# SESSION HANDOFF — Marian Madrid / Wix Auditoría
**Fecha:** 2026-11-20  
**Repositorio:** `nachoortegazgz/marianmadridz`  
**Sitio Wix:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Estado global:** desarrollo/QA; producción **NO-GO**.

> Documento de traspaso operativo. Prevalece sobre notas históricas anteriores cuando exista contradicción de estado. No implica que las tareas marcadas pendientes estén ejecutadas.

## 1. Baseline y control de cambios

- Rama base `main` en la creación de PR #469: `6f97878d7e33082ce1f51fd84729df5533d762aa` (merge de PR #468).
- PR #468: integrada en main. Merge SHA `6f97878d7e33082ce1f51fd84729df5533d762aa`. Sus workflows de secret scanning y backend offline quality gates finalizaron SUCCESS.
- PR #469: [docs(qa): confirm CajaActual native bulk patch eligibility](https://github.com/nachoortegazgz/marianmadridz/pull/469). Sigue abierta/no fusionada en la última consulta fiable. Rama `audit/cajaactual-bulkpatch-contract-evidence`.
- La PR #469 tuvo CI SUCCESS en el commit `bd07f138620cba95b87d5486d2e4fe1637fb2fc1`: Backend offline quality gates y Secret scanning. Después se añadieron dos commits documentales (`50c176a057a32560f39f2a9b86fad83e48f022e2`, `45145b4a1188a9d8df557edcbdb052b3c13af735`). **Estos commits posteriores todavía requieren CI.** Reconsultar estado y head antes de merge.
- GitHub devolvió un `merge_commit_sha` para #469 pese a que el estado era `open`, `merged=false`; no tratar ese SHA como merge confirmado.
- `main` continúa sin branch protection/ruleset ni required checks (última evidencia API: `protected=false`). Issue #210 requiere acción owner/admin. No hay que asumir que el auto-merge del repositorio sustituye esa protección.
- El último SHA de contenido devuelto por `fetch_file` no es necesariamente el commit HEAD; verificar HEAD mediante comparación de refs/commits y estado de PR, no confundir blob SHA con commit SHA.

## 2. Avances verificados de esta sesión

### PR #469 — documentación H-01
Cambios documentales en:
- `docs/architecture/ADR-CASH-REGISTER-SESSION-CONTROL.md`
- `docs/qa/2026-11-20-project-state-and-release-plan.md`

Se documenta:
- CMS read-only devuelve `CajaActual.collectionType=NATIVE`, `revision=18`, `sequenceCounters: OBJECT`.
- La enumeración Wix distingue `NATIVE` (colección creada por usuario) de `WIX_APP` (colección creada por app). Se resuelve la elegibilidad de la colección para Patch/Bulk Patch.
- El SDK `@wix/data` documenta `items.bulkPatch()`, `condition.filter` y modificaciones parciales como `SET_FIELD`, `INCREMENT_FIELD` y `APPEND_TO_ARRAY`; los incrementos se ejecutan atómicamente en servidor y se emite Data Item Updated.
- El DAL ya tiene `bulkPatchItems()`, pero su política allowlist actual solo autoriza ciertos casos de `ControlOperativo`; CajaActual no está autorizada.
- Se añadieron escritores que deben migrarse coordinadamente.
- La sección 13 del ADR declara que supersede el bloqueo de elegibilidad de colección de la sección 12, pero mantiene pendientes los contratos de hook, condición fallida y runtime.

### Escritores de CajaActual identificados
1. `src/backend/cajas.web.js::_updateCajaActual`: proyección de movimientos con `dalUpdate(CAJA_ACTUAL_COL, cashRegister)`.
2. `src/backend/cajas.web.js`: cierre Z actualiza CajaActual con `dalSave(CAJA_ACTUAL_COL, cashRegister)`.
3. `src/backend/fiscalLedgerLock.js`: reserva/liberación/compensación de secuencias mediante update sobre la caja.
4. `src/backend/tpv/tpvQaRepository.js::_writeCajaProjection`: proyección QA mediante `updateItem(CAJA_ACTUAL, next)`.
5. `src/backend/tpv/tpvQaRepository.js`: apertura/cambio de sesión QA mediante `updateItem(CAJA_ACTUAL, updated)`.

