import test from "node:test";
import assert from "node:assert/strict";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const VARIANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LOCATION_ID = "22222222-2222-4222-8222-222222222222";

const calls = [];
const page = (itemsKey, items) => async (...args) => {
    calls.push({ method: itemsKey, args });
    return {
        [itemsKey]: items,
        pagingMetadata: { hasNext: false, cursors: {} },
    };
};

globalThis.__mmStoresMocks = {
    "catalogVersioning.getCatalogVersion": async () => ({
        catalogVersion: "V3_CATALOG",
    }),
    "productsV3.queryProducts": page("products", [{
        _id: PRODUCT_ID,
        name: "QA Product V3",
        slug: "qa-product-v3",
        visible: true,
    }]),
    "readOnlyVariantsV3.queryVariants": page("variants", [{
        variantId: VARIANT_ID,
        sku: "QA-V3-001",
        productData: { productId: PRODUCT_ID, name: "QA Product V3" },
        optionChoices: [],
    }]),
    "inventoryItemsV3.queryInventoryItems": page("inventoryItems", [{
        productId: PRODUCT_ID,
        variantId: VARIANT_ID,
        locationId: LOCATION_ID,
        trackQuantity: true,
        quantity: 6,
    }]),
    "storesLocationsV3.queryStoresLocations": async (query) => {
        calls.push({ method: "queryStoresLocations", query });
        return {
            storesLocations: [{
                id: LOCATION_ID,
                defaultLocation: true,
            }],
            pagingMetadata: { hasNext: false, cursors: {} },
        };
    },
};

const { getStoresCatalogSnapshot } = await import("../storesCatalog.js");

test("V3 catalog snapshot reads products, variants, inventory and default location", async () => {
    const snapshot = await getStoresCatalogSnapshot();

    assert.equal(snapshot.catalogVersion, "V3_CATALOG");
    assert.equal(snapshot.products[0].productId, PRODUCT_ID);
    assert.equal(snapshot.variants[0].variantId, VARIANT_ID);
    assert.equal(snapshot.inventoryItems[0].locationId, LOCATION_ID);
    assert.equal(snapshot.inventoryItems[0].stockKey, `V3:${PRODUCT_ID}:${VARIANT_ID}:${LOCATION_ID}`);
    assert.equal(snapshot.defaultLocationId, LOCATION_ID);

    const locationCall = calls.find((call) => call.method === "queryStoresLocations");
    assert.deepEqual(locationCall.query.filter, { defaultLocation: true });
});
