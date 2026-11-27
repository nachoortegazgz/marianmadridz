import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";

const backendRoot = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, backendRoot), "utf8");
}

test("SDK_CONFIG is the sole source for shared timeouts, cache limits and security TTL", async () => {
  const [config, staff, bookingCore, bookingSaga, audit, eventLog, reservas, citasManager, fiscalAggregator] = await Promise.all([
    source("internalConfig.js"),
    source("staff.js"),
    source("booking/bookingCore.js"),
    source("booking/bookingSaga.js"),
    source("audit.js"),
    source("eventLog.js"),
    source("reservas.web.js"),
    source("citasManager.web.js"),
    source("fiscalAggregator.web.js"),
  ]);

  for (const [pattern, description] of [
    [/API_MS:\\s*15000/, "API timeout"],
    [/CMS_MS:\\s*15000/, "CMS timeout"],
    [/CHECKOUT_MS:\\s*20000/, "checkout timeout"],
    [/BOOKING_CREATION_MS:\\s*25000/, "booking creation timeout"],
    [/WATCHDOG_MS:\\s*15000/, "watchdog timeout"],
    [/WEBHOOK_MS:\\s*30000/, "webhook timeout"],
    [/STAFF_TTL_MS:\\s*300000/, "staff cache TTL"],
    [/STAFF_MAX_ENTRIES:\\s*100/, "staff cache capacity"],
    [/SERVICES_TTL_MS:\\s*120000/, "service cache TTL"],
    [/SERVICES_MAX_ENTRIES:\\s*500/, "service cache capacity"],
    [/SECRET_CACHE_TTL_MS:\\s*300000/, "secret cache TTL"],
    [/FISCAL_DAILY_MAX_PAGES:\\s*50/, "fiscal page limit"],
  ]) assert.match(config, pattern, description);

  assert.match(staff, /SDK_CONFIG\\.CACHE\\.STAFF_TTL_MS/);
  assert.match(staff, /SDK_CONFIG\\.CACHE\\.STAFF_MAX_ENTRIES/);
  assert.match(staff, /SDK_CONFIG\\.TIMEOUTS\\.API_MS/);
  assert.match(bookingCore, /const checkoutTimeoutMs = SDK_CONFIG\\.TIMEOUTS\\.CHECKOUT_MS;/);
  assert.match(bookingCore, /const apiTimeoutMs = SDK_CONFIG\\.TIMEOUTS\\.API_MS;/);
  assert.match(bookingSaga, /const BOOKING_CREATION_TIMEOUT_MS = SDK_CONFIG\\.TIMEOUTS\\.BOOKING_CREATION_MS;/);
  assert.match(bookingSaga, /const API_TIMEOUT_MS = SDK_CONFIG\\.TIMEOUTS\\.API_MS;/);
  assert.match(audit, /const API_TIMEOUT_MS = SDK_CONFIG\\.TIMEOUTS\\.WEBHOOK_MS;/);
  assert.match(eventLog, /const PROYECCION_TIMEOUT_MS = SDK_CONFIG\\.TIMEOUTS\\.API_MS;/);
  assert.match(eventLog, /const FISCAL_SYSTEM_CACHE_TTL_MS = SDK_CONFIG\\.SECURITY\\.SECRET_CACHE_TTL_MS;/);
  assert.match(reservas, /const WATCHDOG_TIMEOUT_MS = SDK_CONFIG\\.TIMEOUTS\\.WATCHDOG_MS;/);
  assert.match(reservas, /const SERVICE_CACHE_TTL_MS = SDK_CONFIG\\.CACHE\\.SERVICES_TTL_MS;/);
  assert.match(reservas, /const CACHE_MAX_SIZE = SDK_CONFIG\\.CACHE\\.SERVICES_MAX_ENTRIES;/);
  assert.match(citasManager, /const API_TIMEOUT_MS = SDK_CONFIG\\.TIMEOUTS\\.API_MS;/);
  assert.match(fiscalAggregator, /const MAX_PAGES = SDK_CONFIG\\.JOBS\\.FISCAL_DAILY_MAX_PAGES;/);
  assert.match(fiscalAggregator, /const CMS_TIMEOUT_MS = SDK_CONFIG\\.TIMEOUTS\\.CMS_MS;/);

  for (const [name, code] of Object.entries({ staff, bookingCore, bookingSaga, audit, eventLog, reservas, citasManager, fiscalAggregator })) {
    assert.doesNotMatch(code, /SDK_CONFIG\\?\\.CACHE|SDK_CONFIG\\?\\.TIMEOUTS|SDK_CONFIG\\?\\.SECURITY|SDK_CONFIG\\?\\.JOBS/,
      name + " must not hide missing shared configuration behind local fallbacks");
  }
});
