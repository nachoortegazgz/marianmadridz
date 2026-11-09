/*
=============================================================================
MODULE: backend/crons.js
VERSION: v5012-DUAL-PAIR-STRICT-RECONCILIATION
BASE: v5010-TELEMETRY-ATOMIC + correcciones auditoria P0 (jobs huerfanos)
RESPONSIBILITY: Jobs programados (cron). 9 jobs wired en jobs.config + 2 de
reconciliacion interna (reconcileUnknownTransactions / InconsistentDualPairs).
STANDARDS: G10 ASCII Strict. Cero suppressAuth. Cero COLLECTIONS alias.

CORRECCIONES v5012-DUAL-PAIR-STRICT-RECONCILIATION:
DUAL-RECONCILE-01 (P1): reconcileInconsistentDualPairs solo marca RECONCILED
cuando existen exactamente F1+F2, relacion, mismo pedido/estado/importe,
un unico movimiento ORDER vinculado y ambas reservas nativas en Wix.

CORRECCIONES v5011-CRON-PARITY:
AUDIT-NZ-01 (P0): verifyNightlyZClosing implementado (declurado en
jobs.config sin export -> fallo PARITY-01/02). Idempotente por lectura Z_<dia>,
intento de cierre automatico via SSOT cajas.web, aviso ALERT deduplicado por
el notificador central backend/audit.js si se requiere accion humana. No lanza
al scheduler (condicion no recuperable).
AUDIT-WEBHOOK-01 (P0): cleanAuditLogs implementado (declurado sin export).
Purga ALERT terminales (COMPLETED/CLOSED/RESOLVED) y COMPENSATION
EXECUTED pasados AUDIT_RETENTION_DAYS. FAILED y WEBHOOK_EVENT JAMAS
(ADR-05 append-only, doble filtro defensivo).
CRON-P2-01 (P1): systemHealthCheck no incluye MapaStaff porque la
comprobacion de salud se limita a colecciones criticas del ledger y agenda;
MapaStaff permanece como coleccion de negocio para resolver identidad staff.

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
import { query as dalQuery, getItem as dalGet, insertItem as dalInsert, updateItem as dalUpdate, bulkRemove as dalBulkRemove } from "backend/dataAccess";
import { bookings, extendedBookings } from "@wix/bookings";
import { orders } from "@wix/ecom";
import { auth } from "@wix/essentials";
import {
BUSINESS_COLLECTIONS,
OPERATIONAL_COLLECTIONS,
CONTROL_TYPE,
CONTROL_STATUS,
COMPENSATION_STATUS,
WIX_CATALOG_APP_IDS,
BOOKING_STATUS,
PAYMENT_STATUS,
BOOKING_FIELDS,
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
import { _completeTransaction, cancelBookingElevated } from "backend/booking/bookingCore";
import {
    reconcileUnknownTransaction,
    reconcilePaidCitasFromLedgerInternal,
    reconcileConfirmedNativeBookingProjectionInternal,
} from "backend/events";

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

// Reservation idempotency is retained for one replay window after a terminal
// outcome. Never purge in-flight, retryable, or unknown-result transactions.
const IDEMPOTENCY_RETENTION_MS = 24 * 60 * 60 * 1000;

function _summarizeBulkRemove(response) {
    if (Array.isArray(response?.results)) {
        let removed = 0, skipped = 0, failed = 0;
        const errors = [];
        for (const entry of response.results) {
            const metadata = entry?.itemMetadata || {};
            if (metadata.success === true) { removed++; continue; }
            const error = metadata.error || {};
            const code = String(error.code || "REMOVE_FAILED");
            if (code === "WDE0193") { skipped++; continue; }
            failed++;
            if (errors.length < 10) errors.push({
                item: metadata.id || null,
                code,
                message: error.description || error.message || "UNKNOWN",
            });
        }
        return { removed, skipped, failed, errors };
    }
    const errors = Array.isArray(response?.errors) ? response.errors : [];
    return {
        removed: Number(response?.removed) || 0,
        skipped: Number(response?.skipped) || 0,
        failed: Number.isFinite(Number(response?.failed)) ? Number(response.failed) : errors.length,
        errors,
    };
}


// CRON-08: elevatedGet para reconciliación
const getBookingElevated = auth.elevate(bookings.getBooking);
const searchOrdersElevated = auth.elevate(orders.searchOrders);
const queryExtendedBookingsElevated = auth.elevate(extendedBookings.queryExtendedBookings);
const ORDER_RECONCILIATION_PAGE_LIMIT = 100;
const BOOKING_RECONCILIATION_PAGE_LIMIT = 100;
const BOOKING_RECONCILIATION_MAX_PAGES = 5;
const BOOKING_RECONCILIATION_MARKER_PAGE_LIMIT = 500;
const BOOKING_RECONCILIATION_MARKER_MAX_PAGES = 20;
const ORDER_RECONCILIATION_MAX_PAGES = 20;
const ORDER_MARKER_PAGE_LIMIT = 500;
const ORDER_MARKER_MAX_PAGES = 20;
const ORDER_RECONCILIATION_MARKER_TTL_HOURS = 72;

// =============================================================================
// CRON 1: cleanExpiredLocks - 15 * * * *
// =============================================================================
/**
* CRON-09/10: contadores precisos. Solo incrementa tras éxito confirmado.
* Retorna removed, failed y muestras de errores.
*/
export async function cleanExpiredLocks() {
const traceId = makeTraceId("cron-locks");
const result = { removed: 0, skipped: 0, failed: 0, errors: [] };

try {
const now = new Date();
const collection = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
const res = await dalQuery(collection)
.eq("controlType", CONTROL_TYPE.SLOT_LOCK)
.lt("expiresAt", now)
.limit(100)
.find({ consistencyMode: "strong" });

const ids = (res?.items || []).map((item) => item._id).filter(Boolean);
if (ids.length > 0) {
const removal = await dalBulkRemove(collection, ids, {
condition: { filter: {
controlType: { $eq: CONTROL_TYPE.SLOT_LOCK },
expiresAt: { $lt: now },
} },
});
const summary = _summarizeBulkRemove(removal);
result.removed = summary.removed;
result.skipped = summary.skipped;
result.failed = summary.failed;
result.errors = summary.errors.slice(0, 5);
}

log.info("cleanExpiredLocks completed", {
removed: result.removed,
skipped: result.skipped,
failed: result.failed,
traceId,
});
} catch (err) {
log.error("cleanExpiredLocks failed", { error: err?.message, traceId });
result.failed += 1;
result.errors.push({ query: "main", error: err?.message || "UNKNOWN" });
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
condition: { filter: {
controlType: { $eq: CONTROL_TYPE.RATE_LIMIT },
expiresAt: { $lt: now },
} },
});
const summary = _summarizeBulkRemove(removal);
result.removed = summary.removed;
result.skipped = summary.skipped;
result.failed = summary.failed;
result.errors = summary.errors.slice(0, 5);
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
// CRON: cleanExpiredDisplayTokens - every 15 minutes
// =============================================================================
/**
 * Removes expired one-time display tokens. Only DISPLAY_TOKEN rows with an
 * expired expiresAt are eligible; reservation transactions and webhook ledger
 * rows are deliberately excluded.
 */
