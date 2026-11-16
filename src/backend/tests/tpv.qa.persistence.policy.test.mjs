import test from "node:test";
import assert from "node:assert/strict";
import {
    assertBulkPatchAllowed,
    assertInsertAllowed,
    assertUpdateAllowed,
    assertRemoveAllowed,
} from "../dataAccessPolicy.js";
import {
    TPV_QA_COLLECTIONS,
    TPV_QA_RUNTIME_POLICY,
    CONTROL_TYPE,
    OPERATIONAL_COLLECTIONS,
} from "../internalConfig.js";
import {
    normalizeClientIdempotencyKey,
    normalizeIdempotencyKey,
    normalizePaymentMethod,
    toMinorUnits,
    fromMinorUnits,
    makeSyntheticPayload,
    makeQaRefundLockId,
    makeQaSessionLockId,
} from "../tpv/tpvUtils.js";

test("all TPV QA collections are insert-only and cannot be updated or removed", () => {
    for (const collection of Object.values(TPV_QA_COLLECTIONS)) {
        assert.doesNotThrow(() => assertInsertAllowed(collection, {
            idempotencyKey: "qa-idempotency-key-0001",
            payload: makeSyntheticPayload({ sample: true }),
        }));
        assert.throws(() => assertInsertAllowed(collection, {
            idempotencyKey: "qa-idempotency-key-0001",
            payload: { isSynthetic: true },
        }), /DATA_ACCESS_ERROR/);
        assert.throws(() => assertInsertAllowed(collection, {
            payload: makeSyntheticPayload({ sample: true }),
        }), /DATA_ACCESS_ERROR/);
        assert.throws(() => assertUpdateAllowed(collection, { _id: "qa-item" }), /DATA_ACCESS_ERROR/);
        assert.throws(() => assertRemoveAllowed(collection, "qa-item"), /DATA_ACCESS_ERROR/);
    }
});

test("QA refund lock allows only scoped compare-and-swap fields", () => {
    const collection = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
    assert.doesNotThrow(() => assertInsertAllowed(collection, {
        _id: "TPVQA_REFUND_LOCK_QA-SALE-TEST",
        controlType: CONTROL_TYPE.TPV_QA_REFUND_LOCK,
        dedupeKey: "TPV_QA_REFUND:QA-SALE-TEST",
        traceId: "test",
        status: "ACTIVE",
        version: 0,
        expiresAt: new Date(),
        payload: { environment: "TEST" },
    }));
    assert.doesNotThrow(() => assertBulkPatchAllowed(collection, [
        { fieldPath: "status", action: "SET_FIELD", value: "RELEASED" },
        { fieldPath: "expiresAt", action: "SET_FIELD", value: new Date() },
        { fieldPath: "payload", action: "SET_FIELD", value: { environment: "TEST" } },
        { fieldPath: "version", action: "INCREMENT_FIELD", value: 1 },
    ], {
        controlType: { $eq: CONTROL_TYPE.TPV_QA_REFUND_LOCK },
        version: { $eq: 0 },
        status: { $eq: "ACTIVE" },
    }));
    assert.throws(() => assertBulkPatchAllowed(collection, [
        { fieldPath: "payloadJson", action: "SET_FIELD", value: "{}" },
    ], {
        controlType: { $eq: CONTROL_TYPE.TPV_QA_REFUND_LOCK },
        version: { $eq: 0 },
        status: { $eq: "ACTIVE" },
    }), /DATA_ACCESS_ERROR/);
});

test("refund lock IDs are deterministic and respect Wix CMS _id length", () => {
    const saleId = "QA-SALE-" + "x".repeat(100);
    const first = makeQaRefundLockId(saleId);
    assert.equal(first, makeQaRefundLockId(saleId));
    assert.equal(first.length, 36);
    assert.match(first, /^TPVQ[a-f0-9]{32}$/);
});

