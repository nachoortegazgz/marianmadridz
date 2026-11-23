import test from "node:test";
import assert from "node:assert/strict";
import { validateSaleDraft } from "../tpv/tpvValidation.js";
import { makeSyntheticPayload, normalizeClientIdempotencyKey } from "../tpv/tpvUtils.js";

const RUN_ID = "TPVQA-DEV-20261120-DAY01";
const customerIds = ["QA-CLI-0001", "QA-CLI-0002", "QA-CLI-0003"];
const staffIds = ["QA-STAFF-0001", "QA-STAFF-0002"];

const saleFixtures = [
    {
        id: "QA-SALE-DAY01-001",
        idempotencyKey: "DAY01-SALE-0001",
        customerId: customerIds[0],
        professionalId: staffIds[0],
        lineas: [
            { tipoLinea: "SERVICIO", itemId: "SRV-CORTE", concepto: "Corte y peinado", cantidad: 1, precioUnitario: 45, impuestosImporte: 9.45, profesionalId: staffIds[0] },
            { tipoLinea: "PRODUCTO", itemId: "PRD-CHAMPU", concepto: "Champú profesional 250 ml", cantidad: 1, precioUnitario: 18, impuestosImporte: 3.78, stockAfectado: true },
        ],
        pagos: [{ medioPago: "EFECTIVO", importe: 100, importeCambio: 23.77 }],
        subtotalNeto: 63,
        impuestosTotal: 13.23,
        totalVenta: 76.23,
    },
    {
        id: "QA-SALE-DAY01-002",
        idempotencyKey: "DAY01-SALE-0002",
        customerId: customerIds[1],
        professionalId: staffIds[1],
        lineas: [
            { tipoLinea: "SERVICIO", itemId: "SRV-MANICURA", concepto: "Manicura semipermanente", cantidad: 1, precioUnitario: 32.50, impuestosImporte: 6.83, profesionalId: staffIds[1] },
        ],
        pagos: [{ medioPago: "BIZUM", importe: 39.33 }],
        subtotalNeto: 32.50,
        impuestosTotal: 6.83,
        totalVenta: 39.33,
    },
    {
        id: "QA-SALE-DAY01-003",
        idempotencyKey: "DAY01-SALE-0003",
        customerId: customerIds[2],
        professionalId: staffIds[0],
        lineas: [
            { tipoLinea: "PRODUCTO", itemId: "PRD-MASCARILLA", concepto: "Mascarilla capilar 200 ml", cantidad: 1, precioUnitario: 24.90, impuestosImporte: 5.23, stockAfectado: true },
        ],
        pagos: [{ medioPago: "TARJETA", importe: 30.13 }],
        subtotalNeto: 24.90,
        impuestosTotal: 5.23,
        totalVenta: 30.13,
    },
];

function validateFixture(fixture) {
    const key = normalizeClientIdempotencyKey(fixture.idempotencyKey);
    const sale = validateSaleDraft(fixture);
    assert.equal(sale.importePendiente, 0);
    assert.equal(sale.estadoVenta, "COBRADA_SINTETICA");
    assert.equal(sale.realPayment, false);
    return { key, sale };
}

function runSyntheticBusinessDay() {
    const processed = new Map();
    const events = [];
    const commitFixture = (fixture) => {
        const { key, sale } = validateFixture(fixture);
        if (processed.has(key)) {
            events.push(makeSyntheticPayload({
                type: "SALE_REPLAY",
                key,
                saleId: fixture.id,
                duplicate: true,
                testRunId: RUN_ID,
                persisted: false,
            }));
            return;
        }
        const event = makeSyntheticPayload({
            eventId: fixture.id,
            testRunId: RUN_ID,
            type: "SALE_COMMITTED",
            customerId: fixture.customerId,
            professionalId: fixture.professionalId,
            amountMinor: Math.round(sale.totalVenta * 100),
            paymentBreakdownMinor: Object.fromEntries(
                Object.entries(sale.desgloseMedios).map(([method, amount]) => [method, Math.round(amount * 100)])
            ),
            lineCount: sale.lineas.length,
            stockLines: sale.lineas.filter((line) => line.stockAfectado).length,
            persisted: false,
        });
        processed.set(key, event);
        events.push(event);
    };
    for (const fixture of saleFixtures) commitFixture(fixture);
    // Replay the first request with the same key to exercise the in-memory dedupe path.
    commitFixture(saleFixtures[0]);

    const refund = makeSyntheticPayload({
        eventId: "QA-REFUND-DAY01-001",
        testRunId: RUN_ID,
        type: "REFUND_SIMULATED",
        originalSaleId: "QA-SALE-DAY01-003",
        amountMinor: 3013,
        method: "EFECTIVO",
        persisted: false,
    });
    events.push(refund);

    const cashMovements = [
        { id: "QA-CASH-IN-001", type: "CASH_IN", amountMinor: 2000 },
        { id: "QA-CASH-OUT-001", type: "CASH_OUT", amountMinor: 1200 },
    ].map((movement) => makeSyntheticPayload({ ...movement, testRunId: RUN_ID, persisted: false }));

    const totalSalesMinor = [...processed.values()].reduce((sum, event) => sum + event.amountMinor, 0);
    const paymentTotals = [...processed.values()].reduce((totals, event) => {
        for (const [method, amount] of Object.entries(event.paymentBreakdownMinor)) {
            totals[method] += amount;
        }
        return totals;
    }, { EFECTIVO: 0, TARJETA: 0, BIZUM: 0, BONO: 0, TARJETA_REGALO: 0, OTROS: 0 });

    const openingFloatMinor = 15000;
    const cashAppliedMinor = paymentTotals.EFECTIVO;
    const cashInMinor = cashMovements.filter((item) => item.type === "CASH_IN").reduce((sum, item) => sum + item.amountMinor, 0);
    const cashOutMinor = cashMovements.filter((item) => item.type === "CASH_OUT").reduce((sum, item) => sum + item.amountMinor, 0);
    const cashRefundMinor = refund.amountMinor;
    const expectedDrawerMinor = openingFloatMinor + cashAppliedMinor + cashInMinor - cashOutMinor - cashRefundMinor;

    return {
        runId: RUN_ID,
        processed,
        events,
        cashMovements,
        refund,
        totals: {
            salesCount: processed.size,
            totalSalesMinor,
            refundMinor: cashRefundMinor,
            netSalesMinor: totalSalesMinor - cashRefundMinor,
            paymentTotals,
            openingFloatMinor,
            cashInMinor,
            cashOutMinor,
            cashRefundMinor,
            expectedDrawerMinor,
        },
    };
}

