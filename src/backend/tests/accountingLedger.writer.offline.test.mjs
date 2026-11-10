import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { wixDataMock } from "./loader.mjs";
import * as IC from "backend/internalConfig.js";
import { appendAccountingEntry } from "backend/accountingLedger.js";
import { hashChain } from "backend/securityEngine.js";

const ACCOUNTING_COL = IC.BUSINESS_COLLECTIONS.LIBRO_ASIENTOS_CONTABLES_DETALLE;
const CONTROL_COL = IC.BUSINESS_COLLECTIONS.CONTROL_OPERATIVO;
const SOURCE_MOVEMENT_ID = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";

function entry(entryId, debit = 121, credit = 121) {
  return {
    entryId,
    sourceMovementId: SOURCE_MOVEMENT_ID,
    concept: "Asiento QA sintético",
    origenTipo: "MOVIMIENTO_CAJA",
    origenRegistro: "MovimientosCaja",
    entryDate: "2026-11-06",
    fiscalPeriod: "2026-11",
    traceId: `trace-${entryId}`,
    lines: [
      { lineNumber: 1, accountCode: "000001", debitAmount: debit, creditAmount: 0 },
      { lineNumber: 2, accountCode: "000002", debitAmount: 0, creditAmount: credit },
    ],
  };
}

function hashPayloadFromRow(row) {
  return {
    entryId: row.entryId,
    recordTimestamp: new Date(row.recordTimestamp).toISOString(),
    concept: row.concept,
    lineNumber: Number(row.lineNumber),
    origenTipo: row.origenTipo,
    origenRegistro: row.origenRegistro,
    sourceMovementId: row.sourceMovementId,
    cashMovementId: row.cashMovementId || null,
    entryDate: new Date(row.entryDate).toISOString(),
    fiscalPeriod: row.fiscalPeriod,
    accountCode: row.accountCode,
    debitAmount: Number(row.debitAmount),
    creditAmount: Number(row.creditAmount),
    traceId: row.traceId,
  };
}

beforeEach(() => {
  wixDataMock._reset();
  wixDataMock._seed(ACCOUNTING_COL, []);
  wixDataMock._seed(CONTROL_COL, []);
});