test("refund lock is mutable only through its scoped compare-and-swap policy", () => {
    const collection = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
    assert.throws(() => assertUpdateAllowed(collection, {
        _id: "TPVQA_REFUND_LOCK_QA-SALE-TEST",
        controlType: CONTROL_TYPE.TPV_QA_REFUND_LOCK,
        dedupeKey: "TPV_QA_REFUND:QA-SALE-TEST",
        traceId: "test",
        version: 0,
        status: "RELEASED",
    }), /DATA_ACCESS_ERROR/);
    assert.throws(() => assertRemoveAllowed(
        collection,
        "TPVQA_REFUND_LOCK_QA-SALE-TEST",
        CONTROL_TYPE.TPV_QA_REFUND_LOCK
    ), /DATA_ACCESS_ERROR/);
});

test("QA session lock is deterministic, bounded and CAS-only", () => {
    const sessionId = "QA-SESSION-20261116";
    const lockId = makeQaSessionLockId(sessionId);
    assert.equal(lockId, makeQaSessionLockId(sessionId));
    assert.equal(lockId.length, 36);
    assert.match(lockId, /^TPVS[a-f0-9]{32}$/);

    const collection = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
    assert.doesNotThrow(() => assertInsertAllowed(collection, {
        _id: lockId,
        controlType: CONTROL_TYPE.TPV_QA_SESSION_LOCK,
        dedupeKey: "TPV_QA_SESSION:" + lockId.slice(4),
        traceId: "test",
        status: "ACTIVE",
        version: 0,
        expiresAt: new Date(),
        payload: { sessionId, environment: "TEST" },
    }));
    assert.doesNotThrow(() => assertBulkPatchAllowed(collection, [
        { fieldPath: "status", action: "SET_FIELD", value: "RELEASED" },
        { fieldPath: "expiresAt", action: "SET_FIELD", value: new Date() },
        { fieldPath: "payload", action: "SET_FIELD", value: { sessionId, environment: "TEST" } },
        { fieldPath: "version", action: "INCREMENT_FIELD", value: 1 },
    ], {
        controlType: { $eq: CONTROL_TYPE.TPV_QA_SESSION_LOCK },
        version: { $eq: 0 },
        status: { $eq: "ACTIVE" },
    }));
    assert.throws(() => assertUpdateAllowed(collection, {
        _id: lockId,
        controlType: CONTROL_TYPE.TPV_QA_SESSION_LOCK,
        status: "RELEASED",
    }), /DATA_ACCESS_ERROR/);
    assert.throws(() => assertRemoveAllowed(collection, lockId, CONTROL_TYPE.TPV_QA_SESSION_LOCK), /DATA_ACCESS_ERROR/);
});

test("QA policy remains synthetic and client idempotency keys are bounded", () => {
    assert.equal(TPV_QA_RUNTIME_POLICY.ENABLED, true);
    assert.equal(TPV_QA_RUNTIME_POLICY.ENVIRONMENT, "TEST");
    assert.equal(TPV_QA_RUNTIME_POLICY.SYNTHETIC_ONLY, true);
    assert.equal(TPV_QA_RUNTIME_POLICY.REAL_PAYMENTS_ENABLED, false);
    assert.equal(TPV_QA_RUNTIME_POLICY.FISCAL_WRITES_ENABLED, false);
    assert.equal(TPV_QA_RUNTIME_POLICY.CUSTOMER_NOTIFICATIONS_ENABLED, false);
    assert.equal(TPV_QA_RUNTIME_POLICY.HARDWARE_ENABLED, false);
    assert.equal(normalizeClientIdempotencyKey("qa-client-key-0001"), "qa-client-key-0001");
    assert.throws(() => normalizeClientIdempotencyKey("short"), /TPV_QA_IDEMPOTENCY_KEY_INVALID/);
    assert.equal(normalizeIdempotencyKey("qa-client-key-0001:PAYMENT:001"), "qa-client-key-0001:PAYMENT:001");
    assert.equal(normalizePaymentMethod("bizum"), "BIZUM");
    assert.equal(toMinorUnits(12.34), 1234);
    assert.equal(fromMinorUnits(1234), 12.34);
    assert.throws(() => toMinorUnits(12.345), /TPV_QA_INVALID_PRECISION/);
    const payload = makeSyntheticPayload({ sample: true });
    assert.equal(payload.isSynthetic, true);
    assert.equal(payload.realPayment, false);
    assert.equal(payload.externalSideEffects, false);
});
