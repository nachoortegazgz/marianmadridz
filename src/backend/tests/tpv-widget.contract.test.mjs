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
