## Criterio GO (vinculante)

El release pasa a GO si y solo si:
1. Los 5 P0 tienen evidencia runtime PASS enlazada en esta tabla.
2. Cada evidencia PASS tiene fecha, ejecutor y JSON íntegro en RUNTIME-EVIDENCE-CHECKLIST.md.
3. CONFIG_SISTEMA_FISCAL existe en Wix CMS con datos legales verificados (F1 PASS).
4. Los flags LEDGER_WRITES_ENABLED y ACCOUNTING_LEDGER_WRITES_ENABLED siguen en false hasta la certificación legal del punto 3.
5. Las verificaciones CMS de #520 están todas PASS.

Cualquier otro estado es NO-GO. No hay GO parcial.

# Release Readiness

| Issue | Descripción (1 línea) | PR asociado | Evidencia runtime requerida (referencia a RUNTIME-EVIDENCE-CHECKLIST.md) | Estado evidencia | Responsable | Fecha |
|---|---|---|---|---|---|---|
| #416 (P0) | Caja, compensaciones pendientes y conciliación de pedidos POS. | #587 (merged) | P3 y P4; además conciliación/recovery de los casos #10032–#10034 fuera de esta checklist. | PENDIENTE | Propietario + QA | — |
| #415 / #209 (P0) | Maestro fiscal canónico y SIF/VERI*FACTU; el singleton real sigue ausente. | #589 (F5 + F1 reader validation, merged) | F1: contrato exacto en `docs/RUNTIME-EVIDENCE-CHECKLIST.md`; alta de datos legales verificados y lectura read-only. F5: prueba append-only del cierre Z en la misma checklist; código integrado en #589. Writers fiscales/contables siguen deshabilitados. | PENDIENTE | Propietario + asesoría fiscal | — |
| #525 (P0) | Concurrencia de apertura y proyección CajaActual. | #587 (merged) | P1. | PENDIENTE | QA | — |
| #434 (P0) | Discrepancia histórica de cinco filas en MovimientosCaja; no atribuible al código actual. | #590 (test de hardening, merged) | M1–M3 y M5 YA_CUMPLE: `data.js:530-536`, `dataAccessPolicy.js:110-115,154-208,241-260`, `dataAccess.js:350-408`, `tpvRepository.js:769-830`, `eventLog.js:431-465,513-540,789-880`, `data.hooks.test.mjs:275-280,694-722`, `dataAccess.writePolicy.test.mjs:129-194,251-319`. M4 pendiente: Wix Activity Logs/backups; auditoría `docs/archive/2026-11/audits/2026-11-23-movimientos-caja-count-drift.md:8-27,37-50,54-59`. | PENDIENTE | QA + propietario | — |
| #520 (P0) | Siete automatizaciones Wix PREINSTALLED siguen ACTIVE y protegidas; el flujo laboral APPLICATION está INACTIVE (revisión 5). | — (código YA_CUMPLE; sin control CMS desde backend) | CÓDIGO: no hay módulo Automation/Workflow/PREINSTALLED ni flag global de disable en `src/backend/`; `events.js`/`webhookEventClaims.js` reclaman eventos idempotentemente; `jobs.config` define jobs propios con `concurrencyPolicy=Forbid` y alertas; búsqueda `sendEmail`/`triggeredEmails` sin consumidor; `notifyOperationalAlert` registra alertas internas. No se añade kill-switch genérico porque podría descartar eventos/compensaciones legítimas y no controla Wix Automations. CMS: [ ] Dashboard → Automations → Manage Automations → PREINSTALLED trigger guardar tarjeta: PAUSED. [ ] PREINSTALLED tarea pendiente Agent Maker: PAUSED. [ ] PREINSTALLED notificación Aria: PAUSED. [ ] PREINSTALLED confirmación a miembros: PAUSED. [ ] PREINSTALLED confirmación de suscripción: PAUSED. [ ] PREINSTALLED límite CMS: PAUSED. [ ] PREINSTALLED restablecimiento de contraseña: PAUSED. PASS de estos siete solo si cada uno está PAUSED (último read-back: ACTIVE; `disableStatusChange=true`; no eludir el bloqueo). [ ] Abrir cada definición y verificar trigger, acción, destinatarios/alcance; PASS si no hay efectos externos no autorizados. [ ] Dashboard → Automations → History/Activity: revisar ejecuciones pendientes/en curso; PASS si no las hay ni existen efectos no aprobados. [ ] Dashboard → Apps → Manage Apps → Configuración de control laboral: verificar INACTIVE; PASS si sigue INACTIVE (último read-back: revisión 5). [ ] Revisar historial/ejecuciones de la app laboral; PASS si no hay tareas Agent Maker pendientes/activas. | PENDIENTE | Propietario + QA | — |
| #523 (P1) | Inconsistencias entre proyecciones CitasF2 y bookings nativos. | — | RUNTIME-EVIDENCE-CHECKLIST.md; revalidación Bookings y trazabilidad de ledger asociada. | PENDIENTE | QA | — |
| #522 (P1) | Diferencias entre flags de pago del catálogo y opciones nativas Bookings. | — | RUNTIME-EVIDENCE-CHECKLIST.md; validación de canales y checkout en Preview. | PENDIENTE | QA | — |
| #210 (P1) | Protección de main y obligatoriedad de checks. | — | RUNTIME-EVIDENCE-CHECKLIST.md; evidencia de rulesets/branch protection y checks requeridos. | PENDIENTE | Propietario | — |
| #435 (P1) | Aislamiento y persistencia del TPV QA en Sandbox Wix. | #587 (merged; cobertura parcial P1–P4 TPV) | P1, P3 y P4; evidencia específica de aislamiento Sandbox de #435. | PENDIENTE | QA | — |

