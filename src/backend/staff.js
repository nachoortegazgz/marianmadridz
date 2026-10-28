/*
=============================================================================
MODULE: backend/staff.js
VERSION: v9-BRIDGES
BASE: v8.2-SSOT-MASTER + reescritura completa tras eliminacion de MapaStaff.
RESPONSIBILITY: Resolver de identidad de personal mediante resourceId y
  contactId nativos de Wix. Los roles internos se derivan del mapa canonico
  de resourceId; el site-member ID se obtiene por Contacts API cuando se necesita.
STANDARDS: G10 ASCII Strict. Minimo codigo.
DECISION CLAVE: MapaStaff NO existe en CMS KEY FIELDS. Toda identidad
  staff se resuelve via APIs nativas de Wix. Este modulo es el UNICO
  punto de acceso a identidad staff en todo el backend.
=============================================================================
*/
import { staffMembers } from "@wix/bookings";
import { contactsV5 } from "@wix/crm";
import { auth } from "@wix/essentials";
import {
    SDK_CONFIG,
    STAFF_DEFAULT_NAME,
    STAFF,
    isValidGuid,
} from "backend/internalConfig";
import { _safeTrim, withTimeout } from "public/mmUtils";
import { logger } from "backend/logger";

const log = logger;

// =============================================================================
// CONSTANTES
// =============================================================================
const CACHE_TTL_MS = Number(SDK_CONFIG?.CACHE?.STAFF_TTL_MS) || 300000;
const CACHE_MAX_ENTRIES = Number(SDK_CONFIG?.CACHE?.MAX_ENTRIES) || 100;
const API_TIMEOUT_MS = Number(SDK_CONFIG?.TIMEOUTS?.API_MS) || 15000;

// Bookings Staff Members API oficial.
const queryStaffMembersElevated = auth.elevate(staffMembers.queryStaffMembers);
const getContactElevated = auth.elevate(contactsV5.getContact);
const STAFF_MEMBER_FIELDS = Object.freeze(["RESOURCE_DETAILS", "ASSOCIATED_IDENTITY_STATUS"]);
const MAX_STAFF_PAGES = 20;

// =============================================================================
// CACHE LRU
// =============================================================================
const _cache = new Map();

function _cacheGet(key) {
    const entry = _cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL_MS) {
        _cache.delete(key);
        return null;
    }
    _cache.delete(key);
    _cache.set(key, entry);
    return entry.val;
}

function _cacheSet(key, val) {
    if (_cache.size >= CACHE_MAX_ENTRIES) {
        const oldest = _cache.keys().next().value;
        if (oldest) _cache.delete(oldest);
    }
    _cache.set(key, { val, ts: Date.now() });
}

export function invalidateStaffCache() {
    _cache.clear();
}

// =============================================================================
// STAFF IDENTITY AND ROLE NORMALIZATION
// =============================================================================

/**
 * Obtiene un staff member por resourceId desde Bookings Staff API.
 * Retorna objeto normalizado o null.
 */
function _normalizeStaffMember(staff) {
    if (!staff || typeof staff !== "object") return null;

    const resource = staff.resource && typeof staff.resource === "object"
        ? staff.resource
        : {};
    const identity = staff.associatedWixIdentity || {};
    const identityStatus = _safeTrim(identity.connectionStatus || identity.connection?.status || "").toUpperCase();
    const identificationData = identity.identificationData || {};
    const contactId = identityStatus === "CONNECTED"
        ? _safeTrim(identificationData.contactId || "")
        : "";
    const workingHours = Array.isArray(resource.workingHoursSchedules)
        ? resource.workingHoursSchedules[0]
        : null;
    const resourceId = _safeTrim(staff.resourceId || resource.id || resource._id || "");

    const normalized = {
        staffMemberId: _safeTrim(staff.id || staff._id || ""),
        resourceId,
        contactId,
        displayName: _safeTrim(staff.name || ""),
        roleWebsite: _safeTrim(STAFF.WEBSITE_ROLE_BY_RESOURCE_ID[resourceId] || ""),
        scheduleId: _safeTrim(
            workingHours?.id ||
            workingHours?._id ||
            resource.eventsSchedule?.id ||
            resource.eventsSchedule?._id ||
            ""
        ),
    };

    return normalized.resourceId ? normalized : null;
}

function _indexStaff(staff) {
    if (!staff) return;
    _cacheSet(`staff:rid:${staff.resourceId}`, staff);
    if (staff.contactId && isValidGuid(staff.contactId)) {
        _cacheSet(`staff:contact:${staff.contactId}`, staff);
    }
}

