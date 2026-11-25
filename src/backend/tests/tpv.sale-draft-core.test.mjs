import assert from "node:assert/strict";
import { test } from "node:test";
import { TPV_STORES_APP_ID } from "../internalConfig.js";
import { registerTpvSaleDraft } from "../tpv/tpvSaleDraftCore.js";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const VARIANT_ID = "22222222-2222-4222-8222-222222222222";
const IDEMPOTENCY_KEY = "33333333-3333-4333-8333-333333333333";
const DRAFT_ORDER_ID = "44444444-4444-4444-8444-444444444444";
const input = {
    sessionId: "TPV-SESSION-20261125",
    idempotencyKey: IDEMPOTENCY_KEY,
    lineas: [{ productId: PRODUCT_ID, variantId: VARIANT_ID, cantidad: 1 }],
    medioPago: "EFECTIVO",
};
const context = {
    traceId: "tpv-test-trace-20261125",
    operatorResourceId: "staff-resource-001",
};

function createHarness(overrides = {}) {
    let marker = null;
    let draftOrder = null;
    let createCalls = 0;
    const product = {
        _id: PRODUCT_ID,
        name: "Producto de prueba",
        visible: true,
        visibleInPos: true,
        currency: "EUR",
        variantsInfo: {
            variants: [{
                _id: VARIANT_ID,
                visible: true,
                price: { actualPrice: { amount: "100.00" } },
            }],
        },
    };

    const deps = {
        now: () => new Date("2026-11-25T04:00:00.000Z"),
        getItem: async (_collection, id) => marker?._id === id ? structuredClone(marker) : null,
        insertItem: async (_collection, item) => {
            if (marker) throw new Error("DUPLICATE_KEY");
            marker = structuredClone(item);
            return structuredClone(marker);
        },
        updateItem: async (_collection, item) => {
            marker = structuredClone(item);
            return structuredClone(marker);
        },
        getProduct: async () => product,
        queryTaxRegions: async () => ({
            taxRegions: [{
                id: "tax-region-es",
                country: "ES",
                subdivision: "*",
                taxIncludedInPrice: false,
            }],
        }),
        listDefaultTaxGroupsByAppIds: async () => ({
            results: [{
                taxGroupMetadata: { success: true },
                taxGroup: { _id: TPV_STORES_APP_ID },
            }],
        }),
        queryTaxGroups: async () => ({ taxGroups: [] }),
        calculateTax: async ({ lineItems }) => ({
            taxSummary: {
                totalTaxableAmount: "100.00",
                totalTax: "21.00",
                totalAmount: "121.00",
            },
            lineItemTaxDetails: lineItems.map((line) => ({
                _id: line._id,
                taxGroupId: line.taxGroupId,
                taxSummary: { taxAmount: "21.00" },
            })),
        }),
        createDraftOrder: async ({ draftOrder: request }) => {
            createCalls += 1;
            draftOrder = {
                _id: DRAFT_ORDER_ID,
                status: "DRAFT",
                currency: "EUR",
                priceSummary: {
                    subtotal: { amount: "100.00" },
                    discount: { amount: "0.00" },
                    tax: { amount: "21.00" },
                    total: { amount: "121.00" },
                    shipping: { amount: "0.00" },
                    totalAdditionalFees: { amount: "0.00" },
                },
                taxInfo: {
                    taxExempt: false,
                    totalTax: { amount: "21.00" },
                },
                lineItems: request.catalogLineItems.map((line) => ({
                    lineItem: {
                        _id: line._id,
                        catalogReference: line.catalogReference,
                        quantity: line.quantity,
                    },
                })),
            };
            return { calculatedDraftOrder: { draftOrder: structuredClone(draftOrder) } };
        },
        getDraftOrder: async () => ({ calculatedDraftOrder: { draftOrder: structuredClone(draftOrder) } }),
        queryDraftOrders: async () => ({
            draftOrders: draftOrder ? [structuredClone(draftOrder)] : [],
            pagingMetadata: { cursors: {} },
        }),
        deleteDraftOrder: async () => {
            draftOrder = null;
        },
        ...overrides,
    };

    return {
        deps,
        getMarker: () => structuredClone(marker),
        getDraftOrder: () => structuredClone(draftOrder),
        getCreateCalls: () => createCalls,
    };
}

