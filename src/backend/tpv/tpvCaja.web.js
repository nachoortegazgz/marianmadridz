import { Permissions, webMethod } from "wix-web-module";
import { resolveTpvContext } from "backend/tpv/tpvContext";
import { requireAdmin, requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { TPV_COLLECTIONS, TPV_RUNTIME_POLICY } from "backend/internalConfig";
import { appendTpvAudit, initializeTpvCaja, seedTpvIdentities, insertTpvEvent, latestOpenTpvSession, queryTpvRecords, withTpvSessionLock } from "backend/tpv/tpvRepository";
import { buildSandboxSessionSummary } from "backend/tpv/tpvCierresCore";
import { wql } from "backend/dataAccess";
import { fromMinorUnits, makeSyntheticPayload, normalizeClientIdempotencyKey, toMinorUnits } from "backend/tpv/tpvUtils";

function errorResult(code) {
    return { status: "ERROR", data: null, error: { code }, persisted: false, realPayment: false };
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
        const traceId = makeTraceId("tpv-sandbox-bootstrap");
        await requireCajero(traceId);

        try {
            const result = await initializeTpvCaja();
            const identities = await seedTpvIdentities();
            return {
                status: "SUCCESS",
                data: {
                    sandboxReady: true,
                    initialized: result.created,
                    identitiesCreated: identities.created,
                    identitiesTotal: identities.total,
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
        const traceId = makeTraceId("tpv-sandbox-session-read");
        await requireCajero(traceId);

        const session = await latestOpenTpvSession();
        if (!session) return { status: "SUCCESS", data: null, error: null, traceId };
        const summary = await buildSandboxSessionSummary(session);
        return {
            status: "SUCCESS",
            data: {
                sessionId: session.sessionId,
                status: "ABIERTA",
                openingCash: fromMinorUnits(Number(session.openingCashMinor || 0)),
                expectedCash: fromMinorUnits(summary.expectedCashMinor),
                cashAmount: fromMinorUnits(summary.cashMinor),
                cardAmount: fromMinorUnits(summary.cardMinor),
                bizumAmount: fromMinorUnits(summary.bizumMinor),
                otherAmount: fromMinorUnits(summary.otherMinor),
                totalOperations: summary.ticketCount,
                openedAt: session.openedAt,
                isSynthetic: true,
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
        const traceId = makeTraceId("tpv-sandbox-session-open");
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
                    payload: makeSyntheticPayload({ traceId, replayed }),
                });
                return {
                    status: "SUCCESS",
                    data: {
                        sessionId: item.sessionId,
                        status: item.status,
                        openingCash: fromMinorUnits(openingCashMinor),
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
        const traceId = makeTraceId("tpv-sandbox-partial-count");
        await requireAdmin(traceId);
        const operator = await resolveTpvContext(traceId);

        try {
            const session = await latestOpenTpvSession();
            if (!session) return errorResult("TPV_SESSION_NOT_OPEN");

            return await withTpvSessionLock(session.sessionId, traceId, async () => {
                const activeSession = await latestOpenTpvSession();
                if (!activeSession || activeSession.sessionId !== session.sessionId) {
                    throw new Error("TPV_SESSION_CLOSED");
                }
            const countedMinor = toMinorUnits(input.countedCash, "COUNTED_CASH");
            const summary = await buildSandboxSessionSummary(session);
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
                payload: { expectedMinor, countedMinor, differenceMinor, reason },
            });
            return {
                status: "SUCCESS",
                data: { movementId: item._id, difference: fromMinorUnits(differenceMinor), replayed, persisted: true, isSynthetic: true },
                error: null,
                traceId,
            };
            });
        } catch (error) {
            return { ...errorResult(String(error?.message || "TPV_PARTIAL_COUNT_FAILED")), persisted, recoverable: persisted, isSynthetic: true };
        }
    }
);
