import test from "node:test";
import assert from "node:assert/strict";
import { queryItems, query, wql, getItem } from "backend/dataAccess";
import * as DAL from "backend/dataAccess";

test("DATA-QUERY-01 rejects negative, fractional and out-of-range offsets", async () => {
    for (const offset of [-1, 1.5, 2147483648]) {
        await assert.rejects(
            queryItems({ dataCollectionId: "TestCollection", limit: 10, offset }),
            { code: "QUERY_OFFSET_INVALID" }
        );
    }
});

test("DATA-QUERY-02 rejects zero, negative, fractional and out-of-range limits", async () => {
    for (const limit of [0, -1, 1.5, 2147483648]) {
        await assert.rejects(
            queryItems({ dataCollectionId: "TestCollection", limit, offset: 0 }),
            { code: "QUERY_LIMIT_INVALID" }
        );
    }
});

test("DATA-QUERY-03 array membership is explicit and unsupported contains helpers are absent", () => {
    assert.equal(typeof query("TestCollection").hasSome, "function");
    assert.equal(typeof query("TestCollection").hasAll, "function");
    assert.equal(query("TestCollection").contains, undefined);
    assert.equal(wql.hasSome("resourceIds", ["resource-1"]).resourceIds.$hasSome[0], "resource-1");
    assert.equal(wql.hasAll("resourceIds", ["resource-1", "resource-2"]).resourceIds.$hasAll.length, 2);
    assert.equal(wql.contains, undefined);
});


test("DATA-QUERY-04 getItem distinguishes invalid arguments from a genuinely missing item", async () => {
    await assert.rejects(
        getItem("", "valid-id"),
        { code: "DATA_COLLECTION_REQUIRED" }
    );
    await assert.rejects(
        getItem("TestCollection", ""),
        { code: "DATA_ITEM_ID_REQUIRED" }
    );
    await assert.rejects(
        getItem("TestCollection", 123),
        { code: "DATA_ITEM_ID_REQUIRED" }
    );
});

test("DATA-QUERY-05 unused queryReferencedItems API is removed after consumer audit", () => {
    assert.equal(DAL.queryReferencedItems, undefined);
});
