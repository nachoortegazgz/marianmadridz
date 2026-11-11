import assert from "node:assert/strict";
import { orderTransactions } from "@wix/ecom";

assert.equal(
    typeof orderTransactions?.listTransactionsForSingleOrder,
    "function",
    "@wix/ecom orderTransactions.listTransactionsForSingleOrder must be exported by the installed SDK"
);

process.stdout.write(
    "Wix SDK contract OK: @wix/ecom orderTransactions.listTransactionsForSingleOrder\n"
);
