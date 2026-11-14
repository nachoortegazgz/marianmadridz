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
- **Wix Runtime/E2E:** BLOCKED_ENVIRONMENT; el Site ID QA no fue resuelto por la conexión Wix de esta sesión.
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
- **Corrección en curso:** rama `fix/ci-regression-and-milestone-2026-11-14`; restaura el validador nativo MapaStaff y añade pruebas; alinea la prueba de enum con el sentinel QA. CI completo pendiente.
- **Cambios Wix/CMS:** ninguno. No se desplegó ni se usó producción.
- **Wix Runtime/E2E:** BLOCKED_ENVIRONMENT por resolución técnica del contexto QA.
- **Resultado provisional:** código de corrección preparado; hito no cerrado hasta CI PASS y comprobación posterior en el deployment QA.
