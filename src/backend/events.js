/*
=============================================================================
MODULE: backend/events.js
VERSION: v5017-REFUND-IDEMPOTENCY-BOUNDED
BASE: v5009-FISCAL-V20.1 + alineacion con internalConfig v12.0-SSOT-FINAL
      y dataAccess v2.1-UNIFIED
RESPONSIBILITY: Server-to-server native webhooks for Wix Bookings V2 and
                Wix eCommerce V2 with exact-indexed queries, bounded
                execution and full idempotency.
STANDARDS: G10 ASCII Strict. Cero suppressAuth. Cero COLLECTIONS alias.

CAMBIOS DE ALINEACION v5015-ALIGNED (respecto a v5009-FISCAL-V20.1):
  ALN-01: COLLECTIONS alias eliminado. Uso de BUSINESS_COLLECTIONS y
          OPERATIONAL_COLLECTIONS.
  ALN-02: PROCESSED_WEBHOOK_EVENTS (coleccion inexistente en v12.0) se
          consolida en ControlOperativo con controlType = WEBHOOK_EVENT.
          El _id se mantiene como normalizacion del eventId (<=100 chars).
  ALN-03: BOOKING_STATUS.CANCELED -> BOOKING_STATUS.CANCELED
          (enum Wix nativo correcto en v12.0).
  ALN-04: AEAT_INVOICE_TYPE -> TIPO_FACTURA.
  ALN-05: VAT_ACCRUAL_STATUS no existe en v12.0. Constante local
          VAT_ACCRUAL_DEVENGADO.
  ALN-06: PAYMENT_METHOD.ONLINE no existe en v12.0. Se sustituye por
          PAYMENT_METHOD.WIX_PAYMENTS (equivalente semantico para el
          ledger fiscal; el canal "ONLINE" se conserva en channelType).
  ALN-07: wixData.query/get/insert -> dalQuery/dalGet/dalInsert.
  ALN-08: .find({ suppressHooks: true }) retirado del query a CitasF2
          (dataAccess no expone suppressHooks; CitasF2 no tiene hook
          beforeRemove que interfiera en lectura).
  ALN-09: Correccion heredada: CORRECTION_REASON.NUMERO_SERIE (no existia
          en v5009; el enum real v12.0 solo tiene DESCUENTO_O_MARGEN,
          ELEMENTOS_SEGURIDAD, CAMBIOS_BASE_IMPONIBLE, CUOTA_ERRONEA,
          EXENTA_NO_SUJETA_REPETIDA, SIMPLIFICADA_REPETIDA, OTRAS).
          Se usa CORRECTION_REASON.OTRAS.
  FISCAL-ORDER-01: El importe explicito de pedido, incluido 0, prevalece
          sobre el precio unitario. Si falta, se usan importes de linea
          despues de descuentos antes de recurrir al precio unitario.

REFUND-01 (P1): deduplicacion fiscal por REFUND-{orderId}-{refundId}; valida
  reutilizacion de refundId, acumulado contra el importe original y lectura
  paginada con fallo cerrado. La base y cuota de IVA se prorratean en reembolsos
  parciales y el ultimo reembolso aplica el residual para cuadrar el original.
  Los efectos restock explicitos de Wix conservan su idempotencia por refundId.

FIXES APLICADOS v5009-FISCAL-V20.1 (heredados):
  - V20-01..V20-06.
FIXES APLICADOS v5009-FISCAL (heredados):
  - CONSOL-04..08, E-01..E-03, FIX-55..59.
=============================================================================
*/

import { createClient } from "@wix/sdk";
import { orders } from "@wix/ecom";
import { extendedBookings } from "@wix/bookings";
import { auth } from "@wix/essentials";
import { getSecretValue } from "backend/secretAccess";

import {
    query as dalQuery,
    getItem as dalGet,
    insertItem as dalInsert,
    updateItem as dalUpdate,
} from "backend/dataAccess";

import {
    makeTraceId,
    _executeWithRetry,
    _normalizeIdPart,
    _safeTrim,
    _looksLikeGuid,
    getMadridLocalStringNoZ,
    _toDateSafe,
    withTimeout,
} from "public/mmUtils";

import {
    BUSINESS_COLLECTIONS,
    OPERATIONAL_COLLECTIONS,
    CONTROL_TYPE,
    CONTROL_STATUS,
    WIX_CATALOG_APP_IDS,
    MOVEMENT_TYPE,
    PAYMENT_METHOD,
    BOOKING_STATUS,
    PAYMENT_STATUS,
    BOOKING_TYPE,
    normalizeBookingType,
    CHANNEL_TYPE,
    BOOKING_FIELDS,
    SDK_CONFIG,
    TIPO_FACTURA,
    CORRECTION_REASON,
    FISCAL_ROLE,
    EVENT_TYPE,
} from "backend/internalConfig";

import { SECRETS } from "backend/mmSecrets";
import { logger } from "backend/logger";
import { normalizeError, _updateCitaSafe, _persistBooking } from "backend/booking/bookingCore";
import { queueFiscalRecovery, updateCajaActualFromMovement } from "backend/cajas.web";
import { registrarEventoEconomico } from "backend/eventLog";
import { syncPaidOrderInventoryInternal, reserveOrderInventoryInternal, releaseOrderInventoryInternal, syncRestockedOrderInventoryInternal } from "backend/inventario.web";

import { logAuditEventWithTimeout, notifyOperationalAlert } from "backend/audit";
import {
    readControlPayload,
    readInvoiceNumber,
    readInvoiceIssueDate,
    readTaxBase,
    readTaxAmount,
    readRecipientTaxId,
    readMovementField,
} from "backend/data";

/**
 * Resolve the authoritative Wix order amount for the fiscal ledger.
 * An explicit zero is valid and must not fall back to undiscounted prices.
 */
export function resolveOrderLedgerAmount(order) {
    const orderTotalCandidates = [
        order?.priceSummary?.totalPrice?.amount,
        order?.priceSummary?.total?.amount,
        order?.payNow?.total?.amount,
        order?.payNow?.totalPrice?.amount,
        order?.totals?.total?.amount,
    ];
    for (const rawOrderTotal of orderTotalCandidates) {
        if (
            rawOrderTotal === undefined ||
            rawOrderTotal === null ||
            String(rawOrderTotal).trim() === ""
        ) {
            continue;
        }
        const orderTotal = Number(rawOrderTotal);
        if (Number.isFinite(orderTotal) && orderTotal >= 0) {
            return orderTotal;
        }
    }

    const lineItems = Array.isArray(order?.lineItems) ? order.lineItems : [];
    return lineItems.reduce((sum, item) => {
        const lineTotalCandidates = [
            item?.totalPriceAfterTax?.amount,
            item?.totalPriceBeforeTax?.amount,
            item?.totalPrice?.amount,
        ];
        for (const rawLineTotal of lineTotalCandidates) {
            if (
                rawLineTotal === undefined ||
                rawLineTotal === null ||
                String(rawLineTotal).trim() === ""
            ) {
                continue;
            }
            const lineTotal = Number(rawLineTotal);
            if (Number.isFinite(lineTotal) && lineTotal >= 0) {
                return sum + lineTotal;
            }
        }

        const rawUnitPrice = item?.price?.amount ?? item?.price;
        const unitPrice = Number(rawUnitPrice);
        const quantity = Number(item?.quantity) || 1;
        return sum + (
            Number.isFinite(unitPrice) && unitPrice >= 0
                ? unitPrice * quantity
                : 0
        );
    }, 0);
}

/**
 * Resolve the fiscal VAT breakdown from the current Wix Orders schema.
 * Uses Order.taxInfo and OrderLineItem.taxInfo; deprecated taxSummary/taxDetails
 * and a hard-coded VAT rate are deliberately not accepted.
 */
export function resolveOrderFiscalTaxData(order) {
    const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
    const readMoney = (value, field) => {
        const raw = value && typeof value === "object" ? value.amount : value;
        if (raw === undefined || raw === null || String(raw).trim() === "") {
            throw new Error("FISCAL_TAX_FIELD_MISSING:" + field);
        }
        const amount = Number(raw);
        if (!Number.isFinite(amount) || amount < 0) {
            throw new Error("FISCAL_TAX_FIELD_INVALID:" + field);
        }
        return roundMoney(amount);
    };

    const lineItems = Array.isArray(order?.lineItems) ? order.lineItems : [];
    if (!lineItems.length) throw new Error("FISCAL_TAX_LINE_ITEMS_MISSING");
    const orderTaxInfo = order?.taxInfo;
    if (!orderTaxInfo || orderTaxInfo.taxExempt === true) {
        throw new Error("FISCAL_TAX_INFO_MISSING_OR_EXEMPT");
    }
    const totalExempt = orderTaxInfo.totalExempt?.amount == null
        ? 0
        : readMoney(orderTaxInfo.totalExempt, "taxInfo.totalExempt");
    if (totalExempt > 0) throw new Error("FISCAL_TAX_EXEMPTION_REQUIRES_POLICY");

    let taxBase = 0;
    let taxAmount = 0;
    let lineTotal = 0;
    const rates = new Set();
    const breakdown = [];

    for (let index = 0; index < lineItems.length; index++) {
        const item = lineItems[index];
        const taxInfo = item?.taxInfo;
        if (!taxInfo) throw new Error("FISCAL_LINE_TAX_INFO_MISSING:" + index);
        const exemptAmount = taxInfo.exemptAmount?.amount == null
            ? 0
            : readMoney(taxInfo.exemptAmount, "lineItems[" + index + "].taxInfo.exemptAmount");
        if (exemptAmount > 0) {
            throw new Error("FISCAL_LINE_EXEMPTION_REQUIRES_POLICY:" + index);
        }
        if (Array.isArray(taxInfo.taxBreakdown) && taxInfo.taxBreakdown.length > 1) {
            throw new Error("FISCAL_MULTIPLE_JURISDICTION_TAXES_UNSUPPORTED:" + index);
        }

        const base = readMoney(taxInfo.taxableAmount, "lineItems[" + index + "].taxInfo.taxableAmount");
        const tax = readMoney(taxInfo.taxAmount, "lineItems[" + index + "].taxInfo.taxAmount");
        const rawRate = taxInfo.taxRate ?? taxInfo.taxBreakdown?.[0]?.rate;
        const rate = Number(rawRate);
        if (!Number.isFinite(rate) || rate <= 0 || rate > 1) {
            throw new Error("FISCAL_LINE_TAX_RATE_INVALID:" + index);
        }
        if (Math.abs(roundMoney(base * rate) - tax) > 0.02) {
            throw new Error("FISCAL_LINE_TAX_CALCULATION_MISMATCH:" + index);
        }

        const rawLineTotal = item?.totalPriceAfterTax?.amount;
        if (rawLineTotal === undefined || rawLineTotal === null || String(rawLineTotal).trim() === "") {
            throw new Error("FISCAL_LINE_TOTAL_AFTER_TAX_MISSING:" + index);
        }
        const afterTax = readMoney(item.totalPriceAfterTax, "lineItems[" + index + "].totalPriceAfterTax");
        if (Math.abs(roundMoney(base + tax) - afterTax) > 0.02) {
            throw new Error("FISCAL_LINE_TOTAL_TAX_MISMATCH:" + index);
        }

        taxBase += base;
        taxAmount += tax;
        lineTotal += afterTax;
        rates.add(roundMoney(rate * 100));
        breakdown.push({
            base,
            tipo: roundMoney(rate * 100),
            cuota: tax,
            operationDescription: String(item?.productName?.original || item?.name || "Wix order line").slice(0, 180),
            units: Number(item?.quantity) > 0 ? Number(item.quantity) : 1,
            magnitude: 1,
        });
    }

    taxBase = roundMoney(taxBase);
    taxAmount = roundMoney(taxAmount);
    lineTotal = roundMoney(lineTotal);
    const officialTax = readMoney(orderTaxInfo.totalTax, "taxInfo.totalTax");
    if (Math.abs(taxAmount - officialTax) > 0.01) {
        throw new Error("FISCAL_ORDER_TAX_TOTAL_MISMATCH");
    }
    if (order?.priceSummary?.tax?.amount != null) {
        const summaryTax = readMoney(order.priceSummary.tax, "priceSummary.tax");
        if (Math.abs(summaryTax - officialTax) > 0.01) {
            throw new Error("FISCAL_PRICE_SUMMARY_TAX_MISMATCH");
        }
    }
    const orderTotal = roundMoney(resolveOrderLedgerAmount(order));
    if (Math.abs(lineTotal - orderTotal) > 0.02) {
        throw new Error("FISCAL_ORDER_TOTAL_HAS_UNSUPPORTED_FEES_OR_SHIPPING");
    }
    if (rates.size !== 1) throw new Error("FISCAL_MULTIPLE_VAT_RATES_UNSUPPORTED");

    return {
        taxBase,
        taxAmount,
        tipoImpositivo: Array.from(rates)[0],
        breakdown,
    };
}

const log = logger;
const queryExtendedBookingsElevated = auth.elevate(extendedBookings.queryExtendedBookings);
const getOrderElevated = auth.elevate(orders.getOrder);
const READER_V2_PAGE_LIMIT = 100;
const READER_V2_MAX_PAGES = 5;

// ============================================================================
// CONSTANTES (ALN-01, ALN-05, ALN-06)
// ============================================================================

const CITAS_COL = BUSINESS_COLLECTIONS.CITAS_F2;
const MOVIMIENTOS_CAJA_COL = BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA;
const CONTROL_OPERATIVO_COL = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
const MAPA_STAFF_COL = BUSINESS_COLLECTIONS.MAPA_STAFF;

// ALN-05: VAT_ACCRUAL_STATUS no existe en internalConfig v12.0.
const VAT_ACCRUAL_DEVENGADO = "DEVENGADO";

// ALN-06: PAYMENT_METHOD.ONLINE no existe. WIX_PAYMENTS es el canonico
// para el ledger fiscal. El canal "ONLINE" se conserva en channelType.
const LEDGER_PAYMENT_METHOD_ONLINE = PAYMENT_METHOD.WIX_PAYMENTS;

const WEBHOOK_RETRIES = Number(SDK_CONFIG?.EVENTS?.RETRY_ATTEMPTS) || 3;
const WEBHOOK_RETRY_DELAY_MS =
    Number(SDK_CONFIG?.EVENTS?.RETRY_BASE_BACKOFF_MS) || 1000;
const API_TIMEOUT_MS = Number(SDK_CONFIG?.TIMEOUTS?.WEBHOOK_MS) || 30000;

const EMISOR_FALLBACK_NAME = "MARIAN MADRID";
const EVENT_TTL_HOURS = 72;

const STRONG_READ = Object.freeze({ consistencyMode: "strong" });

// ============================================================================
// WIX CLIENT
// ============================================================================

const wixClient = createClient({});

async function _verifyAndDecodeWebhook(rawBody, expectedEventType) {
    try {
        if (!rawBody) {
            log.warn("WEBHOOK_EMPTY_BODY", { expectedEventType });
            return null;
        }

        if (typeof rawBody === "object" && !(rawBody instanceof String)) {
            return rawBody;
        }

        if (typeof wixClient?.webhooks?.process !== "function") {
            log.error("WEBHOOK_PROCESS_NOT_AVAILABLE", {
                expectedEventType,
                hint: "El runtime debe entregar el evento ya decodificado.",
            });
            return null;
        }

        const event = await wixClient.webhooks.process(rawBody);

        if (!event) {
            log.warn("WEBHOOK_VERIFICATION_FAILED", { expectedEventType });
            return null;
        }

        log.debug("WEBHOOK_VERIFIED", {
            eventType: event.eventType || expectedEventType,
            hasData: !!event.data,
        });

        return event;
    } catch (err) {
        log.error("WEBHOOK_JWT_VERIFICATION_FAILED", {
            expectedEventType,
            error: err?.message || String(err),
        });
        return null;
    }
}

