import { createHash } from "node:crypto";
import { Permissions, webMethod } from "wix-web-module";
import { getMyStaffContext, requireAdmin, requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { resolveTpvContext } from "backend/tpv/tpvContext";
import { prepareTpvSaleCatalog } from "backend/tpv/tpvSalePreparation";
import { validateSaleDraft } from "backend/tpv/tpvValidation";
import { assertTpvPaymentMethodsSupported } from "backend/tpv/tpvSalePreparationCore";
import { getTpvWriteV1Blockers } from "backend/tpv/tpvWriteV1Contract";
import { fromMinorUnits, normalizeIdempotencyKey, toMinorUnits } from "backend/tpv/tpvUtils";
import {
    appendTpvTestRunEvent,
    createTpvTestRun,
    getLatestTpvTestRun,
    purgeExpiredTpvTestRuns,
    getTpvTestRun,
} from "backend/tpv/tpvTestRuntimeRepository";
import { hashTpvTestValue, summarizeTpvTestRun } from "backend/tpv/tpvTestRuntimeCore";

function ok(data, traceId) {
    return { status: "SUCCESS", data, error: null, traceId };
}

function fail(code, traceId, details = {}) {
    return {
        status: "ERROR",
        data: null,
        error: { code: String(code || "TPV_TEST_RUNTIME_FAILED") },
        persisted: false,
        testPersisted: false,
        ...details,
        traceId,
    };
}

function saleIdFor(sessionId, idempotencyKey) {
    return "TPV-TEST-SALE-" + createHash("sha256")
        .update(String(sessionId) + ":" + String(idempotencyKey), "utf8")
        .digest("hex").slice(0, 24);
}

function sessionResponse(run, actor, now = new Date()) {
    if (!run || run.status !== "OPEN" || new Date(run.payload.activeUntil || 0).getTime() <= now.getTime()) {
        return {
            sessionId: run?.payload?.sessionId || null,
            status: run?.status === "CLOSED" ? "CERRADA" : "SIN_SESION",
            operationalStatus: run?.status === "CLOSED" ? "CERRADA" : "SIN_SESION",
            canOpenSession: true,
            operatorId: actor.operatorId,
            actorId: actor.actorId,
            operatorDisplayName: actor.operatorDisplayName,
            now: now.toISOString(),
            timeZone: "Europe/Madrid",
            integrationStatus: "INTERNO",
            paymentStatus: "NOT_APPLICABLE",
            testRuntime: true,
            sourceType: "SYNTHETIC",
            persisted: false,
        };
    }
    return {
        sessionId: run.payload.sessionId,
        status: "ABIERTA",
        operationalStatus: "ABIERTA",
        canOpenSession: false,
        operatorId: run.payload.operatorId,
        actorId: run.payload.actorId,
        operatorDisplayName: run.payload.operatorDisplayName,
        operatorResourceId: run.payload.operatorResourceId,
        openedAt: run.payload.openedAt,
        openingCash: fromMinorUnits(run.payload.openingCashMinor),
        now: now.toISOString(),
        timeZone: "Europe/Madrid",
        integrationStatus: "INTERNO",
        paymentStatus: "NOT_APPLICABLE",
        testRuntime: true,
        sourceType: "SYNTHETIC",
        persisted: false,
    };
}

async function trustedCashier(traceId) {
    await requireCajero(traceId);
    const [actor, staff] = await Promise.all([
        resolveTpvContext(traceId),
        getMyStaffContext(traceId),
    ]);
    return { actor, isAdmin: staff?.rolWebsite === "ADMIN" };
}

async function trustedAdmin(traceId) {
    await requireAdmin(traceId);
    return resolveTpvContext(traceId);
}

async function currentOpenRun(actor) {
    const run = await getLatestTpvTestRun(actor.actorId, { openOnly: true });
    if (!run) throw new Error("TPV_SESSION_NOT_OPEN");
    return run;
}

function findPriorEvent(run, idempotencyKey, eventType, request) {
    const key = normalizeIdempotencyKey(idempotencyKey);
    const claim = run.payload.idempotencyIndex?.[key];
    if (!claim) return null;
    const event = run.payload.events.find((entry) => entry.sequence === claim.sequence);
    const fingerprint = hashTpvTestValue(request);
    if (!event || event.eventType !== eventType ||
        event.data?.requestFingerprint !== fingerprint) {
        throw new Error("TPV_IDEMPOTENCY_CONFLICT");
    }
    return event;
}

function saleReplayResponse(event, sessionId, traceId) {
    const data = event.data;
    return ok({
        saleId: data.saleId,
        sessionId,
        totalVenta: fromMinorUnits(data.totalMinor),
        subtotalNeto: fromMinorUnits(data.taxBaseMinor),
        impuestosTotal: fromMinorUnits(data.taxMinor),
        lineas: data.lineas,
        pagos: data.payments,
        paymentStatus: "SIMULATED",
        paymentVerified: false,
        inventoryMutated: false,
        fiscalDocumentIssued: false,
        sourceType: "SYNTHETIC",
        testRuntime: true,
        testPersisted: true,
        persisted: false,
        realPayment: false,
        externalSideEffects: false,
        replayed: true,
        traceId,
    }, traceId);
}

async function appendEvent(actor, input, eventType, data, {
    closeRun = false,
    buildData,
    requestFingerprint,
} = {}) {
    const sessionId = String(input?.sessionId || "").trim();
    const idempotencyKey = normalizeIdempotencyKey(input?.idempotencyKey);
    return appendTpvTestRunEvent({
        sessionId,
        actorId: actor.actorId,
        eventType,
        idempotencyKey,
        data,
        buildData,
        requestFingerprint,
        traceId: input?.traceId,
        closeRun,
    });
}

export const obtenerEstadoCajaPrueba = webMethod(
    Permissions.SiteMember,
    async () => {
        const traceId = makeTraceId("tpv-test-cashier-state");
        try {
            const { actor, isAdmin } = await trustedCashier(traceId);
            if (!isAdmin) {
                return ok({
                    sessionId: null,
                    status: "SIN_SESION",
                    operationalStatus: "SIN_SESION",
                    canOpenSession: false,
                    operatorId: actor.operatorId,
                    actorId: actor.actorId,
                    operatorDisplayName: actor.operatorDisplayName,
                    testRuntime: false,
                    sourceType: "SYNTHETIC",
                    persisted: false,
                }, traceId);
            }
            const latest = await getLatestTpvTestRun(actor.actorId);
            const open = latest?.status === "OPEN" &&
                new Date(latest.payload.activeUntil || 0).getTime() > Date.now()
                ? latest
                : null;
            return ok(sessionResponse(open || latest, actor), traceId);
        } catch (error) {
            return fail(error?.code || error?.message, traceId);
        }
    }
);

export const abrirSesionCajaPrueba = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-test-session-open");
        try {
            const actor = await trustedAdmin(traceId);
            await purgeExpiredTpvTestRuns();
            const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
            const openingCashMinor = toMinorUnits(input.openingCash, "OPENING_CASH");
            const sessionId = "TPV-SESSION-" + createHash("sha256")
                .update(actor.actorId + ":" + idempotencyKey, "utf8")
                .digest("hex").slice(0, 32);
            let priorSession = null;
            try {
                priorSession = await getTpvTestRun(sessionId, actor.actorId);
            } catch (error) {
                if (String(error?.message || error?.code) !== "TPV_TEST_RUN_NOT_FOUND") throw error;
            }
            if (!priorSession) {
                const existing = await getLatestTpvTestRun(actor.actorId, { openOnly: true });
                if (existing) return fail("TPV_TEST_SESSION_ALREADY_OPEN", traceId);
            }
            const created = await createTpvTestRun({
                sessionId,
                actorId: actor.actorId,
                operatorId: actor.operatorId,
                operatorDisplayName: actor.operatorDisplayName,
                operatorResourceId: actor.operatorResourceId,
                openingCashMinor,
                idempotencyKey,
                traceId,
            });
            return ok({
                ...sessionResponse(created.item, actor),
                replayed: created.created !== true,
                testPersisted: true,
                persisted: false,
                realPayment: false,
                externalSideEffects: false,
            }, traceId);
        } catch (error) {
            return fail(error?.code || error?.message, traceId);
        }
    }
);

