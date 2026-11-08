/*
MODULE: backend/booking/bookingCore.js
VERSION: v5022-CONTROL-SERVICE-ID
BASE: v5020-CART-V2-ITEM-VALIDATION
RESPONSIBILITY: Primitivas atomicas de reserva (simple y dual con gap),
Bookings Writer V2, checkout Cart V2 de F1, locks, idempotencia,
persistencia CitasF2, proyeccion de slots y traduccion de enums en frontera.

CORRECCIONES v5021 (alineadas con la documentacion oficial de Wix Bookings V2):
  WIX-V2-ID-01 (P0): _resolveWriteLocation devuelve `{ id, locationType }`,
    no `{ _id, locationType }`. El contrato oficial de BookedSlot.Location
    es `{ id, name, formattedAddress, locationType }` (id, NO _id).
    Ref: https://dev.wix.com/docs/api-reference/business-solutions/bookings/
    bookings/bookings-writer-v2/create-booking
  WIX-V2-ID-02 (P0): _forceStaffInPristineSlot devuelve
    `resource: { id }`, no `resource: { _id }`. El contrato oficial de
    BookedSlot.Resource es `{ id, name, email, scheduleId }`.
  WIX-V2-ID-03 (P1): _forceStaffInPristineSlot acepta
    `resourceCandidate.id` (fallback a `_id` para compatibilidad).
  WIX-V2-ID-04 (P1): _projectCertifiedSlot lee `location.id` (antes ._id)
    para construir `locationId` interno.
  LOG-NOISE-01 (P2): eliminado el log.warn de thirdPartyId en
    _persistBooking. El campo es OPCIONAL en Bookings Writer V2.

CORRECCIONES v5017-STRONG-QUERY:
  CORE-52 (P0): elevatedQueryFind llamaba q.find() sin consistencyMode,
    degradando TODAS las queries a eventual. Ahora find({consistencyMode:"strong"}).

CART-01: Cart V2 solo entrega checkout si el carrito calculado contiene
    exactamente la reserva F1 esperada y no declara el item como no disponible.
FIXES HEREDADOS v5016: CORE-50/51 (CANCELLED dos L).
FIXES HEREDADOS v5015: CORE-46..CORE-49.
FIXES HEREDADOS v5014: CORE-39..CORE-45.
FIXES HEREDADOS v5013: CORE-30..CORE-38.
=============================================================================
*/

import { bookings } from "@wix/bookings";
import { cartV2 } from "@wix/ecom";
import { auth } from "@wix/essentials";
import {
    query as dalQuery,
    getItem as dalGet,
    insertItem as dalInsert,
    updateItem as dalUpdate,
    bulkPatchItems,
    removeById as dalRemove
} from "backend/dataAccess";
import { getStaffScheduleId } from "backend/staff";
// MATRIZ v15: helper de lectura dual del payload canonico de ControlOperativo.
import { readControlPayload } from "backend/data";
import { logger } from "backend/logger";
import { assertValidEnum } from "backend/validation";
import {
    BUSINESS_COLLECTIONS,
    OPERATIONAL_COLLECTIONS,
    CONTROL_TYPE,
    CONCURRENCY,
    normalizeBookingType,
    isDualBookingType,
    SDK_CONFIG,
    API,
    PAYMENT_STATUS,
    BOOKING_FIELDS,
    CITAS_BOOKING_STATUS,
    CITAS_PAYMENT_STATUS,
    WIX_CATALOG_APP_IDS,
} from "backend/internalConfig";
import {
    _safeTrim,
    _looksLikeGuid,
    _roundMoney,
    getUtcDateFromMadridLocal,
    getMadridLocalStringNoZ,
    makeTraceId,
    _toDateSafe,
    _hashKey,
    _normalizeLocalIsoStr,
    _generateUUID,
    _executeWithRetry,
    withTimeout,
} from "public/mmUtils";
import {
    getResourceIdsFromSlot,
    normalizeAvailabilitySlot,
    _normalizeGuidForComparison,
    _buildPairFingerprint,
    _buildPairTokenDeterministic,
} from "backend/booking/bookingUtils";

const log = logger;
const STAFF_RESOURCE_TYPE_ID = API.STAFF_RESOURCE_TYPE_ID;

const elevatedInsert = dalInsert;
const elevatedUpdate = dalUpdate;
const elevatedRemove = dalRemove;
const elevatedGet = function (collection, id) {
    return dalGet(collection, id, "strong");
};

/**
 * CORE-52: lectura fuerte obligatoria.
 */
function elevatedQueryFind(collection, queryFn) {
    return Promise.resolve(queryFn(dalQuery(collection))).then(function (q) {
        return q.find({ consistencyMode: "strong" });
    });
}

// =============================================================================
// BLOQUE 1 - CODIGOS DE ERROR
// =============================================================================
export const ERROR_CODES = Object.freeze({
    INVALID_PAYLOAD: "INVALID_PAYLOAD",
    TOKEN_BUSY: "TOKEN_BUSY",
    FISCAL_SIGN_FAIL: "FISCAL_SIGN_FAIL",
    FISCAL_VIOLATION: "FISCAL_VIOLATION",
    BOOKING_CREATION_FAILED: "BOOKING_CREATION_FAILED",
    CHECKOUT_FAILED: "CHECKOUT_FAILED",
    INVALID_EMPLOYEE: "INVALID_EMPLOYEE",
    AUTH_REQUIRED: "AUTH_REQUIRED",
    ACCESS_DENIED: "ACCESS_DENIED",
    INVALID_CLOCK_TYPE: "INVALID_CLOCK_TYPE",
    RATE_LIMITED: "RATE_LIMITED",
    SLOT_UNAVAILABLE: "SLOT_UNAVAILABLE",
    STAFF_UNAVAILABLE: "STAFF_UNAVAILABLE",
    SERVICE_NOT_FOUND: "SERVICE_NOT_FOUND",
    LOCATION_MISMATCH: "LOCATION_MISMATCH",
    LOCK_KEY_OR_OWNER_INVALID: "LOCK_KEY_OR_OWNER_INVALID",
    LOCK_HELD_BY_ANOTHER_OWNER: "LOCK_HELD_BY_ANOTHER_OWNER",
    LOCK_EXPIRED_PENDING_CLEANUP: "LOCK_EXPIRED_PENDING_CLEANUP",
    LOCK_RENEWAL_FAILED: "LOCK_RENEWAL_FAILED",
    LOCK_RACE: "LOCK_RACE",
    LOCK_OWNERSHIP_CHANGED: "LOCK_OWNERSHIP_CHANGED",
    LOCK_RELEASE_FAILED: "LOCK_RELEASE_FAILED",
    LOCK_CONFLICT: "LOCK_CONFLICT",
    TRANSACTION_TIMEOUT: "TRANSACTION_TIMEOUT",
    PAIR_TOKEN_PAYLOAD_MISMATCH: "PAIR_TOKEN_PAYLOAD_MISMATCH",
    TRANSACTION_PREVIOUSLY_FAILED: "TRANSACTION_PREVIOUSLY_FAILED",
    INVALID_SLOT_RECHECK: "INVALID_SLOT_RECHECK",
    DATABASE_ERROR: "DATABASE_ERROR",
    INVALID_DATES: "INVALID_DATES",
    UNKNOWN_ERROR: "UNKNOWN_ERROR",
});

// =============================================================================
// BLOQUE 2 - ENUMS EN FRONTERA
// =============================================================================
const CMS_BOOKING_CANCELLED =
    (CITAS_BOOKING_STATUS &&
        (CITAS_BOOKING_STATUS.CANCELLED || CITAS_BOOKING_STATUS.CANCELED)) ||
    "CANCELLED";
const CMS_BOOKING_REFUNDED =
    (CITAS_BOOKING_STATUS && CITAS_BOOKING_STATUS.REFUNDED) || "REFUNDED";

const WIX_TO_CMS_BOOKING_STATUS = Object.freeze({
    CREATED: CITAS_BOOKING_STATUS.PENDING,
    PENDING: CITAS_BOOKING_STATUS.PENDING,
    WAITING_LIST: CITAS_BOOKING_STATUS.PENDING,
    CONFIRMED: CITAS_BOOKING_STATUS.CONFIRMED,
    UPDATED: CITAS_BOOKING_STATUS.CONFIRMED,
    COMPLETED: CITAS_BOOKING_STATUS.COMPLETED,
    CANCELED: CMS_BOOKING_CANCELLED,
    CANCELLED: CMS_BOOKING_CANCELLED,
    DECLINED: CMS_BOOKING_CANCELLED,
    REFUNDED: CMS_BOOKING_REFUNDED,
    NO_SHOW: CITAS_BOOKING_STATUS.NO_SHOW,
    NOSHOW: CITAS_BOOKING_STATUS.NO_SHOW,
    PENDIENTE: CITAS_BOOKING_STATUS.PENDING,
    CONFIRMADO: CITAS_BOOKING_STATUS.CONFIRMED,
    COMPLETADO: CITAS_BOOKING_STATUS.COMPLETED,
    CANCELADO: CMS_BOOKING_CANCELLED,
    REEMBOLSADO: CMS_BOOKING_REFUNDED,
    NO_PRESENTADO: CITAS_BOOKING_STATUS.NO_SHOW,
});

