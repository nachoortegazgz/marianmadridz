import test from "node:test";
import assert from "node:assert/strict";

const { wixDataMock, mocks } = await import("./loader.mjs");
const IC = await import("backend/internalConfig.js");

let catalogVersion = "V1_CATALOG";
let getStoreVariantCalls = 0;
mocks.sdk["@wix/stores::catalogVersioning::getCatalogVersion"] = async () => ({
  catalogVersion,
});
mocks.sdk["@wix/stores::products::getStoreVariant"] = async (storeVariantId) => {
  getStoreVariantCalls += 1;
  const rawId = String(storeVariantId);
  const productId = rawId.slice(0, 36);
  const variantId = rawId.slice(37);
  return {
    variant: {
      productId,
      variantId,
      productName: "Producto de prueba",
      sku: "SKU-QA-001",
      price: { amount: "25.00" },
      stock: { trackQuantity: true, quantity: 6 },
    },
  };
};

const INV = await import("backend/inventario.web.js");
const STOCK_COL = IC.BUSINESS_COLLECTIONS.INVENTARIO_STOCK_VENTA;
const MOVEMENTS_COL = IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_INVENTARIO;
const CONTROL_COL = IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const LINE_ID = "22222222-2222-4222-8222-222222222222";
const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";
const VARIANT_ID = "44444444-4444-4444-8444-444444444444";
const STOCK_KEY = `V1:${PRODUCT_ID}:${VARIANT_ID}`;

function paidOrder() {
  return {
    _id: ORDER_ID,
    taxIncludedInPrices: true,
    lineItems: [{
      _id: LINE_ID,
      quantity: 2,
      catalogReference: {
        appId: IC.WIX_CATALOG_APP_IDS.STORES,
        catalogItemId: PRODUCT_ID,
        options: { variantId: VARIANT_ID },
      },
      productName: { original: "Producto de prueba" },
      taxDetails: { taxRate: "0.21" },
    }],
  };
}

function seed() {
  wixDataMock._reset();
  getStoreVariantCalls = 0;
  wixDataMock._seed(CONTROL_COL, []);
  wixDataMock._seed(MOVEMENTS_COL, []);
  wixDataMock._seed(STOCK_COL, [{
    _id: "stock-master-001",
    name: "Producto de prueba",
    tipoImpositivo: 0.21,
    taxIncluded: true,
    price: 25,
    sku: "SKU-QA-001",
    stockOnHand: 8,
    stockReserved: 1,
    stockAvailable: 7,
    stockKey: STOCK_KEY,
    productId: PRODUCT_ID,
    variantId: VARIANT_ID,
    catalogVersion: "V1_CATALOG",
    traceId: "trace-seed",
  }]);
}

test.beforeEach(() => {
  catalogVersion = "V1_CATALOG";
  seed();
});

test("INVENTORY-WRITER-01 mirrors native Wix V1 stock without writing to native inventory", async () => {
  const result = await INV.syncPaidOrderInventoryInternal(
    paidOrder(),
    "trace-inventory-001",
    "event-inventory-001"
  );

  assert.equal(result.status, "SUCCESS");
  assert.equal(result.data.processed, 1);
  const stock = wixDataMock._store.get(STOCK_COL)[0];
  assert.equal(stock.stockOnHand, 6);
  assert.equal(stock.stockReserved, 1);
  assert.equal(stock.stockAvailable, 5);
  assert.equal(stock.catalogVersion, "V1_CATALOG");

  const movements = wixDataMock._store.get(MOVEMENTS_COL);
  assert.equal(movements.length, 1);
  assert.equal(movements[0].movementType, "VENTA");
  assert.equal(movements[0].quantityDelta, -2);
  assert.equal(movements[0].movementToken.startsWith("SALE_"), true);
  assert.equal(movements[0].nativeCommercialMovement, true);
  assert.equal(movements[0].stockApplied, true);
  assert.equal(getStoreVariantCalls, 1);
});

test("INVENTORY-WRITER-02 repeated paid-order event is idempotent by movementToken", async () => {
  const order = paidOrder();
  const first = await INV.syncPaidOrderInventoryInternal(order, "trace-inventory-002", "event-inventory-002");
  const second = await INV.syncPaidOrderInventoryInternal(order, "trace-inventory-003", "event-inventory-003");

  assert.equal(first.status, "SUCCESS");
  assert.equal(second.status, "SUCCESS");
  assert.equal(wixDataMock._store.get(MOVEMENTS_COL).length, 1);
  assert.equal(second.data.results[0].data.idempotent, true);
  assert.equal(wixDataMock._store.get(STOCK_COL)[0].stockOnHand, 6);
});

test("INVENTORY-WRITER-03 refuses an unsupported catalog version before any CMS mutation", async () => {
  catalogVersion = "V3_CATALOG";
  const result = await INV.syncPaidOrderInventoryInternal(
    paidOrder(),
    "trace-inventory-004",
    "event-inventory-004"
  );

  assert.equal(result.status, "PARTIAL");
  assert.equal(result.error.code, "INVENTORY_ORDER_SYNC_PARTIAL");
  assert.equal(result.data.results[0].code, "INVENTORY_CATALOG_VERSION_MISMATCH");
  assert.equal(wixDataMock._store.get(MOVEMENTS_COL).length, 0);
  assert.equal(wixDataMock._store.get(STOCK_COL)[0].stockOnHand, 8);
});

test("INVENTORY-WRITER-04 missing variant identity fails closed", async () => {
  const order = paidOrder();
  delete order.lineItems[0].catalogReference.options.variantId;
  const result = await INV.syncPaidOrderInventoryInternal(order, "trace-inventory-005", "event-inventory-005");

  assert.equal(result.status, "PARTIAL");
  assert.equal(result.data.results[0].code, "INVENTORY_ORDER_LINE_INVALID");
  assert.equal(wixDataMock._store.get(MOVEMENTS_COL).length, 0);
});
