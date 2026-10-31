/*
MODULE: backend/security.js
RESPONSIBILITY: resolve authenticated Wix Members identity against the
Bookings Staff API and enforce a distributed GCRA rate limiter backed by atomic Wix Data conditional bulk patches.
RATE LIMITING: persistent per-requester state in ControlOperativo (RATE_LIMIT),
using atomic conditional bulkPatch compare-and-set. Fail closed on storage errors.
*/

import { currentMember } from "@wix/members";

import {
    CONTROL_STATUS,
    CONTROL_TYPE,
    OPERATIONAL_COLLECTIONS,
    ROL_WEBSITE,
} from "backend/internalConfig";

import {
    findStaffByContactId,
    invalidateStaffCache as _invalidateStaffCache,
} from "backend/staff";

import { makeTraceId } from "public/mmUtils";
import {
    CONSISTENCY,
    getItem,
    insertItem,
    bulkPatchItems,
} from "backend/dataAccess";
import { hashSHA256 } from "backend/securityEngine";
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

const DEFAULT_RATE_LIMIT = Object.freeze({
    maxRequests: 20,
    windowMs: 5000,
});

const RATE_LIMIT_POLICIES = Object.freeze({
    "public-booking": Object.freeze({ maxRequests: 5, windowMs: 10000 }),
    reservas: Object.freeze({ maxRequests: 20, windowMs: 5000 }),
    availability: Object.freeze({ maxRequests: 12, windowMs: 5000 }),
});

const RATE_LIMIT_CAS_ATTEMPTS = 12;
const RATE_LIMIT_COLLECTION = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;

const GUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


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

function _isDuplicateRateLimitRecord(error) {
    return error?.code === "WDE0023" ||
        /WDE0023|already exists/i.test(_safeString(error?.message));
}

