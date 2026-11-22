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

El contexto se obtiene mediante `obtenerConfiguracionTPV` y confirma únicamente acceso autorizado, moneda y zona horaria. La interfaz no inspecciona etiquetas de entorno ni flags booleanos para habilitar el flujo. El aislamiento de datos lo proporciona el data plane Sandbox seleccionado en Wix; las autorizaciones siguen aplicándose en backend.

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

`obtenerConfiguracionTPV` es el WebMethod adicional de contexto funcional (moneda y zona horaria) y no sustituye ninguno de los doce nombres anteriores. El controlador importa cada módulo WebMethod con el sufijo Wix `.web` (por ejemplo, `backend/tpv/tpvCaja.web`); no debe importar módulos backend privados sin ese sufijo.

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
- **Cliente:** el botón busca identidades sintéticas mediante `buscarClientesTPV`; se envía `customerIdentityId`/ y el backend vuelve a validar que pertenece al conjunto Sandbox.
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


## 5 bis. Correspondencia funcional y persistencia canónica

| Elemento del HTML | Mensaje | WebMethod / servicio | Persistencia o sistema nativo | Estado |
|---|---|---|---|---|
| Abrir caja | `SESSION_OPEN` | `abrirSesionCaja` · `tpvCaja.web.js` | Singleton `CajaActual` | Escritura de proyección |
| Estado de caja | `CASHIER_STATE` | `obtenerEstadoCaja` | `CajaActual` | Lectura |
| Actualizar | llamadas de estado y catálogo | `obtenerEstadoCaja`, `obtenerServicios`, `obtenerStaff`, `obtenerProductos` | Wix Bookings, Wix Stores Catalog V3 y colección de identidades de prueba | Lectura |
| Buscar catálogo | filtro local | HTML | Datos ya cargados | Solo frontend |
| Elegir variante | `CATALOG_VARIANTS` | `obtenerVariantesProducto` | Wix Stores Catalog V3 | Lectura |
| Elegir operador | `CATALOG_STAFF` | `obtenerStaff` | `TpvSandboxIdentities` | Identidad sintética; no es Wix Staff |
| Elegir cliente | `CUSTOMERS_SEARCH` | `buscarClientesTPV` | `TpvSandboxIdentities` | Identidad sintética; no es Wix Contacts |
| Añadir tarifa propia | local | HTML + validación de `registrarVenta` | Se persiste como línea TPV tipada | No inventa ID de catálogo |
| Guardar venta | `SALE_REGISTER` | `registrarVenta` | Eventos append-only en `MovimientosCaja`; proyección en `CajaActual`; locks en `ControlOperativo` | Operación de prueba |
| Entrada / salida | `CASH_MOVEMENT` | `registrarMovimientoCaja` | `MovimientosCaja` + proyección `CajaActual` | Operación de prueba |
| Devolución | `REFUND` | `registrarDevolucion` | Eventos de devolución y pagos compensatorios en `MovimientosCaja` | No ejecuta reembolso de proveedor |
| Control X | `TICKET_X` | `generarControlX` | `MovimientosCaja` | Informe no destructivo |
| Cierre Z | `TICKET_Z` | `generarCierreZ` | `MovimientosCaja` + proyección `CajaActual` | Cierre de sesión de prueba |
| Resumen | `SESSION_SUMMARY` | `obtenerResumenCaja` | Agregación de eventos de `MovimientosCaja` | Lectura |
| Movimientos | `AUDIT_LIST` | `obtenerMovimientosCaja` | `MovimientosCaja` | Lectura de movimientos, no auditoría de seguridad |
| Imprimir | acción local | `window.print()` | Impresión del navegador | No usa impresora nativa Wix POS |

### Identidad de colecciones

Los únicos IDs físicos de CMS para la caja son `CajaActual`, `MovimientosCaja` y `ControlOperativo`. `cashRegisterStatus=SIMULACION` se conserva como estado de proyección de prueba reconocido por los módulos transversales de caja; no es una comprobación booleana de entorno ni un nombre de colección. No sustituirlo por `ABIERTA`, porque `src/backend/cajas.web.js` utiliza ese sentinel para evitar que una sesión de prueba se trate como operativa. El repositorio TPV ya los resuelve mediante `BUSINESS_COLLECTIONS.CAJA_ACTUAL`, `BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA` y `OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO`. Los valores `SANDBOX_LOGICAL_*` son discriminadores internos de evento dentro de `MovimientosCaja`, no nombres de colecciones Wix ni tablas paralelas. No se deben crear colecciones con esos nombres.

