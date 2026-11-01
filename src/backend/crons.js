/*
=============================================================================
MODULE: backend/crons.js
VERSION: v5011-CRON-PARITY
BASE: v5010-TELEMETRY-ATOMIC + correcciones auditoria P0 (jobs huerfanos)
RESPONSIBILITY: Jobs programados (cron). 9 jobs wired en jobs.config + 2 de
reconciliacion interna (reconcileUnknownTransactions / InconsistentDualPairs).
STANDARDS: G10 ASCII Strict. Cero suppressAuth. Cero COLLECTIONS alias.

CORRECCIONES v5011-CRON-PARITY:
AUDIT-NZ-01 (P0): verifyNightlyZClosing implementado (declurado en
jobs.config sin export -> fallo PARITY-01/02). Idempotente por lectura Z_<dia>,
intento de cierre automatico via SSOT cajas.web, aviso ALERT deduplicado por
el notificador central backend/audit.js si se requiere accion humana. No lanza
al scheduler (condicion no recuperable).
AUDIT-WEBHOOK-01 (P0): cleanAuditLogs implementado (declurado sin export).
Purga solo ALERT terminales (CLOSED/RESOLVED) y COMPENSATION terminales
(EXECUTED/FAILED/CLOSED) pasados AUDIT_RETENTION_DAYS. WEBHOOK_EVENT JAMAS
(ADR-05 append-only, doble filtro defensivo).
CRON-P2-01 (P1): systemHealthCheck referenciaba
BUSINESS_COLLECTIONS.MAPA_STAFF (clave inexistente en internalConfig v12 ->
undefined -> query a coleccion fantasma). Sustituido por HISTORICO_CIERRES_Z.

CORRECCIONES v5010-TELEMETRY-ATOMIC:
CRON-07 (P0): Reemplazo COLLECTIONS por BUSINESS_COLLECTIONS y
OPERATIONAL_COLLECTIONS (internalConfig v12).
CRON-08 (P0): Migración completa a backend/dataAccess. Cero wixData directo.
Cero suppressAuth. Lecturas con consistencyMode:"strong".
CRON-09 (P2): Contadores precisos: solo incrementan tras éxito confirmado.
CRON-10 (P2): Retorno de removed, failed y muestras de errores.
CRON-11 (P1): Nuevo job reconcileUnknownTransactions para reconciliar
transacciones RESULT_UNKNOWN de bookingSaga.
CRON-12 (P1): Nuevo job reconcileInconsistentDualPairs para reconciliar
pares duales marcados como DUAL_INCONSISTENT.
CRON-13 (P1): Nuevo job retryCompletionRequired para reintentar
_completeTransaction en transacciones COMPLETION_RETRY_REQUIRED.
CRON-14 (P2): Eliminación de referencia a COLLECTIONS.ALERTAS_OPERATIVAS
(no existe en internalConfig v12).

FIXES HEREDADOS v5009-FISCAL-V20.1: CRON-01..CRON-06.
PENDIENTES:
- Mantener paridad crons.js/jobs.config mediante CRON-PARITY-01.
- Verificar operaciones de dataAccess en CI y runtime QA.
=============================================================================
*/
import { query as dalQuery, getItem as dalGet, insertItem as dalInsert, updateItem as dalUpdate, removeById as dalRemove, bulkRemove as dalBulkRemove } from "backend/dataAccess";
import { _completeTransaction } from "backend/booking/bookingCore";
import { bookings } from "@wix/bookings";
import { auth } from "@wix/essentials";
import {
BUSINESS_COLLECTIONS,
OPERATIONAL_COLLECTIONS,
CONTROL_TYPE,
CONTROL_STATUS,
COMPENSATION_STATUS,
CONCURRENCY,
SDK_CONFIG,
normalizeBookingType,
BOOKING_TYPE,
} from "backend/internalConfig";
import { makeTraceId, _safeTrim, _looksLikeGuid, withTimeout } from "public/mmUtils";
import { readControlPayload } from "backend/data";
import { logger } from "backend/logger";
import { notifyOperationalAlert } from "backend/audit";
import { verifyFiscalHashChainIntegrity } from "backend/cajas.web";
import { cancelBookingElevated } from "backend/booking/bookingCore";
import { reconcileUnknownTransaction } from "backend/events";

