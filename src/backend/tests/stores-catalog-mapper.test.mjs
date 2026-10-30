import test from "node:test";
import assert from "node:assert/strict";

import {
    CATALOG_VERSION,
    createVariantStockKey,
    normalizeStoreOrderLineItem,
    normalizeV1InventoryItem,
    normalizeV1StoreVariant,
    normalizeV3InventoryItem,
    normalizeV3Variant,
    buildInventoryMovementToken,
} from "../storesCatalogMapper.js";
import { APP_IDS } from "backend/internalConfig";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const VARIANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VARIANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LOCATION_ID = "22222222-2222-4222-8222-222222222222";

test("V1 stock key is variant-scoped and does not use SKU", () => {
    const first = createVariantStockKey({
        catalogVersion: CATALOG_VERSION.V1,
        productId: PRODUCT_ID,
        variantId: VARIANT_A,
    });
    const second = createVariantStockKey({
        catalogVersion: CATALOG_VERSION.V1,
        productId: PRODUCT_ID,
        variantId: VARIANT_B,
    });

    assert.notEqual(first, second);
    assert.equal(first, `V1:${PRODUCT_ID}:${VARIANT_A}`);
});

test("V3 stock key includes the inventory location", () => {
    const first = createVariantStockKey({
        catalogVersion: CATALOG_VERSION.V3,
        productId: PRODUCT_ID,
        variantId: VARIANT_A,
        locationId: LOCATION_ID,
    });

    assert.equal(first, `V3:${PRODUCT_ID}:${VARIANT_A}:${LOCATION_ID}`);
    assert.throws(() => createVariantStockKey({
        catalogVersion: CATALOG_VERSION.V3,
        productId: PRODUCT_ID,
        variantId: VARIANT_A,
    }), /V3_LOCATION_ID_REQUIRED/);
});

test("official V1 eCommerce order line item resolves product, variant and physical SKU", () => {
    const item = normalizeStoreOrderLineItem({
        _id: "line-item-1",
        quantity: 2,
        physicalProperties: { sku: "SKU-SHARED" },
        catalogReference: {
            appId: APP_IDS.STORES,
            catalogItemId: PRODUCT_ID,
            options: { options: { Size: "M" }, variantId: VARIANT_A },
        },
    }, 0, CATALOG_VERSION.V1);

    assert.equal(item.kind, "STORE_ITEM");
    assert.equal(item.productId, PRODUCT_ID);
    assert.equal(item.variantId, VARIANT_A);
    assert.equal(item.sku, "SKU-SHARED");
    assert.equal(item.quantity, 2);
    assert.equal(item.stockKey, `V1:${PRODUCT_ID}:${VARIANT_A}`);
});

test("single un-managed Wix product resolves its sole catalog variant when options.variantId is absent", () => {
    const item = normalizeStoreOrderLineItem({
        _id: "line-unmanaged",
        quantity: 1,
        physicalProperties: { sku: "SKU-SINGLE" },
        catalogReference: {
            appId: APP_IDS.STORES,
            catalogItemId: PRODUCT_ID,
            options: {},
        },
    }, 0, CATALOG_VERSION.V1, null, [
        { productId: PRODUCT_ID, variantId: "00000000-0000-0000-0000-000000000000" },
    ]);

    assert.equal(item.kind, "STORE_ITEM");
    assert.equal(item.variantId, "00000000-0000-0000-0000-000000000000");
});

test("ambiguous multi-variant order line without variantId fails closed", () => {
    const item = normalizeStoreOrderLineItem({
        _id: "line-ambiguous",
        quantity: 1,
        catalogReference: {
            appId: APP_IDS.STORES,
            catalogItemId: PRODUCT_ID,
            options: { options: { Size: "M" } },
        },
    }, 0, CATALOG_VERSION.V1, null, [
        { productId: PRODUCT_ID, variantId: VARIANT_A },
        { productId: PRODUCT_ID, variantId: VARIANT_B },
    ]);

    assert.equal(item.kind, "ERROR");
    assert.equal(item.code, "INCOMPLETE_ORDER_VARIANT_IDENTITY");
});

