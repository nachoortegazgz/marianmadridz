import { createHash } from "node:crypto";
import {
    OPERATIONAL_COLLECTIONS,
    CONTROL_TYPE,
    TPV_RUNTIME_POLICY,
    TPV_STORES_APP_ID,
} from "../internalConfig.js";
import {
    fromMinorUnits,
    makeRequestFingerprint,
    normalizePaymentMethod,
    toMinorUnits,
} from "./tpvUtils.js";
import { error as tpvError, pending as tpvPending } from "./tpvEnvelope.js";

const CONTROL_COLLECTION = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CATALOG_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_LINES = 100;
const MAX_RECOVERY_PAGES = 10;
const RECOVERY_PAGE_SIZE = 100;
const RESOLUTION_STEPS = Object.freeze([
    "idempotency_check",
    "catalog_prices",
    "tax_calculation",
    "ecom_draft_order",
    "persistence",
]);

function sha256(value) {
    return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function markerId(idempotencyKey) {
    return "TPVSALE_" + sha256(
        TPV_RUNTIME_POLICY.SITE_ID + ":TPV_SALE_DRAFT:" + idempotencyKey
    );
}

function lineItemId(idempotencyKey, index) {
    return "TPVSALE_" + sha256(
        TPV_RUNTIME_POLICY.SITE_ID + ":" + idempotencyKey + ":LINE:" + index
    );
}

function safeText(value, max = 160) {
    return String(value ?? "").trim().slice(0, max);
}

function fingerprintInput(input, sessionId) {
    const rawLines = Array.isArray(input?.lineas) ? input.lineas.slice(0, MAX_LINES) : [];
    return makeRequestFingerprint({
        sessionId,
        lineas: rawLines.map((line) => ({
            productId: safeText(line?.productId),
            variantId: safeText(line?.variantId),
            cantidad: line?.cantidad ?? null,
        })),
        medioPago: safeText(input?.medioPago, 40).toUpperCase() || null,
    });
}

function formatMinorUnits(value) {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error("TPV_MINOR_UNITS_INVALID");
    }
    return String(Math.floor(value / 100)) + "." + String(value % 100).padStart(2, "0");
}

function moneyMinor(value, field, fallback = null) {
    if (value == null && fallback !== null) return fallback;
    const raw = value && typeof value === "object" ? value.amount : value;
    return toMinorUnits(raw, field);
}

function normalizeDraftOrder(response) {
    return response?.calculatedDraftOrder?.draftOrder ||
        response?.draftOrder ||
        response?.calculatedDraftOrder ||
        response ||
        null;
}

function extractDraftId(draftOrder) {
    return safeText(draftOrder?.id || draftOrder?._id, 100);
}

function extractDraftLineItems(draftOrder) {
    return (Array.isArray(draftOrder?.lineItems) ? draftOrder.lineItems : [])
        .map((entry) => entry?.lineItem || entry)
        .filter((line) => line && typeof line === "object");
}

function extractLineItemId(line) {
    return safeText(line?._id || line?.id, 120);
}

function makeActionable(code, userMessage, remediation, traceId, extra = {}) {
    return tpvError(code, userMessage, remediation, {
        traceId,
        retryable: extra.retryable === true,
        requiresReconciliation: extra.requiresReconciliation === true,
        resolutionAttempts: extra.resolutionAttempts || ["idempotency_check"],
        ...extra,
    });
}

function makePending(reason, context, extra = {}) {
    return tpvPending(reason, {
        orderId: extra.orderId || null,
        draftOrderId: extra.draftOrderId || extra.orderId || null,
        idempotencyKey: context.idempotencyKey,
        subtotalNeto: extra.subtotalNeto ?? null,
        impuestosTotal: extra.impuestosTotal ?? null,
        totalVenta: extra.totalVenta ?? null,
        subtotalNetoMinor: extra.subtotalNetoMinor ?? null,
        impuestosTotalMinor: extra.impuestosTotalMinor ?? null,
        totalVentaMinor: extra.totalVentaMinor ?? null,
        solution: extra.solution || "Resolver Contract A para habilitar el cobro; el borrador no está pagado.",
        retryable: extra.retryable === true,
        requiresReconciliation: extra.requiresReconciliation === true,
        replayed: extra.replayed === true,
        autoResolved: extra.autoResolved === true,
        persisted: extra.persisted === true,
        traceId: context.traceId,
        resolutionAttempts: extra.resolutionAttempts || RESOLUTION_STEPS,
    });
}

function validateInput(input, sessionId) {
    if (!sessionId) return { code: "TPV_SESSION_REQUIRED", message: "La sesión TPV es obligatoria." };
    const idempotencyKey = safeText(input?.idempotencyKey, 100);
    if (!UUID_V4_RE.test(idempotencyKey)) {
        return { code: "TPV_IDEMPOTENCY_KEY_INVALID", message: "La clave idempotente debe ser un UUID v4 válido." };
    }
    if (!Array.isArray(input?.lineas) || input.lineas.length === 0 || input.lineas.length > MAX_LINES) {
        return { code: "TPV_LINES_INVALID", message: "La venta debe contener entre 1 y 100 líneas de producto." };
    }

    const lineas = [];
    for (let index = 0; index < input.lineas.length; index += 1) {
        const line = input.lineas[index];
        const productId = safeText(line?.productId, 80);
        const variantId = safeText(line?.variantId, 80);
        const cantidad = Number(line?.cantidad);
        if (!line || typeof line !== "object" || Array.isArray(line) ||
            !CATALOG_ID_RE.test(productId) ||
            (variantId && !CATALOG_ID_RE.test(variantId)) ||
            !Number.isSafeInteger(cantidad) || cantidad <= 0 || cantidad > 100000) {
            return {
                code: "TPV_SALE_LINE_INVALID",
                message: "Una o más líneas de producto no tienen identificador, variante o cantidad válidos.",
                invalidLineIndexes: [index],
            };
        }
        lineas.push({ productId, ...(variantId ? { variantId } : {}), cantidad });
    }

    let medioPago = null;
    if (safeText(input?.medioPago, 40)) {
        try {
            medioPago = normalizePaymentMethod(input.medioPago);
        } catch {
            return { code: "TPV_PAYMENT_METHOD_UNSUPPORTED", message: "El medio de pago solicitado no está habilitado en TPV." };
        }
    }
    return { value: { sessionId, idempotencyKey, lineas, medioPago } };
}

