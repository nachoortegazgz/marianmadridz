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
    assert.match(html, /windowsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).parentsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).postMessagesend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(message, PARENT_ORIGINsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
    assert.doesNotMatch(html, /windowsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).parentsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).postMessagesend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)([^;]*,send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)s*["']send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)*["']send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
    assert.match(html, /"https:send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)/send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)/wwwsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).marianmadridsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).es"/);
    assert.match(html, /"https:send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)/send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)/nachoortegazgz-marianmadridsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).editorsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).wixsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).com"/);
    assert.match(html, /return null;/);
    assert.doesNotMatch(html, /return PARENT_ORIGIN_ALLOWLISTsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)[0send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)]/);
    assert.match(page, /send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)$wsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)("#htmlTPV"send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
    assert.match(page, /initializeTpvPagesend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(widgetsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
    assert.match(controller, /export function initializeTpvPagesend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(widgetsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
    assert.match(controller, /createWidgetBridge/);
    assert.match(controller, /transport: "wix-html-component"/);
    assert.doesNotMatch(controller, /allowOpaqueOrigin: true/);
    assert.doesNotMatch(controller, /ALLOWED_ORIGINsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)s*=send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)s*["']send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)*["']/);
    assert.match(bridge, /widgetElementsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).onMessage/);
    assert.match(bridge, /widgetElementsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).postMessage/);
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
            assert.match(content, new RegExp("export const " + name + " = webMethodsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)("), path + " must export " + name);
            assert.ok(controller.includes(name), "controller must consume " + name);
        }
    }
    assert.doesNotMatch(controller, /tpvTestRuntimesend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).web|registrarVentaPrueba|testRuntimeAvailable/);
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
    assert.match(controller, /case "CASHIER_STATE":[send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)ssend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)S]*?return obtenerEstadoCajasend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
    assert.match(controller, /case "SALE_VALIDATE":[send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)ssend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)S]*?return validarVentaBorradorsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null){ lineas, pagos send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)}send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
    assert.match(controller, /case "SALE_REGISTER":[send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)ssend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)S]*?return registrarVentasend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null){/);
    assert.match(controller, /case "AUDIT_LIST":[send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)ssend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)S]*?return obtenerAuditoriaTPVListasend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(/);
    assert.match(controller, /case "REFUND":[send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)ssend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)S]*?throw new Errorsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)("TPV_REFUND_DISABLED"send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
    assert.doesNotMatch(controller, /registrarDevolucion/);
    assert.match(controller, /replysend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(messagesend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).type send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)+ "_RES", result, messagesend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
    assert.match(controller, /idempotencyKeysend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(message, payloadsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
    assert.match(controller, /saleUuidV4Keysend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(payloadsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).idempotencyKeysend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
    assert.doesNotMatch(controller, /tpvTestRuntimesend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).web|registrarVentaPrueba/);
    assert.match(html, /statesend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).saleQuotesend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).saleReady !== true/);
    assert.match(controller, /!Numbersend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).isSafeIntegersend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(minorsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
});

