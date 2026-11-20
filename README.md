# Marian Madrid — repositorio técnico

**Plataforma:** Wix Editor Classic + Velo  
**Sitio:** https://www.marianmadrid.es/  
**Site ID:** `188bed94-177c-4bc9-a9f0-35080d874f3e`

## Documento rector

Toda la arquitectura, estado, decisiones, TPV física, QA, directrices de desarrollo, plan de acción y condiciones de despliegue se consolidan en:

**[DOSSIER TÉCNICO CONSOLIDADO.md](DOSSIER%20T%C3%89CNICO%20CONSOLIDADO.md)**

Es la única guía operativa en la raíz. En caso de discrepancia, prevalecen sus adendas vigentes, las decisiones posteriores aprobadas y los contratos oficiales de Wix/proveedores.

## Referencias especializadas

- [Diccionario de datos CMS](docs/reference/DICCIONARIO_DATOS_CMS.md): catálogo detallado y snapshots históricos. No sustituye una lectura live de Wix.
- [Flujos Capa 1 → Capa 3](docs/reference/DOSSIER-FLUJOS-CAPA-1-A-CAPA-3.md): diseño y evidencia histórica; no acredita implantación E2E.
- [Registro de decisiones](docs/DECISION-LOG.md).
- [Auditorías](docs/audits/), [estándares de ingeniería](docs/engineering/) y [QA](docs/qa/).

## Reglas de operación

- El dossier maestro es la referencia del estado; los documentos de `docs/reference/` aportan detalle, no autoridad operativa independiente.
- Los snapshots CMS requieren revalidación live antes de cualquier operación.
- CI offline no equivale a Wix Runtime, E2E, validación fiscal ni pruebas de hardware.
- No publicar ni ejecutar operaciones económicas sin autorización y gates aprobados.
- El código funcional, pruebas y workflows permanecen en sus directorios técnicos.


## Estado de release vigente — 2026-11-20

El estado operativo más reciente está en [docs/PROJECT-STATUS.md](docs/PROJECT-STATUS.md) y el handoff TPV en [docs/qa/2026-11-20-tpv-sandbox-session-handoff.md](docs/qa/2026-11-20-tpv-sandbox-session-handoff.md). HEAD de referencia tras PR #499: `cfe1d0c37a9464cb63aea9d31873071eecb10d9f`; CI offline post-merge: 75 suites/705 tests, 0 fallos; Gitleaks PASS. Wix Site Context observado como Draft. Preview E2E, aislamiento por invocación, concurrencia runtime y aceptación global pendientes. Publicación: **NO-GO**.


## Addendum posterior a PR #500 — 2026-11-20

PR #500 está fusionada en `main`: commit `6da7cdf0d815ad2e1833f5bd56b5950aff2afb3e`. La corrección consolida el helper `_ensureCajaActualForSandbox()` para validar existencia y marcador/run ID de `CajaActual` y ejecuta ese preflight antes de cualquier lectura/escritura de locks en `ControlOperativo`. Se añade una prueba contractual específica.

Validación pre-merge del HEAD `306816dff20d62e4ec3fda87e25fb050c155bb96`: Layer 1 28 suites/339 tests PASS; Layer 2 19 suites/268 tests PASS; suite completa 75 suites/706 tests PASS; contratos Wix SDK, eCommerce Order Transactions, TPV Catalog y ESLint PASS; Gitleaks PASS (runs `44781808680` y `44781808524`). CI post-merge para `6da7cdf0...` está en curso en los runs `44781982497` y `44781982392`; no declararlo aprobado hasta que ambos finalicen SUCCESS.

La corrección es una barrera de código por estado de datos; no identifica de forma contractual Preview frente a Published. No equivale a prueba de aislamiento runtime ni a aceptación E2E. Wix Preview, prueba negativa Published, concurrencia H-01, permisos efectivos, efectos externos, comparación LIVE antes/después y reset preproducción siguen pendientes. Sitio Wix observado en Draft. **NO-GO de publicación.**
