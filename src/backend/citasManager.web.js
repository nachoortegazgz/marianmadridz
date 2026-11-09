/**
 * MODULE: backend/citasManager.web.js
 * VERSION: v10.10-PAYMENT-STATE-RECOVERY
 * BASE: v10.8-CLEAN
 *
 * CORRECCIONES v10.10:
 *   - PAYMENT-RECOVERY-01: un movimiento fiscal persistido con estado PARTIAL
 *     permite completar la proyeccion de pago; CajaActual pendiente no equivale
 *     a ausencia de ledger. La clave ORDER-{orderId} conserva la idempotencia.
 *   - PAYMENT-RECOVERY-02: un par con filas PAID y pendientes del mismo pedido
 *     puede reintentarse; se rechazan filas PAID asociadas a otro orderId.
 *   - PAYMENT-RECOVERY-03: el fallo de CitasF2 genera la alerta persistente
 *     PAYMENT_STATE_UPDATE_REQUIRED con referencias para su recuperacion.
 *
 * CORRECCIONES v10.9 (alineadas con documentación oficial y con reservas v10.19):
 *   - DUAL-SLOT-01 (P1): _getDualSlotInput acepta `slot` como fallback de
 *     `slotRef`. El DTO mínimo de reservas.web.js v10.19 devuelve `slot`
 *     (4 campos) en lugar de `slotRef` (objeto SDK completo). Sin este
 *     cambio, rescheduleDualBookings rechazaba el payload del widget.
 *   - DUAL-GAP-03 (P1): _revalidateDualInputSlots mantiene la validación
 *     exacta del gap (gapMinutes === exposureMinutes) coherente con la
 *     búsqueda exacta de reservas.web.js. Añade log de diagnóstico.
 *   - PRISTINE-ID-01 (P0): los objetos BookedSlot de @wix/bookings usan
 *     `resource._id` y `location._id`. La forma `id` corresponde a REST y
 *     no se acepta en este flujo SDK.
 *
 * DOC OFICIAL:
 *   - Bookings Writer V2 SDK: https://dev.wix.com/docs/api-reference/business-solutions/bookings/bookings/bookings-writer-v2/create-booking?apiView=SDK
 *   - Reschedule Booking V2 SDK: https://dev.wix.com/docs/api-reference/business-solutions/bookings/bookings/bookings-writer-v2/reschedule-booking?apiView=SDK
 *     Firma: rescheduleBooking(bookingId, slot, options); revision pertenece a options.
 *   - Multi-Service Booking: no soporta gaps (solo SEQUENTIAL_BOOKINGS).
 *     La estrategia de dos bookings individuales con gap manual es correcta.
 */
import { webMethod, Permissions } from "wix-web-module";
import { orders } from "@wix/ecom";
import { bookings } from "@wix/bookings";
import { auth } from "@wix/essentials";
import { members } from "@wix/members";
import { queryFirstItem, queryItems, wql, CONSISTENCY, insertItem as dalInsert, bulkPatchItems } from "backend/dataAccess";
import {
    BUSINESS_COLLECTIONS, OPERATIONAL_COLLECTIONS, CONTROL_TYPE, SDK_CONFIG,
    WIX_CATALOG_APP_IDS, CITAS_BOOKING_STATUS, PAYMENT_STATUS, PAYMENT_METHOD, CHANNEL_TYPE,
    MOVEMENT_TYPE, BOOKING_TYPE, BOOKING_FIELDS, ROL_WEBSITE
} from "backend/internalConfig";
import {
    makeTraceId, _safeTrim, _looksLikeGuid, _normalizeLocalIsoStr,
    _readPositiveAmount, _toDateSafe, getUtcDateFromMadridLocal,
    getMadridLocalStringNoZ, withTimeout
} from "public/mmUtils";
import { toUtcRange } from "backend/booking/bookingUtils";
import { executeBookingSaga, _startLockHeartbeat } from "backend/booking/bookingSaga";
import { normalizeError, _handleError, ERROR_CODES, createBookingError, _updateCitaSafe, _forceStaffInPristineSlot, generateSlotKey, _lockSlotKeyOrFail, _unlockSlotKey } from "backend/booking/bookingCore";
import { registerBookingPayment } from "backend/cajas.web.js";
import { rateLimiter } from "backend/security";
import { logger } from "backend/logger";
import { logAuditEvent } from "backend/audit";
import { revalidateExactAvailabilitySlot, _getServiceBySlugOrIdInternal } from "backend/reservas.web.js";
import { findStaffByResourceId } from "backend/staff";
import {
    buildDualRescheduleJournalIdentity,
    DUAL_RESCHEDULE_STATUS,
    isDualRescheduleTerminalStatus,
} from "backend/booking/dualRescheduleJournal";

const log = logger;

const BLOCKED_PAYMENT_STATES = new Set([
    CITAS_BOOKING_STATUS.CANCELED,
    CITAS_BOOKING_STATUS.COMPLETED,
    CITAS_BOOKING_STATUS.REFUNDED,
    CITAS_BOOKING_STATUS.NO_SHOW,
]);
const ALLOWED_PAYMENT_CONFIRMATION_STATES = new Set([
    CITAS_BOOKING_STATUS.PENDING,
    CITAS_BOOKING_STATUS.CONFIRMED,
]);
const ALLOWED_RESCHEDULE_STATES = new Set([
    CITAS_BOOKING_STATUS.PENDING,
    CITAS_BOOKING_STATUS.CONFIRMED,
]);
const CITAS_COL = BUSINESS_COLLECTIONS.CITAS_F2;
const CONTROL_COL = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
const API_TIMEOUT_MS = Number(SDK_CONFIG?.TIMEOUTS?.API_MS) || 15000;
const AUDIT_SOURCE = "backend/citasManager.web.js";
const FIELD_BOOKING_ID = BOOKING_FIELDS?.BOOKING_ID || "bookingId";
const FIELD_STATUS = BOOKING_FIELDS?.STATUS || "bookingStatus";
const FIELD_PAYMENT_STATUS = BOOKING_FIELDS?.PAYMENT_STATUS || "paymentStatus";
const FIELD_CASH_MOVEMENT_ID = BOOKING_FIELDS?.CASH_MOVEMENT_ID || "cashMovementId";
const FIELD_ORDER_ID = BOOKING_FIELDS?.ORDER_ID || "orderId";
const FIELD_TRACE_ID = BOOKING_FIELDS?.TRACE_ID || "traceId";
const FIELD_SERVICE_ID = BOOKING_FIELDS?.SERVICE_ID || "serviceId";
const FIELD_RESOURCE_ID = BOOKING_FIELDS?.RESOURCE_ID || "resourceId";
const FIELD_SLOT_START = BOOKING_FIELDS?.SLOT_START || "slotStart";
const FIELD_SLOT_END = BOOKING_FIELDS?.SLOT_END || "slotEnd";
const FIELD_PAIR_TOKEN = BOOKING_FIELDS?.PAIR_TOKEN || "pairToken";
const FIELD_CONTACT_DETAILS = BOOKING_FIELDS?.CONTACT_DETAILS || "contactDetails";
const CHANNEL_ONLINE = _safeTrim(CHANNEL_TYPE.ONLINE).toUpperCase();
const CHANNEL_PRESENCIAL = _safeTrim(CHANNEL_TYPE.PRESENCIAL).toUpperCase();
const getOrderElevated = auth.elevate(orders.getOrder);
const rescheduleBookingElevated = auth.elevate(bookings.rescheduleBooking);
const getBookingElevated = auth.elevate(bookings.getBooking);

async function _rateLimitOrThrow(surface, key, traceId) {
    const result = await rateLimiter({ surface, key });
    if (result?.allowed) return;

    const error = new Error(`RATE_LIMITED: retryAfter=${result?.retryAfter ?? 1}`);
    error.code = "RATE_LIMITED";
    error.meta = {
        retryAfter: result?.retryAfter ?? 1,
        surface,
        traceId: traceId || null,
    };
    throw error;
}

function _getCitaMeta(cita) {
    if (!cita) return {};
    const meta = cita.meta;
    if (typeof meta === "string") {
        try {
            const parsed = JSON.parse(meta);
            return parsed && typeof parsed === "object" && !Array.isArray(parsed)
                ? parsed
                : {};
        } catch (_) {
            return {};
        }
    }
    if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
        return {};
    }
    return meta;
}

function _getAddOnIdsForRevalidation(cita) {
    const meta = _getCitaMeta(cita);
    const source = Array.isArray(meta.addOnIds)
        ? meta.addOnIds
        : Array.isArray(meta.nativeAddonIds)
            ? meta.nativeAddonIds
            : [];
    return Array.from(
        new Set(
            source
                .map((id) => _safeTrim(id))
                .filter((id) => _looksLikeGuid(id))
        )
    ).sort();
}

function _normalizeBookingAddOnIds(value) {
    if (!Array.isArray(value)) return [];
    return Array.from(
        new Set(
            value
                .map((id) => _safeTrim(id))
                .filter((id) => _looksLikeGuid(id))
        )
    ).sort();
}

async function _findCitaByBookingId(bookingId) {
    const normalizedId = _safeTrim(bookingId);
    if (!normalizedId) return null;
    return queryFirstItem({
        dataCollectionId: CITAS_COL,
        filter: wql.eq(FIELD_BOOKING_ID, normalizedId),
        consistency: CONSISTENCY.STRONG,
    });
}