function makeInitialMarker(context, fingerprint, lineItemIds, createdAt) {
    return {
        _id: markerId(context.idempotencyKey),
        controlType: CONTROL_TYPE.IDEMPOTENCY,
        dedupeKey: "TPV_SALE_DRAFT:" + context.idempotencyKey,
        traceId: context.traceId,
        eventId: null,
        kind: "TPV_SALE_DRAFT",
        status: "CREATING",
        version: 1,
        attempts: 1,
        totalAmount: 0,
        payload: {
            schemaVersion: 1,
            recordType: "TPV_SALE_DRAFT",
            sourceType: TPV_RUNTIME_POLICY.SOURCE_TYPE,
            siteId: TPV_RUNTIME_POLICY.SITE_ID,
            currency: TPV_RUNTIME_POLICY.CURRENCY,
            sessionId: context.sessionId,
            idempotencyKey: context.idempotencyKey,
            requestFingerprint: fingerprint,
            operatorResourceId: context.operatorResourceId,
            requestedPaymentMethod: context.medioPago,
            lineItemIds,
            lineas: context.lineas,
            status: "CREATING",
            createdAt,
            updatedAt: createdAt,
        },
    };
}

async function updateMarker(deps, marker, status, payloadPatch = {}, totalMinor = null, eventId = null) {
    const now = (deps.now ? deps.now() : new Date()).toISOString();
    const updated = {
        ...marker,
        status,
        version: Math.max(1, Number(marker.version) || 1) + 1,
        attempts: Math.max(1, Number(marker.attempts) || 1),
        ...(totalMinor == null ? {} : { totalAmount: fromMinorUnits(totalMinor) }),
        ...(eventId ? { eventId } : {}),
        payload: {
            ...(marker.payload || {}),
            ...payloadPatch,
            status,
            updatedAt: now,
        },
    };
    await deps.updateItem(CONTROL_COLLECTION, updated);
    return updated;
}

function isDefinitiveDraftRejection(error) {
    const status = Number(error?.status || error?.statusCode || error?.httpStatus || error?.response?.status);
    return [400, 401, 403, 404, 422].includes(status);
}

function extractTaxRegion(response) {
    const regions = response?.taxRegions || response?.regions || [];
    const candidates = regions.filter((region) =>
        String(region?.country || "").toUpperCase() === "ES" &&
        (!region?.subdivision || region.subdivision === "*")
    );
    return candidates.length === 1 ? candidates[0] : null;
}

function extractDefaultTaxGroup(response) {
    const results = response?.results || response?.defaultTaxGroups || [];
    const found = results.find((entry) =>
        entry?.taxGroupMetadata?.success === true &&
        (entry?.taxGroup?._id || entry?.taxGroup?.id)
    );
    return safeText(found?.taxGroup?._id || found?.taxGroup?.id, 100);
}

function extractCustomTaxGroups(response) {
    return (response?.taxGroups || response?.groups || [])
        .map((group) => safeText(group?._id || group?.id, 100))
        .filter(Boolean);
}

function extractVariants(product) {
    return Array.isArray(product?.variantsInfo?.variants)
        ? product.variantsInfo.variants
        : [];
}

function resolveVariant(product, requestedVariantId) {
    const variants = extractVariants(product).filter((variant) => variant?.visible !== false);
    if (!variants.length) return null;
    if (requestedVariantId) {
        return variants.find((variant) =>
            safeText(variant?._id || variant?.id, 100) === requestedVariantId
        ) || null;
    }
    return variants[0] || null;
}

function resolveDraftTotals(draftOrder) {
    const summary = draftOrder?.priceSummary || {};
    const subtotalGrossMinor = moneyMinor(summary.subtotal, "DRAFT_SUBTOTAL");
    const discountMinor = moneyMinor(summary.discount, "DRAFT_DISCOUNT", 0);
    const taxMinor = moneyMinor(summary.tax, "DRAFT_TAX");
    const totalMinor = moneyMinor(summary.total, "DRAFT_TOTAL");
    const shippingMinor = moneyMinor(summary.shipping, "DRAFT_SHIPPING", 0);
    const feesMinor = moneyMinor(summary.totalAdditionalFees, "DRAFT_FEES", 0);
    const subtotalNetMinor = subtotalGrossMinor - discountMinor;
    if (subtotalNetMinor < 0 || shippingMinor !== 0 || feesMinor !== 0) {
        throw new Error("TPV_DRAFT_TOTALS_UNSUPPORTED");
    }
    if (draftOrder?.taxInfo?.taxExempt === true || draftOrder?.taxExempt === true) {
        throw new Error("TPV_DRAFT_TAX_EXEMPT");
    }
    const taxInfoTotal = draftOrder?.taxInfo?.totalTax;
    if (taxInfoTotal != null && moneyMinor(taxInfoTotal, "DRAFT_TAX_INFO") !== taxMinor) {
        throw new Error("TPV_DRAFT_TAX_SUMMARY_MISMATCH");
    }
    if (String(draftOrder?.currency || TPV_RUNTIME_POLICY.CURRENCY).toUpperCase() !== TPV_RUNTIME_POLICY.CURRENCY) {
        throw new Error("TPV_DRAFT_CURRENCY_MISMATCH");
    }
    return { subtotalNetMinor, taxMinor, totalMinor };
}

