# Segunda pasada documental — archivo noviembre 2026

**Fecha de revisión:** 2026-11-28  
**Rama base:** `main`  
**Alcance:** todos los archivos bajo `docs/archive/2026-11/`  
**Inventario revisado:** 161 documentos preexistentes · 8 grupos · 0 duplicados binarios exactos. Este registro es el nuevo artefacto de revisión y queda excluido del universo auditado para evitar autorreferencia.

## Dictamen

El archivo contiene evidencia técnica útil, pero mezcla snapshots de distintos días, decisiones que fueron sustituidas, diseños no aprobados, handoffs y contratos implementados que después cambiaron. El riesgo principal no es que existan demasiados archivos: es que un modelo recupere un documento antiguo como si describiera el estado actual o ejecutase una instrucción ya revocada.

**Decisión de limpieza:** no se elimina ni se reescribe el cuerpo probatorio de ninguna auditoría, snapshot o handoff. Se mantiene la estructura de archivo y se introduce este registro documento a documento. Se corrigen únicamente datos personales y un identificador de credencial expuesto en documentación antigua. No se han tocado código, CMS, Wix, secretos ni configuración.

## Reglas para cualquier modelo IA

1. Este árbol es evidencia histórica, no una fuente operativa de estado.
2. Una observación solo describe el instante, sitio, método y SHA que constan en su documento.
3. CI offline no acredita Wix Editor, Preview, Runtime ni producción.
4. Una decisión histórica solo se aplica si no existe una enmienda o decisión posterior.
5. Contratos Wix se verifican contra documentación oficial vigente; el código/tests describen implementación y comportamiento offline.
6. Antes de ejecutar una tarea, empezar por [AI-ENTRYPOINT](../../AI-ENTRYPOINT.md), [AI-INDEX](../../AI-INDEX.md), [STATE-NOW](../../STATE-NOW.md), [PROJECT-CANON](../../PROJECT-CANON.md) y el documento de dominio correspondiente.
7. No convertir una propuesta, checklist o criterio de aceptación en una prueba ejecutada.

## Resumen de decisiones de organización

| Grupo | Archivos | Tratamiento |
|---|---:|---|
| Raíz | 11 | Se identifican los resúmenes/estados supersedidos y las decisiones históricas |
| ADR | 6 | Se conservan; se distingue decisión aceptada, propuesta y contrato a revalidar |
| Arquitectura | 9 | Se marcan los diseños TPV retirados o sustituidos; se conserva el rationale |
| Auditorías | 58 | Se conservan como snapshots fechados, no como estado actual |
| Estándares | 1 | Se conserva como antecedente; prevalecen reglas actuales |
| Hitos | 2 | Evidencia histórica de CI/PR, sin valor de release actual |
| QA | 71 | Se separan evidencia offline, especificaciones y handoffs; no implican Runtime |
| Referencias | 3 | El diccionario y esquema 23-11 quedan sustituidos por el CMS snapshot 27-11; el dossier E2E se conserva como diseño histórico |

## Registro individual

### Documentos raíz (11)

