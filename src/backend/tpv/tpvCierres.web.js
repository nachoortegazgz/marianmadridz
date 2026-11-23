import { Permissions, webMethod } from "wix-web-module";
import { resolveTpvContext } from "backend/tpv/tpvContext";
import { requireAdmin, requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { TPV_COLLECTIONS, TPV_RUNTIME_POLICY } from "backend/internalConfig";
import { appendTpvAudit, getPendingTpvRefunds, getPendingTpvSales, insertTpvEvent, latestOpenTpvSession, queryTpvRecords, withTpvSessionLock } from "backend/tpv/tpvRepository";
import { buildSandboxSessionSummary } from "backend/tpv/tpvCierresCore";
import { fromMinorUnits, makeRequestFingerprint, normalizeClientIdempotencyKey, toMinorUnits } from "backend/tpv/tpvUtils";
import { wql } from "backend/dataAccess";

export const obtenerResumenCaja = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-sandbox-summary");
        await requireCajero(traceId);

        try {
            const session = await latestOpenTpvSession();
            if (!session) throw new Error("TPV_SESSION_NOT_OPEN");
            if (input.sessionId && input.sessionId !== session.sessionId) throw new Error("TPV_SESSION_MISMATCH");
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
                        BONO: fromMinorUnits(totals.bonoMinor),
                        TARJETA_REGALO: fromMinorUnits(totals.giftCardMinor),
                        OTROS: fromMinorUnits(totals.otherMinor),
                    },
                },
                error: null,
                traceId,
            };
        } catch (error) {
            return { status: "ERROR", data: null, error: { code: String(error?.message || "TPV_SUMMARY_FAILED") }, traceId };
        }
    }
);

export const generarControlX = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        let persisted = false;
        const traceId = makeTraceId("tpv-sandbox-ticket-x");
        await requireAdmin(traceId);
        const operator = await resolveTpvContext(traceId);

        try {
            const key = normalizeClientIdempotencyKey(input.idempotencyKey);
            const session = await latestOpenTpvSession();
            if (!session) throw new Error("TPV_SESSION_NOT_OPEN");
            if (input.sessionId && input.sessionId !== session.sessionId) throw new Error("TPV_SESSION_MISMATCH");
            return await withTpvSessionLock(session.sessionId, traceId, async () => {
                const activeSession = await latestOpenTpvSession();
                if (!activeSession || activeSession.sessionId !== session.sessionId) {
                    throw new Error("TPV_SESSION_CLOSED");
                }
            const totals = await buildSandboxSessionSummary(session);
            const reportId = "TPV-X-" + session.sessionId + "-" + key.slice(0, 20);
            const { item, replayed } = await insertTpvEvent(TPV_COLLECTIONS.TICKET_X, key + ":TICKET_X", {
                sessionId: session.sessionId,
                reportId,
                generatedAt: new Date(),
                status: "GENERADO",
                sourceType: TPV_RUNTIME_POLICY.SOURCE_TYPE,
                totals,
                payload: { traceId, readOnly: true, closesSession: false },
            });
            persisted = true;
            await appendTpvAudit({
                idempotencyKey: key + ":AUDIT",
                action: "TICKET_X_GENERATED",
                actorId: operator.operatorId,
                entityType: "TICKET_X",
                entityId: reportId,
                traceId,
                payload: { sessionId: session.sessionId },
            });
            return { status: "SUCCESS", data: { reportId: item.reportId, totals, replayed, closesSession: false, isSynthetic: true }, error: null, traceId };
            });
        } catch (error) {
            return { status: "ERROR", data: null, error: { code: String(error?.message || "TPV_TICKET_X_FAILED") }, persisted, recoverable: persisted, isSynthetic: true, realPayment: false, traceId };
        }
    }
);