test("registrarVenta returns the existing Draft Order on an idempotent replay", async () => {
    const harness = createHarness();
    const first = await registerTpvSaleDraft(input, context, harness.deps);
    const second = await registerTpvSaleDraft(input, context, harness.deps);

    assert.equal(first.status, "PENDING");
    assert.equal(first.orderId, DRAFT_ORDER_ID);
    assert.equal(second.status, "PENDING");
    assert.equal(second.orderId, DRAFT_ORDER_ID);
    assert.equal(second.replayed, true);
    assert.equal(harness.getCreateCalls(), 1);
});

test("registrarVenta rejects missing Catalog V3 products before creating a Draft Order", async () => {
    const harness = createHarness({
        getProduct: async () => null,
    });
    const result = await registerTpvSaleDraft(input, context, harness.deps);

    assert.equal(result.status, "ERROR");
    assert.equal(result.error.code, "TPV_PRODUCT_NOT_FOUND");
    assert.deepEqual(result.invalidProductIds, [PRODUCT_ID]);
    assert.equal(harness.getCreateCalls(), 0);
    assert.equal(harness.getMarker().status, "FAILED_FINAL");
});

test("registrarVenta creates a tax-validated Draft Order and returns its authoritative orderId", async () => {
    const harness = createHarness();
    const result = await registerTpvSaleDraft(input, context, harness.deps);

    assert.equal(result.status, "PENDING");
    assert.equal(result.reason, "TPV_PAYMENT_PROVIDER_NOT_CONFIGURED");
    assert.equal(result.orderId, DRAFT_ORDER_ID);
    assert.equal(result.subtotalNeto, 100);
    assert.equal(result.impuestosTotal, 21);
    assert.equal(result.totalVenta, 121);
    assert.equal(result.retryable, false);
    assert.equal(result.requiresReconciliation, false);
    assert.equal(result.persisted, true);
    assert.equal(result.replayed, false);
    assert.equal(harness.getMarker().status, "PENDING_PAYMENT");
    assert.equal(harness.getMarker().payload.draftOrderId, DRAFT_ORDER_ID);
    assert.equal(harness.getMarker().payload.totalVentaMinor, 12100);
    assert.equal(harness.getCreateCalls(), 1);
});

test("registrarVenta recovers a Draft Order after an uncertain create timeout without retrying creation", async () => {
    let createdDraft = null;
    let createCalls = 0;
    const harness = createHarness({
        createDraftOrder: async ({ draftOrder: request }) => {
            createCalls += 1;
            const line = request.catalogLineItems[0];
            createdDraft = {
                _id: DRAFT_ORDER_ID,
                status: "DRAFT",
                currency: "EUR",
                priceSummary: {
                    subtotal: { amount: "100.00" },
                    discount: { amount: "0.00" },
                    tax: { amount: "21.00" },
                    total: { amount: "121.00" },
                    shipping: { amount: "0.00" },
                    totalAdditionalFees: { amount: "0.00" },
                },
                taxInfo: { taxExempt: false, totalTax: { amount: "21.00" } },
                lineItems: [{
                    lineItem: {
                        _id: line._id,
                        catalogReference: line.catalogReference,
                        quantity: line.quantity,
                    },
                }],
            };
            throw Object.assign(new Error("gateway timeout"), { status: 504 });
        },
        queryDraftOrders: async () => ({
            draftOrders: createdDraft ? [structuredClone(createdDraft)] : [],
            pagingMetadata: { cursors: {} },
        }),
    });
    const result = await registerTpvSaleDraft(input, context, harness.deps);

    assert.equal(result.status, "PENDING");
    assert.equal(result.orderId, DRAFT_ORDER_ID);
    assert.equal(result.replayed, true);
    assert.equal(result.autoResolved, true);
    assert.equal(createCalls, 1);
});
