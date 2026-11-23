# Estado consolidado del proyecto y plan de cierre

Fecha de corte: 2026-11-20  
Repositorio: `nachoortegazgz/marianmadridz`  
Rama: `main`  
Site ID: `188bed94-177c-4bc9-a9f0-35080d874f3e`  
Último SHA de aplicación verificado: `94163f66c7c3f1513a169162726b3b8e05a21ff0`

## 1. Dictamen ejecutivo

**NO-GO para producción comercial.** La calidad offline del backend ha avanzado, pero siguen abiertos bloqueos fiscales, de conciliación, de seguridad de integración y de validación Wix Runtime. No se debe publicar ni habilitar writers económicos/fiscales/contables por el mero hecho de que CI esté verde.

El propietario declaró que el sitio está en desarrollo y que los datos son sintéticos. Esto permite diseñar pruebas controladas, pero no convierte una colección LIVE en Sandbox ni autoriza efectos externos. Los ledgers fiscales, contables y laborales mantienen el principio append-only: no se actualizan ni borran; las correcciones se realizan mediante registros rectificativos trazables.

## 2. Estado verificado del repositorio

- `main` apunta a `962aa48d892890dbe2a919cbfc9b30f883c36232` tras PR #464 (documentación). El último commit de aplicación sigue siendo `94163f66c7c3f1513a169162726b3b8e05a21ff0` tras PR #462.
- PR #456 integrada: refresco del estado consolidado tras la auditoría CMS (`1357d770d6b786f6ecdad1c93d4d29002c00c810`).
- PR #457 integrada: reconciliación live de CajaActual, CMS y pedidos Wix (merge documental `65983abfaad0e6ae83e2992dd410b32d2d0b0037`).
- PR #458 integrada: importe de booking por línea nativa de pedido y actualización de dossier.
- PR #459 integrada: ausencia de ALERT persistidas y ejecución runtime del cron de bookings no acreditada.
- PR #460 integrada: DTO de caja alineado con openingCashAmount.
- PR #461 integrada: diccionario CMS actualizado y prevalencia de inmutabilidad append-only de ledgers.
- PR #462 integrada: DTO Jornada derivado de openedAt; elimina escritura del campo operationDate ausente (`94163f66c7c3f1513a169162726b3b8e05a21ff0`). CI SUCCESS: Layer 1 333/333, Layer 2 266/266, suite offline 688/688; SDK, npm audit, ESLint y secret scanning SUCCESS.
- PR #463 integrada: documentación del daykey y contrato de caja actualizado.
- PR #464 integrada: ADR CajaActual revalidada con esquema live y contratos oficiales de hooks Wix; sigue pendiente aprobación de implementación.
- PR #460 integrada: DTO de caja alineado con openingCashAmount (`1c3afcea4194e524dc2c67ab102581a4876e90f2`). CI SUCCESS: Layer 1 333/333, Layer 2 266/266, suite offline 688/688; SDK, npm audit, ESLint y secret scanning SUCCESS.
- PR #453 integrada: consolidación documental (`9aa92a9ef7408ab9b431694463ca1ffe2dedacfa`).
- PR #454 integrada: auditoría de productores y bypasses CMS (`06766afbcdf7f8d32d34ccbb3f1ff68a242f8bca`).
- PR #455 integrada: validación central de `PaquetesGestoria` (`7672bac4b4207ba87c9688fa34f38752a253ae86`).
- PR #450 integrada: `11e6cefd838cfd8f18301ddff534e2edd8849743`.
- PR #451 integrada: `bdbdb2467294c781bfc090cd8429d7c060413d15`.
- PR #452 integrada: `5cfbecd6849c56d162f0d20a11b620eb2bea0c54`.
- PR #452 workflow #44667244690: completed / success sobre head `940a6cf9fadb85ed414963eff2cfd1b28c82ed67`; job agregado de Layer 1/2, regresión offline, contratos SDK y lint: SUCCESS.
- No se encontraron PR abiertas en la consulta posterior a PR #455.
- La rama `main` continúa sin protección: API de branch devuelve `protected=false`, `protection.enabled=false`, checks obligatorios desactivados. La integración no dispone de permiso administrativo para corregirlo.
- La consulta de status checks del merge SHA no devolvió statuses asociados. PR #455 sí superó CI: Layer 1 333/333, Layer 2 266/266, suite offline 688/688, SDK contracts, npm audit (0 advisories), ESLint y secret scanning SUCCESS. No se declara workflow post-merge.
- No se ha ejecutado Wix Local Editor, Preview ni E2E desde esta sesión. No se declara sincronización local/runtime verificada.