const WIX_TO_CMS_PAYMENT_STATUS = Object.freeze({
    UNDEFINED: CITAS_PAYMENT_STATUS.UNDEFINED,
    NOT_PAID: CITAS_PAYMENT_STATUS.NOT_PAID,
    PENDING_PAYMENT: CITAS_PAYMENT_STATUS.PENDING_PAYMENT,
    PENDING_LEDGER: CITAS_PAYMENT_STATUS.PENDING_LEDGER,
    UNPAID: CITAS_PAYMENT_STATUS.NOT_PAID,
    PAID: CITAS_PAYMENT_STATUS.PAID,
    EXEMPT: CITAS_PAYMENT_STATUS.EXEMPT,
    PARTIALLY_PAID: CITAS_PAYMENT_STATUS.PARTIALLY_PAID,
    PARTIALLY_REFUNDED: CITAS_PAYMENT_STATUS.PARTIALLY_REFUNDED,
    PARTIAL: CITAS_PAYMENT_STATUS.PARTIALLY_PAID,
    REFUNDED: CITAS_PAYMENT_STATUS.REFUNDED,
    IMPAGADO: CITAS_PAYMENT_STATUS.NOT_PAID,
    NO_PAGADO: CITAS_PAYMENT_STATUS.NOT_PAID,
    PENDIENTE_PAGO: CITAS_PAYMENT_STATUS.PENDING_PAYMENT,
    PAGADO: CITAS_PAYMENT_STATUS.PAID,
    PARCIALMENTE_PAGADO: CITAS_PAYMENT_STATUS.PARTIALLY_PAID,
    REEMBOLSADO_PARCIAL: CITAS_PAYMENT_STATUS.PARTIALLY_REFUNDED,
    REEMBOLSADO: CITAS_PAYMENT_STATUS.REFUNDED,
    EXENTO: CITAS_PAYMENT_STATUS.EXEMPT,
});

export function _toCmsBookingStatus(value) {
    const v = _safeTrim(value).toUpperCase();
    if (!v) return "";
    return WIX_TO_CMS_BOOKING_STATUS[v] || "";
}

export function _toCmsPaymentStatus(value) {
    const v = _safeTrim(value).toUpperCase();
    if (!v) return "";
    return WIX_TO_CMS_PAYMENT_STATUS[v] || "";
}

const WIX_NATIVE_PAYMENT_STATUS = Object.freeze({
    UNDEFINED: PAYMENT_STATUS.UNDEFINED,
    NOT_PAID: PAYMENT_STATUS.NOT_PAID,
    PENDING_PAYMENT: PAYMENT_STATUS.PENDING_PAYMENT,
    PENDING_LEDGER: PAYMENT_STATUS.PENDING_LEDGER,
    PAID: PAYMENT_STATUS.PAID,
    PARTIALLY_PAID: PAYMENT_STATUS.PARTIALLY_PAID,
    REFUNDED: PAYMENT_STATUS.REFUNDED,
    PARTIALLY_REFUNDED: PAYMENT_STATUS.PARTIALLY_REFUNDED,
    EXEMPT: PAYMENT_STATUS.EXEMPT,
    IMPAGADO: PAYMENT_STATUS.NOT_PAID,
    NO_PAGADO: PAYMENT_STATUS.NOT_PAID,
    UNPAID: PAYMENT_STATUS.NOT_PAID,
    PAGADO: PAYMENT_STATUS.PAID,
    PARCIALMENTE_PAGADO: PAYMENT_STATUS.PARTIALLY_PAID,
    PARTIAL: PAYMENT_STATUS.PARTIALLY_PAID,
    REEMBOLSADO: PAYMENT_STATUS.REFUNDED,
    REEMBOLSADO_PARCIAL: PAYMENT_STATUS.PARTIALLY_REFUNDED,
    EXENTO: PAYMENT_STATUS.EXEMPT,
});

function _toWixNativePaymentStatus(value) {
    const v = _safeTrim(value).toUpperCase();
    if (!v) return value;
    return WIX_NATIVE_PAYMENT_STATUS[v] || value;
}

function _deriveCmsBookingStatus(cmsPaymentStatus) {
    if (
        cmsPaymentStatus === CITAS_PAYMENT_STATUS.NOT_PAID ||
        cmsPaymentStatus === CITAS_PAYMENT_STATUS.PENDING_PAYMENT ||
        cmsPaymentStatus === CITAS_PAYMENT_STATUS.PENDING_LEDGER
    ) {
        return CITAS_BOOKING_STATUS.PENDING;
    }
    return CITAS_BOOKING_STATUS.CONFIRMED;
}

// =============================================================================
// BLOQUE 3 - ELEVATED PROXIES
// =============================================================================
export const cancelBookingElevated = auth.elevate(bookings.cancelBooking);

export const createCartV2 = cartV2.createCart;
export const calculateCartV2 = cartV2.calculateCart;
export const getCartV2CheckoutUrl = cartV2.getCheckoutUrl;

const _confirmOrDeclineElevatedRaw = auth.elevate(
    bookings.confirmOrDeclineBooking
);

export async function createBookingCartCheckout(bookingId, traceId) {
    const normalizedBookingId = _safeTrim(bookingId);
    if (!_looksLikeGuid(normalizedBookingId)) {
        throw createBookingError(
            ERROR_CODES.CHECKOUT_FAILED,
            "A valid Wix Bookings booking ID is required for Cart V2 checkout.",
            { traceId: _safeTrim(traceId) }
        );
    }

    const checkoutTimeoutMs =
        Number(SDK_CONFIG && SDK_CONFIG.TIMEOUTS && SDK_CONFIG.TIMEOUTS.CHECKOUT_MS) ||
        20000;
    const apiTimeoutMs =
        Number(SDK_CONFIG && SDK_CONFIG.TIMEOUTS && SDK_CONFIG.TIMEOUTS.API_MS) ||
        15000;

    const createdCart = await withTimeout(
        function () {
            return createCartV2({
                cart: { source: { channelType: "WEB" } },
                catalogItems: [
                    {
                        catalogReference: {
                            appId: WIX_CATALOG_APP_IDS.BOOKINGS,
                            catalogItemId: normalizedBookingId,
                        },
                        quantity: 1,
                    },
                ],
            });
        },
        checkoutTimeoutMs,
        "createCartV2"
    );

    const cartId = _safeTrim(createdCart && createdCart._id);
    if (!_looksLikeGuid(cartId)) {
        throw createBookingError(
            ERROR_CODES.CHECKOUT_FAILED,
            "Cart V2 did not return a valid cart ID.",
            { traceId: _safeTrim(traceId) }
        );
    }

    const calculation = await withTimeout(
        function () {
            return calculateCartV2(cartId, { refreshCart: true });
        },
        checkoutTimeoutMs,
        "calculateCartV2"
    );

    const summary = calculation && calculation.summary;
    const calculatedCartId = _safeTrim(
        calculation && calculation.cart && calculation.cart._id
    );
    const cartLineItems = Array.isArray(calculation?.cart?.lineItems)
        ? calculation.cart.lineItems
        : null;
    const matchingBookingItems = cartLineItems
        ? cartLineItems.filter((item) => {
              const reference = item?.source?.catalogReference;
              return (
                  reference?.appId === WIX_CATALOG_APP_IDS.BOOKINGS &&
                  reference?.catalogItemId === normalizedBookingId
              );
          })
        : [];
    const bookingItemUnavailable = matchingBookingItems.some(
        (item) => item?.status != null && item.status !== "IN_STOCK"
    );
    const violations = summary && summary.violations;
    const totalAmount = _safeTrim(
        summary &&
            summary.priceSummary &&
            summary.priceSummary.total &&
            summary.priceSummary.total.amount
    );
    const currencyCode = _safeTrim(
        calculation &&
            calculation.cart &&
            calculation.cart.businessInfo &&
            calculation.cart.businessInfo.currencyCode
    );

    if (
        calculatedCartId !== cartId ||
        !cartLineItems ||
        cartLineItems.length !== 1 ||
        matchingBookingItems.length !== 1 ||
        bookingItemUnavailable ||
        (violations != null &&
            (!Array.isArray(violations) || violations.length > 0)) ||
        !totalAmount ||
        !Number.isFinite(Number(totalAmount)) ||
        Number(totalAmount) < 0 ||
        !/^[A-Z]{3}$/.test(currencyCode)
    ) {
        throw createBookingError(
            ERROR_CODES.CHECKOUT_FAILED,
            "Cart V2 calculation is incomplete or contains violations.",
            {
                traceId: _safeTrim(traceId),
                cartId: cartId,
                violationCount: Array.isArray(violations) ? violations.length : null,
            }
        );
    }

    const checkoutResult = await _executeWithRetry(
        function () {
            return withTimeout(
                function () {
                    return getCartV2CheckoutUrl(cartId);
                },
                apiTimeoutMs,
                "getCartV2CheckoutUrl"
            );
        },
        2,
        300
    );

    const checkoutUrl = _safeTrim(checkoutResult && checkoutResult.checkoutUrl);
    if (!/^https:\/\//i.test(checkoutUrl)) {
        throw createBookingError(
            ERROR_CODES.CHECKOUT_FAILED,
            "Cart V2 did not return a valid HTTPS checkout URL.",
            { traceId: _safeTrim(traceId), cartId: cartId }
        );
    }

    return {
        cartId: cartId,
        checkoutUrl: checkoutUrl,
        totalAmount: totalAmount,
        currencyCode: currencyCode,
    };
}

