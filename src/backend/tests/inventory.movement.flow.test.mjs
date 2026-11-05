import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

const { wixDataMock } = await import("./loader.mjs");
const IC = await import("backend/internalConfig.js");
const mapper = await import("../storesCatalogMapper.js");
const { recordInventoryMovementSafe } = await import("../inventario.web.js");

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const VARIANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STOCK_KEY = mapper.createVariantStockKey({
  catalogVersion: mapper.CATALOG_VERSION.V1,
  productId: PRODUCT_ID,
  variantId: VARIANT_ID,
});
const INVENTORY_COL = IC.BUSINESS_COLLECTIONS.INVENTARIO_STOCK_VENTA;
const MOVEMENTS_COL = IC.OPERATIONAL_COLLECTIONS.MOVIMIENTOS_INVENTARIO;
const CONTROL_COL = IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
const TRACE_ID = "trace-qa-inventory-flow-001";

function identity(overrides = {}) {
  return {
    catalogVersion: mapper.CATALOG_VERSION.V1,
    productId: PRODUCT_ID,
    variantId: VARIANT_ID,
    stockKey: STOCK_KEY,
    sku: "QA-SKU-001",
    ...overrides,
  };
}

function seedStock(overrides = {}) {
  wixDataMock._seed(INVENTORY_COL, [{
    _id: "qa-stock-row-001",
    stockKey: STOCK_KEY,
    productId: PRODUCT_ID,
    variantId: VARIANT_ID,
    catalogVersion: mapper.CATALOG_VERSION.V1,
    locationId: null,
    sku: "QA-SKU-001",
    name: "Producto QA",
    stockOnHand: 5,
    stockReserved: 1,
    stockAvailable: 4,
    ...overrides,
  }]);
  wixDataMock._seed(MOVEMENTS_COL, []);
  wixDataMock._seed(CONTROL_COL, []);
}

function stockRow() {
  return wixDataMock._store.get(INVENTORY_COL).find((row) => row._id === "qa-stock-row-001");
}

function movementRows() {
  return wixDataMock._store.get(MOVEMENTS_COL) || [];
}

function controlRows() {
  return wixDataMock._store.get(CONTROL_COL) || [];
}

beforeEach(() => {
  wixDataMock._reset();
  seedStock();
});

test("QA-INV-FLOW-01 online sale applies stock once and writes an immutable movement receipt", async () => {
  const result = await recordInventoryMovementSafe(
    identity(),
    "VENTA",
    -2,
    {
      traceId: TRACE_ID,
      movementToken: "ORDER-qa-order-001-line-001",
      orderId: "qa-order-001",
      lineItemId: "line-001",
      reason: "QA simulated online sale",
      requiresWixReconciliation: true,
      nativeCommercialMovement: true,
    },
  );

  assert.equal(result.status, "SUCCESS");
  assert.equal(result.data.applicationConfirmed, true);
  assert.equal(stockRow().stockOnHand, 3);
  assert.equal(stockRow().stockAvailable, 2);
  assert.equal(stockRow().needsWixReconciliation, true);
  assert.equal(stockRow().lastInventoryMovementId, result.data._id);

  assert.equal(movementRows().length, 1);
  const movement = movementRows()[0];
  assert.equal(movement.movementType, "VENTA");
  assert.equal(movement.quantityDelta, -2);
  assert.equal(movement.quantity, 2);
  assert.equal(movement.stockBefore, 5);
  assert.equal(movement.stockAfter, 3);
  assert.equal(movement.orderId, "qa-order-001");
  assert.equal(movement.lineItemId, "line-001");
  assert.equal(movement.stockApplied, false, "append-only ledger row is not rewritten");
  assert.equal(controlRows().some((row) => row.controlType === IC.CONTROL_TYPE.SLOT_LOCK), false);
});

test("QA-INV-FLOW-02 retry of the same movement token is idempotent and does not double-decrement", async () => {
  const payload = {
    traceId: TRACE_ID,
    movementToken: "ORDER-qa-order-002-line-001",
    orderId: "qa-order-002",
    lineItemId: "line-001",
    requiresWixReconciliation: true,
  };

  const first = await recordInventoryMovementSafe(identity(), "VENTA", -2, payload);
  const second = await recordInventoryMovementSafe(identity(), "VENTA", -2, payload);

  assert.equal(first.status, "SUCCESS");
  assert.equal(second.status, "SUCCESS");
  assert.equal(second.idempotent, true);
  assert.equal(second.recovered, true);
  assert.equal(stockRow().stockOnHand, 3);
  assert.equal(stockRow().stockAvailable, 2);
  assert.equal(movementRows().length, 1);
  assert.equal(movementRows()[0].movementToken, payload.movementToken);
});

test("QA-INV-FLOW-03 confirmed refund restock increments stock with a distinct refund token", async () => {
  const sale = await recordInventoryMovementSafe(identity(), "VENTA", -2, {
    traceId: TRACE_ID,
    movementToken: "ORDER-qa-order-003-line-001",
    orderId: "qa-order-003",
    lineItemId: "line-001",
  });
  assert.equal(sale.status, "SUCCESS");

  const refund = await recordInventoryMovementSafe(identity(), "DEVOLUCION", 1, {
    traceId: TRACE_ID,
    movementToken: "REFUND-qa-refund-001-line-001",
    orderId: "qa-order-003",
    refundId: "qa-refund-001",
    lineItemId: "line-001",
    reason: "QA confirmed restock",
  });

  assert.equal(refund.status, "SUCCESS");
  assert.equal(stockRow().stockOnHand, 4);
  assert.equal(stockRow().stockAvailable, 3);
  assert.equal(movementRows().length, 2);
  assert.deepEqual(movementRows().map((row) => row.movementType), ["VENTA", "DEVOLUCION"]);
  assert.equal(movementRows()[1].refundId, "qa-refund-001");
  assert.notEqual(movementRows()[0].movementToken, movementRows()[1].movementToken);
});

test("QA-INV-FLOW-04 insufficient stock fails closed, writes no movement and releases the lock", async () => {
  const result = await recordInventoryMovementSafe(identity(), "VENTA", -6, {
    traceId: TRACE_ID,
    movementToken: "ORDER-qa-order-004-line-001",
    orderId: "qa-order-004",
    lineItemId: "line-001",
  });

  assert.equal(result.status, "ERROR");
  assert.equal(result.error.code, "NEGATIVE_STOCK");
  assert.equal(stockRow().stockOnHand, 5);
  assert.equal(movementRows().length, 0);
  assert.equal(controlRows().some((row) => row.controlType === IC.CONTROL_TYPE.SLOT_LOCK), false);
});

test("QA-INV-FLOW-05 variant mapping mismatch fails before stock or ledger mutation", async () => {
  const result = await recordInventoryMovementSafe(
    identity({ variantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
    "VENTA",
    -1,
    {
      traceId: TRACE_ID,
      movementToken: "ORDER-qa-order-005-line-001",
    },
  );

  assert.equal(result.status, "ERROR");
  assert.equal(result.error.code, "STOCK_KEY_IDENTITY_MISMATCH");
  assert.equal(stockRow().stockOnHand, 5);
  assert.equal(movementRows().length, 0);
  assert.equal(controlRows().length, 0);
});