export const validarVentaBorradorPrueba = webMethod(
    Permissions.SiteMember,
    async (venta = {}) => {
        const traceId = makeTraceId("tpv-test-sale-validate");
        try {
            const actor = await trustedAdmin(traceId);
            const run = await currentOpenRun(actor);
            const pagos = Array.isArray(venta?.pagos) ? venta.pagos : [];
            assertTpvPaymentMethodsSupported(pagos);
            const prepared = await prepareTpvSaleCatalog(venta?.lineas);
            const validated = validateSaleDraft({
                lineas: prepared.lineas,
                pagos,
                subtotalNeto: prepared.subtotalNeto,
                impuestosTotal: prepared.impuestosTotal,
                totalVenta: prepared.totalVenta,
            });
            const blockers = getTpvWriteV1Blockers({
                lineas: prepared.lineas,
                pagos: validated.pagos,
                totalVenta: validated.totalVenta,
            });
            const testCatalogReady = prepared.lineas.length > 0 &&
                !blockers.some((code) => [
                    "TPV_WRITE_V1_LINES_REQUIRED",
                    "TPV_WRITE_V1_TAX_RATE_UNVERIFIABLE",
                    "TPV_WRITE_V1_MULTI_VAT_UNSUPPORTED",
                ].includes(code));
            const lineas = validated.lineas.map((line, index) => ({
                ...line,
                taxGroupId: prepared.lineas[index].taxGroupId,
                desgloseImpuestos: prepared.lineas[index].desgloseImpuestos,
            }));
            return ok({
                ...validated,
                lineas,
                catalogVerified: true,
                taxVerified: true,
                testReady: blockers.length === 0,
                testCatalogReady,
                testReadinessBlockers: blockers,
                saleReadinessBlockers: blockers,
                saleReady: false,
                paymentVerified: false,
                inventoryVerified: false,
                consumerPricePresentationVerified: false,
                persisted: false,
                testPersisted: false,
                realPayment: false,
                externalSideEffects: false,
                sourceType: "SYNTHETIC",
                testRuntime: true,
                sessionId: run.payload.sessionId,
                taxCalculation: {
                    currency: prepared.taxCurrency,
                    calculatorIds: prepared.taxCalculatorIds,
                    totalTax: prepared.taxSummary.totalTax,
                    totalTaxableAmount: prepared.taxSummary.totalTaxableAmount,
                    totalTaxIncludedInPrice: prepared.taxSummary.totalTaxIncludedInPrice,
                    taxIncludedInPrice: prepared.taxIncludedInPrice,
                },
            }, traceId);
        } catch (error) {
            return fail(error?.code || error?.message, traceId);
        }
    }
);