function _normalizeBookingIds(value) {
    const values = Array.isArray(value) ? value : String(value || "").split(",");
    return Array.from(
        new Set(values.map((id) => String(id || "").trim()).filter(Boolean))
    );
}

async function _expandBookingIdsWithPair(bookingIds) {
    const directIds = _normalizeBookingIds(bookingIds);
    const pairTokens = new Set();

    const directRows = await Promise.all(
        directIds.map(async (bookingId) => {
            const result = await dalQuery(CITAS_COL)
                .eq(BOOKING_FIELDS.BOOKING_ID, bookingId)
                .limit(1)
                .find(STRONG_READ);
            return (result && result.items && result.items[0]) || null;
        })
    );

    for (const cita of directRows) {
        const pairToken = _safeTrim(
            cita && (cita[BOOKING_FIELDS.PAIR_TOKEN] ||
                (cita.meta && cita.meta.pairToken))
        );
        if (pairToken) pairTokens.add(pairToken);
    }

    const pairedRows = await Promise.all(
        Array.from(pairTokens).map(async (pairToken) => {
            const result = await dalQuery(CITAS_COL)
                .eq(BOOKING_FIELDS.PAIR_TOKEN, pairToken)
                .limit(10)
                .find(STRONG_READ);
            return (result && result.items) || [];
        })
    );

    const allIds = new Set(directIds);
    for (const rows of pairedRows) {
        for (const cita of rows) {
            const bookingId = _safeTrim(
                cita && (cita[BOOKING_FIELDS.BOOKING_ID] || cita.bookingId)
            );
            if (bookingId) allIds.add(bookingId);
        }
    }

    return {
        directIds,
        allIds: Array.from(allIds),
    };
}

// ============================================================================
// EMISOR FISCAL CACHE
// ============================================================================

let _emisorCache = null;

async function _getEmisorFiscal() {
    if (_emisorCache) return _emisorCache;
    try {
        const nif = await getSecretValue(SECRETS.FISCAL_NIF_EMISOR);
        // SSOT-KEYFIELD (Matriz MovimientosCaja, Apartado 2): claves canonicas
        // AEAT; el motor promueve aliases legacy, pero los writers entregan
        // directamente el canon — cero aliases en src/.
        _emisorCache = {
            nifEmisor: _safeTrim(nif).toUpperCase(),
            issuerLegalName: EMISOR_FALLBACK_NAME,
        };
    } catch (_) {
        _emisorCache = {
            nifEmisor: "",
            issuerLegalName: EMISOR_FALLBACK_NAME,
        };
    }
    return _emisorCache;
}

// ============================================================================
// EVENT STRUCTURE VALIDATION
// ============================================================================

function validateEventStructure(event, requiredFields) {
    if (!event || typeof event !== "object") {
        log.warn("EVENT_INVALID_STRUCTURE", { hasEvent: !!event });
        return false;
    }
    for (const field of requiredFields) {
        const value = field.split(".").reduce((obj, key) => obj?.[key], event);
        if (value === undefined || value === null) {
            log.warn("EVENT_MISSING_FIELD", {
                field,
                eventId: event.metadata?.id,
            });
            return false;
        }
    }
    return true;
}

/**
 * Normalize the Wix Bookings V2 Velo/SDK backend event contract.
 * Wix invokes backend/events.js handlers with event.metadata + event.entity.
 * REST webhook JWT envelopes belong to a separate HTTP webhook receiver and
 * are deliberately not accepted here as unverified plain objects.
 */
function _normalizeBookingsEvent(event) {
    // Wix Editor Velo backend events use metadata + data.booking.
    // SDK event handlers use metadata + entity; retain entity as a compatible
    // shape, but do not confuse REST webhook actionEvent envelopes with Velo events.
    const booking = event?.data?.booking || event?.entity || {};
    const bookingId = _safeTrim(booking?.id || booking?._id || "");
    return {
        eventId: _safeTrim(event?.metadata?.id || ""),
        bookingId,
        booking: bookingId
            ? { ...booking, id: bookingId }
            : booking,
    };
}

// ============================================================================
// IDEMPOTENCY (ALN-02: ControlOperativo con controlType=WEBHOOK_EVENT)
// ============================================================================

async function isEventProcessed(eventId) {
    if (!eventId) return false;
    const normalizedId = _normalizeIdPart(String(eventId), 100);
    const webhookKey = `WEBHOOK_${normalizedId}`;

    const existing = await dalQuery(CONTROL_OPERATIVO_COL)
        .eq("controlType", CONTROL_TYPE.WEBHOOK_EVENT)
        .eq("dedupeKey", webhookKey)
        .limit(1)
        .find(STRONG_READ);

    return Boolean(existing?.items?.length);
}

async function isOrderCreatedReconciled(orderId) {
    if (!_looksLikeGuid(orderId)) return false;
    const existing = await dalQuery(CONTROL_OPERATIVO_COL)
        .eq("controlType", CONTROL_TYPE.WEBHOOK_EVENT)
        .eq("orderId", orderId)
        .eq("status", CONTROL_STATUS.COMPLETED)
        .limit(5)
        .find(STRONG_READ);
    return (existing?.items || []).some((row) =>
        row?.payload?.eventType === "ORDER_CREATED_RECONCILED"
    );
}

async function markEventAsProcessed(eventId, eventType, traceId, metadata = {}) {
    if (!eventId) return;
    const normalizedId = _normalizeIdPart(String(eventId), 100);
    const webhookKey = `WEBHOOK_${normalizedId}`;
    const expiresAt = new Date(Date.now() + EVENT_TTL_HOURS * 3600 * 1000);

    try {
        await dalInsert(CONTROL_OPERATIVO_COL, {
            controlType: CONTROL_TYPE.WEBHOOK_EVENT,
            serviceId: _looksLikeGuid(metadata?.serviceId) ? _safeTrim(metadata.serviceId) : undefined,
            dedupeKey: webhookKey,
            eventId: String(eventId),
            status: CONTROL_STATUS.COMPLETED,
            expiresAt,
            payload: {
                eventType,
                traceId,
                processedAt: new Date().toISOString(),
                metadata,
            },
            traceId: _safeTrim(traceId) || makeTraceId("webhook"),
            _createdDate: new Date(),
        });
        log.debug("EVENT_MARKED_PROCESSED", { eventId, eventType });
        return true;
    } catch (err) {
        // A failed insert is treated as a duplicate only when the exact key
        // can be read back. Otherwise propagate the persistence failure.
        const existing = await dalQuery(CONTROL_OPERATIVO_COL)
            .eq("controlType", CONTROL_TYPE.WEBHOOK_EVENT)
            .eq("dedupeKey", webhookKey)
            .limit(1)
            .find(STRONG_READ);
        if (existing?.items?.length) {
            log.debug("EVENT_INSERT_CONFLICT_CONFIRMED", { eventId, eventType });
            return true;
        }
        throw err;
    }
}

function _handleError(error, context, traceId) {
    const normalized = normalizeError(error);
    log.error(`Error in ${context}`, { error: normalized.message, traceId });
    return { code: normalized.code, message: normalized.message };
}

// ============================================================================
// EXTRACCION FISCAL DEL PEDIDO
// ============================================================================

function _extractFiscalDataFromOrder(order) {
    if (!order || typeof order !== "object") {
        return {
            // SSOT-KEYFIELD (Matriz MovimientosCaja, Apartado 2): nifDestinatario
            // es la clave canonica AEAT; cero aliases internos en src/.
            nifDestinatario: null,
            recipientLegalName: null,
            recipientAddress: null,
            isB2B: false,
            irpfWithholdingRate: 0,
            withholdingBase: 0,
            irpfWithholdingAmount: 0,
            bankReconciliationReference: null,
            fiscalRole: FISCAL_ROLE.EMISOR,
        };
    }

    const billingInfo = order.billingInfo || order.buyerInfo || {};
    const billingAddress =
        billingInfo.address || billingInfo.billingAddress || {};

    const vatId = _safeTrim(
        billingInfo.vatId ||
            billingInfo.taxId ||
            billingAddress.vatId ||
            ""
    ).toUpperCase();

    const companyName = _safeTrim(
        billingInfo.company ||
            billingAddress.company ||
            billingAddress.companyName ||
            ""
    ).toUpperCase();

    const isB2B = Boolean(vatId || companyName);

    const recipientAddress =
        billingAddress && Object.keys(billingAddress).length > 0
            ? {
                  pais: _safeTrim(billingAddress.country) || "ES",
                  calle: _safeTrim(
                      billingAddress.streetAddress ||
                          billingAddress.addressLine ||
                          billingAddress.addressLine1 ||
                          ""
                  ),
                  cp: _safeTrim(
                      billingAddress.postalCode ||
                          billingAddress.zipCode ||
                          ""
                  ),
                  municipio: _safeTrim(
                      billingAddress.city || billingAddress.town || ""
                  ),
                  provincia: _safeTrim(
                      billingAddress.subdivision ||
                          billingAddress.state ||
                          billingAddress.province ||
                          ""
                  ),
              }
            : null;

    // Wix Orders does not expose a standard IRPF-retention field. Do not
    // infer withholding base from subtotal or deprecated taxSummary.
    const withholdingAmount = 0;
    const withholdingBase = 0;

    const bankReconciliationReference =
        _safeTrim(
            order.paymentDetails?.transactionId ||
                order.paymentDetails?.gatewayTransactionId ||
                order.transactionId ||
                ""
        ) || null;

    return {
        nifDestinatario: vatId || null,
        recipientLegalName: companyName || null,
        recipientAddress,
        isB2B,
        irpfWithholdingRate: 0,
        withholdingBase,
        irpfWithholdingAmount: withholdingAmount,
        bankReconciliationReference,
        fiscalRole: FISCAL_ROLE.EMISOR,
    };
}

// ============================================================================
/* Native Bookings -> CitasF2 projection.
 * Custom booking sagas write the richer row first. Native Wix Bookings
 * confirmations must also be represented when no saga row exists, without
 * replacing pairToken/meta if the webhook races a custom dual transaction.
 */
async function _resolveStaffResourceFromMapaStaff(staffMemberId) {
    const id = _safeTrim(staffMemberId);
    if (!id || !_looksLikeGuid(id)) {
        return { ok: false, reason: "MAPA_STAFF_MEMBER_ID_MISSING" };
    }

    const result = await dalQuery(MAPA_STAFF_COL)
        .eq("staffMemberId", id)
        .eq("active", true)
        .limit(2)
        .find(STRONG_READ);
    const matches = Array.isArray(result?.items) ? result.items : [];

    if (matches.length === 0) {
        return { ok: false, reason: "MAPA_STAFF_ACTIVE_MAPPING_NOT_FOUND" };
    }
    if (matches.length !== 1) {
        return { ok: false, reason: "MAPA_STAFF_ACTIVE_MAPPING_AMBIGUOUS" };
    }

    const resourceId = _safeTrim(matches[0]?.resourceId || "");
    const scheduleId = _safeTrim(matches[0]?.scheduleId || "");
    if (!_looksLikeGuid(resourceId)) {
        return { ok: false, reason: "MAPA_STAFF_RESOURCE_ID_INVALID" };
    }
    if (!_looksLikeGuid(scheduleId)) {
        return { ok: false, reason: "MAPA_STAFF_SCHEDULE_ID_INVALID" };
    }
    return { ok: true, resourceId, scheduleId };
}

