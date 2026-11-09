import test from "node:test";
import assert from "node:assert/strict";

import { resolveOrderLedgerAmount, resolveOrderFiscalTaxData } from "../events.js";

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

test("FISCAL-ORDER-07 prefers the documented Wix Velo priceSummary.totalPrice amount", () => {
    assert.equal(
        resolveOrderLedgerAmount({
            priceSummary: { totalPrice: { amount: "45.50" } },
            lineItems: [{ totalPriceAfterTax: { amount: "120.00" }, quantity: 1 }],
        }),
        45.5
    );
});


test("FISCAL-ORDER-08 resolves VAT from current Wix Order.taxInfo and lineItems.taxInfo", () => {
    const result = resolveOrderFiscalTaxData({
        taxInfo: { totalTax: { amount: "7.90" }, taxBreakdown: [] },
        priceSummary: {
            subtotal: { amount: "37.60" },
            tax: { amount: "7.90" },
            total: { amount: "45.50" },
        },
        lineItems: [{
            productName: { original: "Servicio de peluqueria" },
            quantity: 1,
            totalPriceAfterTax: { amount: "45.50" },
            taxInfo: {
                taxableAmount: { amount: "37.60" },
                taxAmount: { amount: "7.90" },
                taxRate: "0.21",
                taxBreakdown: [],
            },
        }],
    });
    assert.equal(result.taxBase, 37.6);
    assert.equal(result.taxAmount, 7.9);
    assert.equal(result.tipoImpositivo, 21);
    assert.deepEqual(result.breakdown.map((line) => [line.base, line.tipo, line.cuota]), [[37.6, 21, 7.9]]);
});

test("FISCAL-ORDER-09 rejects missing tax data instead of inventing 21 percent or zero tax", () => {
    assert.throws(
        () => resolveOrderFiscalTaxData({
            priceSummary: { total: { amount: "45.50" } },
            lineItems: [{ totalPriceAfterTax: { amount: "45.50" } }],
        }),
        /FISCAL_TAX_INFO_MISSING_OR_EXEMPT/
    );
});

test("FISCAL-ORDER-10 rejects a tax summary that does not reconcile to line tax details", () => {
    assert.throws(
        () => resolveOrderFiscalTaxData({
            taxInfo: { totalTax: { amount: "8.00" } },
            priceSummary: { tax: { amount: "8.00" }, total: { amount: "45.50" } },
            lineItems: [{
                totalPriceAfterTax: { amount: "45.50" },
                taxInfo: {
                    taxableAmount: { amount: "37.60" },
                    taxAmount: { amount: "7.90" },
                    taxRate: "0.21",
                },
            }],
        }),
        /FISCAL_ORDER_TAX_TOTAL_MISMATCH/
    );
});
