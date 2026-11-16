import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Script } from "node:vm";

const html = await readFile(new URL("../../../%23htmlTPV.txt", import.meta.url), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test("TPV HTML QA script parses and wires persistent synthetic workflows", () => {
    assert.ok(script);
    assert.doesNotThrow(() => new Script(script));
    for (const message of ["QA_SESSION_OPEN", "QA_SALE_REGISTER", "QA_CASH_MOVEMENT", "QA_REFUND", "QA_TICKET_X", "QA_TICKET_Z", "QA_AUDIT_LIST"]) {
        assert.ok(script.includes(message), "missing bridge message " + message);
    }
    assert.match(html, /Guardar venta sintética en QA/);
    assert.match(html, /TPV_QA_\*/);
    assert.match(html, /Cerrar sesión QA/);
    assert.doesNotMatch(html, /send\("TICKET_X_PREVIEW"/);
});