test("TPV widget exposes authorized physical and commercial capabilities independently of fiscal gates", async () => {
    const html = await source("%23htmlTPV.txt");
    const permissions = await source("src/backend/tpv/tpvPermisos.web.js");
    const sales = await source("src/backend/tpv/tpvVentas.web.js");
    assert.match(permissions, /operationalWritesAvailable: true/);
    assert.match(permissions, /createSale: true/);
    assert.match(permissions, /openSession: staff.rolWebsite === "ADMIN"/);
    assert.match(permissions, /registerCashMovement: staff.rolWebsite === "ADMIN"/);
    assert.match(permissions, /registerPartialCount: staff.rolWebsite === "ADMIN"/);
    assert.match(permissions, /requestRefund: false/);
    for (const capability of ["issueTicketZ", "exportAudit"]) assert.match(permissions, new RegExp(capability + ": false"));
    for (const capability of ["closeSession", "issueTicketX", "exportMovements"]) assert.match(permissions, new RegExp(capability + ": staffsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).rolWebsite === send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)"ADMINsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)""));
    assert.doesNotMatch(permissions, /testRuntimeAvailable|testRuntimeMode/);
    assert.match(html, /!statesend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).operationalWritesAvailable/);
    assert.match(html, /id="refund"[^>]*disabled/);
    assert.match(html, /const PERMANENTLY_DISABLED = new Setsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)["refund"send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)]send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
    assert.doesNotMatch(html, /send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)$send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)("refund"send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).onclick|keyedActionsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)("REFUND"/);
    assert.match(html, /statesend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).saleQuotesend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).saleReady !== true/);
    assert.match(html, /resultsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)?send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).persisted !== true/);
    assert.match(html, /MODO CONSULTA/);
    assert.doesNotMatch(html, /testRuntimeAvailable|testReady|testCatalogReady|testPersisted|PRUEBA INTERNA|TPV_TEST_/);
    assert.match(sales, /PENDING_PAYMENT/);
    assert.match(sales, /saleReady: saleReadinessBlockerssend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).length === 0/);
    assert.doesNotMatch(html, /environment|previewOnly|syntheticOnly|realPaymentsEnabled|fiscalWritesEnabled|SANDBOX|PRODUCTION|LIVE/);
    assert.match(html, /callsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)("SALE_VALIDATE"/);
    assert.match(html, /type: "MM_READY"/);
    assert.match(html, /datasend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).type !== "MM_CONTEXT"/);
    assert.doesNotMatch(html, /fetchsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)s*send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(|XMLHttpRequest|wix-data|suppressAuth/i);
    assert.doesNotMatch(html, /createPayment|capturePayment|processRefund/i);
});


test("TPV reads CajaActual on startup and refreshes the projection only after completed operations", async () => {
    const html = await source("%23htmlTPV.txt");
    const repository = await source("src/backend/tpv/tpvRepository.js");
    const caja = await source("src/backend/tpv/tpvCaja.web.js");
    assert.match(html, /function initializeWidgetAfterHandshakesend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))[send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)ssend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)S]*?refreshCashStatesend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).catch/);
    assert.match(html, /async function runOperationsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(fnsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))[send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)ssend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)S]*?const result = await fnsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null));[send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)ssend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)S]*?await refreshCashStatesend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
    assert.doesNotMatch(html, /setIntervalsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)s*send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(/);
    assert.match(html, /id="refreshCatalog"/);
    assert.match(html, /send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)$send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)("refreshCatalog"send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).onclick = send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)) => loadCatalog/);
    assert.match(repository, /export async function initializeTpvCajasend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))[send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)ssend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)S]*?_getCajaActualsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
    assert.match(repository, /saved = await insertItemsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(BUSINESS_COLLECTIONSsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).MOVIMIENTOS_CAJA, ledgerItemsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
    assert.match(repository, /await _projectPersistedTpvEventsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)([send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)ssend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)S]*?collection, record, itemsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)._id, itemsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).hash, key, false/);
    assert.match(repository, /await updateItemsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(BUSINESS_COLLECTIONSsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).CAJA_ACTUAL, nextsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
    assert.match(caja, /const session = await latestTpvSessionsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
    assert.match(caja, /await buildTpvSessionSummarysend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(sessionsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
});

test("TPV open session revalidates CajaActual preview and generates an opening receipt", async () => {
    const html = await source("%23htmlTPV.txt");
    const caja = await source("src/backend/tpv/tpvCaja.web.js");
    const cierres = await source("src/backend/tpv/tpvCierres.web.js");

    assert.match(html, /nextSessionPreview/);
    assert.match(html, /expectedSessionId/);
    assert.match(html, /latestsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)?send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).canOpenSession !== true/);
    assert.match(html, /latestsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)?send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).authenticatedOperatorId !== authenticatedOperatorId/);
    assert.match(html, /const receipt = openedsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).openingReceipt/);
    assert.match(html, /openingReceiptHtmlsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(receiptsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
    assert.match(html, /receiptsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).ticketType !== "APERTURA_CAJA"/);
    assert.match(html, /Cerrar y continuar/);
    assert.match(html, /No repitas la apertura/);
    assert.match(caja, /inputsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).expectedSessionId/);
    assert.match(caja, /TPV_SESSION_PREVIEW_STALE/);
    assert.match(caja, /movementType: "APERTURA"/);
    assert.match(caja, /openingReceipt: send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null){/);
    assert.match(cierres, /ticketType: "CONTROL_PARCIAL_X"/);
    assert.match(cierres, /issuedByMemberId: operatorsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).operatorId/);
    assert.match(cierres, /readOnly: true,[send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)ssend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)S]*?closesSession: false/);
});

