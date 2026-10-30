/**
 * Wix Stores catalog adapter.
 *
 * Every Stores operation is gated by Catalog Versioning. V1 and V3 SDK
 * namespaces are never mixed within a request. Catalog version is permanent
 * for a site, so the resolved promise is cached for the backend instance.
 */

import { auth } from "@wix/essentials";
import {
    catalogVersioning,
    products,
    inventory,
    productsV3,
    readOnlyVariantsV3,
    inventoryItemsV3,
    storesLocationsV3,
} from "@wix/stores";

import {
    CATALOG_VERSION,
    normalizeV1StoreVariant,
    normalizeV1InventoryItem,
    normalizeV3Variant,
    normalizeV3InventoryItem,
} from "backend/storesCatalogMapper";

const elevatedGetCatalogVersion = auth.elevate(
    catalogVersioning.getCatalogVersion,
);
const elevatedQueryStoreVariants = auth.elevate(
    products.queryStoreVariants,
);
const elevatedQueryV1Inventory = auth.elevate(
    inventory.queryInventory,
);
const elevatedQueryProductsV3 = auth.elevate(
    productsV3.queryProducts,
);
const elevatedQueryVariantsV3 = auth.elevate(
    readOnlyVariantsV3.queryVariants,
);
const elevatedQueryInventoryItemsV3 = auth.elevate(
    inventoryItemsV3.queryInventoryItems,
);
const elevatedQueryStoresLocationsV3 = auth.elevate(
    storesLocationsV3.queryStoresLocations,
);

const V1_PAGE_SIZE = 100;
const V3_PRODUCT_PAGE_SIZE = 100;
const V3_ENTITY_PAGE_SIZE = 1000;
const V3_LOCATION_PAGE_SIZE = 100;
const MAX_PAGES = 100;

let catalogVersionPromise = null;

export async function getStoresCatalogVersion() {
    if (!catalogVersionPromise) {
        catalogVersionPromise = elevatedGetCatalogVersion()
            .then((response) => {
                const version = response?.catalogVersion;
                if (![
                    CATALOG_VERSION.V1,
                    CATALOG_VERSION.V3,
                    CATALOG_VERSION.NOT_INSTALLED,
                ].includes(version)) {
                    throw new Error("STORES_CATALOG_VERSION_UNRECOGNIZED");
                }
                return version;
            })
            .catch((error) => {
                catalogVersionPromise = null;
                throw error;
            });
    }
    return catalogVersionPromise;
}

async function collectOffsetPages(fetchPage, itemsKey) {
    const items = [];
    for (let page = 0; page < MAX_PAGES; page += 1) {
        const offset = page * V1_PAGE_SIZE;
        const response = await fetchPage({
            paging: { limit: V1_PAGE_SIZE, offset },
        });
        const current = Array.isArray(response?.[itemsKey])
            ? response[itemsKey]
            : [];
        items.push(...current);
        if (current.length < V1_PAGE_SIZE) return items;
    }
    throw new Error("STORES_V1_PAGINATION_LIMIT_EXCEEDED");
}

async function collectCursorPages(fetchPage, itemsKey, pageSize) {
    const items = [];
    let cursor = null;

    for (let page = 0; page < MAX_PAGES; page += 1) {
        const cursorPaging = { limit: pageSize };
        if (cursor) cursorPaging.cursor = cursor;

        const response = await fetchPage({ cursorPaging });
        const current = Array.isArray(response?.[itemsKey])
            ? response[itemsKey]
            : [];
        items.push(...current);

        const nextCursor = response?.pagingMetadata?.cursors?.next || null;
        if (!nextCursor) {
            if (response?.pagingMetadata?.hasNext === true) {
                throw new Error("STORES_V3_PAGINATION_CURSOR_MISSING");
            }
            return items;
        }
        cursor = nextCursor;
    }

    throw new Error("STORES_V3_PAGINATION_LIMIT_EXCEEDED");
}

async function getV1Snapshot() {
    const [rawVariants, rawInventory] = await Promise.all([
        collectOffsetPages(
            (query) => elevatedQueryStoreVariants(query),
            "variants",
        ),
        collectOffsetPages(
            (query) => elevatedQueryV1Inventory({ query }),
            "inventoryItems",
        ),
    ]);

    const variants = rawVariants.map(normalizeV1StoreVariant);
    const inventoryItems = rawInventory.flatMap(normalizeV1InventoryItem);
    const productsById = new Map();

    for (const variant of variants) {
        if (!productsById.has(variant.productId)) {
            productsById.set(variant.productId, {
                productId: variant.productId,
                name: variant.productName,
            });
        }
    }

    return {
        catalogVersion: CATALOG_VERSION.V1,
        products: Array.from(productsById.values()),
        variants,
        inventoryItems,
        defaultLocationId: null,
    };
}

async function getV3DefaultLocationId() {
    const response = await elevatedQueryStoresLocationsV3({
        filter: { defaultLocation: true },
        cursorPaging: { limit: V3_LOCATION_PAGE_SIZE },
    });
    const locations = Array.isArray(response?.storesLocations)
        ? response.storesLocations
        : [];
    const defaults = locations.filter((location) => (
        location?.defaultLocation === true && String(location?.id || "").trim()
    ));

    if (defaults.length !== 1 || response?.pagingMetadata?.hasNext === true) {
        throw new Error("STORES_V3_DEFAULT_LOCATION_NOT_UNIQUE");
    }
    return String(defaults[0].id).trim();
}

export async function getDefaultStoresLocationId() {
    const version = await getStoresCatalogVersion();
    if (version === CATALOG_VERSION.V1) return null;
    if (version === CATALOG_VERSION.NOT_INSTALLED) {
        throw new Error("STORES_NOT_INSTALLED");
    }
    return getV3DefaultLocationId();
}

async function getV3Snapshot() {
    const [rawProducts, rawVariants, rawInventory, defaultLocationId] = await Promise.all([
        collectCursorPages(
            (query) => elevatedQueryProductsV3(query, { fields: [] }),
            "products",
            V3_PRODUCT_PAGE_SIZE,
        ),
        collectCursorPages(
            (query) => elevatedQueryVariantsV3(query, { fields: [] }),
            "variants",
            V3_ENTITY_PAGE_SIZE,
        ),
        collectCursorPages(
            (query) => elevatedQueryInventoryItemsV3(query),
            "inventoryItems",
            V3_ENTITY_PAGE_SIZE,
        ),
        getV3DefaultLocationId(),
    ]);

    return {
        catalogVersion: CATALOG_VERSION.V3,
        products: rawProducts.map((product) => ({
            productId: String(product?._id || "").trim(),
            name: String(product?.name || "").trim(),
            slug: String(product?.slug || "").trim(),
            visible: product?.visible === true,
            productType: product?.productType || null,
        })).filter((product) => product.productId),
        variants: rawVariants.map(normalizeV3Variant),
        inventoryItems: rawInventory.map(normalizeV3InventoryItem),
        defaultLocationId,
    };
}

export async function getStoresCatalogSnapshot() {
    const version = await getStoresCatalogVersion();

    if (version === CATALOG_VERSION.NOT_INSTALLED) {
        return {
            catalogVersion: version,
            products: [],
            variants: [],
            inventoryItems: [],
            defaultLocationId: null,
        };
    }

    if (version === CATALOG_VERSION.V1) return getV1Snapshot();
    if (version === CATALOG_VERSION.V3) return getV3Snapshot();

    throw new Error("STORES_CATALOG_VERSION_UNSUPPORTED");
}
