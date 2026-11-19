import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Script } from "node:vm";

const html = await readFile(new URL("../../../%23htmlTPV.txt", import.meta.url), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test("TPV HTML QA script parses and wires the active synthetic workflows", () => {
    assert.ok(script);
    assert.doesNotThrow(() => new Script(script));

    for (const message of [
        "QA_SESSION_OPEN",
        "QA_SALE_REGISTER",
        "QA_CASH_MOVEMENT",
        "QA_REFUND",
        "QA_TICKET_X",
        "QA_TICKET_Z",
        "QA_PAYMENT_VALIDATE",
        "VALIDATE_SALE_DRAFT",
    ]) {
        assert.ok(script.includes(message), "missing active workflow message " + message);
    }

    for (const control of [
        'id="saveSale"',
        'id="openSession"',
        'id="cashMovement"',
        'id="refund"',
        'id="ticketX"',
        'id="ticketZ"',
    ]) {
        assert.ok(html.includes(control), "missing TPV control " + control);
    }

    assert.match(html, /Emitir tarjeta regalo<\/button>/);
    assert.match(html, /Consultar tarjeta regalo<\/button>/);
    assert.match(html, /Emitir factura completa<\/button>/);
    assert.match(html, /Emitir rectificativa<\/button>/);
    assert.match(html, /id="taxTotal"[^>]*disabled/);
    assert.doesNotMatch(html, /send\("TICKET_X_PREVIEW"/);
    assert.doesNotMatch(html, /fetch\s*\(|XMLHttpRequest|wix-data|suppressAuth/i);
});
