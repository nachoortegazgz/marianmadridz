# Manifiesto de archivo — 2026-11

| Archivo de origen | Fecha documental | Motivo | Destino del contenido crítico |
|---|---|---|---|
| docs/PROJECT-STATUS.md | 2026-11-23 | Estado extenso duplicado; sustituido por estado acotado | STATE-NOW.md: P0/P1, estado Wix y NO-GO |
| docs/PROJECT-OWNER-DIRECTIVE-2026-11-20.md | 2026-11-20 | Directriz conservada como evidencia fuente | STATE-NOW.md: autoridad y precedencia |
| docs/DECISION-LOG.md | sin fecha nominal verificable | Registro histórico extenso; decisiones activas extraídas | STATE-NOW.md: BUS/TEC e invariantes |
| docs/PROJECT-KNOWLEDGE-BASE.md | sin fecha nominal verificable | Duplica estado, arquitectura e índice | Archivo íntegro en archive/2026-11/ |
| docs/MASTER-EXECUTION-PLAN.md | sin fecha nominal verificable | Duplica estado, backlog y criterios | Archivo íntegro en archive/2026-11/ |
| docs/architecture/ADR-CASH-REGISTER-SESSION-CONTROL.md | sin fecha nominal verificable | ADR extensa; preservada íntegra | Archivo íntegro en archive/2026-11/architecture/ |
| docs/architecture/ADR-VERIFACTU-REMISSION.md | sin fecha nominal verificable | Diseño y gates fiscales preservados | Archivo íntegro en archive/2026-11/architecture/ |
| docs/audits/2026-11-23-fiscal-recovery-root-cause.md | 2026-11-23 | Evidencia P0 preservada | STATE-NOW.md: #416 y CONFIG_SISTEMA_FISCAL |
| docs/audits/2026-11-23-movimientos-caja-count-drift.md | 2026-11-23 | Evidencia P0 de integridad preservada | STATE-NOW.md: #434 |
| docs/audits/2026-11-23-bookings-revalidation.md | 2026-11-23 | Evidencia P1 de Bookings preservada | STATE-NOW.md: #522/#523 y contrato F1/F2 |
| docs/audits/2026-11-23-repository-wix-cms-reconciliation.md | 2026-11-23 | Reconciliación Wix/CMS preservada | STATE-NOW.md: Draft y automatizaciones |
| docs/audits/2026-11-23-dual-booking-classification-and-order-reconciliation.md | 2026-11-23 | Clasificación de bookings y pedidos preservada | Archivo íntegro en archive/2026-11/audits/ |
| docs/architecture/TPV-HTML-WIDGET-BRIDGE.md | sin fecha nominal verificable | Contrato bridge actualizado preservado | STATE-NOW.md: 120 reintentos / 60 s / watchdog 65 s |
| docs/qa/TPV-NATIVE-SESSION-CONTRACT-2026-11-23.md | 2026-11-23 | Contrato TPV neutral preservado | Archivo íntegro en archive/2026-11/qa/ |
| docs/qa/TPV-WIX-NATIVE-RECONCILIATION-AUDIT-2026-11-23.md | 2026-11-23 | Conciliación POS/TPV preservada | STATE-NOW.md: pedidos #10030–#10034 |
| docs/qa/2026-11-23-tpv-session-handoff.md | 2026-11-23 | Relevo técnico con bloqueos TPV preservado | STATE-NOW.md: #525 y #435 |
| docs/qa/TPV-NATIVE-RECONCILIATION-ACCEPTANCE-2026-11-23.md | 2026-11-23 | Matriz de aceptación preservada | Archivo íntegro en archive/2026-11/qa/ |
| docs/qa/QA-ENVIRONMENT-SSOT.md | sin fecha nominal verificable | Addenda de entorno preservados; no son estado Runtime | Archivo íntegro en archive/2026-11/qa/ |
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


## Ciclo 2026-11-25

| Archivo de origen | Acción | Destino | Contenido crítico conservado en |
|---|---|---|---|
| `docs/RUNTIME-EVIDENCE-CHECKLIST.md` | Archivado tras consolidar los seis criterios PASS y sus procedimientos | `docs/archive/2026-11/RUNTIME-EVIDENCE-CHECKLIST.md` | `docs/RELEASE-READINESS.md` (bloques P1–P4, F1 y F5); `docs/PROJECT-CANON.md` (contratos y patrones) |
| `docs/qa/2026-11-24-tpv-diff-review-and-safe-hardening.md` | Archivado como revisión de sesión; referencias contractuales trasladadas al canónico | `docs/archive/2026-11/qa/2026-11-24-tpv-diff-review-and-safe-hardening.md` | `docs/PROJECT-CANON.md` (TPV, inventario, pagos y estado) |

