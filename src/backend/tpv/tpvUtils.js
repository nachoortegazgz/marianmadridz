import { createHash } from "node:crypto";
import { TPV_COLLECTIONS, TPV_LEGACY_COLLECTIONS, TPV_LEDGER_SOURCE, TPV_PAYMENT_METHOD, TPV_RUNTIME_POLICY } from "backend/internalConfig";

const PAYMENT_METHODS = Object.freeze(Object.values(TPV_PAYMENT_METHOD));

export function getTpvRuntimeState(caja) {
    const operations = caja?.conceptOperations;
    const current = operations?.tpvRuntime;
    if (current && typeof current === "object" && !Array.isArray(current) &&
        Object.keys(current).length > 0) return current;
    const legacy = operations?.tpvSandbox;
    if (legacy && typeof legacy === "object" && !Array.isArray(legacy)) return legacy;
    return current && typeof current === "object" && !Array.isArray(current) ? current : {};
}
export function assertTpvCajaIntegrity(caja, { allowBootstrap = false } = {}) {
    const legacyRunId = TPV_RUNTIME_POLICY.LEGACY_RUN_ID;
    const state = getTpvRuntimeState(caja);
    const sessionId = String(state?.sessionId || "").trim();
    const snapshotSource = String(caja?.snapshotSource || "");
    const traceId = String(caja?.traceId || "");

    const validNeutralMetadataV2 = state?.sourceType === TPV_RUNTIME_POLICY.SOURCE_TYPE &&
        state?.siteId === TPV_RUNTIME_POLICY.SITE_ID &&
        state?.ledgerVersion === TPV_RUNTIME_POLICY.LEDGER_VERSION &&
        Number(state?.schemaVersion) === TPV_RUNTIME_POLICY.SCHEMA_VERSION &&
        state?.externalSideEffects === false &&
        (state?.processingMode === undefined || state?.processingMode === TPV_RUNTIME_POLICY.PROCESSING_MODE) &&
        (state?.reconciliationStatus === undefined || state?.reconciliationStatus === TPV_RUNTIME_POLICY.RECONCILIATION_STATUS) &&
        (state?.allowNativePayments === undefined || state.allowNativePayments === false) &&
        (state?.allowNativeRefunds === undefined || state.allowNativeRefunds === false);
    const validEventHash = /^[a-f0-9]{64}$/i.test(String(state?.eventHash || ""));
    const validRequestFingerprint = /^[a-f0-9]{64}$/i.test(String(state?.requestFingerprint || ""));
    const validV1Trace = traceId.startsWith("TPV:" + TPV_RUNTIME_POLICY.SITE_ID + ":") ||
        traceId.startsWith("TPV_SESSION:");
    const validNeutralMetadataV1 = state?.sourceType === TPV_RUNTIME_POLICY.SOURCE_TYPE &&
        state?.siteId === TPV_RUNTIME_POLICY.SITE_ID &&
        state?.ledgerVersion === TPV_RUNTIME_POLICY.LEDGER_VERSION &&
        (state?.schemaVersion === undefined || state?.schemaVersion === null || Number(state.schemaVersion) === 1) &&
        (state?.reconciliationStatus === undefined || state?.reconciliationStatus === TPV_RUNTIME_POLICY.RECONCILIATION_STATUS) &&
        (state?.processingMode === undefined || state?.processingMode === TPV_RUNTIME_POLICY.PROCESSING_MODE) &&
        (state?.allowNativePayments === undefined || state.allowNativePayments === false) &&
        (state?.allowNativeRefunds === undefined || state.allowNativeRefunds === false) &&
        state?.externalSideEffects === false &&
        Boolean(sessionId) &&
        (validRequestFingerprint || validV1Trace);

    const bootstrap = allowBootstrap === true &&
        caja?.cashRegisterStatus === "CERRADA" &&
        snapshotSource === TPV_RUNTIME_POLICY.CASH_REGISTER_SOURCE &&
        validNeutralMetadataV2 &&
        !sessionId;
    const legacyBootstrap = allowBootstrap === true &&
        caja?.cashRegisterStatus === "CERRADA" &&
        snapshotSource === TPV_RUNTIME_POLICY.LEGACY_CASH_REGISTER_SOURCE &&
        traceId === legacyRunId &&
        (state?.sandboxRunId === legacyRunId || state?.legacyRunId === legacyRunId) &&
        !sessionId;
    const explicitSyntheticV2 = caja?.cashRegisterStatus === "SIMULACION" &&
        snapshotSource === TPV_RUNTIME_POLICY.CASH_REGISTER_SOURCE &&
        validNeutralMetadataV2 &&
        Boolean(sessionId) &&
        validEventHash;
    const explicitSyntheticV1 = caja?.cashRegisterStatus === "SIMULACION" &&
        snapshotSource === TPV_RUNTIME_POLICY.CASH_REGISTER_SOURCE &&
        validNeutralMetadataV1;
    const legacySynthetic = caja?.cashRegisterStatus === "SIMULACION" &&
        [TPV_RUNTIME_POLICY.LEGACY_LEDGER_SOURCE, TPV_RUNTIME_POLICY.LEGACY_CASH_REGISTER_SOURCE].includes(snapshotSource) &&
        traceId === legacyRunId &&
        (state?.sandboxRunId === legacyRunId || state?.legacyRunId === legacyRunId);

    if (!bootstrap && !legacyBootstrap && !explicitSyntheticV2 && !explicitSyntheticV1 && !legacySynthetic) {
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

/**
 * Historical transaction ID lookup only.
 * Use exclusively when searching for records written by the previous run-scoped format;
 * never use this value for a new insert.
 */
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

/**
 * Historical Sandbox ID lookup only. Retained for idempotent retries against old rows;
 * never use this value for a new insert.
 */
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

/**
 * Parse a monetary value without guessing ambiguous thousands/decimal separators.
 * Accepts numeric values, decimal comma/dot and correctly grouped thousands:
 * 12,50 | 12.50 | 1.234,56 | 1,234.56.
 * A single separator followed by three digits is rejected as ambiguous.
 */
export function parseTpvAmount(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value !== "string") return null;
    let raw = value.trim().replace(/\s+/g, "").replace(/€$/i, "");
    if (!raw) return null;
    const sign = /^[+-]/.test(raw) ? raw[0] : "";
    if (sign) raw = raw.slice(1);
    if (!/^\d+(?:[.,]\d+)*$/.test(raw)) return null;

    const comma = raw.lastIndexOf(",");
    const dot = raw.lastIndexOf(".");
    let integerPart = raw;
    let fractionPart = "";
    if (comma >= 0 && dot >= 0) {
        const decimalSeparator = comma > dot ? "," : ".";
        const groupSeparator = decimalSeparator === "," ? "." : ",";
        const parts = raw.split(decimalSeparator);
        if (parts.length !== 2 || !/^\d{1,2}$/.test(parts[1])) return null;
        const groups = parts[0].split(groupSeparator);
        if (!/^\d{1,3}$/.test(groups[0]) || !groups.slice(1).every((part) => /^\d{3}$/.test(part))) return null;
        integerPart = groups.join("");
        fractionPart = parts[1];
    } else if (comma >= 0 || dot >= 0) {
        const separator = comma >= 0 ? "," : ".";
        const parts = raw.split(separator);
        if (parts.length === 1) return null;
        if (parts.length === 2 && parts[1].length >= 1 && parts[1].length <= 2) {
            integerPart = parts[0];
            fractionPart = parts[1];
        } else if (parts.length > 2 && /^\d{1,3}$/.test(parts[0]) && parts.slice(1).every((part) => /^\d{3}$/.test(part))) {
            integerPart = parts.join("");
        } else {
            return null;
        }
    }
    const normalized = sign + integerPart + (fractionPart ? "." + fractionPart : "");
    const amount = Number(normalized);
    return Number.isFinite(amount) ? amount : null;
}

export function toMinorUnits(value, field = "AMOUNT") {
    const amount = parseTpvAmount(value);
    if (amount === null) throw new Error("TPV_INVALID_FORMAT_" + field);
    if (amount < 0) throw new Error("TPV_INVALID_" + field);
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
        schemaVersion: TPV_RUNTIME_POLICY.SCHEMA_VERSION,
        recordSource: TPV_LEDGER_SOURCE,
        processingMode: TPV_RUNTIME_POLICY.PROCESSING_MODE,
        reconciliationStatus: TPV_RUNTIME_POLICY.RECONCILIATION_STATUS,
        allowNativePayments: TPV_RUNTIME_POLICY.CAPABILITIES.allowNativePayments,
        allowNativeRefunds: TPV_RUNTIME_POLICY.CAPABILITIES.allowNativeRefunds,
        externalSideEffects: false,
    };
}

