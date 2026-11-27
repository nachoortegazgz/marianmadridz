import { Permissions, webMethod } from "wix-web-module";
import { resolveTpvContext } from "backend/tpv/tpvContext";
import { requireAdmin, requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { TPV_COLLECTIONS, TPV_RUNTIME_POLICY } from "backend/internalConfig";
import { appendTpvAudit, assertTpvOperationalLedgerConfigured, getPendingTpvRefunds, getPendingTpvSales, insertTpvEvent, latestOpenTpvSession, latestTpvSession, queryTpvRecords, withTpvSessionLock } from "backend/tpv/tpvRepository";
import { buildTpvSessionSummary } from "backend/tpv/tpvCierresCore";
import { fromMinorUnits, makeRequestFingerprint, normalizeClientIdempotencyKey, toMinorUnits } from "backend/tpv/tpvUtils";
import { wql } from "backend/dataAccess";
import { normalizeTpvError } from "backend/tpv/tpvError";

export const obtenerResumenCaja = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-session-summary");

        try {
            await requireCajero(traceId);
            const requestedSessionId = String(input.sessionId || "").trim();
            if (!requestedSessionId) throw new Error("TPV_SESSION_REQUIRED");
            const session = await latestOpenTpvSession();
            if (!session) {
                const latest = await latestTpvSession();
                throw new Error(latest?.status === "CERRADA" ? "TPV_SESSION_CLOSED" : "TPV_SESSION_NOT_OPEN");
            }
            if (requestedSessionId !== session.sessionId) throw new Error("TPV_SESSION_MISMATCH");
            const totals = await buildTpvSessionSummary(session);
            return {
                status: "SUCCESS",
                data: {
                    ...totals,
                    sessionId: session.sessionId,
                    operationalStatus: "ABIERTA",
                    integrationStatus: "NO_ENVIADO",
                    paymentStatus: "NOT_APPLICABLE",
                    now: new Date().toISOString(),
                    timeZone: TPV_RUNTIME_POLICY.TIME_ZONE,
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
            return { status: "ERROR", data: null, error: normalizeTpvError(error, "TPV_SUMMARY_FAILED"), traceId };
        }
    }
);

export const generarTicketX = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-ticket-x");

        try {
            await requireAdmin(traceId);
            assertTpvOperationalLedgerConfigured("audit");
            const operator = await resolveTpvContext(traceId);
            const sessionId = String(input.sessionId || "").trim();
            if (!sessionId) throw new Error("TPV_SESSION_REQUIRED");
            const session = await latestOpenTpvSession();
            if (!session || session.sessionId !== sessionId) {
                const latest = await latestTpvSession();
                throw new Error(latest?.status === "CERRADA" ? "TPV_SESSION_CLOSED" : "TPV_SESSION_NOT_OPEN");
            }
            return await withTpvSessionLock(sessionId, traceId, async () => {
                const activeSession = await latestOpenTpvSession();
                if (!activeSession || activeSession.sessionId !== sessionId) throw new Error("TPV_SESSION_CLOSED");
                const totals = await buildTpvSessionSummary(activeSession);
                const [sales, movements] = await Promise.all([
                    queryTpvRecords(TPV_COLLECTIONS.VENTAS, wql.eq("sessionId", sessionId)),
                    queryTpvRecords(TPV_COLLECTIONS.MOVIMIENTOS_CAJA, wql.eq("sessionId", sessionId)),
                ]);
                const generatedAt = new Date();
                const ticketX = {
                    reportId: "TPV-X-" + sessionId,
                    reportType: "CONTROL_PARCIAL",
                    sessionId,
                    businessDate: new Intl.DateTimeFormat("en-CA", {
                        timeZone: TPV_RUNTIME_POLICY.TIME_ZONE,
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                    }).format(generatedAt),
                    generatedAt,
                    generatedBy: {
                        operatorId: operator.operatorId,
                        displayName: operator.operatorDisplayName,
                    },
                    sessionOpenedAt: activeSession.openedAt || null,
                    sessionOperator: {
                        operatorId: activeSession.operatorId || activeSession.cashierMemberId || null,
                        displayName: activeSession.operatorDisplayName || null,
                    },
                    openingCash: fromMinorUnits(Number(activeSession.openingCashMinor || 0)),
                    expectedCash: fromMinorUnits(Number(totals.expectedCashMinor || 0)),
                    totales: {
                        totalVentas: fromMinorUnits(totals.grossSalesMinor),
                        totalEfectivo: fromMinorUnits(totals.cashMinor),
                        totalTarjeta: fromMinorUnits(totals.cardMinor),
                        totalOtros: fromMinorUnits(
                            totals.bizumMinor + totals.bonoMinor + totals.giftCardMinor + totals.otherMinor
                        ),
                    },
                    desglose: {
                        EFECTIVO: fromMinorUnits(totals.cashMinor),
                        TARJETA: fromMinorUnits(totals.cardMinor),
                        BIZUM: fromMinorUnits(totals.bizumMinor),
                        BONO: fromMinorUnits(totals.bonoMinor),
                        TARJETA_REGALO: fromMinorUnits(totals.giftCardMinor),
                        OTROS: fromMinorUnits(totals.otherMinor),
                    },
                    nOperaciones: sales.length + movements.length,
                };
                const snapshotFingerprint = makeRequestFingerprint({
                    sessionId,
                    totals,
                    nOperaciones: sales.length + movements.length,
                    generatedBy: operator.operatorId,
                });
                const audit = await appendTpvAudit({
                    idempotencyKey: "TICKET_X:" + sessionId + ":" + snapshotFingerprint.slice(0, 32),
                    action: "TICKET_X_GENERATED",
                    actorId: operator.operatorId,
                    entityType: "TICKET_X",
                    entityId: "TPV-X-" + sessionId,
                    traceId,
                    payload: { ticketX, readOnly: true, closesSession: false, fiscalLedgerWritten: false },
                });
                const ticketXResult = {
                    ...(audit.item?.payload?.ticketX || ticketX),
                    timestamp: audit.item?.processedAt || new Date(),
                };
                return {
                    status: "SUCCESS",
                    ticketX: ticketXResult,
                    data: { ticketX: ticketXResult, replayed: audit.replayed },
                    error: null,
                    replayed: audit.replayed,
                    traceId,
                };
            });
        } catch (error) {
            return {
                status: "ERROR",
                ticketX: null,
                data: null,
                error: normalizeTpvError(error, "TPV_TICKET_X_FAILED"),
                traceId,
            };
        }
    }
);