export async function confirmOrDeclineBookingElevated(bookingId, options) {
    let normalizedOptions = options;
    if (
        options &&
        typeof options === "object" &&
        options.paymentStatus !== undefined
    ) {
        const translated = _toWixNativePaymentStatus(options.paymentStatus);
        if (translated !== options.paymentStatus) {
            log.info("CORE-06: paymentStatus translated SSOT -> Wix native", {
                bookingId: _safeTrim(bookingId),
                from: options.paymentStatus,
                to: translated,
            });
        }
        normalizedOptions = Object.assign({}, options, {
            paymentStatus: translated,
        });
    }
    return _confirmOrDeclineElevatedRaw(bookingId, normalizedOptions);
}

export { logger };

// =============================================================================
// BLOQUE 4 - BOOKINGERROR Y NORMALIZACION
// =============================================================================
export class BookingError extends Error {
    constructor(code, message, details) {
        super(String(message || "Unknown error"));
        this.name = "BookingError";
        this.code = String(code || ERROR_CODES.UNKNOWN_ERROR);
        this.details =
            details && typeof details === "object"
                ? details
                : { details: details };
        this.timestamp = new Date().toISOString();
    }
}

export function createBookingError(code, message, details) {
    return new BookingError(code, message, details);
}

export function normalizeError(err) {
    if (err && typeof err === "object" && err.name === "BookingError") {
        return {
            code: String(err.code || ERROR_CODES.UNKNOWN_ERROR),
            message: String(err.message || "Unknown error"),
            stack: err.stack || null,
            details: err.details || {},
        };
    }
    if (err instanceof Error) {
        const legacy = err.code || err.errorCode || null;
        const msgCode =
            !legacy && typeof err.message === "string"
                ? (err.message.match(/^([A-Z][A-Z0-9_]{2,60}):/) || [])[1] || null
                : null;
        return {
            code: String(legacy || msgCode || err.name || ERROR_CODES.UNKNOWN_ERROR),
            message: String(err.message || "Unknown error"),
            stack: err.stack || null,
            details:
                err.details && typeof err.details === "object" ? err.details : {},
        };
    }
    if (typeof err === "string") {
        return {
            code: ERROR_CODES.UNKNOWN_ERROR,
            message: err,
            stack: null,
            details: {},
        };
    }
    if (err && typeof err === "object") {
        return {
            code: String(
                err.code || err.errorCode || err.name || ERROR_CODES.UNKNOWN_ERROR
            ),
            message: String(err.message || err.error || "Unknown error"),
            stack: err.stack || null,
            details: {},
        };
    }
    return {
        code: ERROR_CODES.UNKNOWN_ERROR,
        message: "Unknown error",
        stack: null,
        details: {},
    };
}

export function _handleError(error, context, traceId, logFn) {
    const loggerInstance = logFn || log;
    const norm = normalizeError(error);
    loggerInstance.error("[" + context + "] " + norm.code + ": " + norm.message, {
        traceId: traceId,
        details: norm.details,
    });
    return {
        status: "ERROR",
        data: null,
        error: {
            code: norm.code || ERROR_CODES.UNKNOWN_ERROR,
            message: norm.message || "Unknown error",
        },
    };
}

// =============================================================================
// BLOQUE 5 - HELPERS BAJO NIVEL
// =============================================================================
function _readControlPayload(doc) {
    return readControlPayload(doc);
}

function _isDuplicateItemError(error) {
    const message = String((error && error.message) || "").toLowerCase();
    return (
        message.indexOf("wde0123") >= 0 ||
        message.indexOf("wd_item_already_exists") >= 0 ||
        message.indexOf("duplicated") >= 0 ||
        message.indexOf("already exists") >= 0
    );
}

function _isRevisionConflictError(error) {
    const message = String((error && error.message) || "").toLowerCase();
    return (
        message.indexOf("revision") >= 0 ||
        message.indexOf("conflict") >= 0 ||
        message.indexOf("wde0124") >= 0
    );
}

// =============================================================================
// BLOQUE 6 - SCHEDULEID
// =============================================================================
async function _resolveScheduleIdByResourceId(resourceId) {
    const id = _safeTrim(resourceId);
    if (!id || !_looksLikeGuid(id)) return null;
    const scheduleId = await getStaffScheduleId(id);
    return scheduleId && _looksLikeGuid(scheduleId) ? scheduleId : null;
}

export async function _resolveScheduleIdForResource(resourceId, sourceSlot) {
    const resourceIdClean = _safeTrim(resourceId);
    if (!resourceIdClean || !_looksLikeGuid(resourceIdClean)) return null;
    const s = sourceSlot && typeof sourceSlot === "object" ? sourceSlot : {};
    const nestedSlot = s.slot && typeof s.slot === "object" ? s.slot : {};
    const schedule = s.schedule && typeof s.schedule === "object" ? s.schedule : {};
    const resource = s.resource && typeof s.resource === "object" ? s.resource : {};
    let scheduleId = _safeTrim(
        s.scheduleId || nestedSlot.scheduleId || schedule.id || resource.scheduleId
    );
    if (scheduleId && _looksLikeGuid(scheduleId)) return scheduleId;
    scheduleId = await _resolveScheduleIdByResourceId(resourceIdClean);
    return scheduleId || null;
}

// =============================================================================
// BLOQUE 7 - BODY CREATEBOOKING (Writer V2)
// =============================================================================
export function _buildBookedAddOns(addOnIds) {
    if (!Array.isArray(addOnIds) || addOnIds.length === 0) return [];
    const seen = new Set();
    const out = [];
    for (let i = 0; i < addOnIds.length; i += 1) {
        const raw = _safeTrim(addOnIds[i]);
        if (!_looksLikeGuid(raw)) continue;
        const key = _normalizeGuidForComparison(raw);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ addOnId: raw });
    }
    return out;
}

function _toMadridLocalString(rawValue) {
    if (rawValue instanceof Date) {
        return isNaN(rawValue.getTime())
            ? ""
            : getMadridLocalStringNoZ(rawValue);
    }
    if (typeof rawValue === "string") {
        const trimmed = _safeTrim(rawValue);
        if (!trimmed) return "";
        if (trimmed.endsWith("Z")) {
            const utcDt = new Date(trimmed);
            return isNaN(utcDt.getTime())
                ? ""
                : getMadridLocalStringNoZ(utcDt);
        }
        return _normalizeLocalIsoStr(trimmed);
    }
    return "";
}

function _readSlotLocalStart(slot) {
    if (!slot || typeof slot !== "object") return "";
    return _toMadridLocalString(slot.localStartDate || slot.startDate);
}

function _readSlotLocalEnd(slot) {
    if (!slot || typeof slot !== "object") return "";
    return _toMadridLocalString(slot.localEndDate || slot.endDate);
}

const CONFIGURED_LOCATION_ID = _safeTrim(SDK_CONFIG && SDK_CONFIG.LOCATION_ID);

/**
 * WIX-V2-ID-01: BookedSlot.Location usa `id`, no `_id`.
 * Ref: https://dev.wix.com/docs/api-reference/business-solutions/bookings/
 *      bookings/bookings-writer-v2/create-booking
 * NOTA: NO usar Object.freeze. El SDK de Wix Bookings V2 muta este objeto
 * al normalizar el payload (renameKeysFromSDKRequestToRESTRequest).
 */
export function _resolveWriteLocation(slotLocation, serviceConfig) {
    const incoming = _safeTrim(slotLocation && slotLocation._id);
    const fromCms = _safeTrim(serviceConfig && serviceConfig.locationId);
    if (incoming) {
        return _looksLikeGuid(incoming)
            ? { id: incoming, locationType: "OWNER_BUSINESS" }
            : null;
    }
    if (fromCms) {
        return _looksLikeGuid(fromCms)
            ? { id: fromCms, locationType: "OWNER_BUSINESS" }
            : null;
    }
    return _looksLikeGuid(CONFIGURED_LOCATION_ID)
        ? { id: CONFIGURED_LOCATION_ID, locationType: "OWNER_BUSINESS" }
        : null;
}

