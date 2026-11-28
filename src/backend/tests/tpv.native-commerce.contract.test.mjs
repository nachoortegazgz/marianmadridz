import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const adapterUrl = new URL("../tpv/tpvNativeCommerce.js", import.meta.url);

test("native commerce adapter elevates Wix order and transaction operations", async () => {
    const source = await readFile(adapterUrl, "utf8");
    for (const expression of [
        /auth\.elevate\(orders\.createOrder\)/,
        /auth\.elevate\(orders\.getOrder\)/,
        /auth\.elevate\(orders\.searchOrders\)/,
        /auth\.elevate\(orders\.cancelOrder\)/,
        /auth\.elevate\(orderTransactions\.addPayments\)/,
        /auth\.elevate\(orderTransactions\.listTransactionsForSingleOrder\)/,
    ]) assert.match(source, expression);
});

test("uncertain Create Order is recovered by externalOrderId, never blindly retried", async () => {
    const source = await readFile(adapterUrl, "utf8");
    assert.match(source, /channelInfo\?\.externalOrderId === externalOrderId/);
    assert.match(source, /TPV_WIX_ORDER_CREATE_UNKNOWN/);
    assert.match(source, /searchOrdersByExternalId/);
    assert.doesNotMatch(source, /createOrderElevated\([^\n]*\)\s*;\s*createOrderElevated/);
});

test("cash payments are recorded only after cashier receipt and read back from Wix", async () => {
    const source = await readFile(adapterUrl, "utf8");
    assert.match(source, /offlinePayment: true/);
    assert.match(source, /predefined: "CASH"/);
    assert.match(source, /status: "APPROVED"/);
    assert.match(source, /listTpvNativeOrderPayments/);
    assert.match(source, /waitForOrderPaymentStatus\(orderId, "PAID"\)/);
    assert.match(source, /allowCreate = true/);
    assert.match(source, /if \(!allowCreate\) fail\("TPV_WIX_CASH_PAYMENT_NOT_FOUND_AFTER_WRITE"\)/);
});

test("unpaid native order cancellation restocks Wix inventory and refuses paid orders", async () => {
    const source = await readFile(adapterUrl, "utf8");
    assert.match(source, /TPV_WIX_ORDER_HAS_PAYMENTS_REQUIRES_REFUND/);
    assert.match(source, /restockAllItems: true/);
    assert.match(source, /sendOrderCanceledEmail: false/);
    assert.match(source, /TPV_WIX_ORDER_CANCEL_READBACK_FAILED/);
});
