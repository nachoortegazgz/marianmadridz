import test from "node:test";
import assert from "node:assert/strict";

import { isExplicitSimulationLedgerRecord } from "../validation.js";

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

test("SIMULATION-05 classifies neutral TPV ledger source as non-fiscal", () => {
  assert.equal(isExplicitSimulationLedgerRecord({
    recordSource: "TPV_LEDGER",
    movementType: "TPV_PAYMENT",
    eventType: "PAYMENT",
    hash: "a".repeat(64),
  }), true);
});
