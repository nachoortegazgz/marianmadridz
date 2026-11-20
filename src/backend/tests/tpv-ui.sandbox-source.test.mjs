import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Script } from "node:vm";

const html = await readFile(new URL("../../../%23htmlTPV.txt", import.meta.url), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test("TPV HTML SANDBOX script parses and wires the active synthetic workflows", () => {
    assert.ok(script);
    assert.doesNotThrow(() => new Script(script));

    for (const message of [
        "SANDBOX_SESSION_OPEN",
        "SANDBOX_SALE_REGISTER",
        "SANDBOX_CASH_MOVEMENT",
        "SANDBOX_REFUND",
        "SANDBOX_TICKET_X",
        "SANDBOX_TICKET_Z",
        "SANDBOX_PAYMENT_VALIDATE",
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
