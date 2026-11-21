import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Script } from "node:vm";

const repoRoot = new URL("../../../", import.meta.url);
const source = (path) => readFile(new URL(path, repoRoot), "utf8");

test("TPV page attaches the shared controller to the existing #htmlTPV component", async () => {
    const page = await source("src/pages/TPV.yl5th.js");
    const controller = await source("src/public/tpvPageController.js");
    const bridge = await source("src/public/widgetBridge.js");
    assert.match(page, /\$w\("#htmlTPV"\)/);
    assert.match(page, /initializeTpvPage\(widget\)/);
    assert.match(controller, /export function initializeTpvPage\(widget\)/);
    assert.match(controller, /createWidgetBridge/);
    assert.match(controller, /allowOpaqueOrigin: true/);
    assert.doesNotMatch(controller, /ALLOWED_ORIGIN\s*=\s*["']\*["']/);
    assert.match(bridge, /widgetElement\.onMessage/);
    assert.match(bridge, /widgetElement\.postMessage/);
});

test("TPV controller imports all twelve canonical backend WebMethod names", async () => {
    const controller = await source("src/public/tpvPageController.js");
    const modules = {
        "src/backend/tpv/tpvCaja.web.js": ["obtenerEstadoCaja", "abrirSesionCaja"],
        "src/backend/tpv/tpvCatalogo.web.js": ["obtenerServicios", "obtenerProductos", "obtenerStaff"],
        "src/backend/tpv/tpvVentas.web.js": ["registrarVenta"],
        "src/backend/tpv/tpvMovimientos.web.js": ["registrarMovimientoCaja", "obtenerMovimientosCaja"],
        "src/backend/tpv/tpvDevoluciones.web.js": ["registrarDevolucion"],
        "src/backend/tpv/tpvCierres.web.js": ["generarControlX", "generarCierreZ", "obtenerResumenCaja"],
    };
    for (const [path, names] of Object.entries(modules)) {
        const content = await source(path);
        for (const name of names) {
            assert.match(content, new RegExp("export const " + name + " = webMethod\\("), path + " must export " + name);
            assert.ok(controller.includes(name), "controller must consume " + name);
        }
    }
    assert.equal(Object.values(modules).flat().length, 12);
    assert.match(controller, /obtenerConfiguracionTPV/);
    assert.match(controller, /currency: config.status === "SUCCESS"/);
    assert.doesNotMatch(controller, /environment:|previewOnly:|syntheticOnly:/);
});

test("TPV controller dispatches the messages emitted by the POS widget", async () => {
    const controller = await source("src/public/tpvPageController.js");
    const html = await source("%23htmlTPV.txt");
    const types = [
        "CASHIER_STATE", "SESSION_OPEN", "CATALOG_SERVICES", "CATALOG_PRODUCTS", "CATALOG_VARIANTS",
        "CATALOG_STAFF", "CUSTOMERS_SEARCH", "SALE_REGISTER", "CASH_MOVEMENT", "REFUND",
        "TICKET_X", "TICKET_Z", "SESSION_SUMMARY", "AUDIT_LIST",
    ];
    for (const type of types) {
        assert.ok(controller.includes('"' + type + '"'), "controller must dispatch " + type);
        assert.ok(html.includes('"' + type + '"'), "HTML widget must send " + type);
        assert.ok(html.includes(type + "_RES"), "HTML widget must receive " + type + "_RES");
    }
    assert.match(controller, /reply\(message\.type \+ "_RES", result, message\)/);
    assert.match(controller, /idempotencyKey\(message, payload\)/);
    assert.match(controller, /lineTaxMinor !== declaredTaxMinor/);
});

test("TPV widget keeps all writes synthetic and does not implement a second payment gateway", async () => {
    const html = await source("%23htmlTPV.txt");
    const config = await source("src/backend/internalConfig.js");
    assert.match(config, /ENVIRONMENT: "SANDBOX"/);
    assert.match(config, /SYNTHETIC_ONLY: true/);
    assert.match(config, /REAL_PAYMENTS_ENABLED: false/);
    assert.match(config, /FISCAL_WRITES_ENABLED: false/);
    assert.doesNotMatch(html, /environment|previewOnly|syntheticOnly|realPaymentsEnabled|fiscalWritesEnabled/);
    assert.match(html, /m\.payload\?\.status!=="SUCCESS"/);
    assert.match(html, /textContent="TPV"/);
    assert.match(html, /customerIdentityId/);
    assert.doesNotMatch(html, /customerContactId/);
    assert.match(html, /id="tax"[^>]*disabled/);
    assert.doesNotMatch(html, /fetch\s*\(|XMLHttpRequest|wix-data|suppressAuth/i);
    assert.doesNotMatch(html, /createPayment|capturePayment|processRefund/i);
});
