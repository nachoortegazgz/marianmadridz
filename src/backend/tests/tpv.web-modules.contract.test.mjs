import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { validateSaleDraft } from "../tpv/tpvValidation.js";

const backendRoot = new URL("../", import.meta.url);
const repoRoot = new URL("../../../", import.meta.url);

async function source(path) {
    return readFile(new URL(path, backendRoot), "utf8");
}

test("TPV sale draft validates report fields and minor-unit arithmetic", () => {
    const result = validateSaleDraft({
        lineas: [{
            tipoLinea: "SERVICIO",
            itemId: "service-1",
            concepto: "Servicio SANDBOX",
            cantidad: 1,
            precioUnitario: 100,
            descuentoImporte: 10,
            subtotalNeto: 90,
            impuestosImporte: 18.9,
            totalLinea: 108.9,
        }],
        pagos: [
            { medioPago: "EFECTIVO", importe: 40 },
            { medioPago: "TARJETA", importe: 68.9 },
        ],
    });

    assert.equal(result.totalVenta, 108.9);
    assert.equal(result.importePagado, 108.9);
    assert.equal(result.importePendiente, 0);
    assert.equal(result.estadoVenta, "COBRADA");
    assert.equal(result.persisted, false);
    assert.equal(result.realPayment, undefined);
});

test("TPV sale draft reconciles tax-inclusive catalog price without adding VAT twice", () => {
    const result = validateSaleDraft({
        lineas: [{
            tipoLinea: "PRODUCTO",
            itemId: "product-1",
            concepto: "Producto con IVA incluido",
            cantidad: 1,
            precioUnitario: 22.90,
            subtotalNeto: 18.93,
            impuestosImporte: 3.97,
            totalLinea: 22.90,
            taxIncludedInPrice: true,
        }],
        pagos: [{ medioPago: "EFECTIVO", importe: 22.90 }],
    });
    assert.equal(result.subtotalNeto, 18.93);
    assert.equal(result.impuestosTotal, 3.97);
    assert.equal(result.totalVenta, 22.90);
    assert.equal(result.lineas[0].taxIncludedInPrice, true);
});

test("TPV custom tariff lines remain explicitly typed and validated", () => {
    const result = validateSaleDraft({
        lineas: [{
            tipoLinea: "PERSONALIZADA",
            concepto: "Tarifa especial acordada",
            cantidad: 1,
            precioUnitario: 25,
            descuentoImporte: 0,
            impuestosImporte: 0,
        }],
        pagos: [{ medioPago: "EFECTIVO", importe: 25 }],
    });
    assert.equal(result.lineas[0].tipoLinea, "PERSONALIZADA");
    assert.equal(result.totalVenta, 25);
    assert.equal(result.importePendiente, 0);
});

test("TPV product variant identity is retained and restricted to product lines", () => {
    const product = validateSaleDraft({
        lineas: [{
            tipoLinea: "PRODUCTO",
            itemId: "product-123",
            varianteId: "variant-123",
            concepto: "Producto · Talla M",
            cantidad: 1,
            precioUnitario: 20,
            impuestosImporte: 0,
        }],
        pagos: [{ medioPago: "EFECTIVO", importe: 20 }],
    });
    assert.equal(product.lineas[0].varianteId, "variant-123");
    assert.throws(() => validateSaleDraft({
        lineas: [{
            tipoLinea: "SERVICIO",
            varianteId: "variant-123",
            concepto: "Servicio",
            cantidad: 1,
            precioUnitario: 20,
            impuestosImporte: 0,
        }],
        pagos: [{ medioPago: "EFECTIVO", importe: 20 }],
    }), /TPV_VARIANT_ONLY_FOR_PRODUCTS/);
});

test("TPV cash tender subtracts change before reconciling amount applied", () => {
    const result = validateSaleDraft({
        lineas: [{
            tipoLinea: "SERVICIO",
            concepto: "Servicio con cambio",
            cantidad: 1,
            precioUnitario: 40,
            descuentoImporte: 0,
            impuestosImporte: 0,
        }],
        pagos: [{ medioPago: "EFECTIVO", importe: 50, importeCambio: 10 }],
    });
    assert.equal(result.importePagado, 40);
    assert.equal(result.importePendiente, 0);
    assert.equal(result.pagos[0].importeAplicado, 40);
    assert.throws(
        () => validateSaleDraft({
            lineas: [{
                tipoLinea: "SERVICIO",
                concepto: "Cambio no efectivo",
                cantidad: 1,
                precioUnitario: 40,
                impuestosImporte: 0,
            }],
            pagos: [{ medioPago: "TARJETA", importe: 50, importeCambio: 10 }],
        }),
        /TPV_CHANGE_REQUIRES_CASH/
    );
});

