import test from "node:test";
import assert from "node:assert/strict";

const { wixDataMock, mocks } = await import("./loader.mjs");
const IC = await import("backend/internalConfig.js");

let catalogVersion = "V3_CATALOG";
let getStoreVariantCalls = 0;
let nativeQuantity = 6;
mocks.sdk["@wix/stores::@wix/stores::catalogVersioning::getCatalogVersion"] = async () => ({
  catalogVersion,
});
const INVENTORY_ITEM_ID = "55555555-6666-4666-8666-555555555555";
const LOCATION_ID = "66666666-7777-4777-8777-666666666666";
mocks.sdk["@wix/stores::@wix/stores::inventoryItemsV3::queryInventoryItems"] = async (query) => {
  getStoreVariantCalls += 1;
  return {
    inventoryItems: [{
      id: INVENTORY_ITEM_ID,
      productId: PRODUCT_ID,
      variantId: VARIANT_ID,
      locationId: LOCATION_ID,
      quantity: nativeQuantity,
      trackQuantity: true,
      product: {
        name: "Producto de prueba",
        variantName: "Unica",
        variantSku: "SKU-QA-001",
      },
    }],
    pagingMetadata: { count: 1, cursors: {} },
  };
};
mocks.sdk["@wix/stores::@wix/stores::productsV3::getProduct"] = async () => ({
  product: {
    id: PRODUCT_ID,
    name: "Producto de prueba",
    variantsInfo: {
      variants: [{
        id: VARIANT_ID,
        sku: "SKU-QA-001",
        price: { actualPrice: { amount: "25.00" } },
      }],
    },
  },
});
mocks.sdk["@wix/stores::@wix/stores::inventoryItemsV3::bulkIncrementInventoryItems"] = async (data) => {
  nativeQuantity += Number(data?.[0]?.incrementBy || 0);
  return { results: [{ itemMetadata: { success: true }, item: { id: INVENTORY_ITEM_ID, quantity: nativeQuantity } }] };
};
mocks.sdk["@wix/stores::@wix/stores::inventoryItemsV3::bulkDecrementInventoryItems"] = async (data) => {
  nativeQuantity -= Number(data?.[0]?.decrementBy || 0);
  return { results: [{ itemMetadata: { success: true }, item: { id: INVENTORY_ITEM_ID, quantity: nativeQuantity } }] };
};
mocks.sdk["@wix/bookings::bookings::staffMembers"] = {
  queryStaffMembers: async () => ({
  staffMembers: [{
    _id: "77777777-8888-4888-8888-777777777777",
    name: "QA Admin",
    resourceId: "e556070a-6d6a-402e-8422-11133033ea76",
    associatedWixIdentity: {
      connection: { status: "CONNECTED" },
      identificationData: { contactId: "88888888-9999-4999-8999-888888888888" },
    },
    resource: { workingHoursSchedules: [{ _id: "66666666-7777-4888-8999-aaaaaaaaaaaa" }] },
  }],
  }),
};

const INV = await import("backend/inventario.web.js");
const STOCK_COL = IC.BUSINESS_COLLECTIONS.INVENTARIO_STOCK_VENTA;
const MOVEMENTS_COL = IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_INVENTARIO;
const CONTROL_COL = IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const LINE_ID = "22222222-2222-4222-8222-222222222222";
const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";
const VARIANT_ID = "44444444-4444-4444-8444-444444444444";
const STOCK_KEY = `V3:${PRODUCT_ID}:${VARIANT_ID}`;

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
  nativeQuantity = 6;
  mocks.members._current = {
    _id: "99999999-aaaa-4bbb-8ccc-dddddddddddd",
    contactId: "88888888-9999-4999-8999-888888888888",
    loginEmail: "admin@example.test",
  };
  wixDataMock._seed(CONTROL_COL, []);
  wixDataMock._seed(MOVEMENTS_COL, []);
  wixDataMock._seed(STOCK_COL, [{
    _id: "stock-master-001",
    name: "Producto de prueba",
    tipoImpositivo: 21,
    taxIncluded: true,
    price: 25,
    sku: "SKU-QA-001",
    stockOnHand: 8,
    stockReserved: 1,
    stockAvailable: 7,
    stockKey: STOCK_KEY,
    productId: PRODUCT_ID,
    variantId: VARIANT_ID,
    catalogVersion: "V3_CATALOG",
    traceId: "trace-seed",
  }]);
}

test.beforeEach(() => {
  catalogVersion = "V3_CATALOG";
  INV._resetCatalogVersionCacheForTests();
  seed();
});

