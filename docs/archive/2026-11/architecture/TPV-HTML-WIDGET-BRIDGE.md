# TPV Marian Madrid — contrato vigente HTML / Velo / backend

**Estado:** PR #572 y PR #580 integradas en main; CI de PR #580 SUCCESS (79 suites / 740 pruebas offline). Wix Editor/Preview/Runtime siguen pendientes de validación.  
**Página:** `src/pages/TPV.yl5th.js` · **HTML Component:** `#htmlTPV` · **HTML fuente:** `#htmlTPV.txt`  
**Controlador:** `src/public/tpvPageController.js` · **Puente:** `src/public/widgetBridge.js`

## 1. Modelo funcional

La interfaz toma como referencia operativa la página POS nativa de Wix Dashboard y añade controles propios de Marian Madrid. No crea un catálogo, una pasarela de pagos ni un ledger alternativos.

- **Wix Bookings:** lectura de servicios mediante `services.queryServices`.
- **Wix Stores:** lectura de productos y variantes mediante Stores Catalog V3; se respeta `visibleInPos`.
- **Clientes y profesionales:** clientes desde Wix CRM Contacts V5 y profesionales desde Wix Bookings Staff, vinculados mediante `MapaStaff.resourceId`.
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
- permitir explícitamente los mensajes entrantes `MM_READY` y `MM_CONTEXT`, además de las solicitudes TPV;
- gestionar `MM_READY` / `MM_CONTEXT` y las respuestas `*_RES`;
- delegar toda operación de negocio a WebMethods backend.

### 2.1 Handshake y errores conocidos

El flujo tiene dos mensajes distintos:
1. El iframe envía `MM_READY`; el controlador recibe el evento Wix `onMessage` y responde con `MM_CONTEXT`.
2. El iframe valida `status=SUCCESS`, `data.component=htmlTPV` y `data.protocolVersion=1`. Solo entonces inicia catálogo, staff y estado de caja.

Correcciones integradas en main mediante PR #572 y PR #580:
- `MESSAGE_TYPES.CONTEXT` se incluye en `allowedTypes`. Antes se permitía recibir `MM_READY`, pero `send(MM_CONTEXT)` se rechazaba por el mismo filtro de tipos; eso explica el registro `WIDGET_MESSAGE_TYPE_NOT_ALLOWED` al publicar el contexto.
- El iframe reenvía `MM_READY` cada 500 ms, hasta 120 intentos (60 s), con `messageId` nuevo. PR #580 amplía la ventana de reintentos para dejar 5 s de margen antes del watchdog Velo de 65 s. Esto cubre la carrera en la que el iframe termina de cargar antes de que el page code haya registrado `onMessage`; el controlador ignora los READY duplicados una vez completado el handshake.
- Las llamadas de negocio ya no se disparan inmediatamente después del primer `postMessage(MM_READY)`; esperan un `MM_CONTEXT` válido. Esto evita solicitudes iniciales perdidas o prematuras.
- El controlador actual permite `MM_READY`, `MM_CONTEXT` y todos los tipos de solicitud del HTML Component.
- El watchdog específico del TPV es de 65 s; el iframe reintenta `MM_READY` 120 veces cada 500 ms (60 s), con un margen de 5 s.
- Un rechazo `WIDGET_MESSAGE_TYPE_NOT_ALLOWED` registra ahora `receivedType`, `receivedVersion` y `allowedTypes`; los fallos al enviar también incluyen `attemptedType` y allowlist. Los detalles no incluyen payloads de negocio.
- Los fallos al publicar `MM_CONTEXT` conservan `causeCode` y `causeDetail`, de modo que se distingue un rechazo del tipo de un fallo al obtener configuración.

Diagnóstico actualizado:
- La causa histórica del rechazo de `MM_CONTEXT` fue que el mismo allowlist se aplicaba a mensajes entrantes y salientes, y `MM_CONTEXT` no estaba incluido. PR #572 lo corrigió y está fusionada en `main`.
- PR #572 sustituyó la emisión única de `MM_READY` por reintentos y corrigió la allowlist de `MM_CONTEXT`; PR #580 amplió los reintentos de 25 s a 60 s para mantenerlos activos hasta 5 s antes del watchdog.
- Revisión adicional: el HTML repetía `MM_READY` durante 25 s (50 × 500 ms), mientras el watchdog Velo esperaba 65 s. Esa ventana desigual podía dejar de emitir antes de que el controlador estuviera listo. Se amplía a 120 intentos (60 s), dejando 5 s de margen antes del watchdog; el test contractual comprueba matemáticamente la relación entre ambas ventanas.
- Si los errores persisten con el código actual, el próximo log debe mostrar el tipo recibido y el allowlist activo. Si el tipo recibido es `MM_CONTEXT` o la allowlist no contiene `MM_CONTEXT`, el código de página Velo ejecutado en Wix no está sincronizado con el código versionado. Si el tipo es otra solicitud, debe compararse literalmente con `REQUEST_TYPES`.