export const generarCierreZ = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        let persisted = false;
        const traceId = makeTraceId("tpv-ticket-z");

        try {
            await requireAdmin(traceId);
            assertTpvOperationalLedgerConfigured("physical");
            const operator = await resolveTpvContext(traceId);
            const clientIdempotencyKey = normalizeClientIdempotencyKey(input.idempotencyKey);
            const requestedSessionId = String(input.sessionId || "").trim();
            if (!requestedSessionId) throw new Error("TPV_SESSION_REQUIRED");
            const session = await latestOpenTpvSession();
            if (!session && requestedSessionId) {
                const priorClose = await queryTpvRecords(TPV_COLLECTIONS.TICKET_Z, wql.eq("sessionId", requestedSessionId));
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
                            operationalStatus: "CERRADA",
                            operatorId: operator.operatorId,
                            actorId: operator.actorId,
                            integrationStatus: "NO_ENVIADO",
                            paymentStatus: "NOT_APPLICABLE",
                            now: new Date().toISOString(),
                            timeZone: TPV_RUNTIME_POLICY.TIME_ZONE,
                            replayed: true,
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
            const totals = await buildTpvSessionSummary(session);
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
                    operationalStatus: "CERRADA",
                    operatorId: operator.operatorId,
                    actorId: operator.actorId,
                    integrationStatus: "NO_ENVIADO",
                    paymentStatus: "NOT_APPLICABLE",
                    now: new Date().toISOString(),
                    timeZone: TPV_RUNTIME_POLICY.TIME_ZONE,
                    fiscalLedgerWritten: false,
                },
                error: null,
                traceId,
            };
            });
        } catch (error) {
            return { status: "ERROR", data: null, error: normalizeTpvError(error, "TPV_TICKET_Z_FAILED"), persisted, recoverable: persisted, traceId };
        }
    }
);
