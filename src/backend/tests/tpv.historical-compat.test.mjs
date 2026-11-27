import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("historical TPV environment classifier is retired", async () => {
    const source = await readFile(new URL("../tpv/tpvHistoricalCompat.js", import.meta.url), "utf8");
    assert.doesNotMatch(source, /SYNTHETIC|SIMULATED|isValidTpvTestRunPayload|sourceType/);
});