async function _syncNativeBookingToCitas(booking, eventId, traceId) {
    const bookingId = _safeTrim(booking?.id || booking?._id);
    const bookedEntity = booking?.bookedEntity || {};
    const slot = bookedEntity.slot || bookedEntity.item?.slot || {};
    const resource = slot.resource || {};
    const serviceId = _safeTrim(slot.serviceId || booking?.serviceId);
    let resourceId = _safeTrim(resource._id || resource.id || booking?.resource?._id || booking?.resource?.id);
    let scheduleId = _safeTrim(slot.scheduleId || resource.scheduleId || booking?.scheduleId);
    const staffMemberId = _safeTrim(booking?.staffMemberId || booking?.staff?.staffMemberId || "");
    const startDate = booking?.startDate || slot.startDate;
    const endDate = booking?.endDate || slot.endDate;

    if (!bookingId || !serviceId) {
        const missing = [];
        if (!bookingId) missing.push("bookingId");
        if (!serviceId) missing.push("serviceId");
        return { ok: false, reason: "NATIVE_BOOKING_MISSING_REQUIRED_FIELDS", missing };
    }

    // Order is intentional: custom booking sagas persist the complete CitasF2
    // row before Wix emits the confirmation webhook. Reconcile that row first;
    // do not reject a valid saga projection because the webhook snapshot omits
    // resource details that are already stored in CitasF2.
    const existing = await dalQuery(CITAS_COL)
        .eq(BOOKING_FIELDS.BOOKING_ID, bookingId)
        .limit(1)
        .find(STRONG_READ);

    if (existing?.items?.length) {
        const existingCita = existing.items[0];
        const existingResourceId = _safeTrim(existingCita?.resourceId || "");
        const existingScheduleId = _safeTrim(existingCita?.scheduleId || "");
        if (_looksLikeGuid(existingResourceId) && _looksLikeGuid(existingScheduleId)) {
            await _updateCitaStatus(bookingId, BOOKING_STATUS.CONFIRMED, traceId);
            return {
                ok: true,
                created: false,
                existing: true,
                bookingId,
                serviceId: _safeTrim(existingCita?.serviceId || serviceId),
            };
        }

        if ((!_looksLikeGuid(resourceId) || !_looksLikeGuid(scheduleId)) && staffMemberId) {
            const mapping = await _resolveStaffResourceFromMapaStaff(staffMemberId);
            if (!mapping.ok) {
                return { ok: false, reason: mapping.reason, missing: ["resourceId", "scheduleId"] };
            }
            if (!_looksLikeGuid(resourceId)) resourceId = mapping.resourceId;
            if (!_looksLikeGuid(scheduleId)) scheduleId = mapping.scheduleId;
        }
        const resolvedResourceId = _looksLikeGuid(existingResourceId) ? existingResourceId : resourceId;
        const resolvedScheduleId = _looksLikeGuid(existingScheduleId) ? existingScheduleId : scheduleId;
        if (!_looksLikeGuid(resolvedResourceId) || !_looksLikeGuid(resolvedScheduleId)) {
            const missing = [];
            if (!_looksLikeGuid(resolvedResourceId)) missing.push("resourceId");
            if (!_looksLikeGuid(resolvedScheduleId)) missing.push("scheduleId");
            return { ok: false, reason: "NATIVE_BOOKING_MISSING_REQUIRED_FIELDS", missing };
        }
        await _updateCitaSafe(
            bookingId,
            (cita) => ({
                ...cita,
                resourceId: resolvedResourceId,
                scheduleId: resolvedScheduleId,
                [BOOKING_FIELDS.STATUS]: BOOKING_STATUS.CONFIRMED,
            }),
            traceId,
            "events_reconcileExistingCitaResource"
        );
        return {
            ok: true,
            created: false,
            existing: true,
            bookingId,
            serviceId: _safeTrim(existingCita?.serviceId || serviceId),
        };
    }

    // New native projections prefer the canonical Wix slot resource. When it
    // is absent, use the explicit staff identity only through the active CMS
    // mapping; never infer a resource from a display name or a default staff.
    if ((!_looksLikeGuid(resourceId) || !_looksLikeGuid(scheduleId)) && staffMemberId) {
        const mapping = await _resolveStaffResourceFromMapaStaff(staffMemberId);
        if (!mapping.ok) {
            return { ok: false, reason: mapping.reason, missing: ["resourceId", "scheduleId"] };
        }
        if (!_looksLikeGuid(resourceId)) resourceId = mapping.resourceId;
        if (!_looksLikeGuid(scheduleId)) scheduleId = mapping.scheduleId;
    }

    const missing = [];
    if (!_looksLikeGuid(resourceId)) missing.push("resourceId");
    if (!_looksLikeGuid(scheduleId)) missing.push("scheduleId");
    if (!startDate) missing.push("startDate");
    if (!endDate) missing.push("endDate");
    if (missing.length) {
        return { ok: false, reason: "NATIVE_BOOKING_MISSING_REQUIRED_FIELDS", missing };
    }

    const selectedPaymentOption = _safeTrim(booking?.selectedPaymentOption || "UNDEFINED").toUpperCase();
    const rawPaymentStatus = _safeTrim(booking?.paymentStatus || "").toUpperCase();
    const validPaymentStatuses = Object.values(PAYMENT_STATUS);
    let paymentStatus = validPaymentStatuses.includes(rawPaymentStatus) ? rawPaymentStatus : "";
    if (!paymentStatus || paymentStatus === PAYMENT_STATUS.UNDEFINED) {
        paymentStatus = selectedPaymentOption === "ONLINE"
            ? PAYMENT_STATUS.PENDING_PAYMENT
            : PAYMENT_STATUS.NOT_PAID;
    }

    const amountCandidates = [
        booking?.totalAmount,
        booking?.priceDetails?.totalPrice?.value,
        booking?.priceDetails?.total?.amount,
        booking?.priceSummary?.total?.amount,
    ];
    const rawAmount = amountCandidates.find(value =>
        value !== undefined && value !== null && value !== ""
    );
    const parsedAmount = Number(rawAmount);
    const hasExactAmount = rawAmount !== undefined && Number.isFinite(parsedAmount) && parsedAmount >= 0;

    const appointmentNotes = (Array.isArray(booking?.additionalFields) ? booking.additionalFields : [])
        .filter(field => /note|nota|observaci[oó]n|comentario|comment/i.test(_safeTrim(field?.label)))
        .map(field => ({
            label: _safeTrim(field?.label).slice(0, 120),
            value: _safeTrim(field?.value).slice(0, 2000),
        }))
        .filter(field => field.value);

    const meta = {
        source: "WIX_BOOKINGS_NATIVE",
        eventId: _safeTrim(eventId) || null,
        nativeBookingTitle: _safeTrim(bookedEntity.title || bookedEntity.titleTranslated || ""),
        nativeBookingStatus: _safeTrim(booking?.status || BOOKING_STATUS.CONFIRMED).toUpperCase(),
        selectedPaymentOption,
        channelType: selectedPaymentOption === "ONLINE" ? CHANNEL_TYPE.ONLINE : CHANNEL_TYPE.PRESENCIAL,
        contactId: _safeTrim(booking?.contactDetails?.contactId || "") || null,
        amountSource: hasExactAmount ? "NATIVE_BOOKING_SNAPSHOT" : "NOT_EXPOSED_BY_BOOKINGS",
        amountReconciliationRequired: !hasExactAmount,
        nativePhasePairUnknown: true,
        staffMemberId: staffMemberId || null,
        resourceIdSource: _looksLikeGuid(_safeTrim(resource._id || resource.id || booking?.resource?._id || booking?.resource?.id || ""))
            ? "BOOKINGS_SLOT_RESOURCE"
            : (staffMemberId ? "MAPA_STAFF" : "UNRESOLVED"),
    };
    const internalBusinessNote = _safeTrim(booking?.internalBusinessNote || "").slice(0, 200);
    const formSubmissionId = _safeTrim(booking?.formSubmissionId || "");
    if (internalBusinessNote) meta.appointmentNote = internalBusinessNote;
    else if (appointmentNotes.length) {
        meta.appointmentNote = appointmentNotes
            .map(field => field.label ? field.label + ": " + field.value : field.value)
            .join(" | ")
            .slice(0, 200);
    }
    if (appointmentNotes.length) meta.appointmentNotes = appointmentNotes;
    if (formSubmissionId) meta.formSubmissionId = formSubmissionId;

    const write = await _persistBooking({
        bookingId,
        revision: Number(booking?.revision) || 1,
        serviceId,
        scheduleId,
        resourceId,
        startDate,
        endDate,
        bookingType: BOOKING_TYPE.SIMPLE,
        bookingStatus: _safeTrim(booking?.status || BOOKING_STATUS.CONFIRMED).toUpperCase(),
        paymentStatus,
        totalAmount: hasExactAmount ? parsedAmount : 0,
        contactDetails: booking?.contactDetails || {},
        meta,
        traceId,
        insertOnly: true,
    }, traceId);

    // If the custom saga inserted the richer row between our read and write,
    // insertOnly leaves it untouched. Refresh only its confirmed status.
    if (!write?.created) {
        await _updateCitaStatus(bookingId, BOOKING_STATUS.CONFIRMED, traceId);
    }
    return { ok: true, created: Boolean(write?.created), existing: !write?.created, bookingId, serviceId };
}

export async function reconcileConfirmedNativeBookingProjectionInternal(
    booking,
    traceId = makeTraceId("booking-projection-reconcile")
) {
    const bookingId = _safeTrim(booking?.id || booking?._id);
    if (!_looksLikeGuid(bookingId)) {
        return { ok: false, reason: "NATIVE_BOOKING_ID_INVALID", missing: ["bookingId"] };
    }
    if (_safeTrim(booking?.status).toUpperCase() !== BOOKING_STATUS.CONFIRMED) {
        return { ok: false, reason: "NATIVE_BOOKING_NOT_CONFIRMED", missing: ["status"] };
    }
    const paymentStatus = _safeTrim(booking?.paymentStatus).toUpperCase();
    if ([PAYMENT_STATUS.PAID, PAYMENT_STATUS.PARTIALLY_PAID, PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.PARTIALLY_REFUNDED].includes(paymentStatus)) {
        return { ok: false, reason: "NATIVE_BOOKING_PAYMENT_REQUIRES_LEDGER_RECONCILIATION", missing: ["financialLedger"] };
    }

    const eventId = `BOOKING_CONFIRMED_RECONCILED_${bookingId}`;
    const syncResult = await _syncNativeBookingToCitas(booking, eventId, traceId);
    if (!syncResult?.ok) return syncResult;

    const amountCandidates = [
        booking?.totalAmount,
        booking?.priceDetails?.totalPrice?.value,
        booking?.priceDetails?.total?.amount,
        booking?.priceSummary?.total?.amount,
    ];
    const rawAmount = amountCandidates.find((value) =>
        value !== undefined && value !== null && value !== ""
    );
    const parsedAmount = Number(rawAmount);
    const amountReconciliationRequired = rawAmount === undefined ||
        !Number.isFinite(parsedAmount) || parsedAmount < 0;

    const reconciliationDedupeKey = `WEBHOOK_${_normalizeIdPart(eventId, 100)}`;
    const existingReconciliationMarker = await dalQuery(CONTROL_OPERATIVO_COL)
        .eq("controlType", CONTROL_TYPE.WEBHOOK_EVENT)
        .eq("dedupeKey", reconciliationDedupeKey)
        .limit(1)
        .find(STRONG_READ);
    if (!(existingReconciliationMarker?.items || []).length) {
        await markEventAsProcessed(eventId, "BOOKING_CONFIRMED_RECONCILED", traceId, {
            bookingId,
            serviceId: syncResult.serviceId,
            ledgerCreated: syncResult.created,
            ledgerSource: "WIX_BOOKINGS_NATIVE_RECONCILIATION",
            amountReconciliationRequired,
        });
    }
    return {
        ok: true,
        created: Boolean(syncResult.created),
        existing: Boolean(syncResult.existing),
        bookingId,
        serviceId: syncResult.serviceId,
        amountReconciliationRequired,
    };
}

// ============================================================================
// CITA STATUS UPDATES
// ============================================================================

async function _updateCitaStatus(bookingId, newStatus, traceId) {
    return _updateCitaSafe(
        bookingId,
        (cita) => {
            if (
                String(cita[BOOKING_FIELDS.STATUS] || "").toUpperCase() ===
                String(newStatus || "").toUpperCase()
            ) {
                return null;
            }
            return {
                ...cita,
                [BOOKING_FIELDS.STATUS]: String(
                    newStatus || BOOKING_STATUS.CONFIRMED
                ).toUpperCase(),
            };
        },
        traceId,
        "events_updateCitaEstado"
    );
}

async function _markCitasRefundedByBookingIds(
    bookingIds,
    orderId,
    refundId,
    fullyRefunded,
    traceId
) {
    const { directIds, allIds: ids } = await _expandBookingIdsWithPair(bookingIds);
    const results = await Promise.allSettled(
        ids.map((bookingId) =>
            _updateCitaSafe(
                bookingId,
                (cita) => {
                    const meta = cita.meta || {};
                    const paymentState = fullyRefunded
                        ? PAYMENT_STATUS.REFUNDED
                        : PAYMENT_STATUS.PARTIALLY_REFUNDED;
                    return {
                        ...cita,
                        ...(fullyRefunded && directIds.includes(bookingId)
                            ? { [BOOKING_FIELDS.STATUS]: BOOKING_STATUS.REFUNDED }
                            : {}),
                        [BOOKING_FIELDS.PAYMENT_STATUS]: paymentState,
                        meta: {
                            ...meta,
                            paymentStatus: paymentState,
                            orderId: orderId || null,
                            refundId: refundId || null,
                            fechaReembolso: new Date(),
                        },
                    };
                },
                traceId,
                "events_markRefunded"
            )
        )
    );

    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
        log.warn("Some citas failed to update refund status", {
            traceId,
            orderId,
            totalIds: ids.length,
            failedCount: failures.length,
        });
    }
}

async function _markCitasPaidByBookingIds(bookingIds, orderId, traceId) {
    const { allIds: ids } = await _expandBookingIdsWithPair(bookingIds);
    const results = await Promise.allSettled(
        ids.map((bookingId) =>
            _updateCitaSafe(
                bookingId,
                (cita) => {
                    const meta = cita.meta || {};
                    const alreadyPaid =
                        String(
                            meta.paymentStatus || cita.paymentStatus || ""
                        ).toUpperCase() === PAYMENT_STATUS.PAID;
                    if (alreadyPaid) return null;
                    return {
                        ...cita,
                        // Payment status and booking approval are independent.
                        // Only the native BOOKING_CONFIRMED webhook may confirm
                        // an appointment; receiving payment must preserve PENDING.
                        [BOOKING_FIELDS.PAYMENT_STATUS]: PAYMENT_STATUS.PAID,
                        meta: {
                            ...meta,
                            paymentStatus: PAYMENT_STATUS.PAID,
                            orderId: orderId || null,
                            fechaConfirmacionPago: new Date(),
                        },
                    };
                },
                traceId,
                "events_markPaid"
            )
        )
    );

    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
        log.warn("Some citas failed to update payment status", {
            traceId,
            orderId,
            totalIds: ids.length,
            failedCount: failures.length,
        });
    }
    return {
        totalIds: ids.length,
        updatedCount: ids.length - failures.length,
        failedCount: failures.length,
    };
}

async function _markCitasPendingLedgerByBookingIds(bookingIds, orderId, traceId) {
    const { allIds: ids } = await _expandBookingIdsWithPair(bookingIds);
    const results = await Promise.allSettled(
        ids.map((bookingId) =>
            _updateCitaSafe(
                bookingId,
                (cita) => {
                    const meta = cita.meta || {};
                    const currentPaymentState = String(
                        meta.paymentStatus || cita.paymentStatus || ""
                    ).toUpperCase();
                    if (currentPaymentState === PAYMENT_STATUS.PAID) return null;
                    return {
                        ...cita,
                        [BOOKING_FIELDS.PAYMENT_STATUS]:
                            PAYMENT_STATUS.PENDING_LEDGER,
                        meta: {
                            ...meta,
                            paymentStatus: PAYMENT_STATUS.PENDING_LEDGER,
                            orderId: orderId || null,
                            fechaPagoRecibido: new Date(),
                        },
                    };
                },
                traceId,
                "events_markPendingLedger"
            )
        )
    );

    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
        log.warn("Some citas failed to update pending ledger status", {
            traceId,
            orderId,
            totalIds: ids.length,
            failedCount: failures.length,
        });
    }
}

/**
 * Repairs only the CitasF2 payment projection after verifying the paid Wix
 * order and its single existing ORDER ledger movement. Never creates a second
 * fiscal movement and never changes bookingStatus.
 */
export async function reconcilePaidCitasFromLedgerInternal(recoveryData, traceId = makeTraceId("payment-state-recovery")) {
    const orderId = _safeTrim(recoveryData?.orderId);
    const transactionId = _safeTrim(recoveryData?.transactionId);
    const expectedMovementId = _safeTrim(recoveryData?.cashMovementId);
    if (!orderId || transactionId !== `ORDER-${orderId}`) {
        throw new Error("PAYMENT_STATE_RECOVERY_IDENTITY_INVALID");
    }

    const orderResponse = await withTimeout(
        getOrderElevated(orderId),
        API_TIMEOUT_MS,
        "paymentStateRecovery:getOrder"
    );
    const order = orderResponse?.order || orderResponse;
    if (!order || _safeTrim(order.id || order._id) !== orderId) {
        throw new Error("PAYMENT_STATE_RECOVERY_ORDER_MISSING");
    }
    if (!["PAID", "FULLY_PAID", "PAID_FULL"].includes(String(order.paymentStatus || "").toUpperCase())) {
        throw new Error("PAYMENT_STATE_RECOVERY_ORDER_NOT_PAID");
    }

    const orderBookingIds = _normalizeBookingIds(
        (Array.isArray(order.lineItems) ? order.lineItems : [])
            .filter((item) => item?.catalogReference?.appId === WIX_CATALOG_APP_IDS.BOOKINGS)
            .map((item) => item?.catalogReference?.catalogItemId)
    );
    if (!orderBookingIds.length) throw new Error("PAYMENT_STATE_RECOVERY_BOOKING_LINES_MISSING");

    const ledgerResult = await dalQuery(MOVIMIENTOS_CAJA_COL)
        .eq("transactionId", transactionId)
        .limit(2)
        .find(STRONG_READ);
    const movements = Array.isArray(ledgerResult?.items) ? ledgerResult.items : [];
    if (movements.length !== 1) throw new Error("PAYMENT_STATE_RECOVERY_LEDGER_NOT_UNIQUE");

    const movement = movements[0];
    const movementId = _safeTrim(movement?._id);
    if (!movementId || (expectedMovementId && movementId !== expectedMovementId)) {
        throw new Error("PAYMENT_STATE_RECOVERY_LEDGER_REFERENCE_MISMATCH");
    }
    if (_safeTrim(movement?.orderId) !== orderId) {
        throw new Error("PAYMENT_STATE_RECOVERY_LEDGER_ORDER_MISMATCH");
    }
    if (_safeTrim(movement?.paymentMethod).toUpperCase() !== PAYMENT_METHOD.WIX_PAYMENTS) {
        throw new Error("PAYMENT_STATE_RECOVERY_LEDGER_METHOD_MISMATCH");
    }

    const expectedAmount = resolveOrderLedgerAmount(order);
    const movementAmount = Number(movement?.totalAmount ?? movement?.accountingAmount);
    if (!Number.isFinite(expectedAmount) || !Number.isFinite(movementAmount) ||
        Math.abs(Math.round(expectedAmount * 100) - Math.round(movementAmount * 100)) > 1) {
        throw new Error("PAYMENT_STATE_RECOVERY_LEDGER_AMOUNT_MISMATCH");
    }

    const linkedIds = Array.isArray(movement?.linkedBookingIds)
        ? movement.linkedBookingIds.map((value) => _safeTrim(value)).filter(Boolean)
        : _safeTrim(movement?.linkedBookingIds).split(",").map((value) => _safeTrim(value)).filter(Boolean);
    if (orderBookingIds.some((bookingId) => !linkedIds.includes(bookingId))) {
        throw new Error("PAYMENT_STATE_RECOVERY_LEDGER_BOOKING_LINK_MISMATCH");
    }

    const sync = await _markCitasPaidByBookingIds(orderBookingIds, orderId, traceId);
    if (sync.failedCount > 0 || sync.updatedCount !== sync.totalIds) {
        throw new Error("PAYMENT_STATE_RECOVERY_CITAS_UPDATE_INCOMPLETE");
    }
    return {
        orderId,
        transactionId,
        cashMovementId: movementId,
        bookingIds: orderBookingIds,
        updatedCount: sync.updatedCount,
    };
}

