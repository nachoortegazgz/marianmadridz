# Release Readiness

| Issue | Descripción (1 línea) | PR asociado | Evidencia runtime requerida (referencia a RUNTIME-EVIDENCE-CHECKLIST.md) | Estado evidencia | Responsable | Fecha |
|---|---|---|---|---|---|---|
| #416 (P0) | Caja, compensaciones pendientes y conciliación de pedidos POS. | #587 | P3 y P4; además conciliación/recovery de los casos #10032–#10034 fuera de esta checklist. | PENDIENTE | Propietario + QA | — |
| #415 / #209 (P0) | Maestro fiscal canónico y SIF/VERI*FACTU; el registro fiscal real no consta en el último estado documentado. | #589 | RUNTIME-EVIDENCE-CHECKLIST.md; F1 requiere configuración legal verificada; F5 tiene contrato offline en PR #589 y sigue pendiente de evidencia runtime segura. | PENDIENTE | Propietario + asesoría fiscal | — |
| #525 (P0) | Concurrencia de apertura y proyección CajaActual. | #587 | P1. | PENDIENTE | QA | — |
| #434 (P0) | Discrepancia de integridad y recuento de MovimientosCaja. | — | RUNTIME-EVIDENCE-CHECKLIST.md; auditoría de integridad/append-only y conciliación específica del issue. | PENDIENTE | QA + propietario | — |
| #520 (P0) | Estado y efectos de automatizaciones Wix preinstaladas. | — | RUNTIME-EVIDENCE-CHECKLIST.md; verificación de efectos y estado real en Wix. | PENDIENTE | Propietario + QA | — |
| #523 (P1) | Inconsistencias entre proyecciones CitasF2 y bookings nativos. | — | RUNTIME-EVIDENCE-CHECKLIST.md; revalidación Bookings y trazabilidad de ledger asociada. | PENDIENTE | QA | — |
| #522 (P1) | Diferencias entre flags de pago del catálogo y opciones nativas Bookings. | — | RUNTIME-EVIDENCE-CHECKLIST.md; validación de canales y checkout en Preview. | PENDIENTE | QA | — |
| #210 (P1) | Protección de main y obligatoriedad de checks. | — | RUNTIME-EVIDENCE-CHECKLIST.md; evidencia de rulesets/branch protection y checks requeridos. | PENDIENTE | Propietario | — |
| #435 (P1) | Aislamiento y persistencia del TPV QA en Sandbox Wix. | #587 (parcial: P1–P4 TPV) | P1, P3 y P4; evidencia específica de aislamiento Sandbox de #435. | PENDIENTE | QA | — |

P0: 0 con evidencia PASS / 5 pendientes (3 con PR listo; 2 sin PR).

P1: 0 con evidencia PASS / 4 pendientes.

Decisión preliminar: NO-GO hasta que todos los P0 estén PASS.

Regla dura: "Sin evidencia runtime enlazada = NO-GO automático del ítem".