export async function _forceStaffInPristineSlot(
    slot,
    resourceId,
    serviceIdOverride,
    defaultDurationMinutes,
    serviceConfig = null
) {
    if (!slot || typeof slot !== "object") return null;
    const serviceId = _safeTrim(serviceIdOverride || slot.serviceId);
    if (!serviceId || !_looksLikeGuid(serviceId)) {
        log.error("_forceStaffInPristineSlot: invalid serviceId", {
            serviceId: serviceId,
        });
        return null;
    }
    const resourceCandidate =
        slot.resource && typeof slot.resource === "object" ? slot.resource : {};
    /* WIX-V2-ID-03: acepta `id` (contrato V2) con fallback a `_id` (legacy). */
    const resourceIdClean = _safeTrim(
        resourceId ||
            slot.resourceId ||
            resourceCandidate.id ||
            resourceCandidate._id
    );
    if (!resourceIdClean || !_looksLikeGuid(resourceIdClean)) {
        log.error("_forceStaffInPristineSlot: invalid resourceId", {
            resourceId: resourceIdClean,
        });
        return null;
    }
    const scheduleId = await _resolveScheduleIdForResource(resourceIdClean, slot);
    if (!scheduleId) {
        log.error("_forceStaffInPristineSlot: missing scheduleId", {
            resourceId: resourceIdClean,
        });
        return null;
    }
    const localStartDate = _readSlotLocalStart(slot);
    if (!localStartDate) return null;
    let localEndDate = _readSlotLocalEnd(slot);
    if (!localEndDate) {
        const startUtc = getUtcDateFromMadridLocal(localStartDate);
        if (!startUtc) return null;
        const durationMin =
            Number(defaultDurationMinutes) ||
            Number(CONCURRENCY && CONCURRENCY.DEFAULT_DURATION_MIN) ||
            30;
        localEndDate = getMadridLocalStringNoZ(
            new Date(startUtc.getTime() + durationMin * 60 * 1000)
        );
    }
    const startDate = getUtcDateFromMadridLocal(localStartDate);
    const endDate = getUtcDateFromMadridLocal(localEndDate);
    if (!startDate || !endDate) return null;
    if (endDate.getTime() <= startDate.getTime()) {
        log.error("_forceStaffInPristineSlot: invalid date range", {
            localStartDate: localStartDate,
            localEndDate: localEndDate,
            resourceId: resourceIdClean,
            serviceId: serviceId,
        });
        return null;
    }
    const slotLocation =
        slot.location && typeof slot.location === "object" ? slot.location : {};
    const location = _resolveWriteLocation(slotLocation, serviceConfig);
    if (!location) {
        log.error("_forceStaffInPristineSlot: location not configured", {
            serviceId: serviceId,
        });
        return null;
    }
    /* WIX-V2-ID-02: BookedSlot.Resource usa `id`, no `_id`. */
    return {
        serviceId: serviceId,
        scheduleId: scheduleId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        timezone: _safeTrim(SDK_CONFIG && SDK_CONFIG.TZ) || "Europe/Madrid",
        resource: { id: resourceIdClean },
        location,
    };
}

// =============================================================================
// BLOQUE 9 - SLOT KEYS
// =============================================================================
export function generateSlotKey(serviceId, resourceId, startDate, endDate) {
    const startUtc =
        startDate instanceof Date
            ? startDate
            : getUtcDateFromMadridLocal(_normalizeLocalIsoStr(startDate));
    const endUtc =
        endDate instanceof Date
            ? endDate
            : getUtcDateFromMadridLocal(_normalizeLocalIsoStr(endDate));
    if (!startUtc || !endUtc || endUtc.getTime() <= startUtc.getTime()) {
        throw createBookingError(
            ERROR_CODES.INVALID_DATES,
            "Invalid slot dates for lock key"
        );
    }
    const res = _safeTrim(resourceId);
    if (!res || !_looksLikeGuid(res)) {
        throw createBookingError(
            ERROR_CODES.LOCK_KEY_OR_OWNER_INVALID,
            "resourceId is required and must be a valid GUID to build a slot key"
        );
    }
    const svc = _safeTrim(serviceId);
    const servicePrefix = svc ? svc.slice(0, 8) : "srv";
    const startEpochMin = Math.floor(startUtc.getTime() / 60000);
    const endEpochMin = Math.floor(endUtc.getTime() / 60000);
    return (
        "slot_" +
        servicePrefix +
        "_" +
        res +
        "_" +
        startEpochMin +
        "_" +
        endEpochMin
    );
}

export function parseResourceIdFromSlotKey(slotKey) {
    const parts = String(slotKey || "").split("_");
    if (parts.length !== 5 || parts[0] !== "slot") return "";
    const servicePrefix = _safeTrim(parts[1]);
    const resourceId = _safeTrim(parts[2]);
    const startEpochMin = parts[3];
    const endEpochMin = parts[4];
    if (!servicePrefix) return "";
    if (!/^\d+$/.test(startEpochMin) || !/^\d+$/.test(endEpochMin)) return "";
    if (Number(endEpochMin) <= Number(startEpochMin)) return "";
    return _looksLikeGuid(resourceId) ? resourceId : "";
}

export const _buildLockKeys = buildLockKeys;
export function buildLockKeys(phases, resourceId) {
    const keys = (Array.isArray(phases) ? phases : [])
        .map(function (phase) {
            const slot = (phase && phase.rawSlot) || {};
            try {
                return generateSlotKey(
                    slot.serviceId,
                    resourceId,
                    phase && phase.localStart,
                    phase && phase.localEnd
                );
            } catch (_) {
                return "";
            }
        })
        .filter(function (key) {
            return Boolean(key);
        });
    return Array.from(new Set(keys)).sort();
}

// =============================================================================
// BLOQUE 10 - MUTEX LOCKS
// =============================================================================
const MUTEX_TTL_MS = Number(CONCURRENCY && CONCURRENCY.MS_TTL_MUTEX);
if (!Number.isFinite(MUTEX_TTL_MS) || MUTEX_TTL_MS <= 0) {
    throw new Error("MS_TTL_MUTEX must be positive");
}

const LOCKS_COL = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;

export function safeLockId(key) {
    const k = _safeTrim(key);
    if (!k) return "";
    return "lk" + _hashKey(k) + k.slice(0, 24);
}

export function _buildSlotLockControl(slotClave, lockOwnerId, ttlMs, existing, serviceId, lockTokenOverride) {
    const resourceId = parseResourceIdFromSlotKey(slotClave);
    const resolvedServiceId = _safeTrim(serviceId || (existing && existing.serviceId));
    const ttl = Number(ttlMs);
    const now = new Date();
    const existingPayload = _readControlPayload(existing);
    const lockToken = _safeTrim(lockTokenOverride) ||
        _safeTrim(existingPayload.lockToken || existing?.lockToken) ||
        _generateUUID();
    const doc = {
        _id: safeLockId(slotClave),
        controlType: CONTROL_TYPE.SLOT_LOCK,
        dedupeKey: String(slotClave),
        serviceId: resolvedServiceId,
        resourceId: resourceId,
        expiresAt: new Date(
            now.getTime() + (Number.isFinite(ttl) && ttl > 0 ? ttl : MUTEX_TTL_MS)
        ),
        heartbeatAt: now,
        version: 0,
        // lockOwnerId, lockToken and acquiredAt are not physical columns in
        // ControlOperativo; keep lock-specific state inside its OBJECT payload.
        payload: {
            ...existingPayload,
            lockOwnerId: String(lockOwnerId || ""),
            lockToken,
            acquiredAt: _safeTrim(lockTokenOverride)
                ? now
                : existingPayload.acquiredAt || existing?.acquiredAt || now,
            lockStatus: "ACTIVE",
        },
        traceId: _safeTrim(existing && existing.traceId) || makeTraceId("lock"),
    };
    if (existing && existing._revision !== undefined) {
        doc._revision = existing._revision;
    }
    return doc;
}

async function _getLock(slotClave) {
    const id = safeLockId(slotClave);
    if (!id) return null;
    const item = await elevatedGet(LOCKS_COL, id).catch(function () {
        return null;
    });
    if (!item) return null;
    if (item.expiresAt) item.expiresAt = _toDateSafe(item.expiresAt);
    return item;
}

function _getLockOwnerId(lock) {
    if (!lock || typeof lock !== "object") return "";
    const payload = _readControlPayload(lock);
    return _safeTrim(payload.lockOwnerId || lock.lockOwnerId) || "";
}

function _getLockToken(lock) {
    if (!lock || typeof lock !== "object") return "";
    const payload = _readControlPayload(lock);
    return _safeTrim(payload.lockToken || lock.lockToken);
}

async function _patchSlotLockConditionally(existing, {
    expiresAt,
    heartbeatAt,
    payload,
    serviceId,
}) {
    if (!existing?._id || !existing?.expiresAt) {
        return { ok: false, reason: ERROR_CODES.LOCK_CONFLICT };
    }

    const currentVersion = Number(existing.version);
    const hasVersion = Number.isInteger(currentVersion) && currentVersion >= 0;
    const conditionFilter = hasVersion
        ? { version: { $eq: currentVersion } }
        : { expiresAt: { $eq: existing.expiresAt } };

    const modifications = [
        { fieldPath: "expiresAt", action: "SET_FIELD", value: expiresAt },
        { fieldPath: "heartbeatAt", action: "SET_FIELD", value: heartbeatAt },
        { fieldPath: "payload", action: "SET_FIELD", value: payload },
        {
            fieldPath: "version",
            action: hasVersion ? "INCREMENT_FIELD" : "SET_FIELD",
            value: 1,
        },
    ];
    if (serviceId) {
        modifications.push({
            fieldPath: "serviceId",
            action: "SET_FIELD",
            value: serviceId,
        });
    }

    const result = await bulkPatchItems(
        LOCKS_COL,
        [existing._id],
        [modifications],
        { condition: { filter: conditionFilter } }
    );

    if (Array.isArray(result?.errors) && result.errors.length > 0) {
        const missing = result.errors.every((entry) => entry?.code === "WDE0073");
        return {
            ok: false,
            reason: missing ? "LOCK_NOT_FOUND" : ERROR_CODES.LOCK_RENEWAL_FAILED,
        };
    }
    if (!Array.isArray(result?.updatedItemIds) ||
        !result.updatedItemIds.includes(existing._id)) {
        return { ok: false, reason: ERROR_CODES.LOCK_CONFLICT };
    }

    return {
        ok: true,
        newVersion: hasVersion ? currentVersion + 1 : 1,
    };
}