No dejar escritores de reemplazo completo conviviendo con el nuevo mecanismo condicional. La migración debe ser única y coordinada.

## 3. H-01 — diagnóstico y decisión

**Problema verificado estáticamente:** el DAL actual hace update completo y no pasa predicado de versión. La lectura fuerte dentro de `beforeUpdate` no constituye compare-and-swap. Los reintentos de escritura no evitan lost updates cuando dos escritores parten del mismo snapshot.

**Candidato preferente:** `items.bulkPatch()` con condición/versionado y modificaciones parciales atómicas. No está implementado ni probado como CAS para este singleton.

**Pendiente de validar en Wix Sandbox antes de código productivo:**
1. Semántica exacta de condición no satisfecha: respuesta/error y cómo distinguirla de un timeout/fallo incierto.
2. Filtro sobre el campo elegido; confirmar soporte real del path anidado si se usa `sequenceCounters.seqGlobal`.
3. Si Bulk Patch ejecuta `CajaActual_beforeUpdate`, con qué payload, y si la forma satisface el contrato del hook. No usar `suppressHooks` para sortear garantías.
4. Comportamiento de `sequenceCounters: OBJECT` y actualización atómica de campos anidados.
5. Idempotencia ante timeout después de commit y reentrega.
6. Prueba concurrente de dos movimientos distintos y dos writers simultáneos, sin pérdida ni doble aplicación.
7. Reserva y liberación de secuencias fiscales sin rollback inseguro.
8. Migración coordinada de los cinco productores anteriores, apertura/cierre Z y cualquier otro writer descubierto en búsqueda completa.

**Diseño de prueba recomendado:** colección/datos Sandbox aislados, dos writers simultáneos con deltas distintos, replay de mismo movement ID, condición conflictiva, timeout tras commit, relectura fuerte y reconciliación. Verificar suma final, versión, IDs aplicados y secuencias. No usar el singleton live como fixture.

## 4. Estado Wix/CMS y límites de seguridad

- Estado del sitio documentado como Draft/no publicado en la última lectura de contexto Wix. Revalidar antes de cualquier operación.
- La consulta de esquema CajaActual fue read-only. No se consultó ni mutó el singleton como parte de la verificación NATIVE.
- La colección es elegible por tipo, pero esto **no** valida el CAS, hooks ni los writers.
- No se han realizado escrituras CMS, cambios de permisos, mutaciones del singleton, pagos, remisiones fiscales, reintentos de compensaciones ni publicación en esta intervención.
- Los registros contables/fiscales del entorno son sintéticos/editables según declaración expresa del usuario; mantener esta condición de QA y no activar procesos reales.
- Mantener CMS como SSOT transaccional; SharePoint solo evidencia; no introducir writers fiscales/contables.
- No alterar ni borrar registros append-only. No reintentar las compensaciones históricas por inferencia.

## 5. Bloqueos abiertos y prioridades

### P0 — Integridad, fiscalidad y reconciliación
- **#434:** release gate global; NO-GO hasta cierre de bloqueos.
- **#209 / #415:** modelo fiscal/SIF, maestro fiscal y credenciales/configuración incompletos. Writers fiscales deshabilitados.
- **#416:** tres registros `FISCAL_LEDGER/PENDING_RECOVERY` sin reconciliar y singleton CajaActual live anómalo. No reintentar ni mutar sin reconstrucción y autorización.
- **#290:** claims atómicos/concurrencia de webhooks por acreditar en runtime.
- **#441:** corrección de canal POS integrada en código, pero compensaciones históricas y E2E pendientes.

### P1 — Operaciones, concurrencia y QA
- **H-01 / #434:** endurecimiento de CajaActual y concurrencia; prioridad inmediata de ingeniería.
- **#435:** TPV QA E2E Wix Sandbox pendiente.
- **#159 / #162 / #164:** idempotencia, recuperación dual y MessageEvent requieren E2E runtime.
- **#188:** área privada cliente requiere E2E autenticado.
- **#211:** Wix Bookings + Payments + eventos Sandbox.
- **#223:** snapshot exacto/versionado antes de envío a Gestoría.
- **#237:** autoridad única de inventario Wix Stores Catalog V3.
- **#261:** prueba de permisos CMS_EDITOR con identidad real.
- **#291:** conditional bulkRemove y carreras en runtime.
- **#210:** branch protection/ruleset y checks requeridos, intervención owner/admin.

