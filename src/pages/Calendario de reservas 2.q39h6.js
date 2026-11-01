/**
 * MODULE: pages/calendario-2.js
 * VERSION: v5016-HARDENED-AUTO-STAFF
 */

import { location } from "@wix/site-location";
import { lightbox } from "@wix/site-window";

import {
    getServiceBySlugOrId,
    getAvailableDays,
    getAvailableSlots,
    getCertifiedDualSlots
} from "backend/reservas.web.js";

import {
    MESSAGE_TYPES,
    URLS,
    UI,
    BOOKINGS_ADDON_CONFIG,
    CHANNEL_TYPE,
    PAYMENT_METHOD,
    makeTraceId,
    _safeTrim,
    _safeSlugOrId,
    _looksLikeGuid,
    isDateYmd,
    withTimeout,
    _getMessageType,
    _getPayload,
    _executeWithRetry
} from "public/mmUtils";

import { createWidgetBridge } from "public/widgetBridge";
import { processDualBooking } from "backend/citasManager.web.js";

let currentServiceId = null;
let currentSlug = null;
let currentService = null;
let bridge = null;
let activeBookingMessageId = "";
let bookingInFlight = false;

const MAX_ADDONS_PER_BOOKING =
    Number(BOOKINGS_ADDON_CONFIG?.MAX_POR_RESERVA) || 5;

const VALID_PAYMENT_METHODS = Object.freeze(
    new Set(Object.values(PAYMENT_METHOD))
);

const PUBLIC_ERROR_MESSAGE =
    "No se ha podido completar la operación. Inténtalo de nuevo.";

const AVAILABILITY_ATTEMPT_TIMEOUT_MS = 45000;
const RETRYABLE_READ_CODES = new Set([
    "TIMEOUT",
    "RATE_LIMITED",
    "NETWORK_ERROR",
    "ECONNRESET",
    "ETIMEDOUT",
    "SERVICE_UNAVAILABLE",
    "INTERNAL_ERROR",
    "AVAILABILITY_FAILED",
    "WIX_API_UNAVAILABLE"
]);

function isRetryableReadError(error) {
    const code = _safeTrim(error?.code || "").toUpperCase();
    return RETRYABLE_READ_CODES.has(code) || /^(429|5\d{2})$/.test(code);
}

async function runAvailabilityWithRetry(factory, label) {
    return _executeWithRetry(async () => {
        const result = await withTimeout(
            factory,
            AVAILABILITY_ATTEMPT_TIMEOUT_MS,
            label
        );

        if (result?.status === "ERROR") {
            const code = _safeTrim(result?.error?.code || "").toUpperCase();
            if (isRetryableReadError({ code })) {
                const error = new Error(code || label);
                error.code = code || label;
                throw error;
            }
        }

        return result;
    }, 2, 500, isRetryableReadError);
}

function resultError(code) {
    return {
        status: "ERROR",
        data: null,
        error: {
            code,
            message: PUBLIC_ERROR_MESSAGE
        }
    };
}

function normalizePublicError(result) {
    if (
        !result ||
        result.status !== "ERROR" ||
        !result.error
    ) {
        return result;
    }

    return {
        ...result,
        error: {
            ...result.error,
            message: PUBLIC_ERROR_MESSAGE
        }
    };
}

function bridgeLogError(traceId, error) {
    console.error("[calendario-2] Error de comunicación", {
        traceId,
        code: error?.code,
        message: error?.message,
        detail: error?.detail
    });
}

/* ============================================================================
 * CONTEXTO DEL SERVICIO
 * ========================================================================== */

function decodeUrlValue(value) {
    const raw = _safeTrim(value || "");

    if (!raw) {
        return "";
    }

    try {
        return decodeURIComponent(raw).normalize("NFC");
    } catch (error) {
        console.warn("[calendario-2] Valor URL inválido", {
            message: error?.message
        });

        return raw.normalize("NFC");
    }
}

function normalizeLookupValue(value) {
    return _safeSlugOrId(decodeUrlValue(value));
}