## 3. Hitos integrados

### Seguridad de canal POS — PR #445/#446
- Se corrigió el tratamiento de pedidos POS en el webhook fiscal online.
- El flujo online exige canal WEB verificado; canales distintos requieren revisión manual.
- Queda pendiente la conciliación de las compensaciones históricas asociadas a pedidos 10032 y 10033 (#441/#416).

### Protección de ledger fiscal — PR #447/#448
- Eliminado fallback SIF no verificado.
- Configuración fiscal fail-closed.
- No existe todavía configuración SIF física completa ni conformidad VERI*FACTU.
- Writers fiscales permanecen deshabilitados.

### Gobierno de workflows — PR #449
- Referencias de upload-artifact fijadas a SHA oficial.
- La protección de main sigue pendiente (#210).

### ControlOperativo — PR #450
- Contrato físico alineado con revisión 93.
- `payload` OBJECT requerido y allowlist de campos físicos.
- Registros históricos terminales preservados; compensaciones pendientes no reintentadas.

### Contratos CMS — PR #451
- Refuerzo de validación/hook para colecciones de negocio.
- Se bloquean rutas de cierre Z sin `recordDomain` y responsable de sistema aprobados.
- No se han habilitado writers.

### Auditoría de productores CMS — PR #454
- Auditoría estática de ocho colecciones críticas y sus productores, DAL, hooks y rutas de escritura.
- No se localizó bypass directo activo de `@wix/data` en los módulos backend revisados.
- `CajaActual` requiere endurecer la política DAL de transiciones; cierre Z sigue bloqueado por `recordDomain`.
- Informe: [cms-producer-and-bypass-audit](./2026-11-20-cms-producer-and-bypass-audit.md).

### Validación central de PaquetesGestoria — PR #455
- `assertPaquetesGestoriaRecord` centralizado en `validation.js`, invocado desde DAL y hook.
- CI PR #455: Layer 1 333/333, Layer 2 266/266, suite offline 688/688; SDK, npm audit, ESLint y secret scanning SUCCESS.

### Ledger contable — PR #452
- Añadido beforeInsert y validación central append-only.
- CI de PR verde; hook Wix Sandbox pendiente.
- Hash validado por formato, no recomputado por el hook.

### Retirada ONLYSTAFF — PR #444
- Página y archivo de interfaz retirados.
- No se borraron colecciones ni registros laborales.
- No equivale a retirar el dominio laboral completo.

### TPV QA — PR #439/#440
- QA migra a `CajaActual` y `MovimientosCaja`, sin colecciones `TPV_QA_*`.
- La ruta QA exige seed Sandbox explícito y metadatos de test-run; no inicializa la caja LIVE.
- E2E TPV Sandbox pendiente (#435).

## 4. Bloqueos y backlog abierto

La consulta actual identificó 19 issues abiertas. El estado resumido siguiente combina evidencia de código y runtime documentada; cada issue debe revalidarse antes de cerrarse.

| Issue | Prioridad | Estado / acción |
|---|---|---|
| #434 | P0 | Gate de predespliegue; mantener NO-GO hasta resolver todos los bloqueos. |
| #209 | P0 | SIF/VERI*FACTU incompleto; requiere definición legal/técnica, esquema, firma y remisión probada. |
| #415 | P0 | Completar maestro fiscal y esquema físico; no inventar CONFIG_SISTEMA. |
| #416 | P0 | Conciliar compensaciones fiscales pendientes y singleton CajaActual antes de writers. |
| #290 | P0 | Verificar claims atómicos y concurrencia en Wix Runtime. |
| #441 | P0 | Código POS corregido; actualizar issue y resolver compensaciones históricas. |
| #159 | P1 | Idempotencia implementada; falta QA Wix concurrente de consumo/removeById. |
| #162 | P1 | Recuperación dual implementada parcialmente; E2E y escenarios inciertos pendientes. |
| #164 | P1 | Validación MessageEvent integrada; navegador/Wix Preview pendiente. |
| #188 | P1 | Área privada cliente requiere E2E autenticado. |
| #210 | P1 | Activar branch protection/ruleset con permisos owner/admin. |
| #211 | P1 | E2E Bookings + Payments + eventos reales de Sandbox. |
| #223 | P1 | Persistir snapshot exacto/versionado antes de enviar paquete Gestoría. |
| #237 | P1 | Verificar que Wix Stores Catalog V3 sea autoridad única de inventario. |
| #261 | P1 | E2E con colaborador CMS_EDITOR; permisos privilegiados verificados, pero rol real no probado. |
| #291 | P1 | Validar conditional bulkRemove y carreras en runtime Wix. |
| #435 | P1 | Ejecutar TPV E2E Sandbox con testRunId. |
| #442 | P1 | Mantener gobierno de backlog; actualizar después de cada hito. |
| #173 | P2 | Verificar Power Automate/SharePoint end-to-end; no afirmar automatización no demostrada. |

## 5. Riesgos estructurales conocidos

1. **Conciliación:** existen tres compensaciones `FISCAL_LEDGER/PENDING_RECOVERY` históricas, incluidos pedidos POS; no reintentar automáticamente.
2. **Caja:** la lectura histórica encontró singleton `CajaActual` ABIERTA y fechas incoherentes; requiere investigación de solo lectura y plan de conciliación.
3. **Fiscalidad:** no existe configuración SIF completa; no habilitar remisión ni leyendas VERI*FACTU.
4. **Permisos:** las colecciones críticas se devolvieron como PRIVILEGED en auditoría posterior; falta demostrar el comportamiento con CMS_EDITOR.
5. **Cierres Z:** `recordDomain` y la identidad de cron no tienen contrato aprobado; ruta debe permanecer fail-closed.
6. **Gestoría:** no enviar hasta persistir el snapshot exacto que se entrega.
7. **Runtime:** CI offline no sustituye Preview, Sandbox, eventos nativos ni pruebas de identidad.
8. **Integración:** `main` sin protección permite integración sin checks obligatorios.
9. **Estado Wix:** existe discrepancia histórica entre Draft/published=false y un informe posterior que indica Published. Confirmar estado real y entorno antes de cualquier escritura.

## 6. Plan de acción mínimo y ordenado

### P0-A — Baseline y control de cambios
1. Mantener el trabajo en ramas y PR; no push directo a main.
2. Configurar branch protection/ruleset mediante owner/admin.
3. Revalidar estado Wix, publicación, entorno Sandbox, permisos y snapshot de esquemas.
4. Confirmar que no existen PR abiertas y reconciliar todas las issues.

### P0-B — Integridad y conciliación
1. Auditoría estática de productores y bypasses CMS completada (PR #454); falta E2E de hooks/permisos en Sandbox y endurecer `CajaActual`.
2. Reconciliar las tres compensaciones pendientes y CajaActual sin reintentos ciegos.
3. Completar prueba de atomicidad/idempotencia de webhooks.
4. Probar beforeInsert/update/remove y permisos en Sandbox con identidad adecuada.
5. Resolver contratos de cierre Z y cron sin introducir valores por defecto no aprobados.

### P0-C — Fiscalidad
1. Aprobar modelo de identidad y configuración SIF.
2. Acordar ampliación del esquema físico MapaStaff.
3. Verificar contrato normativo y técnico vigente con documentación oficial y asesoría competente.
4. Implementar firma/remisión solo con proveedor, certificado y representación válidos.
5. Mantener writers deshabilitados hasta completar pruebas y aprobación.

### P1 — E2E de operaciones
1. Reservas simples/duales, reprogramación y cancelación.
2. Cart V2, pagos Sandbox, refunds y webhooks.
3. TPV, caja, movimientos y cierre sintéticos.
4. Wix Stores e inventario nativo.
5. Área cliente y permisos colaborador.
6. Gestoría: snapshot inmutable, versionado y envío controlado.

### P2 — Capa documental
1. Verificar flujos Power Automate y bibliotecas SharePoint.
2. Probar exportación con documentos sintéticos y trazabilidad de entrega.
3. Confirmar que SharePoint no modifica Wix CMS.

### Release gate
No declarar GO hasta que:
- P0 cerrados con evidencia;
- CI verde y branch protection activa;
- E2E Wix Sandbox completados;
- permisos, secretos y writers auditados;
- conciliación histórica documentada;
- revisión legal/fiscal aplicable completada;
- rollback y reset preproducción ensayados;
- diff y documentación revisados;
- publicación autorizada expresamente.

## 7. Límites de esta consolidación

- Los estados de PR, merge SHA, workflow #44667244690 y branch protection se consultaron directamente en GitHub.
- Se repitieron consultas Wix read-only el 20/11/2026: SiteContext Draft, esquemas/revisiones, permisos, singleton CajaActual, compensaciones, pedidos eCommerce, transacciones y bookings nativos. El detalle está en [reconciliación live 20/11](./2026-11-20-live-caja-schema-and-reconciliation.md).
- No se ejecutó código local, Wix Preview ni pruebas en Wix Sandbox; no se realizaron escrituras CMS.
- No se habilitó ningún writer, no se enviaron pagos, no se remitieron datos AEAT y no se publicó el sitio.

## 8. Punto de continuación

Siguiente intervención recomendada: **cerrar H-01 de `CajaActual`** definiendo transiciones válidas y endureciendo la frontera DAL sin romper los productores de caja y TPV QA. En paralelo, priorizar la conciliación P0 de las tres compensaciones y CajaActual; después ejecutar pruebas de hooks/permisos en Sandbox. Mantener cierre Z y writers fiscales bloqueados.


## 9. Addendum live Wix — 2026-11-20

- SiteContext confirma estado Draft; no publicado.
- CajaActual cambió de esquema el 17/11: revisión 18, 81 campos. La auditoría del 14/11 queda histórica/supersedida como contrato físico vigente.
- PR #460 corrigió getCashierState para devolver openingCashAmount desde el campo físico; PR #462 eliminó la escritura de operationDate y deriva el daykey de openedAt en Europe/Madrid. El endurecimiento de transiciones CajaActual (H-01) sigue pendiente; operationDateHour conserva semántica no aprobada.
- Singleton CajaActual: ABIERTA, apertura/efectivo/esperado/contado 300 EUR; closedAt y lastMovementAt anteriores a openedAt; traceId vacío; sequenceCounters almacenado como texto pese a schema OBJECT. No cumple marcadores del sandbox TPV QA.
- ControlOperativo: 58 elementos, tres compensaciones FISCAL_LEDGER/PENDING_RECOVERY con attempts=0. MovimientosCaja, HistoricoCierresZ y LibroAsientosContablesDetalle permanecen en cero.
- Pedidos POS #10033 y #10032 continúan vinculados a las compensaciones. Los bookings nativos se leen CONFIRMED/PAID, mientras sus proyecciones CitasF2 siguen CONFIRMED/PENDING_LEDGER/totalAmount=0. #10033 además está FULLY_REFUNDED en eCommerce.
- Los dos pedidos POS contienen una línea Wix Bookings de 18,15 EUR brutos (15,00 + 3,15 IVA), correlacionada por appId y catalogItemId con cada booking. CitasF2 sigue en totalAmount=0 y amountReconciliationRequired=true; no se actualiza sin aprobar el contrato de precedencia y tratamiento fiscal.
- ControlOperativo devuelve 0 registros ALERT; el cron reconcileMissingConfirmedBookingProjections está declarado cada hora en los minutos 15 y 45 y debería generar revisión para bookings pagados, pero su ejecución runtime no está acreditada.
- Issue #441 actualizada: guard POS integrado en código, E2E Sandbox pendiente. Issue #416 actualizada con correlación nativa y decisión de no mutar datos.
- ADR-CASH-REGISTER-SESSION-CONTROL revalidada el 20/11: permanece PROPUESTA TÉCNICA sin aprobación de implementación. Wix no documenta context.original en UpdateHookContext; H-01 requiere recuperar el estado previo en backend/DAL y definir transiciones antes de modificar.
- No se realizaron escrituras Wix, reintentos, cierres, cambios de pagos ni publicación. Consulta GitHub 20/11: 0 PR abiertas.

**Prioridad inmediata:** conciliación manual de #10033 refund vs booking y #10032 POS Cash mixto; mantener CajaActual sin cierre/ajuste. Después cerrar H-01 de transiciones CajaActual, acreditar el runtime cron y preparar un singleton TPV QA aislado. Writers fiscales/contables siguen deshabilitados; NO-GO.


## 10. Addendum — CajaActual beforeUpdate contract correction (2026-11-20)

- PR #466 merged into `main`: `22a74ff4a594cf6f8d742c34c18527c6438a1719`.
- `CajaActual_beforeUpdate` no longer depends on `context.original`. It reads the persisted singleton through `getItem(CajaActual, _id, CONSISTENCY.STRONG)` and fails closed if the previous item cannot be retrieved.
- Offline hook tests now seed the persisted record, verify that an undocumented `context.original` is ignored, and assert failure when the persisted item is missing.
- PR CI passed: Layer 1, Layer 2, full offline regression suite, Wix SDK contracts, eCommerce/TPV SDK contracts, ESLint and secret scanning.
- This correction fixes previous-state retrieval only. It does **not** complete H-01 transition authorization, concurrent compare-and-swap for all CajaActual mutations, reconciliation of the current LIVE singleton, or Wix Preview/Sandbox E2E.
- No Wix CMS records, permissions, secrets, fiscal writers or publication state were changed. Production remains NO-GO.


## 11. Addendum de revalidación de H-01 y control de cambios — 2026-11-20

### Baseline Git verificado
- Rama base: `main`.
- HEAD verificado: `19079bd6b2cfde80b5758160b5ec060c0a49bd7b`.
- El commit padre es `22a74ff4a594cf6f8d742c34c18527c6438a1719`; el HEAD documenta la corrección acotada de `CajaActual_beforeUpdate`.
- La API de GitHub devuelve `protected=false`, `protection.enabled=false`, enforcement de checks `off` y lista de checks requeridos vacía.
- La consulta de status del HEAD no acredita un conjunto de checks CI ejecutados sobre ese commit. Los resultados de PR anteriores son evidencia de esas PR, no del HEAD actual.

### Evidencia de código revalidada en HEAD
Archivos inspeccionados:
- `src/backend/dataAccessPolicy.js`
- `src/backend/dataAccess.js`
- `src/backend/cajas.web.js`
- `src/backend/tests/data.hooks.test.mjs`

Hallazgos:
1. `assertUpdateAllowed(CAJA_ACTUAL, item)` exige `_id`, pero no compara el estado persistido, la versión esperada, el actor ni una transición permitida.
2. `assertSaveAllowed(CAJA_ACTUAL, item)` exige `_id`; no define por sí mismo una matriz de campos mutables.
3. `updateItem()` ejecuta `elevatedUpdate(collection, item)`; no pasa un predicado de versión/estado.
4. `_updateCajaActual()` lee el singleton, calcula una proyección sobre el snapshot leído y llama a `dalUpdate(CAJA_ACTUAL_COL, cashRegister)`. El bucle de reintentos ante error de escritura no demuestra CAS ni evita que dos escritores sobrescriban actualizaciones calculadas desde el mismo snapshot.
5. Los tests de hooks verifican recuperación del estado previo y fallo cerrado si falta, pero no prueban dos escritores concurrentes en Wix Runtime.

### Decisión de ingeniería
No introducir una guarda basada únicamente en lectura fuerte dentro de `beforeUpdate`: el hook se ejecuta antes de la actualización y la lectura previa no convierte el write posterior en una operación atómica. Tampoco añadir una whitelist genérica sin inventariar todos los productores y sus campos, porque puede bloquear productores legítimos o conservar la falsa impresión de control de concurrencia.

El cierre de H-01 requiere:
- Inventario completo de todos los productores y operaciones de CajaActual (update/save/bulk update y hooks).
- Contrato único de transición ABIERTA/CERRADA/SIMULACION, identidad/autorización backend y campos mutables por operación.
- Mecanismo de exclusión/CAS cuya atomicidad esté documentada por Wix para el endpoint/SDK realmente usado. No asumir que `consistentRead: true` es CAS.
- Prueba concurrente con dos movimientos diferentes y reentrega idempotente: ambos deben reflejarse exactamente una vez, sin pérdida ni doble aplicación.
- Pruebas de fallo intermedio y recuperación de compensación.
- Wix Sandbox/Preview para validar el contrato real antes de tocar datos operativos.

### Estado de seguridad y despliegue
- No se cambió código de runtime en esta intervención porque la evidencia disponible no demuestra un mecanismo CAS/lock atómico adecuado para reemplazar el writer actual. Un cambio especulativo en el hook o DAL aumentaría el riesgo.
- No se realizaron escrituras CMS, mutaciones de singleton, reintentos de compensaciones, cambios de permisos/secretos ni publicación.
- Producción: **NO-GO**. TPV Sandbox E2E, reconciliación de las tres compensaciones, modelo fiscal/SIF y control de rama siguen abiertos.
- Esta revalidación es estática y documental; no equivale a tests ejecutados ni a una validación de Wix Runtime.

### Referencias oficiales Wix
- [Wix Data beforeUpdate](https://dev.wix.com/docs/velo/apis/wix-data/hooks/before-update): el hook recibe el elemento y UpdateHookContext; la documentación consultada no define `context.original`.
- [Wix Data hooks](https://dev.wix.com/docs/develop-websites/articles/databases/wix-data/hooks/about-data-hooks): los hooks interceptan operaciones Data API/CMS, pero no describen por ello un mecanismo de compare-and-swap.
- [Update Data Item](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/update-data-item) y [Patch Data Item](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/patch-data-item): revisar el contrato del endpoint elegido antes de diseñar cualquier reemplazo de update.


## 12. Candidato SDK para resolver concurrencia de CajaActual — 2026-11-20

La revisión de documentación Wix SDK ha identificado `items.patch(...).run({ condition })` como candidato para una actualización condicional. La dependencia del proyecto es `@wix/data@1.0.527`. El SDK documenta filtros `items.filter().eq()`, `incrementField()`, `appendToArray()` y `setField()`; la documentación REST describe `condition` y modificaciones aritméticas atómicas.

Esto permite diseñar un control optimista condicionado por `sequenceCounters.seqGlobal`, con incrementos de saldo y append del ID de movimiento en la misma operación. No se ha implementado ni se declara CAS validado.

Bloqueos:
- Wix documenta que Patch no funciona en colecciones de aplicaciones Wix. Falta confirmar que la colección física `CajaActual` es elegible.
- Falta probar el filtro sobre el campo anidado `sequenceCounters.seqGlobal`, la respuesta de condición no coincidente y el hook `CajaActual_beforeUpdate` bajo Patch.
- Los productores actuales incluyen el writer normal de `cajas.web.js`, cierre Z mediante `saveItem`, y las proyecciones/sesiones QA de `tpvQaRepository.js`. Deben migrarse coordinadamente para evitar escritores no serializados.
- Requiere pruebas Wix Sandbox con writers concurrentes y reintentos idempotentes.

Referencias oficiales:
- [SDK items.patch](https://dev.wix.com/docs/sdk/data-items-sdk/data/items/patch)
- [SDK incrementField](https://dev.wix.com/docs/sdk/data-items-sdk/data/items/wix-data-patch/increment-field)
- [REST Patch Data Item](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/patch-data-item)

El sitio Marian Madrid sigue en estado Draft según el contexto Wix consultado. La PR #468 se fusionó en `main` mediante `6f97878d7e33082ce1f51fd84729df5533d762aa`; sus dos workflows finalizaron SUCCESS. Esta nota histórica queda supersedida por el addendum siguiente. No se han realizado cambios runtime ni escrituras CMS.


## 9. Addendum — verificación de CajaActual NATIVE y Bulk Patch — 2026-11-20

- Wix CMS read-only: `CajaActual` devuelve `collectionType=NATIVE`, revisión 18 y `sequenceCounters: OBJECT`. Según la enumeración oficial Wix, NATIVE significa colección creada por el usuario; ya no aplica el bloqueo de elegibilidad que impedía usar Patch sobre Wix App Collections.
- SDK oficial `@wix/data`: `items.bulkPatch()` admite `condition.filter` y modificaciones atómicas `INCREMENT_FIELD`, además de `SET_FIELD` y `APPEND_TO_ARRAY`. La documentación indica que se dispara el evento Data Item Updated.
- El repositorio ya contiene una abstracción DAL `bulkPatchItems()` con allowlist para determinados tipos de `ControlOperativo`; la política todavía no autoriza `CajaActual`.
- Inventario de writers CajaActual revalidado: `cajas.web.js` proyección por update y cierre Z por save; `fiscalLedgerLock.js` reserva/liberación de secuencia por update; `tpvQaRepository.js` proyección y sesión QA por update. Todos deben migrarse coordinadamente.
- La documentación consultada no acredita que `CajaActual_beforeUpdate` se ejecute con payload compatible durante Bulk Patch, ni resuelve la semántica de condición no coincidente. Requiere prueba aislada Wix Sandbox.
- No se realizaron escrituras CMS ni mutaciones del singleton. No se modificó código runtime ni se publicó el sitio. H-01 sigue abierto y producción permanece NO-GO.


## 10. Punto de continuación y traspaso — 2026-11-20

El estado consolidado para la próxima sesión está en [SESSION-HANDOFF-2026-11-20.md](./SESSION-HANDOFF-2026-11-20.md). Ese documento prevalece sobre notas históricas de este informe en lo relativo a HEAD, PRs, CI, estado de Wix y descubrimiento CMS NATIVE.