// ============================================================================
// WEBHOOK: BOOKING CONFIRMED
// ============================================================================

export async function wixBookingsV2_onBookingConfirmed(rawBody) {
    const traceId = makeTraceId("whook-conf");
    try {
        const event = await _verifyAndDecodeWebhook(
            rawBody,
            "BOOKING_CONFIRMED"
        );
        if (!event) return { status: "REJECTED", reason: "JWT_VERIFICATION_FAILED" };

        // Wix Editor Velo Bookings V2 backend events expose metadata + data.booking.
        // SDK event callback payloads may expose metadata + entity.
        const { eventId, bookingId, booking } = _normalizeBookingsEvent(event);
        const valid = Boolean(eventId && bookingId && _safeTrim(booking?.status || ""));
        if (!valid) {
            log.warn("EVENT_INVALID_STRUCTURE_REJECTED", { eventId, bookingId });
            throw new Error("INVALID_BOOKING_CONFIRMED_EVENT");
        }

        const alreadyProcessed = await isEventProcessed(eventId);
        if (alreadyProcessed && bookingId !== "unknown") {
            const existingLedger = await dalQuery(CITAS_COL)
                .eq(BOOKING_FIELDS.BOOKING_ID, bookingId)
                .limit(1)
                .find(STRONG_READ)
                .catch(() => null);
            if (existingLedger?.items?.length) {
                log.info("EVENT_DUPLICATE_IGNORED", {
                    eventId,
                    eventType: "BOOKING_CONFIRMED",
                });
                return { status: "OK", duplicate: true };
            }
            // Older handler versions could mark an event processed even when
            // its CitasF2 row was missing. A replay now repairs that gap.
            log.warn("BOOKING_CONFIRMED_LEDGER_REPAIR", { eventId, bookingId, traceId });
        }

        const syncResult = await _syncNativeBookingToCitas(booking, eventId, traceId);
        if (!syncResult.ok) {
            log.error("BOOKING_CONFIRMED_LEDGER_SYNC_FAILED", {
                eventId,
                bookingId,
                traceId,
                reason: syncResult.reason,
                missing: syncResult.missing,
            });
            const syncError = new Error(syncResult.reason || "BOOKING_CONFIRMED_LEDGER_SYNC_FAILED");
            syncError.details = { missing: syncResult.missing || [] };
            throw syncError;
        }
        if (!alreadyProcessed) {
            await markEventAsProcessed(eventId, "BOOKING_CONFIRMED", traceId, {
                bookingId,
                serviceId: syncResult.serviceId,
                ledgerCreated: syncResult.created,
                ledgerSource: syncResult.created ? "WIX_BOOKINGS_NATIVE" : "EXISTING_CITASF2",
            });
        }
        return { status: "OK", eventId, ledgerCreated: syncResult.created };
    } catch (error) {
        _handleError(error, "wixBookingsV2_onBookingConfirmed", traceId);
        throw error;
    }
}

// ============================================================================
// WEBHOOK: BOOKING CANCELED (ALN-03: BOOKING_STATUS.CANCELED)
// ============================================================================

export function buildCancellationRectificationTransactionId(pairToken, bookingId) {
    const token = _safeTrim(pairToken);
    return token ? `RECT-PAIR-${token}` : `RECT-${_safeTrim(bookingId)}`;
}

async function _upsertDualCancellationFlag(pairToken, traceId, triggerBookingId, fiscalStatus = "NOT_REQUIRED") {
    const token = _safeTrim(pairToken);
    if (!token) return { status: "NOT_DUAL" };

    const pairRes = await dalQuery(CITAS_COL)
        .eq("pairToken", token)
        .limit(3)
        .find(STRONG_READ);
    const rows = pairRes?.items || [];
    const bookingIds = _normalizeBookingIds(rows.map((row) => row?.bookingId));
    const allCanceled = rows.length === 2 && rows.every((row) => {
        const status = String(row?.bookingStatus || "").toUpperCase();
        return status === "CANCELED";
    });
    const flagId = `DUAL_CANCEL_${token.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64)}`;
    const fiscalPending = ["REPAIR_REQUIRED", "WAITING_FOR_SIBLING_CANCELLATION", "RECOVERY_QUEUED"].includes(fiscalStatus);
    const resolved = allCanceled && !fiscalPending;
    const status = resolved ? "RESOLVED" : "REPAIR_REQUIRED";
    const flag = {
        _id: flagId,
        controlType: CONTROL_TYPE.SYSTEM_FLAG,
        dedupeKey: `DUAL_CANCELLATION_${token}`,
        status,
        alertType: "DUAL_BOOKING_CANCELLATION_MISMATCH",
        severity: resolved ? "INFO" : "ERROR",
        message: resolved
            ? "Ambas fases de la reserva dual y su estado fiscal estan conciliados."
            : "La reserva dual o su rectificacion fiscal requiere conciliacion manual.",
        payload: {
            pairToken: token,
            fiscalStatus,
            bookingIds,
            bookingStatuses: rows.map((row) => ({
                bookingId: row?.bookingId || null,
                status: row?.bookingStatus || null,
            })),
            triggerBookingId: _safeTrim(triggerBookingId),
            reason: rows.length === 2 ? "DUAL_PHASE_CANCELLATION_MISMATCH" : "DUAL_PAIR_CARDINALITY_INVALID",
            detectedAt: new Date().toISOString(),
            resolution: resolved
                ? "BOTH_PHASES_CANCELED_AND_FISCALLY_RECONCILED"
                : "Review native Wix Bookings status, cancellation policy and fiscal ledger; do not auto-cancel or refund the sibling phase without policy approval.",
        },
        traceId,
        processedAt: resolved ? new Date() : null,
        _updatedDate: new Date(),
    };
    const existing = await dalGet(CONTROL_OPERATIVO_COL, flagId, "strong");
    if (existing) {
        await dalUpdate(CONTROL_OPERATIVO_COL, {
            ...existing,
            ...flag,
            _id: flagId,
            _createdDate: existing._createdDate,
        });
    } else {
        await dalInsert(CONTROL_OPERATIVO_COL, {
            ...flag,
            _createdDate: new Date(),
        });
    }
    return { status, bookingIds, rows };
}



// ============================================================================
// BOOKING RESCHEDULED
// ============================================================================

/**
 * Reconcile reschedules performed through native Wix Bookings surfaces.
 *
 * A custom dual booking is represented by two independent Wix bookings. The
 * native Members Area can reschedule one of them without knowing CitasF2's
 * pairToken. Update only the booking Wix actually rescheduled and open a
 * repair alert for its sibling; never move the sibling without availability
 * validation and the dual-reschedule journal/lock protocol.
 */
export async function wixBookingsV2_onBookingRescheduled(rawBody) {
    const traceId = makeTraceId("whook-reschedule");
    try {
        const event = await _verifyAndDecodeWebhook(rawBody, "BOOKING_RESCHEDULED");
        if (!event) {
            return { status: "REJECTED", reason: "JWT_VERIFICATION_FAILED" };
        }

        const { eventId, bookingId, booking } = _normalizeBookingsEvent(event);
        const slot = booking?.bookedEntity?.slot || {};
        const startRaw = booking?.startDate || slot.startDate;
        const endRaw = booking?.endDate || slot.endDate;
        const startDate = _toDateSafe(startRaw);
        const endDate = _toDateSafe(endRaw);
        if (
            !eventId ||
            !_looksLikeGuid(bookingId) ||
            !startDate ||
            !endDate ||
            Number.isNaN(startDate.getTime()) ||
            Number.isNaN(endDate.getTime()) ||
            endDate.getTime() <= startDate.getTime()
        ) {
            log.warn("BOOKING_RESCHEDULED_INVALID_EVENT", { eventId, bookingId, traceId });
            throw new Error("INVALID_BOOKING_RESCHEDULED_EVENT");
        }

        const existing = await dalQuery(CITAS_COL)
            .eq(BOOKING_FIELDS.BOOKING_ID, bookingId)
            .limit(1)
            .find(STRONG_READ);
        const currentCita = existing?.items?.[0] || null;
        if (!currentCita) {
            // Do not create an incomplete payment/fiscal projection from a
            // reschedule-only event. Retry until the canonical booking row exists.
            throw new Error("RESCHEDULED_BOOKING_CITASF2_NOT_FOUND");
        }

        const incomingRevision = Number(booking?.revision);
        const currentRevision = Number(currentCita?.revision);
        if (
            Number.isFinite(incomingRevision) &&
            incomingRevision > 0 &&
            Number.isFinite(currentRevision) &&
            currentRevision > incomingRevision
        ) {
            const alreadyProcessed = await isEventProcessed(eventId);
            if (!alreadyProcessed) {
                await markEventAsProcessed(eventId, "BOOKING_RESCHEDULED", traceId, {
                    bookingId,
                    staleRevision: incomingRevision,
                    currentRevision,
                });
            }
            return { status: "OK", stale: true, bookingId };
        }

        const resourceId = _safeTrim(
            slot?.resource?._id || slot?.resource?.id ||
            booking?.resource?._id || booking?.resource?.id || currentCita.resourceId
        );
        const scheduleId = _safeTrim(
            slot?.scheduleId || slot?.resource?.scheduleId || currentCita.scheduleId
        );
        const serviceId = _safeTrim(
            slot?.serviceId || booking?.serviceId || currentCita.serviceId
        );
        const startLocal = getMadridLocalStringNoZ(startDate);
        const dateYmd = startLocal ? startLocal.slice(0, 10) : "";
        const missingSlotFields = [];
        if (!_looksLikeGuid(resourceId)) missingSlotFields.push("resourceId");
        if (!_looksLikeGuid(scheduleId)) missingSlotFields.push("scheduleId");
        if (!_looksLikeGuid(serviceId)) missingSlotFields.push("serviceId");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) missingSlotFields.push("dateYmd");
        if (missingSlotFields.length > 0) {
            log.warn("BOOKING_RESCHEDULED_SLOT_PROJECTION_INCOMPLETE", {
                bookingId, missingSlotFields, traceId,
            });
            const slotError = new Error("RESCHEDULED_BOOKING_SLOT_PROJECTION_INCOMPLETE");
            slotError.details = { bookingId, missingSlotFields };
            throw slotError;
        }

        const updateResult = await _updateCitaSafe(
            bookingId,
            (cita) => {
                const sameSlot =
                    new Date(cita.slotStart).getTime() === startDate.getTime() &&
                    new Date(cita.slotEnd).getTime() === endDate.getTime() &&
                    _safeTrim(cita.resourceId) === resourceId &&
                    _safeTrim(cita.scheduleId) === scheduleId &&
                    _safeTrim(cita.serviceId) === serviceId;
                if (
                    sameSlot &&
                    (!Number.isFinite(incomingRevision) || incomingRevision <= Number(cita.revision || 0))
                ) {
                    return null;
                }
                return {
                    ...cita,
                    serviceId,
                    resourceId,
                    scheduleId,
                    slotStart: startDate,
                    slotEnd: endDate,
                    dateYmd,
                    revision: Number.isFinite(incomingRevision) && incomingRevision > 0
                        ? incomingRevision
                        : cita.revision,
                };
            },
            traceId,
            "events_nativeBookingRescheduled"
        );
        if (!updateResult.updated && updateResult.reason !== "NO_CHANGE") {
            throw new Error("RESCHEDULED_BOOKING_CITASF2_UPDATE_FAILED");
        }

        const pairToken = _safeTrim(currentCita.pairToken || currentCita.meta?.pairToken);
        let pairRepairRequired = false;
        let pairedBookingIds = [bookingId];
        if (pairToken) {
            const pairResult = await dalQuery(CITAS_COL)
                .eq(BOOKING_FIELDS.PAIR_TOKEN, pairToken)
                .limit(3)
                .find(STRONG_READ);
            const pairRows = pairResult?.items || [];
            pairedBookingIds = _normalizeBookingIds(pairRows.map((row) => row.bookingId));
            pairRepairRequired = true;
            const alert = await notifyOperationalAlert({
                alertType: "DUAL_BOOKING_NATIVE_RESCHEDULE_MISMATCH",
                severity: "CRITICAL",
                message: "A native Wix Members reschedule changed one phase of a dual booking; reconcile the sibling through the controlled dual-reschedule flow.",
                data: {
                    pairToken,
                    bookingId,
                    pairedBookingId: pairedBookingIds.find((id) => id !== bookingId) || null,
                    pairRowCount: pairRows.length,
                    eventId,
                    newStart: startDate.toISOString(),
                    newEnd: endDate.toISOString(),
                    actionRequired: "RECONCILE_SIBLING_WITH_DUAL_RESCHEDULE_JOURNAL",
                },
                traceId,
                entityId: pairToken,
                source: "WIX_BOOKINGS_RESCHEDULE_WEBHOOK",
                dedupeKey: "DUAL_NATIVE_RESCHEDULE_" + pairToken + "_" + bookingId,
            });
            if (alert.failed) {
                throw new Error("DUAL_RESCHEDULE_REPAIR_ALERT_FAILED");
            }
        }

        const alreadyProcessed = await isEventProcessed(eventId);
        if (!alreadyProcessed) {
            await markEventAsProcessed(eventId, "BOOKING_RESCHEDULED", traceId, {
                bookingId,
                pairToken: pairToken || null,
                pairRepairRequired,
                bookingIds: pairedBookingIds,
                revision: Number.isFinite(incomingRevision) ? incomingRevision : null,
            });
        }

        log.warn("NATIVE_BOOKING_RESCHEDULED_RECONCILED", {
            bookingId,
            pairToken: pairToken || null,
            pairRepairRequired,
            eventId,
            traceId,
        });
        return {
            status: "OK",
            bookingId,
            pairRepairRequired,
            bookingIds: pairedBookingIds,
            updated: updateResult.updated,
        };
    } catch (error) {
        _handleError(error, "wixBookingsV2_onBookingRescheduled", traceId);
        throw error;
    }
}