test("non-Stores order lines are ignored", () => {
    const item = normalizeStoreOrderLineItem({
        _id: "booking-line",
        quantity: 1,
        catalogReference: {
            appId: APP_IDS.BOOKINGS,
            catalogItemId: "booking-service",
            options: {},
        },
    }, 0, CATALOG_VERSION.V1);

    assert.equal(item.kind, "IGNORE");
});

test("Store order lines without a variant identity fail closed", () => {
    const item = normalizeStoreOrderLineItem({
        _id: "line-item-2",
        quantity: 1,
        catalogReference: {
            appId: APP_IDS.STORES,
            catalogItemId: PRODUCT_ID,
            options: {},
        },
    }, 0, CATALOG_VERSION.V1);

    assert.equal(item.kind, "ERROR");
    assert.equal(item.code, "INCOMPLETE_ORDER_VARIANT_IDENTITY");
});

test("V1 inventory is flattened by product and variant, retaining absent quantity", () => {
    const rows = normalizeV1InventoryItem({
        productId: PRODUCT_ID,
        trackQuantity: true,
        variants: [
            { variantId: VARIANT_A, quantity: 7, inStock: true },
            { variantId: VARIANT_B, inStock: false },
        ],
    });

    assert.equal(rows.length, 2);
    assert.equal(rows[0].quantity, 7);
    assert.equal(rows[0].stockKey, `V1:${PRODUCT_ID}:${VARIANT_A}`);
    assert.equal(rows[1].quantity, null);
    assert.equal(rows[1].stockKey, `V1:${PRODUCT_ID}:${VARIANT_B}`);
});

test("V1 variant normalization keeps variant SKU independent", () => {
    const variant = normalizeV1StoreVariant({
        productId: PRODUCT_ID,
        variantId: VARIANT_A,
        productName: "Product",
        variantName: "Size M",
        sku: "SKU-SHARED",
        choices: { Size: "M" },
    });

    assert.equal(variant.sku, "SKU-SHARED");
    assert.equal(variant.variantId, VARIANT_A);
});

test("V3 variant identity uses productData.productId and variantId", () => {
    const variant = normalizeV3Variant({
        variantId: VARIANT_A,
        sku: "SKU-SHARED",
        productData: { productId: PRODUCT_ID, name: "Product" },
        optionChoices: [{ name: "Size", value: "M" }],
    });

    assert.equal(variant.productId, PRODUCT_ID);
    assert.equal(variant.variantId, VARIANT_A);
    assert.equal(variant.sku, "SKU-SHARED");
});

test("V3 inventory identity requires product, variant and location", () => {
    const row = normalizeV3InventoryItem({
        productId: PRODUCT_ID,
        variantId: VARIANT_A,
        locationId: LOCATION_ID,
        trackQuantity: true,
        quantity: 4,
    });

    assert.equal(row.stockKey, `V3:${PRODUCT_ID}:${VARIANT_A}:${LOCATION_ID}`);
    assert.equal(row.quantity, 4);
    assert.throws(() => normalizeV3InventoryItem({
        productId: PRODUCT_ID,
        variantId: VARIANT_A,
        trackQuantity: true,
        quantity: 4,
    }), /V3_INVENTORY_VARIANT_LOCATION_IDENTITY_MISSING/);
});

test("movement idempotency uses line item ID, not SKU", () => {
    const first = buildInventoryMovementToken({
        movementType: "VENTA",
        orderId: "order-1",
        lineItemId: "line-1",
    });
    const second = buildInventoryMovementToken({
        movementType: "VENTA",
        orderId: "order-1",
        lineItemId: "line-2",
    });

    assert.notEqual(first, second);
    assert.equal(first, "ORDER-order-1-line-1");
});

test("refund movement idempotency requires refund ID", () => {
    assert.equal(buildInventoryMovementToken({
        movementType: "DEVOLUCION",
        orderId: "order-1",
        lineItemId: "line-1",
        refundId: "refund-1",
    }), "REFUND-refund-1-line-1");
    assert.throws(() => buildInventoryMovementToken({
        movementType: "DEVOLUCION",
        orderId: "order-1",
        lineItemId: "line-1",
    }), /REFUND_ID_REQUIRED_FOR_RETURN/);
});
