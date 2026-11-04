/**
 * MODULE: pages/calendario-2.js
 * VERSION: v5024-HARDENED-AUTO-STAFF-DTO-AUTOSEL
 * BASE: v5023-HARDENED-AUTO-STAFF-DTO-AUTOSEL
 *
 * CORRECCIONES v5024:
 *   - DAYS-02 (P1): el bloque `days` calculaba los días filtrados al mes
 *     solicitado pero NO los asignaba a `result.data`, por lo que el widget
 *     seguía recibiendo días de otros meses si el backend los mezclaba.
 *     Ahora `result.data = days` es la única verdad enviada al widget.
 *     Si `days.length === 0`, se eliminan `recommendedDay`/`recommendedSlots`
 *     para no conservar recomendaciones de una respuesta previa. Si la
 *     precarga de slots falla, `recommendedSlots = []` (array vacío) en
 *     lugar de `undefined`.
 *
 * FIXES HEREDADOS v5023:
 *   ISO-02: isLocalIso valida calendario real (rechaza 2026-02-30).
 *   BOOK-02: buildBookingRequestPayload valida slotF1/slotF2 antes.
 *   PAIR-02: pairToken solo se incluye si existe.
 *
 * FIXES HEREDADOS v5022:
 *   DTO-07: _toWidgetSlotDto valida ISO y orden temporal.
 *   COMB-01: serviceAllowsCombine() acepta true / "true".
 *
 * FIXES HEREDADOS v5021:
 *   DTO-06: _sanitizeSlotsForWidget rechaza pares con DTO null.
 *   PAIR-01: normalizeSlot + buildBookingRequestPayload propagan pairToken.
 *   ISO-01: isLocalIso valida fecha real.
 *   DAYS-01: days filtrados al mes solicitado.
 *
 * FIXES HEREDADOS v5020:
 *   A3: _toWidgetSlotDto / _sanitizeSlotsForWidget sin resourceId.
 *   A4: normalizeSlot sin resourceId.
 *   A5: isValidBookingSlot valida ISO antes de comparar fechas.
 *
 * FIXES HEREDADOS v5019:
 *   DTO-05: sanitizeAvailabilityResponse recibe action.
 *
 * FIXES HEREDADOS v5018:
 *   DATE-01: getMadridYmdOffset con Intl "en-CA" + Date.UTC a mediodía.
 *   DTO-03: sanitizeAvailabilityResponse aplicado antes de reply().
 *   DTO-04: normalizeSlot devuelve slotRef y slot.
 *
 * FIXES HEREDADOS v5017:
 *   AUTOSEL-01: recommendedDay / recommendedSlots en action "days".
 *   DTO-01: _sanitizeSlotsForWidget antes de reply().
 *   DTO-02: normalizeSlot/isValidBookingSlot aceptan slot como fallback.
 *   LOG-01: handleAvailability recibe traceId.
 */

import { location } from "@wix/site-location";
import { window as wixWindow } from "@wix/site-window";

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
 * AUTOSEL-01 + DATE-01: helpers de fecha Madrid y DTO mínimo de slots.
 * ========================================================================== */

/**
 * DATE-01: devuelve YYYY-MM-DD (Europe/Madrid) desplazado `days` días.
 *
 * Implementación robusta:
 *   1) Extrae el Y-M-D actual en Europe/Madrid vía Intl (en-CA = ISO).
 *   2) Construye un Date UTC a MEDIODÍA con el offset aplicado. A mediodía
 *      no hay borde de cambio de día por TZ ni por DST.
 *   3) Formatea a YYYY-MM-DD con toISOString.
 */
function getMadridYmdOffset(days) {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Madrid",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });

    const parts = Object.fromEntries(
        formatter
            .formatToParts(new Date())
            .filter(({ type }) => type !== "literal")
            .map(({ type, value }) => [type, Number(value)])
    );

    const date = new Date(Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day + Number(days || 0),
        12, 0, 0
    ));

    return date.toISOString().slice(0, 10);
}

/**
 * ISO-02: validación estricta de fechas reales.
 *
 * Acepta YYYY-MM-DDTHH:MM (con segundos y/o Z opcionales) y comprueba:
 *   - mes 1-12, hora 0-23, minuto 0-59, segundo 0-59;
 *   - día dentro de los días reales del mes (rechaza 2026-02-30,
 *     2026-04-31, etc.);
 *   - Date(v).getTime() finito (defensa en profundidad).
 */