export async function wixBookingsV2_onBookingCanceled(rawBody) {
    const traceId = makeTraceId("whook-cancel");
    try {
        const event = await _verifyAndDecodeWebhook(rawBody, "BOOKING_CANCELED");
        if (!event) return { status: "REJECTED", reason: "JWT_VERIFICATION_FAILED" };

        // Wix Editor Velo Bookings V2 backend events expose metadata + data.booking.
        // SDK event callback payloads may expose metadata + entity.
        const { eventId, bookingId, booking } = _normalizeBookingsEvent(event);
        let serviceId = _safeTrim(booking?.bookedEntity?.slot?.serviceId || booking?.serviceId || "");
        const valid = Boolean(eventId && bookingId);
        if (!valid) {
            log.warn("EVENT_INVALID_STRUCTURE_REJECTED", { eventId });
            throw new Error("INVALID_BOOKING_CANCELED_EVENT");
        }

        const alreadyProcessed = await isEventProcessed(eventId);
        if (alreadyProcessed) {
            // Do not silently skip a replay when CMS status is stale.
            // Reconcile status below; fiscal writes remain idempotent by transactionId.
            log.info("BOOKING_CANCELED_REPLAY_RECONCILIATION", {
                eventId,
                bookingId,
            });
        }

        // Si la cita previa estaba PAID, generar rectificativa
        const previousCita = await dalQuery(CITAS_COL)
            .eq("bookingId", bookingId)
            .limit(1)
            .find(STRONG_READ)
            .then((r) => r?.items?.[0] || null);

        const pairToken = _safeTrim(previousCita?.pairToken);
        let dualPairFullyCancelled = false;
        let dualPairBookingIds = [bookingId];
        let dualFiscalStatus = pairToken ? "WAITING_FOR_SIBLING_CANCELLATION" : "NOT_DUAL";
        if (pairToken) {
            const pairRes = await dalQuery(CITAS_COL)
                .eq("pairToken", pairToken)
                .limit(3)
                .find(STRONG_READ);
            const pairRows = pairRes?.items || [];
            const effectiveRows = pairRows.map((row) => row.bookingId === bookingId
                ? { ...row, bookingStatus: "CANCELED" }
                : row);
            dualPairBookingIds = _normalizeBookingIds(effectiveRows.map((row) => row.bookingId));
            dualPairFullyCancelled = effectiveRows.length === 2 && effectiveRows.every((row) => {
                const status = String(row?.bookingStatus || "").toUpperCase();
                return status === "CANCELED";
            });
            if (dualPairFullyCancelled) dualFiscalStatus = "NOT_REQUIRED";
        }

        if (
            previousCita &&
            String(previousCita.paymentStatus || "").toUpperCase() === PAYMENT_STATUS.PAID &&
            (!pairToken || dualPairFullyCancelled)
        ) {
            const pairOrderId = pairToken
                ? _safeTrim(previousCita.orderId || null)
                : null;
            const originalMovementQuery = dalQuery(MOVIMIENTOS_CAJA_COL)
                .eq("movementType", MOVEMENT_TYPE.VENTA_ONLINE);
            if (pairOrderId) {
                originalMovementQuery.eq("orderId", pairOrderId);
            } else if (pairToken) {
                originalMovementQuery.hasSome("linkedBookingIds", dualPairBookingIds);
            } else {
                originalMovementQuery.eq("linkedBookingIds", bookingId);
            }
            const originalMovementRes = await originalMovementQuery
                .limit(2)
                .find(STRONG_READ);

            const originalMovement = originalMovementRes?.items?.length === 1
                ? originalMovementRes.items[0]
                : null;
            const rectificationTransactionId = buildCancellationRectificationTransactionId(pairToken, bookingId);
            const rectificationBookingIds = pairToken ? dualPairBookingIds : [bookingId];

            if (originalMovement) {
                try {
                    const emisor = await _getEmisorFiscal();
                    const amountOriginal = Math.abs(
                        Number(originalMovement.totalAmount ?? 0)
                    );

                    const eventResult = await registrarEventoEconomico({
                        eventType: EVENT_TYPE.RECTIFICATIVA,
                        movementType: MOVEMENT_TYPE.REEMBOLSO,
                        paymentMethod:
                            originalMovement.paymentMethod ||
                            LEDGER_PAYMENT_METHOD_ONLINE,
                        totalAmount: -amountOriginal,
                        taxBase: -Math.abs(readTaxBase(originalMovement)),
                        taxAmount: -Math.abs(readTaxAmount(originalMovement)),
                        tipoImpositivo: Number(
                            readMovementField(originalMovement, "tipoImpositivo") ?? 21
                        ),
                        operationDescription: pairToken
                            ? `Rectificacion cancelacion reserva dual ${pairToken}`
                            : `Rectificacion cancelacion booking ${bookingId}`,
                        // SSOT Apartado 5 (claves canonicas literales): el doc
                        // original ya esta normalizado (HOOK-CAJA-06); los
                        // helpers leen dual por movimientos pre-migracion.
                        numSerieFactura: readInvoiceNumber(originalMovement),
                        fechaExpedicionFactura: new Date().toLocaleDateString(
                            "sv-SE",
                            {
                                timeZone:
                                    SDK_CONFIG?.TZ || "Europe/Madrid",
                            }
                        ),
                        tipoFactura: TIPO_FACTURA.R1,
                        tipoRectificativa: "I",
                        previousInvoiceId:
                            readInvoiceNumber(originalMovement) || null,
                        previousInvoiceNumber:
                            readInvoiceNumber(originalMovement) || null,
                        previousInvoiceIssueDate:
                            readInvoiceIssueDate(originalMovement) || null,
                        // ALN-09: enum v12.0 no tiene NUMERO_SERIE. Se usa OTRAS.
                        correctionReason: CORRECTION_REASON.OTRAS,
                        nifEmisor: emisor.nifEmisor,
                        issuerLegalName: emisor.issuerLegalName,
                        nifDestinatario:
                            readRecipientTaxId(originalMovement) || null,
                        recipientLegalName:
                            originalMovement.recipientLegalName || null,
                        fiscalRole: FISCAL_ROLE.EMISOR,
                        channelType: "ONLINE",
                        linkedBookingIds: rectificationBookingIds,
                        transactionId: rectificationTransactionId,
                        orderId: originalMovement.orderId || null,
                        traceId,
                    });

                    if (
                        eventResult.status !== "SUCCESS" &&
                        eventResult.status !== "PARTIAL"
                    ) {
                        throw new Error(
                            eventResult.error?.message ||
                                "EVENTLOG_RECT_FAIL"
                        );
                    }
                    dualFiscalStatus = "RECTIFIED";
                } catch (rectErr) {
                    log.error(
                        "Rectification ledger failed; queuing recovery",
                        {
                            bookingId,
                            traceId,
                            error: rectErr?.message,
                        }
                    );
                    const recovery = await queueFiscalRecovery({
                        kind: "FISCAL_LEDGER",
                        bookingIds: rectificationBookingIds,
                        totalAmount: -Math.abs(
                            Number(originalMovement.totalAmount || 0)
                        ),
                        paymentMethod:
                            originalMovement.paymentMethod ||
                            LEDGER_PAYMENT_METHOD_ONLINE,
                        transactionId: rectificationTransactionId,
                        orderId: originalMovement.orderId || null,
                        origin: "WIX_BOOKINGS_CANCEL_WEBHOOK",
                        operationDescription: pairToken
                            ? `Rectificacion cancelacion reserva dual ${pairToken}`
                            : `Rectificacion cancelacion booking ${bookingId}`,
                        resourceId: "online",
                        movementType: MOVEMENT_TYPE.REEMBOLSO,
                        traceId,
                        lastError: rectErr?.message || "RECT_FAIL",
                    });
                    if (!recovery?.queued) {
                        throw new Error("FISCAL_RECOVERY_QUEUE_FAILED");
                    }
                    dualFiscalStatus = pairToken ? "RECOVERY_QUEUED" : dualFiscalStatus;
                }
            } else if (pairToken) {
                dualFiscalStatus = "REPAIR_REQUIRED";
                log.error("DUAL_CANCELLATION_ORIGINAL_LEDGER_MISSING_OR_AMBIGUOUS", {
                    pairToken,
                    orderId: pairOrderId || null,
                    bookingIds: dualPairBookingIds,
                    matches: originalMovementRes?.items?.length || 0,
                    traceId,
                });
            }
        } else if (pairToken && previousCita &&
            String(previousCita.paymentStatus || "").toUpperCase() === PAYMENT_STATUS.PAID) {
            dualFiscalStatus = "WAITING_FOR_SIBLING_CANCELLATION";
        }

        if (!_looksLikeGuid(serviceId)) {
            const citaResult = await dalQuery(CITAS_COL)
                .eq(BOOKING_FIELDS.BOOKING_ID, bookingId)
                .limit(1)
                .find(STRONG_READ);
            serviceId = _safeTrim(citaResult?.items?.[0]?.serviceId || "");
        }

        // ALN-03: enum Wix nativo es CANCELED (una L).
        const statusUpdate = await _updateCitaStatus(bookingId, BOOKING_STATUS.CANCELED, traceId);
        if (!statusUpdate?.updated && statusUpdate?.reason !== "NO_CHANGE") {
            throw new Error("CITASF2_CANCEL_SYNC_FAILED:" + (statusUpdate?.reason || "UNKNOWN"));
        }
        let dualCancellationState = { status: "NOT_DUAL" };
        if (pairToken) {
            dualCancellationState = await _upsertDualCancellationFlag(pairToken, traceId, bookingId, dualFiscalStatus);
        }
        await markEventAsProcessed(eventId, "BOOKING_CANCELED", traceId, {
            bookingId,
            serviceId,
            pairToken: pairToken || null,
            dualCancellationState: dualCancellationState.status,
            dualFiscalStatus,
        });
        return { status: "OK", eventId, dualCancellationState: dualCancellationState.status, dualFiscalStatus };
    } catch (error) {
        _handleError(error, "wixBookingsV2_onBookingCanceled", traceId);
        throw error;
    }
}

async function _syncPaidOrderInventoryOrThrow(order, traceId, eventId) {
    const result = await syncPaidOrderInventoryInternal(order, traceId, eventId);
    if (result?.status === "PARTIAL" &&
        Array.isArray(result.data?.results) &&
        result.data.results.filter((item) => item.status === "ERROR").every((item) => item.repairQueued === true)) {
        log.warn("INVENTORY_SYNC_QUEUED_FOR_REPAIR", {
            orderId: order?._id || order?.id || null,
            traceId,
            eventId: eventId || null,
            failedLines: result.data.results.filter((item) => item.status === "ERROR").length,
        });
        return result;
    }
    if (result?.status !== "SUCCESS") {
        log.error("INVENTORY_SYNC_RETRY_REQUIRED", {
            orderId: order?._id || order?.id || null,
            traceId,
            eventId: eventId || null,
            result,
        });
        const error = new Error("INVENTORY_REPAIR_QUEUE_FAILED");
        error.code = "INVENTORY_REPAIR_QUEUE_FAILED";
        throw error;
    }
    return result;
}

// ============================================================================
// WEBHOOK: ORDER CREATED — reserve stock in CMS after native checkout reserve
// ============================================================================

export async function wixEcom_onOrderCreated(rawBody) {
    const traceId = makeTraceId("whook-order-created");
    try {
        const event = await _verifyAndDecodeWebhook(rawBody, "ORDER_CREATED");
        if (!event) return { status: "REJECTED", reason: "JWT_VERIFICATION_FAILED" };
        const order = event?.order || event?.data?.order || event;
        const orderId = _safeTrim(order?._id || order?.id);
        if (!_looksLikeGuid(orderId)) return { status: "OK", skipped: "ORDER_ID_MISSING" };
        const eventId = _safeTrim(event?.eventId || event?._id || event?.metadata?.id) || `order-created-${orderId}`;
        if (await isEventProcessed(eventId)) return { status: "OK", duplicate: true };
        if (await isOrderCreatedReconciled(orderId)) {
            return { status: "OK", reconciled: true, orderId };
        }

        const result = await reserveOrderInventoryInternal(order, traceId, eventId);
        if (result.status === "PARTIAL") {
            const failed = result.data?.results?.filter((item) => item.status === "ERROR") || [];
            if (!failed.length || failed.some((item) => item.repairQueued !== true)) {
                throw new Error("INVENTORY_REPAIR_QUEUE_FAILED");
            }
        } else if (result.status !== "SUCCESS") {
            throw new Error("INVENTORY_RESERVATION_FAILED");
        }

        await markEventAsProcessed(eventId, "ORDER_CREATED", traceId, {
            orderId,
            inventoryStatus: result.status,
            queuedRepairs: result.data?.results?.filter((item) => item.repairQueued).length || 0,
        });
        return { status: "OK", eventId, inventoryStatus: result.status };
    } catch (error) {
        _handleError(error, "wixEcom_onOrderCreated", traceId);
        // Wix event delivery is asynchronous and at least once, so handlers
        // must remain idempotent. Do not report failed persistence as success;
        // the scheduled native-order reconciler provides independent recovery.
        throw error;
    }
}

// ============================================================================
// WEBHOOK: ORDER PAYMENT STATUS UPDATED
// ============================================================================