function assertDraftMatches(draftOrder, expected, resolvedLines, lineItemIds) {
    const draftId = extractDraftId(draftOrder);
    if (!draftId) throw new Error("TPV_DRAFT_ID_MISSING");
    if (String(draftOrder?.status || "").toUpperCase() !== "DRAFT") {
        throw new Error("TPV_DRAFT_STATUS_NOT_PENDING");
    }
    const actual = resolveDraftTotals(draftOrder);
    if (actual.subtotalNetMinor !== expected.subtotalNetoMinor ||
        actual.taxMinor !== expected.impuestosTotalMinor ||
        actual.totalMinor !== expected.totalVentaMinor ||
        actual.subtotalNetMinor + actual.taxMinor !== actual.totalMinor) {
        throw new Error("TPV_DRAFT_TOTALS_MISMATCH");
    }

    const lines = extractDraftLineItems(draftOrder);
    const byId = new Map(lines.map((line) => [extractLineItemId(line), line]));
    for (let index = 0; index < resolvedLines.length; index += 1) {
        const expectedLine = resolvedLines[index];
        const actualLine = byId.get(lineItemIds[index]);
        if (!actualLine) throw new Error("TPV_DRAFT_LINE_CORRELATION_MISMATCH");
        const catalogReference = actualLine.catalogReference || {};
        const actualProductId = safeText(catalogReference.catalogItemId, 100);
        const actualVariantId = safeText(catalogReference.options?.variantId, 100);
        if (actualProductId !== expectedLine.productId ||
            actualVariantId !== expectedLine.variantId ||
            Number(actualLine.quantity) !== expectedLine.cantidad) {
            throw new Error("TPV_DRAFT_LINE_CONTRACT_MISMATCH");
        }
    }
    return { draftOrderId: draftId, ...actual };
}

function findCorrelatedDraft(draftOrders, expectedLineItemIds) {
    const expected = new Set(expectedLineItemIds);
    const matches = [];
    let partial = false;
    for (const draft of draftOrders) {
        const actualIds = new Set(extractDraftLineItems(draft).map(extractDraftLineItemId));
        const count = expectedLineItemIds.filter((id) => actualIds.has(id)).length;
        if (count === expectedLineItemIds.length) matches.push(draft);
        else if (count > 0) partial = true;
    }
    return { matches, partial };
}

async function recoverDraftOrder(deps, marker) {
    const expectedIds = marker?.payload?.lineItemIds || [];
    const createdAt = marker?.payload?.createdAt;
    if (!expectedIds.length || !createdAt) return { draftOrder: null, partial: false, duplicate: false, truncated: false };

    let cursor = null;
    let partial = false;
    for (let page = 0; page < MAX_RECOVERY_PAGES; page += 1) {
        const query = {
            filter: { _createdDate: { $gte: createdAt } },
            sort: [{ fieldName: "_createdDate", order: "DESC" }],
            cursorPaging: { limit: RECOVERY_PAGE_SIZE, ...(cursor ? { cursor } : {}) },
        };
        const response = await deps.queryDraftOrders(query);
        const drafts = Array.isArray(response?.draftOrders) ? response.draftOrders : [];
        const found = findCorrelatedDraft(drafts, expectedIds);
        if (found.matches.length > 1) return { draftOrder: null, partial: found.partial, duplicate: true, truncated: false };
        if (found.matches.length === 1) return { draftOrder: found.matches[0], partial: false, duplicate: false, truncated: false };
        if (found.partial) partial = true;
        cursor = safeText(response?.pagingMetadata?.cursors?.next, 2000) || null;
        if (!cursor) return { draftOrder: null, partial, duplicate: false, truncated: false };
    }
    return { draftOrder: null, partial: false, duplicate: false, truncated: Boolean(cursor) };
}

function buildPendingFromMarker(context, marker, { replayed = true, autoResolved = false } = {}) {
    const payload = marker?.payload || {};
    const subtotalNetoMinor = Number(payload.subtotalNetoMinor);
    const impuestosTotalMinor = Number(payload.impuestosTotalMinor);
    const totalVentaMinor = Number(payload.totalVentaMinor);
    const hasTotals = [subtotalNetoMinor, impuestosTotalMinor, totalVentaMinor].every(Number.isSafeInteger);
    return makePending("TPV_PAYMENT_PROVIDER_NOT_CONFIGURED", context, {
        orderId: payload.draftOrderId || marker?.eventId || null,
        draftOrderId: payload.draftOrderId || marker?.eventId || null,
        ...(hasTotals ? {
            subtotalNetoMinor,
            impuestosTotalMinor,
            totalVentaMinor,
            subtotalNeto: fromMinorUnits(subtotalNetoMinor),
            impuestosTotal: fromMinorUnits(impuestosTotalMinor),
            totalVenta: fromMinorUnits(totalVentaMinor),
        } : {}),
        replayed,
        autoResolved,
        persisted: Boolean(payload.draftOrderId),
        requiresReconciliation: false,
        retryable: false,
        resolutionAttempts: RESOLUTION_STEPS,
    });
}

