/**
 * Pure TPV movement response contracts shared by the WebMethods and repository.
 * Keeps partial-persistence state explicit without mutating append-only records.
 */

import { normalizeTpvError } from "backend/tpv/tpvError";

export function createPersistedTpvProjectionError(cause, {
    recordId,
    idempotencyKey,
    replayed = false,
} = {}) {
    const error = new Error("TPV_EVENT_PERSISTED_PROJECTION_UNCONFIRMED");
    error.code = "TPV_EVENT_PERSISTED_PROJECTION_UNCONFIRMED";
    error.cause = cause;
    error.persisted = true;
    error.projectionConfirmed = false;
    error.projectionStatus = "UNCONFIRMED";
    error.recordId = String(recordId || "");
    error.idempotencyKey = String(idempotencyKey || "");
    error.replayed = replayed === true;
    return error;
}

export function resolveCashSessionOperationalStatus(latestSession, closures, sessionId) {
    const status = latestSession?.sessionId === sessionId
        ? latestSession.status
        : (closures.some((item) => item.sessionId === sessionId && item.closed === true)
            ? "CERRADA"
            : null);
    if (!status) throw new Error("TPV_SESSION_NOT_FOUND");
    return status;
}

export function buildCashMovementSuccessData({
    item,
    session,
    movementType,
    amountMinor,
    operator,
    replayed,
    timeZone,
    now = new Date(),
}) {
    return {
        movementId: item._id,
        sessionId: session.sessionId,
        movementType,
        amount: Number(amountMinor) / 100,
        operatorId: operator.operatorId,
        actorId: operator.actorId,
        operationalStatus: session.status,
        integrationStatus: "NO_ENVIADO",
        paymentStatus: "NOT_APPLICABLE",
        now: now.toISOString(),
        timeZone,
        replayed: replayed === true,
        persisted: true,
    };
}

export function buildCashMovementFailure(error, persistedBeforeError, traceId) {
    const persisted = persistedBeforeError === true || error?.persisted === true;
    const result = {
        status: "ERROR",
        data: null,
        error: normalizeTpvError(error, "TPV_CASH_MOVEMENT_FAILED"),
        persisted,
        recoverable: persisted,
        traceId,
    };
    if (error?.projectionStatus) result.projectionStatus = error.projectionStatus;
    if (error?.recordId) result.movementId = error.recordId;
    return result;
}