Conteo del ciclo documental previo: 2 archivos movidos; 0 eliminados. El inventario global debe recalcularse desde el árbol Git vigente antes de publicar nuevos contadores; los tres JSON de `docs/qa/` permanecen como fixtures/snapshots QA.


## Revisión de vigencia — 2026-11-25

- PR #611 está fusionada en `main` (merge `62fdcb7b560f7eab16f1188ecf9227ae7b45d5cf`). El estado de TPV preparado y sus gates se mantienen en `docs/STATE-NOW.md`, `docs/RELEASE-READINESS.md` y `src/backend/tpv/README.md`.
- Se actualizaron los documentos canónicos para retirar estados obsoletos de PR abierta/Draft y referencias antiguas a escrituras sintéticas activas.
- No se eliminaron documentos archivados: contienen evidencia histórica, contratos y decisiones que no deben perder trazabilidad. La limpieza se realiza separando documentación viva de evidencia histórica y retirando referencias operativas obsoletas.
- No se publican contadores de archivos nuevos en esta revisión porque el inventario anterior contenía cifras incompatibles entre sí; deben recalcularse desde el árbol Git completo antes de usarse como métrica.


## Supersesión de directrices TPV — 2026-11-25

La nueva decisión [TPV-UNIFIED-FLOW.md](TPV-UNIFIED-FLOW.md) sustituye cualquier instrucción histórica que ordene crear, mantener o autorizar un runtime TPV diferenciado por Sandbox/Live, sintético/real, Preview/Published o test-run. Los documentos de auditoría y handoff anteriores se conservan íntegros como evidencia fechada, pero dejan de ser instrucciones operativas. No se borran porque acreditan decisiones y observaciones anteriores; ante contradicción, prevalece el criterio de flujo único. La retirada de código se ejecutará solo después de verificar consumidores, bindings, hooks y pruebas.


| docs/TPV-ONLINE-TEST-READINESS.md | 2026-11-25 | Instrucciones del runtime separado PR #615/#616 sustituidas por el flujo único | Copia histórica: [TPV-ONLINE-TEST-READINESS-2026-11-25-SUPERSEDED.md](archive/2026-11/qa/TPV-ONLINE-TEST-READINESS-2026-11-25-SUPERSEDED.md); autoridad actual: [TPV-UNIFIED-FLOW.md](TPV-UNIFIED-FLOW.md) y [Hito TPV-01](TPV-MILESTONE-01-UNIFIED-CORE.md) |

## Limpieza documental — 2026-11-25

- Se retira del área viva el documento de preparación online del runtime separado; se conserva como evidencia histórica marcada explícitamente como supersedida.
- Se elimina el artefacto generado `.codeviz/Untitled 1/Untitled-1.md`: no estaba indexado, duplicaba diagramas y contenía referencias/placeholder no verificados.
- El criterio operativo vigente se limita a `PROJECT-CANON.md`, `STATE-NOW.md`, `RELEASE-READINESS.md`, `TPV-UNIFIED-FLOW.md` y `TPV-MILESTONE-01-UNIFIED-CORE.md`; los documentos archivados no son instrucciones ejecutables.


## Consolidación de sesión — 2026-11-27

- `docs/TPV-ONLINE-TEST-READINESS.md` se elimina del árbol operativo: su copia ya está en `archive/2026-11/qa/TPV-ONLINE-TEST-READINESS-2026-11-25-SUPERSEDED.md`; autoridad actual: `TPV-UNIFIED-FLOW.md`.
- `docs/TPV-SYNTHETIC-FISCAL-ACCEPTANCE.md` se reduce a una página de sustitución. Su contenido anterior se preserva en `archive/2026-11/qa/TPV-SYNTHETIC-FISCAL-ACCEPTANCE-2026-11-27-SUPERSEDED.md`.
- `DOSSIER TÉCNICO CONSOLIDADO.md` deja de ser documentación operativa y se convierte en un índice de transición a PROJECT-CANON, STATE-NOW, RELEASE-READINESS e INDEX. Se mantiene el path para no romper referencias históricas externas.
- `audits/2026-11-27-wix-site-and-tpv-cli-audit.md` queda marcado explícitamente como baseline anterior a PR #640; no se borra porque documenta el diagnóstico que motivó la corrección.
- No se purgan auditorías ni documentos históricos que acreditan cambios, decisiones, contratos o resultados. El archivo histórico no es documentación activa.
- Auditoría de código TPV: no se encontró el runtime separado `tpvTestRuntime*.js` en el árbol actual. `tpvHistoricalCompat.js`, discriminadores históricos y sus validadores/hooks conservan referencias desde `validation.js`, `data.js`, `dataAccessPolicy.js` y pruebas; no se eliminan hasta separar y probar esa compatibilidad. No se ha demostrado ningún módulo TPV huérfano con evidencia suficiente para borrarlo.
- No se ha ejecutado suite local ni CI para esta rama documental; no se declara validación de código ni runtime.
