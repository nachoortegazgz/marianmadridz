import test from "node:test";
import assert from "node:assert/strict";

import { __test__ as eventLogTest } from "backend/eventLog.js";

test("EVENTLOG-SIGN-01 refund amounts are always negative regardless of input sign", () => {
  assert.equal(eventLogTest.normalizeAccountingAmount({
    movementType: "REEMBOLSO",
    totalAmount: -125.5,
  }), -125.5);
  assert.equal(eventLogTest.normalizeAccountingAmount({
    movementType: "REEMBOLSO",
    totalAmount: 125.5,
  }), -125.5);
  assert.equal(eventLogTest.normalizeAccountingAmount({
    movementType: "DEVOLUCION_SERVICIO",
    accountingAmount: 40,
  }), -40);
  assert.equal(eventLogTest.normalizeAccountingAmount({
    movementType: "VENTA",
    totalAmount: 125.5,
  }), 125.5);
});

test("EVENTLOG-LINK-01 booking references are normalized to a unique array", () => {
  assert.deepEqual(
    eventLogTest.normalizeLinkedBookingIds("booking-a, booking-b,booking-a"),
    ["booking-a", "booking-b"],
  );
  assert.deepEqual(
    eventLogTest.normalizeLinkedBookingIds(["booking-a", "booking-b", "booking-a"]),
    ["booking-a", "booking-b"],
  );
  assert.deepEqual(eventLogTest.normalizeLinkedBookingIds(null), []);
});


test("EVENTLOG-RECT-01 only referenced RECT cancellation records bypass eCommerce refund identity", () => {
  assert.equal(eventLogTest.isCancellationRectification({
    movementType: "REEMBOLSO",
    eventType: "RECTIFICATIVA",
    transactionId: "RECT-BOOKING-123",
    previousInvoiceId: "F2-2026-000123",
  }), true);
  assert.equal(eventLogTest.isCancellationRectification({
    movementType: "REEMBOLSO",
    eventType: "RECTIFICATIVA",
    transactionId: "REFUND-ORDER-1-REFUND-1",
    previousInvoiceId: "F2-2026-000123",
  }), false);
  assert.equal(eventLogTest.isCancellationRectification({
    movementType: "REEMBOLSO",
    eventType: "VENTA",
    transactionId: "RECT-BOOKING-123",
    previousInvoiceId: "F2-2026-000123",
  }), false);
  assert.equal(eventLogTest.isCancellationRectification({
    movementType: "REEMBOLSO",
    eventType: "RECTIFICATIVA",
    transactionId: "RECT-BOOKING-123",
  }), false);
});
