/**
 * MODULE: backend/reservas.web.js
 * VERSION: v10.13-SDK-BOOKING-IDENTIFIERS
 * BASE: v10.10-SELECTED-STAFF + alineación con documentación oficial Wix Bookings V2.
 *
 * APIS:
 *   - wix-web-module (webMethod, Permissions)
 *   - @wix/bookings (availabilityTimeSlots)
 *   - @wix/members (currentMember)
 *   - backend/dataAccess.js (CMS con consistentRead)
 *   - backend/internalConfig.js (SSOT)
 *   - backend/booking/bookingUtils.js (utilidades puras + ranking)
 *
 * DOC OFICIAL:
 *   - List Availability Time Slots: https://dev.wix.com/docs/api-reference/business-solutions/bookings/time-slots/time-slots-v2/list-availability-time-slots
 *     "Use bookingPolicyViolations to filter slots based on booking restrictions.
 *      Default: all slots are returned regardless of their booking policy status."
 *   - Availability Calendar Filters: https://dev.wix.com/docs/api-reference/business-solutions/bookings/availability-calendar/supported-filters
 *   - Create Booking: https://dev.wix.com/docs/api-reference/business-solutions/bookings/bookings/bookings-writer-v2/create-booking
 *     "Specify the slot's startDate, endDate, resource, and location."
 *   - Wix Data eventual consistency: https://dev.wix.com/docs/api-reference/business-solutions/cms/eventual-consistency
 *
 * CORRECCIONES v10.11-LOCATION-SCHEDULE-ALIGNED:
 *   RES-49 (P0): _resolveAvailabilityLocation resuelve locationId desde
 *     ServiciosCatalogo.locationId (DTO). Fallback a SDK_CONFIG.LOCATION_ID.
 *     Elimina el hardcode que forzaba todas las consultas a una única sede.
 *   RES-50 (P0): bookingPolicyViolations en _listTimeSlotsV2 con filtros
 *     bookOnlineDisabled, tooEarlyToBook, tooLateToBook. Sin este filtro,
 *     Wix devuelve slots no reservables.
 *   RES-51 (P1): bookingPolicyViolations también en
 *     revalidateExactAvailabilitySlot (revalidación coherente con listado).
 *   RES-52 (P1): consistentRead: true en todas las lecturas CMS.
 *     Sustituye STRONG_READ / consistencyMode.
 *   RES-53 (P1): _toPublicService preserva linkedPhases y clientHidden.
 *   RES-54 (P2): _normalizeAddon solo acepta addonId (SSOT CMS KEY FIELDS).
 *   RES-55 (P2): ranking de carga delegado en bookingUtils (un solo origen).
 *
 * RES-56 (P0): usar Location._id en las llamadas SDK de Time Slots V2.
 * RES-57 (P0): Query Extended Bookings SDK V2 devuelve resource._id; se
 *   usa ese campo para calcular la carga real de profesionales.
 *   El contrato SDK no acepta Location.id como identificador de ubicacion.
 * FIXES HEREDADOS v10.10: RES-46..RES-48 (staff seleccionado, F2 filtrado).
 * FIXES HEREDADOS v10.9: RES-40..RES-45.
 * FIXES HEREDADOS v10.7: RES-32..RES-34.
 */
import { webMethod, Permissions } from "wix-web-module";
import {
    query as dalQuery,
    removeById,
    saveItem,
    insertItem as dalInsert,
} from "backend/dataAccess";
import { availabilityTimeSlots, extendedBookings } from "@wix/bookings";
import { auth } from "@wix/essentials";
import { currentMember } from "@wix/members";
import {
    BUSINESS_COLLECTIONS,
    OPERATIONAL_COLLECTIONS,
    CONTROL_TYPE,
    CITAS_BOOKING_STATUS,
    BOOKING_FIELDS,
    SDK_CONFIG,
    SLOT_SEARCH,
    API,
    STAFF_DEFAULT_NAME,
} from "backend/internalConfig";
import {
    findStaffByResourceId,
    getStaffDisplayName as _resolveDisplayName,
} from "backend/staff";
import { readControlPayload } from "backend/data";
import { _toPublicError } from "backend/responseUtils";
import {
    makeTraceId,
    _safeTrim,
    _safeSlugOrId,
    _looksLikeGuid,
    _normalizeLocalIsoStr,
    getUtcDateFromMadridLocal,
    getMadridLocalStringNoZ,
    _executeWithRetry,
    _hashKey,
    _generateUUID,
    _toDateSafe,
    withTimeout,
} from "public/mmUtils";
import {
    normalizeSlotShape as _normalizeSlotShapeShared,
    getResourceIdsFromSlot as _getResourceIdsFromSlotShared,
    _rankResourcesByLoad as _rankResourcesByLoadShared,
} from "backend/booking/bookingUtils";
import { logger } from "backend/logger";
import { rateLimiter } from "backend/security";

const log = logger;

/* =============================================================================
 * CONSTANTES
 * ==========================================================================*/
const SERVICIOS_COL = BUSINESS_COLLECTIONS.SERVICIOS_CATALOGO;
const CITAS_COL = BUSINESS_COLLECTIONS.CITAS_F2;
const queryExtendedBookingsElevated = auth.elevate(extendedBookings.queryExtendedBookings);
const CONTROL_COL = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
const CT_DUAL_CACHE = (CONTROL_TYPE && CONTROL_TYPE.DUAL_CACHE) || "DUAL_CACHE";
const CT_DAYS_CACHE = (CONTROL_TYPE && CONTROL_TYPE.DAYS_CACHE) || "DAYS_CACHE";
const CT_DISPLAY_TOKEN = (CONTROL_TYPE && CONTROL_TYPE.DISPLAY_TOKEN) || "DISPLAY_TOKEN";

/** RES-52: lectura consistente (primaria). Wix Data es eventualmente consistente. */
const CONSISTENT_READ = Object.freeze({ consistentRead: true });

const WATCHDOG_TIMEOUT_MS = Number(SDK_CONFIG?.TIMEOUTS?.WATCHDOG_MS) || 15000;
const SERVICE_CACHE_TTL_MS = Number(SDK_CONFIG?.CACHE?.SERVICES_TTL_MS) || 120000;
const SLOTS_CACHE_TTL_MS = Number(SDK_CONFIG?.CACHE?.SLOTS_CACHE_TTL_MS) || 60000;
const DUAL_CACHE_TTL_MS = Number(SDK_CONFIG?.CACHE?.DUAL_CACHE_TTL_MS) || 300000;
const DISPLAY_TOKEN_TTL_MS = 30 * 60 * 1000;
const DISPLAY_TOKEN_MAX_ATTEMPTS = 5;

const DIAS_LIMITE = Number(SLOT_SEARCH?.DIAS_LIMITE) || 14;
const CACHE_MAX_SIZE = Number(SDK_CONFIG?.CACHE?.MAX_ENTRIES) || 500;

/**
 * Strict ASCII key for matching service slugs and human-readable titles.
 * Diacritics are folded; every non-ASCII/non-alphanumeric run becomes "-".
 * This key is for lookup only; the canonical CMS slug remains unchanged.
 */
