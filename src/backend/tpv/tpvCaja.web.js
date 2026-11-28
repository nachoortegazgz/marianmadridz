import { Permissions, webMethod } from "wix-web-module";
import { resolveTpvContext } from "backend/tpv/tpvContext";
import { requireAdmin, requireTpvOperator } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { SDK_CONFIG, TPV_COLLECTIONS } from "backend/internalConfig";
import { appendTpvAudit, assertTpvLedgerTypeSupported, closeTpvCajaSessionProjection, initializeTpvCaja, readTpvCajaSnapshot, insertTpvEvent, latestOpenTpvSession, latestTpvSession, queryTpvRecords, withTpvSessionLock } from "backend/tpv/tpvRepository";
import { buildTpvSessionSummary } from "backend/tpv/tpvCierresCore";
import { wql } from "backend/dataAccess";
import { fromMinorUnits, makeTpvPayload, normalizeClientIdempotencyKey, toMinorUnits } from "backend/tpv/tpvUtils";
import { normalizeTpvError } from "backend/tpv/tpvError";

function errorResult(error, fallbackCode = "TPV_OPERATION_FAILED", traceId = null, extra = {}) {
    return {
        status: "ERROR",
        data: null,
        error: normalizeTpvError(error, fallbackCode),
        ...(traceId ? { traceId } : {}),
        persisted: false,
        ...extra,
    };
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
    return { now: new Date().toISOString(), timeZone: SDK_CONFIG.TZ };
}

function madridDayKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: SDK_CONFIG.TZ, year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return values.year + values.month + values.day;
}

export const inicializarCaja = webMethod(
    Permissions.SiteMember,
    async () => {
        const traceId = makeTraceId("tpv-bootstrap");

        try {
            await requireTpvOperator(traceId);
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
            };
        } catch (error) {
            return {
                status: "ERROR",
                data: null,
                error: normalizeTpvError(error, "TPV_BOOTSTRAP_FAILED"),
                traceId,
                persisted: false,
            };
        }
    }
);

