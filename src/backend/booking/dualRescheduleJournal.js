import { hashSHA256 } from "../securityEngine.js";

function _required(value, field) {
    const normalized = String(value ?? "").trim();
    if (!normalized) {
        const error = new Error(`DUAL_RESCHEDULE_IDENTITY_INVALID:${field}`);
        error.code = "DUAL_RESCHEDULE_IDENTITY_INVALID";
        throw error;
    }
    return normalized;
}

export const DUAL_RESCHEDULE_STATUS = Object.freeze({
    IN_PROGRESS: "IN_PROGRESS",
    F1_IN_PROGRESS: "F1_IN_PROGRESS",
    F1_DONE: "F1_DONE",
    F2_IN_PROGRESS: "F2_IN_PROGRESS",
    F2_DONE: "F2_DONE",
    COMPENSATING: "COMPENSATING",
    COMPENSATED: "COMPENSATED",
    CMS_PROJECTED: "CMS_PROJECTED",
    COMPLETED: "COMPLETED",
    REPAIR_REQUIRED: "REPAIR_REQUIRED",
});

export function isDualRescheduleTerminalStatus(status) {
    return [
        DUAL_RESCHEDULE_STATUS.COMPENSATED,
        DUAL_RESCHEDULE_STATUS.COMPLETED,
        DUAL_RESCHEDULE_STATUS.REPAIR_REQUIRED,
    ].includes(String(status || "").trim().toUpperCase());
}

/**
 * Stable identity for one intended dual-reschedule operation.
 * traceId is intentionally excluded so transport retries map to the same journal.
 */
export async function buildDualRescheduleJournalIdentity(input = {}) {
    const canonical = {
        schemaVersion: 1,
        pairToken: _required(input.pairToken, "pairToken"),
        operationId: String(input.operationId ?? "").trim(),
        f1BookingId: _required(input.f1BookingId, "f1BookingId"),
        f2BookingId: _required(input.f2BookingId, "f2BookingId"),
        f1ServiceId: _required(input.f1ServiceId, "f1ServiceId"),
        f2ServiceId: _required(input.f2ServiceId, "f2ServiceId"),
        resourceId: _required(input.resourceId, "resourceId"),
        targetF1Start: _required(input.targetF1Start, "targetF1Start"),
        targetF1End: _required(input.targetF1End, "targetF1End"),
        targetF2Start: _required(input.targetF2Start, "targetF2Start"),
        targetF2End: _required(input.targetF2End, "targetF2End"),
    };
    const operationHash = await hashSHA256(JSON.stringify(canonical));
    return {
        operationHash,
        journalId: `DR_${operationHash}`,
        dedupeKey: `DUAL_RESCHEDULE_${operationHash}`,
        canonical,
    };
}
