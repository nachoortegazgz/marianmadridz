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
    for (const type of ["SESSION_OPEN", "CATALOG_SERVICES", "CATALOG_PRODUCTS", "CATALOG_VARIANTS", "CATALOG_STAFF", "CUSTOMERS_SEARCH", "SALE_REGISTER", "SALE_VALIDATE", "CASH_MOVEMENT", "PARTIAL_CASH_COUNT", "TICKET_X", "TICKET_Z", "SESSION_SUMMARY", "AUDIT_LIST"]) {
        assert.ok(script.includes('"' + type + '"'), "missing widget operation " + type);
    }
});

test("POS DTOs map to operational WebMethods without trusting client prices or totals", async () => {
    const html = await read("%23htmlTPV.txt");
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] || "";
    const controller = await read("src/public/tpvPageController.js");
    assert.match(script, /medioPago: state\.paymentMethod/);
    assert.match(script, /payments: state\.payments\.map\(\(payment\) =>/);
    assert.match(script, /differenceReason(?:\s*:|\s*,)/);
    assert.match(script, /call\("SALE_VALIDATE"/);
    assert.match(script, /saleReady !== true/);
    assert.doesNotMatch(script, /testReady|testCatalogReady|testRuntimeAvailable|testPersisted/);
    assert.doesNotMatch(script, /TPV_TEST_|sesión de prueba|venta de prueba|prueba V1/);
    assert.match(script, /selectCatalogItem/);
    assert.match(script, /CATALOG_VARIANTS/);
    assert.match(script, /call\("CUSTOMERS_SEARCH"/);
    const saleWriteBlock = controller.match(/case "SALE_REGISTER": \{([\s\S]*?)case "CASH_MOVEMENT":/)?.[1] || "";
    assert.match(saleWriteBlock, /return registrarVenta\(\{/);
    assert.match(saleWriteBlock, /itemId,/);
    assert.match(saleWriteBlock, /tipoLinea,/);
    assert.match(saleWriteBlock, /cantidad: numeric\(line\.cantidad/);
    assert.match(saleWriteBlock, /idempotencyKey: saleUuidV4Key\(payload\.idempotencyKey\)/);
    assert.doesNotMatch(saleWriteBlock, /precioUnitario|descuentoImporte|impuestosImporte|subtotalNeto|impuestosTotal|totalVenta/);
    assert.match(controller, /case "SALE_VALIDATE":[\s\S]*?return validarVentaBorrador\(\{ lineas, pagos \}\)/);
    assert.match(controller, /importeCambio:/);
    assert.match(script, /function parseLocalizedAmount/);
    assert.match(script, /function keyedAction/);
    assert.match(script, /sessionStorage\.setItem\(storageKey, key\)/);
    assert.match(script, /response\.status === "PENDING"/);
    assert.match(script, /outcomeUnknown:\s*true/);
    assert.match(script, /operationMayContinue:\s*true/);
});

test("TPV fiscal quotes expose readiness blockers and keep payments disabled without backend authorization", async () => {
    const html = await read("%23htmlTPV.txt");
    assert.match(html, /id="tax"[^>]*disabled/);
    assert.match(html, /Impuestos \(cálculo fiscal Wix\)/);
    assert.match(html, /call\("SALE_VALIDATE"/);
    assert.match(html, /data-method="BIZUM" disabled/);
    assert.match(html, /data-method="BONO" disabled/);
    assert.match(html, /data-method="TARJETA_REGALO" disabled/);
    assert.match(html, /data-method="OTROS" disabled/);
    assert.match(html, /const PAYMENT_METHODS = \["EFECTIVO", "TARJETA"\]/);
    assert.match(html, /state\.saleQuote\.totalVenta/);
    assert.match(html, /paymentReady = state\.saleQuote\?\.catalogVerified === true && state\.saleQuote\?\.taxVerified === true && state\.saleQuote\?\.commercialRecordReady === true && state\.operationalWritesAvailable === true/);
    assert.match(html, /state\.operationalWritesAvailable !== true/);
    assert.doesNotMatch(html, /testRuntimeAvailable|testReady|testCatalogReady|testPersisted|TPV_TEST_/);

    const controller = await read("src/public/tpvPageController.js");
    assert.match(controller, /async function dispatch\(message\)/);
    assert.match(controller, /validarVentaBorrador/);
    assert.match(controller, /registrarVenta/);
    assert.match(controller, /requiresReconciliation/);
    const sales = await read("src/backend/tpv/tpvVentas.web.js");
    const preparation = await read("src/backend/tpv/tpvSalePreparation.js");
    assert.match(sales, /saleReady: saleReadinessBlockers\.length === 0/);
    assert.match(sales, /PENDING_PAYMENT/);
    assert.match(sales, /BUSINESS_COLLECTIONS\.TRANSACCIONES_TPV/);
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

test("product selection resolves a concrete Catalog V3 variant and fails closed on unknown stock", async () => {
    const html = await read("%23htmlTPV.txt");
    const catalog = await read("src/backend/tpv/tpvCatalogo.web.js");
    assert.match(html, /if \(item\.tipoLinea === "PRODUCTO"\) \{/);
    assert.match(html, /if \(variants\.length === 1\)[\s\S]*?selected\.varianteId/);
    assert.match(html, /typeof variant\.varianteId === "string"/);
    assert.match(catalog, /variant\.inventoryStatus\?\.inStock === true/);
    assert.match(catalog, /variant\.inventoryStatus\?\.preorderEnabled === true/);
    assert.match(catalog, /toMinorUnitsStrict\(raw, "CATALOG_PRICE"\)/);
});
