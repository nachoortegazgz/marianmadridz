import { createHash } from "node:crypto";
import {
    CONSISTENCY,
    insertItem,
    getItem,
    updateItem,
    bulkPatchItems,
    queryItems,
    wql,
} from "backend/dataAccess";
import { TPV_SANDBOX_COLLECTIONS, TPV_SANDBOX_EVENT_MOVEMENT_TYPES, TPV_SANDBOX_RUNTIME_POLICY, TPV_SANDBOX_IDENTITY_TYPES, CONTROL_TYPE, OPERATIONAL_COLLECTIONS, BUSINESS_COLLECTIONS, SINGLETONS } from "backend/internalConfig";
import { listTpvSandboxIdentities } from "backend/tpv/tpvSandboxIdentities";
import {

    assertSandboxCajaWritable,
    normalizeIdempotencyKey,
    stableSerialize,
    makeSyntheticPayload,
    makeSandboxRefundLockId,
    makeSandboxSessionLockId,
    makeSandboxTransactionId,
    makeLegacySandboxTransactionId,
} from "backend/tpv/tpvUtils";

const ALLOWED_SANDBOX_COLLECTIONS = new Set(Object.values(TPV_SANDBOX_COLLECTIONS));
const REFUND_LOCK_TTL_MS = 300000;

