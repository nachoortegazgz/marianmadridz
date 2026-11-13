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
  };
}

function seed(record) {
  wixDataMock._reset();
  wixDataMock._seed(COLLECTION, [record]);
}

describe("ControlOperativo hooks", () => {
  it("validates inserts and all type-specific required fields", () => {
    const validLock = {
      ...base(CONTROL_TYPE.SLOT_LOCK),
      resourceId: RESOURCE_ID,
      expiresAt: new Date(Date.now() + 60000),
    };
    assert.deepEqual(ControlOperativo_beforeInsert(validLock), validLock);

    assert.throws(
      () => ControlOperativo_beforeInsert({ ...base("INVALID_TYPE") }),
      /controlType/
    );
    assert.throws(
      () => ControlOperativo_beforeInsert(base(CONTROL_TYPE.WEBHOOK_EVENT)),
      /eventId/
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

  it("allows temporary webhook-event edits but keeps controlType immutable", async () => {
    const original = {
      _id: "event-1",
      ...base(CONTROL_TYPE.WEBHOOK_EVENT),
      eventId: "wix-event-1",
    };
    seed(original);

    await assert.doesNotReject(
      ControlOperativo_beforeUpdate({
        _id: original._id,
        status: CONTROL_STATUS.CLOSED,
      })
    );

    await assert.rejects(
      ControlOperativo_beforeUpdate({
        _id: original._id,
        controlType: CONTROL_TYPE.SLOT_LOCK,
        resourceId: RESOURCE_ID,
        expiresAt: new Date(Date.now() + 60000),
      }),
      /controlType es inmutable/
    );
  });

  it("allows temporary removal by Wix beforeRemove itemId contract", async () => {
    const original = {
      _id: "event-2",
      ...base(CONTROL_TYPE.WEBHOOK_EVENT),
      eventId: "wix-event-2",
    };
    seed(original);

    await assert.doesNotReject(
      ControlOperativo_beforeRemove(original._id)
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
      "DISPLAY_TOKEN",
    ];
    assert.deepEqual(Object.values(CONTROL_TYPE).sort(), expected.sort());
  });
});
