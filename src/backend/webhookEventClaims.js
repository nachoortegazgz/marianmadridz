/*
=============================================================================
MODULE: backend/webhookEventClaims.js
VERSION: v1.0-ATOMIC-FENCED-CLAIMS
RESPONSIBILITY: Durable per-event claims for at-least-once Wix backend events.
CONTRACT: Deterministic insert claim + owner/version conditional transitions.
=============================================================================
*/

import {
    getItem,
    insertItem,
    bulkPatchItems,
    CONSISTENCY,
} from "backend/dataAccess";
import {
    OPERATIONAL_COLLECTIONS,
    CONTROL_TYPE,
    WEBHOOK_CLAIM_STATUS,
} from "backend/internalConfig";
import { hashSHA256 } from "backend/securityEngine";

const COLLECTION = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
const DEFAULT_LEASE_MS = 10 * 60 * 1000;
const MAX_EVENT_ID_LENGTH = 512;

function claimError(code) {
    const error = new Error("WEBHOOK_EVENT_CLAIM_ERROR");
    error.code = code;
    return error;
}

function normalizeNow(value) {
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value ?? Date.now());
    if (Number.isNaN(date.getTime())) throw claimError("WEBHOOK_CLAIM_CLOCK_INVALID");
    return date;
}

function normalizeLeaseMs(value) {
    const lease = Number(value ?? DEFAULT_LEASE_MS);
    if (!Number.isSafeInteger(lease) || lease < 1000 || lease > 60 * 60 * 1000) {
        throw claimError("WEBHOOK_CLAIM_LEASE_INVALID");
    }
    return lease;
}

export async function getWebhookEventClaimId(eventId, eventType) {
    const id = String(eventId ?? "").trim();
    const type = String(eventType ?? "").trim().toUpperCase();
    if (!id || id.length > MAX_EVENT_ID_LENGTH || !type) {
        throw claimError("WEBHOOK_CLAIM_IDENTITY_INVALID");
    }
    const digest = await hashSHA256(JSON.stringify([type, id]));
    return "WHC_" + digest;
}

function claimCondition(claim) {
    return {
        controlType: { $eq: CONTROL_TYPE.WEBHOOK_CLAIM },
        status: { $eq: claim.status },
        traceId: { $eq: claim.traceId },
        version: { $eq: claim.version },
    };
}

async function compareAndSwap(claim, modifications) {
    const result = await bulkPatchItems(
        COLLECTION,
        [claim._id],
        modifications,
        { condition: { filter: claimCondition(claim) } }
    );
    return Array.isArray(result?.updatedItemIds) &&
        result.updatedItemIds.includes(claim._id);
}

export async function acquireWebhookEventClaim({
    eventId,
    eventType,
    traceId,
    now,
    leaseMs,
}) {
    const id = String(eventId ?? "").trim();
    const type = String(eventType ?? "").trim().toUpperCase();
    const claimTraceId = String(traceId ?? "").trim();
    if (!id || id.length > MAX_EVENT_ID_LENGTH || !type || !claimTraceId) {
        throw claimError("WEBHOOK_CLAIM_IDENTITY_INVALID");
    }

    const clock = normalizeNow(now);
    const leaseDuration = normalizeLeaseMs(leaseMs);
    const claimId = await getWebhookEventClaimId(id, type);
    const expiresAt = new Date(clock.getTime() + leaseDuration);
    const initial = {
        _id: claimId,
        controlType: CONTROL_TYPE.WEBHOOK_CLAIM,
        dedupeKey: claimId,
        eventId: id,
        eventType: type,
        status: WEBHOOK_CLAIM_STATUS.IN_PROGRESS,
        traceId: claimTraceId,
        version: 1,
        attempts: 1,
        expiresAt,
        payload: { eventType: type },
    };

    try {
        await insertItem(COLLECTION, initial);
        return {
            status: "ACQUIRED",
            claim: {
                _id: claimId,
                eventId: id,
                eventType: type,
                traceId: claimTraceId,
                version: 1,
                attempts: 1,
                expiresAt,
                status: WEBHOOK_CLAIM_STATUS.IN_PROGRESS,
                payload: initial.payload,
            },
        };
    } catch (insertError) {
        const existing = await getItem(COLLECTION, claimId, CONSISTENCY.STRONG);
        if (!existing) throw insertError;
        if (existing.controlType !== CONTROL_TYPE.WEBHOOK_CLAIM) {
            throw claimError("WEBHOOK_CLAIM_TYPE_COLLISION");
        }
        if (existing.status === WEBHOOK_CLAIM_STATUS.COMPLETED) {
            return { status: "COMPLETED", claimId };
        }

        const existingLease = new Date(existing.expiresAt);
        if (
            existing.status === WEBHOOK_CLAIM_STATUS.IN_PROGRESS &&
            Number.isFinite(existingLease.getTime()) &&
            existingLease.getTime() > clock.getTime()
        ) {
            return { status: "BUSY", claimId };
        }
        if (
            ![
                WEBHOOK_CLAIM_STATUS.IN_PROGRESS,
                WEBHOOK_CLAIM_STATUS.FAILED_RETRYABLE,
            ].includes(existing.status)
        ) {
            throw claimError("WEBHOOK_CLAIM_STATE_INVALID");
        }

        const version = Number(existing.version);
        const previousTraceId = String(existing.traceId ?? "").trim();
        if (!Number.isSafeInteger(version) || version < 1 || !previousTraceId) {
            throw claimError("WEBHOOK_CLAIM_FENCE_INVALID");
        }

        const previous = {
            _id: claimId,
            status: existing.status,
            traceId: previousTraceId,
            version,
        };
        const previousAttempts = Number(existing.attempts);
        if (!Number.isSafeInteger(previousAttempts) || previousAttempts < 1) {
            throw claimError("WEBHOOK_CLAIM_ATTEMPTS_INVALID");
        }
        const attempts = previousAttempts + 1;
        const nextPayload = existing.payload || {};
        const recovered = await compareAndSwap(previous, [
            { fieldPath: "status", action: "SET_FIELD", value: WEBHOOK_CLAIM_STATUS.IN_PROGRESS },
            { fieldPath: "traceId", action: "SET_FIELD", value: claimTraceId },
            { fieldPath: "payload", action: "SET_FIELD", value: nextPayload },
            { fieldPath: "attempts", action: "SET_FIELD", value: attempts },
            { fieldPath: "expiresAt", action: "SET_FIELD", value: expiresAt },
            { fieldPath: "version", action: "INCREMENT_FIELD", value: 1 },
        ]);
        if (!recovered) return { status: "BUSY", claimId };

        return {
            status: "ACQUIRED",
            claim: {
                _id: claimId,
                eventId: id,
                eventType: type,
                traceId: claimTraceId,
                version: version + 1,
                attempts,
                expiresAt,
                status: WEBHOOK_CLAIM_STATUS.IN_PROGRESS,
                payload: nextPayload,
            },
        };
    }
}