async function _findCitasByPairToken(pairToken) {
    const normalizedToken = _safeTrim(pairToken);
    if (!normalizedToken) return [];
    const result = await queryItems({
        dataCollectionId: CITAS_COL,
        filter: wql.eq(FIELD_PAIR_TOKEN, normalizedToken),
        limit: 10,
        offset: 0,
        consistency: CONSISTENCY.STRONG,
    });
    return Array.isArray(result?.items) ? result.items : [];
}

async function _findCitaByOrderAndBookingId(orderId, bookingId) {
    const cita = await _findCitaByBookingId(bookingId);
    if (!cita) return null;
    const meta = _getCitaMeta(cita);
    const storedOrderId = _safeTrim(
        cita?.[FIELD_ORDER_ID] || meta.orderId || ""
    );
    if (storedOrderId && storedOrderId !== _safeTrim(orderId)) {
        return null;
    }
    return cita;
}

function _isPaidOrderStatus(value) {
    const status = String(value || "").trim().toUpperCase();
    return ["PAID", "FULLY_PAID", "PAID_FULL"].includes(status);
}

function _getOrderBookingLineItems(order) {
    const lineItems = Array.isArray(order?.lineItems) ? order.lineItems : [];
    const bookingsAppId = WIX_CATALOG_APP_IDS.BOOKINGS;
    return lineItems.filter(
        (item) => item?.catalogReference?.appId === bookingsAppId
    );
}

function _getBookingLineItemsTotal(lineItems) {
    return (lineItems || []).reduce((sum, item) => {
        const amount = Number(item?.price?.amount ?? item?.price ?? 0) || 0;
        const quantity = Number(item?.quantity) || 1;
        return sum + amount * quantity;
    }, 0);
}

function _isOnlinePaymentAllowed(cita) {
    const meta = _getCitaMeta(cita);
    const channel = _safeTrim(meta.channelType || "").toUpperCase();
    if (channel === CHANNEL_ONLINE) return true;
    if (_safeTrim(meta.checkoutUrl || "")) return true;
    const legacyPm = _safeTrim(meta.paymentMethod || "").toUpperCase();
    return (
        legacyPm === CHANNEL_ONLINE ||
        legacyPm === _safeTrim(PAYMENT_METHOD.WIX_PAYMENTS).toUpperCase()
    );
}

async function _getCurrentMemberInfo() {
    try {
        const response = await members.getCurrentMember();
        const member = response?.member || response;
        if (!member || member.status === "ERROR") return null;
        return member;
    } catch (_) {
        return null;
    }
}

function _getMemberId(member) {
    if (!member) return "";
    return _safeTrim(
        member._id || member.id || member.memberId || ""
    );
}

async function _getStaffAccess(resourceId, traceId = null) {
    const id = _safeTrim(resourceId);
    if (!id || !_looksLikeGuid(id)) return null;

    try {
        const staff = await findStaffByResourceId(id, traceId);
        if (!staff?.contactId || !staff.roleWebsite) return null;

        return {
            contactId: staff.contactId,
            roleWebsite: staff.roleWebsite,
        };
    } catch (error) {
        log.warn("_getStaffAccess: Bookings Staff Members lookup failed", {
            resourceId: id,
            traceId,
            error: error?.message,
        });
        return null;
    }
}

function _validateProcessBookingPayload(payload, traceId, sessionMemberId = "", sessionContactId = "") {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "Booking payload is invalid.",
            { traceId }
        );
    }

    const requiredText = ["serviceId", "email", "firstName", "phone"];
    for (const field of requiredText) {
        if (!_safeTrim(payload[field])) {
            throw createBookingError(
                ERROR_CODES.INVALID_PAYLOAD,
                `${field} is required.`,
                { traceId, field }
            );
        }
    }

    if (!payload.slotF1 || typeof payload.slotF1 !== "object") {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "slotF1 is required.",
            { traceId }
        );
    }

    if (payload.rgpdConsent !== true) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "RGPD consent is required.",
            { traceId }
        );
    }

    const channelRaw = _safeTrim(
        payload.channelType || payload.paymentMethod || ""
    ).toUpperCase();
    if (channelRaw !== CHANNEL_ONLINE && channelRaw !== CHANNEL_PRESENCIAL) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "Invalid channelType: expected ONLINE or PRESENCIAL.",
            { traceId, channelType: channelRaw || null }
        );
    }

    const pmRaw = _safeTrim(payload.paymentMethod || "").toUpperCase();
    if (pmRaw && pmRaw !== CHANNEL_ONLINE && pmRaw !== CHANNEL_PRESENCIAL) {
        const validMembers = Object.values(PAYMENT_METHOD || {}).map((v) =>
            _safeTrim(v).toUpperCase()
        );
        if (!validMembers.includes(pmRaw)) {
            throw createBookingError(
                ERROR_CODES.INVALID_PAYLOAD,
                "Invalid payment method.",
                { traceId, paymentMethod: pmRaw }
            );
        }
    }

    if (payload.addOnIds !== undefined && !Array.isArray(payload.addOnIds)) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "addOnIds must be an array.",
            { traceId }
        );
    }

    return {
        serviceId: _safeTrim(payload.serviceId),
        slug: _safeTrim(payload.slug || ""),
        resourceId: _safeTrim(payload.resourceId || ""),
        slotF1: payload.slotF1,
        slotF2: payload.slotF2 || null,
        email: _safeTrim(payload.email),
        firstName: _safeTrim(payload.firstName),
        lastName: _safeTrim(payload.lastName || ""),
        phone: _safeTrim(payload.phone),
        appointmentNote: _safeTrim(payload.appointmentNote || "").slice(0, 200),
        channelType: channelRaw,
        paymentMethod: pmRaw || null,
        rgpdConsent: true,
        // Timestamp is generated server-side only after explicit checkbox acceptance.
        // This records booking-management processing, not optional marketing consent.
        privacyNoticeVersion: _safeTrim(payload.privacyNoticeVersion || "") || null,
        privacyNoticeAcceptedAt: new Date(),
        privacyNoticePurpose: "GESTION_RESERVA",
        addOnIds: _normalizeBookingAddOnIds(payload.addOnIds),
        traceId: _safeTrim(payload.traceId || ""),
        memberId: _safeTrim(sessionMemberId),
        contactId: _safeTrim(sessionContactId),
    };
}

// =============================================================================
// PUBLIC WEB METHODS
// =============================================================================
export const processDualBooking = webMethod(
    Permissions.SiteMember,
    async (unsafePayload) => {
        const traceId = unsafePayload?.traceId || makeTraceId("dual-bkg");
        try {
            const sessionMember = await _getCurrentMemberInfo();
            const sessionMemberId = _getMemberId(sessionMember);
            const sessionContactId = _safeTrim(sessionMember?.contactId || "");

            // SiteMember is the platform boundary; this explicit identity check
            // also prevents booking attribution when the member/contact context
            // cannot be resolved. Never accept IDs supplied by the browser.
            if (!sessionMemberId || !sessionContactId) {
                throw createBookingError(
                    ERROR_CODES.AUTH_REQUIRED,
                    "An authenticated Wix member with memberId and contactId is required to book.",
                    { traceId }
                );
            }

            const validatedDto = _validateProcessBookingPayload(
                unsafePayload,
                traceId,
                sessionMemberId,
                sessionContactId
            );

            await _rateLimitOrThrow(
                "public-booking",
                sessionMemberId || _safeTrim(unsafePayload?.email) || "anon",
                traceId
            );

            const normalizedPayload = {
                ...validatedDto,
                traceId: validatedDto.traceId || traceId,
            };

            return await executeBookingSaga(normalizedPayload);
        } catch (error) {
            return _handleError(error, "processDualBooking", traceId);
        }
    }
);