function isLocalIso(value) {
    const v = _safeTrim(value);

    const match = v.match(
        /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z)?$/
    );

    if (!match) {
        return false;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = Number(match[6] || 0);

    if (
        month < 1 ||
        month > 12 ||
        hour < 0 ||
        hour > 23 ||
        minute < 0 ||
        minute > 59 ||
        second < 0 ||
        second > 59
    ) {
        return false;
    }

    const daysInMonth = new Date(
        Date.UTC(year, month, 0)
    ).getUTCDate();

    if (day < 1 || day > daysInMonth) {
        return false;
    }

    return Number.isFinite(
        new Date(v).getTime()
    );
}

/**
 * COMB-01: normaliza `allowCombine` desde CMS (puede llegar como
 * boolean true o como string "true" si la columna es texto).
 */
function serviceAllowsCombine(service) {
    return (
        service?.allowCombine === true ||
        service?.allowCombine === "true"
    );
}

/**
 * A3 + DTO-07: DTO mínimo de slot para el widget.
 * - Sin `resourceId` (auto-staff).
 * - Rechaza ISO inválido (ISO-02) y start >= end.
 */
function _toWidgetSlotDto(slot) {
    if (!slot || typeof slot !== "object") {
        return null;
    }

    const start = _safeTrim(
        slot.localStartDate || slot.startDate || ""
    );

    const end = _safeTrim(
        slot.localEndDate || slot.endDate || ""
    );

    if (
        !isLocalIso(start) ||
        !isLocalIso(end)
    ) {
        return null;
    }

    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();

    if (
        !Number.isFinite(startTime) ||
        !Number.isFinite(endTime) ||
        startTime >= endTime
    ) {
        return null;
    }

    return {
        localStartDate: start,
        localEndDate: end,
        serviceId: _safeTrim(
            slot.serviceId || ""
        ) || null
    };
}

/**
 * DTO-06: reduce cada par a DTO mínimo.
 * - Rechaza el par si f1Dto es null (o si slotF2 existe y f2Dto es null).
 * - Elimina resourceId en todos los niveles.
 * - Conserva pairToken (de par o de f1/f2) para processDualBooking.
 */
function _sanitizeSlotsForWidget(pairs) {
    if (!Array.isArray(pairs)) return [];
    return pairs
        .map((pair) => {
            if (!pair || typeof pair !== "object") return null;
            const f1 = pair.slotF1 && typeof pair.slotF1 === "object" ? pair.slotF1 : null;
            const f2 = pair.slotF2 && typeof pair.slotF2 === "object" ? pair.slotF2 : null;
            if (!f1) return null;

            const f1Src = f1.slot || f1.slotRef || f1;
            const f2Src = f2 ? (f2.slot || f2.slotRef || f2) : null;

            const f1Dto = _toWidgetSlotDto(f1Src);
            const f2Dto = f2Src ? _toWidgetSlotDto(f2Src) : null;

            /* DTO-06 + DTO-07: rechazar el par si algún DTO es inválido. */
            if (!f1Dto || (f2 && !f2Dto)) return null;

            const pairToken = _safeTrim(
                pair.pairToken ||
                f1.pairToken ||
                f1Src.pairToken ||
                f2?.pairToken ||
                f2Src?.pairToken ||
                ""
            );

            return {
                slotF1: {
                    ...f1Dto,
                    slot: f1Dto,
                    ...(pairToken ? { pairToken } : {}),
                },
                slotF2: f2
                    ? {
                        ...f2Dto,
                        slot: f2Dto,
                        ...(pairToken ? { pairToken } : {}),
                    }
                    : null,
                pairToken,
                serviceId: _safeTrim(pair.serviceId || "") || null,
                dateYMD: _safeTrim(pair.dateYMD || ""),
            };
        })
        .filter(Boolean);
}

/**
 * DTO-03 (v5019):
 * - `data` se sanea únicamente cuando la acción devuelve slots
 *   (action === "slots").
 * - `data` de "days" conserva fechas YYYY-MM-DD.
 * - `recommendedSlots` siempre se sanea como DTO mínimo.
 */