export const generarCierreZ = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        let persisted = false;
        const traceId = makeTraceId("tpv-sandbox-ticket-z");
        await requireAdmin(traceId);
        const operator = await resolveTpvContext(traceId);

        try {
            const clientIdempotencyKey = normalizeClientIdempotencyKey(input.idempotencyKey);
            const session = await latestOpenTpvSession();
            if (!session && input.sessionId) {
                const priorClose = await queryTpvRecords(TPV_COLLECTIONS.TICKET_Z, wql.eq("sessionId", String(input.sessionId)));
                if (priorClose.length) {
                    const prior = priorClose[0];
                    const requestedCount = toMinorUnits(input.countedCash, "COUNTED_CASH");
                    const requestedReason = String(input.differenceReason || "").trim();
                    const requestFingerprint = makeRequestFingerprint({
                        sessionId: String(input.sessionId),
                        countedCashMinor: requestedCount,
                        differenceReason: requestedReason,
                    });
                    if (prior.requestFingerprint) {
                        if (prior.requestFingerprint !== requestFingerprint) throw new Error("TPV_IDEMPOTENCY_CONFLICT");
                        if (prior.clientIdempotencyKey === clientIdempotencyKey &&
                            prior.requestFingerprint !== requestFingerprint) throw new Error("TPV_IDEMPOTENCY_CONFLICT");
                    } else if (
                        requestedCount !== Number(prior.totals?.countedCashMinor) ||
                        requestedReason !== String(prior.totals?.differenceReason || "")
                    ) {
                        throw new Error("TPV_IDEMPOTENCY_CONFLICT");
                    }
                    await appendTpvAudit({
                        idempotencyKey: "TICKET_Z:" + TPV_RUNTIME_POLICY.SITE_ID + ":" + prior.sessionId + ":AUDIT",
                        action: "TICKET_Z_CLOSED",
                        actorId: operator.operatorId,
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
            if (!session) throw new Error("TPV_SESSION_NOT_OPEN");
            return await withTpvSessionLock(session.sessionId, traceId, async () => {
                const activeSession = await latestOpenTpvSession();
                if (!activeSession || activeSession.sessionId !== session.sessionId) {
                    throw new Error("TPV_SESSION_CLOSED");
                }
            if (input.sessionId && input.sessionId !== session.sessionId) throw new Error("TPV_SESSION_MISMATCH");
            const pendingSales = await getPendingTpvSales(session.sessionId);
            if (pendingSales.length > 0) throw new Error("TPV_PENDING_SALES_PREVENT_CLOSE");
            const pendingRefunds = await getPendingTpvRefunds(session.sessionId);
            if (pendingRefunds.length > 0) throw new Error("TPV_PENDING_REFUNDS_PREVENT_CLOSE");
            const countedMinor = toMinorUnits(input.countedCash, "COUNTED_CASH");
            const totals = await buildSandboxSessionSummary(session);
            if (totals.reconciliationOk !== true) {
                throw new Error("TPV_RECONCILIATION_FAILED");
            }
            const differenceMinor = countedMinor - totals.expectedCashMinor;
            const reason = String(input.differenceReason || "").trim();
            if (differenceMinor !== 0 && reason.length < 3) throw new Error("TPV_COUNT_DIFFERENCE_REASON_REQUIRED");
            const requestFingerprint = makeRequestFingerprint({
                sessionId: session.sessionId,
                countedCashMinor: countedMinor,
                differenceReason: reason,
            });

            const existing = await queryTpvRecords(TPV_COLLECTIONS.TICKET_Z, wql.eq("sessionId", session.sessionId));
            if (existing.length) {
                const prior = existing[0];
                if (prior.closed !== true) throw new Error("TPV_Z_RECORD_INVALID");
                if (prior.requestFingerprint && prior.requestFingerprint !== requestFingerprint) {
                    throw new Error("TPV_IDEMPOTENCY_CONFLICT");
                }
                if (!prior.requestFingerprint && (
                    Number(prior.totals?.countedCashMinor) !== countedMinor ||
                    String(prior.totals?.differenceReason || "") !== reason
                )) throw new Error("TPV_IDEMPOTENCY_CONFLICT");
                return {
                    status: "SUCCESS",
                    data: {
                        reportId: prior.reportId,
                        sessionId: prior.sessionId,
                        expectedCash: fromMinorUnits(Number(prior.totals?.expectedCashMinor || 0)),
                        countedCash: fromMinorUnits(Number(prior.totals?.countedCashMinor || 0)),
                        difference: fromMinorUnits(Number(prior.totals?.differenceMinor || 0)),
                        replayed: true,
                        closed: true,
                        isSynthetic: true,
                        realPayment: false,
                        fiscalLedgerWritten: false,
                    },
                    error: null,
                    traceId,
                };
            }
            const idempotencyKey = "TICKET_Z:" + TPV_RUNTIME_POLICY.SITE_ID + ":" + session.sessionId;
            const reportId = "Z-" + session.sessionId;
            const { item, replayed } = await insertTpvEvent(TPV_COLLECTIONS.TICKET_Z, idempotencyKey, {
                sessionId: session.sessionId,
                reportId,
                generatedAt: new Date(),
                status: "CERRADO",
                sourceType: TPV_RUNTIME_POLICY.SOURCE_TYPE,
                closed: true,
                clientIdempotencyKey,
                requestFingerprint,
                totals: {
                    ...totals,
                    countedCashMinor: countedMinor,
                    differenceMinor,
                    differenceReason: reason,
                    closedByMemberId: operator.operatorId,
                    actorId: operator.actorId,
                    operatorId: operator.operatorId,
                },
                payload: { traceId, sourceType: TPV_RUNTIME_POLICY.SOURCE_TYPE, siteId: operator.siteId, sessionId: session.sessionId, immutableAfterCreation: true },
            });
            persisted = true;
            await appendTpvAudit({
                idempotencyKey: idempotencyKey + ":AUDIT",
                action: "TICKET_Z_CLOSED",
                actorId: operator.operatorId,
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
            return { status: "ERROR", data: null, error: { code: String(error?.message || "TPV_TICKET_Z_FAILED") }, persisted, recoverable: persisted, isSynthetic: true, realPayment: false, traceId };
        }
    }
);
