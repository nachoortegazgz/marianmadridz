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
    assert.match(script, /call\("SALE_VALIDATE"/);
    assert.match(script, /state\.saleQuote\.totalVenta/);
    assert.match(script, /saleReady !== true/);
    assert.match(script, /selectCatalogItem/);
    assert.match(script, /CATALOG_VARIANTS/);
    assert.match(script, /addCatalogLine\(item, selected\.precioMinor, selected\.varianteId, selected\.concepto\)/);
    assert.match(script, /call\("CUSTOMERS_SEARCH"/);
    assert.doesNotMatch(script.match(/keyedAction\("SALE", "SALE_REGISTER", \{[\s\S]*?\}, "SALE_REGISTER_RES"\)/)?.[0] || "", /customerIdentityId|precioUnitario|impuestosImporte|subtotal:|tax:|total,/);
    assert.match(script, /keyedAction\("SALE", "SALE_REGISTER"/);
    assert.match(controller, /const lineas = payload\.lineItems\.map/);
    assert.match(controller, /const pagos = \(payload\.payments \|\| \[\]\)\.map/);
    assert.match(controller, /case "SALE_REGISTER": \{[\s\S]*?return registrarVenta\(\{/);
    const saleWriteBlock = controller.match(/case "SALE_REGISTER": \{([\s\S]*?)case "SALE_VALIDATE":/)?.[1] || "";
    assert.match(saleWriteBlock, /itemId,/);
    assert.match(saleWriteBlock, /tipoLinea,/);
    assert.match(saleWriteBlock, /cantidad: numeric\(line\.cantidad/);
    assert.match(saleWriteBlock, /idempotencyKey: saleUuidV4Key\(payload\.idempotencyKey\)/);
    assert.doesNotMatch(saleWriteBlock, /precioUnitario|descuentoImporte|impuestosImporte|subtotalNeto|impuestosTotal|totalVenta/);
    assert.match(controller, /importeCambio:/);
    assert.match(controller, /differenceReason:/);
    assert.match(script, /const amount = num\(\$\("paymentAmount"\)\.value\)/);
    assert.match(script, /inputmode="decimal"/);
    assert.match(script, /function parseLocalizedAmount/);
    assert.match(script, /function publicErrorMessage/);
    assert.match(script, /TPV_INVALID_FORMAT_/);
    assert.match(script, /No repitas la acción/);
    assert.match(script, /const countedCashInput = \$\("partialCountCash"\)\.value;\s*const countedCash = num\(countedCashInput\);\s*if \(!String\(countedCashInput \?\? ""\)\.trim\(\) \|\| !Number\.isFinite\(countedCash\) \|\| countedCash < 0\) throw new Error\("TPV_INVALID_AMOUNT"\);/);
    assert.match(script, /const countedCashInput = \$\("countedCash"\)\.value;\s*const countedCash = num\(countedCashInput\);\s*if \(!String\(countedCashInput \?\? ""\)\.trim\(\) \|\| !Number\.isFinite\(countedCash\) \|\| countedCash < 0\) throw new Error\("TPV_INVALID_AMOUNT"\);/);
    assert.match(script, /function keyedAction/);
    assert.match(script, /sessionStorage\.setItem\(storageKey, key\)/);
    assert.match(script, /keyPrefix \+ "_" \+ crypto\.randomUUID/);
    assert.match(script, /response\.status === "PENDING"/);
    assert.match(script, /error\.outcomeUnknown = true/);
    assert.match(script, /error\.operationMayContinue = true/);
    assert.match(script, /if \(result !== null && result !== undefined\) \{\s*sessionStorage\.removeItem\(storageKey\)/);

});

test("TPV tax quotes use live Wix tax settings and block unready sales", async () => {
    const html = await read("%23htmlTPV.txt");
    assert.match(html, /id="tax"[^>]*disabled/);
    assert.match(html, /Impuestos \(cálculo fiscal Wix\)/);
    assert.match(html, /call\("SALE_VALIDATE"/);
    assert.match(html, /state\.saleQuote\.totalVenta/);
    assert.match(html, /WIX_TAX_REGION_EXCLUDES_TAX/);
    assert.match(html, /No se aceptan pagos: la venta todavía no está autorizada/);
    assert.match(html, /const sequence = \+\+state\.quoteSequence/);
    assert.match(html, /if \(sequence !== state\.quoteSequence\) return/);
    assert.match(html, /paymentReady = state\.saleQuote\?\.saleReady === true/);
    assert.match(html, /document\.querySelectorAll\("\[data-cash\], \[data-method\]"\)/);

    const controller = await read("src/public/tpvPageController.js");
    assert.match(controller, /"SALE_VALIDATE"/);
    assert.match(controller, /validarVentaBorrador/);
    assert.match(controller, /quote\.saleReady !== true/);
    assert.match(controller, /TPV_SALE_NOT_READY: Object\.freeze/);
    assert.match(controller, /requiresReconciliation/);
    assert.match(controller, /hasOwnProperty\.call\(result, "data"\)/);
    assert.match(controller, /hasOwnProperty\.call\(result, "error"\)/);

    const sales = await read("src/backend/tpv/tpvVentas.web.js");
    const preparation = await read("src/backend/tpv/tpvSalePreparation.js");
    assert.match(sales, /saleReady: false/);
    assert.match(sales, /TPV_OPERATIONAL_LEDGER_NOT_CONFIGURED/);
    assert.match(preparation, /taxSettings\.getTaxSettings/);
    assert.match(preparation, /taxCalculation\.calculateTax/);
    assert.match(preparation, /auth\.elevate/);
});
 
test("TPV controller parses localized amounts without guessing ambiguous separators", async () => {
    const controller = await read("src/public/tpvPageController.js");
    const numericSource = controller.match(/function numeric\([\s\S]*?\n}\n/)?.[0];
    assert.ok(numericSource, "controller numeric normalizer must exist");
    const context = {};
    new Script(numericSource + "\nglobalThis.numeric = numeric;").runInNewContext(context);
    assert.equal(context.numeric("12,50", "AMOUNT"), 12.5);
    assert.equal(context.numeric("12.50", "AMOUNT"), 12.5);
    assert.equal(context.numeric("1.234,56", "AMOUNT"), 1234.56);
    assert.equal(context.numeric("1,234.56", "AMOUNT"), 1234.56);
    assert.throws(() => context.numeric("1.234", "AMOUNT"), /TPV_INVALID_AMOUNT/);
    assert.throws(() => context.numeric("12,345", "AMOUNT"), /TPV_INVALID_AMOUNT/);
    assert.throws(() => context.numeric(12.345, "AMOUNT"), /TPV_INVALID_AMOUNT/);
});

test("product selection always resolves a concrete Catalog V3 variant and fails closed on unknown stock", async () => {
    const html = await read("%23htmlTPV.txt");
    const catalog = await read("src/backend/tpv/tpvCatalogo.web.js");
    assert.match(html, /if \(item\.tipoLinea === "PRODUCTO"\) \{/);
    assert.match(html, /if \(variants\.length === 1\)[\s\S]*?selected\.varianteId/);
    assert.match(html, /typeof variant\.varianteId === "string"/);
    assert.match(catalog, /variant\.inventoryStatus\?\.inStock === true/);
    assert.match(catalog, /variant\.inventoryStatus\?\.preorderEnabled === true/);
    assert.match(catalog, /toMinorUnitsStrict\(raw, "CATALOG_PRICE"\)/);
});
