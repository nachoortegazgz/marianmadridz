import { Permissions, webMethod } from "wix-web-module";
import { requireAdmin, requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { TPV_SANDBOX_COLLECTIONS, TPV_SANDBOX_RUNTIME_POLICY } from "backend/internalConfig";
import { appendSandboxAudit, getPendingSandboxRefunds, getPendingSandboxSales, insertSandboxEvent, latestOpenSandboxSession, querySandboxRecords, withSandboxSessionLock } from "backend/tpv/tpvSandboxRepository";
import { buildSandboxSessionSummary } from "backend/tpv/tpvCierresCore";
import { fromMinorUnits, normalizeClientIdempotencyKey, toMinorUnits } from "backend/tpv/tpvUtils";
import { wql } from "backend/dataAccess";

export const obtenerResumenCaja = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-sandbox-summary");
        await requireCajero(traceId);

        try {
            const session = await latestOpenSandboxSession();
            if (!session) throw new Error("TPV_SANDBOX_SESSION_NOT_OPEN");
            if (input.sessionId && input.sessionId !== session.sessionId) throw new Error("TPV_SANDBOX_SESSION_MISMATCH");
            const totals = await buildSandboxSessionSummary(session);
            return {
                status: "SUCCESS",
                data: {
                    ...totals,
                    grossSales: fromMinorUnits(totals.grossSalesMinor),
                    netSales: fromMinorUnits(totals.netSalesMinor),
                    totalRefunds: fromMinorUnits(totals.totalRefundsMinor),
                    totalCollected: fromMinorUnits(totals.totalCollectedMinor),
                    expectedCash: fromMinorUnits(totals.expectedCashMinor),
                    breakdown: {
                        EFECTIVO: fromMinorUnits(totals.cashMinor),
                        TARJETA: fromMinorUnits(totals.cardMinor),
                        BIZUM: fromMinorUnits(totals.bizumMinor),
                        OTROS: fromMinorUnits(totals.otherMinor),
                    },
                },
                error: null,
                traceId,
            };
        } catch (error) {
            return { status: "ERROR", data: null, error: { code: String(error?.message || "TPV_SANDBOX_SUMMARY_FAILED") }, traceId };
        }
    }
);

export const generarControlX = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        let persisted = false;
        const traceId = makeTraceId("tpv-sandbox-ticket-x");
        await requireAdmin(traceId);

        try {
            const key = normalizeClientIdempotencyKey(input.idempotencyKey);
            const session = await latestOpenSandboxSession();
            if (!session) throw new Error("TPV_SANDBOX_SESSION_NOT_OPEN");
            if (input.sessionId && input.sessionId !== session.sessionId) throw new Error("TPV_SANDBOX_SESSION_MISMATCH");
            return await withSandboxSessionLock(session.sessionId, traceId, async () => {
                const activeSession = await latestOpenSandboxSession();
                if (!activeSession || activeSession.sessionId !== session.sessionId) {
                    throw new Error("TPV_SANDBOX_SESSION_CLOSED");
                }
            const totals = await buildSandboxSessionSummary(session);
            const reportId = "SANDBOX-X-" + session.sessionId + "-" + key.slice(0, 20);
            const { item, replayed } = await insertSandboxEvent(TPV_SANDBOX_COLLECTIONS.TICKET_X, key + ":TICKET_X", {
                sessionId: session.sessionId,
                reportId,
                generatedAt: new Date(),
                status: "GENERADO_SINTETICO",
                totals,
                payload: { traceId, readOnly: true, closesSession: false },
            });
            persisted = true;
            await appendSandboxAudit({
                idempotencyKey: key + ":AUDIT",
                action: "TICKET_X_SANDBOX_GENERADO",
                actorId: TPV_SANDBOX_RUNTIME_POLICY.ACTOR_ID,
                entityType: "TICKET_X",
                entityId: reportId,
                traceId,
                payload: { sessionId: session.sessionId },
            });
            return { status: "SUCCESS", data: { reportId: item.reportId, totals, replayed, closesSession: false, isSynthetic: true }, error: null, traceId };
            });
        } catch (error) {
            return { status: "ERROR", data: null, error: { code: String(error?.message || "TPV_SANDBOX_TICKET_X_FAILED") }, persisted, recoverable: persisted, isSynthetic: true, realPayment: false, traceId };
        }
    }
);

