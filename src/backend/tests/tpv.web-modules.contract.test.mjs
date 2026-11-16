import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Script } from "node:vm";

import { validateSaleDraft } from "../tpv/tpvValidation.js";

const backendRoot = new URL("../", import.meta.url);
const repoRoot = new URL("../../../", import.meta.url);

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

test("TPV cash tender subtracts change before reconciling amount applied", () => {
    const result = validateSaleDraft({
        lineas: [{
            tipoLinea: "SERVICIO",
            concepto: "Servicio con cambio",
            cantidad: 1,
            precioUnitario: 40,
            descuentoImporte: 0,
            impuestosImporte: 0,
        }],
        pagos: [{ medioPago: "EFECTIVO", importe: 50, importeCambio: 10 }],
    });
    assert.equal(result.importePagado, 40);
    assert.equal(result.importePendiente, 0);
    assert.equal(result.pagos[0].importeAplicado, 40);
    assert.throws(
        () => validateSaleDraft({
            lineas: [{
                tipoLinea: "SERVICIO",
                concepto: "Cambio no efectivo",
                cantidad: 1,
                precioUnitario: 40,
                impuestosImporte: 0,
            }],
            pagos: [{ medioPago: "TARJETA", importe: 50, importeCambio: 10 }],
        }),
        /TPV_CHANGE_REQUIRES_CASH/
    );
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

test("TPV dependency manifest and npm lockfile remain synchronized", async () => {
    const packageJson = JSON.parse(await readFile(new URL("package.json", repoRoot), "utf8"));
    const packageLock = JSON.parse(await readFile(new URL("package-lock.json", repoRoot), "utf8"));
    assert.deepEqual(
        packageLock.packages[""].dependencies,
        packageJson.dependencies
    );
    assert.equal(packageJson.dependencies["@wix/stores"], "1.0.997");
});

test("TPV WebMethods keep writes blocked and do not access CMS directly", async () => {
    const files = [
        "tpv/tpvCaja.web.js",
        "tpv/tpvVentas.web.js",
        "tpv/tpvCatalogo.web.js",
        "tpv/tpvReportes.web.js",
        "tpv/tpvGiftCards.web.js",
    ];
    const contents = await Promise.all(files.map(source));
    const joined = contents.join("\n");

    assert.match(joined, /webMethod\(\s*Permissions\.SiteMember/);
    assert.match(joined, /requireCajero/);
    assert.match(joined, /TPV_CASH_MOVEMENT_WRITES_DISABLED/);
    assert.match(joined, /TPV_SALE_WRITES_DISABLED/);
    assert.match(joined, /TPV_REFUNDS_DISABLED/);
    assert.match(joined, /TPV_Z_CLOSING_DISABLED/);
    assert.doesNotMatch(joined, /\b(?:wixData|MovimientosCaja|CajaActual)\b|\.insert\(|\.update\(|\.remove\(/);
});

test("TPV catalog reader uses native Bookings SDK and does not expose staff contact details", async () => {
    const catalog = await source("tpv/tpvCatalogo.web.js");
    assert.match(catalog, /services\.queryServices/);
    assert.match(catalog, /staffMembers\.queryStaffMembersV2/);
    assert.match(catalog, /formattedValue/);
    assert.match(catalog, /precioMinor/);
    assert.match(catalog, /catalogVersioning\.getCatalogVersion/);
    assert.match(catalog, /productsV3\.queryProducts/);
    assert.match(catalog, /productsV3\.getProduct/);
    assert.match(catalog, /visibleInPos/);
    assert.match(catalog, /V3_CATALOG/);
    assert.match(catalog, /precioMinor/);
    assert.match(catalog, /from ["']@wix\/stores["']/);
    assert.doesNotMatch(catalog, /staff\.email|staff\.phone/);

    const giftCards = await source("tpv/tpvGiftCards.web.js");
    assert.match(giftCards, /giftVouchers\.getGiftCard/);
    assert.match(giftCards, /requireCajero/);
    assert.match(giftCards, /obfuscatedCode/);
    assert.doesNotMatch(giftCards, /console\.(?:log|info|warn|error)|wixData|\.insert\(|\.update\(|\.remove\(/);
});

test("TPV page is wired to the shared HTML bridge and its versioned iframe protocol", async () => {
    const [page, controller, html] = await Promise.all([
        source("../pages/TPV.yl5th.js"),
        source("../public/tpvPageController.js"),
        source("../../%23htmlTPV.txt"),
    ]);

    assert.match(page, /initializeTpvPage/);
    assert.match(page, /public\/tpvPageController/);
    assert.match(page, /initializeTpvPage\(widget\)/);
    assert.doesNotMatch(page, /TPV_REQUEST_STATE|TPV_READY|getCashierState/);

    assert.match(controller, /MESSAGE_TYPES\.READY/);
    assert.match(controller, /MESSAGE_TYPES\.CONTEXT/);
    assert.match(controller, /"CASHIER_STATE"/);
    assert.match(controller, /CASHIER_STATE_RES/);
    assert.match(controller, /CATALOG_SERVICES/);
    assert.match(controller, /CATALOG_STAFF/);
    assert.match(controller, /obtenerServicios/);
    assert.match(controller, /obtenerProfesionales/);
    assert.match(controller, /obtenerProductos/);
    assert.match(controller, /obtenerVariantesProducto/);
    assert.match(controller, /validarVentaBorrador/);
    assert.match(controller, /previsualizarTicketX/);
    assert.match(controller, /TICKET_X_PREVIEW/);
    assert.match(controller, /consultarTarjetaRegalo/);
    assert.match(controller, /GIFT_CARD_BALANCE/);
    assert.match(controller, /obtenerCajaActual/);
    assert.match(controller, /reply\("CASHIER_STATE_RES", result, message\)/);
    assert.doesNotMatch(controller, /\bgetCashierState\b/);

    assert.match(html, /send\("MM_READY"/);
    assert.match(html, /m\.type==="MM_CONTEXT"/);
    assert.match(html, /send\("CASHIER_STATE"/);
    assert.match(html, /m\.type==="CASHIER_STATE_RES"/);
    assert.match(html, /send\("CATALOG_SERVICES"/);
    assert.match(html, /send\("CATALOG_STAFF"/);
    assert.match(html, /m\.type==="CATALOG_SERVICES_RES"/);
    assert.match(html, /m\.type==="CATALOG_STAFF_RES"/);
    assert.match(html, /GIFT_CARD_BALANCE_RES/);
    assert.match(html, /lookupGiftCard/);
    assert.match(html, /finalizeSynthetic/);

    const inlineScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    assert.ok(inlineScript, "TPV HTML component must contain its runtime script");
    assert.doesNotThrow(() => new Script(inlineScript));
});
