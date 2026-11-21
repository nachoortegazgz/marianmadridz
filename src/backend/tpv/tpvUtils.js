import { createHash } from "node:crypto";
import { TPV_SANDBOX_COLLECTIONS, TPV_SANDBOX_RUNTIME_POLICY } from "backend/internalConfig";

const PAYMENT_METHODS = Object.freeze(["EFECTIVO", "TARJETA", "BIZUM", "OTROS"]);
export function assertSandboxCajaWritable(caja, { allowBootstrap = false } = {}) {
    const sandboxRunId = TPV_SANDBOX_RUNTIME_POLICY.SANDBOX_RUN_ID;
    const sandboxState = caja?.conceptOperations?.tpvSandbox;
    const bootstrap = allowBootstrap === true &&
        caja?.snapshotSource === "TPV_SANDBOX_INITIALIZED" &&
        caja?.cashRegisterStatus === "CERRADA" &&
        caja?.traceId === sandboxRunId &&
        sandboxState?.sandboxRunId === sandboxRunId;
    const synthetic = caja?.snapshotSource === "TPV_SANDBOX_SYNTHETIC" &&
        caja?.cashRegisterStatus === "SIMULACION" &&
        caja?.traceId === sandboxRunId &&
        sandboxState?.sandboxRunId === sandboxRunId;
    if (!bootstrap && !synthetic) {
        throw new Error("TPV_SANDBOX_CASH_REGISTER_NOT_IN_TEST_MODE");
    }
    return true;
}

export function makeSandboxTransactionId(collection, idempotencyKey) {
    if (!Object.values(TPV_SANDBOX_COLLECTIONS).includes(collection)) {
        throw new Error("TPV_SANDBOX_COLLECTION_NOT_ALLOWED");
    }
    const key = normalizeIdempotencyKey(idempotencyKey);
    const digest = createHash("sha256")
        .update(TPV_SANDBOX_RUNTIME_POLICY.SANDBOX_RUN_ID + ":" + collection + ":" + key, "utf8")
        .digest("hex");
    return "TPVSANDBOX_" + digest;
}

export function makeLegacySandboxTransactionId(idempotencyKey) {
    const key = normalizeIdempotencyKey(idempotencyKey);
    const digest = createHash("sha256")
        .update(TPV_SANDBOX_RUNTIME_POLICY.SANDBOX_RUN_ID + ":" + key, "utf8")
        .digest("hex");
    return "TPVSANDBOX_" + digest;
}

export function normalizeIdempotencyKey(value) {
    const key = String(value || "").trim();
    if (!/^[A-Za-z0-9:_-]{8,100}$/.test(key)) throw new Error("TPV_SANDBOX_IDEMPOTENCY_KEY_INVALID");
    return key;
}

export function normalizeClientIdempotencyKey(value) {
    const key = String(value || "").trim();
    if (!/^[A-Za-z0-9_-]{8,72}$/.test(key)) throw new Error("TPV_SANDBOX_IDEMPOTENCY_KEY_INVALID");
    return key;
}

export function toMinorUnits(value, field = "AMOUNT") {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
        throw new Error("TPV_SANDBOX_INVALID_" + field);
    }
    const minor = Math.round((amount + Number.EPSILON) * 100);
    if (Math.abs(amount * 100 - minor) > 1e-7) {
        throw new Error("TPV_SANDBOX_INVALID_PRECISION_" + field);
    }
    return minor;
}

export function fromMinorUnits(value) {
    if (!Number.isSafeInteger(value)) throw new Error("TPV_SANDBOX_MINOR_UNITS_INVALID");
    return value / 100;
}

export function normalizePaymentMethod(value) {
    const method = String(value || "").trim().toUpperCase();
    if (!PAYMENT_METHODS.includes(method)) {
        throw new Error("TPV_SANDBOX_PAYMENT_METHOD_UNSUPPORTED");
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

export function makeSandboxId(prefix, idempotencyKey) {
    const safe = normalizeIdempotencyKey(idempotencyKey).replace(/[^A-Za-z0-9_-]/g, "-");
    return "SANDBOX-" + String(prefix || "EVENT").toUpperCase() + "-" + safe;
}

export function makeSandboxRefundLockId(saleId) {
    const value = String(saleId || "").trim();
    if (!value) throw new Error("TPV_SANDBOX_REFUND_LOCK_INVALID");
    const digest = createHash("sha256").update(value, "utf8").digest("hex").slice(0, 32);
    return "TPVQ" + digest;
}

export function makeSandboxSessionLockId(sessionId) {
    const value = String(sessionId || "").trim();
    if (!value) throw new Error("TPV_SANDBOX_SESSION_LOCK_INVALID");
    const digest = createHash("sha256").update(value, "utf8").digest("hex").slice(0, 32);
    return "TPVS" + digest;
}

export function makeSyntheticPayload(payload = {}) {
    return {
        ...payload,
        sourceEnvironment: TPV_SANDBOX_RUNTIME_POLICY.ENVIRONMENT,
        isSynthetic: true,
        realPayment: false,
        externalSideEffects: false,
    };
}