export const obtenerEstadoCaja = webMethod(
    Permissions.SiteMember,
    async () => {
        const traceId = makeTraceId("tpv-session-read");
        await requireTpvOperator(traceId);

        const operator = await resolveTpvContext(traceId);
        const cajaActual = await readTpvCajaSnapshot();
        const session = await latestTpvSession();
        const dayKey = madridDayKey();
        const nextSessionPreview = {
            operationDate: dayKey.slice(0, 4) + "-" + dayKey.slice(4, 6) + "-" + dayKey.slice(6, 8),
            sessionId: "TPV-SESSION-" + dayKey,
            timeZone: SDK_CONFIG.TZ,
            preparedAt: new Date().toISOString(),
        };
        if (!session) {
            const canOpenSession = operator.rolWebsite === "ADMIN" && cajaActual.canStartSession === true;
            return {
                status: "SUCCESS",
                data: {
                    status: OPERATIONAL_CASH_STATUS.NONE,
                    operationalStatus: OPERATIONAL_CASH_STATUS.NONE,
                    canOpenSession,
                    nextSessionPreview: canOpenSession ? nextSessionPreview : null,
                    cajaActual,
                    operationalWritesAvailable: false,
                    operationalWritesUnavailableReason: "TPV_SESSION_NOT_OPEN",
                    sessionId: null,
                    operatorId: null,
                    actorId: null,
                    operatorResourceId: null,
                    authenticatedOperatorId: operator.operatorId,
                    authenticatedActorId: operator.actorId,
                    authenticatedDisplayName: operator.operatorDisplayName,
                    integrationStatus: "NO_ENVIADO",
                    paymentStatus: "NOT_APPLICABLE",
                    ...responseClock(),
                },
                error: null,
                traceId,
            };
        }
        const status = operationalStatus(session.status);
        const summary = status === OPERATIONAL_CASH_STATUS.OPEN
            ? await buildTpvSessionSummary(session)
            : null;
        const canOpenSession = operator.rolWebsite === "ADMIN" &&
            status === OPERATIONAL_CASH_STATUS.CLOSED &&
            session.sessionId !== "TPV-SESSION-" + dayKey;
        return {
            status: "SUCCESS",
            data: {
                sessionId: session.sessionId,
                status,
                operationalStatus: status,
                canOpenSession,
                nextSessionPreview: canOpenSession ? nextSessionPreview : null,
                cajaActual,
                operationalWritesAvailable: status === OPERATIONAL_CASH_STATUS.OPEN,
                operationalWritesUnavailableReason: status === OPERATIONAL_CASH_STATUS.OPEN ? null : "TPV_SESSION_NOT_OPEN",
                operatorId: session.operatorId || session.cashierMemberId || null,
                actorId: session.actorId || session.cashierMemberId || null,
                operatorDisplayName: session.operatorDisplayName || null,
                operatorResourceId: session.operatorResourceId || null,
                authenticatedOperatorId: operator.operatorId,
                authenticatedActorId: operator.actorId,
                authenticatedDisplayName: operator.operatorDisplayName,
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
                paymentStatus: "NOT_APPLICABLE",
                ...responseClock(),
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

        try {
            await requireAdmin(traceId);
            assertTpvLedgerTypeSupported("physical");
            const operator = await resolveTpvContext(traceId);
            if (!String(operator.operatorResourceId || "").trim()) {
                throw new Error("TPV_OPERATOR_RESOURCE_REQUIRED");
            }
            const openingCashMinor = toMinorUnits(input.openingCash, "OPENING_CASH");
            const dayKey = madridDayKey();
            const sessionId = "TPV-SESSION-" + dayKey;
            const expectedSessionId = String(input.expectedSessionId || "").trim();
            if (!expectedSessionId) throw new Error("TPV_SESSION_PREVIEW_REQUIRED");
            if (expectedSessionId !== sessionId) {
                throw new Error("TPV_SESSION_PREVIEW_STALE");
            }
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
                        operatorDisplayName: operator.operatorDisplayName,
                        operatorResourceId: operator.operatorResourceId,
                        payload: makeTpvPayload({
                            dayKey,
                            openingReason: String(input.reason || "Apertura de TPV").slice(0, 200),
                            traceId,
                            terminalId: String(input.terminalId || "TPV").slice(0, 80),
                        }),
                    }
                );
                persisted = true;
                const openedAt = item.openedAt instanceof Date ? item.openedAt : new Date(item.openedAt);
                if (Number.isNaN(openedAt.getTime())) throw new Error("TPV_SESSION_OPENED_AT_INVALID");
                const openingMovement = await insertTpvEvent(
                    TPV_COLLECTIONS.MOVIMIENTOS_CAJA,
                    idempotencyKey + ":MOVEMENT",
                    {
                        sessionId,
                        movementType: "APERTURA",
                        amountMinor: openingCashMinor,
                        paymentMethod: "EFECTIVO",
                        reason: String(input.reason || "Apertura de caja").slice(0, 200),
                        status: "CONFIRMADO",
                        createdAt: openedAt,
                        operatorId: operator.operatorId,
                        actorId: operator.actorId,
                        operatorDisplayName: operator.operatorDisplayName,
                        operatorResourceId: operator.operatorResourceId,
                        traceId,
                        payload: makeTpvPayload({
                            dayKey,
                            openingCashMinor,
                            openingSessionId: sessionId,
                            operatorId: operator.operatorId,
                            operatorResourceId: operator.operatorResourceId,
                            traceId,
                        }),
                    }
                );
                await insertTpvEvent(TPV_COLLECTIONS.AUDITORIA, idempotencyKey + ":AUDIT", {
                    action: "APERTURA_CAJA",
                    actorId: operator.operatorId,
                    entityType: "SESION_CAJA",
                    entityId: sessionId,
                    occurredAt: openedAt,
                    source: "TPV_WEB_METHOD",
                    payload: makeTpvPayload({
                        traceId,
                        replayed,
                        sessionId,
                        movementId: openingMovement.item._id,
                        transactionId: openingMovement.item._id,
                    }),
                });
                const openingAmount = fromMinorUnits(openingCashMinor);
                return {
                    status: "SUCCESS",
                    data: {
                        sessionId: item.sessionId,
                        status: item.status,
                        operationalStatus: OPERATIONAL_CASH_STATUS.OPEN,
                        canOpenSession: false,
                        operatorId: operator.operatorId,
                        actorId: operator.actorId,
                        operatorDisplayName: operator.operatorDisplayName,
                        operatorResourceId: operator.operatorResourceId,
                        openingCash: openingAmount,
                        openedAt,
                        openingMovementId: openingMovement.item._id,
                        openingTransactionId: openingMovement.item._id,
                        openingReceipt: {
                            ticketType: "APERTURA_CAJA",
                            sessionId,
                            operationDate: dayKey.slice(0, 4) + "-" + dayKey.slice(4, 6) + "-" + dayKey.slice(6, 8),
                            openedAt: openedAt.toISOString(),
                            timeZone: SDK_CONFIG.TZ,
                            professional: operator.operatorDisplayName || operator.operatorId,
                            professionalId: operator.operatorResourceId || null,
                            operatorId: operator.operatorId,
                            total: openingAmount,
                            breakdown: {
                                EFECTIVO: openingAmount,
                                TARJETA: 0,
                                BIZUM: 0,
                                BONO: 0,
                                TARJETA_REGALO: 0,
                                OTROS: 0,
                            },
                            movementId: openingMovement.item._id,
                            transactionId: openingMovement.item._id,
                        },
                        integrationStatus: "NO_ENVIADO",
                        paymentStatus: "NOT_APPLICABLE",
                        ...responseClock(),
                        replayed,
                        persisted: true,
                    },
                    error: null,
                    traceId,
                };
            }, { allowLegacyProjection: true });

        } catch (error) {
            return errorResult(error, "TPV_SESSION_OPEN_FAILED", traceId, { persisted, recoverable: persisted });
        }
    }
);

