/*
 * MODULE: backend/catalogV3Adapter.js
 * RESPONSIBILITY: Narrow adapter for Wix Stores Catalog V3 product and inventory APIs.
 * POLICY: Wix Stores owns native stock; this adapter reads it and applies only
 * explicit manual stock adjustments. Order/refund stock side effects are read-only.
 */
import { auth } from "@wix/essentials";
import { catalogVersioning, inventoryItemsV3, productsV3 } from "@wix/stores";

const getCatalogVersionElevated = auth.elevate(catalogVersioning.getCatalogVersion);
const queryInventoryItemsElevated = auth.elevate(inventoryItemsV3.queryInventoryItems);
const getProductElevated = auth.elevate(productsV3.getProduct);
const bulkIncrementElevated = auth.elevate(inventoryItemsV3.bulkIncrementInventoryItems);
const bulkDecrementElevated = auth.elevate(inventoryItemsV3.bulkDecrementInventoryItems);

function _failure(code, message) {
    return Object.assign(new Error(message), { code });
}

function _inventoryId(item) {
    return String(item?._id || item?.id || "").trim();
}

function _toVariant(item, product, variant) {
    const stock = {
        trackQuantity: item?.trackQuantity === true,
        quantity: Number(item?.quantity),
    };
    return {
        productId: String(item?.productId || ""),
        variantId: String(item?.variantId || ""),
        productName: String(product?.name || item?.product?.name || ""),
        variantName: String(item?.product?.variantName || ""),
        sku: String(variant?.sku || item?.product?.variantSku || ""),
        price: { amount: String(variant?.price?.actualPrice?.amount ?? "") },
        stock,
        inventoryItemId: _inventoryId(item),
        locationId: String(item?.locationId || ""),
        choices: variant?.choices || [],
    };
}

export async function getCatalogVersion() {
    const result = await getCatalogVersionElevated();
    return { catalogVersion: String(result?.catalogVersion || "") };
}

/**
 * Resolves one product variant to exactly one V3 inventory item.
 * Multiple locations are deliberately rejected until location allocation is
 * part of the order/stock contract; silently choosing one would corrupt stock.
 */
export async function getCatalogVariant(productAndVariantId) {
    const raw = String(productAndVariantId || "");
    const productId = raw.slice(0, 36);
    const variantId = raw.slice(37);
    if (raw.length !== 73 || raw[36] !== "-" || !productId || !variantId) {
        throw _failure("INVENTORY_CATALOG_ID_INVALID", "Se requiere productId-variantId con GUID validos.");
    }

    const inventoryResponse = await queryInventoryItemsElevated({
        filter: {
            productId: { $eq: productId },
            variantId: { $eq: variantId },
        },
        cursorPaging: { limit: 100 },
    });
    const matches = (inventoryResponse?.inventoryItems || []).filter((item) =>
        String(item?.productId) === productId && String(item?.variantId) === variantId
    );
    if (matches.length === 0) {
        throw _failure("WIX_CATALOG_V3_INVENTORY_ITEM_NOT_FOUND", "No existe un inventory item V3 para la variante.");
    }
    if (matches.length !== 1) {
        throw _failure("INVENTORY_V3_LOCATION_AMBIGUOUS", "La variante tiene inventario en varias ubicaciones; requiere asignacion explicita.");
    }

    const item = matches[0];
    const productResponse = await getProductElevated(productId, {});
    const product = productResponse?.product || productResponse;
    const variant = (product?.variantsInfo?.variants || []).find((entry) =>
        String(entry?._id || entry?.id) === variantId
    );
    if (!product || !variant) {
        throw _failure("WIX_CATALOG_V3_PRODUCT_VARIANT_NOT_FOUND", "No se pudo resolver la variante dentro del producto V3.");
    }
    const result = _toVariant(item, product, variant);
    if (!result.inventoryItemId || !result.locationId) {
        throw _failure("WIX_CATALOG_V3_INVENTORY_IDENTITY_INCOMPLETE", "El inventory item no contiene id o locationId.");
    }
    return { variant: result };
}

/**
 * Returns the inventory items expected by the existing staff candidate UI.
 * Catalog V3 uses cursor paging only; the adapter walks cursors to preserve
 * the current limit/offset WebMethod contract for existing consumers.
 */
export async function queryCatalogInventory(options = {}) {
    const limit = Math.min(100, Math.max(1, Math.floor(Number(options?.paging?.limit) || 100)));
    const offset = Math.max(0, Math.floor(Number(options?.paging?.offset) || 0));
    const wanted = offset + limit;
    const selected = [];
    let cursor;
    let hasNext = true;
    let safetyPages = 0;

    while (hasNext && selected.length < wanted && safetyPages < 20) {
        const query = { cursorPaging: { limit: 1000, ...(cursor ? { cursor } : {}) } };
        const response = await queryInventoryItemsElevated(query);
        const items = Array.isArray(response?.inventoryItems) ? response.inventoryItems : [];
        selected.push(...items);
        cursor = response?.pagingMetadata?.cursors?.next || null;
        hasNext = Boolean(cursor);
        safetyPages += 1;
        if (!items.length) break;
    }

    const page = selected.slice(offset, wanted);
    const variants = page.map((item) => ({
        productId: String(item?.productId || ""),
        variantId: String(item?.variantId || ""),
        productName: String(item?.product?.name || ""),
        variantName: String(item?.product?.variantName || ""),
        sku: String(item?.product?.variantSku || ""),
        managedVariant: true,
        stock: {
            trackQuantity: item?.trackQuantity === true,
            quantity: Number(item?.quantity),
        },
        inventoryItemId: _inventoryId(item),
        locationId: String(item?.locationId || ""),
        choices: {},
    }));
    return {
        variants,
        totalCount: hasNext ? null : selected.length,
        hasNext: offset + variants.length < selected.length || hasNext,
        nextCursor: cursor,
    };
}

async function _applyInventoryChange(method, itemId, quantity, operation) {
    if (!itemId || !Number.isSafeInteger(quantity) || quantity <= 0) {
        throw _failure("INVENTORY_V3_ADJUSTMENT_INVALID", "Se requiere inventoryItemId y cantidad entera positiva.");
    }
    const response = await method(
        [{ inventoryItemId: itemId, [operation === "INCREMENT" ? "incrementBy" : "decrementBy"]: quantity }],
        { returnEntity: true, reason: "MANUAL" }
    );
    const result = response?.results?.[0];
    if (result?.itemMetadata?.success !== true) {
        throw _failure("INVENTORY_V3_BULK_CHANGE_FAILED", "Wix no confirmo el cambio de stock V3.");
    }
    return result.item || null;
}

export async function incrementCatalogInventory(itemId, quantity) {
    return _applyInventoryChange(bulkIncrementElevated, itemId, quantity, "INCREMENT");
}

export async function decrementCatalogInventory(itemId, quantity) {
    return _applyInventoryChange(bulkDecrementElevated, itemId, quantity, "DECREMENT");
}