const log = logger;
const API_TIMEOUT_MS =
Number(SDK_CONFIG?.TIMEOUTS?.API_MS) || 15000;
const MAX_COMPENSATION_ATTEMPTS =
Math.max(1, Number(CONCURRENCY?.MAX_COMPENSATION_RETRIES) || 3);
// CRON-P2-01: MapaStaff es coleccion MUERTA (internalConfig v12.1-SSOT
// PEND-DAL: staff.js v9 lee exclusivamente de la Bookings Staff API).
// Retirada de criticalCols en systemHealthCheck: referenciar una clave
// inexistente devolvia undefined -> query a coleccion vacia y contaje
// erroneo "accessible:true".
// AUDIT-NZ-01 / AUDIT-WEBHOOK-01: unicos controlTypes purgables por
// cleanAuditLogs. WEBHOOK_EVENT es ledger append-only (ADR-05): NUNCA se
// purgea desde el cron, ni aunque llegue a estado terminal.
// [CRON-AUDIT-01] ALERT nace con status OPEN (estado vivo: crons.inserta
// NIGHTLY_Z_CLOSING_MANUAL_REQUIRED y alertas operativas con OPEN). OPEN es
// estado vivo NO purgable. Formas terminales de alerta tras resolucion:
// CLOSED y RESOLVED (ambas registran cierre explicito) -> elegibles para
// purga por retencion junto a COMPENSATION EXECUTED/FAILED.
const PURGABLE_TERMINAL_ALERT_STATUSES = [CONTROL_STATUS.CLOSED, CONTROL_STATUS.RESOLVED];
const AUDIT_RETENTION_DAYS =
Math.max(30, Number(SDK_CONFIG?.JOBS?.AUDIT_RETENTION_DAYS) || 90);

// CRON-08: elevatedGet para reconciliación
const getBookingElevated = auth.elevate(bookings.getBooking);

// =============================================================================
// CRON 1: cleanExpiredLocks - 15 * * * *
// =============================================================================
/**
* CRON-09/10: contadores precisos. Solo incrementa tras éxito confirmado.
* Retorna removed, failed y muestras de errores.
*/
export async function cleanExpiredLocks() {
const traceId = makeTraceId("cron-locks");
const result = { removed: 0, failed: 0, errors: [] };

try {
const now = new Date();
const res = await dalQuery(OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO)
.eq("controlType", CONTROL_TYPE.SLOT_LOCK)
.lt("expiresAt", now)
.limit(100)
.find({ consistencyMode: "strong" });

for (const item of res?.items || []) {
try {
await dalRemove(OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO, item._id);
result.removed++;
} catch (removeError) {
result.failed++;
if (result.errors.length < 5) {
result.errors.push({
id: item._id,
error: removeError?.message || "UNKNOWN",
});
}
log.warn("cleanExpiredLocks: remove failed", {
lockId: item._id,
error: removeError?.message,
traceId,
});
}
}

log.info("cleanExpiredLocks completed", {
removed: result.removed,
failed: result.failed,
traceId,
});
} catch (err) {
log.error("cleanExpiredLocks failed", { error: err?.message, traceId });
result.errors.push({ query: "main", error: err?.message });
}

return result;
}

// =============================================================================
// CRON: cleanExpiredRateLimits - every 5 minutes
// =============================================================================
/**
 * Purges only expired RATE_LIMIT rows. The server-side condition is repeated
 * on bulkRemove so a row renewed by a concurrent request is not deleted.
 */
export async function cleanExpiredRateLimits() {
const traceId = makeTraceId("cron-rate-limits");
const result = { removed: 0, skipped: 0, failed: 0, errors: [] };

try {
const now = new Date();
const collection = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
const res = await dalQuery(collection)
.eq("controlType", CONTROL_TYPE.RATE_LIMIT)
.lt("expiresAt", now)
.limit(500)
.find({ consistencyMode: "strong" });

const ids = (res?.items || []).map((item) => item._id).filter(Boolean);
if (ids.length > 0) {
const removal = await dalBulkRemove(collection, ids, {
condition: {
filter: {
controlType: { $eq: CONTROL_TYPE.RATE_LIMIT },
expiresAt: { $lt: now },
},
},
});
result.removed = Number(removal?.removed) || 0;
result.skipped = Number(removal?.skipped) || 0;
result.failed = Array.isArray(removal?.errors) ? removal.errors.length : 0;
result.errors = (removal?.errors || []).slice(0, 5).map((error) => ({
id: error?.item || null,
code: error?.code || "REMOVE_FAILED",
error: error?.message || "UNKNOWN",
}));
}

log.info("cleanExpiredRateLimits completed", {
removed: result.removed,
skipped: result.skipped,
failed: result.failed,
traceId,
});
} catch (err) {
log.error("cleanExpiredRateLimits failed", { error: err?.message, traceId });
result.failed += 1;
result.errors.push({ query: "main", error: err?.message || "UNKNOWN" });
}

return result;
}

