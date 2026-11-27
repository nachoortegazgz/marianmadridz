import test from "node:test";
import { buildQuarterlyRegistryPackage } from "../exports/exportContract.js";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { validateSaleDraft } from "../tpv/tpvValidation.js";
import { normalizeTpvError, errorResult } from "../tpv/tpvError.js";
import { createActionableError } from "../errors/actionableError.js";

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
    assert.ok(sales.includes("sourceType: TPV_RUNTIME_POLICY.SOURCE_TYPE"));
    assert.match(sales, /createTpvRecordMetadata/);
    assert.doesNotMatch(sales, /recordNature|SYNTHETIC|REAL/);
    assert.match(sales, /TPV_SALE_NOT_READY/);
    assert.doesNotMatch(sales, /FISCAL_CONFIG_UNVERIFIED/);
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
    assert.doesNotMatch(policy, /CMS_TPV_HISTORICAL_LEDGER_WRITE_DENIED/);
    assert.match(policy, /APPEND_ONLY_COLLECTIONS/);
    assert.match(config, /TPV_RUNTIME_POLICY/);
    assert.match(config, /SOURCE_TYPE: "TPV"/);
    assert.doesNotMatch(config, /TPV_HISTORICAL_POLICY|TPV_SYNTHETIC_LEDGER/);
    assert.doesNotMatch(config, /ALLOW_REAL_PAYMENTS|ALLOW_NATIVE_WRITES|CAPABILITIES:/);
    assert.match(await readFile(new URL("../public/tpvPageController.js", backendRoot), "utf8"), /obtenerConfiguracionTPV/);
    const controller = await readFile(new URL("../public/tpvPageController.js", backendRoot), "utf8");
    assert.doesNotMatch(controller, /environment:|previewOnly:|syntheticOnly:|realPaymentsEnabled:|fiscalWritesEnabled:/);
    assert.doesNotMatch(config, /LEGACY_RUN_ID|TPVSANDBOX-DEV-/);
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
        "registrarDevolucion", "generarTicketX", "generarCierreZ", "cerrarSesionCaja", "exportarMovimientos",
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

