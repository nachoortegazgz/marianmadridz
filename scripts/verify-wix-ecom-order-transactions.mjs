import assert from "node:assert/strict";
import { draftOrders, orders, orderBilling, orderTransactions } from "@wix/ecom";

assert.equal(
    typeof orderTransactions?.listTransactionsForSingleOrder,
    "function",
    "@wix/ecom orderTransactions.listTransactionsForSingleOrder must be exported by the installed SDK"
);

for (const [name, fn] of [
    ["orders.createOrder", orders?.createOrder],
    ["orders.getOrder", orders?.getOrder],
    ["orders.searchOrders", orders?.searchOrders],
    ["orders.cancelOrder", orders?.cancelOrder],
    ["orderTransactions.addPayments", orderTransactions?.addPayments],
    ["orderTransactions.updatePaymentStatus", orderTransactions?.updatePaymentStatus],
    ["orderBilling.getOrderRefundability", orderBilling?.getOrderRefundability],
    ["orderBilling.refundPayments", orderBilling?.refundPayments],
]) {
    assert.equal(typeof fn, "function", `@wix/ecom ${name} must be exported by the installed SDK`);
}

assert.equal(
    typeof draftOrders?.createDraftOrder,
    "function",
    "@wix/ecom draftOrders.createDraftOrder must be exported by the installed SDK"
);

process.stdout.write(
    "Wix SDK contracts OK: @wix/ecom orderTransactions.listTransactionsForSingleOrder and draftOrders.createDraftOrder\n"
);