function _normalizeServiceLookupKey(value) {
    const raw = _safeTrim(value, 200);
    if (!raw) return "";
    return raw
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

const DAYS_CACHE_VERSION = String(SDK_CONFIG?.CACHE?.DAYS_CACHE_VERSION || "v1");
const STAFF_RESOURCE_TYPE_ID = API.STAFF_RESOURCE_TYPE_ID;

const availabilityCache = new Map();
const inflightRequests = new Map();
const serviceCatalogRAM = new Map();

/* =============================================================================
 * HELPERS DE ERROR
 * ==========================================================================*/

function _rateLimitError(surface, retryAfter) {
    const error = new Error("RATE_LIMITED");
    error.code = "RATE_LIMITED";
    error.meta = { retryAfter, surface };
    return error;
}

/* =============================================================================
 * HELPERS INTERNOS
 * ==========================================================================*/
function _readField(item, field) {
    if (!item || typeof item !== "object") return null;
    return item[field] ?? item.data?.[field] ?? item.fields?.[field] ?? null;
}

function _parseAddons(value) {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string") return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

function _extractMediaUrl(value) {
    if (!value) return "";
    if (typeof value === "string") return _safeTrim(value);
    if (typeof value === "object") return _safeTrim(value.url || value.src || value.fileUrl || "");
    return "";
}

function _extractFirstRelationId(value) {
    if (!value) return "";
    if (typeof value === "string") return _safeTrim(value);
    if (Array.isArray(value)) return _extractFirstRelationId(value[0]);
    if (typeof value === "object") return _safeTrim(value._id || value.id || value.locationId || "");
    return "";
}

/** RES-54: solo addonId (SSOT CMS KEY FIELDS). */
function _normalizeAddon(addon) {
    if (!addon || typeof addon !== "object") return null;
    const addonId = _safeTrim(addon.addonId || "");
    if (!_looksLikeGuid(addonId)) return null;
    const rawPrice = Number(addon.price ?? 0);
    const price = Number.isFinite(rawPrice) && rawPrice >= 0 ? rawPrice : 0;
    return {
        addonId,
        name: _safeTrim(addon.name || addon.nombreComplemento) || "Complemento",
        price,
    };
}

function _resolveAddonContext(service, requestedAddonIds) {
    const catalog = Array.isArray(service?.addOnOptions) ? service.addOnOptions : [];
    const catalogIds = new Set(catalog.map((a) => _safeTrim(a?.addonId || "")).filter((id) => _looksLikeGuid(id)));
    const requested = Array.from(new Set((Array.isArray(requestedAddonIds) ? requestedAddonIds : [])
        .map((id) => _safeTrim(id)).filter((id) => _looksLikeGuid(id))));
    const validated = requested.filter((id) => catalogIds.has(id));
    if (requested.length > 0 && validated.length !== requested.length) {
        log.warn("_resolveAddonContext: addOnIds fuera de catalogo", {
            requested: requested.length,
            validated: validated.length,
        });
    }
    return { addOnIds: validated, nativeAddonIds: validated };
}

async function _getStaffDisplayName(resourceId) {
    const id = _safeTrim(resourceId);
    if (!id || !_looksLikeGuid(id)) return STAFF_DEFAULT_NAME;
    try {
        const staff = await findStaffByResourceId(id);
        return _resolveDisplayName(staff);
    } catch (e) {
        log.warn("_getStaffDisplayName failed", { resourceId: id, error: e?.message });
        return STAFF_DEFAULT_NAME;
    }
}

function _cacheSetBounded(map, key, value, maxSize) {
    if (map.has(key)) map.delete(key);
    map.set(key, value);
    if (map.size <= maxSize) return;
    const firstKey = map.keys().next().value;
    if (firstKey) map.delete(firstKey);
}

function _buildRateLimitKey(surface, visitorId, ipHash) {
    return `${_safeTrim(visitorId) || "anon"}:${_safeTrim(ipHash) || "noip"}:${surface}`;
}

async function _rateLimitOrThrow(surface, key) {
    const result = await rateLimiter({ surface, key });
    if (result && result.allowed) return;
    throw _rateLimitError(surface, result?.retryAfter ?? null);
}

async function _getVisitorIdentity() {
    try {
        const response = await currentMember.getMember();
        const member = response?.member || response;
        if (member && member.status === "ERROR") return { memberId: "", isAuthenticated: false };
        const memberId = _safeTrim(member?._id || member?.id || member?.memberId || "");
        return { memberId, isAuthenticated: Boolean(memberId) };
    } catch (_) {
        return { memberId: "", isAuthenticated: false };
    }
}

function _hashIp(ipAddress) {
    const ip = _safeTrim(ipAddress);
    return ip ? _hashKey(ip).slice(0, 16) : "";
}

function _normalizeSlotShape(slot) { return _normalizeSlotShapeShared(slot); }
function _getResourceIdsFromSlot(slot) { return _getResourceIdsFromSlotShared(slot, STAFF_RESOURCE_TYPE_ID); }

function _attachServiceId(slot, forcedServiceId, traceId, ctx) {
    const s = _normalizeSlotShape(slot);
    if (!s) return null;
    const serviceId = _safeTrim(forcedServiceId);
    if (!serviceId || !_looksLikeGuid(serviceId)) {
        log.error("_attachServiceId: invalid serviceId", { traceId, ctx, serviceId });
        return null;
    }
    return {
        ...s,
        serviceId,
        ...(s.slot && typeof s.slot === "object" ? { slot: { ...s.slot, serviceId } } : {}),
    };
}

function _isValidMadridYmd(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(_safeTrim(value));
    if (!match) return false;
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function _addDaysYMD(ymd, days) {
    if (!_isValidMadridYmd(ymd)) return "";
    const parts = String(ymd).split("-").map(Number);
    const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
    dt.setUTCDate(dt.getUTCDate() + Number(days || 0));
    return dt.toLocaleDateString("sv-SE", { timeZone: SDK_CONFIG.TZ });
}

function _filterDaysByLimit(daysArray) {
    if (!Array.isArray(daysArray) || daysArray.length === 0) return [];
    const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: SDK_CONFIG.TZ });
    const tomorrowStr = _addDaysYMD(todayStr, 1);
    const maxDateStr = _addDaysYMD(todayStr, DIAS_LIMITE);
    if (!tomorrowStr || !maxDateStr) return [];
    return daysArray.filter((date) => date >= tomorrowStr && date <= maxDateStr);
}

function _normalizeResourceIdsStrict(resourceId, traceId) {
    const normalized = _safeTrim(resourceId);
    if (!normalized || ["all", "any"].includes(normalized.toLowerCase())) return [];
    if (!_looksLikeGuid(normalized)) {
        log.warn("_normalizeResourceIdsStrict: invalid staff identifier", { resourceId: normalized, traceId });
        return null;
    }
    return [normalized];
}

function _minutesBetweenUtcDates(a, b) {
    if (!(a instanceof Date) || !(b instanceof Date)) return 0;
    const ms = b.getTime() - a.getTime();
    if (!Number.isFinite(ms) || ms <= 0) return 0;
    return Math.round(ms / 60000);
}

function _isValidSlotRange(startLocal, endLocal) {
    const startUtc = getUtcDateFromMadridLocal(_normalizeLocalIsoStr(startLocal));
    const endUtc = getUtcDateFromMadridLocal(_normalizeLocalIsoStr(endLocal));
    return Boolean(startUtc && endUtc && endUtc.getTime() > startUtc.getTime());
}

/**
 * RES-49: resuelve la ubicación para consultas de disponibilidad.
 * Prioridad: service.locationId (CMS) → SDK_CONFIG.LOCATION_ID (fallback).
 * El tipo para consultas es siempre "BUSINESS".
 */
function _resolveAvailabilityLocation(service) {
    const fromCms = _safeTrim(service && service.locationId);
    const fromConfig = _safeTrim(SDK_CONFIG && SDK_CONFIG.LOCATION_ID);
    const locationId = _looksLikeGuid(fromCms)
        ? fromCms
        : _looksLikeGuid(fromConfig)
        ? fromConfig
        : "";
    if (!locationId) {
        log.error("_resolveAvailabilityLocation: no valid locationId", {
            cmsLocationId: fromCms || null,
            configLocationId: fromConfig || null,
        });
        return null;
    }
    return Object.freeze({ _id: locationId, locationType: "BUSINESS" });
}

/* =============================================================================
 * CATÁLOGO DE SERVICIOS
 * ==========================================================================*/
export async function _getServiceBySlugOrIdInternal(slugOrId, externalTraceId = null, visited = new Set()) {
    const traceId = externalTraceId || makeTraceId("service");
    const raw = _safeTrim(slugOrId);
    const lookupValue = raw
        ? raw.split("?")[0].split("#")[0].replace(/^\/+/, "").replace(/\/+$/, "")
        : "";
    const isGuid = _looksLikeGuid(lookupValue);
    // Wix GUIDs are canonicalized; all slug lookups are strict ASCII.
    const clean = isGuid ? lookupValue.toLowerCase() : _safeSlugOrId(lookupValue);
    if (!clean) {
        return {
            status: "ERROR", data: null,
            error: { code: "INVALID_SERVICE_LOOKUP", message: "Invalid service slug or ID." },
        };
    }
    const cycleKey = clean.toLowerCase();
    if (visited.has(cycleKey)) {
        return {
            status: "ERROR", data: null,
            error: { code: "SERVICE_LINK_CYCLE", message: "Circular linked service configuration." },
        };
    }
    const cached = serviceCatalogRAM.get(clean);
    if (cached && Date.now() - cached.timestamp < SERVICE_CACHE_TTL_MS) {
        return { status: "SUCCESS", data: cached.data, error: null };
    }
    try {
        let result;
        if (isGuid) {
            result = await withTimeout(
                dalQuery(SERVICIOS_COL).limit(1).eq("serviceId", clean).find(CONSISTENT_READ),
                WATCHDOG_TIMEOUT_MS,
                "getServiceBySlugOrId:serviceId"
            );
        } else {
            result = await withTimeout(
                dalQuery(SERVICIOS_COL).limit(1).eq("slug", clean).find(CONSISTENT_READ),
                WATCHDOG_TIMEOUT_MS,
                "getServiceBySlugOrId:slug"
            );
            if (!result?.items?.[0] && _looksLikeGuid(clean)) {
                result = await withTimeout(
                    dalQuery(SERVICIOS_COL).limit(1).eq("serviceId", clean).find(CONSISTENT_READ),
                    WATCHDOG_TIMEOUT_MS,
                    "getServiceBySlugOrId:guidFallback"
                );
            }
        }
        let service = result?.items?.[0] || null;

        // Legacy/dynamic URLs may be generated from the service title rather
        // than the shorter canonical CMS slug. Match only an exact normalized
        // ASCII title/slug key; reject collisions instead of guessing.
        if (!service && !isGuid) {
            const catalog = await withTimeout(
                dalQuery(SERVICIOS_COL).limit(1000).find(CONSISTENT_READ),
                WATCHDOG_TIMEOUT_MS,
                "getServiceBySlugOrId:titleFallback"
            );
            const matches = (catalog?.items || []).filter((row) => {
                const slugKey = _normalizeServiceLookupKey(_readField(row, "slug"));
                const titleKey = _normalizeServiceLookupKey(_readField(row, "title"));
                return slugKey === clean || titleKey === clean;
            });
            const uniqueMatches = new Map(
                matches.map((row) => [
                    _safeTrim(_readField(row, "serviceId") || row._id),
                    row,
                ])
            );
            if (uniqueMatches.size === 1) {
                service = uniqueMatches.values().next().value;
                log.info("Service resolved by normalized ASCII title/slug", {
                    traceId,
                    key: clean,
                });
            } else if (uniqueMatches.size > 1) {
                log.warn("Ambiguous service lookup rejected", {
                    traceId,
                    key: clean,
                    matches: uniqueMatches.size,
                });
                return {
                    status: "ERROR", data: null,
                    error: { code: "SERVICE_LOOKUP_AMBIGUOUS", message: "Service lookup is ambiguous." },
                };
            }
        }

        if (!service) {
            log.error("Service not found in ServiciosCatalogo", { key: clean, traceId });
            return {
                status: "ERROR", data: null,
                error: { code: "SERVICE_NOT_FOUND", message: "Service not found." },
            };
        }
        const nextVisited = new Set(visited);
        nextVisited.add(cycleKey);
        const catalogEntryType = _safeTrim(_readField(service, "catalogEntryType")).toUpperCase();
        const mapped = catalogEntryType === "PRICING_PLAN"
            ? _mapPricingPlanToDTO(service)
            : await _mapServiceImport2ToUX(service, traceId, nextVisited);
        _cacheSetBounded(serviceCatalogRAM, clean, { data: mapped, timestamp: Date.now() }, CACHE_MAX_SIZE);
        if (mapped.serviceId) _cacheSetBounded(serviceCatalogRAM, mapped.serviceId, { data: mapped, timestamp: Date.now() }, CACHE_MAX_SIZE);
        if (mapped.slug) _cacheSetBounded(serviceCatalogRAM, mapped.slug, { data: mapped, timestamp: Date.now() }, CACHE_MAX_SIZE);
        return { status: "SUCCESS", data: mapped, error: null };
    } catch (e) {
        log.error("Error in getServiceBySlugOrId", { error: e?.message, traceId });
        return {
            status: "ERROR", data: null,
            error: { code: "DATABASE_ERROR", message: e?.message || "Error al consultar la base de datos." },
        };
    }
}

export async function _resolveServiceIdInternal(serviceIdReq) {
    const raw = _safeTrim(serviceIdReq);
    if (!raw) return null;
    if (_looksLikeGuid(raw)) return raw;
    const normalized = _safeSlugOrId(raw);
    if (!normalized) return null;
    const res = await _getServiceBySlugOrIdInternal(normalized);
    if (res?.status === "SUCCESS" && res?.data?.serviceId) {
        const sid = _safeTrim(res.data.serviceId);
        if (sid && _looksLikeGuid(sid)) return sid;
    }
    return null;
}

export async function _mapServiceToDTO(service, traceId, visited = new Set()) {
    const serviceId = _safeTrim(_readField(service, "serviceId"));
    if (!_looksLikeGuid(serviceId)) {
        throw new Error("ServiciosCatalogo invalid: serviceId missing or not a GUID");
    }
    const clientHidden = _readField(service, "clientHidden") === true;
    const rawAllowCombine = _readField(service, "allowCombine") === true;
    const allowCombine = !clientHidden && rawAllowCombine;
    const linkedPhases = _safeTrim(_readField(service, "linkedPhases"));
    if (rawAllowCombine && !_looksLikeGuid(linkedPhases)) {
        throw new Error("ServiciosCatalogo invalid: linkedPhases missing or not a GUID");
    }
    const rawPhase1Duration = _readField(service, "phase1Duration");
    const rawExposureDuration = _readField(service, "exposureDuration");
    const rawPhase2Duration = _readField(service, "phase2Duration");
    const rawTotalDuration = _readField(service, "totalDuration");
    if (rawAllowCombine) {
        const dualDurations = [
            ["phase1Duration", rawPhase1Duration],
            ["exposureDuration", rawExposureDuration],
            ["phase2Duration", rawPhase2Duration],
            ["totalDuration", rawTotalDuration],
        ];
        for (const [field, value] of dualDurations) {
            if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
                throw new Error(`ServiciosCatalogo invalid: dual service ${field} must be an explicit non-negative number`);
            }
        }
        const linkedRes = await _getServiceBySlugOrIdInternal(linkedPhases, traceId, visited);
        if (linkedRes?.status !== "SUCCESS" || !linkedRes.data) {
            throw new Error("ServiciosCatalogo invalid: linked service unavailable or unresolvable");
        }
    }
    const phase1Duration = Number(rawPhase1Duration) || 0;
    const exposureDuration = Number(rawExposureDuration) || 0;
    const phase2Duration = Number(rawPhase2Duration) || 0;
    const storedTotalDuration = Number(rawTotalDuration) || 0;
    const calculatedDuration = allowCombine ? phase1Duration + exposureDuration + phase2Duration : phase1Duration;
    const durationCandidate = Math.max(storedTotalDuration, calculatedDuration);
    const estimatedTotal = durationCandidate > 0 ? durationCandidate : 30;
    const title = _safeTrim(_readField(service, "title")) || "Servicio";
    const price = Number(_readField(service, "price")) || 0;
    const currency = _safeTrim(_readField(service, "currency")) || "EUR";
    const slug = _safeTrim(_readField(service, "slug")) || null;
    const mainMedia = _extractMediaUrl(_readField(service, "mainMedia"));
    const location = _safeTrim(_readField(service, "location")) || null;
    const locationId = _extractFirstRelationId(_readField(service, "locationId")) || null;
    const tagLine = _safeTrim(_readField(service, "tagLine")) || null;
    const description = _safeTrim(_readField(service, "description")) || null;
    const recommendations = _normalizeRecommendations(_readField(service, "recomendaciones"));
    const nameRef = _readField(service, "name");
    const referencedAddons = Array.isArray(nameRef) ? nameRef : [];
    const rawAddons = referencedAddons.length > 0
        ? referencedAddons
        : (_readField(service, "addOnOptions") ?? _readField(service, "addons"));
    const addOnOptions = _parseAddons(rawAddons).map((addon) => _normalizeAddon(addon)).filter(Boolean);

    return {
        catalogEntryType: "SERVICE",
        serviceId,
        sku: _safeTrim(_readField(service, "sku")) || null,
        slug,
        title,
        description,
        tagLine,
        price,
        currency,
        location,
        locationId,
        mainMedia,
        totalDuration: estimatedTotal,
        phase1Duration,
        phase2Duration,
        exposureDuration,
        allowCombine,
        linkedPhases: allowCombine ? linkedPhases : null,
        clientHidden,
        onlinePayment: _readField(service, "onlinePayment") !== false,
        inPersonPayment: _readField(service, "inPersonPayment") !== false,
        addOnOptions,
        recommendations,
    };
}

