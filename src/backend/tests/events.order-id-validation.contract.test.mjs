import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../events.js", import.meta.url), "utf8");

test("EVENT-ORDER-GUID-01 order-created webhook uses the imported canonical GUID validator", () => {
    assert.match(
        source,
        /import\s*\{[\s\S]*?\b_looksLikeGuid\b[\s\S]*?\}\s*from\s*"public\/mmUtils";/
    );
    assert.match(
        source,
        /if\s*\(!_looksLikeGuid\(orderId\)\)\s*return\s*\{\s*status:\s*"OK",\s*skipped:\s*"ORDER_ID_MISSING"\s*\};/
    );
    assert.doesNotMatch(source, /\bisValidGuid\s*\(/);
});
