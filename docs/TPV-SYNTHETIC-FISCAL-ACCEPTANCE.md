# TPV — aceptación fiscal sintética

<badge>Documento sustituido</badge>

Este documento histórico contenía criterios de pruebas y supuestos de CMS que han evolucionado. No debe utilizarse como runbook ni como autorización para mutar ledgers, caja o registros existentes.

Fuentes vigentes:
- [Flujo TPV único](TPV-UNIFIED-FLOW.md).
- [Estado actual](STATE-NOW.md).
- [Gates de release](RELEASE-READINESS.md).
- [Copia histórica del documento sustituido](archive/2026-11/qa/TPV-SYNTHETIC-FISCAL-ACCEPTANCE-2026-11-27-SUPERSEDED.md).

Decisión actual: la clasificación sintético/real se deriva en backend mediante `recordTimestamp` y `productionActivationAt`; no se usa un runtime alternativo. La naturaleza sintética no autoriza a sobrescribir ni borrar ledgers append-only. No se habilitan cobros ni efectos externos durante QA.