describe("accounting ledger writer", () => {
  it("ACC-LEDGER-01 appends a balanced double-entry with a continuous hash chain", async () => {
    const result = await appendAccountingEntry(entry("ACC-QA-ENTRY-001"), "trace-acc-001");

    assert.equal(result.status, "SUCCESS");
    const rows = wixDataMock._store.get(ACCOUNTING_COL);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].debitAmount + rows[0].creditAmount, 121);
    assert.equal(rows[1].debitAmount + rows[1].creditAmount, 121);
    assert.equal(rows[0].previousRecordHash, "0".repeat(64));
    assert.equal(rows[1].previousRecordHash, rows[0].recordHash);
    assert.equal(rows.every((row) => /^[a-f0-9]{64}$/i.test(row.recordHash)), true);
  });

  it("ACC-LEDGER-02 replays the same entry idempotently without duplicate lines", async () => {
    const payload = entry("ACC-QA-ENTRY-002");
    const first = await appendAccountingEntry(payload, "trace-acc-002");
    const replay = await appendAccountingEntry(payload, "trace-acc-002-replay");

    assert.equal(first.status, "SUCCESS");
    assert.equal(replay.status, "SUCCESS");
    assert.equal(replay.data.idempotent, true);
    assert.equal(wixDataMock._store.get(ACCOUNTING_COL).length, 2);
  });

  it("ACC-LEDGER-03 rejects unbalanced entries before any append", async () => {
    const result = await appendAccountingEntry(entry("ACC-QA-ENTRY-003", 121, 120), "trace-acc-003");

    assert.equal(result.status, "ERROR");
    assert.equal(result.error.code, "ACCOUNTING_ENTRY_UNBALANCED");
    assert.equal(wixDataMock._store.get(ACCOUNTING_COL).length, 0);
  });

  it("ACC-LEDGER-04 rejects reuse of entryId with a different payload", async () => {
    const first = await appendAccountingEntry(entry("ACC-QA-ENTRY-004"), "trace-acc-004");
    const conflicting = await appendAccountingEntry(entry("ACC-QA-ENTRY-004", 99, 99), "trace-acc-004-conflict");

    assert.equal(first.status, "SUCCESS");
    assert.equal(conflicting.status, "ERROR");
    assert.equal(conflicting.error.code, "ACCOUNTING_ENTRY_PAYLOAD_MISMATCH");
    assert.equal(wixDataMock._store.get(ACCOUNTING_COL).length, 2);
  });

  it("ACC-LEDGER-06 non-cash entries do not fabricate a cashMovementId", async () => {
    const payload = {
      ...entry("ACC-QA-ENTRY-006"),
      sourceMovementId: "supplier-invoice-source-006",
      origenTipo: "FACTURA_RECIBIDA",
      origenRegistro: "DOCUMENTO_PROVEEDOR",
    };
    const result = await appendAccountingEntry(payload, "trace-acc-006");

    assert.equal(result.status, "SUCCESS");
    const rows = wixDataMock._store.get(ACCOUNTING_COL);
    assert.equal(rows.length, 2);
    assert.equal(rows.every((row) => row.cashMovementId == null), true);
  });

  it("ACC-LEDGER-07 cashMovementId is stored only when explicitly supplied", async () => {
    const payload = {
      ...entry("ACC-QA-ENTRY-007"),
      cashMovementId: "physical-cash-movement-007",
    };
    const result = await appendAccountingEntry(payload, "trace-acc-007");

    assert.equal(result.status, "SUCCESS");
    const rows = wixDataMock._store.get(ACCOUNTING_COL);
    assert.equal(rows.length, 2);
    assert.equal(rows.every((row) => row.cashMovementId === "physical-cash-movement-007"), true);
  });

  it("ACC-LEDGER-05 serializes concurrent entries into one unbroken global hash chain", async () => {
    const [first, second] = await Promise.all([
      appendAccountingEntry(entry("ACC-QA-ENTRY-005-A"), "trace-acc-005-a"),
      appendAccountingEntry(entry("ACC-QA-ENTRY-005-B"), "trace-acc-005-b"),
    ]);

    assert.equal(first.status, "SUCCESS");
    assert.equal(second.status, "SUCCESS");
    const rows = [...wixDataMock._store.get(ACCOUNTING_COL)]
      .sort((a, b) => new Date(a.recordTimestamp).getTime() - new Date(b.recordTimestamp).getTime());
    assert.equal(rows.length, 4);
    for (let index = 1; index < rows.length; index += 1) {
      assert.equal(rows[index].previousRecordHash, rows[index - 1].recordHash);
    }
  });
});


  it("ACC-LEDGER-08 does not chain a new accounting entry from an explicitly marked smoke-test row", async () => {
    wixDataMock._seed(ACCOUNTING_COL, [{
      _id: "simulated-accounting-row",
      entryId: "SIM-ACCOUNTING-001",
      recordTimestamp: new Date(Date.now() + 60000),
      lineNumber: 1,
      accountCode: "SIMULATED",
      debitAmount: 25,
      creditAmount: 0,
      sourceMovementId: "smoke-source-001",
      origenTipo: "SMOKE_TEST",
      origenRegistro: "SMOKE_TEST",
      recordHash: "SIMULATED_DETAIL_HASH",
      previousRecordHash: "SIMULATED_PREVIOUS_DETAIL_HASH",
      traceId: "SMOKE_TEST",
    }]);

    const result = await appendAccountingEntry(entry("ACC-QA-ENTRY-AFTER-SMOKE"), "trace-acc-after-smoke");

    assert.equal(result.status, "SUCCESS", JSON.stringify(result.error));
    const rows = wixDataMock._store.get(ACCOUNTING_COL)
      .filter((row) => row.entryId === "ACC-QA-ENTRY-AFTER-SMOKE")
      .sort((a, b) => Number(a.lineNumber) - Number(b.lineNumber));
    assert.equal(rows.length, 2);
    assert.equal(rows[0].previousRecordHash, "0".repeat(64));
    assert.notEqual(rows[0].previousRecordHash, "SIMULATED_PREVIOUS_DETAIL_HASH");
  });

