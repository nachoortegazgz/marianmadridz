# SSOT — entorno QA único de Marian Madrid

**Vigente desde:** 2026-11-14 · **Autoridad:** decisión expresa del propietario.

- **Sitio QA único y oficial:** `188bed94-177c-4bc9-a9f0-35080d874f3e` — `https://www.marianmadrid.es/`.
- **Finalidad:** entorno QA del ecosistema Marian Madrid para pruebas previas al despliegue real. No existe un segundo sitio QA ni un QA externo designado.
- **Actividad:** el propietario confirma que nunca ha existido actividad real y que actualmente no existe.
- **Datos:** todos los registros existentes y nuevos utilizados en QA son sintéticos.
- **Cliente sintético canónico:** Nacho Pitt — `nachoortegazgz@gmail.com`.
- **Pagos:** pasarela desconectada. No se realizan cobros, capturas, reembolsos ni operaciones bancarias reales.
- **Fiscalidad y comunicaciones:** Veri*Factu, AEAT, emisión/transmisión fiscal, email, SMS, WhatsApp, campañas y comunicaciones a clientes permanecen desactivados; las pruebas correspondientes usan mocks/sinks offline sin I/O.
- **Ledgers:** se aplica la política SSOT vigente de QA; si sus writers están pausados, no se insertan nuevos registros. Nunca se habilita update/remove ni sobrescritura de registros append-only.
- **Seguridad:** el estado Wix `Published` y el dominio personalizado son metadatos de publicación; no cambian la clasificación funcional del sitio como QA ni acreditan actividad real. Toda operación de prueba debe seguir siendo sintética y no producir efectos externos.
- **No usar:** identificadores de sitios anteriores, sitios auxiliares o entornos de terceros como destino alternativo de QA. Las designaciones anteriores quedan supersedidas y no son operativas.

**Estado de evidencia:** la finalidad QA, ausencia de actividad real, datos sintéticos, identidad del cliente de prueba y pasarela desconectada son declaraciones expresas del propietario. El contexto Wix consultado confirma el Site ID, URL, estado Published y aplicaciones instaladas. No se afirma que se hayan probado en runtime todos los bloqueos de integraciones; las pruebas con posible efecto externo continúan sujetas a mocks/offline y a comprobaciones específicas.

**Regla de precedencia:** este documento es la referencia única de identidad y clasificación del entorno. Si otra documentación identifica un QA distinto, denomina este sitio producción o propone un QA externo, esa referencia queda supersedida por esta SSOT. Los informes históricos conservan su valor como evidencia de lo que se observó en su fecha, pero no definen el entorno vigente.

---


## Desalineación técnica pendiente — fixtures offline

La inspección estática de la rama detecta que los fixtures de código todavía conservan el identificador anterior en:

- `src/backend/tests/fixtures/qaSyntheticParties.mjs` — `QA_TEST_SITE_ID`.
- `src/backend/tests/qa.simulation-manifest.test.mjs` — aserción de `QA_TEST_SITE_ID`.
- `src/backend/tests/fixtures/qaTpvSimulation.mock.mjs` — validación del `testSiteId`.

Estos puntos siguen usando una identidad anterior y no están alineados con el sitio QA único `188bed94-177c-4bc9-a9f0-35080d874f3e`. **No se deben ejecutar ni considerar alineados con el sitio actual los escenarios que dependan de esa identidad hasta corregir el contrato y sus pruebas en una intervención de código independiente.** Esta PR es documental y no modifica runtime ni fixtures.
