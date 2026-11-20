# TPV SANDBOX — módulos Velo

> **Estado actualizado (2026-11-20, main 566a819):** PR #496 normalizó los contratos WebMethod y PR #497 corrigió el encabezado arquitectónico del controlador y el indicador `persisted` de respuestas de lectura. Los workflows del PR #497 y los dos workflows post-merge del commit `566a819719d945e690f85836f91a424afb9d959f` finalizaron en SUCCESS (runs `44777610050` y `44777610037`). La suite offline registró 75 suites / 704 tests, 0 fallos. La persistencia sintética usa `tpvSandboxRepository.js` sobre CMS nativo y comprueba los marcadores de `CajaActual` antes de escribir. No hay evidencia de ejecución Wix Preview, seed de identidades ni E2E runtime. No publicar ni declarar listo el TPV hasta obtener esa evidencia.

> **Estado UI:** `#htmlTPV.txt` conserva el contrato versionado y las operaciones sintéticas. El bootstrap de caja e identidades está implementado, pero no se ha ejecutado en Wix Preview. Cobros reales, pasarelas, fiscalidad, hardware y notificaciones permanecen deshabilitados.

> **Backend canónico:** todos los módulos TPV Velo residen exclusivamente en `src/backend/tpv/`. No reintroducir archivos `src/backend/tpv*.web.js` en la raíz: eran stubs legacy sin consumidores activos.

Este directorio implementa el TPV en modo SANDBOX persistente y sintético para el sitio Marian Madrid en Wix Classic.

## Límites de seguridad

- Los eventos TPV sintéticos se persisten como filas marcadas en `MovimientosCaja`; `CajaActual` conserva la proyección de la sesión Sandbox. `TPV_SANDBOX_COLLECTIONS` son claves lógicas internas, no colecciones físicas.
- `MovimientosCaja` conserva su contrato de ledger: las filas sintéticas se distinguen por `recordSource=TPV_SANDBOX_SYNTHETIC`, `movementType=SIMULATED_TPV_*`, `testRunId`, hash SANDBOX y secuencia fiscal cero. Los ledgers fiscal/contable y `HistoricoCierresZ` no reciben escrituras TPV.
- La idempotencia se aplica mediante índice CMS único `idempotencyKey`, lectura fuerte previa y reconciliación del resultado de inserción concurrente.
- Los reembolsos sintéticos se serializan por venta mediante compare-and-swap en `ControlOperativo`, tipo `TPV_SANDBOX_REFUND_LOCK`. Ventas, devoluciones, movimientos, arqueos y cierres comparten además `TPV_SANDBOX_SESSION_LOCK` para evitar carreras con Ticket Z. Los locks no son ledgers ni almacenan importes.
- Clientes y profesionales se consultan exclusivamente en `TpvSandboxIdentities`; no se consultan CRM, Members, Bookings Staff, reservas ni saldos de Gift Cards. No se llama a Wix Payments, checkout, Orders, refunds, Bookings writers, Gift Card writers, hardware, notificaciones ni emisión fiscal.
- `CajaActual` solo se actualiza como proyección backend de la sesión sintética. No se escribe en `HistoricoCierresZ` ni `LibroAsientosContablesDetalle`.
- Ticket Z cierra solo la sesión SANDBOX y nunca cierra el periodo fiscal u operativo.

## Inventario

