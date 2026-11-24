import { Permissions, webMethod } from "wix-web-module";
import { resolveTpvContext } from "backend/tpv/tpvContext";
import { requireAdmin, requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { TPV_COLLECTIONS, TPV_LEDGER_SOURCE, TPV_PAYMENT_METHOD, TPV_RUNTIME_POLICY } from "backend/internalConfig";
import { appendTpvAudit, assertTpvOperationalLedgerConfigured, insertTpvEvent, latestOpenTpvSession, latestTpvSession, queryTpvLedgerRecords, queryTpvRecords, withTpvSessionLock } from "backend/tpv/tpvRepository";
import { resolveAuthorizedProfessional } from "backend/tpv/tpvNativeDirectory";
import { fromMinorUnits, normalizeClientIdempotencyKey, toMinorUnits } from "backend/tpv/tpvUtils";
import { buildCashMovementFailure, buildCashMovementSuccessData, resolveCashSessionOperationalStatus } from "backend/tpv/tpvMovementContracts";

const TPV_LEDGER_DISPLAY_TYPES = Object.freeze({
    TPV_SALE: "VENTA",
    TPV_CASH_MOVEMENT: null,
    TPV_REFUND: "DEVOLUCION",
    TPV_TICKET_X: "CONTROL_X",
    TPV_TICKET_Z: "CIERRE_Z",
    // Read-only compatibility for previously persisted movement discriminators.
    SIMULATED_TPV_SALE: "VENTA",
    SIMULATED_TPV_CASH_MOVEMENT: null,
    SIMULATED_TPV_REFUND: "DEVOLUCION",
    SIMULATED_TPV_TICKET_X: "CONTROL_X",
    SIMULATED_TPV_TICKET_Z: "CIERRE_Z",
});

function sessionOf(record) {
    return String(record?.sessionId || record?.payload?.sessionId || "").trim();
}

function mapMovementRecord(record) {
    const sourceType = String(record?.cmsMovementType || "");
    if (!Object.prototype.hasOwnProperty.call(TPV_LEDGER_DISPLAY_TYPES, sourceType)) return null;
    if ((sourceType === "TPV_SALE" || sourceType === "SIMULATED_TPV_SALE") && !["CONFIRMADA", "CONFIRMADA_SINTETICA"].includes(record.status)) return null;
    const amountMinor = Number.isSafeInteger(Number(record.amountMinor))
        ? Number(record.amountMinor)
        : Number.isSafeInteger(Number(record.totalMinor))
            ? Number(record.totalMinor)
            : null;
    return {
        movementId: record._id,
        sessionId: sessionOf(record) || null,
        movementType: TPV_LEDGER_DISPLAY_TYPES[sourceType] || String(record.movementType || "MOVIMIENTO_CAJA"),
        sourceType: TPV_LEDGER_SOURCE,
        amount: amountMinor === null ? null : fromMinorUnits(amountMinor),
        paymentMethod: record.paymentMethod || null,
        reason: record.reason || record.totals?.differenceReason || "",
        reference: record.saleId || record.refundId || record.reportId || record._id,
        status: record.status || null,
        concept: String(record.operationDescription || record.reason || "Operación TPV histórica").replace(/\s*\[SINTÉTICO\]$/i, "") + " [SINTÉTICO]",
        createdAt: record.createdAt || record.generatedAt || record._createdDate || null,
        totals: record.totals || null,
        currency: record.currency || "EUR",
        persisted: true,
    };
}

function sessionIdFromInput(input) {
    const sessionId = String(input?.sessionId || "").trim();
    if (!sessionId || sessionId.length > 128) throw new Error("TPV_SESSION_REQUIRED");
    return sessionId;
}

function exportSuccess(data, traceId) {
    return { status: "SUCCESS", data, error: null, traceId };
}

function exportFailure(error, fallback, traceId) {
    return { status: "ERROR", data: null, error: { code: String(error?.message || fallback) }, traceId };
}

export const registrarMovimientoCaja = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        let persisted = false;
        const traceId = makeTraceId("tpv-cash-movement");
        await requireAdmin(traceId);
        assertTpvOperationalLedgerConfigured();
        const operator = await resolveTpvContext(traceId);

        try {
            const movementType = String(input.movementType || "").trim().toUpperCase();
            if (!["ENTRADA", "SALIDA", "RETIRADA"].includes(movementType)) throw new Error("TPV_CASH_MOVEMENT_TYPE_INVALID");
            const paymentMethod = String(input.paymentMethod || TPV_PAYMENT_METHOD.EFECTIVO).trim().toUpperCase();
            if (paymentMethod !== TPV_PAYMENT_METHOD.EFECTIVO) throw new Error("TPV_CASH_MOVEMENT_REQUIRES_CASH");
            const requestedSessionId = sessionIdFromInput(input);
            const session = await latestOpenTpvSession();
            if (!session) {
                const latest = await latestTpvSession();
                throw new Error(latest?.status === "CERRADA" ? "TPV_SESSION_CLOSED" : "TPV_SESSION_NOT_OPEN");
            }
            if (requestedSessionId !== session.sessionId) throw new Error("TPV_SESSION_MISMATCH");

            return await withTpvSessionLock(session.sessionId, traceId, async () => {
                const activeSession = await latestOpenTpvSession();
                if (!activeSession || activeSession.sessionId !== session.sessionId) {
                    throw new Error("TPV_SESSION_CLOSED");
                }
            const amountMinor = toMinorUnits(input.amount, "CASH_MOVEMENT");
            if (amountMinor <= 0) throw new Error("TPV_CASH_MOVEMENT_AMOUNT_INVALID");
            const reason = String(input.reason || "").trim();
            if (reason.length < 3 || reason.length > 500) throw new Error("TPV_REASON_REQUIRED");
            const key = normalizeClientIdempotencyKey(input.idempotencyKey);
            const requestedProfessionalId = String(input.profesionalId || "").trim();
            const profesionalId = requestedProfessionalId
                ? (await resolveAuthorizedProfessional(requestedProfessionalId)).resourceId
                : null;
            const { item, replayed } = await insertTpvEvent(TPV_COLLECTIONS.MOVIMIENTOS_CAJA, key, {
                sessionId: session.sessionId,
                movementType,
                amountMinor,
                paymentMethod,
                profesionalId: profesionalId || null,
                reason,
                status: "CONFIRMADO",
                createdAt: new Date(),
                payload: {
                    sessionId: session.sessionId,
                    actorId: operator.actorId,
                    operatorId: operator.operatorId,
                    profesionalId: profesionalId || null,
                    authorizedBy: movementType === "ENTRADA" ? null : operator.operatorId,
                    affectsPhysicalCash: true,
                    traceId,
                },
            });
            persisted = true;
            await appendTpvAudit({
                idempotencyKey: key + ":AUDIT",
                action: "MOVIMIENTO_CAJA_" + movementType,
                actorId: operator.operatorId,
                entityType: "MOVIMIENTO_CAJA",
                entityId: item._id || key,
                traceId,
                payload: { sessionId: session.sessionId, operatorId: operator.operatorId, amountMinor, reason },
            });
            return {
                status: "SUCCESS",
                data: buildCashMovementSuccessData({
                    item,
                    session: activeSession,
                    movementType,
                    amountMinor,
                    operator,
                    replayed,
                    timeZone: TPV_RUNTIME_POLICY.TIME_ZONE,
                }),
                error: null,
                traceId,
            };
            });
        } catch (error) {
            return buildCashMovementFailure(error, persisted, traceId);
        }
    }
);