// =============================================================================
// CRON 2: cleanupExpiredDualCache - 20 * * * *
// =============================================================================
/**
* CRON-09/10: contadores precisos. Solo incrementa tras éxito confirmado.
*/
export async function cleanupExpiredDualCache() {
const traceId = makeTraceId("cron-dual-cache");
const result = { removed: 0, failed: 0, errors: [] };

try {
const now = new Date();
const limit =
Number(SDK_CONFIG?.JOBS?.DUAL_CACHE_CLEANUP_LIMIT) || 100;
const res = await dalQuery(OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO)
.eq("controlType", CONTROL_TYPE.DUAL_CACHE)
.lt("expiresAt", now)
.limit(limit)
.find({ consistencyMode: "strong" });

for (const item of res?.items || []) {
try {
await dalRemove(OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO, item._id);
result.removed++;
} catch (removeError) {
result.failed++;
if (result.errors.length < 5) {
result.errors.push({
id: item._id,
error: removeError?.message || "UNKNOWN",
});
}
log.warn("cleanupExpiredDualCache: remove failed", {
cacheId: item._id,
error: removeError?.message,
traceId,
});
}
}

log.info("cleanupExpiredDualCache completed", {
removed: result.removed,
failed: result.failed,
traceId,
});
} catch (err) {
log.error("cleanupExpiredDualCache failed", {
error: err?.message,
traceId,
});
result.errors.push({ query: "main", error: err?.message });
}

return result;
}

// =============================================================================
// CRON 3: runPendingCompensationsJob - 30 * * * *
// =============================================================================
async function _runOneCompensation(comp, traceId) {
const payload = readControlPayload(comp);
const kind = _safeTrim(payload.compensationKind || payload.kind).toUpperCase();
const bookingId = _safeTrim(payload.bookingId || comp?.bookingId);

// CajaActual es una proyeccion incremental, no una fuente contable.
// Reaplicar el movimiento podria duplicar el saldo; hasta disponer de una
// reconciliacion canonica con control de concurrencia, se deriva a revision
// manual y se excluye de los reintentos automaticos.
if (kind === "RESYNC_CAJA_BALANCE") {
return {
ok: false,
manualReconciliationRequired: true,
action: kind,
reason: "CajaActual requiere conciliacion contra MovimientosCaja; no aplicar incrementos automaticamente",
};
}

if (kind === "CANCEL_BOOKING") {
if (!bookingId || !_looksLikeGuid(bookingId)) {
throw new Error("CANCEL_BOOKING requires a valid bookingId GUID");
}
const revision = Number(payload.revision || comp?.revision);
if (!Number.isInteger(revision) || revision < 1) {
throw new Error("CANCEL_BOOKING requires a valid revision; manual reconciliation required");
}
await withTimeout(
() =>
cancelBookingElevated(bookingId, {
revision: String(revision),
// CRON-08: cero suppressAuth. auth.elevate ya eleva.
}),
API_TIMEOUT_MS,
"cron:cancelBookingCompensation"
);
return { ok: true, action: "CANCEL_BOOKING", bookingId };
}

if (kind === "FISCAL_LEDGER" || kind === "RESYNC_LEDGER_ACCOUNTING") {
try {
const { registerBookingPayment } = await import("backend/cajas.web");
const amount = Number(payload.totalAmount || comp?.totalAmount);
const hasAmount = Number.isFinite(amount) && amount !== 0;
const transactionId = _safeTrim(payload.transactionId || comp?.transactionId);
const bookingIds = payload.bookingIds || payload.bookingId || comp?.bookingIds || comp?.bookingId || null;

if (kind === "FISCAL_LEDGER" && hasAmount && transactionId) {
const result = await withTimeout(
() =>
registerBookingPayment(bookingIds, amount, payload.paymentMethod || "WIX_PAYMENTS", {
operationDescription: payload.operationDescription || "Fiscal recovery retry",
transactionId: transactionId,
orderId: payload.orderId || null,
refundId: payload.refundId || null,
tipoMovimiento: payload.movementType || null,
origen: "CRON_FISCAL_RECOVERY",
resourceId: "online",
traceId: traceId,
}),
API_TIMEOUT_MS,
"cron:fiscalLedgerRecovery"
);
if (result?.status === "SUCCESS") {
return { ok: true, action: kind, transactionId };
}
throw new Error(
(result && result.error && result.error.message) ||
"FISCAL_LEDGER recovery returned non-SUCCESS"
);
}
throw new Error(
kind +
" requires manual or extended processor (payload incomplete or RESYNC)"
);
} catch (err) {
throw err;
}
}

throw new Error(`Unsupported compensation kind: ${kind || "UNKNOWN"}`);
}