| Documento | Clasificación | Resultado y acción |
|---|---|---|
| `CHECKPOINT-2026-11-01-PHASE0.md` | SUPERSEDED — RETAIN | Checkpoint del 01-11; estado, PR y backlog sustituidos por `docs/STATE-NOW.md` y `docs/RELEASE-READINESS.md`. |
| `DECISION-LOG.md` | DECISION RECORD — REVALIDATE | Registro cronológico con decisiones revocadas y adendas. Conservar; nunca consumirlo como política vigente sin comprobar fecha, supersedencia y `docs/PROJECT-CANON.md`. Se han redactado contactos personales. |
| `DOSSIER CONSOLIDADO.txt` | SUPERSEDED — RETAIN | Dossier raíz duplicado/antiguo; sustituido para consulta por `DOSSIER CONSOLIDADO.md`, `AI-ENTRYPOINT.md` y documentos canónicos. Se ha eliminado el identificador de credencial y redactado el contacto personal. |
| `MASTER-EXECUTION-PLAN.md` | SUPERSEDED — RETAIN | Plan de 23-11 con PR/issues/estados superados; usar `STATE-NOW` y `RELEASE-READINESS`. |
| `PROJECT-KNOWLEDGE-BASE.md` | SUPERSEDED — RETAIN | Base de conocimiento 23-11; sustituida como entrada IA por `AI-ENTRYPOINT`, `AI-INDEX` y `PROJECT-CANON`. |
| `PROJECT-OWNER-DIRECTIVE-2026-11-20.md` | HISTORICAL DECISION — RETAIN | Directriz original del 20-11; existen instrucciones y enmiendas posteriores del propietario. No prevalece sobre las directrices del proyecto actuales. |
| `PROJECT-STATUS.md` | SUPERSEDED — RETAIN | Estado del 23-11; sustituido por `docs/STATE-NOW.md`. |
| `README.md` | HISTORICAL INDEX — RETAIN | Índice del archivo al 23-11; el registro de segunda pasada lo complementa y lo sustituye como inventario documento a documento. |
| `RUNTIME-EVIDENCE-CHECKLIST.md` | SUPERSEDED TEST SPEC — RETAIN | Checklist previo a cambios posteriores de Capa 0/TPV; usar `tests/runtime/RUNTIME-TEST-PLAN.md` y verificar precondiciones actuales. |
| `SESSION-STATUS-2026-10-31.md` | SUPERSEDED HANDOFF — RETAIN | Handoff de 31-10; solo evidencia histórica, no instrucciones de continuación. |
| `VELO-MANIFEST-BOOTSTRAP.md` | EPHEMERAL ARTIFACT — RETAIN | Artefacto temporal de bootstrap. No ejecutar como runbook; consultar workflows y documentación Wix CLI actuales. |


### Decisiones ADR (6)

| Documento | Clasificación | Resultado y acción |
|---|---|---|
| `adr/2026-11-10-deposit-and-native-inventory.md` | DECISION RECORD — REVALIDATE | Criterio de anticipo/fianza e inventario nativo; Wix Stores V3 conserva autoridad de stock. No activar depósitos sin contrato fiscal/legal actual. |
| `adr/ADR-002-bookings-v2-sdk-field-names.md` | CONTRACT REFERENCE — REVALIDATE | Referencia histórica de nombres REST vs SDK Bookings; confirmar siempre con documentación oficial vigente y consumidores actuales. |
| `adr/ADR-003-cart-v2-booking-checkout.md` | DECISION RECORD — REVALIDATE | Decisión Cart V2 y separación del carrito de reservas; conservar como rationale, no como prueba de checkout Runtime. |
| `adr/ADR-004-payment-provider-wix-payments.md` | DECISION RECORD — REVALIDATE | Decisión de proveedor Wix Payments; no acredita onboarding ni métodos habilitados en la cuenta. |
| `adr/ADR-004-persistent-rate-limiting.md` | DECISION RECORD — REVALIDATE | Diseño de rate limiting persistente; confirmar contrato/código actual antes de cambiarlo. |
| `adr/ADR-004-stores-catalog-v3-migration.md` | DECISION RECORD — RETAIN | Rationale de migración Catalog V3. La autoridad nativa de inventario se mantiene; el estado de integración actual está en código y `STATE-NOW`. |

### Arquitectura (9)

