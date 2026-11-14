import test from "node:test";
import assert from "node:assert/strict";
import { assertBulkPatchAllowed } from "backend/dataAccessPolicy";
import { CONTROL_TYPE, OPERATIONAL_COLLECTIONS } from "backend/internalConfig";

const collection = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;

test("bulk patch policy allows the current GCRA rate-limit CAS contract", () => {
    assert.doesNotThrow(() => assertBulkPatchAllowed(collection, [
        { fieldPath: "payload", action: "SET_FIELD", value: {} },
        { fieldPath: "requestCount", action: "INCREMENT_FIELD", value: 1 },
        { fieldPath: "version", action: "INCREMENT_FIELD", value: 1 },
        { fieldPath: "expiresAt", action: "SET_FIELD", value: new Date() },
    ], {
        controlType: { $eq: CONTROL_TYPE.RATE_LIMIT },
        version: { $eq: 4 },
    }));
});

test("bulk patch policy allows slot-lock CAS with version or legacy expiry", () => {
    assert.doesNotThrow(() => assertBulkPatchAllowed(collection, [
        { fieldPath: "expiresAt", action: "SET_FIELD", value: new Date() },
        { fieldPath: "heartbeatAt", action: "SET_FIELD", value: new Date() },
        { fieldPath: "payload", action: "SET_FIELD", value: {} },
        { fieldPath: "version", action: "INCREMENT_FIELD", value: 1 },
        { fieldPath: "serviceId", action: "SET_FIELD", value: "service" },
    ], {
        controlType: { $eq: CONTROL_TYPE.SLOT_LOCK },
        version: { $eq: 2 },
    }));
    assert.doesNotThrow(() => assertBulkPatchAllowed(collection, [
        { fieldPath: "version", action: "SET_FIELD", value: 1 },
    ], {
        controlType: { $eq: CONTROL_TYPE.SLOT_LOCK },
        expiresAt: { $eq: new Date() },
    }));
});

test("bulk patch policy allows the current dual-reschedule journal CAS contract", () => {
    assert.doesNotThrow(() => assertBulkPatchAllowed(collection, [
        { fieldPath: "payload", action: "SET_FIELD", value: {} },
        { fieldPath: "version", action: "INCREMENT_FIELD", value: 1 },
        { fieldPath: "traceId", action: "SET_FIELD", value: "trace" },
    ], {
        controlType: { $eq: CONTROL_TYPE.SYSTEM_FLAG },
        version: { $eq: 7 },
    }));
});

test("bulk patch policy allows fenced WEBHOOK_CLAIM state transitions only", () => {
    assert.doesNotThrow(() => assertBulkPatchAllowed(collection, [
        { fieldPath: "status", action: "SET_FIELD", value: "COMPLETED" },
        { fieldPath: "ownerToken", action: "SET_FIELD", value: "worker-token" },
        { fieldPath: "payload", action: "SET_FIELD", value: { completedAt: new Date() } },
        { fieldPath: "attempts", action: "SET_FIELD", value: 2 },
        { fieldPath: "expiresAt", action: "SET_FIELD", value: new Date() },
        { fieldPath: "version", action: "INCREMENT_FIELD", value: 1 },
    ], {
        controlType: { $eq: CONTROL_TYPE.WEBHOOK_CLAIM },
        status: { $eq: "IN_PROGRESS" },
        ownerToken: { $eq: "worker-token" },
        version: { $eq: 3 },
    }));
});

test("bulk patch policy denies business, fiscal and append-only collections", () => {
    for (const target of ["CitasF2", "MovimientosCaja", "ControlOperativo"]) {
        if (target === "ControlOperativo") {
            assert.throws(() => assertBulkPatchAllowed(collection, [
                { fieldPath: "status", action: "SET_FIELD", value: "CLOSED" },
            ], {
                controlType: { $eq: CONTROL_TYPE.WEBHOOK_EVENT },
                version: { $eq: 1 },
            }), { code: "BULK_PATCH_POLICY_TYPE_DENIED" });
        } else {
            assert.throws(() => assertBulkPatchAllowed(target, [
                { fieldPath: "status", action: "SET_FIELD", value: "CLOSED" },
            ], {
                controlType: { $eq: CONTROL_TYPE.SYSTEM_FLAG },
                version: { $eq: 1 },
            }), { code: "BULK_PATCH_POLICY_COLLECTION_DENIED" });
        }
    }
});

test("bulk patch policy rejects unapproved fields, actions and missing CAS", () => {
    assert.throws(() => assertBulkPatchAllowed(collection, [
        { fieldPath: "transactionId", action: "SET_FIELD", value: "overwrite" },
    ], {
        controlType: { $eq: CONTROL_TYPE.SYSTEM_FLAG },
        version: { $eq: 1 },
    }), { code: "BULK_PATCH_POLICY_FIELD_OR_ACTION_DENIED" });

    assert.throws(() => assertBulkPatchAllowed(collection, [
        { fieldPath: "payload", action: "REMOVE_FIELD" },
    ], {
        controlType: { $eq: CONTROL_TYPE.SYSTEM_FLAG },
        version: { $eq: 1 },
    }), { code: "BULK_PATCH_POLICY_FIELD_OR_ACTION_DENIED" });

    assert.throws(() => assertBulkPatchAllowed(collection, [
        { fieldPath: "payload", action: "SET_FIELD", value: {} },
    ], {
        controlType: { $eq: CONTROL_TYPE.SYSTEM_FLAG },
    }), { code: "BULK_PATCH_POLICY_CAS_CONDITION_INVALID" });

    assert.throws(() => assertBulkPatchAllowed(collection, [
        { fieldPath: "payload", action: "SET_FIELD", value: {} },
    ], null), { code: "BULK_PATCH_POLICY_CONDITION_REQUIRED" });
});
