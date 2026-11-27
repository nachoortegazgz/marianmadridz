import {
    isActionableError,
    toPublicShape,
} from "backend/errors/actionableError";

export function normalizeTpvError(
    error,
    fallbackCode = "TPV_OPERATION_FAILED"
) {
    if (isActionableError(error)) {
        return {
            ...toPublicShape(error),
            technicalDetail: error.technicalDetail || null,
            retryable: error.retryable === true,
        };
    }

    const suppliedCode = typeof error === "string"
        ? error.trim()
        : error?.code;
    const code = String(suppliedCode || fallbackCode).slice(0, 120);
    const technicalDetail = typeof error === "string"
        ? error
        : error?.technicalDetail || error?.message || fallbackCode;

    return {
        code,
        userMessage: "No se pudo completar la operación TPV.",
        remediation: [
            "Revisar el detalle técnico asociado al traceId.",
            "Comprobar el estado de la sesión y la configuración TPV.",
            "Corregir la causa indicada antes de reintentar.",
        ],
        technicalDetail: String(technicalDetail || fallbackCode).slice(0, 1000),
        retryable: error?.retryable === true,
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
