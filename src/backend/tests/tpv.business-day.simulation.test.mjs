import test from "node:test";
import assert from "node:assert/strict";
import { validateSaleDraft } from "../tpv/tpvValidation.js";
import { normalizeClientIdempotencyKey } from "../tpv/tpvUtils.js";

const customerIds = ["QA-CLI-0001", "QA-CLI-0002", "QA-CLI-0003"];
const staffIds = ["QA-STAFF-0001", "QA-STAFF-0002"];

const saleFixtures = [
    {
        id: "QA-SALE-DAY01-001",
        idempotencyKey: "DAY01-SALE-0001",
        customerId: customerIds[0],
        professionalId: staffIds[0],
        lineas: [
            { tipoLinea: "SERVICIO", itemId: "SRV-CORTE", concepto: "Corte y peinado [SINTÉTICO]", cantidad: 1, precioUnitario: 45, impuestosImporte: 9.45, profesionalId: staffIds[0] },
            { tipoLinea: "PRODUCTO", itemId: "PRD-CHAMPU", concepto: "Champú profesional 250 ml [SINTÉTICO]", cantidad: 1, precioUnitario: 18, impuestosImporte: 3.78, stockAfectado: true },
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
            { tipoLinea: "SERVICIO", itemId: "SRV-MANICURA", concepto: "Manicura semipermanente [SINTÉTICO]", cantidad: 1, precioUnitario: 32.50, impuestosImporte: 6.83, profesionalId: staffIds[1] },
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
            { tipoLinea: "PRODUCTO", itemId: "PRD-MASCARILLA", concepto: "Mascarilla capilar 200 ml [SINTÉTICO]", cantidad: 1, precioUnitario: 24.90, impuestosImporte: 5.23, stockAfectado: true },
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
    assert.equal(sale.estadoVenta, "COBRADA");
    return { key, sale };
}

function calculateBusinessDayFromFixtures() {
    const processed = new Map();
    const events = [];
    const commitFixture = (fixture) => {
        const { key, sale } = validateFixture(fixture);
        if (processed.has(key)) {
            events.push({
                type: "SALE_REPLAY",
                key,
                saleId: fixture.id,
                duplicate: true,
                concept: "Reintento de venta [SINTÉTICO]",
            });
            return;
        }
        const event = {
            eventId: fixture.id,
            type: "SALE",
            concept: "Venta de prueba [SINTÉTICO]",
            customerId: fixture.customerId,
            professionalId: fixture.professionalId,
            amountMinor: Math.round(sale.totalVenta * 100),
            paymentBreakdownMinor: Object.fromEntries(
                Object.entries(sale.desgloseMedios).map(([method, amount]) => [method, Math.round(amount * 100)])
            ),
            lineCount: sale.lineas.length,
            stockLines: sale.lineas.filter((line) => line.stockAfectado).length,
        };
        processed.set(key, event);
        events.push(event);
    };
    for (const fixture of saleFixtures) commitFixture(fixture);
    commitFixture(saleFixtures[0]);

    const refund = {
        eventId: "QA-REFUND-DAY01-001",
        type: "REFUND",
        concept: "Devolución de prueba [SINTÉTICO]",
        originalSaleId: "QA-SALE-DAY01-003",
        amountMinor: 3013,
        method: "EFECTIVO",
    };
    events.push(refund);

    const cashMovements = [
        { id: "QA-CASH-IN-001", type: "CASH_IN", amountMinor: 2000, concept: "Entrada de efectivo [SINTÉTICO]" },
        { id: "QA-CASH-OUT-001", type: "CASH_OUT", amountMinor: 1200, concept: "Salida de efectivo [SINTÉTICO]" },
    ];

    const totalSalesMinor = [...processed.values()].reduce((sum, event) => sum + event.amountMinor, 0);
    const paymentTotals = [...processed.values()].reduce((totals, event) => {
        for (const [method, amount] of Object.entries(event.paymentBreakdownMinor)) totals[method] += amount;
        return totals;
    }, { EFECTIVO: 0, TARJETA: 0, BIZUM: 0, BONO: 0, TARJETA_REGALO: 0, OTROS: 0 });

    const openingFloatMinor = 15000;
    const cashAppliedMinor = paymentTotals.EFECTIVO;
    const cashInMinor = cashMovements.filter((item) => item.type === "CASH_IN").reduce((sum, item) => sum + item.amountMinor, 0);
    const cashOutMinor = cashMovements.filter((item) => item.type === "CASH_OUT").reduce((sum, item) => sum + item.amountMinor, 0);
    const cashRefundMinor = refund.amountMinor;
    const expectedDrawerMinor = openingFloatMinor + cashAppliedMinor + cashInMinor - cashOutMinor - cashRefundMinor;

    return {
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

test("TPV business-day calculations use neutral in-memory fixtures", () => {
    const day = calculateBusinessDayFromFixtures();
    assert.equal(day.totals.salesCount, 3);
    assert.deepEqual([...day.processed.values()].map((item) => item.amountMinor), [7623, 3933, 3013]);
    assert.equal(day.totals.totalSalesMinor, 14569);
    assert.equal(day.totals.netSalesMinor, 11556);
    assert.deepEqual(day.totals.paymentTotals, { EFECTIVO: 7623, TARJETA: 3013, BIZUM: 3933, BONO: 0, TARJETA_REGALO: 0, OTROS: 0 });
});

test("cash drawer calculation reconciles opening float, cash tender, movements and cash refund", () => {
    const { totals } = calculateBusinessDayFromFixtures();
    assert.equal(totals.openingFloatMinor, 15000);
    assert.equal(totals.cashInMinor, 2000);
    assert.equal(totals.cashOutMinor, 1200);
    assert.equal(totals.cashRefundMinor, 3013);
    assert.equal(totals.expectedDrawerMinor, 20410);
});

test("sale draft validation normalizes localized price and tender strings to exact cents", () => {
    const sale = validateSaleDraft({
        lineas: [{ tipoLinea: "SERVICIO", concepto: "Servicio [SINTÉTICO]", cantidad: 1, precioUnitario: "12,50", impuestosImporte: "0,00" }],
        pagos: [{ medioPago: " efectivo ", importe: "12,50", importeCambio: "0,00" }],
    });
    assert.equal(sale.totalVenta, 12.5);
    assert.equal(sale.totalCobrado, 12.5);
    assert.equal(sale.estadoVenta, "COBRADA");
});

test("cash change is separated from applied tender and drawer proceeds", () => {
    const sale = validateSaleDraft(saleFixtures[0]);
    assert.equal(sale.efectivoRecibido, 100);
    assert.equal(sale.cambioEntregado, 23.77);
    assert.equal(sale.efectivoAplicado, 76.23);
});

test("idempotent draft replay does not duplicate the in-memory calculation", () => {
    const day = calculateBusinessDayFromFixtures();
    const replay = validateFixture(saleFixtures[0]);
    assert.ok(day.processed.has(replay.key));
    assert.equal(day.processed.size, 3);
    assert.equal(day.totals.totalSalesMinor, 14569);
    assert.equal(day.events.filter((event) => event.type === "SALE_REPLAY" && event.duplicate).length, 1);
});

test("invalid amount, overpayment and partial tender are handled explicitly", () => {
    assert.throws(() => validateSaleDraft({
        lineas: [{ tipoLinea: "SERVICIO", concepto: "Servicio inválido [SINTÉTICO]", cantidad: 1, precioUnitario: 10.001, impuestosImporte: 0 }],
    }), /TPV_INVALID_PRECISION_UNIT_PRICE/);

    assert.throws(() => validateSaleDraft({
        lineas: [{ tipoLinea: "PRODUCTO", concepto: "Producto [SINTÉTICO]", cantidad: 1, precioUnitario: 10, impuestosImporte: 0 }],
        pagos: [{ medioPago: "TARJETA", importe: 10.01 }],
    }), /TPV_OVERPAYMENT/);

    const partial = validateSaleDraft({
        lineas: [{ tipoLinea: "SERVICIO", concepto: "Servicio parcialmente cobrado [SINTÉTICO]", cantidad: 1, precioUnitario: 20, impuestosImporte: 0 }],
        pagos: [{ medioPago: "EFECTIVO", importe: 5 }],
    });
    assert.equal(partial.estadoVenta, "PARCIAL");
    assert.equal(partial.importePendiente, 15);
});

test("synthetic test data is identified only in descriptive concepts", () => {
    const day = calculateBusinessDayFromFixtures();
    const records = [...day.events, ...day.cashMovements];
    assert.ok(records.every((record) => String(record.concept || "").endsWith("[SINTÉTICO]")));
    for (const record of records) {
        assert.equal(record.isSynthetic, undefined);
        assert.equal(record.realPayment, undefined);
        assert.equal(record.sourceType, undefined);
        assert.equal(record.testRunId, undefined);
        assert.equal(record.persisted, undefined);
    }
});

test("fixture identities and catalog references are bounded to the test scenario", () => {
    assert.ok(customerIds.every((id) => id.startsWith("QA-CLI-")));
    assert.ok(staffIds.every((id) => id.startsWith("QA-STAFF-")));
    assert.ok(saleFixtures.flatMap((sale) => sale.lineas).every((line) => line.itemId.startsWith("SRV-") || line.itemId.startsWith("PRD-")));
});
