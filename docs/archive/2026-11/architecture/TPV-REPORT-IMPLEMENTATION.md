> **VIGENCIA — 2026-11-20:** este documento conserva el diseño histórico basado en nueve colecciones `TPV_QA_*`, ya eliminadas y no utilizadas. Queda supersedido por TEC-042 y por `docs/audits/2026-11-20-tpv-sandbox-persistence-decision.md`: las entidades QA son tipos lógicos persistidos como eventos sintéticos en `MovimientosCaja` y la sesión/proyección en `CajaActual`. Solo las filas marcadas `TPV_QA_SYNTHETIC`/`SIMULATED_TPV_*` del test-run activo son editables; no se activa el writer fiscal real. Validación runtime Preview/Sandbox pendiente.

---

# TPV — desarrollo basado en la auditoría funcional de Wix

## 1. Fuente funcional y alcance

Fuente funcional primaria: informe Wix aportado por el propietario (`Texto pegado.txt`). Se conservan sus áreas: ventas multilínea, descuentos, impuestos declarados, profesionales/clientes, pagos divididos, tickets suspendidos, devoluciones, gift cards, caja, arqueos, pagos electrónicos, Ticket X, Ticket Z, facturación y auditoría.

Sitio objetivo único:
- Marian Madrid Peluquería y Estética.
- Site ID: `188bed94-177c-4bc9-a9f0-35080d874f3e`.
- Dominio: `https://www.marianmadrid.es/`.
- Wix Classic Editor con Velo habilitado.
- Moneda EUR; zona horaria Europe/Madrid.
- Página TPV ID `yl5th`, ruta `/blank`.
- Studio Two queda expresamente fuera del alcance.

PR #397, PR #398 y PR #399 están fusionadas en `main`. PR #399 aplica la regla SSOT de datos exclusivamente sintéticos. CI: 74 suites / 670 pruebas, 0 fallos; Layer 1, Layer 2, SDK contracts, ESLint y secret scanning correctos.

## 2. Decisión de arquitectura

La auditoría funcional propone entidades operativas separadas. No se reutiliza `MovimientosCaja` como ledger TPV: en el proyecto esa colección tiene semántica de ledger fiscal canónico, con secuencia/hash y flujo de escritura fiscal.

La persistencia de QA utiliza exclusivamente estas nueve colecciones separadas:
- `TPV_QA_Ventas`
- `TPV_QA_VentaLineas`
- `TPV_QA_Pagos`
- `TPV_QA_Reembolsos`
- `TPV_QA_MovimientosCaja`
- `TPV_QA_SesionesCaja`
- `TPV_QA_TicketX`
- `TPV_QA_TicketZ`
- `TPV_QA_Auditoria`

Las nueve colecciones se provisionaron en el sitio actual, con permisos restrictivos e índice único `idempotencyKey`. La comprobación CMS confirmó los nueve índices `ACTIVE` y cero elementos en todas las colecciones. No se insertaron registros de prueba. El acceso de escritura de aplicación exige además clave idempotente y sobre sintético con `isSynthetic=true`, `realPayment=false` y `externalSideEffects=false`.

## 3. Módulos desarrollados

| Módulo | Responsabilidad |
|---|---|
| `tpvCaja.web.js` | Apertura diaria de sesión QA, lectura de estado QA y arqueo parcial |
| `tpvVentas.web.js` | Validación de borrador y saga de venta sintética persistente |
| `tpvMovimientos.web.js` | Entradas, salidas y retiradas sintéticas de efectivo |
| `tpvCatalogo.web.js` | Lectura nativa de servicios Bookings y productos/variantes Stores V3; cliente y profesionales proceden de fixtures sintéticas |
| `tpvGiftCards.web.js` | Bloquea toda consulta de tarjetas regalo reales en QA; no recibe ni transmite códigos |
| `tpvPagos.web.js` | Validación de pagos divididos y cambio, sin llamada a pasarela |
| `tpvDevoluciones.web.js` | Devoluciones sintéticas parciales/totales, ADMIN y locks CAS por venta/sesión |
| `tpvCierres.web.js` | Resumen de sesión, Ticket X no destructivo y Ticket Z QA |
| `tpvAuditoria.web.js` | Consulta autenticada de auditoría QA |
| `tpvPermisos.web.js` | Capacidades permitidas según contexto/rol backend |
| `tpvUtils.web.js` | Configuración y validaciones QA expuestas al frontend |
| `tpvQaRepository.js` | Acceso central a colecciones QA, lectura fuerte, idempotencia y locks CAS de sesión/venta |
| `tpvUtils.js` | Funciones puras para importes, claves, métodos y payload sintético |
| `tpvCierresCore.js` | Agregación reproducible de caja, ventas, pagos y devoluciones |
| `README.md` | Contratos, límites, inventario y pruebas de los módulos |