export const confirmPayment = webMethod(
    Permissions.SiteMember,
    async (payload) => {
        const traceId = payload?.traceId || makeTraceId("confirm-pay");
        try {
            await _rateLimitOrThrow(
                "citasManager.confirmPayment",
                _safeTrim(payload?.orderId) || "anon",
                traceId
            );

            const orderId = _safeTrim(payload?.orderId);
            const bookingIds = Array.isArray(payload?.bookingIds)
                ? Array.from(
                    new Set(
                        payload.bookingIds
                            .map((id) => _safeTrim(id))
                            .filter((id) => _looksLikeGuid(id))
                    )
                )
                : [];
            const requestedAmount = _readPositiveAmount(payload?.amount);

            if (!orderId || bookingIds.length === 0) {
                return {
                    status: "ERROR",
                    data: null,
                    error: {
                        code: "INVALID_PAYLOAD",
                        message: "orderId and valid bookingIds are required.",
                    },
                };
            }

            const citas = [];
            for (const bookingId of bookingIds) {
                const cita = await _findCitaByOrderAndBookingId(
                    orderId,
                    bookingId
                );
                if (!cita) {
                    return {
                        status: "ERROR",
                        data: null,
                        error: {
                            code: "CITA_NOT_FOUND",
                            message: "Booking record was not found.",
                        },
                    };
                }
                await _assertBookingOwner(cita, traceId);
                citas.push(cita);
            }

            const expandedCitas = new Map(
                citas.map(cita => [
                    _safeTrim(cita?.[FIELD_BOOKING_ID] || cita?.bookingId || ""),
                    cita,
                ])
            );
            for (const cita of citas) {
                const meta = _getCitaMeta(cita);
                const pairToken = _safeTrim(
                    cita?.[FIELD_PAIR_TOKEN] || meta.pairToken || ""
                );
                if (!pairToken) continue;

                const pairedCitas = await _findCitasByPairToken(pairToken);
                for (const pairedCita of pairedCitas) {
                    const pairedBookingId = _safeTrim(
                        pairedCita?.[FIELD_BOOKING_ID] || pairedCita?.bookingId || ""
                    );
                    if (!pairedBookingId || expandedCitas.has(pairedBookingId)) continue;
                    await _assertBookingOwner(pairedCita, traceId);
                    expandedCitas.set(pairedBookingId, pairedCita);
                }
            }
            citas.splice(0, citas.length, ...expandedCitas.values());

            await _validatePaymentCitaSet(citas, orderId, traceId);
            await _validatePaymentIdempotency(citas, orderId, traceId);

            for (const cita of citas) {
                if (!_isOnlinePaymentAllowed(cita)) {
                    throw createBookingError(
                        ERROR_CODES.INVALID_PAYLOAD,
                        "This booking is not configured for online payment.",
                        { traceId }
                    );
                }
            }

            const alreadyPaid = citas.every((cita) => {
                const meta = _getCitaMeta(cita);
                return (
                    String(
                        cita?.[FIELD_PAYMENT_STATUS] ||
                        meta.paymentStatus ||
                        ""
                    ).toUpperCase() === PAYMENT_STATUS.PAID &&
                    _safeTrim(meta.orderId || "") === orderId
                );
            });

            if (alreadyPaid) {
                return {
                    status: "SUCCESS",
                    data: {
                        paymentStatus: PAYMENT_STATUS.PAID,
                        confirmed: true,
                        amount: requestedAmount || 0,
                        idempotent: true,
                    },
                    error: null,
                };
            }

            const { finalAmount } = await _getValidatedPaidOrder(
                orderId,
                bookingIds,
                requestedAmount,
                traceId
            );

            const linkedBookingIds = citas.map(cita => _safeTrim(cita?.[FIELD_BOOKING_ID] || cita?.bookingId || "")).filter(Boolean).join(",");

            const ledgerResult = await registerBookingPayment(
                linkedBookingIds,
                finalAmount,
                PAYMENT_METHOD.WIX_PAYMENTS,
                {
                    concept: "Online booking payment",
                    resourceId: "online",
                    traceId,
                    transactionId: `ORDER-${orderId}`,
                    orderId,
                    origen: "WIX_ECOM_PAYMENT_CONFIRM",
                    movementType: MOVEMENT_TYPE.VENTA_ONLINE,
                    channelType: CHANNEL_TYPE.ONLINE,
                }
            );

            const ledgerPersisted = ["SUCCESS", "PARTIAL"].includes(ledgerResult?.status) &&
                Boolean(ledgerResult?.data?.cabeceraId || ledgerResult?.data?._id);

            if (!ledgerPersisted) {
                await logAuditEvent(
                    "PAYMENT_LEDGER_FAILED",
                    "ERROR",
                    "Payment ledger registration failed.",
                    {
                        orderId,
                        traceId,
                        error: ledgerResult?.error?.message || null,
                    },
                    traceId,
                    orderId,
                    AUDIT_SOURCE
                );
                return {
                    status: "ERROR",
                    data: null,
                    error: {
                        code: "LEDGER_FAIL",
                        message:
                            ledgerResult?.error?.message ||
                            "Payment registration failed.",
                    },
                };
            }

            const cashMovementId =
                ledgerResult?.data?.cabeceraId ||
                ledgerResult?.data?._id ||
                null;

            if (!cashMovementId) {
                await logAuditEvent(
                    "PAYMENT_LEDGER_FAILED",
                    "ERROR",
                    "Ledger registered without cash movement reference.",
                    { orderId, traceId, error: "LEDGER_REFERENCE_MISSING" },
                    traceId,
                    orderId,
                    AUDIT_SOURCE
                );
                return {
                    status: "ERROR",
                    data: null,
                    error: {
                        code: "LEDGER_REFERENCE_MISSING",
                        message:
                            "Payment could not be confirmed: ledger reference missing.",
                    },
                };
            }

            try {
                await _setCitasPaymentState(
                    citas,
                    PAYMENT_STATUS.PAID,
                    orderId,
                    cashMovementId,
                    traceId
                );
            } catch (stateError) {
                await logAuditEvent(
                    "PAYMENT_STATE_UPDATE_REQUIRED",
                    "ERROR",
                    "Fiscal payment exists; booking state requires retry.",
                    {
                        orderId,
                        transactionId: `ORDER-${orderId}`,
                        cashMovementId,
                        bookingIds: citas.map(cita => _safeTrim(cita?.[FIELD_BOOKING_ID] || cita?.bookingId || "")).filter(Boolean),
                        traceId,
                        error: stateError?.message || String(stateError),
                    },
                    traceId,
                    orderId,
                    AUDIT_SOURCE
                );
                return {
                    status: "ERROR",
                    data: null,
                    error: {
                        code: "PAYMENT_STATE_UPDATE_REQUIRED",
                        message:
                            "Payment is recorded. Retry reservation reconciliation; the existing ORDER transaction will be reused.",
                        transactionId: `ORDER-${orderId}`,
                        cashMovementId,
                    },
                };
            }

            await logAuditEvent(
                "PAYMENT_CONFIRMED",
                "INFO",
                "Booking payment confirmed.",
                { orderId, bookingIds, amount: finalAmount, traceId },
                traceId,
                orderId,
                AUDIT_SOURCE
            );

            return {
                status: "SUCCESS",
                data: {
                    paymentStatus: PAYMENT_STATUS.PAID,
                    confirmed: true,
                    amount: finalAmount,
                },
                error: null,
            };
        } catch (error) {
            const normalized = normalizeError(error);
            log.error("confirmPayment failed", {
                code: normalized.code,
                error: normalized.message,
                traceId,
            });
            return {
                status: "ERROR",
                data: null,
                error: {
                    code: normalized.code || "CONFIRM_PAY_FAIL",
                    message: normalized.message,
                },
            };
        }
    }
);

// =============================================================================
// ORDER VALIDATION
// =============================================================================
async function _getValidatedPaidOrder(
    orderId,
    bookingIds,
    requestedTotalAmount,
    traceId
) {
    const normalizedOrderId = _safeTrim(orderId);
    if (!normalizedOrderId) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "orderId is required",
            { traceId }
        );
    }

    let order;
    try {
        order = await withTimeout(
            getOrderElevated(normalizedOrderId),
            API_TIMEOUT_MS,
            "getOrder"
        );
    } catch (error) {
        throw createBookingError(
            ERROR_CODES.DATABASE_ERROR,
            "Failed to fetch order.",
            { traceId, cause: error?.message }
        );
    }

    if (!order) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "Order not found",
            { traceId }
        );
    }

    const paymentStatus = String(order?.paymentStatus || "").toUpperCase();
    if (!_isPaidOrderStatus(paymentStatus)) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "Order is not paid.",
            { traceId, paymentStatus }
        );
    }

    const bookingLineItems = _getOrderBookingLineItems(order);

    const orderBookingIds = Array.from(
        new Set(
            bookingLineItems
                .map((item) =>
                    _safeTrim(item?.catalogReference?.catalogItemId || "")
                )
                .filter(Boolean)
        )
    );

    const requestedIds = new Set(bookingIds.map(String));
    for (const id of requestedIds) {
        if (!orderBookingIds.includes(id)) {
            throw createBookingError(
                ERROR_CODES.INVALID_PAYLOAD,
                "Booking is not included in the order.",
                { traceId, bookingId: id }
            );
        }
    }

    const orderTotal =
        Number(order?.priceSummary?.total?.amount ?? 0) || 0;
    const lineItemsTotal = _getBookingLineItemsTotal(bookingLineItems);
    const finalAmount = orderTotal > 0 ? orderTotal : lineItemsTotal;

    if (
        requestedTotalAmount &&
        Math.abs(finalAmount - requestedTotalAmount) > 0.01
    ) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "Amount does not match the order.",
            { traceId }
        );
    }

    return { order, finalAmount, bookingLineItems };
}

async function _validatePaymentCitaSet(citas, orderId, traceId) {
    for (const cita of citas) {
        const meta = _getCitaMeta(cita);
        const currentPaymentStatus = String(
            cita?.[FIELD_PAYMENT_STATUS] || meta.paymentStatus || ""
        ).toUpperCase();
        const existingOrderId = _safeTrim(meta.orderId || "");
        const bookingId = _safeTrim(
            cita?.[FIELD_BOOKING_ID] || cita?.bookingId || ""
        );

        if (currentPaymentStatus === PAYMENT_STATUS.REFUNDED) {
            throw createBookingError(
                ERROR_CODES.INVALID_PAYLOAD,
                "Booking has already been refunded.",
                { traceId, bookingId, orderId }
            );
        }

        if (
            currentPaymentStatus === PAYMENT_STATUS.PAID &&
            existingOrderId !== orderId
        ) {
            throw createBookingError(
                ERROR_CODES.INVALID_PAYLOAD,
                "Booking has already been paid with another order.",
                { traceId, bookingId, orderId, existingOrderId }
            );
        }

        const bookingStatus = String(
            cita?.[FIELD_STATUS] || cita?.bookingStatus || ""
        ).toUpperCase();
        if (
            BLOCKED_PAYMENT_STATES.has(bookingStatus) ||
            (bookingStatus && !ALLOWED_PAYMENT_CONFIRMATION_STATES.has(bookingStatus))
        ) {
            throw createBookingError(
                ERROR_CODES.INVALID_PAYLOAD,
                "Booking cannot be paid in its current state.",
                { traceId, bookingId, bookingStatus }
            );
        }
    }
}

