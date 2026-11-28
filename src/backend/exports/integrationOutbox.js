import {
    BUSINESS_COLLECTIONS,
} from "backend/internalConfig";
import {
    CONSISTENCY,
    getItem,
    insertItem,
    order,
    queryItems,
    wql,
} from "backend/dataAccess";
import { hashSHA256 } from "backend/securityEngine";

const COLLECTION = BUSINESS_COLLECTIONS.REGISTRO_INTEGRACION;
const EVENT_TYPE = "C3_PACKAGE_PREPARED";
const ALLOWED_PAYLOAD_KEYS = Object.freeze([
    "exportId",
    "artifactId",
    "fileName",
    "contentChecksum",
    "year",
    "quarter",
    "recordCount",
    "dataClassification",
    "artifactPurpose",
    "legalUseStatus",
    "reconciliationStatus",
    "sharePointItemId",
    "webUrl",
    "responseStatus",
]);

function stableJson(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
    return "{" + Object.keys(value).sort().map((key) =>
        JSON.stringify(key) + ":" + stableJson(value[key])
    ).join(",") + "}";
}

function uuidV8FromHash(hash) {
    const value = String(hash || "").toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(value)) {
        throw Object.assign(new Error("C3_OUTBOX_HASH_INVALID"), { code: "C3_OUTBOX_HASH_INVALID" });
    }
    const variant = ((parseInt(value[16], 16) & 0x03) | 0x08).toString(16);
    return value.slice(0, 8) + "-" + value.slice(8, 12) + "-8" +
        value.slice(13, 16) + "-" + variant + value.slice(17, 20) + "-" + value.slice(20, 32);
}

function safeEvent(item) {
    return {
        eventId: item.eventId,
        eventType: item.eventType,
        occurredAt: item.occurredAt,
        traceId: item.traceId,
        correlationId: item.correlationId,
        deliveryStatus: item.deliveryStatus,
        deliveryAttempts: item.deliveryAttempts,
        payload: item.payload,
        payloadHash: item.payloadHash,
    };
}

/**
 * Appends a deterministic Capa 3 outbox event. The deterministic Wix Data
 * _id is the uniqueness boundary: concurrent retries can only create one
 * event. Existing QA legacy rows are never read as C3 events or modified.
 */
export async function appendC3PreparedEvent({ manifest, traceId } = {}) {
    if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
        throw Object.assign(new Error("C3_OUTBOX_MANIFEST_REQUIRED"), { code: "C3_OUTBOX_MANIFEST_REQUIRED" });
    }
    const required = ["exportId", "artifactId", "contentChecksum", "period", "recordCount"];
    if (required.some((key) => manifest[key] === null || manifest[key] === undefined || manifest[key] === "")) {
        throw Object.assign(new Error("C3_OUTBOX_MANIFEST_INCOMPLETE"), { code: "C3_OUTBOX_MANIFEST_INCOMPLETE" });
    }
    const normalizedTraceId = String(traceId || manifest.traceId || "").trim();
    if (!normalizedTraceId) {
        throw Object.assign(new Error("C3_OUTBOX_TRACE_ID_REQUIRED"), { code: "C3_OUTBOX_TRACE_ID_REQUIRED" });
    }

    const year = Number(manifest.period.year);
    const quarter = Number(manifest.period.quarter);
    const recordCount = Number(manifest.recordCount);
    if (!Number.isInteger(year) || year < 2000 || year > 2100 ||
        !Number.isInteger(quarter) || quarter < 1 || quarter > 4 ||
        !Number.isSafeInteger(recordCount) || recordCount < 0) {
        throw Object.assign(new Error("C3_OUTBOX_PERIOD_INVALID"), { code: "C3_OUTBOX_PERIOD_INVALID" });
    }

    const payload = {
        exportId: String(manifest.exportId),
        artifactId: String(manifest.artifactId),
        fileName: String(manifest.exportId) + "-" + String(manifest.artifactId).slice(0, 12) + ".json",
        contentChecksum: String(manifest.contentChecksum),
        year,
        quarter,
        recordCount,
        dataClassification: String(manifest.dataClassification || ""),
        artifactPurpose: String(manifest.artifactPurpose || ""),
        legalUseStatus: String(manifest.legalUseStatus || ""),
        reconciliationStatus: String(manifest.reconciliationStatus || ""),
    };
    if (Object.keys(payload).some((key) => !ALLOWED_PAYLOAD_KEYS.includes(key))) {
        throw Object.assign(new Error("C3_OUTBOX_PAYLOAD_KEY_INVALID"), { code: "C3_OUTBOX_PAYLOAD_KEY_INVALID" });
    }

    const payloadHash = await hashSHA256(stableJson(payload));
    const idempotencyKey = EVENT_TYPE + ":" + payload.artifactId;
    const eventId = await hashSHA256(idempotencyKey);
    const item = {
        _id: uuidV8FromHash(eventId),
        eventId,
        eventType: EVENT_TYPE,
        sourceModule: "C3_EXPORT",
        sourceCollection: "WIX_CMS",
        sourceItemId: payload.artifactId,
        occurredAt: new Date(),
        traceId: normalizedTraceId,
        correlationId: payload.artifactId,
        idempotencyKey,
        schemaVersion: "1",
        payload,
        payloadHash,
        deliveryStatus: "PENDING",
        deliveryAttempts: 0,
    };

    try {
        const inserted = await insertItem(COLLECTION, item);
        return {
            created: true,
            event: safeEvent(inserted || item),
        };
    } catch (insertError) {
        const existing = await getItem(COLLECTION, item._id, CONSISTENCY.STRONG);
        if (!existing) throw insertError;
        if (existing.eventId !== eventId ||
            existing.idempotencyKey !== idempotencyKey ||
            existing.payloadHash !== payloadHash) {
            throw Object.assign(new Error("C3_OUTBOX_IDEMPOTENCY_CONFLICT"), {
                code: "C3_OUTBOX_IDEMPOTENCY_CONFLICT",
            });
        }
        return {
            created: false,
            duplicate: true,
            event: safeEvent(existing),
        };
    }
}

