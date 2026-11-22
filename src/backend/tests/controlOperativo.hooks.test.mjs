/**
 * ControlOperativo CMS boundary contracts.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ControlOperativo_beforeInsert,
  ControlOperativo_beforeUpdate,
  ControlOperativo_beforeRemove,
  readControlPayload,
} from "../data.js";
import {
  CONTROL_TYPE,
  CONTROL_STATUS,
  WEBHOOK_CLAIM_STATUS,
  OPERATIONAL_COLLECTIONS,
} from "../internalConfig.js";
import { wixDataMock } from "./loader.mjs";

const COLLECTION = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
const RESOURCE_ID = "11111111-1111-4111-8111-111111111111";

function base(controlType) {
  return {
    controlType,
    dedupeKey: `${controlType}:unit-test-key`,
    status: CONTROL_STATUS.ACTIVE,
    traceId: "trace-unit-001",
    payload: {},
  };
}

function seed(record) {
  wixDataMock._reset();
  wixDataMock._seed(COLLECTION, [record]);
}

describe("ControlOperativo hooks", () => {
  it("rejects root fields absent from the live Wix schema", () => {
    for (const field of ["pairToken", "maxAttempts", "alertType", "severity", "message", "operationDate"]) {
      const candidate = { ...base(CONTROL_TYPE.SYSTEM_FLAG), [field]: "legacy-root-field" };
      assert.throws(
        () => ControlOperativo_beforeInsert(candidate),
        /absent from live CMS schema/
      );
    }
  });

  it("rejects missing, null, array and primitive payloads required by live CMS schema", () => {
    for (const payload of [undefined, null, [], "not-an-object", 1]) {
      const candidate = { ...base(CONTROL_TYPE.SLOT_LOCK), resourceId: RESOURCE_ID,
        expiresAt: new Date(Date.now() + 60000), payload };
      assert.throws(
        () => ControlOperativo_beforeInsert(candidate),
        /payload OBJECT/
      );
    }
    const valid = { ...base(CONTROL_TYPE.SLOT_LOCK), resourceId: RESOURCE_ID,
      expiresAt: new Date(Date.now() + 60000), payload: {} };
    assert.equal(ControlOperativo_beforeInsert(valid), valid);
  });

  it("validates inserts and all type-specific required fields", () => {
    const validLock = {
      ...base(CONTROL_TYPE.SLOT_LOCK),
      resourceId: RESOURCE_ID,
      expiresAt: new Date(Date.now() + 60000),
    };
    assert.deepEqual(ControlOperativo_beforeInsert(validLock), validLock);

    const validDisplayToken = {
      ...base(CONTROL_TYPE.DISPLAY_TOKEN),
      bookingId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      attempts: 0,
      expiresAt: new Date(Date.now() + 60000),
      payload: { maxAttempts: 3 },
    };
    assert.deepEqual(ControlOperativo_beforeInsert(validDisplayToken), validDisplayToken);
    assert.throws(
      () => ControlOperativo_beforeInsert({ ...validDisplayToken, payload: {} }),
      /maxAttempts/
    );

    const validClaim = {
      ...base(CONTROL_TYPE.WEBHOOK_CLAIM),
      eventId: "wix-event-001",
      eventType: "BOOKING_CONFIRMED",
      status: WEBHOOK_CLAIM_STATUS.IN_PROGRESS,
      version: 1,
      attempts: 1,
      expiresAt: new Date(Date.now() + 60000),
      payload: { eventType: "BOOKING_CONFIRMED" },
    };
    assert.deepEqual(ControlOperativo_beforeInsert(validClaim), validClaim);

    assert.throws(
      () => ControlOperativo_beforeInsert({ ...validClaim, attempts: undefined }),
      /attempts/
    );
    assert.throws(
      () => ControlOperativo_beforeInsert({ ...validClaim, expiresAt: undefined }),
      /expiresAt/
    );
    assert.throws(
      () => ControlOperativo_beforeInsert({ ...validClaim, ownerToken: "retired-token" }),
      /ownerToken/
    );

    assert.throws(
      () => ControlOperativo_beforeInsert({ ...base("INVALID_TYPE") }),
      /controlType/
    );
    assert.throws(
      () => ControlOperativo_beforeInsert(base(CONTROL_TYPE.WEBHOOK_EVENT)),
      /eventId/
    );
    const validEvent = {
      ...base(CONTROL_TYPE.WEBHOOK_EVENT),
      eventId: "wix-event-002",
      eventType: "BOOKING_CONFIRMED",
      processedAt: new Date(),
      payload: { eventType: "BOOKING_CONFIRMED" },
    };
    assert.deepEqual(ControlOperativo_beforeInsert(validEvent), validEvent);
    assert.throws(
      () => ControlOperativo_beforeInsert({ ...validEvent, eventType: undefined }),
      /eventType/
    );
    assert.throws(
      () => ControlOperativo_beforeInsert({ ...validEvent, processedAt: undefined }),
      /processedAt/
    );
    assert.throws(
      () => ControlOperativo_beforeInsert({
        ...base(CONTROL_TYPE.SLOT_LOCK),
        expiresAt: new Date(Date.now() + 60000),
      }),
      /resourceId/
    );
    assert.throws(
      () => ControlOperativo_beforeInsert({
        ...base(CONTROL_TYPE.SLOT_LOCK),
        resourceId: RESOURCE_ID,
        expiresAt: "not-a-date",
      }),
      /expiresAt/
    );
  });

  it("merges partial updates with the persisted record before validating", async () => {
    const original = {
      _id: "lock-1",
      ...base(CONTROL_TYPE.SLOT_LOCK),
      resourceId: RESOURCE_ID,
      expiresAt: new Date(Date.now() + 60000),
      payload: { owner: "saga" },
    };
    seed(original);

    const updated = await ControlOperativo_beforeUpdate({
      _id: original._id,
      status: CONTROL_STATUS.COMPLETED,
    });

    assert.equal(updated.controlType, CONTROL_TYPE.SLOT_LOCK);
    assert.equal(updated.resourceId, RESOURCE_ID);
    assert.equal(updated.dedupeKey, original.dedupeKey);
    assert.equal(updated.traceId, original.traceId);
    assert.deepEqual(updated.payload, original.payload);
    assert.equal(updated.status, CONTROL_STATUS.COMPLETED);
  });

  it("rejects partial updates that break a type-specific invariant", async () => {
    const original = {
      _id: "lock-2",
      ...base(CONTROL_TYPE.SLOT_LOCK),
      resourceId: RESOURCE_ID,
      expiresAt: new Date(Date.now() + 60000),
    };
    seed(original);

    await assert.rejects(
      ControlOperativo_beforeUpdate({
        _id: original._id,
        resourceId: "",
      }),
      /resourceId/
    );
  });

  it("accepts the scoped TPV SANDBOX refund lock as a canonical mutable control type", async () => {
    const original = {
      _id: "tpv-refund-lock-1",
      ...base(CONTROL_TYPE.TPV_REFUND_LOCK),
      version: 0,
      expiresAt: new Date(Date.now() + 60000),
      payload: { environment: "SANDBOX" },
    };
    assert.deepEqual(ControlOperativo_beforeInsert(original), original);
    seed(original);
    const updated = await ControlOperativo_beforeUpdate({
      _id: original._id,
      status: "RELEASED",
      version: 1,
    });
    assert.equal(updated.controlType, CONTROL_TYPE.TPV_REFUND_LOCK);
    assert.equal(updated.status, "RELEASED");
    assert.equal(updated.version, 1);
  });

  it("accepts the scoped TPV SANDBOX session lock as a canonical mutable control type", async () => {
    const original = {
      _id: "tpv-session-lock-1",
      ...base(CONTROL_TYPE.TPV_SESSION_LOCK),
      version: 0,
      expiresAt: new Date(Date.now() + 60000),
      payload: { sessionId: "SANDBOX-SESSION-20261116", environment: "SANDBOX" },
    };
    assert.deepEqual(ControlOperativo_beforeInsert(original), original);
    seed(original);
    const updated = await ControlOperativo_beforeUpdate({
      _id: original._id,
      status: "RELEASED",
      version: 1,
    });
    assert.equal(updated.controlType, CONTROL_TYPE.TPV_SESSION_LOCK);
    assert.equal(updated.status, "RELEASED");
    assert.equal(updated.version, 1);
  });

  it("keeps webhook-event records append-only during SANDBOX", async () => {
    const original = {
      _id: "event-1",
      ...base(CONTROL_TYPE.WEBHOOK_EVENT),
      eventId: "wix-event-1",
      eventType: "BOOKING_CONFIRMED",
      processedAt: new Date(),
    };
    seed(original);

    await assert.rejects(
      ControlOperativo_beforeUpdate({
        _id: original._id,
        status: CONTROL_STATUS.CLOSED,
      }),
      /append-only/
    );

    await assert.rejects(
      ControlOperativo_beforeUpdate({
        _id: original._id,
        controlType: CONTROL_TYPE.SLOT_LOCK,
        resourceId: RESOURCE_ID,
        expiresAt: new Date(Date.now() + 60000),
      }),
      /append-only/
    );
  });

  it("rejects removal of webhook-event evidence during SANDBOX", async () => {
    const original = {
      _id: "event-2",
      ...base(CONTROL_TYPE.WEBHOOK_EVENT),
      eventId: "wix-event-2",
    };
    seed(original);

    await assert.rejects(
      ControlOperativo_beforeRemove(original._id),
      /append-only/
    );
  });

  it("allows removal of an expiring operational lock", async () => {
    const original = {
      _id: "lock-3",
      ...base(CONTROL_TYPE.SLOT_LOCK),
      resourceId: RESOURCE_ID,
      expiresAt: new Date(Date.now() + 60000),
    };
    seed(original);

    assert.equal(
      await ControlOperativo_beforeRemove(original._id),
      original._id
    );
  });

  it("reads only the canonical structured payload", () => {
    assert.deepEqual(
      readControlPayload({ _id: "canonical-control-1", payload: { status: "ACTIVE" } }),
      { status: "ACTIVE" }
    );
    assert.deepEqual(
      readControlPayload({ _id: "retired-control-1", payloadJson: '{"status":"ACTIVE"}' }),
      {}
    );
  });

  it("keeps the canonical control type set", () => {
    const expected = [
      "SLOT_LOCK", "WEBHOOK_CLAIM", "WEBHOOK_EVENT", "IDEMPOTENCY", "RATE_LIMIT",
      "SYSTEM_FLAG", "DEDUPE_KEY", "LEDGER_IDEMPOTENCY",
      "COMPENSATION", "ALERT", "DAYS_CACHE", "DUAL_CACHE",
      "DISPLAY_TOKEN", "TPV_SANDBOX_REFUND_LOCK", "TPV_SANDBOX_SESSION_LOCK",
    ];
    assert.deepEqual(Object.values(CONTROL_TYPE).sort(), expected.sort());
  });
});
