import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";

const backendRoot = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, backendRoot), "utf8");
}

test("SDK_CONFIG is the sole source for staff and booking timeout/cache values", async () => {
  const [config, staff, bookingCore, bookingSaga] = await Promise.all([
    source("internalConfig.js"),
    source("staff.js"),
    source("booking/bookingCore.js"),
    source("booking/bookingSaga.js"),
  ]);

  assert.match(config, /API_MS:\s*15000/);
  assert.match(config, /CHECKOUT_MS:\s*20000/);
  assert.match(config, /BOOKING_CREATION_MS:\s*25000/);
  assert.match(config, /STAFF_TTL_MS:\s*300000/);
  assert.match(config, /MAX_ENTRIES:\s*100/);

  assert.match(staff, /SDK_CONFIG\.CACHE\.STAFF_TTL_MS/);
  assert.match(staff, /SDK_CONFIG\.CACHE\.MAX_ENTRIES/);
  assert.match(staff, /SDK_CONFIG\.TIMEOUTS\.API_MS/);
  assert.match(bookingCore, /const checkoutTimeoutMs = SDK_CONFIG\.TIMEOUTS\.CHECKOUT_MS;/);
  assert.match(bookingCore, /const apiTimeoutMs = SDK_CONFIG\.TIMEOUTS\.API_MS;/);
  assert.match(bookingSaga, /const BOOKING_CREATION_TIMEOUT_MS = SDK_CONFIG\.TIMEOUTS\.BOOKING_CREATION_MS;/);
  assert.match(bookingSaga, /const API_TIMEOUT_MS = SDK_CONFIG\.TIMEOUTS\.API_MS;/);

  assert.doesNotMatch(staff, /SDK_CONFIG\?\.CACHE|SDK_CONFIG\?\.TIMEOUTS/);
  assert.doesNotMatch(bookingCore, /Number\(SDK_CONFIG && SDK_CONFIG\.TIMEOUTS/);
  assert.doesNotMatch(bookingSaga, /\) \|\| 25000|\) \|\|\s*15000/);
});
