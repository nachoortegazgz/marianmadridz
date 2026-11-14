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


## Alineación técnica de fixtures offline — intervención en curso

La identidad del sitio y el cliente canónico ya están reflejados en la rama `fix/qa-site-fixtures-188bed94-2026-11-14` en:

- `src/backend/tests/fixtures/qaSyntheticParties.mjs`: Site ID QA único y cliente sintético Nacho Pitt.
- `src/backend/tests/qa.simulation-manifest.test.mjs`: aserciones del Site ID y la identidad sintética.
- `src/backend/tests/fixtures/qaTpvSimulation.mock.mjs`, `qaPaymentGateway.mock.mjs` y `qaManagerEmailSink.mock.mjs`: validación fail-closed contra el Site ID canónico.
- Pruebas de los tres simuladores y manifiesto: el identificador anterior queda rechazado; el email operativo de la fixture usa un dominio reservado `.example.test`, nunca la dirección real designada por el propietario.

**Estado:** cambios propuestos en rama, pendientes de CI, revisión de diff y merge. No se afirma que estén validados hasta completar esas comprobaciones. Los simuladores permanecen in-memory/offline y no realizan llamadas a proveedores, CMS, red ni comunicaciones.