export async function wixEcom_onOrderPaymentStatusUpdated(rawBody) {
    const traceId = makeTraceId("whook-pay-status");
    try {
        const event = await _verifyAndDecodeWebhook(
            rawBody,
            "ORDER_PAYMENT_STATUS_UPDATED"
        );
        if (!event) return { status: "REJECTED", reason: "JWT_VERIFICATION_FAILED" };

        const eventId = event?.metadata?.id || event?.id || event?.eventId || event?._id;
        if (eventId) {
            const alreadyProcessed = await isEventProcessed(eventId);
            if (alreadyProcessed) {
                log.info("EVENT_DUPLICATE_IGNORED", {
                    eventId,
                    eventType: "ORDER_PAYMENT_STATUS_UPDATED",
                });
                return { status: "OK", duplicate: true };
            }
        }

        const orderSource =
            event?.actionEvent?.body?.order ||
            event?.order ||
            event?.data?.order ||
            event?.entity ||
            event ||
            {};
        const orderId = String(
            orderSource?._id ||
            orderSource?.id ||
            event?.entityId ||
            event?.data?.entityId ||
            event?.actionEvent?.body?.orderId ||
            ""
        ).trim();
        const order = {
            ...orderSource,
            _id: orderSource?._id || orderSource?.id || orderId,
        };
        if (!orderId || orderId === "unknown") {
            log.warn("PAYMENT_WEBHOOK_MISSING_ORDER_ID", {
                traceId,
                eventId,
            });
            return { status: "OK" };
        }

        const paymentStatusRaw = order.paymentStatus || "";
        const paymentStatus = String(paymentStatusRaw).toUpperCase();
        const isPaidStatus = [
            "PAID",
            "FULLY_PAID",
            "PAID_FULL",
        ].includes(paymentStatus);
        if (!isPaidStatus) return { status: "OK" };

        const lineItems = Array.isArray(order.lineItems)
            ? order.lineItems
            : [];

        const bookingsAppId = WIX_CATALOG_APP_IDS.BOOKINGS;
        const bookingLineItems = lineItems.filter(
            (item) => item?.catalogReference?.appId === bookingsAppId
        );
        const bookingIds = _normalizeBookingIds(
            bookingLineItems.map(
                (item) => item?.catalogReference?.catalogItemId
            )
        );
        const linkedBookingIds = bookingIds.join(",");

        const finalLedgerAmount = resolveOrderLedgerAmount(order);
        const transactionId = `ORDER-${orderId}`;

        const existingLedgerRes = await withTimeout(
            dalQuery(MOVIMIENTOS_CAJA_COL)
                .eq("transactionId", transactionId)
                .limit(1)
                .find(STRONG_READ),
            API_TIMEOUT_MS,
            "checkExistingLedgerPreflight"
        ).catch(() => ({ items: [] }));

        if (existingLedgerRes?.items?.length > 0) {
            // Recover a possible interruption after fiscal movement insertion.
            // The cash-register projection deduplicates by persisted movement ID.
            await updateCajaActualFromMovement(existingLedgerRes.items[0], traceId);
            await _syncPaidOrderInventoryOrThrow(order, traceId, eventId);
            if (bookingIds.length) {
                try {
                    await _executeWithRetry(async () => {
                        const sync = await _markCitasPaidByBookingIds(
                            bookingIds,
                            orderId,
                            traceId
                        );
                        if (sync.failedCount > 0 || sync.updatedCount !== sync.totalIds) {
                            throw new Error("PAYMENT_STATE_UPDATE_INCOMPLETE");
                        }
                    }, WEBHOOK_RETRIES, WEBHOOK_RETRY_DELAY_MS);
                } catch (stateError) {
                    const alert = await notifyOperationalAlert({
                        alertType: "PAYMENT_STATE_UPDATE_REQUIRED",
                        severity: "ERROR",
                        message: "Wix payment and fiscal ledger are recorded; booking payment projection requires recovery.",
                        data: {
                            orderId,
                            transactionId,
                            bookingIds: bookingIds.join(","),
                            reasonCode: "PAYMENT_STATE_UPDATE_INCOMPLETE",
                        },
                        traceId,
                        entityId: orderId,
                        source: "backend/events.js",
                        dedupeKey: `PAYMENT_STATE_${orderId}`,
                    });
                    if (alert?.failed) throw new Error("PAYMENT_STATE_RECOVERY_ALERT_PERSISTENCE_FAILED");
                    log.error("PAYMENT_STATE_UPDATE_REQUIRED", {
                        orderId,
                        transactionId,
                        error: stateError?.message || "UNKNOWN",
                        traceId,
                    });
                }
            }
            if (eventId) {
                await markEventAsProcessed(
                    eventId,
                    "ORDER_PAYMENT_STATUS_UPDATED",
                    traceId,
                    { orderId, idempotent: true }
                );
            }
            return { status: "OK" };
        }

        if (bookingIds.length) {
            await _executeWithRetry(async () => {
                await _markCitasPendingLedgerByBookingIds(
                    bookingIds,
                    orderId,
                    traceId
                );
            }, WEBHOOK_RETRIES, WEBHOOK_RETRY_DELAY_MS);
        }

        if (finalLedgerAmount <= 0) {
            await _syncPaidOrderInventoryOrThrow(order, traceId, eventId);
            if (bookingIds.length) {
                await _executeWithRetry(async () => {
                    await _markCitasPaidByBookingIds(
                        bookingIds,
                        orderId,
                        traceId
                    );
                }, WEBHOOK_RETRIES, WEBHOOK_RETRY_DELAY_MS);
            }
            if (eventId) {
                await markEventAsProcessed(
                    eventId,
                    "ORDER_PAYMENT_STATUS_UPDATED",
                    traceId,
                    { orderId, zeroAmount: true }
                );
            }
            return { status: "OK" };
        }

        const orderConcept =
            bookingIds.length > 0
                ? lineItems.length > bookingIds.length
                    ? `Pedido Mixto Cita + Tienda ${orderId}`
                    : `Reserva Online ${orderId}`
                : `Venta Online Tienda ${orderId}`;

        const fiscalData = _extractFiscalDataFromOrder(order);
        let fiscalTaxData;
        try {
            fiscalTaxData = resolveOrderFiscalTaxData(order);
        } catch (taxError) {
            const alert = await notifyOperationalAlert({
                alertType: "FISCAL_TAX_DATA_INCOMPLETE",
                severity: "CRITICAL",
                message: "Wix order is paid but its authoritative tax breakdown cannot be reconciled.",
                data: {
                    orderId,
                    transactionId: `ORDER-${orderId}`,
                    amount: finalLedgerAmount,
                    reasonCode: String(taxError?.message || "FISCAL_TAX_DATA_INVALID").slice(0, 100),
                },
                traceId,
                entityId: orderId,
                source: "backend/events.js",
                dedupeKey: `FISCAL_TAX_DATA_${orderId}`,
            });
            if (alert?.failed) throw new Error("FISCAL_TAX_ALERT_PERSISTENCE_FAILED");
            if (bookingIds.length) {
                await _markCitasPendingLedgerByBookingIds(bookingIds, orderId, traceId);
            }
            if (eventId) {
                await markEventAsProcessed(eventId, "ORDER_PAYMENT_STATUS_UPDATED", traceId, {
                    orderId,
                    fiscalStatus: "MANUAL_REVIEW_REQUIRED",
                });
            }
            return { status: "OK", fiscalStatus: "MANUAL_REVIEW_REQUIRED" };
        }
        const emisor = await _getEmisorFiscal();

        let eventResult;
        try {
            eventResult = await registrarEventoEconomico({
                eventType: EVENT_TYPE.VENTA_LINEA,
                movementType: MOVEMENT_TYPE.VENTA_ONLINE,
                // ALN-06: WIX_PAYMENTS es el canonico v12.0.
                paymentMethod: LEDGER_PAYMENT_METHOD_ONLINE,
                channelType: "ONLINE",
                resourceId: "online",
                totalAmount: finalLedgerAmount,
                taxBase: fiscalTaxData.taxBase,
                taxAmount: fiscalTaxData.taxAmount,
                tipoImpositivo: fiscalTaxData.tipoImpositivo,
                irpfWithholdingAmount: fiscalData.irpfWithholdingAmount,
                irpfWithholdingRate: fiscalData.irpfWithholdingRate,
                withholdingBase: fiscalData.withholdingBase,
                operationDescription: orderConcept,
                numSerieFactura: null,
                fechaExpedicionFactura: new Date().toLocaleDateString("sv-SE", {
                    timeZone: SDK_CONFIG?.TZ || "Europe/Madrid",
                }),
                // ALN-04: TIPO_FACTURA
                tipoFactura: fiscalData.isB2B
                    ? TIPO_FACTURA.F1
                    : TIPO_FACTURA.F2,
                nifEmisor: emisor.nifEmisor,
                issuerLegalName: emisor.issuerLegalName,
                nifDestinatario: fiscalData.nifDestinatario,
                recipientLegalName: fiscalData.recipientLegalName,
                recipientAddress: fiscalData.recipientAddress,
                isB2B: fiscalData.isB2B,
                bankReconciliationReference:
                    fiscalData.bankReconciliationReference,
                fiscalRole: fiscalData.fiscalRole || FISCAL_ROLE.EMISOR,
                // ALN-05: constante local
                vatAccrualStatus: VAT_ACCRUAL_DEVENGADO,
                linkedBookingIds: linkedBookingIds || null,
                transactionId,
                orderId,
                breakdown: fiscalTaxData.breakdown.map((line) => ({
                    ...line,
                    operationDescription: line.operationDescription || orderConcept,
                })),
                traceId,
            });
        } catch (err) {
            log.error("registrarEventoEconomico fallo", {
                orderId,
                traceId,
                error: err?.message,
            });
            eventResult = { status: "ERROR", error: { message: err?.message } };
        }

        const ledgerOk =
            eventResult?.status === "SUCCESS" ||
            eventResult?.status === "PARTIAL";

        if (ledgerOk) {
            await _syncPaidOrderInventoryOrThrow(order, traceId, eventId);
            if (bookingIds.length) {
                await _executeWithRetry(async () => {
                    await _markCitasPaidByBookingIds(
                        bookingIds,
                        orderId,
                        traceId
                    );
                }, WEBHOOK_RETRIES, WEBHOOK_RETRY_DELAY_MS);
            }
            if (eventId) {
                await markEventAsProcessed(
                    eventId,
                    "ORDER_PAYMENT_STATUS_UPDATED",
                    traceId,
                    { orderId }
                );
            }
            return { status: "OK" };
        }

        await queueFiscalRecovery({
            bookingIds: linkedBookingIds,
            totalAmount: finalLedgerAmount,
            paymentMethod: LEDGER_PAYMENT_METHOD_ONLINE,
            transactionId,
            orderId,
            origin: "WIX_ECOM_PAYMENT_WEBHOOK",
            operationDescription: orderConcept,
            resourceId: "online",
            movementType: MOVEMENT_TYPE.VENTA_ONLINE,
            traceId,
            lastError:
                eventResult?.error?.message ||
                "LEDGER_REGISTRATION_FAILED",
        });

        await logAuditEventWithTimeout(
            "LEDGER_REGISTRATION_FAILED",
            "ERROR",
            `Ledger registration queued for order ${orderId}`,
            {
                orderId,
                bookingIds,
                ledgerError: eventResult?.error || "Unknown error",
                traceId,
            },
            traceId,
            orderId,
            "backend/events.js"
        );

        return { status: "OK" };
    } catch (error) {
        const normalized = _handleError(
            error,
            "wixEcom_onOrderPaymentStatusUpdated",
            traceId
        );
        if (normalized?.code === "INVENTORY_SYNC_RETRY_REQUIRED" ||
            String(error?.message || "").includes("INVENTORY_SYNC_RETRY_REQUIRED")) {
            throw error;
        }
        await logAuditEventWithTimeout(
            "WEBHOOK_CRITICAL_ERROR",
            "ERROR",
            `Critical error in webhook: ${normalized.message}`,
            { error: normalized.message, traceId },
            traceId,
            "system",
            "backend/events.js"
        );
        throw error;
    }
}

// ============================================================================
// WEBHOOK: ORDER REFUNDED
// ============================================================================

export async function wixEcom_onOrderRefunded(rawBody) {
    const traceId = makeTraceId("whook-refund");
    try {
        const event = await _verifyAndDecodeWebhook(rawBody, "ORDER_REFUND_UPDATED") ||
            await _verifyAndDecodeWebhook(rawBody, "ORDER_REFUNDED");
        if (!event) return { status: "REJECTED", reason: "JWT_VERIFICATION_FAILED" };

        const orderId = String(
            event?.orderId ||
            event?.entityId ||
            event?.actionEvent?.body?.orderId ||
            event?.order?._id ||
            event?.data?.order?._id ||
            ""
        ).trim() || "unknown";
        const refundObj =
            event?.actionEvent?.body?.refund ||
            event?.refund ||
            event?.data?.refund ||
            null;
        if (!refundObj || orderId === "unknown") return { status: "OK" };

        // WIX-BOUNDARY: contrato oficial eCom Refund.money = { amount, currency }.
        const officialRefundMoney = refundObj?.amount;
        const rawAmount =
            typeof officialRefundMoney === "object" &&
            officialRefundMoney !== null
                ? Number(officialRefundMoney.amount ?? 0)
                : officialRefundMoney ?? 0;
        const refundAmount = Number(rawAmount) || 0;
        if (refundAmount <= 0) return { status: "OK" };

        const refundId = String(refundObj?._id || refundObj?.id || "").trim();
        if (!refundId) {
            await logAuditEventWithTimeout(
                "REFUND_ID_MISSING",
                "ERROR",
                `Refund without stable identifier for order ${orderId}`,
                { orderId, traceId },
                traceId,
                orderId,
                "backend/events.js"
            );
            return { status: "OK" };
        }

        const transactionId = `REFUND-${orderId}-${refundId}`;
        const originalTransactionId = `ORDER-${orderId}`;

        const restockLines = refundObj?.sideEffects?.restock?.lineItems;
        if (Array.isArray(restockLines) && restockLines.length) {
            const inventoryRefundResult = await syncRestockedOrderInventoryInternal(
                orderId,
                refundId,
                restockLines,
                refundObj?.reason || "WIX_REFUND_RESTOCK",
                traceId,
                event?.eventId || event?._id || null
            );
            if (inventoryRefundResult.status === "PARTIAL") {
                const failed = inventoryRefundResult.data?.results?.filter((item) => item.status === "ERROR") || [];
                if (failed.some((item) => item.repairQueued !== true)) {
                    throw new Error("INVENTORY_REFUND_REPAIR_QUEUE_FAILED");
                }
            } else if (inventoryRefundResult.status !== "SUCCESS") {
                throw new Error("INVENTORY_REFUND_SYNC_FAILED");
            }
        }



        const originalMovementRes = await withTimeout(
            dalQuery(MOVIMIENTOS_CAJA_COL)
                .eq("transactionId", originalTransactionId)
                .limit(1)
                .find(STRONG_READ),
            API_TIMEOUT_MS,
            "queryOriginalMovement"
        ).catch(() => ({ items: [] }));

        const originalMovement = originalMovementRes.items?.[0];
        if (!originalMovement) {
            await queueFiscalRecovery({
                bookingIds: "",
                totalAmount: -refundAmount,
                paymentMethod: LEDGER_PAYMENT_METHOD_ONLINE,
                transactionId,
                orderId,
                refundId,
                origin: "WIX_ECOM_REFUND_WEBHOOK",
                operationDescription: `Refund - Order ${orderId}`,
                resourceId: "online",
                movementType: MOVEMENT_TYPE.REEMBOLSO,
                phase: "WAIT_FOR_ORIGINAL_ORDER_LEDGER",
                traceId,
                lastError: "ORIGINAL_ORDER_LEDGER_MISSING",
            });
            await logAuditEventWithTimeout(
                "REFUND_WAITING_FOR_ORIGINAL_LEDGER",
                "ERROR",
                `Refund queued before original ledger for order ${orderId}`,
                { orderId, refundId, traceId },
                traceId,
                orderId,
                "backend/events.js"
            );
            return { status: "OK" };
        }

        const originalAmount = Math.abs(Number(originalMovement.totalAmount ?? originalMovement.accountingAmount ?? 0));
        const linkedBookingIds = _normalizeBookingIds(
            originalMovement.linkedBookingIds
        );
        if (!Number.isFinite(originalAmount) || originalAmount <= 0) {
            throw new Error("REFUND_ORIGINAL_AMOUNT_INVALID");
        }

        // Read the complete refund history before creating a fiscal correction.
        // The bounded page count fails closed instead of silently undercounting.
        const refundsRes = await withTimeout(
            dalQuery(MOVIMIENTOS_CAJA_COL)
                .eq("orderId", orderId)
                .eq("movementType", MOVEMENT_TYPE.REEMBOLSO)
                .limit(1000)
                .find(STRONG_READ),
            API_TIMEOUT_MS,
            "queryRefundsForOrder"
        );
        const refundMovements = [...(refundsRes?.items || [])];
        let refundPage = refundsRes;
        let refundPages = 1;
        while (typeof refundPage?.hasNext === "function" && refundPage.hasNext()) {
            if (refundPages >= 100) throw new Error("REFUND_HISTORY_PAGE_LIMIT_EXCEEDED");
            refundPage = await withTimeout(() => refundPage.next(), API_TIMEOUT_MS, "queryRefundsNextPage");
            refundMovements.push(...(refundPage?.items || []));
            refundPages++;
        }
        if (typeof refundPage?.hasNext === "function" && refundPage.hasNext()) {
            throw new Error("REFUND_HISTORY_INCOMPLETE");
        }

        const matchingRefunds = refundMovements.filter(
            movement => _safeTrim(movement?.transactionId) === transactionId
        );
        if (matchingRefunds.length > 1) throw new Error("REFUND_TRANSACTION_DUPLICATE_LEDGER_ROWS");
        const existingRefundMovement = matchingRefunds[0] || null;

        const refundIdMatches = await withTimeout(
            dalQuery(MOVIMIENTOS_CAJA_COL)
                .eq("refundId", refundId)
                .limit(2)
                .find(STRONG_READ),
            API_TIMEOUT_MS,
            "queryRefundIdUniqueness"
        );
        const reusedRefundId = (refundIdMatches?.items || []).some(
            movement => _safeTrim(movement?.orderId) !== orderId ||
                _safeTrim(movement?.transactionId) !== transactionId
        );
        if (reusedRefundId) throw new Error("REFUND_ID_REUSED_ACROSS_ORDERS");

        const refundAmountCents = Math.round(refundAmount * 100);
        const originalAmountCents = Math.round(originalAmount * 100);
        const priorRefundMovements = refundMovements.filter(
            movement => _safeTrim(movement?.transactionId) !== transactionId
        );
        const refundedBeforeCents = priorRefundMovements.reduce(
            (sum, movement) => sum + Math.round(Math.abs(Number(
                movement?.accountingAmount ?? movement?.totalAmount ?? 0
            )) * 100),
            0
        );
        const remainingCents = Math.max(0, originalAmountCents - refundedBeforeCents);
        if (existingRefundMovement) {
            const existingAmountCents = Math.round(Math.abs(Number(
                existingRefundMovement?.accountingAmount ?? existingRefundMovement?.totalAmount ?? 0
            )) * 100);
            if (existingAmountCents !== refundAmountCents) {
                throw new Error("REFUND_IDEMPOTENCY_AMOUNT_MISMATCH");
            }
        } else if (refundAmountCents > remainingCents) {
            throw new Error("REFUND_EXCEEDS_ORIGINAL_ORDER_AMOUNT");
        }

        const refundedAfterCents = refundedBeforeCents + refundAmountCents;
        const fullyRefunded = refundedAfterCents >= originalAmountCents;
        const originalTaxBase = Math.abs(readTaxBase(originalMovement));
        const originalTaxAmount = Math.abs(readTaxAmount(originalMovement));
        const previousRefundTaxBase = priorRefundMovements.reduce(
            (sum, movement) => sum + Math.abs(readTaxBase(movement)), 0
        );
        const previousRefundTaxAmount = priorRefundMovements.reduce(
            (sum, movement) => sum + Math.abs(readTaxAmount(movement)), 0
        );
        const refundTaxBase = fullyRefunded
            ? Math.max(0, Math.round((originalTaxBase - previousRefundTaxBase) * 100) / 100)
            : Math.round(originalTaxBase * refundAmountCents / originalAmountCents * 100) / 100;
        const refundTaxAmount = fullyRefunded
            ? Math.max(0, Math.round((originalTaxAmount - previousRefundTaxAmount) * 100) / 100)
            : Math.round(originalTaxAmount * refundAmountCents / originalAmountCents * 100) / 100;

        const emisor = await _getEmisorFiscal();
        const todayDate = new Date().toLocaleDateString("sv-SE", {
            timeZone: SDK_CONFIG?.TZ || "Europe/Madrid",
        });

        let eventResult;
        if (existingRefundMovement) {
            eventResult = { status: "SUCCESS", idempotent: true, data: existingRefundMovement };
        } else try {
            eventResult = await registrarEventoEconomico({
                eventType: EVENT_TYPE.RECTIFICATIVA,
                movementType: MOVEMENT_TYPE.REEMBOLSO,
                paymentMethod: LEDGER_PAYMENT_METHOD_ONLINE,
                channelType: "ONLINE",
                resourceId: "online",
                totalAmount: -refundAmount,
                taxBase: -refundTaxBase,
                taxAmount: -refundTaxAmount,
                tipoImpositivo: Number(
                    readMovementField(originalMovement, "tipoImpositivo") ?? 21
                ),
                operationDescription: `Refund - Order ${orderId}`,
                numSerieFactura: readInvoiceNumber(originalMovement),
                fechaExpedicionFactura: todayDate,
                tipoFactura: TIPO_FACTURA.R1,
                tipoRectificativa: "I",
                previousInvoiceId: readInvoiceNumber(originalMovement) || null,
                previousInvoiceNumber:
                    readInvoiceNumber(originalMovement) || null,
                previousInvoiceIssueDate:
                    readInvoiceIssueDate(originalMovement) || null,
                correctionReason: CORRECTION_REASON.OTRAS,
                nifEmisor: emisor.nifEmisor,
                issuerLegalName: emisor.issuerLegalName,
                nifDestinatario: readRecipientTaxId(originalMovement) || null,
                recipientLegalName:
                    originalMovement.recipientLegalName || null,
                fiscalRole: FISCAL_ROLE.EMISOR,
                linkedBookingIds: linkedBookingIds.join(",") || null,
                transactionId,
                orderId,
                refundId,
                breakdown: [
                    {
                        base: -refundTaxBase,
                        tipo: Number(
                            readMovementField(originalMovement, "tipoImpositivo") ?? 21
                        ),
                        cuota: -refundTaxAmount,
                        operationDescription: `Refund - Order ${orderId}`,
                        units: 1,
                        magnitude: -1,
                    },
                ],
                traceId,
            });
        } catch (err) {
            log.error("registrarEventoEconomico refund fallo", {
                orderId,
                refundId,
                traceId,
                error: err?.message,
            });
            eventResult = { status: "ERROR", error: { message: err?.message } };
        }

        const ledgerOk =
            eventResult?.status === "SUCCESS" ||
            eventResult?.status === "PARTIAL";

        if (!ledgerOk) {
            const refundErrorCode = _safeTrim(eventResult?.error?.message);
            const nonRetryableRefundErrors = new Set([
                "REFUND_IDENTITY_INVALID",
                "REFUND_ID_REUSED_ACROSS_ORDERS",
                "REFUND_ORIGINAL_LEDGER_AMBIGUOUS",
                "REFUND_ORIGINAL_AMOUNT_INVALID",
                "REFUND_EXCEEDS_ORIGINAL_ORDER_AMOUNT",
                "REFUND_HISTORY_PAGE_LIMIT_EXCEEDED",
                "REFUND_HISTORY_INCOMPLETE",
            ]);
            if (nonRetryableRefundErrors.has(refundErrorCode)) {
                await logAuditEventWithTimeout(
                    "REFUND_REJECTED_INTEGRITY",
                    "ERROR",
                    `Refund rejected by fiscal integrity guard for order ${orderId}`,
                    { orderId, refundId, refundAmount, errorCode: refundErrorCode, traceId },
                    traceId,
                    orderId,
                    "backend/events.js"
                );
                return { status: "OK", rejected: true, reason: refundErrorCode };
            }

            await queueFiscalRecovery({
                bookingIds: linkedBookingIds.join(","),
                totalAmount: -refundAmount,
                paymentMethod: LEDGER_PAYMENT_METHOD_ONLINE,
                transactionId,
                orderId,
                refundId,
                origin: "WIX_ECOM_REFUND_WEBHOOK",
                operationDescription: `Refund - Order ${orderId}`,
                resourceId: "online",
                movementType: MOVEMENT_TYPE.REEMBOLSO,
                traceId,
                lastError:
                    eventResult?.error?.message ||
                    "REFUND_LEDGER_REGISTRATION_FAILED",
            });
            await logAuditEventWithTimeout(
                "REFUND_LEDGER_REGISTRATION_FAILED",
                "ERROR",
                `Refund ledger queued for order ${orderId}`,
                { orderId, refundId, traceId },
                traceId,
                orderId,
                "backend/events.js"
            );
            return { status: "OK" };
        }



        await _markCitasRefundedByBookingIds(
            linkedBookingIds,
            orderId,
            refundId,
            fullyRefunded,
            traceId
        );

        return { status: "OK" };
    } catch (error) {
        _handleError(error, "wixEcom_onOrderRefunded", traceId);
        throw error;
    }
}

