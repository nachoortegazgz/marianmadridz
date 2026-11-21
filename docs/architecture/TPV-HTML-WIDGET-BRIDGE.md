# TPV Marian Madrid — contrato vigente HTML / Velo / backend

**Estado:** contrato de código en revisión; validación Wix Runtime pendiente.  
**Página:** `src/pages/TPV.yl5th.js` · **HTML Component:** `#htmlTPV` · **HTML fuente:** `#htmlTPV.txt`  
**Controlador:** `src/public/tpvPageController.js` · **Puente:** `src/public/widgetBridge.js`

## 1. Modelo funcional

La interfaz toma como referencia operativa la página POS nativa de Wix Dashboard y añade controles propios de Marian Madrid. No crea un catálogo, una pasarela de pagos ni un ledger alternativos.

- **Wix Bookings:** lectura de servicios mediante `services.queryServices`.
- **Wix Stores:** lectura de productos y variantes mediante Stores Catalog V3; se respeta `visibleInPos`.
- **Personal:** en el entorno Sandbox se consultan identidades sintéticas propias; no se convierten en Wix Members, contactos CRM ni staff nativo.
- **Operaciones extendidas:** apertura/estado de sesión, venta sintética, movimientos, devolución sintética, Control X, Cierre Z, resumen y consulta de movimientos.
- **Pagos:** la interfaz registra únicamente métodos y cantidades sintéticos. No llama a Wix Payments, checkout, Orders ni a una pasarela real.
- **Fiscalidad:** no se emiten facturas ni se escriben ledgers fiscales.

La interfaz custom no sustituye ni duplica el proceso nativo de cobro de Wix POS.

## 2. Transporte y seguridad

`src/pages/TPV.yl5th.js` adjunta `initializeTpvPage(widget)` al componente existente `$w("#htmlTPV")`.

El controlador usa `createWidgetBridge` para:
- validar mensajes, versión, tamaño y correlación;
- usar `onMessage/postMessage` del HTML Component;
- admitir el origen opaco propio del iframe Wix sin desactivar la validación de orígenes no opacos;
- gestionar `MM_READY` / `MM_CONTEXT`;
- delegar toda operación de negocio a WebMethods backend.

No se utiliza `postMessage(..., "*")` desde el controlador. El HTML no accede a CMS, backend ni APIs Wix directamente.

El contexto se obtiene mediante `obtenerConfiguracionTPV`. La UI solo habilita el flujo si el backend confirma `environment="SANDBOX"`; el contexto indica `previewOnly=true`, `syntheticOnly=true` y capacidades externas deshabilitadas.

## 3. Contrato exacto de WebMethods

Los doce nombres exportados requeridos son:

| Exportación backend | Módulo | Responsabilidad |
|---|---|---|
| `obtenerEstadoCaja` | `tpvCaja.web.js` | Leer sesión Sandbox abierta |
| `abrirSesionCaja` | `tpvCaja.web.js` | Abrir sesión sintética, con autorización backend |
| `obtenerServicios` | `tpvCatalogo.web.js` | Consultar catálogo de Bookings |
| `obtenerProductos` | `tpvCatalogo.web.js` | Consultar Stores Catalog V3 |
| `obtenerStaff` | `tpvCatalogo.web.js` | Leer identidades sintéticas de personal |
| `registrarVenta` | `tpvVentas.web.js` | Persistir venta sintética idempotente |
| `registrarMovimientoCaja` | `tpvMovimientos.web.js` | Persistir entrada/salida sintética |
| `registrarDevolucion` | `tpvDevoluciones.web.js` | Registrar devolución sintética por método original |
| `generarControlX` | `tpvCierres.web.js` | Generar informe X sin cerrar sesión |
| `generarCierreZ` | `tpvCierres.web.js` | Conciliar efectivo y cerrar sesión Sandbox |
| `obtenerResumenCaja` | `tpvCierres.web.js` | Obtener resumen de sesión |
| `obtenerMovimientosCaja` | `tpvMovimientos.web.js` | Consultar movimientos de caja sintéticos |

`obtenerConfiguracionTPV` es el WebMethod adicional de contexto y no sustituye ninguno de los doce nombres anteriores.

Los WebMethods devuelven el sobre `{ status, data, error }`. El controlador reenvía ese sobre sin anidarlo dentro de otro `data`.

## 4. Mensajes activos

Cada solicitud se responde con el mismo `messageId` y el sufijo `_RES`.

| Mensaje HTML | Respuesta | Backend |
|---|---|---|
| `CASHIER_STATE` | `CASHIER_STATE_RES` | `obtenerEstadoCaja` |
| `SESSION_OPEN` | `SESSION_OPEN_RES` | `abrirSesionCaja` |
| `CATALOG_SERVICES` | `CATALOG_SERVICES_RES` | `obtenerServicios` |
| `CATALOG_PRODUCTS` | `CATALOG_PRODUCTS_RES` | `obtenerProductos` |
| `CATALOG_VARIANTS` | `CATALOG_VARIANTS_RES` | `obtenerVariantesProducto` (consulta adicional de variantes) |
| `CATALOG_STAFF` | `CATALOG_STAFF_RES` | `obtenerStaff` |
| `CUSTOMERS_SEARCH` | `CUSTOMERS_SEARCH_RES` | `buscarClientesTPV` (consulta adicional de identidades sintéticas) |
| `SALE_REGISTER` | `SALE_REGISTER_RES` | `registrarVenta` |
| `CASH_MOVEMENT` | `CASH_MOVEMENT_RES` | `registrarMovimientoCaja` |
| `REFUND` | `REFUND_RES` | `registrarDevolucion` |
| `TICKET_X` | `TICKET_X_RES` | `generarControlX` |
| `TICKET_Z` | `TICKET_Z_RES` | `generarCierreZ` |
| `SESSION_SUMMARY` | `SESSION_SUMMARY_RES` | `obtenerResumenCaja` |
| `AUDIT_LIST` | `AUDIT_LIST_RES` | `obtenerMovimientosCaja` |

