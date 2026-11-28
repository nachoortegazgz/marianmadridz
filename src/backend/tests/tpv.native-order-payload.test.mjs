import test from "node:test";
import assert from "node:assert/strict";
import { buildTpvNativeOrderPayload } from "backend/tpv/tpvNativeOrderPayload";

const STORES_APP_ID = "215238eb-22a5-4c36-9e7b-e7c08025e04e";
const BOOKINGS_APP_ID = "13d21c63-b5ec-5912-8397-c3a5ddb27a97";
const PRODUCT_ID = "b0a75e2a-e194-437b-b8b3-64225a29b6c3";
const SERVICE_ID = "a0a75e2a-e194-437b-b8b3-64225a29b6c3";
const VARIANT_ID = "1d560c12-fefc-4cdf-b0dc-dd2a96af6919";
const TAX_GROUP = "215238eb-22a5-4c36-9e7b-e7c08025e04e";

function prepared() {
    return {
        taxCurrency: "EUR",
        taxIncludedInPrice: false,
        subtotalNeto: 30,
        impuestosTotal: 6.3,
        totalVenta: 36.3,
        lineas: [
            {
                tipoLinea: "PRODUCTO",
                itemId: PRODUCT_ID,
                appId: STORES_APP_ID,
                varianteId: VARIANT_ID,
                concepto: "Producto prueba",
                cantidad: 1,
                precioUnitario: "20.00",
                subtotalNeto: 20,
                impuestosImporte: 4.2,
                totalLinea: 24.2,
                taxIncludedInPrice: false,
                taxGroupId: TAX_GROUP,
                desgloseImpuestos: [{
                    rate: "0.210000",
                    taxableAmount: "20.00",
                    taxAmount: "4.20",
                    taxName: "IVA 21%",
                }],
            },
            {
                tipoLinea: "SERVICIO",
                itemId: SERVICE_ID,
                appId: BOOKINGS_APP_ID,
                concepto: "Servicio prueba",
                cantidad: 1,
                precioUnitario: "10.00",
                subtotalNeto: 10,
                impuestosImporte: 2.1,
                totalLinea: 12.1,
                taxIncludedInPrice: false,
                taxGroupId: TAX_GROUP,
                desgloseImpuestos: [{
                    rate: "0.210000",
                    taxableAmount: "10.00",
                    taxAmount: "2.10",
                    taxName: "IVA 21%",
                }],
            },
        ],
    };
}

test("maps mixed Wix Stores and Bookings lines to one POS order", () => {
    const result = buildTpvNativeOrderPayload(prepared(), {
        contactId: "9f1f0a0a-1111-4111-8111-111111111111",
        email: "fixture@example.com",
    }, "b2e8c1aa-2b44-4c7f-9f7d-2f4d0d5f7b19");

    assert.equal(result.order.channelInfo.type, "POS");
    assert.equal(result.order.channelInfo.externalOrderId, "b2e8c1aa-2b44-4c7f-9f7d-2f4d0d5f7b19");
    assert.equal(result.order.currency, "EUR");
    assert.equal(result.order.buyerInfo.contactId, "9f1f0a0a-1111-4111-8111-111111111111");
    assert.equal(result.order.lineItems.length, 2);
    assert.deepEqual(result.order.lineItems[0].catalogReference, {
        catalogItemId: PRODUCT_ID,
        appId: STORES_APP_ID,
        options: { variantId: VARIANT_ID },
    });
    assert.deepEqual(result.order.lineItems[1].catalogReference, {
        catalogItemId: SERVICE_ID,
        appId: BOOKINGS_APP_ID,
        options: {},
    });
    assert.equal(result.order.lineItems[0].itemType.preset, "PHYSICAL");
    assert.equal(result.order.lineItems[1].itemType.preset, "SERVICE");
    assert.equal(result.order.lineItems[0].paymentOption, undefined);
    assert.equal(result.order.lineItems[1].paymentOption, "FULL_PAYMENT_OFFLINE");
    assert.equal(result.options.settings.orderApprovalStrategy, "PAYMENT_RECEIVED");
    assert.equal(result.order.priceSummary.subtotal.amount, "30.00");
    assert.equal(result.order.priceSummary.tax.amount, "6.30");
    assert.equal(result.order.priceSummary.total.amount, "36.30");
    assert.equal(result.order.lineItems[0].taxInfo.taxRate, "0.21");
    assert.equal(result.order.lineItems[0].taxInfo.taxBreakdown[0].taxAmount.amount, "4.20");
});

test("rejects order totals or line tax breakdowns that do not reconcile", () => {
    const value = prepared();
    value.lineas[0].desgloseImpuestos[0].taxAmount = "4.19";
    assert.throws(() => buildTpvNativeOrderPayload(value, {}, "b2e8c1aa-2b44-4c7f-9f7d-2f4d0d5f7b19"), { code: "TPV_ORDER_TAX_BREAKDOWN_MISMATCH:0" });
});

test("rejects missing native catalog identity or tax classification", () => {
    const value = prepared();
    value.lineas[0].appId = BOOKINGS_APP_ID;
    assert.throws(() => buildTpvNativeOrderPayload(value, {}, "b2e8c1aa-2b44-4c7f-9f7d-2f4d0d5f7b19"), { code: "TPV_ORDER_CATALOG_APP_INVALID:0" });
});

test("rejects invalid buyer identity and non-EUR preparation", () => {
    assert.throws(() => buildTpvNativeOrderPayload(prepared(), {
        contactId: "not-a-guid",
        email: "fixture@example.com",
    }, "b2e8c1aa-2b44-4c7f-9f7d-2f4d0d5f7b19"), { code: "TPV_ORDER_BUYER_CONTACT_INVALID" });

    const value = prepared();
    value.taxCurrency = "USD";
    assert.throws(() => buildTpvNativeOrderPayload(value, {}, "b2e8c1aa-2b44-4c7f-9f7d-2f4d0d5f7b19"), { code: "TPV_ORDER_CURRENCY_INVALID" });
});

test("reconciles gross catalog price when Wix catalog prices include tax", () => {
    const value = prepared();
    value.taxIncludedInPrice = true;
    value.subtotalNeto = 30;
    value.impuestosTotal = 6.3;
    value.totalVenta = 36.3;
    value.lineas[0].taxIncludedInPrice = true;
    value.lineas[0].precioUnitario = "24.20";
    value.lineas[0].subtotalNeto = 20;
    value.lineas[0].impuestosImporte = 4.2;
    value.lineas[0].totalLinea = 24.2;
    value.lineas[1].taxIncludedInPrice = true;
    value.lineas[1].precioUnitario = "12.10";
    value.lineas[1].subtotalNeto = 10;
    value.lineas[1].impuestosImporte = 2.1;
    value.lineas[1].totalLinea = 12.1;
    const result = buildTpvNativeOrderPayload(value, {}, "b2e8c1aa-2b44-4c7f-9f7d-2f4d0d5f7b19");
    assert.equal(result.order.lineItems[0].price.amount, "24.20");
    assert.equal(result.order.lineItems[0].totalPriceBeforeTax.amount, "20.00");
    assert.equal(result.order.lineItems[0].totalPriceAfterTax.amount, "24.20");
});
