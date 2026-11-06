import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createFiscalFacsimile,
  verifyFiscalFacsimile,
} from "backend/fiscalFacsimile.js";

test("FACSIMIL series, chained hashes and non-X509 signature are reproducible", async () => {
  const first = await createFiscalFacsimile({
    sequenceNumber: 1,
    yearSequence: 1,
    year: 2026,
    payload: {
      totalAmount: 50,
      paymentMethod: "EFECTIVO",
      operationDescription: "Venta de prueba (SIMULACION PREVIA A DESPLIEGUE REAL)",
    },
    generatedAt: new Date("2026-11-06T10:00:00.000Z"),
  });

  assert.equal(first.numSerieFactura, "FACSIMIL-FAC-2026-00001");
  assert.match(first.hash, /^FACSIMIL-[0-9a-f]{64}$/);
  assert.match(first.previousRecordHash, /^FACSIMIL-[0-9a-f]{64}$/);
  assert.match(first.digitalSignature, /^FACSIMIL-SIGNATURE-NOT-X509-[0-9a-f]{64}$/);
  assert.equal(first.signatureAlgorithm, "FACSIMIL-NOT-X509");
  assert.equal(first.hashAlgorithm, "FACSIMIL-SHA-256");
  assert.equal(first.verificationQR, null);
  assert.equal(first.verifactuEligible, false);
  assert.equal(first.aeatSubmissionAllowed, false);
  assert.equal(first.simulationLabel, "(SIMULACION PREVIA A DESPLIEGUE REAL)");
  assert.equal(await verifyFiscalFacsimile(first), true);

  const second = await createFiscalFacsimile({
    sequenceNumber: 2,
    yearSequence: 2,
    year: 2026,
    previousRecordHash: first.hash,
    payload: { totalAmount: 20, movementType: "DEVOLUCION" },
    generatedAt: new Date("2026-11-06T11:00:00.000Z"),
  });
  assert.equal(second.previousRecordHash, first.hash);
  assert.equal(await verifyFiscalFacsimile(second), true);
  assert.equal(await verifyFiscalFacsimile({
    ...second,
    canonicalPayload: second.canonicalPayload + "&tampered=1",
  }), false);
  assert.equal(await verifyFiscalFacsimile({
    ...second,
    digitalSignature: "MOCKX509SIG:" + "a".repeat(16),
  }), false);
  assert.equal(await verifyFiscalFacsimile({
    ...second,
    aeatSubmissionAllowed: true,
  }), false);
});

test("FACSIMIL rejects real-chain hashes and invalid sequence data", async () => {
  await assert.rejects(() => createFiscalFacsimile({
    sequenceNumber: 1,
    yearSequence: 1,
    year: 2026,
    previousRecordHash: "a".repeat(64),
    payload: { totalAmount: 10 },
  }), /FACSIMIL_PREVIOUS_HASH_MUST_BE_FACSIMIL/);

  await assert.rejects(() => createFiscalFacsimile({
    sequenceNumber: 0,
    yearSequence: 1,
    year: 2026,
    payload: { totalAmount: 10 },
  }), /FACSIMIL_SEQUENCE_NUMBER_INVALID/);
});
