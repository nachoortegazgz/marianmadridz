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

test("EVENTS-VELO-02 keeps Bookings V2 Velo event handler exports", () => {
  assert.match(source, /export async function wixBookingsV2_onBookingConfirmed/);
  assert.match(source, /export async function wixBookingsV2_onBookingRescheduled/);
  assert.match(source, /export async function wixBookingsV2_onBookingCanceled/);
});
