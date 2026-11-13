import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const source = await readFile(
  fileURLToPath(new URL("../events.js", import.meta.url)),
  "utf8"
);

test("EVENTS-VELO-01 consumes Wix-managed event objects without raw webhook verification", () => {
  assert.match(source, /function _readWixBackendEvent\(event, expectedEventType\)/);
  assert.match(source, /WIX_EVENT_OBJECT_REQUIRED/);
  assert.doesNotMatch(source, /webhooks\.process/);
  assert.doesNotMatch(source, /createClient/);
  assert.doesNotMatch(source, /_verifyAndDecodeWebhook/);
  assert.doesNotMatch(source, /rawBody/);
});

test("EVENTS-VELO-02 uses the exact Velo Bookings V2 event handler names", () => {
  assert.match(source, /export async function wixBookings_onBookingCreated/);
  assert.match(source, /export async function wixBookingsV2_onBookingConfirmed/);
  assert.match(source, /export async function wixBookings_onBookingRescheduled/);
  assert.match(source, /export async function wixBookingsV2_onBookingCanceled/);
  assert.doesNotMatch(source, /export async function wixBookingsV2_onBookingCreated/);
  assert.doesNotMatch(source, /export async function wixBookingsV2_onBookingRescheduled/);
});

test("EVENTS-VELO-03 refunds use stable order payment-status and order-updated events", () => {
  assert.match(source, /export async function wixEcom_onOrderPaymentStatusUpdated/);
  assert.match(source, /export async function wixEcom_onOrderUpdated/);
  assert.match(source, /PARTIALLY_REFUNDED/);
  assert.match(source, /FULLY_REFUNDED/);
  assert.match(source, /listTransactionsForSingleOrderElevated/);
  assert.match(source, /resolveCompletedRefunds\(orderTransactionsRecord\)/);
  assert.match(source, /REFUND_TRANSACTIONS_PENDING/);
  assert.doesNotMatch(source, /export async function wixEcom_onOrderRefunded/);
  assert.doesNotMatch(source, /export async function wixEcom_onOrderTransactionsUpdated/);
});
