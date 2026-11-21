import { Permissions, webMethod } from "wix-web-module";
import { requireAdmin, requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { TPV_SANDBOX_COLLECTIONS, TPV_SANDBOX_RUNTIME_POLICY } from "backend/internalConfig";
import { insertSandboxEvent, latestOpenSandboxSession, querySandboxLedgerRecords, withSandboxSessionLock } from "backend/tpv/tpvSandboxRepository";
import { assertTpvSandboxEnabled, fromMinorUnits, normalizeClientIdempotencyKey, toMinorUnits } from "backend/tpv/tpvUtils";

const TPV_LEDGER_DISPLAY_TYPES = Object.freeze({
    SIMULATED_TPV_SALE: "VENTA",
    SIMULATED_TPV_CASH_MOVEMENT: null,
    SIMULATED_TPV_REFUND: "DEVOLUCION",
    SIMULATED_TPV_TICKET_X: "CONTROL_X",
    SIMULATED_TPV_TICKET_Z: "CIERRE_Z",
});

export const registrarMovimientoCaja = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        let persisted = false;
        const traceId = makeTraceId("tpv-sandbox-cash-movement");
        await requireAdmin(traceId);
        assertTpvSandboxEnabled();
        try {
            const movementType = String(input.movementType || "").trim().toUpperCase();
            if (!["ENTRADA", "SALIDA", "RETIRADA"].includes(movementType)) throw new Error("TPV_SANDBOX_CASH_MOVEMENT_TYPE_INVALID");
            const session = await latestOpenSandboxSession();
            if (!session) throw new Error("TPV_SANDBOX_SESSION_NOT_OPEN");

            return await withSandboxSessionLock(session.sessionId, traceId, async () => {
                const activeSession = await latestOpenSandboxSession();
                if (!activeSession || activeSession.sessionId !== session.sessionId) {
                    throw new Error("TPV_SANDBOX_SESSION_CLOSED");
                }
            const amountMinor = toMinorUnits(input.amount, "CASH_MOVEMENT");
            if (amountMinor <= 0) throw new Error("TPV_SANDBOX_CASH_MOVEMENT_AMOUNT_INVALID");
            const reason = String(input.reason || "").trim();
            if (reason.length < 3 || reason.length > 500) throw new Error("TPV_SANDBOX_REASON_REQUIRED");
            const key = normalizeClientIdempotencyKey(input.idempotencyKey);
            const { item, replayed } = await insertSandboxEvent(TPV_SANDBOX_COLLECTIONS.MOVIMIENTOS_CAJA, key, {
                sessionId: session.sessionId,
                movementType,
                amountMinor,
                paymentMethod: "EFECTIVO",
                reason,
                status: "CONFIRMADO_SINTETICO",
                createdAt: new Date(),
                payload: {
                    actorId: TPV_SANDBOX_RUNTIME_POLICY.ACTOR_ID,
                    authorizedBy: movementType === "ENTRADA" ? null : TPV_SANDBOX_RUNTIME_POLICY.ACTOR_ID,
                    affectsPhysicalCash: true,
                    traceId,
                },
            });
            persisted = true;
            await insertSandboxEvent(TPV_SANDBOX_COLLECTIONS.AUDITORIA, key + ":AUDIT", {
                action: "MOVIMIENTO_CAJA_" + movementType,
                actorId: TPV_SANDBOX_RUNTIME_POLICY.ACTOR_ID,
                entityType: "MOVIMIENTO_CAJA",
                entityId: item._id || key,
                occurredAt: new Date(),
                source: "TPV_SANDBOX_WEB_METHOD",
                payload: { amountMinor, reason, traceId },
            });
            return { status: "SUCCESS", data: { movementId: item._id, movementType, amount: fromMinorUnits(amountMinor), replayed, persisted: true, isSynthetic: true, realPayment: false }, error: null, traceId };
            });
        } catch (error) {
            return { status: "ERROR", data: null, error: { code: String(error?.message || "TPV_SANDBOX_CASH_MOVEMENT_FAILED") }, persisted, recoverable: persisted, isSynthetic: true, realPayment: false, traceId };
        }
    }
);


export const obtenerMovimientosCaja = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-sandbox-cash-movements-read");
        await requireCajero(traceId);
        assertTpvSandboxEnabled();
        try {
            const limit = Number(input.limit ?? 50);
            if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
                throw new Error("TPV_INVALID_MOVEMENTS_LIMIT");
            }
            const sessionId = String(input.sessionId || "").trim();
            const ledger = await querySandboxLedgerRecords({ limit: 1000 });
            const visibleTypes = new Set(Object.keys(TPV_LEDGER_DISPLAY_TYPES));
            const items = ledger.records
                .filter((record) => {
                    const sourceType = String(record.cmsMovementType || "");
                    if (!visibleTypes.has(sourceType)) return false;
                    if (sourceType === "SIMULATED_TPV_SALE" && record.status !== "CONFIRMADA_SINTETICA") return false;
                    const recordSessionId = String(record.sessionId || record.payload?.sessionId || "");
                    return !sessionId || recordSessionId === sessionId;
                })
                .map((record) => {
                    let amountMinor = null;
                    if (record.amountMinor !== undefined && record.amountMinor !== null && Number.isSafeInteger(Number(record.amountMinor))) {
                        amountMinor = Number(record.amountMinor);
                    } else if (record.totalMinor !== undefined && record.totalMinor !== null && Number.isSafeInteger(Number(record.totalMinor))) {
                        amountMinor = Number(record.totalMinor);
                    }
                    const sourceType = String(record.cmsMovementType || "");
                    const movementType = TPV_LEDGER_DISPLAY_TYPES[sourceType] || String(record.movementType || "MOVIMIENTO_CAJA");
                    return {
                        movementId: record._id,
                        sessionId: record.sessionId || record.payload?.sessionId || null,
                        movementType,
                        sourceType,
                        amount: amountMinor === null ? null : fromMinorUnits(amountMinor),
                        paymentMethod: record.paymentMethod || null,
                        reason: record.reason || record.totals?.differenceReason || "",
                        reference: record.saleId || record.refundId || record.reportId || record._id,
                        status: record.status || null,
                        createdAt: record.createdAt || record.generatedAt || record._createdDate || null,
                        totals: record.totals || null,
                        currency: record.currency || "EUR",
                        isSynthetic: true,
                        persisted: true,
                    };
                })
                .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
                .slice(0, limit);
            return {
                status: "SUCCESS",
                data: {
                    items,
                    syntheticOnly: true,
                    truncated: ledger.hasMore,
                },
                error: null,
                traceId,
            };
        } catch (error) {
            return {
                status: "ERROR",
                data: null,
                error: { code: String(error?.message || "TPV_SANDBOX_CASH_MOVEMENTS_READ_FAILED") },
                traceId,
            };
        }
    }
);
