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


test("EVENT-WEBHOOK-RETRY-02 booking and eCommerce persistence handlers never acknowledge caught failures", () => {
    const handlerNames = [
        "wixBookingsV2_onBookingConfirmed",
        "wixBookingsV2_onBookingRescheduled",
        "wixBookingsV2_onBookingCanceled",
        "wixEcom_onOrderCreated",
        "wixEcom_onOrderPaymentStatusUpdated",
        "wixEcom_onOrderRefunded",
        "wixEcom_onOrderCanceled",
    ];
    for (const name of handlerNames) {
        const start = source.indexOf(`export async function ${name}`);
        const next = source.indexOf("\nexport ", start + 10);
        assert.ok(start >= 0, `${name} must be exported`);
        const handler = source.slice(start, next < 0 ? source.length : next);
        const catchIndex = handler.lastIndexOf("catch (error)");
        assert.ok(catchIndex >= 0, `${name} must handle/log errors`);
        const catchBlock = handler.slice(catchIndex);
        assert.match(catchBlock, /throw error;/, `${name} must propagate persistence failures`);
        assert.doesNotMatch(catchBlock, /return\s*\{\s*status:\s*"OK"\s*\}/, `${name} must not acknowledge a failed write`);
    }
    assert.doesNotMatch(source, /return\s*\{\s*status:\s*"RETRY_REQUIRED"/);
});
