import test from "node:test";
import assert from "node:assert/strict";

import { resolveOrderLedgerAmount } from "../events.js";

test("FISCAL-ORDER-01 preserves an explicit zero order total", () => {
    assert.equal(
        resolveOrderLedgerAmount({
            priceSummary: { total: { amount: "0.00" } },
            lineItems: [{ price: { amount: "120.00" }, quantity: 1 }],
        }),
        0
    );
});

test("FISCAL-ORDER-02 prefers the explicit order total over line items", () => {
    assert.equal(
        resolveOrderLedgerAmount({
            priceSummary: { total: { amount: "45.50" } },
            lineItems: [{ price: { amount: "120.00" }, quantity: 1 }],
        }),
        45.5
    );
});

test("FISCAL-ORDER-03 uses a valid secondary total when the primary amount is empty", () => {
    assert.equal(
        resolveOrderLedgerAmount({
            priceSummary: { total: { amount: "" } },
            totals: { total: { amount: "25.00" } },
            lineItems: [{ price: { amount: "120.00" }, quantity: 1 }],
        }),
        25
    );
});

test("FISCAL-ORDER-04 uses discounted line totals when the order total is absent", () => {
    assert.equal(
        resolveOrderLedgerAmount({
            lineItems: [
                {
                    price: { amount: "100.00" },
                    totalPriceAfterTax: { amount: "20.00" },
                    quantity: 1,
                },
                {
                    price: { amount: "50.00" },
                    totalPriceAfterTax: { amount: "0.00" },
                    quantity: 1,
                },
            ],
        }),
        20
    );
});

test("FISCAL-ORDER-05 falls back to unit price times quantity only when line totals are absent", () => {
    assert.equal(
        resolveOrderLedgerAmount({
            lineItems: [{ price: { amount: "12.50" }, quantity: 3 }],
        }),
        37.5
    );
});

test("FISCAL-ORDER-06 treats a zero discounted line total as authoritative", () => {
    assert.equal(
        resolveOrderLedgerAmount({
            lineItems: [{
                price: { amount: "80.00" },
                totalPriceAfterTax: { amount: "0.00" },
                quantity: 1,
            }],
        }),
        0
    );
});