/**
* CRON-09/10: contadores precisos. Solo incrementa tras éxito confirmado.
* CRON-14: eliminada referencia a COLLECTIONS.ALERTAS_OPERATIVAS.
*/
export async function runPendingCompensationsJob() {
const traceId = makeTraceId("cron-comp");
const result = { processed: 0, failed: 0, manualRequired: 0, errors: [] };

try {
const batchSize =
Number(SDK_CONFIG?.JOBS?.FISCAL_RECOVERY_BATCH_SIZE) || 25;
const statuses = ["PENDING", "RETRYING", "PENDING_RECOVERY"];

const queryResults = await Promise.all(
statuses.map((status) =>
dalQuery(OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO)
.eq("controlType", CONTROL_TYPE.COMPENSATION)
.eq("status", status)
.lt("attempts", MAX_COMPENSATION_ATTEMPTS)
.limit(batchSize)
.find({ consistencyMode: "strong" })
)
);

const seenIds = new Set();
const compensationItems = queryResults
.flatMap((res) => res?.items || [])
.filter((item) => {
if (!item?._id || seenIds.has(item._id)) return false;
seenIds.add(item._id);
return true;
})
.sort((a, b) =>
new Date(a?._createdDate || 0).getTime() -
new Date(b?._createdDate || 0).getTime()
)
.slice(0, batchSize);

for (const comp of compensationItems) {
try {
const outcome = await _runOneCompensation(comp, traceId);
const payload = readControlPayload(comp);
if (outcome?.manualReconciliationRequired === true) {
payload.status = "MANUAL_RECONCILIATION_REQUIRED";
payload.compensationStatus = "MANUAL_RECONCILIATION_REQUIRED";
payload.lastError = outcome.reason || "Manual reconciliation required";
payload._updatedDate = new Date();
await dalUpdate(OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO, {
...comp,
status: "MANUAL_RECONCILIATION_REQUIRED",
attempts: Number(payload.attempts || comp.attempts || 0),
payload,
});
result.manualRequired++;
log.error("runPendingCompensationsJob: manual reconciliation required", {
compId: comp._id,
kind: payload.compensationKind || payload.kind,
reason: payload.lastError,
traceId,
});
continue;
}
payload.status = COMPENSATION_STATUS.EXECUTED;
payload.compensationStatus = COMPENSATION_STATUS.EXECUTED;
payload.lastError = null;
payload._updatedDate = new Date();
await dalUpdate(OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO, {
...comp,
status: COMPENSATION_STATUS.EXECUTED,
attempts: Number(payload.attempts || comp.attempts || 0),
payload,
});
result.processed++;
} catch (compErr) {
const payload = readControlPayload(comp);
const attempts = Number(payload.attempts ?? comp.attempts ?? 0) + 1;
payload.attempts = attempts;
payload.lastError = compErr?.message || "UNKNOWN";
payload.status =
attempts >= MAX_COMPENSATION_ATTEMPTS ? "FAILED" : "RETRYING";
payload._updatedDate = new Date();

try {
await dalUpdate(OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO, {
...comp,
status: payload.status,
attempts,
payload,
});
} catch (updateError) {
log.error("runPendingCompensationsJob: update failed", {
compId: comp._id,
error: updateError?.message,
traceId,
});
}

result.failed++;
if (result.errors.length < 10) {
result.errors.push({
compId: comp._id,
error: compErr?.message || "UNKNOWN",
});
}

// CRON-14: eliminada inserción en COLLECTIONS.ALERTAS_OPERATIVAS
// (no existe en internalConfig v12). Solo log.
if (payload.status === "FAILED") {
log.error("CRON-14: compensation failed permanently", {
compId: comp._id,
kind: payload.compensationKind || payload.kind,
error: payload.lastError,
traceId,
});
}
}
}

log.info("runPendingCompensationsJob completed", {
processed: result.processed,
failed: result.failed,
manualRequired: result.manualRequired,
traceId,
});
} catch (err) {
log.error("runPendingCompensationsJob failed", {
error: err?.message,
traceId,
});
result.errors.push({ query: "main", error: err?.message });
}

return result;
}

// =============================================================================
// CRON 4: cleanExpiredDaysCache - 0 1 * * *
// =============================================================================
/**
* CRON-09/10: contadores precisos. Solo incrementa tras éxito confirmado.
*/
export async function cleanExpiredDaysCache() {
const traceId = makeTraceId("cron-days-cache");
const result = { removed: 0, failed: 0, errors: [] };

try {
const now = new Date();
const res = await dalQuery(OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO)
.eq("controlType", CONTROL_TYPE.DAYS_CACHE)
.lt("expiresAt", now)
.limit(200)
.find({ consistencyMode: "strong" });

for (const item of res?.items || []) {
try {
await dalRemove(OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO, item._id);
result.removed++;
} catch (removeError) {
result.failed++;
if (result.errors.length < 5) {
result.errors.push({
id: item._id,
error: removeError?.message || "UNKNOWN",
});
}
log.warn("cleanExpiredDaysCache: remove failed", {
cacheId: item._id,
error: removeError?.message,
traceId,
});
}
}

log.info("cleanExpiredDaysCache completed", {
removed: result.removed,
failed: result.failed,
traceId,
});
} catch (err) {
log.error("cleanExpiredDaysCache failed", {
error: err?.message,
traceId,
});
result.errors.push({ query: "main", error: err?.message });
}

return result;
}