export const obtenerMovimientosCaja = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-cash-movements-read");
        await requireCajero(traceId);

        try {
            const limit = Number(input.limit ?? 50);
            if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
                throw new Error("TPV_INVALID_MOVEMENTS_LIMIT");
            }
            const sessionId = sessionIdFromInput(input);
            const latestSession = await latestTpvSession();
            const closures = await queryTpvRecords(TPV_COLLECTIONS.TICKET_Z, undefined);
            const operationalStatus = resolveCashSessionOperationalStatus(latestSession, closures, sessionId);
            const ledger = await queryTpvLedgerRecords({ limit: 1000 });
            const visibleTypes = new Set(Object.keys(TPV_LEDGER_DISPLAY_TYPES));
            const items = ledger.records
                .filter((record) => {
                    const sourceType = String(record.cmsMovementType || "");
                    if (!visibleTypes.has(sourceType)) return false;
                    if ((sourceType === "TPV_SALE" || sourceType === "SIMULATED_TPV_SALE") && !["CONFIRMADA", "CONFIRMADA_SINTETICA"].includes(record.status)) return false;
                    const recordSessionId = String(record.sessionId || record.payload?.sessionId || "");
                    return recordSessionId === sessionId;
                })
                .map(mapMovementRecord)
                .filter(Boolean)
                .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
                .slice(0, limit);
            return {
                status: "SUCCESS",
                data: {
                    items,
                    sessionId,
                    operationalStatus,
                    integrationStatus: "NO_ENVIADO",
                    paymentStatus: "NOT_APPLICABLE",
                    now: new Date().toISOString(),
                    timeZone: TPV_RUNTIME_POLICY.TIME_ZONE,
                    truncated: ledger.hasMore,
                },
                error: null,
                traceId,
            };
        } catch (error) {
            return {
                status: "ERROR",
                data: null,
                error: { code: String(error?.message || "TPV_CASH_MOVEMENTS_READ_FAILED") },
                traceId,
            };
        }
    }
);


