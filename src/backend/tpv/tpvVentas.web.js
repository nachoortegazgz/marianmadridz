import { Permissions, webMethod } from "wix-web-module";
import { draftOrders } from "@wix/ecom";
import { auth } from "@wix/essentials";
import { getMyCajeroContext } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { validateSaleDraft } from "backend/tpv/tpvValidation";
import { error as tpvError, ok as tpvOk, pending as tpvPending } from "backend/tpv/tpvEnvelope";
import { prepareTpvSaleCatalog } from "backend/tpv/tpvSalePreparation";
import { assertTpvPaymentMethodsSupported } from "backend/tpv/tpvSalePreparationCore";
import { BUSINESS_COLLECTIONS, TPV_RUNTIME_POLICY } from "backend/internalConfig";
import { CONSISTENCY, getItem, insertItem } from "backend/dataAccess";
import { appendTpvAudit, latestOpenTpvSession, withTpvSessionLock } from "backend/tpv/tpvRepository";
import { toMinorUnits } from "backend/tpv/tpvUtils";
import { createHash } from "node:crypto";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const createDraftOrderElevated = auth.elevate(draftOrders.createDraftOrder);

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
    const code = String(error?.code || error?.message || "TPV_SALE_PREPARATION_FAILED");
    const message = PREPARATION_MESSAGES[code] ||
        "No se ha podido preparar la venta con los datos actuales del catálogo y la configuración fiscal de Wix.";
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

/**
 * Validates a sale using current Wix Catalog V3 / Bookings prices and Wix tax
 * calculation. Client-supplied prices, taxes and totals are deliberately ignored.
 */
