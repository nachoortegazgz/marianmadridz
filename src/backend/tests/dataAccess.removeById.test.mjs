import test from "node:test";
import assert from "node:assert/strict";
import { removeById, bulkRemove } from "backend/dataAccess";
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
        payload: {},
    }]);
}

test.beforeEach(() => wixDataMock._reset());

test("single-item deletion is prohibited and preserves the original record", async () => {
    seedControl(CONTROL_TYPE.DUAL_CACHE);
    await assert.rejects(
        removeById(COLLECTION, "control-target", { expectedControlType: CONTROL_TYPE.DUAL_CACHE }),
        { code: "CMS_DELETE_PROHIBITED" }
    );
    const rows = wixDataMock._store.get(COLLECTION);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]._id, "control-target");
});

test("bulk deletion is an explicit skipped operation and preserves all records", async () => {
    seedControl(CONTROL_TYPE.DUAL_CACHE);
    const result = await bulkRemove(COLLECTION, ["control-target"], {
        condition: { filter: { controlType: { $eq: CONTROL_TYPE.DUAL_CACHE } } },
    });
    assert.equal(result.removed, 0);
    assert.equal(result.skipped, 1);
    assert.equal(result.failed, 0);
    assert.equal(result.errors[0].code, "CMS_BULK_DELETE_PROHIBITED");
    assert.equal(wixDataMock._store.get(COLLECTION).length, 1);
});

test("missing records are reported explicitly before deletion policy evaluation", async () => {
    wixDataMock._seed(COLLECTION, []);
    await assert.rejects(
        removeById(COLLECTION, "missing-control", { expectedControlType: CONTROL_TYPE.DUAL_CACHE }),
        { code: "REMOVE_TARGET_NOT_FOUND" }
    );
});
