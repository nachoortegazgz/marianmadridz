import test from "node:test";
import assert from "node:assert/strict";
import { removeById } from "backend/dataAccess";
import { BUSINESS_COLLECTIONS, CONTROL_TYPE } from "backend/internalConfig";
import { wixDataMock } from "./loader.mjs";

const COLLECTION = BUSINESS_COLLECTIONS.CONTROL_OPERATIVO;

function seedControl(controlType, id = "control-target") {
    wixDataMock._seed(COLLECTION, [{
        _id: id,
        controlType,
        dedupeKey: "operational-key",
        traceId: "trace-operational",
        status: "ACTIVE",
        ...(controlType === CONTROL_TYPE.DISPLAY_TOKEN ? {
            bookingId: "11111111-1111-4111-8111-111111111111",
            attempts: 0,
        } : {}),
        expiresAt: new Date(Date.now() + 60000),
        payload: controlType === CONTROL_TYPE.DISPLAY_TOKEN ? { maxAttempts: 3 } : {},
    }]);
}

test.beforeEach(() => wixDataMock._reset());

test("retiring a dual cache changes state and never deletes the record", async () => {
    seedControl(CONTROL_TYPE.DUAL_CACHE);
    const result = await removeById(COLLECTION, "control-target", {
        expectedControlType: CONTROL_TYPE.DUAL_CACHE,
    });
    assert.equal(result.deleted, false);
    assert.equal(result.retired, true);
    assert.equal(result.status, "INVALIDATED");
    const rows = wixDataMock._store.get(COLLECTION);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, "INVALIDATED");
    assert.equal(new Date(rows[0].expiresAt).getTime(), 0);
});

test("retiring a display token marks it consumed and never deletes it", async () => {
    seedControl(CONTROL_TYPE.DISPLAY_TOKEN);
    const result = await removeById(COLLECTION, "control-target", {
        expectedControlType: CONTROL_TYPE.DISPLAY_TOKEN,
    });
    assert.equal(result.deleted, false);
    assert.equal(result.status, "CONSUMED");
    assert.equal(wixDataMock._store.get(COLLECTION).length, 1);
});

test("retirement fails closed when persisted controlType differs", async () => {
    seedControl(CONTROL_TYPE.DISPLAY_TOKEN);
    await assert.rejects(
        removeById(COLLECTION, "control-target", { expectedControlType: CONTROL_TYPE.DUAL_CACHE }),
        { code: "CONTROL_TYPE_MISMATCH" }
    );
});

test("non-retirable records are never deleted", async () => {
    seedControl(CONTROL_TYPE.WEBHOOK_EVENT);
    await assert.rejects(
        removeById(COLLECTION, "control-target", { expectedControlType: CONTROL_TYPE.WEBHOOK_EVENT }),
        { code: "CMS_DELETE_PROHIBITED" }
    );
    assert.equal(wixDataMock._store.get(COLLECTION).length, 1);
});

test("missing records are reported explicitly", async () => {
    wixDataMock._seed(COLLECTION, []);
    await assert.rejects(
        removeById(COLLECTION, "missing-control", { expectedControlType: CONTROL_TYPE.DUAL_CACHE }),
        { code: "REMOVE_TARGET_NOT_FOUND" }
    );
});