### P2
- **#173:** Power Automate/SharePoint E2E; no afirmar automatización hasta demostrarla.

Revalidar el estado actual de cada issue antes de actualizarla/cerrarla; la lista refleja el backlog consolidado disponible, no una consulta live exhaustiva de issues en esta sesión.

## 6. Próxima sesión — orden exacto de trabajo

1. **Reconciliar GitHub:** consultar PR #469, head SHA, checks del head más reciente, estado real de merge y HEAD de main. No confundir `merge_commit_sha` informado con `merged=true`. Si los checks del head final están verdes y el diff es solo documental, fusionar #469 según autorización general del usuario y confirmar main por SHA y contenido.
2. **Cerrar la documentación:** confirmar que ADR sección 13 y el handoff están en main; corregir cualquier nota histórica que siga contradiciendo estado actual.
3. **Inspección de contrato runtime:** leer `dataAccess.js`, `dataAccessPolicy.js`, `internalConfig.js`, `data.js`, `cajas.web.js`, `fiscalLedgerLock.js`, `tpvQaRepository.js` y tests; buscar exhaustivamente todos los usos de update/save/patch/bulkPatch sobre CajaActual.
4. **Spike mínimo aislado:** implementar solo en rama/PR un test harness Sandbox para verificar Bulk Patch, condición fallida, hook y campos anidados. No tocar singleton live. Si Wix no demuestra CAS/semántica fiable, detener y elegir lock/ControlOperativo atómico documentado.
5. **Contrato único:** definir versión monotónica y transiciones válidas; matriz de campos por operación; idempotency key; timeout incierto; conciliación; política de reintentos acotados.
6. **Implementación coordinada:** migrar todos los escritores CajaActual y endurecer allowlist DAL con tipos de operación explícitos. No ampliar allowlist genéricamente.
7. **Tests:** unitarios/mocks, contratos SDK, concurrencia, idempotencia, regresión, seguridad negativa, hooks y Wix Sandbox E2E. No declarar runtime validado por CI offline.
8. **Actualizar issues:** #434, #416, #435, #210 y las relacionadas con evidencia y enlaces de PR.
9. **No desplegar:** hasta resolver P0, E2E, fiscalidad aplicable, branch protection, rollback y autorización explícita de publicación.

## 7. Criterios de cierre H-01

- Todos los productores están inventariados y usan el mismo contrato condicional/lock.
- Dos escrituras concurrentes distintas no pierden incrementos.
- Repetición de la misma operación no duplica el movimiento ni el saldo.
- Timeout tras commit se resuelve mediante relectura/idempotencia, nunca reejecutando a ciegas.
- Secuencias y locks conservan invariantes.
- Hooks/validaciones no se eluden y su comportamiento está probado.
- Suite pertinente y Wix Sandbox pasan; diff revisado; rollback definido.
- Ningún registro histórico/append-only se modifica para reparar la proyección.

## 8. Referencias oficiales Wix

