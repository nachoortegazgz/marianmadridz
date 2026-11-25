import test from "node:test";
import assert from "node:assert/strict";
import { getTpvWriteV1Blockers } from "backend/tpv/tpvWriteV1Contract";

const validLine = (rate = "0.210000") => ({
    desgloseImpuestos: [{ rate, taxableAmount: "100.00", taxAmount: "21.00" }],
});
const validPayment = (medioPago = "TARJETA", importeAplicado = 121) => ({
    medioPago,
    importeAplicado,
});

test("accepts one tender fully covering a single-rate sale", () => {
    assert.deepEqual(getTpvWriteV1Blockers({
        lineas: [validLine(), validLine("0.21")],
        pagos: [validPayment("TARJETA", 242)],
        totalVenta: 242,
    }), []);
});

test("rejects multiple tax rates without inventing a representative rate", () => {
    assert.deepEqual(getTpvWriteV1Blockers({
        lineas: [validLine("0.21"), validLine("0.10")],
        pagos: [validPayment("EFECTIVO", 131)],
        totalVenta: 131,
    }), ["TPV_WRITE_V1_MULTI_VAT_UNSUPPORTED"]);
});

test("rejects tax lines without a verifiable Wix tax rate", () => {
    assert.deepEqual(getTpvWriteV1Blockers({
        lineas: [{ desgloseImpuestos: [{ taxableAmount: "100", taxAmount: "21" }] }],
        pagos: [validPayment()],
        totalVenta: 121,
    }), ["TPV_WRITE_V1_TAX_RATE_UNVERIFIABLE"]);
});

test("requires exactly one payment method in V1", () => {
    assert.deepEqual(getTpvWriteV1Blockers({
        lineas: [validLine()],
        pagos: [validPayment("EFECTIVO"), validPayment("TARJETA")],
        totalVenta: 121,
    }), ["TPV_WRITE_V1_SPLIT_TENDER_UNSUPPORTED"]);
});

test("blocks Bizum until PAYMENTS configuration is verified", () => {
    assert.deepEqual(getTpvWriteV1Blockers({
        lineas: [validLine()],
        pagos: [validPayment("BIZUM", 121)],
        totalVenta: 121,
    }), ["TPV_WRITE_V1_PAYMENT_METHOD_UNSUPPORTED"]);
});

test("requires a supported physical tender and exact applied amount", () => {
    assert.deepEqual(getTpvWriteV1Blockers({
        lineas: [validLine()],
        pagos: [validPayment("WIX_PAYMENTS", 121)],
        totalVenta: 121,
    }), ["TPV_WRITE_V1_PAYMENT_METHOD_UNSUPPORTED"]);

    assert.deepEqual(getTpvWriteV1Blockers({
        lineas: [validLine()],
        pagos: [validPayment("TARJETA", 120)],
        totalVenta: 121,
    }), ["TPV_WRITE_V1_PAYMENT_TOTAL_MISMATCH"]);
});

test("cash tender may include change but the applied amount must equal the sale", () => {
    assert.deepEqual(getTpvWriteV1Blockers({
        lineas: [validLine()],
        pagos: [{ medioPago: "EFECTIVO", importe: 130, importeCambio: 9, importeAplicado: 121 }],
        totalVenta: 121,
    }), []);
});
