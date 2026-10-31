/*
=============================================================================
MODULE: backend/events.js
VERSION: v5015-ALIGNED
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
  ALN-03: BOOKING_STATUS.CANCELLED (dos L) -> BOOKING_STATUS.CANCELED
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

FIXES APLICADOS v5009-FISCAL-V20.1 (heredados):
  - V20-01..V20-06.
FIXES APLICADOS v5009-FISCAL (heredados):
  - CONSOL-04..08, E-01..E-03, FIX-55..59.
=============================================================================
*/

import { createClient } from "@wix/sdk";
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
import { queueFiscalRecovery } from "backend/cajas.web";
import { registrarEventoEconomico } from "backend/eventLog";
import {
    recordOnlineInventoryOrderInternal,
    recordOnlineInventoryRefundInternal,
} from "backend/inventario.web";

import { logAuditEventWithTimeout } from "backend/audit";
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
    const rawOrderTotal =
        order?.priceSummary?.total?.amount ??
        order?.totals?.total?.amount;

    if (
        rawOrderTotal !== undefined &&
        rawOrderTotal !== null &&
        String(rawOrderTotal).trim() !== ""
    ) {
        const orderTotal = Number(rawOrderTotal);
        if (Number.isFinite(orderTotal) && orderTotal >= 0) {
            return orderTotal;
        }
    }

    const lineItems = Array.isArray(order?.lineItems) ? order.lineItems : [];
    return lineItems.reduce((sum, item) => {
        const rawLineTotal =
            item?.totalPriceAfterTax?.amount ??
            item?.totalPriceBeforeTax?.amount ??
            item?.totalPrice?.amount;

        if (
            rawLineTotal !== undefined &&
            rawLineTotal !== null &&
            String(rawLineTotal).trim() !== ""
        ) {
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

const log = logger;

// ============================================================================
// CONSTANTES (ALN-01, ALN-05, ALN-06)
// ============================================================================

const CITAS_COL = BUSINESS_COLLECTIONS.CITAS_F2;
const MOVIMIENTOS_CAJA_COL = BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA;
const CONTROL_OPERATIVO_COL = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;

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
        .find(STRONG_READ)
        .catch(() => null);

    return Boolean(existing?.items?.length);
}

async function markEventAsProcessed(eventId, eventType, traceId, metadata = {}) {
    if (!eventId) return;
    const normalizedId = _normalizeIdPart(String(eventId), 100);
    const webhookKey = `WEBHOOK_${normalizedId}`;
    const expiresAt = new Date(Date.now() + EVENT_TTL_HOURS * 3600 * 1000);

    try {
        await dalInsert(CONTROL_OPERATIVO_COL, {
            controlType: CONTROL_TYPE.WEBHOOK_EVENT,
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
    } catch (err) {
        // Colision de dedupeKey (evento ya marcado por otro proceso): OK.
        log.debug("EVENT_INSERT_CONFLICT", { eventId, error: err.message });
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

    const withholdingAmount =
        Number(
            order.taxSummary?.retention?.amount ||
                order.additionalFees?.retention ||
                0
        ) || 0;

    const withholdingBase =
        Number(
            order.taxSummary?.retention?.base ||
                order.priceSummary?.subtotal?.amount ||
                0
        ) || 0;

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
async function _syncNativeBookingToCitas(booking, eventId, traceId) {
    const bookingId = _safeTrim(booking?.id || booking?._id);
    const bookedEntity = booking?.bookedEntity || {};
    const slot = bookedEntity.slot || bookedEntity.item?.slot || {};
    const resource = slot.resource || {};
    const serviceId = _safeTrim(slot.serviceId || booking?.serviceId);
    const resourceId = _safeTrim(resource.id || booking?.resource?.id);
    const scheduleId = _safeTrim(slot.scheduleId || resource.scheduleId || booking?.scheduleId);
    const startDate = booking?.startDate || slot.startDate;
    const endDate = booking?.endDate || slot.endDate;

    const missing = [];
    if (!bookingId) missing.push("bookingId");
    if (!serviceId) missing.push("serviceId");
    if (!resourceId) missing.push("resourceId");
    if (!scheduleId) missing.push("scheduleId");
    if (!startDate) missing.push("startDate");
    if (!endDate) missing.push("endDate");
    if (missing.length) {
        return { ok: false, reason: "NATIVE_BOOKING_MISSING_REQUIRED_FIELDS", missing };
    }

    const existing = await dalQuery(CITAS_COL)
        .eq(BOOKING_FIELDS.BOOKING_ID, bookingId)
        .limit(1)
        .find(STRONG_READ);

    if (existing?.items?.length) {
        await _updateCitaStatus(bookingId, BOOKING_STATUS.CONFIRMED, traceId);
        return { ok: true, created: false, existing: true, bookingId };
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
    return { ok: true, created: Boolean(write?.created), existing: !write?.created, bookingId };
}

// ============================================================================
// CITA STATUS UPDATES
// ============================================================================

async function _updateCitaStatus(bookingId, newStatus, traceId) {
    await _updateCitaSafe(
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

        // Wix Bookings V2 Velo envelope: metadata.id + data.booking.
        // Keep the canonical shape strict; do not silently accept legacy payloads.
        const eventId = _safeTrim(event?.metadata?.id || "");
        const booking = event?.data?.booking || {};
        const bookingId = _safeTrim(booking?._id || "");
        const alreadyProcessed = await isEventProcessed(eventId);
        if (alreadyProcessed && bookingId && bookingId !== "unknown") {
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

        const valid = Boolean(eventId) && validateEventStructure(event, [
            "metadata.id",
            "data.booking._id",
            "data.booking.status",
        ]);
        if (!valid) {
            log.warn("EVENT_INVALID_STRUCTURE_REJECTED", { eventId });
            await markEventAsProcessed(
                eventId,
                "BOOKING_CONFIRMED_INVALID",
                traceId,
                { rejected: true }
            );
            return { status: "OK", rejected: true };
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
            return { status: "RETRY_REQUIRED", reason: syncResult.reason, missing: syncResult.missing };
        }
        if (!alreadyProcessed) {
            await markEventAsProcessed(eventId, "BOOKING_CONFIRMED", traceId, {
                bookingId,
                ledgerCreated: syncResult.created,
                ledgerSource: syncResult.created ? "WIX_BOOKINGS_NATIVE" : "EXISTING_CITASF2",
            });
        }
        return { status: "OK", eventId, ledgerCreated: syncResult.created };
    } catch (error) {
        _handleError(error, "wixBookingsV2_onBookingConfirmed", traceId);
        return { status: "OK" };
    }
}

// ============================================================================
// WEBHOOK: BOOKING CANCELED (ALN-03: BOOKING_STATUS.CANCELED)
// ============================================================================

export async function wixBookingsV2_onBookingCanceled(rawBody) {
    const traceId = makeTraceId("whook-cancel");
    try {
        const event = await _verifyAndDecodeWebhook(rawBody, "BOOKING_CANCELED");
        if (!event) return { status: "REJECTED", reason: "JWT_VERIFICATION_FAILED" };

        const eventId =
            event?.eventId ||
            event?._id ||
            `cancel-${event?.booking?.id || Date.now()}`;
        const alreadyProcessed = await isEventProcessed(eventId);
        if (alreadyProcessed) {
            log.info("EVENT_DUPLICATE_IGNORED", {
                eventId,
                eventType: "BOOKING_CANCELED",
            });
            return { status: "OK", duplicate: true };
        }

        const valid = validateEventStructure(event, ["booking.id"]);
        if (!valid) {
            log.warn("EVENT_INVALID_STRUCTURE_REJECTED", { eventId });
            await markEventAsProcessed(
                eventId,
                "BOOKING_CANCELED_INVALID",
                traceId,
                { rejected: true }
            );
            return { status: "OK", rejected: true };
        }

        const booking = event?.booking || event?.entity || {};
        const bookingId = booking?.id || booking?._id || "unknown";

        // Si la cita previa estaba PAID, generar rectificativa
        const previousCita = await dalQuery(CITAS_COL)
            .eq("bookingId", bookingId)
            .limit(1)
            .find(STRONG_READ)
            .then((r) => r?.items?.[0] || null)
            .catch(() => null);

        if (
            previousCita &&
            String(previousCita.paymentStatus || "").toUpperCase() ===
                PAYMENT_STATUS.PAID
        ) {
            const originalMovementRes = await dalQuery(MOVIMIENTOS_CAJA_COL)
                .eq("linkedBookingIds", bookingId)
                .eq("movementType", MOVEMENT_TYPE.VENTA_ONLINE)
                .limit(1)
                .find(STRONG_READ)
                .catch(() => ({ items: [] }));

            const originalMovement = originalMovementRes?.items?.[0];

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
                        operationDescription: `Rectificacion cancelacion booking ${bookingId}`,
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
                        linkedBookingIds: bookingId,
                        transactionId: `RECT-${bookingId}`,
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
                } catch (rectErr) {
                    log.error(
                        "Rectification ledger failed; queuing recovery",
                        {
                            bookingId,
                            traceId,
                            error: rectErr?.message,
                        }
                    );
                    await queueFiscalRecovery({
                        bookingIds: bookingId,
                        totalAmount: -Math.abs(
                            Number(originalMovement.totalAmount || 0)
                        ),
                        paymentMethod:
                            originalMovement.paymentMethod ||
                            LEDGER_PAYMENT_METHOD_ONLINE,
                        transactionId: `RECT-${bookingId}`,
                        orderId: originalMovement.orderId || null,
                        origin: "WIX_BOOKINGS_CANCEL_WEBHOOK",
                        operationDescription: `Rectificacion cancelacion booking ${bookingId}`,
                        resourceId: "online",
                        movementType: MOVEMENT_TYPE.REEMBOLSO,
                        traceId,
                        lastError: rectErr?.message || "RECT_FAIL",
                    });
                }
            }
        }

        // ALN-03: enum Wix nativo es CANCELED (una L).
        await _updateCitaStatus(bookingId, BOOKING_STATUS.CANCELED, traceId);
        await markEventAsProcessed(eventId, "BOOKING_CANCELED", traceId, {
            bookingId,
        });
        return { status: "OK", eventId };
    } catch (error) {
        _handleError(error, "wixBookingsV2_onBookingCanceled", traceId);
        return { status: "OK" };
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

        const eventId = event?.id || event?.eventId || event?._id;
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
            const inventoryRetry = await recordOnlineInventoryOrderInternal(order, traceId);
            if (inventoryRetry?.status === "PENDING_RECONCILIATION") {
                await logAuditEventWithTimeout(
                    "INVENTORY_ORDER_RECONCILIATION_QUEUED",
                    "ERROR",
                    `Inventario pendiente de conciliacion para pedido ${orderId}`,
                    {
                        orderId,
                        queueId: inventoryRetry.queueId || null,
                        results: inventoryRetry.data || [],
                        traceId,
                    },
                    traceId,
                    orderId,
                    "backend/events.js"
                );
            }
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
                taxBase:
                    fiscalData.withholdingBase > 0
                        ? fiscalData.withholdingBase
                        : 0,
                taxAmount: 0,
                tipoImpositivo: 21,
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
                breakdown: [
                    {
                        base:
                            fiscalData.withholdingBase > 0
                                ? fiscalData.withholdingBase
                                : finalLedgerAmount,
                        tipo: 21,
                        cuota: 0,
                        operationDescription: orderConcept,
                        units: 1,
                        magnitude: 1,
                    },
                ],
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
            try {
                const inventoryResult = await recordOnlineInventoryOrderInternal(order, traceId);
                if (inventoryResult?.status === "PENDING_RECONCILIATION") {
                    await logAuditEventWithTimeout(
                        "INVENTORY_ORDER_RECONCILIATION_QUEUED",
                        "ERROR",
                        `Inventario pendiente de conciliacion para pedido ${orderId}`,
                        {
                            orderId,
                            queueId: inventoryResult.queueId || null,
                            results: inventoryResult.data || [],
                            traceId,
                        },
                        traceId,
                        orderId,
                        "backend/events.js"
                    );
                }
            } catch (inventoryError) {
                log.error("Online inventory mirror failed", {
                    orderId,
                    traceId,
                    error: inventoryError?.message || String(inventoryError),
                });
                await logAuditEventWithTimeout(
                    "INVENTORY_MIRROR_FAILED",
                    "ERROR",
                    `Inventario no sincronizado para orden ${orderId} tras ledger OK`,
                    {
                        orderId,
                        traceId,
                        error: inventoryError?.message || String(inventoryError),
                    },
                    traceId,
                    orderId,
                    "backend/events.js"
                );
            }

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
        await logAuditEventWithTimeout(
            "WEBHOOK_CRITICAL_ERROR",
            "ERROR",
            `Critical error in webhook: ${normalized.message}`,
            { error: normalized.message, traceId },
            traceId,
            "system",
            "backend/events.js"
        );
        return { status: "OK" };
    }
}

// ============================================================================
// WEBHOOK: ORDER REFUNDED
// ============================================================================

export async function wixEcom_onOrderRefunded(rawBody) {
    const traceId = makeTraceId("whook-refund");
    try {
        const event = await _verifyAndDecodeWebhook(rawBody, "ORDER_REFUNDED");
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

        const originalAmount = Number(originalMovement.totalAmount ?? 0);
        const linkedBookingIds = _normalizeBookingIds(
            originalMovement.linkedBookingIds
        );

        const refundRestockInfo =
            event?.actionEvent?.body?.sideEffects?.restock ||
            event?.sideEffects?.restock ||
            event?.data?.sideEffects?.restock ||
            refundObj?.sideEffects?.restock ||
            null;

        const refundOrderSource =
            event?.actionEvent?.body?.order ||
            event?.order ||
            event?.data?.order ||
            {};
        const refundOrder = {
            ...refundOrderSource,
            _id: refundOrderSource?._id || refundOrderSource?.id || orderId,
            lineItems: Array.isArray(refundOrderSource?.lineItems)
                ? refundOrderSource.lineItems
                : event?.lineItems || event?.data?.lineItems || [],
        };

        try {
            const inventoryRefund = await recordOnlineInventoryRefundInternal(
                refundOrder,
                refundObj,
                refundRestockInfo,
                traceId
            );
            if (inventoryRefund?.status === "PENDING_RECONCILIATION") {
                await logAuditEventWithTimeout(
                    "REFUND_INVENTORY_RECONCILIATION_QUEUED",
                    "ERROR",
                    `Inventario pendiente de conciliacion para reembolso ${refundId}`,
                    {
                        orderId,
                        refundId,
                        queueId: inventoryRefund.queueId || null,
                        results: inventoryRefund.data || [],
                        traceId,
                    },
                    traceId,
                    orderId,
                    "backend/events.js"
                );
            }
            if (
                inventoryRefund?.status === "SKIPPED" &&
                inventoryRefund?.reason !== "NO_CONFIRMED_RESTOCK"
            ) {
                await logAuditEventWithTimeout(
                    "REFUND_INVENTORY_TRACE_SKIPPED",
                    "WARN",
                    `Inventory trace skipped for refund ${refundId}`,
                    {
                        orderId,
                        refundId,
                        reason: inventoryRefund.reason,
                        traceId,
                    },
                    traceId,
                    orderId,
                    "backend/events.js"
                );
            }
        } catch (inventoryRefundError) {
            await logAuditEventWithTimeout(
                "REFUND_INVENTORY_TRACE_FAILED",
                "ERROR",
                `Inventory trace failed for refund ${refundId}`,
                {
                    orderId,
                    refundId,
                    error:
                        inventoryRefundError?.message ||
                        String(inventoryRefundError),
                    traceId,
                },
                traceId,
                orderId,
                "backend/events.js"
            );
        }

        const emisor = await _getEmisorFiscal();
        const todayDate = new Date().toLocaleDateString("sv-SE", {
            timeZone: SDK_CONFIG?.TZ || "Europe/Madrid",
        });

        let eventResult;
        try {
            eventResult = await registrarEventoEconomico({
                eventType: EVENT_TYPE.RECTIFICATIVA,
                movementType: MOVEMENT_TYPE.REEMBOLSO,
                paymentMethod: LEDGER_PAYMENT_METHOD_ONLINE,
                channelType: "ONLINE",
                resourceId: "online",
                totalAmount: -refundAmount,
                taxBase: -Math.abs(readTaxBase(originalMovement)),
                taxAmount: -Math.abs(readTaxAmount(originalMovement)),
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
                        base: -Math.abs(readTaxBase(originalMovement)),
                        tipo: Number(
                            readMovementField(originalMovement, "tipoImpositivo") ?? 21
                        ),
                        cuota: -Math.abs(readTaxAmount(originalMovement)),
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

        const refundsRes = await withTimeout(
            dalQuery(MOVIMIENTOS_CAJA_COL)
                .eq("orderId", orderId)
                .eq("movementType", MOVEMENT_TYPE.REEMBOLSO)
                .limit(100)
                .find(STRONG_READ),
            API_TIMEOUT_MS,
            "queryRefundsForOrder"
        );

        const refundedTotal = (refundsRes?.items || []).reduce(
            (sum, movement) =>
                sum +
                Math.abs(
                    Number(
                        movement?.accountingAmount ??
                            movement?.totalAmount ??
                            0
                    )
                ),
            0
        );
        const fullyRefunded =
            originalAmount > 0 && refundedTotal >= originalAmount;

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
        return { status: "OK" };
    }
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
        return { status: "OK" };
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

/**
 * Reconcilia una transaccion RESULT_UNKNOWN: verifica si las reservas F1/F2
 * realmente existen en CitasF2 (persistencia local post-commit) y cierra el
 * ciclo escribiendo COMPLETED (si existen) o FAILED_FINAL (si no hay rastro).
 * Consumido por CRON-11 cada 45 min. Idempotente: solo actua sobre
 * payload.status === RESULT_UNKNOWN.
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

        // Verificacion: buscar citas persistidas con pairToken == txId.
        let existing = [];
        try {
            const res = await dalQuery(CITAS_COL)
                .eq(BOOKING_FIELDS.PAIR_TOKEN || "pairToken", id)
                .limit(5)
                .find({ consistencyMode: "strong" });
            existing = (res && res.items) || [];
        } catch (queryErr) {
            log.warn("reconcileUnknownTransaction verify query failed", { traceId, txId: id, error: queryErr && queryErr.message });
        }

        let updated;
        if (existing.length >= 2) {
            payload.status = "COMPLETED";
            payload.reconciledBy = "CRON-11";
            payload.reconciledAt = new Date().toISOString();
            payload.bookingIds = existing.map((c) => c._id);
            updated = Object.assign({}, doc, { payload });
            await dalUpdate(CONTROL_OPERATIVO_COL, updated);
            log.info("reconcileUnknownTransaction resolved COMPLETED", { traceId, txId: id });
            return { ok: true, reconciled: true };
        }

        if (existing.length === 1) {
            // Media creacion confirmada: delegar compensacion al cron dedicado
            // (compensateOrphanBookings) marcando la necesidad via flag.
            payload.compensationRequired = true;
            updated = Object.assign({}, doc, { payload });
            await dalUpdate(CONTROL_OPERATIVO_COL, updated);
            log.warn("reconcileUnknownTransaction flagged compensationRequired", { traceId, txId: id });
            return { ok: true, reconciled: false, reason: "COMPENSATION_REQUIRED" };
        }

        // Sin rastro alguno: el create nunca aterrizo. Cerrar como definitivo.
        payload.status = "FAILED_FINAL";
        payload.reconciledBy = "CRON-11";
        payload.reconciledAt = new Date().toISOString();
        payload.error = String(payload.error || "SAGA-39 unresolved: no bookings found");
        updated = Object.assign({}, doc, { payload });
        await dalUpdate(CONTROL_OPERATIVO_COL, updated);
        log.info("reconcileUnknownTransaction resolved FAILED_FINAL", { traceId, txId: id });
        return { ok: true, reconciled: true };
    } catch (error) {
        log.error("reconcileUnknownTransaction failed", { traceId, txId: id, error: error && error.message });
        return { ok: false, reason: (error && error.message) || "RECONCILE_FAILED" };
    }
}
