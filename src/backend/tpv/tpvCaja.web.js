import { Permissions, webMethod } from "wix-web-module";
import { resolveTpvContext } from "backend/tpv/tpvContext";
import { requireAdmin, requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { TPV_COLLECTIONS, TPV_RUNTIME_POLICY } from "backend/internalConfig";
import { appendTpvAudit, initializeTpvCaja, insertTpvEvent, latestOpenTpvSession, latestTpvSession, queryTpvRecords, withTpvSessionLock } from "backend/tpv/tpvRepository";
import { buildTpvSessionSummary } from "backend/tpv/tpvCierresCore";
import { wql } from "backend/dataAccess";
import { fromMinorUnits, makeSyntheticPayload, normalizeClientIdempotencyKey, toMinorUnits } from "backend/tpv/tpvUtils";

function errorResult(code) {
    return { status: "ERROR", data: null, error: { code }, persisted: false, realPayment: false };
}

const OPERATIONAL_CASH_STATUS = Object.freeze({
    OPEN: "ABIERTA",
    CLOSED: "CERRADA",
    NONE: "SIN_SESION",
});

function operationalStatus(value) {
    const status = String(value || "").toUpperCase();
    if (status === OPERATIONAL_CASH_STATUS.OPEN) return OPERATIONAL_CASH_STATUS.OPEN;
    if (status === OPERATIONAL_CASH_STATUS.CLOSED) return OPERATIONAL_CASH_STATUS.CLOSED;
    return OPERATIONAL_CASH_STATUS.NONE;
}

function responseClock() {
    return { now: new Date().toISOString(), timeZone: TPV_RUNTIME_POLICY.TIME_ZONE };
}

function madridDayKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: TPV_RUNTIME_POLICY.TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return values.year + values.month + values.day;
}

export const inicializarCaja = webMethod(
    Permissions.SiteMember,
    async () => {
        const traceId = makeTraceId("tpv-bootstrap");
        await requireCajero(traceId);

        try {
            const result = await initializeTpvCaja();
            return {
                status: "SUCCESS",
                data: {
                    initialized: result.created,
                    cashRegisterStatus: result.item.cashRegisterStatus,
                    snapshotSource: result.item.snapshotSource,
                },
                error: null,
                traceId,
                isSynthetic: true,
                realPayment: false,
            };
        } catch (error) {
            return {
                status: "ERROR",
                data: null,
                error: { code: String(error?.message || "TPV_BOOTSTRAP_FAILED") },
                traceId,
                persisted: false,
                isSynthetic: true,
                realPayment: false,
            };
        }
    }
);

export const obtenerEstadoCaja = webMethod(
    Permissions.SiteMember,
    async () => {
        const traceId = makeTraceId("tpv-session-read");
        await requireCajero(traceId);

        const operator = await resolveTpvContext(traceId);
        const session = await latestTpvSession();
        if (!session) {
            return {
                status: "SUCCESS",
                data: {
                    status: OPERATIONAL_CASH_STATUS.NONE,
                    operationalStatus: OPERATIONAL_CASH_STATUS.NONE,
                    sessionId: null,
                    operatorId: null,
                    actorId: null,
                    integrationStatus: "NO_ENVIADO",
                    ...responseClock(),
                },
                error: null,
                traceId,
                isSynthetic: true,
                realPayment: false,
            };
        }
        const status = operationalStatus(session.status);
        const summary = status === OPERATIONAL_CASH_STATUS.OPEN
            ? await buildTpvSessionSummary(session)
            : null;
        return {
            status: "SUCCESS",
            data: {
                sessionId: session.sessionId,
                status,
                operationalStatus: status,
                operatorId: session.operatorId || session.cashierMemberId || operator.operatorId,
                actorId: session.actorId || session.operatorId || session.cashierMemberId || operator.actorId,
                openingCash: fromMinorUnits(Number(session.openingCashMinor || 0)),
                expectedCash: summary ? fromMinorUnits(summary.expectedCashMinor) : null,
                cashAmount: summary ? fromMinorUnits(summary.cashMinor) : null,
                cardAmount: summary ? fromMinorUnits(summary.cardMinor) : null,
                bizumAmount: summary ? fromMinorUnits(summary.bizumMinor) : null,
                otherAmount: summary ? fromMinorUnits(summary.otherMinor) : null,
                totalOperations: summary?.ticketCount ?? null,
                openedAt: session.openedAt,
                closedAt: session.closedAt || null,
                integrationStatus: "NO_ENVIADO",
                ...responseClock(),
                isSynthetic: true,
                realPayment: false,
            },
            error: null,
            traceId,
        };
    }
);

