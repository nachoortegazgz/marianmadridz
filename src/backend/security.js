/*
=============================================================================
MODULE: backend/security.js
VERSION: v5015-ALIGNED
BASE: v5009-FISCAL-V20.1 + alineacion con internalConfig v12.0-SSOT-FINAL
      y dataAccess v2.1-UNIFIED
RESPONSIBILITY: Motor de seguridad. Rate limiter con ventana deslizante,
verificacion de roles y bloqueo persistente cross-instancia.
STANDARDS: G10 ASCII Strict. Cero suppressAuth. Cero COLLECTIONS alias.

CAMBIOS DE ALINEACION v5015-ALIGNED (respecto a v5009-FISCAL-V20.1):
  ALN-01: COLLECTIONS alias eliminado. MAPA_STAFF no esta declarada en
          BUSINESS_COLLECTIONS v12.0 (coleccion MUERTA segun nota PEND-DAL).
          Se declara MAPA_STAFF_COL local = "MapaStaff" por compatibilidad
          con despliegues historicos. ADR pendiente para migrar la
          verificacion de roles a la Bookings Staff API.
  ALN-02: COLLABORATOR_ROLES y STAFF_ACCESS ELIMINADOS en v12.0. Se usa
          ROL_WEBSITE (ADMIN | GESTION | ESTILISTA) y ALLOWED_STAFF_ROLES
          local.
  ALN-03: Campo canonico del rol es rolWebsite (BIBLIA 5.9). Se mantiene
          fallback legacy a "rol" para datos historicos.
  ALN-04: Filtro ".eq('active', true)" ELIMINADO: no existe en KEY FIELDS
          MapaStaff. Si el documento existe en MapaStaff, se considera
          activo (el alta/baja se gestiona por borrado del registro).
  ALN-05: wix-members-backend + suppressAuth ELIMINADOS. Se usa
          @wix/members (SDK v2) con shape defensivo (response?.member ||
          response). Coherente con citasManager.web.js.
  ALN-06: wixData.query(...).find({ suppressAuth: true }) -> dalQuery(...)
          .find(STRONG_READ).
=============================================================================
*/

import { currentMember } from "@wix/members";

import {
    query as dalQuery,
    insertItem as dalInsert,
} from "backend/dataAccess";

import {
    SDK_CONFIG,
    ROL_WEBSITE,
} from "backend/internalConfig";

import {
    findStaffByContactId,
    invalidateStaffCache as _invalidateStaffCache,
} from "backend/staff";

import { makeTraceId } from "public/mmUtils";
import { logger } from "backend/logger";

const log = logger;

// =============================================================================
// BLOQUE 1 - CONSTANTES
// =============================================================================

// La identidad se resuelve por el contactId de una cuenta de staff conectada.
// Los roles proceden exclusivamente de STAFF.WEBSITE_ROLE_BY_RESOURCE_ID.

// Only canonical roles from internalConfig can reach these guards. No role is
// inferred from arbitrary fields returned by the Bookings Staff API.
const ALLOWED_STAFF_ROLES = Object.freeze([
    ROL_WEBSITE.ADMIN,
    ROL_WEBSITE.GESTION,
    ROL_WEBSITE.ESTILISTA,
]);

const RATE_LIMIT_CACHE = new Map();

const RATE_LIMIT_MAX_REQUESTS =
    Number(SDK_CONFIG?.RATE_LIMIT?.MAX_REQUESTS) || 20;

const RATE_LIMIT_WINDOW_MS =
    Number(SDK_CONFIG?.RATE_LIMIT?.WINDOW_MS) || 5000;

const RATE_LIMIT_CLEANUP_TTL_MS =
    Number(SDK_CONFIG?.SECURITY?.RATE_LIMIT_CACHE_CLEANUP_TTL_MS) || 60000;

const RATE_LIMIT_CACHE_MAX_ENTRIES =
    Number(SDK_CONFIG?.SECURITY?.RATE_LIMIT_CACHE_MAX_ENTRIES) || 5000;

const PERSISTENT_BLOCK_THRESHOLD_MULTIPLIER = 3;
const PERSISTENT_BLOCK_DURATION_MS = 60 * 60 * 1000;

const GUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STRONG_READ = Object.freeze({ consistencyMode: "strong" });

let lastCleanupTime = Date.now();

// =============================================================================
// BLOQUE 2 - HELPERS INTERNOS
// =============================================================================

function _safeString(value) {
    if (value === null || value === undefined) {
        return "";
    }
    return String(value).trim();
}

function _isValidGuid(value) {
    return GUID_PATTERN.test(_safeString(value));
}

