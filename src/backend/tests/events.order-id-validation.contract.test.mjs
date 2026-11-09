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


test("EVENT-ORDER-RETRY-01 order-created reconciliation skips recovered booking-only orders and propagates every failure", () => {
    const start = source.indexOf("export async function wixEcom_onOrderCreated");
    const end = source.indexOf("// WEBHOOK: ORDER PAYMENT STATUS UPDATED", start);
    assert.ok(start >= 0 && end > start, "order-created handler must remain discoverable");
    const handler = source.slice(start, end);

    assert.match(handler, /isOrderCreatedReconciled\(orderId\)/);
    assert.match(handler, /if\s*\(await isOrderCreatedReconciled\(orderId\)\)\s*\{[\s\S]*?reconciled:\s*true/);
    assert.match(handler, /catch\s*\(error\)\s*\{[\s\S]*?_handleError\(error,\s*"wixEcom_onOrderCreated",\s*traceId\);[\s\S]*?throw error;/);
    assert.doesNotMatch(handler, /return\s*\{\s*status:\s*"OK"\s*\};/);
});