// =============================================================================
// CRON 6: systemHealthCheck - 0 7 * * *
// =============================================================================
/**
* CRON-14: eliminada inserción en COLLECTIONS.ALERTAS_OPERATIVAS.
* Solo log de issues.
*/
export async function systemHealthCheck() {
const traceId = makeTraceId("cron-health");
const result = {
timestamp: new Date().toISOString(),
collections: {},
fiscalChain: null,
secrets: {},
issues: [],
};

try {
// CRON-P2-01: MAPA_STAFF retirado (no existe en internalConfig v12; la
// coleccion esta muerta - staff.js v9 usa Bookings Staff API).
const criticalCols = [
BUSINESS_COLLECTIONS.CITAS_F2,
BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA,
BUSINESS_COLLECTIONS.HISTORICO_CIERRES_Z,
OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO,
];

for (const col of criticalCols) {
try {
const count = await dalQuery(col).limit(1).count();
result.collections[col] = { accessible: true, count };
} catch (err) {
result.collections[col] = { accessible: false, count: 0 };
result.issues.push({
type: "COLLECTION_INACCESSIBLE",
collection: col,
error: err?.message,
});
}
}

try {
const chainResult = await verifyFiscalHashChainIntegrity({
traceId,
limit: 100,
});
result.fiscalChain = chainResult.status;
if (chainResult.status !== "SUCCESS") {
result.issues.push({
type: "FISCAL_CHAIN_BROKEN",
status: chainResult.status,
});
}
} catch (err) {
result.fiscalChain = "ERROR";
result.issues.push({
type: "FISCAL_CHAIN_CHECK_FAILED",
error: err?.message,
});
}

log.info("systemHealthCheck completed", { result, traceId });

// CRON-14: eliminada inserción en COLLECTIONS.ALERTAS_OPERATIVAS
if (result.issues.length > 0) {
log.error("CRON-14: systemHealthCheck detected issues", {
issues: result.issues,
traceId,
});
}
} catch (err) {
log.error("systemHealthCheck failed", { error: err?.message, traceId });
result.issues.push({
type: "HEALTH_CHECK_FAILED",
error: err?.message,
});
}

return result;
}

// =============================================================================
// CRON 11: reconcileUnknownTransactions - 45 * * * * (NUEVO)
// =============================================================================
/**
* CRON-11: reconcilia transacciones RESULT_UNKNOWN de bookingSaga.
* Busca en ControlOperativo transacciones con status RESULT_UNKNOWN
* y llama a events.reconcileUnknownTransaction para verificar si
* la reserva se creó realmente en Bookings.
*/
export async function reconcileUnknownTransactions() {
const traceId = makeTraceId("cron-reconcile-unknown");
const result = { processed: 0, reconciled: 0, failed: 0, errors: [] };

try {
const res = await dalQuery(OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO)
.eq("controlType", CONTROL_TYPE.IDEMPOTENCY)
.limit(50)
.find({ consistencyMode: "strong" });

for (const tx of res?.items || []) {
try {
const payload = readControlPayload(tx);
if (payload.status !== "RESULT_UNKNOWN") continue;

result.processed++;
const reconciliation = await reconcileUnknownTransaction(tx._id, traceId);

if (reconciliation.ok) {
if (reconciliation.reconciled) {
result.reconciled++;
} else {
result.failed++;
if (result.errors.length < 10) {
result.errors.push({
pairToken: tx._id,
reason: reconciliation.reason || "UNKNOWN",
});
}
}
} else {
result.failed++;
if (result.errors.length < 10) {
result.errors.push({
pairToken: tx._id,
reason: reconciliation.reason || "RECONCILIATION_FAILED",
});
}
}
} catch (txError) {
result.failed++;
if (result.errors.length < 10) {
result.errors.push({
pairToken: tx._id,
error: txError?.message || "UNKNOWN",
});
}
log.warn("reconcileUnknownTransactions: tx failed", {
pairToken: tx._id,
error: txError?.message,
traceId,
});
}
}

log.info("reconcileUnknownTransactions completed", {
processed: result.processed,
reconciled: result.reconciled,
failed: result.failed,
traceId,
});
} catch (err) {
log.error("reconcileUnknownTransactions failed", {
error: err?.message,
traceId,
});
result.errors.push({ query: "main", error: err?.message });
}

return result;
}

