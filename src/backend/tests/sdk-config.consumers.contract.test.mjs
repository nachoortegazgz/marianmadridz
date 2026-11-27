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

  for (const value of [
    "API_MS: 15000",
    "CMS_MS: 15000",
    "CHECKOUT_MS: 20000",
    "BOOKING_CREATION_MS: 25000",
    "WATCHDOG_MS: 15000",
    "WEBHOOK_MS: 30000",
    "STAFF_TTL_MS: 300000",
    "STAFF_MAX_ENTRIES: 100",
    "SERVICES_TTL_MS: 120000",
    "SERVICES_MAX_ENTRIES: 500",
    "DAYS_CACHE_VERSION: \"v1\"",
    "SECRET_CACHE_TTL_MS: 300000",
    "FISCAL_DAILY_MAX_PAGES: 50",
  ]) assert.ok(config.includes(value), "missing canonical setting: " + value);

  const contracts = [
    [staff, "const CACHE_TTL_MS = SDK_CONFIG.CACHE.STAFF_TTL_MS;"],
    [staff, "const CACHE_MAX_ENTRIES = SDK_CONFIG.CACHE.STAFF_MAX_ENTRIES;"],
    [staff, "const API_TIMEOUT_MS = SDK_CONFIG.TIMEOUTS.API_MS;"],
    [bookingCore, "const checkoutTimeoutMs = SDK_CONFIG.TIMEOUTS.CHECKOUT_MS;"],
    [bookingCore, "const apiTimeoutMs = SDK_CONFIG.TIMEOUTS.API_MS;"],
    [bookingSaga, "const BOOKING_CREATION_TIMEOUT_MS = SDK_CONFIG.TIMEOUTS.BOOKING_CREATION_MS;"],
    [bookingSaga, "const API_TIMEOUT_MS = SDK_CONFIG.TIMEOUTS.API_MS;"],
    [audit, "const API_TIMEOUT_MS = SDK_CONFIG.TIMEOUTS.WEBHOOK_MS;"],
    [eventLog, "const PROYECCION_TIMEOUT_MS = SDK_CONFIG.TIMEOUTS.API_MS;"],
    [eventLog, "const FISCAL_SYSTEM_CACHE_TTL_MS = SDK_CONFIG.SECURITY.SECRET_CACHE_TTL_MS;"],
    [reservas, "const WATCHDOG_TIMEOUT_MS = SDK_CONFIG.TIMEOUTS.WATCHDOG_MS;"],
    [reservas, "const SERVICE_CACHE_TTL_MS = SDK_CONFIG.CACHE.SERVICES_TTL_MS;"],
    [reservas, "const CACHE_MAX_SIZE = SDK_CONFIG.CACHE.SERVICES_MAX_ENTRIES;"],
    [citasManager, "const API_TIMEOUT_MS = SDK_CONFIG.TIMEOUTS.API_MS;"],
    [fiscalAggregator, "const MAX_PAGES = SDK_CONFIG.JOBS.FISCAL_DAILY_MAX_PAGES;"],
    [fiscalAggregator, "const CMS_TIMEOUT_MS = SDK_CONFIG.TIMEOUTS.CMS_MS;"],
  ];
  for (const [code, contract] of contracts) {
    assert.ok(code.includes(contract), "missing consumer contract: " + contract);
  }

  for (const [name, code] of Object.entries({ staff, bookingCore, bookingSaga, audit, eventLog, reservas, citasManager, fiscalAggregator })) {
    for (const obsolete of ["SDK_CONFIG?.CACHE", "SDK_CONFIG?.TIMEOUTS", "SDK_CONFIG?.SECURITY", "SDK_CONFIG?.JOBS"]) {
      assert.ok(!code.includes(obsolete), name + " retains fallback access " + obsolete);
    }
  }
});
