# TPV Sandbox — relevo técnico de sesión

**Fecha:** 2026-11-20  
**Repositorio:** `nachoortegazgz/marianmadridz`  
**Rama base:** `main`  
**HEAD base verificado:** `6e8386bab15b94b1a2f334bcf4ac1bf1ded51edf`  
**Sitio Wix:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Estado Wix observado/documentado:** Draft; no publicar.

## 1. Resumen ejecutivo

El TPV tiene una implementación de QA persistente con datos sintéticos y controles de seguridad en código. La integración de identidades sintéticas ya está implementada y su esquema CMS existe, pero todavía no se han insertado filas. La sesión de caja QA independiente tampoco tiene bootstrap operativo acreditado.

**Estado de release: NO-GO.** No ejecutar pruebas de escritura en Wix Preview ni publicar hasta demostrar aislamiento backend Sandbox/Published. CI offline post-merge del HEAD base está verde, pero no acredita ejecución de WebMethods, persistencia Wix ni comportamiento runtime.

## 2. Estado verificado en GitHub

HEAD de `main`: `6e8386bab15b94b1a2f334bcf4ac1bf1ded51edf`  
Commit: `docs(tpv): refresh Sandbox release readiness status`.

Ejecuciones post-merge consultadas para ese HEAD:

| Control | Run ID | Resultado |
|---|---:|---|
| Layer 1/2, regresión offline, contratos SDK y ESLint | `44703822699` | SUCCESS |
| Gitleaks full-history | `44703822792` | SUCCESS |

El job de calidad completó los pasos de instalación bloqueada, auditoría npm, Layer 1, Layer 2, suite offline, contratos Wix SDK/eCommerce/TPV y ESLint. La suite del commit de implementación anterior `ecee48f84f05a87d680639b8fec6ddb7da953009` quedó documentada como 74 suites / 692 tests, 0 fallos. Los runs post-merge consultados confirman SUCCESS; no se extrajo un nuevo recuento de tests de sus logs en esta sesión. No atribuirles un recuento adicional no verificado.

PRs relevantes ya integradas:
- #479 — identidades sintéticas leídas desde Sandbox CMS.
- #480 — documentación de estado Sandbox y release gates.

## 3. Arquitectura TPV vigente

- Frontend: `src/pages/TPV.yl5th.js` inicializa `#htmlTPV` mediante `src/public/tpvPageController.js`.
- Widget: `#htmlTPV.txt`; contrato documentado en `docs/architecture/TPV-HTML-WIDGET-BRIDGE.md`.
- Backend canónico: `src/backend/tpv/*.web.js`; no recrear stubs legacy en `src/backend/tpv*.web.js` raíz.
- Repositorio QA: `src/backend/tpv/tpvQaRepository.js`, sobre colecciones CMS nativas existentes. Los nombres `TPV_QA_COLLECTIONS` son claves lógicas, no colecciones físicas.
- Identidades: `src/backend/tpv/tpvSandboxIdentities.js` consulta `TpvSandboxIdentities`; catálogo y validación de ventas ya consumen esa fuente.
- Validación/guardas: `src/backend/validation.js`, hooks de `src/backend/data.js`, configuración canónica en `internalConfig.js`.

Los eventos QA se marcan con `recordSource=TPV_QA_SYNTHETIC`, `movementType=SIMULATED_TPV_*`, `testRunId`, hash QA y secuencia fiscal cero. La persistencia en múltiples colecciones no es ACID; el flujo preparado → líneas/pagos → confirmación permite detectar/reanudar escrituras parciales. Locks CAS protegen sesión y reembolsos frente a concurrencia.

No se habilitan pagos reales, Orders/Bookings writers, reembolsos externos, hardware, notificaciones, emisión fiscal ni writers de ledger fiscal/contable.

## 4. Sandbox: situación y bloqueos

### Verificado/documentado
- La colección CMS `TpvSandboxIdentities` existe; tipo NATIVE, revisión 1, permisos CMS ADMIN.
- Hooks de inserción validan identidad sintética; update/remove están bloqueados por el diseño append-only.
- La lectura backend usa acceso elevado.
- Wix Sandbox contiene datos de CMS y el sitio tiene datos en LIVE y SANDBOX según la lectura previa de uso de datos.

