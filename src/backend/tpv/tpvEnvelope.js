import { createActionableError, toPublicShape } from "backend/errors/actionableError";

export function ok(data, extra = {}) {
    return {
        ...extra,
        status: "SUCCESS",
        data,
    };
}

export function pending(reason, extra = {}) {
    return {
        ...extra,
        status: "PENDING",
        reason: String(reason || "PENDING"),
    };
}

export function error(code, userMessage, remediation, extra = {}) {
    const actionable = createActionableError({
        code,
        userMessage,
        remediation,
        retryable: extra.retryable === true,
        autoResolved: extra.autoResolved === true,
        resolutionAttempts: extra.resolutionAttempts || [],
        contextSnapshot: extra.contextSnapshot || {},
        technicalDetail: extra.technicalDetail || "",
    });
    const publicExtra = { ...extra };
    delete publicExtra.contextSnapshot;
    delete publicExtra.technicalDetail;
    delete publicExtra.status;
    delete publicExtra.data;
    delete publicExtra.error;
    return {
        ...publicExtra,
        status: "ERROR",
        data: null,
        error: toPublicShape(actionable),
    };
}