// =============================================================================
// CRON 12: reconcileInconsistentDualPairs - 50 * * * * (NUEVO)
// =============================================================================
/**
* CRON-12: reconcilia pares duales marcados como DUAL_INCONSISTENT.
* Busca en ControlOperativo flags con reason DUAL_INCONSISTENT
* y verifica el estado real de F1/F2 en Bookings y CMS.
*/
export async function reconcileInconsistentDualPairs() {
const traceId = makeTraceId("cron-reconcile-dual");
const result = { processed: 0, reconciled: 0, failed: 0, errors: [] };

try {
const res = await dalQuery(OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO)
.eq("controlType", CONTROL_TYPE.SYSTEM_FLAG)
.limit(50)
.find({ consistencyMode: "strong" });

for (const flag of res?.items || []) {
try {
const payload = readControlPayload(flag);
if (payload.reason !== "DUAL_INCONSISTENT" &&
payload.status !== "REPAIR_REQUIRED") continue;

result.processed++;
const pairToken = _safeTrim(payload.pairToken || flag?.pairToken);

if (!pairToken) {
result.failed++;
continue;
}

// Consultar CitasF2 para verificar estado del par
const citas = await dalQuery(BUSINESS_COLLECTIONS.CITAS_F2)
.eq("pairToken", pairToken)
.limit(10)
.find({ consistencyMode: "strong" });

// SSOT-KEYFIELD v13: canon DUAL_F1/DUAL_F2; normalizeBookingType promueve
// docs historicos escritos con la ID legacy DUALF1/DUALF2.
const f1Cita = citas?.items?.find(c =>
normalizeBookingType(c.bookingType) === BOOKING_TYPE.DUAL_F1 || !c.meta?.linkedF1BookingId
);
const f2Cita = citas?.items?.find(c =>
normalizeBookingType(c.bookingType) === BOOKING_TYPE.DUAL_F2 || c.meta?.linkedF1BookingId
);

if (!f1Cita || !f2Cita) {
log.warn("reconcileInconsistentDualPairs: missing cita", {
pairToken,
hasF1: !!f1Cita,
hasF2: !!f2Cita,
traceId,
});
result.failed++;
continue;
}

// Verificar estado en Bookings
let f1Exists = false;
let f2Exists = false;

try {
const f1Booking = await withTimeout(
getBookingElevated(f1Cita.bookingId),
API_TIMEOUT_MS,
"getBookingF1"
);
f1Exists = !!f1Booking?.booking?.id;
} catch (_) {}

try {
const f2Booking = await withTimeout(
getBookingElevated(f2Cita.bookingId),
API_TIMEOUT_MS,
"getBookingF2"
);
f2Exists = !!f2Booking?.booking?.id;
} catch (_) {}

// Si ambas existen en Bookings, marcar como reconciliado
if (f1Exists && f2Exists) {
const updatedPayload = {
...payload,
status: "RECONCILED",
reconciledAt: new Date().toISOString(),
f1Exists,
f2Exists,
};
await dalUpdate(OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO, {
...flag,
payload: updatedPayload,
});
result.reconciled++;
log.info("reconcileInconsistentDualPairs: reconciled", {
pairToken,
traceId,
});
} else {
result.failed++;
if (result.errors.length < 10) {
result.errors.push({
pairToken,
f1Exists,
f2Exists,
reason: "BOOKING_MISSING",
});
}
log.warn("reconcileInconsistentDualPairs: booking missing", {
pairToken,
f1Exists,
f2Exists,
traceId,
});
}
} catch (flagError) {
result.failed++;
if (result.errors.length < 10) {
result.errors.push({
flagId: flag._id,
error: flagError?.message || "UNKNOWN",
});
}
log.warn("reconcileInconsistentDualPairs: flag failed", {
flagId: flag._id,
error: flagError?.message,
traceId,
});
}
}

log.info("reconcileInconsistentDualPairs completed", {
processed: result.processed,
reconciled: result.reconciled,
failed: result.failed,
traceId,
});
} catch (err) {
log.error("reconcileInconsistentDualPairs failed", {
error: err?.message,
traceId,
});
result.errors.push({ query: "main", error: err?.message });
}

return result;
}

// =============================================================================
// CRON 7: verifyNightlyZClosing - 30 2 * * * (AUDIT-NZ-01, P0 parity)
// =============================================================================
/**
* AUDIT-NZ-01 (P0): Declurado en jobs.config pero NO implementado (la suite
* crons.jobsConfigParity fallaba en PARITY-01/02). Verifica que el dia natural
* anterior (Europe/Madrid) tiene cierre Z firmado o pendiente de firma.
* Estrategia fail-open para el runner (no lanza: evitaria reintentos infinitos
* del scheduler por condicion que requiere accion humana) y fail-closed para
* la trazabilidad: si falta el Z Y no se puede ni verificar/crear, se levanta
* una ALERT deduplicada NIGHTLY_Z_CLOSING_MANUAL_REQUIRED en ControlOperativo.
* Idempotencia: si el Z ya existe (cierre manual del cajero), sale sin alertar.
*/
export async function verifyNightlyZClosing() {
const traceId = makeTraceId("cron-nightly-z");
const result = { checkedDate: null, closed: false, alerted: false, errors: [] };

try {
const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: SDK_CONFIG?.TZ || "Europe/Madrid" })
.format(new Date(Date.now() - 24 * 60 * 60 * 1000));
result.checkedDate = ymd;