function _normalizeRecommendations(value) {
    if (Array.isArray(value)) return value.map(_safeTrim).filter(Boolean);
    if (typeof value !== "string") return [];
    return value
        .split(/\r?\n/)
        .map((line) => _safeTrim(line).replace(/^[•·▪*-]\s*/, ""))
        .filter(Boolean);
}

function _mapPricingPlanToDTO(row) {
    const pricingPlanId = _safeTrim(_readField(row, "pricingPlanId"));
    const rawSessionCount = Number(_readField(row, "sessionCount"));
    const slug = _safeSlugOrId(_readField(row, "slug"));
    const title = _safeTrim(_readField(row, "title"));
    const price = Number(_readField(row, "price"));
    const currency = _safeTrim(_readField(row, "currency") || "EUR").toUpperCase();

    if (!_looksLikeGuid(pricingPlanId)) {
        throw new Error("ServiciosCatalogo invalid: pricingPlanId missing or not a GUID");
    }
    if (!Number.isSafeInteger(rawSessionCount) || rawSessionCount < 1) {
        throw new Error("ServiciosCatalogo invalid: sessionCount must be a positive integer");
    }
    if (!slug || !_safeTrim(_readField(row, "slug"))) {
        throw new Error("ServiciosCatalogo invalid: pricing plan slug missing or invalid");
    }
    if (!title) {
        throw new Error("ServiciosCatalogo invalid: pricing plan title missing");
    }
    if (!Number.isFinite(price) || price < 0) {
        throw new Error("ServiciosCatalogo invalid: pricing plan price missing or invalid");
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
        throw new Error("ServiciosCatalogo invalid: pricing plan currency must be ISO 4217");
    }

    const recommendations = _normalizeRecommendations(_readField(row, "recomendaciones"));
    return {
        catalogEntryType: "PRICING_PLAN",
        pricingPlanId,
        sessionCount: rawSessionCount,
        slug,
        title,
        description: _safeTrim(_readField(row, "description")) || null,
        tagLine: _safeTrim(_readField(row, "tagLine")) || null,
        price,
        currency,
        location: _safeTrim(_readField(row, "location")) || null,
        mainMedia: _extractMediaUrl(_readField(row, "mainMedia")),
        recommendations,
        clientHidden: _readField(row, "clientHidden") === true,
        allowCombine: false,
        linkedPhases: null,
        totalDuration: 0,
        phase1Duration: 0,
        phase2Duration: 0,
        exposureDuration: 0,
        onlinePayment: true,
        inPersonPayment: false,
        addOnOptions: [],
        primaryActionLabel: "Comprar bono",
    };
}

export async function _mapServiceImport2ToUX(row, traceId = null, visited = new Set()) {
    return _mapServiceToDTO(row, traceId || makeTraceId("ux-map"), visited);
}

export async function getServiceForBookingInternal(serviceId, traceId = null) {
    return _getServiceBySlugOrIdInternal(serviceId, traceId || makeTraceId("service-internal"));
}

/* =============================================================================
 * WEB METHODS PÚBLICOS (CATÁLOGO)
 * ==========================================================================*/
export const getServiceBySlugOrId = webMethod(
    Permissions.Anyone,
    async function getServiceBySlugOrId(slugOrId) {
        const traceId = makeTraceId("wm-svc");
        try {
            const visitor = await _getVisitorIdentity();
            const rateKey = _buildRateLimitKey("reservas", visitor.memberId, "");
            await _rateLimitOrThrow("reservas", rateKey);
            const result = await _getServiceBySlugOrIdInternal(slugOrId, traceId);
            if (result?.status === "SUCCESS" && result?.data?.clientHidden === true) {
                return {
                    status: "ERROR", data: null,
                    error: { code: "SERVICE_NOT_AVAILABLE", message: "Service is not available for booking." },
                };
            }
            return result?.status === "SUCCESS"
                ? { status: "SUCCESS", data: _toPublicService(result.data), error: null }
                : result;
        } catch (err) {
            return { status: "ERROR", data: null, error: _toPublicError(err, "SERVICE_LOOKUP_FAILED") };
        }
    }
);

export const resolveServiceId = webMethod(
    Permissions.Anyone,
    async (serviceIdReq) => {
        const traceId = makeTraceId("wm-svc-resolve");
        try {
            const visitor = await _getVisitorIdentity();
            const rateKey = _buildRateLimitKey("reservas", visitor.memberId, "");
            await _rateLimitOrThrow("reservas", rateKey);
            const resolved = await _resolveServiceIdInternal(serviceIdReq);
            if (!resolved) {
                return {
                    status: "ERROR", data: null,
                    error: { code: "SERVICE_NOT_FOUND", message: "Identificador de servicio no encontrado." },
                };
            }
            return { status: "SUCCESS", data: String(resolved), error: null };
        } catch (err) {
            return { status: "ERROR", data: null, error: _toPublicError(err, "SERVICE_RESOLVE_FAILED") };
        }
    }
);

/** RES-56: explicit public DTO allowlist; never spread CMS records. */
export function _toPublicService(service) {
    if (!service || typeof service !== "object" || Array.isArray(service)) return null;

    const finiteNonNegative = (value) => {
        const number = Number(value);
        return Number.isFinite(number) && number >= 0 ? number : 0;
    };
    const text = (value) => typeof value === "string" ? _safeTrim(value) : "";
    const catalogEntryType = text(service.catalogEntryType).toUpperCase() || "SERVICE";
    const recommendations = Array.isArray(service.recommendations)
        ? service.recommendations
            .filter((item) => typeof item === "string")
            .map(text)
            .filter(Boolean)
        : [];
    const addOnOptions = Array.isArray(service.addOnOptions)
        ? service.addOnOptions
            .filter((item) => item && typeof item === "object" && !Array.isArray(item))
            .map((item) => ({
                addonId: _looksLikeGuid(item.addonId) ? _safeTrim(item.addonId) : "",
                name: text(item.name),
                price: finiteNonNegative(item.price),
            }))
            .filter((item) => item.addonId && item.name)
        : [];
    const pricingPlanId = _looksLikeGuid(service.pricingPlanId)
        ? _safeTrim(service.pricingPlanId)
        : "";

    const common = {
        catalogEntryType,
        slug: text(service.slug),
        title: text(service.title) || "Servicio",
        description: text(service.description),
        tagLine: text(service.tagLine),
        location: text(service.location),
        price: finiteNonNegative(service.price),
        currency: /^[A-Z]{3}$/.test(text(service.currency).toUpperCase())
            ? text(service.currency).toUpperCase()
            : "EUR",
        mainMedia: service.mainMedia || "",
        recommendations,
        clientHidden: service.clientHidden === true,
        primaryActionLabel: text(service.primaryActionLabel),
    };

    if (catalogEntryType === "PRICING_PLAN") {
        return {
            ...common,
            pricingPlanId,
            sessionCount: Number.isSafeInteger(Number(service.sessionCount)) && Number(service.sessionCount) > 0
                ? Number(service.sessionCount)
                : 0,
        };
    }

    return {
        ...common,
        serviceId: _looksLikeGuid(service.serviceId) ? _safeTrim(service.serviceId) : "",
        totalDuration: finiteNonNegative(service.totalDuration),
        addOnOptions,
        allowCombine: service.allowCombine === true,
        phase1Duration: finiteNonNegative(service.phase1Duration),
        exposureDuration: finiteNonNegative(service.exposureDuration),
        phase2Duration: finiteNonNegative(service.phase2Duration),
        linkedPhases: _looksLikeGuid(service.linkedPhases)
            ? _safeTrim(service.linkedPhases)
            : null,
        onlinePayment: service.onlinePayment !== false,
        inPersonPayment: service.inPersonPayment !== false,
    };
}

export async function _resolveAddonContextPublic(service, requestedAddonIds) {
    return _resolveAddonContext(service, requestedAddonIds);
}

export async function _getStaffDisplayNamePublic(resourceId) {
    return _getStaffDisplayName(resourceId);
}

/* =============================================================================
 * REVALIDACIÓN EXACTA DE SLOT (RES-51)
 * ==========================================================================*/
export async function revalidateExactAvailabilitySlot({
    serviceId, localStartDate, localEndDate, resourceId, nativeAddonIds = [], traceId,
}) {
    const activeTraceId = traceId || makeTraceId("exact-slot");
    const resolvedServiceId = await _resolveServiceIdInternal(serviceId);
    const start = _normalizeLocalIsoStr(localStartDate);
    const end = _normalizeLocalIsoStr(localEndDate);
    const requiredResourceId = _safeTrim(resourceId || "");
    if (requiredResourceId && !_looksLikeGuid(requiredResourceId)) {
        return { status: "ERROR", data: null, error: { code: "INVALID_RESOURCE_ID", message: "Invalid staff identifier." } };
    }
    if (!resolvedServiceId || !start || !end) {
        return { status: "ERROR", data: null, error: { code: "INVALID_SLOT_RECHECK", message: "Selected slot data is invalid." } };
    }
    try {
        const serviceRes = await _getServiceBySlugOrIdInternal(resolvedServiceId, activeTraceId);
        const service = serviceRes?.data;
        const location = _resolveAvailabilityLocation(service);
        if (!location) {
            return { status: "ERROR", data: null, error: { code: "LOCATION_NOT_CONFIGURED", message: "Service has no valid locationId." } };
        }

        const normalizedNativeAddonIds = Array.from(new Set(
            (Array.isArray(nativeAddonIds) ? nativeAddonIds : []).map((id) => _safeTrim(id)).filter((id) => _looksLikeGuid(id))
        )).sort();
        let rawSlot = null;
        if (normalizedNativeAddonIds.length > 0) {
            const listPayload = {
                serviceId: String(resolvedServiceId),
                fromLocalDate: start,
                toLocalDate: end,
                timeZone: SDK_CONFIG.TZ,
                bookable: true,
                locations: [location],
                includeResourceTypeIds: [STAFF_RESOURCE_TYPE_ID],
                customerChoices: { addOnIds: normalizedNativeAddonIds },
                bookingPolicyViolations: {
                    bookOnlineDisabled: false,
                    tooEarlyToBook: false,
                    tooLateToBook: false,
                },
            };
            if (requiredResourceId) {
                listPayload.resourceTypes = [{ resourceTypeId: STAFF_RESOURCE_TYPE_ID, resourceIds: [requiredResourceId] }];
            }
            const listed = await _executeWithRetry(
                () => withTimeout(availabilityTimeSlots.listAvailabilityTimeSlots(listPayload), WATCHDOG_TIMEOUT_MS, "listAvailabilityTimeSlots:addonRecheck"),
                2, 300
            );
            rawSlot = (Array.isArray(listed?.timeSlots) ? listed.timeSlots : []).find((slot) =>
                _normalizeLocalIsoStr(slot?.localStartDate || slot?.startDate) === start &&
                _normalizeLocalIsoStr(slot?.localEndDate || slot?.endDate) === end &&
                slot?.bookable === true
            ) || null;
        } else {
            const getOptions = {
                includeResourceTypeIds: [STAFF_RESOURCE_TYPE_ID],
            };
            if (requiredResourceId) {
                getOptions.resourceTypes = [{ resourceTypeId: STAFF_RESOURCE_TYPE_ID, resourceIds: [requiredResourceId] }];
            }
            const result = await _executeWithRetry(
                () => withTimeout(
                    availabilityTimeSlots.getAvailabilityTimeSlot(
                        String(resolvedServiceId),
                        start,
                        end,
                        SDK_CONFIG.TZ,
                        location,
                        getOptions
                    ),
                    WATCHDOG_TIMEOUT_MS,
                    "getAvailabilityTimeSlot"
                ),
                2, 300
            );
            rawSlot = result?.timeSlot || null;
        }
        const normalized = _attachServiceId(rawSlot, resolvedServiceId, activeTraceId, "revalidateExactAvailabilitySlot");
        const availableResourceIds = _getResourceIdsFromSlot(normalized);
        if (!normalized || normalized.bookable !== true) {
            return { status: "ERROR", data: null, error: { code: "SLOT_UNAVAILABLE", message: "Selected slot is no longer available." } };
        }
        if (requiredResourceId && !availableResourceIds.includes(requiredResourceId)) {
            return {
                status: "ERROR", data: null,
                error: {
                    code: "STAFF_UNAVAILABLE_SELECTED",
                    message: "El profesional seleccionado ya no está disponible. Elige otro profesional.",
                    action: "REQUIRES_STAFF_RESELECTION",
                    requestedResourceId: requiredResourceId,
                },
            };
        }
        return {
            status: "SUCCESS",
            data: {
                slot: { ...normalized, localStartDate: start, localEndDate: end },
                resourceId: requiredResourceId || (availableResourceIds.length === 1 ? availableResourceIds[0] : null),
                candidateResourceIds: availableResourceIds,
            },
            error: null,
        };
    } catch (error) {
        const httpStatus = Number(error?.httpStatus || error?.statusCode || error?.response?.status || 0) || null;
        const wixErrorCode = _safeTrim(error?.code || error?.details?.applicationError?.code) || "UNKNOWN";
        log.warn("Exact slot recheck failed", {
            traceId: activeTraceId, wixErrorCode, httpStatus,
            message: error?.message || String(error),
            serviceId: String(resolvedServiceId), localStartDate: start, localEndDate: end,
        });
        return { status: "ERROR", data: null, error: { code: "SLOT_UNAVAILABLE", message: "Selected slot could not be revalidated.", traceId: activeTraceId } };
    }
}