P0: 0 con evidencia PASS / 5 pendientes.

P1: 0 con evidencia PASS / 4 pendientes.

Decisión preliminar: NO-GO hasta que todos los P0 estén PASS.

Regla dura: "Sin evidencia runtime enlazada = NO-GO automático del ítem".

## TPV PERSONAL — control de implementación (24/11/2026)

- **PR #592 — MERGED:** contratos de respuesta de movimiento, sesión activa y persistencia parcial explícita. Si el ledger append-only queda persistido y falla la proyección, la respuesta conserva `persisted=true`, el identificador del movimiento y el estado de proyección no confirmado.
- **PR #600 — MERGED:** retirada de escrituras TPV sintéticas, aislamiento de registros históricos y cierre fail-closed de las escrituras operativas. Merge commit: 7ffca8c4ceeea2af9be5bf0a697af15283ab214b. El código validado en el head de PR 5099dad7d3c091dae6c5901b5600b47086b85ed8 obtuvo Backend offline quality gates SUCCESS (run 45443104056) y Gitleaks full-history SUCCESS (run 45443104106).
- Las barreras de inserción de `dataAccessPolicy.js` y el hook `data.js` rechazan nuevos discriminadores TPV y los discriminadores históricos declarados en `TPV_LEGACY_EVENT_MOVEMENT_TYPES`. Los registros CMS existentes no se modifican.
- `tpvUtils.toMinorUnits()` y el controlador de página rechazan importes cuyo valor en céntimos no sea un entero seguro; la suite incorpora casos de desbordamiento.
- La capacidad `registerPartialCount` es independiente de `registerCashMovement`; el widget exige tanto la capacidad específica como `operationalWritesAvailable=true` antes de habilitar controles de escritura.
- Los errores desconocidos del controlador dejan de ser reintentables automáticamente y requieren consultar el estado/conciliar antes de repetir.
- `tpvCatalogo.web.js` ya no usa el precio mínimo como precio de una línea vendible: el widget resuelve siempre la variante concreta mediante Catalog V3 `getProduct`, usa su `actualPrice` y exige `variantId`; una única variante se selecciona automáticamente y varias requieren elección explícita.
- La disponibilidad de variante es fail-closed: solo se acepta `inStock === true` o `preorderEnabled === true`; un estado ausente no se interpreta como stock disponible. La consulta actual sigue limitada al estado de la variante/devuelve default location; la disponibilidad multiubicación requiere Inventory Items V3.
- La lectura histórica permanece separada de los cálculos operativos; no se deben incorporar registros históricos sintéticos a ventas, pagos, caja, X o Z.
- **CI:** PASS en el head de código `5099dad7d3c091dae6c5901b5600b47086b85ed8`: Backend offline quality gates SUCCESS (run `45443104056`) y Gitleaks full-history SUCCESS (run `45443104106`). El pipeline completó dependencias, auditoría, Layer 1, Layer 2, suite offline completa, verificaciones SDK de Cart/Transactions/TPV y ESLint. El commit documental posterior no modifica código; su CI queda separado de esta evidencia.
- **Runtime:** Wix Preview/Runtime, pruebas de escritura CMS y pagos/devoluciones nativos no ejecutados. El merge de #600 no autoriza despliegue ni apertura de escrituras; el estado operativo continúa NO-GO.

**Decisión TPV: NO-GO operativo.** Se permite continuar revisión y pruebas offline; las escrituras permanecen cerradas hasta que el contrato canónico, la integración nativa y las pruebas requeridas estén demostrados.