// 1) Verificacion por lectura directa (fuerte): el id canonico es Z_<fecha>.
const zId = `Z_${ymd}`;
let existingZ = null;
try {
existingZ = await dalGet(BUSINESS_COLLECTIONS.HISTORICO_CIERRES_Z, zId);
} catch (readErr) {
result.errors.push({ stage: "readZ", error: readErr?.message || "UNKNOWN" });
}

if (existingZ) {
result.closed = true;
log.info("verifyNightlyZClosing: day already closed", {
checkedDate: ymd,
closingStatus: existingZ.closingStatus,
signature: existingZ.closingSignatureStatus,
traceId,
});
return result;
}

// 2) Cierre por la entrada interna del backend. El cron no tiene sesion
//    interactiva: no debe invocar el webMethod protegido para cajeros.
//    La entrada interna comparte la misma logica fiscal y no se expone al frontend.
try {
const { registerZClosingInternal } = await import("backend/cajas.web");
const closing = await withTimeout(
() => registerZClosingInternal(ymd, { traceId }),
API_TIMEOUT_MS,
"cron:registerZClosing"
);
if (closing?.status === "SUCCESS") {
result.closed = true;
log.info("verifyNightlyZClosing: automated Z created", { checkedDate: ymd, traceId });
return result;
}
// Z_ALREADY_CLOSED => verificacion por carrera: otro proceso cerro el dia.
if (closing?.error?.code === "Z_ALREADY_CLOSED") {
result.closed = true;
return result;
}
result.errors.push({ stage: "autoClose", code: closing?.error?.code || "NON_SUCCESS" });
} catch (closeErr) {
// ACCESS_DENIED / NO_MOVEMENTS esperables en cron; NO lanzar: accion humana.
result.errors.push({ stage: "autoClose", error: closeErr?.message || "UNKNOWN" });
}

// 3) Dia sin cerrar y sin posibilidad de cierre automatico => ALERT
//    deduplicada (una por fecha) en ControlOperativo.
const alert = await notifyOperationalAlert({
alertType: "NIGHTLY_Z_CLOSING_MANUAL_REQUIRED",
severity: "WARN",
message: "Cierre diario pendiente de revisión manual.",
data: { operationDate: ymd, actionRequired: "CREATE_OR_REVIEW_Z_CLOSING" },
traceId,
entityId: ymd,
source: "backend/crons.js",
dedupeKey: `NIGHTLY_Z_CLOSING_${ymd}`,
operationDate: ymd,
});
result.alerted = Boolean(alert?.created);

log.warn("verifyNightlyZClosing: manual Z required", {
checkedDate: ymd,
alerted: result.alerted,
traceId,
});
} catch (err) {
log.error("verifyNightlyZClosing failed", { error: err?.message, traceId });
result.errors.push({ query: "main", error: err?.message });
}

return result;
}

