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
    const html = await source("%23htmlTPV.txt");
    assert.match(html, /function resolveParentOrigin/);
    assert.match(html, /window\.parent\.postMessage\(message, PARENT_ORIGIN\)/);
    assert.doesNotMatch(html, /window\.parent\.postMessage\([^;]*,\s*["']\*["']\)/);
    assert.match(html, /"https:\/\/www\.marianmadrid\.es"/);
    assert.match(html, /"https:\/\/nachoortegazgz-marianmadrid\.editor\.wix\.com"/);
    assert.match(html, /return null;/);
    assert.doesNotMatch(html, /return PARENT_ORIGIN_ALLOWLIST\[0\]/);
    assert.match(page, /\$w\("#htmlTPV"\)/);
    assert.match(page, /initializeTpvPage\(widget\)/);
    assert.match(controller, /export function initializeTpvPage\(widget\)/);
    assert.match(controller, /createWidgetBridge/);
    assert.match(controller, /transport: "wix-html-component"/);
    assert.doesNotMatch(controller, /allowOpaqueOrigin: true/);
    assert.doesNotMatch(controller, /ALLOWED_ORIGIN\s*=\s*["']\*["']/);
    assert.match(bridge, /widgetElement\.onMessage/);
    assert.match(bridge, /widgetElement\.postMessage/);
});

test("TPV controller imports operational WebMethods and no longer imports the separate test runtime", async () => {
    const controller = await source("src/public/tpvPageController.js");
    const modules = {
        "src/backend/tpv/tpvCaja.web.js": ["obtenerEstadoCaja", "abrirSesionCaja", "registrarArqueoParcial", "cerrarSesionCaja"],
        "src/backend/tpv/tpvVentas.web.js": ["validarVentaBorrador", "registrarVenta"],
        "src/backend/tpv/tpvMovimientos.web.js": ["registrarMovimientoCaja", "exportarMovimientosCaja", "exportarAuditoriaTPV"],
        "src/backend/tpv/tpvCierres.web.js": ["obtenerResumenCaja", "generarTicketX", "generarCierreZ"],
        "src/backend/tpv/tpvExport.web.js": ["exportarMovimientos"],
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
    assert.doesNotMatch(controller, /tpvTestRuntime\.web|registrarVentaPrueba|testRuntimeAvailable/);
});

test("TPV controller dispatches widget requests to canonical backend methods", async () => {
    const controller = await source("src/public/tpvPageController.js");
    const html = await source("%23htmlTPV.txt");
    const types = [
        "CASHIER_STATE", "SESSION_OPEN", "CATALOG_SERVICES", "CATALOG_PRODUCTS", "CATALOG_VARIANTS",
        "CATALOG_STAFF", "CUSTOMERS_SEARCH", "SALE_REGISTER", "SALE_VALIDATE", "CASH_MOVEMENT",
        "PARTIAL_CASH_COUNT", "TICKET_X", "TICKET_Z", "SESSION_SUMMARY", "AUDIT_LIST",
        "CASH_MOVEMENTS_EXPORT", "AUDIT_EXPORT",
    ];
    for (const type of types) {
        assert.ok(controller.includes('"' + type + '"'), "controller must dispatch " + type);
        assert.ok(html.includes('"' + type + '"'), "HTML widget must send " + type);
        assert.ok(html.includes(type + "_RES") || html.includes('const responseType = type + "_RES"'),
            "HTML widget must receive " + type + "_RES");
    }
    assert.match(controller, /case "CASHIER_STATE":[\s\S]*?return obtenerEstadoCaja\(\)/);
    assert.match(controller, /case "SALE_VALIDATE":[\s\S]*?return validarVentaBorrador\(\{ lineas, pagos \}\)/);
    assert.match(controller, /case "SALE_REGISTER":[\s\S]*?return registrarVenta\(\{/);
    assert.match(controller, /case "AUDIT_LIST":[\s\S]*?return obtenerAuditoriaTPVLista\(/);
    assert.match(controller, /case "REFUND":[\s\S]*?throw new Error\("TPV_REFUND_DISABLED"\)/);
    assert.doesNotMatch(controller, /registrarDevolucion/);
    assert.match(controller, /reply\(message\.type \+ "_RES", result, message\)/);
    assert.match(controller, /idempotencyKey\(message, payload\)/);
    assert.match(controller, /saleUuidV4Key\(payload\.idempotencyKey\)/);
    assert.doesNotMatch(controller, /tpvTestRuntime\.web|registrarVentaPrueba/);
    assert.match(html, /state\.saleQuote\.saleReady !== true/);
    assert.match(controller, /!Number\.isSafeInteger\(minor\)/);
});

test("TPV widget exposes authorized physical and commercial capabilities independently of fiscal gates", async () => {
    const html = await source("%23htmlTPV.txt");
    const permissions = await source("src/backend/tpv/tpvPermisos.web.js");
    const sales = await source("src/backend/tpv/tpvVentas.web.js");
    assert.match(permissions, /operationalWritesAvailable: true/);
    assert.match(permissions, /createSale: true/);
    assert.match(permissions, /openSession: staff.rolWebsite === "ADMIN"/);
    assert.match(permissions, /registerCashMovement: true/);
    assert.match(permissions, /registerPartialCount: staff.rolWebsite === "ADMIN"/);
    assert.match(permissions, /requestRefund: false/);
    for (const capability of ["issueTicketZ", "exportAudit"]) assert.match(permissions, new RegExp(capability + ": false"));
    for (const capability of ["closeSession", "issueTicketX", "exportMovements"]) assert.match(permissions, new RegExp(capability + ": staff\\.rolWebsite === \"ADMIN\""));
    assert.doesNotMatch(permissions, /testRuntimeAvailable|testRuntimeMode/);
    assert.match(html, /!state\.operationalWritesAvailable/);
    assert.match(html, /id="refund"[^>]*disabled/);
    assert.match(html, /const PERMANENTLY_DISABLED = new Set\(\["refund"\]\)/);
    assert.doesNotMatch(html, /\$\("refund"\)\.onclick|keyedAction\("REFUND"/);
    assert.match(html, /state\.saleQuote\.saleReady !== true/);
    assert.match(html, /result\?\.persisted !== true/);
    assert.match(html, /MODO CONSULTA/);
    assert.doesNotMatch(html, /testRuntimeAvailable|testReady|testCatalogReady|testPersisted|PRUEBA INTERNA|TPV_TEST_/);
    assert.match(sales, /PENDING_PAYMENT/);
    assert.match(sales, /saleReady: saleReadinessBlockers\.length === 0/);
    assert.doesNotMatch(html, /environment|previewOnly|syntheticOnly|realPaymentsEnabled|fiscalWritesEnabled|SANDBOX|PRODUCTION|LIVE/);
    assert.match(html, /call\("SALE_VALIDATE"/);
    assert.match(html, /type: "MM_READY"/);
    assert.match(html, /data\.type !== "MM_CONTEXT"/);
    assert.doesNotMatch(html, /fetch\s*\(|XMLHttpRequest|wix-data|suppressAuth/i);
    assert.doesNotMatch(html, /createPayment|capturePayment|processRefund/i);
});


test("TPV reads CajaActual on startup and refreshes the projection only after completed operations", async () => {
    const html = await source("%23htmlTPV.txt");
    const repository = await source("src/backend/tpv/tpvRepository.js");
    const caja = await source("src/backend/tpv/tpvCaja.web.js");
    assert.match(html, /function initializeWidgetAfterHandshake\(\)[\s\S]*?refreshCashState\(\)\.catch/);
    assert.match(html, /async function runOperation\(fn\)[\s\S]*?const result = await fn\(\);[\s\S]*?await refreshCashState\(\)/);
    assert.doesNotMatch(html, /setInterval\s*\(/);
    assert.match(html, /id="refreshCatalog"/);
    assert.match(html, /\$\("refreshCatalog"\)\.onclick = \(\) => loadCatalog/);
    assert.match(repository, /export async function initializeTpvCaja\(\)[\s\S]*?_getCajaActual\(\)/);
    assert.match(repository, /saved = await insertItem\(BUSINESS_COLLECTIONS\.MOVIMIENTOS_CAJA, ledgerItem\)/);
    assert.match(repository, /await _projectPersistedTpvEvent\([\s\S]*?collection, record, item\._id, item\.hash, key, false/);
    assert.match(repository, /await updateItem\(BUSINESS_COLLECTIONS\.CAJA_ACTUAL, next\)/);
    assert.match(caja, /const session = await latestTpvSession\(\)/);
    assert.match(caja, /await buildTpvSessionSummary\(session\)/);
});

test("TPV open session revalidates CajaActual preview and generates an opening receipt", async () => {
    const html = await source("%23htmlTPV.txt");
    const caja = await source("src/backend/tpv/tpvCaja.web.js");
    const cierres = await source("src/backend/tpv/tpvCierres.web.js");

    assert.match(html, /nextSessionPreview/);
    assert.match(html, /expectedSessionId/);
    assert.match(html, /latest\?\.canOpenSession !== true/);
    assert.match(html, /latest\?\.authenticatedOperatorId !== authenticatedOperatorId/);
    assert.match(html, /const receipt = opened\.openingReceipt/);
    assert.match(html, /openingReceiptHtml\(receipt\)/);
    assert.match(html, /receipt\.ticketType !== "APERTURA_CAJA"/);
    assert.match(html, /Cerrar y continuar/);
    assert.match(html, /No repitas la apertura/);
    assert.match(caja, /input\.expectedSessionId/);
    assert.match(caja, /TPV_SESSION_PREVIEW_STALE/);
    assert.match(caja, /movementType: "APERTURA"/);
    assert.match(caja, /openingReceipt: \{/);
    assert.match(cierres, /ticketType: "CONTROL_PARCIAL_X"/);
    assert.match(cierres, /issuedByMemberId: operator\.operatorId/);
    assert.match(cierres, /readOnly: true,[\s\S]*?closesSession: false/);
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
    assert.match(controller, /receivedType: typeof detail\.receivedType/);
    assert.match(controller, /controllerBuild: CONTROLLER_BUILD/);
    assert.match(controller, /TPV_BRIDGE_DIAGNOSTICS_2026-11-27/);
    assert.ok(controller.includes("onError: (error, reportedDetail)"));
    assert.ok(controller.includes('reportedDetail && typeof reportedDetail === "object"'));
    assert.match(controller, /attemptedType: typeof detail\.attemptedType/);
    assert.match(controller, /allowedTypes,/);
    assert.match(controller, /Widget bridge initialized/);
    assert.ok(controller.includes("allowedTypes: bridge.allowedTypes"));
    assert.match(controller, /causeCode: typeof detail\.causeCode/);
    assert.match(controller, /handshakeTimeoutMs:\s*65000/);
    assert.match(bridge, /allowedTypes: Array\.from\(allowedTypes\)/);
    assert.match(bridge, /receivedType: extracted\.type \?\? null,[\s\S]{0,180}allowedTypes: Array\.from\(allowedTypes\)/);
    assert.match(bridge, /function isAllowedType\(type\)[\s\S]*?allowedTypes\.has\(type\)/);
    assert.match(bridge, /send\(MESSAGE_TYPES\.CONTEXT, contextPayload, message\.messageId \|\| null\)/);
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
        data: { type: MESSAGE_TYPES.READY, nonce: "tpv-handshake-nonce-20261128", version: 1, messageId: "bad-origin-123456" },
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
        data: { type: MESSAGE_TYPES.READY, nonce: "tpv-handshake-nonce-20261128", version: 1, messageId: "opaque-origin-123456" },
    });
    assert.equal(reported?.code, "WIDGET_ORIGIN_OPAQUE_REJECTED");
    assert.equal(bridge.handshakeCompleted, false);
    bridge.destroy();
});

test("TPV bridge trusts the Wix HtmlComponent transport boundary while preserving message allowlists", () => {
    let receive;
    let reported = [];
    const widget = {
        onMessage(handler) { receive = handler; return () => { receive = null; }; },
        postMessage() {},
    };
    const bridge = createWidgetBridge(widget, {
        allowedTypes: [MESSAGE_TYPES.READY, MESSAGE_TYPES.CONTEXT],
        allowedOrigin: "https://tpv.example.test",
        transport: "wix-html-component",
        onError: (error) => { reported.push(error.code); },
    });

    receive({ origin: "https://unrelated.example.test", data: { type: MESSAGE_TYPES.READY, nonce: "tpv-handshake-nonce-20261128", version: 1, messageId: "tpv-opaque-ready-123" } });
    assert.equal(bridge.handshakeCompleted, true);

    receive({ origin: "null", data: { type: "UNLISTED_REQUEST", version: 1 } });
    assert.ok(reported.includes("WIDGET_MESSAGE_TYPE_NOT_ALLOWED"));
    assert.equal(bridge.handshakeCompleted, true);
    bridge.destroy();
});

// The Wix HtmlComponent wrapper is the trust boundary; nonce binds the context response to this handshake.
test("Wix HtmlComponent requires a nonce before accepting MM_READY", () => {
    let receive;
    const errors = [];
    const widget = {
        onMessage(handler) { receive = handler; return () => { receive = null; }; },
        postMessage() {},
    };
    const bridge = createWidgetBridge(widget, {
        allowedTypes: [MESSAGE_TYPES.READY, MESSAGE_TYPES.CONTEXT],
        transport: "wix-html-component",
        onError: (error) => errors.push(error.code),
    });
    receive({
        origin: "null",
        data: { type: MESSAGE_TYPES.READY, version: 1, messageId: "tpv-ready-without-nonce" },
    });
    assert.ok(errors.includes("WIDGET_HANDSHAKE_NONCE_REQUIRED"));
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
        transport: "wix-html-component",
        handshakeTimeoutMs: 1000,
        onContextReady: async () => ({
            status: "SUCCESS",
            data: { component: "htmlTPV", protocolVersion: 1 },
            error: null,
        }),
    });

    receive({
        origin: "null",
        data: { type: MESSAGE_TYPES.READY, nonce: "tpv-handshake-nonce-20261128", version: 1, messageId: "tpv-ready-12345678" },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const contextMessage = sent.find((message) => message.type === MESSAGE_TYPES.CONTEXT);
    assert.ok(contextMessage, "bridge must send MM_CONTEXT after READY");
    assert.equal(contextMessage.payload.status, "SUCCESS");
    assert.equal(contextMessage.payload.nonce, "tpv-handshake-nonce-20261128");
    assert.equal(contextMessage.messageId, "tpv-ready-12345678");
    bridge.destroy();
});


test("TPV widget buttons are capability-aligned with authenticated backend operations and native collections", async () => {
    const [html, controller, caja, cierres, permissions, catalog, config, repository] = await Promise.all([
        source("%23htmlTPV.txt"),
        source("src/public/tpvPageController.js"),
        source("src/backend/tpv/tpvCaja.web.js"),
        source("src/backend/tpv/tpvCierres.web.js"),
        source("src/backend/tpv/tpvPermisos.web.js"),
        source("src/backend/tpv/tpvCatalogo.web.js"),
        source("src/backend/internalConfig.js"),
        source("src/backend/tpv/tpvRepository.js"),
    ]);

    // Opening is a fresh read of CajaActual. The server issues the date/session
    // preview and revalidates it before creating the canonical session projection.
    assert.match(html, /Apertura de caja: sesión, movimiento, recibo y continuidad/);
    assert.match(html, /Usuario autenticado: /);
    assert.match(html, /Operador de sesión: /);
    assert.match(html, /call\("CASHIER_STATE", \{\}, "CASHIER_STATE_RES"\)/);
    assert.match(html, /expectedSessionId,/);
    assert.match(controller, /TPV_SESSION_PREVIEW_REQUIRED/);
    assert.match(controller, /expectedSessionId,/);
    assert.match(caja, /const cajaActual = await readTpvCajaSnapshot\(\)/);
    assert.match(caja, /nextSessionPreview/);
    assert.match(caja, /TPV_SESSION_PREVIEW_REQUIRED/);
    assert.match(caja, /TPV_SESSION_PREVIEW_STALE/);
    assert.match(repository, /export async function readTpvCajaSnapshot\(\)/);
    assert.match(repository, /projectionStatus: session \? "CANONICAL" : \(canonicalBootstrap \? "CANONICAL_BOOTSTRAP" : "LEGACY_UNVERIFIED"\)/);
    assert.match(repository, /canStartSession: canonicalBootstrap \|\| legacyOpenable/);
    assert.match(caja, /cajaActual\.canStartSession === true/);
    assert.match(repository, /function _isLegacyUnverifiedProjection\(caja\)/);
    assert.match(repository, /function _assertTpvCajaLockable\(caja, allowLegacyProjection = false\)/);
    assert.match(repository, /allowLegacyProjection = false/);
    assert.match(caja, /withTpvSessionLock\(sessionId, traceId, async \(\) => \{[\s\S]*?\{ allowLegacyProjection: true \}\)/);
    assert.match(repository, /monetarySnapshotReused: false/);
    assert.match(repository, /posPaymentStatus: null/);
    assert.match(repository, /transactionId: null/);
    assert.match(repository, /ticketTotal: null/);

    // The operator is a Wix-authenticated member; permissions are server-owned.
    assert.match(permissions, /readCatalog: true/);
    assert.match(permissions, /searchCustomers: true/);
    assert.match(permissions, /readCashSummary: true/);
    assert.match(permissions, /readAudit: staff\.rolWebsite !== "ESTILISTA"/);
    assert.match(permissions, /acceptPayment: false/);
    assert.match(permissions, /printReceipt: false/);
    assert.match(html, /SESSION_REQUIRED_CAPABILITIES/);
    assert.match(html, /printLast: "printReceipt"/);
    assert.match(html, /ticketX: "issueTicketX"/);
    assert.match(html, /cashSummary: "readCashSummary"/);
    assert.match(html, /audit: "readAudit"/);

    // Ticket X is a non-closing snapshot, with session, date and operator data;
    // its audit evidence is stored in ControlOperativo, not a fictional ledger.
    assert.match(cierres, /ticketType: "CONTROL_PARCIAL_X"/);
    assert.match(cierres, /sessionDate,/);
    assert.match(cierres, /openedAt: openedAt\.toISOString\(\)/);
    assert.match(cierres, /issuedByMemberId: operator\.operatorId/);
    assert.match(cierres, /readOnly: true, closesSession: false/);
    assert.match(cierres, /action: "TICKET_X_GENERATED"/);
    assert.match(html, /ticketXReceiptHtml/);
    assert.match(html, /Imprimir \/ Guardar PDF/);
    assert.match(html, /INFORMATIVO · NO CIERRA LA CAJA/);

    // Native source ownership: Bookings for services/staff, Stores Catalog V3
    // for products, native Contacts for customer search; custom ledgers for TPV.
    assert.match(catalog, /from "@wix\/bookings"/);
    assert.match(catalog, /from "@wix\/stores"/);
    assert.match(config, /CAJA_ACTUAL: "CajaActual"/);
    assert.match(config, /MOVIMIENTOS_CAJA: "MovimientosCaja"/);
    assert.match(config, /TRANSACCIONES_TPV: "TransaccionesTPV"/);
    assert.match(config, /CONTROL_OPERATIVO: "ControlOperativo"/);
    assert.match(config, /HISTORICO_CIERRES_Z: "HistoricoCierresZ"/);
    assert.match(repository, /BUSINESS_COLLECTIONS\.CAJA_ACTUAL/);
    assert.match(repository, /BUSINESS_COLLECTIONS\.MOVIMIENTOS_CAJA/);
    assert.match(repository, /BUSINESS_COLLECTIONS\.TRANSACCIONES_TPV/);
    assert.match(repository, /OPERATIONAL_COLLECTIONS\.CONTROL_OPERATIVO/);

    // No apparent payment controls can be mistaken for real or persisted payments.
    assert.match(html, /Efectivo \(no habilitado\)/);
    assert.match(html, /Tarjeta \(no habilitada\)/);
    assert.match(html, /Cobros deshabilitados/);
    assert.doesNotMatch(html, /window\.print\(\);[\s\S]{0,150}state\.lastSale/);
});