async function parseUrlParams() {
    // Wix Location exposes `query` as a read-only object in the current SDK.
    // Keep method support for compatibility with older injected wrappers.
    let query = typeof location.query === "function"
        ? await location.query()
        : location.query;

    if (!query || typeof query !== "object" || Array.isArray(query)) {
        query = {};
    }

    // Some Wix page contexts can expose an empty query object despite a URL
    // containing parameters. Recover only from the current page URL.
    if (
        !query.serviceId &&
        !query.slug &&
        typeof location.url === "string"
    ) {
        try {
            query = Object.fromEntries(
                new URL(location.url).searchParams.entries()
            );
        } catch (error) {
            console.warn("[calendario-2] No se pudo leer la query de la URL", {
                message: error?.message
            });
        }
    }

    const rawServiceId = decodeUrlValue(query?.serviceId);
    const rawSlug = decodeUrlValue(query?.slug);
    const rawAddOnIds = decodeUrlValue(query?.addOnIds);

    return {
        serviceId: _looksLikeGuid(rawServiceId)
            ? rawServiceId.toLowerCase()
            : "",
        slug: normalizeLookupValue(rawSlug),
        referral: _safeTrim(decodeUrlValue(query?.referral)),
        addOnIds: rawAddOnIds
            .split(",")
            .map((value) => _safeTrim(decodeUrlValue(value)))
            .filter(Boolean)
    };
}

async function resolveServiceFromParams(params) {
    if (
        params?.serviceId &&
        _looksLikeGuid(params.serviceId)
    ) {
        return {
            serviceId: params.serviceId.toLowerCase(),
            slug: params.slug || null,
            source: "query.serviceId"
        };
    }

    if (params?.slug) {
        return {
            serviceId: null,
            slug: params.slug,
            source: "query.slug"
        };
    }

    // Same fallback strategy as Pagina de servicio 2: resolve the service
    // from the route when query parameters are unavailable.
    const path = await location.path();
    const segments = Array.isArray(path) ? path : [];
    const normalizedSegments = segments
        .map(normalizeLookupValue)
        .filter(Boolean);
    const routeSegments = new Set([
        "booking-calendar",
        "calendario-2",
        "calendario-de-reservas-2"
    ]);

    const serviceSlug = [...normalizedSegments]
        .reverse()
        .find((segment) => !routeSegments.has(segment));

    if (serviceSlug) {
        return {
            serviceId: null,
            slug: serviceSlug,
            source: "location.path"
        };
    }

    return null;
}

const SERVICE_LOOKUP_ATTEMPT_TIMEOUT_MS = 18000;

