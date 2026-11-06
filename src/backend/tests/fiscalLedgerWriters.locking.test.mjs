import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const backend = resolve(here, "..");

async function source(name) {
  return readFile(resolve(backend, name), "utf8");
}

test("FISCAL-CHAIN-01 eventLog acquires the shared lock before reading hash head and sequence", async () => {
  const code = await source("eventLog.js");
  const acquire = code.indexOf("acquireFiscalLedgerLock(traceId)");
  const readHead = code.indexOf("const previous = await _getLastCashEvent()");
  const nextSequence = code.indexOf("const seq = await _getNextSequenceInternal(traceId)");
  const insert = code.indexOf("cabecera = await dalInsert(MOVIMIENTOS_CAJA_COL, doc)");
  const assertLock = code.indexOf("await assertFiscalLedgerLock(ledgerLock)");

  assert.ok(acquire >= 0);
  assert.ok(readHead > acquire);
  assert.ok(nextSequence > acquire);
  assert.ok(assertLock > nextSequence);
  assert.ok(insert > assertLock);
  assert.match(code, /finally\s*\{[\s\S]*releaseFiscalLedgerLock\(ledgerLock\)/);
});

test("FISCAL-CHAIN-02 manual cash writer shares the same lock and checks ownership before append", async () => {
  const code = await source("cajas.web.js");
  const acquire = code.indexOf("acquireFiscalLedgerLock(traceId)");
  const nextSequence = code.indexOf("const seq = await _getNextSequence(traceId)");
  const insert = code.indexOf("saved = await dalInsert(MOVIMIENTOS_CAJA_COL, movement)");
  const assertLock = code.indexOf("await assertFiscalLedgerLock(ledgerLock)");

  assert.ok(acquire >= 0);
  assert.ok(nextSequence > acquire);
  assert.ok(assertLock > nextSequence);
  assert.ok(insert > assertLock);
  assert.match(code, /finally\s*\{[\s\S]*releaseFiscalLedgerLock\(ledgerLock\)/);
});