/* =============================================================================
 * LISTADO DE SLOTS (RES-50: bookingPolicyViolations + locationId del CMS)
 * ==========================================================================*/
async function _listTimeSlotsV2({ serviceId, fromLocalDate, toLocalDate, resourceIds, nativeAddonIds = [] }, options = {}) {
    const { skipCache = false, timeSlotsPerDay } = options;
    const traceId = makeTraceId("slots");
    const fromKey = _normalizeLocalIsoStr(fromLocalDate);
    const toKey = _normalizeLocalIsoStr(toLocalDate);
    if (!fromKey || !toKey) return [];
    const resolvedServiceId = await _resolveServiceIdInternal(serviceId);
    if (!resolvedServiceId) return [];

    const serviceRes = await _getServiceBySlugOrIdInternal(resolvedServiceId, traceId);
    const service = serviceRes?.data;
    const location = _resolveAvailabilityLocation(service);
    if (!location) return [];

    const normalizedResourceIds = Array.isArray(resourceIds) ? resourceIds.map(String).filter(Boolean) : [];
    const normalizedNativeAddonIds = Array.from(new Set(
        (Array.isArray(nativeAddonIds) ? nativeAddonIds : []).map((id) => _safeTrim(id)).filter((id) => _looksLikeGuid(id))
    )).sort();
    const resourceKey = normalizedResourceIds.slice().sort().join(",");
    const addonKey = normalizedNativeAddonIds.join(",");
    const locationKey = location._id;
    const cacheKey = `${String(resolvedServiceId)}__${locationKey}__${resourceKey}__${addonKey}__${fromKey}__${toKey}__ts:${timeSlotsPerDay || 0}`;

    if (!skipCache) {
        const cached = availabilityCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < SLOTS_CACHE_TTL_MS) return cached.data;
        const inflight = inflightRequests.get(cacheKey);
        if (inflight) return inflight;
    }
    const p = (async () => {
        try {
            const resourceTypes = normalizedResourceIds.length
                ? [{ resourceTypeId: STAFF_RESOURCE_TYPE_ID, resourceIds: normalizedResourceIds }]
                : [];
            const payload = {
                serviceId: String(resolvedServiceId),
                fromLocalDate: String(fromKey),
                toLocalDate: String(toKey),
                timeZone: SDK_CONFIG.TZ,
                bookable: true,
                locations: [location],
                includeResourceTypeIds: [STAFF_RESOURCE_TYPE_ID],
                bookingPolicyViolations: {
                    bookOnlineDisabled: false,
                    tooEarlyToBook: false,
                    tooLateToBook: false,
                },
            };
            if (resourceTypes.length) payload.resourceTypes = resourceTypes;
            if (normalizedNativeAddonIds.length > 0) payload.customerChoices = { addOnIds: normalizedNativeAddonIds };
            if (Number.isFinite(timeSlotsPerDay) && Number(timeSlotsPerDay) > 0) payload.timeSlotsPerDay = Number(timeSlotsPerDay);

            const data = await _executeWithRetry(
                () => withTimeout(availabilityTimeSlots.listAvailabilityTimeSlots(payload), WATCHDOG_TIMEOUT_MS, "listAvailabilityTimeSlots"),
                3, 500
            );
            const rawSlots = Array.isArray(data?.timeSlots) ? data.timeSlots : [];
            const slots = rawSlots.map((s) => {
                if (!s || s.bookable !== true) return null;
                const start = s.localStartDate || s.startDate || "";
                const end = s.localEndDate || s.endDate || "";
                const fixed = _attachServiceId(s, resolvedServiceId, traceId, "_listTimeSlotsV2");
                if (!fixed) return null;
                if (!_isValidSlotRange(start, end)) return null;
                return {
                    ...fixed,
                    localStartDate: _normalizeLocalIsoStr(start),
                    localEndDate: _normalizeLocalIsoStr(end),
                };
            }).filter(Boolean);

            if (!skipCache) _cacheSetBounded(availabilityCache, cacheKey, { data: slots, timestamp: Date.now() }, CACHE_MAX_SIZE);
            return slots;
        } catch (e) {
            log.error("_listTimeSlotsV2 failed", { traceId, message: e?.message });
            return [];
        }
    })();

    if (!skipCache) {
        inflightRequests.set(cacheKey, p);
        try { return await p; } finally { inflightRequests.delete(cacheKey); }
    }
    return await p;
}

/* =============================================================================
 * BALANCEO POR CARGA (RES-55: delegado en bookingUtils)
 * ==========================================================================*/
async function _rankResourcesByLoad(candidateResourceIds, dateYMD, traceId) {
    const ids = Array.from(new Set(
        Array.isArray(candidateResourceIds) ? candidateResourceIds.map(String).filter(Boolean) : []
    ));
    if (ids.length <= 1) return ids;

    const minutesMap = await _getBookedMinutesByResourceForDay(dateYMD, ids, traceId);
    const names = {};
    await Promise.allSettled(ids.map(async (rid) => {
        names[rid] = (await _getStaffDisplayName(rid).catch(() => "")) || "";
    }));

    return _rankResourcesByLoadShared(ids, minutesMap, names);
}

async function _pickLeastLoadedResource(candidateResourceIds, dateYMD, traceId) {
    const ranked = await _rankResourcesByLoad(candidateResourceIds, dateYMD, traceId);
    return ranked[0] || null;
}

async function _getBookedMinutesByResourceForDay(dateYMD, resourceIds, traceId) {
    const ymd = String(dateYMD || "").slice(0, 10);
    if (!_isValidMadridYmd(ymd)) {
        const error = new Error("INVALID_BOOKING_LOAD_DATE");
        error.code = "INVALID_BOOKING_LOAD_DATE";
        throw error;
    }
    const ids = Array.isArray(resourceIds) ? resourceIds.map(String).filter(Boolean) : [];
    if (!ids.length) return {};

    const query = dalQuery(CITAS_COL)
        .eq("dateYmd", ymd)
        .in("bookingStatus", ["PENDING", "CONFIRMED", "COMPLETED"])
        .in("resourceId", ids)
        .limit(1000);

    let result;
    try {
        result = await withTimeout(query.find(CONSISTENT_READ), WATCHDOG_TIMEOUT_MS, "balance:queryCitas");
    } catch (e) {
        log.error("_getBookedMinutesByResourceForDay custom ledger query failed", {
            traceId,
            message: e?.message,
        });
        const error = new Error("UPSTREAM_UNAVAILABLE");
        error.code = "UPSTREAM_UNAVAILABLE";
        throw error;
    }
    if (!result || !Array.isArray(result.items)) {
        const error = new Error("UPSTREAM_UNAVAILABLE");
        error.code = "UPSTREAM_UNAVAILABLE";
        throw error;
    }

    const customItems = [...result.items];
    try {
        while (result?.hasNext?.()) {
            result = await withTimeout(result.next(), WATCHDOG_TIMEOUT_MS, "balance:queryCitas.next");
            customItems.push(...(result?.items || []));
        }
    } catch (e) {
        log.error("_getBookedMinutesByResourceForDay custom ledger pagination failed", {
            traceId,
            message: e?.message,
        });
        const error = new Error("UPSTREAM_UNAVAILABLE");
        error.code = "UPSTREAM_UNAVAILABLE";
        throw error;
    }

    const minutes = {};
    const knownBookingIds = new Set();
    ids.forEach((rid) => (minutes[rid] = 0));

    for (const item of customItems) {
        const bookingId = _safeTrim(item?.bookingId);
        if (bookingId) knownBookingIds.add(bookingId);

        const resourceId = _safeTrim(item?.resourceId);
        if (!resourceId || minutes[resourceId] === undefined) continue;
        const status = String(item?.bookingStatus || "").trim().toUpperCase();
        const paymentStatus = String(item?.paymentStatus || "").trim().toUpperCase();
        if (!["PENDING", "CONFIRMED", "COMPLETED"].includes(status)) continue;
        if (paymentStatus === "REFUNDED") continue;

        const start = _toDateSafe(item?.slotStart);
        const end = _toDateSafe(item?.slotEnd);
        if (!start || !end || end.getTime() <= start.getTime()) continue;
        minutes[resourceId] += _minutesBetweenUtcDates(start, end);
    }

    // Native Wix Bookings is also a source of truth. Some appointments are
    // created directly in Wix and therefore have no CitasF2 ledger row.
    // Merge by booking ID so custom-engine bookings are never counted twice.
    try {
        const startUtc = getUtcDateFromMadridLocal(`${ymd}T00:00:00`);
        const nextDayDate = new Date(`${ymd}T12:00:00.000Z`);
        nextDayDate.setUTCDate(nextDayDate.getUTCDate() + 1);
        const nextYmd = nextDayDate.toISOString().slice(0, 10);
        const endUtc = getUtcDateFromMadridLocal(`${nextYmd}T00:00:00`);
        if (!startUtc || !endUtc) throw new Error("INVALID_MADRID_DAY_RANGE");

        const baseQuery = {
            filter: {
                "$and": [
                    { startDate: { "$gte": startUtc.toISOString() } },
                    { startDate: { "$lt": endUtc.toISOString() } },
                ],
            },
            sort: [{ fieldName: "startDate", order: "ASC" }],
            cursorPaging: { limit: 100 },
        };
        const options = {
            withBookingAllowedActions: false,
            withBookingAttendanceInfo: false,
            withBookingConferencingDetails: false,
            withBookingPolicySettings: false,
            withBookingFeeDetails: false,
        };
        let cursor = "";
        let pageCount = 0;
        const maxPages = 20;

        do {
            const query = {
                ...baseQuery,
                cursorPaging: { limit: 100, ...(cursor ? { cursor } : {}) },
            };
            const nativeResponse = await withTimeout(
                queryExtendedBookingsElevated(query, options),
                WATCHDOG_TIMEOUT_MS,
                "balance:queryNativeBookings"
            );
            if (!Array.isArray(nativeResponse?.extendedBookings)) {
                const error = new Error("BOOKING_LOAD_RESPONSE_INVALID");
                error.code = "BOOKING_LOAD_RESPONSE_INVALID";
                throw error;
            }
            const bookings = nativeResponse.extendedBookings;

            for (const entry of bookings) {
                const booking = entry?.booking || {};
                const bookingId = _safeTrim(booking.id);
                if (!bookingId || knownBookingIds.has(bookingId)) continue;
                knownBookingIds.add(bookingId);

                const status = String(booking.status || "").trim().toUpperCase();
                if (!["CREATED", "PENDING", "CONFIRMED", "COMPLETED"].includes(status)) continue;
                if (String(booking.paymentStatus || "").trim().toUpperCase() === "REFUNDED") continue;

                const resourceId = _safeTrim(booking?.bookedEntity?.slot?.resource?._id);
                if (!resourceId || minutes[resourceId] === undefined) continue;
                const start = _toDateSafe(booking.startDate);
                const end = _toDateSafe(booking.endDate);
                if (!start || !end || end.getTime() <= start.getTime()) continue;
                minutes[resourceId] += _minutesBetweenUtcDates(start, end);
            }

            cursor = _safeTrim(nativeResponse?.pagingMetadata?.cursors?.next);
            pageCount += 1;
            if (cursor && pageCount >= maxPages) {
                log.error("_getBookedMinutesByResourceForDay native booking page cap reached; load is incomplete", {
                    traceId,
                    dateYMD: ymd,
                    maxPages,
                });
                const error = new Error("BOOKING_LOAD_INCOMPLETE");
                error.code = "BOOKING_LOAD_INCOMPLETE";
                throw error;
            }
        } while (cursor);
    } catch (e) {
        // Staff balancing is a booking invariant: without the native source,
        // the daily workload is incomplete and assigning by partial data would
        // silently violate the least-booked-minutes rule.
        log.error("_getBookedMinutesByResourceForDay native booking query failed; refusing incomplete load ranking", {
            traceId,
            dateYMD: ymd,
            message: e?.message,
        });
        const error = new Error(e?.code || "BOOKING_LOAD_UNAVAILABLE");
        error.code = e?.code || "BOOKING_LOAD_UNAVAILABLE";
        throw error;
    }

    return minutes;
}