export const generarCierreZ = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        let persisted = false;
        const traceId = makeTraceId("tpv-sandbox-ticket-z");
        await requireAdmin(traceId);

        try {
            const session = await latestOpenSandboxSession();
            if (!session && input.sessionId) {
                const priorClose = await querySandboxRecords(TPV_SANDBOX_COLLECTIONS.TICKET_Z, wql.eq("sessionId", String(input.sessionId)));
                if (priorClose.length) {
                    const prior = priorClose[0];
                    const requestedCount = toMinorUnits(input.countedCash, "COUNTED_CASH");
                    if (requestedCount !== Number(prior.totals?.countedCashMinor) || String(input.differenceReason || "").trim() !== String(prior.totals?.differenceReason || "")) throw new Error("TPV_SANDBOX_IDEMPOTENCY_CONFLICT");
                            await appendSandboxAudit({
                        idempotencyKey: "SANDBOX_TICKET_Z:" + prior.sessionId + ":AUDIT",
                        action: "TICKET_Z_SANDBOX_CERRADO",
                        actorId: TPV_SANDBOX_RUNTIME_POLICY.ACTOR_ID,
                        entityType: "TICKET_Z",
                        entityId: prior.reportId,
                        traceId,
                        payload: { sessionId: prior.sessionId, replayedClose: true },
                    });
                    return {
                        status: "SUCCESS",
                        data: {
                            reportId: prior.reportId,
                            sessionId: prior.sessionId,
                            expectedCash: fromMinorUnits(Number(prior.totals?.expectedCashMinor || 0)),
                            countedCash: fromMinorUnits(Number(prior.totals?.countedCashMinor || 0)),
                            difference: fromMinorUnits(Number(prior.totals?.differenceMinor || 0)),
                            closed: prior.closed === true,
                            replayed: true,
                            isSynthetic: true,
                            realPayment: false,
                            fiscalLedgerWritten: false,
                        },
                        error: null,
                        traceId,
                    };
                }
            }
            if (!session) throw new Error("TPV_SANDBOX_SESSION_NOT_OPEN");
            return await withSandboxSessionLock(session.sessionId, traceId, async () => {
                const activeSession = await latestOpenSandboxSession();
                if (!activeSession || activeSession.sessionId !== session.sessionId) {
                    throw new Error("TPV_SANDBOX_SESSION_CLOSED");
                }
            if (input.sessionId && input.sessionId !== session.sessionId) throw new Error("TPV_SANDBOX_SESSION_MISMATCH");
            const pendingSales = await getPendingSandboxSales(session.sessionId);
            if (pendingSales.length > 0) throw new Error("TPV_SANDBOX_PENDING_SALES_PREVENT_CLOSE");
            const pendingRefunds = await getPendingSandboxRefunds(session.sessionId);
            if (pendingRefunds.length > 0) throw new Error("TPV_SANDBOX_PENDING_REFUNDS_PREVENT_CLOSE");
            const countedMinor = toMinorUnits(input.countedCash, "COUNTED_CASH");
            const totals = await buildSandboxSessionSummary(session);
            if (totals.reconciliationOk !== true) {
                throw new Error("TPV_SANDBOX_RECONCILIATION_FAILED");
            }
            const differenceMinor = countedMinor - totals.expectedCashMinor;
            const reason = String(input.differenceReason || "").trim();
            if (differenceMinor !== 0 && reason.length < 3) throw new Error("TPV_SANDBOX_COUNT_DIFFERENCE_REASON_REQUIRED");

            const existing = await querySandboxRecords(TPV_SANDBOX_COLLECTIONS.TICKET_Z, wql.eq("sessionId", session.sessionId));
            if (existing.length && existing[0].closed !== true) throw new Error("TPV_SANDBOX_Z_RECORD_INVALID");
            const idempotencyKey = "SANDBOX_TICKET_Z:" + session.sessionId;
            const reportId = "SANDBOX-Z-" + session.sessionId;
            const { item, replayed } = await insertSandboxEvent(TPV_SANDBOX_COLLECTIONS.TICKET_Z, idempotencyKey, {
                sessionId: session.sessionId,
                reportId,
                generatedAt: new Date(),
                status: "CERRADO_SINTETICO",
                closed: true,
                totals: {
                    ...totals,
                    countedCashMinor: countedMinor,
                    differenceMinor,
                    differenceReason: reason,
                    closedByMemberId: TPV_SANDBOX_RUNTIME_POLICY.ACTOR_ID,
                },
                payload: { traceId, sourceEnvironment: TPV_SANDBOX_RUNTIME_POLICY.ENVIRONMENT, immutableAfterCreation: true },
            });
            persisted = true;
            await appendSandboxAudit({
                idempotencyKey: idempotencyKey + ":AUDIT",
                action: "TICKET_Z_SANDBOX_CERRADO",
                actorId: TPV_SANDBOX_RUNTIME_POLICY.ACTOR_ID,
                entityType: "TICKET_Z",
                entityId: reportId,
                traceId,
                payload: { sessionId: session.sessionId, differenceMinor },
            });
            return {
                status: "SUCCESS",
                data: {
                    reportId: item.reportId,
                    sessionId: session.sessionId,
                    expectedCash: fromMinorUnits(totals.expectedCashMinor),
                    countedCash: fromMinorUnits(countedMinor),
                    difference: fromMinorUnits(differenceMinor),
                    replayed,
                    closed: true,
                    isSynthetic: true,
                    realPayment: false,
                    fiscalLedgerWritten: false,
                },
                error: null,
                traceId,
            };
            });
        } catch (error) {
            return { status: "ERROR", data: null, error: { code: String(error?.message || "TPV_SANDBOX_TICKET_Z_FAILED") }, persisted, recoverable: persisted, isSynthetic: true, realPayment: false, traceId };
        }
    }
);