async function _validatePaymentIdempotency(citas, orderId, traceId) {
    for (const cita of citas) {
        const meta = _getCitaMeta(cita);
        const existingOrderId = _safeTrim(meta.orderId || "");
        const paymentStatus = String(
            cita?.[FIELD_PAYMENT_STATUS] || meta.paymentStatus || ""
        ).toUpperCase();

        if (paymentStatus !== PAYMENT_STATUS.PAID) continue;

        if (!existingOrderId || existingOrderId !== orderId) {
            throw createBookingError(
                ERROR_CODES.INVALID_PAYLOAD,
                "Booking has already been paid.",
                { traceId, orderId, existingOrderId }
            );
        }

    }

    // A mixed PAID/unpaid pair is a recoverable partial write. Every row already
    // marked PAID was checked above to belong to this order; confirmPayment can
    // reuse ORDER-{orderId} and repair the remaining CitasF2 rows.
}

async function _setCitasPaymentState(
    citas,
    paymentState,
    orderId,
    cashMovementId,
    traceId
) {
    for (const cita of citas) {
        const bookingId = _safeTrim(
            cita?.[FIELD_BOOKING_ID] || cita?.bookingId || ""
        );
        if (!bookingId) {
            throw createBookingError(
                ERROR_CODES.INVALID_PAYLOAD,
                "Booking identifier is missing.",
                { traceId }
            );
        }

        await _updateCitaSafe(
            bookingId,
            (currentCita) => {
                const meta = _getCitaMeta(currentCita);
                return {
                    ...currentCita,
                    [FIELD_PAYMENT_STATUS]: paymentState,
                    [FIELD_CASH_MOVEMENT_ID]: cashMovementId || null,
                    [FIELD_TRACE_ID]: traceId,
                    meta: {
                        ...meta,
                        paymentStatus: paymentState,
                        cashMovementId: cashMovementId || null,
                        orderId: orderId || null,
                        traceId,
                        fechaConfirmacionPago: new Date(),
                    },
                };
            },
            traceId,
            "citasManager_setPaymentState"
        );
    }
}

// =============================================================================
// OWNERSHIP
// =============================================================================
async function _assertBookingOwner(cita, traceId) {
    if (!cita) {
        throw createBookingError(
            ERROR_CODES.AUTH_REQUIRED,
            "Booking was not found.",
            { traceId }
        );
    }

    const member = await _getCurrentMemberInfo();
    if (!member) {
        throw createBookingError(
            ERROR_CODES.AUTH_REQUIRED,
            "Authenticated member is required for this operation.",
            { traceId }
        );
    }

    const currentMemberId = _getMemberId(member);
    if (!currentMemberId) {
        throw createBookingError(
            ERROR_CODES.AUTH_REQUIRED,
            "Member ID could not be determined.",
            { traceId }
        );
    }

    const resourceId = _safeTrim(
        cita?.[FIELD_RESOURCE_ID] || cita?.resourceId || ""
    );
    if (resourceId) {
        const staffAccess = await _getStaffAccess(resourceId, traceId);
        if (
            staffAccess &&
            _safeTrim(member.contactId) &&
            staffAccess.contactId === _safeTrim(member.contactId) &&
            staffAccess.roleWebsite === ROL_WEBSITE.ADMIN
        ) {
            return {
                memberId: currentMemberId,
                via: "STAFF_ROLE",
                role: staffAccess.roleWebsite,
            };
        }
    }

    const meta = _getCitaMeta(cita);
    const contactDetails =
        cita?.[FIELD_CONTACT_DETAILS] || meta.contactDetails || {};
    const citaMemberId = _safeTrim(contactDetails?.memberId || "");

    if (citaMemberId && citaMemberId === currentMemberId) {
        return { memberId: currentMemberId, via: "MEMBER_ID_MATCH" };
    }

    throw createBookingError(
        ERROR_CODES.AUTH_REQUIRED,
        "You are not authorized for this booking.",
        { traceId }
    );
}

// =============================================================================
// BOOKING LOOKUP Y SLOTS
// =============================================================================
function _getBookingSlotFromCita(cita) {
    return {
        serviceId: _safeTrim(
            cita?.[FIELD_SERVICE_ID] || cita?.serviceId || ""
        ),
        resourceId: _safeTrim(
            cita?.[FIELD_RESOURCE_ID] || cita?.resourceId || ""
        ),
        slotStart: _toDateSafe(cita?.[FIELD_SLOT_START]) || null,
        slotEnd: _toDateSafe(cita?.[FIELD_SLOT_END]) || null,
    };
}

/**
 * DUAL-SLOT-01: acepta `slot` como fallback de `slotRef`.
 * El DTO mínimo de reservas.web.js v10.19 devuelve `slot` (4 campos:
 * localStartDate, localEndDate, serviceId, resourceId) en lugar de
 * `slotRef` (objeto SDK completo).
 */
function _getDualSlotInput(payload, key) {
    const slot = payload?.[key];
    if (!slot || typeof slot !== "object" || Array.isArray(slot)) return null;

    const localStartDate = _normalizeLocalIsoStr(slot.localStartDate);
    const localEndDate = _normalizeLocalIsoStr(slot.localEndDate);
    const slotRef =
        slot.slotRef &&
        typeof slot.slotRef === "object" &&
        !Array.isArray(slot.slotRef)
            ? slot.slotRef
            : slot.slot &&
              typeof slot.slot === "object" &&
              !Array.isArray(slot.slot)
            ? slot.slot
            : null;

    if (!localStartDate || !localEndDate || !slotRef) return null;
    if (!_hasSlotReference(slotRef)) return null;

    return {
        localStartDate,
        localEndDate,
        slotRef,
        serviceId: _safeTrim(slot.serviceId || ""),
    };
}

function _hasSlotReference(slotRef) {
    if (!slotRef || typeof slotRef !== "object") return false;
    return Boolean(
        _safeTrim(slotRef.id || "") ||
        _safeTrim(slotRef.slotId || "") ||
        _safeTrim(slotRef.scheduleId || "") ||
        _safeTrim(slotRef.serviceId || "")
    );
}

function _slotReferenceMatches(inputSlot, result) {
    const returnedSlot = result?.data?.slot;
    if (!returnedSlot) return false;

    const inputStart = _normalizeLocalIsoStr(inputSlot.localStartDate);
    const inputEnd = _normalizeLocalIsoStr(inputSlot.localEndDate);
    const resultStart = _normalizeLocalIsoStr(
        returnedSlot.localStartDate || returnedSlot.startDate || ""
    );
    const resultEnd = _normalizeLocalIsoStr(
        returnedSlot.localEndDate || returnedSlot.endDate || ""
    );

    return inputStart === resultStart && inputEnd === resultEnd;
}

function _matchesCitaPairIdentifier(cita, token) {
    const meta = _getCitaMeta(cita);
    const pairToken = _safeTrim(
        cita?.[FIELD_PAIR_TOKEN] || meta.pairToken
    );
    return pairToken === _safeTrim(token);
}

function _buildDualRescheduleSlot(serviceConfig, inputSlot, expectedServiceId) {
    if (
        !serviceConfig ||
        !inputSlot?.localStartDate ||
        !inputSlot?.localEndDate
    ) {
        return null;
    }

    const linkedServiceId = _safeTrim(serviceConfig.linkedPhases || "");
    const expectedId = _safeTrim(expectedServiceId);

    if (!linkedServiceId || !expectedId || linkedServiceId !== expectedId) {
        return null;
    }

    return {
        serviceId: linkedServiceId,
        localStartDate: inputSlot.localStartDate,
        localEndDate: inputSlot.localEndDate,
    };
}

async function _loadServiceConfigForCita(cita, traceId) {
    const meta = _getCitaMeta(cita);
    const serviceId = _safeTrim(
        cita?.[FIELD_SERVICE_ID] || cita?.serviceId || meta.serviceId
    );

    if (!serviceId) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "Booking service is missing.",
            { traceId }
        );
    }

    const result = await _getServiceBySlugOrIdInternal(serviceId, traceId);
    if (result?.status !== "SUCCESS" || !result?.data) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "Booking service configuration was not found.",
            { traceId }
        );
    }

    return result.data;
}

