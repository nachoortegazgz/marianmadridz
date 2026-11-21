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
    assert.equal(result.estadoVenta, "COBRADA_SINTETICA");
    assert.equal(result.persisted, false);
    assert.equal(result.realPayment, false);
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
    assert.equal(result.realPayment, false);
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

test("TPV WebMethods isolate synthetic SANDBOX writes from operational ledgers", async () => {
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
    assert.match(joined, /registrarVenta/);
    assert.match(joined, /registrarDevolucion/);
    assert.match(joined, /generarCierreZ/);
    assert.match(joined, /TPV_SANDBOX_COLLECTIONS/);
    assert.doesNotMatch(joined, /contactsV5|extendedBookings|giftVouchers|staffMembers|staff\?\.memberId/);
    const cashierModule = await source("tpv/tpvCaja.web.js");
    assert.doesNotMatch(cashierModule, /backend\/cajas\.web|CajaActual|getCashierState/);
    assert.match(joined, /TPV_OPERATIONAL_REFUNDS_DISABLED/);
    const payments = await source("tpv/tpvPagos.web.js");
    assert.match(payments, /simularPasarelaPago/);
    assert.match(payments, /simularReembolsoPasarela/);
    assert.match(payments, /simulateGatewayPayment/);
    assert.match(payments, /simulateGatewayRefund/);
    assert.doesNotMatch(payments, /wixPay|checkout|createOrder|processRefund/i);
    const simulator = await source("tpv/tpvPaymentSimulator.js");
    assert.match(simulator, /providerCalled: false/);
    assert.match(simulator, /realPayment: false/);
    assert.match(simulator, /externalSideEffects: false/);
    assert.match(simulator, /requestFingerprint/);

    const sales = await source("tpv/tpvVentas.web.js");
    assert.match(sales, /realPayment: false/);
    assert.match(sales, /fiscalLedgerWritten: false/);
    assert.match(sales, /TPV_SANDBOX_SALE_MUST_BE_FULLY_PAID/);
    const refunds = await source("tpv/tpvDevoluciones.web.js");
    const movements = await source("tpv/tpvMovimientos.web.js");
    const cash = await source("tpv/tpvCaja.web.js");
    const closures = await source("tpv/tpvCierres.web.js");
    assert.match(sales, /withSandboxSessionLock\(session\.sessionId/);
    assert.match(refunds, /withSandboxSaleLock\(saleId, traceId, async \(\) => \{[\s\S]*?\}, session\.sessionId\)/);
    assert.match(movements, /withSandboxSessionLock\(session\.sessionId/);
    assert.match(cash, /withSandboxSessionLock\(session\.sessionId/);
    assert.match(closures, /withSandboxSessionLock\(session\.sessionId/);
    assert.doesNotMatch(joined, /registerManualTransaction|registerZClosing|createCheckout|createOrder|createPayment|processRefund/i);

    const repository = await source("tpv/tpvSandboxRepository.js");
    assert.match(repository, /insertItem\(/);
    assert.match(repository, /CONSISTENCY\.STRONG/);
    assert.match(repository, /requestFingerprint/);
    assert.match(repository, /TPV_SANDBOX_COLLECTIONS/);
    assert.match(repository, /CONTROL_TYPE\.TPV_SANDBOX_SESSION_LOCK/);
    assert.match(repository, /updateItem\(BUSINESS_COLLECTIONS\.CAJA_ACTUAL/);
    const cashier = await source("tpv/tpvCaja.web.js");
    assert.match(cashier, /withSandboxSessionLock\(sessionId, traceId/);
    assert.doesNotMatch(repository, /removeById\(|bulkUpdate\(|bulkRemove\(/);

    const policy = await source("dataAccessPolicy.js");
    const config = await source("internalConfig.js");
    assert.match(policy, /TPV_SANDBOX_RUNTIME_POLICY/);
    assert.match(policy, /TPV_SANDBOX_SYNTHETIC/);
    assert.match(policy, /APPEND_ONLY_COLLECTIONS/);
    assert.match(config, /REAL_PAYMENTS_ENABLED: false/);
    assert.match(config, /FISCAL_WRITES_ENABLED: false/);
    assert.match(config, /SYNTHETIC_ONLY: true/);
    assert.match(config, /TPV_SANDBOX_RUNTIME_POLICY = Object\.freeze\(\{[\s\S]*?ENABLED: true/);
    assert.match(await readFile(new URL("../public/tpvPageController.js", backendRoot), "utf8"), /obtenerConfiguracionTPV/);
    assert.match(await readFile(new URL("../public/tpvPageController.js", backendRoot), "utf8"), /previewOnly: true/);
    assert.match(config, /SANDBOX_RUN_ID: "TPVSANDBOX-DEV-/);
    assert.match(config, /TPV_SANDBOX_EVENT_MOVEMENT_TYPES/);
    for (const writer of [cash, movements, sales, closures]) {
        assert.match(writer, /requireAdmin/);
    }
});

test("TPV catalog reader uses native Bookings SDK and does not expose staff contact details", async () => {
    const catalog = await source("tpv/tpvCatalogo.web.js");
    assert.match(catalog, /services\.queryServices/);
    assert.match(catalog, /listTpvSandboxIdentities\(TPV_SANDBOX_IDENTITY_TYPES\.STAFF\)/);
    assert.match(catalog, /listTpvSandboxIdentities\(TPV_SANDBOX_IDENTITY_TYPES\.CUSTOMER\)/);
    assert.doesNotMatch(catalog, /TPV_SANDBOX_FIXTURES/);
    const identities = await source("tpv/tpvSandboxIdentities.js");
    assert.match(identities, /BUSINESS_COLLECTIONS\.TPV_SANDBOX_IDENTITIES/);
    assert.match(identities, /CONSISTENCY\.STRONG/);
    assert.match(identities, /syntheticOnly/);
    assert.match(identities, /testRunId/);
    const validation = await source("validation.js");
    assert.match(validation, /assertTpvSandboxIdentity/);
    const hooks = await source("data.js");
    assert.match(hooks, /TpvSandboxIdentities_beforeInsert/);
    assert.match(hooks, /TPV_SANDBOX_IDENTITIES_APPEND_ONLY/);
    assert.doesNotMatch(catalog, /contactsV5|extendedBookings|staffMembers|tpvNativeReaders/);
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
    assert.match(catalog, /product\.visibleInPos/);
    assert.match(catalog, /V3_CATALOG/);
    assert.match(catalog, /precioMinor/);
    assert.match(catalog, /from ["']@wix\/stores["']/);
    assert.doesNotMatch(catalog, /staff\.email|staff\.phone/);

    const giftCards = await source("tpv/tpvGiftCards.web.js");
    assert.match(giftCards, /TPV_GIFT_CARDS_DISABLED_IN_SANDBOX/);
    assert.doesNotMatch(giftCards, /giftVouchers|@wix\/ecom|auth\.elevate/);
    assert.match(giftCards, /requireCajero/);
    assert.match(giftCards, /syntheticOnly: true/);
    assert.doesNotMatch(giftCards, /insertItem|updateItem|redeemGiftCard|console\.(?:log|info|warn|error)/);
    assert.doesNotMatch(giftCards, /console\.(?:log|info|warn|error)|wixData|\.insert\(|\.update\(|\.remove\(/);
});

test("TPV page is wired to the native POS widget bridge and canonical backend exports", async () => {
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
    assert.match(controller, /obtenerEstadoCaja/);
    assert.match(controller, /abrirSesionCaja/);
    assert.match(controller, /obtenerServicios/);
    assert.match(controller, /obtenerProductos/);
    assert.match(controller, /obtenerStaff/);
    assert.match(controller, /buscarClientesTPV/);
    assert.match(controller, /registrarVenta/);
    assert.match(controller, /registrarMovimientoCaja/);
    assert.match(controller, /registrarDevolucion/);
    assert.match(controller, /generarControlX/);
    assert.match(controller, /generarCierreZ/);
    assert.match(controller, /obtenerResumenCaja/);
    assert.match(controller, /obtenerMovimientosCaja/);
    assert.match(controller, /obtenerConfiguracionTPV/);
    assert.match(bridge, /widgetElement\.onMessage/);
    assert.match(bridge, /widgetElement\.postMessage/);
    assert.match(html, /send\("MM_READY"/);
    assert.match(html, /m\.type==="MM_CONTEXT"/);
    assert.match(html, /environment!=="SANDBOX"/);
    assert.match(html, /send\("CASHIER_STATE"/);
    assert.match(html, /send\("CUSTOMERS_SEARCH"/);
    assert.match(html, /send\("SALE_REGISTER"/);
    assert.match(html, /send\("CASH_MOVEMENT"/);
    assert.match(html, /send\("REFUND"/);
    assert.match(html, /send\("TICKET_X"/);
    assert.match(html, /send\("TICKET_Z"/);
});
 
test("SANDBOX repository paginates reads and blocks Z close while sales are incomplete", async () => {
    const repository = await source("tpv/tpvSandboxRepository.js");
    const closures = await source("tpv/tpvCierres.web.js");
    assert.match(repository, /while \(page\.hasNext && records\.length < maxRecords\)/);
    assert.match(repository, /export async function getPendingSandboxSales\(sessionId\)/);
    assert.match(repository, /export async function getPendingSandboxRefunds\(sessionId\)/);
    assert.match(repository, /actualByMethod\.size !== expectedByMethod\.size/);
    assert.match(repository, /actual\.amountMinor !== expected\.amountMinor/);
    assert.match(repository, /refundCashMovements\.length !== expectedCash\.count/);
    assert.match(repository, /actualCashAmount !== expectedCash\.amountMinor/);
    assert.match(repository, /refundTotal !== Number\(refund\.amountMinor\)/);
    assert.match(closures, /getPendingSandboxSales\(session\.sessionId\)/);
    assert.match(closures, /TPV_SANDBOX_PENDING_SALES_PREVENT_CLOSE/);
    assert.match(closures, /getPendingSandboxRefunds\(session\.sessionId\)/);
    assert.match(closures, /TPV_SANDBOX_PENDING_REFUNDS_PREVENT_CLOSE/);
    assert.match(closures, /totals\.reconciliationOk !== true/);
    assert.match(closures, /TPV_SANDBOX_RECONCILIATION_FAILED/);
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

test("TPV synthetic persistence maps logical events to CajaActual and MovimientosCaja without fiscal side effects", async () => {
    const repository = await source("tpv/tpvSandboxRepository.js");
    const config = await source("internalConfig.js");
    const utilities = await source("tpv/tpvUtils.js");
    assert.match(repository, /SANDBOX_LEDGER_SOURCE = "TPV_SANDBOX_SYNTHETIC"/);
    assert.match(config, /SIMULATED_TPV_/);
    assert.match(repository, /sequenceNumber: 0/);
    assert.match(repository, /cmsMovementType: item\.movementType/);
    assert.doesNotMatch(repository, /movementType: item\.movementType/);
    assert.match(repository, /previousRecordHash: SANDBOX_GENESIS_HASH/);
    assert.match(repository, /createHash\("sha256"\)/);
    assert.match(repository, /cashRegisterStatus: "SIMULACION"/);
    assert.match(repository, /_ensureCajaActualForSandbox/);
    assert.match(repository, /TPV_SANDBOX_CASH_REGISTER_NOT_SEEDED/);
    assert.match(repository, /assertSandboxCajaWritable/);
    assert.match(repository, /export async function initializeSandboxCaja\(/);
    assert.match(repository, /TPV_SANDBOX_CASH_REGISTER_NOT_PRESEEDED/);
    assert.doesNotMatch(repository, /insertItem\(BUSINESS_COLLECTIONS\.CAJA_ACTUAL, seed\)/);
    assert.match(utilities, /TPV_SANDBOX_INITIALIZED/);
    assert.match(utilities, /TPV_SANDBOX_SYNTHETIC/);
    assert.match(repository, /payloadFiscal\?\.sandboxRunId === SANDBOX_RUN_ID/);
    assert.match(repository, /MAX_SANDBOX_PROJECTION_EVENTS = 1000/);
    assert.match(repository, /conceptOperations\?\.tpvSandbox\?\.sessionId/);
    assert.match(repository, /updateItem\(BUSINESS_COLLECTIONS\.CAJA_ACTUAL/);
    assert.match(config, /SANDBOX_RUN_ID: "TPVSANDBOX-DEV-/);
    assert.doesNotMatch(repository, /registerManualTransaction|signFiscal|sendToAeat|createPayment|capturePayment|processRefund/i);
});
