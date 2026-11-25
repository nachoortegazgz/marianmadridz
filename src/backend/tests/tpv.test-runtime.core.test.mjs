import test from "node:test";
import assert from "node:assert/strict";
import {
    assertBulkPatchAllowed,
    assertBulkRemoveAllowed,
    assertInsertAllowed,
    assertRemoveAllowed,
    assertUpdateAllowed,
} from "../dataAccessPolicy.js";
import { CONTROL_TYPE, TPV_RUNTIME_POLICY } from "../internalConfig.js";
import { ControlOperativo_beforeInsert } from "../data.js";
import {
    appendTpvTestEvent,
    createTpvTestRunPayload,
    isValidTpvTestRunPayload,
    summarizeTpvTestRun,
    tpvTestRunId,
    TPV_TEST_GENESIS_HASH,
} from "../tpv/tpvTestRuntimeCore.js";

function basePayload() {
    return createTpvTestRunPayload({
        sessionId: "TPV-SESSION-TEST-001",
        siteId: "188bed94-177c-4bc9-a9f0-35080d874f3e",
        actorId: "member-admin-1",
        operatorId: "member-admin-1",
        operatorDisplayName: "Admin test",
        openingCashMinor: 15000,
        openedAt: new Date("2026-11-25T09:00:00.000Z"),
        traceId: "TPV-TEST-TRACE-001",
    });
}

function append(payload, eventType, idempotencyKey, data) {
    return appendTpvTestEvent(payload, {
        eventType,
        idempotencyKey,
        actorId: "member-admin-1",
        data,
        occurredAt: new Date("2026-11-25T09:01:00.000Z"),
    });
}

test("test run envelope is neutral, internal and explicitly non-native", () => {
    const payload = basePayload();
    assert.equal(payload.sourceType, "SYNTHETIC");
    assert.equal(payload.processingMode, "INTERNAL");
    assert.equal(payload.reconciliationStatus, "NOT_RECONCILED");
    assert.equal(payload.realPayment, false);
    assert.equal(payload.externalSideEffects, false);
    assert.equal(payload.eventHash, TPV_TEST_GENESIS_HASH);
    assert.equal(isValidTpvTestRunPayload(payload, {
        siteId: payload.siteId,
        sessionId: payload.sessionId,
        actorId: payload.actorId,
    }), true);
});

test("event append is hash chained and exact retry is idempotent", () => {
    const first = append(basePayload(), "SESSION_OPENED", "open-key-0001", { openingCashMinor: 15000 });
    const replay = append(first.payload, "SESSION_OPENED", "open-key-0001", { openingCashMinor: 15000 });
    assert.equal(replay.replayed, true);
    assert.equal(replay.event.eventHash, first.event.eventHash);
    assert.equal(replay.payload.events.length, 1);
    assert.equal(isValidTpvTestRunPayload(first.payload, {
        siteId: first.payload.siteId,
        sessionId: first.payload.sessionId,
        actorId: first.payload.actorId,
    }), true);
});

test("same idempotency key with a different payload is a conflict", () => {
    const first = append(basePayload(), "SESSION_OPENED", "open-key-0002", { openingCashMinor: 15000 });
    assert.throws(() =>
        append(first.payload, "SESSION_OPENED", "open-key-0002", { openingCashMinor: 20000 }),
    /TPV_IDEMPOTENCY_CONFLICT/);
});

test("tampering with a prior event invalidates the hash chain", () => {
    let payload = append(basePayload(), "SESSION_OPENED", "open-key-0003", { openingCashMinor: 15000 }).payload;
    payload = append(payload, "SALE_RECORDED", "sale-key-0003", {
        saleId: "SALE-1",
        totalMinor: 12100,
        payments: [{ method: "EFECTIVO", amountAppliedMinor: 12100 }],
    }).payload;
    assert.equal(isValidTpvTestRunPayload(payload, {
        siteId: payload.siteId,
        sessionId: payload.sessionId,
        actorId: payload.actorId,
    }), true);
    const tampered = {
        ...payload,
        events: payload.events.map((event, index) => index === 1
            ? { ...event, data: { ...event.data, totalMinor: 99999 } }
            : event),
    };
    assert.equal(isValidTpvTestRunPayload(tampered, {
        siteId: tampered.siteId,
        sessionId: tampered.sessionId,
        actorId: tampered.actorId,
    }), false);
});