export const registrarVentaPrueba = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-test-sale-register");
        try {
            const actor = await trustedAdmin(traceId);
            const run = await getTpvTestRun(input.sessionId, actor.actorId);
            const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
            const lineas = Array.isArray(input.lineas) ? input.lineas : [];
            const pagos = Array.isArray(input.pagos) ? input.pagos : [];
            const requestFingerprint = hashTpvTestValue({ lineas, pagos });
            const prior = findPriorEvent(run, idempotencyKey, "SALE_RECORDED", { lineas, pagos });
            if (prior) return saleReplayResponse(prior, run.payload.sessionId, traceId);
            assertTpvPaymentMethodsSupported(pagos);
            const prepared = await prepareTpvSaleCatalog(lineas);
            const validated = validateSaleDraft({
                lineas: prepared.lineas,
                pagos,
                subtotalNeto: prepared.subtotalNeto,
                impuestosTotal: prepared.impuestosTotal,
                totalVenta: prepared.totalVenta,
            });
            const blockers = getTpvWriteV1Blockers({
                lineas: prepared.lineas,
                pagos: validated.pagos,
                totalVenta: validated.totalVenta,
            });
            if (blockers.length) return fail("TPV_TEST_SALE_CONTRACT_INVALID", traceId, { blockers });
            const saleId = saleIdFor(run.payload.sessionId, idempotencyKey);
            const lineSnapshots = validated.lineas.map((line, index) => ({
                ...line,
                taxGroupId: prepared.lineas[index].taxGroupId,
                desgloseImpuestos: prepared.lineas[index].desgloseImpuestos,
            }));
            const paymentSnapshots = validated.pagos.map((payment) => ({
                method: payment.medioPago,
                amountReceivedMinor: toMinorUnits(payment.importe, "PAYMENT_RECEIVED"),
                changeMinor: toMinorUnits(payment.importeCambio || 0, "PAYMENT_CHANGE"),
                amountAppliedMinor: toMinorUnits(payment.importeAplicado, "PAYMENT_APPLIED"),
                paymentStatus: "SIMULATED",
                realPayment: false,
            }));
            const saleEventData = {
                saleId,
                requestFingerprint,
                totalMinor: toMinorUnits(validated.totalVenta, "SALE_TOTAL"),
                taxBaseMinor: toMinorUnits(validated.subtotalNeto, "SALE_BASE"),
                taxMinor: toMinorUnits(validated.impuestosTotal, "SALE_TAX"),
                lineas: lineSnapshots,
                payments: paymentSnapshots,
                paymentStatus: "SIMULATED",
                realPayment: false,
                stockMutation: false,
                fiscalDocumentIssued: false,
            };
            const result = await appendEvent(actor, input, "SALE_RECORDED", null, {
                requestFingerprint,
                buildData: () => saleEventData,
            });
            return ok({
                saleId,
                sessionId: run.payload.sessionId,
                totalVenta: validated.totalVenta,
                subtotalNeto: validated.subtotalNeto,
                impuestosTotal: validated.impuestosTotal,
                lineas: lineSnapshots,
                pagos: paymentSnapshots,
                paymentStatus: "SIMULATED",
                paymentVerified: false,
                inventoryMutated: false,
                fiscalDocumentIssued: false,
                sourceType: "SYNTHETIC",
                testRuntime: true,
                testPersisted: true,
                persisted: false,
                realPayment: false,
                externalSideEffects: false,
                replayed: result.replayed,
                traceId,
            }, traceId);
        } catch (error) {
            return fail(error?.code || error?.message, traceId, {
                requiresReconciliation: error?.code === "TPV_TEST_RUNTIME_CONCURRENT_RETRY_REQUIRED",
            });
        }
    }
);