test("TPV HTML component JavaScript parses without syntax errors", async () => {
    const html = await source("%23htmlTPV.txt");
    const scripts = [...html.matchAll(/<scriptsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)b[^>]*>([send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)ssend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)S]*?)<send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)/script>/gi)];
    assert.ok(scripts.length > 0, "HTML component must contain a script block");
    for (const match of scripts) {
        assert.doesNotThrow(() => new Script(match[1], { filename: "#htmlTPV.txt" }));
    }
});

test("TPV bridge permits the context response and retries READY until a valid context arrives", async () => {
    const controller = await source("src/public/tpvPageController.js");
    const bridge = await source("src/public/widgetBridge.js");
    const html = await source("%23htmlTPV.txt");

    assert.match(controller, /allowedTypes:send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)s*send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)[MESSAGE_TYPESsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).READY,send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)s*MESSAGE_TYPESsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).CONTEXT,send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)s*send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).REQUEST_TYPESsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)]/);
    assert.match(controller, /receivedType: typeof detailsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).receivedType/);
    assert.match(controller, /controllerBuild: CONTROLLER_BUILD/);
    assert.match(controller, /TPV_BRIDGE_DIAGNOSTICS_2026-11-27/);
    assert.ok(controller.includes("onError: (error, reportedDetail)"));
    assert.ok(controller.includes('reportedDetail && typeof reportedDetail === "object"'));
    assert.match(controller, /attemptedType: typeof detailsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).attemptedType/);
    assert.match(controller, /allowedTypes,/);
    assert.match(controller, /Widget bridge initialized/);
    assert.ok(controller.includes("allowedTypes: bridge.allowedTypes"));
    assert.match(controller, /causeCode: typeof detailsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).causeCode/);
    assert.match(controller, /handshakeTimeoutMs:send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)s*65000/);
    assert.match(bridge, /allowedTypes: Arraysend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).fromsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(allowedTypessend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
    assert.match(bridge, /receivedType: extractedsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).type send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)?send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)? null,[send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)ssend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)S]{0,180}allowedTypes: Arraysend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).fromsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(allowedTypessend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
    assert.match(bridge, /function isAllowedTypesend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(typesend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))[send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)ssend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)S]*?allowedTypessend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).hassend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(typesend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
    assert.match(bridge, /send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)|send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)|send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)/);
    assert.match(html, /const HANDSHAKE_RETRY_MS = 500/);
    assert.match(html, /const HANDSHAKE_MAX_ATTEMPTS = 120/);
    const retryIntervalMs = Number(html.match(/const HANDSHAKE_RETRY_MS = (send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)d+)/)?.[1]);
    const retryAttempts = Number(html.match(/const HANDSHAKE_MAX_ATTEMPTS = (send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)d+)/)?.[1]);
    const watchdogMs = Number(controller.match(/handshakeTimeoutMs: (send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)d+)/)?.[1]);
    assert.ok(retryIntervalMs > 0 && retryAttempts > 0 && watchdogMs > 0);
    assert.ok(retryIntervalMs * retryAttempts < watchdogMs,
        "iframe retries must continue until shortly before the Velo watchdog");
    assert.match(html, /function sendHandshakesend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))[send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)ssend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)S]*?type: "MM_READY"/);
    assert.match(html, /datasend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).type !== "MM_CONTEXT"/);
    assert.match(html, /contextsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).datasend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)?send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).component === "htmlTPV"/);
    assert.match(html, /contextsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).datasend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)?send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).protocolVersion === BRIDGE_PROTOCOL_VERSION/);
    assert.match(html, /if send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(connectedsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)) send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null){send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)s*initializeWidgetAfterHandshakesend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
    assert.match(html, /function initializeWidgetAfterHandshakesend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))[send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)ssend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)S]*?loadCatalogsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)("SERVICES"send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
    assert.doesNotMatch(html, /function initsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))[send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)ssend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)S]*?loadCatalogsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)("SERVICES"send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
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
        data: { type: MESSAGE_TYPES.READY, nonce: "tpv-handshake-nonce-20261128", version: 1, messageId: "tpv-ready-without-nonce" },
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
    assert.match(html, /callsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)("CASHIER_STATE", send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null){send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)}, "CASHIER_STATE_RES"send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
    assert.match(html, /expectedSessionId,/);
    assert.match(controller, /TPV_SESSION_PREVIEW_REQUIRED/);
    assert.match(controller, /expectedSessionId,/);
    assert.match(caja, /const cajaActual = await readTpvCajaSnapshotsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
    assert.match(caja, /nextSessionPreview/);
    assert.match(caja, /TPV_SESSION_PREVIEW_REQUIRED/);
    assert.match(caja, /TPV_SESSION_PREVIEW_STALE/);
    assert.match(repository, /export async function readTpvCajaSnapshotsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
    assert.match(repository, /projectionStatus: session send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)? "CANONICAL" : send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(canonicalBootstrap send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)? "CANONICAL_BOOTSTRAP" : "LEGACY_UNVERIFIED"send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
    assert.match(repository, /canStartSession: canonicalBootstrap send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)|send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)| legacyOpenable/);
    assert.match(caja, /cajaActualsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).canStartSession === true/);
    assert.match(repository, /function _isLegacyUnverifiedProjectionsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(cajasend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
    assert.match(repository, /function _assertTpvCajaLockablesend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(caja, allowLegacyProjection = falsesend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
    assert.match(repository, /allowLegacyProjection = false/);
    assert.match(caja, /withTpvSessionLocksend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(sessionId, traceId, async send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)) => send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null){[send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)ssend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)S]*?send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null){ allowLegacyProjection: true send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)}send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
    assert.match(repository, /monetarySnapshotReused: false/);
    assert.match(repository, /posPaymentStatus: null/);
    assert.match(repository, /transactionId: null/);
    assert.match(repository, /ticketTotal: null/);

    // The operator is a Wix-authenticated member; permissions are server-owned.
    assert.match(permissions, /readCatalog: true/);
    assert.match(permissions, /searchCustomers: true/);
    assert.match(permissions, /readCashSummary: true/);
    assert.match(permissions, /readAudit: true/);
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
    assert.match(cierres, /openedAt: openedAtsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).toISOStringsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
    assert.match(cierres, /issuedByMemberId: operatorsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).operatorId/);
    assert.match(cierres, /readOnly: true, closesSession: false/);
    assert.match(cierres, /action: "TICKET_X_GENERATED"/);
    assert.match(html, /ticketXReceiptHtml/);
    assert.match(html, /Imprimir send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)/ Guardar PDF/);
    assert.match(html, /INFORMATIVO · NO CIERRA LA CAJA/);

    // Native source ownership: Bookings for services/staff, Stores Catalog V3
    // for products, native Contacts for customer search; custom ledgers for TPV.
    assert.match(catalog, /from "@wixsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)/bookings"/);
    assert.match(catalog, /from "@wixsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)/stores"/);
    assert.match(config, /CAJA_ACTUAL: "CajaActual"/);
    assert.match(config, /MOVIMIENTOS_CAJA: "MovimientosCaja"/);
    assert.match(config, /TRANSACCIONES_TPV: "TransaccionesTPV"/);
    assert.match(config, /CONTROL_OPERATIVO: "ControlOperativo"/);
    assert.match(config, /HISTORICO_CIERRES_Z: "HistoricoCierresZ"/);
    assert.match(repository, /BUSINESS_COLLECTIONSsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).CAJA_ACTUAL/);
    assert.match(repository, /BUSINESS_COLLECTIONSsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).MOVIMIENTOS_CAJA/);
    assert.match(repository, /BUSINESS_COLLECTIONSsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).TRANSACCIONES_TPV/);
    assert.match(repository, /OPERATIONAL_COLLECTIONSsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).CONTROL_OPERATIVO/);

    // No apparent payment controls can be mistaken for real or persisted payments.
    assert.match(html, /Efectivo send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(no habilitadosend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
    assert.match(html, /Tarjeta send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(no habilitadasend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null))/);
    assert.match(html, /Cobros deshabilitados/);
    assert.doesNotMatch(html, /windowsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).printsend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)(send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null));[send(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)ssend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null)S]{0,150}statesend(MESSAGE_TYPES.CONTEXT, contextPayload, message.messageId || null).lastSale/);
});
