const MAX_USER_MESSAGE_LENGTH = 120;
const SENSITIVE_CONTEXT_KEY = /(nif|nie|cif|vat|taxid|secret|token|password|authorization|cookie|email|phone|memberid|contactid|identity|credential|signature|hmac)/i;

function sanitizeContext(value, depth = 0) {
    if (value === null || value === undefined) return value ?? null;
    if (depth > 4) return "[TRUNCATED]";
    if (Array.isArray(value)) return value.slice(0, 20).map((entry) => sanitizeContext(entry, depth + 1));
    if (typeof value !== "object") {
        if (typeof value === "string" && /\b[0-9]{8}[A-Z]\b/i.test(value)) return "[REDACTED_TAX_ID]";
        return typeof value === "string" ? value.slice(0, 300) : value;
    }
    const output = {};
    for (const [key, entry] of Object.entries(value).slice(0, 30)) {
        output[key] = SENSITIVE_CONTEXT_KEY.test(key)
            ? "[REDACTED]"
            : sanitizeContext(entry, depth + 1);
    }
    return output;
}

export function createActionableError({
    code,
    userMessage,
    technicalDetail = "",
    remediation,
    contextSnapshot = {},
    retryable = false,
    autoResolved = false,
    resolutionAttempts = [],
} = {}) {
    if (typeof code !== "string" || !code.trim()) {
        throw new TypeError("ACTIONABLE_ERROR_CODE_REQUIRED");
    }
    if (typeof userMessage !== "string" || !userMessage.trim() ||
        userMessage.trim().length > MAX_USER_MESSAGE_LENGTH) {
        throw new TypeError("ACTIONABLE_ERROR_USER_MESSAGE_INVALID");
    }
    if (!Array.isArray(remediation) || remediation.length === 0 ||
        remediation.some((step) => typeof step !== "string" || !step.trim())) {
        throw new TypeError("ACTIONABLE_ERROR_REMEDIATION_REQUIRED");
    }

    const legacyPrefix = code.trim() === "LEDGER_APPEND_ONLY" ? "DATA_ACCESS_ERROR: " : "";
    const error = new Error(legacyPrefix + userMessage.trim() + " [" + code.trim() + "]");
    error.name = "ActionableError";
    error.code = code.trim();
    error.userMessage = userMessage.trim();
    error.technicalDetail = String(technicalDetail || "").slice(0, 2000);
    error.remediation = remediation.map((step) => step.trim());
    error.contextSnapshot = sanitizeContext(contextSnapshot);
    error.retryable = retryable === true;
    error.autoResolved = autoResolved === true;
    error.resolutionAttempts = Array.isArray(resolutionAttempts)
        ? resolutionAttempts.slice(0, 10).map((attempt) => sanitizeContext(attempt))
        : [];
    return error;
}

export function isActionableError(error) {
    return Boolean(error && error.name === "ActionableError" &&
        typeof error.code === "string" &&
        typeof error.userMessage === "string" &&
        Array.isArray(error.remediation));
}

export function toPublicShape(error) {
    if (!isActionableError(error)) return null;
    return {
        code: error.code,
        userMessage: error.userMessage,
        remediation: [...error.remediation],
    };
}