export const registrarMovimientoCajaPrueba = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-test-cash-movement");
        try {
            const actor = await trustedAdmin(traceId);
            const movementType = String(input.movementType || "").trim().toUpperCase();
            if (!["ENTRADA", "SALIDA", "RETIRADA"].includes(movementType)) throw new Error("TPV_CASH_MOVEMENT_TYPE_INVALID");
            const paymentMethod = String(input.paymentMethod || "EFECTIVO").trim().toUpperCase();
            if (paymentMethod !== "EFECTIVO") throw new Error("TPV_CASH_MOVEMENT_REQUIRES_CASH");
            const amountMinor = toMinorUnits(input.amount, "CASH_MOVEMENT");
            if (amountMinor <= 0) throw new Error("TPV_CASH_MOVEMENT_AMOUNT_INVALID");
            const reason = String(input.reason || "").trim().slice(0, 500);
            const requestFingerprint = hashTpvTestValue({
                movementType,
                amountMinor,
                reason,
                paymentMethod: "EFECTIVO",
            });
            const result = await appendEvent(actor, input, "CASH_MOVEMENT", null, {
                requestFingerprint,
                buildData: (payload) => {
                    const summary = summarizeTpvTestRun(payload);
                    if (movementType !== "ENTRADA" && amountMinor > summary.expectedCashMinor) {
                        throw new Error("TPV_TEST_CASH_OUT_EXCEEDS_EXPECTED");
                    }
                    return {
                        movementType,
                        amountMinor,
                        reason,
                        paymentMethod: "EFECTIVO",
                        requestFingerprint,
                    };
                },
            });
            return ok({
                movementId: "TPV-TEST-MOV-" + result.event.sequence,
                sessionId: input.sessionId,
                movementType,
                amount: fromMinorUnits(amountMinor),
                paymentMethod: "EFECTIVO",
                sourceType: "SYNTHETIC",
                testPersisted: true,
                persisted: false,
                replayed: result.replayed,
                traceId,
            }, traceId);
        } catch (error) {
            return fail(error?.code || error?.message, traceId);
        }
    }
);