export async function _lockSlotKeyOrFail(slotClave, lockOwnerId, ttlMs, serviceId) {
    const k = _safeTrim(slotClave);
    const owner = _safeTrim(lockOwnerId);
    const service = _safeTrim(serviceId);
    if (!k || !owner || !_looksLikeGuid(service)) {
        return { ok: false, message: ERROR_CODES.LOCK_KEY_OR_OWNER_INVALID };
    }
    if (!parseResourceIdFromSlotKey(k)) {
        return { ok: false, message: ERROR_CODES.LOCK_KEY_OR_OWNER_INVALID };
    }

    try {
        const newLock = _buildSlotLockControl(k, owner, ttlMs, null, service);
        await elevatedInsert(LOCKS_COL, newLock);
        return {
            ok: true,
            acquired: true,
            version: newLock.version,
            lockToken: _getLockToken(newLock),
        };
    } catch (error) {
        if (!_isDuplicateItemError(error)) {
            log.error("_lockSlotKeyOrFail failed", {
                slotClave: k,
                error: error && error.message,
            });
            return {
                ok: false,
                message: (error && error.message) || ERROR_CODES.DATABASE_ERROR,
            };
        }

        const existing = await _getLock(k);
        if (!existing || !existing._id) {
            return { ok: false, message: ERROR_CODES.LOCK_HELD_BY_ANOTHER_OWNER };
        }

        const currentOwner = _getLockOwnerId(existing);
        const expiresAt = _toDateSafe(existing.expiresAt);
        const expired = !expiresAt || expiresAt.getTime() <= Date.now();

        if (currentOwner === owner && !expired) {
            const existingToken = _getLockToken(existing);
            const renewed = await _renewLock(k, owner, ttlMs, {
                expectedVersion: existing.version,
                expectedLockToken: existingToken,
                serviceId: service,
            });
            return renewed.ok
                ? {
                    ok: true,
                    renewed: true,
                    version: renewed.newVersion,
                    lockToken: renewed.lockToken,
                }
                : { ok: false, message: renewed.reason || ERROR_CODES.LOCK_RENEWAL_FAILED };
        }

        if (expired) {
            if (!expiresAt) {
                log.error("CORE-43: Malformed lock found (missing expiresAt)", {
                    slotClave: k,
                    lockId: existing._id,
                });
            }
            const reclaimedToken = _generateUUID();
            const reclaimedPayload = {
                ..._readControlPayload(existing),
                lockOwnerId: owner,
                lockToken: reclaimedToken,
                acquiredAt: new Date(),
                lockStatus: "ACTIVE",
            };
            try {
                const reclaimed = await _patchSlotLockConditionally(existing, {
                    expiresAt: new Date(Date.now() + (Number(ttlMs) > 0 ? Number(ttlMs) : MUTEX_TTL_MS)),
                    heartbeatAt: new Date(),
                    payload: reclaimedPayload,
                    serviceId: service,
                });
                if (!reclaimed.ok) {
                    return { ok: false, message: reclaimed.reason || ERROR_CODES.LOCK_RACE };
                }
                return {
                    ok: true,
                    acquired: true,
                    reclaimed: true,
                    version: reclaimed.newVersion,
                    lockToken: reclaimedToken,
                };
            } catch (updateError) {
                log.error("_lockSlotKeyOrFail: conditional reclaim failed", {
                    slotClave: k,
                    error: updateError && updateError.message,
                });
                return {
                    ok: false,
                    message: ERROR_CODES.LOCK_HELD_BY_ANOTHER_OWNER,
                };
            }
        }

        return { ok: false, message: ERROR_CODES.LOCK_HELD_BY_ANOTHER_OWNER };
    }
}

export async function _unlockSlotKey(slotClave, lockOwnerId, options = {}) {
    const owner = _safeTrim(lockOwnerId);
    const expectedRevision = options?.expectedRevision;
    const expectedLockToken = _safeTrim(options?.expectedLockToken);
    const existing = await _getLock(slotClave);
    if (!existing) return { ok: true, missing: true };

    if (!owner || _getLockOwnerId(existing) !== owner) {
        return {
            ok: false,
            reason: ERROR_CODES.LOCK_OWNERSHIP_CHANGED,
            skipped: true,
        };
    }
    if (!expectedLockToken || _getLockToken(existing) !== expectedLockToken) {
        return {
            ok: false,
            reason: ERROR_CODES.LOCK_OWNERSHIP_CHANGED,
            skipped: true,
        };
    }
    if (expectedRevision === undefined || existing._revision !== expectedRevision) {
        return { ok: false, reason: ERROR_CODES.LOCK_CONFLICT };
    }

    try {
        await elevatedRemove(LOCKS_COL, existing._id);
        return { ok: true };
    } catch (error) {
        log.warn("_unlockSlotKey: remove failed", {
            slotClave: slotClave,
            error: error && error.message,
        });
        return {
            ok: false,
            reason: ERROR_CODES.LOCK_RELEASE_FAILED,
            error: error && error.message,
        };
    }
}

export async function _renewLock(slotClave, lockOwnerId, ttlMs, options = {}) {
    const owner = _safeTrim(lockOwnerId);
    const expectedRevision = options?.expectedRevision;
    const expectedLockToken = _safeTrim(options?.expectedLockToken);
    const serviceId = _safeTrim(options?.serviceId);
    try {
        const existing = await _getLock(slotClave);
        if (!existing) return { ok: false, reason: "LOCK_NOT_FOUND" };
        if (!owner || _getLockOwnerId(existing) !== owner) {
            return { ok: false, reason: ERROR_CODES.LOCK_OWNERSHIP_CHANGED };
        }
        if (!expectedLockToken || _getLockToken(existing) !== expectedLockToken) {
            return { ok: false, reason: ERROR_CODES.LOCK_OWNERSHIP_CHANGED };
        }
        if (expectedRevision === undefined || existing._revision !== expectedRevision) {
            return { ok: false, reason: ERROR_CODES.LOCK_CONFLICT };
        }
        const expiresAt = _toDateSafe(existing.expiresAt);
        if (!expiresAt || expiresAt.getTime() <= Date.now()) {
            return { ok: false, reason: ERROR_CODES.LOCK_EXPIRED_PENDING_CLEANUP };
        }

        const updated = await elevatedUpdate(
            LOCKS_COL,
            _buildSlotLockControl(slotClave, owner, ttlMs, existing, serviceId)
        );
        return {
            ok: true,
            newRevision: updated._revision,
            lockToken: _getLockToken(updated),
        };
    } catch (error) {
        if (_isRevisionConflictError(error)) {
            return { ok: false, reason: ERROR_CODES.LOCK_CONFLICT };
        }
        log.error("_renewLock failed", {
            slotClave: slotClave,
            error: error && error.message,
        });
        return { ok: false, reason: ERROR_CODES.LOCK_RENEWAL_FAILED };
    }
}

// =============================================================================
// BLOQUE 11 - TRANSACCIONES IDEMPOTENTES
// =============================================================================
const TRANSACTIONS_COL = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
const TX_DEDUPE_PREFIX = "TX_";
const TX_PAYLOAD_MAX_CHARS = 5000;
const TRANSACTION_POLL_BASE_MS =
    Number(CONCURRENCY && CONCURRENCY.TRANSACTION_POLL_BASE_MS) || 250;
const TRANSACTION_MAX_WAIT_MS =
    Number(CONCURRENCY && CONCURRENCY.TRANSACTION_MAX_WAIT_MS) || 3000;
const TRANSACTION_LEASE_MS =
    Number(CONCURRENCY && CONCURRENCY.TRANSACTION_LEASE_MS) || 300000;

async function _getTransactionById(pairToken) {
    const id = _safeTrim(pairToken);
    if (!id) return null;
    return await elevatedGet(TRANSACTIONS_COL, id).catch(function () {
        return null;
    });
}

function _readTransaction(doc) {
    if (!doc) return null;
    const payload = _readControlPayload(doc);
    return {
        doc: doc,
        status: _safeTrim(payload.status || doc.status),
        payloadHash: _safeTrim(payload.payloadHash),
        ownerTraceId: _safeTrim(payload.ownerTraceId),
        ownerExecutionId: _safeTrim(payload.ownerExecutionId),
        error: _safeTrim(payload.error),
        bookingId: _safeTrim(payload.bookingId || doc.bookingId),
        result: payload.result,
        expiresAt: _toDateSafe(payload.expiresAt || doc.expiresAt),
        heartbeatAt: _toDateSafe(payload.heartbeatAt || doc.heartbeatAt),
        attempts: Number(payload.attempts || doc.attempts || 0),
        serviceId: _safeTrim(payload.serviceId || doc.serviceId),
        writerIntent: payload.writerIntent && typeof payload.writerIntent === "object"
            ? payload.writerIntent
            : null,
    };
}

function _extractBookingIdFromResult(result) {
    if (!result || typeof result !== "object") return "";
    const direct = _safeTrim(result.bookingId);
    if (direct) return direct;
    const nested =
        result.data && typeof result.data === "object" ? result.data : {};
    return _safeTrim(nested.bookingId);
}

