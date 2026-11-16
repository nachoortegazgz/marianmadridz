import { Permissions, webMethod } from "wix-web-module";
import { getMyStaffContext, requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { TPV_QA_COLLECTIONS, TPV_QA_RUNTIME_POLICY } from "backend/internalConfig";
import { appendQaAudit, insertQaEvent, latestOpenQaSession, queryQaRecords, withQaSessionLock } from "backend/tpv/tpvQaRepository";
import { buildQaSessionSummary } from "backend/tpv/tpvCierresCore";
import { wql } from "backend/dataAccess";
import { assertTpvQaEnabled, fromMinorUnits, makeSyntheticPayload, normalizeClientIdempotencyKey, toMinorUnits } from "backend/tpv/tpvUtils";

function errorResult(code) {
    return { status: "ERROR", data: null, error: { code }, persisted: false, realPayment: false };
}

function madridDayKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: TPV_QA_RUNTIME_POLICY.TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return values.year + values.month + values.day;
}

export const obtenerSesionCajaQA = webMethod(
    Permissions.SiteMember,
    async () => {
        const traceId = makeTraceId("tpv-qa-session-read");
        await requireCajero(traceId);
        assertTpvQaEnabled();
        const session = await latestOpenQaSession();
        if (!session) return { status: "SUCCESS", data: null, error: null, traceId };
        const summary = await buildQaSessionSummary(session);
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
                environment: TPV_QA_RUNTIME_POLICY.ENVIRONMENT,
                isSynthetic: true,
            },
            error: null,
            traceId,
        };
    }
);

export const abrirCajaQA = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        let persisted = false;
        const traceId = makeTraceId("tpv-qa-session-open");
        await requireCajero(traceId);
        assertTpvQaEnabled();
        try {
            const openingCashMinor = toMinorUnits(input.openingCash, "OPENING_CASH");
            const dayKey = madridDayKey();
            const sessionId = "QA-SESSION-" + dayKey;
            const idempotencyKey = "QA_SESSION_OPEN:" + dayKey;
            const staff = await getMyStaffContext(traceId);
            const current = await latestOpenQaSession();
            if (current && current.sessionId !== sessionId) return errorResult("TPV_QA_PREVIOUS_SESSION_NOT_CLOSED");
            const alreadyClosed = await queryQaRecords(TPV_QA_COLLECTIONS.TICKET_Z, wql.eq("sessionId", sessionId));
            if (alreadyClosed.some((item) => item.closed === true)) return errorResult("TPV_QA_SESSION_ALREADY_CLOSED_TODAY");
            const { item, replayed } = await insertQaEvent(
                TPV_QA_COLLECTIONS.SESIONES_CAJA,
                idempotencyKey,
                {
                    sessionId,
                    status: "ABIERTA",
                    openedAt: new Date(),
                    openingCashMinor,
                    expectedCashMinor: openingCashMinor,
                    cashierMemberId: staff?.memberId || "UNKNOWN",
                    payload: makeSyntheticPayload({
                        dayKey,
                        openingReason: String(input.reason || "Apertura de QA").slice(0, 200),
                        traceId,
                        terminalId: String(input.terminalId || "TPV_QA").slice(0, 80),
                    }),
                }
            );
            persisted = true;
            await insertQaEvent(TPV_QA_COLLECTIONS.AUDITORIA, idempotencyKey + ":AUDIT", {
                action: "APERTURA_CAJA_QA",
                actorId: staff?.memberId || "UNKNOWN",
                entityType: "SESION_CAJA",
                entityId: sessionId,
                occurredAt: new Date(),
                source: "TPV_QA_WEB_METHOD",
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
        } catch (error) {
            return { ...errorResult(String(error?.message || "TPV_QA_SESSION_OPEN_FAILED")), persisted, recoverable: persisted, isSynthetic: true };
        }
    }
);

export const registrarArqueoParcialQA = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        let persisted = false;
        const traceId = makeTraceId("tpv-qa-partial-count");
        await requireCajero(traceId);
        assertTpvQaEnabled();
        try {
            const session = await latestOpenQaSession();
            if (!session) return errorResult("TPV_QA_SESSION_NOT_OPEN");

            return await withQaSessionLock(session.sessionId, traceId, async () => {
                const activeSession = await latestOpenQaSession();
                if (!activeSession || activeSession.sessionId !== session.sessionId) {
                    throw new Error("TPV_QA_SESSION_CLOSED");
                }
            const countedMinor = toMinorUnits(input.countedCash, "COUNTED_CASH");
            const summary = await buildQaSessionSummary(session);
            const expectedMinor = Number(summary.expectedCashMinor || 0);
            const differenceMinor = countedMinor - expectedMinor;
            const reason = differenceMinor === 0 ? "" : String(input.reason || "").trim();
            if (differenceMinor !== 0 && reason.length < 3) {
                throw new Error("TPV_QA_COUNT_DIFFERENCE_REASON_REQUIRED");
            }
            const key = normalizeClientIdempotencyKey(input.idempotencyKey);
            const staff = await getMyStaffContext(traceId);
            const { item, replayed } = await insertQaEvent(
                TPV_QA_COLLECTIONS.MOVIMIENTOS_CAJA,
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
                        actorId: staff?.memberId || "UNKNOWN",
                        traceId,
                    }),
                }
            );
            persisted = true;
            await appendQaAudit({
                idempotencyKey: key + ":AUDIT",
                action: "ARQUEO_PARCIAL_QA",
                actorId: staff?.memberId || "UNKNOWN",
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
            return { ...errorResult(String(error?.message || "TPV_QA_PARTIAL_COUNT_FAILED")), persisted, recoverable: persisted, isSynthetic: true };
        }
    }
);