/* =============================================================================
 * BÚSQUEDA DE SIGUIENTE SLOT (para dual F2)
 * ==========================================================================*/
async function _findNextSlotForServiceInternal(serviceId, fromLocalDateTime, requiredResourceId, traceId, sameDayOnly = false) {
    const resolvedServiceId = await _resolveServiceIdInternal(serviceId);
    if (!resolvedServiceId) {
        return { status: "ERROR", data: null, error: { code: "SERVICE_NOT_FOUND", message: "Service ID not found" } };
    }
    const fromLocal = _normalizeLocalIsoStr(fromLocalDateTime);
    if (!fromLocal) {
        return { status: "ERROR", data: null, error: { code: "INVALID_DATES", message: "fromLocalDateTime invalid" } };
    }
    const strictRequiredResourceId = _safeTrim(requiredResourceId || "");
    if (strictRequiredResourceId && !["all", "any"].includes(strictRequiredResourceId.toLowerCase()) && !_looksLikeGuid(strictRequiredResourceId)) {
        return { status: "ERROR", data: null, error: { code: "INVALID_RESOURCE_ID", message: "Invalid staff identifier." } };
    }
    const startYMD = fromLocal.slice(0, 10);
    const mustHaveStaff = _looksLikeGuid(strictRequiredResourceId);
    const resourceIds = mustHaveStaff ? [strictRequiredResourceId] : [];
    const maxDayOffset = sameDayOnly ? 0 : DIAS_LIMITE;

    for (let i = 0; i <= maxDayOffset; i++) {
        const ymd = _addDaysYMD(startYMD, i);
        const dayFrom = i === 0 ? fromLocal : `${ymd}T00:00:00`;
        const dayTo = `${ymd}T23:59:59`;
        const slots = await _listTimeSlotsV2(
            { serviceId: resolvedServiceId, fromLocalDate: dayFrom, toLocalDate: dayTo, resourceIds },
            { skipCache: true }
        );
        const normFrom = _normalizeLocalIsoStr(dayFrom);
        const candidates = (slots || [])
            .filter((s) => _normalizeLocalIsoStr(s.localStartDate) >= normFrom)
            .sort((a, b) => String(a.localStartDate).localeCompare(String(b.localStartDate)));

        if (!candidates.length) continue;
        if (mustHaveStaff) {
            const required = String(strictRequiredResourceId);
            const match = candidates.find((s) => _getResourceIdsFromSlot(s).includes(required));
            if (match) return { status: "SUCCESS", data: { slot: match, dayYMD: ymd }, error: null };
            continue;
        }
        return { status: "SUCCESS", data: { slot: candidates[0], dayYMD: ymd }, error: null };
    }
    return { status: "ERROR", data: null, error: { code: "SLOT_UNAVAILABLE", message: "No available slot found in search window." } };
}

/* =============================================================================
 * RESOLUCIÓN DE STAFF PARA SLOT EXACTO (RES-46)
 * ==========================================================================*/
export async function _resolveStaffForSlotInternal(params) {
    const traceId = _safeTrim(params?.traceId) || makeTraceId("staff-internal");
    try {
        const f1Start = _normalizeLocalIsoStr(params?.f1Start);
        const f1End = _normalizeLocalIsoStr(params?.f1End || "");
        if (!f1Start) {
            return { status: "ERROR", data: null, error: { code: "INVALID_SLOT_RECHECK", message: "f1Start is required." } };
        }
        const resolvedServiceId = await _resolveServiceIdInternal(params?.serviceId);
        if (!resolvedServiceId) {
            return { status: "ERROR", data: null, error: { code: "SERVICE_NOT_FOUND", message: "Service ID not found" } };
        }
        const svcRes = await _getServiceBySlugOrIdInternal(resolvedServiceId, traceId);
        const serviceCfg = svcRes?.data;
        if (!serviceCfg) {
            return { status: "ERROR", data: null, error: { code: "SERVICE_CONFIG_MISSING", message: "Service not in catalog" } };
        }
        if (serviceCfg.clientHidden === true) {
            return { status: "ERROR", data: null, error: { code: "SERVICE_NOT_AVAILABLE", message: "Service is not available for booking." } };
        }
        const linkedServiceId = _safeTrim(serviceCfg.linkedPhases || "");
        const isDual = serviceCfg.allowCombine === true && _looksLikeGuid(linkedServiceId);
        const f2Start = _normalizeLocalIsoStr(params?.f2Start || "");
        if (!isDual && f2Start) {
            return { status: "ERROR", data: null, error: { code: "UNEXPECTED_F2_CONTEXT", message: "Simple service cannot include F2 context." } };
        }
        const addonContext = _resolveAddonContext(serviceCfg, params?.addOnIds);
        const dateYMD = f1Start.slice(0, 10);
        if (!_isValidMadridYmd(dateYMD)) {
            return { status: "ERROR", data: null, error: { code: "INVALID_DATES", message: "f1Start has invalid Madrid day." } };
        }
        const requestedResourceId = _safeTrim(params?.requestedResourceId || "");
        if (requestedResourceId && !_looksLikeGuid(requestedResourceId)) {
            return { status: "ERROR", data: null, error: { code: "INVALID_RESOURCE_ID", message: "Invalid staff identifier." } };
        }
        const slotsF1 = await _listTimeSlotsV2(
            {
                serviceId: resolvedServiceId,
                fromLocalDate: `${dateYMD}T00:00:00`,
                toLocalDate: `${dateYMD}T23:59:59`,
                resourceIds: requestedResourceId ? [requestedResourceId] : [],
                nativeAddonIds: addonContext.nativeAddonIds,
            },
            { skipCache: true }
        );
        const slotF1Raw = (slotsF1 || []).find((s) => {
            if (_normalizeLocalIsoStr(s.localStartDate) !== f1Start) return false;
            if (f1End && _normalizeLocalIsoStr(s.localEndDate) !== f1End) return false;
            return true;
        });
        if (!slotF1Raw) {
            return {
                status: "ERROR", data: null,
                error: {
                    code: requestedResourceId ? "STAFF_UNAVAILABLE_SELECTED" : "SLOT_UNAVAILABLE",
                    message: requestedResourceId
                        ? "El profesional seleccionado ya no está disponible para este horario. Elige otro profesional."
                        : "F1 slot is no longer available.",
                    action: requestedResourceId ? "REQUIRES_STAFF_RESELECTION" : undefined,
                    requestedResourceId: requestedResourceId || undefined,
                },
            };
        }
        const slotF1 = _attachServiceId(slotF1Raw, resolvedServiceId, traceId, "staffInternal:F1");
        if (!slotF1) {
            return { status: "ERROR", data: null, error: { code: "SLOT_UNAVAILABLE", message: "F1 slot could not be normalized." } };
        }
        let candidateResourceIds = _getResourceIdsFromSlot(slotF1);
        let slotF2 = null;

        if (isDual) {
            if (!f2Start) {
                return {
                    status: "ERROR", data: null,
                    error: {
                        code: requestedResourceId ? "STAFF_UNAVAILABLE_DUAL" : "F2_SLOT_REQUIRED",
                        message: requestedResourceId
                            ? "El profesional seleccionado no está disponible para ambas fases. Elige otro profesional."
                            : "Dual service requires the certified F2 slot.",
                        action: requestedResourceId ? "REQUIRES_STAFF_RESELECTION" : undefined,
                        requestedResourceId: requestedResourceId || undefined,
                    },
                };
            }
            const f2Ymd = f2Start.slice(0, 10);
            if (f2Ymd !== dateYMD) {
                return { status: "ERROR", data: null, error: { code: "F2_DIFFERENT_DAY", message: "F2 must occur on the same Madrid day as F1." } };
            }
            const f2End = _normalizeLocalIsoStr(params?.f2End || "");

            // RES-46: si el cliente eligió staff, F2 solo busca slots de ESE staff.
            const slotsF2 = await _listTimeSlotsV2(
                {
                    serviceId: linkedServiceId,
                    fromLocalDate: `${f2Ymd}T00:00:00`,
                    toLocalDate: `${f2Ymd}T23:59:59`,
                    resourceIds: requestedResourceId ? [requestedResourceId] : [],
                    nativeAddonIds: [],
                },
                { skipCache: true }
            );
            const slotF2Raw = (slotsF2 || []).find((s) => {
                if (_normalizeLocalIsoStr(s.localStartDate) !== f2Start) return false;
                if (f2End && _normalizeLocalIsoStr(s.localEndDate) !== f2End) return false;
                return true;
            });
            if (!slotF2Raw) {
                return {
                    status: "ERROR", data: null,
                    error: {
                        code: requestedResourceId ? "STAFF_UNAVAILABLE_DUAL" : "F2_UNAVAILABLE",
                        message: requestedResourceId
                            ? "El profesional seleccionado ya no está disponible para la segunda fase. Elige otro profesional."
                            : "F2 slot is no longer available.",
                        action: requestedResourceId ? "REQUIRES_STAFF_RESELECTION" : undefined,
                        requestedResourceId: requestedResourceId || undefined,
                    },
                };
            }
            const attachedF2 = _attachServiceId(slotF2Raw, linkedServiceId, traceId, "staffInternal:F2");
            if (!attachedF2) {
                return { status: "ERROR", data: null, error: { code: "F2_UNAVAILABLE", message: "F2 slot could not be normalized." } };
            }
            const f1EndLocal = _normalizeLocalIsoStr(slotF1.localEndDate);
            const f1EndUtc = getUtcDateFromMadridLocal(f1EndLocal);
            const f2StartUtc = getUtcDateFromMadridLocal(f2Start);
            if (!f1EndUtc || !f2StartUtc || f2StartUtc.getTime() < f1EndUtc.getTime()) {
                return {
                    status: "ERROR", data: null,
                    error: {
                        code: requestedResourceId ? "STAFF_UNAVAILABLE_DUAL" : "INVALID_GAP",
                        message: requestedResourceId
                            ? "El profesional seleccionado ya no cumple el hueco requerido entre fases. Elige otro profesional."
                            : "F2 must start after F1 ends.",
                        action: requestedResourceId ? "REQUIRES_STAFF_RESELECTION" : undefined,
                        requestedResourceId: requestedResourceId || undefined,
                    },
                };
            }
            const gapMinutes = (f2StartUtc.getTime() - f1EndUtc.getTime()) / 60000;
            const minimumGapMinutes = Math.max(0, Number(serviceCfg.exposureDuration || 0));
            if (gapMinutes !== minimumGapMinutes) {
                return {
                    status: "ERROR", data: null,
                    error: {
                        code: requestedResourceId ? "STAFF_UNAVAILABLE_DUAL" : "INVALID_GAP",
                        message: requestedResourceId
                            ? "El profesional seleccionado ya no cumple el hueco requerido entre fases. Elige otro profesional."
                            : "F2 gap must exactly match ServiciosCatalogo.exposureDuration.",
                        action: requestedResourceId ? "REQUIRES_STAFF_RESELECTION" : undefined,
                        requestedResourceId: requestedResourceId || undefined,
                    },
                };
            }
            const candidatesF2 = _getResourceIdsFromSlot(attachedF2);
            candidateResourceIds = candidateResourceIds.filter((id) => candidatesF2.includes(id));
            slotF2 = attachedF2;
        }

        if (!candidateResourceIds.length) {
            return {
                status: "ERROR", data: null,
                error: {
                    code: requestedResourceId ? (isDual ? "STAFF_UNAVAILABLE_DUAL" : "STAFF_UNAVAILABLE_SELECTED") : "STAFF_NOT_AVAILABLE",
                    message: requestedResourceId
                        ? (isDual
                            ? "El profesional seleccionado ya no está disponible para ambas fases. Elige otro profesional."
                            : "El profesional seleccionado ya no está disponible. Elige otro profesional.")
                        : "No staff available for this slot.",
                    action: requestedResourceId ? "REQUIRES_STAFF_RESELECTION" : undefined,
                    requestedResourceId: requestedResourceId || undefined,
                },
            };
        }
        if (requestedResourceId && !candidateResourceIds.includes(requestedResourceId)) {
            return {
                status: "ERROR", data: null,
                error: {
                    code: isDual ? "STAFF_UNAVAILABLE_DUAL" : "STAFF_UNAVAILABLE_SELECTED",
                    message: isDual
                        ? "El profesional seleccionado ya no está disponible para ambas fases. Elige otro profesional."
                        : "El profesional seleccionado ya no está disponible. Elige otro profesional.",
                    action: "REQUIRES_STAFF_RESELECTION",
                    requestedResourceId,
                    candidateResourceIds,
                },
            };
        }
        const finalResourceId = requestedResourceId || (await _pickLeastLoadedResource(candidateResourceIds, dateYMD, traceId));
        if (!finalResourceId) {
            return { status: "ERROR", data: null, error: { code: "STAFF_NOT_AVAILABLE", message: "No staff could be assigned." } };
        }
        const resourceName = (await _getStaffDisplayName(finalResourceId).catch(() => "")) || STAFF_DEFAULT_NAME;
        return {
            status: "SUCCESS",
            data: {
                resourceId: finalResourceId,
                resourceName,
                slotF1,
                slotF2,
                candidateResourceIds,
                dateYMD,
            },
            error: null,
        };
    } catch (err) {
        log.error("_resolveStaffForSlotInternal failed", { traceId, error: err?.message });
        return { status: "ERROR", data: null, error: _toPublicError(err, "STAFF_RESOLVE_FAILED") };
    }
}