### Alcance real de las integraciones nativas

- Bookings y Stores Catalog V3 se consultan mediante sus SDK nativos. El catálogo no crea ni modifica reservas, productos ni inventario.
- La pantalla POS del Dashboard Wix es la referencia visual/funcional. El HTML Component no es una extensión del Dashboard POS ni invoca internamente sus botones o terminal.
- La venta TPV actual no crea un pedido Wix eCommerce ni una transacción de pago nativa. Los medios efectivo/tarjeta/Bizum/otros son datos de prueba; no confirman un cobro.
- La devolución TPV registra una devolución interna de prueba; no ejecuta refund en Wix Payments.
- Gift Cards, facturación fiscal, notificaciones y hardware no forman parte de los mensajes activos del widget.

### Handshake sin indicadores de entorno

`MM_CONTEXT` solo comunica el resultado del contexto autenticado y los datos funcionales (moneda y zona horaria). El HTML no evalúa `environment`, `previewOnly`, `syntheticOnly` ni flags true/false para arrancar. La separación de colecciones la realiza Wix CMS Sandbox cuando se usa el editor/preview configurado para ello; los WebMethods mantienen autorización, validación, idempotencia y controles de integridad.

## 6. Persistencia y colecciones

`TPV_COLLECTIONS` contiene tipos de evento internos, no IDs ni nombres de colecciones físicas. La persistencia actual proyecta eventos sintéticos sobre:
- `MovimientosCaja`: ledger append-only de eventos sintéticos.
- `CajaActual`: proyección operativa de la sesión, protegida por marcador Sandbox y preseed.
- `ControlOperativo`: locks compare-and-swap de sesión/devolución.
- colección propia de identidades Sandbox: clientes y personal sintéticos.

No se modifica la estructura ni se elimina el índice único `transactionId_unique`. Las correcciones de eventos persistidos requieren nuevos registros trazables, nunca reescritura histórica.

## 7. Límites de entorno

El HTML Component no contiene verificaciones de `environment`, `previewOnly` ni flags sintéticos true/false. Las pruebas se ejecutan en el data plane Sandbox seleccionado en Wix. Los registros generados siguen siendo registros de prueba y no activan operaciones de cobro, facturación ni efectos externos.

No se habilitan por este cambio cobros reales, devoluciones reales, facturas, notificaciones, hardware ni sincronización de colecciones Wix Apps. Las colecciones de Wix Apps no heredan el aislamiento de Sandbox CMS.

## 8. Validación y pendientes

**Verificado en repositorio y CI (commit `e790f7ed361e822fbbca1de8298456a80172b9e1`):** Layer 1 28 suites/343 tests; Layer 2 19 suites/268 tests; regresión offline completa 77 suites/724 tests, 0 fallos; contratos SDK Wix eCommerce/TPV y ESLint correctos. Backend offline quality gates: run `44858255145` SUCCESS. Gitleaks: run `44858255191` SUCCESS. Los contratos estáticos confirman las doce exportaciones y sus imports `.web`.

**Pendiente de ejecutar:** Wix Local Editor, Preview, permisos con roles reales, disponibilidad de catálogo real en el sitio, preseed de `CajaActual`/identidades, ventas/devoluciones/cierres E2E y verificación de que el HTML fuente está instalado en el componente Wix. La CI offline no acredita ejecución runtime ni separación efectiva Sandbox/Live.

El código versionado no demuestra por sí solo sincronización del Editor ni ejecución runtime. No publicar ni ejecutar operaciones LIVE como parte de esta corrección.


Las operaciones de escritura (apertura, venta, movimiento, devolución y X/Z) conservan el `requireAdmin` vigente; elegir un operador sintético solo atribuye la operación y no concede permisos. Las consultas usan `requireCajero`.


No se descuenta inventario ni se escribe en Stores durante la simulación.
