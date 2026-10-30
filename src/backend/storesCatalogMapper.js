/**
 * Canonical Wix Stores catalog normalization.
 * V1 and V3 use different SDK models; this module is the only translation
 * boundary used by inventory and migration code.
 */

import { APP_IDS } from "backend/internalConfig";

export const CATALOG_VERSION = Object.freeze({
    V1: "V1_CATALOG",
    V3: "V3_CATALOG",
    NOT_INSTALLED: "STORES_NOT_INSTALLED",
});

const text = (value) => String(value ?? "").trim();
const numericValue = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));

export function createVariantStockKey({
    catalogVersion,
    productId,
    variantId,
    locationId = null,
}) {
    const version = text(catalogVersion);
    const product = text(productId);
    const variant = text(variantId);
    const location = text(locationId);

    if (![CATALOG_VERSION.V1, CATALOG_VERSION.V3].includes(version)) {
        throw new Error("INVALID_CATALOG_VERSION");
    }
    if (!product || !variant) {
        throw new Error("INCOMPLETE_VARIANT_IDENTITY");
    }
    if (version === CATALOG_VERSION.V3 && !location) {
        throw new Error("V3_LOCATION_ID_REQUIRED");
    }
    if (version === CATALOG_VERSION.V1 && location) {
        throw new Error("V1_LOCATION_ID_NOT_SUPPORTED");
    }

    return version === CATALOG_VERSION.V1
        ? `V1:${product}:${variant}`
        : `V3:${product}:${variant}:${location}`;
}

export function normalizeStoreOrderLineItem(
    item,
    index,
    catalogVersion,
    locationId = null,
) {
    if (!item || typeof item !== "object") {
        return { kind: "ERROR", code: "INVALID_ORDER_LINE_ITEM", index };
    }

    const catalogReference = item.catalogReference;
    if (text(catalogReference?.appId) !== APP_IDS.STORES) {
        return { kind: "IGNORE", reason: "NON_STORES_CATALOG_ITEM", index };
    }

    const productId = text(catalogReference?.catalogItemId);
    const variantId = text(catalogReference?.options?.variantId);
    const lineItemId = text(item.id);
    const sku = text(item.physicalProperties?.sku);
    const quantity = Number(item.quantity);

    if (!productId || !variantId || !lineItemId) {
        return {
            kind: "ERROR",
            code: "INCOMPLETE_ORDER_VARIANT_IDENTITY",
            index,
            lineItemId: lineItemId || null,
            productId: productId || null,
            variantId: variantId || null,
        };
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
        return {
            kind: "ERROR",
            code: "INVALID_ORDER_LINE_QUANTITY",
            index,
            lineItemId,
        };
    }

    let stockKey;
    try {
        stockKey = createVariantStockKey({
            catalogVersion,
            productId,
            variantId,
            locationId,
        });
    } catch (error) {
        return {
            kind: "ERROR",
            code: error?.message || "INVALID_VARIANT_STOCK_KEY",
            index,
            lineItemId,
        };
    }

    return {
        kind: "STORE_ITEM",
        index,
        lineItemId,
        productId,
        variantId,
        locationId: locationId || null,
        catalogVersion,
        stockKey,
        sku: sku || null,
        quantity,
    };
}

export function normalizeV1StoreVariant(variant) {
    const productId = text(variant?.productId);
    const variantId = text(variant?.variantId);
    if (!productId || !variantId) {
        throw new Error("V1_VARIANT_IDENTITY_MISSING");
    }

    return {
        catalogVersion: CATALOG_VERSION.V1,
        productId,
        variantId,
        stockKey: createVariantStockKey({
            catalogVersion: CATALOG_VERSION.V1,
            productId,
            variantId,
        }),
        productName: text(variant?.productName),
        variantName: text(variant?.variantName),
        sku: text(variant?.sku) || null,
        choices: variant?.choices || {},
        stock: variant?.stock || null,
    };
}

export function normalizeV1InventoryItem(item) {
    const productId = text(item?.productId);
    if (!productId) throw new Error("V1_INVENTORY_PRODUCT_ID_MISSING");

    const variants = Array.isArray(item?.variants) ? item.variants : [];
    return variants.map((variant) => {
        const variantId = text(variant?.variantId);
        if (!variantId) throw new Error("V1_INVENTORY_VARIANT_ID_MISSING");
        return {
            catalogVersion: CATALOG_VERSION.V1,
            productId,
            variantId,
            locationId: null,
            stockKey: createVariantStockKey({
                catalogVersion: CATALOG_VERSION.V1,
                productId,
                variantId,
            }),
            trackQuantity: item.trackQuantity === true,
            quantity: numericValue(variant?.quantity)
                ? Number(variant.quantity)
                : null,
            inStock: typeof variant?.inStock === "boolean"
                ? variant.inStock
                : null,
            availableForPreorder: variant?.availableForPreorder === true,
        };
    });
}

export function normalizeV3Variant(variant) {
    const productId = text(variant?.productData?.productId);
    const variantId = text(variant?.variantId);
    if (!productId || !variantId) {
        throw new Error("V3_VARIANT_IDENTITY_MISSING");
    }

    return {
        catalogVersion: CATALOG_VERSION.V3,
        productId,
        variantId,
        stockKey: null,
        productName: text(variant?.productData?.name),
        sku: text(variant?.sku) || null,
        optionChoices: Array.isArray(variant?.optionChoices)
            ? variant.optionChoices
            : [],
        price: variant?.price || null,
        inventoryStatus: variant?.inventoryStatus || null,
    };
}

export function normalizeV3InventoryItem(item) {
    const productId = text(item?.productId);
    const variantId = text(item?.variantId);
    const locationId = text(item?.locationId);
    if (!productId || !variantId || !locationId) {
        throw new Error("V3_INVENTORY_VARIANT_LOCATION_IDENTITY_MISSING");
    }

    return {
        catalogVersion: CATALOG_VERSION.V3,
        productId,
        variantId,
        locationId,
        stockKey: createVariantStockKey({
            catalogVersion: CATALOG_VERSION.V3,
            productId,
            variantId,
            locationId,
        }),
        trackQuantity: item.trackQuantity === true,
        quantity: numericValue(item.quantity)
            ? Number(item.quantity)
            : null,
        inStock: typeof item.inStock === "boolean" ? item.inStock : null,
        availabilityStatus: text(item.availabilityStatus) || null,
    };
}

export function buildInventoryMovementToken({
    movementType,
    orderId,
    lineItemId,
    refundId = null,
}) {
    const type = text(movementType).toUpperCase();
    const order = text(orderId);
    const line = text(lineItemId);
    const refund = text(refundId);

    if (!type || !order || !line) {
        throw new Error("INVENTORY_MOVEMENT_TOKEN_INPUT_MISSING");
    }
    if (type === "DEVOLUCION" && !refund) {
        throw new Error("REFUND_ID_REQUIRED_FOR_RETURN");
    }

    return type === "DEVOLUCION"
        ? `REFUND-${refund}-${line}`
        : `ORDER-${order}-${line}`;
}
