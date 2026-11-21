import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Script } from "node:vm";

const html = await readFile(new URL("../../../%23htmlTPV.txt", import.meta.url), "utf8");
const controller = await readFile(new URL("../../public/tpvPageController.js", import.meta.url), "utf8");
const bridge = await readFile(new URL("../../public/widgetBridge.js", import.meta.url), "utf8");
const config = await readFile(new URL("../internalConfig.js", import.meta.url), "utf8");

const expectedMethods = [
    "obtenerEstadoCaja",
    "abrirSesionCaja",
    "obtenerServicios",
    "obtenerProductos",
    "obtenerStaff",
    "registrarVenta",
    "registrarMovimientoCaja",
    "registrarDevolucion",
    "generarControlX",
    "generarCierreZ",
    "obtenerResumenCaja",
    "obtenerMovimientosCaja",
];

const activeMessages = [
    "CASHIER_STATE",
    "SESSION_OPEN",
    "CATALOG_SERVICES",
    "CATALOG_PRODUCTS",
    "CATALOG_STAFF",
    "SALE_REGISTER",
    "CASH_MOVEMENT",
    "REFUND",
    "TICKET_X",
    "TICKET_Z",
    "SESSION_SUMMARY",
    "AUDIT_LIST",
];

test("TPV controller binds the exact backend method contract through the shared Wix HTML bridge", async () => {
    assert.match(controller, /export function initializeTpvPage\(widget\)/);
    assert.match(controller, /createWidgetBridge\(widget/);
    assert.match(controller, /MESSAGE_TYPES\.READY/);
    assert.match(controller, /MESSAGE_TYPES\.CONTEXT/);
    assert.match(controller, /allowOpaqueOrigin: true/);
    assert.match(controller, /environment: "SANDBOX"/);
    assert.match(controller, /syntheticOnly: true/);
    assert.doesNotMatch(controller, /environment: ["']LIVE["']/);
    assert.doesNotMatch(controller, /ALLOWED_ORIGIN\s*=\s*["']\*["']/);

    for (const method of expectedMethods) assert.ok(controller.includes(method), "controller must consume " + method);
    for (const type of activeMessages) {
        assert.ok(controller.includes('"' + type + '"'), "controller must dispatch " + type);
        assert.ok(controller.includes('"' + type + '_RES"'), "controller must respond to " + type);
    }

    const modules = {
        "tpvCaja.web.js": ["obtenerEstadoCaja", "abrirSesionCaja"],
        "tpvCatalogo.web.js": ["obtenerServicios", "obtenerProductos", "obtenerStaff"],
        "tpvVentas.web.js": ["registrarVenta"],
        "tpvMovimientos.web.js": ["registrarMovimientoCaja"],
        "tpvDevoluciones.web.js": ["registrarDevolucion"],
        "tpvCierres.web.js": ["generarControlX", "generarCierreZ", "obtenerResumenCaja"],
        "tpvAuditoria.web.js": ["obtenerMovimientosCaja"],
    };
    for (const [file, methods] of Object.entries(modules)) {
        const source = await readFile(new URL("../tpv/" + file, import.meta.url), "utf8");
        for (const method of methods) {
            assert.match(source, new RegExp("export const " + method + " = webMethod\\("), file + " must export " + method);
        }
    }
});

test("TPV widget and controller agree on request/response names and payload mapping", () => {
    assert.match(html, /send\("MM_READY"/);
    assert.match(html, /m\.type==="MM_CONTEXT"/);
    for (const type of activeMessages) {
        assert.ok(html.includes('"' + type + '"'), "widget must request " + type);
        assert.ok(html.includes('"' + type + '_RES"'), "widget must await " + type + "_RES");
    }
    assert.match(controller, /lineItems/);
    assert.match(controller, /medioPago: payment\.method/);
    assert.match(controller, /importeCambio: payment\.change/);
    assert.match(controller, /idempotencyKey/);
    assert.match(controller, /differenceReason/);
    assert.match(html, /data-tax/);
    assert.match(html, /taxTotal/);
    assert.match(html, /payments:\[\{paymentMethod,amount\}\]/);
    assert.match(html, /state\.lastSale=result/);
    assert.doesNotMatch(html, /\$\("tax"\)/);

    const inlineScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    assert.ok(inlineScript, "TPV HTML component must contain its runtime script");
    assert.doesNotThrow(() => new Script(inlineScript));
});

test("TPV Sandbox writes stay mapped to the site's canonical physical collections", () => {
    assert.match(config, /CAJA_ACTUAL:\s*"CajaActual"/);
    assert.match(config, /MOVIMIENTOS_CAJA:\s*"MovimientosCaja"/);
    assert.match(config, /CONTROL_OPERATIVO:\s*"ControlOperativo"/);
    assert.match(config, /TPV_SANDBOX_IDENTITIES:\s*"TpvSandboxIdentities"/);
    assert.match(config, /SANDBOX_LOGICAL_VENTAS/);
    assert.match(config, /SANDBOX_LOGICAL_MOVIMIENTOS_CAJA/);

    const repositoryPath = new URL("../tpv/tpvSandboxRepository.js", import.meta.url);
    return readFile(repositoryPath, "utf8").then((repository) => {
        assert.match(repository, /BUSINESS_COLLECTIONS\.CAJA_ACTUAL/);
        assert.match(repository, /BUSINESS_COLLECTIONS\.MOVIMIENTOS_CAJA/);
        assert.match(repository, /TPV_SANDBOX_SYNTHETIC/);
        assert.match(repository, /payloadFiscal\?\.sandboxRunId === SANDBOX_RUN_ID/);
        assert.doesNotMatch(repository, /HISTORICO_CIERRES_Z|LIBRO_ASIENTOS_CONTABLES_DETALLE/);
    });
});

test("shared bridge is the only page-to-widget transport and never advertises LIVE", () => {
    const page = `import { initializeTpvPage } from "public/tpvPageController";`;
    assert.match(page, /initializeTpvPage/);
    assert.match(bridge, /export function createWidgetBridge/);
    assert.match(bridge, /function isOriginAllowed/);
    assert.match(bridge, /allowOpaqueOrigin/);
    assert.match(controller, /environment: "SANDBOX"/);
    assert.doesNotMatch(controller, /environment: "LIVE"/);
});