// =============================================================================
// DUAL SLOT REVALIDATION
// =============================================================================
async function _revalidateDualInputSlots(
    citas,
    slotF1Input,
    slotF2Input,
    traceId
) {
    if (!slotF1Input?.localStartDate || !slotF1Input?.localEndDate) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "F1 slot dates are required.",
            { traceId }
        );
    }

    if (!slotF2Input?.localStartDate || !slotF2Input?.localEndDate) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "F2 slot dates are required.",
            { traceId }
        );
    }

    const { f1Cita, f2Cita } = _selectDualCitas(citas);

    if (!f1Cita || !f2Cita) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "Both dual booking phases are required.",
            { traceId }
        );
    }

    const f1ServiceId = _safeTrim(
        f1Cita?.[FIELD_SERVICE_ID] ||
        f1Cita?.serviceId ||
        _getCitaMeta(f1Cita).serviceId
    );
    const f2ServiceId = _safeTrim(
        f2Cita?.[FIELD_SERVICE_ID] ||
        f2Cita?.serviceId ||
        _getCitaMeta(f2Cita).serviceId
    );

    if (slotF1Input.serviceId && slotF1Input.serviceId !== f1ServiceId) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "F1 service does not match the booking.",
            { traceId, expected: f1ServiceId, received: slotF1Input.serviceId }
        );
    }

    if (slotF2Input.serviceId && slotF2Input.serviceId !== f2ServiceId) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "F2 service does not match the booking.",
            { traceId, expected: f2ServiceId, received: slotF2Input.serviceId }
        );
    }

    const f1ResourceId = _safeTrim(
        f1Cita?.[FIELD_RESOURCE_ID] || f1Cita?.resourceId || ""
    );
    const f2ResourceId = _safeTrim(
        f2Cita?.[FIELD_RESOURCE_ID] || f2Cita?.resourceId || ""
    );

    if (f1ResourceId && f2ResourceId && f1ResourceId !== f2ResourceId) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "Dual phases must use the same staff member.",
            { traceId }
        );
    }

    const selectedResourceId = f1ResourceId || f2ResourceId || null;
    const f1Addons = _getAddOnIdsForRevalidation(f1Cita);
    const f2Addons = _getAddOnIdsForRevalidation(f2Cita);

    const f1Result = await revalidateExactAvailabilitySlot({
        serviceId: f1ServiceId,
        localStartDate: slotF1Input.localStartDate,
        localEndDate: slotF1Input.localEndDate,
        resourceId: selectedResourceId,
        nativeAddonIds: f1Addons,
        traceId,
    });

    if (
        f1Result?.status !== "SUCCESS" ||
        !_slotReferenceMatches(slotF1Input, f1Result)
    ) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "F1 slot could not be verified.",
            { traceId }
        );
    }

    const f2Result = await revalidateExactAvailabilitySlot({
        serviceId: f2ServiceId,
        localStartDate: slotF2Input.localStartDate,
        localEndDate: slotF2Input.localEndDate,
        resourceId: selectedResourceId,
        nativeAddonIds: f2Addons,
        traceId,
    });

    if (
        f2Result?.status !== "SUCCESS" ||
        !_slotReferenceMatches(slotF2Input, f2Result)
    ) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "F2 slot could not be verified.",
            { traceId }
        );
    }

    const range = toUtcRange(
        slotF1Input.localStartDate,
        slotF1Input.localEndDate
    );
    const f2StartUtc = getUtcDateFromMadridLocal(slotF2Input.localStartDate);

    if (!range || !f2StartUtc) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "Dual slot dates are invalid.",
            { traceId }
        );
    }

    const { endUtc: f1EndUtc } = range;

    if (f2StartUtc.getTime() < f1EndUtc.getTime()) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "F2 must start after F1.",
            { traceId }
        );
    }

    const serviceConfig = await _loadServiceConfigForCita(f1Cita, traceId);

    const rawExposureMinutes = Number(serviceConfig?.exposureDuration);
    if (!Number.isFinite(rawExposureMinutes) || rawExposureMinutes < 0) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "ServiciosCatalogo.exposureDuration must be a non-negative number of minutes.",
            { traceId, exposureDuration: serviceConfig?.exposureDuration }
        );
    }
    const exposureMinutes = rawExposureMinutes;

    const gapMinutes = (f2StartUtc.getTime() - f1EndUtc.getTime()) / 60000;

    if (gapMinutes !== exposureMinutes) {
        log.warn("[rescheduleDual] gap no coincide con exposureDuration", {
            traceId,
            gapMinutes,
            exposureMinutes,
            f1End: slotF1Input.localEndDate,
            f2Start: slotF2Input.localStartDate,
        });
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "Gap between F1 and F2 must exactly match ServiciosCatalogo.exposureDuration.",
            { traceId, gapMinutes, exposureMinutes }
        );
    }

    return {
        f1Cita,
        f2Cita,
        f1Result,
        f2Result,
        selectedResourceId,
        serviceConfig,
        gapMinutes,
        exposureMinutes,
    };
}

// =============================================================================
// RESCHEDULE
// =============================================================================
async function _fetchLiveRevision(bookingId, cita) {
    const id = _safeTrim(bookingId);
    if (!id || !_looksLikeGuid(id)) {
        log.warn("_fetchLiveRevision: invalid bookingId", { bookingId: id });
        return _safeTrim(cita?.revision || _getCitaMeta(cita).writerRevision || "") || "";
    }

    try {
        const live = await withTimeout(
            getBookingElevated(id),
            API_TIMEOUT_MS,
            "getBookingForRevision"
        );
        const liveBooking = live?.booking || live;
        const revision = _safeTrim(liveBooking?.revision);
        if (revision) return revision;
    } catch (error) {
        log.warn("_fetchLiveRevision: getBooking failed; fallback to cita.revision", {
            bookingId: id,
            error: error?.message,
        });
    }

    const meta = _getCitaMeta(cita);
    return _safeTrim(cita?.revision || meta.writerRevision || "") || "";
}

function _assertReschedulableCita(cita, traceId) {
    const bookingStatus = _safeTrim(
        cita?.[FIELD_STATUS] || cita?.bookingStatus || ""
    ).toUpperCase();

    if (!ALLOWED_RESCHEDULE_STATES.has(bookingStatus)) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "Booking cannot be rescheduled in its current state.",
            { traceId, bookingStatus }
        );
    }

    const currentSlot = _getBookingSlotFromCita(cita);
    if (currentSlot.slotEnd && currentSlot.slotEnd.getTime() <= Date.now()) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "Booking slot has already started or finished.",
            { traceId }
        );
    }

    return currentSlot;
}

/**
 * Enforce the @wix/bookings SDK BookedSlot identifier shape.
 * REST id aliases are intentionally rejected in this SDK-only path.
 */
function _assertPristineSlotIdContract(pristineSlot, traceId) {
    const resourceId = _safeTrim(pristineSlot?.resource?._id || "");
    const locationId = _safeTrim(pristineSlot?.location?._id || "");

    if (!resourceId || !_looksLikeGuid(resourceId)) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "pristineSlot.resource._id is required (GUID).",
            { traceId }
        );
    }
    if (!locationId || !_looksLikeGuid(locationId)) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "pristineSlot.location._id is required (GUID).",
            { traceId }
        );
    }
}

async function _rescheduleBookingNative(cita, slotInput, traceId) {
    const bookingId = _safeTrim(
        cita?.[FIELD_BOOKING_ID] || cita?.bookingId || ""
    );

    if (!bookingId || !_looksLikeGuid(bookingId)) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "Booking identifier is missing.",
            { traceId }
        );
    }

    const serviceId = _safeTrim(
        slotInput.serviceId ||
        cita?.[FIELD_SERVICE_ID] ||
        cita?.serviceId ||
        ""
    );
    const resourceId = _safeTrim(
        cita?.[FIELD_RESOURCE_ID] || cita?.resourceId || ""
    );

    const pristineSlot = await _forceStaffInPristineSlot(
        {
            localStartDate: slotInput.localStartDate,
            localEndDate: slotInput.localEndDate,
        },
        resourceId,
        serviceId,
        null
    );

    if (!pristineSlot) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "Could not build the reschedule slot.",
            { traceId, bookingId }
        );
    }

    /* PRISTINE-ID-01: contrato oficial SDK resource._id / location._id. */
    _assertPristineSlotIdContract(pristineSlot, traceId);

    const revision = await _fetchLiveRevision(bookingId, cita);
    if (!revision) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "Current booking revision is required to reschedule.",
            { traceId, bookingId }
        );
    }

    await withTimeout(
        rescheduleBookingElevated(bookingId, pristineSlot, {
            revision: String(revision),
        }),
        API_TIMEOUT_MS,
        "rescheduleBooking"
    );

    const startUtc = getUtcDateFromMadridLocal(slotInput.localStartDate);
    const endUtc = getUtcDateFromMadridLocal(slotInput.localEndDate);

    return {
        bookingId,
        startUtc,
        endUtc,
        dateYmd: _safeTrim(slotInput.localStartDate).slice(0, 10),
    };
}

function _selectDualCitas(citas) {
    const rows = Array.isArray(citas) ? citas : [];
    const f1Cita = rows.find((cita) => {
        const meta = _getCitaMeta(cita);
        return !(cita?.bookingType === BOOKING_TYPE.DUAL_F2 || meta.linkedF1BookingId);
    }) || rows[0];
    const f2Cita = rows.find((cita) => {
        const meta = _getCitaMeta(cita);
        return cita?.bookingType === BOOKING_TYPE.DUAL_F2 || Boolean(meta.linkedF1BookingId);
    }) || rows[1];
    return { f1Cita: f1Cita || null, f2Cita: f2Cita || null };
}

async function _readDualRescheduleJournal(journalId) {
    return queryFirstItem({
        dataCollectionId: CONTROL_COL,
        filter: wql.eq("_id", _safeTrim(journalId)),
        consistency: CONSISTENCY.STRONG,
    });
}