async function finalizeDraft(deps, marker, draftOrder, expected, resolvedLines, context, { replayed = false, autoResolved = false } = {}) {
    const lineItemIds = marker.payload.lineItemIds;
    let checked;
    try {
        checked = assertDraftMatches(draftOrder, expected, resolvedLines, lineItemIds);
    } catch (validationError) {
        const draftOrderId = extractDraftId(draftOrder);
        if (draftOrderId) {
            try {
                marker = await updateMarker(deps, marker, "PENDING_RECONCILIATION", {
                    draftOrderId,
                    errorCode: validationError.message || "TPV_DRAFT_INVALID",
                    reconciliationRequired: true,
                    draftDeleted: false,
                });
            } catch {
                // The existing CREATING marker remains a no-retry guard.
            }
            try {
                await deps.deleteDraftOrder(draftOrderId);
            } catch (deleteError) {
                try {
                    await updateMarker(deps, marker, "PENDING_RECONCILIATION", {
                        draftOrderId,
                        draftDeleted: false,
                        reconciliationRequired: true,
                        cleanupErrorCode: safeText(deleteError?.code || deleteError?.message, 120),
                    });
                } catch {
                    // Keep the no-retry marker; do not create a replacement draft.
                }
                return makePending("TPV_DRAFT_RECONCILIATION_REQUIRED", context, {
                    orderId: draftOrderId,
                    draftOrderId,
                    requiresReconciliation: true,
                    retryable: false,
                    persisted: true,
                    resolutionAttempts: RESOLUTION_STEPS,
                    solution: "El borrador no coincide con el cálculo fiscal y Wix no permitió eliminarlo; no se cobrará ni se repetirá su creación.",
                });
            }
            try {
                await updateMarker(deps, marker, "FAILED_FINAL", {
                    draftOrderId: null,
                    draftDeleted: true,
                    reconciliationRequired: false,
                    errorCode: validationError.message || "TPV_DRAFT_INVALID",
                });
            } catch {
                return makePending("TPV_DRAFT_RECONCILIATION_REQUIRED", context, {
                    orderId: draftOrderId,
                    draftOrderId,
                    requiresReconciliation: true,
                    retryable: false,
                    persisted: true,
                    solution: "El borrador se eliminó, pero no se pudo cerrar el estado idempotente; repetir la consulta con la misma clave.",
                });
            }
            return makeActionable(
                validationError.message || "TPV_DRAFT_INVALID",
                "Wix ha devuelto un borrador con importes o líneas que no coinciden con el cálculo del TPV.",
                ["El borrador inconsistente se ha eliminado.", "No se ha realizado ningún cobro.", "Revisar catálogo e impuestos antes de repetir la venta con una nueva clave idempotente."],
                context.traceId,
                { retryable: false, requiresReconciliation: false, idempotencyPersisted: true }
            );
        }
        return makeActionable(
            validationError.message || "TPV_DRAFT_INVALID",
            "No se ha podido validar el borrador de eCommerce.",
            ["No se ha registrado ningún movimiento de caja.", "Revisar la respuesta de Draft Orders y repetir únicamente con una clave idempotente nueva si no existe borrador."],
            context.traceId,
            { retryable: false, requiresReconciliation: true }
        );
    }

    let updated;
    try {
        updated = await updateMarker(
            deps,
            marker,
            "PENDING_PAYMENT",
            {
                draftOrderId: checked.draftOrderId,
                subtotalNetoMinor: checked.subtotalNetMinor,
                impuestosTotalMinor: checked.taxMinor,
                totalVentaMinor: checked.totalMinor,
                currency: TPV_RUNTIME_POLICY.CURRENCY,
                reconciliationRequired: false,
            },
            checked.totalMinor,
            checked.draftOrderId
        );
    } catch {
        return makePending("TPV_DRAFT_CREATION_UNCERTAIN", context, {
            orderId: checked.draftOrderId,
            draftOrderId: checked.draftOrderId,
            subtotalNetoMinor: checked.subtotalNetMinor,
            impuestosTotalMinor: checked.taxMinor,
            totalVentaMinor: checked.totalMinor,
            subtotalNeto: fromMinorUnits(checked.subtotalNetMinor),
            impuestosTotal: fromMinorUnits(checked.taxMinor),
            totalVenta: fromMinorUnits(checked.totalMinor),
            requiresReconciliation: true,
            retryable: false,
            persisted: true,
            solution: "El borrador existe; el vínculo idempotente se recuperará consultando el mismo Draft Order.",
        });
    }
    return buildPendingFromMarker(context, updated, { replayed, autoResolved });
}