/* =============================================================================
 * MOTOR DE SLOTS DUALES + CACHÉ
 * ==========================================================================*/
export async function _cleanExpiredDualSlotsInternal({ limit = 100, traceId = null } = {}) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 100));
    const now = new Date();
    const result = await withTimeout(
        dalQuery(CONTROL_COL).eq("controlType", CT_DUAL_CACHE).lt("expiresAt", now).limit(safeLimit).find(CONSISTENT_READ),
        WATCHDOG_TIMEOUT_MS,
        "cleanExpiredDualSlotsQuery"
    );
    let removed = 0;
    for (const item of result?.items || []) {
        await withTimeout(removeById(CONTROL_COL, item._id), WATCHDOG_TIMEOUT_MS, "cleanExpiredDualSlotsRemove").catch(() => null);
        removed += 1;
    }
    log.info("Expired dual cache entries cleaned", { removed, traceId });
    return { status: "SUCCESS", data: { removed }, error: null };
}

export async function _getCertifiedDualSlotsInternal(serviceId, resourceId, dateYMD, requestedAddonIds = []) {
    const traceId = makeTraceId("dual");
    if (!serviceId || !_isValidMadridYmd(dateYMD)) {
        return { status: "ERROR", data: null, error: { code: "INVALID_PARAMS", message: "serviceId and valid Madrid dateYMD are required" } };
    }
    const resolvedServiceId = await _resolveServiceIdInternal(serviceId);
    if (!resolvedServiceId) {
        return { status: "ERROR", data: null, error: { code: "SERVICE_NOT_FOUND", message: "Service ID not found" } };
    }
    const resourceIdsFilter = _normalizeResourceIdsStrict(resourceId, traceId);
    if (resourceIdsFilter === null) {
        return { status: "ERROR", data: null, error: { code: "INVALID_RESOURCE_ID", message: "Invalid staff identifier." } };
    }
    const serviceRes = await _getServiceBySlugOrIdInternal(resolvedServiceId, traceId);
    if (!serviceRes || serviceRes.status !== "SUCCESS" || !serviceRes.data) {
        return { status: "ERROR", data: null, error: { code: "SERVICE_NOT_FOUND", message: "Service catalog missing" } };
    }
    const service = serviceRes.data;
    if (service.clientHidden === true) {
        return { status: "ERROR", data: null, error: { code: "SERVICE_NOT_AVAILABLE", message: "Service is not available for booking." } };
    }
    const addonContext = _resolveAddonContext(service, requestedAddonIds);
    const linkedServiceId = _safeTrim(service.linkedPhases || "");
    const isDual = service.allowCombine === true && _looksLikeGuid(linkedServiceId);
    const rankedCandidateCache = new Map();

    // REGLA DE NEGOCIO: si el cliente eligió staff, ese mismo staff
    // debe estar disponible en F1 Y F2. Nunca se cambia la elección.
    const selectedResourceId = _safeTrim(resourceId) && _looksLikeGuid(resourceId) ? _safeTrim(resourceId) : null;

    async function _rankCandidates(candidateResourceIds) {
        const normalized = Array.from(new Set((candidateResourceIds || []).map(String).filter(Boolean)));
        const key = normalized.slice().sort().join("|");
        if (!key) return [];
        if (rankedCandidateCache.has(key)) return rankedCandidateCache.get(key);
        const ranked = await _rankResourcesByLoad(normalized, dateYMD, traceId);
        rankedCandidateCache.set(key, ranked);
        return ranked;
    }

    const fromLocalDate = `${dateYMD}T00:00:00`;
    const toLocalDate = `${dateYMD}T23:59:59`;
    const slotsF1 = await _listTimeSlotsV2(
        {
            serviceId: resolvedServiceId,
            fromLocalDate,
            toLocalDate,
            resourceIds: resourceIdsFilter,
            nativeAddonIds: addonContext.nativeAddonIds,
        },
        { skipCache: true }
    );

    if (!isDual) {
        const out = [];
        for (const s1 of slotsF1 || []) {
            const candidateResourceIds = _getResourceIdsFromSlot(s1);
            if (selectedResourceId && !candidateResourceIds.includes(selectedResourceId)) continue;
            const rankedCandidates = await _rankCandidates(candidateResourceIds);
            const chosen = selectedResourceId || rankedCandidates[0] || null;
            const pairToken = _generateUUID();
            const forcedSlot = _attachServiceId({ ...s1 }, resolvedServiceId, traceId, "single");
            if (!forcedSlot) continue;
            const localStartDate = _normalizeLocalIsoStr(forcedSlot.localStartDate);
            const localEndDate = _normalizeLocalIsoStr(forcedSlot.localEndDate);
            if (!localStartDate || !localEndDate) continue;
            if (!_isValidSlotRange(localStartDate, localEndDate)) continue;
            out.push({
                slotF1: { localStartDate, localEndDate, slotRef: forcedSlot, resourceId: chosen || null },
                slotF2: null,
                resourceId: chosen || null,
                pairToken,
                candidateResourceIds,
                serviceId: resolvedServiceId,
                dateYMD,
            });
        }
        return { status: "SUCCESS", data: out, error: null };
    }

    const exposureMinutes = Number(service.exposureDuration ?? 0);
    const exposureMs = Math.max(0, exposureMinutes) * 60 * 1000;
    const pairs = [];

    for (const s1 of slotsF1 || []) {
        const s1EndLocal = _normalizeLocalIsoStr(s1.localEndDate);
        if (!s1EndLocal) continue;
        const s1EndUtc = getUtcDateFromMadridLocal(s1EndLocal);
        if (!s1EndUtc) continue;
        const earliestF2Utc = new Date(s1EndUtc.getTime() + exposureMs);
        const earliestF2Local = getMadridLocalStringNoZ(earliestF2Utc);
        const candidateResourceIds = _getResourceIdsFromSlot(s1);
        if (!candidateResourceIds.length) continue;
        if (selectedResourceId && !candidateResourceIds.includes(selectedResourceId)) continue;
        const rankedCandidates = await _rankCandidates(candidateResourceIds);
        const candidatesToTry = selectedResourceId ? [selectedResourceId] : rankedCandidates;
        let chosenResourceId = null;
        let s2 = null;

        for (const candidateResourceId of candidatesToTry) {
            const nextF2 = await _findNextSlotForServiceInternal(linkedServiceId, earliestF2Local, candidateResourceId, traceId, true);
            if (nextF2?.status !== "SUCCESS" || !nextF2?.data?.slot) continue;
            const candidateF2 = nextF2.data.slot;
            const s2StartLocal = _normalizeLocalIsoStr(candidateF2.localStartDate);
            const s2EndLocal = _normalizeLocalIsoStr(candidateF2.localEndDate);
            if (!_isValidSlotRange(s1.localStartDate, s1.localEndDate) || !_isValidSlotRange(s2StartLocal, s2EndLocal)) continue;
            const s2StartUtc = getUtcDateFromMadridLocal(s2StartLocal);
            if (!s2StartUtc || s2StartUtc.getTime() < s1EndUtc.getTime()) continue;
            const gapMinutes = (s2StartUtc.getTime() - s1EndUtc.getTime()) / 60000;
            const minimumGapMinutes = Math.max(0, exposureMinutes);
            if (gapMinutes !== minimumGapMinutes) continue;
            const s2Staff = _getResourceIdsFromSlot(candidateF2);
            if (s2Staff.length === 0 || !s2Staff.includes(String(candidateResourceId))) continue;
            chosenResourceId = candidateResourceId;
            s2 = candidateF2;
            break;
        }
        if (!chosenResourceId || !s2) continue;

        const pairToken = _generateUUID();
        const forcedF1 = _attachServiceId({ ...s1 }, resolvedServiceId, traceId, "dual:F1");
        const forcedF2 = _attachServiceId({ ...s2 }, linkedServiceId, traceId, "dual:F2");
        if (!forcedF1 || !forcedF2) continue;

        const f1LocalStart = _normalizeLocalIsoStr(forcedF1.localStartDate);
        const f1LocalEnd = _normalizeLocalIsoStr(forcedF1.localEndDate);
        const f2LocalStart = _normalizeLocalIsoStr(forcedF2.localStartDate);
        const f2LocalEnd = _normalizeLocalIsoStr(forcedF2.localEndDate);
        if (!f1LocalStart || !f1LocalEnd || !f2LocalStart || !f2LocalEnd) continue;
        if (!_isValidSlotRange(f1LocalStart, f1LocalEnd) || !_isValidSlotRange(f2LocalStart, f2LocalEnd)) continue;

        const slotF1 = { localStartDate: f1LocalStart, localEndDate: f1LocalEnd, slotRef: forcedF1, resourceId: chosenResourceId };
        const slotF2 = { localStartDate: f2LocalStart, localEndDate: f2LocalEnd, slotRef: forcedF2, resourceId: chosenResourceId };
        pairs.push({
            slotF1,
            slotF2,
            resourceId: chosenResourceId,
            pairToken,
            candidateResourceIds,
            serviceId: resolvedServiceId,
            dateYMD,
        });
    }

    if (pairs.length > 0) {
        const cachePromises = pairs.map((slotPair) => {
            const expiresAt = new Date(Date.now() + DUAL_CACHE_TTL_MS);
            const record = {
                _id: String(slotPair.pairToken),
                controlType: CT_DUAL_CACHE,
                dedupeKey: "DUAL_" + String(slotPair.pairToken),
                serviceId: String(slotPair.serviceId),
                resourceId: String(slotPair.resourceId || ""),
                dateYmd: String(dateYMD),
                slotStart: getUtcDateFromMadridLocal(slotPair.slotF1.localStartDate),
                slotEnd: getUtcDateFromMadridLocal((slotPair.slotF2 || slotPair.slotF1).localEndDate),
                expiresAt,
                payload: {
                    pairToken: slotPair.pairToken,
                    linkedPhases: String(linkedServiceId),
                    f1Start: slotPair.slotF1.localStartDate,
                    f1End: slotPair.slotF1.localEndDate,
                    f2Start: slotPair.slotF2 ? slotPair.slotF2.localStartDate : null,
                    f2End: slotPair.slotF2 ? slotPair.slotF2.localEndDate : null,
                    candidateResourceIds: slotPair.candidateResourceIds || [],
                },
                traceId,
            };
            return saveItem(CONTROL_COL, record).catch(() => null);
        });
        await Promise.allSettled(cachePromises);
    }
    return { status: "SUCCESS", data: pairs, error: null };
}