async function withSandboxScopedLock({
    lockId,
    controlType,
    dedupePrefix,
    scopeField,
    scopeId,
    traceId,
    operation,
    errorPrefix,
}) {

    await _ensureCajaActualForSandbox();
    const cleanScopeId = String(scopeId || "").trim();
    if (!cleanScopeId || typeof operation !== "function") throw new Error(errorPrefix + "_INVALID");
    const collection = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
    const now = Date.now();
    const expiresAt = new Date(now + REFUND_LOCK_TTL_MS);
    let record = await getItem(collection, lockId, CONSISTENCY.STRONG);
    let heldVersion = 0;

    if (!record) {
        const initial = {
            _id: lockId,
            controlType,
            dedupeKey: dedupePrefix + lockId.slice(4),
            traceId: String(traceId || ""),
            status: "ACTIVE",
            expiresAt,
            version: 0,
            payload: {
                [scopeField]: cleanScopeId,
                environment: TPV_SANDBOX_RUNTIME_POLICY.ENVIRONMENT,
                acquiredAt: new Date(now),
            },
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
        if (record.controlType !== controlType || record.payload?.[scopeField] !== cleanScopeId) {
            throw new Error(errorPrefix + "_ID_COLLISION");
        }
        const currentExpiry = record.expiresAt instanceof Date ? record.expiresAt : new Date(record.expiresAt || 0);
        if (record.status === "ACTIVE" && currentExpiry.getTime() > now) {
            throw new Error(errorPrefix + "_IN_PROGRESS");
        }
        if (!["ACTIVE", "RELEASED"].includes(record.status)) {
            throw new Error(errorPrefix + "_LOCK_INVALID_STATE");
        }
        const version = Number(record.version);
        if (!Number.isInteger(version) || version < 0) throw new Error(errorPrefix + "_LOCK_VERSION_INVALID");
        const condition = {
            controlType: { $eq: controlType },
            version: { $eq: version },
            status: { $eq: record.status },
        };
        if (record.status === "ACTIVE") condition.expiresAt = { $eq: currentExpiry };
        const patched = await bulkPatchItems(collection, [lockId], [[
            { fieldPath: "status", action: "SET_FIELD", value: "ACTIVE" },
            { fieldPath: "expiresAt", action: "SET_FIELD", value: expiresAt },
            { fieldPath: "traceId", action: "SET_FIELD", value: String(traceId || "") },
            {
                fieldPath: "payload",
                action: "SET_FIELD",
                value: {
                    [scopeField]: cleanScopeId,
                    environment: TPV_SANDBOX_RUNTIME_POLICY.ENVIRONMENT,
                    acquiredAt: new Date(now),
                },
            },
            { fieldPath: "version", action: "INCREMENT_FIELD", value: 1 },
        ]], { condition: { filter: condition } });
        if (!Array.isArray(patched?.updatedItemIds) || !patched.updatedItemIds.includes(lockId)) {
            throw new Error(errorPrefix + "_IN_PROGRESS");
        }
        heldVersion = version + 1;
    }

    let result;
    let operationError = null;
    try {
        result = await operation();
    } catch (error) {
        operationError = error;
    }

    let releaseError = null;
    try {
        const latest = await getItem(collection, lockId, CONSISTENCY.STRONG);
        if (!latest || latest.controlType !== controlType ||
            latest.status !== "ACTIVE" || Number(latest.version) !== heldVersion) {
            throw new Error(errorPrefix + "_LOCK_LOST");
        }
        const released = await bulkPatchItems(collection, [lockId], [[
            { fieldPath: "status", action: "SET_FIELD", value: "RELEASED" },
            { fieldPath: "expiresAt", action: "SET_FIELD", value: new Date(0) },
            {
                fieldPath: "payload",
                action: "SET_FIELD",
                value: {
                    [scopeField]: cleanScopeId,
                    environment: TPV_SANDBOX_RUNTIME_POLICY.ENVIRONMENT,
                    releasedAt: new Date(),
                },
            },
            { fieldPath: "version", action: "INCREMENT_FIELD", value: 1 },
        ]], {
            condition: {
                filter: {
                    controlType: { $eq: controlType },
                    status: { $eq: "ACTIVE" },
                    version: { $eq: heldVersion },
                },
            },
        });
        if (!Array.isArray(released?.updatedItemIds) || !released.updatedItemIds.includes(lockId)) {
            throw new Error(errorPrefix + "_LOCK_RELEASE_FAILED");
        }
    } catch (error) {
        releaseError = error;
    }

    if (operationError && releaseError) {
        const combined = new Error(errorPrefix + "_OPERATION_AND_LOCK_RELEASE_FAILED");
        combined.cause = operationError;
        combined.code = errorPrefix + "_OPERATION_AND_LOCK_RELEASE_FAILED";
        combined.releaseError = String(releaseError?.message || releaseError);
        throw combined;
    }
    if (operationError) throw operationError;
    if (releaseError) throw releaseError;
    return result;
}

export async function withSandboxSaleLock(saleId, traceId, operation, sessionId = null) {
    const lockId = makeSandboxRefundLockId(saleId);
    const executeSaleLock = () => withSandboxScopedLock({
        lockId,
        controlType: CONTROL_TYPE.TPV_SANDBOX_REFUND_LOCK,
        dedupePrefix: "TPV_SANDBOX_REFUND:",
        scopeField: "saleId",
        scopeId: saleId,
        traceId,
        operation,
        errorPrefix: "TPV_SANDBOX_REFUND",
    });
    return sessionId
        ? withSandboxSessionLock(sessionId, traceId, executeSaleLock)
        : executeSaleLock();
}

export async function withSandboxSessionLock(sessionId, traceId, operation) {
    const caja = await _ensureCajaActualForSandbox();
    assertSandboxCajaWritable(caja, { allowBootstrap: true });
    const lockId = makeSandboxSessionLockId(sessionId);
    return withSandboxScopedLock({
        lockId,
        controlType: CONTROL_TYPE.TPV_SANDBOX_SESSION_LOCK,
        dedupePrefix: "TPV_SANDBOX_SESSION:",
        scopeField: "sessionId",
        scopeId: sessionId,
        traceId,
        operation,
        errorPrefix: "TPV_SANDBOX_SESSION",
    });
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

const SANDBOX_LEDGER_SOURCE = "TPV_SANDBOX_SYNTHETIC";
const SANDBOX_GENESIS_HASH = "0".repeat(64);

const SANDBOX_RUN_ID = TPV_SANDBOX_RUNTIME_POLICY.SANDBOX_RUN_ID;
const MAX_SANDBOX_PROJECTION_EVENTS = 1000;

function _assertLogicalCollection(collection) {
    if (!ALLOWED_SANDBOX_COLLECTIONS.has(collection)) throw new Error("TPV_SANDBOX_COLLECTION_NOT_ALLOWED");
}

function _fingerprintOf(record) {
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

function _testTransactionId(collection, key) {
    return makeSandboxTransactionId(collection, key);
}

function _eventAmount(record) {
    for (const key of ["totalMinor", "amountMinor", "paidMinor"]) {
        const value = Number(record?.[key]);
        if (Number.isSafeInteger(value)) return value / 100;
    }
    const gross = Number(record?.totals?.grossSalesMinor);
    return Number.isSafeInteger(gross) ? gross / 100 : 0;
}

function _virtualRecord(item) {
    const envelope = item?.payloadFiscal && typeof item.payloadFiscal === "object"
        ? item.payloadFiscal
        : {};
    const record = envelope.sandboxRecord && typeof envelope.sandboxRecord === "object"
        ? envelope.sandboxRecord
        : {};
    return {
        ...record,
        _id: item._id,
        _createdDate: item._createdDate,
        _updatedDate: item._updatedDate,
        idempotencyKey: envelope.idempotencyKey,
        payload: { ...(record.payload && typeof record.payload === "object" ? record.payload : {}), requestFingerprint: envelope.requestFingerprint },
        payloadFiscal: envelope,
        recordSource: item.recordSource,
        cmsMovementType: item.movementType,
        traceId: record.traceId || item.traceId,
        cmsTraceId: item.traceId,
        persisted: true,
        isSynthetic: true,
        realPayment: false,
    };
}


export async function seedSandboxIdentities() {

    const requiredIds = [
        ...Array.from({ length: 3 }, (_, index) => "SANDBOX-CUSTOMER-" + String(index + 1).padStart(2, "0")),
        ...Array.from({ length: 3 }, (_, index) => "SANDBOX-STAFF-" + String(index + 1).padStart(2, "0")),
    ];
    const [customers, staff] = await Promise.all([
        listTpvSandboxIdentities(TPV_SANDBOX_IDENTITY_TYPES.CUSTOMER),
        listTpvSandboxIdentities(TPV_SANDBOX_IDENTITY_TYPES.STAFF),
    ]);
    const existing = new Map([...customers, ...staff].map((item) => [item.identityId, item]));
    const missing = requiredIds.filter((identityId) => !existing.has(identityId));
    if (missing.length) {
        throw new Error("TPV_SANDBOX_IDENTITIES_NOT_PRESEEDED:" + missing.join(","));
    }
    return { created: 0, total: requiredIds.length };
}

export async function initializeSandboxCaja() {

    const existing = await _getCajaActual();
    if (!existing) throw new Error("TPV_SANDBOX_CASH_REGISTER_NOT_PRESEEDED");
    assertSandboxCajaWritable(existing, { allowBootstrap: true });
    return { item: existing, created: false };
}

async function _getCajaActual() {
    const result = await queryItems({
        dataCollectionId: BUSINESS_COLLECTIONS.CAJA_ACTUAL,
        filter: wql.eq("singletonKey", SINGLETONS.CAJA_PRINCIPAL),
        limit: 2,
        consistency: CONSISTENCY.STRONG,
    });
    if (result.items.length > 1) throw new Error("TPV_SANDBOX_CASH_REGISTER_SINGLETON_DUPLICATE");
    return result.items[0] || null;
}

async function _ensureCajaActualForSandbox() {
    const caja = await _getCajaActual();
    if (!caja) throw new Error("TPV_SANDBOX_CASH_REGISTER_NOT_SEEDED");
    assertSandboxCajaWritable(caja, { allowBootstrap: true });
    return caja;
}

function _sessionFromCaja(caja) {
    if (!caja || caja.snapshotSource !== SANDBOX_LEDGER_SOURCE || caja.traceId !== SANDBOX_RUN_ID) return null;
    const sessionId = String(caja.conceptOperations?.tpvSandbox?.sessionId || "").trim();
    if (!sessionId) throw new Error("TPV_SANDBOX_SESSION_ID_MISSING");
    const openedAt = caja.openedAt instanceof Date ? caja.openedAt : new Date(caja.openedAt || 0);
    const closedAt = caja.closedAt ? (caja.closedAt instanceof Date ? caja.closedAt : new Date(caja.closedAt)) : null;
    return {
        _id: caja._id,
        sessionId,
        status: closedAt ? "CERRADA" : "ABIERTA",
        openedAt,
        closedAt,
        openingCashMinor: Math.round(Number(caja.openingCashAmount || 0) * 100),
        cashierMemberId: caja.openedBy || TPV_SANDBOX_RUNTIME_POLICY.ACTOR_ID,
        conceptOperations: caja.conceptOperations,
        payloadFiscal: { requestFingerprint: caja.conceptOperations?.tpvSandbox?.requestFingerprint },
        payload: makeSyntheticPayload({
            sandboxRunId: SANDBOX_RUN_ID,
            dayKey: openedAt.toISOString().slice(0, 10).replace(/-/g, ""),
            source: SANDBOX_LEDGER_SOURCE,
        }),
        _createdDate: caja._createdDate,
        _updatedDate: caja._updatedDate,
        isSynthetic: true,
        persisted: true,
    };
}

async function _writeCajaProjection(collection, record, eventId) {
    const caja = await _getCajaActual();
    if (!caja) throw new Error("TPV_SANDBOX_CASH_REGISTER_NOT_FOUND");
    if (caja.snapshotSource !== SANDBOX_LEDGER_SOURCE || caja.traceId !== SANDBOX_RUN_ID) {
        throw new Error("TPV_SANDBOX_CASH_REGISTER_NOT_IN_TEST_MODE");
    }
    const conceptOperations = caja.conceptOperations && typeof caja.conceptOperations === "object"
        ? { ...caja.conceptOperations }
        : {};
    const sandboxState = conceptOperations.tpvSandbox && typeof conceptOperations.tpvSandbox === "object"
        ? { ...conceptOperations.tpvSandbox }
        : {};
    const appliedIds = Array.isArray(sandboxState.appliedMovementIds) ? sandboxState.appliedMovementIds : [];
    if (eventId && appliedIds.includes(eventId)) return caja;
    if (eventId && appliedIds.length >= MAX_SANDBOX_PROJECTION_EVENTS) {
        throw new Error("TPV_SANDBOX_PROJECTION_IDEMPOTENCY_LIMIT");
    }
    const now = new Date();
    const next = { ...caja, _updatedDate: now };
    next.lastOperationId = eventId || caja.lastOperationId;
    next.lastOperationAt = now;
    next.lastOperationStatus = "SIMULATED";
    next.traceId = SANDBOX_RUN_ID;
    next.snapshotSource = SANDBOX_LEDGER_SOURCE;
    next.cashRegisterStatus = collection === TPV_SANDBOX_COLLECTIONS.TICKET_Z ? "CERRADA" : "ABIERTA";

    if (collection === TPV_SANDBOX_COLLECTIONS.VENTAS && record.status === "CONFIRMADA_SINTETICA") {
        next.salesCount = Number(caja.salesCount || 0) + 1;
    }
    if (collection === TPV_SANDBOX_COLLECTIONS.PAGOS) {
        const method = String(record.paymentMethod || "").toUpperCase();
        const amount = Number(record.amountMinor || 0) / 100;
        if (method === "EFECTIVO") next.cashAmount = Number(caja.cashAmount || 0) + amount;
        else if (method === "TARJETA") next.cardAmount = Number(caja.cardAmount || 0) + amount;
        else if (method === "BIZUM") next.bizumAmount = Number(caja.bizumAmount || 0) + amount;
        else next.otherAmount = Number(caja.otherAmount || 0) + amount;
        next.expectedCash = Number(next.cashAmount || 0);
    }
    if (collection === TPV_SANDBOX_COLLECTIONS.MOVIMIENTOS_CAJA) {
        const type = String(record.movementType || "").toUpperCase();
        const amount = Number(record.amountMinor || 0) / 100;
        if (type === "ENTRADA") next.cashAmount = Number(caja.cashAmount || 0) + amount;
        if (type === "SALIDA" || type === "RETIRADA") next.cashAmount = Number(caja.cashAmount || 0) - amount;
        if (type === "ARQUEO_PARCIAL") {
            next.countedCash = amount;
            next.difference = amount - Number(caja.cashAmount || 0);
            next.differenceReason = String(record.reason || "");
        }
        next.expectedCash = Number(next.cashAmount || 0);
    }
    if (collection === TPV_SANDBOX_COLLECTIONS.TICKET_Z) {
        next.closedAt = record.generatedAt || now;
        next.closedBy = TPV_SANDBOX_RUNTIME_POLICY.ACTOR_ID;
        next.countedCash = Number(record.totals?.countedCashMinor || 0) / 100;
        next.expectedCash = Number(record.totals?.expectedCashMinor || 0) / 100;
        next.difference = Number(record.totals?.differenceMinor || 0) / 100;
        next.differenceReason = String(record.totals?.differenceReason || "");
        next.lastOperationType = "TPV_SANDBOX_SESSION_CLOSE";
    } else {
        next.lastOperationType = "TPV_SANDBOX_" + String(collection).replace(/^SANDBOX_/, "");
    }
    sandboxState.appliedMovementIds = eventId ? [...appliedIds, eventId] : appliedIds;
    sandboxState.lastProjectedAt = now;
    conceptOperations.tpvSandbox = sandboxState;
    next.conceptOperations = conceptOperations;
    await updateItem(BUSINESS_COLLECTIONS.CAJA_ACTUAL, next);
    return next;
}

function _shouldProject(collection, record) {
    if (collection === TPV_SANDBOX_COLLECTIONS.PAGOS ||
        collection === TPV_SANDBOX_COLLECTIONS.MOVIMIENTOS_CAJA ||
        collection === TPV_SANDBOX_COLLECTIONS.TICKET_Z) return true;
    return collection === TPV_SANDBOX_COLLECTIONS.VENTAS &&
        record?.status === "CONFIRMADA_SINTETICA";
}

function _sessionCajaPatch(caja, record, fingerprint) {
    const openedAt = record.openedAt instanceof Date ? record.openedAt : new Date(record.openedAt || Date.now());
    const openingCash = Number(record.openingCashMinor || 0) / 100;
    return {
        ...caja,
        cashRegisterStatus: "ABIERTA",
        openedAt,
        closedAt: null,
        openedBy: TPV_SANDBOX_RUNTIME_POLICY.ACTOR_ID,
        closedBy: "",
        openingCashAmount: openingCash,
        openingCardAmount: 0,
        openingBizumAmount: 0,
        openingOtherAmount: 0,
        cashAmount: openingCash,
        cardAmount: 0,
        bizumAmount: 0,
        otherAmount: 0,
        expectedCash: openingCash,
        countedCash: openingCash,
        difference: 0,
        differenceReason: "",
        salesCount: 0,
        snapshotSource: SANDBOX_LEDGER_SOURCE,
        traceId: SANDBOX_RUN_ID,
        lastOperationId: "TPVSANDBOX_SESSION_OPEN:" + record.sessionId,
        lastOperationType: "TPV_SANDBOX_SESSION_OPEN",
        lastOperationAmount: openingCash,
        lastOperationPaymentMethod: "EFECTIVO",
        lastOperationAt: openedAt,
        lastOperationStatus: "SIMULATED",
        conceptOperations: {
            ...(caja.conceptOperations && typeof caja.conceptOperations === "object" ? caja.conceptOperations : {}),
            tpvSandbox: { sandboxRunId: SANDBOX_RUN_ID, sessionId: record.sessionId, requestFingerprint: fingerprint, openedAt, appliedMovementIds: [] },
        },
        _updatedDate: new Date(),
    };
}

async function findByIdempotencyKey(collection, key) {
    _assertLogicalCollection(collection);
    if (collection === TPV_SANDBOX_COLLECTIONS.SESIONES_CAJA) {
        const caja = await _getCajaActual();
        const session = _sessionFromCaja(caja);
        return session && session.sessionId ? session : null;
    }
    const movementType = TPV_SANDBOX_EVENT_MOVEMENT_TYPES[collection];
    if (!movementType) throw new Error("TPV_SANDBOX_COLLECTION_NOT_ALLOWED");
    const transactionIds = [
        _testTransactionId(collection, key),
        makeLegacySandboxTransactionId(key),
    ];
    const uniqueTransactionIds = [...new Set(transactionIds)];
    for (const transactionId of uniqueTransactionIds) {
        const result = await queryItems({
            dataCollectionId: BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA,
            filter: wql.and(
                wql.eq("recordSource", SANDBOX_LEDGER_SOURCE),
                wql.eq("movementType", movementType),
                wql.eq("transactionId", transactionId)
            ),
            limit: 2,
            consistency: CONSISTENCY.STRONG,
        });
        if (result.items.length > 1) throw new Error("TPV_SANDBOX_IDEMPOTENCY_INDEX_VIOLATION");
        if (result.items[0]) return _virtualRecord(result.items[0]);
    }
    return null;
}

function assertSameRequest(existing, fingerprint) {
    const existingFingerprint = existing?.payloadFiscal?.requestFingerprint ||
        existing?.payload?.requestFingerprint ||
        existing?.conceptOperations?.tpvSandbox?.requestFingerprint;
    if (existingFingerprint !== fingerprint) throw new Error("TPV_SANDBOX_IDEMPOTENCY_CONFLICT");
    return { item: existing, replayed: true };
}

function _buildSyntheticLedgerItem(collection, key, record, fingerprint) {
    const movementType = TPV_SANDBOX_EVENT_MOVEMENT_TYPES[collection];
    if (!movementType) throw new Error("TPV_SANDBOX_COLLECTION_NOT_ALLOWED");
    const now = record.createdAt || record.generatedAt || record.occurredAt || new Date();
    const timestamp = now instanceof Date ? now : new Date(now);
    if (Number.isNaN(timestamp.getTime())) throw new Error("TPV_SANDBOX_RECORD_TIMESTAMP_INVALID");
    const dateYmd = timestamp.toLocaleDateString("en-CA", { timeZone: TPV_SANDBOX_RUNTIME_POLICY.TIME_ZONE });
    const transactionId = _testTransactionId(collection, key);
    const amount = _eventAmount(record);
    const traceId = "TPVSANDBOX:" + SANDBOX_RUN_ID + ":" + String(record.sessionId || record.payload?.sessionId || "GLOBAL");
    const envelope = {
        sandboxRunId: SANDBOX_RUN_ID,
        logicalCollection: collection,
        idempotencyKey: key,
        requestFingerprint: fingerprint,
        sandboxRecord: record,
        isSynthetic: true,
        realPayment: false,
        externalSideEffects: false,
    };
    const hashPayload = stableSerialize({
        sandboxRunId: SANDBOX_RUN_ID,
        logicalCollection: collection,
        transactionId,
        traceId,
        record,
    });
    const hash = createHash("sha256").update(hashPayload).digest("hex");
    return {
        _id: transactionId,
        hash,
        sequenceNumber: 0,
        numSerieFactura: "SANDBOX-NO-FISCAL-" + transactionId.slice(-20),
        transactionId,
        previousRecordHash: SANDBOX_GENESIS_HASH,
        recordTimestamp: timestamp,
        schemaVersion: "TPV_SANDBOX_SYNTHETIC_V1",
        traceId,
        movementType,
        totalAmount: amount,
        amount,
        taxBase: 0,
        taxAmount: 0,
        paymentMethod: String(record.paymentMethod || "OTROS").toUpperCase(),
        channelType: "PRESENCIAL",
        operationDescription: "SIMULATED TPV SANDBOX " + collection,
        staffResourceId: TPV_SANDBOX_RUNTIME_POLICY.ACTOR_ID,
        tipoFactura: "F2",
        fechaExpedicionFactura: dateYmd,
        tipoImpositivo: 0,
        fiscalPeriod: dateYmd.slice(0, 7),
        recordSource: SANDBOX_LEDGER_SOURCE,
        payloadFiscal: envelope,
        desgloseDetallado: { accountCode: "SIMULATED", sandboxRunId: SANDBOX_RUN_ID },
        lineItems: { sandboxRecord: record.lineItems || [] },
    };
}

function _matchesFilter(record, filter) {
    if (!filter || typeof filter !== "object") return true;
    if (Array.isArray(filter.$and)) return filter.$and.every((part) => _matchesFilter(record, part));
    if (Array.isArray(filter.$or)) return filter.$or.some((part) => _matchesFilter(record, part));
    return Object.entries(filter).every(([field, clause]) => {
        const value = field.split(".").reduce((current, key) => current?.[key], record);
        if (!clause || typeof clause !== "object" || Array.isArray(clause)) return value === clause;
        return Object.entries(clause).every(([operator, expected]) => {
            if (operator === "$eq") return value === expected;
            if (operator === "$ne") return value !== expected;
            if (operator === "$in") return Array.isArray(expected) && expected.includes(value);
            if (operator === "$gt") return value > expected;
            if (operator === "$gte") return value >= expected;
            if (operator === "$lt") return value < expected;
            if (operator === "$lte") return value <= expected;
            if (operator === "$startsWith") return String(value || "").startsWith(String(expected));
            if (operator === "$contains") return String(value || "").includes(String(expected));
            return false;
        });
    });
}

export async function insertSandboxEvent(collection, idempotencyKey, data) {

    _assertLogicalCollection(collection);
    const key = normalizeIdempotencyKey(idempotencyKey);
    const record = { ...data };
    const fingerprint = _fingerprintOf(record);

    if (collection === TPV_SANDBOX_COLLECTIONS.SESIONES_CAJA) {
        const caja = await _ensureCajaActualForSandbox();
        assertSandboxCajaWritable(caja, { allowBootstrap: true });
        const existing = await findByIdempotencyKey(collection, key);
        if (existing?.sessionId === record.sessionId) return assertSameRequest(existing, fingerprint);
        if (caja.snapshotSource === SANDBOX_LEDGER_SOURCE && !caja.closedAt) {
            throw new Error("TPV_SANDBOX_PREVIOUS_SESSION_NOT_CLOSED");
        }
        const updated = _sessionCajaPatch(caja, record, fingerprint);
        const saved = await updateItem(BUSINESS_COLLECTIONS.CAJA_ACTUAL, updated);
        return { item: _sessionFromCaja(saved), replayed: false };
    }

    const caja = await _getCajaActual();
    assertSandboxCajaWritable(caja);
    const existing = await findByIdempotencyKey(collection, key);
    if (existing) {
        const replay = assertSameRequest(existing, fingerprint);
        if (_shouldProject(collection, existing)) {
            await _writeCajaProjection(collection, existing, existing._id);
        }
        return replay;
    }

    const ledgerItem = _buildSyntheticLedgerItem(collection, key, record, fingerprint);
    let saved;
    try {
        saved = await insertItem(BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA, ledgerItem);
    } catch (error) {
        const winner = await findByIdempotencyKey(collection, key);
        if (!winner) throw error;
        const replay = assertSameRequest(winner, fingerprint);
        if (_shouldProject(collection, winner)) {
            await _writeCajaProjection(collection, winner, winner._id);
        }
        return replay;
    }

    const item = _virtualRecord({
        ...ledgerItem,
        _id: saved?._id || ledgerItem._id,
        _createdDate: saved?._createdDate || new Date(),
        _updatedDate: saved?._updatedDate || new Date(),
    });
    if (_shouldProject(collection, record)) {
        await _writeCajaProjection(collection, record, item._id);
    }
    return { item, replayed: false };
}

export async function querySandboxRecords(collection, filter, options = {}) {

    _assertLogicalCollection(collection);
    if (collection === TPV_SANDBOX_COLLECTIONS.SESIONES_CAJA) {
        const session = _sessionFromCaja(await _getCajaActual());
        const sessions = session ? [session] : [];
        return sessions.filter((item) => _matchesFilter(item, filter));
    }
    const movementType = TPV_SANDBOX_EVENT_MOVEMENT_TYPES[collection];
    if (!movementType) throw new Error("TPV_SANDBOX_COLLECTION_NOT_ALLOWED");
    const pageSize = Math.min(1000, Math.max(1, Math.floor(Number(options.limit || 1000))));
    const result = await queryItems({
        dataCollectionId: BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA,
        filter: wql.and(
            wql.eq("recordSource", SANDBOX_LEDGER_SOURCE),
            wql.eq("movementType", movementType)
        ),
        sort: ["recordTimestamp ASC"],
        limit: pageSize,
        consistency: CONSISTENCY.STRONG,
    });
    const records = result.items.map(_virtualRecord).filter((item) =>
        item.payloadFiscal?.sandboxRunId === SANDBOX_RUN_ID && _matchesFilter(item, filter)
    );
    if (options.allowTruncated === true) return records;
    const maxRecords = Math.max(pageSize, Math.floor(Number(options.maxRecords || 10000)));
    let page = result;
    while (page.hasNext && records.length < maxRecords) {
        page = await page.next();
        records.push(...page.items.map(_virtualRecord).filter((item) =>
            item.payloadFiscal?.sandboxRunId === SANDBOX_RUN_ID && _matchesFilter(item, filter)
        ));
    }
    if (page.hasNext) throw new Error("TPV_SANDBOX_QUERY_LIMIT_EXCEEDED");
    if (Array.isArray(options.sort) && options.sort.length) {
        const [field, direction = "ASC"] = String(options.sort[0]).split(/\s+/);
        records.sort((a, b) => {
            const av = field.split(".").reduce((v, k) => v?.[k], a);
            const bv = field.split(".").reduce((v, k) => v?.[k], b);
            const cmp = av < bv ? -1 : av > bv ? 1 : 0;
            return direction.toUpperCase() === "DESC" ? -cmp : cmp;
        });
    }
    return records;
}

export async function querySandboxLedgerRecords(options = {}) {

    const limit = Number(options.limit ?? 100);
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
        throw new Error("TPV_SANDBOX_LEDGER_INVALID_LIMIT");
    }
    const result = await queryItems({
        dataCollectionId: BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA,
        filter: wql.eq("recordSource", SANDBOX_LEDGER_SOURCE),
        sort: ["recordTimestamp DESC"],
        limit,
        consistency: CONSISTENCY.STRONG,
    });
    const records = result.items
        .map(_virtualRecord)
        .filter((item) => item.payloadFiscal?.sandboxRunId === SANDBOX_RUN_ID);
    return { records, hasMore: result.hasNext === true };
}

export async function appendSandboxAudit({
    idempotencyKey,
    action,
    actorId,
    entityType,
    entityId,
    traceId,
    payload = {},
}) {
    const { item, replayed } = await insertSandboxEvent(
        TPV_SANDBOX_COLLECTIONS.AUDITORIA,
        idempotencyKey,
        {
            action: String(action || "UNKNOWN").slice(0, 80),
            actorId: String(actorId || "UNKNOWN").slice(0, 100),
            entityType: String(entityType || "TPV").slice(0, 80),
            entityId: String(entityId || "").slice(0, 120),
            occurredAt: new Date(),
            source: "TPV_SANDBOX_WEB_METHOD",
            payload: { ...payload, traceId: String(traceId || "") },
        }
    );
    return { item, replayed };
}

export async function latestOpenSandboxSession() {
    const sessions = await querySandboxRecords(
        TPV_SANDBOX_COLLECTIONS.SESIONES_CAJA,
        undefined,
        { sort: ["_createdDate DESC"], limit: 1000 }
    );
    const closures = await querySandboxRecords(TPV_SANDBOX_COLLECTIONS.TICKET_Z, undefined);
    const closedSessionIds = new Set(closures.filter((item) => item.closed === true).map((item) => item.sessionId));
    return sessions.find((session) =>
        session.status === "ABIERTA" && !closedSessionIds.has(session.sessionId)
    ) || null;
}


export async function getCommittedSandboxSales(sessionId) {
    const records = await querySandboxRecords(TPV_SANDBOX_COLLECTIONS.VENTAS, undefined);
    return records.filter((item) =>
        item.status === "CONFIRMADA_SINTETICA" &&
        item.payload?.sessionId === sessionId
    );
}

export async function getPendingSandboxSales(sessionId) {
    const records = await querySandboxRecords(TPV_SANDBOX_COLLECTIONS.VENTAS, undefined);
    const committedIds = new Set(records
        .filter((item) => item.status === "CONFIRMADA_SINTETICA")
        .map((item) => item.saleId));
    return records.filter((item) =>
        item.status === "PREPARADA_SINTETICA" &&
        item.payload?.sessionId === sessionId &&
        !committedIds.has(item.saleId)
    );
}

export async function getSandboxPayments(sessionId) {
    const records = await querySandboxRecords(TPV_SANDBOX_COLLECTIONS.PAGOS, undefined);
    return records.filter((item) => item.payload?.sessionId === sessionId);
}

export async function getPendingSandboxRefunds(sessionId) {
    const [refunds, payments, movements] = await Promise.all([
        getSandboxRefunds(sessionId),
        getSandboxPayments(sessionId),
        getSandboxCashMovements(sessionId),
    ]);

    return refunds.filter((refund) => {
        const allocations = Array.isArray(refund.payload?.allocations)
            ? refund.payload.allocations
            : [];
        if (allocations.length === 0) return true;

        const expectedByMethod = new Map();
        for (const allocation of allocations) {
            const method = allocation?.paymentMethod;
            const amountMinor = Number(allocation?.amountMinor);
            if (!["EFECTIVO", "TARJETA", "BIZUM", "OTROS"].includes(method) ||
                !Number.isSafeInteger(amountMinor) || amountMinor <= 0) return true;
            const current = expectedByMethod.get(method) || { count: 0, amountMinor: 0 };
            current.count += 1;
            current.amountMinor += amountMinor;
            expectedByMethod.set(method, current);
        }

        const refundPayments = payments.filter((payment) =>
            payment.status === "REEMBOLSO_SINTETICO" &&
            payment.payload?.refundId === refund.refundId
        );
        const refundCashMovements = movements.filter((movement) =>
            movement.status === "CONFIRMADO_SINTETICO" &&
            movement.movementType === "DEVOLUCION_EFECTIVO" &&
            movement.payload?.refundId === refund.refundId
        );
        const actualByMethod = new Map();
        for (const payment of refundPayments) {
            const method = payment.paymentMethod;
            const amountMinor = Number(payment.amountMinor);
            if (!Number.isSafeInteger(amountMinor) || amountMinor >= 0) return true;
            const current = actualByMethod.get(method) || { count: 0, amountMinor: 0 };
            current.count += 1;
            current.amountMinor += Math.abs(amountMinor);
            actualByMethod.set(method, current);
        }

        if (actualByMethod.size !== expectedByMethod.size) return true;
        for (const [method, expected] of expectedByMethod) {
            const actual = actualByMethod.get(method);
            if (!actual || actual.count !== expected.count ||
                actual.amountMinor !== expected.amountMinor) return true;
        }

        const expectedCash = expectedByMethod.get("EFECTIVO") || { count: 0, amountMinor: 0 };
        const actualCashAmount = refundCashMovements.reduce((sum, movement) => {
            const amountMinor = Number(movement.amountMinor);
            return Number.isSafeInteger(amountMinor) && amountMinor > 0
                ? sum + amountMinor
                : Number.NaN;
        }, 0);
        const refundTotal = allocations.reduce((sum, allocation) => sum + Number(allocation.amountMinor), 0);

        return refundPayments.length !== allocations.length ||
            refundCashMovements.length !== expectedCash.count ||
            actualCashAmount !== expectedCash.amountMinor ||
            refundTotal !== Number(refund.amountMinor);
    });
}

export async function getSandboxRefunds(sessionId) {
    const records = await querySandboxRecords(TPV_SANDBOX_COLLECTIONS.REEMBOLSOS, undefined);
    return records.filter((item) =>
        item.status === "CONFIRMADO_SINTETICO" &&
        item.payload?.sessionId === sessionId
    );
}

export async function getSandboxCashMovements(sessionId) {
    return querySandboxRecords(
        TPV_SANDBOX_COLLECTIONS.MOVIMIENTOS_CAJA,
        wql.eq("sessionId", sessionId)
    );
}