export async function wixEcom_onOrderRefundUpdated(rawBody) {
    return wixEcom_onOrderRefunded(rawBody);
}

// ============================================================================
// WEBHOOK: ORDER CANCELED
// ============================================================================

export async function wixEcom_onOrderCanceled(rawBody) {
    const traceId = makeTraceId("whook-order-cancel");
    try {
        const event = await _verifyAndDecodeWebhook(rawBody, "ORDER_CANCELED");
        if (!event) return { status: "REJECTED", reason: "JWT_VERIFICATION_FAILED" };

        const order = event?.order || event?.data?.order || event || {};
        const orderId =
            String(order?._id || order?.id || "").trim() || "unknown";
        if (orderId === "unknown") return { status: "OK" };

        const eventId =
            event?.eventId || event?._id || `cancel-order-${orderId}`;
        const alreadyProcessed = await isEventProcessed(eventId);
        if (alreadyProcessed) {
            log.info("EVENT_DUPLICATE_IGNORED", {
                eventId,
                eventType: "ORDER_CANCELED",
            });
            return { status: "OK", duplicate: true };
        }

        const lineItems = Array.isArray(order.lineItems)
            ? order.lineItems
            : [];
        const inventoryReleaseResult = await releaseOrderInventoryInternal(order, traceId, eventId);
        if (inventoryReleaseResult.status === "PARTIAL") {
            const failed = inventoryReleaseResult.data?.results?.filter((item) => item.status === "ERROR") || [];
            if (failed.some((item) => item.repairQueued !== true)) {
                throw new Error("INVENTORY_RESERVATION_RELEASE_QUEUE_FAILED");
            }
        } else if (inventoryReleaseResult.status !== "SUCCESS") {
            throw new Error("INVENTORY_RESERVATION_RELEASE_FAILED");
        }
        const bookingsAppId = WIX_CATALOG_APP_IDS.BOOKINGS;
        const bookingIds = _normalizeBookingIds(
            lineItems
                .filter(
                    (item) => item?.catalogReference?.appId === bookingsAppId
                )
                .map((item) => item?.catalogReference?.catalogItemId)
        );
        const { allIds: relatedBookingIds } =
            await _expandBookingIdsWithPair(bookingIds);

        for (const bId of relatedBookingIds) {
            // Order cancellation applies to the complete dual booking pair.
            // ALN-03: enum Wix es CANCELED (una L).
            await _updateCitaStatus(bId, BOOKING_STATUS.CANCELED, traceId);
        }

        await markEventAsProcessed(eventId, "ORDER_CANCELED", traceId, {
            orderId,
            bookingIds,
        });
        return { status: "OK", eventId };
    } catch (error) {
        _handleError(error, "wixEcom_onOrderCanceled", traceId);
        throw error;
    }
}


// =============================================================================
// RECONCILIACION RESULT_UNKNOWN (CRON-11, SAGA-39) — SSOT v13.0
// =============================================================================
/**
 * Marca la transaccion IDEMPOTENCY como RESULT_UNKNOWN cuando la saga sabe
 * que el resultado de createBooking es incierto (uncertainStep presente en
 * los detalles del error normalizado). Es el productor del estado que consume
 * crons.reconcileUnknownTransactions; sin este enlace, las reservas con
 * timeout de pago quedaban en FAILED_RETRYABLE y nunca se reconciliaban.
 */
export async function markTransactionResultUnknown(pairToken, uncertainStep, traceId) {
    const id = _safeTrim(pairToken);
    if (!id) return { ok: false, reason: "NO_PAIR_TOKEN" };
    try {
        const doc = await dalGet(CONTROL_OPERATIVO_COL, id);
        if (!doc || !doc._id) return { ok: false, reason: "TX_NOT_FOUND" };
        let payload = {};
        try { payload = readControlPayload(doc); } catch (_e) { payload = {}; }
        if (payload.status === "COMPLETED") return { ok: true, reason: "ALREADY_COMPLETED" };
        payload.status = "RESULT_UNKNOWN";
        payload.uncertainStep = _safeTrim(uncertainStep) || "UNKNOWN_STEP";
        payload.unknownAt = new Date().toISOString();
        const updated = Object.assign({}, doc, {
            payload,
            traceId: _safeTrim(traceId) || doc.traceId,
        });
        await dalUpdate(CONTROL_OPERATIVO_COL, updated);
        log.info("markTransactionResultUnknown recorded", { traceId, pairToken: id, uncertainStep: payload.uncertainStep });
        return { ok: true };
    } catch (error) {
        log.error("markTransactionResultUnknown failed", { traceId, pairToken: id, error: error && error.message });
        return { ok: false, reason: (error && error.message) || "MARK_FAILED" };
    }
}

function _sameInstant(left, right) {
    const leftMs = Date.parse(left);
    const rightMs = Date.parse(right);
    return Number.isFinite(leftMs) && Number.isFinite(rightMs) && leftMs === rightMs;
}

function _isExactReaderBooking(booking, intent, now) {
    const slot = booking?.bookedEntity?.slot || {};
    const serviceId = _safeTrim(slot.serviceId);
    const resourceId = _safeTrim(slot.resource?._id || slot.resource?.id);
    const startDate = booking?.startDate || slot.startDate;
    const endDate = booking?.endDate || slot.endDate;
    const contactDetails = booking?.contactDetails || {};
    const createdDate = booking?.createdDate || booking?._createdDate;
    const createdMs = Date.parse(createdDate);
    const fromMs = Date.parse(intent.createdDateFrom);
    const toMs = now.getTime() + 120000;

    if (intent.bookingId && _safeTrim(booking?._id || booking?.id) !== intent.bookingId) return false;
    if (serviceId !== intent.serviceId || resourceId !== intent.resourceId) return false;
    if (!_sameInstant(startDate, intent.startDate) || !_sameInstant(endDate, intent.endDate)) return false;
    if (!Number.isFinite(createdMs) || !Number.isFinite(fromMs) || createdMs < fromMs || createdMs > toMs) return false;

    const readerContactId = _safeTrim(contactDetails.contactId);
    const readerEmail = _safeTrim(contactDetails.email).toLowerCase();
    if (intent.contactId && readerContactId && readerContactId !== intent.contactId) return false;
    if (intent.contactEmail && readerEmail !== intent.contactEmail.toLowerCase()) return false;
    if (intent.contactId && !readerContactId && !readerEmail) return false;
    return true;
}

async function _queryExactNativeBooking(intent, traceId) {
    if (
        !_looksLikeGuid(intent?.serviceId) ||
        !_looksLikeGuid(intent?.resourceId) ||
        !intent?.startDate ||
        !intent?.endDate ||
        !intent?.createdDateFrom ||
        (!intent?.contactId && !intent?.contactEmail)
    ) {
        return { status: "ERROR", reason: "WRITER_INTENT_CORRELATION_INCOMPLETE", candidates: [] };
    }

    const filter = {
        "bookedEntity.item.slot.serviceId": intent.serviceId,
        "bookedEntity.item.slot.resource.id": intent.resourceId,
        startDate: intent.startDate,
        endDate: intent.endDate,
        createdDate: {
            $gte: intent.createdDateFrom,
            $lte: new Date(Date.now() + 120000).toISOString(),
        },
    };
    if (intent.bookingId) filter.id = intent.bookingId;
    if (intent.contactId) filter["contactDetails.contactId"] = intent.contactId;
    else filter["contactDetails.email"] = intent.contactEmail.toLowerCase();

    const matches = [];
    let cursor = null;
    let exhausted = false;
    try {
        for (let page = 0; page < READER_V2_MAX_PAGES; page++) {
            const query = {
                filter,
                cursorPaging: {
                    limit: READER_V2_PAGE_LIMIT,
                    ...(cursor ? { cursor } : {}),
                },
            };
            const response = await withTimeout(
                queryExtendedBookingsElevated(query, {}),
                20000,
                "bookings.readerV2.queryExtendedBookings"
            );
            const rows = Array.isArray(response?.extendedBookings) ? response.extendedBookings : [];
            for (const wrapper of rows) {
                const booking = wrapper?.booking || wrapper;
                if (_isExactReaderBooking(booking, intent, new Date())) matches.push(booking);
                if (matches.length > 1) {
                    return { status: "AMBIGUOUS", reason: "READER_MULTIPLE_EXACT_MATCHES", candidates: matches };
                }
            }
            cursor = response?.pagingMetadata?.cursors?.next || null;
            if (!cursor) {
                exhausted = true;
                break;
            }
        }
    } catch (error) {
        log.warn("Bookings Reader V2 query failed during unknown writer recovery", {
            traceId,
            serviceId: intent.serviceId,
            error: error?.message,
        });
        return { status: "ERROR", reason: "READER_QUERY_FAILED", candidates: [] };
    }

    if (!exhausted) {
        return { status: "AMBIGUOUS", reason: "READER_PAGE_LIMIT_REACHED", candidates: matches };
    }
    if (matches.length === 1) return { status: "FOUND", booking: matches[0], candidates: matches };
    return { status: "NOT_FOUND", reason: "READER_NO_EXACT_MATCH", candidates: [] };
}

