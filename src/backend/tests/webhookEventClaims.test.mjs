import test from "node:test";
import assert from "node:assert/strict";
import {
    acquireWebhookEventClaim,
    completeWebhookEventClaim,
    releaseWebhookEventClaim,
    runWithWebhookEventClaim,
} from "backend/webhookEventClaims";
import { BUSINESS_COLLECTIONS, WEBHOOK_CLAIM_STATUS } from "backend/internalConfig";
import { wixDataMock } from "./loader.mjs";

const EVENT_ID = "synthetic-wix-event-001";
const EVENT_TYPE = "BOOKING_CONFIRMED";
const BASE_TIME = new Date("2026-11-11T12:00:00.000Z");

function claimCount() {
    return (wixDataMock._store.get(BUSINESS_COLLECTIONS.CONTROL_OPERATIVO) || [])
        .filter((item) => item.controlType === "WEBHOOK_CLAIM").length;
}

test.beforeEach(() => wixDataMock._reset());

test("concurrent deliveries acquire exactly one event claim", async () => {
    const [first, second] = await Promise.all([
        acquireWebhookEventClaim({
            eventId: EVENT_ID,
            eventType: EVENT_TYPE,
            traceId: "worker-one",
            now: BASE_TIME,
        }),
        acquireWebhookEventClaim({
            eventId: EVENT_ID,
            eventType: EVENT_TYPE,
            traceId: "worker-two",
            now: BASE_TIME,
        }),
    ]);

    assert.equal([first, second].filter((item) => item.status === "ACQUIRED").length, 1);
    assert.equal([first, second].filter((item) => item.status === "BUSY").length, 1);
    assert.equal(claimCount(), 1);
});

test("completed event replay is rejected before the handler runs", async () => {
    let sideEffects = 0;
    const first = await runWithWebhookEventClaim({
        eventId: EVENT_ID,
        eventType: EVENT_TYPE,
        traceId: "worker-one",
        handler: async () => {
            sideEffects += 1;
            return { status: "OK" };
        },
    });
    const replay = await runWithWebhookEventClaim({
        eventId: EVENT_ID,
        eventType: EVENT_TYPE,
        traceId: "worker-two",
        handler: async () => {
            sideEffects += 1;
            return { status: "UNEXPECTED" };
        },
    });

    assert.deepEqual(first, { status: "OK" });
    assert.deepEqual(replay, { status: "OK", duplicate: true });
    assert.equal(sideEffects, 1);
});

test("expired lease recovery fences the previous owner", async () => {
    const first = await acquireWebhookEventClaim({
        eventId: EVENT_ID,
        eventType: EVENT_TYPE,
        traceId: "worker-one",
        now: BASE_TIME,
        leaseMs: 1000,
    });
    const recovered = await acquireWebhookEventClaim({
        eventId: EVENT_ID,
        eventType: EVENT_TYPE,
        traceId: "worker-two",
        now: new Date(BASE_TIME.getTime() + 1001),
        leaseMs: 1000,
    });

    assert.equal(recovered.status, "ACQUIRED");
    assert.equal(recovered.claim.version, first.claim.version + 1);
    assert.equal(recovered.claim.ownerToken, "worker-two");
    await assert.rejects(
        completeWebhookEventClaim(first.claim, new Date(BASE_TIME.getTime() + 1002)),
        { code: "WEBHOOK_CLAIM_LOST" }
    );
    await completeWebhookEventClaim(
        recovered.claim,
        new Date(BASE_TIME.getTime() + 1003)
    );
    const rows = wixDataMock._store.get(BUSINESS_COLLECTIONS.CONTROL_OPERATIVO);
    assert.equal(rows[0].status, WEBHOOK_CLAIM_STATUS.COMPLETED);
});

test("failed claim can be retried with a new owner token", async () => {
    const first = await acquireWebhookEventClaim({
        eventId: EVENT_ID,
        eventType: EVENT_TYPE,
        traceId: "worker-one",
        now: BASE_TIME,
    });
    assert.equal(await releaseWebhookEventClaim(first.claim, { code: "SYNTHETIC_FAILURE" }, BASE_TIME), true);

    const retry = await acquireWebhookEventClaim({
        eventId: EVENT_ID,
        eventType: EVENT_TYPE,
        traceId: "worker-two",
        now: new Date(BASE_TIME.getTime() + 1),
    });

    assert.equal(retry.status, "ACQUIRED");
    assert.equal(retry.claim.ownerToken, "worker-two");
    assert.equal(retry.claim.version, first.claim.version + 1);
});

test("active concurrent delivery returns retryable busy without duplicate side effects", async () => {
    let sideEffects = 0;
    let startedResolve;
    let finishResolve;
    const started = new Promise((resolve) => { startedResolve = resolve; });
    const finish = new Promise((resolve) => { finishResolve = resolve; });

    const first = runWithWebhookEventClaim({
        eventId: EVENT_ID,
        eventType: EVENT_TYPE,
        traceId: "worker-one",
        handler: async () => {
            sideEffects += 1;
            startedResolve();
            await finish;
            return { status: "OK" };
        },
    });
    await started;

    await assert.rejects(
        runWithWebhookEventClaim({
            eventId: EVENT_ID,
            eventType: EVENT_TYPE,
            traceId: "worker-two",
            handler: async () => {
                sideEffects += 1;
                return { status: "UNEXPECTED" };
            },
        }),
        { code: "WEBHOOK_EVENT_CLAIM_BUSY" }
    );

    finishResolve();
    await first;
    assert.equal(sideEffects, 1);
});

test("claim requires a stable event identity and owner token", async () => {
    await assert.rejects(
        acquireWebhookEventClaim({ eventId: "", eventType: EVENT_TYPE, traceId: "worker" }),
        { code: "WEBHOOK_CLAIM_IDENTITY_INVALID" }
    );
});
