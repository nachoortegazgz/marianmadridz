import test from "node:test";
import assert from "node:assert/strict";

const { wixDataMock } = await import("./loader.mjs");
const IC = await import("backend/internalConfig.js");
const { CATALOG_VERSION, createVariantStockKey } = await import("backend/storesCatalogMapper.js");
const { recordInventoryMovementSafe } = await import("backend/inventario.web.js");

const stockCollection = IC.BUSINESS_COLLECTIONS.INVENTARIO_STOCK_VENTA;
const movementCollection = IC.OPERATIONAL_COLLECTIONS.MOVIMIENTOS_INVENTARIO;
const controlCollection = IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;

test.beforeEach(() => wixDataMock._reset());

test("recordInventoryMovementSafe releases its own SLOT_LOCK after success", async () => {
  const productId = "product-lock-release";
  const variantId = "variant-lock-release";
  const catalogVersion = CATALOG_VERSION.V1;
  const stockId = "stock-lock-release";
  const stockKey = createVariantStockKey({
    catalogVersion,
    productId,
    variantId,
    locationId: null,
  });

  wixDataMock._seed(stockCollection, [{
    _id: stockId,
    stockKey,
    productId,
    variantId,
    wixProductId: productId,
    wixVariantId: variantId,
    catalogVersion,
    locationId: null,
    sku: "SKU-LOCK-RELEASE",
    name: "Lock release test item",
    stockOnHand: 5,
    stockReserved: 1,
    stockAvailable: 4,
  }]);
  wixDataMock._seed(movementCollection, []);
  wixDataMock._seed(controlCollection, []);

  const result = await recordInventoryMovementSafe(
    { stockKey, productId, variantId, catalogVersion, locationId: null },
    "VENTA",
    -1,
    { movementToken: "movement-lock-release", traceId: "trace-lock-release" },
  );

  assert.equal(result.status, "SUCCESS", result.error?.message || "inventory movement failed");
  const controlRows = wixDataMock._store.get(controlCollection) || [];
  assert.equal(controlRows.some((row) => row._id === `INV_LOCK_${stockId}`), false);
  assert.equal(controlRows.length, 0);

  const stock = (wixDataMock._store.get(stockCollection) || []).find((row) => row._id === stockId);
  assert.equal(stock.stockOnHand, 4);
  assert.equal(stock.stockAvailable, 3);
});
