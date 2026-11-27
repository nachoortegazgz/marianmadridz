import test from "node:test";
import assert from "node:assert/strict";
import { createTpvRecordMetadata } from "../tpv/tpvRecordNature.js";

test("TPV metadata uses one neutral server timestamp without classifying record nature", () => {
    const metadata = createTpvRecordMetadata({
        createdAt: "2026-11-27T12:00:00.000Z",
    });

    assert.equal(metadata.recordTimestamp.toISOString(), "2026-11-27T12:00:00.000Z");
    assert.deepEqual(Object.keys(metadata), ["recordTimestamp"]);
    assert.equal(Object.isFrozen(metadata), true);
    assert.equal(Object.hasOwn(metadata, "recordNature"), false);
    assert.equal(Object.hasOwn(metadata, "isSynthetic"), false);
});

test("TPV metadata rejects invalid timestamps", () => {
    assert.throws(
        () => createTpvRecordMetadata({ createdAt: "invalid" }),
        { message: "TPV_RECORD_TIMESTAMP_INVALID" }
    );
});
