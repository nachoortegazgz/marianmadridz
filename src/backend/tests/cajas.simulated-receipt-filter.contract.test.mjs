import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../cajas.web.js", import.meta.url), "utf8");
const start = source.indexOf("export const getMovimientoByBooking =");
const end = source.indexOf("\n);", start);
const handler = start >= 0 && end > start ? source.slice(start, end) : "";

test("CASH-RECEIPT-01 simulated movements cannot be returned as fiscal receipts", () => {
  assert.ok(handler.length > 0, "receipt handler must remain present");
  assert.match(handler, /items\s*=\s*items\.filter\(\(movement\)\s*=>\s*!isExplicitSimulationLedgerRecord\(movement\)\)/);
});

test("CASH-HEAD-02 cash and fiscal heads ignore explicit simulated movements", () => {
  const eventLog = readFileSync(new URL("../eventLog.js", import.meta.url), "utf8");
  const lastCashEventStart = eventLog.indexOf("async function _getLastCashEvent");
  const lastCashEvent = eventLog.slice(lastCashEventStart, eventLog.indexOf("\n}", lastCashEventStart));
  const lastMovementStart = source.indexOf("async function _getLastMovement");
  const lastMovement = source.slice(lastMovementStart, source.indexOf("\n}", lastMovementStart));
  assert.match(lastCashEvent, /!isExplicitSimulationLedgerRecord/);
  assert.match(lastMovement, /!isExplicitSimulationLedgerRecord/);
});