// =============================================================================
// CRON 8: cleanAuditLogs - 0 3 * * 0 (AUDIT-WEBHOOK-01, P0 parity)
// =============================================================================
/**
* AUDIT-WEBHOOK-01 (P0): Declurado en jobs.config pero NO implementado.
* Purga exclusivamente filas TERMINALES de retencion vencida:
*  - ALERT con status CLOSED/RESOLVED y _createdDate > ventana de retencion.
*  - COMPENSATION con status EXECUTED/FAILED/CLOSED y _createdDate > ventana.
* NUNCA purga WEBHOOK_EVENT (ledger append-only, ADR-05; ademas el hook
* ControlOperativo_beforeRemove lo bloquea en runtime real). SLOT_LOCK y
* caches tienen su propio ciclo de vida (cleanExpiredLocks/DualCache/DaysCache)
* y quedan fuera de este job.
*/
export async function cleanAuditLogs() {
const traceId = makeTraceId("cron-audit-purge");
const result = { removed: 0, failed: 0, skippedLedger: 0, errors: [] };

try {
const cutoff = new Date(Date.now() - AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
const C = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;

const terminalCompensationStatuses = [
CONTROL_STATUS.EXECUTED,
CONTROL_STATUS.FAILED,
];

const queryResults = await Promise.all([
...PURGABLE_TERMINAL_ALERT_STATUSES.map((status) =>
dalQuery(C)
.eq("controlType", CONTROL_TYPE.ALERT)
.eq("status", status)
.lt("_createdDate", cutoff)
.limit(200)
.find({ consistencyMode: "strong" })
),
...terminalCompensationStatuses.map((status) =>
dalQuery(C)
.eq("controlType", CONTROL_TYPE.COMPENSATION)
.eq("status", status)
.lt("_createdDate", cutoff)
.limit(200)
.find({ consistencyMode: "strong" })
),
]);

const seenIds = new Set();
const candidates = queryResults
.flatMap((res) => res?.items || [])
.filter((item) => {
if (!item?._id || seenIds.has(item._id)) return false;
seenIds.add(item._id);
// Doble red de seguridad ADR-05: jamas purgar el ledger webhook.
if (item.controlType === CONTROL_TYPE.WEBHOOK_EVENT) {
result.skippedLedger++;
return false;
}
return true;
});

for (const item of candidates) {
try {
await dalRemove(C, item._id);
result.removed++;
} catch (removeError) {
result.failed++;
if (result.errors.length < 5) {
result.errors.push({ id: item._id, error: removeError?.message || "UNKNOWN" });
}
log.warn("cleanAuditLogs: remove failed", {
id: item._id,
error: removeError?.message,
traceId,
});
}
}

log.info("cleanAuditLogs completed", {
removed: result.removed,
failed: result.failed,
skippedLedger: result.skippedLedger,
retentionDays: AUDIT_RETENTION_DAYS,
traceId,
});
} catch (err) {
log.error("cleanAuditLogs failed", { error: err?.message, traceId });
result.errors.push({ query: "main", error: err?.message });
}

return result;
}

// =============================================================================
// CRON 13: retryCompletionRequired - 55 * * * * (NUEVO)
// =============================================================================
/**
* CRON-13: reintenta completar transacciones marcadas como COMPLETION_RETRY_REQUIRED.
* Esto ocurre cuando la saga crea reservas y checkout correctamente pero falla
* al registrar el estado final en la transacción idempotente.
*/
export async function retryCompletionRequired() {
const traceId = makeTraceId("cron-retry-completion");
const result = { processed: 0, succeeded: 0, failed: 0, errors: [] };

try {
// bookingSaga persists COMPLETION_RETRY as SYSTEM_FLAG. Query the producer's
// canonical type; querying IDEMPOTENCY made every completion retry invisible.
const res = await dalQuery(OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO)
.eq("controlType", CONTROL_TYPE.SYSTEM_FLAG)
.limit(50)
.find({ consistencyMode: "strong" });

for (const tx of res?.items || []) {
try {
const payload = readControlPayload(tx);
if (payload.status !== "COMPLETION_RETRY_REQUIRED") continue;

result.processed++;

// Reintentar la finalizacion real de la transaccion idempotente.
const pairToken = _safeTrim(payload.pairToken);
if (!pairToken || !payload.result || typeof payload.result !== "object") {
result.failed++;
if (result.errors.length < 10) {
result.errors.push({
recordId: tx._id,
reason: !pairToken ? "NO_PAIR_TOKEN" : "NO_VALID_RESULT_STORED",
});
}
continue;
}

const completion = await withTimeout(
() => _completeTransaction(pairToken, payload.result, traceId),
API_TIMEOUT_MS,
"cron:completeBookingTransaction"
);
if (!completion || !completion.ok) {
throw new Error(completion?.error || "COMPLETION_RETRY_FAILED");
}

// Marcar la incidencia auxiliar como resuelta SOLO despues de que el SSOT
// transaccional confirme la finalizacion (incluye el caso idempotente).
await dalUpdate(OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO, {
...tx,
payload: {
...payload,
status: "COMPLETED",
completedAt: new Date().toISOString(),
completionResult: {
alreadyCompleted: Boolean(completion.alreadyCompleted),
},
},
});
result.succeeded++;
log.info("retryCompletionRequired: succeeded", {
pairToken,
alreadyCompleted: Boolean(completion.alreadyCompleted),
traceId,
});
} catch (txError) {
result.failed++;
if (result.errors.length < 10) {
result.errors.push({
pairToken: tx._id,
error: txError?.message || "UNKNOWN",
});
}
log.warn("retryCompletionRequired: tx failed", {
pairToken: tx._id,
error: txError?.message,
traceId,
});
}
}

log.info("retryCompletionRequired completed", {
processed: result.processed,
succeeded: result.succeeded,
failed: result.failed,
traceId,
});
} catch (err) {
log.error("retryCompletionRequired failed", {
error: err?.message,
traceId,
});
result.errors.push({ query: "main", error: err?.message });
}

return result;
}