Todos los WebMethods de mutación QA requieren miembro autenticado y validación backend de rol. Reembolsos y cierre Z requieren ADMIN. Las capacidades que devuelve el módulo de permisos son informativas; cada método vuelve a comprobar autorización en backend.

## 4. Política de datos e integridad

### Colecciones QA
- `TPV_QA_COLLECTIONS` y `TPV_QA_RUNTIME_POLICY` centralizan nombres y configuración.
- `dataAccessPolicy.js` permite insertar en las nueve colecciones QA.
- Las colecciones QA son append-only: no están en las listas de update/remove.
- No se utiliza `suppressAuth` directamente desde módulos TPV.
- Lecturas de idempotencia usan consistencia fuerte.
- Índice CMS único `idempotencyKey` protege frente a duplicados concurrentes.
- La misma clave con payload distinto produce conflicto, no sobrescritura.

### Bloqueo técnico de reembolsos
Las devoluciones de una misma venta se serializan mediante compare-and-swap en `ControlOperativo`, tipo `TPV_QA_REFUND_LOCK`, con expiración y versión. Este registro es un lock técnico, no un ledger: no almacena importes ni sustituye los eventos QA. La política CAS solo permite modificar status, expiresAt, traceId, payload y version bajo condición compare-and-swap.

### Exclusiones innegociables
No se escribe en:
- `CajaActual`
- `MovimientosCaja`
- `HistoricoCierresZ`
- `LibroAsientosContablesDetalle`
- Colecciones fiscales, contables o laborales.

No se ejecutan pagos, checkout, órdenes, devoluciones externas, Bookings writers, Gift Card writers, hardware, notificaciones ni emisión fiscal. La política de runtime QA fija `REAL_PAYMENTS_ENABLED=false`, `FISCAL_WRITES_ENABLED=false`, `CUSTOMER_NOTIFICATIONS_ENABLED=false` y `HARDWARE_ENABLED=false`.

## 5. Flujo persistente de venta QA

1. El cajero autorizado obtiene la sesión QA abierta.
2. El frontend envía el borrador al validador backend.
3. El backend valida líneas, cantidades, descuentos, impuestos declarados y pagos divididos en céntimos.
4. Se exige total pendiente cero y sesión QA abierta.
5. Se inserta la cabecera `PREPARADA_SINTETICA`.
6. Se insertan las líneas y los pagos simulados.
7. Se inserta la cabecera `CONFIRMADA_SINTETICA`.
8. Se añade evento de auditoría.

Cada evento utiliza clave derivada de la clave cliente. Un reintento reanuda los pasos ya escritos y solo inserta los que falten. Los informes solo agregan ventas confirmadas. Las consultas CMS recorren páginas de hasta 1.000 registros y fallan cerradas si superan 10.000; Ticket Z bloquea el cierre si detecta ventas PREPARADA sin una confirmación correspondiente. La escritura entre varias colecciones no es una transacción ACID; el estado PREPARADA permite detectar una operación parcial.

## 6. Pagos y caja QA

Los métodos admitidos son EFECTIVO, TARJETA, BIZUM y OTROS. Se usan unidades menores (céntimos). En efectivo:
- `importe` es efectivo recibido.
- `importeCambio` es cambio entregado.
- `importeAplicado = importe - importeCambio`.
- El impacto de caja física es el importe aplicado.

Los pagos de tarjeta/Bizum/otros son registros simulados con proveedor `SIMULATED` y referencia `QA-NO-GATEWAY`. No se invoca Wix Payments ni un proveedor externo.

Una sesión por día local Europe/Madrid se crea con clave idempotente determinista. Arqueos parciales y movimientos se insertan como eventos. Ticket X es una instantánea no destructiva. Ticket Z crea un registro de cierre de la sesión QA y no cierra caja real, periodo fiscal ni ledger.

## 7. Devoluciones QA

