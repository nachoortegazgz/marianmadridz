import { createHash } from "node:crypto";
import {
    CONSISTENCY,
    insertItem,
    getItem,
    bulkPatchItems,
    bulkRemove,
    queryItems,
    wql,
} from "backend/dataAccess";
import { CONTROL_TYPE, OPERATIONAL_COLLECTIONS, TPV_RUNTIME_POLICY } from "backend/internalConfig";
import {
    appendTpvTestEvent,
    createTpvTestRunPayload,
    isValidTpvTestRunPayload,
    tpvTestRunId,
} from "backend/tpv/tpvTestRuntimeCore";

const RUN_COLLECTION = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
const MAX_CAS_ATTEMPTS = 5;
const RUN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function duplicateKey(error) {
    const code = String(error?.code || error?.details?.applicationError?.code || error?.details?.code || "").toUpperCase();
    return code === "DUPLICATE_KEY" || code === "WDE0023" ||
        /DUPLICATE[_ ]KEY|WDE0023|ALREADY EXISTS/i.test(String(error?.message || ""));
}

function assertRunOwner(item, { sessionId, actorId }) {
    if (!item || item.controlType !== CONTROL_TYPE.TPV_TEST_RUN ||
        !isValidTpvTestRunPayload(item.payload, {
            siteId: TPV_RUNTIME_POLICY.SITE_ID,
            sessionId,
            actorId,
        })) {
        throw new Error("TPV_TEST_RUN_NOT_FOUND");
    }
    return item;
}

export async function createTpvTestRun({
    sessionId,
    actorId,
    operatorId,
    operatorDisplayName,
    operatorResourceId,
    openingCashMinor,
    idempotencyKey,
    traceId,
}) {
    const id = tpvTestRunId(sessionId, TPV_RUNTIME_POLICY.SITE_ID);
    const now = new Date();
    const initialPayload = createTpvTestRunPayload({
        sessionId,
        siteId: TPV_RUNTIME_POLICY.SITE_ID,
        actorId,
        operatorId,
        operatorDisplayName,
        operatorResourceId,
        openingCashMinor,
        openedAt: now,
        traceId,
    });
    const opened = appendTpvTestEvent(initialPayload, {
        eventType: "SESSION_OPENED",
        idempotencyKey,
        actorId,
        data: { openingCashMinor },
        occurredAt: now,
    });
    const item = {
        _id: id,
        controlType: CONTROL_TYPE.TPV_TEST_RUN,
        dedupeKey: "TPV_TEST_RUN:" + id,
        traceId: String(traceId || ""),
        status: "OPEN",
        version: 0,
        expiresAt: new Date(now.getTime() + RUN_TTL_MS),
        payload: opened.payload,
    };
    assertRunOwner(item, { sessionId, actorId });
    try {
        await insertItem(RUN_COLLECTION, item);
        const persisted = await getItem(RUN_COLLECTION, id, CONSISTENCY.STRONG);
        assertRunOwner(persisted, { sessionId, actorId });
        return { item: persisted, created: true };
    } catch (error) {
        if (!duplicateKey(error)) throw error;
        const existing = await getItem(RUN_COLLECTION, id, CONSISTENCY.STRONG);
        assertRunOwner(existing, { sessionId, actorId });
        const replay = appendTpvTestEvent(existing.payload, {
            eventType: "SESSION_OPENED",
            idempotencyKey,
            actorId,
            data: { openingCashMinor },
            occurredAt: existing.payload.openedAt,
        });
        if (!replay.replayed) throw new Error("TPV_IDEMPOTENCY_CONFLICT");
        return { item: existing, created: false };
    }
}

export async function getTpvTestRun(sessionId, actorId) {
    const cleanSessionId = String(sessionId || "").trim();
    if (!cleanSessionId || !actorId) throw new Error("TPV_SESSION_REQUIRED");
    const id = tpvTestRunId(cleanSessionId, TPV_RUNTIME_POLICY.SITE_ID);
    const item = await getItem(RUN_COLLECTION, id, CONSISTENCY.STRONG);
    return assertRunOwner(item, { sessionId: cleanSessionId, actorId });
}

export async function getLatestTpvTestRun(actorId, { openOnly = false } = {}) {
    if (!actorId) throw new Error("TPV_TEST_RUN_ACTOR_REQUIRED");
    const result = await queryItems({
        dataCollectionId: RUN_COLLECTION,
        filter: wql.eq("controlType", CONTROL_TYPE.TPV_TEST_RUN),
        sort: ["_createdDate DESC"],
        limit: 1000,
        consistency: CONSISTENCY.STRONG,
    });
    if (result.hasNext) throw new Error("TPV_TEST_RUN_QUERY_LIMIT_EXCEEDED");
    const now = Date.now();
    const matches = result.items
        .filter((item) => item.controlType === CONTROL_TYPE.TPV_TEST_RUN &&
            item.payload?.siteId === TPV_RUNTIME_POLICY.SITE_ID &&
            item.payload?.actorId === actorId &&
            item.payload?.sourceType === "SYNTHETIC" &&
            item.payload?.processingMode === "INTERNAL" &&
            item.payload?.realPayment === false &&
            item.payload?.externalSideEffects === false)
        .filter((item) => openOnly
            ? item.status === "OPEN" && new Date(item.payload.activeUntil || 0).getTime() > now
            : true)
        .sort((a, b) => new Date(b._createdDate || 0).getTime() - new Date(a._createdDate || 0).getTime());
    if (matches.length > 1 && openOnly) throw new Error("TPV_TEST_MULTIPLE_OPEN_RUNS");
    const item = matches[0] || null;
    if (item) assertRunOwner(item, {
        sessionId: item.payload.sessionId,
        actorId,
    });
    return item;
}

