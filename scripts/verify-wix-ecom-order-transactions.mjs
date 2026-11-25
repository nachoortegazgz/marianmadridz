import assert from "node:assert/strict";
import { draftOrders, orderTransactions, taxCalculation, taxGroups, taxRegions } from "@wix/ecom";

assert.equal(
    typeof orderTransactions?.listTransactionsForSingleOrder,
    "function",
    "@wix/ecom orderTransactions.listTransactionsForSingleOrder must be exported by the installed SDK"
);

assert.equal(
    typeof draftOrders?.createDraftOrder,
    "function",
    "@wix/ecom draftOrders.createDraftOrder must be exported by the installed SDK"
);

for (const [name, operation] of [
    ["draftOrders.getDraftOrder", draftOrders?.getDraftOrder],
    ["draftOrders.queryDraftOrders", draftOrders?.queryDraftOrders],
    ["draftOrders.deleteDraftOrder", draftOrders?.deleteDraftOrder],
    ["taxCalculation.calculateTax", taxCalculation?.calculateTax],
    ["taxGroups.queryTaxGroups", taxGroups?.queryTaxGroups],
    ["taxGroups.listDefaultTaxGroupsByAppIds", taxGroups?.listDefaultTaxGroupsByAppIds],
    ["taxRegions.queryTaxRegions", taxRegions?.queryTaxRegions],
]) {
    assert.equal(typeof operation, "function", `@wix/ecom ${name} must be exported by the installed SDK`);
}

process.stdout.write(
    "Wix SDK contracts OK: @wix/ecom Draft Orders, order transactions and tax calculation APIs\n"
);