### Pendiente de comprobar en runtime
- No hay filas de clientes/profesionales en `TpvSandboxIdentities`.
- El esquema/hook no han sido probados mediante inserción real en Wix Sandbox.
- No se ha probado que los WebMethods que escriben en `CajaActual`/ `MovimientosCaja` queden aislados de LIVE al invocarse desde Preview y Published.
- No se ha acreditado una API backend oficial y fiable que permita usar `wixWindowFrontend.viewMode` como guard de escritura. Ese valor es contexto frontend y no debe considerarse autorización backend.
- Wix Preview no equivale a E2E publicado; las colecciones de Wix Apps pueden tener comportamiento distinto al CMS nativo.

**Bloqueo P0:** no implementar ni invocar bootstrap de caja o seed de identidades hasta demostrar una frontera de entorno backend fail-closed. No asumir que Preview protege una llamada backend publicada.

## 5. CajaActual: no tocar LIVE

La auditoría documentada en `docs/qa/2026-11-20-live-caja-schema-and-reconciliation.md` observó:
- Colección LIVE `CajaActual`: un singleton `CAJA_PRINCIPAL`, estado `ABIERTA`, con apertura del 2026-11-14.
- `closedAt` y `lastMovementAt` anteriores a `openedAt`.
- `sequenceCounters` persistido como texto JSON aunque el esquema declara OBJECT.
- No hay movimientos ni cierres Z que permitan reconstruir sesión.

No cerrar, corregir, borrar, sobrescribir ni reutilizar ese singleton LIVE. La sesión TPV QA requiere un registro independiente en Sandbox, con marcador inequívoco y `testRunId`.

La colección física `CajaActual` declara 81 campos en la lectura documentada. Los tipos y valores de propuesta no equivalen a contrato de enums/defaults: validar en código y runtime antes de persistir. No usar la propuesta de valores iniciales como autorización para escribir.

## 6. Identidades sintéticas propuestas (sin insertar)

Colección: `TpvSandboxIdentities`.

| identityId | identityType | displayName | email |
|---|---|---|---|
| `QA-CUSTOMER-001` | `CUSTOMER` | Cliente Sintético 01 | `cliente01@example.test` |
| `QA-STAFF-001` | `STAFF` | Profesional Sintético 01 | `staff01@example.test` |
| `QA-STAFF-002` | `STAFF` | Profesional Sintético 02 | `staff02@example.test` |

Cada fila debe tener `active=true`, `syntheticOnly=true`, `environment=SANDBOX`, `testRunId=TPVQA-DEV-20261120-01` y `metadata={}`. Wix genera `_id`. No añadir PII, teléfonos, NIF, direcciones, IDs de contactos, miembros o recursos nativos. Estas filas siguen **sin insertar**.

## 7. Riesgos y datos LIVE preexistentes

La auditoría LIVE permanece en el documento de reconciliación. Entre los hallazgos:
- Tres registros `FISCAL_LEDGER/PENDING_RECOVERY` en `ControlOperativo`, relacionados con pedidos #10032 y #10033.
- Pedido #10033: pago reembolsado, booking aún CONFIRMED/PAID.
- Pedido #10032: pedido POS mixto Stores + Bookings, requiere tratamiento manual.
- Caja LIVE inconsistente, sin movimientos ni cierres Z.

No reintentar compensaciones, modificar pedidos/bookings, crear asientos/movimientos de cuadre ni ejecutar crons manualmente en este trabajo TPV. Mantener estos casos separados del Sandbox.

## 8. Próxima secuencia de trabajo