test("TPV business-day simulation validates three realistic synthetic sales", () => {
    const day = runSyntheticBusinessDay();
    assert.equal(day.totals.salesCount, 3);
    assert.deepEqual([...day.processed.values()].map((item) => item.amountMinor), [7623, 3933, 3013]);
    assert.equal(day.totals.totalSalesMinor, 14569);
    assert.equal(day.totals.netSalesMinor, 11556);
    assert.deepEqual(day.totals.paymentTotals, { EFECTIVO: 7623, TARJETA: 3013, BIZUM: 3933, BONO: 0, TARJETA_REGALO: 0, OTROS: 0 });
});

test("cash drawer reconciles opening float, cash tender, movements and cash refund", () => {
    const { totals } = runSyntheticBusinessDay();
    assert.equal(totals.openingFloatMinor, 15000);
    assert.equal(totals.cashInMinor, 2000);
    assert.equal(totals.cashOutMinor, 1200);
    assert.equal(totals.cashRefundMinor, 3013);
    assert.equal(totals.expectedDrawerMinor, 20410);
});

test("cash change is separated from applied tender and drawer proceeds", () => {
    const sale = validateSaleDraft(saleFixtures[0]);
    assert.equal(sale.efectivoRecibido, 100);
    assert.equal(sale.cambioEntregado, 23.77);
    assert.equal(sale.efectivoAplicado, 76.23);
});

test("replay of the same idempotency key does not duplicate the simulated sale", () => {
    const day = runSyntheticBusinessDay();
    const replay = validateFixture(saleFixtures[0]);
    assert.ok(day.processed.has(replay.key));
    assert.equal(day.processed.size, 3);
    assert.equal(day.totals.totalSalesMinor, 14569);
    assert.equal(day.events.filter((event) => event.type === "SALE_REPLAY" && event.duplicate).length, 1);
});

test("invalid amount, overpayment and partial tender are handled explicitly", () => {
    assert.throws(() => validateSaleDraft({
        lineas: [{ tipoLinea: "SERVICIO", concepto: "Servicio inválido", cantidad: 1, precioUnitario: 10.001, impuestosImporte: 0 }],
    }), /TPV_INVALID_PRECISION_UNIT_PRICE/);

    assert.throws(() => validateSaleDraft({
        lineas: [{ tipoLinea: "PRODUCTO", concepto: "Producto", cantidad: 1, precioUnitario: 10, impuestosImporte: 0 }],
        pagos: [{ medioPago: "TARJETA", importe: 10.01 }],
    }), /TPV_OVERPAYMENT/);

    const partial = validateSaleDraft({
        lineas: [{ tipoLinea: "SERVICIO", concepto: "Servicio parcialmente cobrado", cantidad: 1, precioUnitario: 20, impuestosImporte: 0 }],
        pagos: [{ medioPago: "EFECTIVO", importe: 5 }],
    });
    assert.equal(partial.estadoVenta, "PARCIAL_SINTETICA");
    assert.equal(partial.importePendiente, 15);
});

test("every simulated event is synthetic and declares no persistence or external side effects", () => {
    const day = runSyntheticBusinessDay();
    for (const event of [...day.events, ...day.cashMovements]) {
        assert.equal(event.isSynthetic, true);
        assert.equal(event.realPayment, false);
        assert.equal(event.externalSideEffects, false);
        assert.equal(event.persisted, false);
        assert.equal(event.testRunId, RUN_ID);
    }
});

test("fixture identities and catalog references are bounded to the synthetic scenario", () => {
    assert.ok(customerIds.every((id) => id.startsWith("QA-CLI-")));
    assert.ok(staffIds.every((id) => id.startsWith("QA-STAFF-")));
    assert.ok(saleFixtures.flatMap((sale) => sale.lineas).every((line) => line.itemId.startsWith("SRV-") || line.itemId.startsWith("PRD-")));
});