/* =============================================================================
 * INVALIDACIÓN DE CACHÉS
 * ==========================================================================*/
async function _removeDualCacheForDay(serviceId, dateYmd, resourceId, traceId) {
    const ids = _normalizeResourceIdsStrict(resourceId, traceId);
    if (ids === null) return 0;
    let query = dalQuery(CONTROL_COL)
        .eq("controlType", CT_DUAL_CACHE)
        .eq("serviceId", String(serviceId))
        .eq("dateYmd", String(dateYmd));
    if (ids.length === 1) query = query.eq("resourceId", ids[0]);
    let page = await withTimeout(query.limit(1000).find(CONSISTENT_READ), WATCHDOG_TIMEOUT_MS, "invalidateDualCacheQuery");
    let removed = 0;
    while (page) {
        const items = page.items || [];
        await Promise.allSettled(items.map((item) => removeById(CONTROL_COL, item._id).catch(() => null)));
        removed += items.length;
        if (!page.hasNext || !page.hasNext()) break;
        page = await withTimeout(page.next(), WATCHDOG_TIMEOUT_MS, "invalidateDualCacheNext").catch(() => null);
    }
    return removed;
}

export async function _invalidateCachesInternal(serviceId, dateYMD, resourceId, traceId = null) {
    const tId = traceId || makeTraceId("invalidate");
    const resolvedServiceId = (await _resolveServiceIdInternal(serviceId)) || _safeTrim(serviceId);
    const ymd = _safeTrim(dateYMD);
    if (!resolvedServiceId || !_isValidMadridYmd(ymd)) {
        return { ok: true, traceId: tId, skipped: true };
    }
    const prefix = `${String(resolvedServiceId)}__`;
    for (const k of availabilityCache.keys()) {
        if (String(k).startsWith(prefix)) availabilityCache.delete(k);
    }
    const yearMonth = String(ymd).slice(0, 7);
    const resourceIds = (_normalizeResourceIdsStrict(resourceId, tId) || []).sort().join(",");
    const daysCacheKey = `DAYSCACHE_${DAYS_CACHE_VERSION}__${String(resolvedServiceId)}__${_hashKey(resourceIds)}__${String(yearMonth)}`;
    try {
        const daysPage = await withTimeout(
            dalQuery(CONTROL_COL).eq("controlType", CT_DAYS_CACHE).eq("dedupeKey", daysCacheKey).limit(10).find(CONSISTENT_READ),
            WATCHDOG_TIMEOUT_MS,
            "invalidateDaysCache"
        );
        await Promise.allSettled((daysPage?.items || []).map((item) => removeById(CONTROL_COL, item._id).catch(() => null)));
    } catch (e) {
        log.warn("_invalidateCachesInternal: days cache cleanup skipped", { traceId: tId, message: e?.message });
    }
    try {
        const removed = await _removeDualCacheForDay(resolvedServiceId, ymd, resourceId, tId);
        log.info("Dual cache invalidated", { traceId: tId, removed });
    } catch (e) {
        log.warn("_invalidateCachesInternal: dual cache cleanup failed", { traceId: tId, message: e?.message });
    }
    return { ok: true, traceId: tId };
}

export const invalidateCachesInternal = webMethod(
    Permissions.Admin,
    async (serviceId, dateYMD, resourceId) => {
        const traceId = makeTraceId("wm-invalidate-internal");
        try {
            const res = await _invalidateCachesInternal(serviceId, dateYMD, resourceId, traceId);
            return { status: "SUCCESS", data: res, error: null };
        } catch (err) {
            return { status: "ERROR", data: null, error: _toPublicError(err, "INVALIDATE_FAILED") };
        }
    }
);

/* =============================================================================
 * DISPONIBILIDAD PÚBLICA
 * ==========================================================================*/
export const getAvailableDays = webMethod(
    Permissions.Anyone,
    async (serviceId, resourceId, year, month, addonIds = []) => {
        try {
            const visitor = await _getVisitorIdentity();
            const rateKey = _buildRateLimitKey("availability", visitor.memberId, "");
            await _rateLimitOrThrow("availability", rateKey);
            return await _getAvailableDaysInternal({
                serviceId, resourceId, year, month, addonIds,
                traceId: makeTraceId("wm-days"),
            });
        } catch (err) {
            return { status: "ERROR", data: null, error: _toPublicError(err, "DAYS_QUERY_FAILED") };
        }
    }
);

async function _queryAvailableDaysFromSlots(resolvedServiceId, resourceIds, fromLocal, toLocal, nativeAddonIds) {
    const slots = await _listTimeSlotsV2(
        {
            serviceId: resolvedServiceId,
            fromLocalDate: `${fromLocal}T00:00:00`,
            toLocalDate: `${toLocal}T23:59:59`,
            resourceIds,
            nativeAddonIds,
        },
        { skipCache: true, timeSlotsPerDay: 1 }
    );
    const dateSet = new Set();
    (slots || []).forEach((s) => {
        if (s.localStartDate) dateSet.add(String(s.localStartDate).slice(0, 10));
    });
    return Array.from(dateSet).sort();
}

async function _readDaysCacheWindow(daysCacheKey) {
    try {
        const page = await withTimeout(
            dalQuery(CONTROL_COL).eq("controlType", CT_DAYS_CACHE).eq("dedupeKey", daysCacheKey).limit(1).find(CONSISTENT_READ),
            WATCHDOG_TIMEOUT_MS,
            "daysCacheRead"
        );
        const item = (page?.items || [])[0];
        if (!item) return null;
        const expiresAtMs = new Date(item.expiresAt).getTime();
        if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
            return null;
        }
        const parsed = readControlPayload(item);
        if (!parsed || !Array.isArray(parsed.availableDaysYmds)) return null;

        // readControlPayload is the canonical adapter for both current payload
        // objects and stored payloadJson. Do not parse the legacy field again.
        return parsed;
    } catch (e) {
        log.warn("_readDaysCacheWindow failed", { message: e?.message });
        return null;
    }
}

async function _writeDaysCacheWindow(daysCacheKey, payload) {
    const expiresAt = new Date(Date.now() + DUAL_CACHE_TTL_MS);
    const cacheId = `DAYS_${_hashKey(String(daysCacheKey))}`.slice(0, 64);
    const record = {
        _id: cacheId,
        controlType: CT_DAYS_CACHE,
        dedupeKey: String(daysCacheKey),
        serviceId: String(payload.serviceId || ""),
        resourceId: "",
        dateYmd: String(payload.yearMonth || ""),
        expiresAt,
        payload,
    };
    try {
        await saveItem(CONTROL_COL, record);
    } catch (e) {
        log.warn("_writeDaysCacheWindow failed", { message: e?.message });
    }
}