function _buildTransactionControl(pairToken, state, existingDoc) {
    const payload = Object.assign({}, state);
    if (JSON.stringify(payload).length > TX_PAYLOAD_MAX_CHARS) {
        delete payload.result;
        payload.resultDropped = true;
    }
    const serviceId = _safeTrim(payload.serviceId || (existingDoc && existingDoc.serviceId));
    if (serviceId) payload.serviceId = serviceId;
    const now = new Date();
    const doc = {
        _id: String(pairToken),
        controlType: CONTROL_TYPE.IDEMPOTENCY,
        serviceId: serviceId,
        dedupeKey: TX_DEDUPE_PREFIX + String(pairToken),
        payload: payload,
        expiresAt:
            payload.expiresAt ||
            (existingDoc && existingDoc.expiresAt) ||
            null,
        heartbeatAt:
            payload.heartbeatAt ||
            (existingDoc && existingDoc.heartbeatAt) ||
            now,
        attempts: payload.attempts || (existingDoc && existingDoc.attempts) || 1,
        traceId:
            _safeTrim(existingDoc && existingDoc.traceId) ||
            _safeTrim(state.ownerTraceId) ||
            makeTraceId("tx"),
    };
    if (existingDoc && existingDoc._revision !== undefined) {
        doc._revision = existingDoc._revision;
    }
    const bookingId = _safeTrim(payload.bookingId);
    if (bookingId) doc.bookingId = bookingId;
    return doc;
}

async function _writeTransaction(pairToken, state, existingDoc, throwOnError) {
    const doc = _buildTransactionControl(pairToken, state, existingDoc);
    try {
        if (existingDoc && existingDoc._id) {
            await elevatedUpdate(TRANSACTIONS_COL, doc);
        } else {
            await elevatedInsert(TRANSACTIONS_COL, doc);
        }
    } catch (error) {
        const isDup = _isDuplicateItemError(error);
        if (!isDup) {
            log.error("_writeTransaction failed", {
                pairToken: pairToken,
                error: error && error.message,
            });
        }
        if (throwOnError && !isDup) {
            throw error;
        }
    }
}

function _evaluatePendingTransaction(current, payloadHash) {
    if (!current) return null;
    if (current.payloadHash !== String(payloadHash || "")) {
        return {
            success: false,
            error: ERROR_CODES.PAIR_TOKEN_PAYLOAD_MISMATCH,
            existing: current,
        };
    }
    if (current.status === "COMPLETED") {
        return { success: true, isNew: false, existing: current };
    }
    if (
        current.status === "FAILED" ||
        current.status === "FAILED_RETRYABLE" ||
        current.status === "FAILED_FINAL"
    ) {
        return {
            success: false,
            error: ERROR_CODES.TRANSACTION_PREVIOUSLY_FAILED,
            existing: current,
        };
    }
    return null;
}

export async function _inspectTransactionReplay(pairToken, payloadHash) {
    const id = _safeTrim(pairToken);
    if (!id) return { state: "MISSING" };
    const current = _readTransaction(await _getTransactionById(id));
    if (!current) return { state: "MISSING" };
    if (current.payloadHash !== String(payloadHash || "")) {
        return { state: "PAYLOAD_MISMATCH" };
    }
    if (current.status === "COMPLETED") {
        return { state: "COMPLETED", result: current.result || null };
    }
    if (["FAILED", "FAILED_RETRYABLE", "FAILED_FINAL"].includes(current.status)) {
        return { state: "FAILED", error: current.error || null };
    }
    return { state: "IN_PROGRESS", status: current.status || null };
}

export async function _initTransaction(
    pairToken,
    payloadHash,
    traceId,
    serviceId,
    ownerExecutionId,
    writerIntent
) {
    const id = _safeTrim(pairToken);
    const resolvedServiceId = _safeTrim(serviceId);
    if (!id) return { success: false, error: "INVALID_PAIR_TOKEN" };
    if (!_looksLikeGuid(resolvedServiceId)) return { success: false, error: "INVALID_SERVICE_ID" };
    const now = new Date();
    const state = {
        status: "IN_PROGRESS",
        serviceId: resolvedServiceId,
        payloadHash: String(payloadHash || ""),
        ownerTraceId: String(traceId || ""),
        ownerExecutionId: String(ownerExecutionId || traceId || ""),
        expiresAt: new Date(now.getTime() + TRANSACTION_LEASE_MS),
        heartbeatAt: now,
        attempts: 1,
        writerIntent: writerIntent && typeof writerIntent === "object" ? writerIntent : null,
    };
    try {
        await elevatedInsert(
            TRANSACTIONS_COL,
            _buildTransactionControl(id, state, null)
        );
        return { success: true, isNew: true };
    } catch (error) {
        if (!_isDuplicateItemError(error)) {
            log.error("_initTransaction: insert failed", {
                pairToken: id,
                error: error && error.message,
            });
            return { success: false, error: ERROR_CODES.DATABASE_ERROR };
        }
    }
    const startTime = Date.now();
    let pollAttempt = 0;
    while (Date.now() - startTime < TRANSACTION_MAX_WAIT_MS) {
        const verdict = _evaluatePendingTransaction(
            _readTransaction(await _getTransactionById(id)),
            payloadHash
        );
        if (verdict) return verdict;
        const remainingMs = TRANSACTION_MAX_WAIT_MS - (Date.now() - startTime);
        const delay = Math.min(
            Math.floor(
                TRANSACTION_POLL_BASE_MS *
                    Math.pow(2, Math.min(pollAttempt, 3)) *
                    (0.5 + Math.random())
            ),
            remainingMs
        );
        if (delay <= 0) break;
        pollAttempt += 1;
        await new Promise(function (resolve) {
            setTimeout(resolve, delay);
        });
    }
    const finalState = _readTransaction(await _getTransactionById(id));
    return (
        _evaluatePendingTransaction(finalState, payloadHash) || {
            success: false,
            error: ERROR_CODES.TRANSACTION_TIMEOUT,
            existing: finalState,
            timeout: true,
        }
    );
}

export async function updateBookingWriterIntent(pairToken, phase, status, metadata = {}, traceId) {
    const id = _safeTrim(pairToken);
    const phaseKey = _safeTrim(phase).toUpperCase();
    const nextStatus = _safeTrim(status).toUpperCase();
    if (!id || !["F1", "F2"].includes(phaseKey) || !nextStatus) {
        return { ok: false, reason: "INVALID_WRITER_INTENT_INPUT" };
    }

    for (let attempt = 0; attempt < 4; attempt++) {
        const doc = await _getTransactionById(id);
        if (!doc) return { ok: false, reason: "TX_NOT_FOUND" };
        const payload = _readControlPayload(doc);
        if (payload.status === "COMPLETED") return { ok: false, reason: "TX_ALREADY_COMPLETED" };

        const writerIntent = payload.writerIntent && typeof payload.writerIntent === "object"
            ? payload.writerIntent
            : {};
        const phases = writerIntent.phases && typeof writerIntent.phases === "object"
            ? writerIntent.phases
            : {};
        const currentPhase = phases[phaseKey] && typeof phases[phaseKey] === "object"
            ? phases[phaseKey]
            : {};
        const updatedWriterIntent = {
            ...writerIntent,
            phases: {
                ...phases,
                [phaseKey]: {
                    ...currentPhase,
                    ...metadata,
                    status: nextStatus,
                    updatedAt: new Date().toISOString(),
                },
            },
            updatedAt: new Date().toISOString(),
        };
        const nextPayload = { ...payload, writerIntent: updatedWriterIntent };
        const nextDoc = _buildTransactionControl(id, nextPayload, doc);
        try {
            await elevatedUpdate(TRANSACTIONS_COL, nextDoc);
            return { ok: true, writerIntent: updatedWriterIntent };
        } catch (error) {
            if (_isRevisionConflictError(error)) continue;
            log.error("updateBookingWriterIntent failed", {
                traceId,
                pairToken: id,
                phase: phaseKey,
                error: error?.message,
            });
            return { ok: false, reason: (error && error.message) || "WRITER_INTENT_UPDATE_FAILED" };
        }
    }
    return { ok: false, reason: "WRITER_INTENT_REVISION_CONFLICT" };
}

export async function claimTransaction(
    pairToken,
    newOwnerExecutionId,
    newTraceId
) {
    const id = _safeTrim(pairToken);
    if (!id) return { ok: false, reason: "INVALID_PAIR_TOKEN" };

    const current = await _getTransactionById(id);
    if (!current) return { ok: false, reason: "NOT_FOUND" };

    const tx = _readTransaction(current);

    if (tx.status === "COMPLETED") {
        return { ok: false, reason: "ALREADY_COMPLETED" };
    }

    const expiresAt = tx.expiresAt;
    if (expiresAt && expiresAt.getTime() > Date.now()) {
        return { ok: false, reason: "LEASE_NOT_EXPIRED" };
    }

    const now = new Date();
    const newState = {
        status: "IN_PROGRESS",
        payloadHash: tx.payloadHash,
        ownerTraceId: String(newTraceId || ""),
        ownerExecutionId: String(newOwnerExecutionId || ""),
        expiresAt: new Date(now.getTime() + TRANSACTION_LEASE_MS),
        heartbeatAt: now,
        attempts: tx.attempts + 1,
        bookingId: tx.bookingId,
        serviceId: tx.serviceId,
        writerIntent: tx.writerIntent || null,
    };

    try {
        await elevatedUpdate(
            TRANSACTIONS_COL,
            _buildTransactionControl(id, newState, current)
        );
        return {
            ok: true,
            transaction: _readTransaction(await _getTransactionById(id)),
        };
    } catch (error) {
        if (_isRevisionConflictError(error)) {
            return { ok: false, reason: "CLAIM_RACE" };
        }
        log.error("claimTransaction: update failed", {
            pairToken: id,
            error: error && error.message,
        });
        return { ok: false, reason: ERROR_CODES.DATABASE_ERROR };
    }
}

