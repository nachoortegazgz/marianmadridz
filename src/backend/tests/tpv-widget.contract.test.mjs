import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../../../%23htmlTPV.txt", import.meta.url), "utf8");
const controller = await readFile(new URL("../../public/tpvPageController.js", import.meta.url), "utf8");
const cashierBackend = await readFile(new URL("../cajas.web.js", import.meta.url), "utf8");
const catalogBackend = await readFile(new URL("../tpv/tpvCatalogo.web.js", import.meta.url), "utf8");

test("TPV controller exposes authenticated QA session and Bookings catalog methods", () => {
    assert.match(controller, /obtenerSesionCajaQA/);
    assert.match(controller, /obtenerServicios/);
    assert.match(controller, /obtenerProfesionales/);
    assert.match(controller, /consultarTarjetaRegalo/);
    assert.match(cashierBackend, /requireCajero/);
    assert.match(catalogBackend, /requireCajero/);
    assert.match(controller, /MESSAGE_TYPES\.READY/);
    assert.match(controller, /MESSAGE_TYPES\.CONTEXT/);
    assert.match(controller, /"CASHIER_STATE"/);
    assert.match(controller, /"CATALOG_SERVICES"/);
    assert.match(controller, /"CATALOG_STAFF"/);
    assert.doesNotMatch(
        controller,
        /registerManualTransaction|registerZClosing|createCheckout|createOrder|createPayment|processRefund/i
    );
});

