import {
    isActionableError,
    toPublicShape,
} from "backend/errors/actionableError";

const SAFE_ERROR_CODE = /^[A-Z][A-Z0-9_]{2,119}$/;

export function normalizeTpvError(
    error,
    fallbackCode = "TPV_OPERATION_FAILED"
) {
    if (isActionableError(error)) {
        return {
            ...toPublicShape(error),
            // technicalDetail may contain provider payloads or credentials.
            // Expose only the stable code; the backend trace retains diagnostics.
            technicalDetail: error.code,
            retryable: error.retryable === true,
        };
    }

    const message = typeof error?.message === "string" ? error.message.trim() : "";
    const messageIsCode = SAFE_ERROR_CODE.test(message);
    const candidateCode = typeof error === "string"
        ? (SAFE_ERROR_CODE.test(error.trim()) ? error.trim() : "")
        : error?.code || (messageIsCode ? message : "");
    const code = SAFE_ERROR_CODE.test(String(candidateCode || ""))
        ? String(candidateCode)
        : (SAFE_ERROR_CODE.test(String(fallbackCode || "")) ? fallbackCode : "TPV_OPERATION_FAILED");

    return {
        code,
        userMessage: "No se pudo completar la operación TPV.",
        remediation: [
            "Revisar el estado de la operación mediante su traceId.",
            "Comprobar la sesión, los permisos y la configuración requerida.",
            "Corregir la causa antes de reintentar.",
        ],
        // Never forward raw Error.message or provider details to the browser.
        technicalDetail: code,
        retryable: false,
    };
}

export function errorResult(
    error,
    fallbackCode,
    traceId,
    extra = {}
) {
    return {
        status: "ERROR",
        data: null,
        error: normalizeTpvError(error, fallbackCode),
        traceId,
        ...extra,
    };
}
