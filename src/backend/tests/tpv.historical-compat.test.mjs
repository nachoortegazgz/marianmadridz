import test from "node:test";
import assert from "node:assert/strict";
import { isValidTpvTestRunPayload, stableTpvTestSerialize, TPV_TEST_GENESIS_HASH } from "../tpv/tpvHistoricalCompat.js";
import { assertInsertAllowed, assertUpdateAllowed, assertRemoveAllowed, assertBulkPatchAllowed } from "../dataAccessPolicy.js";
import { CONTROL_TYPE, OPERATIONAL_COLLECTIONS } from "../internalConfig.js";
const payload = () => ({sourceType:"SYNTHETIC",processingMode:"INTERNAL",reconciliationStatus:"NOT_RECONCILED",isSynthetic:true,realPayment:false,externalSideEffects:false,siteId:"site",sessionId:"legacy-session",actorId:"legacy-actor",schemaVersion:1,ledgerVersion:"TPV_TEST_RUNTIME_V1",events:[],idempotencyIndex:{},openedAt:"2026-11-25T09:00:00.000Z",activeUntil:"2026-11-25T21:00:00.000Z",eventHash:TPV_TEST_GENESIS_HASH});
test("historical TPV serialization is stable",()=>{assert.equal(stableTpvTestSerialize({b:2,a:1}),stableTpvTestSerialize({a:1,b:2}));});
test("historical TPV payloads remain readable",()=>{const p=payload();assert.equal(isValidTpvTestRunPayload(p,{siteId:p.siteId,sessionId:p.sessionId,actorId:p.actorId}),true);assert.equal(isValidTpvTestRunPayload(p,{siteId:"other",sessionId:p.sessionId,actorId:p.actorId}),false);});

test("retired TPV historical runtime records are read-only", () => {
    const collection = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
    const item = { _id: "TPVTR" + "a".repeat(31), controlType: CONTROL_TYPE.TPV_TEST_RUN, dedupeKey: "legacy", traceId: "legacy", status: "OPEN", version: 0, payload: payload() };
    assert.throws(() => assertInsertAllowed(collection, item), /DATA_ACCESS_ERROR/);
    assert.throws(() => assertUpdateAllowed(collection, item), /DATA_ACCESS_ERROR/);
    assert.throws(() => assertRemoveAllowed(collection, item._id, CONTROL_TYPE.TPV_TEST_RUN), /DATA_ACCESS_ERROR/);
    assert.throws(() => assertBulkPatchAllowed(collection, [{ fieldPath: "version", action: "INCREMENT_FIELD", value: 1 }], {
        controlType: { $eq: CONTROL_TYPE.TPV_TEST_RUN }, version: { $eq: 0 }, status: { $eq: "OPEN" },
    }), /DATA_ACCESS_ERROR/);
});