test("TPV HTML uses versioned messaging and browser-local ticket drafts", () => {
    assert.match(html, /MM_READY/);
    assert.match(html, /CASHIER_STATE_RES/);
    assert.match(html, /CATALOG_SERVICES_RES/);
    assert.match(html, /CATALOG_STAFF_RES/);
    assert.match(html, /GIFT_CARD_BALANCE_RES/);
    assert.match(html, /send\("CATALOG_SERVICES"/);
    assert.match(html, /send\("CATALOG_STAFF"/);
    assert.match(html, /precioFormateado/);
    assert.ok(html.includes('if(!state.contextReady&&type!=="MM_READY")return false;'));
    assert.match(html, /function requestCatalog/);
    assert.match(html, /window\.parent\.postMessage/);
    assert.match(html, /function announceReady/);
    assert.match(html, /e\.source!==window\.parent/);
    assert.match(html, /state\.items/);
    assert.match(html, /QA PERSISTENTE/);
    assert.match(html, /Cobrar · deshabilitado/);
    assert.match(html, /Ticket Z · cierre/);
    assert.match(html, /id="section-tickets"/);
    assert.match(html, /Factura simplificada/);
    assert.match(html, /Factura completa/);
    assert.match(html, /Abono \/ rectificativa/);
    assert.match(html, /cashDenominations/);
    assert.match(html, /loadMoreProducts/);
    assert.match(html, /function requestMoreProducts/);
    assert.match(html, /calculateDenominations/);
    assert.doesNotMatch(html, /fetch\s*\(|XMLHttpRequest|wix-data|suppressAuth/i);
    assert.match(html, /send\("CASHIER_STATE"/);
    assert.match(html, /m\.type==="MM_CONTEXT"/);
    assert.match(html, /m\.type==="CASHIER_STATE_RES"/);
    assert.match(html, /send\("CATALOG_SERVICES"/);
    assert.match(html, /send\("CATALOG_STAFF"/);
    assert.match(html, /request\("QA_PAYMENT_VALIDATE"/);
    assert.match(html, /function finalizeSynthetic/);
    assert.doesNotMatch(html, /function lookupGiftCard/);
    assert.match(html, /state\.operationKeys\.sale/);
    assert.match(html, /state\.operationKeys\.refund/);
    assert.match(html, /id="taxTotal"[^>]*disabled/);
    assert.doesNotMatch(html, /onclick="addProduct\(|Usuario:\s*Administrador/);

});

test("TPV mutation controls remain visibly disabled", () => {
    for (const label of ["Cobrar · deshabilitado", "Crear / modificar reserva", "Emitir tarjeta regalo", "Emitir factura completa", "Emitir abono / rectificativa"]) {
        assert.ok(html.includes(label), "expected guarded UI capability: " + label);
    }
    assert.match(html, /disabled/);
    assert.match(html, /no enviado a CMS/i);
    assert.match(html, /memoria de sesión/i);
    assert.match(html, /Guardar venta sintética en QA/);
    assert.match(html, /Abrir sesión QA/);
    assert.match(html, /Registrar arqueo parcial QA/);
    assert.match(html, /Registrar devolución QA/);
});
test("TPV HTML request protocol is dispatched for the active widget workflows", async () => {
    const page = await readFile(new URL("../../pages/TPV.yl5th.js", import.meta.url), "utf8");
    const requests = ["CASHIER_STATE", "QA_CONFIG", "QA_PERMISSIONS", "CATALOG_SERVICES", "CATALOG_STAFF", "CATALOG_PRODUCTS", "PRODUCT_VARIANTS", "CUSTOMERS_SEARCH", "QA_PAYMENT_VALIDATE", "VALIDATE_SALE_DRAFT", "QA_SALE_REGISTER", "QA_SESSION_SUMMARY", "QA_SESSION_OPEN", "QA_CASH_MOVEMENT", "QA_REFUND", "QA_TICKET_X", "QA_TICKET_Z"];
    assert.match(page, /\$w\("#htmlTPV"\)/);
    assert.match(controller, /protocolVersion: 1/);
    assert.match(controller, /environment: "QA"/);
    assert.match(controller, /syntheticOnly: true/);
    assert.match(controller, /case MESSAGE_TYPES\.READY:\s+return;/);
    for (const type of requests) {
        assert.ok(controller.includes('"' + type + '"'), "controller must allow " + type);
        assert.ok(controller.includes('case "' + type + '":'), "controller must dispatch " + type);
        assert.ok(controller.includes('"' + type + '_RES"'), "controller must return " + type + "_RES");
        assert.ok(html.includes('"' + type + '"'), "widget must request " + type);
    }
    for (const type of ["QA_AUDIT_LIST", "QA_PARTIAL_COUNT", "CUSTOMER_BOOKINGS", "GIFT_CARD_BALANCE"]) {
        assert.ok(controller.includes('"' + type + '"' ), "controller retains reserved handler " + type);
    }
});

test("TPV customer, staff and booking references are synthetic-only", async () => {
    const sales = await readFile(new URL("../tpv/tpvVentas.web.js", import.meta.url), "utf8");
    assert.match(catalogBackend, /TPV_QA_FIXTURES\.CUSTOMER/);
    assert.match(catalogBackend, /TPV_QA_FIXTURES\.STAFF/);
    assert.match(catalogBackend, /syntheticOnly: true/);
    assert.doesNotMatch(catalogBackend, /contactsV5|extendedBookings|staffMembers|tpvNativeReaders/);
    assert.match(sales, /TPV_QA_CUSTOMER_NOT_ALLOWED/);
    assert.match(sales, /TPV_QA_BOOKINGS_DISABLED/);
    assert.match(sales, /TPV_QA_STAFF_NOT_ALLOWED/);
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
    assert.match(giftBackend, /TPV_GIFT_CARDS_DISABLED_IN_QA/);
    assert.doesNotMatch(giftBackend, /giftVouchers|@wix\/ecom|auth\.elevate/);
    assert.match(giftBackend, /syntheticOnly: true/);
    assert.doesNotMatch(giftBackend, /insertItem|updateItem|redeemGiftCard|console\.(log|error)/);
    assert.doesNotMatch(html, /Saldo real · deshabilitado en QA/);
    assert.doesNotMatch(html, /id="giftCardAmount"/);
    assert.doesNotMatch(html, /id="giftCardType"/);
    assert.doesNotMatch(html, /function renderGiftCard/);
});
