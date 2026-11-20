import { Permissions, webMethod } from "wix-web-module";
import { getMyStaffContext, requireAdmin, requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { TPV_QA_COLLECTIONS, TPV_QA_RUNTIME_POLICY } from "backend/internalConfig";
import { appendQaAudit, insertQaEvent, latestOpenQaSession, queryQaRecords } from "backend/tpv/tpvQaRepository";
import { buildQaSessionSummary } from "backend/tpv/tpvCierresCore";
import { assertTpvQaEnabled, fromMinorUnits, normalizeClientIdempotencyKey, toMinorUnits } from "backend/tpv/tpvUtils";
import { wql } from "backend/dataAccess";

export const obtenerResumenSesion = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-qa-summary");
        await requireCajero(traceId);
        assertTpvQaEnabled();
        try {
            const session = await latestOpenQaSession();
            if (!session) throw new Error("TPV_QA_SESSION_NOT_OPEN");
            if (input.sessionId && input.sessionId !== session.sessionId) throw new Error("TPV_QA_SESSION_MISMATCH");
            const totals = await buildQaSessionSummary(session);
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
            return { status: "ERROR", data: null, error: { code: String(error?.message || "TPV_QA_SUMMARY_FAILED") }, traceId };
        }
    }
);

export const generarTicketX = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-qa-ticket-x");
        await requireCajero(traceId);
        assertTpvQaEnabled();
        try {
            const key = normalizeClientIdempotencyKey(input.idempotencyKey);
            const session = await latestOpenQaSession();
            if (!session) throw new Error("TPV_QA_SESSION_NOT_OPEN");
            const totals = await buildQaSessionSummary(session);
            const reportId = "QA-X-" + session.sessionId + "-" + key.slice(0, 20);
            const { item, replayed } = await insertQaEvent(TPV_QA_COLLECTIONS.TICKET_X, key + ":TICKET_X", {
                sessionId: session.sessionId,
                reportId,
                generatedAt: new Date(),
                status: "GENERADO_SINTETICO",
                totals,
                payload: { traceId, readOnly: true, closesSession: false },
            });
            const staff = await getMyStaffContext(traceId);
            await appendQaAudit({
                idempotencyKey: key + ":AUDIT",
                action: "TICKET_X_QA_GENERADO",
                actorId: staff?.memberId || "UNKNOWN",
                entityType: "TICKET_X",
                entityId: reportId,
                traceId,
                payload: { sessionId: session.sessionId },
            });
            return { status: "SUCCESS", data: { reportId: item.reportId, totals, replayed, closesSession: false, isSynthetic: true }, error: null, traceId };
        } catch (error) {
            return { status: "ERROR", data: null, error: { code: String(error?.message || "TPV_TICKET_X_FAILED") }, traceId };
        }
    }
);

export const cerrarTicketZ = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-qa-ticket-z");
        await requireAdmin(traceId);
        assertTpvQaEnabled();
        try {
            const session = await latestOpenQaSession();
            if (!session && input.sessionId) {
                const priorClose = await queryQaRecords(TPV_QA_COLLECTIONS.TICKET_Z, wql.eq("sessionId", String(input.sessionId)));
                if (priorClose.length) {
                    const prior = priorClose[0];
                    const requestedCount = toMinorUnits(input.countedCash, "COUNTED_CASH");
                    if (requestedCount !== Number(prior.totals?.countedCashMinor) || String(input.differenceReason || "").trim() !== String(prior.totals?.differenceReason || "")) throw new Error("TPV_QA_IDEMPOTENCY_CONFLICT");
                    const staff = await getMyStaffContext(traceId);
                    await appendQaAudit({
                        idempotencyKey: "TICKET_Z:" + prior.sessionId + ":AUDIT",
                        action: "TICKET_Z_QA_CERRADO",
                        actorId: staff?.memberId || "UNKNOWN",
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
            if (!session) throw new Error("TPV_QA_SESSION_NOT_OPEN");
            if (input.sessionId && input.sessionId !== session.sessionId) throw new Error("TPV_QA_SESSION_MISMATCH");
            const countedMinor = toMinorUnits(input.countedCash, "COUNTED_CASH");
            const totals = await buildQaSessionSummary(session);
            const differenceMinor = countedMinor - totals.expectedCashMinor;
            const reason = String(input.differenceReason || "").trim();
            if (differenceMinor !== 0 && reason.length < 3) throw new Error("TPV_QA_CLOSING_DIFFERENCE_REASON_REQUIRED");

            const existing = await queryQaRecords(TPV_QA_COLLECTIONS.TICKET_Z, wql.eq("sessionId", session.sessionId));
            if (existing.length && existing[0].closed !== true) throw new Error("TPV_QA_Z_RECORD_INVALID");
            const staff = await getMyStaffContext(traceId);
            const idempotencyKey = "TICKET_Z:" + session.sessionId;
            const reportId = "QA-Z-" + session.sessionId;
            const { item, replayed } = await insertQaEvent(TPV_QA_COLLECTIONS.TICKET_Z, idempotencyKey, {
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
                    closedByMemberId: staff?.memberId || "UNKNOWN",
                },
                payload: { traceId, sourceEnvironment: TPV_QA_RUNTIME_POLICY.ENVIRONMENT, immutableAfterCreation: true },
            });
            await appendQaAudit({
                idempotencyKey: idempotencyKey + ":AUDIT",
                action: "TICKET_Z_QA_CERRADO",
                actorId: staff?.memberId || "UNKNOWN",
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
        } catch (error) {
            return { status: "ERROR", data: null, error: { code: String(error?.message || "TPV_TICKET_Z_FAILED") }, traceId };
        }
    }
);