**Validación GitHub:** PR #580 integrada en `main`; CI de PR SUCCESS: Layer 1 30 suites / 369 PASS, Layer 2 17 suites / 245 PASS, suite offline 79 suites / 740 PASS, además de SDK Cart V2, Order Transactions, TPV SDK, ESLint y Secret scanning. Estas pruebas no acreditan Wix Preview/Runtime.

**Límite:** el merge de GitHub no acredita sincronización del Editor Wix. La verificación definitiva exige comprobar el SHA Velo instalado en Wix Draft, aplicar/guardar el contenido actualizado de `#htmlTPV.txt` en el HTML Component `#htmlTPV` y abrir Preview. No publicar ni ejecutar operaciones reales.

### 2.2 Sincronización del HTML Component

`#htmlTPV.txt` es la fuente versionada del widget, pero al estar guardado como HTML pegado en un HTML Component del Editor, no se debe asumir que Git Integration actualiza ese contenido. Después de integrar la corrección:
- copiar el contenido completo de `#htmlTPV.txt` al HTML Component `#htmlTPV` en Wix Draft y aplicar/guardar;
- comprobar que el código de página Velo sí corresponde al SHA sincronizado;
- abrir la página en Preview y verificar ausencia de ambos errores;
- no publicar durante estas pruebas.

No se utiliza `postMessage(..., "*")` desde el controlador. El HTML no accede a CMS, backend ni APIs Wix directamente.

El contexto se obtiene mediante `obtenerConfiguracionTPV` y confirma acceso autorizado, moneda y zona horaria. La interfaz no gobierna la política de ejecución. La política sintética y sus capacidades se aplican en backend; los permisos se comprueban en cada WebMethod.

## 3. Contrato exacto de WebMethods

Los doce nombres exportados requeridos son:

| Exportación backend | Módulo | Responsabilidad |
|---|---|---|
| `obtenerEstadoCaja` | `tpvCaja.web.js` | Leer sesión TPV abierta |
| `abrirSesionCaja` | `tpvCaja.web.js` | Abrir sesión sintética, con autorización backend |
| `obtenerServicios` | `tpvCatalogo.web.js` | Consultar catálogo de Bookings |
| `obtenerProductos` | `tpvCatalogo.web.js` | Consultar Stores Catalog V3 |
| `obtenerStaff` | `tpvCatalogo.web.js` | Resolver profesionales autorizados desde `MapaStaff` y Wix Bookings Staff |
| `registrarVenta` | `tpvVentas.web.js` | Persistir venta sintética idempotente |
| `registrarMovimientoCaja` | `tpvMovimientos.web.js` | Persistir entrada/salida sintética |
| `registrarDevolucion` | `tpvDevoluciones.web.js` | Registrar devolución sintética por método original |
| `generarControlX` | `tpvCierres.web.js` | Generar informe X sin cerrar sesión |
| `generarCierreZ` | `tpvCierres.web.js` | Conciliar efectivo y cerrar sesión TPV |
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
| `CUSTOMERS_SEARCH` | `CUSTOMERS_SEARCH_RES` | `buscarClientesTPV` (consulta adicional de Wix CRM Contacts V5) |
| `SALE_REGISTER` | `SALE_REGISTER_RES` | `registrarVenta` |
| `CASH_MOVEMENT` | `CASH_MOVEMENT_RES` | `registrarMovimientoCaja` |
| `REFUND` | `REFUND_RES` | `registrarDevolucion` |
| `TICKET_X` | `TICKET_X_RES` | `generarControlX` |
| `TICKET_Z` | `TICKET_Z_RES` | `generarCierreZ` |
| `SESSION_SUMMARY` | `SESSION_SUMMARY_RES` | `obtenerResumenCaja` |
| `AUDIT_LIST` | `AUDIT_LIST_RES` | `obtenerMovimientosCaja` |

## 5. Conciliación de botones y DTOs

- **Abrir caja:** envía `openingCash` y `terminalId`; backend exige rol autorizado y sesión válida.
- **Operador:** se elige entre profesionales resueltos desde `MapaStaff`/Bookings; el `resourceId` se envía como `profesionalId` y se vuelve a validar en backend.
- **Cliente:** `buscarClientesTPV` consulta Contacts V5; `customerIdentityId` se conserva por compatibilidad del DTO, pero contiene `Contact._id` y el backend vuelve a validar el contacto.
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
| Actualizar | llamadas de estado y catálogo | `obtenerEstadoCaja`, `obtenerServicios`, `obtenerStaff`, `obtenerProductos` | Wix Bookings, Wix Stores Catalog V3, Wix CRM Contacts V5 y `MapaStaff` | Lectura |
| Buscar catálogo | filtro local | HTML | Datos ya cargados | Solo frontend |
| Elegir variante | `CATALOG_VARIANTS` | `obtenerVariantesProducto` | Wix Stores Catalog V3 | Lectura |
| Elegir operador | `CATALOG_STAFF` | `obtenerStaff` | Wix Bookings Staff + `MapaStaff` | Unión y autorización por `resourceId` |
| Elegir cliente | `CUSTOMERS_SEARCH` | `buscarClientesTPV` | Wix CRM Contacts V5 | ID nativo `Contact._id`; nombre DTO legado conservado |
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

