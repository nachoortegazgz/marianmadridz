> **SSOT de entorno vigente (2026-11-14):** el único sitio del proyecto es QA: `188bed94-177c-4bc9-a9f0-35080d874f3e` (`https://www.marianmadrid.es/`). El propietario confirma que nunca ha tenido actividad real, que todos los datos son sintéticos, que el cliente de pruebas es Nacho Pitt (`nachoortegazgz@gmail.com`) y que la pasarela está desconectada. No existe otro sitio QA ni un QA externo designado. Las referencias anteriores a otros Site ID o a este sitio como producción quedan supersedidas. El estado Wix Published no altera su clasificación funcional como QA. Véase [SSOT del entorno QA](./QA-ENVIRONMENT-SSOT.md).

---

# Registro de ejecución QA — 2026-11-14

## QA-DOCS-20261114-001

- **Tipo:** revisión documental / consistencia de repositorio.
- **Rama:** `docs/qa-operating-model-2026-11-14`.
- **Baseline:** `1a721aeca86e61b02d184ac8ec94f20871073272`.
- **Resultado documental:** PASS.
- **Evidencia:** 7 archivos raíz/decisión actualizados o creados y verificados mediante lectura posterior; rama 7 commits ahead / 0 behind de `main` antes de abrir PR #372.
- **Cambios ejecutados:** plan QA, directrices raíz, README, baseline, estado actual, nota de alcance del diccionario CMS y decisión del propietario.
- **Cambios de código:** ninguno.
- **Cambios Wix/CMS:** ninguno.
- **Pagos/comunicaciones:** ninguna llamada ni envío.
- **Pruebas CI:** PASS en GitHub Actions sobre HEAD previo `4e258a5617f4a64e5ce3604826b4ce2b29f9389e`: Layer 1 = 23 suites / 296 tests; Layer 2 = 19 suites / 252 tests; regresión completa = 69 suites / 631 tests; 0 fallos. SDK contracts (Cart V2, Order Transactions, Bookings Reader V2) PASS; ESLint PASS; Gitleaks full-history PASS (run #579). Workflow offline quality run #1155 (`43604832916`).
- **Wix Runtime/E2E en aquel corte:** BLOCKED_ENVIRONMENT por una designación anterior; estado histórico supersedido tras confirmar el Site ID QA único `188bed94-177c-4bc9-a9f0-35080d874f3e`.
- **Riesgos abiertos:** discrepancia de acceso al sitio QA; aislamiento efectivo de apps/automatizaciones/proveedores pendiente; contrato de pago mixto pendiente.
- **Alcance del PASS:** acredita solo pruebas offline/mock y contratos/lint ejecutados por el workflow. No acredita Wix Runtime, sandbox PSP, aislamiento de automatizaciones ni E2E externo.
- **Siguiente paso:** continuar auditoría de código y ampliar escenarios sintéticos; desbloquear Wix Runtime solo cuando se resuelva el acceso QA. No usar producción como fallback.

## Convención de registros

Cada nueva ejecución añadirá un identificador único y conservará SHA, tipo de prueba, escenario, resultado, artefactos y defectos. No registrar PII, credenciales, tokens ni payloads personales. Un resultado MOCK no se elevará a SANDBOX ni a WIX_RUNTIME.


## QA-SEC-20261114-001

- Tipo: corrección de seguridad de código + pruebas de política.
- Rama: docs/qa-operating-model-2026-11-14.
- Hallazgo P0: ISOLATED_SITE_RECORD_MUTATIONS_ENABLED=true permitía update/remove global de colecciones propias y desactivaba guards de CajaActual/CitasF2 sin una comprobación server-side del Site ID en esa ruta.
- Corrección aplicada en rama: se retiran los bypasses globales de mutabilidad y la ventana temporal; hooks append-only son incondicionales. Bulk update deshabilitado; bulk remove restringido a purgas condicionadas de tipos efímeros/terminales, excluyendo WEBHOOK_EVENT y claims durables.
- Pruebas modificadas: política de escritura exige ledgers inmutables y purga bulk allowlisted; simulador PSP añade concurrencia/idempotencia dentro de un único proceso mock y metadata sintética TEST.
- Validación: pendiente de CI sobre el SHA resultante. No declarar PASS antes de resultados.
- Wix: GetSiteContext sigue devolviendo producción como Published; Site ID QA no resoluble. Sin escrituras Wix/CMS, pagos, comunicaciones ni publicación.
- Limitación: la prueba de concurrencia del mock es in-process y no acredita concurrencia distribuida ni idempotencia persistente.


## QA-TEST-DATA-20261114-001

- Fixture sintético: tres clientes ficticios en example.test y una Gestoría de Pruebas con TEST-NIF-NO-VALIDO, sin teléfono operativo y destino real desactivado.
- PSP mock: requiere environment TEST, testSiteId y testRunId; todas las respuestas de autorización/captura/reembolso llevan isSynthetic=true, sourceEnvironment=TEST y realPayment=false.
- Email sink: solo acepta destinatario gestoria.pruebas@example.test y clientes sintéticos con testRunId coincidente; no realiza I/O.
- Limitación: fixture y sink son offline/in-memory. No acreditan desconexión de proveedores Wix en runtime ni habilitan escritura CMS.


## CI-20261114-43606822535 — regresión offline tras TEC-038

- SHA validado: f4c85855cfd8480e529ff4bc46be6a5193ed019e.
- Layer 1: 23 suites, 299 tests, 0 fallos.
- Layer 2: 19 suites, 252 tests, 0 fallos.
- Regresión completa: 69 suites, 633 tests, 0 fallos.
- Contratos Wix SDK: PASS (@wix/ecom cartV2, @wix/data items.patch/bulkPatch, eCommerce order transactions, Bookings Reader V2).
- ESLint: PASS.
- Secret scanning: run 43606822521 PASS.
- Suites relevantes: data.hooks 29/29; dataAccess.writePolicy 9/9; crons.jobsConfigParity 29/29; site.flows.offline 31/31; qa.payment-gateway.mock 7/7; qa.manager-email-sink.mock 4/4; qa.simulation-manifest 7/7.
- Limitación: todas las pruebas son offline/mock; no demuestran aislamiento de Wix Runtime, permisos CMS efectivos, desconexión de PSP ni ausencia de automatizaciones externas en el sitio.


## QA-TPV-20261114 — motor sintético aislado

- Añadido `src/backend/tests/fixtures/qaTpvSimulation.mock.mjs`: simulador puro/in-memory sin I/O.
- Añadida suite `src/backend/tests/qa.tpv-simulation.mock.test.mjs`: 8 escenarios previstos (fail-closed, efectivo, mixto, OTROS/OTROS_PENDIENTE, validaciones, idempotencia, cantidades fraccionarias y fracciones de céntimo).
- Incluido en `run-layer1.mjs` para que el gate enfocado lo ejecute.
- Añadida auditoría `docs/audits/2026-11-14-tpv-contract-gap-audit.md` con siete gaps verificados y límites.
- No se modifica writer fiscal, enum de producción, CMS, proyección CajaActual, cierre Z ni pagos reales.
- Estado de ejecución: **pendiente CI** en el corte de este registro. No declarar la suite PASS hasta ver el run.

## QA-CODE-20261114-002

- **Tipo:** corrección de regresión backend y cierre de errores de deployment.
- **Origen:** deployment Wix `686cb2af-c530-4f89-a9d7-18baa3f9eb0a`, 2026-11-14 16:07.
- **PR #373:** integrada en `main` con merge `1b39ebb22c885f50320b7d52f5bc336cc0570ee5`; su CI posterior terminó FAIL, por lo que no se considera validada.
- **Evidencia CI PR #373:** Gitleaks PASS. Layer 1 FAIL por export ausente `assertMapaStaffRecord` (consumido por `data.js`) y expectativa obsoleta de `CASH_REGISTER_STATUS` que omitía `SIMULACION`. La mayoría de las suites bloqueadas por el import no pudieron inicializarse.
- **Corrección:** rama `fix/ci-regression-and-milestone-2026-11-14`, HEAD validado `da96c1b50f1910a287aea718bc6025d295e30e2b`; PR #374 integrada en `main` mediante merge `1de381ecb6495e17a3eae5b75b43e8493166988a`.
- **CI final:** Layer 1 24/307 PASS; Layer 2 19/252 PASS; regresión completa 70/644 PASS; Cart V2, Order Transactions y Bookings Reader V2 PASS; ESLint PASS; Gitleaks full-history PASS.
- **Cambios Wix/CMS:** ninguno. No se desplegó ni se usó producción.
- **Wix Runtime/E2E en el corte histórico:** BLOCKED_ENVIRONMENT por resolución de una designación anterior; no es el estado vigente de identidad del sitio.
- **Resultado:** hito de código CERRADO — CI PASS (offline) en HEAD de PR. CI del merge commit `1de381ecb6495e17a3eae5b75b43e8493166988a` también PASS: Layer 1 24/307; Layer 2 19/252; regresión 70/644; SDK, ESLint y Gitleaks PASS. Runtime Wix y discrepancia documental MapaStaff/DatosFiscales siguen pendientes.


## QA-ENV-20261114-002 — comprobación histórica de una designación anterior (supersedida)

- **Objetivo:** comprobar si la conexión Wix actual permite continuar con validación runtime/E2E sin generar efectos externos.
- **GetSiteContext:** consulta de una designación anterior de entorno; respuesta histórica `No site context found`. Esta referencia no identifica el sitio QA vigente.
- **ListWixSites(limit=50):** devolvió el sitio Marian Madrid y otro sitio personal. La clasificación de Marian Madrid como producción que se anotó entonces queda supersedida por la declaración expresa posterior del propietario: es el único sitio QA.
- **Decisión fail-closed:** no intentar APIs de CMS/runtime sobre producción ni sobre el sitio CV; no crear, duplicar, publicar, instalar apps ni cambiar configuración como sustituto implícito del QA designado.
- **Resultado histórico:** `BLOCKED_ENVIRONMENT` por la designación anterior. Queda supersedido; la identidad QA vigente es `188bed94-177c-4bc9-a9f0-35080d874f3e`. No se declara validación runtime/E2E.
- **Acción histórica supersedida:** ya no es necesario compartir ni designar otro sitio QA. La identidad vigente es `188bed94-177c-4bc9-a9f0-35080d874f3e`; la validación de efectos externos se limita a mocks/offline y a los gates específicos.


## QA-FIXTURES-20261114-379 — alineación del entorno sintético

- PR #379 integrada en main mediante squash: 27348a20bfb913fde43761d4c92dd46526a5e470.
- HEAD CI: ecdf16444057d8100d89991b68b1711022bfb71a.
- Layer 1: 24 suites / 307 tests PASS.
- Layer 2: 19 suites / 252 tests PASS.
- Regresión completa: 70 suites / 644 tests PASS.
- Wix SDK Cart V2, Order Transactions, Bookings Reader V2: PASS.
- ESLint: PASS. Secret scanning: PASS.
- Fixtures: Site ID canónico y cliente sintético Nacho Pitt; email de fixture nacho.pitt@example.test.
- Simuladores TPV, PSP y manager-email-sink: validación exacta del Site ID canónico, TEST, enabled y testRunId; permanecen in-memory/offline.
- Sin cambios runtime, CMS, ledgers, configuración Wix, pagos ni comunicaciones.

## QA-AUTOMATIONS-20261114-001 — auditoría read-only de automatizaciones Wix

- Sitio consultado: 188bed94-177c-4bc9-a9f0-35080d874f3e.
- Método: Wix Automations V2 Query Automations, paginación cursor, lectura únicamente.
- Resultado: 150 automatizaciones; 10 ACTIVE, 140 INACTIVE, 0 archivadas.
- Las diez activas son PREINSTALLED; todas tienen al menos una restricción settings.readonly o settings.disableStatusChange. Siete tienen disableStatusChange=true, cinco readonly=true, dos ambas.
- Se identificaron acciones activas de email y notificación. No se modificó ninguna automatización ni se intentó sortear locks.
- Resultado de aislamiento: BLOCKED_EXTERNAL_SIDE_EFFECTS. No ejecutar Runtime/E2E que dispare estos triggers hasta neutralización soportada y relectura de verificación.
- Evidencia detallada: docs/audits/2026-11-14-qa-automations-isolation.md.


## QA-CI-20261114-381 — diagnóstico de regresión integrado

- PR #381 integrada en main mediante merge commit 1c4f9c3322f323bc32012c8c042eb2c47aaaed44.
- Workflow run 43627893841: completed / success.
- Job Layer 1 and 2 QA, offline regression, SDK contract and lint: success.
- Layer 1 focused gate: PASS; Layer 2 focused gate: PASS; complete offline regression: PASS; Wix SDK contracts (Cart V2, Order Transactions, Bookings Reader V2): PASS; ESLint: PASS.
- El paso de diagnóstico individual quedó preparado para ejecutar también qa.manager-email-sink.mock.test.mjs cuando falle una suite.
- PR #380 (auditoría documental de aislamiento) también quedó integrada; sus workflows Secret scanning y Backend offline quality gates finalizaron success.
- No hubo cambios ni despliegue en Wix Runtime, CMS, automatizaciones o datos del sitio.

## QA-AUTOMATIONS-20261114-002 — revalidación read-only y regla oficial de bloqueo

- Repetida Query Automations V2 en el Site ID QA, con paginación completa: 150 automatizaciones, 10 ACTIVE y 140 INACTIVE; sin páginas pendientes.
- Se confirmó que el estado está en configuration.status (no en status de primer nivel).
- Las mismas 10 automatizaciones activas son PREINSTALLED y todas conservan readonly=true o disableStatusChange=true.
- La documentación oficial Wix Automations Activation Status indica expresamente detenerse ante cualquiera de esos locks y no ejecutar PATCH de desactivación.
- No se intentó ninguna mutación ni se modificó ninguna automatización.
- Estado: BLOCKED_EXTERNAL_SIDE_EFFECTS; únicamente offline/mock y read-only.