function sanitizeAvailabilityResponse(result, action = "") {
    if (!result || typeof result !== "object") return result;

    const sanitized = { ...result };

    if (
        action === "slots" &&
        Array.isArray(sanitized.data)
    ) {
        sanitized.data = _sanitizeSlotsForWidget(sanitized.data);
    }

    if (Array.isArray(sanitized.recommendedSlots)) {
        sanitized.recommendedSlots = _sanitizeSlotsForWidget(
            sanitized.recommendedSlots
        );
    }

    return sanitized;
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
    let query = typeof location.query === "function"
        ? await location.query()
        : location.query;

    if (!query || typeof query !== "object" || Array.isArray(query)) {
        query = {};
    }

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

/**
 * PAIR-01: acepta `slot` (DTO mínimo) como fallback de `slotRef`, devuelve
 * AMBOS alias apuntando al mismo objeto y preserva `pairToken`.
 *
 * Sin `resourceId`: contrato auto-staff.
 */
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
            : slot.slot &&
              typeof slot.slot === "object" &&
              !Array.isArray(slot.slot)
            ? slot.slot
            : null;

    if (
        !localStartDate ||
        !localEndDate ||
        !slotRef
    ) {
        return null;
    }

    const pairToken = _safeTrim(
        slot.pairToken ||
        slotRef.pairToken ||
        ""
    );

    return {
        localStartDate,
        localEndDate,
        slotRef,
        slot: slotRef,
        ...(pairToken ? { pairToken } : {}),
    };
}

/**
 * ISO-01 + ISO-02: acepta `slot` como fallback y valida isLocalIso(start/end)
 * antes de comparar. isLocalIso rechaza fechas no reales
 * ("2026-02-30T10:00", "2026-04-31T10:00", "2026-99-99T99:99").
 */
function isValidBookingSlot(slot) {
    if (
        !slot ||
        typeof slot !== "object" ||
        Array.isArray(slot)
    ) {
        return false;
    }

    const ref =
        slot.slotRef &&
        typeof slot.slotRef === "object" &&
        !Array.isArray(slot.slotRef)
            ? slot.slotRef
            : slot.slot &&
              typeof slot.slot === "object" &&
              !Array.isArray(slot.slot)
            ? slot.slot
            : null;

    if (!ref) {
        return false;
    }

    const start = _safeTrim(
        slot.localStartDate || ""
    );

    const end = _safeTrim(
        slot.localEndDate || ""
    );

    if (!isLocalIso(start) || !isLocalIso(end)) {
        return false;
    }

    return new Date(start).getTime() < new Date(end).getTime();
}

/* ============================================================================
 * PAYLOAD DE RESERVA
 * ========================================================================== */