| Módulo | Responsabilidad |
|---|---|
| `tpvCaja.web.js` | Apertura diaria SANDBOX, lectura de sesión y arqueo parcial |
| `tpvVentas.web.js` | Validación y persistencia idempotente de venta sintética |
| `tpvMovimientos.web.js` | Entradas, salidas y retiradas sintéticas |
| `tpvCatalogo.web.js` | Lectura nativa de servicios Bookings y Stores Catalog V3; clientes/profesionales solo desde `TpvSandboxIdentities` |
| `tpvPagos.web.js` | Validación de medios mixtos sin pasarela |
| `tpvDevoluciones.web.js` | Reembolso sintético parcial/total, con autorización ADMIN y lock por venta |
| `tpvCierres.web.js` | Resumen, Ticket X y cierre de sesión SANDBOX Ticket Z |
| `tpvAuditoria.web.js` | Consulta de auditoría persistida |
| `tpvPermisos.web.js` | Capacidades SANDBOX derivadas del rol backend |
| `tpvUtils.web.js` | Configuración SANDBOX expuesta al controlador de página (sin validadores duplicados) |
| `tpvUtils.js` | Validación pura, minor units, claves y payload sintético |
| `tpvSandboxRepository.js` | Adaptador lógico sobre `MovimientosCaja`/`CajaActual`, idempotencia, lectura fuerte y locks CAS de sesión/venta |
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
- Los registros son append-only; la identidad no se reutiliza como `contactId`, `memberId` o `resourceId` de Wix. La vinculación con reservas reales sigue deshabilitada y la venta rechaza cualquier `bookingId`.
- El esquema CMS está creado; la carga de filas sintéticas debe hacerse desde el entorno Sandbox de Wix, nunca mediante la API REST de gestión que no acredita selección de Sandbox.
- La consulta de saldo de Gift Cards reales está deshabilitada; no se envía ni persiste ningún código. Emisión, canje y reembolso siguen bloqueados.
- Los eventos de auditoría usan el actor sintético `SANDBOX_ACTOR`; la identidad real solo se usa para autorización backend y no se persiste.


## Contrato del widget HTML

La integración vigente entre `#htmlTPV.txt`, `src/pages/TPV.yl5th.js`, `src/public/tpvPageController.js` y estos WebMethods está documentada en [`docs/architecture/TPV-HTML-WIDGET-BRIDGE.md`](../../../docs/architecture/TPV-HTML-WIDGET-BRIDGE.md). El ID del componente Wix debe ser exactamente `htmlTPV` (sensible a mayúsculas).


### Datos iniciales del simulacro (insertar solo con CMS en Sandbox)

La colección se ha creado vacía. Cuando Wix Editor permita editar explícitamente el entorno Sandbox, insertar estas identidades (Wix genera `_id`; no copiar IDs reales):

| identityId | identityType | displayName | email |
|---|---|---|---|
| `SANDBOX-CUSTOMER-01` | `CUSTOMER` | Cliente Sintético 01 | `cliente01@example.test` |
| `SANDBOX-CUSTOMER-02` | `CUSTOMER` | Cliente Sintético 02 | `cliente02@example.test` |
| `SANDBOX-CUSTOMER-03` | `CUSTOMER` | Cliente Sintético 03 | `cliente03@example.test` |
| `SANDBOX-STAFF-01` | `STAFF` | Profesional Sintético 01 | `staff01@example.test` |
| `SANDBOX-STAFF-02` | `STAFF` | Profesional Sintético 02 | `staff02@example.test` |
| `SANDBOX-STAFF-03` | `STAFF` | Profesional Sintético 03 | `staff03@example.test` |

En las seis filas: `active=true`, `syntheticOnly=true`, `environment=SANDBOX`, `testRunId=TPVSANDBOX-DEV-20261120-01` y `metadata={}`. No añadir teléfono, NIF, dirección, `contactId`, `memberId` ni `resourceId`. El hook valida el contrato antes de aceptar la inserción.


## Runtime Sandbox y arranque de caja

El controlador del widget solicita `inicializarCaja` al completar el handshake. El WebMethod exige sesión autorizada y delega en `initializeSandboxCaja`, que consulta el singleton `CajaActual` en el data plane seleccionado por Wix. No lo crea ni lo actualiza: si falta o no cumple el marcador de Sandbox, falla sin escribir.

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

Esta rama añade un preflight read-only común antes de leer o escribir locks en `ControlOperativo`: debe existir `CajaActual` y cumplir el marcador/run ID permitido antes de adquirir cualquier lock de sesión o devolución. La prueba contractual correspondiente se incorpora a la suite. Está pendiente de CI y merge; no es todavía código integrado en `main`.

No hay evidencia de Wix Preview E2E, runtime publicado, permisos efectivos por rol ni sincronización del código Editor/Git. El sitio Wix se observó en Draft. Mantener NO-GO de publicación.