async function _createDualRescheduleJournal(identity, pairToken, traceId, payload) {
    const now = new Date().toISOString();
    const row = {
        _id: identity.journalId,
        controlType: CONTROL_TYPE.SYSTEM_FLAG,
        dedupeKey: identity.dedupeKey,
        pairToken: _safeTrim(pairToken),
        version: 0,
        payload: {
            ...payload,
            operationType: "DUAL_RESCHEDULE",
            operationHash: identity.operationHash,
            status: DUAL_RESCHEDULE_STATUS.IN_PROGRESS,
            traceId: _safeTrim(traceId),
            startedAt: now,
            updatedAt: now,
        },
        traceId: _safeTrim(traceId),
    };
    try {
        await dalInsert(CONTROL_COL, row);
        return { journal: row, created: true };
    } catch (error) {
        const existing = await _readDualRescheduleJournal(identity.journalId).catch(() => null);
        if (existing) return { journal: existing, created: false };
        throw error;
    }
}

async function _patchDualRescheduleJournal(journal, patch, traceId) {
    if (!journal?._id || !Number.isInteger(Number(journal.version))) {
        throw createBookingError(
            ERROR_CODES.DATABASE_ERROR,
            "Dual reschedule journal version is missing or invalid.",
            { traceId, journalId: journal?._id || null }
        );
    }
    const expectedVersion = Number(journal.version);
    const payload = {
        ...(journal.payload && typeof journal.payload === "object" ? journal.payload : {}),
        ...patch,
        traceId: _safeTrim(traceId),
        updatedAt: new Date().toISOString(),
    };
    const result = await bulkPatchItems(
        CONTROL_COL,
        [journal._id],
        [[
            { fieldPath: "payload", action: "SET_FIELD", value: payload },
            { fieldPath: "version", action: "INCREMENT_FIELD", value: 1 },
            { fieldPath: "traceId", action: "SET_FIELD", value: _safeTrim(traceId) },
        ]],
        {
            condition: {
                filter: {
                    controlType: { $eq: CONTROL_TYPE.SYSTEM_FLAG },
                    version: { $eq: expectedVersion },
                },
            },
        }
    );
    if (!Array.isArray(result?.updatedItemIds) || !result.updatedItemIds.includes(journal._id)) {
        throw createBookingError(
            ERROR_CODES.DATABASE_ERROR,
            "Dual reschedule journal compare-and-swap conflict.",
            { traceId, journalId: journal._id, expectedVersion }
        );
    }
    return {
        ...journal,
        version: expectedVersion + 1,
        payload,
        traceId: _safeTrim(traceId),
    };
}

function _isSameSlotDates(currentStart, currentEnd, targetStart, targetEnd) {
    const aStart = _toDateSafe(currentStart);
    const aEnd = _toDateSafe(currentEnd);
    const bStart = _toDateSafe(targetStart);
    const bEnd = _toDateSafe(targetEnd);
    return Boolean(
        aStart && aEnd && bStart && bEnd &&
        aStart.getTime() === bStart.getTime() &&
        aEnd.getTime() === bEnd.getTime()
    );
}

async function _applyRescheduleToCita(cita, rescheduleResult, traceId, expectedOriginalSlot) {
    const bookingId = rescheduleResult.bookingId;
    const previousSlot = expectedOriginalSlot || _getBookingSlotFromCita(cita);
    let alreadyProjected = false;

    const projection = await _updateCitaSafe(
        bookingId,
        (currentCita) => {
            if (_isSameSlotDates(
                currentCita?.[FIELD_SLOT_START],
                currentCita?.[FIELD_SLOT_END],
                rescheduleResult.startUtc,
                rescheduleResult.endUtc
            )) {
                alreadyProjected = true;
                return null;
            }

            if (!_isSameSlotDates(
                currentCita?.[FIELD_SLOT_START],
                currentCita?.[FIELD_SLOT_END],
                previousSlot.slotStart,
                previousSlot.slotEnd
            )) {
                throw new Error("CITA_SLOT_CHANGED_OUTSIDE_RESCHEDULE_OPERATION");
            }

            const currentMeta = _getCitaMeta(currentCita);
            return {
                ...currentCita,
                [FIELD_SLOT_START]: rescheduleResult.startUtc,
                [FIELD_SLOT_END]: rescheduleResult.endUtc,
                dateYmd: rescheduleResult.dateYmd,
                [FIELD_TRACE_ID]: traceId,
                meta: {
                    ...currentMeta,
                    previousSlotStart: previousSlot.slotStart || null,
                    previousSlotEnd: previousSlot.slotEnd || null,
                    rescheduledAt: new Date(),
                    traceId,
                },
            };
        },
        traceId,
        "citasManager_reschedule"
    );

    if (!projection?.updated && !(projection?.reason === "NO_CHANGE" && alreadyProjected)) {
        throw createBookingError(
            ERROR_CODES.DATABASE_ERROR,
            "CMS projection of the rescheduled booking failed.",
            {
                traceId,
                bookingId,
                reason: projection?.reason || "UNKNOWN",
                error: projection?.error || null,
            }
        );
    }

    try {
        const serviceId = _safeTrim(
            cita?.[FIELD_SERVICE_ID] || cita?.serviceId || ""
        );
        const resourceId = _safeTrim(
            cita?.[FIELD_RESOURCE_ID] || cita?.resourceId || ""
        );
        const { _invalidateCachesInternal } = await import(
            "backend/reservas.web.js"
        ).catch(() => ({ _invalidateCachesInternal: null }));

        if (typeof _invalidateCachesInternal === "function") {
            await _invalidateCachesInternal(
                serviceId,
                rescheduleResult.dateYmd,
                resourceId,
                traceId
            ).catch(() => null);
        }
    } catch (_) {
        /* best effort */
    }

    return {
        updated: Boolean(projection?.updated),
        alreadyProjected,
        bookingId,
    };
}

async function _markDualPairInconsistent(pairToken, reason, traceId, error) {
    const dedupeKey = `DUAL_INCONSISTENT_${_safeTrim(pairToken)}`;
    try {
        await dalInsert(CONTROL_COL, {
            controlType: CONTROL_TYPE.SYSTEM_FLAG,
            dedupeKey,
            pairToken: _safeTrim(pairToken),
            payload: {
                reason,
                traceId: _safeTrim(traceId),
                error: error?.message || String(error || ""),
                markedAt: new Date().toISOString(),
                status: "REPAIR_REQUIRED",
            },
            traceId: _safeTrim(traceId) || makeTraceId("inconsistent"),
        });
        log.error("CM5-14: dual pair marked inconsistent", {
            pairToken,
            reason,
            traceId,
        });
    } catch (insertError) {
        log.error("CM5-14: failed to mark dual pair inconsistent", {
            pairToken,
            reason,
            traceId,
            error: insertError?.message,
        });
    }
}

export const rescheduleExistingBooking = webMethod(
    Permissions.SiteMember,
    async (payload) => {
        const traceId = payload?.traceId || makeTraceId("resched");
        try {
            await _rateLimitOrThrow(
                "citasManager.rescheduleExistingBooking",
                _safeTrim(payload?.bookingId) || "anon",
                traceId
            );

            const bookingId = _safeTrim(payload?.bookingId);
            if (!bookingId || !_looksLikeGuid(bookingId)) {
                throw createBookingError(
                    ERROR_CODES.INVALID_PAYLOAD,
                    "bookingId is required.",
                    { traceId }
                );
            }

            const localStartDate = _normalizeLocalIsoStr(
                payload?.slotF1?.localStartDate || ""
            );
            const localEndDate = _normalizeLocalIsoStr(
                payload?.slotF1?.localEndDate || ""
            );

            if (!localStartDate || !localEndDate) {
                throw createBookingError(
                    ERROR_CODES.INVALID_PAYLOAD,
                    "slotF1.localStartDate and localEndDate are required.",
                    { traceId }
                );
            }

            const cita = await _findCitaByBookingId(bookingId);
            if (!cita) {
                throw createBookingError(
                    ERROR_CODES.INVALID_PAYLOAD,
                    "Booking record was not found.",
                    { traceId }
                );
            }

            await _assertBookingOwner(cita, traceId);
            _assertReschedulableCita(cita, traceId);

            const citaServiceId = _safeTrim(
                cita?.[FIELD_SERVICE_ID] || cita?.serviceId || ""
            );
            const requestedServiceId = _safeTrim(
                payload?.slotF1?.serviceId || ""
            );

            if (requestedServiceId && requestedServiceId !== citaServiceId) {
                throw createBookingError(
                    ERROR_CODES.INVALID_PAYLOAD,
                    "Requested service does not match the booking.",
                    { traceId, expected: citaServiceId }
                );
            }

            const resourceId = _safeTrim(
                cita?.[FIELD_RESOURCE_ID] || cita?.resourceId || ""
            );

            const revalidated = await revalidateExactAvailabilitySlot({
                serviceId: citaServiceId,
                localStartDate,
                localEndDate,
                resourceId,
                nativeAddonIds: _getAddOnIdsForRevalidation(cita),
                traceId,
            });

            if (revalidated?.status !== "SUCCESS") {
                throw createBookingError(
                    ERROR_CODES.SLOT_UNAVAILABLE,
                    "New slot could not be verified.",
                    { traceId }
                );
            }

            const slotInput = {
                localStartDate,
                localEndDate,
                serviceId: citaServiceId,
            };

            const rescheduleResult = await _rescheduleBookingNative(
                cita,
                slotInput,
                traceId
            );

            await _applyRescheduleToCita(cita, rescheduleResult, traceId);

            await logAuditEvent(
                "BOOKING_RESCHEDULED",
                "INFO",
                "Booking rescheduled.",
                {
                    bookingId,
                    traceId,
                    newStart: localStartDate,
                    newEnd: localEndDate,
                },
                traceId,
                bookingId,
                AUDIT_SOURCE
            );

            return {
                status: "SUCCESS",
                data: {
                    bookingId,
                    slotStart: rescheduleResult.startUtc,
                    slotEnd: rescheduleResult.endUtc,
                    dateYmd: rescheduleResult.dateYmd,
                },
                error: null,
            };
        } catch (error) {
            return _handleError(error, "rescheduleExistingBooking", traceId);
        }
    }
);