/**
 * BOOK-02: valida slotF1/slotF2 con isValidBookingSlot ANTES de construir
 * el payload y lanza INVALID_SLOT_F1 / INVALID_SLOT_F2 si no son válidos.
 * handleBooking captura esos códigos en el try/catch ya existente.
 *
 * PAIR-02: pairToken solo se añade al payload si no está vacío.
 */
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

    if (
        !slotF1 ||
        !isValidBookingSlot(slotF1)
    ) {
        const error = new Error(
            "Slot F1 inválido."
        );

        error.code = "INVALID_SLOT_F1";
        throw error;
    }

    if (
        bookingData.slotF2 &&
        (
            !slotF2 ||
            !isValidBookingSlot(slotF2)
        )
    ) {
        const error = new Error(
            "Slot F2 inválido."
        );

        error.code = "INVALID_SLOT_F2";
        throw error;
    }

    const pairToken = _safeTrim(
        bookingData.pairToken ||
        bookingData.slotF1?.pairToken ||
        bookingData.slotF2?.pairToken ||
        slotF1.pairToken ||
        slotF2?.pairToken ||
        ""
    );

    const addOnIds = validateAllowedAddonIds(
        normalizeAddOnIds(
            bookingData.addOnIds
        ),
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
            ) ||
            makeTraceId("calendario-book")
    };

    /* PAIR-02: solo si existe. */
    if (pairToken) {
        payload.pairToken = pairToken;
    }

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
    reply,
    traceId = ""
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

                /* DAYS-01 + DAYS-02:
                 * - filtra y conserva únicamente días del mes solicitado;
                 * - asigna el resultado filtrado a result.data para que el
                 *   widget nunca reciba días de otros meses;
                 * - elimina recomendaciones si no quedan días válidos. */
                if (
                    result?.status === "SUCCESS" &&
                    Array.isArray(result.data) &&
                    result.data.length > 0
                ) {
                    try {
                        const expectedPrefix =
                            `${year}-${String(month).padStart(2, "0")}-`;

                        const days = result.data
                            .map((d) =>
                                _safeTrim(
                                    typeof d === "string"
                                        ? d
                                        : d?.dateYMD || d?.dateYmd || ""
                                )
                            )
                            .filter((d) =>
                                /^\d{4}-\d{2}-\d{2}$/.test(d) &&
                                d.startsWith(expectedPrefix)
                            );

                        /* DAYS-02: los días filtrados son la única
                           verdad enviada al widget. Sin esta asignación
                           el widget seguía recibiendo días de otros
                           meses si el backend los mezclaba. */
                        result.data = days;

                        if (days.length === 0) {
                            /* Sin días válidos: limpiar cualquier
                               recomendación previa. */
                            delete result.recommendedDay;
                            delete result.recommendedSlots;
                        } else {
                            const tomorrowYmd = getMadridYmdOffset(1);
                            const recommendedDay = days.includes(tomorrowYmd)
                                ? tomorrowYmd
                                : days[0];

                            result.recommendedDay = recommendedDay;

                            /* COMB-01: serviceAllowsCombine(). */
                            const loadRecommended = () =>
                                serviceAllowsCombine(currentService)
                                    ? getCertifiedDualSlots(
                                          currentServiceId || currentSlug,
                                          null,
                                          recommendedDay,
                                          addOnIds
                                      )
                                    : getAvailableSlots(
                                          currentServiceId || currentSlug,
                                          null,
                                          recommendedDay,
                                          addOnIds
                                      );

                            const slotsResult = await withTimeout(
                                () => runAvailabilityWithRetry(
                                    loadRecommended,
                                    "getRecommendedSlots"
                                ),
                                UI?.FRONTEND_API_TIMEOUT_MS || 210000,
                                "getRecommendedSlots"
                            );

                            if (
                                slotsResult?.status === "SUCCESS" &&
                                Array.isArray(slotsResult.data)
                            ) {
                                result.recommendedSlots =
                                    _sanitizeSlotsForWidget(
                                        slotsResult.data
                                    );
                            } else {
                                /* DAYS-02: sin precarga válida, enviar
                                   array vacío para que el widget muestre
                                   "sin slots" en lugar de quedarse
                                   colgado. */
                                result.recommendedSlots = [];
                            }
                        }
                    } catch (prefetchError) {
                        console.warn(
                            "[calendario-2] Prefetch de slots recomendados falló (no bloqueante)",
                            {
                                traceId,
                                code: prefetchError?.code,
                                message: prefetchError?.message
                            }
                        );
                    }
                }
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
                /* COMB-01: serviceAllowsCombine(). */
                const loadSlots = () => serviceAllowsCombine(currentService)
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
                traceId,
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

    /* DTO-03 + DTO-05 + DTO-06 + DTO-07: sanitizeAvailabilityResponse
       distingue "days" de "slots". En "days" NO toca data. En "slots"
       reduce cada par a DTO mínimo y descarta pares con DTO inválido.
       recommendedSlots se sanea siempre. */
    const safeResult = sanitizeAvailabilityResponse(
        normalizedResult,
        action
    );

    reply(MESSAGE_TYPES.AVAIL, {
        ...safeResult,
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
        /* BOOK-02: buildBookingRequestPayload lanza INVALID_SLOT_F1 o
           INVALID_SLOT_F2 cuando los slots no pasan isValidBookingSlot. */
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

    /* COMB-01: serviceAllowsCombine(). */
    if (
        requestPayload.slotF2 &&
        !serviceAllowsCombine(currentService)
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
            await wixWindow.openLightbox("ConfirmacionReserva", {
                booking: bookingResult.data,
                bookingId: bookingResult.data.bookingId,
                service: currentService,
                traceId,
            });
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
            contextTimeoutMs: 110000,
            contextAttemptTimeoutMs: 30000,

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

                    await handleAvailability(payload, reply, traceId);
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