export const validarVentaBorrador = webMethod(
    Permissions.SiteMember,
    async (venta = {}) => {
        const traceId = makeTraceId("tpv-sale-prepare");
        await requireCajero(traceId);
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

            const containsProducts = prepared.lineas.some((line) => line.tipoLinea === "PRODUCTO");
            const writeV1Blockers = getTpvWriteV1Blockers({
                lineas: prepared.lineas,
                pagos: validated.pagos,
                totalVenta: validated.totalVenta,
            });
            const saleReadinessBlockers = [
                "FISCAL_CONFIG_UNVERIFIED",
                "TPV_LEDGER_WRITER_NOT_CONFIGURED",
                "PAYMENT_NOT_VERIFIED",
                "CONSUMER_PRICE_PRESENTATION_UNVERIFIED",
            ];
            saleReadinessBlockers.push(...writeV1Blockers);
            if (containsProducts) {
                saleReadinessBlockers.push("INVENTORY_POLICY_NOT_CONFIGURED");
            }
            if (FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED !== true) {
                saleReadinessBlockers.push("FISCAL_WRITER_DISABLED");
            }
            if (prepared.taxIncludedInPrice !== true) {
                saleReadinessBlockers.push("WIX_TAX_REGION_EXCLUDES_TAX");
            }

            return tpvOk({
                ...validated,
                lineas,
                catalogVerified: true,
                taxVerified: true,
                paymentVerified: false,
                inventoryVerified: !containsProducts,
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

async function createSaleDraftOrder(prepared) {
    const productLines = prepared.lineas.filter((line) => line.tipoLinea === "PRODUCTO");
    if (productLines.length !== prepared.lineas.length || productLines.length === 0) {
        return { orderId: null, requiresReconciliation: true, reason: "DRAFT_ORDER_CATALOG_PRODUCTS_ONLY" };
    }
    try {
        const response = await createDraftOrderElevated({
            draftOrder: {
                catalogLineItems: productLines.map((line) => ({
                    catalogReference: {
                        catalogItemId: line.itemId,
                        appId: line.appId,
                        ...(line.varianteId ? { options: { variantId: line.varianteId } } : {}),
                    },
                    quantity: line.cantidad,
                })),
            },
        });
        const draft = response?.calculatedDraftOrder?.draftOrder;
        const orderId = String(draft?._id || draft?.id || "").trim();
        return orderId
            ? { orderId, requiresReconciliation: false, reason: "DRAFT_ORDER_CREATED" }
            : { orderId: null, requiresReconciliation: true, reason: "DRAFT_ORDER_ID_MISSING" };
    } catch (error) {
        return {
            orderId: null,
            requiresReconciliation: true,
            reason: String(error?.code || error?.message || "DRAFT_ORDER_UNAVAILABLE").slice(0, 120),
        };
    }
}

function salePendingEnvelope(record, { replayed, auditPersisted = true, traceId }) {
    return tpvPending("TPV_PAYMENT_PROVIDER_NOT_CONFIGURED", {
        orderId: record.orderId || null,
        idempotencyKey: record._id,
        totalVenta: record.totalVenta,
        medioPago: record.medioPago || null,
        requiresReconciliation: record.requiresReconciliation === true || !auditPersisted,
        persisted: true,
        replayed,
        retryable: false,
        solution: "Contract A",
        sourceType: record.sourceType,
        auditPersisted,
        resolutionAttempts: [
            { step: "operator-authorization", status: "VERIFIED" },
            { step: "catalog-and-tax-recalculation", status: "VERIFIED" },
            { step: "draft-order", status: record.orderId ? "CREATED" : "UNAVAILABLE", reason: record.orderId ? null : record.draftOrderReason },
            { step: "commercial-transaction", status: "PERSISTED" },
            { step: "payment-provider", status: "BLOCKED", reason: "Contract A" },
            { step: "operational-audit", status: auditPersisted ? "PERSISTED" : "PENDING" },
        ],
        traceId,
    });
}

async function appendSaleAudit(record, traceId) {
    return appendTpvAudit({
        idempotencyKey: record._id + ":SALE_AUDIT",
        action: "VENTA_TPV_REGISTRADA",
        actorId: record.operatorResourceId,
        entityType: "TRANSACCION_TPV",
        entityId: record._id,
        traceId,
        payload: {
            sessionId: record.sessionId,
            orderId: record.orderId || null,
            totalVenta: record.totalVenta,
            status: record.status,
            sourceType: record.sourceType,
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
                String(error?.code || "TPV_CASHIER_NOT_AUTHORIZED"),
                "El usuario actual no está autorizado como operador TPV.",
                ["Accede con un miembro vinculado a un operador TPV autorizado."],
                { persisted: false, retryable: false, traceId }
            );
        }

        const sessionId = String(input?.sessionId || "").trim();
        const idempotencyKey = String(input?.idempotencyKey || "").trim().toLowerCase();
        const lineas = Array.isArray(input?.lineas) ? input.lineas : [];
        const pagos = Array.isArray(input?.pagos) ? input.pagos : [];
        if (!input || typeof input !== "object" || Array.isArray(input) ||
            !sessionId || !UUID_V4.test(idempotencyKey) ||
            lineas.length === 0 || lineas.length > 100 || pagos.length > 100 ||
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
            assertTpvPaymentMethodsSupported(pagos);
            prepared = await prepareTpvSaleCatalog(lineas);
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
            try { await appendSaleAudit(existing, traceId); } catch { auditPersisted = false; }
            return salePendingEnvelope(existing, { replayed: true, auditPersisted, traceId });
        }

        try {
            return await withTpvSessionLock(sessionId, traceId, async () => {
                const winner = await readExisting();
                if (winner) {
                    if (winner.requestFingerprint !== requestFingerprint) {
                        throw new Error("TPV_IDEMPOTENCY_CONFLICT");
                    }
                    let auditPersisted = true;
                    try { await appendSaleAudit(winner, traceId); } catch { auditPersisted = false; }
                    return salePendingEnvelope(winner, { replayed: true, auditPersisted, traceId });
                }

                const currentSession = await latestOpenTpvSession();
                if (!currentSession || currentSession.sessionId !== sessionId) {
                    throw new Error("TPV_SESSION_NOT_OPEN");
                }

                const draft = await createSaleDraftOrder(prepared);
                const record = {
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
                    createdAt: new Date(),
                    status: "PENDING_PAYMENT",
                    sourceType: "SYNTHETIC",
                    requiresReconciliation: draft.requiresReconciliation,
                    draftOrderReason: draft.reason,
                    requestFingerprint,
                    currency: TPV_RUNTIME_POLICY.CURRENCY,
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
                                    payload: { sessionId, idempotencyKey, errorCode: String(error?.code || error?.message || "INSERT_FAILED") },
                                });
                            } catch { /* orphan remains explicitly traceable by the failed insert response */ }
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
                try { await appendSaleAudit(saved, traceId); } catch { auditPersisted = false; }
                return salePendingEnvelope(saved, { replayed: false, auditPersisted, traceId });
            });
        } catch (error) {
            return tpvError(
                String(error?.code || error?.message || "TPV_SALE_PERSISTENCE_FAILED"),
                "No se ha podido completar el registro comercial de la venta.",
                ["Conserva la clave idempotente y el traceId; consulta TransaccionesTPV antes de repetir la operación."],
                { persisted: false, retryable: false, traceId }
            );
        }
    }
);