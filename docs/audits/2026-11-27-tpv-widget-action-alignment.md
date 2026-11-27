# Alineación del widget TPV con backend y colecciones Wix

Fecha: 2026-11-27  
Estado: MERGED EN MAIN · CI PRE-MERGE PASS · RUNTIME PENDIENTE

## Objetivo

Alinear los controles del widget `#htmlTPV` con las capacidades autorizadas en backend y con el propietario real de cada dato. La identidad del operador procede del miembro Wix autenticado; el estado de sesión procede de `CajaActual`.

## Flujo de usuario y apertura

1. El handshake del widget solicita contexto Wix. `obtenerPermisosTPV` resuelve el miembro mediante `getMyCajeroContext`; cada WebMethod vuelve a autorizar en backend.
2. Al cargar, `CASHIER_STATE` obtiene el estado de sesión y el usuario autenticado.
3. Al pulsar **Abrir caja**, se vuelve a consultar `CASHIER_STATE`. El backend devuelve fecha local Madrid e ID de sesión propuesto. El widget solo muestra esos valores; no los calcula ni los decide.
4. El widget envía `expectedSessionId`. `abrirSesionCaja` lo compara con la fecha del servidor y rechaza una previsualización obsoleta.
5. La apertura actualiza la proyección `CajaActual` y registra auditoría en `ControlOperativo`, bajo locks e idempotencia.

La UI distingue **operador de la sesión** de **usuario autenticado actual**. No atribuye automáticamente al usuario actual la apertura realizada por otra persona.

## Estado Wix observado

Consulta CMS de solo lectura, `consistentRead=true`, colección `CajaActual`: 1 singleton.

El registro actual presenta `cashRegisterStatus=ABIERTA`, `snapshotSource=MOVIMIENTOS_CAJA_RECONCILIADOS`, `traceId=0`, `lastOperationStatus=SIMULATED_SUCCESS`, fecha de apertura 2026-11-21, apertura 300 EUR, efectivo/esperado 320 EUR, tarjeta 25 EUR y referencias POS históricas. No contiene `conceptOperations.tpvRuntime` canónico.

Conclusión: la proyección se clasifica como `LEGACY_UNVERIFIED`; no se considera una sesión TPV vigente ni se reutilizan sus importes. La excepción de apertura está limitada a esa combinación concreta de marcadores legacy. La apertura conserva un resumen de esa proyección dentro de `CajaActual.conceptOperations.tpvRuntime.legacyProjection`, lo marca como no reutilizado y limpia referencias/estados de pago y ticket heredados. Los movimientos históricos no se modifican.

## Matriz de controles

| Control/widget | Mensaje y WebMethod | Fuente/persistencia | Capacidad |
|---|---|---|---|
| Abrir caja | `SESSION_OPEN` → `abrirSesionCaja` | `CajaActual`; auditoría `ControlOperativo` | ADMIN |
| Venta pendiente | `SALE_VALIDATE` / `SALE_REGISTER` → `validarVentaBorrador` / `registrarVenta` | `TransaccionesTPV` y detalle TPV | Personal autorizado; no cobra |
| Entrada/salida | `CASH_MOVEMENT` → `registrarMovimientoCaja` | `MovimientosCaja` + proyección `CajaActual`; control técnico `ControlOperativo` | ADMIN |
| Arqueo parcial | `PARTIAL_CASH_COUNT` → `registrarArqueoParcial` | `MovimientosCaja` + auditoría `ControlOperativo` | ADMIN |
| Ticket X | `TICKET_X` → `generarTicketX` | Lectura de sesión, ventas y movimientos; evidencia append-only en `ControlOperativo` | ADMIN |
| Resumen | `SESSION_SUMMARY` → `obtenerResumenCaja` | Lectura de `TransaccionesTPV` y `MovimientosCaja` | Cajero autorizado |
| Historial | `AUDIT_LIST` → `obtenerAuditoriaTPVLista` | `ControlOperativo` | Cajero autorizado |
| Exportar movimientos | `CASH_MOVEMENTS_EXPORT` → `exportarMovimientosCaja` | `MovimientosCaja` | ADMIN |
| Catálogo/variantes | `CATALOG_*` | Bookings V2 para servicios; Stores Catalog V3 para productos/variantes | Lectura autorizada |
| Personal | `CATALOG_STAFF` | Wix Bookings Staff + `MapaStaff` para correspondencia profesional | Lectura autorizada |
| Clientes | `CUSTOMERS_SEARCH` | Wix Contacts V5 | Lectura autorizada |
| Cierre Z, reembolso, exportación de auditoría | Controles presentes | No se ofrece ejecución hasta disponer del contrato/capacidad correspondiente | Deshabilitados |
| Cobro efectivo/tarjeta y ticket de venta | Controles de pago/impresión | No hay integración de cobro/impresora validada en este flujo | Deshabilitados |

## Ticket X

El backend genera un snapshot `CONTROL_PARCIAL_X` con fecha de sesión, ID, apertura, operador que abrió, usuario que emite, fondo inicial, efectivo esperado, total cobrado y desglose de importes. Es de solo lectura: `readOnly=true`, `closesSession=false`, sin movimiento económico ni cierre Z. La evidencia se registra en `ControlOperativo`; no se inventa una colección de tickets.

El widget presenta un comprobante imprimible mediante el diálogo del navegador (Imprimir/Guardar PDF). No equivale a integración directa con impresora térmica o cajón portamonedas.

## Cambios de código

- `src/public/tpvPageController.js`: exige `expectedSessionId` en la apertura del widget.
- `src/backend/tpv/tpvCaja.web.js`: previsualización de fecha/sesión, lectura de snapshot y validación de apertura.
- `src/backend/tpv/tpvRepository.js`: lectura no mutante de `CajaActual`; excepción legacy acotada al lock/apertura; proyección nueva limpia y metadatos de la anterior.
- `src/backend/tpv/tpvCierres.web.js`: datos ampliados de Ticket X.
- `src/backend/tpv/tpvPermisos.web.js`: capacidades explícitas de lectura, cobro e impresión.
- `#htmlTPV.txt`: botones ligados a capacidades; distingue identidades; deshabilita cobros, reembolsos, ticket de venta, cierre Z y exportación no implementada.
- `src/backend/tests/tpv-widget.contract.test.mjs`: contratos estáticos de alineación y protección legacy.

## Validación y límites

- VERIFICADO: lectura CMS de `CajaActual` y sus valores legacy; lectura de esquemas y colecciones nativas documentadas en la auditoría CMS del mismo día.
- MERGED: PR #658, merge commit `af73da08156a357677131629a30a6cc5bf225bc1`.
- CI pre-merge en HEAD `b2eb170a840862244856ae7ca391703afc225a7e`: Layer 1 29 suites / 380 PASS; Layer 2 16 / 249 PASS; suite offline 81 suites / 767 PASS; contratos Wix Cart, Order Transactions y TPV SDK PASS; ESLint, npm audit y Secret scanning PASS.
- CI post-merge: no se obtuvo run/status asociado al merge commit; no se atribuye PASS post-merge.
- PENDIENTE: Wix Preview; prueba autenticada de apertura; lectura de Ticket X; comprobación de impresión en dispositivo real.
- NO EJECUTADO: no se ha abierto/cerrado caja, escrito CMS, cobrado, reembolsado, generado cierre Z, enviado a AEAT ni publicado el sitio.

No declarar el TPV validado en runtime o producción hasta completar esas pruebas.
