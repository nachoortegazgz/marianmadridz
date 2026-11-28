import { Permissions, webMethod } from "wix-web-module";
import { getMyCajeroContext, requireTpvOperator } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { validateSaleDraft } from "backend/tpv/tpvValidation";
import { error as tpvError, ok as tpvOk, pending as tpvPending } from "backend/tpv/tpvEnvelope";
import { prepareTpvSaleCatalog } from "backend/tpv/tpvSalePreparation";
import { assertTpvPaymentMethodsSupported } from "backend/tpv/tpvSalePreparationCore";
import { getTpvWriteV1Blockers } from "backend/tpv/tpvWriteV1Contract";
import { BUSINESS_COLLECTIONS, SDK_CONFIG, TPV_COLLECTIONS, TPV_RUNTIME_POLICY } from "backend/internalConfig";
import { CONSISTENCY, getItem, insertItem, updateItem } from "backend/dataAccess";
import { appendTpvAudit, insertTpvEvent, latestOpenTpvSession, withTpvSessionLock } from "backend/tpv/tpvRepository";
import { toMinorUnits } from "backend/tpv/tpvUtils";
import { createTpvRecordMetadata } from "backend/tpv/tpvRecordNature";
import { createHash } from "node:crypto";
import { logger } from "backend/logger";
import { normalizeTpvError } from "backend/tpv/tpvError";
import { resolveTpvContact } from "backend/tpv/tpvNativeDirectory";
import {
    addTpvNativeCashPayment,
    createTpvNativeOrder,
    findTpvNativeOrderByExternalId,
} from "backend/tpv/tpvNativeCommerce";