export async function cleanExpiredDisplayTokens() {
const traceId = makeTraceId("cron-display-tokens");
const result = { removed: 0, skipped: 0, failed: 0, errors: [] };

try {
const now = new Date();
const collection = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
const res = await dalQuery(collection)
.eq("controlType", CONTROL_TYPE.DISPLAY_TOKEN)
.lt("expiresAt", now)
.limit(500)
.find({ consistencyMode: "strong" });
const ids = (res?.items || []).map((item) => item._id).filter(Boolean);

if (ids.length) {
const removal = await dalBulkRemove(collection, ids, {
condition: { filter: {
controlType: { $eq: CONTROL_TYPE.DISPLAY_TOKEN },
expiresAt: { $lt: now },
} },
});
const summary = _summarizeBulkRemove(removal);
result.removed = summary.removed;
result.skipped = summary.skipped;
result.failed = summary.failed;
result.errors = summary.errors.slice(0, 10);
}

log.info("cleanExpiredDisplayTokens completed", {
removed: result.removed,
skipped: result.skipped,
failed: result.failed,
traceId,
});
} catch (err) {
log.error("cleanExpiredDisplayTokens failed", { error: err?.message, traceId });
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
const result = { removed: 0, skipped: 0, failed: 0, errors: [] };

try {
const now = new Date();
const collection = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
const batchSize = Math.max(
1,
Math.min(Number(SDK_CONFIG?.JOBS?.DUAL_CACHE_CLEANUP_LIMIT) || 500, 500)
);

// Drain bounded batches so a backlog of expired slot-pair cache rows does
// not persist for several hourly runs. The remove condition rechecks expiry
// at write time and cannot delete a row refreshed by a concurrent request.
for (let batch = 0; batch < 10; batch++) {
const res = await dalQuery(collection)
.eq("controlType", CONTROL_TYPE.DUAL_CACHE)
.lt("expiresAt", now)
.limit(batchSize)
.find({ consistencyMode: "strong" });
const ids = (res?.items || []).map((item) => item._id).filter(Boolean);
if (!ids.length) break;

const removal = await dalBulkRemove(collection, ids, {
condition: {
filter: {
controlType: { $eq: CONTROL_TYPE.DUAL_CACHE },
expiresAt: { $lt: now },
},
},
});
const summary = _summarizeBulkRemove(removal);
result.removed += summary.removed;
result.skipped += summary.skipped;
result.failed += summary.failed;
if (result.errors.length < 10) {
result.errors.push(...summary.errors.slice(0, 10 - result.errors.length));
}
if (summary.removed === 0) break;
}

log.info("cleanupExpiredDualCache completed", {
removed: result.removed,
skipped: result.skipped,
failed: result.failed,
traceId,
});
} catch (err) {
log.error("cleanupExpiredDualCache failed", {
error: err?.message,
traceId,
});
result.failed += 1;
result.errors.push({ query: "main", error: err?.message || "UNKNOWN" });
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
async function _recoverPendingPaymentStateAlerts(batchSize, traceId) {
    const summary = { recovered: 0, failed: 0, manualRequired: 0, errors: [] };
    const alerts = await dalQuery(OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO)
        .eq("controlType", CONTROL_TYPE.ALERT)
        .eq("alertType", "PAYMENT_STATE_UPDATE_REQUIRED")
        .eq("status", CONTROL_STATUS.OPEN)
        .ascending("_createdDate")
        .limit(batchSize)
        .find({ consistencyMode: "strong" });

    for (const alert of alerts?.items || []) {
        const payload = readControlPayload(alert);
        const data = payload?.data || {};
        const attempts = Number(payload?.recoveryAttempts) || 0;
        try {
            const recovered = await withTimeout(
                () => reconcilePaidCitasFromLedgerInternal(data, traceId),
                API_TIMEOUT_MS * 2,
                "cron:paymentStateRecovery"
            );
            const resolvedPayload = {
                ...payload,
                recoveryAttempts: attempts + 1,
                resolvedAt: new Date().toISOString(),
                recoveryResult: {
                    transactionId: recovered.transactionId,
                    cashMovementId: recovered.cashMovementId,
                    updatedCount: recovered.updatedCount,
                },
                lastRecoveryError: null,
            };
            await dalUpdate(OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO, {
                ...alert,
                status: CONTROL_STATUS.RESOLVED,
                payload: resolvedPayload,
            });
            summary.recovered++;
        } catch (error) {
            const nextAttempts = attempts + 1;
            const manualRequired = nextAttempts >= 5;
            const failedPayload = {
                ...payload,
                recoveryAttempts: nextAttempts,
                lastRecoveryAt: new Date().toISOString(),
                lastRecoveryError: String(error?.message || "UNKNOWN").slice(0, 240),
                ...(manualRequired ? { manualReconciliationRequired: true } : {}),
            };
            await dalUpdate(OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO, {
                ...alert,
                status: manualRequired ? CONTROL_STATUS.FAILED : CONTROL_STATUS.OPEN,
                payload: failedPayload,
            }).catch((updateError) => {
                log.error("payment state recovery alert update failed", {
                    alertId: alert?._id,
                    error: updateError?.message,
                    traceId,
                });
            });
            if (manualRequired) summary.manualRequired++;
            else summary.failed++;
            if (summary.errors.length < 10) {
                summary.errors.push({ alertId: alert?._id, error: error?.message || "UNKNOWN" });
            }
        }
    }
    return summary;
}

export async function runPendingCompensationsJob() {
const traceId = makeTraceId("cron-comp");
const result = {
paymentStatesRecovered: 0,
paymentStatesFailed: 0,
paymentStatesManualRequired: 0,
processed: 0,
failed: 0,
manualRequired: 0,
errors: [],
};

try {
const batchSize =
Number(SDK_CONFIG?.JOBS?.FISCAL_RECOVERY_BATCH_SIZE) || 25;
const statuses = ["PENDING", "RETRYING", "PENDING_RECOVERY"];

const paymentStateRecovery = await _recoverPendingPaymentStateAlerts(batchSize, traceId);
result.paymentStatesRecovered = paymentStateRecovery.recovered;
result.paymentStatesFailed = paymentStateRecovery.failed;
result.paymentStatesManualRequired = paymentStateRecovery.manualRequired;
if (paymentStateRecovery.errors.length) {
result.errors.push(...paymentStateRecovery.errors.slice(0, 10));
}

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
paymentStatesRecovered: result.paymentStatesRecovered,
paymentStatesFailed: result.paymentStatesFailed,
paymentStatesManualRequired: result.paymentStatesManualRequired,
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
    const result = { removed: 0, skipped: 0, failed: 0, errors: [] };
    try {
        const now = new Date();
        const collection = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
        const batchSize = Math.max(1, Math.min(Number(SDK_CONFIG?.JOBS?.DAYS_CACHE_CLEANUP_LIMIT) || 500, 500));
        const candidates = [];
        for (let page = 0; page < 10; page++) {
            const res = await dalQuery(collection)
                .eq("controlType", CONTROL_TYPE.DAYS_CACHE)
                .lt("expiresAt", now)
                .ascending("expiresAt")
                .limit(batchSize)
                .skip(page * batchSize)
                .find({ consistencyMode: "strong" });
            const rows = res?.items || [];
            candidates.push(...rows.map((item) => item._id).filter(Boolean));
            if (rows.length < batchSize) break;
        }
        for (let offset = 0; offset < candidates.length; offset += 500) {
            const ids = candidates.slice(offset, offset + 500);
            const removal = await dalBulkRemove(collection, ids, {
                condition: { filter: {
                    controlType: { $eq: CONTROL_TYPE.DAYS_CACHE },
                    expiresAt: { $lt: now },
                } },
            });
            const summary = _summarizeBulkRemove(removal);
            result.removed += summary.removed;
            result.skipped += summary.skipped;
            result.failed += summary.failed;
            if (result.errors.length < 10) result.errors.push(...summary.errors.slice(0, 10 - result.errors.length));
        }
        log.info("cleanExpiredDaysCache completed", {
            removed: result.removed, skipped: result.skipped, failed: result.failed, traceId,
        });
    } catch (err) {
        result.failed++;
        result.errors.push({ query: "main", error: err?.message || "UNKNOWN" });
        log.error("cleanExpiredDaysCache failed", { error: err?.message, traceId });
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
* Busca transacciones RESULT_UNKNOWN y valida la proyeccion CitasF2.
* Solo cierra una SIMPLE completa o un par DUAL_F1/DUAL_F2 completo;
* estados ambiguos pasan a REPAIR_REQUIRED y requieren revision manual.
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
// Dual-reschedule journals have their own operation identity and recovery
// contract. This legacy pair reconciler only checks booking existence; it
// must never rewrite a journal to RECONCILED without verifying target slots
// and the CMS projection.
if (payload.operationType === "DUAL_RESCHEDULE") continue;
if (payload.reason !== "DUAL_INCONSISTENT" &&
payload.status !== "REPAIR_REQUIRED") continue;

result.processed++;
const pairToken = _safeTrim(payload.pairToken || flag?.pairToken);

if (!pairToken) {
result.failed++;
continue;
}

// Reconcile only a complete, internally consistent dual pair.
const citasRes = await dalQuery(BUSINESS_COLLECTIONS.CITAS_F2)
.eq("pairToken", pairToken)
.limit(10)
.find({ consistencyMode: "strong" });
const pairRows = Array.isArray(citasRes?.items) ? citasRes.items : [];
const f1Rows = pairRows.filter(c => normalizeBookingType(c.bookingType) === BOOKING_TYPE.DUAL_F1);
const f2Rows = pairRows.filter(c => normalizeBookingType(c.bookingType) === BOOKING_TYPE.DUAL_F2);
const f1Cita = f1Rows[0];
const f2Cita = f2Rows[0];
const f1BookingId = _safeTrim(f1Cita?.bookingId || "");
const f2BookingId = _safeTrim(f2Cita?.bookingId || "");
const f1Meta = f1Cita?.meta && typeof f1Cita.meta === "object" ? f1Cita.meta : {};
const f2Meta = f2Cita?.meta && typeof f2Cita.meta === "object" ? f2Cita.meta : {};
const f1OrderId = _safeTrim(f1Cita?.orderId || f1Meta.orderId || "");
const f2OrderId = _safeTrim(f2Cita?.orderId || f2Meta.orderId || "");
const f1PaymentStatus = _safeTrim(f1Cita?.paymentStatus || f1Meta.paymentStatus || "").toUpperCase();
const f2PaymentStatus = _safeTrim(f2Cita?.paymentStatus || f2Meta.paymentStatus || "").toUpperCase();
const f1Amount = Number(f1Cita?.totalAmount);
const f2Amount = Number(f2Cita?.totalAmount);
const pairValid =
pairRows.length === 2 &&
f1Rows.length === 1 &&
f2Rows.length === 1 &&
Boolean(f1BookingId && f2BookingId && f1BookingId !== f2BookingId) &&
_safeTrim(f2Meta.linkedF1BookingId) === f1BookingId &&
Boolean(f1OrderId && f1OrderId === f2OrderId) &&
Boolean(f1PaymentStatus && f1PaymentStatus === f2PaymentStatus) &&
Number.isFinite(f1Amount) &&
Number.isFinite(f2Amount) &&
f1Amount >= 0 &&
Math.round(f2Amount * 100) === 0;

if (!pairValid) {
result.failed++;
if (result.errors.length < 10) result.errors.push({
pairToken, reason: "DUAL_PAIR_INTEGRITY_MISMATCH", rowCount: pairRows.length,
f1Count: f1Rows.length, f2Count: f2Rows.length,
sameOrder: Boolean(f1OrderId && f1OrderId === f2OrderId),
samePaymentStatus: Boolean(f1PaymentStatus && f1PaymentStatus === f2PaymentStatus),
f2IsZero: Number.isFinite(f2Amount) && Math.round(f2Amount * 100) === 0,
});
continue;
}

const ledgerRes = await dalQuery(BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA)
.eq("transactionId", `ORDER-${f1OrderId}`)
.limit(2)
.find({ consistencyMode: "strong" });
const ledgerRows = Array.isArray(ledgerRes?.items) ? ledgerRes.items : [];
const movement = ledgerRows[0];
const movementAmount = Number(movement?.totalAmount ?? movement?.accountingAmount);
const linkedIds = Array.isArray(movement?.linkedBookingIds)
? movement.linkedBookingIds.map(value => _safeTrim(value))
: _safeTrim(movement?.linkedBookingIds).split(",").map(value => _safeTrim(value)).filter(Boolean);
const movementLinked = linkedIds.includes(f1BookingId) || linkedIds.includes(f2BookingId);
const movementMatches = ledgerRows.length === 1 &&
_safeTrim(movement?.orderId) === f1OrderId &&
Number.isFinite(movementAmount) &&
Math.round(movementAmount * 100) === Math.round(f1Amount * 100) &&
movementLinked;

if (!movementMatches) {
result.failed++;
if (result.errors.length < 10) result.errors.push({
pairToken, reason: "DUAL_PAIR_LEDGER_MISMATCH", ledgerMovementCount: ledgerRows.length,
movementAmount: Number.isFinite(movementAmount) ? movementAmount : null,
expectedAmount: f1Amount, movementLinked,
});
continue;
}

const storedMovementIds = [
f1Cita.cashMovementId || f1Meta.cashMovementId,
f2Cita.cashMovementId || f2Meta.cashMovementId,
].map(value => _safeTrim(value)).filter(Boolean);
if (storedMovementIds.some(id => id !== _safeTrim(movement._id))) {
result.failed++;
if (result.errors.length < 10) result.errors.push({
pairToken, reason: "DUAL_PAIR_CASH_MOVEMENT_REFERENCE_MISMATCH",
});
continue;
}

let f1Exists = false;
let f2Exists = false;
try {
const f1Booking = await withTimeout(getBookingElevated(f1BookingId), API_TIMEOUT_MS, "getBookingF1");
f1Exists = Boolean(f1Booking?.booking?.id || f1Booking?.booking?._id);
} catch (_) {}
try {
const f2Booking = await withTimeout(getBookingElevated(f2BookingId), API_TIMEOUT_MS, "getBookingF2");
f2Exists = Boolean(f2Booking?.booking?.id || f2Booking?.booking?._id);
} catch (_) {}

if (f1Exists && f2Exists) {
const updatedPayload = {
...payload, status: "RECONCILED", reconciledAt: new Date().toISOString(),
f1Exists, f2Exists,
verified: {
pairRows: pairRows.length, f1BookingId, f2BookingId, orderId: f1OrderId,
paymentStatus: f1PaymentStatus, amount: f1Amount,
movementId: movement._id, transactionId: movement.transactionId,
},
};
await dalUpdate(OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO, { ...flag, payload: updatedPayload });
result.reconciled++;
log.info("reconcileInconsistentDualPairs: reconciled", { pairToken, traceId });
} else {
result.failed++;
if (result.errors.length < 10) result.errors.push({ pairToken, f1Exists, f2Exists, reason: "BOOKING_MISSING" });
log.warn("reconcileInconsistentDualPairs: booking missing", { pairToken, f1Exists, f2Exists, traceId });
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
// CRON: cleanExpiredBookingControl - every 15 minutes
// =============================================================================
/**
 * Keeps terminal booking idempotency records and resolved recovery flags for
 * 24 hours after their last update, then removes them. CMS _updatedDate is the
 * terminal timestamp because the terminal state transition updates the row.
 *
 * Strict allow-list:
 * - IDEMPOTENCY: COMPLETED, FAILED_FINAL.
 * - SYSTEM_FLAG: COMPLETED, RECONCILED.
 * IN_PROGRESS, FAILED_RETRYABLE, RESULT_UNKNOWN, COMPLETION_RETRY_REQUIRED,
 * REPAIR_REQUIRED and all other states remain available to recovery.
 * WEBHOOK_EVENT is a separate immutable ledger.
 */
export async function cleanExpiredBookingControl() {
    const traceId = makeTraceId("cron-booking-control-purge");
    const result = { removed: 0, skipped: 0, failed: 0, errors: [] };
    try {
        const cutoff = new Date(Date.now() - IDEMPOTENCY_RETENTION_MS);
        const collection = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
        const candidates = [];
        const seenIds = new Set();
        for (const type of [CONTROL_TYPE.IDEMPOTENCY, CONTROL_TYPE.SYSTEM_FLAG]) {
            for (let page = 0; page < 10; page++) {
                const res = await dalQuery(collection)
                    .eq("controlType", type)
                    .lt("_updatedDate", cutoff)
                    .ascending("_updatedDate")
                    .limit(500)
                    .skip(page * 500)
                    .find({ consistencyMode: "strong" });
                const rows = res?.items || [];
                for (const item of rows) {
                    if (item?._id && !seenIds.has(item._id)) {
                        seenIds.add(item._id);
                        candidates.push(item);
                    }
                }
                if (rows.length < 500) break;
            }
        }
        const eligibleStatuses = {
            [CONTROL_TYPE.IDEMPOTENCY]: new Set(["COMPLETED", "FAILED_FINAL"]),
            [CONTROL_TYPE.SYSTEM_FLAG]: new Set(["COMPLETED", "RECONCILED", "RESOLVED"]),
        };
        const groups = new Map();
        for (const item of candidates) {
            const payload = readControlPayload(item);
            const payloadStatus = _safeTrim(payload.status).toUpperCase();
            const rootStatus = _safeTrim(item.status).toUpperCase();
            const status = payloadStatus || rootStatus;
            const terminalAt = new Date(
                payload.terminalAt || payload.completedAt || payload.reconciledAt ||
                payload.resolvedAt || item?._updatedDate || ""
            );
            if (
                (payloadStatus && rootStatus && payloadStatus !== rootStatus) ||
                !eligibleStatuses[item.controlType]?.has(status) ||
                !Number.isFinite(terminalAt.getTime()) ||
                terminalAt.getTime() > cutoff.getTime()
            ) {
                result.skipped++;
                continue;
            }
            const key = item.controlType;
            if (!groups.has(key)) groups.set(key, {
                controlType: item.controlType, ids: [],
            });
            groups.get(key).ids.push(item._id);
        }
        for (const group of groups.values()) {
            for (let offset = 0; offset < group.ids.length; offset += 500) {
                const ids = group.ids.slice(offset, offset + 500);
                const removal = await dalBulkRemove(collection, ids, {
                    condition: { filter: {
                        controlType: { $eq: group.controlType },
                        _updatedDate: { $lt: cutoff },
                    } },
                });
                const summary = _summarizeBulkRemove(removal);
                result.removed += summary.removed;
                result.skipped += summary.skipped;
                result.failed += summary.failed;
                if (result.errors.length < 10) result.errors.push(...summary.errors.slice(0, 10 - result.errors.length));
            }
        }
        log.info("cleanExpiredBookingControl completed", {
            removed: result.removed, skipped: result.skipped, failed: result.failed,
            retentionHours: 24, traceId,
        });
    } catch (err) {
        result.failed++;
        result.errors.push({ query: "main", error: err?.message || "UNKNOWN" });
        log.error("cleanExpiredBookingControl failed", { error: err?.message, traceId });
    }
    return result;
}

// =============================================================================
// CRON 8: cleanAuditLogs - 0 3 * * 0 (AUDIT-WEBHOOK-01, P0 parity)
// =============================================================================
/**
* AUDIT-WEBHOOK-01 (P0): Declurado en jobs.config pero NO implementado.
* Purga exclusivamente filas TERMINALES de retencion vencida:
*  - ALERT con status COMPLETED/CLOSED/RESOLVED y _createdDate > retencion.
*  - COMPENSATION solo EXECUTED; FAILED puede requerir recuperacion manual.
* NUNCA purga WEBHOOK_EVENT (ledger append-only, ADR-05; ademas el hook
* ControlOperativo_beforeRemove lo bloquea en runtime real). SLOT_LOCK y
* caches tienen su propio ciclo de vida (cleanExpiredLocks/DualCache/DaysCache)
* y quedan fuera de este job.
*/
export async function cleanAuditLogs() {
    const traceId = makeTraceId("cron-audit-purge");
    const result = { removed: 0, skipped: 0, failed: 0, errors: [] };
    try {
        const cutoff = new Date(Date.now() - AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
        const collection = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
        const purgeGroups = [
            { controlType: CONTROL_TYPE.ALERT, statuses: ["COMPLETED", ...PURGABLE_TERMINAL_ALERT_STATUSES] },
            // FAILED compensation may still require fiscal or booking recovery.
            { controlType: CONTROL_TYPE.COMPENSATION, statuses: [CONTROL_STATUS.EXECUTED] },
        ];
        for (const group of purgeGroups) {
            for (const status of group.statuses) {
                const candidates = [];
                for (let page = 0; page < 10; page++) {
                    const res = await dalQuery(collection)
                        .eq("controlType", group.controlType)
                        .eq("status", status)
                        .lt("_createdDate", cutoff)
                        .ascending("_createdDate")
                        .limit(500)
                        .skip(page * 500)
                        .find({ consistencyMode: "strong" });
                    const rows = res?.items || [];
                    candidates.push(...rows.map((item) => item._id).filter(Boolean));
                    if (rows.length < 500) break;
                }
                for (let offset = 0; offset < candidates.length; offset += 500) {
                    const ids = candidates.slice(offset, offset + 500);
                    const removal = await dalBulkRemove(collection, ids, {
                        condition: { filter: {
                            controlType: { $eq: group.controlType },
                            status: { $eq: status },
                            _createdDate: { $lt: cutoff },
                        } },
                    });
                    const summary = _summarizeBulkRemove(removal);
                    result.removed += summary.removed;
                    result.skipped += summary.skipped;
                    result.failed += summary.failed;
                    if (result.errors.length < 10) result.errors.push(...summary.errors.slice(0, 10 - result.errors.length));
                }
            }
        }
        log.info("cleanAuditLogs completed", {
            removed: result.removed, skipped: result.skipped, failed: result.failed,
            retentionDays: AUDIT_RETENTION_DAYS, traceId,
        });
    } catch (err) {
        result.failed++;
        log.error("cleanAuditLogs failed", { error: err?.message, traceId });
        result.errors.push({ query: "main", error: err?.message || "UNKNOWN" });
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


// =============================================================================
// CRON: reconcileUnmarkedOrderCreatedEvents - every 30 minutes
// =============================================================================
/**
 * Reconciles native Wix Orders whose ORDER_CREATED event marker is absent.
 *
 * Only orders composed entirely of Wix Bookings line items are auto-marked:
 * they require no Stores inventory reservation. Any Stores or unknown catalog
 * line item is left unmarked and receives a deduplicated operational alert.
 * This cron never creates payments, cash movements, accounting entries, stock
 * movements, or stock reservations.
 */
export async function reconcileUnmarkedOrderCreatedEvents() {
    const traceId = makeTraceId("cron-order-created-reconcile");
    const result = {
        ordersRead: 0,
        markersFound: 0,
        reconciled: 0,
        reviewRequired: 0,
        skipped: 0,
        failed: 0,
        errors: [],
    };

    const ordersById = new Map();
    // Search Orders omits PENDING/REJECTED by default; INITIALIZED is never
    // returned by Search Orders and must be handled by its originating event.
    const filters = [null, { status: "PENDING" }, { status: "REJECTED" }];

    try {
        for (const filter of filters) {
            let cursor = null;
            let hasNext = true;
            let page = 0;

            while (hasNext && page < ORDER_RECONCILIATION_MAX_PAGES) {
                const search = {
                    ...(filter ? { filter } : {}),
                    cursorPaging: {
                        limit: ORDER_RECONCILIATION_PAGE_LIMIT,
                        ...(cursor ? { cursor } : {}),
                    },
                };
                const response = await withTimeout(
                    () => searchOrdersElevated(search),
                    API_TIMEOUT_MS,
                    "cron:searchOrdersForOrderCreatedReconciliation"
                );
                const pageOrders = response?.orders || [];
                for (const order of pageOrders) {
                    const orderId = _safeTrim(order?._id || order?.id);
                    if (!orderId) continue;
                    if (!_looksLikeGuid(orderId)) {
                        throw new Error("ORDER_ID_INVALID_IN_NATIVE_SEARCH");
                    }
                    ordersById.set(orderId, order);
                }
                hasNext = Boolean(response?.metadata?.hasNext);
                cursor = response?.metadata?.cursors?.next || null;
                page++;
                if (hasNext && !cursor) {
                    throw new Error("ORDER_SEARCH_NEXT_CURSOR_MISSING");
                }
            }

            if (hasNext) {
                throw new Error("ORDER_SEARCH_PAGE_LIMIT_REACHED");
            }
        }

        result.ordersRead = ordersById.size;

        const markerRows = [];
        let markerPage = 0;
        while (markerPage < ORDER_MARKER_MAX_PAGES) {
            const markerResponse = await dalQuery(OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO)
                .eq("controlType", CONTROL_TYPE.WEBHOOK_EVENT)
                .ascending("_createdDate")
                .limit(ORDER_MARKER_PAGE_LIMIT)
                .skip(markerPage * ORDER_MARKER_PAGE_LIMIT)
                .find({ consistencyMode: "strong" });
            const rows = markerResponse?.items || [];
            markerRows.push(...rows);
            if (rows.length < ORDER_MARKER_PAGE_LIMIT) break;
            markerPage++;
        }
        if (markerPage >= ORDER_MARKER_MAX_PAGES &&
            markerRows.length === ORDER_MARKER_PAGE_LIMIT * ORDER_MARKER_MAX_PAGES) {
            throw new Error("ORDER_EVENT_MARKER_SCAN_LIMIT_REACHED");
        }

        const markedOrderIds = new Set();
        for (const row of markerRows) {
            const payload = readControlPayload(row);
            const eventType = _safeTrim(payload?.eventType).toUpperCase();
            if (eventType !== "ORDER_CREATED" && eventType !== "ORDER_CREATED_RECONCILED") {
                continue;
            }
            const orderId = _safeTrim(
                row?.orderId || payload?.metadata?.orderId || payload?.orderId
            );
            if (orderId) markedOrderIds.add(orderId);
        }
        result.markersFound = markedOrderIds.size;

        for (const [orderId, order] of ordersById.entries()) {
            if (markedOrderIds.has(orderId)) {
                result.skipped++;
                continue;
            }

            const lineItems = Array.isArray(order?.lineItems) ? order.lineItems : [];
            const bookingsOnly = lineItems.length > 0 && lineItems.every((line) =>
                line?.catalogReference?.appId === WIX_CATALOG_APP_IDS.BOOKINGS
            );

            if (bookingsOnly) {
                const eventId = `ORDER_CREATED_RECONCILED_${orderId}`;
                const recordId = `ORDER_CREATED_RECONCILED_${orderId}`;
                const now = new Date();
                const record = {
                    _id: recordId,
                    controlType: CONTROL_TYPE.WEBHOOK_EVENT,
                    dedupeKey: `WEBHOOK_${eventId}`,
                    eventId,
                    orderId,
                    status: CONTROL_STATUS.COMPLETED,
                    expiresAt: new Date(now.getTime() +
                        ORDER_RECONCILIATION_MARKER_TTL_HOURS * 60 * 60 * 1000),
                    payload: {
                        eventType: "ORDER_CREATED_RECONCILED",
                        traceId,
                        processedAt: now.toISOString(),
                        metadata: {
                            orderId,
                            orderNumber: order?.number ?? null,
                            orderStatus: _safeTrim(order?.status) || "UNKNOWN",
                            paymentStatus: _safeTrim(order?.paymentStatus) || "UNKNOWN",
                            lineItemCount: lineItems.length,
                            inventoryAction: "NOT_REQUIRED_BOOKINGS_ONLY",
                            reconciliationSource: "WIX_ORDERS_NATIVE",
                            originalEventMarkerMissing: true,
                        },
                    },
                    traceId,
                    _createdDate: now,
                    _updatedDate: now,
                };

                try {
                    await dalInsert(OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO, record);
                    markedOrderIds.add(orderId);
                    result.reconciled++;
                } catch (insertError) {
                    const existing = await dalGet(
                        OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO,
                        recordId,
                        "strong"
                    );
                    if (existing?.payload?.eventType === "ORDER_CREATED_RECONCILED" &&
                        existing?.orderId === orderId) {
                        markedOrderIds.add(orderId);
                        result.skipped++;
                    } else {
                        throw insertError;
                    }
                }
                continue;
            }

            const appIds = Array.from(new Set(lineItems.map((line) =>
                _safeTrim(line?.catalogReference?.appId) || "MISSING_APP_ID"
            )));
            const alert = await notifyOperationalAlert({
                alertType: "ORDER_CREATED_RECONCILIATION_REQUIRED",
                severity: "ERROR",
                message: "Pedido nativo sin marcador ORDER_CREATED; requiere revisar lineas de catalogo antes de reconciliar inventario.",
                data: {
                    orderId,
                    orderNumber: order?.number ?? null,
                    orderStatus: _safeTrim(order?.status) || "UNKNOWN",
                    paymentStatus: _safeTrim(order?.paymentStatus) || "UNKNOWN",
                    lineItemCount: lineItems.length,
                    catalogAppIds: appIds,
                },
                traceId,
                entityId: orderId,
                source: "backend/crons.js",
                dedupeKey: `ORDER_CREATED_RECONCILIATION_${orderId}`,
            });
            if (alert?.failed) {
                result.failed++;
                if (result.errors.length < 10) {
                    result.errors.push({ orderId, reason: "RECONCILIATION_ALERT_PERSISTENCE_FAILED" });
                }
                continue;
            }
            result.reviewRequired++;
        }

        log.info("reconcileUnmarkedOrderCreatedEvents completed", {
            ordersRead: result.ordersRead,
            markersFound: result.markersFound,
            reconciled: result.reconciled,
            reviewRequired: result.reviewRequired,
            skipped: result.skipped,
            failed: result.failed,
            traceId,
        });
        if (result.failed > 0) {
            throw new Error("ORDER_CREATED_RECONCILIATION_PARTIAL_FAILURE");
        }
        return result;
    } catch (error) {
        log.error("reconcileUnmarkedOrderCreatedEvents failed", {
            error: error?.message || "UNKNOWN",
            ordersRead: result.ordersRead,
            reconciled: result.reconciled,
            reviewRequired: result.reviewRequired,
            failed: result.failed,
            traceId,
        });
        throw error;
    }
}


// =============================================================================
// CRON: reconcileMissingConfirmedBookingProjections - every 30 minutes
// =============================================================================
/**
 * Reconciles confirmed native Bookings V2 that lack a CitasF2 projection.
 * Unpaid/exempt bookings with complete service, schedule and resource data
 * are projected using the canonical events.js writer. Paid bookings and
 * bookings without a selected resource are never guessed or financially
 * posted; they receive deduplicated operational alerts.
 *
 * Canceled unpaid bookings remain in Wix Bookings SSOT and are not copied
 * into the active operational projection. Canceled PAID bookings without a
 * CitasF2 projection are flagged for financial review.
 */
export async function reconcileMissingConfirmedBookingProjections() {
    const traceId = makeTraceId("cron-booking-projection-reconcile");
    const result = {
        nativeConfirmedRead: 0,
        canceledPaidRead: 0,
        amountReconciliationRequired: 0,
        reconciled: 0,
        alreadyProjected: 0,
        reviewRequired: 0,
        skipped: 0,
        failed: 0,
        errors: [],
    };

    const _queryNativeBookings = async (filter) => {
        const nativeBookings = new Map();
        let cursor = null;
        let page = 0;
        let hasNext = true;
        while (hasNext && page < BOOKING_RECONCILIATION_MAX_PAGES) {
            const query = page === 0
                ? { filter, cursorPaging: { limit: BOOKING_RECONCILIATION_PAGE_LIMIT } }
                : { cursorPaging: { limit: BOOKING_RECONCILIATION_PAGE_LIMIT, cursor } };
            const response = await withTimeout(
                () => queryExtendedBookingsElevated(query, {
                    withBookingAllowedActions: false,
                    withBookingAttendanceInfo: false,
                    withBookingConferencingDetails: false,
                    withBookingPolicySettings: false,
                    withBookingFeeDetails: false,
                    withEcomOrder: false,
                    withEcomTransactions: false,
                }),
                API_TIMEOUT_MS,
                "cron:queryExtendedBookingsForProjectionReconciliation"
            );
            for (const item of response?.extendedBookings || []) {
                const booking = item?.booking || item;
                const bookingId = _safeTrim(booking?.id || booking?._id);
                if (!bookingId) continue;
                if (!_looksLikeGuid(bookingId)) {
                    throw new Error("NATIVE_BOOKING_ID_INVALID_IN_READER");
                }
                nativeBookings.set(bookingId, booking);
            }
            cursor = response?.pagingMetadata?.cursors?.next || null;
            hasNext = Boolean(cursor);
            page++;
        }
        if (hasNext) throw new Error("NATIVE_BOOKING_QUERY_PAGE_LIMIT_REACHED");
        return [...nativeBookings.values()];
    };

    const _loadCitasByBookingId = async () => {
        const rows = [];
        let page = 0;
        while (page < BOOKING_RECONCILIATION_MAX_PAGES) {
            const response = await dalQuery(BUSINESS_COLLECTIONS.CITAS_F2)
                .limit(BOOKING_RECONCILIATION_MARKER_PAGE_LIMIT)
                .skip(page * BOOKING_RECONCILIATION_MARKER_PAGE_LIMIT)
                .find({ consistencyMode: "strong" });
            const items = response?.items || [];
            rows.push(...items);
            if (items.length < BOOKING_RECONCILIATION_MARKER_PAGE_LIMIT) break;
            page++;
        }
        if (page >= BOOKING_RECONCILIATION_MAX_PAGES) {
            throw new Error("CITASF2_RECONCILIATION_SCAN_LIMIT_REACHED");
        }
        return new Map(rows.map((row) => [
            _safeTrim(row?.[BOOKING_FIELDS.BOOKING_ID]),
            row,
        ]).filter(([bookingId]) => bookingId));
    };

    const _loadBookingEventMarkerIds = async () => {
        const rows = [];
        let page = 0;
        while (page < BOOKING_RECONCILIATION_MARKER_MAX_PAGES) {
            const response = await dalQuery(OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO)
                .eq("controlType", CONTROL_TYPE.WEBHOOK_EVENT)
                .ascending("_createdDate")
                .limit(BOOKING_RECONCILIATION_MARKER_PAGE_LIMIT)
                .skip(page * BOOKING_RECONCILIATION_MARKER_PAGE_LIMIT)
                .find({ consistencyMode: "strong" });
            const items = response?.items || [];
            rows.push(...items);
            if (items.length < BOOKING_RECONCILIATION_MARKER_PAGE_LIMIT) break;
            page++;
        }
        if (page >= BOOKING_RECONCILIATION_MARKER_MAX_PAGES) {
            throw new Error("BOOKING_EVENT_MARKER_SCAN_LIMIT_REACHED");
        }
        const ids = new Set();
        for (const row of rows) {
            const payload = readControlPayload(row);
            const eventType = _safeTrim(payload?.eventType).toUpperCase();
            if (eventType !== "BOOKING_CONFIRMED" &&
                eventType !== "BOOKING_CONFIRMED_RECONCILED") continue;
            const bookingId = _safeTrim(
                payload?.metadata?.bookingId || payload?.bookingId || row?.bookingId
            );
            if (bookingId) ids.add(bookingId);
        }
        return ids;
    };

    const _queueBookingReview = async (booking, reason, alertType) => {
        const bookingId = _safeTrim(booking?.id || booking?._id);
        const alert = await notifyOperationalAlert({
            alertType,
            severity: "ERROR",
            message: "Reserva nativa sin proyeccion CitasF2 automatizable; requiere revision controlada.",
            data: {
                bookingId,
                bookingStatus: _safeTrim(booking?.status) || "UNKNOWN",
                paymentStatus: _safeTrim(booking?.paymentStatus) || "UNKNOWN",
                selectedPaymentOption: _safeTrim(booking?.selectedPaymentOption) || "UNKNOWN",
                reason,
                serviceId: _safeTrim(booking?.bookedEntity?.slot?.serviceId) || null,
                scheduleId: _safeTrim(booking?.bookedEntity?.slot?.scheduleId) || null,
                resourceId: _safeTrim(
                    booking?.bookedEntity?.slot?.resource?._id ||
                    booking?.bookedEntity?.slot?.resource?.id
                ) || null,
            },
            traceId,
            entityId: bookingId,
            source: "backend/crons.js",
            dedupeKey: `${alertType}_${bookingId}`,
        });
        if (alert?.failed) {
            result.failed++;
            if (result.errors.length < 10) result.errors.push({ bookingId, reason: "ALERT_PERSISTENCE_FAILED" });
            return false;
        }
        result.reviewRequired++;
        return true;
    };

    try {
        const [confirmedBookings, canceledPaidBookings] = await Promise.all([
            _queryNativeBookings({
                status: BOOKING_STATUS.CONFIRMED,
                startDate: { "$gte": "2020-01-01T00:00:00.000Z" },
            }),
            _queryNativeBookings({
                status: BOOKING_STATUS.CANCELED,
                paymentStatus: PAYMENT_STATUS.PAID,
                startDate: { "$gte": "2020-01-01T00:00:00.000Z" },
            }),
        ]);
        result.nativeConfirmedRead = confirmedBookings.length;
        result.canceledPaidRead = canceledPaidBookings.length;

        const [citasByBookingId, markerIds] = await Promise.all([
            _loadCitasByBookingId(),
            _loadBookingEventMarkerIds(),
        ]);

        for (const booking of confirmedBookings) {
            const bookingId = _safeTrim(booking?.id || booking?._id);
            if (!_looksLikeGuid(bookingId)) {
                await _queueBookingReview(booking, "NATIVE_BOOKING_ID_INVALID", "BOOKING_PROJECTION_RECONCILIATION_REQUIRED");
                continue;
            }

            const paymentStatus = _safeTrim(booking?.paymentStatus).toUpperCase();
            if ([PAYMENT_STATUS.PAID, PAYMENT_STATUS.PARTIALLY_PAID, PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.PARTIALLY_REFUNDED].includes(paymentStatus)) {
                await _queueBookingReview(booking, "PAYMENT_REQUIRES_LEDGER_RECONCILIATION", "BOOKING_PAID_PROJECTION_REVIEW_REQUIRED");
                continue;
            }

            const hasProjection = citasByBookingId.has(bookingId);
            const hasMarker = markerIds.has(bookingId);
            if (hasProjection && hasMarker) {
                result.skipped++;
                continue;
            }

            const syncResult = await reconcileConfirmedNativeBookingProjectionInternal(booking, traceId);
            if (!syncResult?.ok) {
                await _queueBookingReview(
                    booking,
                    syncResult?.reason || "NATIVE_BOOKING_PROJECTION_FAILED",
                    "BOOKING_PROJECTION_RECONCILIATION_REQUIRED"
                );
                continue;
            }
            if (syncResult.created) result.reconciled++;
            else result.alreadyProjected++;
            if (syncResult.amountReconciliationRequired) result.amountReconciliationRequired++;
            citasByBookingId.set(bookingId, { bookingId });
            markerIds.add(bookingId);
        }

        for (const booking of canceledPaidBookings) {
            const bookingId = _safeTrim(booking?.id || booking?._id);
            if (!bookingId || citasByBookingId.has(bookingId)) {
                result.skipped++;
                continue;
            }
            await _queueBookingReview(
                booking,
                "CANCELED_BOOKING_STILL_MARKED_PAID_WITHOUT_CITASF2",
                "CANCELED_PAID_BOOKING_FINANCIAL_REVIEW_REQUIRED"
            );
        }

        log.info("reconcileMissingConfirmedBookingProjections completed", {
            nativeConfirmedRead: result.nativeConfirmedRead,
            canceledPaidRead: result.canceledPaidRead,
            amountReconciliationRequired: result.amountReconciliationRequired,
            reconciled: result.reconciled,
            alreadyProjected: result.alreadyProjected,
            reviewRequired: result.reviewRequired,
            skipped: result.skipped,
            failed: result.failed,
            traceId,
        });
        if (result.failed > 0) throw new Error("BOOKING_PROJECTION_RECONCILIATION_PARTIAL_FAILURE");
        return result;
    } catch (error) {
        log.error("reconcileMissingConfirmedBookingProjections failed", {
            error: error?.message || "UNKNOWN",
            nativeConfirmedRead: result.nativeConfirmedRead,
            reconciled: result.reconciled,
            reviewRequired: result.reviewRequired,
            failed: result.failed,
            traceId,
        });
        throw error;
    }
}