test("session summary reconciles cash, card, Bizum, refunds and movements in minor units", () => {
    let payload = basePayload();
    payload = append(payload, "SESSION_OPENED", "summary-open-001", { openingCashMinor: 15000 }).payload;
    payload = append(payload, "SALE_RECORDED", "summary-sale-001", {
        saleId: "SALE-1",
        totalMinor: 12100,
        payments: [
            { method: "EFECTIVO", amountAppliedMinor: 5000 },
            { method: "TARJETA", amountAppliedMinor: 7100 },
        ],
    }).payload;
    payload = append(payload, "REFUND_RECORDED", "summary-refund-001", {
        saleId: "SALE-1",
        totalMinor: 2100,
        payments: [{ method: "TARJETA", amountMinor: 2100 }],
    }).payload;
    payload = append(payload, "CASH_MOVEMENT", "summary-in-001", {
        movementType: "ENTRADA",
        amountMinor: 500,
    }).payload;
    payload = append(payload, "CASH_MOVEMENT", "summary-out-001", {
        movementType: "SALIDA",
        amountMinor: 1000,
    }).payload;

    const summary = summarizeTpvTestRun(payload);
    assert.equal(summary.openingCashMinor, 15000);
    assert.equal(summary.grossSalesMinor, 12100);
    assert.equal(summary.refundsMinor, 2100);
    assert.equal(summary.netSalesMinor, 10000);
    assert.equal(summary.cashMinor, 5000);
    assert.equal(summary.cardMinor, 5000);
    assert.equal(summary.cashInMinor, 500);
    assert.equal(summary.cashOutMinor, 1000);
    assert.equal(summary.expectedCashMinor, 19500);
    assert.equal(summary.ticketCount, 1);
    assert.equal(summary.refundCount, 1);
});

test("test-run IDs are stable, site scoped and CMS length bounded", () => {
    const first = tpvTestRunId("SESSION-1", "SITE-1");
    assert.equal(first, tpvTestRunId("SESSION-1", "SITE-1"));
    assert.notEqual(first, tpvTestRunId("SESSION-1", "SITE-2"));
    assert.equal(first.length, 36);
    assert.match(first, /^TPVTR[a-f0-9]{31}$/);
});

test("ControlOperativo test-run writes are isolated and CAS-only", () => {
    const payload = basePayload();
    const opened = append(payload, "SESSION_OPENED", "policy-open-001", { openingCashMinor: 15000 });
    const item = {
        _id: tpvTestRunId(payload.sessionId, payload.siteId),
        controlType: CONTROL_TYPE.TPV_TEST_RUN,
        dedupeKey: "TPV_TEST_RUN:" + tpvTestRunId(payload.sessionId, payload.siteId),
        traceId: "TPV-TEST-TRACE-001",
        status: "OPEN",
        version: 0,
        expiresAt: new Date("2026-11-25T21:00:00.000Z"),
        payload: opened.payload,
    };
    assert.doesNotThrow(() => assertInsertAllowed("ControlOperativo", item));
    assert.doesNotThrow(() => ControlOperativo_beforeInsert({ ...item, payload: { ...item.payload } }));
    assert.throws(() => assertUpdateAllowed("ControlOperativo", item), /DATA_ACCESS_ERROR/);
    assert.doesNotThrow(() => assertBulkPatchAllowed("ControlOperativo", [
        { fieldPath: "payload", action: "SET_FIELD", value: opened.payload },
        { fieldPath: "version", action: "INCREMENT_FIELD", value: 1 },
    ], {
        controlType: { $eq: CONTROL_TYPE.TPV_TEST_RUN },
        version: { $eq: 0 },
        status: { $eq: "OPEN" },
    }));
    assert.throws(() => assertRemoveAllowed(
        "ControlOperativo",
        item._id,
        CONTROL_TYPE.TPV_TEST_RUN,
        item
    ), /DATA_ACCESS_ERROR/);
    assert.doesNotThrow(() => assertBulkRemoveAllowed("ControlOperativo", [item._id], {
        condition: {
            filter: {
                controlType: { $eq: CONTROL_TYPE.TPV_TEST_RUN },
                expiresAt: { $lt: new Date("2026-11-26T00:00:00.000Z") },
            },
        },
    }));
    assert.throws(() => assertBulkRemoveAllowed("ControlOperativo", [item._id], {
        condition: {
            filter: { controlType: { $eq: CONTROL_TYPE.TPV_TEST_RUN } },
        },
    }), /CMS_BULK_REMOVE_SCOPE_DENIED/);

    const wrongSite = { ...item, payload: { ...item.payload, siteId: "another-site" } };
    assert.throws(() => ControlOperativo_beforeInsert(wrongSite), /synthetic envelope invalid/);
    assert.equal(TPV_RUNTIME_POLICY.SITE_ID, payload.siteId);
});
