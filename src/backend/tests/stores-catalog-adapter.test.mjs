import test from "node:test";
import assert from "node:assert/strict";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const VARIANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const calls = [];

globalThis.__mmStoresMocks = {
    "catalogVersioning.getCatalogVersion": async () => ({
        catalogVersion: "V1_CATALOG",
    }),
    "products.queryStoreVariants": async (query) => {
        calls.push({ method: "queryStoreVariants", query });
        return {
            variants: [{
                productId: PRODUCT_ID,
                variantId: VARIANT_ID,
                productName: "QA Product",
                variantName: "Default",
                managedVariant: true,
                sku: "QA-001",
                stock: { trackQuantity: true, quantity: 5, inStock: true },
                choices: {},
            }],
            metadata: { count: 1, offset: 0, total: 1 },
        };
    },
};

const {
    getStoresCatalogVersion,
    getStoresCatalogVariants,
} = await import("../storesCatalog.js");

test("catalog adapter detects the installed V1 catalog before other calls", async () => {
    assert.equal(await getStoresCatalogVersion(), "V1_CATALOG");
});

test("V1 catalog adapter queries and normalizes native variant identity", async () => {
    const variants = await getStoresCatalogVariants();

    assert.equal(variants.length, 1);
    assert.equal(variants[0].productId, PRODUCT_ID);
    assert.equal(variants[0].variantId, VARIANT_ID);
    assert.equal(variants[0].sku, "QA-001");
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].query, {
        paging: { limit: 100, offset: 0 },
    });
});
