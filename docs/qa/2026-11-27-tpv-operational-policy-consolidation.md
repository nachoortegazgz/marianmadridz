# Registro de decisión — política TPV (2026-11-27)

Este documento registra la decisión histórica de PR #651. La especificación operativa vigente está consolidada en [TPV-UNIFIED-FLOW](../TPV-UNIFIED-FLOW.md); no mantener aquí una segunda copia del contrato.

- No hay interruptores globales por entorno para deshabilitar writers. La operación valida sus precondiciones concretas.
- Desarrollo, pruebas y producción comparten el mismo código de dominio; fixtures y dobles aíslan dependencias externas.
- Los errores TPV deben ser explícitos, estables, seguros y accionables. El envelope común y su estado de integración se describen en el flujo canónico.
- Borrado físico prohibido en DAL, bulk, hooks y crons. Las actualizaciones comerciales/operativas requieren validación y autorización.
- Ledgers contabilizados, jornada y cierres son append-only; rectificaciones mediante nuevos eventos trazables.
- No clasificar negocio por etiquetas de entorno ni alterar históricos. Los marcadores de smoke/simulación solo identifican fixtures de prueba.
- La PR #651 permanece pendiente de CI final y merge en el momento de esta revisión. No implica Runtime E2E ni habilitación productiva.