test("TPV mixed tender breakdown reconciles commercial totals separately from physical cash", () => {
    const result = validateSaleDraft({
        lineas: [{
            tipoLinea: "SERVICIO",
            concepto: "Venta mixta SANDBOX",
            cantidad: 1,
            precioUnitario: 100,
            descuentoImporte: 0,
            impuestosImporte: 0,
        }],
        pagos: [
            { medioPago: "EFECTIVO", importe: 45, importeCambio: 5 },
            { medioPago: "TARJETA", importe: 35 },
            { medioPago: "BIZUM", importe: 25 },
        ],
    });

    assert.equal(result.totalCobrado, 100);
    assert.equal(result.desgloseMedios.EFECTIVO, 40);
    assert.equal(result.desgloseMedios.TARJETA, 35);
    assert.equal(result.desgloseMedios.BIZUM, 25);
    assert.equal(result.desgloseMedios.OTROS, 0);
    assert.equal(result.efectivoRecibido, 45);
    assert.equal(result.cambioEntregado, 5);
    assert.equal(result.efectivoAplicado, 40);
    assert.equal(result.importePendiente, 0);
    assert.equal(result.realPayment, undefined);
});

test("TPV sale draft rejects invalid tax, overpayment, unknown methods and sub-cent arithmetic", () => {
    const valid = {
        lineas: [{
            tipoLinea: "PRODUCTO",
            concepto: "Producto SANDBOX",
            cantidad: 1,
            precioUnitario: 10,
            descuentoImporte: 0,
            impuestosImporte: 2.1,
        }],
    };

    assert.throws(
        () => validateSaleDraft({ ...valid, lineas: [{ ...valid.lineas[0], subtotalNeto: 9 }] }),
        /TPV_LINE_SUBTOTAL_MISMATCH/
    );
    assert.throws(
        () => validateSaleDraft({ ...valid, pagos: [{ medioPago: "EFECTIVO", importe: 20 }] }),
        /TPV_OVERPAYMENT/
    );
    assert.throws(
        () => validateSaleDraft({ ...valid, pagos: [{ medioPago: "UNKNOWN", importe: 12.1 }] }),
        /TPV_INVALID_PAYMENT_METHOD/
    );
    assert.throws(
        () => validateSaleDraft({ ...valid, pagos: [{ medioPago: "EFECTIVO", importe: 5, importeCambio: 6 }] }),
        /TPV_CHANGE_EXCEEDS_CASH_RECEIVED/
    );
    assert.throws(
        () => validateSaleDraft({
            lineas: [{
                tipoLinea: "PRODUCTO",
                concepto: "Unidad fraccionada",
                cantidad: 0.5,
                precioUnitario: 0.01,
                impuestosImporte: 0,
            }],
        }),
        /TPV_INVALID_LINE_AMOUNT/
    );
});

test("TPV dependency manifest and npm lockfile remain synchronized", async () => {
    const packageJson = JSON.parse(await readFile(new URL("package.json", repoRoot), "utf8"));
    const packageLock = JSON.parse(await readFile(new URL("package-lock.json", repoRoot), "utf8"));
    assert.deepEqual(
        packageLock.packages[""].dependencies,
        packageJson.dependencies
    );
    assert.equal(packageJson.dependencies["@wix/stores"], "1.0.997");
});