async function recoverExistingMarker(deps, marker, context) {
    const status = String(marker?.status || "").toUpperCase();
    const payload = marker?.payload || {};

    if (status === "PENDING_PAYMENT" && payload.draftOrderId) {
        try {
            const response = await deps.getDraftOrder(payload.draftOrderId);
            const draftOrder = normalizeDraftOrder(response);
            if (String(draftOrder?.status || "").toUpperCase() !== "DRAFT") {
                return makeActionable(
                    "TPV_DRAFT_STATUS_NOT_PENDING",
                    "El borrador ya no está pendiente de pago.",
                    ["No repetir la venta.", "Comprobar el estado del pedido en Wix eCommerce antes de cualquier cobro."],
                    context.traceId,
                    { orderId: payload.draftOrderId, requiresReconciliation: true }
                );
            }
            return buildPendingFromMarker(context, marker, { replayed: true });
        } catch (lookupError) {
            return makeActionable(
                "TPV_DRAFT_LOOKUP_FAILED",
                "No se ha podido verificar el borrador ya registrado.",
                ["No crear un segundo borrador con la misma clave.", "Reintentar la consulta de estado con la misma clave idempotente."],
                context.traceId,
                { orderId: payload.draftOrderId, retryable: true, requiresReconciliation: true }
            );
        }
    }

    if (status === "PENDING_RECONCILIATION" && payload.draftDeleted === true) {
        try {
            const updated = await updateMarker(deps, marker, "FAILED_FINAL", {
                errorCode: safeText(payload.errorCode, 120) || "TPV_DRAFT_INVALID",
                draftDeleted: true,
                reconciliationRequired: false,
            });
            return makeActionable(
                safeText(updated.payload?.errorCode, 120) || "TPV_DRAFT_INVALID",
                "El borrador inconsistente fue eliminado y la venta no se registró.",
                ["Corregir la clasificación fiscal o el catálogo.", "Crear una nueva operación con una clave idempotente nueva."],
                context.traceId,
                { idempotencyPersisted: true }
            );
        } catch {
            return makePending("TPV_DRAFT_RECONCILIATION_REQUIRED", context, {
                requiresReconciliation: true,
                retryable: false,
                persisted: true,
            });
        }
    }

    if (status === "CREATING" || status === "PENDING_RECONCILIATION") {
        let recovered;
        try {
            recovered = await recoverDraftOrder(deps, marker);
        } catch (lookupError) {
            return makePending("TPV_DRAFT_CREATION_UNCERTAIN", context, {
                requiresReconciliation: true,
                retryable: false,
                persisted: true,
                solution: "La creación pudo completarse en Wix; repetir la consulta con la misma clave. No se lanzará otra creación.",
            });
        }
        if (recovered.duplicate || recovered.partial || recovered.truncated) {
            return makePending("TPV_DRAFT_CREATION_UNCERTAIN", context, {
                requiresReconciliation: true,
                retryable: false,
                persisted: true,
                solution: "La correlación del borrador no es concluyente; no se repetirá createDraftOrder.",
            });
        }
        if (recovered.draftOrder) {
            const expected = {
                subtotalNetoMinor: Number(payload.subtotalNetoMinor),
                impuestosTotalMinor: Number(payload.impuestosTotalMinor),
                totalVentaMinor: Number(payload.totalVentaMinor),
            };
            const lines = Array.isArray(payload.resolvedLines) ? payload.resolvedLines : [];
            if (!lines.length || ![expected.subtotalNetoMinor, expected.impuestosTotalMinor, expected.totalVentaMinor].every(Number.isSafeInteger)) {
                return makePending("TPV_DRAFT_CREATION_UNCERTAIN", context, {
                    orderId: extractDraftId(recovered.draftOrder),
                    requiresReconciliation: true,
                    retryable: false,
                    persisted: true,
                });
            }
            return finalizeDraft(deps, marker, recovered.draftOrder, expected, lines, context, {
                replayed: true,
                autoResolved: true,
            });
        }
        return makePending("TPV_DRAFT_CREATION_UNCERTAIN", context, {
            requiresReconciliation: true,
            retryable: false,
            persisted: true,
            solution: "No se ha encontrado aún el borrador correlacionado; repetir solo la consulta con la misma clave. No se creará otro.",
        });
    }

    if (status === "FAILED_RETRYABLE") return null;

    if (status === "FAILED_FINAL") {
        return makeActionable(
            safeText(payload.errorCode, 100) || "TPV_SALE_PRECHECK_FAILED",
            safeText(payload.userMessage, 500) || "La venta no se pudo preparar.",
            Array.isArray(payload.remediation) ? payload.remediation : ["Corregir el dato señalado y usar una nueva clave idempotente."],
            context.traceId,
            { retryable: false, idempotencyPersisted: true }
        );
    }

    return makeActionable(
        "TPV_IDEMPOTENCY_STATE_INVALID",
        "La clave idempotente tiene un estado no reconocido.",
        ["No repetir la operación con una clave distinta.", "Verificar el registro de ControlOperativo y el borrador de Wix."],
        context.traceId,
        { requiresReconciliation: true, idempotencyPersisted: true }
    );
}

async function failBeforeDraft(deps, marker, context, code, userMessage, remediation, extra = {}) {
    try {
        await updateMarker(deps, marker, extra.retryable ? "FAILED_RETRYABLE" : "FAILED_FINAL", {
            errorCode: code,
            userMessage,
            remediation,
            invalidProductIds: extra.invalidProductIds || [],
        });
    } catch {
        return makeActionable(
            "TPV_IDEMPOTENCY_STATE_UPDATE_FAILED",
            "No se pudo guardar el resultado de la validación de la venta.",
            ["No repetir con una clave nueva.", "Consultar el estado idempotente antes de volver a intentar."],
            context.traceId,
            { requiresReconciliation: true, idempotencyPersisted: true }
        );
    }
    return makeActionable(code, userMessage, remediation, context.traceId, {
        retryable: extra.retryable === true,
        requiresReconciliation: false,
        idempotencyPersisted: true,
        invalidProductIds: extra.invalidProductIds || [],
        resolutionAttempts: extra.resolutionAttempts || RESOLUTION_STEPS,
    });
}

