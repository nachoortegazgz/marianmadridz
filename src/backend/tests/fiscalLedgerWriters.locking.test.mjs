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
  const nextSequence = code.indexOf("const seq = await allocateFiscalSequence(ledgerLock, previous)");
  const insert = code.indexOf("cabecera = await dalInsert(MOVIMIENTOS_CAJA_COL, doc)");
  const assertLock = code.indexOf("await assertFiscalLedgerLock(ledgerLock)");

  assert.ok(acquire >= 0);
  assert.ok(readHead > acquire);
  const headReaderStart = code.indexOf("async function _getLastCashEvent()");
  const strongHeadRead = code.indexOf('.find({ consistencyMode: "strong" })', headReaderStart);
  assert.ok(strongHeadRead > headReaderStart);
  assert.ok(nextSequence > acquire);
  assert.ok(assertLock > nextSequence);
  assert.ok(insert > assertLock);
  assert.match(code, /finally\s*\{[\s\S]*releaseFiscalLedgerLock\(ledgerLock\)/);
});

test("FISCAL-CHAIN-02 manual cash writer shares the same lock and checks ownership before append", async () => {
  const code = await source("cajas.web.js");
  const acquire = code.indexOf("acquireFiscalLedgerLock(traceId)");
  const lastMovement = code.indexOf("const lastMovement = await _getLastMovement()", acquire);
  const nextSequence = code.indexOf("const seq = await allocateFiscalSequence(ledgerLock, lastMovement)", acquire);
  const insert = code.indexOf("saved = await dalInsert(MOVIMIENTOS_CAJA_COL, movement)");
  const assertLock = code.indexOf("await assertFiscalLedgerLock(ledgerLock)");

  assert.ok(acquire >= 0);
  assert.ok(lastMovement > acquire);
  assert.ok(nextSequence > lastMovement);
  assert.ok(assertLock > nextSequence);
  assert.ok(insert > assertLock);
  assert.match(code, /finally\s*\{[\s\S]*releaseFiscalLedgerLock\(ledgerLock\)/);
});

test("FISCAL-CHAIN-03 Z closing shares the global lock and verifies ownership before append", async () => {
  const code = await source("cajas.web.js");
  const start = code.indexOf("async function _registerZClosing");
  const acquire = code.indexOf("acquireFiscalLedgerLock(traceId)", start);
  const movements = code.indexOf("let allMovements = []", start);
  const insert = code.indexOf("saved = await dalInsert(HISTORICO_CIERRES_Z_COL, zRecord)", start);
  const assertBeforeInsert = code.lastIndexOf("await assertFiscalLedgerLock(ledgerLock)", insert);

  assert.ok(start >= 0);
  assert.ok(acquire > start);
  assert.ok(movements > acquire);
  assert.ok(assertBeforeInsert > acquire && assertBeforeInsert < insert);
  assert.match(code.slice(start), /finally\s*\{[\s\S]*releaseFiscalLedgerLock\(ledgerLock\)/);
});

test("FISCAL-CHAIN-04 manual writer revalidates closed period after acquiring the lock", async () => {
  const code = await source("cajas.web.js");
  const start = code.indexOf("export const registerManualTransaction");
  const acquire = code.indexOf("acquireFiscalLedgerLock(traceId)", start);
  const recheck = code.indexOf("_assertPeriodNotClosed(operationDate, traceId)", acquire);
  const lastMovement = code.indexOf("const lastMovement = await _getLastMovement()", acquire);
  const nextSequence = code.indexOf("const seq = await allocateFiscalSequence(ledgerLock, lastMovement)", acquire);

  assert.ok(acquire > start);
  assert.ok(recheck > acquire);
  assert.ok(nextSequence > recheck);
});

test("FISCAL-CHAIN-05 Z closing starts daily hash verification from the global predecessor", async () => {
  const code = await source("cajas.web.js");
  const start = code.indexOf("async function _registerZClosing");
  const predecessor = code.indexOf('.lt("sequenceNumber", firstSequence)', start);
  const expectedHash = code.indexOf("let expectedPreviousHash = previousMovement?.hash || GENESIS_HASH", start);

  assert.ok(predecessor > start);
  assert.ok(expectedHash > predecessor);
});

test("FISCAL-CHAIN-06 hash audit paginates and cannot report success when pages remain", async () => {
  const code = await source("cajas.web.js");
  const start = code.indexOf("export async function verifyFiscalHashChainIntegrity");
  const pagination = code.indexOf("movements = await movements.next()", start);
  const partial = code.indexOf('"PARTIAL"', pagination);

  assert.ok(pagination > start);
  assert.ok(partial > pagination);
});

test("FISCAL-CHAIN-07 Z closing never exposes raw internal exception messages", async () => {
  const code = await source("cajas.web.js");
  const start = code.indexOf("async function _registerZClosing");
  const finallyIndex = code.indexOf("    } finally {", start);
  const catchIndex = code.lastIndexOf("    } catch (err) {", finallyIndex);
  const catchBlock = code.slice(catchIndex, finallyIndex);

  assert.ok(catchIndex > start);
  assert.doesNotMatch(catchBlock, /_toPublicError\(err/);
  assert.match(catchBlock, /publicMessages\[publicCode\]\s*\|\|\s*"No se pudo completar el cierre Z\."/);
  assert.match(catchBlock, /normalized\.message/);
});

test("FISCAL-CHAIN-08 no active backend path creates the obsolete CAJA_SEQ singleton", async () => {
  const [cajas, eventLog, config, data, lock] = await Promise.all([
    source("cajas.web.js"),
    source("eventLog.js"),
    source("internalConfig.js"),
    source("data.js"),
    source("fiscalLedgerLock.js"),
  ]);
  for (const code of [cajas, eventLog, config, data, lock]) {
    assert.doesNotMatch(code, /CAJA_SEQ/);
  }
  assert.match(lock, /allocateFiscalSequence/);
  assert.match(lock, /getCashRegisterSingleton/);
});