export const registrarArqueoParcialPrueba = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-test-partial-count");
        try {
            const actor = await trustedAdmin(traceId);
            const countedCashMinor = toMinorUnits(input.countedCash, "COUNTED_CASH");
            const result = await appendEvent(actor, input, "PARTIAL_CASH_COUNT", {
                countedCashMinor,
                reason: String(input.reason || "").trim().slice(0, 500),
            });
            return ok({
                sessionId: input.sessionId,
                countedCash: fromMinorUnits(countedCashMinor),
                testPersisted: true,
                persisted: false,
                replayed: result.replayed,
                sourceType: "SYNTHETIC",
                traceId,
            }, traceId);
        } catch (error) {
            return fail(error?.code || error?.message, traceId);
        }
    }
);

export const registrarDevolucionPrueba = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-test-refund");
        try {
            const actor = await trustedAdmin(traceId);
            const run = await getTpvTestRun(input.sessionId, actor.actorId);
            const saleId = String(input.saleId || "").trim();
            const payments = (Array.isArray(input.payments) ? input.payments : []).map((payment) => ({
                method: String(payment.paymentMethod || "").trim().toUpperCase(),
                amountMinor: toMinorUnits(payment.amount, "REFUND_AMOUNT"),
            }));
            const reason = String(input.reason || "").trim().slice(0, 500);
            const requestFingerprint = hashTpvTestValue({ saleId, payments, reason });
            const prior = findPriorEvent(run, input.idempotencyKey, "REFUND_RECORDED", {
                saleId,
                payments,
                reason,
            });
            if (prior) return ok({
                refundId: prior.data.refundId,
                saleId,
                total: fromMinorUnits(prior.data.totalMinor),
                refundStatus: "SIMULATED",
                realRefund: false,
                testPersisted: true,
                persisted: false,
                replayed: true,
                sourceType: "SYNTHETIC",
                traceId,
            }, traceId);
            if (!saleId || !payments.length || payments.some((payment) =>
                !["EFECTIVO", "TARJETA", "BIZUM"].includes(payment.method) || payment.amountMinor <= 0
            )) throw new Error("TPV_TEST_REFUND_ALLOCATION_INVALID");

            const totalMinor = payments.reduce((sum, payment) => sum + payment.amountMinor, 0);
            const refundId = "TPV-TEST-REFUND-" + resultId(input.idempotencyKey);
            const result = await appendEvent(actor, input, "REFUND_RECORDED", null, {
                requestFingerprint,
                buildData: (payload) => {
                    const saleEvent = payload.events.find((event) =>
                        event.eventType === "SALE_RECORDED" && event.data?.saleId === saleId
                    );
                    if (!saleEvent) throw new Error("TPV_TEST_REFUND_SALE_NOT_FOUND");
                    const originalByMethod = {};
                    for (const payment of saleEvent.data.payments || []) {
                        originalByMethod[payment.method] = (originalByMethod[payment.method] || 0) +
                            Number(payment.amountAppliedMinor || 0);
                    }
                    const priorByMethod = {};
                    for (const event of payload.events.filter((entry) =>
                        entry.eventType === "REFUND_RECORDED" && entry.data?.saleId === saleId
                    )) {
                        for (const payment of event.data.payments || []) {
                            priorByMethod[payment.method] = (priorByMethod[payment.method] || 0) +
                                Number(payment.amountMinor || 0);
                        }
                    }
                    for (const payment of payments) {
                        if ((priorByMethod[payment.method] || 0) + payment.amountMinor >
                            (originalByMethod[payment.method] || 0)) {
                            throw new Error("TPV_TEST_REFUND_EXCEEDS_ORIGINAL_PAYMENT");
                        }
                    }
                    return {
                        refundId,
                        requestFingerprint,
                        reason,
                        saleId,
                        totalMinor,
                        payments,
                        refundStatus: "SIMULATED",
                        realRefund: false,
                        externalSideEffects: false,
                    };
                },
            });
            return ok({
                refundId,
                saleId,
                total: fromMinorUnits(totalMinor),
                refundStatus: "SIMULATED",
                realRefund: false,
                testPersisted: true,
                persisted: false,
                replayed: result.replayed,
                sourceType: "SYNTHETIC",
                traceId,
            }, traceId);
        } catch (error) {
            return fail(error?.code || error?.message, traceId);
        }
    }
);