| Documento | Clasificación | Resultado y acción |
|---|---|---|
| `architecture/ADR-CASH-REGISTER-SESSION-CONTROL.md` | PROPOSAL / SUPERSEDED — RETAIN | Propuesta de sesión de caja con snapshots históricos y contratos previos. No ejecutar sus reglas como especificación vigente; contrastar con `TPV-UNIFIED-FLOW` y código actual. |
| `architecture/ADR-TPV-CASH-MOVEMENT-UNIQUE-TRANSACTION-ID-2026-11-20.md` | SUPERSEDED DESIGN — RETAIN | Namespacing basado en SANDBOX_RUN_ID quedó supersedido por el contrato neutral de identidad e idempotencia integrado posteriormente (incluida PR #667). Mantener solo como explicación del defecto histórico. |
| `architecture/ADR-TPV-SYNTHETIC-PAYMENT-SIMULATOR-2026-11-20.md` | RETIRED IMPLEMENTATION — RETAIN | Simulador y runtime de identidades TPV retirados en PR #627. No recrear módulos/fixtures a partir de este ADR. |
| `architecture/ADR-VERIFACTU-REMISSION.md` | UNAPPROVED PROPOSAL — RETAIN | Propuesta de remisión; no aprobada ni evidencia de cumplimiento. Contrastar con normativa y especificaciones AEAT vigentes antes de cualquier diseño/activación. |
| `architecture/TPV-CAJA-INTEGRATION.md` | SUPERSEDED — RETAIN | Integración read-only antigua; reemplazada por flujo TPV posterior. |
| `architecture/TPV-CURRENT-SITE-IMPLEMENTATION-2026-11-16.md` | SUPERSEDED SNAPSHOT — RETAIN | Snapshot del 16-11, con esquema/flags y estado ya superados; usar `STATE-NOW`, `ESQUEMA_CMS` y `TPV-UNIFIED-FLOW`. |
| `architecture/TPV-HTML-WIDGET-BRIDGE.md` | SUPERSEDED CONTRACT SNAPSHOT — RETAIN | Contrato del bridge previo a correcciones posteriores (#637 y revisiones siguientes); usar código actual, tests y auditoría widget/action 27-11. |
| `architecture/TPV-REPORT-IMPLEMENTATION.md` | RETIRED IMPLEMENTATION — RETAIN | Diseño de nueve colecciones TPV_QA_* retirado; no recrear colecciones ni writers. |
| `architecture/TPV-WIX-NATIVE-INTEGRATION.md` | SUPERSEDED SNAPSHOT — RETAIN | Estado de integración y nombres SANDBOX históricos; usar `TPV-UNIFIED-FLOW` y `STATE-NOW`. |

### Auditorías (58)

| Documento | Clasificación | Resultado y acción |
|---|---|---|
| `audits/2026-10-31-wix-bookings-live-readonly-audit.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-01-booking-flow-retries.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-01-live-cms-reconciliation.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-01-widget-timeout-alignment.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-01-wix-p0-corrections-and-p1-followup.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-01-wix-site-app-settings-readonly-audit.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-05-live-calendar-route-verification.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-05-workflow-traceability-matrix.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-06-cms-field-pruning-qa.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-06-control-operativo-field-audit.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-09-capa3-implementation-state.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-09-catalog-inventory-state.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-09-consolidated-error-report-review.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-09-frontend-native-reconciliation.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-11-bulk-patch-policy.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-11-cms-write-policy.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-11-orphan-catalog-adapter-removal.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-11-p0-p1-hardening.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-11-wix-automation-recipient-isolation.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-12-report-bugs-reconciliation.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-13-current-site-isolation.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-14-accounting-fiscal-document-flow-audit.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-14-cajaactual-live-schema-audit.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-14-code-debt-cleanup.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-14-current-site-cms-normalization.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-14-fiscal-validation-deduplication.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-14-qa-automations-isolation.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-14-tpv-contract-gap-audit.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-15-live-cms-keyfield-code-alignment.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-16-tpv-qa-cms-readonly-verification.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-17-caja-session-normalization.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-17-cms-permissions-hardening.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-17-compensation-order-correlation.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-17-deployment-readiness.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-17-live-operational-recheck.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-17-mapastaff-contract-reconciliation.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-17-tpv-deployment-readiness.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-19-cli-toolchain-audit.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-19-tpv-interface-backend-reconciliation.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-20-backend-flow-reachability-and-e2e-readiness.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-20-consolidated-tpv-sandbox-and-release-readiness.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-20-implementation-corrections-status.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-20-live-cms-and-wix-lock-reconciliation.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-20-tpv-backend-sandbox-gate.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-20-tpv-sandbox-persistence-decision.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-20-wix-live-sandbox-usage.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-21-wix-site-readonly-baseline.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-23-bookings-revalidation.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-23-code-minimization-review.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-23-dual-booking-classification-and-order-reconciliation.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-23-fiscal-recovery-root-cause.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-23-movimientos-caja-count-drift.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-23-native-vs-custom-functionality-matrix.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-23-repository-wix-cms-reconciliation.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-23-revised-objectives-and-execution-plan.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-23-tpv-native-directory-cms-alignment.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-23-tpv-neutral-adaptation-baseline.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |
| `audits/2026-11-23-tpv-synthetic-records-contract-audit.md` | HISTORICAL AUDIT — RETAIN | Auditoría fechada: conservar como evidencia de su corte. Sus estados, recuentos, PR, esquema y conclusiones no son actuales por defecto; contrastar con `STATE-NOW`, `ESQUEMA_CMS`, código/tests y fuente oficial. |

### Estándares (1)

| Documento | Clasificación | Resultado y acción |
|---|---|---|
| `engineering/DEVELOPMENT-STANDARDS.md` | HISTORICAL STANDARD — REVALIDATE | Estándar de noviembre; prevalecen las instrucciones actuales del proyecto, `AI-ENTRYPOINT` y documentación oficial. |

### Hitos (2)

| Documento | Clasificación | Resultado y acción |
|---|---|---|
| `milestones/2026-11-14-backend-deployment-fix.md` | MILESTONE EVIDENCE — RETAIN | Evidencia histórica PR #373/#374; no representa el HEAD ni la aceptación Runtime actuales. |
| `milestones/2026-11-14-qa-offline-fixtures-complete-runtime-isolation-blocked.md` | MILESTONE EVIDENCE — RETAIN | Evidencia histórica de fixtures y aislamiento; los estados de automatizaciones y runtime deben revalidarse. |

### QA, pruebas y handoffs (71)

| Documento | Clasificación | Resultado y acción |
|---|---|---|
| `qa/2026-11-06-capa2-integrated-audit.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-06-layer1-bookings-live-readonly-audit.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-06-layer1-layer2-simulation-report.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-08-member-identity-sdk-contract.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-09-accountant-package-read-model.md` | RETIRED DOMAIN — RETAIN | Paquetes de gestoría/PaquetesGestoria fueron retirados del alcance/runtime posterior. Conservar rationale y evidencia; no recrear. |
| `qa/2026-11-09-accountant-package-snapshot-pause.md` | RETIRED DOMAIN — RETAIN | Pausa histórica de snapshot de gestoría; no reactivar módulo retirado. |
| `qa/2026-11-09-catalog-v3-invoices-compatibility.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-09-data-registration-gap-execution.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-09-fiscal-ledger-z-hardening.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-09-process-registration-coverage.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-09-runtime-smoke-production.md` | HISTORICAL RUNTIME SNAPSHOT — RETAIN | Smoke y estado de publicación de 09-11; reemplazado por read-backs posteriores. No inferir estado actual. |
| `qa/2026-11-09-verifactu-readiness-audit.md` | HISTORICAL FISCAL AUDIT — REVALIDATE | Diagnóstico estático de Veri*Factu del 09-11. No es certificación; verificar normativa AEAT y estado del SIF actual. |
| `qa/2026-11-09-wix-members-cart-v2-published-e2e-runbook.md` | TEST SPEC / EVIDENCE — REVALIDATE | Especificación o reproducción fechada; no confundir pasos esperados con pruebas ejecutadas. Usar el plan Runtime actual. |
| `qa/2026-11-09-wix-members-required-booking.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-10-manager-package-snapshot-implementation.md` | RETIRED DOMAIN — RETAIN | Implementación de PaquetesGestoria retirada; no reintroducir colecciones ni hooks. |
| `qa/2026-11-10-native-inventory-retirement.md` | DECISION EVIDENCE — RETAIN | Evidencia de retirada de inventario custom y delegación a Wix Stores. Rationale útil; comprobar estado actual en `PROJECT-CANON` y código. |
| `qa/2026-11-10-phase2-catalog-status-audit.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-10-smoke-ledger-contamination-audit.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-11-cms-smoke-process-audit.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-11-execution-status.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-11-native-booking-created-projection.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-11-next-milestone-readiness.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-11-post-merge-ecosystem-reconciliation.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-11-qa-master-reference.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-11-staff-zones-bookings-alignment.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-12-dual-reschedule-readonly-inspector.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-12-live-cms-field-completeness.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-13-citasf2-keyfields.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-13-custom-cms-registration-audit.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-13-fiscal-alert-and-citasf2-recovery.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-13-post-merge-live-readonly-check.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-14-baseline-reconciliation.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-14-control-operativo-field-contract.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-14-qa-execution-log.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-14-retired-inventory-contract-audit.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-14-wix-platform-compatibility.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-20-accounting-ledger-insert-guard.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-20-bug-report-addendum-and-fixes.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-20-cms-insert-contract-audit.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-20-cms-producer-and-bypass-audit.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-20-control-operativo-live-audit.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-20-current-state-consolidated.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-20-ecom-pos-channel-guard.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-20-fiscal-config-fail-closed.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-20-live-caja-schema-and-reconciliation.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-20-online-test-readiness.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-20-project-state-and-release-plan.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-20-release-readiness-consolidated.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-20-tpv-arqueo-wde0123-fix.md` | SUPERSEDED FIX — RETAIN | Fix basado en IDs SANDBOX_RUN_ID, sustituido por contrato neutral de transactionId; no reutilizar generador antiguo. |
| `qa/2026-11-20-tpv-sandbox-session-handoff.md` | SUPERSEDED HANDOFF — RETAIN | Handoff del modelo TPV Sandbox; sustituido por TPV unified flow. |
| `qa/2026-11-20-tpv-synthetic-business-day-simulation.md` | OFFLINE TEST EVIDENCE — RETAIN | Simulación en memoria, no Runtime. Conservar como evidencia de escenarios y validar su suite/test actual. |
| `qa/2026-11-22-phase0-live-reassessment.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/2026-11-23-tpv-neutral-source-contract-audit.md` | SUPERSEDED DESIGN — RETAIN | Auditoría del contrato neutral previa a PRs de hardening posteriores; usar código, `TPV-UNIFIED-FLOW` y `STATE-NOW`. |
| `qa/2026-11-23-tpv-session-handoff.md` | SUPERSEDED HANDOFF — RETAIN | Handoff del 23-11; solo contexto histórico. |
| `qa/2026-11-23-tpv-wix-audit-validation.md` | HISTORICAL READ-BACK — RETAIN | Read-back Wix del 23-11; estado Draft observado entonces, no sustituye el estado más reciente. |
| `qa/2026-11-24-tpv-diff-review-and-safe-hardening.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |
| `qa/BACKLOG-RECONCILIATION-2026-11-23.md` | SUPERSEDED BACKLOG — RETAIN | Estado de issues al 23-11; no utilizar como backlog actual. Consultar GitHub Issues y `STATE-NOW`. |
| `qa/BOOKINGS-INTERNAL-F2-AVAILABILITY-2026-11-23.md` | TEST SPEC / EVIDENCE — REVALIDATE | Especificación o reproducción fechada; no confundir pasos esperados con pruebas ejecutadas. Usar el plan Runtime actual. |
| `qa/DUAL-BOOKING-AVAILABILITY-REPRO-2026-11-24.md` | TEST SPEC / EVIDENCE — REVALIDATE | Especificación o reproducción fechada; no confundir pasos esperados con pruebas ejecutadas. Usar el plan Runtime actual. |
| `qa/DUAL-BOOKING-RUNTIME-ACCEPTANCE-2026-11-23.md` | TEST SPEC — REVALIDATE | Especificación de pruebas, no resultados. Comparar con `tests/runtime/RUNTIME-TEST-PLAN.md` antes de ejecutar. |
| `qa/PHASE1-REPOSITORY-STABILIZATION-2026-11-23.md` | MILESTONE EVIDENCE — RETAIN | Cierre de fase de repositorio/documentación del 23-11; no equivale a release, Runtime o producción. |
| `qa/QA-ENVIRONMENT-SSOT.md` | SUPERSEDED POLICY SNAPSHOT — RETAIN | SSOT QA de noviembre con adendas contradictorias sobre mutabilidad, Sandbox y estado Published. No usar como política actual; prevalecen las instrucciones del propietario y `PROJECT-CANON`/`STATE-NOW`. |
| `qa/QA-RESERVAS-PAGOS-REEMBOLSOS-2026-11-09.md` | HISTORICAL TEST EVIDENCE — RETAIN | Pruebas offline y contratos de pagos/reservas; no equivalen a integración E2E actual. |
| `qa/QA-SIMULATION-2026-11.md` | HISTORICAL TEST EVIDENCE — REVALIDATE | Pack de fixtures y cobertura offline. Los IDs de escenario/test y la cobertura deben cotejarse con los ficheros actuales; no equivale a Runtime. |
| `qa/SESSION-HANDOFF-2026-11-20.md` | SUPERSEDED HANDOFF — RETAIN | Handoff 20-11; referencias a PR/estado antiguas. No usar como siguiente paso operativo. |
| `qa/SESSION-HANDOFF-2026-11-21.md` | SUPERSEDED HANDOFF — RETAIN | Handoff 21-11; baseline de TPV anterior a PRs posteriores y a TPV unified flow. |
| `qa/TPV-NATIVE-RECONCILIATION-ACCEPTANCE-2026-11-23.md` | SUPERSEDED ACCEPTANCE MATRIX — RETAIN | La aceptación funcional se consolida en `TPV-UNIFIED-FLOW` y el plan Runtime actual. |
| `qa/TPV-NATIVE-SESSION-CONTRACT-2026-11-23.md` | SUPERSEDED CONTRACT — RETAIN | Contrato de sesión previo a unificación y cambios posteriores; usar `TPV-UNIFIED-FLOW`. |
| `qa/TPV-ONLINE-TEST-READINESS-2026-11-25-SUPERSEDED.md` | EXPLICITLY SUPERSEDED — RETAIN | El propio documento declara que no es operativo; conservar como evidencia de transición #615/#616. |
| `qa/TPV-SYNTHETIC-FISCAL-ACCEPTANCE-2026-11-27-SUPERSEDED.md` | EXPLICITLY SUPERSEDED — RETAIN | El propio documento declara que no es autoridad operativa; contiene diseño fiscal sintético previo. No usar para habilitar writers ni modificar ledgers. |
| `qa/TPV-WIX-NATIVE-RECONCILIATION-AUDIT-2026-11-23.md` | HISTORICAL QA EVIDENCE — RETAIN | Evidencia de pruebas/lecturas de su fecha; no demuestra Runtime actual ni estado actual de Wix. Contrastar con `STATE-NOW` y tests actuales. |

### Referencias técnicas (3)

| Documento | Clasificación | Resultado y acción |
|---|---|---|
| `reference/DICCIONARIO_DATOS_CMS.md` | SUPERSEDED SCHEMA — RETAIN | Diccionario extenso con snapshots y addenda contradictorios; sustituido como esquema físico por `docs/ESQUEMA_CMS.md` (27-11). No usar campos/recuentos de este archivo para escribir/migrar. |
| `reference/DOSSIER-FLUJOS-CAPA-1-A-CAPA-3.md` | HISTORICAL FLOW DESIGN — RETAIN | Conservar como dossier de diseño y rationale E2E. Contiene snapshots y propuestas antiguas; no acredita implementación, tenant M365 ni estado Runtime. Contrastar con `PROJECT-CANON`, `STATE-NOW` y `RUNTIME-TEST-PLAN`. |
| `reference/WIX-CMS-SCHEMA-VERIFICATION-2026-11-23.md` | SUPERSEDED SCHEMA SNAPSHOT — RETAIN | Verificación del 23-11 sustituida por el snapshot más reciente `docs/ESQUEMA_CMS.md` (27-11). |

## Sustituciones documentales confirmadas

- Estado operativo y pendientes: `PROJECT-STATUS.md` del archivo → [`docs/STATE-NOW.md`](../../STATE-NOW.md).
- Plan y release gates: `MASTER-EXECUTION-PLAN.md` / estados antiguos → [`docs/RELEASE-READINESS.md`](../../RELEASE-READINESS.md).
- Entrada de conocimiento IA: `PROJECT-KNOWLEDGE-BASE.md` y dossier antiguo → [`docs/AI-ENTRYPOINT.md`](../../AI-ENTRYPOINT.md) + [`docs/AI-INDEX.md`](../../AI-INDEX.md).
- Arquitectura y autoridad: directrices/ADRs históricos → [`docs/PROJECT-CANON.md`](../../PROJECT-CANON.md) y directrices actuales del propietario.
- Flujo TPV: bridge, sesión, report implementation y aceptación antiguos → [`docs/TPV-UNIFIED-FLOW.md`](../../TPV-UNIFIED-FLOW.md), backend actual y tests.
- Esquema físico CMS: `DICCIONARIO_DATOS_CMS.md` y `WIX-CMS-SCHEMA-VERIFICATION-2026-11-23.md` → [`docs/ESQUEMA_CMS.md`](../../ESQUEMA_CMS.md), snapshot del 27-11-2026.
- Pruebas Runtime: checklists y especificaciones antiguas → [`tests/runtime/RUNTIME-TEST-PLAN.md`](../../../tests/runtime/RUNTIME-TEST-PLAN.md).
- Capa 3: auditoría 09-11 → [auditoría de preparación 27-11](../../audits/2026-11-27-capa3-export-preparation.md).

## Limpieza de seguridad documental

- Se retiró de `DOSSIER CONSOLIDADO.txt` un identificador de credencial y se sustituyó la instrucción insegura por una referencia a los almacenes autorizados de secretos.
- Se redactó el buzón personal del propietario en los documentos históricos donde aparecía. Las direcciones reservadas `example.test` se conservan cuando identifican fixtures sintéticas.
- No se ha modificado el código/configuración activa que contiene allowlists operativas. La limpieza se limita al archivo documental.
- El historial Git conserva versiones previas; esta limpieza evita que las copias actuales del archivo sigan exponiendo esos datos.

## Duplicidad y conservación

- No se detectaron archivos idénticos por SHA de blob dentro del árbol de archivo.
- Sí hay solapamiento semántico entre resúmenes, estados, handoffs, auditorías y ADR. Se resuelve mediante clasificación y enlaces a fuentes activas, no borrando documentos.
- No se han movido documentos: mantener rutas evita romper referencias históricas y enlaces de PR/issues.
- Ningún documento se eleva a fuente activa solo por conservar una decisión útil.

## Límites de esta pasada

- Se inspeccionaron los 161 documentos del árbol, su estructura, secciones y afirmaciones de estado/decisión relevantes.
- Esta pasada no vuelve a ejecutar las pruebas históricas, no verifica Wix Runtime, no reconsulta el CMS y no certifica el estado legal/fiscal de propuestas antiguas.
- No se ha realizado un análisis exhaustivo de cada enlace externo ni de cada SHA/PR citado dentro de los 161 documentos. Las referencias a GitHub/Wix se deben revalidar al usarlas.
- La ausencia de duplicados binarios exactos no descarta duplicidad semántica adicional.
