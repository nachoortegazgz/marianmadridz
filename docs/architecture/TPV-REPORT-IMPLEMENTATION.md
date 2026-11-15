# TPV — implementacion modular basada en el informe funcional

## Alcance de esta entrega

Esta rama incorpora los puntos de entrada backend Velo con extension `.web.js` para:

- Caja: lectura autenticada del estado actual.
- Ventas: validacion del borrador comercial en backend, sin persistencia.
- Catalogo: lectura de servicios y profesionales desde Wix Bookings.
- Informes: lectura del estado y previsualizacion X parcial.
- Validacion: aritmetica en centimos, descuentos, impuestos declarados y pagos divididos.
- Interfaz: conexion del codigo de pagina TPV con el puente de mensajes compartido del componente HTML.

Todos los WebMethods requieren `Permissions.SiteMember` y validan el rol de cajero en backend cuando no delegan en `getCashierState()`. El frontend no puede enviar identidad, permisos ni actor autorizado.

## Limpieza de codigo TPV sin consumidor

Se elimina `src/public/tpv/tpv-page.js`: importaba `backend/tpvBackend`, modulo que no existe en el repositorio, y no se encontraron consumidores ni referencias documentales a ese archivo. La pagina activa identificada usa `TPV.yl5th.js` y `public/tpvPageController.js`; esta ruta antigua tambien incumplia el contrato frontend/backend de importar solo WebMethods publicos. No se elimina ni modifica ningun otro modulo raiz.

## Integracion en repositorio y validacion pendiente en Wix Editor

La pagina estatica existente del sitio seleccionado ha sido identificada en Wix como:

- Pagina: `TPV`
- ID de pagina: `yl5th`
- Ruta publicada: `/blank`

En el repositorio, `src/pages/TPV.yl5th.js` inicializa ahora `initializeTpvPage()` desde `public/tpvPageController.js`. El controlador usa el protocolo versionado del HTML Component: `MM_READY` → `MM_CONTEXT` → `CASHIER_STATE` → `CASHIER_STATE_RES`. La fuente HTML `#htmlTPV.txt` contiene ese mismo protocolo. La suite contractual comprueba la coherencia estatica de los cuatro extremos.

La integracion anterior de la pagina estaba rota: el page code esperaba `TPV_REQUEST_STATE` y respondia `TPV_STATE`, mientras que el HTML enviaba `MM_READY` y `CASHIER_STATE`, esperando `MM_CONTEXT` y `CASHIER_STATE_RES`. El nuevo page code elimina esa implementacion duplicada y delega el protocolo en el controlador existente.

**Limite de validacion:** Wix ha confirmado el ID y la ruta de la pagina, pero la API de inventario de paginas no devuelve el arbol de componentes ni el contenido publicado del HTML Component. Por ello, el ID `#htmlTPV` y el contenido real del iframe deben comprobarse en el Editor/Preview. El sitio es de tipo Editor clasico, no Studio Two; la integracion de codigo en esta rama no equivale a guardar ni publicar el codigo en el Editor. No se ha realizado despliegue ni publicacion en Wix.

Los modulos de catalogo, ventas y caja siguen aislados bajo `backend/tpv/`. Los lectores de Bookings no estan aun conectados a controles del HTML. La interfaz conserva borradores locales; no presenta todavia productos, servicios ni profesionales obtenidos en tiempo real desde los nuevos WebMethods.

## Limites deliberados

No se crean pedidos, pagos, reembolsos, movimientos de caja, sesiones, cierres X/Z, tarjetas regalo, facturas ni registros CMS. Los metodos de escritura devuelven errores explicitos `TPV_*_DISABLED`; no simulan persistencia ni pagos reales.

## Bloqueos de contrato y seguridad detectados en el sitio live

