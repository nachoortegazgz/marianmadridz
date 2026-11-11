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


test("EVENT-ORDER-NATIVE-STOCK-01 order-created webhook records idempotency without custom inventory operations", () => {
    const start = source.indexOf("async function _handleWixEcom_onOrderCreated");
    const end = source.indexOf("// WEBHOOK: ORDER PAYMENT STATUS UPDATED", start);
    assert.ok(start >= 0 && end > start, "order-created handler must remain discoverable");
    const handler = source.slice(start, end);

    assert.match(handler, /isOrderCreatedReconciled\(orderId\)/);
    assert.match(handler, /inventoryAuthority:\s*"WIX_CATALOG_OWNER"/);
    assert.match(handler, /inventoryAction:\s*"NO_CUSTOM_STOCK_WRITE"/);
    assert.match(handler, /catch\s*\(error\)\s*\{[\s\S]*?_handleError\(error,\s*"wixEcom_onOrderCreated",\s*traceId\);[\s\S]*?throw error;/);
    assert.doesNotMatch(handler, /reserveOrderInventoryInternal|syncPaidOrderInventoryInternal|MovimientosInventario|InventarioStockVenta/);
});


test("EVENT-WEBHOOK-RETRY-02 booking and eCommerce persistence handlers never acknowledge caught failures", () => {
    const handlerNames = [
        "_handleWixBookingsV2_onBookingConfirmed",
        "_handleWixBookingsV2_onBookingRescheduled",
        "_handleWixBookingsV2_onBookingCanceled",
        "_handleWixEcom_onOrderCreated",
        "_handleWixEcom_onOrderPaymentStatusUpdated",
        "_handleWixEcom_onOrderUpdated",
        "_handleWixEcom_onOrderCanceled",
    ];
    for (const name of handlerNames) {
        const start = source.indexOf(`async function ${name}`);
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


test("EVENT-ORDER-NATIVE-STOCK-02 eCommerce events no longer import the custom inventory module", () => {
    assert.doesNotMatch(source, /backend\/inventario\.web/);
    assert.doesNotMatch(source, /_syncPaidOrderInventoryOrThrow|reserveOrderInventoryInternal|releaseOrderInventoryInternal|syncRestockedOrderInventoryInternal/);
});


test("EVENT-ORDER-NATIVE-STOCK-03 stable payment and order-update handlers route refunds without custom stock writes", () => {
    const paymentStart = source.indexOf("async function _handleWixEcom_onOrderPaymentStatusUpdated");
    const processorStart = source.indexOf("// WIX ECOMMERCE TRANSACTION PROCESSORS", paymentStart);
    const orderUpdatedStart = source.indexOf("async function _handleWixEcom_onOrderUpdated", processorStart);
    const cancelStart = source.indexOf("// WEBHOOK: ORDER CANCELED", orderUpdatedStart);
    assert.ok(paymentStart >= 0 && processorStart > paymentStart);
    assert.ok(orderUpdatedStart > processorStart && cancelStart > orderUpdatedStart);
    const paymentHandler = source.slice(paymentStart, processorStart);
    const refundProcessor = source.slice(processorStart, orderUpdatedStart);
    const orderUpdatedHandler = source.slice(orderUpdatedStart, cancelStart);
    for (const block of [paymentHandler, refundProcessor, orderUpdatedHandler]) {
        assert.doesNotMatch(block, /MovimientosInventario|InventarioStockVenta|syncRestockedOrderInventoryInternal|releaseOrderInventoryInternal|syncPaidOrderInventoryInternal/);
    }
    assert.match(paymentHandler, /PARTIALLY_REFUNDED/);
    assert.match(refundProcessor, /resolveCompletedRefunds/);
    assert.match(orderUpdatedHandler, /processOrderRefundTransactions/);
    assert.match(source, /registrarEventoEconomico\(fiscalPayload\)/);
    assert.match(source, /queueFiscalRecovery\(/);
    assert.doesNotMatch(source, /export async function wixEcom_onOrderRefunded/);
    assert.doesNotMatch(source, /export async function wixEcom_onOrderTransactionsUpdated/);
});
