> **Estado vigente — 2026-11-23:** main permanece en `995c085aa2ef45fea6d57f95f86d4c75c7cf7f7d` (PR #536). PR #541 está abierta sobre `main`; la rama `feat/tpv-payment-exports-after-p0-20261123` alcanza `1d7e99d66fcc14165bf2482885e583176c2b06ef`. CI del HEAD de código actual SUCCESS: Layer 1 364/364, Layer 2 255/255, suite offline completa 732/732; npm audit sin vulnerabilidades, contratos Wix SDK/eCommerce/TPV, ESLint y secret scanning SUCCESS (runs 45100967570 y 45100967567). El sitio Wix Marian Madrid sigue en estado Draft, Velo Enabled y Stores Catalog V3. No está integrado en `main` ni validado en Wix Preview/Runtime. **Release NO-GO.** Las notas fechadas más abajo son snapshots históricos y no sustituyen este estado.



> **Wix site context verificado (solo lectura, 2026-11-23):** Site ID `188bed94-177c-4bc9-a9f0-35080d874f3e`; estado Draft, editor clásico, Velo Enabled, EUR y zona horaria Europe/Madrid. Apps instaladas: Wix Bookings, Wix Forms & Payments, Wix Gift Cards, Wix Payments, Wix Stores Catalog V3, Wix Invoices V1, Wix Members Area, Wix Blog y Promote SEO. La lectura de contexto no demuestra sincronización del HEAD Git con Wix Editor ni ejecución de Preview.

## Contrato TPV vigente — escritura neutral, lectura legacy controlada

- Las nuevas filas del ledger usan `recordSource=TPV_LEDGER`, `movementType=SIMULATED_TPV_*` y metadatos explícitos `sourceType=SYNTHETIC`, `siteId`, `ledgerVersion`, `schemaVersion`, `sessionId`, `requestFingerprint` y huella/hash. El entorno no acredita el origen ni autoriza escrituras.
- Los marcadores históricos `TPV_SANDBOX_SYNTHETIC`, `sandboxRunId` y trazas antiguas se conservan únicamente para lectura/compatibilidad; las nuevas escrituras no dependen de `SANDBOX_RUN_ID`.
- Las identidades nuevas de `TpvSandboxIdentities` exigen `sourceType`, `siteId` y `schemaVersion=2`, además de `syntheticOnly=true`. Las filas históricas con `environment=SANDBOX` y `testRunId` solo se aceptan mediante `allowLegacyRead: true`; no son válidas para nuevas escrituras.
- El fixture `docs/qa/fixtures/tpv-sandbox-identities.json` representa el formato transicional histórico y se valida exclusivamente por la ruta de lectura legacy. No copiarlo como plantilla de nuevas identidades.
- La TPV HTML incorpora selección de cliente sintético mediante `CUSTOMERS_SEARCH` y envía `customerIdentityId`; el backend vuelve a validar la identidad antes de registrar la venta.
- Persistencia sintética no significa captura de pago, actualización de Stores/Bookings, emisión fiscal ni conciliación. Esas capacidades siguen deshabilitadas.

## Estado de validación

El último CI completado antes del HEAD actual registró 363/364 pruebas de Layer 1; el único fallo restante era una aserción contractual que esperaba el formato compacto de la llamada REFUND. El HEAD actual contiene el ajuste de esa aserción y la corrección de validación de identidades, pero la suite debe finalizar en SUCCESS antes de integrar. No hay evidencia de Preview E2E, pruebas negativas Published ni escrituras CMS ejecutadas durante esta revisión.

> **Estado de rama TPV (2026-11-21):** PR #514 `fix/tpv-native-pos-contract-alignment` sigue abierto en revisión; no está integrado en `main`. Commit validado `e790f7ed361e822fbbca1de8298456a80172b9e1`: Layer 1 343 tests, Layer 2 268 tests y suite offline completa 724 tests/77 suites, 0 fallos; contratos SDK y ESLint correctos; Gitleaks SUCCESS. La validación Wix Editor/Preview y E2E runtime siguen pendientes. No publicar ni desplegar hasta completar esas pruebas.

> **Estado actualizado (2026-11-20, main a231e5c):** PR #512 integrada. El simulador de proveedor sintético y fixture de identidades están versionados. CI post-merge SUCCESS: Layer 1, Layer 2, regresión offline completa, auditoría npm, contratos SDK Wix/eCommerce/TPV, ESLint y Gitleaks. No hay evidencia de Preview, preseed ejecutado ni E2E runtime. No publicar ni declarar listo el TPV hasta obtener esa evidencia.

> **Estado actualizado (2026-11-20, main 566a819):** PR #496 normalizó los contratos WebMethod y PR #497 corrigió el encabezado arquitectónico del controlador y el indicador `persisted` de respuestas de lectura. Los workflows del PR #497 y los dos workflows post-merge del commit `566a819719d945e690f85836f91a424afb9d959f` finalizaron en SUCCESS (runs `44777610050` y `44777610037`). La suite offline registró 75 suites / 704 tests, 0 fallos. La persistencia sintética usa `tpvRepository.js` sobre CMS nativo y comprueba los marcadores de `CajaActual` antes de escribir. No hay evidencia de ejecución Wix Preview, seed de identidades ni E2E runtime. No publicar ni declarar listo el TPV hasta obtener esa evidencia.

> **Estado UI:** `#htmlTPV.txt` conserva el contrato versionado y las operaciones sintéticas. El bootstrap de caja e identidades está implementado, pero no se ha ejecutado en Wix Preview. Cobros reales, pasarelas, fiscalidad, hardware y notificaciones permanecen deshabilitados.

> **Backend canónico:** todos los módulos TPV Velo residen exclusivamente en `src/backend/tpv/`. No reintroducir archivos `src/backend/tpv*.web.js` en la raíz: eran stubs legacy sin consumidores activos.

Este directorio implementa el TPV en modo SANDBOX persistente y sintético para el sitio Marian Madrid en Wix Classic.

## Límites de seguridad

- Los eventos TPV sintéticos se persisten como filas marcadas en `MovimientosCaja`; `CajaActual` conserva la proyección de la sesión Sandbox. `TPV_COLLECTIONS` son claves lógicas internas, no colecciones físicas.
- `MovimientosCaja` conserva su contrato de ledger: las filas sintéticas se distinguen por `recordSource=TPV_SANDBOX_SYNTHETIC` (marcador persistido histórico conservado por compatibilidad), `movementType=SIMULATED_TPV_*`, `sandboxRunId`, hash y secuencia fiscal cero. Los IDs de entidad/transacción generados son neutrales (`TPV-*` / `TPV_<sha256>`); el origen sintético se identifica por metadatos, no por el prefijo del ID. Los ledgers fiscal/contable y `HistoricoCierresZ` no reciben escrituras TPV.
- La idempotencia se aplica mediante índice CMS único `idempotencyKey`, lectura fuerte previa y reconciliación del resultado de inserción concurrente.
- Los reembolsos sintéticos se serializan por venta mediante compare-and-swap en `ControlOperativo`, tipo `TPV_REFUND_LOCK`. Ventas, devoluciones, movimientos, arqueos y cierres comparten además `TPV_SESSION_LOCK` para evitar carreras con Ticket Z. Los locks no son ledgers ni almacenan importes.
- Clientes y profesionales se consultan exclusivamente en `TpvSandboxIdentities`; no se consultan CRM, Members, Bookings Staff, reservas ni saldos de Gift Cards. No se llama a Wix Payments, checkout, Orders, refunds, Bookings writers, Gift Card writers, hardware, notificaciones ni emisión fiscal.
- `CajaActual` solo se actualiza como proyección backend de la sesión sintética. No se escribe en `HistoricoCierresZ` ni `LibroAsientosContablesDetalle`.
- Ticket Z cierra solo la sesión SANDBOX y nunca cierra el periodo fiscal u operativo.

## Contrato del controlador TPV

El controlador de página consume los doce WebMethods canónicos documentados en `docs/architecture/TPV-HTML-WIDGET-BRIDGE.md`. Los imports desde frontend deben usar los módulos públicos Wix con sufijo `.web` (por ejemplo, `backend/tpv/tpvVentas.web`). No se deben importar desde frontend repositorios, validadores ni helpers privados del directorio `/tpv`.

Los métodos auxiliares `buscarClientesTPV`, `obtenerVariantesProducto` y `obtenerConfiguracionTPV` soportan respectivamente la selección de cliente sintético, la elección de variante del catálogo nativo y el handshake de entorno. Otros WebMethods de pagos, permisos, gift cards y auditoría permanecen aislados: no se conectan a botones mientras el diseño no exponga esos flujos. La lista de doce exportaciones del controlador no implica eliminar esos contratos auxiliares ni los consumidores internos existentes.

## Inventario

| Módulo | Responsabilidad |
|---|---|
| `tpvCaja.web.js` | Apertura diaria SANDBOX, lectura de sesión y arqueo parcial |
| `tpvVentas.web.js` | Validación y persistencia idempotente de venta sintética |
| `tpvMovimientos.web.js` | Entradas, salidas y retiradas sintéticas |
| `tpvCatalogo.web.js` | Lectura nativa de servicios Bookings y Stores Catalog V3; clientes/profesionales solo desde `TpvSandboxIdentities` |
| `tpvPagos.web.js` | Validación de medios mixtos y WebMethods de simulación de proveedor, sin llamadas externas |
| `tpvDevoluciones.web.js` | Reembolso sintético parcial/total, con autorización ADMIN y lock por venta |
| `tpvCierres.web.js` | Resumen, Ticket X y cierre de sesión SANDBOX Ticket Z |
| `tpvAuditoria.web.js` | Consulta de auditoría persistida |
| `tpvPermisos.web.js` | Capacidades SANDBOX derivadas del rol backend |
| `tpvUtils.web.js` | Configuración SANDBOX expuesta al controlador de página (sin validadores duplicados) |
| `tpvUtils.js` | Validación pura, minor units, claves y payload sintético |
| `tpvRepository.js` | Adaptador lógico sobre `MovimientosCaja`/`CajaActual`, idempotencia, lectura fuerte y locks CAS de sesión/venta |
| `tpvCierresCore.js` | Agregación reproducible de ventas, pagos, devoluciones y efectivo |

## Flujo de venta

1. El miembro con rol cajero solicita la sesión SANDBOX abierta.
2. La interfaz prepara y valida el borrador en backend.
3. `registrarVenta` exige una sesión abierta y pago completamente cuadrado; valida cliente/profesionales contra identidades sintéticas activas.
4. Persiste eventos lógicos `PREPARADA`, líneas, pagos y `CONFIRMADA_SINTETICA` en `MovimientosCaja`, con marcador sintético y secuencia fiscal cero.
5. Cada evento utiliza una clave idempotente derivada de la clave cliente; un reintento continúa los pasos pendientes sin duplicar los existentes.
6. Se registra auditoría. No se inicia una autorización, captura, orden ni movimiento fiscal.

La persistencia multi-colección no es una transacción ACID. El orden preparado → líneas/pagos → confirmada permite detectar y reanudar una escritura parcial; los consumidores de informes solo consideran ventas confirmadas.

## Flujo de reembolso

- ADMIN obligatorio.
- Venta original debe estar confirmada y pertenecer a la sesión SANDBOX abierta.
- Los importes por medio no pueden superar el importe original no reembolsado.
- Un lock distribuido por sesión y otro por venta serializan solicitudes concurrentes y bloquean cambios durante Ticket Z.
- Cabecera, pagos negativos, movimiento de efectivo y auditoría se insertan como eventos sintéticos idempotentes.
- Nunca se llama a un proveedor externo.

## Sesión y cierres

- Una sesión por día local de Europe/Madrid, con clave idempotente determinista.
- Los arqueos parciales se registran como eventos; no mutan la sesión.
- Ticket X persiste una instantánea no destructiva.
- Ticket Z usa una clave determinista por sesión, comprueba el efectivo esperado y registra diferencia/motivo. La existencia del Ticket Z marca la sesión como cerrada.

## Pruebas

- `tpv.web-modules.contract.test.mjs`
- `tpv-widget.contract.test.mjs`
- `tpv-ui.sandbox-source.test.mjs`
- `tpv.sandbox.persistence.policy.test.mjs`

Ejecutar `npm test`, `npm run test:layer1` y `npm run lint` antes de sincronizar con Wix Classic. No declarar validación runtime hasta ejecutar Preview con los roles ADMIN, GESTION, ESTILISTA y miembro sin rol.

## Estado de integración

PR #397, PR #398 y PR #399 están integradas en `main`. PR #399 aplica el aislamiento sintético y pasó 74 suites / 670 pruebas offline, 0 fallos. El repositorio está configurado para Wix Git Integration: `wix.config.json` contiene el Site ID exacto y `package.json` expone `wix dev`/`wix`. El merge a `main` debe sincronizar el Editor, pendiente de read-back. No se ha ejecutado Preview ni Publish; la versión pública no está validada.


## Identidades sintéticas de Sandbox

- Clientes y profesionales se leen exclusivamente desde `TpvSandboxIdentities`; no se consultan CRM, Members ni Bookings Staff para resolver identidades TPV.
- La colección CMS tiene permisos ADMIN para lectura/escritura y sus hooks validan `identityType`, ID sintético, `environment=SANDBOX`, `syntheticOnly=true`, `testRunId` activo y correo `@example.test`. No admite teléfono, NIF, dirección ni IDs nativos.
- Los IDs nuevos son neutrales (`TPV-CUSTOMER-*` / `TPV-STAFF-*`); `syntheticOnly`, `environment`, `testRunId` y el correo `@example.test` identifican el carácter sintético. El validador conserva lectura compatible de IDs históricos `SANDBOX-*`. Los registros son append-only; la identidad no se reutiliza como `contactId`, `memberId` o `resourceId` de Wix. La vinculación con reservas reales sigue deshabilitada y la venta rechaza cualquier `bookingId`.
- El esquema CMS está creado; la carga de filas sintéticas debe hacerse desde el entorno Sandbox de Wix, nunca mediante la API REST de gestión que no acredita selección de Sandbox.
- La consulta de saldo de Gift Cards reales está deshabilitada; no se envía ni persiste ningún código. Emisión, canje y reembolso siguen bloqueados.
- Los eventos de auditoría usan el actor sintético `TPV_SYSTEM`; la identidad real solo se usa para autorización backend y no se persiste.


## Contrato del widget HTML

La integración vigente entre `#htmlTPV.txt`, `src/pages/TPV.yl5th.js`, `src/public/tpvPageController.js` y estos WebMethods está documentada en [`docs/architecture/TPV-HTML-WIDGET-BRIDGE.md`](../../../docs/architecture/TPV-HTML-WIDGET-BRIDGE.md). El ID del componente Wix debe ser exactamente `htmlTPV` (sensible a mayúsculas).


### Datos iniciales del simulacro (insertar solo con CMS en Sandbox)

La colección se ha creado vacía. Cuando Wix Editor permita editar explícitamente el entorno Sandbox, insertar estas identidades (Wix genera `_id`; no copiar IDs reales):

| identityId | identityType | displayName | email |
|---|---|---|---|
| `TPV-CUSTOMER-01` | `CUSTOMER` | Cliente Sintético 01 | `cliente01@example.test` |
| `TPV-CUSTOMER-02` | `CUSTOMER` | Cliente Sintético 02 | `cliente02@example.test` |
| `TPV-CUSTOMER-03` | `CUSTOMER` | Cliente Sintético 03 | `cliente03@example.test` |
| `TPV-STAFF-01` | `STAFF` | Profesional Sintético 01 | `staff01@example.test` |
| `TPV-STAFF-02` | `STAFF` | Profesional Sintético 02 | `staff02@example.test` |
| `TPV-STAFF-03` | `STAFF` | Profesional Sintético 03 | `staff03@example.test` |

En las seis filas: `active=true`, `syntheticOnly=true`, `environment=SANDBOX`, `testRunId=TPVSANDBOX-DEV-20261120-01` y `metadata={}`. No añadir teléfono, NIF, dirección, `contactId`, `memberId` ni `resourceId`. El hook valida el contrato antes de aceptar la inserción.


## Runtime Sandbox y arranque de caja

El controlador del widget solicita `inicializarCaja` al completar el handshake. El WebMethod exige sesión autorizada y delega en `initializeTpvCaja`, que consulta el singleton `CajaActual` en el data plane seleccionado por Wix. No lo crea ni lo actualiza: si falta o no cumple el marcador de Sandbox, falla sin escribir.

La apertura de sesión y los eventos posteriores requieren el marcador `TPV_SANDBOX_INITIALIZED` o `TPV_SANDBOX_SYNTHETIC` y el `SANDBOX_RUN_ID` exacto. Pagos reales, escrituras fiscales, notificaciones, hardware y mutaciones de Bookings/Stores permanecen deshabilitados.

El preflight es repetible y de solo lectura: los cajeros autorizados pueden consultar un marcador Sandbox ya inicializado. La preparación del singleton y de las identidades se realiza manualmente desde CMS Sandbox; una fila Online con un origen/run ID diferente se rechaza sin modificación.

Las pruebas contractuales mantienen sus rutas históricas para que el workflow de regresión existente las ejecute; su contenido valida los contratos Sandbox actuales.

El contexto del widget anuncia `environment: SANDBOX` y `previewOnly: true` únicamente cuando el WebMethod confirma el marcador del singleton. Si el marcador no coincide, el widget recibe `UNAVAILABLE` y no habilita capacidades operativas.

El código no crea identidades. `inicializarCaja` solo verifica que existan las seis identidades sintéticas presembradas y que correspondan al `SANDBOX_RUN_ID` activo; si falta alguna, falla sin escribir.

El acceso elevado a `TpvSandboxIdentities` está limitado a altas sintéticas del `SANDBOX_RUN_ID` vigente; la colección permanece append-only. La escritura de fichajes reales continúa cerrada mientras no se validen sus garantías de idempotencia y concurrencia.

La validación de identidades y las pruebas usan `SANDBOX_RUN_ID` como marcador de ejecución; `testRunId` se conserva únicamente como nombre del campo físico CMS de `TpvSandboxIdentities`.


## Release gate — preseed obligatorio, bootstrap de solo lectura

Los WebMethods de TPV no crean automáticamente el singleton `CajaActual` ni filas de `TpvSandboxIdentities`. Esta decisión evita que una llamada accidental desde el sitio publicado convierta una colección CMS Online vacía en un conjunto de datos sintéticos en LIVE. `inicializarCaja` ahora verifica únicamente los marcadores existentes; el seed valida que existan las seis identidades requeridas y no inserta ninguna.

Antes de ejecutar TPV en Preview, un administrador debe crear manualmente en el CMS **Sandbox** el singleton `CAJA_PRINCIPAL` con `_id=SINGLE_ITEM_ID`, `cashRegisterStatus=CERRADA`, `snapshotSource=TPV_SANDBOX_INITIALIZED`, `traceId=TPVSANDBOX-DEV-20261120-01`, `sequenceCounters={ appliedMovementIds: [] }` y `conceptOperations.tpvSandbox.sandboxRunId=TPVSANDBOX-DEV-20261120-01`. Debe crear también las seis identidades sintéticas descritas en `tpvSandboxIdentities.js`, con `environment=SANDBOX`, `syntheticOnly=true`, `testRunId` igual al run ID activo y correos `@example.test`.

No sincronizar estas colecciones Sandbox a Online. Las colecciones de Wix Apps no están aisladas por Sandbox; el TPV debe seguir sin mutar colecciones de Bookings, Stores, Payments o Gift Cards. Esta precondición reduce el riesgo de bootstrap en LIVE, pero no sustituye la prueba E2E de Preview ni una auditoría de permisos del sitio publicado.


## Estado consolidado del código — 2026-11-20 (PR #499)

El HEAD de referencia incorpora PR #496, #497, #498 y #499. La última integración es `cfe1d0c37a9464cb63aea9d31873071eecb10d9f`. En ese commit, CI post-merge terminó SUCCESS: Layer 1 28 suites/338 tests, Layer 2 19 suites/268 tests, regresión completa 75 suites/705 tests, contratos Wix SDK/eCommerce/TPV, ESLint y Gitleaks.

El bootstrap y la verificación de identidades son read-only: no crean automáticamente `CajaActual` ni `TpvSandboxIdentities`. La presemilla manual requiere una caja con `_id=SINGLE_ITEM_ID`, `singletonKey=CAJA_PRINCIPAL`, `cashRegisterStatus=CERRADA`, `snapshotSource=TPV_SANDBOX_INITIALIZED`, `traceId=TPVSANDBOX-DEV-20261120-01`, `sequenceCounters` como objeto y `conceptOperations.tpvSandbox.sandboxRunId` igual al run ID; más las seis identidades anteriores. No ejecutar la presemilla hasta confirmar el CMS Sandbox en el Editor.

PR #500 integrada en main (`6da7cdf0d815ad2e1833f5bd56b5950aff2afb3e`) añade un preflight read-only común antes de leer o escribir locks en `ControlOperativo`: debe existir `CajaActual` y cumplir el marcador/run ID permitido antes de adquirir cualquier lock de sesión o devolución. La prueba contractual correspondiente pasó CI pre-merge; CI post-merge queda pendiente al corte de este addendum.

No hay evidencia de Wix Preview E2E, runtime publicado, permisos efectivos por rol ni sincronización del código Editor/Git. El sitio Wix se observó en Draft. Mantener NO-GO de publicación.

## Addendum posterior a PR #500 — 2026-11-20

PR #500 está fusionada en `main`: commit `6da7cdf0d815ad2e1833f5bd56b5950aff2afb3e`. La corrección consolida el helper `_ensureCajaActualForSandbox()` para validar existencia y marcador/run ID de `CajaActual` y ejecuta ese preflight antes de cualquier lectura/escritura de locks en `ControlOperativo`. Se añade una prueba contractual específica.

Validación pre-merge del HEAD `306816dff20d62e4ec3fda87e25fb050c155bb96`: Layer 1 28 suites/339 tests PASS; Layer 2 19 suites/268 tests PASS; suite completa 75 suites/706 tests PASS; contratos Wix SDK, eCommerce Order Transactions, TPV Catalog y ESLint PASS; Gitleaks PASS (runs `44781808680` y `44781808524`). CI post-merge para `6da7cdf0...` está en curso en los runs `44781982497` y `44781982392`; no declararlo aprobado hasta que ambos finalicen SUCCESS.

La corrección es una barrera de código por estado de datos; no identifica de forma contractual Preview frente a Published. No equivale a prueba de aislamiento runtime ni a aceptación E2E. Wix Preview, prueba negativa Published, concurrencia H-01, permisos efectivos, efectos externos, comparación LIVE antes/después y reset preproducción siguen pendientes. Sitio Wix observado en Draft. **NO-GO de publicación.**


## Simulador de proveedor de pagos — decisión 2026-11-20

`tpvPaymentSimulator.js` implementa un adaptador determinista, puro y sin efectos secundarios para ensayar contratos semejantes a los de una pasarela. Los WebMethods `simularPasarelaPago` y `simularReembolsoPasarela` exigen sesión de miembro y rol cajero en backend.

Escenarios: pago CAPTURED, AUTHORIZED, DECLINED, REQUIRES_ACTION y PENDING; reembolso REFUNDED, DECLINED y PENDING. Solo EUR; importes en céntimos enteros. Las referencias son deterministas por clave idempotente y la huella SHA-256 permite detectar una clave reutilizada con contenido distinto. Todas las respuestas declaran environment=SIMULATOR, dataPlane=NO_CMS_ACCESS, providerCalled=false, realPayment=false, persisted=false y externalSideEffects=false. El simulador no afirma estar ejecutándose en el data plane Sandbox de Wix.

**Límite explícito:** es un simulador de contrato local del backend; NO es el modo de pruebas oficial de Wix Payments, no autoriza tarjetas de prueba reales y no crea transacciones en Wix eCommerce. No prueba webhooks del proveedor, 3DS real, settlement, conciliación bancaria ni comportamiento del SDK del PSP. La repetición es determinista, pero no constituye idempotencia durable entre solicitudes porque el simulador no persiste estado. Cualquier futura persistencia debe aplicar índice único/CAS y reconciliación de reintentos antes de afirmar idempotencia efectiva.

La simulación de reembolso no mantiene un acumulado. El llamador debe comprobar contra eventos sintéticos append-only que el total reembolsado no supera el pago original. No se deben llamar APIs de Wix Payments, checkout, Orders ni endpoints de refund desde este adaptador.

## Fixture de identidades sintéticas

docs/qa/fixtures/tpv-sandbox-identities.json contiene seis registros que cumplen assertTpvIdentity: tres clientes y tres profesionales, todos con correo @example.test, syntheticOnly=true, environment=SANDBOX, active=true y el SANDBOX_RUN_ID actual.

El fixture es para importación manual desde CMS > Sandbox únicamente después de comprobar visualmente que el Editor está en Sandbox. No importar mediante Management API ni sincronizar Sandbox → Online. Los registros no son miembros Wix ni contactos CRM y no se deben convertir en memberId, contactId o resourceId.

## Decisiones de entorno y release

- Se mantiene el sitio actual; no se crea otro sitio ni se publica el principal.
- No se crean cuentas reales Wix Members para representar personas sintéticas.
- Las colecciones propias CMS pueden aislarse mediante Sandbox cuando el toggle está habilitado y el código se ejecuta en Preview. Las colecciones de Wix Apps siguen conectadas a Live.
- El simulador no necesita escribir CMS ni usar colecciones de Apps; por eso es utilizable en pruebas unitarias/offline sin riesgo financiero.
- Las escrituras persistentes TPV siguen sujetas al gate de entorno aislado y al preseed manual de identidades y CajaActual. No inferir aislamiento por environment=SANDBOX en una constante.
- No usar Wix Payments real ni ejecutar pruebas de checkout/captura/reembolso hasta disponer de un modo de prueba oficial habilitado en Dashboard y de un procedimiento de prueba documentado por Wix.

## Índice único de MovimientosCaja y arqueos SANDBOX

La colección física `MovimientosCaja` mantiene el índice `transactionId_unique` (`unique=true`). No se elimina: es una garantía de unicidad del ledger. Los eventos lógicos del TPV comparten esta colección física, por lo que el identificador CMS debe estar namespaced por `logicalCollection` además del `SANDBOX_RUN_ID` y la clave de idempotencia.

`makeTpvTransactionId(collection, key)` genera el `transactionId` y el `_id` determinista con el ámbito completo. La búsqueda de idempotencia también consulta el identificador histórico anterior (sin namespace) para reconocer reintentos ya persistidos; no migra, modifica ni elimina filas históricas. La clave de idempotencia sigue siendo estable dentro de la misma colección lógica.

La inspección read-only del 2026-11-20 confirmó el índice único sobre `transactionId`; no hay índice único de usuario sobre `traceId`, `operationType`, `singletonKey` o `posTransactionId`. La consulta CMS devolvió un registro sintético de prueba sin `transactionId`, por lo que no se identificó un valor histórico duplicado concreto. La causa de colisión se atribuye al espacio de nombres incompleto del generador, no a una fila concreta demostrada.

La corrección de código no autoriza a repetir el arqueo en LIVE ni a modificar la configuración de índices. La validación runtime del arqueo, cierre de `CajaActual` y diferencia cero requiere Sandbox aislado, sesión y singleton presembrados y ejecución E2E autorizada. No se considera superada por pruebas unitarias/offline.


## Contrato TPV POS nativo + extensiones Marian Madrid

La interfaz `#htmlTPV` sigue el modelo operativo del POS nativo de Wix Dashboard, añadiendo funciones propias sin duplicar las fuentes nativas:
- Servicios: Wix Bookings `services.queryServices`.
- Productos: Wix Stores Catalog V3, filtrados por visibilidad POS.
- Personal: identidades sintéticas Sandbox propias, no Wix Members ni contactos CRM.
- Operaciones extendidas: sesión, venta sintética, movimientos, devolución, X/Z, resumen y movimientos.

El controlador `src/public/tpvPageController.js` usa `createWidgetBridge` y reenvía los sobres WebMethod `{status,data,error}` sin doble anidamiento. El contrato de exportaciones exigido es:

`obtenerEstadoCaja`, `abrirSesionCaja`, `obtenerServicios`, `obtenerProductos`, `obtenerStaff`, `registrarVenta`, `registrarMovimientoCaja`, `registrarDevolucion`, `generarControlX`, `generarCierreZ`, `obtenerResumenCaja`, `obtenerMovimientosCaja`.

La configuración se obtiene adicionalmente mediante `obtenerConfiguracionTPV`; el handshake valida acceso y contexto funcional, sin comprobar etiquetas de entorno ni flags true/false. La apertura, escritura, devolución y cierre mantienen las autorizaciones backend existentes. Las operaciones de escritura (apertura, venta, movimiento, devolución y X/Z) conservan el `requireAdmin` vigente; elegir un operador sintético solo atribuye la operación y no concede permisos. Las consultas usan `requireCajero`.

Conciliación de botones:
- El controlador traduce el DTO HTML `lineItems/payments/subtotal/tax/total` al DTO backend `lineas/pagos/subtotalNeto/impuestosTotal/totalVenta`.
- `PERSONALIZADA` se conserva como tipo de línea propio; no se falsea como servicio de catálogo.
- Los productos con variantes consultan `obtenerVariantesProducto` y conservan `varianteId` y precio elegido en la línea sintética. El botón Cliente consulta identidades sintéticas mediante `buscarClientesTPV` y la venta envía `customerIdentityId`, que el backend valida de nuevo. La devolución requiere una asignación explícita por medio de pago original.
- Control X es informativo y no solicita efectivo contado; Cierre Z recibe efectivo contado y motivo de diferencia.
- Las mutaciones usan claves estables por operación y sesión conservadas en `sessionStorage` (fallback en memoria); el controlador valida su formato. El `messageId` sirve para correlación y como fallback de idempotencia.
- El campo global de impuestos permanece bloqueado hasta mapear las reglas Wix por línea. No se prorratea ni se inventa un tipo impositivo.

El listado `obtenerMovimientosCaja` consulta el ledger físico `MovimientosCaja` y filtra `recordSource` + `SANDBOX_RUN_ID`; muestra ventas confirmadas, movimientos, devoluciones y X/Z. No debe confundirse con `consultarAuditoriaTPV`, que representa auditoría de acciones. La colección física sigue siendo `MovimientosCaja`; `SANDBOX_LOGICAL_*` son namespaces lógicos internos.

**Límite:** la TPV personalizada sigue siendo Sandbox sintético. No activa Wix Payments, checkout, captura, reembolso real, emisión fiscal ni hardware. El uso de APIs nativas de catálogo no convierte las escrituras de caja en operaciones LIVE. La validación de Wix Preview/E2E queda pendiente.


No se descuenta inventario ni se escribe en Stores durante la simulación.


## Correspondencia funcional consolidada del widget

El HTML Component consume el contrato documentado en `docs/architecture/TPV-HTML-WIDGET-BRIDGE.md`. Los IDs físicos son `CajaActual`, `MovimientosCaja` y `ControlOperativo`; `SANDBOX_LOGICAL_*` son discriminadores de eventos internos, no colecciones. Bookings y Stores V3 se usan solo para lectura del catálogo. No se crea pedido eCommerce, no se ejecuta pago/refund nativo, ni se modifica inventario. Clientes y operadores proceden de `TpvSandboxIdentities`, no de Wix Contacts ni Wix Staff.

El handshake `MM_CONTEXT` confirma autorización y contexto funcional, sin inspeccionar variables de entorno o flags sintéticos. Los WebMethods conservan autorización de backend, validación de DTO, idempotencia y locks CAS. La persistencia escribe eventos en `MovimientosCaja`, proyecta estado en `CajaActual` y coordina concurrencia mediante `ControlOperativo`.


## Estado de Bloque A — 2026-11-22
La neutralización parcial del dominio TPV está integrada en `main` mediante PR #533 (merge commit `e19bf9c30227f5401d54e8187f8af5503a3bea4d`): el repositorio usa `TPV_COLLECTIONS`, `TPV_EVENT_MOVEMENT_TYPES` y `TPV_RUNTIME_POLICY`; se mantienen aliases de compatibilidad en configuración para imports históricos. Los valores persistidos de los locks de ControlOperativo se conservan para no romper registros existentes.

**Integridad:** `MovimientosCaja` es append-only sin excepción para filas TPV sintéticas. No actualizar ni borrar filas históricas o sintéticas; emitir nuevos eventos rectificativos con trazabilidad. Los hooks CMS y la política de acceso rechazan update/remove.

**CI verificado antes del merge para PR #533**, commit `73f23c34287031dc90b73b2f077d5ea1abd1b45c`: Layer 1 344/344; Layer 2 270/270; suite completa 727/727 en 77 suites; contratos Wix SDK/eCommerce/TPV, ESLint y secret scanning SUCCESS. Esto valida únicamente pruebas offline y contratos estáticos. No se ha acreditado CI post-merge para el merge commit ni Wix Preview/Runtime ni escrituras CMS en Sandbox.

**Pendiente antes de cerrar Bloque A:** revisar idempotencia frontend/backend con reintentos y payload conflictivo, compatibilidad de lectura/migración y ejecutar E2E en Wix Preview con prueba negativa Published. La neutralización de nuevos IDs ya está integrada; los IDs históricos siguen admitidos en lectura. Pagos reales, operaciones nativas y emisión fiscal permanecen deshabilitados.
