# Remediación P0 — bootstrap singleton CajaActual

**Fecha:** 2026-11-28  
**Rama:** fix/tpv-caja-singleton-bootstrap-2026-11-28

## Diagnóstico
La colección Wix CajaActual está vacía. initializeTpvCaja() solo consultaba el singleton y devolvía TPV_CASH_REGISTER_NOT_PRESEEDED; por tanto, el botón de inicialización no podía recuperar el estado tras un reset autorizado.

## Corrección
- La inicialización se ejecuta en backend, bajo el lock de proyección fiscal/caja compartido.
- Crea exclusivamente el item fijo SINGLE_ITEM_ID / CAJA_PRINCIPAL, si no existe.
- El estado inicial es CERRADA, importes cero y contadores vacíos; no inventa una apertura ni un cierre histórico.
- Inserta por DAL (insertItem) con permisos elevados internos, validación y esquema canónico.
- Hace read-back fuerte y valida integridad antes de declarar éxito.
- Si la inserción arroja un resultado incierto, consulta el singleton; no sustituye un registro existente.
- La WebMethod autorizada pasa su traceId a la inicialización.

## Límites
Esto solo repara el bootstrap del singleton. No crea el cierre de ayer, no abre la caja, no crea movimientos ni realiza cobros. La ejecución real requiere invocar inicializarCaja() desde Wix Runtime con un miembro autorizado y verificar el read-back CMS.

## Validación
Prueba estática añadida para contrato de bootstrap y propagación de traceId. CI y Wix Runtime pendientes en esta rama.