## 5. Conciliación de botones y DTOs

- **Abrir caja:** envía `openingCash` y `terminalId`; backend exige rol autorizado y sesión válida.
- **Operador:** se elige entre identidades sintéticas devueltas por `CATALOG_STAFF`; el ID se envía como `profesionalId` al registrar la venta.
- **Cliente:** el botón busca identidades sintéticas mediante `buscarClientesTPV`; se envía `customerContactId` y el backend vuelve a validar que pertenece al conjunto Sandbox.
- **Catálogo:** servicios y productos provienen de las APIs nativas de Bookings y Stores. La paginación de productos usa cursor; servicios usan paginación por offset. Los productos con variantes consultan `obtenerVariantesProducto`; se guarda `varianteId` en la línea y se utiliza el precio de la variante elegida, no el mínimo del producto.
- **Guardar venta:** el controlador transforma `lineItems/payments/subtotal/tax/total` al DTO backend `lineas/pagos/subtotalNeto/impuestosTotal/totalVenta`. Cada pago se convierte a `medioPago/importe/importeCambio`. El HTML conserva una clave idempotente por operación y sesión en `sessionStorage` (con fallback en memoria); el controlador la valida y la pasa al WebMethod. El `messageId` queda como fallback de correlación, no como sustituto de la clave estable.
- **Tarifa personalizada:** se representa como línea `PERSONALIZADA`, conservando concepto e importe; no se finge un ID de catálogo.
- **Impuestos:** el campo global queda deshabilitado hasta mapear y verificar las reglas fiscales de Wix por línea. El controlador rechaza discrepancias entre impuestos por línea y total declarado; no distribuye impuestos por estimación.
- **Entrada/salida:** requiere importe positivo y motivo; el backend genera clave idempotente y exige autorización.
- **Devolución:** envía `saleId`, motivo y asignación explícita `payments[{ paymentMethod, amount }]`. No se infiere el método original.
- **Control X:** no solicita efectivo contado y no cierra sesión.
- **Cierre Z:** solicita efectivo contado y motivo si existe diferencia; no utiliza `nextOpeningCash`.
- **Resumen y movimientos:** consultas separadas; `AUDIT_LIST` devuelve movimientos de caja, no el ledger de auditoría de seguridad.
- **Imprimir último ticket:** actualmente invoca la impresión del navegador; no representa una integración verificada con impresora fiscal o hardware POS.

## 6. Persistencia y colecciones

`TPV_SANDBOX_COLLECTIONS` contiene nombres lógicos internos, no IDs de colecciones físicas. La persistencia actual proyecta eventos sintéticos sobre:
- `MovimientosCaja`: ledger append-only de eventos sintéticos.
- `CajaActual`: proyección operativa de la sesión, protegida por marcador Sandbox y preseed.
- `ControlOperativo`: locks compare-and-swap de sesión/devolución.
- colección propia de identidades Sandbox: clientes y personal sintéticos.

No se modifica la estructura ni se elimina el índice único `transactionId_unique`. Las correcciones de eventos persistidos requieren nuevos registros trazables, nunca reescritura histórica.

## 7. Límites de entorno

La configuración vigente del backend declara `ENVIRONMENT="SANDBOX"`, `SYNTHETIC_ONLY=true`, pagos reales deshabilitados y escrituras fiscales deshabilitadas. No se transforma este contrato a LIVE renombrando métodos ni cambiando etiquetas.

No se habilitan por este cambio cobros reales, devoluciones reales, facturas, notificaciones, hardware ni sincronización de colecciones Wix Apps. Las colecciones de Wix Apps no heredan el aislamiento de Sandbox CMS.

## 8. Validación y pendientes

**Verificado en repositorio:** nombres de WebMethods, mapeo de mensajes, DTOs, control de impuestos por línea, uso del bridge compartido y guardas Sandbox.

**Pendiente de ejecutar:** suite CI completa, Wix Local Editor, Preview, permisos con roles reales, disponibilidad de catálogo real en el sitio, preseed de `CajaActual`, ventas/devoluciones/cierres E2E y verificación de que el HTML fuente está instalado en el componente Wix.

El código versionado no demuestra por sí solo sincronización del Editor ni ejecución runtime. No publicar ni ejecutar operaciones LIVE como parte de esta corrección.


Las operaciones de escritura (apertura, venta, movimiento, devolución y X/Z) conservan el `requireAdmin` vigente; elegir un operador sintético solo atribuye la operación y no concede permisos. Las consultas usan `requireCajero`.
