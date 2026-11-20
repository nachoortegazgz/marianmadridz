# TPV — módulos backend Velo

## Alcance y estado

El directorio implementa el TPV de pruebas en modo Sandbox sintético. Los WebMethods de escritura persisten eventos de prueba en colecciones aisladas `TPV_QA_*`; las operaciones de cobro real, checkout, órdenes, reembolsos de proveedor, emisión fiscal, notificaciones y hardware no están habilitadas.

La configuración canónica está en `backend/internalConfig.js` (`TPV_QA_COLLECTIONS` y `TPV_QA_RUNTIME_POLICY`). No sustituir estos nombres lógicos por colecciones operativas. Las colecciones Wix de Apps nativas permanecen bajo su propio ciclo de vida y no forman parte del repositorio TPV.

## Límites de seguridad e integridad

- Las colecciones `TPV_QA_*` son append-only: el acceso central permite inserción y lectura, no actualización ni borrado.
- La idempotencia se basa en `idempotencyKey`, lectura fuerte y reconciliación de la carrera de inserción; el índice CMS único correspondiente debe existir y estar verificado en el entorno.
- `ControlOperativo` se usa exclusivamente para el lock técnico de reembolso `TPV_QA_REFUND_LOCK`, con compare-and-swap y campos acotados. No es un ledger de ventas.
- No se escribe en `CajaActual`, `MovimientosCaja`, `HistoricoCierresZ`, `LibroAsientosContablesDetalle` ni en colecciones fiscales/contables/laborales.
- Ticket Z cierra únicamente la sesión sintética del TPV; no cierra caja operativa ni periodos fiscales.
- La separación Sandbox/Online de Wix no sustituye el aislamiento lógico y de permisos del TPV. No retirar las barreras `assertTpvQaEnabled` ni la lista permitida del repositorio sin un diseño de migración aprobado y pruebas de seguridad.
- Las colecciones de Wix Apps (Bookings, Stores, Gift Cards, etc.) son independientes. Este código solo consume los lectores nativos indicados; no presupone que sus colecciones internas sean accesibles o modificables.

## Inventario de módulos

| Archivo | Responsabilidad |
|---|---|
| `tpvCaja.web.js` | Lectura de estado de caja operativo (solo lectura), apertura diaria sintética, sesión y arqueo parcial |
| `tpvMovimientos.web.js` | Entradas, salidas y retiradas sintéticas |
| `tpvVentas.web.js` | Validación de borrador y persistencia idempotente de venta sintética; la operación de venta real permanece deshabilitada |
| `tpvPagos.web.js` | Validación de medios mixtos; no ejecuta pasarelas |
| `tpvDevoluciones.web.js` | Reembolso sintético parcial/total, ADMIN y lock por venta |
| `tpvCierres.web.js` | Resumen, Ticket X y cierre de sesión sintética Ticket Z |
| `tpvReportes.web.js` | Consultas y previsualización de informes |
| `tpvCatalogo.web.js` | Lectura nativa de Bookings y Stores Catalog V3 |
| `tpvGiftCards.web.js` | Consulta de saldo/estado de tarjetas regalo; solo lectura |
| `tpvAuditoria.web.js` | Consulta de auditoría persistida |
| `tpvPermisos.web.js` | Capacidades derivadas de la autorización backend |
| `tpvUtils.web.js` | Configuración y validaciones auxiliares expuestas |
| `tpvUtils.js` | Política runtime, importes en unidades menores, idempotencia y payload sintético |
| `tpvValidation.js` | Validación pura del borrador de venta y desglose de pagos |
| `tpvQaRepository.js` | Persistencia central, idempotencia, lectura fuerte y lock de reembolso |
| `tpvCierresCore.js` | Agregación reproducible de ventas, pagos, devoluciones y efectivo |

## Contratos relevantes

Los exports públicos de los módulos WebMethod usan nombres neutrales de operación (por ejemplo, `obtenerSesionCaja`, `abrirCaja`, `registrarMovimientoCaja`, `registrarVenta`, `solicitarDevolucion`, `obtenerResumenSesion`, `generarTicketX`, `cerrarTicketZ`, `consultarAuditoriaTPV` y `obtenerPermisosTPV`). El carácter sintético se aplica internamente y no debe inferirse del nombre del método.

Los métodos se exponen con `Permissions.SiteMember`, pero esto no constituye autorización de negocio suficiente: cada operación protegida invoca `requireCajero` o `requireAdmin` en backend. No eliminar estas comprobaciones.

## Flujo de venta sintética

1. Un miembro con rol de cajero solicita la sesión sintética abierta.
2. El backend valida el borrador y el desglose en céntimos.
3. `registrarVenta` exige sesión abierta y pago completamente cuadrado.
4. Inserta eventos de preparación, líneas, pagos y confirmación sintética.
5. Cada evento usa una clave idempotente; los reintentos reanudan pasos sin duplicar eventos ya insertados.
6. Se registra auditoría. No se inicia autorización, captura, pedido ni movimiento fiscal.

La persistencia en varias colecciones no es una transacción ACID. El estado preparado y la confirmación final permiten identificar escrituras parciales; los informes solo agregan ventas confirmadas.

## Flujo de reembolso sintético

- Requiere ADMIN y sesión abierta.
- La venta original debe estar confirmada y pertenecer a la sesión activa.
- Las asignaciones por medio no pueden superar el importe original no reembolsado.
- Un lock distribuido por venta serializa solicitudes concurrentes.
- Cabecera, pagos negativos, movimiento de efectivo y auditoría son eventos sintéticos idempotentes.
- No se llama a ningún proveedor externo.

## Sesión y cierres

- Una sesión por día local de `Europe/Madrid`, con clave idempotente determinista.
- Los arqueos parciales se registran como eventos; no mutan la sesión.
- Ticket X persiste una instantánea no destructiva.
- Ticket Z registra el cierre sintético de sesión con diferencia y motivo; no afecta al cierre operativo o fiscal.

## Pruebas y validación

Suites relevantes:
- `src/backend/tests/tpv.web-modules.contract.test.mjs`
- `src/backend/tests/tpv-widget.contract.test.mjs`
- `src/backend/tests/tpv-ui.qa-source.test.mjs`
- `src/backend/tests/tpv.qa.persistence.policy.test.mjs`

Ejecutar `npm test`, `npm run test:layer1` y `npm run lint` antes de sincronizar con Wix Classic. La suite local no acredita por sí sola el runtime Wix. La validación E2E requiere Preview con roles ADMIN, GESTION, ESTILISTA y miembro sin rol, y comprobar aislamiento Sandbox/Online.

## Estado de integración

Esta documentación describe el diseño del código versionado en la rama de trabajo. No equivale a certificación runtime ni a publicación. La pasarela y las operaciones fiscales permanecen deshabilitadas. Registrar aquí los resultados de CI y de Preview solo después de ejecutarlos; no marcar módulos como validados por inspección estática.
