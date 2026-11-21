import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Script } from "node:vm";

const repoRoot = new URL("../../../", import.meta.url);
const read = (path) => readFile(new URL(path, repoRoot), "utf8");

test("TPV HTML script parses and wires every visible POS operation", async () => {
    const html = await read("%23htmlTPV.txt");
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    assert.ok(script);
    assert.doesNotThrow(() => new Script(script));
    for (const id of ["openSession", "operatorBtn", "refresh", "saveSale", "cashIn", "cashOut", "refund", "ticketX", "ticketZ", "cashSummary", "audit", "printLast"]) {
        assert.ok(html.includes('id="' + id + '"'), "missing visible POS control " + id);
    }
    for (const type of ["SESSION_OPEN", "CATALOG_SERVICES", "CATALOG_PRODUCTS", "CATALOG_STAFF", "SALE_REGISTER", "CASH_MOVEMENT", "REFUND", "TICKET_X", "TICKET_Z", "SESSION_SUMMARY", "AUDIT_LIST"]) {
        assert.ok(script.includes('"' + type + '"'), "missing widget operation " + type);
    }
});

test("POS buttons send backend-compatible DTOs and do not discard failed sales", async () => {
    const html = await read("%23htmlTPV.txt");
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] || "";
    const controller = await read("src/public/tpvPageController.js");
    assert.match(script, /payments:\[\{paymentMethod,amount\}\]/);
    assert.match(script, /differenceReason:/);
    assert.match(script, /TICKET_X.*sessionId:state\.session\?\.sessionId/);
    assert.doesNotMatch(script, /TICKET_X",\\{sessionId:state\\.session\\?\\.sessionId,countedCash/);
    assert.match(script, /impuestosImporte:0/);
    assert.match(script, /action\("SALE_REGISTER"[\s\S]*?\.then\(result=>\{state\.lastSale=result/);
    assert.match(controller, /lineas: lineItems\.map/);
    assert.match(controller, /pagos: payments\.map/);
    assert.match(controller, /medioPago:/);
    assert.match(controller, /importeCambio:/);
    assert.match(controller, /differenceReason:/);\n    assert.match(script, /function keyedAction/);\n    assert.match(script, /sessionStorage\.setItem\("mmTPVOperationKeys"/);\n    assert.match(script, /operationScope\(kind\)/);
});

test("taxes remain locked until Wix POS tax rules are mapped to per-line tax amounts", async () => {
    const html = await read("%23htmlTPV.txt");
    assert.match(html, /id="tax"[^>]*disabled/);
    assert.match(html, /Impuestos \(reglas Wix pendientes\)/);
    assert.match(html, /lineTaxMinor !== declaredTaxMinor/);
});