export const rescheduleDualBookings = webMethod(
    Permissions.SiteMember,
    async (payload) => {
        const traceId = payload?.traceId || makeTraceId("resched-dual");
        const lockOwnerId = `${traceId}:${makeTraceId("dual-reschedule")}`;
        const acquiredLockKeys = [];
        const acquiredLockVersions = {};
        const acquiredLockTokens = {};
        let lockHeartbeat = null;
        let journal = null;

        try {
            await _rateLimitOrThrow(
                "citasManager.rescheduleDualBookings",
                _safeTrim(payload?.pairToken) || "anon",
                traceId
            );

            const pairToken = _safeTrim(payload?.pairToken);
            if (!pairToken) {
                throw createBookingError(
                    ERROR_CODES.INVALID_PAYLOAD,
                    "pairToken is required.",
                    { traceId }
                );
            }

            const slotF1Input = _getDualSlotInput(payload, "slotF1");
            const slotF2Input = _getDualSlotInput(payload, "slotF2");
            if (!slotF1Input || !slotF2Input) {
                throw createBookingError(
                    ERROR_CODES.INVALID_PAYLOAD,
                    "slotF1 and slotF2 with localStartDate, localEndDate and slot/slotRef are required.",
                    { traceId }
                );
            }

            const citas = await _findCitasByPairToken(pairToken);
            const matched = citas.filter((cita) =>
                _matchesCitaPairIdentifier(cita, pairToken)
            );
            if (matched.length < 2) {
                throw createBookingError(
                    ERROR_CODES.INVALID_PAYLOAD,
                    "Dual booking phases were not found for this pairToken.",
                    { traceId, found: matched.length }
                );
            }

            for (const cita of matched) {
                await _assertBookingOwner(cita, traceId);
                _assertReschedulableCita(cita, traceId);
            }

            const { f1Cita, f2Cita } = _selectDualCitas(matched);
            if (!f1Cita || !f2Cita) {
                throw createBookingError(
                    ERROR_CODES.INVALID_PAYLOAD,
                    "Both dual booking phases are required.",
                    { traceId, pairToken }
                );
            }

            const f1BookingId = _safeTrim(f1Cita?.[FIELD_BOOKING_ID] || f1Cita?.bookingId || "");
            const f2BookingId = _safeTrim(f2Cita?.[FIELD_BOOKING_ID] || f2Cita?.bookingId || "");
            const f1ServiceId = _safeTrim(f1Cita?.[FIELD_SERVICE_ID] || f1Cita?.serviceId || "");
            const f2ServiceId = _safeTrim(f2Cita?.[FIELD_SERVICE_ID] || f2Cita?.serviceId || "");
            const f1ResourceId = _safeTrim(f1Cita?.[FIELD_RESOURCE_ID] || f1Cita?.resourceId || "");
            const f2ResourceId = _safeTrim(f2Cita?.[FIELD_RESOURCE_ID] || f2Cita?.resourceId || "");
            if (f1ResourceId && f2ResourceId && f1ResourceId !== f2ResourceId) {
                throw createBookingError(
                    ERROR_CODES.INVALID_EMPLOYEE,
                    "Dual phases must use the same valid staff resource.",
                    { traceId, pairToken }
                );
            }
            const resourceHint = f1ResourceId || f2ResourceId ||
                _safeTrim(payload?.resourceId || "") || "AUTO";
            const operationId = _safeTrim(payload?.operationId || "");
            if (operationId && !_looksLikeGuid(operationId)) {
                throw createBookingError(
                    ERROR_CODES.INVALID_PAYLOAD,
                    "operationId must be a GUID when supplied.",
                    { traceId }
                );
            }

            const journalIdentity = await buildDualRescheduleJournalIdentity({
                pairToken,
                operationId,
                f1BookingId,
                f2BookingId,
                f1ServiceId,
                f2ServiceId,
                resourceId: resourceHint,
                targetF1Start: slotF1Input.localStartDate,
                targetF1End: slotF1Input.localEndDate,
                targetF2Start: slotF2Input.localStartDate,
                targetF2End: slotF2Input.localEndDate,
            });

            const existingJournal = await _readDualRescheduleJournal(journalIdentity.journalId);
            if (existingJournal) {
                journal = existingJournal;
                const status = _safeTrim(journal.payload?.status).toUpperCase();
                if (status === DUAL_RESCHEDULE_STATUS.COMPLETED && journal.payload?.result) {
                    return { status: "SUCCESS", data: journal.payload.result, error: null };
                }
                throw createBookingError(
                    ERROR_CODES.TOKEN_BUSY,
                    "This dual reschedule intent already has a journal and requires reconciliation before retry.",
                    {
                        traceId,
                        pairToken,
                        journalId: journalIdentity.journalId,
                        journalStatus: status || "UNKNOWN",
                    }
                );
            }

            const validation = await _revalidateDualInputSlots(
                matched,
                slotF1Input,
                slotF2Input,
                traceId
            );
            const resourceId = _safeTrim(validation.selectedResourceId);
            if (!resourceId || (resourceHint !== "AUTO" && resourceId !== resourceHint)) {
                throw createBookingError(
                    ERROR_CODES.INVALID_EMPLOYEE,
                    "The selected resource changed during dual reschedule validation.",
                    { traceId, pairToken }
                );
            }
            const serviceConfig = validation.serviceConfig;
            const f2ExpectedServiceId = f2ServiceId;
            const dualF2Slot = _buildDualRescheduleSlot(
                serviceConfig,
                slotF2Input,
                f2ExpectedServiceId
            );
            if (!dualF2Slot) {
                throw createBookingError(
                    ERROR_CODES.INVALID_PAYLOAD,
                    "F2 slot does not correspond to the linked phase of the service.",
                    { traceId, expected: f2ExpectedServiceId }
                );
            }

            // Lock both original and target F1/F2 intervals in canonical order.
            // The exposure gap is intentionally excluded: it remains bookable.
            const originalF1Slot = _getBookingSlotFromCita(f1Cita);
            const originalF2Slot = _getBookingSlotFromCita(f2Cita);
            const lockCandidates = [
                { serviceId: originalF1Slot.serviceId, start: originalF1Slot.slotStart, end: originalF1Slot.slotEnd },
                { serviceId: originalF2Slot.serviceId, start: originalF2Slot.slotStart, end: originalF2Slot.slotEnd },
                { serviceId: f1ServiceId, start: slotF1Input.localStartDate, end: slotF1Input.localEndDate },
                { serviceId: _safeTrim(dualF2Slot.serviceId), start: dualF2Slot.localStartDate, end: dualF2Slot.localEndDate },
            ];
            const lockServiceByKey = new Map();
            for (const candidate of lockCandidates) {
                if (!candidate.serviceId || !candidate.start || !candidate.end) {
                    throw createBookingError(
                        ERROR_CODES.INVALID_PAYLOAD,
                        "Original and target dual slots must be complete before locking.",
                        { traceId, pairToken }
                    );
                }
                const key = generateSlotKey(candidate.serviceId, resourceId, candidate.start, candidate.end);
                lockServiceByKey.set(key, candidate.serviceId);
            }

            const orderedLockKeys = Array.from(lockServiceByKey.keys()).sort();
            for (const key of orderedLockKeys) {
                const acquired = await _lockSlotKeyOrFail(
                    key,
                    lockOwnerId,
                    300000,
                    lockServiceByKey.get(key)
                );
                if (!acquired?.ok) {
                    throw createBookingError(
                        ERROR_CODES.TOKEN_BUSY,
                        "Dual reschedule conflicts with another booking operation.",
                        { traceId, pairToken, lockKey: key, reason: acquired?.message || acquired?.reason }
                    );
                }
                acquiredLockKeys.push(key);
                acquiredLockVersions[key] = acquired.version;
                acquiredLockTokens[key] = acquired.lockToken;
            }

            const lockServiceIdsByKey = {};
            for (const [key, serviceId] of lockServiceByKey.entries()) {
                lockServiceIdsByKey[key] = serviceId;
            }
            lockHeartbeat = _startLockHeartbeat({
                lockKeys: orderedLockKeys,
                lockOwnerId,
                lockTokens: acquiredLockTokens,
                lockVersions: acquiredLockVersions,
                lockServiceIds: lockServiceIdsByKey,
                ttlMs: 300000,
                intervalMs: 60000,
                traceId,
            });

            const journalAfterLock = await _readDualRescheduleJournal(journalIdentity.journalId);
            if (journalAfterLock) {
                journal = journalAfterLock;
                const status = _safeTrim(journal.payload?.status).toUpperCase();
                if (status === DUAL_RESCHEDULE_STATUS.COMPLETED && journal.payload?.result) {
                    return { status: "SUCCESS", data: journal.payload.result, error: null };
                }
                if (!isDualRescheduleTerminalStatus(status)) {
                    journal = await _patchDualRescheduleJournal(journal, {
                        status: DUAL_RESCHEDULE_STATUS.REPAIR_REQUIRED,
                        repairReason: "NONTERMINAL_JOURNAL_REENTRY_REQUIRES_READER_RECONCILIATION",
                    }, traceId);
                }
                throw createBookingError(
                    ERROR_CODES.TOKEN_BUSY,
                    "A previous dual reschedule attempt is not terminal and requires reconciliation.",
                    { traceId, pairToken, journalId: journalIdentity.journalId, journalStatus: status }
                );
            }

            const createdJournal = await _createDualRescheduleJournal(
                journalIdentity,
                pairToken,
                traceId,
                {
                    originalF1: {
                        serviceId: originalF1Slot.serviceId,
                        resourceId: originalF1Slot.resourceId,
                        slotStart: originalF1Slot.slotStart?.toISOString() || null,
                        slotEnd: originalF1Slot.slotEnd?.toISOString() || null,
                    },
                    originalF2: {
                        serviceId: originalF2Slot.serviceId,
                        resourceId: originalF2Slot.resourceId,
                        slotStart: originalF2Slot.slotStart?.toISOString() || null,
                        slotEnd: originalF2Slot.slotEnd?.toISOString() || null,
                    },
                    targetF1: {
                        serviceId: f1ServiceId,
                        localStartDate: slotF1Input.localStartDate,
                        localEndDate: slotF1Input.localEndDate,
                    },
                    targetF2: {
                        serviceId: _safeTrim(dualF2Slot.serviceId),
                        localStartDate: dualF2Slot.localStartDate,
                        localEndDate: dualF2Slot.localEndDate,
                    },
                    selectedResourceId: resourceId,
                    operationId: journalIdentity.canonical.operationId,
                    gapMinutes: validation.gapMinutes,
                    f1BookingId,
                    f2BookingId,
                }
            );
            journal = createdJournal.journal;
            if (!createdJournal.created) {
                const status = _safeTrim(journal.payload?.status).toUpperCase();
                if (status === DUAL_RESCHEDULE_STATUS.COMPLETED && journal.payload?.result) {
                    return { status: "SUCCESS", data: journal.payload.result, error: null };
                }
                if (!isDualRescheduleTerminalStatus(status)) {
                    journal = await _patchDualRescheduleJournal(journal, {
                        status: DUAL_RESCHEDULE_STATUS.REPAIR_REQUIRED,
                        repairReason: "DUPLICATE_JOURNAL_INSERT_REQUIRES_READER_RECONCILIATION",
                    }, traceId);
                }
                throw createBookingError(
                    ERROR_CODES.TOKEN_BUSY,
                    "Dual reschedule journal already exists and requires reconciliation.",
                    { traceId, pairToken, journalId: journalIdentity.journalId, journalStatus: status }
                );
            }

            journal = await _patchDualRescheduleJournal(journal, {
                status: DUAL_RESCHEDULE_STATUS.F1_IN_PROGRESS,
                f1StartedAt: new Date().toISOString(),
            }, traceId);

            let f1Result = null;
            try {
                lockHeartbeat.assertHealthy();
                f1Result = await _rescheduleBookingNative(f1Cita, slotF1Input, traceId);
            } catch (f1Error) {
                journal = await _patchDualRescheduleJournal(journal, {
                    status: DUAL_RESCHEDULE_STATUS.REPAIR_REQUIRED,
                    repairReason: "F1_NATIVE_RESULT_UNCERTAIN",
                    lastError: f1Error?.message || String(f1Error),
                    lastErrorCode: f1Error?.code || null,
                }, traceId);
                await _markDualPairInconsistent(
                    pairToken,
                    "DUAL_RESCHEDULE_F1_RESULT_UNCERTAIN",
                    traceId,
                    f1Error
                );
                throw f1Error;
            }

            journal = await _patchDualRescheduleJournal(journal, {
                status: DUAL_RESCHEDULE_STATUS.F1_DONE,
                f1CompletedAt: new Date().toISOString(),
                f1Result: {
                    bookingId: f1Result.bookingId,
                    startUtc: f1Result.startUtc?.toISOString?.() || null,
                    endUtc: f1Result.endUtc?.toISOString?.() || null,
                    dateYmd: f1Result.dateYmd,
                },
            }, traceId);

            lockHeartbeat.assertHealthy();
            journal = await _patchDualRescheduleJournal(journal, {
                status: DUAL_RESCHEDULE_STATUS.F2_IN_PROGRESS,
                f2StartedAt: new Date().toISOString(),
            }, traceId);

            let f2Result = null;
            try {
                f2Result = await _rescheduleBookingNative(f2Cita, dualF2Slot, traceId);
                lockHeartbeat.assertHealthy();
                journal = await _patchDualRescheduleJournal(journal, {
                    status: DUAL_RESCHEDULE_STATUS.F2_DONE,
                    f2CompletedAt: new Date().toISOString(),
                    f2Result: {
                        bookingId: f2Result.bookingId,
                        startUtc: f2Result.startUtc?.toISOString?.() || null,
                        endUtc: f2Result.endUtc?.toISOString?.() || null,
                        dateYmd: f2Result.dateYmd,
                    },
                }, traceId);
            } catch (f2Error) {
                journal = await _patchDualRescheduleJournal(journal, {
                    status: DUAL_RESCHEDULE_STATUS.REPAIR_REQUIRED,
                    repairReason: "F2_NATIVE_RESULT_UNCERTAIN_NO_AUTOMATIC_ROLLBACK",
                    lastError: f2Error?.message || String(f2Error),
                    lastErrorCode: f2Error?.code || null,
                }, traceId).catch(() => journal);
                await _markDualPairInconsistent(
                    pairToken,
                    "DUAL_RESCHEDULE_F2_RESULT_UNCERTAIN",
                    traceId,
                    f2Error
                );
                throw f2Error;
            }

            lockHeartbeat.assertHealthy();
            try {
                await _applyRescheduleToCita(f1Cita, f1Result, traceId, originalF1Slot);
                await _applyRescheduleToCita(f2Cita, f2Result, traceId, originalF2Slot);
                journal = await _patchDualRescheduleJournal(journal, {
                    status: DUAL_RESCHEDULE_STATUS.CMS_PROJECTED,
                    cmsProjectedAt: new Date().toISOString(),
                }, traceId);
            } catch (cmsError) {
                journal = await _patchDualRescheduleJournal(journal, {
                    status: DUAL_RESCHEDULE_STATUS.REPAIR_REQUIRED,
                    repairReason: "DUAL_CMS_PARTIAL_UPDATE",
                    lastError: cmsError?.message || String(cmsError),
                }, traceId).catch(() => journal);
                await _markDualPairInconsistent(
                    pairToken,
                    "DUAL_CMS_PARTIAL_UPDATE",
                    traceId,
                    cmsError
                );
                throw cmsError;
            }

            await logAuditEvent(
                "DUAL_BOOKING_RESCHEDULED",
                "INFO",
                "Dual booking rescheduled.",
                { pairToken, traceId, gapMinutes: validation.gapMinutes },
                traceId,
                pairToken,
                AUDIT_SOURCE
            );

            const resultData = {
                pairToken,
                f1: {
                    bookingId: f1Result.bookingId,
                    slotStart: f1Result.startUtc?.toISOString?.() || null,
                    slotEnd: f1Result.endUtc?.toISOString?.() || null,
                    dateYmd: f1Result.dateYmd,
                },
                f2: {
                    bookingId: f2Result.bookingId,
                    slotStart: f2Result.startUtc?.toISOString?.() || null,
                    slotEnd: f2Result.endUtc?.toISOString?.() || null,
                    dateYmd: f2Result.dateYmd,
                },
                gapMinutes: validation.gapMinutes,
            };
            journal = await _patchDualRescheduleJournal(journal, {
                status: DUAL_RESCHEDULE_STATUS.COMPLETED,
                completedAt: new Date().toISOString(),
                result: resultData,
            }, traceId);

            return {
                status: "SUCCESS",
                data: resultData,
                error: null,
            };
        } catch (error) {
            if (journal && lockHeartbeat && !isDualRescheduleTerminalStatus(journal.payload?.status)) {
                journal = await _patchDualRescheduleJournal(journal, {
                    status: DUAL_RESCHEDULE_STATUS.REPAIR_REQUIRED,
                    repairReason: "UNHANDLED_DUAL_RESCHEDULE_FAILURE",
                    lastError: error?.message || String(error),
                    lastErrorCode: error?.code || null,
                }, traceId).catch(() => journal);
            }
            return _handleError(error, "rescheduleDualBookings", traceId);
        } finally {
            if (lockHeartbeat) {
                const monitor = lockHeartbeat;
                monitor.stop();
                lockHeartbeat = null;
                await monitor.wait;
            }
            for (let i = acquiredLockKeys.length - 1; i >= 0; i -= 1) {
                const lockKey = acquiredLockKeys[i];
                const released = await _unlockSlotKey(lockKey, lockOwnerId, {
                    expectedVersion: acquiredLockVersions[lockKey],
                    expectedLockToken: acquiredLockTokens[lockKey],
                });
                if (!released?.ok) {
                    log.error("Dual reschedule slot lock release requires attention.", {
                        traceId,
                        pairToken: _safeTrim(payload?.pairToken),
                        lockKey,
                        reason: released?.reason || "LOCK_RELEASE_FAILED",
                    });
                }
            }
        }
    }
);
