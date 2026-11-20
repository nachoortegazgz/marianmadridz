import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../../../%23htmlTPV.txt", import.meta.url), "utf8");
const controller = await readFile(new URL("../../public/tpvPageController.js", import.meta.url), "utf8");
const cashierBackend = await readFile(new URL("../cajas.web.js", import.meta.url), "utf8");
const catalogBackend = await readFile(new URL("../tpv/tpvCatalogo.web.js", import.meta.url), "utf8");

test("TPV controller exposes authenticated SANDBOX session and Bookings catalog methods", async () => {
    assert.match(controller, /obtenerSesionCaja/);
    assert.match(controller, /obtenerServicios/);
    assert.match(controller, /obtenerProfesionales/);
    assert.match(controller, /consultarTarjetaRegalo/);
    assert.match(cashierBackend, /requireCajero/);
    assert.match(catalogBackend, /requireCajero/);
    const permissions = await readFile(new URL("../tpv/tpvPermisos.web.js", import.meta.url), "utf8");
    for (const capability of ["createSyntheticSale", "openSandboxSession", "registerCashMovement", "requestRefund", "closeSandboxSession", "issueTicketX", "issueTicketZ"]) {
        assert.match(permissions, new RegExp(capability + ": isAdmin"));
    }
    assert.match(controller, /MESSAGE_TYPES\.READY/);
    assert.match(controller, /onContextReady:/);
    assert.match(controller, /"CASHIER_STATE"/);
    assert.match(controller, /"CATALOG_SERVICES"/);
    assert.match(controller, /"CATALOG_STAFF"/);
    assert.doesNotMatch(
        controller,
        /registerManualTransaction|registerZClosing|createCheckout|createOrder|createPayment|processRefund/i
    );
});

