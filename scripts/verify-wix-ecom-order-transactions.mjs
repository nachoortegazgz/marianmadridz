import assert from "node:assert/strict";
import { draftOrders, orderTransactions } from "@wix/ecom";

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

process.stdout.write(
    "Wix SDK contracts OK: @wix/ecom orderTransactions.listTransactionsForSingleOrder and draftOrders.createDraftOrder\n"
);