Los únicos IDs físicos de CMS para la caja son `CajaActual`, `MovimientosCaja` y `ControlOperativo`. `cashRegisterStatus=SIMULACION` se conserva como estado de proyección de prueba reconocido por los módulos transversales de caja; no es una comprobación booleana de entorno ni un nombre de colección. No sustituirlo por `ABIERTA`, porque `src/backend/cajas.web.js` utiliza ese sentinel para evitar que una sesión de prueba se trate como operativa. El repositorio TPV ya los resuelve mediante `BUSINESS_COLLECTIONS.CAJA_ACTUAL`, `BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA` y `OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO`. `TPV_COLLECTIONS` contiene discriminadores lógicos de evento (`TPV_LOGICAL_*`), no nombres de colecciones Wix ni tablas paralelas. No se deben crear colecciones con esos nombres.

### Alcance real de las integraciones nativas

- Bookings y Stores Catalog V3 se consultan mediante sus SDK nativos. El catálogo no crea ni modifica reservas, productos ni inventario.
- La pantalla POS del Dashboard Wix es la referencia visual/funcional. El HTML Component no es una extensión del Dashboard POS ni invoca internamente sus botones o terminal.
- La venta TPV actual no crea un pedido Wix eCommerce ni una transacción de pago nativa. Los medios efectivo/tarjeta/Bizum/otros son datos de prueba; no confirman un cobro.
- La devolución TPV registra una devolución interna de prueba; no ejecuta refund en Wix Payments.
- Gift Cards, facturación fiscal, notificaciones y hardware no forman parte de los mensajes activos del widget.

### Handshake sin indicadores de entorno

`MM_CONTEXT` solo comunica el resultado del contexto autenticado y los datos funcionales (moneda y zona horaria). El HTML no evalúa `environment`, `previewOnly`, `syntheticOnly` ni flags true/false para arrancar. La política `sourceType=SYNTHETIC` / `processingMode=INTERNAL`, el aislamiento por `siteId`/`sessionId`, la autorización, validación, idempotencia y controles de integridad residen en backend.

## 6. Persistencia y colecciones

`TPV_COLLECTIONS` contiene tipos de evento internos, no IDs ni nombres de colecciones físicas. La persistencia actual proyecta eventos sintéticos sobre:
- `MovimientosCaja`: ledger append-only de eventos sintéticos.
- `CajaActual`: proyección operativa de sesión; las nuevas escrituras usan `conceptOperations.tpvRuntime`. El lector conserva fallback a `tpvSandbox` exclusivamente para datos históricos.
- `ControlOperativo`: locks compare-and-swap de sesión/devolución.
- Wix CRM Contacts V5: identidad de cliente; Wix Bookings Staff + `MapaStaff`: identidad profesional. No se usa colección TPV de identidades.

No se modifica la estructura ni se elimina el índice único `transactionId_unique`. Las correcciones de eventos persistidos requieren nuevos registros trazables, nunca reescritura histórica.

## 7. Límites de entorno

El HTML Component no contiene verificaciones de `environment`, `previewOnly` ni flags sintéticos true/false. El backend mantiene `sourceType=SYNTHETIC`, `processingMode=INTERNAL`, `reconciliationStatus=NOT_RECONCILED`; los pagos/reembolsos nativos, escrituras nativas y efectos fiscales siguen deshabilitados. El aislamiento funcional se establece por `siteId`, `sessionId`, versión de esquema e idempotencia, no por sufijos de entorno en identificadores nuevos.

No se habilitan por este cambio cobros reales, devoluciones reales, facturas, notificaciones, hardware ni sincronización de colecciones Wix Apps. Las colecciones de Wix Apps no heredan automáticamente las restricciones de escritura de las colecciones CMS propias.

## 8. Validación y pendientes

**Baseline CI anterior:** los resultados históricos indicados a continuación pertenecen al commit `e790f7ed361e822fbbca1de8298456a80172b9e1`; no validan esta rama ni su contrato actualizado. Para esta corrección, la validación de CI queda pendiente de la PR de neutralización. Los contratos estáticos confirman las doce exportaciones y sus imports `.web`.

**Pendiente de ejecutar:** Wix Local Editor, Preview, permisos con roles reales, disponibilidad de catálogo real en el sitio, preseed válido de `CajaActual`, ventas/devoluciones/cierres E2E y verificación de que el HTML fuente está instalado en el componente Wix. La CI offline no acredita ejecución runtime ni aislamiento efectivo por `siteId`/`sessionId`/`schemaVersion` ni reconciliación CMS.

El código versionado no demuestra por sí solo sincronización del Editor ni ejecución runtime. No publicar ni ejecutar operaciones LIVE como parte de esta corrección.


Las operaciones de escritura (apertura, venta, movimiento, devolución y X/Z) conservan el `requireAdmin` vigente; elegir un operador sintético solo atribuye la operación y no concede permisos. Las consultas usan `requireCajero`.


No se descuenta inventario ni se escribe en Stores durante la simulación.