function _normalizeRateLimitPart(value, fallback = "unknown") {
    const normalized = _safeString(value);

    if (!normalized) {
        return fallback;
    }

    return normalized.slice(0, 200);
}

function _buildRateLimitCacheKey(surface, key) {
    return `${_normalizeRateLimitPart(surface)}:${_normalizeRateLimitPart(key)}`;
}

function _buildPersistentBlockId(surface, key) {
    const raw = `${_normalizeRateLimitPart(surface)}_${_normalizeRateLimitPart(
        key
    )}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    return `RL_${raw.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 190)}`;
}

function _cleanupRateLimitCache() {
    const now = Date.now();

    if (now - lastCleanupTime < RATE_LIMIT_CLEANUP_TTL_MS) {
        return;
    }

    lastCleanupTime = now;

    for (const [cacheKey, entry] of RATE_LIMIT_CACHE.entries()) {
        const windowStart = now - entry.windowMs;

        entry.timestamps = (entry.timestamps || []).filter(
            (timestamp) => timestamp > windowStart
        );

        const activeBlock =
            Number(entry.blockedUntil) > now && entry.blockedUntil !== null;

        if (entry.timestamps.length === 0 && !activeBlock) {
            RATE_LIMIT_CACHE.delete(cacheKey);
        }
    }

    if (RATE_LIMIT_CACHE.size <= RATE_LIMIT_CACHE_MAX_ENTRIES) {
        return;
    }

    const entriesToDelete =
        RATE_LIMIT_CACHE.size - RATE_LIMIT_CACHE_MAX_ENTRIES;

    let deleted = 0;

    for (const cacheKey of RATE_LIMIT_CACHE.keys()) {
        if (deleted >= entriesToDelete) {
            break;
        }

        RATE_LIMIT_CACHE.delete(cacheKey);
        deleted += 1;
    }
}

function _createAccessDeniedError(requiredRole) {
    const error = new Error(`ACCESS_DENIED: ${requiredRole} role required`);
    error.code = "ACCESS_DENIED";
    error.requiredRole = requiredRole;
    return error;
}

// Site-member ownership uses the Contact ID shared by the current member
// and the connected Bookings staff identity. Email alone never grants access.
async function _resolveStaffByIdentity(memberInfo, traceId) {
    const contactId = _safeString(memberInfo?.contactId);
    if (!contactId || !_isValidGuid(contactId)) return null;

    try {
        return await findStaffByContactId(contactId, traceId);
    } catch (error) {
        log.error("Active staff lookup failed", {
            traceId,
            message: error?.message || String(error),
        });
        return null;
    }
}

function _readStaffRole(staff) {
    if (!staff || typeof staff !== "object") return "";
    const role = _safeString(staff.roleWebsite).toUpperCase();
    return Object.values(ROL_WEBSITE).includes(role) ? role : "";
}

/**
 * SEC-R3-03: contexto de staff del miembro actual (antes exclusivo de
 * horario.web). Fuente unica para webMethods de roles/fichajes.
 * Retorna null si el miembro no tiene ficha staff valida.
 */
export async function getMyStaffContext(traceId = null) {
    const safeTraceId = traceId || makeTraceId("staff-ctx");
    const memberInfo = await _getCurrentMemberInfo(safeTraceId);

    if (!memberInfo?.contactId) {
        return null;
    }

    const staff = await _resolveStaffByIdentity(memberInfo, safeTraceId);

    if (!staff) {
        return null;
    }

    return {
        memberId: memberInfo.memberId || "",
        contactId: staff.contactId || memberInfo.contactId || "",
        email: memberInfo.email || "",
        resourceId: staff.resourceId || "",
        displayName: staff.displayName || "",
        rolWebsite: _readStaffRole(staff),
    };
}

// =============================================================================
// BLOQUE 3 - RATE LIMITER LOCAL
// =============================================================================

export function rateLimiter(
    { surface, key } = {},
    maxRequests = RATE_LIMIT_MAX_REQUESTS,
    windowMs = RATE_LIMIT_WINDOW_MS
) {
    _cleanupRateLimitCache();

    const normalizedSurface = _normalizeRateLimitPart(surface);
    const normalizedKey = _normalizeRateLimitPart(key);

    const max = Math.max(1, Number(maxRequests) || RATE_LIMIT_MAX_REQUESTS);
    const window = Math.max(1, Number(windowMs) || RATE_LIMIT_WINDOW_MS);

    const cacheKey = _buildRateLimitCacheKey(
        normalizedSurface,
        normalizedKey
    );

    const now = Date.now();

    let entry = RATE_LIMIT_CACHE.get(cacheKey);

    if (!entry) {
        entry = {
            timestamps: [],
            blockedUntil: null,
            persistentBlockTriggered: false,
            maxRequests: max,
            windowMs: window,
        };

        RATE_LIMIT_CACHE.set(cacheKey, entry);
    }

    entry.maxRequests = max;
    entry.windowMs = window;

    if (entry.blockedUntil && entry.blockedUntil > now) {
        return {
            allowed: false,
            retryAfter: Math.max(
                1,
                Math.ceil((entry.blockedUntil - now) / 1000)
            ),
            persistentBlock: true,
        };
    }

    if (entry.blockedUntil && entry.blockedUntil <= now) {
        entry.blockedUntil = null;
        entry.persistentBlockTriggered = false;
    }

    const windowStart = now - window;

    entry.timestamps = entry.timestamps.filter(
        (timestamp) => timestamp > windowStart
    );

    const persistentThreshold =
        max * PERSISTENT_BLOCK_THRESHOLD_MULTIPLIER;

    if (entry.timestamps.length >= persistentThreshold) {
        if (!entry.persistentBlockTriggered) {
            entry.persistentBlockTriggered = true;
            entry.blockedUntil = now + PERSISTENT_BLOCK_DURATION_MS;

            const traceId = makeTraceId("rl-block");

            registerPersistentBlock(
                normalizedSurface,
                normalizedKey,
                PERSISTENT_BLOCK_DURATION_MS,
                traceId
            ).catch((error) => {
                log.error("Persistent block registration failed", {
                    traceId,
                    message: error?.message || String(error),
                });
            });

            log.warn("Persistent rate limit block triggered", {
                surface: normalizedSurface,
                key: normalizedKey,
                requestsInWindow: entry.timestamps.length,
                threshold: persistentThreshold,
                durationMs: PERSISTENT_BLOCK_DURATION_MS,
                traceId,
            });
        }

        return {
            allowed: false,
            retryAfter: Math.max(
                1,
                Math.ceil((entry.blockedUntil - now) / 1000)
            ),
            persistentBlock: true,
        };
    }

    if (entry.timestamps.length >= max) {
        const oldestTimestamp = entry.timestamps[0] || now;
        const retryAfterMs = oldestTimestamp + window - now;

        return {
            allowed: false,
            retryAfter: Math.max(1, Math.ceil(retryAfterMs / 1000)),
            persistentBlock: false,
        };
    }

    entry.timestamps.push(now);

    return {
        allowed: true,
        retryAfter: 0,
        persistentBlock: false,
    };
}

// =============================================================================
// BLOQUE 4 - BLOQUEO PERSISTENTE
// =============================================================================

export async function isKeyPersistentlyBlocked(surface, key) {
    const normalizedSurface = _normalizeRateLimitPart(surface);
    const normalizedKey = _normalizeRateLimitPart(key);

    if (!normalizedSurface || !normalizedKey) {
        return false;
    }

    try {
        const result = await dalQuery(RATE_LIMIT_BLOCKS_COL())
            .eq("surface", normalizedSurface)
            .eq("key", normalizedKey)
            .gt("expiresAt", new Date())
            .limit(1)
            .find(STRONG_READ);

        return Array.isArray(result?.items) && result.items.length > 0;
    } catch (error) {
        log.error("Persistent block lookup failed", {
            surface: normalizedSurface,
            message: error?.message || String(error),
        });

        return false;
    }
}

// RATE_LIMIT_BLOCKS no esta en BUSINESS_COLLECTIONS v12.0. Se declara
// constante local (coleccion operativa historica).
function RATE_LIMIT_BLOCKS_COL() {
    return "RateLimitBlocks";
}

export async function registerPersistentBlock(
    surface,
    key,
    durationMs,
    traceId = null
) {
    const normalizedSurface = _normalizeRateLimitPart(surface);
    const normalizedKey = _normalizeRateLimitPart(key);
    const safeDurationMs = Math.max(
        1000,
        Number(durationMs) || PERSISTENT_BLOCK_DURATION_MS
    );

    if (!normalizedSurface || !normalizedKey) {
        return {
            status: "ERROR",
            registered: false,
            reason: "INVALID_BLOCK_KEY",
        };
    }

    const expiresAt = new Date(Date.now() + safeDurationMs);
    const blockId = _buildPersistentBlockId(
        normalizedSurface,
        normalizedKey
    );

    try {
        const existing = await dalQuery(RATE_LIMIT_BLOCKS_COL())
            .eq("surface", normalizedSurface)
            .eq("key", normalizedKey)
            .gt("expiresAt", new Date())
            .limit(1)
            .find(STRONG_READ);

        if (existing?.items?.length > 0) {
            return {
                status: "SUCCESS",
                registered: false,
                alreadyBlocked: true,
            };
        }

        await dalInsert(RATE_LIMIT_BLOCKS_COL(), {
            _id: blockId,
            surface: normalizedSurface,
            key: normalizedKey,
            expiresAt,
        });

        log.warn("Persistent block registered", {
            surface: normalizedSurface,
            key: normalizedKey,
            durationMs: safeDurationMs,
            traceId,
        });

        return {
            status: "SUCCESS",
            registered: true,
            alreadyBlocked: false,
        };
    } catch (error) {
        log.error("Persistent block registration failed", {
            surface: normalizedSurface,
            message: error?.message || String(error),
            traceId,
        });

        return {
            status: "ERROR",
            registered: false,
            reason: "PERSISTENT_BLOCK_REGISTRATION_FAILED",
        };
    }
}

// =============================================================================
// BLOQUE 5 - IDENTIDAD DEL MIEMBRO (ALN-05: @wix/members, sin suppressAuth)
// =============================================================================

async function _getCurrentMemberInfo(traceId = null) {
    try {
        const response = await currentMember.getMember();
        const member = response?.member || response;

        if (!member) {
            return null;
        }

        const memberId = _safeString(
            member._id || member.id || member.memberId
        );
        const contactId = _safeString(member.contactId);
        const email = _safeString(
            member.loginEmail || member.contactDetails?.email
        ).toLowerCase();

        return {
            memberId,
            contactId,
            email,
        };
    } catch (error) {
        log.error("Current member lookup failed", {
            traceId,
            message: error?.message || String(error),
        });

        return null;
    }
}

// =============================================================================
// BLOQUE 6 - VERIFICACION DE ROLES (ALN-02/03: ROL_WEBSITE, rolWebsite)
// =============================================================================

export async function isAdmin(traceId = null) {
    const memberInfo = await _getCurrentMemberInfo(traceId);

    if (!memberInfo?.contactId) {
        return false;
    }

    const staff = await _resolveStaffByIdentity(memberInfo, traceId);

    return _readStaffRole(staff) === ROL_WEBSITE.ADMIN;
}

export async function isCajero(traceId = null) {
    const memberInfo = await _getCurrentMemberInfo(traceId);

    if (!memberInfo?.contactId) {
        return false;
    }

    const staff = await _resolveStaffByIdentity(memberInfo, traceId);

    const role = _readStaffRole(staff);
    return role === ROL_WEBSITE.ADMIN || role === ROL_WEBSITE.GESTION;
}

export async function isEstilista(traceId = null) {
    const memberInfo = await _getCurrentMemberInfo(traceId);

    if (!memberInfo?.contactId) {
        return false;
    }

    const staff = await _resolveStaffByIdentity(memberInfo, traceId);

    return _readStaffRole(staff) === ROL_WEBSITE.ESTILISTA;
}

export async function isStaffCollaborator(traceId = null) {
    const memberInfo = await _getCurrentMemberInfo(traceId);

    if (!memberInfo?.contactId) {
        return false;
    }

    const staff = await _resolveStaffByIdentity(memberInfo, traceId);

    if (!staff) {
        return false;
    }

    return ALLOWED_STAFF_ROLES.includes(_readStaffRole(staff));
}

// =============================================================================
// BLOQUE 7 - EXIGENCIA DE ROLES
// =============================================================================

export async function requireAdmin(traceId = null) {
    const authorized = await isAdmin(traceId);

    if (!authorized) {
        throw _createAccessDeniedError("ADMIN");
    }

    return true;
}

export async function requireCajero(traceId = null) {
    const authorized = await isCajero(traceId);

    if (!authorized) {
        throw _createAccessDeniedError("CAJERO");
    }

    return true;
}

/**
 * Test-harness API (offline suites only). Clears the in-memory rate-limit cache.
 * Never invoked by production webMethods; safe because RATE_LIMIT_CACHE is
 * module-scoped and rebuilt lazily on next request.
 */
export function _resetRateLimitCacheForTests() {
    RATE_LIMIT_CACHE.clear();
    // SEC-R3-04: el cache LRU de staff.js persista entre requests del
    // harness; debe invalidarse junto al rate-limit para tests deterministas.
    _invalidateStaffCache();
}

export async function requireMarianManager(traceId = null) {
    const authorized = await isAdmin(traceId);

    if (!authorized) {
        throw _createAccessDeniedError("MARIAN_MANAGER");
    }

    return true;
}