test("TPV physical, commercial and audit ledgers are separated from the fiscal guard", async () => {
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
    assert.doesNotMatch(config, /TPV_HISTORICAL_POLICY|TPV_SYNTHETIC_LEDGER/);
    assert.doesNotMatch(config, /ALLOW_REAL_PAYMENTS|ALLOW_NATIVE_WRITES|CAPABILITIES:/);
    assert.match(repository, /assertTpvOperationalLedgerConfigured/);
    assert.doesNotMatch(repository, /TPV_OPERATIONAL_LEDGER_NOT_CONFIGURED/);
    assert.match(repository, /assertTpvOperationalLedgerConfigured\(ledgerType = "fiscal"\)/);
    assert.match(repository, /TPV_COMMERCIAL_SALES_MUST_USE_TRANSACCIONES_TPV/);
    assert.match(repository, /_isTpvLedgerItem/);
    assert.doesNotMatch(repository, /_isHistoricalTpvLedgerItem/);
    assert.doesNotMatch(repository, /sequenceNumber: 0|cashRegisterStatus: "SIMULACION"|CONFIRMADA_SINTETICA|CONFIRMADO_SINTETICO/);
    assert.match(repository, /export async function queryTpvOperationalLedgerRecords\(/);
    assert.doesNotMatch(repository, /_isHistoricalTpvLedgerItem/);
    assert.doesNotMatch(repository, /_isCanonicalTpvLedgerItem/);
    assert.match(repository, /export async function queryHistoricalTpvLedgerRecords\(/);
    assert.match(repository, /return queryTpvOperationalLedgerRecords\(options\)/);
    assert.match(repository, /export async function queryTpvOperationalLedgerRecords\(/);
    assert.match(utilities, /export function makeTpvPayload/);
    assert.doesNotMatch(utilities, /makeSyntheticPayload|allowNativePayments|allowNativeRefunds/);
    assert.match(utilities, /TPV_BACKEND_METADATA_FORBIDDEN/);
    assert.doesNotMatch(accessPolicy, /CMS_TPV_HISTORICAL_LEDGER_WRITE_DENIED/);
    assert.doesNotMatch(accessPolicy, /_isSyntheticTpvRecord|SIMULATED_TPV_/);
    assert.doesNotMatch(hooks, /CMS_TPV_HISTORICAL_LEDGER_WRITE_DENIED/);
    assert.match(hooks, /recordSource === TPV_LEDGER_SOURCE/);
    assert.doesNotMatch(hooks, /_isCurrentSyntheticTpvRow|SIMULATED_TPV_/);
    assert.match(repository, /TPV_PHYSICAL_LEDGER_CHAIN_BROKEN/);
    assert.match(repository, /sequenceNumber: previousSequence \+ 1/);
    assert.doesNotMatch(validation, /historicalTpvLedgerRecord|recordNature|SYNTHETIC|REAL|TPV_TEST_RUN/);
    assert.match(movements, /queryTpvOperationalLedgerRecords\(\{ limit: 1000 \}\)/);
    assert.doesNotMatch(movements, /SIMULATED_TPV_SALE|CONFIRMADA_SINTETICA/);
    assert.doesNotMatch(movements, /queryHistoricalTpvLedgerRecords/);
    assert.doesNotMatch(movements, /SIMULATED_TPV_REFUND|CONFIRMADO_SINTETICO/);
    assert.doesNotMatch(movements, /\[SINTÉTICO\]/);
    assert.doesNotMatch(movements, /syntheticOnly: true/);
});



test("registrarVenta replays the same TransaccionesTPV idempotency key without duplicating the sale", async () => {
    const sales = await source("tpv/tpvVentas.web.js");
    assert.match(sales, /getItem\(\s*BUSINESS_COLLECTIONS\.TRANSACCIONES_TPV/);
    assert.match(sales, /requestFingerprint/);
    assert.match(sales, /withTpvSessionLock/);
    assert.match(sales, /concurrentWinner/);
    assert.match(sales, /replayed: true/);
    assert.match(sales, /TPV_IDEMPOTENCY_CONFLICT/);
});

test("registrarVenta reports every unavailable Catalog V3 product ID", async () => {
    const sales = await source("tpv/tpvVentas.web.js");
    const preparation = await source("tpv/tpvSalePreparation.js");
    assert.match(preparation, /TPV_CATALOG_PRODUCTS_NOT_FOUND/);
    assert.match(preparation, /invalidProductIds/);
    assert.match(sales, /invalidProductIds\.join\(", "\)/);
});

test("registrarVenta blocks unready intents and avoids external Wix orders", async () => {
    const sales = await source("tpv/tpvVentas.web.js");
    assert.doesNotMatch(sales, /draftOrders|createDraftOrder|auth\.elevate/);
    assert.match(sales, /QA_EXTERNAL_SIDE_EFFECTS_DISABLED/);
    assert.match(sales, /requiresReconciliation: draft\.requiresReconciliation/);
    assert.match(sales, /status: "PENDING_PAYMENT"/);
    assert.match(sales, /sourceType: TPV_RUNTIME_POLICY\.SOURCE_TYPE/);
    assert.match(sales, /createTpvRecordMetadata/);
    assert.match(sales, /TPV_SALE_NOT_READY/);
    assert.match(sales, /saleReadinessBlockers/);
    assert.match(sales, /TPV_PAYMENT_PROVIDER_NOT_CONFIGURED/);
    assert.match(sales, /status: "SKIPPED", reason: record\.draftOrderReason/);
    assert.doesNotMatch(sales, /wixPay|checkout\.create|createPayment|capturePayment/);
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
    assert.match(closures, /action: "TICKET_X_GENERATED"/);
    assert.match(closures, /entityType: "TICKET_X"/);
    assert.match(closures, /fiscalLedgerWritten: false/);
    assert.match(closures, /data: \{ ticketX: ticketXResult/);
    assert.equal(closures.includes("insertTpvEvent(TPV_COLLECTIONS.TICKET_X"), false);
    assert.ok(closures.includes('status: "CERRADO",\n                sourceType: TPV_RUNTIME_POLICY.SOURCE_TYPE,'));
    assert.doesNotMatch(closures, /GENERADO_SINTETICO|CERRADO_SINTETICO/);
    assert.match(closures, /toMinorUnits\(input\.countedCash, "COUNTED_CASH"\)/);
});


test("TPV envelope helpers expose the complete status/data/error contract", async () => {
    const envelope = await source("tpv/tpvEnvelope.js");
    assert.match(envelope, /status: "SUCCESS",[\s\S]*?data,[\s\S]*?error: null/);
    assert.match(envelope, /status: "PENDING",[\s\S]*?data: null,[\s\S]*?error: null/);
    assert.match(envelope, /status: "ERROR",[\s\S]*?data: null,[\s\S]*?error: normalizeTpvError\(actionable\)/);
});


test("TPV close session uses the operational ledger and a separate CajaActual projection without fiscal Z", async () => {
    const [cash, repository] = await Promise.all([
        source("tpv/tpvCaja.web.js"),
        source("tpv/tpvRepository.js"),
    ]);
    assert.match(cash, /export const cerrarSesionCaja = webMethod\(/);
    assert.match(cash, /withTpvSessionLock\(sessionId/);
    assert.match(cash, /movementType: "CIERRE"/);
    const sessionCloseBlock = cash.slice(cash.indexOf("export const cerrarSesionCaja"));
    assert.match(sessionCloseBlock, /const closeIdempotencyKey = sessionId \+ "-CIERRE"/);
    assert.match(sessionCloseBlock, /insertTpvEvent\(\s*TPV_COLLECTIONS\.MOVIMIENTOS_CAJA,\s*closeIdempotencyKey/);
    assert.doesNotMatch(sessionCloseBlock, /idempotencyKey \+ ":CIERRE"/);
    assert.match(cash, /insertTpvEvent\(\s*TPV_COLLECTIONS\.MOVIMIENTOS_CAJA/);
    assert.match(cash, /closeTpvCajaSessionProjection/);
    assert.match(cash, /data: resultData/);
    assert.match(cash, /replayed: true/);
    assert.match(cash, /TPV_CLOSE_MOVEMENT_MISSING/);
    assert.ok(cash.includes('"CAJA_CIERRE:" + sessionId.slice(0, 70) + ":AUDIT"'));
    assert.match(repository, /export async function closeTpvCajaSessionProjection/);
    assert.match(repository, /cashRegisterStatus: "CERRADA"/);
    assert.equal(sessionCloseBlock.includes("TPV_COLLECTIONS.TICKET_Z"), false);
    assert.equal(sessionCloseBlock.includes("HistoricoCierresZ"), false);
    assert.equal(sessionCloseBlock.includes("eventLog"), false);
});

test("TPV export is ADMIN-only, paginated and excludes fiscal payload fields", async () => {
    const exportModule = await source("tpv/tpvExport.web.js");
    const permissions = await source("tpv/tpvPermisos.web.js");
    assert.match(exportModule, /await requireAdmin\(traceId\)/);
    assert.match(exportModule, /limit: PAGE_SIZE/);
    assert.match(exportModule, /offset: rawCursor/);
    assert.match(exportModule, /nextCursor:/);
    assert.match(exportModule, /data: resultData/);
    assert.match(exportModule, /recordSource/);
    assert.ok(exportModule.includes("TPV_EVENT_MOVEMENT_TYPES[TPV_COLLECTIONS.MOVIMIENTOS_CAJA]"));
    assert.doesNotMatch(exportModule, /payloadFiscal:|taxAmount|taxBase|invoice/);
    assert.match(permissions, /closeSession: staff\.rolWebsite === "ADMIN"/);
    assert.match(permissions, /issueTicketX: staff\.rolWebsite === "ADMIN"/);
    assert.match(permissions, /exportMovements: staff\.rolWebsite === "ADMIN"/);
});


test("legacy TPV test runtimes and historical compatibility classifier are retired", async () => {
    const controller = await readFile(new URL("../public/tpvPageController.js", backendRoot), "utf8");
    const validation = await source("validation.js");
    assert.doesNotMatch(controller, /tpvTestRuntime/);
    assert.doesNotMatch(validation, /tpvHistoricalCompat|isValidTpvTestRunPayload/);
    await assert.rejects(source("tpv/tpvHistoricalCompat.js"), { code: "ENOENT" });
    await assert.rejects(source("tpv/tpvTestRuntime.web.js"), { code: "ENOENT" });
    await assert.rejects(source("tpv/tpvTestRuntimeRepository.js"), { code: "ENOENT" });
    await assert.rejects(source("tpv/tpvTestRuntimeCore.js"), { code: "ENOENT" });
});
test("Capa 3 quarterly export is deterministic, minimized and source-gated", () => {
    const summary = {
        nifEmisor: "B12345678",
        totalOperaciones: 1,
        totalOperacionesFiscales: 1,
        conteo: { ventas: 1, reembolsos: 0, propinas: 0, ajustes: 0 },
        borradorIva: { estado: "REVISION_PROFESIONAL_REQUERIDA", baseImponibleRegistrada: 100, cuotaIvaRegistrada: 21 },
        totales: {
            totalVentasBrutas: 121,
            totalReembolsos: 0,
            totalFacturadoNeto: 121,
            totalPropinasSeparadas: 0,
            totalAjustesSeparados: 0,
        },
        desgloseFormaPago: { efectivo: 121, tarjeta: 0, bizum: 0, online: 0 },
    };
    const rows = [{
        invoiceNumber: "MM-2026-0001",
        fechaExpedicion: "2026-10-01",
        tipoFactura: "BORRADOR_INTERNO",
        movementType: "VENTA",
        operationNature: "VENTA",
        taxTreatment: "DEVENGADO",
        paymentMethod: "efectivo",
        taxableAmount: 100,
        taxRate: "21%",
        taxAmount: 21,
        totalAmount: 121,
        hashCompleto: "a".repeat(64),
        fechaHoraRegistro: new Date("2026-10-01T10:00:00.000Z"),
        transactionId: "tx-0001",
        concepto: "must not be exported",
        customerName: "must not be exported",
    }];
    const input = {
        year: 2026,
        quarter: 4,
        generatedAt: new Date("2026-11-27T06:00:00.000Z"),
        traceId: "c3-test-1",
        summary,
        rows,
    };
    const first = buildQuarterlyRegistryPackage(input);
    const second = buildQuarterlyRegistryPackage(input);
    assert.equal(first.manifest.exportId, "MM-C3-ACCOUNTING-2026-Q4-V1.0.0");
    assert.equal(first.manifest.artifactId, second.manifest.artifactId);
    assert.equal(first.manifest.contentChecksum, second.manifest.contentChecksum);
    assert.equal(first.manifest.recordCount, 1);
    assert.equal(first.manifest.deliveryStatus, "PREPARED_NOT_DELIVERED");
    assert.equal(first.manifest.period.periodStart, "2026-10-01");
    assert.equal(first.manifest.period.periodEndExclusive, "2027-01-01");
    assert.equal(first.content.records[0].taxableAmountMinor, 10000);
    assert.equal(first.content.records[0].taxRateBasisPoints, 2100);
    assert.equal(first.content.records[0].taxAmountMinor, 2100);
    assert.equal(first.content.records[0].totalAmountMinor, 12100);
    assert.equal(JSON.stringify(first).includes("must not be exported"), false);
});

test("Capa 3 export rejects incomplete fiscal source rows", () => {
    const summary = {
        nifEmisor: "B12345678",
        totalOperaciones: 0,
        totalOperacionesFiscales: 0,
        conteo: { ventas: 0, reembolsos: 0, propinas: 0, ajustes: 0 },
        borradorIva: { estado: "REVISION_PROFESIONAL_REQUERIDA", baseImponibleRegistrada: 0, cuotaIvaRegistrada: 0 },
        totales: {
            totalVentasBrutas: 0, totalReembolsos: 0, totalFacturadoNeto: 0,
            totalPropinasSeparadas: 0, totalAjustesSeparados: 0,
        },
        desgloseFormaPago: { efectivo: 0, tarjeta: 0, bizum: 0, online: 0 },
    };
    const row = {
        invoiceNumber: "QA-1",
        fechaExpedicion: "2026-10-01",
        tipoFactura: "BORRADOR_INTERNO",
        movementType: "VENTA",
        operationNature: "VENTA",
        taxTreatment: "DEVENGADO",
        paymentMethod: "efectivo",
        taxableAmount: 10,
        taxRate: "21%",
        taxAmount: 2.1,
        totalAmount: 12.1,
        hashCompleto: "b".repeat(64),
        fechaHoraRegistro: new Date("2026-10-01T10:00:00.000Z"),
        transactionId: "qa-1",
    };
    assert.throws(() => buildQuarterlyRegistryPackage({
        year: 2026, quarter: 4, generatedAt: new Date(), traceId: "c3-test-2",
        summary, rows: [{ ...row, hashCompleto: "" }],
    }), /C3_EXPORT_RECORD_HASH_MISSING/);
    assert.throws(() => buildQuarterlyRegistryPackage({
        year: 2026, quarter: 4, generatedAt: new Date(), traceId: "c3-test-2",
        summary, rows: [{ ...row, fechaExpedicion: "2026-02-31" }],
    }), /C3_EXPORT_ISSUE_DATE_INVALID/);
});

test("Capa 3 export WebMethod is admin-only and has no delivery or write side effects", async () => {
    const service = await source("exports/exportService.web.js");
    assert.match(service, /webMethod\(\s*Permissions\.Admin/);
    assert.match(service, /await requireAdmin\(traceId\)/);
    assert.match(service, /getQuarterlyTaxSummaryInternal/);
    assert.match(service, /getLibroRegistroFacturasExpedidasInternal/);
    assert.match(service, /buildQuarterlyRegistryPackage/);
    assert.doesNotMatch(service, /insertItem|updateItem|removeItem|fetch\(|sendEmail|SharePoint|Graph/);
});


test("TPV error normalization preserves actionable metadata and legacy error codes", async () => {
    const actionable = createActionableError({
        code: "TPV_TEST_ACTIONABLE",
        userMessage: "No se puede completar la operación.",
        technicalDetail: "TPV_TEST_ACTIONABLE",
        remediation: ["Revisar el ledger."],
        retryable: true,
    });
    assert.deepEqual(normalizeTpvError(actionable), {
        code: "TPV_TEST_ACTIONABLE",
        userMessage: "No se puede completar la operación.",
        remediation: ["Revisar el ledger."],
        technicalDetail: "ledger unavailable",
        retryable: true,
    });

    const legacy = normalizeTpvError("TPV_SESSION_REQUIRED", "TPV_FALLBACK");
    assert.equal(legacy.code, "TPV_SESSION_REQUIRED");
    assert.equal(legacy.retryable, false);
    assert.equal(legacy.technicalDetail, "TPV_SESSION_REQUIRED");

    const legacyException = normalizeTpvError(new Error("TPV_SESSION_REQUIRED"), "TPV_OPERATION_FAILED");
    assert.equal(legacyException.code, "TPV_SESSION_REQUIRED");

    const generic = normalizeTpvError(new Error("database timeout"), "TPV_CASH_MOVEMENT_FAILED");
    assert.equal(generic.code, "TPV_CASH_MOVEMENT_FAILED");
    assert.equal(generic.userMessage, "No se pudo completar la operación TPV.");
    assert.equal(generic.technicalDetail, "database timeout");
    const unknownRetryability = normalizeTpvError(
        Object.assign(new Error("network timeout"), { retryable: true }),
        "TPV_CASH_MOVEMENT_FAILED"
    );
    assert.equal(unknownRetryability.retryable, false);

    const result = errorResult(actionable, "TPV_FALLBACK", "trace-test", { persisted: true });
    assert.equal(result.status, "ERROR");
    assert.equal(result.error.code, "TPV_TEST_ACTIONABLE");
    assert.equal(result.traceId, "trace-test");
    assert.equal(result.persisted, true);

    const { error: createTpvErrorEnvelope } = await import("../tpv/tpvEnvelope.js");
    const envelope = createTpvErrorEnvelope(
        "TPV_ENVELOPE_TEST",
        "No se pudo completar la operación.",
        ["Revisar el traceId."],
        { technicalDetail: "service unavailable", retryable: true }
    );
    assert.equal(envelope.error.code, "TPV_ENVELOPE_TEST");
    assert.equal(envelope.error.technicalDetail, "service unavailable");
    assert.equal(envelope.error.retryable, true);
});

test("TPV operational ledger assertions and operator resolution are inside WebMethod try blocks", async () => {
    const cases = [
        ["tpv/tpvCaja.web.js", ["abrirSesionCaja", "registrarArqueoParcial", "cerrarSesionCaja"]],
        ["tpv/tpvMovimientos.web.js", ["registrarMovimientoCaja", "exportarMovimientosCaja", "exportarAuditoriaTPV"]],
        ["tpv/tpvCierres.web.js", ["generarTicketX", "generarCierreZ"]],
    ];
    for (const [path, methods] of cases) {
        const content = await source(path);
        for (const method of methods) {
            const start = content.indexOf("export const " + method);
            assert.notEqual(start, -1, path + ":" + method + " exists");
            const tryIndex = content.indexOf("try {", start);
            const guardIndex = content.indexOf("assertTpvOperationalLedgerConfigured(", start);
            const contextIndex = content.indexOf("resolveTpvContext(traceId)", start);
            const nextMethod = content.indexOf("export const ", start + 1);
            assert.ok(tryIndex > start && guardIndex > tryIndex && (nextMethod === -1 || guardIndex < nextMethod),
                path + ":" + method + " operational guard must be caught");
            assert.ok(contextIndex > tryIndex && (nextMethod === -1 || contextIndex < nextMethod),
                path + ":" + method + " context resolution must be caught");
        }
    }
});
