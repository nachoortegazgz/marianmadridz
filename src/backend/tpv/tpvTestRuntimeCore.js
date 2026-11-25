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

export function hashTpvTestValue(value) {
    return createHash("sha256").update(stableTpvTestSerialize(value), "utf8").digest("hex");
}

export function tpvTestRunId(sessionId, siteId) {
    const session = String(sessionId || "").trim();
    const site = String(siteId || "").trim();
    if (!session || !site) throw new Error("TPV_TEST_RUN_IDENTITY_REQUIRED");
    return "TPVTR" + createHash("sha256").update(site + ":" + session, "utf8").digest("hex").slice(0, 31);
}

export function createTpvTestRunPayload({ sessionId, siteId, actorId, operatorId, operatorDisplayName, operatorResourceId, openingCashMinor, openedAt, traceId }) {
    if (!sessionId || !siteId || !actorId || !operatorId) throw new Error("TPV_TEST_RUN_CONTEXT_REQUIRED");
    if (!Number.isSafeInteger(openingCashMinor) || openingCashMinor < 0) throw new Error("TPV_TEST_OPENING_CASH_INVALID");
    return {
        sourceType: "SYNTHETIC",
        processingMode: "INTERNAL",
        reconciliationStatus: "NOT_RECONCILED",
        isSynthetic: true,
        realPayment: false,
        externalSideEffects: false,
        siteId,
        sessionId,
        schemaVersion: 1,
        ledgerVersion: "TPV_TEST_RUNTIME_V1",
        actorId,
        operatorId,
        operatorDisplayName: operatorDisplayName || null,
        operatorResourceId: operatorResourceId || null,
        currency: "EUR",
        openedAt: openedAt instanceof Date ? openedAt.toISOString() : new Date(openedAt).toISOString(),
        activeUntil: new Date(new Date(openedAt).getTime() + 12 * 60 * 60 * 1000).toISOString(),
        openingCashMinor,
        events: [],
        idempotencyIndex: {},
        eventHash: TPV_TEST_GENESIS_HASH,
        traceId: String(traceId || ""),
    };
}

export function appendTpvTestEvent(payload, { eventType, idempotencyKey, actorId, data, occurredAt = new Date() }) {
    if (!payload || payload.sourceType !== "SYNTHETIC" ||
        payload.processingMode !== "INTERNAL" ||
        payload.reconciliationStatus !== "NOT_RECONCILED" ||
        payload.realPayment !== false || payload.externalSideEffects !== false) {
        throw new Error("TPV_TEST_RUN_ENVELOPE_INVALID");
    }
    const key = String(idempotencyKey || "").trim();
    const type = String(eventType || "").trim().toUpperCase();
    if (!key || key.length > 100 || !type || !actorId) throw new Error("TPV_TEST_EVENT_IDENTITY_REQUIRED");

    const requestFingerprint = hashTpvTestValue({ eventType: type, actorId, data });
    const existing = payload.idempotencyIndex?.[key];
    if (existing) {
        if (existing.requestFingerprint !== requestFingerprint) throw new Error("TPV_IDEMPOTENCY_CONFLICT");
        const prior = payload.events?.find((event) => event.sequence === existing.sequence);
        if (!prior) throw new Error("TPV_TEST_IDEMPOTENCY_INDEX_CORRUPT");
        return { payload, event: prior, replayed: true };
    }

    const events = Array.isArray(payload.events) ? payload.events : [];
    if (events.length >= 100) throw new Error("TPV_TEST_EVENT_LIMIT_EXCEEDED");
    const sequence = events.length + 1;
    const previousEventHash = String(payload.eventHash || TPV_TEST_GENESIS_HASH);
    const timestamp = occurredAt instanceof Date ? occurredAt.toISOString() : new Date(occurredAt).toISOString();
    const eventBody = {
        sequence,
        eventType: type,
        idempotencyKey: key,
        requestFingerprint,
        actorId,
        occurredAt: timestamp,
        previousEventHash,
        data: data && typeof data === "object" && !Array.isArray(data) ? data : {},
    };
    const eventHash = createHash("sha256")
        .update(previousEventHash + ":" + stableTpvTestSerialize(eventBody), "utf8")
        .digest("hex");
    const event = Object.freeze({ ...eventBody, eventHash });
    const idempotencyIndex = {
        ...(payload.idempotencyIndex || {}),
        [key]: { requestFingerprint, sequence, eventType: type },
    };
    const nextPayload = {
        ...payload,
        events: [...events, event],
        idempotencyIndex,
        eventHash,
        lastEventAt: timestamp,
        traceId: String(payload.traceId || ""),
    };
    if (stableTpvTestSerialize(nextPayload).length > 250000) {
        throw new Error("TPV_TEST_RUN_PAYLOAD_LIMIT_EXCEEDED");
    }
    return { payload: nextPayload, event, replayed: false };
}

