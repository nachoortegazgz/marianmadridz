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
import { TPV_COLLECTIONS, TPV_EVENT_MOVEMENT_TYPES, TPV_LEDGER_SOURCE, TPV_RUNTIME_POLICY, TPV_IDENTITY_TYPES, CONTROL_TYPE, OPERATIONAL_COLLECTIONS, BUSINESS_COLLECTIONS, SINGLETONS } from "backend/internalConfig";
import { listTpvIdentities } from "backend/tpv/tpvIdentities";
import { logger } from "backend/logger";
import {

    assertTpvCajaIntegrity,
    normalizeIdempotencyKey,
    stableSerialize,
    makeSyntheticPayload,
    makeTpvRefundLockId,
    makeTpvSessionLockId,
    makeTpvTransactionId,
    makeLegacyTpvTransactionIdByCollection,
    makeLegacyTpvTransactionId,
} from "backend/tpv/tpvUtils";
import {
    acquireFiscalLedgerLock,
    assertFiscalLedgerLock,
    releaseFiscalLedgerLock,
} from "backend/fiscalLedgerLock";

const ALLOWED_TPV_COLLECTIONS = new Set(Object.values(TPV_COLLECTIONS));
const REFUND_LOCK_TTL_MS = 300000;

async function withCajaActualProjectionLock(traceId, operation) {
    const lock = await acquireFiscalLedgerLock(traceId || "TPV_CAJA_PROJECTION");
    let operationFailed = false;
    try {
        await assertFiscalLedgerLock(lock);
        return await operation(lock);
    } catch (error) {
        operationFailed = true;
        throw error;
    } finally {
        const released = await releaseFiscalLedgerLock(lock);
        if (!released?.released) {
            logger.error("TPV_CASH_REGISTER_LOCK_RELEASE_FAILED", {
                traceId,
                reason: released?.reason || "UNKNOWN",
                operationFailed,
            });
            if (!operationFailed) {
                throw new Error("TPV_CASH_REGISTER_LOCK_RELEASE_FAILED");
            }
        }
    }
}

