import test from "node:test";
import assert from "node:assert/strict";
import { createTpvRecordMetadata } from "../tpv/tpvRecordNature.js";

test("TPV metadata uses one neutral server timestamp without classifying record nature", async () => {
    const metadata = await createTpvRecordMetadata();

    assert.ok(metadata.recordTimestamp instanceof Date);
    assert.ok(Number.isFinite(metadata.recordTimestamp.getTime()));
    assert.deepEqual(Object.keys(metadata), ["recordTimestamp"]);
    assert.equal(Object.isFrozen(metadata), true);
    assert.equal(Object.hasOwn(metadata, "recordNature"), false);
    assert.equal(Object.hasOwn(metadata, "isSynthetic"), false);
});