export async function completeWebhookEventClaim(claim, now = new Date()) {
    if (!claim || claim.status !== WEBHOOK_CLAIM_STATUS.IN_PROGRESS) {
        throw claimError("WEBHOOK_CLAIM_HANDLE_INVALID");
    }
    const completedAt = normalizeNow(now);
    const completed = await compareAndSwap(claim, [
        { fieldPath: "status", action: "SET_FIELD", value: WEBHOOK_CLAIM_STATUS.COMPLETED },
        {
            fieldPath: "payload",
            action: "SET_FIELD",
            value: {
                ...(claim.payload || {}),
                completedAt,
            },
        },
        { fieldPath: "expiresAt", action: "SET_FIELD", value: completedAt },
        { fieldPath: "version", action: "INCREMENT_FIELD", value: 1 },
    ]);
    if (!completed) throw claimError("WEBHOOK_CLAIM_LOST");
    return true;
}

export async function releaseWebhookEventClaim(claim, error, now = new Date()) {
    if (!claim || claim.status !== WEBHOOK_CLAIM_STATUS.IN_PROGRESS) return false;
    const errorCode = String(error?.code || "HANDLER_FAILED").slice(0, 80);
    const failedAt = normalizeNow(now);
    return compareAndSwap(claim, [
        { fieldPath: "status", action: "SET_FIELD", value: WEBHOOK_CLAIM_STATUS.FAILED_RETRYABLE },
        {
            fieldPath: "payload",
            action: "SET_FIELD",
            value: {
                ...(claim.payload || {}),
                failedAt,
                lastErrorCode: errorCode,
            },
        },
        { fieldPath: "expiresAt", action: "SET_FIELD", value: failedAt },
        { fieldPath: "version", action: "INCREMENT_FIELD", value: 1 },
    ]);
}

export async function runWithWebhookEventClaim({
    eventId,
    eventType,
    traceId,
    handler,
}) {
    if (typeof handler !== "function") throw claimError("WEBHOOK_CLAIM_HANDLER_REQUIRED");
    const acquisition = await acquireWebhookEventClaim({ eventId, eventType, traceId });
    if (acquisition.status === "COMPLETED") {
        return { status: "OK", duplicate: true };
    }
    if (acquisition.status === "BUSY") {
        throw claimError("WEBHOOK_EVENT_CLAIM_BUSY");
    }

    try {
        const result = await handler();
        await completeWebhookEventClaim(acquisition.claim);
        return result;
    } catch (error) {
        try {
            await releaseWebhookEventClaim(acquisition.claim, error);
        } catch (_) {
            // The bounded lease remains the recovery path if release is unavailable.
        }
        throw error;
    }
}