export async function _completeTransaction(pairToken, result, traceId) {
    const id = _safeTrim(pairToken);
    if (!id) return { ok: false, error: "INVALID_PAIR_TOKEN" };
    const current = _readTransaction(await _getTransactionById(id));
    if (current && current.status === "COMPLETED") {
        return { ok: true, alreadyCompleted: true };
    }
    try {
        await _writeTransaction(
            id,
            {
                status: "COMPLETED",
                serviceId: current ? current.serviceId : "",
                payloadHash: current ? current.payloadHash : "",
                ownerTraceId:
                    _safeTrim(traceId) || (current ? current.ownerTraceId : ""),
                bookingId: _extractBookingIdFromResult(result),
                result: result === undefined ? null : result,
                terminalAt: new Date().toISOString(),
            },
            current ? current.doc : null,
            true
        );
        return { ok: true };
    } catch (err) {
        return {
            ok: false,
            error: (err && err.message) || "COMPLETE_FAILED",
        };
    }
}

export async function _failTransaction(pairToken, errorMessage, retryable) {
    const id = _safeTrim(pairToken);
    if (!id) return;
    const current = _readTransaction(await _getTransactionById(id));
    if (current && current.status === "COMPLETED") return;
    const isRetryable = retryable !== false;
    const finalStatus = isRetryable ? "FAILED_RETRYABLE" : "FAILED_FINAL";
    await _writeTransaction(
        id,
        {
            status: finalStatus,
            serviceId: current ? current.serviceId : "",
            payloadHash: current ? current.payloadHash : "",
            ownerTraceId: current ? current.ownerTraceId : "",
            error: String(errorMessage || ERROR_CODES.UNKNOWN_ERROR),
            terminalAt: isRetryable ? null : new Date().toISOString(),
        },
        current ? current.doc : null
    );
}

// =============================================================================
// BLOQUE 12 - PERSISTENCIA CITAS_F2
// =============================================================================
const CITAS_COL = BUSINESS_COLLECTIONS.CITAS_F2;

function _minimizeContactDetails(contactDetails) {
    const cd =
        contactDetails && typeof contactDetails === "object" ? contactDetails : {};
    const out = {};
    const firstName = _safeTrim(cd.firstName || cd.first_name);
    const lastName = _safeTrim(cd.lastName || cd.last_name);
    const email = _safeTrim(cd.email);
    const phone = _safeTrim(cd.phone || cd.phoneNumber);
    const memberId = _safeTrim(cd.memberId);
    const contactId = _safeTrim(cd.contactId);
    if (firstName) out.firstName = firstName;
    if (lastName) out.lastName = lastName;
    if (email) out.email = email;
    if (phone) out.phone = phone;
    if (memberId) out.memberId = memberId;
    if (contactId && _looksLikeGuid(contactId)) out.contactId = contactId;
    return out;
}

function _normalizeMeta(rawMeta, overrides) {
    let meta = rawMeta;
    if (typeof meta === "string") {
        try {
            meta = JSON.parse(meta);
        } catch (_) {
            meta = {};
        }
    }
    if (!meta || typeof meta !== "object" || Array.isArray(meta)) meta = {};
    return Object.assign({}, meta, overrides);
}

export async function _persistBooking(params, traceId) {
    const p = params || {};
    const traceIdClean = _safeTrim(traceId || p.traceId);
    if (!traceIdClean) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "traceId is required to persist a booking in CitasF2",
            { bookingId: _safeTrim(p.bookingId) }
        );
    }
    const bookingId = _safeTrim(p.bookingId);
    const serviceId = _safeTrim(p.serviceId);
    const resourceId = _safeTrim(p.resourceId);
    if (!bookingId || !serviceId || !resourceId || !p.startDate || !p.endDate) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "Missing required fields for persistBooking",
            { traceId: traceIdClean, bookingId: bookingId }
        );
    }
    const scheduleIdClean = _safeTrim(p.scheduleId);
    if (!scheduleIdClean || !_looksLikeGuid(scheduleIdClean)) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "scheduleId is required and must be a valid GUID for CitasF2 persistence",
            {
                traceId: traceIdClean,
                bookingId: bookingId,
                scheduleIdRaw: p.scheduleId,
            }
        );
    }
    const startDateObj = _toDateSafe(p.startDate);
    const endDateObj = _toDateSafe(p.endDate);
    if (
        !startDateObj ||
        !endDateObj ||
        endDateObj.getTime() <= startDateObj.getTime()
    ) {
        throw createBookingError(
            ERROR_CODES.INVALID_DATES,
            "Invalid startDate/endDate for persistBooking",
            { traceId: traceIdClean, bookingId: bookingId }
        );
    }
    const startLocal = getMadridLocalStringNoZ(startDateObj);
    const dateYmd = startLocal ? startLocal.slice(0, 10) : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
        throw createBookingError(
            ERROR_CODES.INVALID_DATES,
            "Cannot derive dateYmd (Europe/Madrid) from slotStart",
            {
                traceId: traceIdClean,
                bookingId: bookingId,
                startLocal: startLocal,
            }
        );
    }
    const bookingType = normalizeBookingType(p.bookingType || p.tipo);
    const pairToken = _safeTrim(p.pairToken || (p.meta && p.meta.pairToken));
    if (isDualBookingType(bookingType) && !pairToken) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "Missing pairToken for linked booking",
            {
                traceId: traceIdClean,
                bookingId: bookingId,
                bookingType: bookingType,
            }
        );
    }
    const metaObj = p.meta && typeof p.meta === "object" ? p.meta : {};
    const rawPayment =
        p.paymentStatus !== undefined
            ? p.paymentStatus
            : metaObj.paymentStatus !== undefined
                ? metaObj.paymentStatus
                : PAYMENT_STATUS.NOT_PAID;
    const paymentStatus = _toCmsPaymentStatus(rawPayment);
    const rawBookingStatus =
        p.bookingStatus !== undefined ? p.bookingStatus : p.status;
    const bookingStatus =
        _toCmsBookingStatus(rawBookingStatus) ||
        _deriveCmsBookingStatus(paymentStatus);
    assertValidEnum(bookingStatus, CITAS_BOOKING_STATUS, "bookingStatus");
    assertValidEnum(paymentStatus, CITAS_PAYMENT_STATUS, "paymentStatus");
    /* LOG-NOISE-01: thirdPartyId es opcional en Bookings Writer V2.
       Su ausencia es esperada; no generamos WARN. */
    const thirdPartyId = _safeTrim(p.thirdPartyId || metaObj.thirdPartyId);
    const catalogId = _safeTrim(p.catalogId) || serviceId;
    const totalAmount = _roundMoney(
        Number(
            p.totalAmount !== undefined
                ? p.totalAmount
                : metaObj.totalAmount || 0
        ) || 0
    );
    const doc = {
        [BOOKING_FIELDS.BOOKING_ID]: bookingId,
        [BOOKING_FIELDS.PAIR_TOKEN]: pairToken,
        [BOOKING_FIELDS.CATALOG_ID]: catalogId,
        [BOOKING_FIELDS.SERVICE_ID]: serviceId,
        [BOOKING_FIELDS.SCHEDULE_ID]: scheduleIdClean,
        [BOOKING_FIELDS.RESOURCE_ID]: resourceId,
        [BOOKING_FIELDS.THIRD_PARTY_ID]: thirdPartyId,
        [BOOKING_FIELDS.DATE_YMD]: dateYmd,
        [BOOKING_FIELDS.SLOT_START]: startDateObj,
        [BOOKING_FIELDS.SLOT_END]: endDateObj,
        [BOOKING_FIELDS.BOOKING_TYPE]: normalizeBookingType(bookingType),
        [BOOKING_FIELDS.REVISION]: Number(p.revision) || 1,
        [BOOKING_FIELDS.STATUS]: bookingStatus,
        [BOOKING_FIELDS.PAYMENT_STATUS]: paymentStatus,
        [BOOKING_FIELDS.TOTAL_AMOUNT]: totalAmount,
        [BOOKING_FIELDS.CONTACT_DETAILS]: _minimizeContactDetails(
            p.contactDetails
        ),
        privacyNoticeVersion: _safeTrim(p.privacyNoticeVersion || "") || null,
        privacyNoticeAcceptedAt: p.privacyNoticeAcceptedAt
            ? _toDateSafe(p.privacyNoticeAcceptedAt)
            : null,
        privacyNoticePurpose: _safeTrim(p.privacyNoticePurpose || "") || null,
        [BOOKING_FIELDS.META]: _normalizeMeta(p.meta, {
            bookingStatus: bookingStatus,
            paymentStatus: paymentStatus,
        }),
        [BOOKING_FIELDS.TRACE_ID]: traceIdClean,
    };
    const existing = await elevatedQueryFind(CITAS_COL, function (q) {
        return q.eq(BOOKING_FIELDS.BOOKING_ID, bookingId).limit(1);
    }).catch(function () {
        return null;
    });
    if (existing && Array.isArray(existing.items) && existing.items.length > 0) {
        const existingDoc = existing.items[0];
        if (p.insertOnly === true) {
            return { created: false, item: existingDoc, existing: true };
        }
        const incomingRevision = Number(doc[BOOKING_FIELDS.REVISION]) || 1;
        const currentRevision = Number(existingDoc[BOOKING_FIELDS.REVISION]) || 1;
        if (incomingRevision < currentRevision) {
            throw new BookingError(
                ERROR_CODES.DATABASE_ERROR,
                "Booking revision conflict",
                {
                    bookingId: bookingId,
                    currentRevision: currentRevision,
                    incomingRevision: incomingRevision,
                    traceId: traceIdClean,
                }
            );
        }
        const updated = Object.assign({}, existingDoc, doc);
        delete updated._createdDate;
        delete updated._updatedDate;
        delete updated._owner;
        delete updated.status;
        const item = await elevatedUpdate(CITAS_COL, updated);
        return { created: false, item: item };
    }
    const item = await elevatedInsert(CITAS_COL, doc);
    return { created: true, item: item };
}