export async function listC3IntegrationEvents(limit = 25) {
    const boundedLimit = Number(limit);
    if (!Number.isSafeInteger(boundedLimit) || boundedLimit < 1 || boundedLimit > 100) {
        throw Object.assign(new Error("C3_OUTBOX_LIMIT_INVALID"), { code: "C3_OUTBOX_LIMIT_INVALID" });
    }
    const result = await queryItems({
        dataCollectionId: COLLECTION,
        filter: wql.startsWith("eventType", "C3_"),
        sort: order.desc("occurredAt"),
        limit: boundedLimit,
        offset: 0,
        consistency: CONSISTENCY.STRONG,
    });
    return {
        items: result.items.map(safeEvent),
        totalCount: result.totalCount,
    };
}


/** Returns the immutable preparation/verification events for one artifact. */
export async function getC3ArtifactEvents(artifactId) {
    const normalized = String(artifactId || "").trim();
    if (!/^[a-f0-9]{64}$/.test(normalized)) {
        throw Object.assign(new Error("C3_OUTBOX_ARTIFACT_ID_INVALID"), { code: "C3_OUTBOX_ARTIFACT_ID_INVALID" });
    }
    const result = await queryItems({
        dataCollectionId: COLLECTION,
        filter: wql.eq("sourceItemId", normalized),
        sort: order.desc("occurredAt"),
        limit: 10,
        offset: 0,
        consistency: CONSISTENCY.STRONG,
    });
    const prepared = result.items.find((item) => item.eventType === EVENT_TYPE) || null;
    const verified = result.items.find((item) => item.eventType === "C3_PACKAGE_VERIFIED") || null;
    return {
        prepared: prepared ? safeEvent(prepared) : null,
        verified: verified ? safeEvent(verified) : null,
    };
}

/** Appends the SharePoint read-back result; the prepared event is never updated. */
export async function appendC3VerifiedEvent({ manifest, delivery, traceId } = {}) {
    if (!manifest || !delivery || typeof delivery !== "object") {
        throw Object.assign(new Error("C3_OUTBOX_DELIVERY_REQUIRED"), { code: "C3_OUTBOX_DELIVERY_REQUIRED" });
    }
    const artifactId = String(manifest.artifactId || "");
    const contentChecksum = String(manifest.contentChecksum || "");
    if (!/^[a-f0-9]{64}$/.test(artifactId) || !/^[a-f0-9]{64}$/.test(contentChecksum) ||
        String(delivery.contentChecksum || "") !== contentChecksum ||
        !String(delivery.itemId || "").trim()) {
        throw Object.assign(new Error("C3_OUTBOX_DELIVERY_INVALID"), { code: "C3_OUTBOX_DELIVERY_INVALID" });
    }
    const payload = {
        exportId: String(manifest.exportId),
        artifactId,
        fileName: String(delivery.fileName),
        contentChecksum,
        year: Number(manifest.period.year),
        quarter: Number(manifest.period.quarter),
        recordCount: Number(manifest.recordCount),
        dataClassification: String(manifest.dataClassification || ""),
        artifactPurpose: String(manifest.artifactPurpose || ""),
        legalUseStatus: String(manifest.legalUseStatus || ""),
        reconciliationStatus: String(manifest.reconciliationStatus || ""),
        sharePointItemId: String(delivery.itemId),
        ...(delivery.webUrl ? { webUrl: String(delivery.webUrl) } : {}),
        responseStatus: Number(delivery.responseStatus),
    };
    const payloadHash = await hashSHA256(stableJson(payload));
    const idempotencyKey = "C3_PACKAGE_VERIFIED:" + artifactId;
    const eventId = await hashSHA256(idempotencyKey);
    const normalizedTraceId = String(traceId || manifest.traceId || "").trim();
    if (!normalizedTraceId) throw Object.assign(new Error("C3_OUTBOX_TRACE_ID_REQUIRED"), { code: "C3_OUTBOX_TRACE_ID_REQUIRED" });
    const item = {
        _id: uuidV8FromHash(eventId),
        eventId,
        eventType: "C3_PACKAGE_VERIFIED",
        sourceModule: "C3_SHAREPOINT",
        sourceCollection: "WIX_CMS",
        sourceItemId: artifactId,
        occurredAt: new Date(),
        traceId: normalizedTraceId,
        correlationId: artifactId,
        idempotencyKey,
        schemaVersion: "1",
        payload,
        payloadHash,
        deliveryStatus: "VERIFIED",
        deliveryAttempts: 1,
    };
    try {
        const inserted = await insertItem(COLLECTION, item);
        return { created: true, event: safeEvent(inserted || item) };
    } catch (insertError) {
        const existing = await getItem(COLLECTION, item._id, CONSISTENCY.STRONG);
        if (!existing) throw insertError;
        if (existing.eventId !== eventId || existing.idempotencyKey !== idempotencyKey ||
            existing.payloadHash !== payloadHash) {
            throw Object.assign(new Error("C3_OUTBOX_IDEMPOTENCY_CONFLICT"), { code: "C3_OUTBOX_IDEMPOTENCY_CONFLICT" });
        }
        return { created: false, duplicate: true, event: safeEvent(existing) };
    }
}
