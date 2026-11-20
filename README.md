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