export const registrarArqueoParcial = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        let persisted = false;
        const traceId = makeTraceId("tpv-partial-count");

        try {
            await requireAdmin(traceId);
            assertTpvLedgerTypeSupported("physical");
            const operator = await resolveTpvContext(traceId);
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
                    // This path passed the operational-ledger gate; synthetic
                    // markers are reserved for isolated QA fixtures.
                    status: "REGISTRADO",
                    createdAt: new Date(),
                    payload: makeTpvPayload({
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
                    paymentStatus: "NOT_APPLICABLE",
                    now: new Date().toISOString(),
                    timeZone: SDK_CONFIG.TZ,
                    replayed,
                    persisted: true,
                },
                error: null,
                traceId,
            };
            });
        } catch (error) {
            return errorResult(error, "TPV_PARTIAL_COUNT_FAILED", traceId, { persisted, recoverable: persisted });
        }
    }
);


export const cerrarSesionCaja = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        let persisted = false;
        const traceId = makeTraceId("tpv-session-close");

        try {
            await requireAdmin(traceId);
            assertTpvLedgerTypeSupported("physical");
            const operator = await resolveTpvContext(traceId);
            const sessionId = String(input.sessionId || "").trim();
            if (!sessionId) throw new Error("TPV_SESSION_REQUIRED");
            const arqueo = input.arqueo && typeof input.arqueo === "object" ? input.arqueo : {};
            const countedCashMinor = toMinorUnits(arqueo.contadoEfectivo, "COUNTED_CASH");
            const countedCardMinor = arqueo.contadoTarjeta === undefined || arqueo.contadoTarjeta === null
                ? null
                : toMinorUnits(arqueo.contadoTarjeta, "COUNTED_CARD");
            // One canonical closure claim per session: retries cannot create a second CIERRE movement.
            const closeIdempotencyKey = sessionId + "-CIERRE";
            const observations = String(input.observaciones || "").trim().slice(0, 500);
            const session = await latestTpvSession();
            if (!session || session.sessionId !== sessionId) {
                throw new Error(session ? "TPV_SESSION_MISMATCH" : "CERRAR_SESSION_NOT_FOUND");
            }

            return await withTpvSessionLock(sessionId, traceId, async () => {
                const current = await latestTpvSession();
                if (!current || current.sessionId !== sessionId) throw new Error("TPV_SESSION_MISMATCH");
                if (current.status === "CERRADA") {
                    const priorClosures = await queryTpvRecords(
                        TPV_COLLECTIONS.MOVIMIENTOS_CAJA,
                        wql.and(wql.eq("sessionId", sessionId), wql.eq("movementType", "CIERRE"))
                    );
                    const prior = priorClosures[0] || null;
                    if (!prior) throw new Error("TPV_CLOSE_MOVEMENT_MISSING");
                    if (Number(prior.payload?.countedCashMinor) !== countedCashMinor) {
                        throw new Error("TPV_IDEMPOTENCY_CONFLICT");
                    }
                    await appendTpvAudit({
                        idempotencyKey: "CAJA_CIERRE:" + sessionId.slice(0, 70) + ":AUDIT",
                        action: "CAJA_SESSION_CLOSED",
                        actorId: operator.operatorId,
                        entityType: "SESION_CAJA",
                        entityId: sessionId,
                        traceId,
                        payload: {
                            sessionId,
                            movementId: prior._id,
                            expectedCashMinor: Number(prior.payload?.expectedCashMinor || 0),
                            countedCashMinor,
                            countedCardMinor: prior.payload?.countedCardMinor ?? null,
                            differenceMinor: Number(prior.payload?.differenceMinor || 0),
                            observations: String(prior.payload?.observations || ""),
                        },
                    });
                    const replayData = {
                        sessionId,
                        saldoFinal: prior ? fromMinorUnits(Number(prior.payload?.countedCashMinor || 0)) : null,
                        diferencia: prior ? fromMinorUnits(Number(prior.payload?.differenceMinor || 0)) : null,
                        replayed: true,
                    };
                    return {
                        status: "SUCCESS",
                        ...replayData,
                        data: replayData,
                        error: null,
                        traceId,
                    };
                }
                const summary = await buildTpvSessionSummary(current);
                const expectedCashMinor = Number(summary.expectedCashMinor || 0);
                const differenceMinor = countedCashMinor - expectedCashMinor;
                const closedAt = new Date();
                const { item: movement, replayed: movementReplayed } = await insertTpvEvent(
                    TPV_COLLECTIONS.MOVIMIENTOS_CAJA,
                    closeIdempotencyKey,
                    {
                        sessionId,
                        movementType: "CIERRE",
                        amountMinor: differenceMinor,
                        paymentMethod: "EFECTIVO",
                        reason: observations,
                        createdAt: closedAt,
                        payload: {
                            traceId,
                            countedCashMinor,
                            countedCardMinor,
                            expectedCashMinor,
                            differenceMinor,
                            observations,
                            operatorId: operator.operatorId,
                        },
                    }
                );
                persisted = true;
                const projection = await closeTpvCajaSessionProjection({
                    sessionId,
                    countedCash: fromMinorUnits(countedCashMinor),
                    expectedCash: fromMinorUnits(expectedCashMinor),
                    difference: fromMinorUnits(differenceMinor),
                    operatorId: operator.operatorId,
                    closedAt,
                });
                await appendTpvAudit({
                    idempotencyKey: "CAJA_CIERRE:" + sessionId.slice(0, 70) + ":AUDIT",
                    action: "CAJA_SESSION_CLOSED",
                    actorId: operator.operatorId,
                    entityType: "SESION_CAJA",
                    entityId: sessionId,
                    traceId,
                    payload: {
                        sessionId,
                        movementId: movement._id,
                        expectedCashMinor,
                        countedCashMinor,
                        countedCardMinor,
                        differenceMinor,
                        observations,
                    },
                });
                const resultData = {
                    sessionId,
                    saldoFinal: fromMinorUnits(countedCashMinor),
                    diferencia: fromMinorUnits(differenceMinor),
                    replayed: movementReplayed || projection.replayed,
                };
                return {
                    status: "SUCCESS",
                    ...resultData,
                    data: resultData,
                    error: null,
                    traceId,
                };
            });
        } catch (error) {
            return {
                ...errorResult(error, "TPV_SESSION_CLOSE_FAILED", traceId, { persisted, recoverable: persisted }),
            };
        }
    }
);
