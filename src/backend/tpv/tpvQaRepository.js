import {
    CONSISTENCY,
    insertItem,
    queryItems,
    wql,
} from "backend/dataAccess";
import { TPV_QA_COLLECTIONS } from "backend/internalConfig";
import {
    assertTpvQaEnabled,
    normalizeIdempotencyKey,
    stableSerialize,
    makeSyntheticPayload,
} from "backend/tpv/tpvUtils";

const ALLOWED_QA_COLLECTIONS = new Set(Object.values(TPV_QA_COLLECTIONS));
const VOLATILE_FIELDS = new Set([
    "traceId", "createdAt", "openedAt", "closedAt", "occurredAt",
    "generatedAt", "confirmedAt", "recordTimestamp",
]);

function stripVolatile(value) {
    if (Array.isArray(value)) return value.map(stripVolatile);
    if (!value || typeof value !== "object" || value instanceof Date) return value;
    const result = {};
    for (const [key, nested] of Object.entries(value)) {
        if (VOLATILE_FIELDS.has(key) || key === "requestFingerprint") continue;
        result[key] = stripVolatile(nested);
    }
    return result;
}

function fingerprintOf(record) {
    const stable = {};
    for (const [key, value] of Object.entries(record || {})) {
        if (key === "idempotencyKey" || key === "payload" || VOLATILE_FIELDS.has(key)) continue;
        stable[key] = stripVolatile(value);
    }
    return stableSerialize({
        record: stable,
        payload: stripVolatile(record?.payload || {}),
    });
}

async function findByIdempotencyKey(collection, key) {
    const result = await queryItems({
        dataCollectionId: collection,
        filter: wql.eq("idempotencyKey", key),
        limit: 2,
        consistency: CONSISTENCY.STRONG,
    });
    if (result.items.length > 1) throw new Error("TPV_QA_IDEMPOTENCY_INDEX_VIOLATION");
    return result.items[0] || null;
}

function assertSameRequest(existing, fingerprint) {
    if (existing?.payload?.requestFingerprint !== fingerprint) {
        throw new Error("TPV_QA_IDEMPOTENCY_CONFLICT");
    }
    return { item: existing, replayed: true };
}

export async function insertQaEvent(collection, idempotencyKey, data) {
    assertTpvQaEnabled();
    if (!ALLOWED_QA_COLLECTIONS.has(collection)) {
        throw new Error("TPV_QA_COLLECTION_NOT_ALLOWED");
    }
    const key = normalizeIdempotencyKey(idempotencyKey);
    const record = { ...data };
    const fingerprint = fingerprintOf(record);
    const existing = await findByIdempotencyKey(collection, key);
    if (existing) return assertSameRequest(existing, fingerprint);

    record.idempotencyKey = key;
    record.payload = makeSyntheticPayload({
        ...(record.payload && typeof record.payload === "object" ? record.payload : {}),
        requestFingerprint: fingerprint,
    });

    try {
        const item = await insertItem(collection, record);
        return { item, replayed: false };
    } catch (error) {
        // A concurrent request may have won the unique CMS index race.
        const winner = await findByIdempotencyKey(collection, key);
        if (winner) return assertSameRequest(winner, fingerprint);
        throw error;
    }
}

export async function queryQaRecords(collection, filter, options = {}) {
    assertTpvQaEnabled();
    if (!ALLOWED_QA_COLLECTIONS.has(collection)) {
        throw new Error("TPV_QA_COLLECTION_NOT_ALLOWED");
    }
    const limit = Number(options.limit || 1000);
    const result = await queryItems({
        dataCollectionId: collection,
        filter,
        sort: options.sort || ["_createdDate ASC"],
        limit,
        consistency: CONSISTENCY.STRONG,
    });
    if (result.hasNext) throw new Error("TPV_QA_QUERY_LIMIT_EXCEEDED");
    return result.items;
}

export async function appendQaAudit({
    idempotencyKey,
    action,
    actorId,
    entityType,
    entityId,
    traceId,
    payload = {},
}) {
    const { item, replayed } = await insertQaEvent(
        TPV_QA_COLLECTIONS.AUDITORIA,
        idempotencyKey,
        {
            action: String(action || "UNKNOWN").slice(0, 80),
            actorId: String(actorId || "UNKNOWN").slice(0, 100),
            entityType: String(entityType || "TPV").slice(0, 80),
            entityId: String(entityId || "").slice(0, 120),
            occurredAt: new Date(),
            source: "TPV_QA_WEB_METHOD",
            payload: { ...payload, traceId: String(traceId || "") },
        }
    );
    return { item, replayed };
}

export async function latestOpenQaSession() {
    const sessions = await queryQaRecords(
        TPV_QA_COLLECTIONS.SESIONES_CAJA,
        undefined,
        { sort: ["_createdDate DESC"], limit: 1000 }
    );
    const closures = await queryQaRecords(TPV_QA_COLLECTIONS.TICKET_Z, undefined);
    const closedSessionIds = new Set(closures.filter((item) => item.closed === true).map((item) => item.sessionId));
    return sessions.find((session) =>
        session.status === "ABIERTA" && !closedSessionIds.has(session.sessionId)
    ) || null;
}

export async function getQaSessionEvents(sessionId) {
    return queryQaRecords(
        TPV_QA_COLLECTIONS.SESIONES_CAJA,
        wql.eq("sessionId", sessionId),
        { sort: ["_createdDate ASC"], limit: 1000 }
    );
}

export async function getCommittedQaSales(sessionId) {
    const records = await queryQaRecords(TPV_QA_COLLECTIONS.VENTAS, undefined);
    return records.filter((item) =>
        item.status === "CONFIRMADA_SINTETICA" &&
        item.payload?.sessionId === sessionId
    );
}

export async function getQaPayments(sessionId) {
    const records = await queryQaRecords(TPV_QA_COLLECTIONS.PAGOS, undefined);
    return records.filter((item) => item.payload?.sessionId === sessionId);
}

export async function getQaRefunds(sessionId) {
    const records = await queryQaRecords(TPV_QA_COLLECTIONS.REEMBOLSOS, undefined);
    return records.filter((item) =>
        item.status === "CONFIRMADO_SINTETICO" &&
        item.payload?.sessionId === sessionId
    );
}

export async function getQaCashMovements(sessionId) {
    return queryQaRecords(
        TPV_QA_COLLECTIONS.MOVIMIENTOS_CAJA,
        wql.eq("sessionId", sessionId)
    );
}