export const abrirSesionCaja = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        let persisted = false;
        const traceId = makeTraceId("tpv-session-open");
        await requireAdmin(traceId);
        const operator = await resolveTpvContext(traceId);

        try {
            const openingCashMinor = toMinorUnits(input.openingCash, "OPENING_CASH");
            const dayKey = madridDayKey();
            const sessionId = "TPV-SESSION-" + dayKey;
            return await withTpvSessionLock(sessionId, traceId, async () => {
                const idempotencyKey = "SESSION_OPEN:" + dayKey;
                const current = await latestOpenTpvSession();
                if (current && current.sessionId !== sessionId) return errorResult("TPV_PREVIOUS_SESSION_NOT_CLOSED");
                const alreadyClosed = await queryTpvRecords(TPV_COLLECTIONS.TICKET_Z, wql.eq("sessionId", sessionId));
                if (alreadyClosed.some((item) => item.closed === true)) return errorResult("TPV_SESSION_ALREADY_CLOSED_TODAY");
                const { item, replayed } = await insertTpvEvent(
                    TPV_COLLECTIONS.SESIONES_CAJA,
                    idempotencyKey,
                    {
                        sessionId,
                        status: "ABIERTA",
                        openedAt: new Date(),
                        openingCashMinor,
                        expectedCashMinor: openingCashMinor,
                        cashierMemberId: operator.operatorId,
                        actorId: operator.actorId,
                        operatorId: operator.operatorId,
                        operatorResourceId: operator.operatorResourceId,
                        payload: makeSyntheticPayload({
                            dayKey,
                            openingReason: String(input.reason || "Apertura de TPV").slice(0, 200),
                            traceId,
                            terminalId: String(input.terminalId || "TPV").slice(0, 80),
                        }),
                    }
                );
                persisted = true;
                await insertTpvEvent(TPV_COLLECTIONS.AUDITORIA, idempotencyKey + ":AUDIT", {
                    action: "APERTURA_CAJA",
                    actorId: operator.operatorId,
                    entityType: "SESION_CAJA",
                    entityId: sessionId,
                    occurredAt: new Date(),
                    source: "TPV_WEB_METHOD",
                    payload: makeSyntheticPayload({ traceId, replayed, sessionId }),
                });
                return {
                    status: "SUCCESS",
                    data: {
                        sessionId: item.sessionId,
                        status: item.status,
                        operationalStatus: OPERATIONAL_CASH_STATUS.OPEN,
                        operatorId: operator.operatorId,
                        actorId: operator.actorId,
                        openingCash: fromMinorUnits(openingCashMinor),
                        openedAt: item.openedAt,
                        integrationStatus: "NO_ENVIADO",
                        ...responseClock(),
                        replayed,
                        persisted: true,
                        isSynthetic: true,
                        realPayment: false,
                    },
                    error: null,
                    traceId,
                };
            });

        } catch (error) {
            return { ...errorResult(String(error?.message || "TPV_SESSION_OPEN_FAILED")), persisted, recoverable: persisted, isSynthetic: true };
        }
    }
);

export const registrarArqueoParcial = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        let persisted = false;
        const traceId = makeTraceId("tpv-partial-count");
        await requireAdmin(traceId);
        const operator = await resolveTpvContext(traceId);

        try {
            const requestedSessionId = String(input.sessionId || "").trim();
            if (!requestedSessionId) throw new Error("TPV_SESSION_REQUIRED");
            const session = await latestOpenTpvSession();
            if (!session) {
                const latest = await latestTpvSession();
                return errorResult(latest?.status === "CERRADA" ? "TPV_SESSION_CLOSED" : "TPV_SESSION_NOT_OPEN");
            }
            if (requestedSessionId !== session.sessionId) throw new Error("TPV_SESSION_MISMATCH");

            return await withTpvSessionLock(session.sessionId, traceId, async () => {
                const activeSession = await latestOpenTpvSession();
                if (!activeSession || activeSession.sessionId !== session.sessionId) {
                    throw new Error("TPV_SESSION_CLOSED");
                }
            const countedMinor = toMinorUnits(input.countedCash, "COUNTED_CASH");
            const summary = await buildTpvSessionSummary(session);
            const expectedMinor = Number(summary.expectedCashMinor || 0);
            const differenceMinor = countedMinor - expectedMinor;
            const reason = differenceMinor === 0 ? "" : String(input.reason || "").trim();
            if (differenceMinor !== 0 && reason.length < 3) {
                throw new Error("TPV_COUNT_DIFFERENCE_REASON_REQUIRED");
            }
            const key = normalizeClientIdempotencyKey(input.idempotencyKey);
            const { item, replayed } = await insertTpvEvent(
                TPV_COLLECTIONS.MOVIMIENTOS_CAJA,
                key,
                {
                    sessionId: session.sessionId,
                    movementType: "ARQUEO_PARCIAL",
                    amountMinor: countedMinor,
                    paymentMethod: "EFECTIVO",
                    reason,
                    status: "REGISTRADO_SINTETICO",
                    createdAt: new Date(),
                    payload: makeSyntheticPayload({
                        expectedCashMinor: expectedMinor,
                        countedCashMinor: countedMinor,
                        differenceMinor,
                        actorId: operator.operatorId,
                        traceId,
                    }),
                }
            );
            persisted = true;
            await appendTpvAudit({
                idempotencyKey: key + ":AUDIT",
                action: "ARQUEO_PARCIAL",
                actorId: operator.operatorId,
                entityType: "ARQUEO_CAJA",
                entityId: session.sessionId,
                traceId,
                payload: { sessionId: session.sessionId, expectedMinor, countedMinor, differenceMinor, reason },
            });
            return {
                status: "SUCCESS",
                data: {
                    movementId: item._id,
                    sessionId: session.sessionId,
                    difference: fromMinorUnits(differenceMinor),
                    operatorId: operator.operatorId,
                    actorId: operator.actorId,
                    operationalStatus: "ABIERTA",
                    integrationStatus: "NO_ENVIADO",
                    now: new Date().toISOString(),
                    timeZone: TPV_RUNTIME_POLICY.TIME_ZONE,
                    replayed,
                    persisted: true,
                    isSynthetic: true,
                    realPayment: false,
                },
                error: null,
                traceId,
            };
            });
        } catch (error) {
            return { ...errorResult(String(error?.message || "TPV_PARTIAL_COUNT_FAILED")), persisted, recoverable: persisted, isSynthetic: true };
        }
    }
);
