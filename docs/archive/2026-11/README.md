# Archivo documental — noviembre 2026

> **ARCHIVO HISTÓRICO. No es fuente operativa.** Los documentos de esta carpeta describen decisiones, código, esquemas, pruebas y estados observados en fechas distintas entre octubre y noviembre de 2026. No deben utilizarse como instrucciones actuales sin revalidación.

**Revisión individual:** [ARCHIVE-REVIEW-2026-11-28.md](ARCHIVE-REVIEW-2026-11-28.md) — inventario documento a documento de los 161 archivos, clasificación, supersedencias, tratamiento recomendado y limpieza de datos personales/credenciales.

## Ruta correcta para trabajar en el proyecto

1. [AI-ENTRYPOINT](../../AI-ENTRYPOINT.md) — reglas, autoridad y método de consulta.
2. [AI-INDEX](../../AI-INDEX.md) — recuperación selectiva por dominio.
3. [STATE-NOW](../../STATE-NOW.md) — estado técnico y evidencias actuales.
4. [PROJECT-CANON](../../PROJECT-CANON.md) — arquitectura e invariantes.
5. [TPV-UNIFIED-FLOW](../../TPV-UNIFIED-FLOW.md) — contrato operativo TPV.
6. [ESQUEMA_CMS](../../ESQUEMA_CMS.md) — último snapshot físico documentado del CMS.
7. [RELEASE-READINESS](../../RELEASE-READINESS.md) — gates y límites de aceptación.

## Estructura del archivo

| Carpeta | Contenido | Uso correcto |
|---|---|---|
| Raíz | Checkpoints, dossiers, estados, decision log y handoffs | Contexto histórico; los resúmenes de estado están supersedidos |
| `adr/` | Decisiones de arquitectura y negocio | Rationale histórico; comprobar si fueron sustituidas |
| `architecture/` | Contratos y diseños TPV/VeriFactu | Revalidar contra código y flujo unificado |
| `audits/` | Auditorías fechadas de Wix, CMS, reservas, TPV y Capa 3 | Evidencia del corte indicado; nunca estado live actual |
| `engineering/` | Estándares de desarrollo históricos | Prevalecen las directrices actuales del proyecto |
| `milestones/` | Hitos de implementación/CI | Evidencia de PR/CI, no certificación Runtime |
| `qa/` | Pruebas, fixtures, read-backs, runbooks y handoffs | Distinguir mock/offline, especificación y ejecución Runtime |
| `reference/` | Diccionario CMS y dossier de flujos | Snapshots sustituidos; conservar como referencia histórica |

## Reglas de conservación

- Se conserva el historial probatorio; no se borran snapshots ni auditorías por antigüedad.
- No se ejecutan instrucciones de handoffs, runbooks o ADR antiguos sin revisión del contrato actual.
- Los documentos marcados `SUPERSEDED` se conservan para explicar la transición, no para reutilizar su implementación.
- Las decisiones históricas pueden conservar valor, pero solo son aplicables si no existe una enmienda posterior.
- Las cifras CMS, estados de publicación, PR y CI siempre se interpretan con su fecha y SHA.