- [Get Data Collection](https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-collections/get-data-collection)
- [Bulk Patch Data Items — SDK](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/bulk-patch-data-items?apiView=SDK)
- [Bulk Patch Data Items — REST](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/bulk-patch-data-items)
- [Velo beforeUpdate hook](https://dev.wix.com/docs/velo/apis/wix-data/hooks/before-update)

---
**Última conclusión:** el bloqueo de elegibilidad de CajaActual para Patch está resuelto por evidencia CMS NATIVE. H-01 no está resuelto: el siguiente trabajo real es validar el comportamiento de Bulk Patch y hooks en Sandbox y migrar todos los escritores en una única intervención. Producción permanece NO-GO.


## 9. Cierre de la sesión — estado final confirmado

- PR #469 quedó **fusionada** el 2026-11-20 mediante merge commit `436c7da665c467de66597e31bccd8745ba52f42c`.
- Se verificó que `main` y el merge commit son idénticos (`compare_commits: identical`).
- La cabeza final de PR #469 (`55e4094e8b364fafde835a47458a193e3d64e531`) superó ambos workflows: Backend offline quality gates run `44682687922` SUCCESS y Secret scanning run `44682687501` SUCCESS.
- El merge commit no presenta workflows asociados en la consulta; la evidencia CI corresponde a la cabeza de PR antes del merge.
- Documentos integrados en main: ADR sección 13, actualización del plan QA y este handoff.
- En el corte anterior a PR #472 no se integró código runtime. No hubo escrituras CMS, cambios de permisos, mutaciones de CajaActual, pagos, ledgers ni publicación.
- Próximo punto de trabajo en ese corte: H-01 spike Sandbox/contrato Bulk Patch + hooks; no abrir implementación de writers hasta demostrar el comportamiento.

## 10. Revalidación TPV Sandbox — 20-11-2026

### Baseline GitHub
- PR #472 integrada en `main`: `6a31adf30774479dd1c0c6417187860726ea4f08`.
- Cambio: `TPV_QA_RUNTIME_POLICY.ENVIRONMENT = "SANDBOX"`; `assertTpvQaEnabled()` valida esa constante.
- Tests `Backend offline quality gates` y `Secret scanning` del head de PR #472 finalizaron SUCCESS.
- No hubo escrituras Wix, cambios de colecciones, datos, permisos ni sincronización Sandbox → Live.

### Contrato Wix Preview/Sandbox
- Site context confirma Wix Editor clásico y Velo habilitado.
- Documentación oficial Wix Help Center, actualizada 2026-11-12, confirma que Sandbox es opcional y está deshabilitado por defecto en sitios nuevos. Preview solo utiliza la copia Sandbox cuando el toggle CMS está habilitado.
- La API de gestión/metadata consultada no demuestra el estado actual del toggle de este sitio.
- Antes de persistir pruebas TPV, el propietario debe habilitar Sandbox en CMS > Your Collections > Manage > More Actions > Advanced Settings > Sandbox y confirmar que las colecciones muestran la pestaña "Sandbox Collection".
- Prohibido sincronizar Sandbox → Live durante QA.

### Estado TPV
- Sin colecciones nuevas; se reutilizan las copias Sandbox de `CajaActual`, `MovimientosCaja` y `ControlOperativo`.
- El backend mantiene los marcadores `TPV_QA_SANDBOX_INITIALIZED` / `TPV_QA_SYNTHETIC`, `testRunId` y los controles de autorización.
- `withQaSessionLock` realiza preflight de `CajaActual` antes de escribir locks en `ControlOperativo`; `insertQaEvent` comprueba el marcador antes de persistir eventos.
- `registerManualTransaction()` no se invoca desde la ruta QA; los writers fiscales y contables continúan deshabilitados.
- Actor fijo `QA_ACTOR` sigue pendiente de sustituir por identidad autenticada de miembro/staff.
- Wix Preview/Local Editor E2E, prueba de invocación directa de WebMethods desde Live, concurrencia/idempotencia y conciliación siguen pendientes. CI offline no acredita estos contratos.

### Release gate
- Issue #471 permanece abierta.
- Issue #210 permanece abierta: `main` sigue sin protección/ruleset ni checks obligatorios.
- Producción continúa **NO-GO**. No publicar ni sincronizar datos hasta completar Sandbox, E2E, H-01, conciliaciones P0, revisión fiscal/legal y demás gates del informe #434.


## 11. Reconciliación de cierre — PR #482–#485

El handoff histórico de las secciones 1–10 refleja cortes anteriores. Para el estado vigente, prevalecen este addendum y `docs/qa/QA-ENVIRONMENT-SSOT.md`.

- PR #482 integrada: commit `520e99b87caedfc6323e1f27f5638a0053774eb9`; C2 corrige el import de `wix-fetch`; CI completa 74 suites / 692 tests en el head final y secret scanning.
- PR #483 integrada: commit `a801405f77dddfe8fcfe76a825be47e656aa542c`; C1 queda descrita como desalineación Wix/npm, no ausencia global del paquete.
- PR #484 integrada: commit `03a67652d87298855aec70d43b2ac44fa5024994`; fail-closed TPV persistente, sin escrituras Wix. Runs de CI `44726194437` y `44726194440` SUCCESS.
- PR #485 integrada: commit `470ea256d2af88bc62465788cd67e40d84f1a001`; snapshot read-only de uso LIVE/SANDBOX.
- El snapshot más reciente informa LIVE 201 elementos y SANDBOX 107. Sustituye el snapshot anterior que informaba SANDBOX 0. Los contadores no acreditan el contexto de ejecución de WebMethods.
- `TPV_QA_RUNTIME_POLICY.ENABLED=false` sigue siendo la configuración canónica. No restaurar `true` basándose únicamente en Preview o en la existencia de almacén Sandbox.
- No se han creado clientes/profesionales sintéticos, no se ha inicializado caja, no se ha ejecutado E2E en Wix ni se ha publicado.
- CajaActual LIVE observado: un singleton con estado/marcadores incompatibles con el test-run vigente; no tocar sin reconciliación. Tres `COMPENSATION/PENDING_RECOVERY` en ControlOperativo siguen pendientes y sin mutación.

**Próximo paso de código:** contrato automatizado que compruebe que cada WebMethod QA expuesto ejecuta el guard backend antes de cualquier acceso al repositorio. La prueba será offline y no se presentará como certificación de Wix Runtime.


## 12. Cierre PR #486 — contrato backend y estado consolidado

- PR #486 fusionada: `5ef81ff132f4cbff594387a60e4446bc5dada171`.
- Contrato offline de WebMethods QA integrado y CI SUCCESS: run `44727128060`; secret scanning SUCCESS: `44727128076`.
- Resultados: npm ci PASS; npm audit 0 vulnerabilidades; Layer 1 28 suites / 335 tests; Layer 2 19 suites / 267 tests; total 74 suites / 693 tests; SDK contracts y ESLint PASS.
- El nuevo contrato cubre el orden guard backend/repositorio en la lista de métodos QA explícitamente declarada. No prueba invocaciones Wix ni la selección del data plane.
- Logs de CI advierten dependencias obsoletas y ESLint 8.25.0 sin soporte. No actualizar sin validar compatibilidad del plugin Wix.
- Main confirmado: `5ef81ff132f4cbff594387a60e4446bc5dada171`.
- Release continúa NO-GO; TPV QA runtime deshabilitado y sin escrituras Wix.


## 13. Cierre PR #488 — clasificación de WebMethods TPV

- PR #488 fusionada: `75c4428fea45795d4337011c389ac909f0aa6e03`.
- Se clasifica cada WebMethod exportado en módulos TPV revisados: guard QA backend, read-only/validación o writer legacy fail-closed. Añadir una nueva exportación sin política rompe el test.
- CI SUCCESS: backend offline quality gates `44727911850`; secret scanning `44727911591`. Layer 1/2, regresión completa, SDK, eCommerce/TPV SDK y ESLint PASS.
- No es Wix E2E; no prueba permisos efectivos ni aislamiento Sandbox/Live. No se cambió runtime, CMS ni flags. TPV persistente continúa deshabilitado.


## 14. Cierre PR #490 — corrección de presentación de paquetes mensuales

- PR #490 integrada mediante squash: `a7cf9fc24e760bdf87b0a1df839dd3888ce462b6`; `main` verificado idéntico al commit.
- Corregido `getPreparedManagerPackages()`: los snapshots `MONTHLY` ya no se muestran como trimestres. El identificador mensual usa `fiscalMonth` (o fallback histórico `_Mmm_`), y la etiqueta es `MM/YYYY`. Periodos inválidos no se inventan; quedan explícitamente marcados como incompletos.
- La descarga devuelve el mismo identificador de presentación coherente. El formato trimestral previo se conserva.
- CI sobre head `ef13ec629583fba5db7dbe93d6c7bdff54e8ed19`: Backend offline quality gates SUCCESS run `44730611443`; Secret scanning SUCCESS run `44730611433`.
- Resultados: `npm ci` PASS; `npm audit` no bloqueó; Layer 1 28 suites / 336 tests; Layer 2 19 suites / 268 tests; regresión completa 74 suites / 695 tests; contratos SDK Wix, eCommerce/TPV y ESLint PASS.
- No se modificaron CMS, snapshots, ledgers, permisos, secretos, envíos ni configuración de Wix. No se ejecutó Wix Runtime/E2E ni publicación.

**Main verificado:** `a7cf9fc24e760bdf87b0a1df839dd3888ce462b6`. El estado global sigue NO-GO para publicación por bloqueos de entorno, conciliación y fiscalidad; esta corrección mejora un flujo documental, no certifica el ecosistema.
