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
    for (const id of ["openCash", "professionalSelect", "selectClient", "refreshCatalog", "saveSale", "cashIn", "cashOut", "refund", "ticketX", "ticketZ", "cashSummary", "audit", "printLast"]) {
        assert.ok(html.includes('id="' + id + '"'), "missing visible POS control " + id);
    }
    for (const type of ["SESSION_OPEN", "CATALOG_SERVICES", "CATALOG_PRODUCTS", "CATALOG_VARIANTS", "CATALOG_STAFF", "CUSTOMERS_SEARCH", "SALE_REGISTER", "CASH_MOVEMENT", "REFUND", "TICKET_X", "TICKET_Z", "SESSION_SUMMARY", "AUDIT_LIST"]) {
        assert.ok(script.includes('"' + type + '"'), "missing widget operation " + type);
    }
});

test("POS buttons send backend-compatible DTOs and do not discard failed sales", async () => {
    const html = await read("%23htmlTPV.txt");
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] || "";
    const controller = await read("src/public/tpvPageController.js");
    assert.match(script, /payments: state\.payments\.map/);
    assert.match(script, /differenceReason(?:\s*:|\s*,)/);
    assert.match(script, /TICKET_X",\s*\{\s*sessionId:\s*state\.session\?\.sessionId\s*\}/);
    assert.doesNotMatch(script, /TICKET_X",\s*\{\s*sessionId:\s*state\.session\?\.sessionId\s*,\s*countedCash/);
    assert.match(script, /impuestosImporte: 0/);
    assert.match(script, /selectCatalogItem/);
    assert.match(script, /CATALOG_VARIANTS/);
    assert.match(script, /addCatalogLine\(item, selected\.precioMinor, selected\.varianteId, selected\.concepto\)/);
    assert.match(script, /call\("CUSTOMERS_SEARCH"/);
    assert.match(script, /customerIdentityId: state\.customerIdentityId/);
    assert.match(script, /keyedAction\("SALE", "SALE_REGISTER"/);
    assert.match(controller, /lineas: lineItems\.map/);
    assert.match(controller, /pagos: payments\.map/);
    assert.match(controller, /medioPago:/);
    assert.match(controller, /importeCambio:/);
    assert.match(controller, /differenceReason:/);
    assert.match(script, /const amount = num\(\$\("paymentAmount"\)\.value\)/);
    assert.match(script, /inputmode="decimal"/);
    assert.match(script, /function parseLocalizedAmount/);
    assert.match(script, /function publicErrorMessage/);
    assert.match(script, /TPV_INVALID_FORMAT_/);
    assert.match(script, /No repitas la acción/);
    assert.match(script, /const countedCash = num\(\$\("partialCountCash"\)\.value\);\s*if \(!Number\.isFinite\(countedCash\) \|\| countedCash < 0\) throw new Error\("TPV_INVALID_AMOUNT"\);/);
    assert.match(script, /const countedCash = num\(\$\("countedCash"\)\.value\);\s*if \(!Number\.isFinite\(countedCash\) \|\| countedCash < 0\) throw new Error\("TPV_INVALID_AMOUNT"\);/);
    assert.match(script, /function keyedAction/);
    assert.match(script, /sessionStorage\.setItem\(storageKey, key\)/);
    assert.match(script, /keyPrefix \+ "_" \+ crypto\.randomUUID/);
});

test("taxes remain locked until Wix POS tax rules are mapped to per-line tax amounts", async () => {
    const html = await read("%23htmlTPV.txt");
    assert.match(html, /id="tax"[^>]*disabled/);
    assert.match(html, /Impuestos \(reglas Wix pendientes\)/);
    const controller = await read("src/public/tpvPageController.js");
    assert.match(controller, /lineTaxMinor !== declaredTaxMinor/);
});