async function loadServiceContext(params, traceId = "") {
    // Only use identifiers supplied by the service-page URL. Never replace
    // an explicit slug with a guessed route segment on a retry.
    const candidates = [];
    if (_looksLikeGuid(params?.serviceId)) {
        candidates.push({
            kind: "serviceId",
            value: params.serviceId.toLowerCase()
        });
    }
    if (params?.slug) {
        candidates.push({
            kind: "slug",
            value: normalizeLookupValue(params.slug)
        });
    }

    const uniqueCandidates = candidates.filter((candidate, index, all) =>
        candidate.value &&
        all.findIndex((item) =>
            item.kind === candidate.kind && item.value === candidate.value
        ) === index
    );

    if (uniqueCandidates.length === 0) {
        throw new Error("No se recibió un identificador válido del servicio.");
    }

    const failures = [];
    let service = null;

    for (let index = 0; index < uniqueCandidates.length; index += 1) {
        const candidate = uniqueCandidates[index];
        const attempt = index + 1;

        console.info("[calendario-2] Consulta de servicio", {
            traceId,
            attempt,
            attemptsAvailable: uniqueCandidates.length,
            lookupKind: candidate.kind,
            lookupValue: candidate.value
        });

        try {
            const result = await withTimeout(
                () => getServiceBySlugOrId(candidate.value),
                SERVICE_LOOKUP_ATTEMPT_TIMEOUT_MS,
                "SERVICE_LOOKUP_TIMEOUT"
            );

            if (
                !result ||
                result.status !== "SUCCESS" ||
                !result.data ||
                typeof result.data !== "object"
            ) {
                const error = new Error(
                    result?.error?.message || "No se encontró el servicio."
                );
                error.code = result?.error?.code || "SERVICE_LOOKUP_FAILED";
                throw error;
            }

            const candidateService = result.data;
            const returnedServiceId = _safeTrim(candidateService.serviceId || "");
            const returnedSlug = normalizeLookupValue(candidateService.slug || "");

            if (!_looksLikeGuid(returnedServiceId)) {
                const error = new Error("El servicio devuelto no tiene un GUID válido.");
                error.code = "INVALID_SERVICE_ID";
                throw error;
            }

            // A GUID lookup must return that exact service. A slug lookup must
            // return the exact canonical slug; title-based fuzzy matches are not
            // accepted here because they can silently load a different service.
            if (
                candidate.kind === "serviceId" &&
                returnedServiceId.toLowerCase() !== candidate.value
            ) {
                const error = new Error("El GUID devuelto no coincide con el solicitado.");
                error.code = "SERVICE_ID_MISMATCH";
                throw error;
            }
            if (
                candidate.kind === "slug" &&
                returnedSlug !== candidate.value
            ) {
                const error = new Error("El slug devuelto no coincide con el solicitado.");
                error.code = "SERVICE_SLUG_MISMATCH";
                throw error;
            }

            service = candidateService;
            console.info("[calendario-2] Servicio localizado", {
                traceId,
                attempt,
                lookupKind: candidate.kind,
                serviceId: returnedServiceId,
                slug: returnedSlug
            });
            break;
        } catch (error) {
            failures.push({
                attempt,
                lookupKind: candidate.kind,
                code: error?.code || "SERVICE_LOOKUP_FAILED",
                message: error?.message || String(error)
            });
            console.warn("[calendario-2] Falló consulta de servicio", {
                traceId,
                attempt,
                lookupKind: candidate.kind,
                lookupValue: candidate.value,
                code: error?.code || "SERVICE_LOOKUP_FAILED",
                message: error?.message || String(error),
                willRetry: index + 1 < uniqueCandidates.length
            });
        }
    }

    if (!service) {
        const error = new Error("No se pudo localizar el servicio por GUID ni por el slug explícito.");
        error.code = "SERVICE_LOOKUP_EXHAUSTED";
        error.detail = failures;
        throw error;
    }

    const catalogEntryType = _safeTrim(
        service.catalogEntryType || "SERVICE"
    ).toUpperCase();

    if (catalogEntryType !== "SERVICE") {
        throw new Error("La entrada seleccionada no es un servicio reservable.");
    }

    currentService = service;
    currentServiceId = _safeTrim(service.serviceId);
    currentSlug = normalizeLookupValue(service.slug || "") || null;

    return {
        ...service,
        catalogEntryType: "SERVICE",
        serviceId: currentServiceId,
        slug: currentSlug,
        referral: params?.referral || "",
        addOnIds: params?.addOnIds || []
    };
}

/* ============================================================================
 * NAVEGACIÓN
 * ========================================================================== */

async function handleNavigation(payload) {
    const target = _safeTrim(
        payload?.target || ""
    ).toUpperCase();

    if (target === "SERVICIOS") {
        await location.to(
            URLS?.SERVICIOS || "/reserva-online"
        );
        return true;
    }

    if (target === "PRIVACY") {
        await location.to(
            URLS?.PRIVACY_POLICY ||
            "/politica-de-privacidad"
        );
        return true;
    }

    return false;
}

/* ============================================================================
 * NORMALIZACIÓN Y VALIDACIÓN
 * ========================================================================== */

function normalizeAvailabilityResult(result) {
    if (!result || typeof result !== "object") {
        return resultError(
            "EMPTY_AVAILABILITY_RESPONSE"
        );
    }

    if (result.status === "ERROR") {
        return normalizePublicError(result);
    }

    if (Array.isArray(result.data)) {
        return result;
    }

    return resultError(
        "INVALID_AVAILABILITY_RESPONSE"
    );
}