async function withTpvScopedLock({
    lockId,
    controlType,
    dedupePrefix,
    scopeField,
    scopeId,
    traceId,
    operation,
    errorPrefix,
}) {

    await _ensureCajaActual();
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
                sourceType: TPV_RUNTIME_POLICY.SOURCE_TYPE,
                siteId: TPV_RUNTIME_POLICY.SITE_ID,
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
                    sourceType: TPV_RUNTIME_POLICY.SOURCE_TYPE,
                siteId: TPV_RUNTIME_POLICY.SITE_ID,
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
                    sourceType: TPV_RUNTIME_POLICY.SOURCE_TYPE,
                siteId: TPV_RUNTIME_POLICY.SITE_ID,
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

export async function withTpvSaleLock(saleId, traceId, operation, sessionId = null) {
    const lockId = makeTpvRefundLockId(saleId);
    const executeSaleLock = () => withTpvScopedLock({
        lockId,
        controlType: CONTROL_TYPE.TPV_REFUND_LOCK,
        dedupePrefix: "TPV_REFUND:",
        scopeField: "saleId",
        scopeId: saleId,
        traceId,
        operation,
        errorPrefix: "TPV_REFUND",
    });
    return sessionId
        ? withTpvSessionLock(sessionId, traceId, executeSaleLock)
        : executeSaleLock();
}

export async function withTpvSessionLock(sessionId, traceId, operation) {
    const caja = await _ensureCajaActualForSandbox();
    assertTpvCajaIntegrity(caja, { allowBootstrap: true });
    const lockId = makeTpvSessionLockId(sessionId);
    return withTpvScopedLock({
        lockId,
        controlType: CONTROL_TYPE.TPV_SESSION_LOCK,
        dedupePrefix: "TPV_SESSION:",
        scopeField: "sessionId",
        scopeId: sessionId,
        traceId,
        operation,
        errorPrefix: "TPV_SESSION",
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

const LEGACY_TPV_LEDGER_SOURCE = "TPV_SANDBOX_SYNTHETIC";
const TPV_CASH_REGISTER_SOURCE = "TPV_SYNTHETIC";
const TPV_GENESIS_HASH = "0".repeat(64);

const LEGACY_RUN_ID = TPV_RUNTIME_POLICY.LEGACY_RUN_ID;
const MAX_TPV_PROJECTION_EVENTS = 1000;

function _assertLogicalCollection(collection) {
    if (!ALLOWED_TPV_COLLECTIONS.has(collection)) throw new Error("TPV_COLLECTION_NOT_ALLOWED");
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
    return makeTpvTransactionId(collection, key);
}

function _eventAmount(record) {
    for (const key of ["totalMinor", "amountMinor", "paidMinor"]) {
        const value = Number(record?.[key]);
        if (Number.isSafeInteger(value)) return value / 100;
    }
    const gross = Number(record?.totals?.grossSalesMinor);
    return Number.isSafeInteger(gross) ? gross / 100 : 0;
}

function _isRecognizedSyntheticLedgerItem(item) {
    if (!item || typeof item !== "object" || Array.isArray(item) || !String(item.movementType || "").startsWith("SIMULATED_TPV_")) return false;
    const envelope = item.payloadFiscal && typeof item.payloadFiscal === "object" ? item.payloadFiscal : {};
    const validHash = /^[a-f0-9]{64}$/i.test(String(item.hash || "")) && Number(item.sequenceNumber) === 0;
    const validCommon = TPV_EVENT_MOVEMENT_TYPES[envelope.logicalCollection] === item.movementType &&
        envelope.isSynthetic === true && envelope.realPayment === false &&
        envelope.externalSideEffects === false && Boolean(envelope.requestFingerprint) && validHash;
    const current = item.recordSource === TPV_LEDGER_SOURCE &&
        envelope.sourceType === TPV_RUNTIME_POLICY.SOURCE_TYPE &&
        envelope.siteId === TPV_RUNTIME_POLICY.SITE_ID &&
        envelope.ledgerVersion === TPV_RUNTIME_POLICY.LEDGER_VERSION &&
        Number(envelope.schemaVersion) === 2 &&
        envelope.reconciliationStatus === "NOT_RECONCILED" &&
        (envelope.logicalCollection === TPV_COLLECTIONS.AUDITORIA || Boolean(String(envelope.sessionId || "").trim())) &&
        String(item.traceId || "").startsWith("TPV:" + TPV_RUNTIME_POLICY.SITE_ID + ":");
    const legacy = [LEGACY_TPV_LEDGER_SOURCE, "TPV_SYNTHETIC"].includes(item.recordSource) &&
        envelope.sandboxRunId === LEGACY_RUN_ID &&
        String(item.traceId || "").startsWith("TPV:" + LEGACY_RUN_ID + ":");
    return validCommon && (current || legacy);
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


export async function seedTpvIdentities() {

    const requiredIds = [
        ...Array.from({ length: 3 }, (_, index) => "TPV-CUSTOMER-" + String(index + 1).padStart(2, "0")),
        ...Array.from({ length: 3 }, (_, index) => "TPV-STAFF-" + String(index + 1).padStart(2, "0")),
    ];
    const [customers, staff] = await Promise.all([
        listTpvIdentities(TPV_IDENTITY_TYPES.CUSTOMER),
        listTpvIdentities(TPV_IDENTITY_TYPES.STAFF),
    ]);
    const existing = new Map([...customers, ...staff].map((item) => [item.identityId, item]));
    const missing = requiredIds.filter((identityId) => !existing.has(identityId));
    if (missing.length) {
        throw new Error("TPV_IDENTITIES_NOT_PRESEEDED:" + missing.join(","));
    }
    return { created: 0, total: requiredIds.length };
}

export async function initializeTpvCaja() {

    const existing = await _getCajaActual();
    if (!existing) throw new Error("TPV_CASH_REGISTER_NOT_PRESEEDED");
    assertTpvCajaIntegrity(existing, { allowBootstrap: true });
    return { item: existing, created: false };
}

async function _getCajaActual() {
    const result = await queryItems({
        dataCollectionId: BUSINESS_COLLECTIONS.CAJA_ACTUAL,
        filter: wql.eq("singletonKey", SINGLETONS.CAJA_PRINCIPAL),
        limit: 2,
        consistency: CONSISTENCY.STRONG,
    });
    if (result.items.length > 1) throw new Error("TPV_CASH_REGISTER_SINGLETON_DUPLICATE");
    return result.items[0] || null;
}

async function _ensureCajaActualForSandbox() {
    const caja = await _getCajaActual();
    if (!caja) throw new Error("TPV_CASH_REGISTER_NOT_SEEDED");
    assertTpvCajaIntegrity(caja, { allowBootstrap: true });
    return caja;
}

function _sessionFromCaja(caja) {
    const sandboxState = caja?.conceptOperations?.tpvSandbox;
    const sessionId = String(sandboxState?.sessionId || "").trim();
    const explicitSynthetic = caja?.cashRegisterStatus === "SIMULACION" &&
        sandboxState?.sourceType === TPV_RUNTIME_POLICY.SOURCE_TYPE &&
        sandboxState?.siteId === TPV_RUNTIME_POLICY.SITE_ID &&
        sandboxState?.ledgerVersion === TPV_RUNTIME_POLICY.LEDGER_VERSION &&
        Number(sandboxState?.schemaVersion) === 2 &&
        sandboxState?.externalSideEffects === false &&
        /^[a-f0-9]{64}$/i.test(String(sandboxState?.eventHash || "")) &&
        Boolean(sessionId);
    const legacySynthetic = caja?.snapshotSource === LEGACY_TPV_LEDGER_SOURCE &&
        caja?.traceId === LEGACY_RUN_ID && Boolean(sessionId);
    if (!explicitSynthetic && !legacySynthetic) return null;
    if (!sessionId) throw new Error("TPV_SESSION_ID_MISSING");
    const openedAt = caja.openedAt instanceof Date ? caja.openedAt : new Date(caja.openedAt || 0);
    const closedAt = caja.closedAt ? (caja.closedAt instanceof Date ? caja.closedAt : new Date(caja.closedAt)) : null;
    return {
        _id: caja._id,
        sessionId,
        status: closedAt ? "CERRADA" : "ABIERTA",
        openedAt,
        closedAt,
        openingCashMinor: Math.round(Number(caja.openingCashAmount || 0) * 100),
        cashierMemberId: caja.openedBy || null,
        conceptOperations: caja.conceptOperations,
        payloadFiscal: { requestFingerprint: caja.conceptOperations?.tpvSandbox?.requestFingerprint },
        payload: makeSyntheticPayload({
            sessionId,
            traceId: caja.traceId || "",
            dayKey: openedAt.toISOString().slice(0, 10).replace(/-/g, ""),
            source: explicitSynthetic ? TPV_CASH_REGISTER_SOURCE : LEGACY_TPV_LEDGER_SOURCE,
        }),
        _createdDate: caja._createdDate,
        _updatedDate: caja._updatedDate,
        isSynthetic: true,
        persisted: true,
    };
}

async function _writeCajaProjection(collection, record, eventId, eventHash) {
    return withCajaActualProjectionLock(
        String(record?.traceId || eventId || "TPV_CAJA_PROJECTION"),
        async (lock) => {
            const caja = await _getCajaActual();
            if (!caja) throw new Error("TPV_CASH_REGISTER_NOT_FOUND");
            assertTpvCajaIntegrity(caja);
            const preflightSandboxState = caja.conceptOperations?.tpvSandbox || {};
            const explicitSynthetic = preflightSandboxState.sourceType === TPV_RUNTIME_POLICY.SOURCE_TYPE &&
                preflightSandboxState.siteId === TPV_RUNTIME_POLICY.SITE_ID &&
                preflightSandboxState.ledgerVersion === TPV_RUNTIME_POLICY.LEDGER_VERSION &&
                preflightSandboxState.schemaVersion === 2 &&
                preflightSandboxState.externalSideEffects === false &&
                /^[a-f0-9]{64}$/i.test(String(preflightSandboxState.eventHash || "")) &&
                Boolean(String(preflightSandboxState.sessionId || "").trim());
            const legacySynthetic = caja.snapshotSource === LEGACY_TPV_LEDGER_SOURCE &&
                caja.traceId === LEGACY_RUN_ID;
            if (!explicitSynthetic && !legacySynthetic) {
                throw new Error("TPV_CASH_REGISTER_INTEGRITY_FAILED");
            }
            const conceptOperations = caja.conceptOperations && typeof caja.conceptOperations === "object"
                ? { ...caja.conceptOperations }
                : {};
            const sandboxState = conceptOperations.tpvSandbox && typeof conceptOperations.tpvSandbox === "object"
                ? { ...conceptOperations.tpvSandbox }
                : {};
            const appliedIds = Array.isArray(sandboxState.appliedMovementIds) ? sandboxState.appliedMovementIds : [];
            if (eventId && appliedIds.includes(eventId)) return caja;
            if (eventId && appliedIds.length >= MAX_TPV_PROJECTION_EVENTS) {
                throw new Error("TPV_PROJECTION_IDEMPOTENCY_LIMIT");
            }
            const now = new Date();
            const next = { ...caja, _updatedDate: now };
            next.lastOperationId = eventId || caja.lastOperationId;
            next.lastOperationAt = now;
            next.lastOperationStatus = "SIMULATED";
            next.traceId = String(record.traceId || caja.traceId || "");
            next.snapshotSource = TPV_CASH_REGISTER_SOURCE;
            next.cashRegisterStatus = "SIMULACION";

            if (collection === TPV_COLLECTIONS.VENTAS && record.status === "CONFIRMADA_SINTETICA") {
                next.salesCount = Number(caja.salesCount || 0) + 1;
            }
            if (collection === TPV_COLLECTIONS.PAGOS) {
                const method = String(record.paymentMethod || "").toUpperCase();
                const amount = Number(record.amountMinor || 0) / 100;
                if (method === "EFECTIVO") next.cashAmount = Number(caja.cashAmount || 0) + amount;
                else if (method === "TARJETA") next.cardAmount = Number(caja.cardAmount || 0) + amount;
                else if (method === "BIZUM") next.bizumAmount = Number(caja.bizumAmount || 0) + amount;
                else next.otherAmount = Number(caja.otherAmount || 0) + amount;
                next.expectedCash = Number(next.cashAmount || 0);
            }
            if (collection === TPV_COLLECTIONS.MOVIMIENTOS_CAJA) {
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
            if (collection === TPV_COLLECTIONS.TICKET_Z) {
                next.closedAt = record.generatedAt || now;
                next.closedBy = record.operatorId || record.actorId || null;
                next.countedCash = Number(record.totals?.countedCashMinor || 0) / 100;
                next.expectedCash = Number(record.totals?.expectedCashMinor || 0) / 100;
                next.difference = Number(record.totals?.differenceMinor || 0) / 100;
                next.differenceReason = String(record.totals?.differenceReason || "");
                next.lastOperationType = "TPV_SESSION_CLOSE";
            } else {
                next.lastOperationType = "TPV_" + String(collection).replace(/^TPV_LOGICAL_/, "");
            }
            sandboxState.sourceType = TPV_RUNTIME_POLICY.SOURCE_TYPE;
            sandboxState.siteId = TPV_RUNTIME_POLICY.SITE_ID;
            sandboxState.ledgerVersion = TPV_RUNTIME_POLICY.LEDGER_VERSION;
            sandboxState.externalSideEffects = false;
            sandboxState.schemaVersion = 2;
            sandboxState.reconciliationStatus = "NOT_RECONCILED";
            sandboxState.eventHash = String(eventHash || sandboxState.eventHash || "");
            sandboxState.sessionId = String(sandboxState.sessionId || record.sessionId || record.payload?.sessionId || "");
            sandboxState.appliedMovementIds = eventId ? [...appliedIds, eventId] : appliedIds;
            sandboxState.lastProjectedAt = now;
            conceptOperations.tpvSandbox = sandboxState;
            next.conceptOperations = conceptOperations;
            await assertFiscalLedgerLock(lock);
            await updateItem(BUSINESS_COLLECTIONS.CAJA_ACTUAL, next);
            return next;
        }
    );
}

function _shouldProject(collection, record) {
    if (collection === TPV_COLLECTIONS.PAGOS ||
        collection === TPV_COLLECTIONS.MOVIMIENTOS_CAJA ||
        collection === TPV_COLLECTIONS.TICKET_Z) return true;
    return collection === TPV_COLLECTIONS.VENTAS &&
        record?.status === "CONFIRMADA_SINTETICA";
}

function _sessionCajaPatch(caja, record, eventHash) {
    const openedAt = record.openedAt instanceof Date ? record.openedAt : new Date(record.openedAt || Date.now());
    const openingCash = Number(record.openingCashMinor || 0) / 100;
    return {
        ...caja,
        cashRegisterStatus: "SIMULACION",
        openedAt,
        closedAt: null,
        openedBy: record.operatorId || record.cashierMemberId || null,
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
        snapshotSource: TPV_CASH_REGISTER_SOURCE,
        traceId: String(record.payload?.traceId || "TPV_SESSION:" + record.sessionId),
        lastOperationId: "TPV_SESSION_OPEN:" + record.sessionId,
        lastOperationType: "TPV_SESSION_OPEN",
        lastOperationAmount: openingCash,
        lastOperationPaymentMethod: "EFECTIVO",
        lastOperationAt: openedAt,
        lastOperationStatus: "SIMULATED",
        conceptOperations: {
            ...(caja.conceptOperations && typeof caja.conceptOperations === "object" ? caja.conceptOperations : {}),
            tpvSandbox: {
                sourceType: TPV_RUNTIME_POLICY.SOURCE_TYPE,
                siteId: TPV_RUNTIME_POLICY.SITE_ID,
                ledgerVersion: TPV_RUNTIME_POLICY.LEDGER_VERSION,
                schemaVersion: 2,
                externalSideEffects: false,
                reconciliationStatus: "NOT_RECONCILED",
                eventHash: String(eventHash || ""),
                sessionId: record.sessionId,
                actorId: String(record.actorId || record.operatorId || record.cashierMemberId || "").trim() || null,
                operatorId: String(record.operatorId || record.cashierMemberId || "").trim() || null,
                operatorResourceId: String(record.operatorResourceId || "").trim() || null,
                requestFingerprint: record.requestFingerprint || null,
                openedAt,
                appliedMovementIds: [],
            },
        },
        _updatedDate: new Date(),
    };
}

async function findByIdempotencyKey(collection, key) {
    _assertLogicalCollection(collection);
    if (collection === TPV_COLLECTIONS.SESIONES_CAJA) {
        const caja = await _getCajaActual();
        const session = _sessionFromCaja(caja);
        return session && session.sessionId ? session : null;
    }
    const movementType = TPV_EVENT_MOVEMENT_TYPES[collection];
    if (!movementType) throw new Error("TPV_COLLECTION_NOT_ALLOWED");
    const transactionIds = [
        _testTransactionId(collection, key),
        makeLegacyTpvTransactionIdByCollection(collection, key),
        makeLegacyTpvTransactionId(key),
    ];
    const uniqueTransactionIds = [...new Set(transactionIds)];
    for (const transactionId of uniqueTransactionIds) {
        const result = await queryItems({
            dataCollectionId: BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA,
            filter: wql.and(
                wql.eq("movementType", movementType),
                wql.eq("transactionId", transactionId)
            ),
            limit: 2,
            consistency: CONSISTENCY.STRONG,
        });
        if (result.items.length > 1) throw new Error("TPV_IDEMPOTENCY_INDEX_VIOLATION");
        if (result.items[0] && _isRecognizedSyntheticLedgerItem(result.items[0])) return _virtualRecord(result.items[0]);
    }
    return null;
}

function assertSameRequest(existing, fingerprint) {
    const existingFingerprint = existing?.payloadFiscal?.requestFingerprint ||
        existing?.payload?.requestFingerprint ||
        existing?.conceptOperations?.tpvSandbox?.requestFingerprint;
    if (existingFingerprint !== fingerprint) throw new Error("TPV_IDEMPOTENCY_CONFLICT");
    return { item: existing, replayed: true };
}

function _buildSyntheticLedgerItem(collection, key, record, fingerprint) {
    const movementType = TPV_EVENT_MOVEMENT_TYPES[collection];
    if (!movementType) throw new Error("TPV_COLLECTION_NOT_ALLOWED");
    const now = record.createdAt || record.generatedAt || record.occurredAt || new Date();
    const timestamp = now instanceof Date ? now : new Date(now);
    if (Number.isNaN(timestamp.getTime())) throw new Error("TPV_RECORD_TIMESTAMP_INVALID");
    const dateYmd = timestamp.toLocaleDateString("en-CA", { timeZone: TPV_RUNTIME_POLICY.TIME_ZONE });
    const transactionId = _testTransactionId(collection, key);
    const amount = _eventAmount(record);
    const sessionId = String(record.sessionId || record.payload?.sessionId || "").trim();
    const traceId = "TPV:" + TPV_RUNTIME_POLICY.SITE_ID + ":" + String(sessionId || "GLOBAL");
    const envelope = {
        sourceType: TPV_RUNTIME_POLICY.SOURCE_TYPE,
        siteId: TPV_RUNTIME_POLICY.SITE_ID,
        ledgerVersion: TPV_RUNTIME_POLICY.LEDGER_VERSION,
        sessionId: sessionId || null,
        logicalCollection: collection,
        idempotencyKey: key,
        requestFingerprint: fingerprint,
        schemaVersion: 2,
        reconciliationStatus: "NOT_RECONCILED",
        sandboxRecord: record,
        isSynthetic: true,
        realPayment: false,
        externalSideEffects: false,
    };
    const hashPayload = stableSerialize({
        sourceType: TPV_RUNTIME_POLICY.SOURCE_TYPE,
        siteId: TPV_RUNTIME_POLICY.SITE_ID,
        ledgerVersion: TPV_RUNTIME_POLICY.LEDGER_VERSION,
        sessionId: sessionId || null,
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
        numSerieFactura: "TPV-SYNTHETIC-NO-FISCAL-" + transactionId.slice(-20),
        transactionId,
        previousRecordHash: TPV_GENESIS_HASH,
        recordTimestamp: timestamp,
        schemaVersion: 2,
        traceId,
        movementType,
        totalAmount: amount,
        amount,
        taxBase: 0,
        taxAmount: 0,
        paymentMethod: String(record.paymentMethod || "OTROS").toUpperCase(),
        channelType: "PRESENCIAL",
        operationDescription: "TPV SYNTHETIC " + collection,
        staffResourceId: String(record.operatorResourceId || ""),
        tipoFactura: "F2",
        fechaExpedicionFactura: dateYmd,
        tipoImpositivo: 0,
        fiscalPeriod: dateYmd.slice(0, 7),
        recordSource: TPV_LEDGER_SOURCE,
        payloadFiscal: envelope,
        desgloseDetallado: { accountCode: "SIMULATED" },
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

export async function insertTpvEvent(collection, idempotencyKey, data) {

    _assertLogicalCollection(collection);
    const key = normalizeIdempotencyKey(idempotencyKey);
    const record = { ...data };
    const fingerprint = _fingerprintOf(record);

    if (collection === TPV_COLLECTIONS.SESIONES_CAJA) {
        return withCajaActualProjectionLock(
            "TPV_SESSION:" + key,
            async (lock) => {
                const caja = await _ensureCajaActualForSandbox();
                assertTpvCajaIntegrity(caja, { allowBootstrap: true });
                const existing = await findByIdempotencyKey(collection, key);
                if (existing?.sessionId === record.sessionId) return assertSameRequest(existing, fingerprint);
                if (caja.closedAt == null && _sessionFromCaja(caja)) {
                    throw new Error("TPV_PREVIOUS_SESSION_NOT_CLOSED");
                }
                const updated = _sessionCajaPatch(caja, record, fingerprint);
                await assertFiscalLedgerLock(lock);
                const saved = await updateItem(BUSINESS_COLLECTIONS.CAJA_ACTUAL, updated);
                return { item: _sessionFromCaja(saved), replayed: false };
            }
        );
    }

    const caja = await _getCajaActual();
    assertTpvCajaIntegrity(caja);
    const existing = await findByIdempotencyKey(collection, key);
    if (existing) {
        const replay = assertSameRequest(existing, fingerprint);
        if (_shouldProject(collection, existing)) {
            await _writeCajaProjection(collection, existing, existing._id, existing.hash);
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
            await _writeCajaProjection(collection, winner, winner._id, winner.hash);
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
        await _writeCajaProjection(collection, record, item._id, item.hash);
    }
    return { item, replayed: false };
}

export async function queryTpvRecords(collection, filter, options = {}) {

    _assertLogicalCollection(collection);
    if (collection === TPV_COLLECTIONS.SESIONES_CAJA) {
        const session = _sessionFromCaja(await _getCajaActual());
        const sessions = session ? [session] : [];
        return sessions.filter((item) => _matchesFilter(item, filter));
    }
    const movementType = TPV_EVENT_MOVEMENT_TYPES[collection];
    if (!movementType) throw new Error("TPV_COLLECTION_NOT_ALLOWED");
    const pageSize = Math.min(1000, Math.max(1, Math.floor(Number(options.limit || 1000))));
    const result = await queryItems({
        dataCollectionId: BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA,
        filter: wql.eq("movementType", movementType),
        sort: ["recordTimestamp ASC"],
        limit: pageSize,
        consistency: CONSISTENCY.STRONG,
    });
    const records = result.items.map(_virtualRecord).filter((item) =>
        _isRecognizedSyntheticLedgerItem(item) && _matchesFilter(item, filter)
    );
    if (options.allowTruncated === true) return records;
    const maxRecords = Math.max(pageSize, Math.floor(Number(options.maxRecords || 10000)));
    let page = result;
    while (page.hasNext && records.length < maxRecords) {
        page = await page.next();
        records.push(...page.items.map(_virtualRecord).filter((item) =>
            _isRecognizedSyntheticLedgerItem(item) && _matchesFilter(item, filter)
        ));
    }
    if (page.hasNext) throw new Error("TPV_QUERY_LIMIT_EXCEEDED");
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

export async function queryTpvLedgerRecords(options = {}) {

    const limit = Number(options.limit ?? 100);
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
        throw new Error("TPV_LEDGER_INVALID_LIMIT");
    }
    const [current, legacy] = await Promise.all([
        queryItems({
            dataCollectionId: BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA,
            filter: wql.eq("recordSource", TPV_LEDGER_SOURCE),
            sort: ["recordTimestamp DESC"],
            limit,
            consistency: CONSISTENCY.STRONG,
        }),
        queryItems({
            dataCollectionId: BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA,
            filter: wql.eq("recordSource", LEGACY_TPV_LEDGER_SOURCE),
            sort: ["recordTimestamp DESC"],
            limit,
            consistency: CONSISTENCY.STRONG,
        }),
    ]);
    const records = [...current.items, ...legacy.items]
        .map(_virtualRecord)
        .filter(_isRecognizedSyntheticLedgerItem)
        .sort((a, b) => new Date(b.recordTimestamp || 0).getTime() - new Date(a.recordTimestamp || 0).getTime())
        .slice(0, limit);
    return { records, hasMore: current.hasNext === true || legacy.hasNext === true ||
        current.items.length + legacy.items.length > limit };
}

export async function appendTpvAudit({
    idempotencyKey,
    action,
    actorId,
    entityType,
    entityId,
    traceId,
    payload = {},
}) {
    const { item, replayed } = await insertTpvEvent(
        TPV_COLLECTIONS.AUDITORIA,
        idempotencyKey,
        {
            action: String(action || "UNKNOWN").slice(0, 80),
            actorId: String(actorId || "UNKNOWN").slice(0, 100),
            entityType: String(entityType || "TPV").slice(0, 80),
            entityId: String(entityId || "").slice(0, 120),
            occurredAt: new Date(),
            source: "TPV_WEB_METHOD",
            payload: { ...payload, traceId: String(traceId || "") },
        }
    );
    return { item, replayed };
}

export async function latestOpenTpvSession() {
    const sessions = await queryTpvRecords(
        TPV_COLLECTIONS.SESIONES_CAJA,
        undefined,
        { sort: ["_createdDate DESC"], limit: 1000 }
    );
    const closures = await queryTpvRecords(TPV_COLLECTIONS.TICKET_Z, undefined);
    const closedSessionIds = new Set(closures.filter((item) => item.closed === true).map((item) => item.sessionId));
    return sessions.find((session) =>
        session.status === "ABIERTA" && !closedSessionIds.has(session.sessionId)
    ) || null;
}


export async function getCommittedTpvSales(sessionId) {
    const records = await queryTpvRecords(TPV_COLLECTIONS.VENTAS, undefined);
    return records.filter((item) =>
        item.status === "CONFIRMADA_SINTETICA" &&
        item.payload?.sessionId === sessionId
    );
}

export async function getPendingTpvSales(sessionId) {
    const records = await queryTpvRecords(TPV_COLLECTIONS.VENTAS, undefined);
    const committedIds = new Set(records
        .filter((item) => item.status === "CONFIRMADA_SINTETICA")
        .map((item) => item.saleId));
    return records.filter((item) =>
        item.status === "PREPARADA_SINTETICA" &&
        item.payload?.sessionId === sessionId &&
        !committedIds.has(item.saleId)
    );
}

export async function getTpvPayments(sessionId) {
    const records = await queryTpvRecords(TPV_COLLECTIONS.PAGOS, undefined);
    return records.filter((item) => item.payload?.sessionId === sessionId);
}

export async function getPendingTpvRefunds(sessionId) {
    const [refunds, payments, movements] = await Promise.all([
        getTpvRefunds(sessionId),
        getTpvPayments(sessionId),
        getTpvCashMovements(sessionId),
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

export async function getTpvRefunds(sessionId) {
    const records = await queryTpvRecords(TPV_COLLECTIONS.REEMBOLSOS, undefined);
    return records.filter((item) =>
        item.status === "CONFIRMADO_SINTETICO" &&
        item.payload?.sessionId === sessionId
    );
}

export async function getTpvCashMovements(sessionId) {
    return queryTpvRecords(
        TPV_COLLECTIONS.MOVIMIENTOS_CAJA,
        wql.eq("sessionId", sessionId)
    );
}
