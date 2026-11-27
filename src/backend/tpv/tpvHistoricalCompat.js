// Read-only compatibility helpers for previously persisted TPV_TEST_RUN records.
import { createHash } from "node:crypto";
export const TPV_TEST_GENESIS_HASH = "0".repeat(64);

export function stableTpvTestSerialize(value) {
    if (value instanceof Date) return JSON.stringify(value.toISOString());
    if (Array.isArray(value)) return "[" + value.map(stableTpvTestSerialize).join(",") + "]";
    if (value && typeof value === "object") {
        return "{" + Object.keys(value).sort()
            .filter((key) => value[key] !== undefined)
            .map((key) => JSON.stringify(key) + ":" + stableTpvTestSerialize(value[key]))
            .join(",") + "}";
    }
    return JSON.stringify(value);
}

export function isValidTpvTestRunPayload(payload, { siteId, sessionId, actorId }) {
    if (!(payload && payload.sourceType === "SYNTHETIC" &&
        payload.processingMode === "INTERNAL" &&
        payload.reconciliationStatus === "NOT_RECONCILED" &&
        payload.isSynthetic === true &&
        payload.realPayment === false &&
        payload.externalSideEffects === false &&
        payload.siteId === siteId &&
        payload.sessionId === sessionId &&
        payload.actorId === actorId &&
        payload.schemaVersion === 1 &&
        payload.ledgerVersion === "TPV_TEST_RUNTIME_V1" &&
        Array.isArray(payload.events) &&
        payload.events.length <= 100 &&
        payload.idempotencyIndex && typeof payload.idempotencyIndex === "object" &&
        !Array.isArray(payload.idempotencyIndex) &&
        Object.keys(payload.idempotencyIndex).length === payload.events.length &&
        typeof payload.activeUntil === "string" &&
        Number.isFinite(Date.parse(payload.activeUntil)) &&
        Number.isFinite(Date.parse(payload.openedAt)) &&
        Date.parse(payload.activeUntil) > Date.parse(payload.openedAt))) return false;

    let previousHash = TPV_TEST_GENESIS_HASH;
    for (let index = 0; index < payload.events.length; index += 1) {
        const event = payload.events[index];
        if (!event || typeof event.eventType !== "string" || !event.eventType.trim() ||
            !event.data || typeof event.data !== "object" || Array.isArray(event.data) ||
            event.sequence !== index + 1 ||
            event.actorId !== actorId ||
            event.previousEventHash !== previousHash ||
            !/^[a-f0-9]{64}$/i.test(String(event.requestFingerprint || "")) ||
            !/^[a-f0-9]{64}$/i.test(String(event.eventHash || ""))) return false;
        const eventBody = {
            sequence: event.sequence,
            eventType: event.eventType,
            idempotencyKey: event.idempotencyKey,
            requestFingerprint: event.requestFingerprint,
            actorId: event.actorId,
            occurredAt: event.occurredAt,
            previousEventHash: event.previousEventHash,
            data: event.data,
        };
        const expectedHash = createHash("sha256")
            .update(previousHash + ":" + stableTpvTestSerialize(eventBody), "utf8")
            .digest("hex");
        if (expectedHash !== event.eventHash) return false;
        const indexEntry = payload.idempotencyIndex[event.idempotencyKey];
        if (indexEntry?.sequence !== event.sequence ||
            indexEntry?.requestFingerprint !== event.requestFingerprint) return false;
        previousHash = event.eventHash;
    }
    return payload.eventHash === previousHash;
}
