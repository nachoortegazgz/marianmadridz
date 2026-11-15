import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../../../%23htmlTPV.txt", import.meta.url), "utf8");
const controller = await readFile(new URL("../../public/tpvPageController.js", import.meta.url), "utf8");

test("TPV controller exposes only authenticated read-only cashier state", () => {
    assert.match(controller, /getCashierState/);
    assert.match(controller, /requireCajero/);
    assert.match(controller, /MESSAGE_TYPES\.READY/);
    assert.match(controller, /"CASHIER_STATE"/);
    assert.doesNotMatch(
        controller,
        /registerManualTransaction|registerZClosing|createCheckout|createOrder|createPayment|refund/i
    );
});

test("TPV HTML uses versioned messaging and browser-local ticket drafts", () => {
    assert.match(html, /MM_READY/);
    assert.match(html, /CASHIER_STATE_RES/);
    assert.match(html, /window\.parent\.postMessage/);
    assert.match(html, /state\.items/);
    assert.match(html, /SIN COBRO/);
    assert.doesNotMatch(html, /fetch\s*\(|XMLHttpRequest|wix-data|suppressAuth/i);
});

test("TPV mutation controls remain visibly disabled", () => {
    for (const label of ["Cobrar", "No hay WebMethod de apertura certificado", "Cierre Z deshabilitado", "Crear o modificar reserva"]) {
        assert.ok(html.includes(label), "expected guarded UI capability: " + label);
    }
    assert.match(html, /disabled title="Pendiente de integración segura"/);
});
