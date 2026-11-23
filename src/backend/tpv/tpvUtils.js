import { createHash } from "node:crypto";
import { TPV_COLLECTIONS, TPV_LEGACY_COLLECTIONS, TPV_LEDGER_SOURCE, TPV_RUNTIME_POLICY } from "backend/internalConfig";

const PAYMENT_METHODS = Object.freeze(["EFECTIVO", "TARJETA", "BIZUM", "OTROS"]);
export function assertTpvCajaIntegrity(caja, { allowBootstrap = false } = {}) {
    const legacyRunId = TPV_RUNTIME_POLICY.LEGACY_RUN_ID;
    const state = caja?.conceptOperations?.tpvSandbox;
    const validNeutralMetadata = state?.sourceType === TPV_RUNTIME_POLICY.SOURCE_TYPE &&
        state?.siteId === TPV_RUNTIME_POLICY.SITE_ID &&
        state?.ledgerVersion === TPV_RUNTIME_POLICY.LEDGER_VERSION &&
        Number(state?.schemaVersion) === 2 &&
        state?.externalSideEffects === false;
    const bootstrap = allowBootstrap === true &&
        caja?.cashRegisterStatus === "CERRADA" &&
        validNeutralMetadata;
    const explicitSynthetic = caja?.cashRegisterStatus === "SIMULACION" &&
        validNeutralMetadata &&
        Boolean(String(state?.sessionId || "").trim()) &&
        validEventHash;
    const legacySynthetic = caja?.snapshotSource === "TPV_SANDBOX_SYNTHETIC" &&
        caja?.cashRegisterStatus === "SIMULACION" &&
        caja?.traceId === legacyRunId &&
        state?.sandboxRunId === legacyRunId;
    if (!bootstrap && !explicitSynthetic && !legacySynthetic) {
        throw new Error("TPV_CASH_REGISTER_INTEGRITY_FAILED");
    }
    return true;
}

export function makeTpvTransactionId(collection, idempotencyKey) {
    if (!Object.values(TPV_COLLECTIONS).includes(collection)) {
        throw new Error("TPV_COLLECTION_NOT_ALLOWED");
    }
    const key = normalizeIdempotencyKey(idempotencyKey);
    const digest = createHash("sha256")
        .update(TPV_RUNTIME_POLICY.SITE_ID + ":" + collection + ":" + key, "utf8")
        .digest("hex");
    return "TPV_" + digest;
}

export function makeLegacyTpvTransactionIdByCollection(collection, idempotencyKey) {
    const logicalKey = Object.keys(TPV_COLLECTIONS).find((key) => TPV_COLLECTIONS[key] === collection);
    const legacyCollection = logicalKey ? TPV_LEGACY_COLLECTIONS[logicalKey] : null;
    if (!legacyCollection) throw new Error("TPV_COLLECTION_NOT_ALLOWED");
    const key = normalizeIdempotencyKey(idempotencyKey);
    const digest = createHash("sha256")
        .update(TPV_RUNTIME_POLICY.LEGACY_RUN_ID + ":" + legacyCollection + ":" + key, "utf8")
        .digest("hex");
    return "TPV_" + digest;
}

export function makeLegacyTpvTransactionId(idempotencyKey) {
    const key = normalizeIdempotencyKey(idempotencyKey);
    const digest = createHash("sha256")
        .update(TPV_RUNTIME_POLICY.LEGACY_RUN_ID + ":" + key, "utf8")
        .digest("hex");
    return "TPVSANDBOX_" + digest;
}

export function normalizeIdempotencyKey(value) {
    const key = String(value || "").trim();
    if (!/^[A-Za-z0-9:_-]{8,100}$/.test(key)) throw new Error("TPV_IDEMPOTENCY_KEY_INVALID");
    return key;
}

export function normalizeClientIdempotencyKey(value) {
    const key = String(value || "").trim();
    if (!/^[A-Za-z0-9_-]{8,72}$/.test(key)) throw new Error("TPV_IDEMPOTENCY_KEY_INVALID");
    return key;
}

export function toMinorUnits(value, field = "AMOUNT") {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
        throw new Error("TPV_INVALID_" + field);
    }
    const minor = Math.round((amount + Number.EPSILON) * 100);
    if (Math.abs(amount * 100 - minor) > 1e-7) {
        throw new Error("TPV_INVALID_PRECISION_" + field);
    }
    return minor;
}

export function fromMinorUnits(value) {
    if (!Number.isSafeInteger(value)) throw new Error("TPV_MINOR_UNITS_INVALID");
    return value / 100;
}

export function normalizePaymentMethod(value) {
    const method = String(value || "").trim().toUpperCase();
    if (!PAYMENT_METHODS.includes(method)) {
        throw new Error("TPV_PAYMENT_METHOD_UNSUPPORTED");
    }
    return method;
}

export function makeRequestFingerprint(value) {
    return createHash("sha256").update(stableSerialize(value), "utf8").digest("hex");
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

export function makeTpvId(prefix, idempotencyKey) {
    const safe = normalizeIdempotencyKey(idempotencyKey).replace(/[^A-Za-z0-9_-]/g, "-");
    return "TPV-" + String(prefix || "EVENT").toUpperCase() + "-" + safe;
}

export function makeTpvRefundLockId(saleId) {
    const value = String(saleId || "").trim();
    if (!value) throw new Error("TPV_REFUND_LOCK_INVALID");
    const digest = createHash("sha256").update(value, "utf8").digest("hex").slice(0, 32);
    return "TPVQ" + digest;
}

export function makeTpvSessionLockId(sessionId) {
    const value = String(sessionId || "").trim();
    if (!value) throw new Error("TPV_SESSION_LOCK_INVALID");
    const digest = createHash("sha256").update(value, "utf8").digest("hex").slice(0, 32);
    return "TPVS" + digest;
}

export function makeSyntheticPayload(payload = {}) {
    return {
        ...payload,
        sourceType: TPV_RUNTIME_POLICY.SOURCE_TYPE,
        siteId: TPV_RUNTIME_POLICY.SITE_ID,
        ledgerVersion: TPV_RUNTIME_POLICY.LEDGER_VERSION,
        schemaVersion: 2,
        recordSource: TPV_LEDGER_SOURCE,
        reconciliationStatus: "NOT_RECONCILED",
        isSynthetic: true,
        realPayment: false,
        externalSideEffects: false,
    };
}

