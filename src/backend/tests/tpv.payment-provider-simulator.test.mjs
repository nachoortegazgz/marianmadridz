import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assertTpvIdentity } from "../validation.js";
import { simulateGatewayPayment, simulateGatewayRefund } from "../tpv/tpvPaymentSimulator.js";

test("approved payment returns deterministic captured synthetic transaction", () => {
    const input = { amount: 25.50, idempotencyKey: "PAYMENT-CASE-0001" };
    const first = simulateGatewayPayment(input);
    const replay = simulateGatewayPayment(input);
    assert.equal(first.status, "CAPTURED");
    assert.equal(first.environment, "SIMULATOR");
    assert.equal(first.dataPlane, "NO_CMS_ACCESS");
    assert.equal(first.transactionId, replay.transactionId);
    assert.equal(first.requestFingerprint, replay.requestFingerprint);
    assert.equal(first.amountMinor, 2550);
    assert.equal(first.providerCalled, false);
    assert.equal(first.realPayment, false);
    assert.equal(first.persisted, false);
    assert.equal(first.externalSideEffects, false);
});

test("authorization-only mode does not claim capture", () => {
    const result = simulateGatewayPayment({ amount: 12, idempotencyKey: "PAYMENT-CASE-0002", capture: false });
    assert.equal(result.status, "AUTHORIZED");
    assert.equal(result.captured, false);
});

test("declined, action-required and pending responses are deterministic", () => {
    assert.equal(simulateGatewayPayment({ amount: 1, idempotencyKey: "PAYMENT-CASE-0003", scenario: "DECLINED" }).status, "DECLINED");
    assert.equal(simulateGatewayPayment({ amount: 1, idempotencyKey: "PAYMENT-CASE-0004", scenario: "REQUIRES_ACTION" }).status, "REQUIRES_ACTION");
    assert.equal(simulateGatewayPayment({ amount: 1, idempotencyKey: "PAYMENT-CASE-0005", scenario: "PENDING" }).status, "PENDING");
});

test("same key with changed request is detectable by fingerprint", () => {
    const first = simulateGatewayPayment({ amount: 10, idempotencyKey: "PAYMENT-CASE-0006" });
    const changed = simulateGatewayPayment({ amount: 11, idempotencyKey: "PAYMENT-CASE-0006" });
    assert.equal(first.transactionId, changed.transactionId);
    assert.notEqual(first.requestFingerprint, changed.requestFingerprint);
});

test("invalid currency, amount, scenario and idempotency key fail closed", () => {
    assert.throws(() => simulateGatewayPayment({ amount: 10, currency: "USD", idempotencyKey: "PAYMENT-CASE-0001" }), /CURRENCY_UNSUPPORTED/);
    assert.throws(() => simulateGatewayPayment({ amount: 0, idempotencyKey: "PAYMENT-CASE-0001" }), /AMOUNT_INVALID/);
    assert.throws(() => simulateGatewayPayment({ amount: 10, scenario: "UNKNOWN", idempotencyKey: "PAYMENT-CASE-0001" }), /SCENARIO_INVALID/);
    assert.throws(() => simulateGatewayPayment({ amount: 10, idempotencyKey: "bad" }), /IDEMPOTENCY_KEY_INVALID/);
});

test("approved partial refund returns synthetic reference and no side effects", () => {
    const payment = simulateGatewayPayment({ amount: 50, idempotencyKey: "PAYMENT-CASE-0007" });
    const refund = simulateGatewayRefund({
        originalTransactionId: payment.transactionId,
        originalAmount: 50,
        refundAmount: 12.5,
        idempotencyKey: "REFUND-CASE-0001",
    });
    assert.equal(refund.status, "REFUNDED");
    assert.equal(refund.refundAmountMinor, 1250);
    assert.equal(refund.providerCalled, false);
    assert.equal(refund.realPayment, false);
    assert.equal(refund.externalSideEffects, false);
});

test("refund rejects foreign transaction references and amounts over original", () => {
    assert.throws(() => simulateGatewayRefund({
        originalTransactionId: "live-transaction", originalAmount: 20, refundAmount: 5, idempotencyKey: "REFUND-CASE-0002",
    }), /ORIGINAL_TRANSACTION_INVALID/);
    const payment = simulateGatewayPayment({ amount: 10, idempotencyKey: "PAYMENT-CASE-0008" });
    assert.throws(() => simulateGatewayRefund({
        originalTransactionId: payment.transactionId, originalAmount: 10, refundAmount: 10.01, idempotencyKey: "REFUND-CASE-0003",
    }), /REFUND_AMOUNT_INVALID/);
});

test("historical synthetic identity fixture is accepted only by the explicit legacy-read validator", async () => {
    const fixtureUrl = new URL("../../../docs/qa/fixtures/tpv-sandbox-identities.json", import.meta.url);
    const identities = JSON.parse(await readFile(fixtureUrl, "utf8"));
    assert.equal(identities.length, 6);
    assert.equal(identities.filter((item) => item.identityType === "CUSTOMER").length, 3);
    assert.equal(identities.filter((item) => item.identityType === "STAFF").length, 3);
    for (const identity of identities) {
        assert.throws(() => assertTpvIdentity(identity));
        assert.equal(assertTpvIdentity(identity, { allowLegacyRead: true }), true);
    }
});