1. El informe propone `MovimientosCaja` como ledger operativo TPV. En el repositorio y en el esquema live actual, `MovimientosCaja` es el ledger fiscal canonico, con campos obligatorios de secuencia, hash, hash anterior, fecha de registro, identificador de transaccion y datos fiscales. No se puede reutilizar como tabla POS sin un ADR y un contrato de datos aprobado; mezclar ambos dominios podria contaminar la trazabilidad fiscal.
2. La lectura live del esquema de `CajaActual` (2026-11-15) confirma `cashRegisterStatus`, `cashAmount`, `cardAmount`, `bizumAmount`, `otherAmount`, `expectedCash`, `countedCash`, `sequenceCounters` y `ticketTotal`, entre otros. **No existe el campo `netAmount`** en el esquema devuelto. Sin embargo, `backend/cajas.web.js` define `CAJA_KEYS.TOTAL = "netAmount"` y `getCashierState()` devuelve cero como fallback cuando no encuentra ese campo. Este contrato debe reconciliarse antes de usar el total de caja.
3. **Bizum si tiene campos propios** en el esquema live: `bizumAmount` y `openingBizumAmount`. El `getCashierState()` actual no expone `bizumAmount` directamente; el HTML calcula Bizum desde `sessionPayments.BIZUM.amount`. Hay que verificar que ambos origenes representen el mismo periodo y que el resumen derivado sea completo antes de mostrarlo como saldo operativo.
4. **Hallazgo de permisos P0/P1:** las colecciones `CajaActual` y `MovimientosCaja` devuelven `read: ANYONE`, mientras insert/update/remove estan restringidos a `ADMIN`. La coleccion `CajaActual` tiene un registro live con importes operativos y datos de apertura/cierre poblados. `MovimientosCaja` devolvio cero registros en la consulta de comprobacion, pero su esquema admite NIF, direcciones, payload fiscal, hashes y firmas. Con permiso de lectura `ANYONE`, futuros registros del ledger podrian quedar accesibles a cualquier visitante. No activar escritores ni introducir nuevos datos fiscales hasta aprobar y probar un modelo de permisos que preserve el acceso backend de cajeros autorizados y cierre la lectura publica.
5. `@wix/stores` y `@wix/gift-vouchers` no figuran entre las dependencias instaladas en `package.json`. El lector de productos y la consulta de tarjetas regalo quedan bloqueados hasta fijar dependencias oficiales y verificar sus contratos SDK.
6. El esquema de lineas, impuestos, ventas presenciales, pagos divididos, devoluciones, apertura de caja, arqueo y cierre Z debe aprobarse antes de habilitar escritores.
7. La identidad de cajero se valida mediante `requireCajero()`; `Permissions.SiteMember` por si solo no equivale a autorizacion de rol. Esta validacion backend tampoco evita que un visitante consulte directamente una coleccion CMS configurada con lectura `ANYONE`.

## Integraciones nativas

- Servicios y profesionales: Wix Bookings, solo lectura en backend; pendiente de conexion a controles de interfaz.
- Productos y variantes: Wix Stores Catalog V3, pendiente de instalar/verificar el paquete SDK correspondiente.
- Pedidos y transacciones: Wix eCommerce, no se crean ni modifican.
- Pagos y reembolsos: proveedor conectado / Wix Payments, bloqueados.
- Tarjetas regalo: Wix Gift Cards, pendiente del paquete SDK correspondiente.
- Facturas: Wix Invoices V1 y flujo fiscal aprobado, bloqueados.
- Caja: `CajaActual` y `MovimientosCaja` no reciben escrituras TPV en esta entrega.

## Validacion

La suite `tpv.web-modules.contract.test.mjs` verifica validacion economica, ausencia de escritores CMS en los WebMethods y coherencia estatica entre page code, controlador y protocolo HTML. Las pruebas offline no sustituyen la validacion en Wix Editor/Preview ni una prueba runtime del SDK Bookings.

La ultima ejecucion CI confirmada para el commit anterior a la conexion de pagina completo Layer 1, Layer 2, regresion offline, contratos SDK Wix Bookings/eCommerce, ESLint y secret scan. La nueva conexion de pagina requiere su propia ejecucion CI y no se considera validada hasta que finalice.

## Siguiente gate

Antes de activar cualquier escritura o publicar:

1. Verificar en Wix Editor que la pagina `yl5th` contiene el HTML Component `#htmlTPV` y que su contenido coincide con `#htmlTPV.txt`.
2. Validar el handshake y la consulta `getCashierState()` en Preview con un usuario de staff autorizado y con un miembro no autorizado.
3. Resolver el permiso de lectura publica de `CajaActual` y `MovimientosCaja` sin romper el acceso backend autorizado; probar lectura anonima, miembro ordinario y cajero.
4. Aprobar el modelo de datos POS separado del ledger fiscal, o aprobar expresamente una arquitectura que mantenga ambos contratos aislados.
5. Reconciliar `netAmount`, `bizumAmount` y el periodo del resumen de pagos con el esquema y los datos live.
6. Instalar y fijar las dependencias oficiales faltantes y conectar los lectores de catalogo a la interfaz.
7. Definir idempotencia, concurrencia, compensaciones y autorizaciones.
8. Diseñar pruebas de integracion con pagos, automatizaciones y comunicaciones aislados.
9. Aprobar el cambio y habilitar writers de forma independiente, con rollback y pruebas de regresion.
