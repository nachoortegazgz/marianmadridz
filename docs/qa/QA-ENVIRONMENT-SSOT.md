# SSOT — entorno QA único de Marian Madrid

**Vigente desde:** 2026-11-14 · **Autoridad:** decisión expresa del propietario.

- **Sitio QA único y oficial:** `188bed94-177c-4bc9-a9f0-35080d874f3e` — `https://www.marianmadrid.es/`.
- **Finalidad:** entorno QA del ecosistema Marian Madrid para pruebas previas al despliegue real. No existe un segundo sitio QA ni un QA externo designado.
- **Actividad:** el propietario confirma que nunca ha existido actividad real y que actualmente no existe.
- **Datos:** todos los registros existentes y nuevos utilizados en QA son sintéticos.
- **Cliente sintético canónico:** Nacho Pitt — `nachoortegazgz@gmail.com`.
- **Pagos:** pasarela desconectada. No se realizan cobros, capturas, reembolsos ni operaciones bancarias reales.
- **Fiscalidad y comunicaciones:** el propietario declara desactivados Veri*Factu, AEAT, emisión/transmisión fiscal, email, SMS, WhatsApp, campañas y comunicaciones a clientes. No obstante, la auditoría read-only Wix del 2026-11-14 detecta 10 automatizaciones preinstaladas ACTIVE con acciones de email/notificación y bloqueos de modificación. Por tanto, el estado efectivo de aislamiento de comunicaciones NO está acreditado; mantener Runtime/E2E que pueda dispararlas bloqueado hasta resolverlo.
- **Ledgers:** se aplica la política SSOT vigente de QA; si sus writers están pausados, no se insertan nuevos registros. Nunca se habilita update/remove ni sobrescritura de registros append-only.
- **Seguridad:** el estado Wix `Published` y el dominio personalizado son metadatos de publicación; no cambian la clasificación funcional del sitio como QA ni acreditan actividad real. Toda operación de prueba debe seguir siendo sintética y no producir efectos externos.
- **No usar:** identificadores de sitios anteriores, sitios auxiliares o entornos de terceros como destino alternativo de QA. Las designaciones anteriores quedan supersedidas y no son operativas.

**Estado de evidencia:** la finalidad QA, ausencia de actividad real, datos sintéticos, identidad del cliente de prueba y pasarela desconectada son declaraciones expresas del propietario. El contexto Wix confirma el Site ID, URL, estado Published y aplicaciones instaladas. La consulta oficial Wix Automations V2 confirma 150 automatizaciones: 10 ACTIVE y 140 INACTIVE; las 10 activas son preinstaladas y están bloqueadas por settings.readonly o settings.disableStatusChange, varias con acciones de email/notificación. No se ha demostrado neutralización runtime de esos efectos. Por ello, la declaración de comunicaciones desactivadas no se considera técnicamente verificada y Runtime/E2E permanece bloqueado.

**Regla de precedencia:** este documento es la referencia única de identidad y clasificación del entorno. Si otra documentación identifica un QA distinto, denomina este sitio producción o propone un QA externo, esa referencia queda supersedida por esta SSOT. Los informes históricos conservan su valor como evidencia de lo que se observó en su fecha, pero no definen el entorno vigente.

---


## Alineación técnica de fixtures offline — CERRADA

PR #379 integrada en main mediante squash commit 27348a20bfb913fde43761d4c92dd46526a5e470.

- QA_TEST_SITE_ID apunta al Site ID QA único.
- El primer cliente fixture es Nacho Pitt; el correo de la fixture es nacho.pitt@example.test, dominio reservado de pruebas. La dirección real designada por el propietario no se utiliza en fixtures ejecutables.
- TPV, PSP y manager-email-sink validan el Site ID canónico exacto y fallan cerrados ante el identificador supersedido.
- CI sobre el HEAD de PR: Layer 1 24/307 PASS; Layer 2 19/252 PASS; regresión 70/644 PASS; contratos SDK, ESLint y Secret scanning PASS.
- Alcance: mocks in-memory/offline. No valida Wix Runtime/E2E ni modifica el sitio Wix.

## Bloqueo vigente — automatizaciones Wix activas

La consulta read-only de Wix Automations V2 devolvió 150 automatizaciones: 10 ACTIVE, 140 INACTIVE, 0 archivadas. Las diez activas son preinstaladas y todas están bloqueadas por settings.readonly o settings.disableStatusChange. Varias ejecutan acciones de email/notificación. No se modificó ninguna.

Ver auditoría read-only de automatizaciones en docs/audits/2026-11-14-qa-automations-isolation.md. Los flujos que puedan disparar esos triggers quedan bloqueados para Runtime/E2E hasta neutralización soportada por Wix/proveedor y nueva lectura de verificación. No sortear locks ni desinstalar apps a ciegas.