export const exportarMovimientosCaja = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-movements-export");
        await requireCajero(traceId);
        assertTpvOperationalLedgerConfigured();
        const operator = await resolveTpvContext(traceId);
        try {
            const sessionId = sessionIdFromInput(input);
            const idempotencyKey = normalizeClientIdempotencyKey(input.idempotencyKey);
            const collections = [
                TPV_COLLECTIONS.VENTAS,
                TPV_COLLECTIONS.MOVIMIENTOS_CAJA,
                TPV_COLLECTIONS.REEMBOLSOS,
                TPV_COLLECTIONS.TICKET_X,
                TPV_COLLECTIONS.TICKET_Z,
            ];
            const batches = await Promise.all(collections.map((collection) =>
                queryTpvRecords(collection, undefined, { limit: 1000, maxRecords: 10000 })
            ));
            const items = batches.flat()
                .filter((record) => sessionOf(record) === sessionId)
                .map(mapMovementRecord)
                .filter(Boolean)
                .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
            await appendTpvAudit({
                idempotencyKey: idempotencyKey + ":AUDIT",
                action: "CASH_MOVEMENTS_EXPORT",
                actorId: operator.operatorId,
                entityType: "TPV_EXPORT",
                entityId: sessionId,
                traceId,
                payload: {
                    sessionId,
                    operatorId: operator.operatorId,
                    createdAt: new Date(),
                    filters: { sessionId },
                    format: "CSV",
                    recordCount: items.length,
                },
            });
            return exportSuccess({
                items,
                count: items.length,
                sessionId,
                format: "CSV",
                truncated: false,
            }, traceId);
        } catch (error) {
            return exportFailure(error, "TPV_MOVEMENTS_EXPORT_FAILED", traceId);
        }
    }
);

export const exportarAuditoriaTPV = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-audit-export");
        await requireCajero(traceId);
        assertTpvOperationalLedgerConfigured();
        const operator = await resolveTpvContext(traceId);
        try {
            const sessionId = sessionIdFromInput(input);
            const idempotencyKey = normalizeClientIdempotencyKey(input.idempotencyKey);
            const [auditRecords, sales, movements, refunds, ticketsX, ticketsZ] = await Promise.all([
                queryTpvRecords(TPV_COLLECTIONS.AUDITORIA, undefined, { limit: 1000, maxRecords: 10000 }),
                queryTpvRecords(TPV_COLLECTIONS.VENTAS, undefined, { limit: 1000, maxRecords: 10000 }),
                queryTpvRecords(TPV_COLLECTIONS.MOVIMIENTOS_CAJA, undefined, { limit: 1000, maxRecords: 10000 }),
                queryTpvRecords(TPV_COLLECTIONS.REEMBOLSOS, undefined, { limit: 1000, maxRecords: 10000 }),
                queryTpvRecords(TPV_COLLECTIONS.TICKET_X, undefined, { limit: 1000, maxRecords: 10000 }),
                queryTpvRecords(TPV_COLLECTIONS.TICKET_Z, undefined, { limit: 1000, maxRecords: 10000 }),
            ]);
            const entityIds = new Set([...sales, ...movements, ...refunds, ...ticketsX, ...ticketsZ]
                .filter((record) => sessionOf(record) === sessionId)
                .flatMap((record) => [record._id, record.saleId, record.refundId, record.reportId])
                .filter(Boolean));
            const items = auditRecords
                .filter((record) => sessionOf(record) === sessionId || record.entityId === sessionId || entityIds.has(record.entityId))
                .map((record) => ({
                    auditId: record._id,
                    action: record.action || record.operationType || "UNKNOWN",
                    operatorId: record.actorId || record.operatorId || null,
                    sessionId: sessionOf(record) || (record.entityId === sessionId ? sessionId : null),
                    entityType: record.entityType || null,
                    entityId: record.entityId || null,
                    createdAt: record.occurredAt || record.createdAt || record._createdDate || null,
                    source: record.source || null,
                    traceId: record.payload?.traceId || record.traceId || null,
                    format: record.payload?.format || null,
                    filters: record.payload?.filters || null,
                    details: JSON.stringify({
                        reason: record.payload?.reason || record.reason || null,
                        amountMinor: record.payload?.amountMinor ?? record.amountMinor ?? null,
                        saleId: record.payload?.saleId || record.saleId || null,
                        refundId: record.payload?.refundId || record.refundId || null,
                        allocations: record.payload?.allocations || null,
                        recordCount: record.payload?.recordCount ?? null,
                    }),
                }))
                .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
            await appendTpvAudit({
                idempotencyKey: idempotencyKey + ":AUDIT",
                action: "AUDIT_EXPORT",
                actorId: operator.operatorId,
                entityType: "TPV_EXPORT",
                entityId: sessionId,
                traceId,
                payload: {
                    sessionId,
                    operatorId: operator.operatorId,
                    createdAt: new Date(),
                    filters: { sessionId },
                    format: "CSV",
                    recordCount: items.length,
                },
            });
            return exportSuccess({
                items,
                count: items.length,
                sessionId,
                format: "CSV",
                syntheticOnly: true,
                truncated: false,
            }, traceId);
        } catch (error) {
            return exportFailure(error, "TPV_AUDIT_EXPORT_FAILED", traceId);
        }
    }
);
