# Marian Madrid — repositorio técnico

**Sitio:** https://www.marianmadrid.es/  
**Site ID:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Plataforma:** Wix Editor clásico + Velo.

## Estado operativo

- **Release:** NO-GO. El sitio no está autorizado para operación comercial ni para activar pagos/writers fiscales.
- **Entorno:** QA/desarrollo único; el propietario declara que no ha tenido actividad real y que los datos de prueba son sintéticos.
- **Wix Site Context (read-back 2026-11-23):** Draft; Velo habilitado; plan Premium; dominio personalizado; EUR / Europe-Madrid.
- **Repositorio:** la estabilización documental quedó integrada en main mediante [PR #545](https://github.com/nachoortegazgz/marianmadridz/pull/545), merge commit `9dbeacfc505bdfb58e8e1cdf9d566c8662cda739`. CI pre-merge y post-merge finalizaron SUCCESS en sus respectivos SHA.
- **Límite:** CI offline no acredita sincronización Git-Wix, Preview/Runtime, integridad CMS live, aceptación fiscal ni pruebas E2E.

## Navegación canónica

1. [Estado operativo vigente](docs/PROJECT-STATUS.md) — único resumen de situación y gates actuales.
2. [Plan maestro](docs/MASTER-EXECUTION-PLAN.md) — prioridades, secuencia y condiciones de salida.
3. [Base de conocimiento consolidada](docs/PROJECT-KNOWLEDGE-BASE.md) — contexto, arquitectura, invariantes, discrepancias y plan de referencia; no sustituye el estado live ni los documentos SSOT especializados.
4. [Directriz del propietario](docs/PROJECT-OWNER-DIRECTIVE-2026-11-20.md) — requisitos, objetivos y precedencia.
5. [Índice y gobierno documental](docs/README.md) — jerarquía, documentos de referencia e histórico.
6. [Dossier técnico consolidado](DOSSIER%20T%C3%89CNICO%20CONSOLIDADO.md) — arquitectura y decisiones de diseño por sus cortes; no sustituye el estado operativo vigente.
7. [Registro de decisiones](docs/DECISION-LOG.md) y [estándares de desarrollo](docs/engineering/DEVELOPMENT-STANDARDS.md).
8. [Diccionario CMS](docs/reference/DICCIONARIO_DATOS_CMS.md) y [flujos Capa 1 → Capa 3](docs/reference/DOSSIER-FLUJOS-CAPA-1-A-CAPA-3.md) — referencias técnicas sujetas a read-back actual.
9. [Verificación de esquema CMS en Wix (2026-11-23)](docs/reference/WIX-CMS-SCHEMA-VERIFICATION-2026-11-23.md) — lectura directa del esquema físico de 11 colecciones.
9. [Aceptación TPV](docs/qa/TPV-NATIVE-RECONCILIATION-ACCEPTANCE-2026-11-23.md) y [README backend TPV](src/backend/tpv/README.md).

## Invariantes

- Wix CMS es la fuente de verdad transaccional de los datos de dominio propios; las apps Wix gobiernan sus dominios nativos.
- SharePoint almacena evidencia documental; no gobierna Capa 1.
- Frontend sin lógica de negocio ni autoridad de permisos; validación y autorización en backend/WebMethods.
- Los ledgers declarados append-only permanecen inmutables; las correcciones se registran mediante eventos rectificativos trazables.
- Los datos sintéticos QA no se deben confundir con hechos económicos, laborales o fiscales reales. Cualquier limpieza preproducción debe ser selectiva, autorizada, respaldada y auditada; no habilita mutaciones indiscriminadas de ledgers.
- No habilitar pagos reales, writers fiscales, emisión Veri*Factu, automatizaciones externas ni publicación durante QA sin sus gates y autorización.
- No borrar informes históricos por parecer antiguos: se conservan como evidencia fechada y se etiquetan como no vigentes cuando corresponda.

## Validación

El estado de cada control debe asociarse al SHA y al entorno exactos. No declarar Wix Runtime, Preview, E2E ni producción a partir de pruebas offline.
