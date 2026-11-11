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
        dedupeKey: "synthetic-dedupe",
        traceId: "synthetic-trace",
        payload: {},
    }]);
}

test.beforeEach(() => wixDataMock._reset());

test("removeById deletes only when the persisted controlType matches", async () => {
    seedControl(CONTROL_TYPE.DUAL_CACHE);

    const result = await removeById(COLLECTION, "control-target", {
        expectedControlType: CONTROL_TYPE.DUAL_CACHE,
    });

    assert.deepEqual(result, { _id: "control-target" });
    assert.equal(wixDataMock._store.get(COLLECTION).length, 0);
});

test("removeById fails closed when the persisted controlType differs", async () => {
    seedControl(CONTROL_TYPE.DISPLAY_TOKEN);

    await assert.rejects(
        removeById(COLLECTION, "control-target", {
            expectedControlType: CONTROL_TYPE.DUAL_CACHE,
        }),
        { code: "REMOVE_CONTROL_TYPE_MISMATCH" }
    );

    assert.equal(wixDataMock._store.get(COLLECTION)[0].controlType, CONTROL_TYPE.DISPLAY_TOKEN);
});

test("removeById fails closed when the target does not exist", async () => {
    wixDataMock._seed(COLLECTION, []);

    await assert.rejects(
        removeById(COLLECTION, "missing-control", {
            expectedControlType: CONTROL_TYPE.DUAL_CACHE,
        }),
        { code: "REMOVE_TARGET_NOT_FOUND" }
    );
});

test("conditional delete prevents a type change between strong read and deletion", async () => {
    seedControl(CONTROL_TYPE.DUAL_CACHE);
    const originalGet = wixDataMock.get;
    let changed = false;

    wixDataMock.get = async (collection, id) => {
        const result = await originalGet(collection, id);
        if (!changed && collection === COLLECTION && id === "control-target") {
            changed = true;
            const rows = wixDataMock._store.get(COLLECTION);
            rows[0].controlType = CONTROL_TYPE.DISPLAY_TOKEN;
        }
        return result;
    };

    await assert.rejects(
        removeById(COLLECTION, "control-target", {
            expectedControlType: CONTROL_TYPE.DUAL_CACHE,
        }),
        { code: "REMOVE_CONDITION_NOT_MET" }
    );

    assert.equal(wixDataMock._store.get(COLLECTION)[0].controlType, CONTROL_TYPE.DISPLAY_TOKEN);
    wixDataMock.get = originalGet;
});