function _createRateLimitStorageError(cause) {
    const error = new Error("Rate limit storage is unavailable.");
    error.code = "RATE_LIMIT_STORAGE_UNAVAILABLE";
    error.cause = cause;
    return error;
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
// BLOQUE 3 - RATE LIMITER DISTRIBUIDO (GCRA + CMS ATOMICO)
// =============================================================================

/**
 * GCRA (Generic Cell Rate Algorithm) persisted in ControlOperativo.
 *
 * Each requester/surface has one row. A conditional bulkPatch compares the
 * current version and atomically advances the theoretical arrival time (TAT).
 * Concurrent requests that read the same version race on the server-side
 * condition: only one update wins; losers reread and retry.
 *
 * This is a burst-capable token/leaky-bucket policy: maxRequests requests can
 * pass immediately, then capacity refills at windowMs / maxRequests.
 * Storage failures are fail-closed; no per-instance Map fallback is allowed.
 */
export async function rateLimiter(
    { surface, key } = {},
    maxRequests = null,
    windowMs = null
) {
    const normalizedSurface = _normalizeRateLimitPart(surface);
    const normalizedKey = _normalizeRateLimitPart(key, "anonymous");
    const policy = RATE_LIMIT_POLICIES[normalizedSurface] || DEFAULT_RATE_LIMIT;
    const max = Math.max(1, Math.floor(Number(maxRequests) || policy.maxRequests));
    const window = Math.max(1, Math.floor(Number(windowMs) || policy.windowMs));
    const intervalMs = Math.ceil(window / max);
    const burstToleranceMs = Math.max(0, window - intervalMs);
    const traceId = makeTraceId("rate-limit");

    try {
        const policyHash = await hashSHA256(
            `${normalizedSurface}|${normalizedKey}|${max}|${window}`
        );
        const requesterHash = await hashSHA256(
            `${normalizedSurface}|${normalizedKey}`
        );
        const recordId = `RL_${policyHash}`;
        const now = Date.now();

        // Insert-once bootstrap. Duplicate-ID contention is expected and safe.
        try {
            await insertItem(RATE_LIMIT_COLLECTION, {
                _id: recordId,
                controlType: CONTROL_TYPE.RATE_LIMIT,
                dedupeKey: `RATE_LIMIT:${policyHash}`,
                traceId,
                status: CONTROL_STATUS.ACTIVE,
                surface: normalizedSurface,
                requesterKey: requesterHash,
                requestCount: 0,
                windowStart: new Date(now),
                expiresAt: new Date(now + window * 2),
                version: 0,
                payload: {
                    algorithm: "GCRA_V1",
                    tat: new Date(now).toISOString(),
                },
            });
        } catch (insertError) {
            if (!_isDuplicateRateLimitRecord(insertError)) throw insertError;
        }

        for (let attempt = 0; attempt < RATE_LIMIT_CAS_ATTEMPTS; attempt += 1) {
            const record = await getItem(
                RATE_LIMIT_COLLECTION,
                recordId,
                CONSISTENCY.STRONG
            );

            if (!record) {
                // Expiry cleanup may race with a request; recreate and retry.
                try {
                    await insertItem(RATE_LIMIT_COLLECTION, {
                        _id: recordId,
                        controlType: CONTROL_TYPE.RATE_LIMIT,
                        dedupeKey: `RATE_LIMIT:${policyHash}`,
                        traceId,
                        status: CONTROL_STATUS.ACTIVE,
                        surface: normalizedSurface,
                        requesterKey: requesterHash,
                        requestCount: 0,
                        windowStart: new Date(now),
                        expiresAt: new Date(now + window * 2),
                        version: 0,
                        payload: {
                            algorithm: "GCRA_V1",
                            tat: new Date(now).toISOString(),
                        },
                    });
                } catch (insertError) {
                    if (!_isDuplicateRateLimitRecord(insertError)) throw insertError;
                }
                continue;
            }

            const version = Number(record.version);
            const tatMs = Date.parse(record.payload?.tat);
            if (!Number.isInteger(version) || version < 0 || !Number.isFinite(tatMs)) {
                throw new Error("RATE_LIMIT_RECORD_INVALID");
            }

            const requestNow = Date.now();
            const allowAt = tatMs - burstToleranceMs;
            if (requestNow < allowAt) {
                return {
                    allowed: false,
                    retryAfter: Math.max(1, Math.ceil((allowAt - requestNow) / 1000)),
                };
            }

            const nextTatMs = Math.max(requestNow, tatMs) + intervalMs;
            const nextPayload = {
                ...(record.payload && typeof record.payload === "object"
                    ? record.payload
                    : {}),
                algorithm: "GCRA_V1",
                tat: new Date(nextTatMs).toISOString(),
            };

            const result = await bulkPatchItems(
                RATE_LIMIT_COLLECTION,
                [recordId],
                [[
                    {
                        fieldPath: "payload",
                        action: "SET_FIELD",
                        value: nextPayload,
                    },
                    {
                        fieldPath: "requestCount",
                        action: "INCREMENT_FIELD",
                        value: 1,
                    },
                    {
                        fieldPath: "version",
                        action: "INCREMENT_FIELD",
                        value: 1,
                    },
                    {
                        fieldPath: "expiresAt",
                        action: "SET_FIELD",
                        value: new Date(nextTatMs + window),
                    },
                ]],
                {
                    condition: {
                        filter: {
                            version: { $eq: version },
                        },
                    },
                }
            );

            if (Array.isArray(result?.errors) && result.errors.length > 0) {
                throw new Error(
                    result.errors[0]?.message ||
                    result.errors[0]?.code ||
                    "RATE_LIMIT_PATCH_FAILED"
                );
            }

            if (Array.isArray(result?.updatedItemIds) &&
                result.updatedItemIds.includes(recordId)) {
                return { allowed: true, retryAfter: 0 };
            }

            // Conditional update lost a concurrent race; reread the new version.
        }

        // Excessive contention is denied rather than bypassing the limiter.
        return { allowed: false, retryAfter: 1 };
    } catch (error) {
        log.error("Distributed rate limiter storage failure", {
            surface: normalizedSurface,
            traceId,
            message: error?.message || String(error),
        });
        throw _createRateLimitStorageError(error);
    }
}

// =============================================================================
// BLOQUE 4 - IDENTIDAD DEL MIEMBRO (ALN-05: @wix/members, sin suppressAuth)
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
// BLOQUE 5 - VERIFICACION DE ROLES (ALN-02/03: ROL_WEBSITE, rolWebsite)
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
// BLOQUE 6 - EXIGENCIA DE ROLES
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

// Test harness resets the mocked ControlOperativo store directly.
export async function requireMarianManager(traceId = null) {
    const authorized = await isAdmin(traceId);

    if (!authorized) {
        throw _createAccessDeniedError("MARIAN_MANAGER");
    }

    return true;
}