test("TPV HTML uses versioned messaging and keeps ticket drafts in browser memory", () => {
    assert.match(html, /MM_READY/);
    assert.match(html, /CASHIER_STATE_RES/);
    assert.match(html, /CATALOG_SERVICES_RES/);
    assert.match(html, /CATALOG_STAFF_RES/);
    assert.match(html, /send\("CATALOG_SERVICES"/);
    assert.match(html, /send\("CATALOG_STAFF"/);
    assert.match(html, /function requestCatalog/);
    assert.match(html, /window\.parent\.postMessage/);
    assert.match(html, /function announceReady/);
    assert.match(html, /e\.source!==window\.parent/);
    assert.match(html, /state\.contextReady/);
    assert.match(html, /state\.items/);
    assert.match(html, /cashDenominations/);
    assert.match(html, /loadMoreProducts/);
    assert.match(html, /function requestMoreProducts/);
    assert.match(html, /calculateDenominations/);
    assert.match(html, /request\("SANDBOX_PAYMENT_VALIDATE"/);
    assert.match(html, /function finalizeSynthetic/);
    assert.match(html, /state\.operationKeys\.sale/);
    assert.match(html, /state\.operationKeys\.refund/);
    assert.match(html, /id="taxTotal"[^>]*disabled/);
    assert.doesNotMatch(html, /fetch\s*\(|XMLHttpRequest|wix-data|suppressAuth/i);
    assert.doesNotMatch(html, /onclick="addProduct\(|Usuario:\s*Administrador/);
});
test("TPV controls keep unsupported commercial and fiscal capabilities disabled", () => {
    for (const label of ["Emitir tarjeta regalo", "Consultar tarjeta regalo", "Emitir factura completa", "Emitir rectificativa"]) {
        assert.match(html, new RegExp("<button[^>]*disabled[^>]*>" + label + "</button>"));
    }
    assert.match(html, /id="taxTotal"[^>]*disabled/);
    assert.match(html, /id="refund" class="btn danger" disabled/);
    assert.match(html, /id="ticketX"[^>]*disabled/);
    assert.match(html, /id="ticketZ"[^>]*disabled/);
    assert.match(html, /state\.context\?\.environment!=="SANDBOX"\|\|state\.context\?\.previewOnly!==true/);
    assert.match(html, /!c\.issueTicketX/);
    assert.match(html, /!c\.registerCashMovement/);
    assert.match(html, /!c\.createSyntheticSale/);
    assert.match(html, /state\.session=session;renderSession\(\);renderCapabilities\(\);/);
    assert.match(html, /id="saveSale"/);
    assert.match(html, /id="openSession"/);
    assert.match(html, /id="cashMovement"/);
    assert.match(html, /id="refund"/);
});
test("TPV HTML request protocol is dispatched for the active widget workflows", async () => {
    const page = await readFile(new URL("../../pages/TPV.yl5th.js", import.meta.url), "utf8");
    const requests = ["CASHIER_STATE", "SANDBOX_CONFIG", "SANDBOX_PERMISSIONS", "CATALOG_SERVICES", "CATALOG_STAFF", "CATALOG_PRODUCTS", "PRODUCT_VARIANTS", "CUSTOMERS_SEARCH", "SANDBOX_PAYMENT_VALIDATE", "VALIDATE_SALE_DRAFT", "SANDBOX_SALE_REGISTER", "SANDBOX_SESSION_SUMMARY", "SANDBOX_SESSION_OPEN", "SANDBOX_CASH_MOVEMENT", "SANDBOX_REFUND", "SANDBOX_TICKET_X", "SANDBOX_TICKET_Z"];
    assert.match(page, /\$w\("#htmlTPV"\)/);
    assert.match(controller, /protocolVersion: 1/);
    assert.match(controller, /environment: sandboxReady \? "SANDBOX" : "UNAVAILABLE"/);
    assert.match(controller, /sandboxReady/);
    assert.match(controller, /inicializarCaja/);
    assert.match(controller, /sandboxReady/);
    assert.match(controller, /syntheticOnly: true/);
    assert.match(controller, /case MESSAGE_TYPES\.READY:\s+return;/);
    for (const type of requests) {
        assert.ok(controller.includes('"' + type + '"'), "controller must allow " + type);
        assert.ok(controller.includes('case "' + type + '":'), "controller must dispatch " + type);
        assert.ok(controller.includes('"' + type + '_RES"'), "controller must return " + type + "_RES");
        assert.ok(html.includes('"' + type + '"'), "widget must request " + type);
    }
    for (const type of ["SANDBOX_AUDIT_LIST", "SANDBOX_PARTIAL_COUNT", "CUSTOMER_BOOKINGS", "GIFT_CARD_BALANCE"]) {
        assert.ok(controller.includes('"' + type + '"' ), "controller retains reserved handler " + type);
    }
});

test("TPV customer, staff and booking references are synthetic-only", async () => {
    const sales = await readFile(new URL("../tpv/tpvVentas.web.js", import.meta.url), "utf8");
    assert.match(catalogBackend, /listTpvSandboxIdentities\(TPV_SANDBOX_IDENTITY_TYPES\.CUSTOMER\)/);
    assert.match(catalogBackend, /listTpvSandboxIdentities\(TPV_SANDBOX_IDENTITY_TYPES\.STAFF\)/);
    assert.doesNotMatch(catalogBackend, /TPV_SANDBOX_FIXTURES/);
    assert.match(catalogBackend, /syntheticOnly: true/);
    assert.doesNotMatch(catalogBackend, /contactsV5|extendedBookings|staffMembers|tpvNativeReaders/);
    assert.match(sales, /TPV_SANDBOX_CUSTOMER_NOT_ALLOWED/);
    assert.match(sales, /TPV_SANDBOX_BOOKINGS_DISABLED/);
    assert.match(sales, /TPV_SANDBOX_STAFF_NOT_ALLOWED/);
    assert.doesNotMatch(sales, /leerContactoTPV|leerReservaTPV|getMyStaffContext|staff\?\.memberId/);
    assert.match(controller, /CUSTOMERS_SEARCH/);
    assert.match(controller, /CUSTOMER_BOOKINGS/);
    assert.match(html, /function renderCustomers/);
    assert.doesNotMatch(html, /function renderCustomerBookings/);
    assert.match(html, /function searchCustomer/);
    assert.match(html, /function renderCustomers/);
});

test("TPV Gift Cards exposes read-only balance lookup without storing or returning the raw code", async () => {
    const giftBackend = await readFile(new URL("../tpv/tpvGiftCards.web.js", import.meta.url), "utf8");
    assert.match(giftBackend, /TPV_GIFT_CARDS_DISABLED_IN_SANDBOX/);
    assert.doesNotMatch(giftBackend, /giftVouchers|@wix\/ecom|auth\.elevate/);
    assert.match(giftBackend, /syntheticOnly: true/);
    assert.doesNotMatch(giftBackend, /insertItem|updateItem|redeemGiftCard|console\.(log|error)/);
    assert.doesNotMatch(html, /Saldo real · deshabilitado en SANDBOX/);
    assert.doesNotMatch(html, /id="giftCardAmount"/);
    assert.doesNotMatch(html, /id="giftCardType"/);
    assert.doesNotMatch(html, /function renderGiftCard/);
});
