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