async function resolveCatalogLines(deps, lineas, lineItemIds) {
    const resolved = [];
    const invalidProductIds = [];
    for (let index = 0; index < lineas.length; index += 1) {
        const line = lineas[index];
        let product;
        try {
            product = await deps.getProduct(line.productId, {
                fields: ["CURRENCY", "VARIANT_OPTION_CHOICE_NAMES"],
            });
        } catch (error) {
            const status = Number(error?.status || error?.statusCode || error?.response?.status);
            if (status === 404 || /PRODUCT_NOT_FOUND|NOT_FOUND/i.test(String(error?.code || ""))) {
                invalidProductIds.push(line.productId);
                continue;
            }
            throw error;
        }
        if (!product || safeText(product._id || product.id, 100) !== line.productId) {
            invalidProductIds.push(line.productId);
            continue;
        }
        if (product.visible === false || product.visibleInPos === false) {
            invalidProductIds.push(line.productId);
            continue;
        }
        const variant = resolveVariant(product, line.variantId);
        if (!variant) {
            invalidProductIds.push(line.productId);
            continue;
        }
        const resolvedVariantId = safeText(variant._id || variant.id, 100);
        const priceAmount = variant.price?.actualPrice?.amount;
        let unitPriceMinor;
        try {
            unitPriceMinor = toMinorUnits(priceAmount, "CATALOG_PRICE");
        } catch {
            invalidProductIds.push(line.productId);
            continue;
        }
        const currency = String(product.currency || TPV_RUNTIME_POLICY.CURRENCY).toUpperCase();
        if (currency !== TPV_RUNTIME_POLICY.CURRENCY) {
            throw new Error("TPV_PRODUCT_CURRENCY_MISMATCH");
        }
        resolved.push({
            productId: line.productId,
            variantId: resolvedVariantId,
            cantidad: line.cantidad,
            productName: safeText(product.name, 250) || line.productId,
            unitPriceMinor,
            lineSubtotalMinor: unitPriceMinor * line.cantidad,
            taxGroupId: safeText(product.taxGroupId, 100) || null,
            lineItemId: lineItemIds[index],
        });
    }
    return { resolved, invalidProductIds };
}

async function calculateSaleTax(deps, resolvedLines) {
    const [regionResponse, defaultGroupsResponse, customGroupsResponse] = await Promise.all([
        deps.queryTaxRegions({ filter: { country: "ES" }, cursorPaging: { limit: 100 } }),
        deps.listDefaultTaxGroupsByAppIds([TPV_STORES_APP_ID]),
        deps.queryTaxGroups({ cursorPaging: { limit: 100 } }),
    ]);
    const taxRegion = extractTaxRegion(regionResponse);
    if (!taxRegion) throw new Error("TPV_TAX_REGION_UNRESOLVED");
    if (typeof taxRegion.taxIncludedInPrice !== "boolean" || taxRegion.taxIncludedInPrice === true) {
        throw new Error("TPV_TAX_INCLUDED_PRICE_UNSUPPORTED");
    }
    const defaultTaxGroupId = extractDefaultTaxGroup(defaultGroupsResponse);
    if (!defaultTaxGroupId) throw new Error("TPV_DEFAULT_TAX_GROUP_MISSING");
    const customTaxGroupIds = new Set(extractCustomTaxGroups(customGroupsResponse));
    const lineItems = resolvedLines.map((line) => {
        const taxGroupId = line.taxGroupId || defaultTaxGroupId;
        if (line.taxGroupId && line.taxGroupId !== defaultTaxGroupId && !customTaxGroupIds.has(line.taxGroupId)) {
            throw new Error("TPV_PRODUCT_TAX_GROUP_INVALID:" + line.productId);
        }
        return {
            _id: line.lineItemId,
            itemName: line.productName,
            quantity: line.cantidad,
            price: formatMinorUnits(line.unitPriceMinor),
            appId: TPV_STORES_APP_ID,
            taxGroupId,
            taxIncludedInPrice: false,
            addressIndex: { singleAddress: 0 },
        };
    });
    const response = await deps.calculateTax({
        currency: TPV_RUNTIME_POLICY.CURRENCY,
        addresses: [{ country: "ES" }],
        lineItems,
    });
    if (Array.isArray(response?.errors) && response.errors.length) {
        throw new Error("TPV_TAX_CALCULATION_REJECTED");
    }
    const taxSummary = response?.taxSummary || {};
    const subtotalNetoMinor = moneyMinor(taxSummary.totalTaxableAmount, "TAXABLE_SUBTOTAL");
    const impuestosTotalMinor = moneyMinor(taxSummary.totalTax, "TAX_TOTAL");
    const totalVentaMinor = moneyMinor(taxSummary.totalAmount, "TAX_TOTAL_AMOUNT");
    if (subtotalNetoMinor !== resolvedLines.reduce((sum, line) => sum + line.lineSubtotalMinor, 0) ||
        subtotalNetoMinor + impuestosTotalMinor !== totalVentaMinor) {
        throw new Error("TPV_TAX_TOTAL_MISMATCH");
    }
    const taxDetails = Array.isArray(response?.lineItemTaxDetails) ? response.lineItemTaxDetails : [];
    if (taxDetails.length !== resolvedLines.length) throw new Error("TPV_TAX_LINE_DETAILS_MISSING");
    for (let index = 0; index < resolvedLines.length; index += 1) {
        const detail = taxDetails.find((item) => safeText(item?._id || item?.id, 120) === resolvedLines[index].lineItemId) || taxDetails[index];
        const expectedGroup = resolvedLines[index].taxGroupId || defaultTaxGroupId;
        if (safeText(detail?.taxGroupId, 100) !== expectedGroup) {
            throw new Error("TPV_TAX_GROUP_FALLBACK_DETECTED:" + resolvedLines[index].productId);
        }
    }
    return {
        taxRegionId: safeText(taxRegion._id || taxRegion.id, 100),
        defaultTaxGroupId,
        taxGroupIds: [...new Set(resolvedLines.map((line) => line.taxGroupId || defaultTaxGroupId))],
        subtotalNetoMinor,
        impuestosTotalMinor,
        totalVentaMinor,
    };
}

