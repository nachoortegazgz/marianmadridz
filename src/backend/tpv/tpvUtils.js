import { TPV_QA_RUNTIME_POLICY } from "backend/internalConfig";

const PAYMENT_METHODS = Object.freeze(["EFECTIVO", "TARJETA", "BIZUM", "OTROS"]);
export function assertTpvQaEnabled() {
    if (!TPV_QA_RUNTIME_POLICY.ENABLED ||
        TPV_QA_RUNTIME_POLICY.ENVIRONMENT !== "SANDBOX" ||
        TPV_QA_RUNTIME_POLICY.SYNTHETIC_ONLY !== true ||
        TPV_QA_RUNTIME_POLICY.REAL_PAYMENTS_ENABLED !== false ||
        TPV_QA_RUNTIME_POLICY.FISCAL_WRITES_ENABLED !== false ||
        TPV_QA_RUNTIME_POLICY.CUSTOMER_NOTIFICATIONS_ENABLED !== false ||
        TPV_QA_RUNTIME_POLICY.HARDWARE_ENABLED !== false) {
        throw new Error("TPV_QA_RUNTIME_POLICY_INVALID");
    }
    return true;
}

export function normalizeIdempotencyKey(value) {
    const key = String(value || "").trim();
    if (!/^[A-Za-z0-9:_-]{8,100}$/.test(key)) throw new Error("TPV_QA_IDEMPOTENCY_KEY_INVALID");
    return key;
}

export function normalizeClientIdempotencyKey(value) {
    const key = String(value || "").trim();
    if (!/^[A-Za-z0-9_-]{8,72}$/.test(key)) throw new Error("TPV_QA_IDEMPOTENCY_KEY_INVALID");
    return key;
}

export function toMinorUnits(value, field = "AMOUNT") {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
        throw new Error("TPV_QA_INVALID_" + field);
    }
    const minor = Math.round((amount + Number.EPSILON) * 100);
    if (Math.abs(amount * 100 - minor) > 1e-7) {
        throw new Error("TPV_QA_INVALID_PRECISION_" + field);
    }
    return minor;
}

export function fromMinorUnits(value) {
    if (!Number.isSafeInteger(value)) throw new Error("TPV_QA_MINOR_UNITS_INVALID");
    return value / 100;
}

export function normalizePaymentMethod(value) {
    const method = String(value || "").trim().toUpperCase();
    if (!PAYMENT_METHODS.includes(method)) {
        throw new Error("TPV_QA_PAYMENT_METHOD_UNSUPPORTED");
    }
    return method;
}

export function stableSerialize(value) {
    if (value instanceof Date) return JSON.stringify(value.toISOString());
    if (Array.isArray(value)) return "[" + value.map(stableSerialize).join(",") + "]";
    if (value && typeof value === "object") {
        return "{" + Object.keys(value).sort()
            .filter((key) => value[key] !== undefined)
            .map((key) => JSON.stringify(key) + ":" + stableSerialize(value[key]))
            .join(",") + "}";
    }
    return JSON.stringify(value);
}

export function makeQaId(prefix, idempotencyKey) {
    const safe = normalizeIdempotencyKey(idempotencyKey).replace(/[^A-Za-z0-9_-]/g, "-");
    return "QA-" + String(prefix || "EVENT").toUpperCase() + "-" + safe;
}

export function makeSyntheticPayload(payload = {}) {
    return {
        ...payload,
        sourceEnvironment: TPV_QA_RUNTIME_POLICY.ENVIRONMENT,
        isSynthetic: true,
        realPayment: false,
        externalSideEffects: false,
    };
}

export function validateReason(value) {
    const reason = String(value || "").trim();
    if (reason.length < 3 || reason.length > 500) {
        throw new Error("TPV_QA_REASON_REQUIRED");
    }
    return reason;
}
