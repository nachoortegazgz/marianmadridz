import test from "node:test";
import assert from "node:assert/strict";
import {
    buildTpvTaxCalculationLines,
    mapTpvTaxCalculation,
    normalizeTpvSaleLineRequests,
} from "backend/tpv/tpvSalePreparationCore";

const PRODUCT_ID = "b0a75e2a-e194-437b-b8b3-64225a29b6c3";
const SERVICE_ID = "a0a75e2a-e194-437b-b8b3-64225a29b6c3";
const VARIANT_ID = "1d560c12-fefc-4cdf-b0dc-dd2a96af6919";
const STORES_APP_ID = "215238eb-22a5-4c36-9e7b-e7c08025e04e";
const BOOKINGS_APP_ID = "13d21c63-b5ec-5912-8397-c3a5ddb27a97";
const PRODUCTS_TAX_GROUP = "215238eb-22a5-4c36-9e7b-e7c08025e04e";
const SERVICES_TAX_GROUP = "13d21c63-b5ec-5912-8397-c3a5ddb27a97";

function taxDetail(id, taxGroupId, fullPrice, taxableAmount, taxAmount, taxIncludedInPrice = false) {
    return {
        id,
        taxGroupId,
        taxIncludedInPrice,
        taxSummary: {
            fullPrice,
            taxableAmount,
            taxAmount,
            appId: "57d13128-4a4c-494b-80b3-a6fb2e28018d",
        },
        taxBreakdown: [{
            rate: "0.210000",
            taxableAmount,
            taxAmount,
            taxName: "Impuesto",
        }],
    };
}

test("normalizes product and service lines using identifiers and integer quantities", () => {
    const result = normalizeTpvSaleLineRequests([
        { tipoLinea: "producto", itemId: PRODUCT_ID, varianteId: VARIANT_ID, cantidad: 2 },
        { tipoLinea: "SERVICIO", itemId: SERVICE_ID, cantidad: 1 },
    ]);

    assert.equal(result.length, 2);
    assert.equal(result[0].tipoLinea, "PRODUCTO");
    assert.equal(result[0].varianteId, VARIANT_ID);
    assert.equal(result[0].cantidad, 2);
    assert.equal(result[1].tipoLinea, "SERVICIO");
    assert.equal(result[0].stockAfectado, false);
});

test("rejects custom lines whose tax group is not configured", () => {
    assert.throws(
        () => normalizeTpvSaleLineRequests([
            { tipoLinea: "PERSONALIZADA", itemId: PRODUCT_ID, cantidad: 1 },
        ]),
        { code: "TPV_LINE_TAX_CLASSIFICATION_UNSUPPORTED" },
    );
});

test("rejects client-originated discounts until a backend discount contract exists", () => {
    assert.throws(
        () => normalizeTpvSaleLineRequests([
            { tipoLinea: "PRODUCTO", itemId: PRODUCT_ID, cantidad: 1, descuentoImporte: 2 },
        ]),
        { code: "TPV_DISCOUNT_NOT_CONFIGURED" },
    );
});

test("builds tax lines with canonical Wix app IDs and the explicit global tax setting", () => {
    const result = buildTpvTaxCalculationLines([
        {
            itemId: PRODUCT_ID,
            tipoLinea: "PRODUCTO",
            concepto: "Producto",
            cantidad: 1,
            precioUnitario: "22.90",
            currency: "EUR",
            appId: STORES_APP_ID,
            taxGroupId: PRODUCTS_TAX_GROUP,
        },
        {
            itemId: SERVICE_ID,
            tipoLinea: "SERVICIO",
            concepto: "Servicio",
            cantidad: 1,
            precioUnitario: "100.00",
            currency: "EUR",
            appId: BOOKINGS_APP_ID,
        },
    ], false);

    assert.equal(result[0].price, "22.90");
    assert.equal(result[0].taxGroupId, PRODUCTS_TAX_GROUP);
    assert.equal(result[0].appId, STORES_APP_ID);
    assert.equal(result[1].appId, BOOKINGS_APP_ID);
    assert.equal(result[0].taxIncludedInPrice, false);
    assert.deepEqual(result[0].addressIndex, { singleAddress: 0 });
});