export async function _findExistingCitasForSlot(params) {
    const p = params || {};
    const serviceId = _safeTrim(p.serviceId);
    const dateYmd = _safeTrim(p.dateYmd);
    const startDate = _toDateSafe(p.startDate);
    const endDate = _toDateSafe(p.endDate);
    const email = _safeTrim(p.email).toLowerCase();
    const memberId = _safeTrim(p.memberId);
    const contactId = _safeTrim(p.contactId);

    if (!serviceId || !dateYmd || !startDate || !endDate || (!email && !memberId && !contactId)) {
        return [];
    }

    const result = await elevatedQueryFind(CITAS_COL, function (q) {
        return q
            .eq(BOOKING_FIELDS.SERVICE_ID, serviceId)
            .eq(BOOKING_FIELDS.DATE_YMD, dateYmd)
            .limit(100);
    });
    const items = Array.isArray(result?.items) ? result.items : [];
    const totalCount = Number(result?.totalCount ?? items.length);
    if (totalCount > items.length) {
        throw new Error("LEGACY_SLOT_SCAN_INCOMPLETE: CitasF2 query exceeded the bounded scan");
    }

    return items.filter(function (item) {
        const rowStart = _toDateSafe(item && item[BOOKING_FIELDS.SLOT_START]);
        const rowEnd = _toDateSafe(item && item[BOOKING_FIELDS.SLOT_END]);
        if (!rowStart || !rowEnd ||
            rowStart.getTime() !== startDate.getTime() ||
            rowEnd.getTime() !== endDate.getTime()) return false;

        const status = _safeTrim(
            item[BOOKING_FIELDS.STATUS] || item.bookingStatus || ""
        ).toUpperCase();
        if (["CANCELED", "CANCELLED", "DECLINED"].includes(status)) return false;

        const details = item[BOOKING_FIELDS.CONTACT_DETAILS] || {};
        const rowMemberId = _safeTrim(details.memberId);
        const rowContactId = _safeTrim(details.contactId);
        const rowEmail = _safeTrim(details.email).toLowerCase();
        const hasComparableIdentity =
            (!!memberId && !!rowMemberId) || (!!contactId && !!rowContactId);
        const identityMatch =
            (!!memberId && !!rowMemberId && memberId === rowMemberId) ||
            (!!contactId && !!rowContactId && contactId === rowContactId) ||
            (!hasComparableIdentity && !!email && rowEmail === email);
        return identityMatch;
    }).map(function (item) {
        return {
            bookingId: _safeTrim(item[BOOKING_FIELDS.BOOKING_ID]),
            bookingType: _safeTrim(item[BOOKING_FIELDS.BOOKING_TYPE]),
            bookingStatus: _safeTrim(item[BOOKING_FIELDS.STATUS] || item.bookingStatus),
            resourceId: _safeTrim(item[BOOKING_FIELDS.RESOURCE_ID]),
            pairToken: _safeTrim(item[BOOKING_FIELDS.PAIR_TOKEN]),
        };
    });
}

// =============================================================================
// BLOQUE 13 - ACTUALIZACION SEGURA
// =============================================================================
export async function _updateCitaSafe(bookingId, updater, traceId, operation) {
    const bid = _safeTrim(bookingId);
    if (!bid) return { updated: false, reason: "INVALID_BOOKING_ID" };
    try {
        const res = await elevatedQueryFind(CITAS_COL, function (q) {
            return q.eq(BOOKING_FIELDS.BOOKING_ID, bid).limit(1);
        });
        const cita = res && Array.isArray(res.items) ? res.items[0] : null;
        if (!cita) {
            log.warn("_updateCitaSafe: cita not found", {
                bookingId: bid,
                operation: operation,
                traceId: traceId,
            });
            return { updated: false, reason: "NOT_FOUND" };
        }
        const updated = updater(cita);
        if (!updated) return { updated: false, reason: "NO_CHANGE" };
        const rawStatus =
            updated.bookingStatus !== undefined
                ? updated.bookingStatus
                : updated.status;
        const nextBookingStatus =
            _toCmsBookingStatus(rawStatus) || cita.bookingStatus;
        const nextPaymentStatus =
            _toCmsPaymentStatus(updated.paymentStatus) || cita.paymentStatus;
        assertValidEnum(nextBookingStatus, CITAS_BOOKING_STATUS, "bookingStatus");
        assertValidEnum(nextPaymentStatus, CITAS_PAYMENT_STATUS, "paymentStatus");
        updated[BOOKING_FIELDS.STATUS] = nextBookingStatus;
        updated[BOOKING_FIELDS.PAYMENT_STATUS] = nextPaymentStatus;
        delete updated.status;
        updated[BOOKING_FIELDS.TRACE_ID] =
            _safeTrim(traceId) || _safeTrim(updated.traceId);
        delete updated._createdDate;
        delete updated._updatedDate;
        delete updated._owner;
        await elevatedUpdate(CITAS_COL, updated);
        return { updated: true, bookingId: bid };
    } catch (err) {
        log.error("_updateCitaSafe failed", {
            bookingId: bid,
            operation: operation,
            traceId: traceId,
            error: err && err.message,
        });
        return {
            updated: false,
            reason: "ERROR",
            error: err && err.message,
        };
    }
}

// =============================================================================
// BLOQUE 14 - RESOURCEIDS DESDE SLOTS
// =============================================================================
export function _extractResourceIdsFromSlot(slot) {
    return getResourceIdsFromSlot(slot, STAFF_RESOURCE_TYPE_ID);
}

// =============================================================================
// BLOQUE 16 - PROYECCION SLOTS
// =============================================================================
export function _projectCertifiedSlot(slot, resourceId) {
    const normalized = normalizeAvailabilitySlot(slot);
    if (!normalized) return null;
    const serviceId = _safeTrim(normalized.serviceId);
    if (!serviceId || !_looksLikeGuid(serviceId)) return null;
    const resourceCandidate =
        normalized.resource && typeof normalized.resource === "object"
            ? normalized.resource
            : {};
    const resourceIdClean = _safeTrim(
        resourceId || normalized.resourceId || resourceCandidate.id
    );
    if (!resourceIdClean || !_looksLikeGuid(resourceIdClean)) return null;
    const localStartDate = normalized.localStartDate;
    const localEndDate = normalized.localEndDate;
    if (!localStartDate || !localEndDate) return null;
    const startDateUtc = getUtcDateFromMadridLocal(localStartDate);
    const endDateUtc = getUtcDateFromMadridLocal(localEndDate);
    if (
        !startDateUtc ||
        !endDateUtc ||
        endDateUtc.getTime() <= startDateUtc.getTime()
    ) {
        return null;
    }
    const slotLocation =
        normalized.location && typeof normalized.location === "object"
            ? normalized.location
            : {};
    const location = _resolveWriteLocation(slotLocation, null);
    if (!location) return null;
    const nestedSlot = normalized.slot && typeof normalized.slot === "object" ? normalized.slot : {};
    return {
        serviceId: serviceId,
        resourceId: resourceIdClean,
        scheduleId: _safeTrim(normalized.scheduleId || nestedSlot.scheduleId),
        localStartDate: localStartDate,
        localEndDate: localEndDate,
        startDate: startDateUtc,
        endDate: endDateUtc,
        bookable: normalized.bookable === true,
        availableResources: _extractResourceIdsFromSlot(normalized),
        timezone: _safeTrim(SDK_CONFIG && SDK_CONFIG.TZ) || "Europe/Madrid",
        /* WIX-V2-ID-04: `location` ahora es `{ id, locationType }`. */
        locationId: location.id,
        locationName: _safeTrim(slotLocation.name),
        formattedAddress: _safeTrim(slotLocation.formattedAddress),
    };
}

// =============================================================================
// BLOQUE 17 - PAIR TOKEN CANONICO
// =============================================================================
export { _buildPairFingerprint, _buildPairTokenDeterministic };

// =============================================================================
