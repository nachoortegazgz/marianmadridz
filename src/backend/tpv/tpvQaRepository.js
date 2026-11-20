import {
    CONSISTENCY,
    insertItem,
    getItem,
    bulkPatchItems,
    queryItems,
    wql,
} from "backend/dataAccess";
import { TPV_QA_COLLECTIONS, TPV_QA_RUNTIME_POLICY, CONTROL_TYPE, OPERATIONAL_COLLECTIONS } from "backend/internalConfig";
import {
    assertTpvQaEnabled,
    normalizeIdempotencyKey,
    stableSerialize,
    makeSyntheticPayload,
} from "backend/tpv/tpvUtils";

const ALLOWED_QA_COLLECTIONS = new Set(Object.values(TPV_QA_COLLECTIONS));
const REFUND_LOCK_TTL_MS = 300000;

export async function withQaSaleLock(saleId, traceId, operation) {
    assertTpvQaEnabled();
    const cleanSaleId = String(saleId || "").trim();
    if (!cleanSaleId || typeof operation !== "function") throw new Error("TPV_QA_REFUND_LOCK_INVALID");
    const lockId = "TPVQA_REFUND_LOCK_" + cleanSaleId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80);
    const collection = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
    const now = Date.now();
    const expiresAt = new Date(now + REFUND_LOCK_TTL_MS);
    let record = await getItem(collection, lockId, CONSISTENCY.STRONG);
    let heldVersion = 0;

    if (!record) {
        const initial = {
            _id: lockId,
            controlType: CONTROL_TYPE.TPV_QA_REFUND_LOCK,
            dedupeKey: "TPV_QA_REFUND:" + cleanSaleId,
            traceId: String(traceId || ""),
            status: "ACTIVE",
            expiresAt,
            version: 0,
            payload: { saleId: cleanSaleId, environment: TPV_QA_RUNTIME_POLICY.ENVIRONMENT, acquiredAt: new Date(now) },
        };
        try {
            await insertItem(collection, initial);
            heldVersion = 0;
        } catch (error) {
            record = await getItem(collection, lockId, CONSISTENCY.STRONG);
            if (!record) throw error;
        }
    }

    if (record) {
        const currentExpiry = record.expiresAt instanceof Date ? record.expiresAt : new Date(record.expiresAt || 0);
        if (record.status === "ACTIVE" && currentExpiry.getTime() > now) {
            throw new Error("TPV_QA_REFUND_IN_PROGRESS");
        }
        if (!["ACTIVE", "RELEASED"].includes(record.status)) {
            throw new Error("TPV_QA_REFUND_LOCK_INVALID_STATE");
        }
        const version = Number(record.version);
        if (!Number.isInteger(version) || version < 0) throw new Error("TPV_QA_REFUND_LOCK_VERSION_INVALID");
        const condition = {
            controlType: { $eq: CONTROL_TYPE.TPV_QA_REFUND_LOCK },
            version: { $eq: version },
            status: { $eq: record.status },
        };
        if (record.status === "ACTIVE") condition.expiresAt = { $eq: currentExpiry };
        const patched = await bulkPatchItems(collection, [lockId], [[
            { fieldPath: "status", action: "SET_FIELD", value: "ACTIVE" },
            { fieldPath: "expiresAt", action: "SET_FIELD", value: expiresAt },
            { fieldPath: "traceId", action: "SET_FIELD", value: String(traceId || "") },
            { fieldPath: "payload", action: "SET_FIELD", value: { saleId: cleanSaleId, environment: TPV_QA_RUNTIME_POLICY.ENVIRONMENT, acquiredAt: new Date(now) } },
            { fieldPath: "version", action: "INCREMENT_FIELD", value: 1 },
        ]], { condition: { filter: condition } });
        if (!Array.isArray(patched?.updatedItemIds) || !patched.updatedItemIds.includes(lockId)) {
            throw new Error("TPV_QA_REFUND_IN_PROGRESS");
        }
        heldVersion = version + 1;
    }

    try {
        return await operation();
    } finally {
        const latest = await getItem(collection, lockId, CONSISTENCY.STRONG);
        if (!latest || latest.controlType !== CONTROL_TYPE.TPV_QA_REFUND_LOCK ||
            latest.status !== "ACTIVE" || Number(latest.version) !== heldVersion) {
            throw new Error("TPV_QA_REFUND_LOCK_LOST");
        }
        const released = await bulkPatchItems(collection, [lockId], [[
            { fieldPath: "status", action: "SET_FIELD", value: "RELEASED" },
            { fieldPath: "expiresAt", action: "SET_FIELD", value: new Date(0) },
            { fieldPath: "payload", action: "SET_FIELD", value: { saleId: cleanSaleId, environment: TPV_QA_RUNTIME_POLICY.ENVIRONMENT, releasedAt: new Date() } },
            { fieldPath: "version", action: "INCREMENT_FIELD", value: 1 },
        ]], {
            condition: {
                filter: {
                    controlType: { $eq: CONTROL_TYPE.TPV_QA_REFUND_LOCK },
                    status: { $eq: "ACTIVE" },
                    version: { $eq: heldVersion },
                },
            },
        });
        if (!Array.isArray(released?.updatedItemIds) || !released.updatedItemIds.includes(lockId)) {
            throw new Error("TPV_QA_REFUND_LOCK_RELEASE_FAILED");
        }
    }
}

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
    if (result.hasNext && options.allowTruncated !== true) throw new Error("TPV_QA_QUERY_LIMIT_EXCEEDED");
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