test("maps tax-exclusive Wix catalog prices to net base plus tax", () => {
    const catalogLines = [
        {
            itemId: PRODUCT_ID,
            tipoLinea: "PRODUCTO",
            concepto: "Producto",
            cantidad: 1,
            precioUnitario: "22.90",
            currency: "EUR",
            appId: STORES_APP_ID,
        },
        {
            itemId: SERVICE_ID,
            tipoLinea: "SERVICIO",
            concepto: "Servicio",
            cantidad: 1,
            precioUnitario: "100.00",
            currency: "EUR",
            appId: BOOKINGS_APP_ID,
        },
    ];
    const result = mapTpvTaxCalculation({
        catalogLines,
        taxIncludedInPrice: false,
        taxResult: {
            currency: "EUR",
            taxSummary: {
                totalAmount: "122.90",
                totalTaxableAmount: "122.90",
                totalTax: "25.81",
                totalTaxIncludedInPrice: "0.00",
            },
            lineItemTaxDetails: [
                taxDetail("TPV_LINE_1", PRODUCTS_TAX_GROUP, "22.90", "22.90", "4.81"),
                taxDetail("TPV_LINE_2", SERVICES_TAX_GROUP, "100.00", "100.00", "21.00"),
            ],
        },
    });

    assert.equal(result.subtotalNeto, 122.9);
    assert.equal(result.impuestosTotal, 25.81);
    assert.equal(result.totalVenta, 148.71);
    assert.equal(result.taxIncludedInPrice, false);
    assert.equal(result.lineas[0].taxGroupId, PRODUCTS_TAX_GROUP);
    assert.equal(result.lineas[1].impuestosImporte, 21);
});

test("maps tax-inclusive Wix catalog prices to net base and preserves the catalog gross total", () => {
    const result = mapTpvTaxCalculation({
        catalogLines: [{
            itemId: PRODUCT_ID,
            tipoLinea: "PRODUCTO",
            concepto: "Producto",
            cantidad: 1,
            precioUnitario: "22.90",
            currency: "EUR",
            appId: STORES_APP_ID,
        }],
        taxIncludedInPrice: true,
        taxResult: {
            currency: "EUR",
            taxSummary: {
                totalAmount: "22.90",
                totalTaxableAmount: "18.93",
                totalTax: "3.97",
                totalTaxIncludedInPrice: "3.97",
            },
            lineItemTaxDetails: [
                taxDetail("TPV_LINE_1", PRODUCTS_TAX_GROUP, "22.90", "18.93", "3.97", true),
            ],
        },
    });

    assert.equal(result.subtotalNeto, 18.93);
    assert.equal(result.impuestosTotal, 3.97);
    assert.equal(result.totalVenta, 22.9);
    assert.equal(result.taxIncludedInPrice, true);
    assert.equal(result.taxIncludedInPriceAmount, 3.97);
});

test("fails closed when Wix reports a tax price mode different from the global setting", () => {
    assert.throws(
        () => mapTpvTaxCalculation({
            catalogLines: [{
                itemId: PRODUCT_ID,
                tipoLinea: "PRODUCTO",
                concepto: "Producto",
                cantidad: 1,
                precioUnitario: "22.90",
                currency: "EUR",
                appId: STORES_APP_ID,
            }],
            taxIncludedInPrice: false,
            taxResult: {
                currency: "EUR",
                taxSummary: {
                    totalTaxableAmount: "18.93",
                    totalTax: "3.97",
                    totalTaxIncludedInPrice: "3.97",
                },
                lineItemTaxDetails: [
                    taxDetail("TPV_LINE_1", PRODUCTS_TAX_GROUP, "22.90", "18.93", "3.97", true),
                ],
            },
        }),
        { code: "TPV_TAX_PRICE_MODE_MISMATCH" },
    );
});

test("fails closed when Wix tax response is incomplete or inconsistent", () => {
    const catalogLines = [{
        itemId: PRODUCT_ID,
        tipoLinea: "PRODUCTO",
        concepto: "Producto",
        cantidad: 1,
        precioUnitario: "22.90",
        currency: "EUR",
        appId: STORES_APP_ID,
    }];

    assert.throws(
        () => mapTpvTaxCalculation({
            catalogLines,
            taxIncludedInPrice: false,
            taxResult: {
                currency: "EUR",
                taxSummary: {
                    totalTaxableAmount: "22.90",
                    totalTax: "4.81",
                    totalTaxIncludedInPrice: "0",
                },
                lineItemTaxDetails: [],
            },
        }),
        { code: "TPV_TAX_RESULT_INCOMPLETE" },
    );

    assert.throws(
        () => mapTpvTaxCalculation({
            catalogLines,
            taxIncludedInPrice: false,
            taxResult: {
                currency: "EUR",
                taxSummary: {
                    totalAmount: "22.90",
                    totalTaxableAmount: "22.90",
                    totalTax: "5.00",
                    totalTaxIncludedInPrice: "0",
                },
                lineItemTaxDetails: [
                    taxDetail("TPV_LINE_1", PRODUCTS_TAX_GROUP, "22.90", "22.90", "4.81"),
                ],
            },
        }),
        { code: "TPV_TAX_ROUNDING_MISMATCH" },
    );
});