function resultId(value) {
    return createHash("sha256").update(String(value || ""), "utf8").digest("hex").slice(0, 20);
}

export const generarControlXPrueba = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-test-ticket-x");
        try {
            const actor = await trustedAdmin(traceId);
            const run = await getTpvTestRun(input.sessionId, actor.actorId);
            const requestFingerprint = hashTpvTestValue({ sessionId: input.sessionId });
            const prior = findPriorEvent(run, input.idempotencyKey, "TICKET_X_ISSUED", { sessionId: input.sessionId });
            if (prior) return ok({
                reportId: prior.data.reportId,
                sessionId: input.sessionId,
                totals: prior.data.totals,
                operationalStatus: "ABIERTA",
                closesSession: false,
                testPersisted: true,
                persisted: false,
                replayed: true,
                sourceType: "SYNTHETIC",
                traceId,
            }, traceId);
            if (run.status !== "OPEN") throw new Error("TPV_SESSION_CLOSED");
            const reportId = "TPV-TEST-X-" + resultId(input.idempotencyKey);
            const result = await appendEvent(actor, input, "TICKET_X_ISSUED", null, {
                requestFingerprint,
                buildData: (payload) => ({
                    reportId,
                    requestFingerprint,
                    totals: summarizeTpvTestRun(payload),
                    closesSession: false,
                }),
            });
            const totals = result.event.data.totals;
            return ok({
                reportId,
                sessionId: input.sessionId,
                totals,
                operationalStatus: "ABIERTA",
                closesSession: false,
                testPersisted: true,
                persisted: false,
                replayed: result.replayed,
                sourceType: "SYNTHETIC",
                traceId,
            }, traceId);
        } catch (error) {
            return fail(error?.code || error?.message, traceId);
        }
    }
);

export const generarCierreZPrueba = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-test-ticket-z");
        try {
            const actor = await trustedAdmin(traceId);
            const run = await getTpvTestRun(input.sessionId, actor.actorId);
            const countedCashMinor = toMinorUnits(input.countedCash, "COUNTED_CASH");
            const request = {
                sessionId: input.sessionId,
                countedCashMinor,
                differenceReason: String(input.differenceReason || "").trim(),
            };
            const prior = findPriorEvent(run, input.idempotencyKey, "TICKET_Z_CLOSED", request);
            if (prior) return ok({
                reportId: prior.data.reportId,
                sessionId: input.sessionId,
                expectedCash: fromMinorUnits(prior.data.totals.expectedCashMinor),
                countedCash: fromMinorUnits(prior.data.countedCashMinor),
                difference: fromMinorUnits(prior.data.differenceMinor),
                closed: true,
                operationalStatus: "CERRADA",
                fiscalLedgerWritten: false,
                testPersisted: true,
                persisted: false,
                replayed: true,
                sourceType: "SYNTHETIC",
                traceId,
            }, traceId);
            const reportId = "TPV-TEST-Z-" + resultId(input.idempotencyKey);
            const requestFingerprint = hashTpvTestValue(request);
            const result = await appendEvent(actor, input, "TICKET_Z_CLOSED", null, {
                closeRun: true,
                requestFingerprint,
                buildData: (payload) => {
                    const totals = summarizeTpvTestRun(payload);
                    const differenceMinor = countedCashMinor - totals.expectedCashMinor;
                    if (differenceMinor !== 0 && request.differenceReason.length < 3) {
                        throw new Error("TPV_COUNT_DIFFERENCE_REASON_REQUIRED");
                    }
                    return {
                        reportId,
                        requestFingerprint,
                        countedCashMinor,
                        differenceMinor,
                        differenceReason: request.differenceReason,
                        totals: { ...totals, countedCashMinor, differenceMinor },
                        fiscalLedgerWritten: false,
                        closesSession: true,
                    };
                },
            });
            const totals = result.event.data.totals;
            const differenceMinor = result.event.data.differenceMinor;
            return ok({
                reportId,
                sessionId: input.sessionId,
                expectedCash: fromMinorUnits(totals.expectedCashMinor),
                countedCash: fromMinorUnits(countedCashMinor),
                difference: fromMinorUnits(differenceMinor),
                closed: true,
                operationalStatus: "CERRADA",
                fiscalLedgerWritten: false,
                testPersisted: true,
                persisted: false,
                replayed: result.replayed,
                sourceType: "SYNTHETIC",
                traceId,
            }, traceId);
        } catch (error) {
            return fail(error?.code || error?.message, traceId);
        }
    }
);