export async function appendTpvTestRunEvent({
    sessionId,
    actorId,
    eventType,
    idempotencyKey,
    data,
    buildData,
    requestFingerprint,
    traceId,
    closeRun = false,
}) {
    if (typeof buildData === "function" &&
        !/^[a-f0-9]{64}$/i.test(String(requestFingerprint || ""))) {
        throw new Error("TPV_TEST_REQUEST_FINGERPRINT_REQUIRED");
    }
    for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
        const current = await getTpvTestRun(sessionId, actorId);
        const claim = current.payload.idempotencyIndex?.[idempotencyKey];
        if (claim && buildData) {
            const prior = current.payload.events.find((event) => event.sequence === claim.sequence);
            if (!prior || prior.eventType !== eventType ||
                prior.data?.requestFingerprint !== requestFingerprint) {
                throw new Error("TPV_IDEMPOTENCY_CONFLICT");
            }
            return { item: current, event: prior, replayed: true };
        }
        if (claim) {
            const replay = appendTpvTestEvent(current.payload, {
                eventType,
                idempotencyKey,
                actorId,
                data,
            });
            if (replay.replayed) return { item: current, event: replay.event, replayed: true };
        }
        if (current.status !== "OPEN") throw new Error("TPV_SESSION_CLOSED");
        const eventData = typeof buildData === "function" ? buildData(current.payload) : data;
        const appended = appendTpvTestEvent(current.payload, {
            eventType,
            idempotencyKey,
            actorId,
            data: eventData,
        });
        if (appended.replayed) {
            return { item: current, event: appended.event, replayed: true };
        }
        if (new Date(current.payload.activeUntil || 0).getTime() <= Date.now()) {
            throw new Error("TPV_TEST_RUN_EXPIRED");
        }
        const condition = {
            controlType: { $eq: CONTROL_TYPE.TPV_TEST_RUN },
            version: { $eq: Number(current.version) },
            status: { $eq: "OPEN" },
        };
        const modifications = [
            { fieldPath: "payload", action: "SET_FIELD", value: appended.payload },
            { fieldPath: "version", action: "INCREMENT_FIELD", value: 1 },
        ];
        if (closeRun) modifications.push({ fieldPath: "status", action: "SET_FIELD", value: "CLOSED" });
        const result = await bulkPatchItems(
            RUN_COLLECTION,
            [current._id],
            modifications,
            { condition: { filter: condition } }
        );
        if (Array.isArray(result?.updatedItemIds) && result.updatedItemIds.includes(current._id)) {
            const updated = await getItem(RUN_COLLECTION, current._id, CONSISTENCY.STRONG);
            assertRunOwner(updated, { sessionId, actorId });
            if (Number(updated.version) < Number(current.version) + 1 ||
                !updated.payload.events.some((entry) => entry.eventHash === appended.event.eventHash) ||
                (closeRun && updated.status !== "CLOSED")) {
                throw new Error("TPV_TEST_RUNTIME_POST_WRITE_INTEGRITY_FAILED");
            }
            return { item: updated, event: appended.event, replayed: false };
        }
    }
    throw new Error("TPV_TEST_RUNTIME_CONCURRENT_RETRY_REQUIRED");
}

export async function purgeExpiredTpvTestRuns(now = new Date()) {
    const result = await queryItems({
        dataCollectionId: RUN_COLLECTION,
        filter: wql.eq("controlType", CONTROL_TYPE.TPV_TEST_RUN),
        limit: 1000,
        consistency: CONSISTENCY.STRONG,
    });
    if (result.hasNext) throw new Error("TPV_TEST_RUN_PURGE_QUERY_LIMIT_EXCEEDED");
    const expiredIds = result.items
        .filter((item) => item.controlType === CONTROL_TYPE.TPV_TEST_RUN &&
            new Date(item.expiresAt || 0).getTime() < now.getTime())
        .map((item) => item._id)
        .filter(Boolean);
    if (expiredIds.length === 0) return { removed: 0 };
    const removal = await bulkRemove(RUN_COLLECTION, expiredIds, {
        condition: {
            filter: {
                controlType: { $eq: CONTROL_TYPE.TPV_TEST_RUN },
                expiresAt: { $lt: now },
            },
        },
    });
    return { removed: Array.isArray(removal?.removedItemIds) ? removal.removedItemIds.length : null };
}
