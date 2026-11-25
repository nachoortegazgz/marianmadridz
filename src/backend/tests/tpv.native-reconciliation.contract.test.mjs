import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const backendRoot = new URL("../", import.meta.url);
const repoRoot = new URL("../../../", import.meta.url);

async function source(path) {
    return readFile(new URL(path, backendRoot), "utf8");
}

test("TPV identity is resolved from the authenticated Wix member, not client-supplied actor IDs", async () => {
    const [security, operatorContext, context, catalog, directory, controller, html] = await Promise.all([
        source("security.js"),
        source("tpv/tpvOperatorContext.js"),
        source("tpv/tpvContext.js"),
        source("tpv/tpvCatalogo.web.js"),
        source("tpv/tpvNativeDirectory.js"),
        readFile(new URL("../public/tpvPageController.js", backendRoot), "utf8"),
        readFile(new URL("%23htmlTPV.txt", repoRoot), "utf8"),
    ]);

    assert.match(security, /members\.getCurrentMember\(\)/);
    assert.match(security, /findStaffByContactId\(contactId/);
    assert.match(security, /staff\.roleWebsite/);
    assert.match(operatorContext, /getMyStaffContext\(traceId\)/);
    assert.match(operatorContext, /actorId: memberId/);
    assert.match(operatorContext, /operatorId: memberId/);
    assert.match(operatorContext, /operatorDisplayName: String\(staff\?\.displayName/);
    assert.match(context, /getTpvOperatorContext\(traceId\)/);
    assert.doesNotMatch(operatorContext, /input\.operatorId|payload\.operatorId/);
    assert.match(directory, /profesionalId: resourceId/);
    assert.match(catalog, /items: await listAuthorizedProfessionals\(\)/);
    assert.match(operatorContext, /operatorResourceId: String\(staff\?\.resourceId/);

    // The UI selects the MapaStaff/Wix Bookings resourceId. The backend actor
    // context is independently resolved from the authenticated Wix member.
    assert.match(html, /state\.profesionalId = person \? person\.profesionalId : null/);
    assert.match(controller, /profesionalId: optionalString\(payload\.profesionalId/);
    const caja = await source("tpv/tpvCaja.web.js");
    const sales = await source("tpv/tpvVentas.web.js");
    assert.match(controller, /import \{ obtenerEstadoCaja, abrirSesionCaja, registrarArqueoParcial \} from "backend\/tpv\/tpvCaja\.web"/);
    assert.match(caja, /export const obtenerEstadoCaja = webMethod/);
    assert.match(caja, /export const abrirSesionCaja = webMethod/);
    assert.match(controller, /openingCash: numeric\(payload\.openingCash/);
    assert.match(caja, /toMinorUnits\(input\.openingCash, "OPENING_CASH"\)/);
    assert.match(caja, /payload: makeTpvPayload\(\{ traceId, replayed, sessionId \}\)/);
    assert.match(caja, /payload: \{ sessionId: session\.sessionId, expectedMinor, countedMinor, differenceMinor, reason \}/);
    assert.match(controller, /const lineas = payload\.lineItems\.map/);
    assert.match(controller, /const pagos = \(payload\.payments \|\| \[\]\)\.map/);
    assert.match(controller, /lineas,\s*pagos,/);
    assert.match(sales, /prepareTpvSaleCatalog\(venta\?\.lineas\)/);
    assert.match(sales, /validateSaleDraft\(\{[\s\S]*?lineas: prepared\.lineas/);
    assert.match(sales, /catalogVerified: true/);
    assert.match(sales, /saleReady: saleReadinessBlockers\.length === 0/);
});

test("TPV role guards and session lifecycle are explicit backend contracts", async () => {
    const [security, permissions, cash, sales, movements, refunds, closures, repository] = await Promise.all([
        source("security.js"),
        source("tpv/tpvPermisos.web.js"),
        source("tpv/tpvCaja.web.js"),
        source("tpv/tpvVentas.web.js"),
        source("tpv/tpvMovimientos.web.js"),
        source("tpv/tpvDevoluciones.web.js"),
        source("tpv/tpvCierres.web.js"),
        source("tpv/tpvRepository.js"),
    ]);

    assert.match(security, /role === ROL_WEBSITE\.ADMIN \|\| role === ROL_WEBSITE\.GESTION/);
    assert.match(security, /return _readStaffRole\(staff\) === ROL_WEBSITE\.ADMIN/);
    assert.match(permissions, /createSale: false/);
    assert.match(permissions, /openSession: false/);
    assert.match(permissions, /registerCashMovement: false/);
    assert.match(permissions, /requestRefund: false/);
    assert.match(permissions, /closeSession: false/);
    assert.match(permissions, /issueTicketX: false/);
    assert.match(permissions, /issueTicketZ: false/);
    assert.match(permissions, /operationalWritesAvailable: false/);
    assert.match(permissions, /TPV_OPERATIONAL_LEDGER_NOT_CONFIGURED/);

    for (const writer of [cash, movements, closures]) {
        assert.match(writer, /Permissions\.SiteMember/);
        assert.match(writer, /requireAdmin\(traceId\)/);
        assert.match(writer, /resolveTpvContext\(traceId\)/);
    }

    assert.match(cash, /openedAt: new Date\(\)/);
    assert.match(cash, /openingCashMinor/);
    assert.match(cash, /cashierMemberId: operator\.operatorId/);
    assert.match(cash, /terminalId:/);
    assert.match(repository, /export function assertTpvOperationalLedgerConfigured/);
    assert.match(repository, /assertTpvOperationalLedgerConfigured/);
    assert.match(repository, /export async function latestOpenTpvSession/);
    assert.match(repository, /export async function withTpvSessionLock/);
    for (const writer of [movements, closures]) {
        assert.match(writer, /latestOpenTpvSession\(\)/);
        assert.match(writer, /withTpvSessionLock\(/);
    }
    assert.match(refunds, /TPV_REFUND_PROVIDER_NOT_CONFIGURED/);
    assert.doesNotMatch(refunds, /latestOpenTpvSession|withTpvSaleLock|insertTpvEvent/);
    assert.match(closures, /closedByMemberId: operator\.operatorId/);
    assert.match(closures, /closed: true/);
});

test("TPV split payments reconcile in minor units and cash movements affect physical cash only", async () => {
    const [validation, summary, movements, config] = await Promise.all([
        source("tpv/tpvValidation.js"),
        source("tpv/tpvCierresCore.js"),
        source("tpv/tpvMovimientos.web.js"),
        source("internalConfig.js"),
    ]);

    assert.ok(validation.includes('import { TPV_PAYMENT_METHOD } from "backend/internalConfig"'));
    assert.ok(validation.includes("Object.values(TPV_PAYMENT_METHOD)"));
    for (const method of ["EFECTIVO", "TARJETA", "BIZUM", "BONO", "TARJETA_REGALO", "OTROS"]) {
        assert.ok(config.includes(method + ': "' + method + '"'));
    }
    assert.match(validation, /importePagadoMinor \+= importeAplicadoMinor/);
    assert.match(validation, /paymentBreakdownMinor\[medioPago\] \+= importeAplicadoMinor/);
    assert.match(validation, /TPV_OVERPAYMENT/);
    assert.match(validation, /TPV_CHANGE_REQUIRES_CASH/);
    assert.match(summary, /case "EFECTIVO": totals\.cashMinor \+= amount/);
    assert.match(summary, /case "TARJETA": totals\.cardMinor \+= amount/);
    assert.match(summary, /case "BIZUM": totals\.bizumMinor \+= amount/);
    assert.ok(summary.includes("case TPV_PAYMENT_METHOD.BONO:"));
    assert.ok(summary.includes("case TPV_PAYMENT_METHOD.TARJETA_REGALO:"));
    assert.ok(summary.includes("case TPV_PAYMENT_METHOD.OTROS:"));
    assert.match(summary, /totals\.expectedCashMinor = totals\.openingCashMinor \+ totals\.cashMinor \+ totals\.cashInMinor - totals\.cashOutMinor/);
    assert.match(movements, /input\.paymentMethod \|\| TPV_PAYMENT_METHOD\.EFECTIVO/);
    assert.match(movements, /affectsPhysicalCash: true/);
    assert.match(movements, /normalizeClientIdempotencyKey\(input\.idempotencyKey\)/);
    assert.match(config, /SOURCE_TYPE: "TPV"/);
    assert.match(config, /TPV_HISTORICAL_POLICY/);
    assert.doesNotMatch(config, /ALLOW_REAL_PAYMENTS|ALLOW_NATIVE_WRITES|CAPABILITIES:/);
});

test("TPV X/Z reports, immutable audit records and native/fiscal side-effect boundaries are explicit", async () => {
    const [closures, summary, repository, audit, sales, widget, config] = await Promise.all([
        source("tpv/tpvCierres.web.js"),
        source("tpv/tpvCierresCore.js"),
        source("tpv/tpvRepository.js"),
        source("tpv/tpvAuditoria.web.js"),
        source("tpv/tpvVentas.web.js"),
        readFile(new URL("%23htmlTPV.txt", repoRoot), "utf8"),
        source("internalConfig.js"),
    ]);

    assert.match(closures, /action: "TICKET_X_GENERATED"/);
    assert.match(closures, /readOnly: true, closesSession: false/);
    assert.match(closures, /action: "TICKET_Z_CLOSED"/);
    assert.match(closures, /getPendingTpvSales\(session\.sessionId\)/);
    assert.match(closures, /getPendingTpvRefunds\(session\.sessionId\)/);
    assert.match(closures, /totals\.reconciliationOk !== true/);
    assert.match(closures, /closed: true/);
    assert.match(closures, /closedByMemberId: operator\.operatorId/);
    assert.match(repository, /occurredAt: new Date\(\)/);
    assert.match(repository, /action: String\(action \|\| "UNKNOWN"\)/);
    assert.match(repository, /actorId: String\(actorId \|\| "UNKNOWN"\)/);
    assert.match(audit, /await requireCajero\(traceId\)/);
    assert.match(audit, /export const obtenerAuditoriaTPV = webMethod/);
    assert.match(audit, /TPV_COLLECTIONS\.AUDITORIA/);
    assert.match(audit, /record\.payload\?\.sessionId/);
    assert.match(audit, /data: \{[\s\S]*items,[\s\S]*count: items\.length/);
    assert.doesNotMatch(audit, /isSynthetic: true|realPayment: false/);
    const controller = await readFile(new URL("../public/tpvPageController.js", backendRoot), "utf8");
    assert.match(controller, /import \{ obtenerAuditoriaTPV \} from "backend\/tpv\/tpvAuditoria\.web"/);
    assert.match(controller, /case "AUDIT_LIST":[\s\S]*?obtenerAuditoriaTPV/);
    assert.doesNotMatch(controller, /case "AUDIT_LIST":[\s\S]*?obtenerMovimientosCaja/);
    assert.match(widget, /Auditoría de operaciones/);
    assert.match(widget, /item\.action/);
    assert.match(widget, /item\.actorId/);
    assert.match(sales, /TPV_OPERATIONAL_LEDGER_NOT_CONFIGURED/);
    assert.match(config, /TPV_RUNTIME_POLICY/);
    assert.doesNotMatch(config, /fiscalEmission|FISCAL_EMISSION_ENABLED/);
    assert.match(config, /SOURCE_TYPE: "TPV"/);
    assert.doesNotMatch(config, /ALLOW_NATIVE_WRITES|CAPABILITIES:/);
    assert.doesNotMatch(sales, /createOrder|createInvoice|verifactuQrUrl/i);
    assert.doesNotMatch(widget, /verifactuQrUrl|Veri\*Factu/i);
    assert.match(summary, /reconciliationOk = totals\.totalCollectedMinor === totals\.netSalesMinor/);
});

test("TPV operational session contract exposes authenticated identity, Madrid time and distinct lifecycle states", async () => {
    const [cash, repository, movements, sales, refunds, closures, audit, controller, widget] = await Promise.all([
        source("tpv/tpvCaja.web.js"),
        source("tpv/tpvRepository.js"),
        source("tpv/tpvMovimientos.web.js"),
        source("tpv/tpvVentas.web.js"),
        source("tpv/tpvDevoluciones.web.js"),
        source("tpv/tpvCierres.web.js"),
        source("tpv/tpvAuditoria.web.js"),
        readFile(new URL("../public/tpvPageController.js", backendRoot), "utf8"),
        readFile(new URL("%23htmlTPV.txt", repoRoot), "utf8"),
    ]);

    assert.match(repository, /export async function latestTpvSession/);
    assert.match(repository, /status: "CERRADA"/);
    assert.match(repository, /operatorResourceId: String\(state\.operatorResourceId/);
    assert.match(repository, /operatorDisplayName: String\(state\.operatorDisplayName/);
    assert.match(repository, /export async function latestOpenTpvSession/);
    assert.match(cash, /OPERATIONAL_CASH_STATUS = Object\.freeze/);
    assert.match(cash, /operationalStatus: OPERATIONAL_CASH_STATUS\.NONE/);
    assert.match(cash, /canOpenSession: false/);
    assert.match(cash, /operationalWritesUnavailableReason: "TPV_OPERATIONAL_LEDGER_NOT_CONFIGURED"/);
    assert.match(cash, /session\.sessionId !== "TPV-SESSION-" \+ madridDayKey\(\)/);
    assert.match(cash, /operatorId: session\.operatorId/);
    assert.match(cash, /actorId: session\.actorId/);
    assert.match(cash, /operatorResourceId: session\.operatorResourceId/);
    assert.match(cash, /operatorDisplayName: session\.operatorDisplayName/);
    assert.match(cash, /timeZone: TPV_RUNTIME_POLICY\.TIME_ZONE/);
    assert.match(cash, /integrationStatus: "NO_ENVIADO"/);

    assert.match(sales, /TPV_OPERATIONAL_LEDGER_NOT_CONFIGURED/);
    assert.doesNotMatch(sales, /latestOpenTpvSession|withTpvSessionLock|insertTpvEvent/);
    assert.doesNotMatch(sales, /realPayment: false|isSynthetic: true/);
    assert.match(refunds, /TPV_REFUND_PROVIDER_NOT_CONFIGURED/);
    assert.match(movements, /paymentStatus: "NOT_APPLICABLE"/);
    assert.match(closures, /paymentStatus: "NOT_APPLICABLE"/);
    assert.match(movements, /const requestedSessionId = sessionIdFromInput\(input\)/);
    assert.match(movements, /return recordSessionId === sessionId/);
    assert.match(movements, /integrationStatus: "NO_ENVIADO"/);
    assert.match(closures, /if \(!requestedSessionId\) throw new Error\("TPV_SESSION_REQUIRED"\)/);
    assert.match(closures, /operationalStatus: "CERRADA"/);
    assert.match(audit, /if \(!sessionId \|\| sessionId\.length > 128/);
    assert.match(audit, /recordSessionId === sessionId/);
    assert.match(audit, /recordSessionId\s*\?\s*recordSessionId === sessionId/);
    assert.match(audit, /timeZone: TPV_RUNTIME_POLICY\.TIME_ZONE/);
    assert.match(controller, /case "PARTIAL_CASH_COUNT":[\s\S]*?registrarArqueoParcial/);
    assert.match(controller, /const sessionId = optionalString\(payload\.sessionId, 160\)/);
    assert.match(controller, /if \(!sessionId\) throw new Error\("TPV_SESSION_REQUIRED"\)/);
    assert.match(widget, /new Intl\.DateTimeFormat\("es-ES",[\s\S]*?timeZone/);
    assert.match(widget, /operatorLabel/);
    assert.match(widget, /operationalStatus === "CERRADA"/);
    assert.match(widget, /canOpenSession = state\.session\?\.canOpenSession/);
    assert.match(widget, /await refreshCashState\(\)/);
    assert.doesNotMatch(widget, /SIMULATED_SUCCESS/);
});

test.todo("Wix Preview: map synthetic TPV staff identity to the real Wix Bookings resourceId and reject a cross-operator mismatch");
test.todo("Wix Preview: open one session, verify authenticated member/operator/resource IDs, terminal, timestamps and opening balance in CMS");
test.todo("Wix Preview: complete split-payment sales and reconcile Wix-native order/receipt IDs when native integration is authorized");
test.todo("Wix Preview: verify payment-method totals, cash drawer balance, cash-only movements and partial refunds against CMS ledger");
test.todo("Wix Preview: generate X without closing, then Z once; verify lock, replay conflict, counted cash, difference, X/Z linkage and closed session");
test.todo("Wix Preview: verify the wired dedicated audit-event reader against persisted session events and distinguish it from ledger movement history");
test.todo("Wix Preview: verify audit coverage for writes, reads, exports, printing and denied permission attempts, including sessionId");
test.todo("Published negative test: native payments, fiscal writes and VeriFactu QR remain unavailable until their release gates are approved");