- Requieren ADMIN.
- La venta original debe estar confirmada y pertenecer a la sesión QA abierta.
- Las asignaciones por método deben coincidir con medios de pago originales y no superar el importe restante no reembolsado.
- Un lock compare-and-swap por venta evita dos reembolsos concurrentes que excedan el saldo disponible.
- La cabecera, los pagos negativos, los movimientos de efectivo y la auditoría se insertan idempotentemente.
- No se llama a la API de refund de un proveedor ni se devuelve dinero real.

## 8. Integración frontend

`src/public/tpvPageController.js` conecta el HTML Component con los WebMethods QA. El HTML `#htmlTPV.txt` incluye:
- apertura de sesión QA;
- validación y guardado persistente de venta sintética;
- movimientos y arqueos parciales;
- devoluciones sintéticas;
- resumen, Ticket X y Ticket Z QA;
- consulta de auditoría persistida;
- lectores de Bookings y Stores;
- búsqueda limitada al cliente fixture `Nacho Pitt` (`nacho.pitt@example.test`), sin consultar CRM;
- profesionales fixture sintéticas, sin consultar Bookings Staff;
- consulta y vinculación de reservas reales deshabilitadas;
- consulta de saldo real de Gift Cards deshabilitada y sin transmisión de códigos.

Las reservas, órdenes, cobros reales, emisión/canje de Gift Cards, facturación y operaciones fiscales permanecen bloqueadas.

## 9. Estado de integración y validación

**Verificado históricamente en Wix CMS:**
- nueve colecciones QA creadas;
- nueve índices idempotentes `ACTIVE`;
- cero elementos en las nueve colecciones.

**Discrepancia CMS posterior que bloquea escritores operativos:**
- `CajaActual`: revisión 17; insert `SITE_MEMBER`, update/remove/read `SITE_MEMBER_AUTHOR`;
- `MovimientosCaja`: revisión 108; insert `SITE_MEMBER`, update/remove/read `SITE_MEMBER_AUTHOR`;
- `ControlOperativo`: revisión 80; insert/update/remove `ADMIN`, read `ANYONE`;
- permisos de items no incluidos en la lectura actual; pendientes de consulta específica;
- permisos de items e insert/update/remove pendientes de lectura directa y conciliación. No se han mutado permisos en esta fase.

**Verificado en CI sobre HEAD `82525384c337306d99dc958e6cb17ede41eac83b` (run 1481):**
- Layer 1: 28 suites / 331 pruebas, 0 fallos;
- Layer 2: 19 suites / 255 pruebas, 0 fallos;
- regresión offline completa: 74 suites / 670 pruebas, 0 fallos;
- contratos de SDK Wix Stores/eCommerce y Bookings correctos; ESLint y secret scanning correctos;
- contratos de WebMethods, aislamiento de datos, locks CAS, UI/HTML y parseo del script inline correctos.

**Pendiente de ejecutar en el entorno Wix:**
- duplicados e idempotencia contra CMS real;
- concurrencia y recuperación de locks CAS de sesión/reembolso;
- reanudación ante fallos parciales entre colecciones;
- Preview con roles ADMIN, GESTION, ESTILISTA, miembro y visitante anónimo.

Las ejecuciones intermedias detectaron aserciones de pruebas desactualizadas y una duplicidad en el conjunto esperado de tipos; se corrigieron y la ejecución final de CI terminó correctamente.

## 10. Sincronización y despliegue

Los módulos y la interfaz TPV están versionados en `main` tras PR #397, #398 y #399. `wix.config.json` enlaza el repositorio con el Site ID y el setup oficial confirma soporte para Wix Editor (Classic); el merge de PR #399 debe sincronizar el código con el Editor, pendiente de read-back. No se ha ejecutado Preview ni Publish. La versión publicada no se considera actualizada.

Siguiente fase segura:
1. confirmar read-back del commit en GitHub Integration del Editor;
2. configurar `CLI_API_KEY` con permiso `Wix CLI for Sites - Git Integration`;
3. ejecutar `.github/workflows/wix-tpv-preview.yml` para crear Preview (sin publicar);
4. probar únicamente carga/lecturas y permisos; no ejecutar acciones que escriban;
5. confirmar pasarela desconectada, neutralizar automatizaciones y revalidar permisos CMS;
6. mantener `wix publish` bloqueado hasta completar E2E y revisión de riesgos.

Studio Two no ha sido consultado ni modificado.