async function _persistReaderBookingProjection(booking, intent, pairToken, traceId) {
    const slot = booking?.bookedEntity?.slot || {};
    const bookingId = _safeTrim(booking?._id || booking?.id);
    const serviceId = _safeTrim(slot.serviceId || intent.serviceId);
    const resourceId = _safeTrim(slot.resource?._id || slot.resource?.id || intent.resourceId);
    const scheduleId = _safeTrim(slot.scheduleId || booking?.bookedEntity?.schedule?.scheduleId || intent.scheduleId);
    const startDate = booking?.startDate || slot.startDate || intent.startDate;
    const endDate = booking?.endDate || slot.endDate || intent.endDate;
    if (!_looksLikeGuid(bookingId) || !_looksLikeGuid(serviceId) ||
        !_looksLikeGuid(resourceId) || !_looksLikeGuid(scheduleId) ||
        !startDate || !endDate) {
        return { ok: false, reason: "READER_BOOKING_PROJECTION_FIELDS_INCOMPLETE" };
    }

    const contactDetails = booking?.contactDetails || {};
    const persisted = await _persistBooking({
        bookingId,
        serviceId,
        scheduleId,
        resourceId,
        startDate,
        endDate,
        bookingType: intent.bookingType,
        revision: Number(booking?.revision) || 1,
        bookingStatus: booking?.status || intent.bookingStatus,
        paymentStatus: booking?.paymentStatus || intent.paymentStatus,
        totalAmount: Number(intent.totalAmount) || 0,
        pairToken,
        contactDetails: {
            firstName: contactDetails.firstName || "",
            lastName: contactDetails.lastName || "",
            email: contactDetails.email || intent.contactEmail || "",
            contactId: contactDetails.contactId || intent.contactId || undefined,
            memberId: contactDetails.memberId || undefined,
        },
        thirdPartyId: booking?.thirdPartyId || null,
        privacyNoticeVersion: intent.privacyNoticeVersion || null,
        privacyNoticeAcceptedAt: intent.privacyNoticeAcceptedAt || null,
        privacyNoticePurpose: intent.privacyNoticePurpose || null,
        meta: {
            ...(intent.meta && typeof intent.meta === "object" ? intent.meta : {}),
            pairToken,
            writerRecovery: "BOOKINGS_READER_V2",
            writerPhase: intent.phase,
            readerCreatedDate: booking?.createdDate || booking?._createdDate || null,
            readerStatus: booking?.status || null,
        },
        insertOnly: true,
        traceId,
    }, traceId);

    if (!persisted?.item || _safeTrim(persisted.item.bookingId) !== bookingId) {
        return { ok: false, reason: "READER_CITAS_PROJECTION_FAILED", bookingId };
    }
    return {
        ok: true,
        bookingId,
        bookingStatus: _safeTrim(booking?.status).toUpperCase(),
        item: persisted.item,
    };
}

async function _recoverUnknownWriterFromReader(pairToken, payload, existingCitas, traceId) {
    const writerIntent = payload?.writerIntent;
    const phases = writerIntent?.phases && typeof writerIntent.phases === "object"
        ? writerIntent.phases
        : null;
    if (!phases || !phases.F1) {
        return { attempted: false, complete: false, reason: "WRITER_INTENT_NOT_AVAILABLE", bookingIds: [] };
    }

    const isDual = writerIntent.isDual === true || writerIntent.bookingType === "DUAL";
    const expected = isDual ? ["F1", "F2"] : ["F1"];
    const existingRows = Array.isArray(existingCitas) ? existingCitas : [];
    const phaseResults = {};
    for (const phaseKey of expected) {
        const intent = phases[phaseKey];
        if (!intent) {
            phaseResults[phaseKey] = { status: "MISSING_INTENT", reason: "PHASE_INTENT_MISSING" };
            continue;
        }
        const expectedType = intent.bookingType;
        const projected = existingRows.filter((row) =>
            normalizeBookingType(row?.bookingType) === expectedType &&
            _looksLikeGuid(_safeTrim(row?.bookingId))
        );
        if (projected.length === 1) {
            phaseResults[phaseKey] = {
                status: "FOUND",
                bookingId: _safeTrim(projected[0].bookingId),
                bookingStatus: _safeTrim(projected[0].bookingStatus).toUpperCase(),
                intentStatus: _safeTrim(intent.status).toUpperCase(),
                source: "CITAS_F2",
            };
            continue;
        }
        if (projected.length > 1) {
            phaseResults[phaseKey] = { status: "AMBIGUOUS", reason: "CITAS_PHASE_DUPLICATED" };
            continue;
        }

        const readerResult = await _queryExactNativeBooking(intent, traceId);
        if (readerResult.status !== "FOUND") {
            phaseResults[phaseKey] = {
                status: readerResult.status,
                reason: readerResult.reason,
                candidateCount: readerResult.candidates?.length || 0,
            };
            continue;
        }
        let projection;
        try {
            projection = await _persistReaderBookingProjection(
                readerResult.booking,
                intent,
                pairToken,
                traceId
            );
        } catch (projectionError) {
            phaseResults[phaseKey] = { status: "ERROR", reason: "READER_CITAS_PROJECTION_EXCEPTION", error: projectionError?.message };
            continue;
        }
        if (!projection.ok) {
            phaseResults[phaseKey] = { status: "ERROR", reason: projection.reason };
            continue;
        }
        phaseResults[phaseKey] = {
            status: "FOUND",
            bookingId: projection.bookingId,
            bookingStatus: projection.bookingStatus,
            intentStatus: _safeTrim(intent.status).toUpperCase(),
            source: "BOOKINGS_READER_V2",
        };
        phases[phaseKey] = {
            ...intent,
            status: "RECONCILED",
            bookingId: projection.bookingId,
            readerStatus: projection.bookingStatus,
            reconciledAt: new Date().toISOString(),
        };
    }

    const bookingIds = expected
        .map((phaseKey) => phaseResults[phaseKey]?.bookingId)
        .filter((id) => _looksLikeGuid(id));
    const allFound = expected.every((phaseKey) => phaseResults[phaseKey]?.status === "FOUND");
    const allCompensated = allFound && expected.every((phaseKey) =>
        ["COMPENSATED", "TERMINAL"].includes(_safeTrim(phaseResults[phaseKey]?.intentStatus).toUpperCase())
    );
    const anyCompensated = expected.some((phaseKey) =>
        ["COMPENSATED", "COMPENSATION_PENDING", "TERMINAL"].includes(_safeTrim(phaseResults[phaseKey]?.intentStatus).toUpperCase())
    );
    const anyCanceled = expected.some((phaseKey) => phaseResults[phaseKey]?.bookingStatus === "CANCELED");
    const anyActive = expected.some((phaseKey) => ["CREATED", "CONFIRMED", "PENDING"].includes(phaseResults[phaseKey]?.bookingStatus));

    let outcome = "REPAIR_REQUIRED";
    if (allFound && allCompensated && !anyActive) outcome = "FAILED_FINAL";
    else if (allFound && !(isDual && anyCanceled && anyActive)) outcome = "COMPLETED";
    else if (allFound && anyCompensated) outcome = "REPAIR_REQUIRED";

    return {
        attempted: true,
        complete: outcome === "COMPLETED",
        terminalFailure: outcome === "FAILED_FINAL",
        outcome,
        reason: allFound
            ? (outcome === "REPAIR_REQUIRED" ? "DUAL_COMPENSATION_STATE_MIXED" : null)
            : Object.values(phaseResults).find((result) => result.status !== "FOUND")?.reason || "READER_PHASES_INCOMPLETE",
        bookingIds,
        phaseResults,
        writerIntent: { ...writerIntent, phases },
    };
}

/**
 * Reconcilia una transaccion RESULT_UNKNOWN usando las proyecciones CitasF2.
 * CitasF2 no demuestra por si sola que Wix no haya creado un booking cuando
 * el Writer devuelve timeout. Solo se cierra automaticamente si la proyeccion
 * es completa: una fila SIMPLE o exactamente un par DUAL_F1 + DUAL_F2.
 * Los estados ambiguos pasan a REPAIR_REQUIRED y bloquean reintentos ciegos.
 */
export async function reconcileUnknownTransaction(txId, traceId) {
    const id = _safeTrim(txId);
    if (!id) return { ok: false, reason: "NO_TX_ID" };
    try {
        const doc = await dalGet(CONTROL_OPERATIVO_COL, id);
        if (!doc || !doc._id) return { ok: false, reason: "TX_NOT_FOUND" };

        let payload = {};
        try { payload = readControlPayload(doc); } catch (_e) { payload = {}; }
        if (payload.status !== "RESULT_UNKNOWN") {
            return { ok: true, reconciled: false, reason: "NOT_RESULT_UNKNOWN" };
        }

        let existing = [];
        let queryFailed = false;
        try {
            const res = await dalQuery(CITAS_COL)
                .eq(BOOKING_FIELDS.PAIR_TOKEN || "pairToken", id)
                .limit(5)
                .find({ consistencyMode: "strong" });
            existing = (res && res.items) || [];
        } catch (queryErr) {
            queryFailed = true;
            log.warn("reconcileUnknownTransaction CitasF2 query failed", {
                traceId,
                txId: id,
                error: queryErr && queryErr.message,
            });
        }

        const hasCanonicalType = (row, expectedType) => {
            const rawType = _safeTrim(row?.bookingType);
            return Boolean(rawType) &&
                normalizeBookingType(rawType) === expectedType;
        };
        const simpleRows = existing.filter((row) =>
            hasCanonicalType(row, BOOKING_TYPE.SIMPLE)
        );
        const f1Rows = existing.filter((row) =>
            hasCanonicalType(row, BOOKING_TYPE.DUAL_F1)
        );
        const f2Rows = existing.filter((row) =>
            hasCanonicalType(row, BOOKING_TYPE.DUAL_F2)
        );

        const simpleBookingId = _safeTrim(simpleRows[0]?.bookingId);
        const f1BookingId = _safeTrim(f1Rows[0]?.bookingId);
        const f2BookingId = _safeTrim(f2Rows[0]?.bookingId);
        const simpleComplete =
            !queryFailed &&
            existing.length === 1 &&
            simpleRows.length === 1 &&
            _looksLikeGuid(simpleBookingId);
        const dualComplete =
            !queryFailed &&
            existing.length === 2 &&
            f1Rows.length === 1 &&
            f2Rows.length === 1 &&
            _looksLikeGuid(f1BookingId) &&
            _looksLikeGuid(f2BookingId) &&
            f1BookingId !== f2BookingId;

        if (simpleComplete || dualComplete) {
            const bookingIds = simpleComplete
                ? [simpleBookingId]
                : [f1BookingId, f2BookingId];
            payload.status = "COMPLETED";
            payload.reconciledBy = "CRON-11";
            payload.reconciledAt = new Date().toISOString();
            payload.bookingIds = bookingIds;
            payload.reconciliationMode = simpleComplete ? "SIMPLE_PROJECTION" : "DUAL_PROJECTIONS";
            await dalUpdate(CONTROL_OPERATIVO_COL, Object.assign({}, doc, {
                payload,
                traceId: _safeTrim(traceId) || doc.traceId,
            }));
            log.info("reconcileUnknownTransaction resolved COMPLETED", {
                traceId,
                txId: id,
                bookingCount: bookingIds.length,
            });
            return { ok: true, reconciled: true, bookingIds };
        }

        // CitasF2 partial/absent is not evidence that Wix Bookings did not
        // create the booking. Query the native Reader V2 using the intent
        // persisted before each Writer call, then require one exact candidate.
        const readerRecovery = await _recoverUnknownWriterFromReader(id, payload, existing, traceId);
        if (readerRecovery.attempted) {
            payload.writerIntent = readerRecovery.writerIntent || payload.writerIntent;
            payload.readerRecovery = {
                attemptedAt: new Date().toISOString(),
                outcome: readerRecovery.outcome || "REPAIR_REQUIRED",
                reason: readerRecovery.reason || null,
                phaseResults: readerRecovery.phaseResults || {},
            };
            if (readerRecovery.outcome === "COMPLETED" || readerRecovery.outcome === "FAILED_FINAL") {
                const resolvedIntent = payload.writerIntent && typeof payload.writerIntent === "object"
                    ? { ...payload.writerIntent }
                    : {};
                const resolvedPhases = resolvedIntent.phases && typeof resolvedIntent.phases === "object"
                    ? { ...resolvedIntent.phases }
                    : {};
                for (const phaseKey of Object.keys(resolvedPhases)) {
                    const phase = { ...resolvedPhases[phaseKey] };
                    delete phase.contactEmail;
                    resolvedPhases[phaseKey] = phase;
                }
                payload.writerIntent = { ...resolvedIntent, phases: resolvedPhases, contactEmailClearedAt: new Date().toISOString() };
                payload.status = readerRecovery.outcome;
                payload.manualReconciliationRequired = false;
                payload.reconciledBy = "CRON-11-BOOKINGS-READER-V2";
                payload.reconciledAt = new Date().toISOString();
                payload.bookingIds = readerRecovery.bookingIds || [];
                payload.reconciliationMode = "BOOKINGS_READER_V2";
                await dalUpdate(CONTROL_OPERATIVO_COL, Object.assign({}, doc, {
                    payload,
                    traceId: _safeTrim(traceId) || doc.traceId,
                }));
                log.info("reconcileUnknownTransaction resolved from native Reader V2", {
                    traceId,
                    txId: id,
                    outcome: readerRecovery.outcome,
                    bookingCount: payload.bookingIds.length,
                });
                return {
                    ok: true,
                    reconciled: true,
                    failedFinal: readerRecovery.outcome === "FAILED_FINAL",
                    bookingIds: payload.bookingIds,
                    mode: "BOOKINGS_READER_V2",
                };
            }
        }

        // Absence or ambiguity in both the projection and native Reader keeps
        // the idempotency guard non-terminal. Never retry the Writer blindly.
        const knownBookingIds = Array.from(new Set([
            ...existing.map((row) => _safeTrim(row?.bookingId)),
            ...(readerRecovery.bookingIds || []),
        ])).filter((bookingId) => _looksLikeGuid(bookingId));
        const reconciliationReason = readerRecovery.attempted
            ? (readerRecovery.reason || "READER_PHASES_INCOMPLETE")
            : queryFailed
                ? "CITAS_QUERY_FAILED"
                : existing.length === 0
                    ? "NO_CITAS_PROJECTION"
                    : existing.length === 1
                        ? "PARTIAL_CITAS_PROJECTION"
                        : "CITAS_PROJECTION_SHAPE_INVALID";

        payload.status = "REPAIR_REQUIRED";
        payload.manualReconciliationRequired = true;
        payload.reconciliationReason = reconciliationReason;
        payload.knownBookingIds = knownBookingIds;
        payload.reconciliationRequiredAt = new Date().toISOString();
        payload.reconciledBy = "CRON-11";
        await dalUpdate(CONTROL_OPERATIVO_COL, Object.assign({}, doc, {
            payload,
            traceId: _safeTrim(traceId) || doc.traceId,
        }));
        await notifyOperationalAlert({
            alertType: "BOOKING_RESULT_UNKNOWN",
            severity: "ERROR",
            message: "Booking Writer outcome requires manual reconciliation.",
            data: {
                pairToken: id,
                serviceId: _safeTrim(doc.serviceId || payload.serviceId),
                uncertainStep: _safeTrim(payload.uncertainStep),
                reconciliationReason,
                existingCount: existing.length,
                knownBookingIds,
            },
            traceId: _safeTrim(traceId) || doc.traceId,
            dedupeKey: "BOOKING_RESULT_UNKNOWN_" + id,
            source: "BOOKING_RECONCILIATION",
        });

        log.error("reconcileUnknownTransaction requires manual repair", {
            traceId,
            txId: id,
            reason: reconciliationReason,
            existingCount: existing.length,
            knownBookingIds,
        });
        return {
            ok: true,
            reconciled: false,
            reason: "MANUAL_RECONCILIATION_REQUIRED",
            reconciliationReason,
            existingCount: existing.length,
        };
    } catch (error) {
        log.error("reconcileUnknownTransaction failed", {
            traceId,
            txId: id,
            error: error && error.message,
        });
        return { ok: false, reason: (error && error.message) || "RECONCILE_FAILED" };
    }
}
