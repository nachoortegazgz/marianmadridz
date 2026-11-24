import test from "node:test";
import assert from "node:assert/strict";

import { isExplicitSimulationLedgerRecord } from "../validation.js";
import { TPV_HISTORICAL_POLICY } from "../internalConfig.js";

test("SIMULATION-01 recognizes movementType simulation markers without recordSource", () => {
  for (const movementType of [
    "SIMULATED_PAYMENT",
    "VENTA_POS_SIMULADA",
    "REEMBOLSO_POS_SIMULADO",
    "INTENTO_PAGO_POS_SIMULADO",
  ]) {
    assert.equal(
      isExplicitSimulationLedgerRecord({
        movementType,
        eventType: "RESERVA_CONFIRMADA",
        sequenceNumber: 1,
      }),
      true,
      movementType
    );
  }
});

test("SIMULATION-02 keeps genuine movement types outside simulation classification", () => {
  for (const movementType of ["VENTA_ONLINE", "VENTA_LINEA", "REEMBOLSO"]) {
    assert.equal(
      isExplicitSimulationLedgerRecord({
        movementType,
        eventType: "VENTA_CONFIRMADA",
        recordSource: "INTERNAL",
        hash: "a".repeat(64),
      }),
      false,
      movementType
    );
  }
});


test("SIMULATION-03 recognizes the explicit legacy TPV-QA markers observed in CMS", () => {
  assert.equal(isExplicitSimulationLedgerRecord({
    synthetic: true,
    recordSource: "TPV_QA_DEVELOPMENT",
    source: "TPV_FUNCTIONAL_TEST",
    movementType: "SALE",
    traceId: "TPV-QA-1795437582366-CASH",
  }), true);

  assert.equal(isExplicitSimulationLedgerRecord({
    projectionStatus: "SIMULATED_ONLY",
    eventType: "TPV_SALE_SIMULATED",
    movementType: "SALE",
  }), true);

  assert.equal(isExplicitSimulationLedgerRecord({
    projectionStatus: "SIMULATED_ONLY",
    eventType: "TPV_REFUND_SIMULATED",
    movementType: "REFUND",
  }), true);
});

test("SIMULATION-04 does not classify a bare synthetic flag or QA source alone", () => {
  assert.equal(isExplicitSimulationLedgerRecord({ synthetic: true, movementType: "SALE" }), false);
  assert.equal(isExplicitSimulationLedgerRecord({
    recordSource: "TPV_QA_DEVELOPMENT",
    source: "TPV_FUNCTIONAL_TEST",
    movementType: "SALE",
  }), false);
});

test("SIMULATION-05 does not classify canonical TPV ledger rows as historical", () => {
  assert.equal(isExplicitSimulationLedgerRecord({
    recordSource: "TPV_LEDGER",
    movementType: "TPV_PAYMENT",
    eventType: "PAYMENT",
    sequenceNumber: 1,
    hash: "a".repeat(64),
    payloadFiscal: {
      sourceType: "TPV",
      ledgerVersion: "TPV_LEDGER_V3",
      schemaVersion: 3,
    },
  }), false);
});

test("SIMULATION-06 classifies only the explicit historical TPV ledger envelope", () => {
  assert.equal(isExplicitSimulationLedgerRecord({
    recordSource: "TPV_LEDGER",
    movementType: "TPV_PAYMENT",
    eventType: "PAYMENT",
    sequenceNumber: 0,
    hash: "a".repeat(64),
    payloadFiscal: {
      sourceType: TPV_HISTORICAL_POLICY.SOURCE_TYPE,
      ledgerVersion: TPV_HISTORICAL_POLICY.LEDGER_VERSION,
      schemaVersion: TPV_HISTORICAL_POLICY.SCHEMA_VERSION,
      isSynthetic: true,
      realPayment: false,
      externalSideEffects: false,
    },
  }), true);
});
