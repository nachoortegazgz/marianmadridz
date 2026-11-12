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