function _safeTpvErrorCode(error, fallbackCode) {
    return normalizeTpvError(error, fallbackCode).code;
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PREPARATION_MESSAGES = Object.freeze({
    TPV_LINES_REQUIRED_OR_LIMIT_EXCEEDED: "La venta debe contener entre 1 y 100 líneas.",
    TPV_LINE_TAX_CLASSIFICATION_UNSUPPORTED: "La línea no tiene una clasificación fiscal configurada para el TPV.",
    TPV_CATALOG_ITEM_ID_INVALID: "El identificador del producto o servicio no es válido.",
    TPV_CATALOG_PRODUCTS_NOT_FOUND: "No se han encontrado en Catalog V3 estos productos: {ids}. Actualiza el catálogo y vuelve a intentarlo.",
    TPV_INVALID_QUANTITY: "La cantidad debe ser un número entero positivo.",
    TPV_DISCOUNT_NOT_CONFIGURED: "Los descuentos no están habilitados para el TPV hasta disponer de una regla de autorización y cálculo en backend.",
    TPV_PRODUCT_NOT_AVAILABLE_IN_POS: "El producto no está disponible en el catálogo del TPV.",
    TPV_PRODUCT_VARIANTS_UNAVAILABLE: "El producto no tiene variantes vendibles disponibles.",
    TPV_PRODUCT_VARIANT_REQUIRED: "Selecciona una variante del producto antes de continuar.",
    TPV_PRODUCT_VARIANT_NOT_FOUND: "La variante seleccionada ya no está disponible en el catálogo.",
    TPV_SERVICE_NOT_AVAILABLE: "El servicio no está disponible en el catálogo actual.",
    TPV_SERVICE_TYPE_NOT_SUPPORTED: "El tipo de servicio no está habilitado para venta directa en el TPV.",
    TPV_SERVICE_PRICE_NOT_FIXED: "El servicio no tiene un precio fijo verificable en Bookings.",
    TPV_SERVICE_CATALOG_PAGE_INCOMPLETE: "No se ha podido consultar el catálogo completo de servicios.",
    TPV_STAFF_NOT_ALLOWED: "El profesional seleccionado no está vinculado a un miembro autorizado de Bookings.",
    TPV_PAYMENT_METHOD_NOT_VERIFIED: "Los bonos y tarjetas regalo requieren consultar y validar su saldo antes de aceptarse como pago.",
    TPV_CATALOG_PRICE_UNAVAILABLE: "Wix no ha devuelto un precio actual verificable para esta línea.",
    TPV_CATALOG_CURRENCY_MISMATCH: "El producto o servicio no está configurado en euros.",
    TPV_TAX_CALCULATION_FAILED: "Wix no ha podido calcular los impuestos de la venta.",
    TPV_TAX_RESULT_INCOMPLETE: "La respuesta fiscal de Wix está incompleta; no se puede validar la venta.",
    TPV_TAX_SETTINGS_UNAVAILABLE: "No se ha podido leer la configuración fiscal global de Wix.",
    TPV_TAX_PRICE_MODE_MISMATCH: "El modo de precio con o sin impuestos devuelto por Wix no coincide con la configuración global.",
    TPV_TAX_CURRENCY_MISMATCH: "El cálculo fiscal no ha devuelto la moneda EUR esperada.",
    TPV_TAX_RESULT_LINE_MISSING: "Wix no ha devuelto el cálculo fiscal de una de las líneas.",
    TPV_TAX_RESULT_LINE_INCONSISTENT: "El desglose fiscal devuelto por Wix no coincide con la línea de venta.",
    TPV_TAX_ROUNDING_MISMATCH: "Los totales fiscales de Wix no cuadran con el desglose por líneas.",
});

function preparationFailure(error, traceId) {
    const code = _safeTpvErrorCode(error, "TPV_SALE_PREPARATION_FAILED");
    const invalidProductIds = Array.isArray(error?.invalidProductIds) ? error.invalidProductIds : [];
    const message = (PREPARATION_MESSAGES[code] ||
        "No se ha podido preparar la venta con los datos actuales del catálogo y la configuración fiscal de Wix.")
        .replace("{ids}", invalidProductIds.join(", ") || "no identificados");
    return tpvError(
        code,
        message,
        [
            "No se ha registrado ninguna venta ni se ha iniciado ningún cobro.",
            "Actualiza el catálogo y vuelve a validar la venta.",
            "Si el error es fiscal, no modifiques manualmente el impuesto ni el precio en el navegador.",
        ],
        {
            persisted: false,
            retryable: false,
            traceId,
            technicalDetail: code,
            invalidProductIds: Array.isArray(error?.invalidProductIds) ? error.invalidProductIds : [],
        }
    );
}

function buildSaleReadiness(prepared, validated) {
    const containsProducts = prepared.lineas.some((line) => line.tipoLinea === "PRODUCTO");
    const writeV1Blockers = getTpvWriteV1Blockers({
        lineas: prepared.lineas,
        pagos: validated.pagos,
        totalVenta: validated.totalVenta,
    });
    // Payment authorization is an external gateway result, not a precondition
    // that may be hard-coded false before the transaction writer is reached.
    // Consumer-price presentation is already derived from the verified Wix
    // catalog/tax preparation; do not add a permanent synthetic blocker here.
    const saleReadinessBlockers = [...writeV1Blockers];
    // Native Wix Orders reserves/decrements Wix Stores stock when the POS order is placed.
    // The final stock decision is made by Create Order, never by a parallel custom ledger.
    return {
        containsProducts,
        inventoryManagedBy: "WIX_ECOM_ORDER",
        writeV1Blockers,
        saleReadinessBlockers,
    };
}

/**
 * Validates a sale using current Wix Catalog V3 / Bookings prices and Wix tax
 * calculation. Client-supplied prices, taxes and totals are deliberately ignored.
 */
export const validarVentaBorrador = webMethod(
    Permissions.SiteMember,
    async (venta = {}) => {
        const traceId = makeTraceId("tpv-sale-prepare");
        await requireTpvOperator(traceId);
        try {
            assertTpvPaymentMethodsSupported(venta?.pagos);
            const prepared = await prepareTpvSaleCatalog(venta?.lineas);
            const validated = validateSaleDraft({
                lineas: prepared.lineas,
                pagos: venta?.pagos,
                subtotalNeto: prepared.subtotalNeto,
                impuestosTotal: prepared.impuestosTotal,
                totalVenta: prepared.totalVenta,
            });

            const lineas = validated.lineas.map((line, index) => ({
                ...line,
                taxGroupId: prepared.lineas[index].taxGroupId,
                desgloseImpuestos: prepared.lineas[index].desgloseImpuestos,
            }));

            const saleReadiness = buildSaleReadiness(prepared, validated);
            const { containsProducts, inventoryManagedBy, writeV1Blockers, saleReadinessBlockers } = saleReadiness;

            return tpvOk({
                ...validated,
                lineas,
                catalogVerified: true,
                taxVerified: true,
                commercialRecordReady: lineas.length > 0,
                paymentVerified: false,
                inventoryVerified: !containsProducts,
                inventoryManagedBy,
                consumerPricePresentationVerified: false,
                saleReady: saleReadinessBlockers.length === 0,
                saleReadinessBlockers,
                writeContractV1: {
                    eligible: writeV1Blockers.length === 0,
                    blockers: writeV1Blockers,
                },
                taxCalculation: {
                    currency: prepared.taxCurrency,
                    calculatorIds: prepared.taxCalculatorIds,
                    totalTax: prepared.taxSummary.totalTax,
                    totalTaxableAmount: prepared.taxSummary.totalTaxableAmount,
                    totalTaxIncludedInPrice: prepared.taxSummary.totalTaxIncludedInPrice,
                    taxIncludedInPrice: prepared.taxIncludedInPrice,
                },
                salePreparationVersion: "TPV_SALE_PREPARATION_V1",
                persisted: false,
            }, { traceId });
        } catch (error) {
            return preparationFailure(error, traceId);
        }
    }
);

async function salePendingEnvelope(record, {
    replayed,
    auditPersisted = true,
    auditErrorCode = null,
    traceId,
}) {
    const payment = Array.isArray(record.paymentSelection) ? record.paymentSelection[0] : null;
    const reason = !record.orderId
        ? record.draftOrderReason || "TPV_ORDER_RECONCILIATION_REQUIRED"
        : record.requiresReconciliation === true
            ? record.draftOrderReason || "TPV_SALE_RECONCILIATION_REQUIRED"
            : "TPV_SALE_PENDING_PAYMENT";
    const paymentStatus = record.status === "CONFIRMADA" ? "PAID" :
        payment?.confirmed === true ? "PAID" : "NOT_PAID";

    return tpvPending(reason, {
        orderId: record.orderId || null,
        idempotencyKey: record._id,
        totalVenta: record.totalVenta,
        medioPago: record.medioPago || null,
        paymentStatus,
        paymentId: payment?.paymentId || null,
        ledgerMovementId: payment?.ledgerMovementId || null,
        requiresReconciliation: record.requiresReconciliation === true || !auditPersisted,
        persisted: true,
        replayed,
        retryable: false,
        solution: !record.orderId ? "RECONCILE_WIX_ORDER" :
            record.requiresReconciliation ? "RECONCILE_TPV_SIDE_EFFECTS" : "COLLECT_PAYMENT",
        sourceType: record.sourceType,
        auditPersisted,
        auditErrorCode,
        resolutionAttempts: [
            { step: "operator-authorization", status: "VERIFIED" },
            { step: "catalog-and-tax-recalculation", status: "VERIFIED" },
            { step: "native-wix-order", status: record.orderId ? "PERSISTED" : "PENDING", reason: record.draftOrderReason || null },
            { step: "cash-payment", status: !payment ? "NOT_APPLICABLE" : payment.confirmed ? "PERSISTED" : "PENDING" },
            { step: "cash-ledger", status: !payment ? "NOT_APPLICABLE" : payment.ledgerMovementId ? "PERSISTED" : "PENDING" },
            { step: "operational-audit", status: auditPersisted ? "PERSISTED" : "PENDING", ...(auditErrorCode ? { errorCode: auditErrorCode } : {}) },
        ],
        traceId,
    });
}

function saleSuccessEnvelope(record, { replayed, auditPersisted, traceId }) {
    const payment = record.paymentSelection[0];
    return tpvOk({
        orderId: record.orderId,
        idempotencyKey: record._id,
        totalVenta: record.totalVenta,
        totalVentaMinor: record.totalVentaMinor,
        medioPago: "EFECTIVO",
        paymentStatus: "PAID",
        paymentId: payment.paymentId,
        ledgerMovementId: payment.ledgerMovementId,
        persisted: true,
        orderPersisted: true,
        paymentPersisted: true,
        ledgerPersisted: true,
        auditPersisted,
        requiresReconciliation: false,
        replayed,
        sourceType: record.sourceType,
    }, { traceId });
}

async function persistSaleCashPayment(record, traceId) {
    let current = record;
    const originalPayment = current.paymentSelection?.[0];
    if (!originalPayment) return { record: current, errorCode: null };

    const writeStatus = originalPayment.writeStatus ||
        (originalPayment.confirmed === true ? "CONFIRMED" : "NOT_STARTED");
    try {
        if (writeStatus === "NOT_STARTED") {
            current = await updateItem(BUSINESS_COLLECTIONS.TRANSACCIONES_TPV, {
                ...current,
                paymentSelection: [{
                    ...originalPayment,
                    confirmed: false,
                    writeStatus: "STARTED",
                }],
                requiresReconciliation: true,
                draftOrderReason: "CASH_PAYMENT_WRITE_STARTED",
            }, { consistency: CONSISTENCY.STRONG });
        }

        const amountMinor = toMinorUnits(originalPayment.importeAplicado, "TPV_CASH_PAYMENT_AMOUNT");
        const payment = await addTpvNativeCashPayment(current.orderId, amountMinor, {
            allowCreate: writeStatus === "NOT_STARTED",
        });

        const ledger = await insertTpvEvent(
            TPV_COLLECTIONS.PAGOS,
            current._id + ":PAYMENT:EFECTIVO",
            {
                sessionId: current.sessionId,
                saleId: current._id,
                orderId: current.orderId,
                paymentId: payment.paymentId,
                paymentMethod: "EFECTIVO",
                amountMinor,
                concept: "Cobro TPV " + current._id,
                operatorResourceId: current.operatorResourceId || null,
                operatorId: current.operatorId || null,
                traceId: current.traceId || traceId,
            }
        );
        const ledgerItem = ledger?.item || ledger?.data || ledger;
        const ledgerMovementId = String(ledgerItem?._id || ledgerItem?.transactionId || "");
        if (!GUID.test(ledgerMovementId)) throw new Error("TPV_PAYMENT_LEDGER_ID_INVALID");

        const confirmedPayment = {
            ...originalPayment,
            confirmed: true,
            writeStatus: "CONFIRMED",
            paymentId: payment.paymentId,
            ledgerMovementId,
            amountMinor,
            paymentStatus: payment.paymentStatus,
        };
        current = await updateItem(BUSINESS_COLLECTIONS.TRANSACCIONES_TPV, {
            ...current,
            medioPago: "EFECTIVO",
            paymentSelection: [confirmedPayment],
            status: "CONFIRMADA",
            requiresReconciliation: false,
            draftOrderReason: null,
        }, { consistency: CONSISTENCY.STRONG });
        return { record: current, errorCode: null };
    } catch (error) {
        const code = _safeTpvErrorCode(error, "TPV_CASH_PAYMENT_RECONCILIATION_REQUIRED");
        try {
            current = await updateItem(BUSINESS_COLLECTIONS.TRANSACCIONES_TPV, {
                ...current,
                requiresReconciliation: true,
                draftOrderReason: code,
            }, { consistency: CONSISTENCY.STRONG });
        } catch (updateError) {
            logger.error("TPV sale reconciliation marker update failed", {
                traceId,
                idempotencyKey: current._id,
                errorCode: _safeTpvErrorCode(updateError, "TPV_SALE_UPDATE_FAILED"),
            });
        }
        return { record: current, errorCode: code };
    }
}

async function resumeExistingSale(record, { buyer, replayed, traceId }) {
    let current = record;
    if (!current.orderId) {
        try {
            const recovered = await findTpvNativeOrderByExternalId({
                externalOrderId: current._id,
                startedAt: current.createdAt,
                buyer,
            });
            if (recovered) {
                if (recovered.status !== "APPROVED" || recovered.paymentStatus !== "NOT_PAID") {
                    throw new Error("TPV_WIX_ORDER_RECOVERED_WITH_UNEXPECTED_STATE");
                }
                current = await updateItem(BUSINESS_COLLECTIONS.TRANSACCIONES_TPV, {
                    ...current,
                    orderId: recovered.orderId,
                    requiresReconciliation: (current.paymentSelection || []).length > 0,
                    draftOrderReason: (current.paymentSelection || []).length > 0 ? "CASH_PAYMENT_PENDING" : null,
                }, { consistency: CONSISTENCY.STRONG });
            }
        } catch (error) {
            const code = _safeTpvErrorCode(error, "TPV_ORDER_RECONCILIATION_REQUIRED");
            try {
                current = await updateItem(BUSINESS_COLLECTIONS.TRANSACCIONES_TPV, {
                    ...current,
                    requiresReconciliation: true,
                    draftOrderReason: code,
                }, { consistency: CONSISTENCY.STRONG });
            } catch (updateError) {
                logger.error("TPV order recovery marker update failed", {
                    traceId,
                    idempotencyKey: current._id,
                    errorCode: _safeTpvErrorCode(updateError, "TPV_SALE_UPDATE_FAILED"),
                });
            }
        }
    }

    let paymentErrorCode = null;
    if (current.orderId && Array.isArray(current.paymentSelection) && current.paymentSelection.length === 1) {
        const result = await persistSaleCashPayment(current, traceId);
        current = result.record;
        paymentErrorCode = result.errorCode;
    }

    let auditPersisted = true;
    let auditErrorCode = null;
    try {
        await appendSaleAudit(current, traceId);
    } catch (error) {
        auditPersisted = false;
        auditErrorCode = _safeTpvErrorCode(error, "TPV_SALE_AUDIT_WRITE_FAILED");
        try {
            current = await updateItem(BUSINESS_COLLECTIONS.TRANSACCIONES_TPV, {
                ...current,
                requiresReconciliation: true,
                draftOrderReason: auditErrorCode,
            }, { consistency: CONSISTENCY.STRONG });
        } catch (updateError) {
            logger.error("TPV sale audit marker update failed", {
                traceId,
                idempotencyKey: current._id,
                errorCode: _safeTpvErrorCode(updateError, "TPV_SALE_UPDATE_FAILED"),
            });
        }
    }

    if (current.status === "CONFIRMADA" && current.requiresReconciliation !== true &&
        auditPersisted && current.paymentSelection?.[0]?.ledgerMovementId) {
        return saleSuccessEnvelope(current, { replayed, auditPersisted, traceId });
    }
    return salePendingEnvelope(current, {
        replayed,
        auditPersisted,
        auditErrorCode: auditErrorCode || paymentErrorCode,
        traceId,
    });
}


async function appendSaleAudit(record, traceId) {
    return appendTpvAudit({
        idempotencyKey: record._id + ":SALE_AUDIT",
        action: "VENTA_TPV_REGISTRADA",
        actorId: record.operatorId,
        entityType: "TRANSACCION_TPV",
        entityId: record._id,
        traceId,
        payload: {
            sessionId: record.sessionId,
            orderId: record.orderId || null,
            subtotalNeto: record.subtotalNeto,
            impuestosTotal: record.impuestosTotal,
            totalVenta: record.totalVenta,
            medioPago: record.medioPago || null,
            lineCount: Array.isArray(record.lineas) ? record.lineas.length : 0,
            currency: record.currency,
            status: record.status,
            sourceType: record.sourceType,
            recordTimestamp: record.recordTimestamp,
            requiresReconciliation: record.requiresReconciliation === true,
            requestFingerprint: record.requestFingerprint,
        },
    });
}

export const registrarVenta = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-sale-register");
        let operator;
        try {
            operator = await getMyCajeroContext(traceId);
        } catch (error) {
            return tpvError(
                _safeTpvErrorCode(error, "TPV_CASHIER_NOT_AUTHORIZED"),
                "El usuario actual no está autorizado como operador TPV.",
                ["Accede con un miembro vinculado a un operador TPV autorizado."],
                { persisted: false, retryable: false, traceId }
            );
        }

        const sessionId = String(input?.sessionId || "").trim();
        const idempotencyKey = String(input?.idempotencyKey || "").trim().toLowerCase();
        const rawLineas = Array.isArray(input?.lineas) ? input.lineas : [];
        const lineas = rawLineas.map((line) => ({
            ...line,
            tipoLinea: String(line?.tipoLinea || (line?.productId ? "PRODUCTO" : "")).trim().toUpperCase(),
            itemId: String(line?.itemId || line?.productId || "").trim(),
            ...(line?.varianteId || line?.variantId ? { varianteId: String(line.varianteId || line.variantId).trim() } : {}),
        }));
        const rawPagos = Array.isArray(input?.pagos) ? input.pagos : null;
        if (!input || typeof input !== "object" || Array.isArray(input) ||
            !sessionId || !UUID_V4.test(idempotencyKey) ||
            lineas.length === 0 || lineas.length > 100 || (rawPagos && rawPagos.length > 100) ||
            lineas.some((line) =>
                !line || typeof line !== "object" ||
                !["PRODUCTO", "SERVICIO"].includes(String(line.tipoLinea || "").trim().toUpperCase()) ||
                !GUID.test(String(line.itemId || "").trim()) ||
                !Number.isSafeInteger(Number(line.cantidad)) ||
                Number(line.cantidad) <= 0
            )) {
            return tpvError(
                "TPV_INVALID_INPUT",
                "La solicitud de venta no contiene una sesión, clave idempotente o líneas de catálogo válidas.",
                ["Envía sessionId, una clave UUID v4 y líneas de producto o servicio con identificadores Wix y cantidades enteras positivas."],
                { persisted: false, retryable: false, traceId }
            );
        }

        let prepared;
        let validated;
        try {
            prepared = await prepareTpvSaleCatalog(lineas);
            const pagos = (rawPagos && rawPagos.length > 0) ? rawPagos : (input?.medioPago
                ? [{ medioPago: String(input.medioPago).trim().toUpperCase(), importe: prepared.totalVenta, importeCambio: 0 }]
                : []);
            assertTpvPaymentMethodsSupported(pagos);
            validated = validateSaleDraft({
                lineas: prepared.lineas,
                pagos,
                subtotalNeto: prepared.subtotalNeto,
                impuestosTotal: prepared.impuestosTotal,
                totalVenta: prepared.totalVenta,
            });
        } catch (error) {
            return preparationFailure(error, traceId);
        }

        const activeSession = await latestOpenTpvSession();
        if (!activeSession || activeSession.sessionId !== sessionId) {
            return tpvError(
                "TPV_SESSION_NOT_OPEN",
                "La sesión de caja indicada no está abierta.",
                ["Abre o selecciona la sesión de caja activa antes de registrar la venta."],
                { persisted: false, retryable: false, traceId }
            );
        }

        const lineasBackend = validated.lineas.map((line, index) => ({
            ...line,
            appId: prepared.lineas[index].appId,
            taxGroupId: prepared.lineas[index].taxGroupId || null,
            desgloseImpuestos: prepared.lineas[index].desgloseImpuestos,
            currency: prepared.lineas[index].currency,
        }));
        const subtotalNetoMinor = toMinorUnits(validated.subtotalNeto, "SALE_SUBTOTAL");
        const impuestosTotalMinor = toMinorUnits(validated.impuestosTotal, "SALE_TAX");
        const totalVentaMinor = toMinorUnits(validated.totalVenta, "SALE_TOTAL");
        const medioPago = validated.pagos.length === 1
            ? validated.pagos[0].medioPago
            : validated.pagos.length > 1 ? "MULTIPLE" : null;
        const requestFingerprint = createHash("sha256").update(JSON.stringify({
            sessionId,
            lineas: lineasBackend,
            pagos: validated.pagos,
            operatorResourceId: operator.operatorResourceId,
        })).digest("hex");

        const readExisting = async () => getItem(
            BUSINESS_COLLECTIONS.TRANSACCIONES_TPV,
            idempotencyKey,
            CONSISTENCY.STRONG
        );
        const existing = await readExisting();
        if (existing) {
            if (existing.requestFingerprint !== requestFingerprint) {
                return tpvError("TPV_IDEMPOTENCY_CONFLICT", "La clave idempotente ya pertenece a otra venta.", ["No reutilices la clave con líneas, sesión u operador diferentes."], { persisted: true, retryable: false, traceId });
            }
            let auditPersisted = true;
            let auditErrorCode = null;
            try { await appendSaleAudit(existing, traceId); } catch (error) {
                auditPersisted = false;
                auditErrorCode = _safeTpvErrorCode(error, "TPV_AUDIT_APPEND_FAILED");
                logger.error("TPV_SALE_AUDIT_APPEND_FAILED", { traceId, transactionId: existing._id, errorCode: auditErrorCode });
            }
            return salePendingEnvelope(existing, { replayed: true, auditPersisted, auditErrorCode, traceId });
        }

        const saleReadiness = buildSaleReadiness(prepared, validated);
        if (saleReadiness.saleReadinessBlockers.length > 0) {
            return tpvError(
                "TPV_SALE_NOT_READY",
                "La venta no supera los mismos requisitos de preparación que muestra el TPV. No se ha creado ninguna intención comercial.",
                saleReadiness.saleReadinessBlockers,
                { persisted: false, retryable: false, traceId, saleReady: false }
            );
        }

        try {
            return await withTpvSessionLock(sessionId, traceId, async () => {
                const winner = await readExisting();
                if (winner) {
                    if (winner.requestFingerprint !== requestFingerprint) {
                        throw new Error("TPV_IDEMPOTENCY_CONFLICT");
                    }
                    let auditPersisted = true;
                    let auditErrorCode = null;
                    try { await appendSaleAudit(winner, traceId); } catch (error) {
                        auditPersisted = false;
                        auditErrorCode = String(error?.code || error?.message || "TPV_AUDIT_APPEND_FAILED");
                        logger.error("TPV_SALE_AUDIT_APPEND_FAILED", { traceId, transactionId: winner._id, errorCode: auditErrorCode });
                    }
                    return salePendingEnvelope(winner, { replayed: true, auditPersisted, auditErrorCode, traceId });
                }

                const currentSession = await latestOpenTpvSession();
                if (!currentSession || currentSession.sessionId !== sessionId) {
                    throw new Error("TPV_SESSION_NOT_OPEN");
                }

                if (saleReadiness.saleReadinessBlockers.length > 0) {
                    throw new Error("TPV_SALE_NOT_READY");
                }
                const recordMetadata = await createTpvRecordMetadata();
                const draft = await createSaleDraftOrder(prepared);
                const record = {
                    ...recordMetadata,
                    _id: idempotencyKey,
                    sessionId,
                    orderId: draft.orderId,
                    lineas: lineasBackend,
                    subtotalNeto: validated.subtotalNeto,
                    subtotalNetoMinor,
                    impuestosTotal: validated.impuestosTotal,
                    impuestosTotalMinor,
                    totalVenta: validated.totalVenta,
                    totalVentaMinor,
                    medioPago,
                    paymentSelection: validated.pagos.map((payment) => ({
                        medioPago: payment.medioPago,
                        importe: payment.importe,
                        importeCambio: payment.importeCambio,
                        importeAplicado: payment.importeAplicado,
                        confirmed: false,
                    })),
                    operatorResourceId: operator.operatorResourceId,
                    operatorId: operator.operatorId,
                    createdAt: new Date(recordMetadata.recordTimestamp),
                    status: "PENDING_PAYMENT",
                    sourceType: TPV_RUNTIME_POLICY.SOURCE_TYPE,
                    requiresReconciliation: draft.requiresReconciliation,
                    draftOrderReason: draft.reason,
                    requestFingerprint,
                    currency: SDK_CONFIG.CURRENCY_CODE,
                    traceId,
                };
                let saved;
                try {
                    saved = await insertItem(BUSINESS_COLLECTIONS.TRANSACCIONES_TPV, record);
                } catch (error) {
                    const concurrentWinner = await readExisting();
                    if (!concurrentWinner) {
                        if (draft.orderId) {
                            try {
                                await appendTpvAudit({
                                    idempotencyKey: idempotencyKey + ":DRAFT_ORPHAN",
                                    action: "DRAFT_ORDER_WITHOUT_TPV_TRANSACTION",
                                    actorId: operator.operatorResourceId,
                                    entityType: "DRAFT_ORDER",
                                    entityId: draft.orderId,
                                    traceId,
                                    payload: { sessionId, idempotencyKey, errorCode: _safeTpvErrorCode(error, "INSERT_FAILED") },
                                });
                            } catch (auditError) {
                                logger.error("TPV_DRAFT_ORPHAN_AUDIT_FAILED", {
                                    traceId,
                                    transactionId: idempotencyKey,
                                    errorCode: _safeTpvErrorCode(auditError, "TPV_DRAFT_ORPHAN_AUDIT_FAILED"),
                                });
                            }
                        }
                        throw error;
                    }
                    if (concurrentWinner.requestFingerprint !== requestFingerprint) {
                        throw new Error("TPV_IDEMPOTENCY_CONFLICT");
                    }
                    let auditPersisted = true;
                    try { await appendSaleAudit(concurrentWinner, traceId); } catch { auditPersisted = false; }
                    return salePendingEnvelope(concurrentWinner, { replayed: true, auditPersisted, traceId });
                }

                let auditPersisted = true;
                let auditErrorCode = null;
                try { await appendSaleAudit(saved, traceId); } catch (error) {
                    auditPersisted = false;
                    auditErrorCode = String(error?.code || error?.message || "TPV_AUDIT_APPEND_FAILED");
                    logger.error("TPV_SALE_AUDIT_APPEND_FAILED", { traceId, transactionId: saved._id, errorCode: auditErrorCode });
                }
                return salePendingEnvelope(saved, { replayed: false, auditPersisted, auditErrorCode, traceId });
            });
        } catch (error) {
            return tpvError(
                _safeTpvErrorCode(error, "TPV_SALE_PERSISTENCE_FAILED"),
                "No se ha podido completar el registro comercial de la venta.",
                ["Conserva la clave idempotente y el traceId; consulta TransaccionesTPV antes de repetir la operación."],
                { persisted: false, retryable: false, traceId }
            );
        }
    }
);