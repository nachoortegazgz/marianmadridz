import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const previewUrl = process.env.WIX_PREVIEW_URL;
const statePath = process.env.WIX_STORAGE_STATE_PATH;
const reportPath = process.env.WIX_TPV_E2E_REPORT;
const moduleRoot = process.env.PLAYWRIGHT_MODULE_ROOT;
const tpvPagePath = process.env.WIX_TPV_PAGE_PATH || "/tpv";
const executionMode = process.env.WIX_TPV_E2E_MODE || "read-only";
const writeAuthorization = process.env.WIX_TPV_E2E_ALLOW_WRITES === "YES";
const dataIsolationConfirmed = process.env.WIX_TPV_DATA_ISOLATION_CONFIRMED === "YES";

assert.ok(previewUrl && statePath && reportPath && moduleRoot, "Missing Preview E2E configuration");
assert.ok(["read-only", "e2e"].includes(executionMode), "WIX_TPV_E2E_MODE must be read-only or e2e");
if (executionMode === "e2e") {
    assert.ok(writeAuthorization, "E2E writes require WIX_TPV_E2E_ALLOW_WRITES=YES");
    assert.ok(dataIsolationConfirmed, "E2E writes require WIX_TPV_DATA_ISOLATION_CONFIRMED=YES after verifying CMS isolation");
}
assert.ok(tpvPagePath.startsWith("/") && !tpvPagePath.startsWith("//"), "TPV page path must be site-relative");

const storageState = JSON.parse(await readFile(statePath, "utf8"));
assert.ok(Array.isArray(storageState.cookies) && Array.isArray(storageState.origins), "Invalid Playwright storageState");

const require = createRequire(moduleRoot + "/@playwright/test/index.js");
const { chromium } = require("playwright");

const wixHost = (hostname) =>
    hostname === "wix.to" ||
    hostname === "wix.com" ||
    hostname.endsWith(".wix.com") ||
    hostname === "wixsite.com" ||
    hostname.endsWith(".wixsite.com") ||
    hostname === "marianmadrid.es" ||
    hostname === "www.marianmadrid.es";

const allowedParentOrigins = [
    "https://www.marianmadrid.es",
    "https://marianmadrid.es",
    "https://nachoortegazgz-marianmadrid.editor.wix.com",
];

const report = {
    result: "FAIL",
    environment: "WIX_EDITOR_PREVIEW",
    dataEnvironment: "WIX_PREVIEW_SITE_DATA",
    executionMode,
    readOnly: executionMode === "read-only",
    writeAuthorizationGate: executionMode === "e2e" && writeAuthorization && dataIsolationConfirmed,
    syntheticByDate: Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric" }).format(new Date())) < 2027,
    previewHttpStatus: null,
    tpvPageHttpStatus: null,
    previewHost: null,
    tpvPageHost: null,
    authenticatedBrowser: false,
    operationalWritesAuthorized: false,
    businessWebMethodsInvoked: 0,
    paymentsInvoked: false,
    refundsInvoked: false,
    ticketZInvoked: false,
    hardwareInvoked: false,
    sessionId: null,
    operations: [],
    postChecks: null,
    timestamp: new Date().toISOString(),
};

let browser;
let page;
let frame;
let phase = "bootstrap";

async function persistReport() {
    report.timestamp = new Date().toISOString();
    await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
}

function redact(value) {
    if (Array.isArray(value)) return value.map(redact);
    if (!value || typeof value !== "object") return value;
    const result = {};
    for (const [key, nested] of Object.entries(value)) {
        if (/^(operatorId|actorId|authenticatedOperatorId|authenticatedActorId|authenticatedDisplayName|operatorDisplayName|operatorResourceId|memberId|email|token|cookie|secret)$/i.test(key)) continue;
        result[key] = redact(nested);
    }
    return result;
}

function recordOperation(name, envelope, messageId = null) {
    report.businessWebMethodsInvoked += 1;
    const operation = {
        name,
        transport: "Velo webMethod via Wix HTML Component bridge",
        httpStatus: null,
        messageId,
        applicationStatus: envelope?.status || "UNKNOWN",
        traceId: envelope?.traceId || null,
        response: redact(envelope),
    };
    report.operations.push(operation);
    return persistReport();
}

function assertSuccess(envelope, name) {
    if (envelope?.status !== "SUCCESS") {
        const code = envelope?.error?.code || envelope?.reason || "TPV_WEBMETHOD_FAILED";
        const error = new Error(name + " failed: " + code);
        error.code = code;
        error.response = redact(envelope);
        throw error;
    }
    return envelope.data ?? envelope;
}