function normalizeAddOnIds(value) {
    if (!Array.isArray(value)) {
        return [];
    }

    const normalized = Array.from(
        new Set(
            value
                .map((item) => {
                    if (typeof item === "string") {
                        return _safeTrim(item);
                    }

                    if (
                        item &&
                        typeof item === "object"
                    ) {
                        return _safeTrim(
                            item.addonId || ""
                        );
                    }

                    return "";
                })
                .filter(Boolean)
        )
    );

    if (
        normalized.length >
        MAX_ADDONS_PER_BOOKING
    ) {
        const error = new Error(
            "Se ha superado el número máximo de complementos."
        );

        error.code = "TOO_MANY_ADDONS";
        throw error;
    }

    return normalized;
}

function validateAllowedAddonIds(ids, service) {
    const catalog = Array.isArray(
        service?.addOnOptions
    )
        ? service.addOnOptions
        : [];

    const allowed = new Set(
        catalog
            .map((item) => {
                if (typeof item === "string") {
                    return _safeTrim(item);
                }

                return _safeTrim(
                    item?.addonId || ""
                );
            })
            .filter(Boolean)
    );

    const invalidIds = ids.filter(
        (id) => !allowed.has(id)
    );

    if (invalidIds.length > 0) {
        const error = new Error(
            "Uno o más complementos no están disponibles."
        );

        error.code = "INVALID_ADDON_SELECTION";
        throw error;
    }

    return ids;
}

function resolveChannelType(bookingData) {
    const raw = _safeTrim(
        bookingData?.channelType || ""
    ).toUpperCase();

    if (
        raw === CHANNEL_TYPE.ONLINE ||
        raw === CHANNEL_TYPE.PRESENCIAL
    ) {
        return raw;
    }

    return null;
}

function isPaymentChannelAllowed(
    channelType,
    service
) {
    if (
        !service ||
        typeof service !== "object"
    ) {
        return false;
    }

    if (
        channelType === CHANNEL_TYPE.ONLINE
    ) {
        return service.onlinePayment !== false;
    }

    if (
        channelType === CHANNEL_TYPE.PRESENCIAL
    ) {
        return service.inPersonPayment !== false;
    }

    return false;
}

function normalizeSlot(slot) {
    if (
        !slot ||
        typeof slot !== "object" ||
        Array.isArray(slot)
    ) {
        return null;
    }

    const localStartDate = _safeTrim(
        slot.localStartDate || ""
    );

    const localEndDate = _safeTrim(
        slot.localEndDate || ""
    );

    const slotRef =
        slot.slotRef &&
        typeof slot.slotRef === "object" &&
        !Array.isArray(slot.slotRef)
            ? slot.slotRef
            : null;

    if (
        !localStartDate ||
        !localEndDate ||
        !slotRef
    ) {
        return null;
    }

    return {
        localStartDate,
        localEndDate,
        slotRef
    };
}

