# Marian Madrid — Wix Editor Classic + Velo

Repositorio canónico del sitio https://www.marianmadrid.es/.

**Referencia única de contexto y directrices:** [PROJECT_BASELINE.md](PROJECT_BASELINE.md). Consultar ese documento antes de cualquier intervención técnica.

## Referencias técnicas
- [Estado actual](ESTADO_ACTUAL_PROYECTO.md) — snapshot operativo conciso.
- [Diccionario CMS](DICCIONARIO_DATOS_CMS.md) — inventario y esquema live del corte 2026-11-14.
- [Dossier técnico](DOSSIER%20T%C3%89CNICO%20CONSOLIDADO.md) — detalle de arquitectura y contratos.
- [Flujos Capa 3](DOSSIER%20FLUJOS%20END%20TO%20END%20CAPA%203.md) — diseño documental, no certificación operativa.
- [Compatibilidad Wix](docs/qa/2026-11-14-wix-platform-compatibility.md).
- [Reconciliación Git/CI/CMS](docs/qa/2026-11-14-baseline-reconciliation.md).

## Estado crítico
- Plataforma confirmada: **Wix Editor Classic + Velo**.
- Git `main` verificado en el corte: `ee2a2f8aee6a00cbe3733b4b8d6325a6cb54bb51`.
- La sincronización del código Velo Editor ↔ GitHub no está verificada.
- `QA_RECORD_MUTATIONS_ENABLED=true`: QA solamente; bloquea publicación en producción.
- No hay release Wix vinculado a SHA ni certificación E2E runtime.
- No publicar ni desplegar sin autorización expresa y cumplimiento de los gates de [PROJECT_BASELINE.md](PROJECT_BASELINE.md).

Los informes históricos y PRs permanecen como trazabilidad en Git; no son instrucciones vigentes salvo que la base maestra los cite expresamente.