test("TPV WebMethods isolate synthetic test records from operational ledgers", async () => {
    const files = [
        "tpv/tpvCaja.web.js",
        "tpv/tpvVentas.web.js",
        "tpv/tpvCatalogo.web.js",
        "tpv/tpvGiftCards.web.js",
        "tpv/tpvPagos.web.js",
        "tpv/tpvMovimientos.web.js",
        "tpv/tpvDevoluciones.web.js",
        "tpv/tpvCierres.web.js",
        "tpv/tpvAuditoria.web.js",
        "tpv/tpvPermisos.web.js",
        "tpv/tpvUtils.web.js",
    ];
    const contents = await Promise.all(files.map(source));
    const joined = contents.join("\n");
    assert.match(joined, /webMethod\(\s*Permissions\.SiteMember/);
    assert.match(joined, /requireCajero/);
    const testRuntime = await source("tpv/tpvTestRuntime.web.js");
    assert.match(testRuntime, /registrarVentaPrueba/);
    assert.match(testRuntime, /registrarDevolucionPrueba/);
    assert.match(testRuntime, /generarCierreZPrueba/);
    assert.match(joined, /TPV_COLLECTIONS/);
    assert.doesNotMatch(joined, /contactsV5|extendedBookings|giftVouchers|staffMembers|staff\?\.memberId/);
    const cashierModule = await source("tpv/tpvCaja.web.js");
    assert.doesNotMatch(cashierModule, /backend\/cajas\.web|CajaActual|getCashierState/);
    const payments = await source("tpv/tpvPagos.web.js");
    assert.doesNotMatch(payments, /simularPasarelaPago|simularReembolsoPasarela|simulateGatewayPayment|simulateGatewayRefund/);
    assert.doesNotMatch(payments, /SIMULATED|SANDBOX/);
    assert.doesNotMatch(payments, /wixPay|checkout|createOrder|processRefund/i);

    const sales = await source("tpv/tpvVentas.web.js");
    assert.doesNotMatch(sales, /procesarDevolucion/);
    assert.doesNotMatch(sales, /realPayment: false|isSynthetic: true/);
    assert.match(sales, /PENDING_PAYMENT/);
    assert.match(sales, /sourceType: "SYNTHETIC"/);
    assert.match(sales, /getMyCajeroContext/);
    assert.match(sales, /prepareTpvSaleCatalog/);
    assert.match(sales, /catalogVerified: true/);
    assert.match(sales, /taxVerified: true/);
    assert.match(sales, /paymentVerified: false/);
    assert.match(sales, /saleReady: saleReadinessBlockers\.length === 0/);
    assert.match(sales, /const containsProducts = prepared\.lineas\.some/);
    assert.match(sales, /if \(containsProducts\)/);
    assert.match(sales, /inventoryVerified: !containsProducts/);
    assert.match(sales, /UUID_V4/);
    assert.ok(sales.includes("BUSINESS_COLLECTIONS.TRANSACCIONES_TPV"));
    assert.ok(sales.includes("getItem("));
    assert.match(sales, /async \(input = \{\}\)/);
    assert.doesNotMatch(sales, /insertTpvEvent/);
    assert.match(sales, /appendTpvAudit/);
    assert.match(sales, /withTpvSessionLock/);
    assert.ok(sales.includes("insertItem(BUSINESS_COLLECTIONS.TRANSACCIONES_TPV"));
    const refunds = await source("tpv/tpvDevoluciones.web.js");
    const movements = await source("tpv/tpvMovimientos.web.js");
    const cash = await source("tpv/tpvCaja.web.js");
    const closures = await source("tpv/tpvCierres.web.js");
    assert.match(refunds, /TPV_REFUND_PROVIDER_NOT_CONFIGURED/);
    assert.doesNotMatch(refunds, /insertTpvEvent|appendTpvAudit|withTpvSaleLock/);
    assert.match(movements, /withTpvSessionLock\(session\.sessionId/);
    assert.match(cash, /withTpvSessionLock\(session\.sessionId/);
    assert.match(closures, /withTpvSessionLock\(session\.sessionId/);
    assert.doesNotMatch(joined, /registerManualTransaction|registerZClosing|createCheckout|createOrder|createPayment|processRefund/i);

    const repository = await source("tpv/tpvRepository.js");
    assert.match(repository, /insertItem\(/);
    assert.match(repository, /CONSISTENCY\.STRONG/);
    assert.match(repository, /requestFingerprint/);
    assert.match(repository, /TPV_COLLECTIONS/);
    assert.match(repository, /CONTROL_TYPE\.TPV_SESSION_LOCK/);
    assert.match(repository, /updateItem\(BUSINESS_COLLECTIONS\.CAJA_ACTUAL/);
    const cashier = await source("tpv/tpvCaja.web.js");
    assert.match(cashier, /withTpvSessionLock\(sessionId, traceId/);
    assert.doesNotMatch(repository, /removeById\(|bulkUpdate\(|bulkRemove\(/);

    const policy = await source("dataAccessPolicy.js");
    const config = await source("internalConfig.js");
    assert.doesNotMatch(policy, /TPV_RUNTIME_POLICY|TPV_SANDBOX_SYNTHETIC|_isSyntheticTpvRecord/);
    assert.match(policy, /CMS_TPV_LEDGER_WRITES_DISABLED/);
    assert.match(policy, /APPEND_ONLY_COLLECTIONS/);
    assert.match(config, /TPV_RUNTIME_POLICY/);
    assert.match(config, /SOURCE_TYPE: "TPV"/);
    assert.match(config, /TPV_HISTORICAL_POLICY/);
    assert.doesNotMatch(config, /ALLOW_REAL_PAYMENTS|ALLOW_NATIVE_WRITES|CAPABILITIES:/);
    assert.match(await readFile(new URL("../public/tpvPageController.js", backendRoot), "utf8"), /obtenerConfiguracionTPV/);
    const controller = await readFile(new URL("../public/tpvPageController.js", backendRoot), "utf8");
    assert.doesNotMatch(controller, /environment:|previewOnly:|syntheticOnly:|realPaymentsEnabled:|fiscalWritesEnabled:/);
    assert.match(config, /LEGACY_RUN_ID: "TPVSANDBOX-DEV-/);
    assert.match(config, /TPV_EVENT_MOVEMENT_TYPES/);
    for (const writer of [cash, movements, closures]) {
        assert.match(writer, /requireAdmin/);
    }
    assert.match(sales, /requireCajero/);
});

test("TPV catalog uses native Wix Contacts and Bookings staff with MapaStaff resource mapping", async () => {
    const catalog = await source("tpv/tpvCatalogo.web.js");
    const directory = await source("tpv/tpvNativeDirectory.js");
    const movements = await source("tpv/tpvMovimientos.web.js");
    assert.match(directory, /contactsV5\.searchContacts/);
    assert.match(directory, /contactsV5\.getContact/);
    assert.match(directory, /staffMembers\.queryStaffMembers/);
    assert.match(directory, /BUSINESS_COLLECTIONS\.MAPA_STAFF/);
    assert.match(directory, /resourceId/);
    assert.match(catalog, /searchTpvContacts/);
    assert.match(catalog, /listAuthorizedProfessionals/);
    assert.match(catalog, /resolveTpvContact/);
    assert.match(movements, /resolveAuthorizedProfessional/);
    for (const file of [catalog, directory, movements]) {
        assert.doesNotMatch(file, /TPV_IDENTITY_TYPES|listTpvIdentities|getTpvIdentity/);
    }
    assert.match(catalog, /formattedValue/);
    assert.match(catalog, /precioMinor/);
    assert.match(catalog, /import \{ auth \} from ["']@wix\/essentials["']/);
    assert.match(catalog, /catalogVersioning\.getCatalogVersion/);
    assert.match(catalog, /catalogVersionPromise = getCatalogVersionElevated\(\)/);
    assert.doesNotMatch(catalog, /catalogVersioning\.getCatalogVersion\(\)/);
    assert.match(catalog, /auth\.elevate\(catalogVersioning\.getCatalogVersion\)/);
    assert.match(catalog, /auth\.elevate\(services\.queryServices\)/);
    assert.match(catalog, /auth\.elevate\(productsV3\.queryProducts\)/);
    assert.match(catalog, /auth\.elevate\(productsV3\.getProduct\)/);
    assert.match(catalog, /productsV3\.queryProducts/);
    assert.match(catalog, /productsV3\.getProduct/);
    assert.match(catalog, /varianteId: variant\._id/);
    assert.doesNotMatch(catalog, /varianteId: variant\.id/);
    assert.match(catalog, /visibleEnPos: product\.visibleInPos !== false/);
    assert.match(catalog, /minPriceVariant\?\.price\?\.actualPrice/);
    const controller = await readFile(new URL("../public/tpvPageController.js", backendRoot), "utf8");
    assert.doesNotMatch(controller, /sessionId: String\(payload\.sessionId/);
    assert.match(controller, /sessionId: optionalString\(payload\.sessionId, 160\) \|\| ""/);
    const widget = await readFile(new URL("../../#htmlTPV.txt", backendRoot), "utf8").catch(() => "");
    if (widget) assert.doesNotMatch(widget, /requireOperator\(\)/);
});
test("TPV QA runtime uses a dedicated lock discriminator and deterministic ID helper", async () => {
    const repository = await source("tpv/tpvTestRuntimeRepository.js");
    const config = await source("internalConfig.js");
    assert.match(repository, /import \{ createHash \} from "node:crypto"/);
    assert.match(repository, /function makeTpvTestSessionLockId\(actorId\)/);
    assert.match(repository, /return "TPVT" \+ digest/);
    assert.doesNotMatch(repository, /makeTpvSessionLockId/);
    assert.match(repository, /CONTROL_TYPE\.TPV_TEST_SESSION_LOCK/);
    assert.match(repository, /const RUN_TTL_MS = 24 \* 60 \* 60 \* 1000/);
    assert.doesNotMatch(repository, /CONTROL_TYPE\.TPV_SESSION_LOCK/);
    assert.match(config, /TPV_TEST_SESSION_LOCK: "TPV_TEST_SESSION_LOCK"/);
    assert.match(config, /\[CONTROL_TYPE\.TPV_TEST_SESSION_LOCK\]: Object\.freeze/);
});

test("synthetic QA records are not consumed by operational ledgers, closures or cash reports", async () => {
    const paths = [
        "cajas.web.js",
        "accountingLedger.js",
        "eventLog.js",
        "tpv/tpvRepository.js",
        "tpv/tpvCaja.web.js",
        "tpv/tpvCierres.web.js",
        "tpv/tpvMovimientos.web.js",
        "tpv/tpvDevoluciones.web.js",
    ];
    for (const path of paths) {
        const file = await source(path);
        assert.doesNotMatch(file, /TPV_TEST_RUN|TPV_TEST_SESSION_LOCK/,
            path + " must not query or consume synthetic QA records");
    }
    const repository = await source("tpv/tpvTestRuntimeRepository.js");
    assert.match(repository, /wql\.eq\("controlType", CONTROL_TYPE\.TPV_TEST_RUN\)/);
});

test("legacy TPV QA runtime remains isolated pending its controlled retirement", async () => {
    const runtime = await source("tpv/tpvTestRuntime.web.js");
    const repository = await source("tpv/tpvTestRuntimeRepository.js");
    const core = await source("tpv/tpvTestRuntimeCore.js");
    const config = await source("internalConfig.js");
    const contracts = [
        "obtenerEstadoCajaPrueba",
        "abrirSesionCajaPrueba",
        "validarVentaBorradorPrueba",
        "registrarVentaPrueba",
        "registrarMovimientoCajaPrueba",
        "registrarArqueoParcialPrueba",
        "registrarDevolucionPrueba",
        "generarControlXPrueba",
        "generarCierreZPrueba",
        "obtenerResumenCajaPrueba",
        "obtenerAuditoriaTPVPrueba",
        "exportarMovimientosCajaPrueba",
    ];
    for (const name of contracts) {
        assert.match(runtime, new RegExp("export const " + name + " = webMethod\\("));
    }
    assert.match(runtime, /requireAdmin/);
    assert.match(runtime, /prepareTpvSaleCatalog/);
    assert.match(runtime, /validateSaleDraft/);
    assert.match(runtime, /getTpvWriteV1Blockers/);
    assert.match(runtime, /realPayment: false/);
    assert.match(runtime, /externalSideEffects: false/);
    assert.match(runtime, /testPersisted: true/);
    assert.match(repository, /CONTROL_TYPE\.TPV_TEST_RUN/);
    assert.match(repository, /acquireTpvTestSessionLock/);
    assert.match(repository, /releaseTpvTestSessionLock/);
    assert.match(repository, /makeTpvTestSessionLockId/);
    assert.doesNotMatch(repository, /makeTpvSessionLockId/);
    assert.match(repository, /CONTROL_TYPE\.TPV_TEST_SESSION_LOCK/);
    assert.match(repository, /TPV_TEST_ADMIN:/);
    assert.match(repository, /buildData/);
    assert.match(repository, /requestFingerprint/);
    assert.match(repository, /bulkPatchItems/);
    assert.match(repository, /CONSISTENCY\.STRONG/);
    assert.match(runtime, /PRODUCTS_CATALOG_TAX_ONLY_NO_STOCK_MUTATION/);
    assert.match(core, /sourceType: "SYNTHETIC"/);
    assert.match(core, /processingMode: "INTERNAL"/);
    assert.match(core, /reconciliationStatus: "NOT_RECONCILED"/);
    assert.match(config, /TPV_TEST_RUN: "TPV_TEST_RUN"/);
    assert.ok(config.includes("[CONTROL_TYPE.TPV_TEST_RUN]: Object.freeze"));
});

test("TPV page is wired to the native POS widget bridge and operational backend exports", async () => {
    const [page, controller, html, bridge] = await Promise.all([
        source("../pages/TPV.yl5th.js"),
        source("../public/tpvPageController.js"),
        source("../../%23htmlTPV.txt"),
        source("../public/widgetBridge.js"),
    ]);
    assert.match(page, /\$w\("#htmlTPV"\)/);
    assert.match(page, /initializeTpvPage\(widget\)/);
    assert.match(controller, /createWidgetBridge/);
    assert.match(controller, /MESSAGE_TYPES\.READY/);
    for (const method of [
        "obtenerEstadoCaja", "abrirSesionCaja", "registrarArqueoParcial",
        "validarVentaBorrador", "registrarVenta", "registrarMovimientoCaja",
        "registrarDevolucion", "generarControlX", "generarCierreZ",
        "obtenerResumenCaja", "obtenerAuditoriaTPVLista", "obtenerConfiguracionTPV",
        "obtenerServicios", "obtenerProductos", "obtenerVariantesProducto",
        "obtenerStaff", "buscarClientesTPV", "obtenerPermisosTPV",
    ]) assert.ok(controller.includes(method), "controller must consume " + method);
    assert.doesNotMatch(controller, /tpvTestRuntime\.web|obtenerEstadoCajaPrueba|abrirSesionCajaPrueba|registrarVentaPrueba|registrarMovimientoCajaPrueba|registrarDevolucionPrueba|generarControlXPrueba|generarCierreZPrueba|testRuntimeAvailable/);
    assert.match(bridge, /widgetElement\.onMessage/);
    assert.match(bridge, /widgetElement\.postMessage/);
    assert.match(html, /function resolveParentOrigin/);
    assert.match(html, /window\.parent\.postMessage\(message, PARENT_ORIGIN\)/);
    assert.match(html, /event\.origin !== PARENT_ORIGIN/);
    assert.doesNotMatch(html, /window\.parent\.postMessage\([^;]*,\s*["']\*["']/);
    assert.match(html, /type: "MM_READY"/);
    assert.match(html, /data\.type !== "MM_CONTEXT"/);
    assert.doesNotMatch(html, /environment|previewOnly|syntheticOnly|realPaymentsEnabled|fiscalWritesEnabled/);
    assert.match(html, /response\.status === "ERROR"/);
    assert.match(html, /call\("CASHIER_STATE"/);
    assert.match(html, /call\("CUSTOMERS_SEARCH"/);
    assert.match(html, /customerIdentityId/);
    assert.doesNotMatch(html, /customerContactId/);
    assert.match(html, /call\("CATALOG_VARIANTS"/);
    assert.match(html, /keyedAction\("SALE",\s*"SALE_REGISTER"/);
    assert.match(html, /keyedAction\("CASH_" \+ type,\s*"CASH_MOVEMENT"/);
    assert.match(html, /openCashMovement\("ENTRADA"\)/);
    assert.match(html, /openCashMovement\("SALIDA"\)/);
    assert.match(html, /keyedAction\("REFUND",\s*"REFUND"/);
    assert.match(html, /call\("TICKET_X",\s*\{\s*sessionId:\s*state\.session\?\.sessionId\s*\}/);
    assert.match(html, /keyedAction\("TICKET_Z",\s*"TICKET_Z"/);
});

test("TPV repository paginates reads and blocks Z close while sales are incomplete", async () => {
    const repository = await source("tpv/tpvRepository.js");
    const closures = await source("tpv/tpvCierres.web.js");
    assert.match(repository, /while \(pages\.some\(\(page\) => page\.hasNext\) && records\.length < maxRecords\)/);
    assert.match(repository, /pages\[index\] = await pages\[index\]\.next\(\)/);
    assert.match(repository, /recordTimestamp ASC/);
    assert.match(repository, /export async function getPendingTpvSales\(sessionId\)/);
    assert.match(repository, /export async function getPendingTpvRefunds\(sessionId\)/);
    assert.match(repository, /actualByMethod\.size !== expectedByMethod\.size/);
    assert.match(repository, /actual\.amountMinor !== expected\.amountMinor/);
    assert.match(repository, /refundCashMovements\.length !== expectedCash\.count/);
    assert.match(repository, /actualCashAmount !== expectedCash\.amountMinor/);
    assert.match(repository, /refundTotal !== Number\(refund\.amountMinor\)/);
    assert.match(closures, /input\.sessionId && input\.sessionId !== session\.sessionId/);
    assert.match(closures, /getPendingTpvSales\(session\.sessionId\)/);
    assert.match(closures, /TPV_PENDING_SALES_PREVENT_CLOSE/);
    assert.match(closures, /getPendingTpvRefunds\(session\.sessionId\)/);
    assert.match(closures, /TPV_PENDING_REFUNDS_PREVENT_CLOSE/);
    assert.match(closures, /totals\.reconciliationOk !== true/);
    assert.match(closures, /TPV_RECONCILIATION_FAILED/);
});

test("legacy TPV pages and direct operational writers are absent from the active site integration", async () => {
    const legacyPaths = [
        "src/pages/tpv.js",
        "src/pages/tpvCaja.web.js",
        "src/backend/tpvCaja.web.js",
        "src/backend/tpvVentas.web.js",
        "src/public/tpv/tpv-page.js",
    ];
    await Promise.all(legacyPaths.map((path) =>
        assert.rejects(
            readFile(new URL(path, repoRoot), "utf8"),
            (error) => error?.code === "ENOENT"
        )
    ));
    const activePage = await readFile(new URL("src/pages/TPV.yl5th.js", repoRoot), "utf8");
    assert.match(activePage, /public\/tpvPageController/);
    assert.doesNotMatch(activePage, /backend\/tpvCaja\.web|backend\/tpvVentas\.web/);
});


test("TPV public utility module exposes only the configuration contract consumed by the page controller", async () => {
    const utilities = await source("tpv/tpvUtils.web.js");
    const controller = await readFile(new URL("../public/tpvPageController.js", backendRoot), "utf8");
    assert.match(utilities, /export const obtenerConfiguracionTPV = webMethod/);
    assert.doesNotMatch(utilities, /validarImportesTPVSANDBOX|normalizePaymentMethod|toMinorUnits/);
    assert.match(controller, /obtenerConfiguracionTPV/);
    assert.doesNotMatch(controller, /validarImportesTPVSANDBOX/);
});

test("TPV operational ledger is neutral, write-disabled and isolated from historical reads", async () => {
    const [repository, config, utilities, movements, accessPolicy, hooks, validation] = await Promise.all([
        source("tpv/tpvRepository.js"),
        source("internalConfig.js"),
        source("tpv/tpvUtils.js"),
        source("tpv/tpvMovimientos.web.js"),
        source("dataAccessPolicy.js"),
        source("data.js"),
        source("validation.js"),
    ]);
    assert.match(config, /SOURCE_TYPE: "TPV"/);
    assert.match(config, /LEDGER_VERSION: "TPV_LEDGER_V3"/);
    assert.match(config, /SCHEMA_VERSION: 3/);
    assert.match(config, /TPV_HISTORICAL_POLICY/);
    assert.doesNotMatch(config, /ALLOW_REAL_PAYMENTS|ALLOW_NATIVE_WRITES|CAPABILITIES:/);
    assert.match(repository, /assertTpvOperationalLedgerConfigured/);
    assert.match(repository, /TPV_OPERATIONAL_LEDGER_NOT_CONFIGURED/);
    assert.match(repository, /_isCanonicalTpvLedgerItem/);
    assert.match(repository, /_isHistoricalTpvLedgerItem/);
    assert.doesNotMatch(repository, /sequenceNumber: 0|cashRegisterStatus: "SIMULACION"|CONFIRMADA_SINTETICA|CONFIRMADO_SINTETICO/);
    assert.match(repository, /export async function queryTpvOperationalLedgerRecords\(/);
    assert.match(repository, /filter\(_isHistoricalTpvLedgerItem\)/);
    assert.match(repository, /filter\(_isCanonicalTpvLedgerItem\)/);
    assert.match(repository, /export async function queryHistoricalTpvLedgerRecords\(/);
    assert.match(repository, /const records = \[\.\.\.currentSource\.items, \.\.\.legacy\.items, \.\.\.previous\.items\]/);
    assert.match(repository, /export async function queryTpvOperationalLedgerRecords\(/);
    assert.match(utilities, /export function makeTpvPayload/);
    assert.doesNotMatch(utilities, /makeSyntheticPayload|allowNativePayments|allowNativeRefunds/);
    assert.match(utilities, /TPV_OPERATIONAL_METADATA_FORBIDDEN/);
    assert.match(accessPolicy, /CMS_TPV_LEDGER_WRITES_DISABLED/);
    assert.doesNotMatch(accessPolicy, /_isSyntheticTpvRecord|SIMULATED_TPV_/);
    assert.match(hooks, /TPV_OPERATIONAL_LEDGER_NOT_CONFIGURED/);
    assert.doesNotMatch(hooks, /_isCurrentSyntheticTpvRow|SIMULATED_TPV_/);
    assert.match(repository, /TPV_LEDGER_SEQUENCE_OR_PREVIOUS_HASH_REQUIRED/);
    assert.match(validation, /historicalTpvLedgerRecord/);
    assert.match(movements, /queryTpvOperationalLedgerRecords\(\{ limit: 1000 \}\)/);
    assert.doesNotMatch(movements, /SIMULATED_TPV_SALE|CONFIRMADA_SINTETICA/);
    assert.doesNotMatch(movements, /queryHistoricalTpvLedgerRecords/);
    assert.doesNotMatch(movements, /SIMULATED_TPV_REFUND|CONFIRMADO_SINTETICO/);
    assert.match(movements, /\[SINTÉTICO\]/);
    assert.doesNotMatch(movements, /syntheticOnly: true/);
});



test("TPV sale persists a pending commercial transaction while refunds remain provider-gated", async () => {
    const sales = await source("tpv/tpvVentas.web.js");
    const refunds = await source("tpv/tpvDevoluciones.web.js");
    assert.match(sales, /PENDING_PAYMENT/);
    assert.match(sales, /TPV_PAYMENT_PROVIDER_NOT_CONFIGURED/);
    assert.ok(sales.includes("requiresReconciliation: draft.requiresReconciliation"));
    assert.match(refunds, /TPV_REFUND_PROVIDER_NOT_CONFIGURED/);
    assert.match(refunds, /async \(input = \{\}\) =>/);
    assert.match(refunds, /validateRefundRequest\(input\)/);
    assert.match(refunds, /payments\.length !== 1/);
    assert.match(refunds, /!idempotencyKey \|\| idempotencyKey\.length > 120/);
    assert.match(refunds, /SUPPORTED_REFUND_METHODS/);
    assert.match(refunds, /originalSaleId: request\.saleId/);
    const controller = await source("../public/tpvPageController.js");
    assert.match(controller, /case "REFUND":[\s\S]*?return registrarDevolucion\(\{[\s\S]*?saleId: optionalString\(payload\.saleId/);
    assert.match(controller, /idempotencyKey: key/);
    assert.doesNotMatch(sales, /CONFIRMADA|CONFIRMADO|SIMULATED/);
    assert.doesNotMatch(refunds, /CONFIRMADA|CONFIRMADO|SIMULATED|SYNTHETIC/);
    assert.doesNotMatch(sales, /insertTpvEvent/);
    assert.match(sales, /appendTpvAudit/);
    assert.doesNotMatch(refunds, /insertTpvEvent|appendTpvAudit/);
});


test("Ticket X and Z use neutral status values and explicit synthetic source metadata", async () => {
    const closures = await source("tpv/tpvCierres.web.js");
    assert.match(closures, /status: "GENERADO",\s*sourceType: TPV_RUNTIME_POLICY\.SOURCE_TYPE/);
    assert.match(closures, /status: "CERRADO",\s*sourceType: TPV_RUNTIME_POLICY\.SOURCE_TYPE/);
    assert.doesNotMatch(closures, /GENERADO_SINTETICO|CERRADO_SINTETICO/);
    assert.match(closures, /toMinorUnits\(input\.countedCash, "COUNTED_CASH"\)/);
});


test("TPV envelope helpers expose the complete status/data/error contract", async () => {
    const envelope = await source("tpv/tpvEnvelope.js");
    assert.match(envelope, /status: "SUCCESS",[\s\S]*?data,[\s\S]*?error: null/);
    assert.match(envelope, /status: "PENDING",[\s\S]*?data: null,[\s\S]*?error: null/);
    assert.match(envelope, /status: "ERROR",[\s\S]*?data: null,[\s\S]*?error: toPublicShape\(actionable\)/);
});
