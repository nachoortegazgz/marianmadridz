import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Script } from "node:vm";
import { createWidgetBridge, MESSAGE_TYPES } from "../../public/widgetBridge.js";

const repoRoot = new URL("../../../", import.meta.url);
const source = (path) => readFile(new URL(path, repoRoot), "utf8");

test("TPV page attaches the shared controller to the existing #htmlTPV component", async () => {
    const page = await source("src/pages/TPV.yl5th.js");
    const controller = await source("src/public/tpvPageController.js");
    const bridge = await source("src/public/widgetBridge.js");
    assert.match(page, /\\$w\\("#htmlTPV"\\)/);
    assert.match(page, /initializeTpvPage\\(widget\\)/);
    assert.match(controller, /export function initializeTpvPage\\(widget\\)/);
    assert.match(controller, /createWidgetBridge/);
    assert.match(controller, /allowOpaqueOrigin: false/);
    assert.doesNotMatch(controller, /ALLOWED_ORIGIN\\s*=\\s*["']\\*["']/);
    assert.match(bridge, /widgetElement\\.onMessage/);
    assert.match(bridge, /widgetElement\\.postMessage/);
});

test("TPV controller imports operational WebMethods and no longer imports the separate test runtime", async () => {
    const controller = await source("src/public/tpvPageController.js");
    const modules = {
        "src/backend/tpv/tpvCaja.web.js": ["obtenerEstadoCaja", "abrirSesionCaja", "registrarArqueoParcial"],
        "src/backend/tpv/tpvVentas.web.js": ["validarVentaBorrador", "registrarVenta"],
        "src/backend/tpv/tpvMovimientos.web.js": ["registrarMovimientoCaja", "exportarMovimientosCaja", "exportarAuditoriaTPV"],
        "src/backend/tpv/tpvDevoluciones.web.js": ["registrarDevolucion"],
        "src/backend/tpv/tpvCierres.web.js": ["obtenerResumenCaja", "generarControlX", "generarCierreZ"],
        "src/backend/tpv/tpvAuditoria.web.js": ["obtenerAuditoriaTPV"],
        "src/backend/tpv/tpvCatalogo.web.js": ["obtenerServicios", "obtenerProductos", "obtenerStaff", "obtenerVariantesProducto", "buscarClientesTPV"],
        "src/backend/tpv/tpvUtils.web.js": ["obtenerConfiguracionTPV"],
        "src/backend/tpv/tpvPermisos.web.js": ["obtenerPermisosTPV"],
    };
    for (const [path, names] of Object.entries(modules)) {
        const content = await source(path);
        const moduleName = path.split("/").pop().replace(".js", "");
        assert.ok(controller.includes('from "backend/tpv/' + moduleName + '"'), "controller must import " + moduleName);
        for (const name of names) {
            assert.match(content, new RegExp("export const " + name + " = webMethod\\("), path + " must export " + name);
            assert.ok(controller.includes(name), "controller must consume " + name);
        }
    }
    assert.doesNotMatch(controller, /tpvTestRuntime\\.web|registrarVentaPrueba|testRuntimeAvailable/);
});

test("TPV controller dispatches widget requests to canonical backend methods", async () => {
    const controller = await source("src/public/tpvPageController.js");
    const html = await source("%23htmlTPV.txt");
    const types = [
        "CASHIER_STATE", "SESSION_OPEN", "CATALOG_SERVICES", "CATALOG_PRODUCTS", "CATALOG_VARIANTS",
        "CATALOG_STAFF", "CUSTOMERS_SEARCH", "SALE_REGISTER", "SALE_VALIDATE", "CASH_MOVEMENT",
        "PARTIAL_CASH_COUNT", "REFUND", "TICKET_X", "TICKET_Z", "SESSION_SUMMARY", "AUDIT_LIST",
        "CASH_MOVEMENTS_EXPORT", "AUDIT_EXPORT",
    ];
    for (const type of types) {
        assert.ok(controller.includes('"' + type + '"'), "controller must dispatch " + type);
        assert.ok(html.includes('"' + type + '"'), "HTML widget must send " + type);
        assert.ok(html.includes(type + "_RES") || html.includes('const responseType = type + "_RES"'),
            "HTML widget must receive " + type + "_RES");
    }
    assert.match(controller, /case "CASHIER_STATE":[\\s\\S]*?return obtenerEstadoCaja\\(\\)/);
    assert.match(controller, /case "SALE_VALIDATE":[\\s\\S]*?return validarVentaBorrador\\(\\{ lineas, pagos \\}\\)/);
    assert.match(controller, /case "SALE_REGISTER":[\\s\\S]*?return registrarVenta\\(\\{/);
    assert.match(controller, /case "AUDIT_LIST":[\\s\\S]*?return obtenerAuditoriaTPVLista\\(/);
    assert.match(controller, /reply\\(message\\.type \\+ "_RES", result, message\\)/);
    assert.match(controller, /idempotencyKey\\(message, payload\\)/);
    assert.match(controller, /saleUuidV4Key\\(payload\\.idempotencyKey\\)/);
    assert.doesNotMatch(controller, /tpvTestRuntime\\.web|registrarVentaPrueba/);
    assert.match(html, /state\\.saleQuote\\.saleReady !== true/);
    assert.match(controller, /!Number\\.isSafeInteger\\(minor\\)/);
});

test("TPV widget exposes read-only capabilities until operational writer release gates pass", async () => {
    const html = await source("%23htmlTPV.txt");
    const permissions = await source("src/backend/tpv/tpvPermisos.web.js");
    const sales = await source("src/backend/tpv/tpvVentas.web.js");
    assert.match(permissions, /operationalWritesAvailable: false/);
    for (const capability of ["createSale", "openSession", "registerCashMovement", "registerPartialCount", "requestRefund", "closeSession", "issueTicketX", "issueTicketZ", "exportMovements", "exportAudit"]) {
        assert.match(permissions, new RegExp(capability + ": false"));
    }
    assert.doesNotMatch(permissions, /testRuntimeAvailable|testRuntimeMode/);
    assert.match(html, /!state\\.operationalWritesAvailable/);
    assert.match(html, /state\\.saleQuote\\.saleReady !== true/);
    assert.match(html, /result\\?\\.persisted !== true/);
    assert.match(html, /MODO CONSULTA/);
    assert.doesNotMatch(html, /testRuntimeAvailable|testReady|testCatalogReady|testPersisted|PRUEBA INTERNA|TPV_TEST_/);
    assert.match(sales, /TPV_OPERATIONAL_LEDGER_NOT_CONFIGURED/);
    assert.match(sales, /saleReady: saleReadinessBlockers\\.length === 0/);
    assert.doesNotMatch(html, /environment|previewOnly|syntheticOnly|realPaymentsEnabled|fiscalWritesEnabled|SANDBOX|PRODUCTION|LIVE/);
    assert.match(html, /call\\("SALE_VALIDATE"/);
    assert.match(html, /type: "MM_READY"/);
    assert.match(html, /data\\.type !== "MM_CONTEXT"/);
    assert.doesNotMatch(html, /fetch\\s*\\(|XMLHttpRequest|wix-data|suppressAuth/i);
    assert.doesNotMatch(html, /createPayment|capturePayment|processRefund/i);
});

test("TPV HTML component JavaScript parses without syntax errors", async () => {
    const html = await source("%23htmlTPV.txt");
    const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
    assert.ok(scripts.length > 0, "HTML component must contain a script block");
    for (const match of scripts) {
        assert.doesNotThrow(() => new Script(match[1], { filename: "#htmlTPV.txt" }));
    }
});

test("TPV bridge permits the context response and retries READY until a valid context arrives", async () => {
    const controller = await source("src/public/tpvPageController.js");
    const bridge = await source("src/public/widgetBridge.js");
    const html = await source("%23htmlTPV.txt");

    assert.match(controller, /allowedTypes:\s*\[MESSAGE_TYPES\.READY,\s*MESSAGE_TYPES\.CONTEXT,\s*\.\.\.REQUEST_TYPES\]/);
    assert.match(controller, /handshakeTimeoutMs:\s*65000/);
    assert.match(bridge, /allowedTypes: Array\.from\(allowedTypes\)/);
    assert.match(bridge, /receivedType: extracted\.type \?\? null,[\s\S]{0,180}allowedTypes: Array\.from\(allowedTypes\)/);
    assert.match(bridge, /function isAllowedType\(type\)[\s\S]*?allowedTypes\.has\(type\)/);
    assert.match(bridge, /send\(MESSAGE_TYPES\.CONTEXT, context, message\.messageId \|\| null\)/);
    assert.match(html, /const HANDSHAKE_RETRY_MS = 500/);
    assert.match(html, /const HANDSHAKE_MAX_ATTEMPTS = 120/);
    const retryIntervalMs = Number(html.match(/const HANDSHAKE_RETRY_MS = (\d+)/)?.[1]);
    const retryAttempts = Number(html.match(/const HANDSHAKE_MAX_ATTEMPTS = (\d+)/)?.[1]);
    const watchdogMs = Number(controller.match(/handshakeTimeoutMs: (\d+)/)?.[1]);
    assert.ok(retryIntervalMs > 0 && retryAttempts > 0 && watchdogMs > 0);
    assert.ok(retryIntervalMs * retryAttempts < watchdogMs,
        "iframe retries must continue until shortly before the Velo watchdog");
    assert.match(html, /function sendHandshake\(\)[\s\S]*?type: "MM_READY"/);
    assert.match(html, /data\.type !== "MM_CONTEXT"/);
    assert.match(html, /context\.data\?\.component === "htmlTPV"/);
    assert.match(html, /context\.data\?\.protocolVersion === BRIDGE_PROTOCOL_VERSION/);
    assert.match(html, /if \(connected\) \{\s*initializeWidgetAfterHandshake\(\)/);
    assert.match(html, /function initializeWidgetAfterHandshake\(\)[\s\S]*?loadCatalog\("SERVICES"\)/);
    assert.doesNotMatch(html, /function init\(\)[\s\S]*?loadCatalog\("SERVICES"\)/);
});

test("widget bridge reports the rejected type and active allowlist", () => {
    let receive;
    let reported;
    const widget = {
        onMessage(handler) {
            receive = handler;
            return () => { receive = null; };
        },
        postMessage() {},
    };
    const allowedTypes = [MESSAGE_TYPES.READY, MESSAGE_TYPES.CONTEXT, "CASHIER_STATE"];
    const bridge = createWidgetBridge(widget, {
        allowedTypes,
        allowedOrigin: "https://tpv.example.test",
        allowOpaqueOrigin: false,
        onError: (error) => { reported = error; },
    });

    receive({
        origin: "https://tpv.example.test",
        data: { type: "UNLISTED_REQUEST", version: 1, messageId: "rejected-12345678" },
    });

    assert.equal(reported?.code, "WIDGET_MESSAGE_TYPE_NOT_ALLOWED");
    assert.equal(reported?.detail?.receivedType, "UNLISTED_REQUEST");
    assert.deepEqual(reported?.detail?.allowedTypes, allowedTypes);
    bridge.destroy();
});


test("widget bridge rejects a non-allowlisted origin before parsing the message", () => {
    let receive;
    let reported;
    const widget = {
        onMessage(handler) { receive = handler; return () => { receive = null; }; },
        postMessage() {},
    };
    const bridge = createWidgetBridge(widget, {
        allowedTypes: [MESSAGE_TYPES.READY, MESSAGE_TYPES.CONTEXT],
        allowedOrigin: "https://tpv.example.test",
        allowOpaqueOrigin: false,
        onError: (error) => { reported = error; },
    });
    receive({
        origin: "https://evil.example.test",
        data: { type: MESSAGE_TYPES.READY, version: 1, messageId: "bad-origin-123456" },
    });
    assert.equal(reported?.code, "WIDGET_ORIGIN_REJECTED");
    assert.equal(bridge.handshakeCompleted, false);
    bridge.destroy();
});

test("widget bridge rejects opaque origins when strict TPV origin policy is active", () => {
    let receive;
    let reported;
    const widget = {
        onMessage(handler) { receive = handler; return () => { receive = null; }; },
        postMessage() {},
    };
    const bridge = createWidgetBridge(widget, {
        allowedTypes: [MESSAGE_TYPES.READY, MESSAGE_TYPES.CONTEXT],
        allowedOrigin: "https://tpv.example.test",
        allowOpaqueOrigin: false,
        onError: (error) => { reported = error; },
    });
    receive({
        origin: "null",
        data: { type: MESSAGE_TYPES.READY, version: 1, messageId: "opaque-origin-123456" },
    });
    assert.equal(reported?.code, "WIDGET_ORIGIN_OPAQUE_REJECTED");
    assert.equal(bridge.handshakeCompleted, false);
    bridge.destroy();
});

test("widget bridge publishes MM_CONTEXT after MM_READY when both directions are allowed", async () => {
    const sent = [];
    let receive;
    const widget = {
        onMessage(handler) {
            receive = handler;
            return () => { receive = null; };
        },
        postMessage(message) {
            sent.push(message);
        },
    };
    const bridge = createWidgetBridge(widget, {
        allowedTypes: [MESSAGE_TYPES.READY, MESSAGE_TYPES.CONTEXT],
        allowedOrigin: "https://tpv.example.test",
        allowOpaqueOrigin: false,
        handshakeTimeoutMs: 1000,
        onContextReady: async () => ({
            status: "SUCCESS",
            data: { component: "htmlTPV", protocolVersion: 1 },
            error: null,
        }),
    });

    receive({
        origin: "https://tpv.example.test",
        data: { type: MESSAGE_TYPES.READY, version: 1, messageId: "tpv-ready-12345678" },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const contextMessage = sent.find((message) => message.type === MESSAGE_TYPES.CONTEXT);
    assert.ok(contextMessage, "bridge must send MM_CONTEXT after READY");
    assert.equal(contextMessage.payload.status, "SUCCESS");
    assert.equal(contextMessage.messageId, "tpv-ready-12345678");
    bridge.destroy();
});
