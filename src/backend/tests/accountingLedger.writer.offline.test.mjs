import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { wixDataMock } from "./loader.mjs";
import * as IC from "backend/internalConfig.js";
import { appendAccountingEntry } from "backend/accountingLedger.js";

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
    expect(replay.status).toBe("SUCCESS");
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
