# Manifiesto de archivo — 2026-11

| Archivo de origen | Fecha documental | Motivo | Destino del contenido crítico |
|---|---|---|---|
| docs/PROJECT-STATUS.md | 2026-11-23 | Estado extenso duplicado; sustituido por estado acotado | STATE-NOW.md: P0/P1, estado Wix y NO-GO |
| docs/PROJECT-OWNER-DIRECTIVE-2026-11-20.md | 2026-11-20 | Directriz conservada como evidencia fuente | STATE-NOW.md: autoridad y precedencia |
| docs/DECISION-LOG.md | sin fecha nominal verificable | Registro histórico extenso; decisiones activas extraídas | STATE-NOW.md: BUS/TEC e invariantes |
| docs/PROJECT-KNOWLEDGE-BASE.md | sin fecha nominal verificable | Duplica estado, arquitectura e índice | STATE-NOW.md: invariantes vigentes |
| docs/MASTER-EXECUTION-PLAN.md | sin fecha nominal verificable | Duplica estado, backlog y criterios | STATE-NOW.md: bloqueos actuales |
| docs/architecture/ADR-CASH-REGISTER-SESSION-CONTROL.md | sin fecha nominal verificable | ADR extensa; preservada íntegra | STATE-NOW.md: caja y separación ledger/proyección |
| docs/architecture/ADR-VERIFACTU-REMISSION.md | sin fecha nominal verificable | Diseño y gates fiscales preservados | STATE-NOW.md: #415/#209 y writers cerrados |
| docs/audits/2026-11-23-fiscal-recovery-root-cause.md | 2026-11-23 | Evidencia P0 preservada | STATE-NOW.md: #416 y CONFIG_SISTEMA_FISCAL |
| docs/audits/2026-11-23-movimientos-caja-count-drift.md | 2026-11-23 | Evidencia P0 de integridad preservada | STATE-NOW.md: #434 |
| docs/audits/2026-11-23-bookings-revalidation.md | 2026-11-23 | Evidencia P1 de Bookings preservada | STATE-NOW.md: #522/#523 y contrato F1/F2 |
| docs/audits/2026-11-23-repository-wix-cms-reconciliation.md | 2026-11-23 | Reconciliación Wix/CMS preservada | STATE-NOW.md: Draft y automatizaciones |
| docs/audits/2026-11-23-dual-booking-classification-and-order-reconciliation.md | 2026-11-23 | Clasificación de bookings y pedidos preservada | STATE-NOW.md: #10030–#10034 |
| docs/architecture/TPV-HTML-WIDGET-BRIDGE.md | sin fecha nominal verificable | Contrato bridge actualizado preservado | STATE-NOW.md: 120 reintentos / 60 s / watchdog 65 s |
| docs/qa/TPV-NATIVE-SESSION-CONTRACT-2026-11-23.md | 2026-11-23 | Contrato TPV neutral preservado | STATE-NOW.md: sourceType/processingMode/reconciliationStatus |
| docs/qa/TPV-WIX-NATIVE-RECONCILIATION-AUDIT-2026-11-23.md | 2026-11-23 | Conciliación POS/TPV preservada | STATE-NOW.md: pedidos #10030–#10034 |
| docs/qa/TPV-NATIVE-RECONCILIATION-ACCEPTANCE-2026-11-23.md | 2026-11-23 | Matriz de aceptación preservada | Archivo íntegro en archive/2026-11/qa/ |
| docs/qa/QA-ENVIRONMENT-SSOT.md | sin fecha nominal verificable | Addenda de entorno preservados; no son estado Runtime | STATE-NOW.md: Draft y límites de validación |
| docs/reference/DICCIONARIO_DATOS_CMS.md | sin fecha nominal verificable | Referencia extensa; snapshots sujetos a read-back | Archivo íntegro en archive/2026-11/reference/ |
| docs/reference/WIX-CMS-SCHEMA-VERIFICATION-2026-11-23.md | 2026-11-23 | Read-back físico preservado | Archivo íntegro en archive/2026-11/reference/ |
| docs/reference/DOSSIER-FLUJOS-CAPA-1-A-CAPA-3.md | sin fecha nominal verificable | Diseño Capa 3 no operativo | STATE-NOW.md: autoridad Capa 1/Capa 3 |

## Reubicación

Los 156 archivos Markdown/texto inventariados se trasladan sin alterar su contenido a `docs/archive/2026-11/`, conservando su ruta relativa y nombre. Los documentos no enumerados individualmente en la tabla anterior se preservan íntegros en el mismo árbol de archivo; no se eliminan.

## Contadores

| Métrica | Antes | Después |
|---|---:|---:|
| Archivos .md/.txt bajo docs/ | 156 | 159 (3 vivos + 156 archivados) |
| Documentos vivos bajo docs/ | 156 | 3 |
| Documentos .md en docs/ raíz | 9 | 3 |
| Archivos archivados | 0 | 156 |
| Archivos borrados | 0 | 0 |
| Archivos nuevos permitidos | 0 | 3 |

Reducción del corpus vivo: **156 → 3 (98,08 %)**. Reducción de documentos en la raíz: **9 → 3 (66,67 %)**.
