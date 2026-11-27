import test from "node:test";
import assert from "node:assert/strict";
import { classifyTpvRecordNature } from "../tpv/tpvRecordNature.js";

test("no activation cutoff classifies records as synthetic", () => {
    assert.equal(classifyTpvRecordNature("2026-11-27T00:00:00.000Z", null), "SYNTHETIC");
});
test("timestamp before cutoff is synthetic", () => {
    assert.equal(classifyTpvRecordNature("2026-11-27T04:59:59.999Z", "2026-11-27T05:00:00.000Z"), "SYNTHETIC");
});
test("timestamp exactly at cutoff is real", () => {
    assert.equal(classifyTpvRecordNature("2026-11-27T05:00:00.000Z", "2026-11-27T05:00:00.000Z"), "REAL");
});
test("timestamp after cutoff is real", () => {
    assert.equal(classifyTpvRecordNature("2026-11-27T05:00:00.001Z", "2026-11-27T05:00:00.000Z"), "REAL");
});
test("invalid timestamp or cutoff is rejected", () => {
    assert.throws(() => classifyTpvRecordNature("invalid", null), /TPV_RECORD_TIMESTAMP_INVALID/);
    assert.throws(() => classifyTpvRecordNature("2026-11-27T05:00:00Z", "invalid"), /TPV_PRODUCTION_ACTIVATION_AT_INVALID/);
});