export async function _getAvailableDaysInternal({ serviceId, resourceId, year, month, addonIds = [], traceId = null }) {
    const tId = traceId || makeTraceId("days-internal");
    const resolved = await _resolveServiceIdInternal(serviceId);
    if (!resolved) {
        return { status: "ERROR", data: null, error: { code: "SERVICE_NOT_FOUND", message: "Service ID not found" } };
    }
    const resourceIds = _normalizeResourceIdsStrict(resourceId, tId);
    if (resourceIds === null) {
        return { status: "ERROR", data: null, error: { code: "INVALID_RESOURCE_ID", message: "Invalid staff identifier." } };
    }
    const svcRes = await _getServiceBySlugOrIdInternal(resolved, tId);
    const service = svcRes?.data;
    if (!service) {
        return { status: "ERROR", data: null, error: { code: "SERVICE_CONFIG_MISSING", message: "Service configuration missing" } };
    }
    if (service.clientHidden === true) {
        return { status: "ERROR", data: null, error: { code: "SERVICE_NOT_AVAILABLE", message: "Service is not available for booking." } };
    }
    const addonContext = _resolveAddonContext(service, addonIds);
    const y = Number(year);
    const m = Number(month);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
        return { status: "ERROR", data: null, error: { code: "INVALID_PARAMS", message: "Invalid year/month" } };
    }
    const yearMonth = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}`;
    const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: SDK_CONFIG.TZ });
    const tomorrowStr = _addDaysYMD(todayStr, 1);
    const maxDateStr = _addDaysYMD(todayStr, DIAS_LIMITE);
    const firstDay = `${yearMonth}-01`;
    const lastDayNum = new Date(y, m, 0).getDate();
    const lastDay = `${yearMonth}-${String(lastDayNum).padStart(2, "0")}`;
    const fromLocal = tomorrowStr > firstDay ? tomorrowStr : firstDay;
    const toLocal = maxDateStr < lastDay ? maxDateStr : lastDay;
    if (fromLocal > toLocal) return { status: "SUCCESS", data: [], error: null };

    const daysCacheKey = `DAYSCACHE_${DAYS_CACHE_VERSION}__${String(resolved)}__${_hashKey(resourceIds.slice().sort().join(","))}__${yearMonth}`;
    const cachedWindow = await _readDaysCacheWindow(daysCacheKey);
    if (cachedWindow) {
        const emptySet = new Set(cachedWindow.emptyDaysYmds || []);
        const rebuilt = [];
        let cursor = fromLocal;
        while (cursor <= toLocal) {
            if (!emptySet.has(cursor)) rebuilt.push(cursor);
            cursor = _addDaysYMD(cursor, 1);
        }
        return { status: "SUCCESS", data: _filterDaysByLimit(rebuilt.sort()), error: null };
    }
    const slotDays = await _queryAvailableDaysFromSlots(resolved, resourceIds, fromLocal, toLocal, addonContext.nativeAddonIds);
    const slotSet = new Set(slotDays);
    const emptyDaysYmds = [];
    let walk = fromLocal;
    while (walk <= toLocal) {
        if (!slotSet.has(walk)) emptyDaysYmds.push(walk);
        walk = _addDaysYMD(walk, 1);
    }
    await _writeDaysCacheWindow(daysCacheKey, {
        serviceId: resolved,
        yearMonth,
        fromLocal,
        toLocal,
        availableDaysYmds: slotDays,
        emptyDaysYmds,
    });
    return { status: "SUCCESS", data: _filterDaysByLimit(slotDays), error: null };
}

export const getCertifiedDualSlots = webMethod(
    Permissions.Anyone,
    async (serviceId, resourceId, dateYMD, addonIds = []) => {
        try {
            const visitor = await _getVisitorIdentity();
            const rateKey = _buildRateLimitKey("availability", visitor.memberId, "");
            await _rateLimitOrThrow("availability", rateKey);
            return await _getCertifiedDualSlotsInternal(serviceId, resourceId, dateYMD, addonIds);
        } catch (err) {
            return { status: "ERROR", data: null, error: _toPublicError(err, "DUAL_SLOTS_FAILED") };
        }
    }
);

export const getAvailableSlots = webMethod(
    Permissions.Anyone,
    async (serviceId, resourceId, dateYMD, addonIds = []) => {
        try {
            const visitor = await _getVisitorIdentity();
            const rateKey = _buildRateLimitKey("availability", visitor.memberId, "");
            await _rateLimitOrThrow("availability", rateKey);
            return await _getCertifiedDualSlotsInternal(serviceId, resourceId, dateYMD, addonIds);
        } catch (err) {
            return { status: "ERROR", data: null, error: _toPublicError(err, "SLOTS_QUERY_FAILED") };
        }
    }
);

export const resolveStaffForSlot = webMethod(
    Permissions.Anyone,
    async (serviceId, start1, rId, addonIds = [], dualContext = null) => {
        const traceId = makeTraceId("wm-staff");
        try {
            const visitor = await _getVisitorIdentity();
            const rateKey = _buildRateLimitKey("availability", visitor.memberId, "");
            await _rateLimitOrThrow("availability", rateKey);
            return await _resolveStaffForSlotInternal({
                serviceId,
                f1Start: start1,
                f1End: null,
                f2Start: dualContext?.start2 || null,
                f2End: dualContext?.end2 || null,
                requestedResourceId: _safeTrim(rId) || null,
                addOnIds: addonIds,
                traceId,
            });
        } catch (err) {
            return { status: "ERROR", data: null, error: _toPublicError(err, "STAFF_RESOLVE_FAILED") };
        }
    }
);

/* =============================================================================
 * TOKENS DE VISUALIZACIÓN
 * ==========================================================================*/
async function _generateDisplayToken(bookingId, traceId) {
    const token = _generateUUID();
    const tokenHash = _hashKey(token);
    const expiresAt = new Date(Date.now() + DISPLAY_TOKEN_TTL_MS);
    try {
        await dalInsert(CONTROL_COL, {
            _id: `DT_${tokenHash}`,
            controlType: CT_DISPLAY_TOKEN,
            dedupeKey: `DISPLAY_TOKEN_${tokenHash}`,
            bookingId: _safeTrim(bookingId),
            tokenHash,
            expiresAt,
            attempts: 0,
            maxAttempts: DISPLAY_TOKEN_MAX_ATTEMPTS,
            consumedAt: null,
            traceId,
        });
        return token;
    } catch (e) {
        log.error("_generateDisplayToken failed", { bookingId, traceId, error: e?.message });
        throw new Error("TOKEN_GENERATION_FAILED");
    }
}

async function _validateAndConsumeDisplayToken(token, traceId) {
    const tokenHash = _hashKey(token);
    const tokenId = `DT_${tokenHash}`;
    try {
        const tokenRecord = await withTimeout(
            dalQuery(CONTROL_COL).eq("controlType", CT_DISPLAY_TOKEN).eq("tokenHash", tokenHash).limit(1).find(CONSISTENT_READ),
            WATCHDOG_TIMEOUT_MS,
            "validateDisplayToken"
        );
        const record = tokenRecord?.items?.[0];
        if (!record) return { valid: false, reason: "TOKEN_NOT_FOUND" };
        const expiresAtMs = new Date(record.expiresAt).getTime();
        if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) return { valid: false, reason: "TOKEN_EXPIRED" };
        if (record.consumedAt) return { valid: false, reason: "TOKEN_ALREADY_CONSUMED" };
        if (record.attempts >= record.maxAttempts) return { valid: false, reason: "TOKEN_MAX_ATTEMPTS_EXCEEDED" };
        // Consumption itself is the authoritative single-use operation.
        // Updating attempts first races with a concurrent request and can
        // resurrect a deleted token on APIs/mocks with upsert-like semantics.
        const consumed = await _consumeDisplayToken(tokenId, traceId);
        if (!consumed) return { valid: false, reason: "TOKEN_ALREADY_CONSUMED" };
        return { valid: true, bookingId: record.bookingId, tokenId };
    } catch (e) {
        log.error("_validateAndConsumeDisplayToken failed", { traceId, error: e?.message });
        return { valid: false, reason: "VALIDATION_ERROR" };
    }
}

async function _consumeDisplayToken(tokenId, traceId) {
    try {
        // CMS removal is atomic by _id: only one concurrent request can delete
        // the row. Replays and competing consumers fail closed.
        await removeById(CONTROL_COL, tokenId);
        return true;
    } catch (e) {
        log.warn("_consumeDisplayToken rejected (fail-closed)", {
            tokenId,
            traceId,
            code: e?.code,
            error: e?.message,
        });
        return false;
    }
}

export const getConfirmedBookingForDisplay = webMethod(
    Permissions.Anyone,
    async ({ bookingId, displayToken } = {}) => {
        const traceId = makeTraceId("wm-display");
        let id;
        let guardMemberId = "";
        let guardViaToken = false;

        if (typeof displayToken === "string" && displayToken.length > 0) {
            const tokenValidation = await _validateAndConsumeDisplayToken(displayToken, traceId);
            if (!tokenValidation.valid) {
                // Replay/max-attempt failures must not disclose whether the
                // bearer token existed. Keep expiry distinct per the existing
                // public contract; normalize consumed/unknown to TOKEN_NOT_FOUND.
                const publicReason = ["TOKEN_ALREADY_CONSUMED", "TOKEN_MAX_ATTEMPTS_EXCEEDED"].includes(tokenValidation.reason)
                    ? "TOKEN_NOT_FOUND"
                    : tokenValidation.reason;
                return { ok: false, data: null, error: publicReason, message: "Invalid or expired display token." };
            }
            id = _safeTrim(tokenValidation.bookingId);
            if (!id || !_looksLikeGuid(id)) return { ok: false, data: null, error: "INVALID_PAYLOAD" };
            guardViaToken = true;
        } else {
            const idPre = _safeTrim(bookingId);
            if (!idPre || !_looksLikeGuid(idPre)) return { ok: false, data: null, error: "INVALID_PAYLOAD" };
            const visitor = await _getVisitorIdentity();
            if (!visitor.isAuthenticated) {
                return { ok: false, data: null, error: "AUTH_REQUIRED", message: "Display token required for unauthenticated access." };
            }
            id = idPre;
            guardMemberId = visitor.memberId;
        }

        try {
            const res = await withTimeout(
                dalQuery(BUSINESS_COLLECTIONS.CITAS_F2).eq("bookingId", id).limit(1).find(CONSISTENT_READ),
                WATCHDOG_TIMEOUT_MS,
                "getConfirmedBookingForDisplay"
            );
            const rec = res?.items?.[0];
            if (!rec) return { ok: false, data: null, error: "NOT_FOUND" };

            if (!guardViaToken && guardMemberId) {
                const contactDetails = rec.contactDetails || {};
                const citaMemberId = _safeTrim(contactDetails.memberId || rec.memberId || "");
                if (!citaMemberId || citaMemberId !== guardMemberId) {
                    return { ok: false, data: null, error: "ACCESS_DENIED" };
                }
            }

            const rawStatus = String(rec.bookingStatus || "").toUpperCase();
            const isConfirmed = rawStatus === CITAS_BOOKING_STATUS?.CONFIRMED || rawStatus === "CONFIRMED";
            if (!isConfirmed) return { ok: false, data: null, error: "NOT_CONFIRMED" };

            const data = {};
            for (const key of [
                "bookingId", "bookingStatus", "paymentStatus", "pairToken",
                "serviceId", "dateYmd", "slotStart", "slotEnd", "resourceId",
            ]) {
                if (rec[key] !== undefined && rec[key] !== null) data[key] = rec[key];
            }
            data.bookingStatus = "CONFIRMED";
            return { ok: true, data, error: null };
        } catch (e) {
            log.warn("getConfirmedBookingForDisplay failed", { bookingId: id, error: e?.message });
            return { ok: false, data: null, error: "INTERNAL_ERROR" };
        }
    }
);

export const generateDisplayToken = webMethod(
    Permissions.Anyone,
    async ({ bookingId, confirmationToken } = {}) => {
        const traceId = makeTraceId("wm-gen-token");
        const visitor = await _getVisitorIdentity();
        const rateKey = _buildRateLimitKey("display-token", visitor.memberId, "");
        await _rateLimitOrThrow("display-token", rateKey);

        const id = _safeTrim(bookingId);
        if (!id || !_looksLikeGuid(id)) return { ok: false, token: null, error: "INVALID_PAYLOAD" };
        if (!visitor.isAuthenticated && !_safeTrim(confirmationToken)) {
            return {
                ok: false, token: null, error: "AUTH_REQUIRED",
                message: "Membership or confirmation credential required to issue a display token.",
            };
        }
        try {
            const res = await withTimeout(
                dalQuery(BUSINESS_COLLECTIONS.CITAS_F2).eq("bookingId", id).limit(1).find(CONSISTENT_READ),
                WATCHDOG_TIMEOUT_MS,
                "verifyBookingForToken"
            );
            const rec = res?.items?.[0];
            if (!rec) return { ok: false, token: null, error: "NOT_FOUND" };

            const rawStatus = String(rec.bookingStatus || "").toUpperCase();
            const isConfirmed = rawStatus === CITAS_BOOKING_STATUS?.CONFIRMED || rawStatus === "CONFIRMED";
            if (!isConfirmed) return { ok: false, token: null, error: "NOT_CONFIRMED" };

            if (visitor.isAuthenticated) {
                const ownerId = _safeTrim((rec.contactDetails && rec.contactDetails.memberId) || rec.memberId || "");
                if (!ownerId || ownerId !== visitor.memberId) {
                    return { ok: false, token: null, error: "ACCESS_DENIED" };
                }
            } else {
                const credHash = _hashKey(_safeTrim(confirmationToken));
                const credRec = await withTimeout(
                    dalQuery(CONTROL_COL).eq("controlType", CT_DISPLAY_TOKEN).eq("bookingId", id).limit(5).find(CONSISTENT_READ),
                    WATCHDOG_TIMEOUT_MS,
                    "verifyEmissionCredential"
                );
                const ownsCredential = (credRec?.items || []).some((row) => row.tokenHash && row.tokenHash === credHash);
                if (!ownsCredential) return { ok: false, token: null, error: "ACCESS_DENIED" };
            }
            const token = await _generateDisplayToken(id, traceId);
            return {
                ok: true, token,
                expiresIn: DISPLAY_TOKEN_TTL_MS,
                maxAttempts: DISPLAY_TOKEN_MAX_ATTEMPTS,
                error: null,
            };
        } catch (e) {
            log.error("generateDisplayToken failed", { bookingId: id, traceId, error: e?.message });
            return { ok: false, token: null, error: "TOKEN_GENERATION_FAILED" };
        }
    }
);