1. **P0 — Aislamiento:** estudiar documentación oficial Wix vigente y demostrar una estrategia backend que no permita escrituras LIVE por rutas Preview/Published. Probar primero con una operación inocua/read-only y evidencia de contexto. Si no hay mecanismo contractual fiable, mantener los writers cerrados y elevar la limitación; no improvisar un guard.
2. **P1 — Contratos:** revisar `internalConfig.js`, políticas de escritura, `assertQaCajaWritable()`, `_ensureCajaActualForQa()`, hooks CMS y `QA_TEST_RUN_ID`. Diseñar ciclo de vida del test run (crear/activar/cerrar/rotar) sin romper la lectura de datos históricos.
3. **P1 — Bootstrap aislado:** solo después de demostrar el aislamiento, implementar apertura idempotente de una caja QA independiente. Resolver conflicto concurrente con lectura fuerte y verificar el marcador antes de cualquier mutación.
4. **P1 — Seed sintético:** insertar las tres identidades en CMS Sandbox desde un contexto inequívocamente Sandbox; verificar lectura y hooks. No usar REST de gestión sin selector de entorno.
5. **P1 — Runtime:** ejecutar Wix Preview con roles ADMIN, GESTION, ESTILISTA y miembro sin rol; verificar bridge, catálogo, identidades, permisos y flujos sintéticos.
6. **P1 — E2E/concurrencia:** venta sintética, medios simulados, devolución sintética, arqueo, Ticket X/Z, reintentos idempotentes y locks concurrentes. Comprobar que LIVE no cambia antes/después.
7. **P2 — Documentación:** actualizar este relevo, README TPV, issue #435 y evidencias de pruebas con resultados reales.
8. No publicar mientras quede cualquier gate P0/P1 abierto.

## 9. Pruebas y comandos

En el repo local, después de sincronizar la rama aprobada:
- `npm ci`
- `npm test`
- `npm run test:layer1`
- `npm run lint`

Confirmar que los scripts existen en `package.json` antes de ejecutar. Las pruebas offline no sustituyen Wix Preview/E2E. Registrar commit SHA, run IDs y logs relevantes.

## 10. Estado final de validación

