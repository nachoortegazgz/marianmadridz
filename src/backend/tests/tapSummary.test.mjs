import test from "node:test";
import assert from "node:assert/strict";
import { parseTapSummary } from "./tapSummary.mjs";

test("parseTapSummary reads legacy Node TAP counters", () => {
  assert.deepEqual(parseTapSummary("# tests 12\n# pass 11\n# fail 1\n"), {
    tests: 12, pass: 11, fail: 1
  });
});

test("parseTapSummary reads Node 24 summary counters", () => {
  assert.deepEqual(parseTapSummary("ℹ tests 61\nℹ pass 61\nℹ fail 0\n"), {
    tests: 61, pass: 61, fail: 0
  });
});

test("parseTapSummary does not fabricate success when counters are missing", () => {
  assert.deepEqual(parseTapSummary("startup diagnostic with no TAP result"), {
    tests: 0, pass: 0, fail: 0
  });
});
