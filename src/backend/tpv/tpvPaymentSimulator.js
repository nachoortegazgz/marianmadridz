import { createHash } from "node:crypto";
import { TPV_RUNTIME_POLICY } from "backend/internalConfig";
import { normalizeClientIdempotencyKey, stableSerialize, toMinorUnits } from "backend/tpv/tpvUtils";

const PAYMENT_SCENARIOS = Object.freeze(["APPROVED", "DECLINED", "REQUIRES_ACTION", "PENDING"]);
const REFUND_SCENARIOS = Object.freeze(["APPROVED", "DECLINED", "PENDING"]);

function fingerprint(value) {
    return createHash("sha256").update(stableSerialize(value), "utf8").digest("hex");
}

function reference(prefix, key) {
    return prefix + "_" + createHash("sha256").update(key, "utf8").digest("hex").slice(0, 24).toUpperCase();
}

function baseEnvelope(operation, requestFingerprint) {
    return {
        provider: "WIX_PAYMENTS_SIMULATOR",
        operation,
        currency: TPV_RUNTIME_POLICY.CURRENCY_CODE,
        environment: "SIMULATOR",
        dataPlane: "NO_CMS_ACCESS",
        testRunId: TPV_RUNTIME_POLICY.SANDBOX_RUN_ID,
        requestFingerprint,
        providerCalled: false,
        realPayment: false,
        isSynthetic: true,
        persisted: false,
        externalSideEffects: false,
    };
}

/** Deterministic, side-effect-free simulator; it never calls Wix Payments. */
export function simulateGatewayPayment(input = {}) {

    const idempotencyKey = normalizeClientIdempotencyKey(input.idempotencyKey);
    const currency = String(input.currency || TPV_RUNTIME_POLICY.CURRENCY_CODE).toUpperCase();
    if (currency !== "EUR") throw new Error("TPV_PAYMENT_SIMULATOR_CURRENCY_UNSUPPORTED");
    const amountMinor = toMinorUnits(input.amount, "PAYMENT_AMOUNT");
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new Error("TPV_PAYMENT_SIMULATOR_AMOUNT_INVALID");
    const scenario = String(input.scenario || "APPROVED").toUpperCase();
    if (!PAYMENT_SCENARIOS.includes(scenario)) throw new Error("TPV_PAYMENT_SIMULATOR_SCENARIO_INVALID");
    const capture = input.capture !== false;
    const request = { operation: "PAYMENT", idempotencyKey, amountMinor, currency, scenario, capture };
    const requestFingerprint = fingerprint(request);
    const status = scenario === "APPROVED" ? (capture ? "CAPTURED" : "AUTHORIZED")
        : scenario === "DECLINED" ? "DECLINED"
            : scenario === "REQUIRES_ACTION" ? "REQUIRES_ACTION" : "PENDING";
    return {
        ...baseEnvelope("PAYMENT", requestFingerprint),
        transactionId: reference("WXPAY_SIM", idempotencyKey),
        idempotencyKey,
        amountMinor,
        amount: amountMinor / 100,
        status,
        approved: scenario === "APPROVED",
        captured: scenario === "APPROVED" && capture,
        requiresAction: scenario === "REQUIRES_ACTION",
        messageCode: "SIMULATED_" + status,
    };
}

/**
 * Refund simulation only. Cumulative refund limits remain the responsibility
 * of the caller, which must reconcile append-only synthetic refund events.
 */
export function simulateGatewayRefund(input = {}) {

    const idempotencyKey = normalizeClientIdempotencyKey(input.idempotencyKey);
    const originalTransactionId = String(input.originalTransactionId || "").trim();
    if (!/^WXPAY_SIM_[A-F0-9]{24}$/.test(originalTransactionId)) {
        throw new Error("TPV_PAYMENT_SIMULATOR_ORIGINAL_TRANSACTION_INVALID");
    }
    const originalAmountMinor = toMinorUnits(input.originalAmount, "ORIGINAL_AMOUNT");
    const refundAmountMinor = toMinorUnits(input.refundAmount, "REFUND_AMOUNT");
    if (!Number.isSafeInteger(originalAmountMinor) || originalAmountMinor <= 0 ||
        !Number.isSafeInteger(refundAmountMinor) || refundAmountMinor <= 0 ||
        refundAmountMinor > originalAmountMinor) {
        throw new Error("TPV_PAYMENT_SIMULATOR_REFUND_AMOUNT_INVALID");
    }
    const scenario = String(input.scenario || "APPROVED").toUpperCase();
    if (!REFUND_SCENARIOS.includes(scenario)) throw new Error("TPV_PAYMENT_SIMULATOR_REFUND_SCENARIO_INVALID");
    const request = { operation: "REFUND", idempotencyKey, originalTransactionId, originalAmountMinor, refundAmountMinor, scenario };
    const requestFingerprint = fingerprint(request);
    const status = scenario === "APPROVED" ? "REFUNDED" : scenario === "DECLINED" ? "DECLINED" : "PENDING";
    return {
        ...baseEnvelope("REFUND", requestFingerprint),
        refundId: reference("WXPAY_SIM_REFUND", idempotencyKey),
        originalTransactionId,
        idempotencyKey,
        originalAmountMinor,
        refundAmountMinor,
        refundAmount: refundAmountMinor / 100,
        status,
        approved: scenario === "APPROVED",
        messageCode: "SIMULATED_" + status,
    };
}
