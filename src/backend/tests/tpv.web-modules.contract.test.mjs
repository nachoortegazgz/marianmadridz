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
    assert.match(joined, /TPV_COLLECTIONS/);
    assert.doesNotMatch(joined, /contactsV5|extendedBookings|giftVouchers|staffMembers|staff\?\.memberId/);
    const cashierModule = await source("tpv/tpvCaja.web.js");
    assert.doesNotMatch(cashierModule, /backend\/cajas\.web|CajaActual|getCashierState/);
    assert.match(joined, /TPV_OPERATIONAL_REFUNDS_DISABLED/);
    const payments = await source("tpv/tpvPagos.web.js");
    assert.doesNotMatch(payments, /simularPasarelaPago|simularReembolsoPasarela|simulateGatewayPayment|simulateGatewayRefund/);
    assert.doesNotMatch(payments, /SIMULATED|SANDBOX/);
    assert.doesNotMatch(payments, /wixPay|checkout|createOrder|processRefund/i);

    const sales = await source("tpv/tpvVentas.web.js");
    assert.doesNotMatch(sales, /realPayment: false|isSynthetic: true/);
    assert.match(sales, /TPV_PAYMENT_PROVIDER_NOT_CONFIGURED/);
    assert.doesNotMatch(sales, /insertTpvEvent|appendTpvAudit|withTpvSessionLock/);
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
    assert.match(config, /ALLOW_REAL_PAYMENTS: false/);
    assert.match(config, /ALLOW_NATIVE_WRITES: false/);
    assert.match(await readFile(new URL("../public/tpvPageController.js", backendRoot), "utf8"), /obtenerConfiguracionTPV/);
    const controller = await readFile(new URL("../public/tpvPageController.js", backendRoot), "utf8");
    assert.doesNotMatch(controller, /environment:|previewOnly:|syntheticOnly:|realPaymentsEnabled:|fiscalWritesEnabled:/);
    assert.match(config, /LEGACY_RUN_ID: "TPVSANDBOX-DEV-/);
    assert.match(config, /TPV_EVENT_MOVEMENT_TYPES/);
    for (const writer of [cash, movements, sales, closures]) {
        assert.match(writer, /requireAdmin/);
    }
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
    assert.match(controller, /sessionId: optionalString\(payload\.sessionId\)/);
    const widget = await readFile(new URL("../../#htmlTPV.txt", backendRoot), "utf8").catch(() => "");
    if (widget) assert.doesNotMatch(widget, /requireOperator\(\)/);
});
test("TPV controller imports the exact canonical WebMethods from their owning modules", async () => {
    const controller = await readFile(new URL("../public/tpvPageController.js", backendRoot), "utf8");
    const contracts = {
        "tpvCaja.web.js": ["obtenerEstadoCaja", "abrirSesionCaja"],
        "tpvCatalogo.web.js": ["obtenerServicios", "obtenerProductos", "obtenerStaff"],
        "tpvVentas.web.js": ["registrarVenta"],
        "tpvMovimientos.web.js": ["registrarMovimientoCaja"],
        "tpvAuditoria.web.js": ["obtenerAuditoriaTPV"],
        "tpvDevoluciones.web.js": ["registrarDevolucion"],
        "tpvCierres.web.js": ["generarControlX", "generarCierreZ", "obtenerResumenCaja"],
    };
    for (const [fileName, names] of Object.entries(contracts)) {
        const moduleSource = await source("tpv/" + fileName);
        for (const name of names) {
            assert.match(moduleSource, new RegExp("export const " + name + " = webMethod\\("), fileName + " must export " + name);
            assert.match(controller, new RegExp("\\b" + name + "\\b"), "page controller must consume " + name);
        }
        const moduleName = fileName.replace(/\.web\.js$/, ".web");
        assert.ok(controller.includes('from "backend/tpv/' + moduleName + '"'), "controller must import " + moduleName);
    }
    const [caja, cierres, cierresCore] = await Promise.all([
        source("tpv/tpvCaja.web.js"),
        source("tpv/tpvCierres.web.js"),
        source("tpv/tpvCierresCore.js"),
    ]);
    assert.ok(cierresCore.includes("export async function buildTpvSessionSummary("));
    assert.ok(caja.includes('import { buildTpvSessionSummary } from "backend/tpv/tpvCierresCore"'));
    assert.ok(cierres.includes('import { buildTpvSessionSummary } from "backend/tpv/tpvCierresCore"'));
    assert.ok(cierres.includes("buildTpvSessionSummary(session)"));
    assert.doesNotMatch([caja, cierres, cierresCore].join("\\n"), /buildSandboxSessionSummary/);

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
    assert.match(controller, /obtenerVariantesProducto/);
    assert.match(controller, /obtenerStaff/);
    assert.match(controller, /buscarClientesTPV/);
    assert.match(controller, /registrarVenta/);
    assert.match(controller, /registrarMovimientoCaja/);
    assert.match(controller, /registrarDevolucion/);
    assert.match(controller, /generarControlX/);
    assert.match(controller, /generarCierreZ/);
    assert.match(controller, /obtenerResumenCaja/);
    assert.match(controller, /obtenerAuditoriaTPV/);
    assert.match(controller, /obtenerConfiguracionTPV/);
    assert.match(bridge, /widgetElement\.onMessage/);
    assert.match(bridge, /widgetElement\.postMessage/);
    assert.match(html, /type: "MM_READY"/);
    assert.match(html, /data\.type !== "MM_CONTEXT"/);
    assert.doesNotMatch(html, /environment|previewOnly|syntheticOnly|realPaymentsEnabled|fiscalWritesEnabled/);
    assert.match(html, /response\.status === "ERROR"/);
    assert.match(html, /call\("CASHIER_STATE"/);
    assert.match(html, /call\("CUSTOMERS_SEARCH"/);
    assert.match(html, /customerIdentityId/);
    assert.match(html, /call\("CUSTOMERS_SEARCH"/);
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
    assert.match(repository, /export async function queryTpvLedgerRecords\\(/);
    assert.match(repository, /filter\\(_isHistoricalTpvLedgerItem\\)/);
    assert.match(repository, /filter\\(_isCanonicalTpvLedgerItem\\)/);
    assert.match(utilities, /export function makeTpvPayload/);
    assert.doesNotMatch(utilities, /makeSyntheticPayload|allowNativePayments|allowNativeRefunds|processingMode|reconciliationStatus/);
    assert.match(accessPolicy, /CMS_TPV_LEDGER_WRITES_DISABLED/);
    assert.doesNotMatch(accessPolicy, /_isSyntheticTpvRecord|SIMULATED_TPV_/);
    assert.match(hooks, /TPV_OPERATIONAL_LEDGER_NOT_CONFIGURED/);
    assert.doesNotMatch(hooks, /_isCurrentSyntheticTpvRow|SIMULATED_TPV_/);
    assert.match(validation, /sequenceNumber invalido \\(debe ser un entero > 0\\)/);
    assert.match(movements, /queryTpvLedgerRecords\\(\\{ limit: 1000 \\}\\)/);
    assert.match(movements, /SIMULATED_TPV_SALE/);
    assert.match(movements, /SIMULATED_TPV_REFUND/);
    assert.match(movements, /\[SINTÉTICO\]/);
    assert.doesNotMatch(movements, /syntheticOnly: true/);
});



test("TPV sale and refund write methods fail closed until a native payment provider is integrated", async () => {
    const sales = await source("tpv/tpvVentas.web.js");
    const refunds = await source("tpv/tpvDevoluciones.web.js");
    assert.match(sales, /TPV_PAYMENT_PROVIDER_NOT_CONFIGURED/);
    assert.match(refunds, /TPV_REFUND_PROVIDER_NOT_CONFIGURED/);
    assert.doesNotMatch(sales, /CONFIRMADA|CONFIRMADO|SIMULATED|SYNTHETIC/);
    assert.doesNotMatch(refunds, /CONFIRMADA|CONFIRMADO|SIMULATED|SYNTHETIC/);
    assert.doesNotMatch(sales, /insertTpvEvent|appendTpvAudit/);
    assert.doesNotMatch(refunds, /insertTpvEvent|appendTpvAudit/);
});


test("Ticket X and Z use neutral status values and explicit synthetic source metadata", async () => {
    const closures = await source("tpv/tpvCierres.web.js");
    assert.match(closures, /status: "GENERADO",\s*sourceType: TPV_RUNTIME_POLICY\.SOURCE_TYPE/);
    assert.match(closures, /status: "CERRADO",\s*sourceType: TPV_RUNTIME_POLICY\.SOURCE_TYPE/);
    assert.doesNotMatch(closures, /GENERADO_SINTETICO|CERRADO_SINTETICO/);
    assert.match(closures, /toMinorUnits\(input\.countedCash, "COUNTED_CASH"\)/);
});
