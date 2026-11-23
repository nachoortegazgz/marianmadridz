# Marian Madrid — repositorio técnico

**Sitio:** https://www.marianmadrid.es/  
**Site ID:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Plataforma:** Wix Editor + Velo.

## Estado operativo

- **Release:** NO-GO. El sitio no está autorizado para publicación ni operación comercial.
- **Wix Site Context (read-back 2026-11-23):** Draft; Velo habilitado; plan Premium; dominio personalizado; EUR / Europe-Madrid.
- **Repositorio:** la estabilización documental se tramita en [PR #545](https://github.com/nachoortegazgz/marianmadridz/pull/545). Los resultados CI se consultan en la PR y corresponden siempre al SHA exacto; los resultados de un commit anterior no certifican automáticamente el último commit.
- **Límite:** CI offline no acredita sincronización Git-Wix, Preview/Runtime, integridad CMS live, aceptación fiscal ni pruebas E2E.

## Navegación canónica

1. [Estado operativo vigente](docs/PROJECT-STATUS.md) — único resumen de situación y gates actuales.
2. [Plan maestro](docs/MASTER-EXECUTION-PLAN.md) — prioridades, secuencia y condiciones de salida.
3. [Índice y gobierno documental](docs/README.md) — jerarquía, documentos de referencia e histórico.
4. [Dossier técnico consolidado](DOSSIER%20T%C3%89CNICO%20CONSOLIDADO.md) — arquitectura y decisiones de diseño por sus cortes documentados; no sustituye el estado operativo vigente.
5. [Registro de decisiones](docs/DECISION-LOG.md) y [estándares de desarrollo](docs/engineering/DEVELOPMENT-STANDARDS.md).
6. [Diccionario CMS](docs/reference/DICCIONARIO_DATOS_CMS.md) y [flujos Capa 1 → Capa 3](docs/reference/DOSSIER-FLUJOS-CAPA-1-A-CAPA-3.md) — referencias técnicas sujetas a read-back actual.
7. [Aceptación TPV](docs/qa/TPV-NATIVE-RECONCILIATION-ACCEPTANCE-2026-11-23.md) y [README backend TPV](src/backend/tpv/README.md).

## Invariantes

- Wix CMS es la fuente de verdad transaccional de los datos de dominio propios.
- SharePoint almacena evidencia documental; no gobierna Capa 1.
- Frontend sin lógica de negocio ni autoridad de permisos; validación y autorización en backend/WebMethods.
- Ledgers append-only: las correcciones se registran mediante eventos rectificativos trazables.
- No habilitar pagos reales, writers fiscales, emisión Veri*Factu, automatizaciones externas ni publicación durante QA sin sus gates y autorización.
- No borrar informes históricos por parecer antiguos: se conservan como evidencia fechada y se etiquetan como no vigentes cuando corresponda.

## Validación

El estado de cada control debe asociarse al SHA y al entorno exactos. No declarar Wix Runtime, Preview, E2E ni producción a partir de pruebas offline.