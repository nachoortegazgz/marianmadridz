import test from "node:test";
import assert from "node:assert/strict";

import { __test__ as eventLogTest } from "backend/eventLog.js";

test("EVENTLOG-SIGN-01 refund amounts are always negative regardless of input sign", () => {
  assert.equal(eventLogTest.normalizeAccountingAmount({
    movementType: "REEMBOLSO",
    totalAmount: -125.5,
  }), -125.5);
  assert.equal(eventLogTest.normalizeAccountingAmount({
    movementType: "REEMBOLSO",
    totalAmount: 125.5,
  }), -125.5);
  assert.equal(eventLogTest.normalizeAccountingAmount({
    movementType: "DEVOLUCION_SERVICIO",
    accountingAmount: 40,
  }), -40);
  assert.equal(eventLogTest.normalizeAccountingAmount({
    movementType: "VENTA",
    totalAmount: 125.5,
  }), 125.5);
});

test("EVENTLOG-LINK-01 booking references are normalized to a unique array", () => {
  assert.deepEqual(
    eventLogTest.normalizeLinkedBookingIds("booking-a, booking-b,booking-a"),
    ["booking-a", "booking-b"],
  );
  assert.deepEqual(
    eventLogTest.normalizeLinkedBookingIds(["booking-a", "booking-b", "booking-a"]),
    ["booking-a", "booking-b"],
  );
  assert.deepEqual(eventLogTest.normalizeLinkedBookingIds(null), []);
});


test("EVENTLOG-RECT-01 only referenced RECT cancellation records bypass eCommerce refund identity", () => {
  assert.equal(eventLogTest.isCancellationRectification({
    movementType: "REEMBOLSO",
    eventType: "RECTIFICATIVA",
    transactionId: "RECT-BOOKING-123",
    previousInvoiceId: "F2-2026-000123",
  }), true);
  assert.equal(eventLogTest.isCancellationRectification({
    movementType: "REEMBOLSO",
    eventType: "RECTIFICATIVA",
    transactionId: "REFUND-ORDER-1-REFUND-1",
    previousInvoiceId: "F2-2026-000123",
  }), false);
  assert.equal(eventLogTest.isCancellationRectification({
    movementType: "REEMBOLSO",
    eventType: "VENTA",
    transactionId: "RECT-BOOKING-123",
    previousInvoiceId: "F2-2026-000123",
  }), false);
  assert.equal(eventLogTest.isCancellationRectification({
    movementType: "REEMBOLSO",
    eventType: "RECTIFICATIVA",
    transactionId: "RECT-BOOKING-123",
  }), false);
});


test("EVENTLOG-FISCAL-CONFIG-01 missing SIF configuration fails closed", () => {
  assert.throws(
    () => eventLogTest.buildFiscalSystemConfig(null),
    /FISCAL_CONFIG_MISSING/,
  );
  assert.throws(
    () => eventLogTest.buildFiscalSystemConfig({
      _id: "wrong-singleton-id",
      recordType: "CONFIG_SISTEMA",
    }),
    /FISCAL_CONFIG_MISSING/,
  );
  assert.throws(
    () => eventLogTest.buildFiscalSystemConfig({
      _id: "CONFIG_SISTEMA_FISCAL",
      recordType: "CONFIG_SISTEMA",
      taxId: "B12345674",
      legalName: "Titular de prueba",
      verifactuVersion: "1.0",
    }),
    /FISCAL_CONFIG_INCOMPLETE/,
  );
});

test("EVENTLOG-FISCAL-CONFIG-03 rejects a tax id with invalid checksum", () => {
  assert.throws(
    () => eventLogTest.buildFiscalSystemConfig({
      _id: "CONFIG_SISTEMA_FISCAL",
      recordType: "CONFIG_SISTEMA",
      sistemaInformaticoNombre: "SIF de prueba",
      idSistemaInformatico: "PRODUCER-001",
      verifactuVersion: "1.0.0",
      numeroInstalacion: "1",
      tipoUsoPosibleSoloVerifactu: false,
      tipoUsoPosibleMultiOT: true,
      indicadorMultiplesOT: true,
      taxId: "X1234567X",
      legalName: "Titular de prueba",
      fechaInicioVerifactu: "2027-07-01",
    }),
    /FISCAL_CONFIG_INVALID_TAX_ID/
  );
});

test("EVENTLOG-FISCAL-CONFIG-02 only complete explicit SIF configuration is accepted", () => {
  const config = eventLogTest.buildFiscalSystemConfig({
    _id: "CONFIG_SISTEMA_FISCAL",
    recordType: "CONFIG_SISTEMA",
    sistemaInformaticoNombre: "SIF de prueba",
    idSistemaInformatico: "PRODUCER-001",
    verifactuVersion: "1.0.0",
    numeroInstalacion: "1",
    tipoUsoPosibleSoloVerifactu: false,
    tipoUsoPosibleMultiOT: true,
    indicadorMultiplesOT: true,
    taxId: "B12345674",
    legalName: "Titular de prueba",
    fechaInicioVerifactu: "2027-07-01",
  });
  assert.deepEqual(config, {
    sistemaInformaticoNombre: "SIF de prueba",
    idSistemaInformatico: "PRODUCER-001",
    version: "1.0.0",
    numeroInstalacion: "1",
    tipoUsoPosibleSoloVerifactu: "N",
    tipoUsoPosibleMultiOT: "S",
    indicadorMultiplesOT: "S",
    nifProductor: "B12345674",
    nombreRazonProductor: "Titular de prueba",
    fechaInicioVerifactu: "2027-07-01",
  });
  assert.equal(Object.isFrozen(config), true);
});