| Área | Estado |
|---|---|
| Cambios de código de identidades | Integrados en main (PR #479) |
| Esquema CMS Sandbox | Verificado por lectura; runtime pendiente |
| Filas de identidades | No insertadas |
| Bootstrap de caja QA | Pendiente |
| Aislamiento backend Sandbox/LIVE | No demostrado; bloqueo P0 |
| CI post-merge del HEAD base | SUCCESS (runs indicados) |
| Wix Preview / WebMethods runtime | No ejecutado |
| E2E de widget y caja | No ejecutado |
| Datos LIVE | No modificar |
| Publicación | NO-GO |

**Criterio de salida:** solo declarar listo cuando exista evidencia runtime de aislamiento, datos Sandbox sintéticos, pruebas E2E completas, comparación LIVE sin cambios, CI verde y reversión segura.

## Addendum de reconciliación — 2026-11-20

La lectura read-only más reciente de Wix CMS Management API actualiza el snapshot anterior. Véase `docs/audits/2026-11-20-live-cms-and-wix-lock-reconciliation.md`.

Conteos observados: `CajaActual=1`, `MovimientosCaja=0`, `TpvSandboxIdentities=0`, `ControlOperativo=58`, `HistoricoCierresZ=0`.

El único `CajaActual` consultado está marcado `snapshotSource=TPV_QA_SYNTHETIC`, pero permanece `ABIERTA`, `openedBy=TPV_SANDBOX_SYSTEM`, con `traceId=TPV-SANDBOX-OPEN-mwopb42y-u1bz4asy` y `sequenceCounters={}`. No coincide con el test-run vigente `TPVQA-DEV-20261120-01` ni con el contrato `SIMULACION`/bootstrap cerrado de `assertQaCajaWritable()`. El backend debe rechazarlo. **No reutilizar, cerrar, corregir ni sobrescribir este singleton.**

La lectura de Management API no es una prueba del dataset Sandbox de Preview. No se han realizado escrituras. El aislamiento y el bootstrap Sandbox siguen pendientes; la publicación permanece NO-GO.


## Addendum de continuidad — 2026-11-20, PR #497 y revisión de límites

- PR #496 integrada en `main`: commit `24d621b6acaf80cd22e662e4c93f37817e1f57a8`.
- PR #497 integrada en `main`: commit `566a819719d945e690f85836f91a424afb9d959f`.
- PR #497 corrigió el indicador de persistencia de resultados de lectura del controlador; ambos workflows de PR finalizaron en SUCCESS. Los workflows post-merge del SHA `566a819...` finalizaron en SUCCESS: calidad offline `44777610050` y Gitleaks `44777610037`. La suite offline registró 75 suites / 704 tests, 0 fallos.
- `tpvSandboxRepository.js` comprueba el marcador de `CajaActual` antes de insertar eventos sintéticos: una caja existente debe ser `TPV_SANDBOX_INITIALIZED` (solo bootstrap) o `TPV_SANDBOX_SYNTHETIC` con el `SANDBOX_RUN_ID` exacto. Los eventos posteriores vuelven a comprobar la caja antes de insertar en `MovimientosCaja`.
- Esta comprobación es una defensa por estado de datos, no una API oficial de detección del entorno Preview. La separación efectiva depende de que Wix Data enrute las llamadas ejecutadas desde Preview a CMS Sandbox. El singleton LIVE observado no satisface el marcador sintético y debe permanecer intacto.
- En el estado de código de este addendum, `inicializarCaja` consulta el singleton y verifica las identidades; el bootstrap y el seed no crean datos automáticamente. La presemilla debe hacerse manualmente desde CMS Sandbox.
- La suite offline incorpora una prueba contractual que exige comprobar el marcador de `CajaActual` antes de insertar el singleton durante bootstrap y antes de insertar eventos.
- No se han realizado escrituras CMS, sincronización Sandbox→Live, publicación ni despliegue.

**Estado de salida:** CI post-merge del commit `566a819...` aprobado (75 suites / 704 tests, 0 fallos); Wix Preview, bootstrap, identidades y E2E siguen pendientes. Mantener NO-GO de publicación hasta validar el recorrido en el sitio y demostrar que LIVE no cambia.


## Addendum — endurecimiento de bootstrap antes de release

El bootstrap del TPV se ha convertido en una operación de solo lectura. `initializeSandboxCaja()` falla si no existe un singleton presembrado y valida el marcador exacto; `seedSandboxIdentities()` exige las seis identidades preexistentes y nunca inserta filas. Se elimina así la ruta de creación automática de datos sintéticos cuando una llamada llegue a la colección Online del sitio publicado.

La precondición manual se realiza exclusivamente desde el CMS Sandbox del Editor. No usar Wix Management API para sembrar datos, no sincronizar Sandbox→Online y no tratar las colecciones de Wix Apps como aisladas. Este cambio no demuestra por sí mismo el aislamiento runtime ni completa la aceptación E2E. Mantener NO-GO de publicación hasta ejecutar Preview y comprobar datos LIVE antes/después.


## Addendum vigente — 2026-11-20, HEAD main cfe1d0c

Este bloque prevalece sobre los snapshots y addenda TPV anteriores cuando exista contradicción.

### Repositorio y CI
- HEAD de `main`: `cfe1d0c37a9464cb63aea9d31873071eecb10d9f` (PR #499 fusionada).
- PR #496, #497, #498 y #499 integradas.
- CI post-merge para este SHA: Backend offline quality SUCCESS (run `44780145944`) y Gitleaks SUCCESS (run `44780145900`).
- Evidencia: Layer 1 28 suites/338 tests; Layer 2 19 suites/268 tests; total 75 suites/705 tests, 0 fallos; contratos Wix SDK, eCommerce Order Transactions y TPV Catalog, ESLint y Gitleaks PASS.
- Esta evidencia es offline/estática. No acredita Wix Runtime, Preview E2E, permisos efectivos ni despliegue.

### Contrato TPV Sandbox vigente
- Configuración canónica actual: `TPV_SANDBOX_RUNTIME_POLICY.ENABLED=true`, `ENVIRONMENT=SANDBOX`, `SYNTHETIC_ONLY=true`, pagos reales, escrituras fiscales, notificaciones y hardware deshabilitados; run ID `TPVSANDBOX-DEV-20261120-01`.
- No confundir esta implementación con la ruta histórica `TPV_QA_RUNTIME_POLICY` / WebMethods con sufijo QA. La documentación antigua de esa ruta se conserva como historial, no como contrato actual del TPV Sandbox.
- Los WebMethods actuales usan nombres neutros y exigen autorización backend y `assertTpvSandboxEnabled()`. Las etiquetas `environment` / `previewOnly` no prueban por sí solas qué data plane atiende la llamada.
- Las colecciones `SANDBOX_LOGICAL_*` son aliases lógicos, no colecciones físicas nuevas: el repositorio proyecta eventos en `MovimientosCaja`, estado de sesión/proyección en `CajaActual` y locks en `ControlOperativo`. Wix Apps no quedan aisladas por CMS Sandbox.
- PR #499 convirtió el bootstrap de caja y la comprobación de las seis identidades en read-only. La aplicación exige presemilla manual en CMS Sandbox; no crea singleton ni identidades automáticamente.

### Precondiciones sintéticas
- Caja: `_id=SINGLE_ITEM_ID`, `singletonKey=CAJA_PRINCIPAL`, `cashRegisterStatus=CERRADA`, `snapshotSource=TPV_SANDBOX_INITIALIZED`, `traceId=TPVSANDBOX-DEV-20261120-01`, `sequenceCounters` objeto y `conceptOperations.tpvSandbox.sandboxRunId` coincidente.
- Identidades: tres clientes y tres profesionales, IDs `SANDBOX-CUSTOMER-01..03` y `SANDBOX-STAFF-01..03`, `environment=SANDBOX`, `syntheticOnly=true`, `active=true`, `testRunId` igual al run ID y correos `@example.test`. No añadir PII ni referencias de CRM/Bookings/Members.
- Última lectura read-only documentada: `TpvSandboxIdentities=0` en ambos data planes. No se ha demostrado que la presemilla exista ni se ha ejecutado.

### Corrección adicional en revisión
La revisión del repositorio identificó que los locks de `ControlOperativo` deben validar el marcador de `CajaActual` antes de cualquier acceso. La rama `fix/tpv-sandbox-lock-preflight-and-docs` incorpora un helper read-only común, el preflight previo a los locks y una prueba contractual. Está pendiente de CI/merge; no atribuir esta corrección a `main` hasta su integración.

### Riesgos y límites no resueltos
- `SANDBOX_RUN_ID` es estático; no existe ciclo de vida/rotación de test-run validado.
- No se ha ejecutado Wix Preview E2E ni prueba negativa desde Published/direct WebMethod.
- No hay prueba de concurrencia/atomicidad en Wix Runtime para todos los escritores de `CajaActual` (H-01).
- No se ha ejecutado comparación de datos LIVE antes/después de una jornada TPV.
- Permisos efectivos por rol, efectos de automatizaciones y Wix Apps, reset sintético preproducción y rollback permanecen pendientes.
- Site Context observado: Draft. No se ha publicado ni acreditado la sincronización del código con Wix Editor.

### Decisión
CI offline de `main` en el SHA indicado: PASS. Integridad runtime, E2E y readiness global: NO VERIFICADOS. Publicación/despliegue: **NO-GO**. No tocar singleton LIVE, tres compensaciones `PENDING_RECOVERY`, pedidos #10032/#10033 ni ledgers. No sincronizar Sandbox→Online.


## Addendum posterior a PR #500 — 2026-11-20

PR #500 está fusionada en `main`: commit `6da7cdf0d815ad2e1833f5bd56b5950aff2afb3e`. La corrección consolida el helper `_ensureCajaActualForSandbox()` para validar existencia y marcador/run ID de `CajaActual` y ejecuta ese preflight antes de cualquier lectura/escritura de locks en `ControlOperativo`. Se añade una prueba contractual específica.

Validación pre-merge del HEAD `306816dff20d62e4ec3fda87e25fb050c155bb96`: Layer 1 28 suites/339 tests PASS; Layer 2 19 suites/268 tests PASS; suite completa 75 suites/706 tests PASS; contratos Wix SDK, eCommerce Order Transactions, TPV Catalog y ESLint PASS; Gitleaks PASS (runs `44781808680` y `44781808524`). CI post-merge para `6da7cdf0...` está en curso en los runs `44781982497` y `44781982392`; no declararlo aprobado hasta que ambos finalicen SUCCESS.

La corrección es una barrera de código por estado de datos; no identifica de forma contractual Preview frente a Published. No equivale a prueba de aislamiento runtime ni a aceptación E2E. Wix Preview, prueba negativa Published, concurrencia H-01, permisos efectivos, efectos externos, comparación LIVE antes/después y reset preproducción siguen pendientes. Sitio Wix observado en Draft. **NO-GO de publicación.**
