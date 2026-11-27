# Manifiesto documental — 2026-11-27

## Documentación operativa vigente

La única entrada operativa es [INDEX.md](INDEX.md), con estas fuentes:
- `PROJECT-CANON.md`: arquitectura e invariantes.
- `STATE-NOW.md`: estado actual y siguiente sesión.
- `RELEASE-READINESS.md`: gates de aceptación y GO/NO-GO.
- `TPV-UNIFIED-FLOW.md`: contrato TPV.
- `TPV-MILESTONE-01-UNIFIED-CORE.md`: estado del hito TPV.
- `src/backend/tpv/README.md`: mapa del backend TPV.

## Política de archivo

`docs/archive/2026-11/` contiene auditorías, decisiones, handoffs, snapshots de CMS, diseños y contratos históricos. Se conserva como evidencia fechada y contexto de trazabilidad. No es fuente de instrucciones operativas: si una afirmación contradice el código integrado o las fuentes operativas vigentes, prevalece la evidencia más reciente y verificable.

No se borran auditorías históricas solo por ser antiguas. Los documentos duplicados o superados que ya no deban guiar trabajo se marcan como sustituidos, se archivan cuando aportan evidencia y se eliminan del árbol activo cuando existe una copia preservada.

## Cambios de consolidación — 2026-11-27

| Documento | Acción | Fuente vigente |
|---|---|---|
| `docs/TPV-ONLINE-TEST-READINESS.md` | Eliminado del árbol activo; copia histórica ya archivada | `docs/TPV-UNIFIED-FLOW.md` |
| `docs/TPV-SYNTHETIC-FISCAL-ACCEPTANCE.md` | Sustituido por una página breve; versión previa preservada en archivo | `docs/TPV-UNIFIED-FLOW.md`, `docs/RELEASE-READINESS.md` |
| `DOSSIER TÉCNICO CONSOLIDADO.md` | Sustituido por un índice de transición para evitar duplicidad y directrices obsoletas | `docs/PROJECT-CANON.md`, `docs/STATE-NOW.md` |
| `docs/audits/2026-11-27-wix-site-and-tpv-cli-audit.md` | Marcado como baseline anterior a PR #640; conservado como evidencia | `docs/STATE-NOW.md`, `docs/audits/2026-11-27-mvp-runtime-readonly-acceptance.md` |
| `docs/TPV-SYNTHETIC-FISCAL-ACCEPTANCE.md` | Copia íntegra archivada como `TPV-SYNTHETIC-FISCAL-ACCEPTANCE-2026-11-27-SUPERSEDED.md` | La versión corta actual solo redirige |

## Auditoría de código TPV

El árbol actual no contiene `tpvTestRuntime.web.js`, `tpvTestRuntimeRepository.js` ni `tpvTestRuntimeCore.js`. No se encontró evidencia de un runtime de negocio paralelo activo.

La compatibilidad histórica no se considera código muerto: `tpvHistoricalCompat.js` tiene consumidores en validación y pruebas; los discriminadores históricos aparecen en hooks/políticas de acceso y pruebas. No se eliminan hasta separar explícitamente el contrato de lectura histórica y superar la suite de regresión.

No se ha demostrado ningún módulo TPV huérfano con evidencia suficiente para borrarlo. La limpieza de dependencias/toolchain (ESLint 8 EOL y transitivas deprecated detectadas en auditoría previa) queda como tarea aislada, con actualización de lockfiles por herramienta oficial Wix/npm, CI y revisión de diff; no se mezcla con esta consolidación documental.

## Límites de verificación

- No se ejecutó código local ni se modificó lógica de negocio en esta consolidación.
- No se ejecutó CI para esta rama documental; el HEAD de main no tiene runs asociados.
- Los resultados CI citados en `STATE-NOW.md` corresponden a PR #640/#641.
- Wix Preview/Runtime y sincronización Git-Wix siguen sin acreditarse.