function isValidBookingSlot(slot) {
    if (
        !slot ||
        typeof slot !== "object" ||
        Array.isArray(slot) ||
        !slot.slotRef ||
        typeof slot.slotRef !== "object"
    ) {
        return false;
    }

    const start = _safeTrim(
        slot.localStartDate || ""
    );

    const end = _safeTrim(
        slot.localEndDate || ""
    );

    if (!start || !end) {
        return false;
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    return (
        !Number.isNaN(startDate.getTime()) &&
        !Number.isNaN(endDate.getTime()) &&
        startDate < endDate
    );
}

/* ============================================================================
 * PAYLOAD DE RESERVA
 * ========================================================================== */

function buildBookingRequestPayload(
    bookingData,
    fallbackTraceId
) {
    const slotF1 = normalizeSlot(
        bookingData.slotF1
    );

    const slotF2 = bookingData.slotF2
        ? normalizeSlot(bookingData.slotF2)
        : null;

    const addOnIds = validateAllowedAddonIds(
        normalizeAddOnIds(bookingData.addOnIds),
        currentService
    );

    const channelType = resolveChannelType(
        bookingData
    );

    const rawPaymentMethod = _safeTrim(
        bookingData.paymentMethod || ""
    ).toUpperCase();

    const paymentMethod =
        VALID_PAYMENT_METHODS.has(
            rawPaymentMethod
        )
            ? rawPaymentMethod
            : null;

    const payload = {
        serviceId: currentServiceId,
        slug: currentSlug,
        slotF1,
        slotF2,
        addOnIds,
        email: _safeTrim(
            bookingData.email || ""
        ),
        firstName: _safeTrim(
            bookingData.firstName || ""
        ),
        lastName: _safeTrim(
            bookingData.lastName || ""
        ),
        phone: _safeTrim(
            bookingData.phone || ""
        ),
        appointmentNote: _safeTrim(
            bookingData.appointmentNote ||
            bookingData.preferences ||
            ""
        ).slice(0, 200),
        channelType,
        rgpdConsent:
            bookingData.rgpdConsent === true,
        traceId:
            _safeTrim(
                fallbackTraceId || ""
            ) || makeTraceId("calendario-book")
    };

    if (paymentMethod) {
        payload.paymentMethod =
            paymentMethod;
    }

    return payload;
}

/* ============================================================================
 * DISPONIBILIDAD
 * ========================================================================== */

async function handleAvailability(
    payload,
    reply
) {
    if (
        !payload ||
        typeof payload !== "object" ||
        Array.isArray(payload)
    ) {
        reply(MESSAGE_TYPES.AVAIL, {
            ...resultError(
                "INVALID_AVAILABILITY_REQUEST"
            ),
            action: "",
            requestSequence: 0
        });

        return;
    }

    const action = _safeTrim(
        payload.action || ""
    ).toLowerCase();

    const requestSequence =
        Number(payload.requestSequence) || 0;

    let addOnIds;

    try {
        addOnIds = validateAllowedAddonIds(
            normalizeAddOnIds(payload.addOnIds),
            currentService
        );
    } catch (error) {
        reply(MESSAGE_TYPES.AVAIL, {
            ...resultError(
                error.code ||
                "INVALID_ADDON_SELECTION"
            ),
            action,
            requestSequence
        });

        return;
    }

    let result;

    try {
        if (action === "days") {
            const year = Number(payload.year);
            const month = Number(payload.month);

            if (
                !Number.isInteger(year) ||
                !Number.isInteger(month) ||
                month < 1 ||
                month > 12
            ) {
                result = resultError(
                    "INVALID_DATE_RANGE"
                );
            } else {
                result = await withTimeout(
                    () => runAvailabilityWithRetry(
                        () => getAvailableDays(
                            currentServiceId || currentSlug,
                            null,
                            year,
                            month,
                            addOnIds
                        ),
                        "getAvailableDays"
                    ),
                    UI?.FRONTEND_API_TIMEOUT_MS || 210000,
                    "getAvailableDays"
                );
            }
        } else if (action === "slots") {
            const dateYmd = _safeTrim(
                payload.dateYmd || ""
            );

            if (!isDateYmd(dateYmd)) {
                result = resultError(
                    "INVALID_DATE"
                );
            } else {
                const loadSlots = () => currentService?.allowCombine === true
                    ? getCertifiedDualSlots(
                        currentServiceId || currentSlug,
                        null,
                        dateYmd,
                        addOnIds
                    )
                    : getAvailableSlots(
                        currentServiceId || currentSlug,
                        null,
                        dateYmd,
                        addOnIds
                    );

                result = await withTimeout(
                    () => runAvailabilityWithRetry(loadSlots, "getAvailableSlots"),
                    UI?.FRONTEND_API_TIMEOUT_MS || 210000,
                    "getAvailableSlots"
                );
            }
        } else {
            result = resultError(
                "INVALID_AVAILABILITY_REQUEST"
            );
        }
    } catch (error) {
        console.error(
            "[calendario-2] Error de disponibilidad",
            {
                code: error?.code,
                message: error?.message
            }
        );

        result = resultError(
            error?.code === "INVALID_ADDON_SELECTION"
                ? error.code
                : "AVAILABILITY_FAILED"
        );
    }

    const normalizedResult =
        normalizeAvailabilityResult(result);

    reply(MESSAGE_TYPES.AVAIL, {
        ...normalizedResult,
        action,
        requestSequence
    });
}

/* ============================================================================
 * RESERVA
 * ========================================================================== */

async function handleBooking(
    message,
    reply,
    traceId
) {
    const bookingData = _getPayload(message);

    if (
        !bookingData ||
        typeof bookingData !== "object" ||
        Array.isArray(bookingData)
    ) {
        reply(
            MESSAGE_TYPES.BOOK,
            resultError(
                "INVALID_BOOKING_PAYLOAD"
            )
        );

        return;
    }

    const messageId = _safeTrim(
        message?.messageId || ""
    );

    if (!messageId) {
        reply(
            MESSAGE_TYPES.BOOK,
            resultError("MISSING_MESSAGE_ID")
        );

        return;
    }

    if (
        bookingInFlight ||
        messageId === activeBookingMessageId
    ) {
        reply(
            MESSAGE_TYPES.BOOK,
            resultError("DUPLICATE_REQUEST")
        );

        return;
    }

    if (!currentServiceId) {
        reply(
            MESSAGE_TYPES.BOOK,
            resultError("SERVICE_NOT_READY")
        );

        return;
    }

    let requestPayload;

    try {
        requestPayload =
            buildBookingRequestPayload(
                bookingData,
                bookingData.traceId || traceId
            );
    } catch (error) {
        reply(
            MESSAGE_TYPES.BOOK,
            resultError(
                error.code ||
                "INVALID_BOOKING_PAYLOAD"
            )
        );

        return;
    }

    if (!requestPayload.channelType) {
        reply(
            MESSAGE_TYPES.BOOK,
            resultError("INVALID_CHANNEL_TYPE")
        );

        return;
    }

    if (
        !isPaymentChannelAllowed(
            requestPayload.channelType,
            currentService
        )
    ) {
        reply(
            MESSAGE_TYPES.BOOK,
            resultError(
                "PAYMENT_CHANNEL_NOT_ALLOWED"
            )
        );

        return;
    }

    if (
        !requestPayload.serviceId &&
        !requestPayload.slug
    ) {
        reply(
            MESSAGE_TYPES.BOOK,
            resultError("MISSING_SERVICE")
        );

        return;
    }

    if (
        !isValidBookingSlot(
            requestPayload.slotF1
        )
    ) {
        reply(
            MESSAGE_TYPES.BOOK,
            resultError("INVALID_SLOT_F1")
        );

        return;
    }

    if (
        requestPayload.slotF2 &&
        !isValidBookingSlot(
            requestPayload.slotF2
        )
    ) {
        reply(
            MESSAGE_TYPES.BOOK,
            resultError("INVALID_SLOT_F2")
        );

        return;
    }

    if (
        requestPayload.slotF2 &&
        currentService?.allowCombine !== true
    ) {
        reply(
            MESSAGE_TYPES.BOOK,
            resultError(
                "DUAL_BOOKING_NOT_ALLOWED"
            )
        );

        return;
    }

    if (
        !requestPayload.email ||
        !requestPayload.firstName ||
        !requestPayload.phone ||
        requestPayload.rgpdConsent !== true
    ) {
        reply(
            MESSAGE_TYPES.BOOK,
            resultError("INVALID_CONTACT_DATA")
        );

        return;
    }

    activeBookingMessageId = messageId;
    bookingInFlight = true;

    try {
        const result = await withTimeout(
            processDualBooking(requestPayload),
            UI?.FRONTEND_API_TIMEOUT_MS ||
                60000,
            "processDualBooking"
        );

        const bookingResult =
            normalizePublicError(
                result ||
                resultError(
                    "EMPTY_BOOKING_RESPONSE"
                )
            );

        reply(
            MESSAGE_TYPES.BOOK,
            bookingResult
        );

        if (
            bookingResult.status !== "SUCCESS" ||
            !bookingResult.data ||
            !bookingResult.data.bookingId
        ) {
            return;
        }

        if (
            bookingResult.data.requiresPayment &&
            bookingResult.data.checkoutUrl
        ) {
            await location.to(
                bookingResult.data.checkoutUrl
            );

            return;
        }

        try {
            await lightbox.openLightbox(
                "ConfirmacionReserva",
                {
                    booking:
                        bookingResult.data,
                    bookingId:
                        bookingResult.data.bookingId,
                    service: currentService,
                    traceId
                }
            );
        } catch (error) {
            console.error(
                "[calendario-2] No se pudo abrir ConfirmacionReserva",
                {
                    traceId,
                    message: error?.message
                }
            );
        }
    } catch (error) {
        const isTimeout =
            error?.code === "TIMEOUT" ||
            String(
                error?.message || ""
            )
                .toUpperCase()
                .includes("TIMEOUT");

        reply(
            MESSAGE_TYPES.BOOK,
            resultError(
                isTimeout
                    ? "BOOKING_STATUS_UNCERTAIN"
                    : error?.code ||
                      "BOOKING_FAILED"
            )
        );
    } finally {
        bookingInFlight = false;
    }
}

/* ============================================================================
 * INICIALIZACIÓN
 * ========================================================================== */

$w.onReady(() => {
    const traceId = makeTraceId("calendario");
    const widget = $w("#html1");

    // Attach the message listener synchronously before awaiting URL/CMS work.
    // The HTML component can emit MM_READY as soon as it loads; if we wait
    // for parseUrlParams()/location.path() first, READY can be lost and the
    // widget will never receive MM_CONTEXT.
    if (
        !widget ||
        typeof widget.postMessage !== "function" ||
        typeof widget.onMessage !== "function"
    ) {
        console.error("[calendario-2] Widget HTML no disponible", { traceId });
        return;
    }

    try {
        bridge = createWidgetBridge(widget, {
            traceId,
            allowOpaqueOrigin: true,
            handshakeTimeoutMs: 30000,
            contextTimeoutMs: 27000,
            contextAttemptTimeoutMs: 8000,

            onContextReady: async () => {
                const params = await parseUrlParams();
                const resolved = await resolveServiceFromParams(params);

                if (!resolved) {
                    const error = new Error("No se pudo resolver el servicio desde la URL.");
                    error.code = "SERVICE_IDENTIFIER_MISSING";
                    throw error;
                }

                const contextParams = {
                    ...params,
                    serviceId: resolved.serviceId || params.serviceId || "",
                    slug: resolved.slug || params.slug || ""
                };

                currentServiceId = contextParams.serviceId || null;
                currentSlug = contextParams.slug || null;

                console.info("[calendario-2] Identificador de servicio resuelto", {
                    traceId,
                    source: resolved.source,
                    hasServiceId: Boolean(contextParams.serviceId),
                    hasSlug: Boolean(contextParams.slug),
                    slug: contextParams.slug || null
                });

                return loadServiceContext(contextParams, traceId);
            },

            onWidgetMessage: async (message, reply) => {
                const type = _getMessageType(message);
                const payload = _getPayload(message);

                if (type === MESSAGE_TYPES.NAV) {
                    const handled = await handleNavigation(payload);
                    if (!handled) {
                        reply(MESSAGE_TYPES.NAV, resultError("INVALID_NAV_TARGET"));
                    }
                    return;
                }

                if (type === MESSAGE_TYPES.AVAIL) {
                    if (!currentServiceId || !currentService) {
                        reply(MESSAGE_TYPES.AVAIL, {
                            ...resultError("SERVICE_NOT_READY"),
                            action: _safeTrim(payload?.action || "").toLowerCase(),
                            requestSequence: Number(payload?.requestSequence) || 0
                        });
                        return;
                    }

                    await handleAvailability(payload, reply);
                    return;
                }

                if (type === MESSAGE_TYPES.BOOK) {
                    await handleBooking(message, reply, traceId);
                    return;
                }

                if (type !== MESSAGE_TYPES.READY && type !== MESSAGE_TYPES.CONTEXT) {
                    console.warn("[calendario-2] Mensaje no soportado", {
                        traceId,
                        type
                    });
                }
            },

            onError: (error) => bridgeLogError(traceId, error)
        });

        if (!bridge) {
            throw new Error("No se pudo inicializar el bridge.");
        }
    } catch (error) {
        console.error("[calendario-2] Error de inicialización", {
            traceId,
            code: error?.code,
            message: error?.message
        });
    }
});
