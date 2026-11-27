import test from "node:test";
import assert from "node:assert/strict";
import { queryItems, query, wql } from "backend/dataAccess";

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
    assert.equal(query("TestCollection").contains, undefined);
    assert.equal(wql.hasSome("resourceIds", ["resource-1"]).resourceIds.$hasSome[0], "resource-1");
    assert.equal(wql.contains, undefined);
});
