import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { wixDataMock } from "./loader.mjs";

const { registrarEventoEconomico } = await import("../eventLog.js");

test("fiscal event writer rejects missing transactionId before any ledger access", async () => {
  wixDataMock._reset();

  const result = await registrarEventoEconomico({
    eventType: "VENTA",
    movementType: "VENTA",
  });

  assert.equal(result.status, "ERROR");
  assert.equal(result.error.code, "TRANSACTION_ID_REQUIRED");
  assert.equal((wixDataMock._store.get("MovimientosCaja") || []).length, 0);
  assert.equal((wixDataMock._store.get("MapaStaff") || []).length, 0);
});

test("fiscal event writer rejects missing fiscal amounts and VAT rate before master-data writes", async () => {
  wixDataMock._reset();

  const result = await registrarEventoEconomico({
    eventType: "VENTA",
    movementType: "VENTA",
    paymentMethod: "EFECTIVO",
    channelType: "PRESENCIAL",
    transactionId: "fiscal-numeric-fields-required-001",
  });

  assert.equal(result.status, "ERROR");
  assert.equal(result.error.code, "FISCAL_NUMERIC_FIELD_INVALID");
  assert.equal(result.error.field, "amount");
  assert.equal((wixDataMock._store.get("MovimientosCaja") || []).length, 0);
  assert.equal((wixDataMock._store.get("MapaStaff") || []).length, 0);
});

test("fiscal event writer rejects invalid optional tax rates instead of coercing them", async () => {
  wixDataMock._reset();

  const result = await registrarEventoEconomico({
    eventType: "VENTA",
    movementType: "VENTA",
    paymentMethod: "EFECTIVO",
    channelType: "PRESENCIAL",
    transactionId: "fiscal-invalid-optional-rate-001",
    totalAmount: 10,
    taxBase: 8.26,
    taxAmount: 1.74,
    tipoImpositivo: 0.21,
    surchargeRate: "not-a-rate",
  });

  assert.equal(result.status, "ERROR");
  assert.equal(result.error.code, "FISCAL_NUMERIC_FIELD_INVALID");
  assert.equal(result.error.field, "surchargeRate");
  assert.equal((wixDataMock._store.get("MovimientosCaja") || []).length, 0);
  assert.equal((wixDataMock._store.get("MapaStaff") || []).length, 0);
});

test("fiscal event writer rejects transactionId longer than the canonical limit", async () => {
  wixDataMock._reset();

  const result = await registrarEventoEconomico({
    eventType: "VENTA",
    movementType: "VENTA",
    transactionId: "T".repeat(129),
  });

  assert.equal(result.status, "ERROR");
  assert.equal(result.error.code, "TRANSACTION_ID_INVALID");
  assert.equal((wixDataMock._store.get("MovimientosCaja") || []).length, 0);
});

test("fiscal event writer never creates a sequence-derived transactionId fallback", async () => {
  const source = await readFile(new URL("../eventLog.js", import.meta.url), "utf8");

  assert.ok(source.includes('const transactionId = _safeTrim(input?.transactionId);'));
  assert.ok(source.includes('code: "TRANSACTION_ID_REQUIRED"'));
  assert.ok(source.includes('.eq("transactionId", transactionId)'));
  assert.ok(source.includes("transactionId,"));
  assert.ok(!source.includes('TX_${seq.sequenceNumber}'));
  assert.ok(!source.includes('traceId when none exists'));
});