async function queryDraftRecovery(deps, marker) {
    return recoverDraftOrder(deps, marker);
}

export async function registerTpvSaleDraft(input = {}, context = {}, deps = {}) {
    const traceId = safeText(context.traceId, 100);
    const sessionId = safeText(input.sessionId, 160);
    const idempotencyKey = safeText(input.idempotencyKey, 100);
    const operatorResourceId = safeText(context.operatorResourceId, 160);
    if (!sessionId) {
        return makeActionable("TPV_SESSION_REQUIRED", "La sesión TPV es obligatoria.", ["Abrir o seleccionar una sesión TPV válida antes de registrar la venta."], traceId);
    }
    if (!UUID_V4_RE.test(idempotencyKey)) {
        return makeActionable("TPV_IDEMPOTENCY_KEY_INVALID", "La clave idempotente debe ser un UUID v4 válido.", ["Generar una clave UUID v4 nueva para esta operación."], traceId);
    }
    if (!operatorResourceId) {
        return makeActionable("TPV_OPERATOR_RESOURCE_REQUIRED", "No se pudo identificar al profesional que registra la venta.", ["Resolver la identidad del empleado en MapaStaff antes de operar el TPV."], traceId);
    }

    const contextValue = { ...input, sessionId, idempotencyKey, lineas: input.lineas };
    const fingerprint = fingerprintInput(contextValue, sessionId);
    const id = markerId(idempotencyKey);
    let marker;
    try {
        marker = await deps.getItem(CONTROL_COLLECTION, id);
    } catch (lookupError) {
        return makeActionable("TPV_IDEMPOTENCY_LOOKUP_FAILED", "No se pudo consultar la clave idempotente.", ["Reintentar la consulta con la misma clave; no crear otro borrador."], traceId, { retryable: true });
    }

    const contextForResult = {
        traceId,
        sessionId,
        idempotencyKey,
        operatorResourceId,
    };

    if (marker) {
        if (marker.payload?.requestFingerprint !== fingerprint) {
            return makeActionable("TPV_IDEMPOTENCY_CONFLICT", "La clave idempotente ya se utilizó con datos distintos.", ["No reutilizar la clave para otra venta.", "Generar un UUID v4 nuevo para una operación diferente."], traceId, { idempotencyPersisted: true });
        }
        const replay = await recoverExistingMarker(deps, marker, contextForResult);
        if (replay) return replay;
    }

    const validated = validateInput(contextValue, sessionId);
    if (validated.code) {
        return makeActionable(validated.code, validated.message, ["Corregir las líneas y enviar una clave idempotente nueva."], traceId, {
            invalidLineIndexes: validated.invalidLineIndexes || [],
        });
    }
    const normalized = validated.value;
    const lineItemIds = normalized.lineas.map((_, index) => lineItemId(idempotencyKey, index));
    const createdAt = (deps.now ? deps.now() : new Date()).toISOString();

    if (!marker) {
        marker = makeInitialMarker({
            ...normalized,
            traceId,
            operatorResourceId,
        }, fingerprint, lineItemIds, createdAt);
        try {
            await deps.insertItem(CONTROL_COLLECTION, marker);
        } catch (insertError) {
            try {
                marker = await deps.getItem(CONTROL_COLLECTION, id);
            } catch {
                marker = null;
            }
            if (!marker) {
                return makeActionable("TPV_IDEMPOTENCY_PERSISTENCE_FAILED", "No se pudo reservar de forma durable la clave idempotente.", ["No lanzar la creación del borrador.", "Reintentar con la misma clave después de recuperar ControlOperativo."], traceId, { retryable: true });
            }
            if (marker.payload?.requestFingerprint !== fingerprint) {
                return makeActionable("TPV_IDEMPOTENCY_CONFLICT", "La clave idempotente ya se utilizó con datos distintos.", ["No reutilizar la clave.", "Generar un UUID v4 nuevo para una operación diferente."], traceId, { idempotencyPersisted: true });
            }
            const replay = await recoverExistingMarker(deps, marker, contextForResult);
            if (replay) return replay;
        }
    } else if (String(marker.status || "").toUpperCase() === "FAILED_RETRYABLE") {
        marker = await updateMarker(deps, marker, "CREATING", {
            errorCode: null,
            userMessage: null,
            remediation: [],
            lineItemIds,
            resolvedLines: [],
        });
    }

    const resolutionAttempts = ["idempotency_check"];
    let catalog;
    resolutionAttempts.push("catalog_prices");
    try {
        catalog = await resolveCatalogLines(deps, normalized.lineas, lineItemIds);
    } catch (catalogError) {
        return failBeforeDraft(
            deps, marker, contextForResult, "TPV_CATALOG_UNAVAILABLE",
            "No se pudo consultar el catálogo de productos.",
            ["Comprobar disponibilidad de Stores Catalog V3.", "Repetir la operación con la misma clave idempotente; no se ha creado ningún borrador."],
            { retryable: true, resolutionAttempts }
        );
    }
    if (catalog.invalidProductIds.length) {
        return failBeforeDraft(
            deps, marker, contextForResult, "TPV_PRODUCT_NOT_FOUND",
            "Uno o más productos no existen, no están visibles o no tienen una variante válida en el catálogo.",
            ["Corregir los identificadores de producto o variante.", "No se ha creado ningún pedido ni movimiento de caja."],
            { invalidProductIds: catalog.invalidProductIds, resolutionAttempts }
        );
    }

    let tax;
    resolutionAttempts.push("tax_calculation");
    try {
        tax = await calculateSaleTax(deps, catalog.resolved);
    } catch (taxError) {
        const code = safeText(taxError?.message, 140).split(":")[0] || "TPV_TAX_CALCULATION_FAILED";
        return failBeforeDraft(
            deps, marker, contextForResult, code,
            "La configuración fiscal de Wix no permite calcular los impuestos de todos los productos de la venta.",
            ["Verificar la región fiscal española y los grupos fiscales de los productos.", "Corregir cualquier taxGroupId sin grupo o mapeo válido.", "No se ha creado ningún pedido ni movimiento de caja."],
            {
                retryable: false,
                resolutionAttempts,
                invalidProductIds: /TPV_PRODUCT_TAX_GROUP_INVALID:([0-9a-f-]+)/i.test(String(taxError?.message || ""))
                    ? [String(taxError.message).split(":")[1]]
                    : [],
            }
        );
    }

    const expected = {
        subtotalNetoMinor: tax.subtotalNetoMinor,
        impuestosTotalMinor: tax.impuestosTotalMinor,
        totalVentaMinor: tax.totalVentaMinor,
    };
    try {
        marker = await updateMarker(deps, marker, "CREATING", {
            taxRegionId: tax.taxRegionId,
            defaultTaxGroupId: tax.defaultTaxGroupId,
            taxGroupIds: tax.taxGroupIds,
            resolvedLines: catalog.resolved,
            phase: "DRAFT_CREATE_STARTED",
            subtotalNetoMinor: expected.subtotalNetoMinor,
            impuestosTotalMinor: expected.impuestosTotalMinor,
            totalVentaMinor: expected.totalVentaMinor,
            currency: TPV_RUNTIME_POLICY.CURRENCY,
        });
    } catch {
        return makeActionable(
            "TPV_IDEMPOTENCY_STATE_UPDATE_FAILED",
            "No se pudo guardar el cálculo fiscal previo al borrador.",
            ["No se ha llamado a Draft Orders.", "Reintentar la lectura del estado idempotente antes de iniciar otra operación."],
            traceId,
            { requiresReconciliation: true, idempotencyPersisted: true, resolutionAttempts }
        );
    }

    resolutionAttempts.push("ecom_draft_order");
    const catalogLineItems = catalog.resolved.map((line) => ({
        _id: line.lineItemId,
        catalogReference: {
            appId: TPV_STORES_APP_ID,
            catalogItemId: line.productId,
            options: { variantId: line.variantId },
        },
        quantity: line.cantidad,
    }));

    let draftOrder;
    try {
        const response = await deps.createDraftOrder({
            draftOrder: {
                catalogLineItems,
                recipientInfo: { address: { country: "ES" } },
                billingInfo: { address: { country: "ES" } },
                taxExempt: false,
            },
        });
        draftOrder = normalizeDraftOrder(response);
        if (!draftOrder) throw new Error("TPV_DRAFT_RESPONSE_EMPTY");
        const calculationErrors = response?.calculatedDraftOrder?.calculationErrors;
        if (calculationErrors && (Array.isArray(calculationErrors)
            ? calculationErrors.length > 0
            : Object.keys(calculationErrors).length > 0)) {
            throw new Error("TPV_DRAFT_CALCULATION_ERRORS");
        }
    } catch (createError) {
        let recovered;
        try {
            recovered = await queryDraftRecovery(deps, marker);
        } catch {
            recovered = null;
        }
        if (recovered?.draftOrder) {
            return finalizeDraft(deps, marker, recovered.draftOrder, expected, catalog.resolved, contextForResult, {
                replayed: true,
                autoResolved: true,
            });
        }
        if (isDefinitiveDraftRejection(createError)) {
            return failBeforeDraft(
                deps, marker, contextForResult, "TPV_ECOM_DRAFT_REJECTED",
                "Wix eCommerce ha rechazado la creación del pedido provisional.",
                ["Revisar el catálogo, los permisos ECOM.DRAFT_ORDERS y los datos de destinatario.", "No se ha realizado ningún cobro."],
                { retryable: false, resolutionAttempts }
            );
        }
        return makePending("TPV_DRAFT_CREATION_UNCERTAIN", contextForResult, {
            requiresReconciliation: true,
            retryable: false,
            persisted: true,
            solution: "Wix pudo crear el borrador antes del timeout; repetir la consulta con la misma clave. No se lanzará una segunda creación.",
            resolutionAttempts,
        });
    }

    if (!extractDraftId(draftOrder)) {
        let recovered;
        try {
            recovered = await queryDraftRecovery(deps, marker);
        } catch {
            recovered = null;
        }
        if (recovered?.draftOrder) {
            return finalizeDraft(deps, marker, recovered.draftOrder, expected, catalog.resolved, contextForResult, {
                replayed: true,
                autoResolved: true,
            });
        }
        return makePending("TPV_DRAFT_CREATION_UNCERTAIN", contextForResult, {
            requiresReconciliation: true,
            retryable: false,
            persisted: true,
            resolutionAttempts,
        });
    }

    return finalizeDraft(deps, marker, draftOrder, expected, catalog.resolved, contextForResult, {
        replayed: false,
        autoResolved: false,
    });
}
