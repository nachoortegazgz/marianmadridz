# Integración del widget HTML TPV — contrato vigente

**Revisión:** 2026-11-21  
**Repositorio:** `nachoortegazgz/marianmadridz`  
**Estado:** contrato de código alineado; instalación en Wix Editor y pruebas runtime pendientes.

## Arquitectura

```text
#htmlTPV.txt (#htmlTPV)
  ↕ postMessage / MM_READY / MM_CONTEXT / mensajes de operación
src/pages/TPV.yl5th.js
  ↓ initializeTpvPage(widget)
src/public/tpvPageController.js
  ↓ createWidgetBridge()
WebMethods de src/backend/tpv/*.web.js
  ↓
tpvSandboxRepository.js / Wix Bookings / Stores Catalog V3
```

El page code solo conecta el HTML Component existente. El controlador es transporte y adaptación DTO; no contiene reglas de autorización ni persistencia. El backend mantiene validación, permisos, idempotencia, locks y escrituras.

## Identidad del componente y handshake

- El ID del componente debe ser exactamente `htmlTPV`.
- `TPV.yl5th.js` importa `initializeTpvPage` desde `public/tpvPageController`.
- El HTML emite `MM_READY`; `createWidgetBridge` valida versión, tipo, tamaño y origen y responde con `MM_CONTEXT`.
- El contexto declara `environment: "SANDBOX"`, `syntheticOnly: true`, `realPaymentsEnabled: false` y `fiscalWritesEnabled: false`.
- El contexto no concede permisos. Cada WebMethod vuelve a comprobar Site Member y rol en backend.
- Se permite origen opaco porque los HTML Components Wix pueden usar iframes sandboxed; se mantienen las restantes validaciones del bridge.

## Contrato de operaciones

| Petición HTML | Respuesta | WebMethod exportado |
|---|---|---|
| `CASHIER_STATE` | `CASHIER_STATE_RES` | `obtenerEstadoCaja` |
| `SESSION_OPEN` | `SESSION_OPEN_RES` | `abrirSesionCaja` |
| `CATALOG_SERVICES` | `CATALOG_SERVICES_RES` | `obtenerServicios` |
| `CATALOG_PRODUCTS` | `CATALOG_PRODUCTS_RES` | `obtenerProductos` |
| `CATALOG_STAFF` | `CATALOG_STAFF_RES` | `obtenerStaff` |
| `SALE_REGISTER` | `SALE_REGISTER_RES` | `registrarVenta` |
| `CASH_MOVEMENT` | `CASH_MOVEMENT_RES` | `registrarMovimientoCaja` |
| `REFUND` | `REFUND_RES` | `registrarDevolucion` |
| `TICKET_X` | `TICKET_X_RES` | `generarControlX` |
| `TICKET_Z` | `TICKET_Z_RES` | `generarCierreZ` |
| `SESSION_SUMMARY` | `SESSION_SUMMARY_RES` | `obtenerResumenCaja` |
| `AUDIT_LIST` | `AUDIT_LIST_RES` | `obtenerMovimientosCaja` |

Estos son los doce nombres públicos requeridos por el controlador. Los WebMethods se encuentran en:
- `tpvCaja.web.js`: estado y apertura.
- `tpvCatalogo.web.js`: servicios, productos y personal sintético.
- `tpvVentas.web.js`: venta sintética.
- `tpvMovimientos.web.js`: movimientos de efectivo.
- `tpvDevoluciones.web.js`: devolución sintética.
- `tpvCierres.web.js`: resumen y tickets X/Z.
- `tpvAuditoria.web.js`: consulta de movimientos/auditoría.

## Adaptación de DTO

- La UI conserva `lineItems` y `payments`; el controlador los adapta al contrato backend `lineas` y `pagos`, incluyendo `medioPago`, `importe` e `importeCambio`.
- Los impuestos se declaran por línea en `impuestosImporte`; el controlador no calcula ni distribuye impuestos.
- El identificador de mensaje se utiliza como clave de idempotencia de las operaciones que la requieren, salvo que el cliente proporcione una clave explícita.
- La devolución envía asignaciones `payments: [{ paymentMethod, amount }]`; el backend contrasta cada medio e importe con los pagos originales y el saldo reembolsable.
- El cierre Z recibe `sessionId`, `countedCash` y `differenceReason`. No se inicia automáticamente una sesión siguiente.
- El widget conserva el borrador y los pagos hasta recibir confirmación de venta.

## Colecciones físicas y persistencia

Los nombres `TPV_SANDBOX_COLLECTIONS.*` son tipos lógicos de evento, no IDs de colecciones CMS.

| Función | Colección física |
|---|---|
| Proyección de sesión activa | `CajaActual` |
| Eventos sintéticos de ventas, líneas, pagos, devoluciones, movimientos, tickets y auditoría | `MovimientosCaja` |
| Locks e idempotencia operativa | `ControlOperativo` |
| Identidades sintéticas de clientes y profesionales | `TpvSandboxIdentities` |

Los eventos lógicos se guardan en `MovimientosCaja` como filas marcadas con `recordSource=TPV_SANDBOX_SYNTHETIC`, `movementType=SIMULATED_TPV_*` y metadatos del `SANDBOX_RUN_ID`. `CajaActual` solo recibe la proyección sintética protegida por el repositorio. No se crean colecciones físicas `SANDBOX_LOGICAL_*`.

El catálogo de servicios se lee mediante Wix Bookings; los productos se leen mediante Stores Catalog V3. Los profesionales proceden de `TpvSandboxIdentities`, no de una colección nativa de Wix Staff ni de datos de contacto privados.

## Límites de seguridad

- `TPV_SANDBOX_RUNTIME_POLICY` mantiene `ENVIRONMENT: "SANDBOX"`, `SYNTHETIC_ONLY: true`, pagos reales deshabilitados y escrituras fiscales deshabilitadas.
- La apertura, venta, movimiento, devolución, arqueos y cierres requieren autorización backend; las operaciones de escritura requieren rol ADMIN según sus WebMethods.
- Los pagos son simulados; no se llama a pasarela ni se captura dinero.
- Las devoluciones son registros sintéticos, no reembolsos bancarios.
- No se escriben `HistoricoCierresZ`, libros contables ni ledgers fiscales desde este flujo.
- No cambiar el entorno a LIVE ni utilizar datos reales para validar esta interfaz.

## Validación y estado

**Verificable en repositorio:** nombres de exportación, importaciones, mensajes, adaptación de DTO, sintaxis del script HTML y mapeo de colecciones.

**Pendiente de ejecución:** CI del cambio, instalación/read-back del HTML Component en Wix Editor, permisos efectivos, Preview, lectura de catálogos en el sitio, apertura/venta/movimiento/devolución/cierre en Sandbox y comprobación de que LIVE permanece intacto.

La presencia del código en GitHub no demuestra que esté instalado en Wix Editor ni que el runtime haya ejecutado las operaciones. No publicar ni ejecutar operaciones sobre LIVE como parte de esta corrección.