async function _queryStaffMembers({ filter = null, traceId = null } = {}) {
    const all = [];
    let cursor = "";
    for (let page = 0; page < MAX_STAFF_PAGES; page += 1) {
        const query = {
            cursorPaging: {
                limit: 100,
                ...(cursor ? { cursor } : {}),
            },
        };
        if (!cursor && filter) query.filter = filter;

        const response = await withTimeout(
            queryStaffMembersElevated(query, { fields: STAFF_MEMBER_FIELDS }),
            API_TIMEOUT_MS,
            "Bookings.staffMembers.queryStaffMembers"
        );

        const items = Array.isArray(response?.staffMembers)
            ? response.staffMembers
            : [];
        all.push(...items);

        const nextCursor = _safeTrim(response?.pagingMetadata?.cursors?.next || "");
        if (!nextCursor) break;
        cursor = nextCursor;
    }

    return all.map(_normalizeStaffMember).filter(Boolean);
}

/**
 * Resolves a native Bookings resourceId through the documented staff-member
 * query. resourceId is not the staffMemberId, so getStaffMember(id) is not
 * valid for this lookup.
 */
async function _fetchStaffByResourceId(resourceId, traceId) {
    const id = _safeTrim(resourceId);
    if (!id || !isValidGuid(id)) return null;

    const cached = _cacheGet(`staff:rid:${id}`);
    if (cached) return cached;

    try {
        const staff = await _queryStaffMembers({
            filter: { resourceId: { $eq: id } },
            traceId,
        });
        const found = staff.find((item) => item.resourceId === id) || null;
        if (found) _indexStaff(found);
        return found;
    } catch (error) {
        log.warn("_fetchStaffByResourceId failed", {
            resourceId: id,
            traceId,
            error: error?.message,
        });
        return null;
    }
}

/**
 * Loads native staff profiles and indexes resource/contact identifiers.
 */
async function _fetchAllStaff(traceId) {
    const cacheKey = "staff:__ALL__";
    const cached = _cacheGet(cacheKey);
    if (cached) return cached;

    try {
        const all = await _queryStaffMembers({ traceId });
        for (const staff of all) _indexStaff(staff);
        _cacheSet(cacheKey, all);
        return all;
    } catch (error) {
        log.warn("_fetchAllStaff failed", { traceId, error: error?.message });
        return [];
    }
}

// =============================================================================
// API PUBLICA
// =============================================================================

export async function findStaffByContactId(contactId, traceId = null) {
    const id = _safeTrim(contactId);
    if (!isValidGuid(id)) return null;

    const cached = _cacheGet(`staff:contact:${id}`);
    if (cached) return cached;

    const all = await _fetchAllStaff(traceId);
    const found = all.find((staff) => staff.contactId === id) || null;
    if (found) _indexStaff(found);
    return found;
}

export async function findStaffByResourceId(resourceId, traceId = null) {
    return _fetchStaffByResourceId(resourceId, traceId);
}

export async function getSiteMemberIdByContactId(contactId, traceId = null) {
    const id = _safeTrim(contactId);
    if (!isValidGuid(id)) return "";

    const cacheKey = `staff:site-member:${id}`;
    const cached = _cacheGet(cacheKey);
    if (cached && isValidGuid(cached)) return cached;

    try {
        const response = await withTimeout(
            getContactElevated(id),
            API_TIMEOUT_MS,
            "CRM.contactsV5.getContact"
        );
        const contact = response?.contact || response;
        const memberId = _safeTrim(contact?.memberInfo?.memberId || "");
        if (!isValidGuid(memberId)) return "";
        _cacheSet(cacheKey, memberId);
        return memberId;
    } catch (error) {
        log.warn("getSiteMemberIdByContactId failed", {
            traceId,
            error: error?.message,
        });
        return "";
    }
}

/**
 * Ficha de Marian (identidad canonica). Unico punto donde vive el
 * resourceId de Marian (R2/DUP-03: sin duplicaciones en consumidores).
 */
export async function findMarianStaff(traceId = null) {
    return _fetchStaffByResourceId(STAFF.IDS[0], traceId);
}

export async function getStaffScheduleId(resourceId, traceId = null) {
    const staff = await findStaffByResourceId(resourceId, traceId);
    return staff ? _safeTrim(staff.scheduleId) || null : null;
}

export async function listStaff(traceId = null) {
    return _fetchAllStaff(traceId);
}

/**
 * Verifica si un resourceId pertenece a Marian (manager).
 */
export function isMarianResource(resourceId) {
    return _safeTrim(resourceId) === STAFF.IDS[0];
}

/**
 * Nombre visible de staff. Fallback a STAFF_DEFAULT_NAME (SSOT internalConfig).
 */
export function getStaffDisplayName(staff) {
    if (!staff) return STAFF_DEFAULT_NAME;
    return _safeTrim(staff.displayName) || STAFF_DEFAULT_NAME;
}
