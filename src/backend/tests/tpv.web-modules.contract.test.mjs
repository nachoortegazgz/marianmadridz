import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { validateSaleDraft } from "../tpv/tpvValidation.js";

const backendRoot = new URL("../", import.meta.url);

async function source(path) {
    return readFile(new URL(path, backendRoot), "utf8");
}

test("TPV sale draft validates report fields and minor-unit arithmetic", () => {
    const result = validateSaleDraft({
        lineas: [{
            tipoLinea: "SERVICIO",
            itemId: "service-1",
            concepto: "Servicio QA",
            cantidad: 1,
            precioUnitario: 100,
            descuentoImporte: 10,
            subtotalNeto: 90,
            impuestosImporte: 18.9,
            totalLinea: 108.9,
        }],
        pagos: [
            { medioPago: "EFECTIVO", importe: 40 },
            { medioPago: "TARJETA", importe: 68.9 },
        ],
    });

    assert.equal(result.totalVenta, 108.9);
    assert.equal(result.importePagado, 108.9);
    assert.equal(result.importePendiente, 0);
    assert.equal(result.estadoVenta, "COBRADA_SINTETICA");
    assert.equal(result.persisted, false);
    assert.equal(result.realPayment, false);
});

test("TPV sale draft rejects invalid tax, overpayment, unknown methods and sub-cent arithmetic", () => {
    const valid = {
        lineas: [{
            tipoLinea: "PRODUCTO",
            concepto: "Producto QA",
            cantidad: 1,
            precioUnitario: 10,
            descuentoImporte: 0,
            impuestosImporte: 2.1,
        }],
    };

    assert.throws(
        () => validateSaleDraft({ ...valid, lineas: [{ ...valid.lineas[0], subtotalNeto: 9 }] }),
        /TPV_LINE_SUBTOTAL_MISMATCH/
    );
    assert.throws(
        () => validateSaleDraft({ ...valid, pagos: [{ medioPago: "EFECTIVO", importe: 20 }] }),
        /TPV_OVERPAYMENT/
    );
    assert.throws(
        () => validateSaleDraft({ ...valid, pagos: [{ medioPago: "UNKNOWN", importe: 12.1 }] }),
        /TPV_INVALID_PAYMENT_METHOD/
    );
    assert.throws(
        () => validateSaleDraft({ ...valid, pagos: [{ medioPago: "EFECTIVO", importe: 5, importeCambio: 6 }] }),
        /TPV_CHANGE_EXCEEDS_CASH_RECEIVED/
    );
    assert.throws(
        () => validateSaleDraft({
            lineas: [{
                tipoLinea: "PRODUCTO",
                concepto: "Unidad fraccionada",
                cantidad: 0.5,
                precioUnitario: 0.01,
                impuestosImporte: 0,
            }],
        }),
        /TPV_INVALID_LINE_AMOUNT/
    );
});

test("TPV WebMethods keep writes blocked and do not access CMS directly", async () => {
    const files = [
        "tpv/tpvCaja.web.js",
        "tpv/tpvVentas.web.js",
        "tpv/tpvCatalogo.web.js",
        "tpv/tpvReportes.web.js",
    ];
    const contents = await Promise.all(files.map(source));
    const joined = contents.join("\n");

    assert.match(joined, /webMethod\(\s*Permissions\.SiteMember/);
    assert.match(joined, /requireCajero/);
    assert.match(joined, /TPV_CASH_MOVEMENT_WRITES_DISABLED/);
    assert.match(joined, /TPV_SALE_WRITES_DISABLED/);
    assert.match(joined, /TPV_REFUNDS_DISABLED/);
    assert.match(joined, /TPV_Z_CLOSING_DISABLED/);
    assert.doesNotMatch(joined, /wixData|MovimientosCaja|CajaActual|\.insert\(|\.update\(|\.remove\(/);
});

test("TPV catalog reader uses native Bookings SDK and does not expose staff contact details", async () => {
    const catalog = await source("tpv/tpvCatalogo.web.js");
    assert.match(catalog, /services\.queryServices/);
    assert.match(catalog, /staffMembers\.queryStaffMembersV2/);
    assert.match(catalog, /TPV_STORES_SDK_NOT_INSTALLED/);
    assert.doesNotMatch(catalog, /staff\.email|staff\.phone/);
});