export const obtenerResumenCajaPrueba = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-test-session-summary");
        try {
            const actor = await trustedAdmin(traceId);
            const run = await getTpvTestRun(input.sessionId, actor.actorId);
            const totals = summarizeTpvTestRun(run.payload);
            return ok({
                ...totals,
                sessionId: run.payload.sessionId,
                operationalStatus: run.status === "OPEN" ? "ABIERTA" : "CERRADA",
                integrationStatus: "INTERNO",
                paymentStatus: "NOT_APPLICABLE",
                now: new Date().toISOString(),
                timeZone: "Europe/Madrid",
                grossSales: fromMinorUnits(totals.grossSalesMinor),
                netSales: fromMinorUnits(totals.netSalesMinor),
                totalRefunds: fromMinorUnits(totals.refundsMinor),
                totalCollected: fromMinorUnits(totals.totalCollectedMinor),
                expectedCash: fromMinorUnits(totals.expectedCashMinor),
                breakdown: {
                    EFECTIVO: fromMinorUnits(totals.cashMinor),
                    TARJETA: fromMinorUnits(totals.cardMinor),
                    BIZUM: fromMinorUnits(totals.bizumMinor),
                    OTROS: fromMinorUnits(totals.otherMinor),
                },
                sourceType: "SYNTHETIC",
                persisted: false,
            }, traceId);
        } catch (error) {
            return fail(error?.code || error?.message, traceId);
        }
    }
);

export const obtenerAuditoriaTPVPrueba = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-test-audit-list");
        try {
            const actor = await trustedAdmin(traceId);
            const run = await getTpvTestRun(input.sessionId, actor.actorId);
            const events = run.payload.events.slice(-Math.max(1, Math.min(100, Number(input.limit) || 50)));
            const records = events.map((event) => ({
                auditId: event.eventHash,
                action: event.eventType,
                operatorId: event.actorId,
                sessionId: run.payload.sessionId,
                entityType: event.eventType,
                entityId: event.data?.saleId || event.data?.refundId || event.data?.reportId || run.payload.sessionId,
                createdAt: event.occurredAt,
                source: "TPV_TEST_RUNTIME",
                sourceType: "SYNTHETIC",
                sequence: event.sequence,
                eventHash: event.eventHash,
            }));
            return ok({ records, items: records, hasMore: run.payload.events.length > events.length, testOnly: true }, traceId);
        } catch (error) {
            return fail(error?.code || error?.message, traceId);
        }
    }
);

export const exportarMovimientosCajaPrueba = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-test-movement-export");
        try {
            const actor = await trustedAdmin(traceId);
            const run = await getTpvTestRun(input.sessionId, actor.actorId);
            const movementTypes = new Set(["SALE_RECORDED", "REFUND_RECORDED", "CASH_MOVEMENT", "PARTIAL_CASH_COUNT"]);
            const records = run.payload.events.filter((event) => movementTypes.has(event.eventType)).map((event) => ({
                movementId: "TPV-TEST-MOV-" + event.sequence,
                sessionId: run.payload.sessionId,
                movementType: event.eventType,
                sourceType: "SYNTHETIC",
                amount: fromMinorUnits(Number(event.data?.totalMinor ?? event.data?.amountMinor ?? event.data?.countedCashMinor ?? 0)),
                paymentMethod: event.data?.payments?.[0]?.method || event.data?.paymentMethod || null,
                reason: event.data?.reason || "",
                reference: event.data?.saleId || event.data?.refundId || event.sequence,
                status: "SIMULATED",
                createdAt: event.occurredAt,
                currency: "EUR",
                persisted: false,
            }));
            return ok({ records, items: records, testOnly: true }, traceId);
        } catch (error) {
            return fail(error?.code || error?.message, traceId);
        }
    }
);

export const exportarAuditoriaTPVPrueba = obtenerAuditoriaTPVPrueba;