function assertPending(envelope, name) {
    if (envelope?.status !== "PENDING" || envelope?.persisted !== true ||
        envelope?.orderPersisted !== true || !envelope?.orderId ||
        !envelope?.idempotencyKey || !Number.isFinite(Number(envelope?.totalVenta))) {
        const code = envelope?.error?.code || envelope?.reason || "TPV_PENDING_SALE_NOT_PERSISTED";
        const error = new Error(name + " did not persist a pending sale: " + code);
        error.code = code;
        error.response = redact(envelope);
        throw error;
    }
    return envelope;
}

async function waitForTpvFrame(targetPage, timeoutMs = 90000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        for (const candidate of targetPage.frames()) {
            try {
                if (await candidate.locator("#connLabel").count()) return candidate;
            } catch (_) {
                // A frame can be replaced while Wix hydrates the HTML Component.
            }
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw Object.assign(new Error("TPV_WIDGET_FRAME_NOT_FOUND"), { code: "TPV_WIDGET_FRAME_NOT_FOUND" });
}

async function installResponseCapture(targetFrame) {
    await targetFrame.evaluate(() => {
        window.__tpvE2eResponses = [];
        window.addEventListener("message", (event) => {
            if (event.source !== window.parent) return;
            const data = event.data || {};
            if (data.type === "MM_CONTEXT") {
                window.__tpvE2eContext = data.payload || {};
                return;
            }
            if (typeof data.type !== "string" || !data.type.endsWith("_RES")) return;
            window.__tpvE2eResponses.push({
                type: data.type,
                messageId: data.messageId || null,
                payload: data.payload || {},
            });
        });
    });
}

async function clearCapturedResponses(targetFrame) {
    await targetFrame.evaluate(() => { window.__tpvE2eResponses = []; });
}

async function waitForCapturedResponse(targetFrame, responseType, timeoutMs = 30000) {
    await targetFrame.waitForFunction(
        (type) => Array.isArray(window.__tpvE2eResponses) &&
            window.__tpvE2eResponses.some((item) => item.type === type),
        responseType,
        { timeout: timeoutMs }
    );
    const captured = await targetFrame.evaluate((type) =>
        window.__tpvE2eResponses.filter((item) => item.type === type), responseType);
    return captured[captured.length - 1];
}

async function invokeWidget(targetFrame, type, payload = {}, timeoutMs = 30000) {
    const messageId = "e2e-" + randomUUID().replace(/-/g, "");
    const targetOrigin = await targetFrame.evaluate((origins) => {
        const candidates = Array.from(window.location.ancestorOrigins || []);
        if (document.referrer) candidates.push(document.referrer);
        for (const candidate of candidates) {
            try {
                const origin = new URL(candidate).origin;
                if (origins.includes(origin)) return origin;
            } catch (_) {
                // Ignore non-URL ancestor values; no wildcard fallback is allowed.
            }
        }
        return null;
    }, allowedParentOrigins);

    assert.ok(targetOrigin, "TPV_PARENT_ORIGIN_UNAVAILABLE: no allowed parent origin found");

    const envelope = await targetFrame.evaluate(({ type, payload, messageId, targetOrigin, timeoutMs }) =>
        new Promise((resolve, reject) => {
            let timer;
            const cleanup = () => {
                window.removeEventListener("message", handler);
                if (timer) clearTimeout(timer);
            };
            const handler = (event) => {
                if (event.source !== window.parent) return;
                if (event.origin && event.origin !== "null" && event.origin !== targetOrigin) return;
                const data = event.data || {};
                if (data.type !== type + "_RES" || data.messageId !== messageId) return;
                cleanup();
                resolve(data.payload || {});
            };
            window.addEventListener("message", handler);
            timer = setTimeout(() => {
                cleanup();
                reject(new Error(type + "_TIMEOUT"));
            }, timeoutMs);
            window.parent.postMessage({
                type,
                payload,
                messageId,
                version: 1,
            }, targetOrigin);
        }), { type, payload, messageId, targetOrigin, timeoutMs });

    await recordOperation(type, envelope, messageId);
    return envelope;
}

async function captureUiOperation(targetFrame, responseType, operationName) {
    const captured = await waitForCapturedResponse(targetFrame, responseType);
    await recordOperation(operationName, captured.payload, captured.messageId);
    return captured.payload;
}

function cashTotalFromMovements(items) {
    let totalMinor = 0;
    for (const item of items) {
        const amount = Number(item.amount);
        if (!Number.isFinite(amount)) throw new Error("TPV_MOVEMENT_AMOUNT_INVALID");
        const minor = Math.round(amount * 100);
        switch (String(item.movementType || "").toUpperCase()) {
            case "APERTURA":
            case "ENTRADA":
                totalMinor += minor;
                break;
            case "SALIDA":
            case "RETIRADA":
                totalMinor -= minor;
                break;
            case "ARQUEO_PARCIAL":
            case "CONTROL_X":
            case "CIERRE_Z":
            case "VENTA":
            case "DEVOLUCION":
            case "CIERRE":
                break;
            case "COBRO":
                if (String(item.paymentMethod || "").toUpperCase() === "EFECTIVO") {
                    totalMinor += minor;
                }
                break;
            default:
                throw new Error("TPV_UNEXPECTED_MOVEMENT_TYPE:" + String(item.movementType || "UNKNOWN"));
        }
    }
    return totalMinor / 100;
}

async function run() {
    const startUrl = new URL(previewUrl);
    assert.equal(startUrl.protocol, "https:", "Preview URL must use HTTPS");
    assert.ok(wixHost(startUrl.hostname), "Preview URL is not a Wix Preview host");

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ storageState, serviceWorkers: "block" });
    page = await context.newPage();

    page.on("pageerror", (error) => {
        report.pageErrors = report.pageErrors || [];
        report.pageErrors.push(String(error?.message || error).slice(0, 500));
    });
    page.on("console", (message) => {
        if (message.type() !== "error") return;
        report.consoleErrors = report.consoleErrors || [];
        report.consoleErrors.push(message.text().slice(0, 500));
    });

    phase = "preview-navigation";
    const previewResponse = await page.goto(previewUrl, {
        waitUntil: "domcontentloaded",
        timeout: 90000,
    });
    assert.ok(previewResponse, "Preview returned no main-document response");
    assert.ok(previewResponse.status() >= 200 && previewResponse.status() < 400,
        "Preview HTTP " + previewResponse.status());
    report.previewHttpStatus = previewResponse.status();

    const landingUrl = new URL(page.url());
    assert.ok(wixHost(landingUrl.hostname), "Preview redirected outside Wix");
    assert.notEqual(landingUrl.hostname, "wix.to", "Wix Preview short link did not resolve");
    report.previewHost = landingUrl.hostname;

    phase = "tpv-page-navigation";
    const tpvUrl = new URL(tpvPagePath, landingUrl);
    tpvUrl.search = landingUrl.search;
    assert.equal(tpvUrl.origin, landingUrl.origin, "TPV route must remain on the Preview origin");
    const tpvResponse = await page.goto(tpvUrl.href, {
        waitUntil: "domcontentloaded",
        timeout: 90000,
    });
    assert.ok(tpvResponse, "TPV Preview route returned no main-document response");
    assert.ok(tpvResponse.status() >= 200 && tpvResponse.status() < 400,
        "TPV Preview HTTP " + tpvResponse.status());
    report.tpvPageHttpStatus = tpvResponse.status();

    const tpvFinalUrl = new URL(page.url());
    assert.ok(wixHost(tpvFinalUrl.hostname), "TPV route redirected outside Wix");
    assert.equal(tpvFinalUrl.hostname, landingUrl.hostname, "TPV route changed Preview host");
    report.tpvPageHost = tpvFinalUrl.hostname;

    phase = "widget-handshake";
    await page.locator("body").waitFor({ state: "visible", timeout: 30000 });
    frame = await waitForTpvFrame(page);
    await installResponseCapture(frame);
    await frame.waitForFunction(
        () => /Conectado/.test(document.querySelector("#connLabel")?.textContent || ""),
        null,
        { timeout: 90000 }
    );
    await frame.waitForFunction(
        () => window.__tpvE2eContext && typeof window.__tpvE2eContext === "object",
        null,
        { timeout: 15000 }
    );
    report.runtimeContext = await frame.evaluate(() => {
        const context = window.__tpvE2eContext || {};
        const data = context.data || {};
        return {
            status: context.status || null,
            protocolVersion: data.protocolVersion ?? null,
            currency: data.currency ?? null,
            timeZone: data.timeZone ?? null,
            permissionsStatus: data.permissionsStatus ?? null,
            operationalWritesAvailable: data.operationalWritesAvailable === true,
            operationalWritesUnavailableReason: data.operationalWritesUnavailableReason || null,
            capabilities: data.capabilities && typeof data.capabilities === "object"
                ? data.capabilities
                : {},
        };
    });
    const connectionLabel = (await frame.locator("#connLabel").innerText()).trim();
    report.authenticatedBrowser = true;
    report.operationalWritesAuthorized = connectionLabel.includes("Operaciones autorizadas");
    report.connectionLabel = connectionLabel;
    if (executionMode === "e2e") {
        assert.ok(report.operationalWritesAuthorized,
            "TPV is not authorized for operational writes: " + connectionLabel);
    }

    phase = "initial-cash-state";
    let stateEnvelope = await invokeWidget(frame, "CASHIER_STATE", {});
    let state = assertSuccess(stateEnvelope, "CASHIER_STATE");
    report.initialCashState = redact({
        status: state.status,
        operationalStatus: state.operationalStatus,
        canOpenSession: state.canOpenSession,
        sessionId: state.sessionId || null,
        expectedCash: state.expectedCash ?? null,
        projectionStatus: state.cajaActual?.projectionStatus || null,
    });
    report.uiCapabilities = await frame.evaluate(() => {
        const ids = ["openCash", "cashIn", "cashOut", "saveSale", "ticketX", "ticketZ", "refund"];
        return Object.fromEntries(ids.map((id) => {
            const element = document.getElementById(id);
            return [id, element ? {
                present: true,
                disabled: Boolean(element.disabled),
                visible: Boolean(element.getClientRects().length),
            } : { present: false }];
        }));
    });

    if (executionMode === "read-only") {
        // This path deliberately stops before SESSION_OPEN, movements, sales,
        // payments, refunds, Ticket X/Z or any other business mutation.
        if (state.sessionId) {
            phase = "read-only-ledger-query";
            const ledgerEnvelope = await invokeWidget(frame, "CASH_MOVEMENTS_EXPORT", {
                sessionId: state.sessionId,
                limit: 200,
            });
            const ledgerData = assertSuccess(ledgerEnvelope, "CASH_MOVEMENTS_EXPORT_READ_ONLY");
            report.readOnlyLedger = {
                itemCount: Array.isArray(ledgerData.items) ? ledgerData.items.length : 0,
                sessionId: state.sessionId,
            };
            phase = "read-only-audit-query";
            const auditEnvelope = await invokeWidget(frame, "AUDIT_LIST", {
                sessionId: state.sessionId,
                limit: 100,
            });
            const auditData = assertSuccess(auditEnvelope, "AUDIT_LIST_READ_ONLY");
            report.readOnlyAudit = {
                itemCount: Array.isArray(auditData.items) ? auditData.items.length : 0,
                sessionId: state.sessionId,
            };
        }
        report.result = "PASS_READ_ONLY";
        report.completedPhase = phase;
        report.readOnlyAssertions = {
            handshakeConnected: true,
            cashierStateRead: true,
            noBusinessWritesInvoked: report.businessWebMethodsInvoked === (state.sessionId ? 3 : 1),
            preexistingSessionUntouched: true,
        };
        await persistReport();
        return;
    }

    // Preflight is read-only. Never close, alter, or adopt a session that
    // existed before this E2E run.
    if (state.operationalStatus === "ABIERTA") {
        report.result = "BLOCKED";
        report.blockReason = "PREEXISTING_OPEN_SESSION_NOT_TOUCHED";
        report.preexistingSessionId = state.sessionId || null;
        throw Object.assign(new Error("A cash session is already open; E2E will not close or modify it."), {
            code: report.blockReason,
        });
    }
    if (state.canOpenSession !== true) {
        report.result = "BLOCKED";
        report.blockReason = state.operationalStatus === "CERRADA"
            ? "SESSION_ALREADY_CLOSED_OR_NOT_REOPENABLE_TODAY"
            : "TPV_SESSION_OPEN_NOT_ALLOWED";
        throw Object.assign(new Error(report.blockReason), { code: report.blockReason });
    }

    phase = "session-open";
    await clearCapturedResponses(frame);
    await frame.locator("#openCash").click();
    await frame.locator("#openingCash").waitFor({ state: "visible", timeout: 15000 });
    await frame.locator("#openingCash").fill("300,00");
    await frame.locator("#openingReason").fill("E2E TPV " + new Date().toISOString().slice(0, 19));
    await frame.locator("#modalConfirm").click();

    const openEnvelope = await captureUiOperation(frame, "SESSION_OPEN_RES", "SESSION_OPEN");
    const openData = assertSuccess(openEnvelope, "SESSION_OPEN");
    const sessionId = String(openData.sessionId || "");
    assert.ok(sessionId, "SESSION_OPEN did not return sessionId");
    assert.ok(openData.openingMovementId, "SESSION_OPEN did not return openingMovementId");
    assert.ok(openData.openingTransactionId, "SESSION_OPEN did not return openingTransactionId");
    assert.equal(openData.openingMovementId, openData.openingTransactionId,
        "Opening movement ID and transactionId differ");
    report.sessionId = sessionId;
    report.openingMovementId = openData.openingMovementId;
    report.openingTransactionId = openData.openingTransactionId;

    await frame.locator("#modalConfirm").waitFor({ state: "visible", timeout: 15000 });
    await frame.waitForFunction(
        () => (document.querySelector("#modalConfirm")?.textContent || "").includes("Cerrar y continuar"),
        null,
        { timeout: 15000 }
    );
    await frame.locator("#modalConfirm").click();
    await frame.locator("#modalBackdrop").waitFor({ state: "hidden", timeout: 15000 });

    phase = "cash-movement";
    await clearCapturedResponses(frame);
    await frame.locator("#cashIn").click();
    await frame.locator("#movementAmount").waitFor({ state: "visible", timeout: 15000 });
    await frame.locator("#movementAmount").fill("1,00");
    await frame.locator("#movementConcept").fill("Entrada de efectivo E2E TPV");
    await frame.locator("#modalConfirm").click();

    const cashEnvelope = await captureUiOperation(frame, "CASH_MOVEMENT_RES", "CASH_MOVEMENT");
    const cashData = assertSuccess(cashEnvelope, "CASH_MOVEMENT");
    assert.ok(cashData.movementId, "CASH_MOVEMENT did not return movementId");
    report.cashMovementId = cashData.movementId;

    phase = "partial-cash-count";
    const partialEnvelope = await invokeWidget(frame, "PARTIAL_CASH_COUNT", {
        sessionId,
        countedCash: 301,
        reason: "Arqueo parcial E2E TPV",
    });
    const partialData = assertSuccess(partialEnvelope, "PARTIAL_CASH_COUNT");
    assert.ok(partialData.movementId, "PARTIAL_CASH_COUNT did not return movementId");
    report.partialCountMovementId = partialData.movementId;

    phase = "pending-sale";
    const catalogEnvelope = await invokeWidget(frame, "CATALOG_SERVICES", {});
    const catalogData = assertSuccess(catalogEnvelope, "CATALOG_SERVICES");
    const services = Array.isArray(catalogData.items) ? catalogData.items : [];
    const testService = services.find((item) =>
        item && item.tipoLinea === "SERVICIO" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(item.itemId || "")) &&
        Number.isFinite(Number(item.precioFijo)) && Number(item.precioFijo) > 0 &&
        String(item.moneda || "EUR").toUpperCase() === "EUR"
    );
    assert.ok(testService, "No fixed-price EUR service is available for the pending-sale E2E case");
    const saleIdempotencyKey = randomUUID();
    const saleEnvelope = await invokeWidget(frame, "SALE_REGISTER", {
        sessionId,
        idempotencyKey: saleIdempotencyKey,
        lineItems: [{ tipoLinea: "SERVICIO", itemId: testService.itemId, cantidad: 1 }],
        payments: [],
    });
    const pendingSale = assertPending(saleEnvelope, "SALE_REGISTER_PENDING");
    phase = "pending-sale-readback";
    const saleReadbackEnvelope = await invokeWidget(frame, "SALE_READBACK", {
        sessionId,
        idempotencyKey: saleIdempotencyKey,
    });
    const saleReadback = assertSuccess(saleReadbackEnvelope, "SALE_READBACK");
    assert.equal(saleReadback.recordPersisted, true);
    assert.equal(saleReadback.orderId, pendingSale.orderId);
    assert.equal(saleReadback.status, "PENDING_PAYMENT");
    assert.equal(saleReadback.requiresReconciliation, false);
    assert.equal(saleReadback.order.externalOrderId, saleIdempotencyKey);
    assert.equal(saleReadback.order.status, "APPROVED");
    assert.equal(saleReadback.order.paymentStatus, "NOT_PAID");
    assert.equal(saleReadback.order.totalMinor, Math.round(Number(pendingSale.totalVenta) * 100));
    report.saleReadback = {
        orderId: saleReadback.orderId,
        status: saleReadback.status,
        requiresReconciliation: saleReadback.requiresReconciliation,
        wixOrderStatus: saleReadback.order.status,
        wixPaymentStatus: saleReadback.order.paymentStatus,
        totalMinor: saleReadback.order.totalMinor,
    };

    report.pendingSale = {
        idempotencyKey: pendingSale.idempotencyKey,
        orderId: pendingSale.orderId,
        orderPersisted: pendingSale.orderPersisted,
        paymentStatus: pendingSale.paymentStatus,
        totalVenta: pendingSale.totalVenta,
        medioPago: pendingSale.medioPago || null,
        persisted: pendingSale.persisted,
        replayed: pendingSale.replayed === true,
        auditPersisted: pendingSale.auditPersisted === true,
        serviceItemId: testService.itemId,
    };

    phase = "pending-sale-summary";
    const summaryEnvelope = await invokeWidget(frame, "SESSION_SUMMARY", { sessionId });
    const summary = assertSuccess(summaryEnvelope, "SESSION_SUMMARY_AFTER_PENDING_SALE");
    assert.equal(Number(summary.pendingSalesCount), 1);
    assert.equal(Math.round(Number(summary.pendingSalesGross) * 100),
        Math.round(Number(pendingSale.totalVenta) * 100));
    assert.equal(summary.reconciliationOk, true,
        "An unpaid commercial intent must remain separate from collected cash");

    phase = "cash-sale-register";
    const cashSaleIdempotencyKey = randomUUID();
    const cashSaleEnvelope = await invokeWidget(frame, "SALE_REGISTER", {
        sessionId,
        idempotencyKey: cashSaleIdempotencyKey,
        lineItems: [{ tipoLinea: "SERVICIO", itemId: testService.itemId, cantidad: 1 }],
        payments: [{
            method: "EFECTIVO",
            amount: Number(pendingSale.totalVenta),
            change: 0,
        }],
    });
    const cashSale = assertSuccess(cashSaleEnvelope, "SALE_REGISTER_CASH");
    assert.equal(cashSale.orderPersisted, true);
    assert.equal(cashSale.paymentPersisted, true);
    assert.equal(cashSale.ledgerPersisted, true);
    assert.equal(cashSale.auditPersisted, true);
    assert.ok(cashSale.orderId, "Cash sale Wix orderId missing");
    assert.equal(cashSale.paymentStatus, "PAID");
    assert.ok(cashSale.paymentId, "Wix offline cash paymentId missing");
    assert.ok(cashSale.ledgerMovementId, "TPV cash payment ledgerMovementId missing");
    report.cashSale = {
        idempotencyKey: cashSaleIdempotencyKey,
        orderId: cashSale.orderId,
        paymentId: cashSale.paymentId,
        ledgerMovementId: cashSale.ledgerMovementId,
        paymentStatus: cashSale.paymentStatus,
        totalVenta: cashSale.totalVenta,
        auditPersisted: cashSale.auditPersisted === true,
    };

    phase = "cash-sale-readback";
    const cashSaleReadbackEnvelope = await invokeWidget(frame, "SALE_READBACK", {
        sessionId,
        idempotencyKey: cashSaleIdempotencyKey,
    });
    const cashSaleReadback = assertSuccess(cashSaleReadbackEnvelope, "SALE_READBACK_CASH");
    assert.equal(cashSaleReadback.recordPersisted, true);
    assert.equal(cashSaleReadback.orderId, cashSale.orderId);
    assert.equal(cashSaleReadback.status, "CONFIRMADA");
    assert.equal(cashSaleReadback.requiresReconciliation, false);
    assert.equal(cashSaleReadback.order.externalOrderId, cashSaleIdempotencyKey);
    assert.equal(cashSaleReadback.order.status, "APPROVED");
    assert.equal(cashSaleReadback.order.paymentStatus, "PAID");
    assert.equal(cashSaleReadback.paymentSelection.length, 1);
    assert.equal(cashSaleReadback.paymentSelection[0].medioPago, "EFECTIVO");
    assert.equal(cashSaleReadback.paymentSelection[0].confirmed, true);
    assert.equal(Math.round(Number(cashSaleReadback.paymentSelection[0].importe) * 100),
        Math.round(Number(cashSale.totalVenta) * 100));
    assert.equal(Math.round(Number(cashSaleReadback.paymentSelection[0].importeCambio) * 100), 0);
    assert.equal(Math.round(Number(cashSaleReadback.paymentSelection[0].importeAplicado) * 100),
        Math.round(Number(cashSale.totalVenta) * 100));
    assert.ok(/^TPV_[a-f0-9]{64}$/i.test(cashSaleReadback.paymentSelection[0].ledgerMovementId));
    report.cashSaleReadback = {
        orderId: cashSaleReadback.orderId,
        orderPaymentStatus: cashSaleReadback.order.paymentStatus,
        paymentId: cashSaleReadback.paymentSelection[0].paymentId,
        ledgerMovementId: cashSaleReadback.paymentSelection[0].ledgerMovementId,
    };

    phase = "cashier-projection-readback";
    const cashierStateAfterCashSaleEnvelope = await invokeWidget(frame, "CASHIER_STATE", {});
    const cashierStateAfterCashSale = assertSuccess(cashierStateAfterCashSaleEnvelope, "CASHIER_STATE_AFTER_CASH_SALE");
    const cajaAfterCashSale = cashierStateAfterCashSale.cajaActual;
    assert.equal(Number(cajaAfterCashSale.salesCount), 1);
    assert.equal(
        Math.round(Number(cajaAfterCashSale.cashAmount) * 100),
        30100 + Math.round(Number(cashSale.totalVenta) * 100)
    );
    report.cashierProjection = {
        salesCount: Number(cajaAfterCashSale.salesCount),
        cashAmount: cajaAfterCashSale.cashAmount,
        expectedCash: cajaAfterCashSale.expectedCash,
    };

    phase = "ticket-x";
    await clearCapturedResponses(frame);
    await frame.locator("#ticketX").click();
    const ticketEnvelope = await captureUiOperation(frame, "TICKET_X_RES", "TICKET_X");
    const ticketData = assertSuccess(ticketEnvelope, "TICKET_X");
    const ticketX = ticketData.ticketX || ticketData.data?.ticketX;
    assert.equal(ticketX?.ticketType, "CONTROL_PARCIAL_X");
    assert.equal(ticketX?.sessionId, sessionId);
    report.ticketX = {
        ticketType: ticketX.ticketType,
        sessionId: ticketX.sessionId,
        nOperaciones: ticketX.nOperaciones,
        closesSession: ticketX.closesSession,
    };
    await frame.locator("#modalConfirm").click();
    await frame.locator("#modalBackdrop").waitFor({ state: "hidden", timeout: 15000 });

    phase = "pre-close-ledger-query";
    const beforeCloseEnvelope = await invokeWidget(frame, "CASH_MOVEMENTS_EXPORT", { sessionId });
    const beforeClose = assertSuccess(beforeCloseEnvelope, "CASH_MOVEMENTS_EXPORT_BEFORE_CLOSE");
    const beforeItems = Array.isArray(beforeClose.items) ? beforeClose.items : [];
    const openingItem = beforeItems.find((item) => item.movementId === openData.openingMovementId);
    const cashItem = beforeItems.find((item) => item.movementId === cashData.movementId);
    assert.ok(openingItem, "Opening movement was not found in the post-write ledger query");
    assert.ok(cashItem, "Cash movement was not found in the post-write ledger query");
    assert.ok(openingItem.transactionId, "Opening transactionId missing from ledger query");
    assert.ok(cashItem.transactionId, "Cash movement transactionId missing from ledger query");
    assert.equal(openingItem.movementId, openingItem.transactionId);
    assert.equal(cashItem.movementId, cashItem.transactionId);
    const expectedCash = cashTotalFromMovements(beforeItems);
    const expectedCashMinor = 30100 + Math.round(Number(cashSale.totalVenta) * 100);
    assert.equal(Math.round(expectedCash * 100), expectedCashMinor,
        "Expected cash differs from the 300€ opening, 1€ cash-in and confirmed cash sale");

    phase = "ticket-z";
    const ticketZEnvelope = await invokeWidget(frame, "TICKET_Z", {
        sessionId,
        countedCash: expectedCash,
        differenceReason: "",
    });
    const ticketZData = assertSuccess(ticketZEnvelope, "TICKET_Z");
    assert.equal(ticketZData.sessionId, sessionId);
    assert.equal(ticketZData.closed, true);
    assert.equal(Math.round(Number(ticketZData.expectedCash) * 100), expectedCashMinor);
    assert.equal(Math.round(Number(ticketZData.countedCash) * 100), expectedCashMinor);
    assert.equal(Math.round(Number(ticketZData.difference) * 100), 0);
    report.ticketZInvoked = true;
    report.ticketZ = {
        reportId: ticketZData.reportId,
        sessionId: ticketZData.sessionId,
        expectedCash: ticketZData.expectedCash,
        countedCash: ticketZData.countedCash,
        difference: ticketZData.difference,
        pendingSalesCount: ticketZData.pendingSalesCount,
        closed: ticketZData.closed,
    };

    phase = "post-close-state-query";
    const finalStateEnvelope = await invokeWidget(frame, "CASHIER_STATE", {});
    const finalState = assertSuccess(finalStateEnvelope, "CASHIER_STATE_AFTER_CLOSE");
    assert.equal(finalState.operationalStatus, "CERRADA");
    assert.equal(finalState.sessionId, sessionId);

    phase = "post-close-ledger-query";
    const finalLedgerEnvelope = await invokeWidget(frame, "CASH_MOVEMENTS_EXPORT", { sessionId });
    const finalLedger = assertSuccess(finalLedgerEnvelope, "CASH_MOVEMENTS_EXPORT_AFTER_CLOSE");
    const finalItems = Array.isArray(finalLedger.items) ? finalLedger.items : [];
    const closingItem = finalItems.find((item) => item.movementType === "CIERRE");
    assert.ok(closingItem, "Closing movement was not found in the post-close ledger query");
    const ticketZLedgerItem = finalItems.find((item) => item.movementType === "CIERRE_Z" && item.reference === ticketZData.reportId);
    assert.ok(ticketZLedgerItem, "Ticket Z record was not found in the post-close ledger query");
    assert.equal(ticketZLedgerItem.sessionId, sessionId);
    assert.ok(ticketZLedgerItem.transactionId, "Ticket Z transactionId missing from ledger query");
    assert.ok(closingItem.transactionId, "Closing transactionId missing from ledger query");
    assert.equal(closingItem.movementId, closingItem.transactionId);
    for (const item of finalItems) {
        assert.ok(item.transactionId, "Ledger item has no transactionId: " + item.movementId);
        assert.ok(Number.isSafeInteger(Number(item.sequenceNumber)) && Number(item.sequenceNumber) > 0,
            "Ledger item has invalid sequenceNumber: " + item.movementId);
        assert.match(String(item.hash || ""), /^[a-f0-9]{64}$/i,
            "Ledger item has invalid hash: " + item.movementId);
    }

    phase = "audit-query";
    const auditEnvelope = await invokeWidget(frame, "AUDIT_LIST", { sessionId, limit: 100 });
    const auditData = assertSuccess(auditEnvelope, "AUDIT_LIST");
    const auditItems = Array.isArray(auditData.items) ? auditData.items : [];
    const ticketAudit = auditItems.find((item) => item.action === "TICKET_X_GENERATED");
    const closeAudit = auditItems.find((item) => item.action === "TICKET_Z_CLOSED");
    assert.ok(ticketAudit?.id, "Ticket X audit record not found");
    assert.ok(closeAudit?.id, "Ticket Z audit record not found");
    const saleAudit = auditItems.find((item) => item.action === "VENTA_TPV_REGISTRADA" && item.entityId === saleIdempotencyKey);
    const orderAudit = auditItems.find((item) => item.action === "PEDIDO_WIX_TPV_VINCULADO" && item.entityId === saleIdempotencyKey);
    assert.ok(saleAudit?.id, "Sale audit record not found");
    assert.ok(orderAudit?.id, "Wix order link audit record not found");
    const cashSaleAudit = auditItems.find((item) => item.action === "VENTA_TPV_REGISTRADA" && item.entityId === cashSaleIdempotencyKey);
    const cashOrderAudit = auditItems.find((item) => item.action === "PEDIDO_WIX_TPV_VINCULADO" && item.entityId === cashSaleIdempotencyKey);
    const cashPaymentAudit = auditItems.find((item) => item.action === "PAGO_TPV_CONFIRMADO" && item.entityId === cashSaleIdempotencyKey);
    assert.ok(cashSaleAudit?.id, "Cash sale audit record not found");
    assert.ok(cashOrderAudit?.id, "Cash Wix order link audit record not found");
    assert.ok(cashPaymentAudit?.id, "Cash payment audit record not found");

    report.postChecks = {
        cashRegisterStatus: finalState.operationalStatus,
        sessionId: finalState.sessionId,
        movementCount: finalItems.length,
        movements: finalItems.map((item) => ({
            _id: item.movementId,
            transactionId: item.transactionId,
            movementType: item.movementType,
            amount: item.amount,
            sequenceNumber: item.sequenceNumber,
            hash: item.hash,
            previousRecordHash: item.previousRecordHash || null,
            traceId: item.traceId || null,
        })),
        ticketXAuditId: ticketAudit.id,
        closeAuditId: closeAudit.id,
        saleAuditId: saleAudit.id,
        orderAuditId: orderAudit.id,
        ticketZReportId: ticketZData.reportId,
        pendingSalesCount: Number(ticketZData.pendingSalesCount || 0),
        cashSaleAuditId: auditItems.find((item) => item.action === "VENTA_TPV_REGISTRADA" && item.entityId === cashSaleIdempotencyKey)?.id || null,
        cashOrderAuditId: auditItems.find((item) => item.action === "PEDIDO_WIX_TPV_VINCULADO" && item.entityId === cashSaleIdempotencyKey)?.id || null,
        cashPaymentAuditId: auditItems.find((item) => item.action === "PAGO_TPV_CONFIRMADO" && item.entityId === cashSaleIdempotencyKey)?.id || null,
        auditActions: auditItems.map((item) => item.action),
    };

    report.result = "PASS";
    report.completedPhase = phase;
    report.acceptance = {
        openingCashMinor: 30000,
        cashInMinor: 100,
        partialCountMinor: 30100,
        pendingSalePersisted: true,
        cashSalePersisted: true,
        cashPaymentPersisted: true,
        expectedCashMinor,
        ticketXVerified: true,
        ticketZVerified: true,
        sessionClosed: true,
    };
    await persistReport();
}

try {
    await run();
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} catch (error) {
    if (report.result !== "BLOCKED") report.result = "FAIL";
    report.failedPhase = phase;
    report.error = {
        code: error?.code || "TPV_PREVIEW_E2E_FAILED",
        message: String(error?.message || error).slice(0, 1000),
        response: redact(error?.response || null),
    };
    await persistReport();
    process.stderr.write(JSON.stringify(report, null, 2) + "\n");
    throw error;
} finally {
    await browser?.close();
    await persistReport();
}