test("INVENTORY-WRITER-01 mirrors native Wix Catalog V3 stock without writing to native inventory", async () => {
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

test("INVENTORY-WRITER-03 refuses Catalog V1 before any CMS mutation", async () => {
  catalogVersion = "V1_CATALOG";
  const result = await INV.syncPaidOrderInventoryInternal(
    paidOrder(),
    "trace-inventory-004",
    "event-inventory-004"
  );

  assert.equal(result.status, "ERROR");
  assert.equal(result.error.code, "INVENTORY_CATALOG_VERSION_MISMATCH");
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


test("INVENTORY-RESERVE-01 order creation reserves stock once and payment releases the reservation", async () => {
  const order = paidOrder();
  const reserve = await INV.reserveOrderInventoryInternal(order, "trace-reserve-001", "event-reserve-001");
  assert.equal(reserve.status, "SUCCESS");
  assert.equal(wixDataMock._store.get(STOCK_COL)[0].stockReserved, 3);
  assert.equal(wixDataMock._store.get(STOCK_COL)[0].stockAvailable, 5);

  const replay = await INV.reserveOrderInventoryInternal(order, "trace-reserve-002", "event-reserve-002");
  assert.equal(replay.status, "SUCCESS");
  assert.equal(wixDataMock._store.get(STOCK_COL)[0].stockReserved, 3);

  const sale = await INV.syncPaidOrderInventoryInternal(order, "trace-reserve-003", "event-paid-003");
  assert.equal(sale.status, "SUCCESS");
  assert.equal(wixDataMock._store.get(STOCK_COL)[0].stockReserved, 1);
  assert.equal(wixDataMock._store.get(STOCK_COL)[0].stockOnHand, 6);
  assert.equal(wixDataMock._store.get(STOCK_COL)[0].stockAvailable, 5);
  assert.equal(wixDataMock._store.get(MOVEMENTS_COL).length, 1);
});

test("INVENTORY-REFUND-01 only explicit restock side effect creates a positive return movement", async () => {
  seed();
  nativeQuantity = 9;
  wixDataMock._seed(MOVEMENTS_COL, [{
    _id: "sale-movement-001",
    movementToken: "SALE-existing",
    movementType: "VENTA",
    orderId: ORDER_ID,
    lineItemId: LINE_ID,
    productId: PRODUCT_ID,
    variantId: VARIANT_ID,
    stockKey: STOCK_KEY,
    sku: "SKU-QA-001",
    quantityDelta: -2,
    traceId: "trace-sale",
  }]);

  const first = await INV.syncRestockedOrderInventoryInternal(
    ORDER_ID, "refund-001", [{ lineItemId: LINE_ID, quantity: 1 }],
    "WIX_REFUND_RESTOCK", "trace-refund-001", "event-refund-001"
  );
  const second = await INV.syncRestockedOrderInventoryInternal(
    ORDER_ID, "refund-001", [{ lineItemId: LINE_ID, quantity: 1 }],
    "WIX_REFUND_RESTOCK", "trace-refund-002", "event-refund-002"
  );

  assert.equal(first.status, "SUCCESS");
  assert.equal(second.status, "SUCCESS");
  const returns = wixDataMock._store.get(MOVEMENTS_COL).filter((row) => row.movementType === "DEVOLUCION");
  assert.equal(returns.length, 1);
  assert.equal(returns[0].quantityDelta, 1);
  assert.equal(returns[0].refundId, "refund-001");
  assert.equal(wixDataMock._store.get(STOCK_COL)[0].stockOnHand, 9);
});


test("INVENTORY-MANUAL-01 supplier receipt increments Wix Catalog V3 atomically and writes one append-only movement", async () => {
  seed();
  nativeQuantity = 8;
  const input = {
    movementToken: "QA-RECEIPT-2026-001",
    stockKey: STOCK_KEY,
    movementType: "ENTRADA_STOCK",
    quantityDelta: 3,
    reason: "Factura proveedor QA-001",
    referenceId: "FAC-PROV-QA-001",
    traceId: "trace-manual-receipt-001",
  };

  const first = await INV.registerInventoryMovement(input);
  const replay = await INV.registerInventoryMovement(input);

  assert.equal(first.status, "SUCCESS");
  assert.equal(replay.status, "SUCCESS");
  assert.equal(nativeQuantity, 11);
  assert.equal(wixDataMock._store.get(STOCK_COL)[0].stockOnHand, 11);
  assert.equal(wixDataMock._store.get(STOCK_COL)[0].stockAvailable, 10);
  const movements = wixDataMock._store.get(MOVEMENTS_COL);
  assert.equal(movements.length, 1);
  assert.equal(movements[0].movementType, "ENTRADA_STOCK");
  assert.equal(movements[0].quantityDelta, 3);
  assert.equal(movements[0].stockBefore, 8);
  assert.equal(movements[0].stockAfter, 11);
  assert.equal(movements[0].movementToken, input.movementToken);
});


test("INVENTORY-MASTER-01 admin maps a managed Wix Catalog V3 variant with explicit tax and reservation baseline", async () => {
  seed();
  nativeQuantity = 8;
  wixDataMock._seed(STOCK_COL, []);

  const result = await INV.registerInventoryMaster({
    productId: PRODUCT_ID,
    variantId: VARIANT_ID,
    taxRatePercent: 21,
    taxIncluded: true,
    stockReserved: 1,
    traceId: "trace-inventory-master-001",
  });

  assert.equal(result.status, "SUCCESS");
  assert.equal(result.data.alreadyMapped, false);
  assert.equal(result.data.stockKey, STOCK_KEY);
  assert.equal(result.data.tipoImpositivo, 21);
  assert.equal(result.data.taxIncluded, true);
  assert.equal(result.data.stockOnHand, 8);
  assert.equal(result.data.stockReserved, 1);
  assert.equal(result.data.stockAvailable, 7);
});