function safeMinor(value) {
    const number = Number(value);
    return Number.isSafeInteger(number) ? number : 0;
}

export function summarizeTpvTestRun(payload) {
    const events = Array.isArray(payload?.events) ? payload.events : [];
    const totals = {
        openingCashMinor: safeMinor(payload?.openingCashMinor),
        grossSalesMinor: 0,
        refundsMinor: 0,
        cashMinor: 0,
        cardMinor: 0,
        bizumMinor: 0,
        otherMinor: 0,
        cashInMinor: 0,
        cashOutMinor: 0,
        expectedCashMinor: 0,
        countedCashMinor: null,
        differenceMinor: null,
        ticketCount: 0,
        refundCount: 0,
    };

    for (const event of events) {
        const data = event.data || {};
        if (event.eventType === "SALE_RECORDED") {
            totals.ticketCount += 1;
            totals.grossSalesMinor += safeMinor(data.totalMinor);
            for (const payment of (Array.isArray(data.payments) ? data.payments : [])) {
                const amount = safeMinor(payment.amountAppliedMinor);
                if (payment.method === "EFECTIVO") totals.cashMinor += amount;
                else if (payment.method === "TARJETA") totals.cardMinor += amount;
                else if (payment.method === "BIZUM") totals.bizumMinor += amount;
                else totals.otherMinor += amount;
            }
        } else if (event.eventType === "REFUND_RECORDED") {
            totals.refundCount += 1;
            totals.refundsMinor += safeMinor(data.totalMinor);
            for (const payment of (Array.isArray(data.payments) ? data.payments : [])) {
                const amount = safeMinor(payment.amountMinor);
                if (payment.method === "EFECTIVO") totals.cashMinor -= amount;
                else if (payment.method === "TARJETA") totals.cardMinor -= amount;
                else if (payment.method === "BIZUM") totals.bizumMinor -= amount;
                else totals.otherMinor -= amount;
            }
        } else if (event.eventType === "CASH_MOVEMENT") {
            if (data.movementType === "ENTRADA") totals.cashInMinor += safeMinor(data.amountMinor);
            if (["SALIDA", "RETIRADA"].includes(data.movementType)) totals.cashOutMinor += safeMinor(data.amountMinor);
        } else if (event.eventType === "PARTIAL_CASH_COUNT") {
            totals.countedCashMinor = safeMinor(data.countedCashMinor);
        } else if (event.eventType === "TICKET_Z_CLOSED") {
            totals.countedCashMinor = safeMinor(data.countedCashMinor);
        }
    }

    totals.expectedCashMinor = totals.openingCashMinor + totals.cashMinor + totals.cashInMinor - totals.cashOutMinor;
    if (totals.countedCashMinor !== null) totals.differenceMinor = totals.countedCashMinor - totals.expectedCashMinor;
    totals.netSalesMinor = totals.grossSalesMinor - totals.refundsMinor;
    totals.totalCollectedMinor = totals.netSalesMinor;
    totals.reconciliationOk = totals.expectedCashMinor >= 0 &&
        totals.cardMinor >= 0 && totals.bizumMinor >= 0 && totals.otherMinor >= 0 &&
        (totals.countedCashMinor === null || totals.differenceMinor === 0);
    return totals;
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
        Number.isFinite(new Date(payload.activeUntil || 0).getTime()))) return false;

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
