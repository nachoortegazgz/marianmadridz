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
    assert.match(html, /function renderCustomerBookings/);
    assert.match(html, /Nacho Pitt · cliente de prueba/);
});

test("TPV Gift Cards exposes read-only balance lookup without storing or returning the raw code", async () => {
    const giftBackend = await readFile(new URL("../tpv/tpvGiftCards.web.js", import.meta.url), "utf8");
    assert.match(giftBackend, /TPV_GIFT_CARDS_DISABLED_IN_QA/);
    assert.doesNotMatch(giftBackend, /giftVouchers|@wix\/ecom|auth\.elevate/);
    assert.match(giftBackend, /syntheticOnly: true/);
    assert.doesNotMatch(giftBackend, /insertItem|updateItem|redeemGiftCard|console\.(log|error)/);
    assert.match(html, /Saldo real · deshabilitado en QA/);
    assert.match(html, /function renderGiftCard/);
});