it("ACC-LEDGER-09 rejects replay when a persisted record hash does not match its immutable payload", async () => {
  const payload = entry("ACC-QA-ENTRY-009");
  const first = await appendAccountingEntry(payload, "trace-acc-009");
  assert.equal(first.status, "SUCCESS");
  const rows = wixDataMock._store.get(ACCOUNTING_COL);
  rows[0].recordHash = "f".repeat(64);

  const replay = await appendAccountingEntry(payload, "trace-acc-009-replay");
  assert.equal(replay.status, "ERROR");
  assert.equal(replay.error.code, "ACCOUNTING_ENTRY_REPAIR_REQUIRED");
});

it("ACC-LEDGER-10 rejects a locally valid replay chain whose first hash is not anchored to the prior ledger head", async () => {
  const prior = await appendAccountingEntry(entry("ACC-QA-ENTRY-010-PRIOR"), "trace-acc-010-prior");
  assert.equal(prior.status, "SUCCESS");
  const payload = entry("ACC-QA-ENTRY-010");
  const first = await appendAccountingEntry(payload, "trace-acc-010");
  assert.equal(first.status, "SUCCESS");

  const allRows = wixDataMock._store.get(ACCOUNTING_COL);
  const rows = allRows.filter(row => row.entryId === payload.entryId)
    .sort((a, b) => Number(a.lineNumber) - Number(b.lineNumber));
  rows[0].previousRecordHash = "1".repeat(64);
  rows[0].recordHash = await hashChain(rows[0].previousRecordHash, hashPayloadFromRow(rows[0]));
  rows[1].previousRecordHash = rows[0].recordHash;
  rows[1].recordHash = await hashChain(rows[1].previousRecordHash, hashPayloadFromRow(rows[1]));

  const replay = await appendAccountingEntry(payload, "trace-acc-010-replay");
  assert.equal(replay.status, "ERROR");
  assert.equal(replay.error.code, "ACCOUNTING_ENTRY_REPAIR_REQUIRED");
});

it("ACC-LEDGER-11 rejects replay when signed metadata is altered even if line amounts remain balanced", async () => {
  const payload = entry("ACC-QA-ENTRY-011");
  const first = await appendAccountingEntry(payload, "trace-acc-011");
  assert.equal(first.status, "SUCCESS");
  const rows = wixDataMock._store.get(ACCOUNTING_COL);
  rows[0].concept = "Concepto alterado";

  const replay = await appendAccountingEntry(payload, "trace-acc-011-replay");
  assert.equal(replay.status, "ERROR");
  assert.equal(replay.error.code, "ACCOUNTING_ENTRY_REPAIR_REQUIRED");
});


it("ACC-LEDGER-12 marks a completed claim for repair when its ledger rows are missing", async () => {
  const payload = entry("ACC-QA-ENTRY-012");
  const first = await appendAccountingEntry(payload, "trace-acc-012");
  assert.equal(first.status, "SUCCESS");
  wixDataMock._store.get(ACCOUNTING_COL).splice(0);

  const replay = await appendAccountingEntry(payload, "trace-acc-012-replay");
  assert.equal(replay.status, "ERROR");
  assert.equal(replay.error.code, "ACCOUNTING_ENTRY_REPAIR_REQUIRED");
  const claim = [...wixDataMock._store.get(CONTROL_COL)]
    .find(item => item.controlType === "DEDUPE_KEY");
  assert.equal(claim.status, "REPAIR_REQUIRED");
});
