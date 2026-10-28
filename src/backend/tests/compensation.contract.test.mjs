import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const readBackend = (name) => readFileSync(path.join(here, "..", name), "utf8");

test("COMPENSATION-01 RESYNC_CAJA_BALANCE is explicitly fail-closed", () => {
  const crons = readBackend("crons.js");
  const caja = readBackend("cajas.web.js");

  assert.match(caja, /kind:\s*"RESYNC_CAJA_BALANCE"/,
    "CajaActual recovery producer must be visible to the contract test");
  assert.match(crons, /kind === "RESYNC_CAJA_BALANCE"/,
    "central compensation processor must explicitly handle the emitted kind");
  assert.match(crons, /manualReconciliationRequired:\s*true/,
    "unsafe balance projection recovery must route to manual reconciliation");
  assert.match(crons, /status = "MANUAL_RECONCILIATION_REQUIRED"/,
    "manual reconciliation must be persisted as a non-retryable state");
  assert.match(crons, /status:\s*"MANUAL_RECONCILIATION_REQUIRED"/,
    "top-level status must match payload status for queue filtering");
});

test("COMPENSATION-02 manual reconciliation is not reported as executed", () => {
  const crons = readBackend("crons.js");
  const start = crons.indexOf("if (outcome?.manualReconciliationRequired === true)");
  const end = crons.indexOf("payload.status = COMPENSATION_STATUS.EXECUTED", start);

  assert.notEqual(start, -1, "manual route must exist");
  assert.notEqual(end, -1, "normal success route must exist");
  assert.ok(start < end, "manual route must branch before the EXECUTED transition");
  assert.match(crons.slice(start, end), /result\.manualRequired\+\+/,
    "manual cases must be counted separately from successful compensation");
});
