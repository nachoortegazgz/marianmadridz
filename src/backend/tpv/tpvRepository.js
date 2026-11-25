/*
P1/P3 OFFICIAL REFERENCES:
- Wix Studio Forum: "Handling concurrent requests…" — deterministic insert key and
  duplicate-key recovery; Wix Data conditional bulkPatch compare-and-set.
- Wix Payments API: "Processing Payments" — idempotent transaction identity
  (wixTransactionId / stable transaction key).
*/
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
import { TPV_COLLECTIONS, TPV_EVENT_MOVEMENT_TYPES, TPV_LEGACY_EVENT_MOVEMENT_TYPES, TPV_HISTORICAL_POLICY, TPV_LEDGER_SOURCE, TPV_PAYMENT_METHOD, TPV_RUNTIME_POLICY, CONTROL_TYPE, OPERATIONAL_COLLECTIONS, BUSINESS_COLLECTIONS, SINGLETONS } from "backend/internalConfig";
import { logger } from "backend/logger";
import { createPersistedTpvProjectionError } from "backend/tpv/tpvMovementContracts";
import {

    assertTpvCajaIntegrity,
    getTpvRuntimeState,
    normalizeIdempotencyKey,
    stableSerialize,
    makeTpvRefundLockId,
    makeTpvSessionLockId,
    makeTpvTransactionId,
} from "backend/tpv/tpvUtils";
import {
    acquireFiscalLedgerLock,
    assertFiscalLedgerLock,
    releaseFiscalLedgerLock,
} from "backend/fiscalLedgerLock";

const ALLOWED_TPV_COLLECTIONS = new Set(Object.values(TPV_COLLECTIONS));
const REFUND_LOCK_TTL_MS = 300000;

/**
 * Fiscal configuration gates fiscal-ledger writes only. Physical cash,
 * commercial sales and operational audit records have independent stores.
 */
export function assertTpvOperationalLedgerConfigured(ledgerType = "fiscal") {
    if (["physical", "commercial", "audit"].includes(ledgerType)) return true;
    if (ledgerType !== "fiscal") throw new Error("TPV_LEDGER_TYPE_INVALID");
    const error = new Error("TPV_OPERATIONAL_LEDGER_NOT_CONFIGURED");
    error.code = "TPV_OPERATIONAL_LEDGER_NOT_CONFIGURED";
    throw error;
}

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

function _isDuplicateTpvKeyError(error) {
    const code = String(
        error?.code ||
        error?.details?.applicationError?.code ||
        error?.details?.code ||
        ""
    ).toUpperCase();
    return code === "DUPLICATE_KEY" ||
        code === "WDE0023" ||
        /DUPLICATE[_ ]KEY|WDE0023|ALREADY EXISTS/i.test(String(error?.message || ""));
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
            if (!_isDuplicateTpvKeyError(error)) throw error;
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
    const caja = await _ensureCajaActual();
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

const TPV_GENESIS_HASH = "0".repeat(64);

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

function _isHistoricalTpvLedgerItem(item) {
    if (!item || typeof item !== "object" || Array.isArray(item) || !(Object.values(TPV_EVENT_MOVEMENT_TYPES).includes(item.movementType) || Object.values(TPV_LEGACY_EVENT_MOVEMENT_TYPES).includes(item.movementType))) return false;
    const envelope = item.payloadFiscal && typeof item.payloadFiscal === "object" ? item.payloadFiscal : {};
    const validHash = /^[a-f0-9]{64}$/i.test(String(item.hash || "")) && Number(item.sequenceNumber) === 0;
    const validFingerprint = /^[a-f0-9]{64}$/i.test(String(envelope.requestFingerprint || ""));
    const validCommon = [TPV_EVENT_MOVEMENT_TYPES, TPV_LEGACY_EVENT_MOVEMENT_TYPES].some((types) => types[envelope.logicalCollection] === item.movementType) &&
        (envelope.isSynthetic === undefined || envelope.isSynthetic === true) &&
        (envelope.realPayment === undefined || envelope.realPayment === false) &&
        envelope.externalSideEffects === false && validHash;
    const validCurrentCommon = validCommon && validFingerprint;
    const validSessionOrAudit = envelope.logicalCollection === TPV_COLLECTIONS.AUDITORIA ||
        Boolean(String(envelope.sessionId || "").trim());
    const validTraceForSite = String(item.traceId || "").startsWith("TPV:" + TPV_RUNTIME_POLICY.SITE_ID + ":");
    const currentRecordSources = [TPV_LEDGER_SOURCE, TPV_HISTORICAL_POLICY.CASH_REGISTER_SOURCE];
    const currentV2 = currentRecordSources.includes(item.recordSource) &&
        envelope.sourceType === TPV_HISTORICAL_POLICY.SOURCE_TYPE &&
        envelope.siteId === TPV_RUNTIME_POLICY.SITE_ID &&
        envelope.ledgerVersion === TPV_HISTORICAL_POLICY.LEDGER_VERSION &&
        Number(envelope.schemaVersion) === TPV_HISTORICAL_POLICY.SCHEMA_VERSION &&
        envelope.reconciliationStatus === "NOT_RECONCILED" &&
        validSessionOrAudit && validTraceForSite;
    const currentV1 = currentRecordSources.includes(item.recordSource) &&
        envelope.sourceType === TPV_HISTORICAL_POLICY.SOURCE_TYPE &&
        envelope.siteId === TPV_RUNTIME_POLICY.SITE_ID &&
        envelope.ledgerVersion === TPV_HISTORICAL_POLICY.LEDGER_VERSION &&
        (envelope.schemaVersion === undefined || envelope.schemaVersion === null || Number(envelope.schemaVersion) === 1) &&
        (envelope.reconciliationStatus === undefined || envelope.reconciliationStatus === "NOT_RECONCILED") &&
        validSessionOrAudit && validTraceForSite;
    const legacyRunId = String(envelope.legacyRunId || envelope.sandboxRunId || "").trim();
    const legacy = [
        TPV_HISTORICAL_POLICY.LEGACY_LEDGER_SOURCE,
        TPV_HISTORICAL_POLICY.CASH_REGISTER_SOURCE,
    ].includes(item.recordSource) &&
        legacyRunId === TPV_HISTORICAL_POLICY.LEGACY_RUN_ID &&
        (String(item.traceId || "").startsWith("TPV:" + legacyRunId + ":") ||
            String(item.traceId || "") === legacyRunId);
    return (validCurrentCommon && (currentV2 || currentV1)) || (validCommon && legacy);
}
function _isCanonicalTpvLedgerItem(item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const envelope = item.payloadFiscal && typeof item.payloadFiscal === "object" ? item.payloadFiscal : {};
    return item.recordSource === TPV_LEDGER_SOURCE &&
        Object.values(TPV_EVENT_MOVEMENT_TYPES).includes(item.movementType) &&
        Number.isSafeInteger(Number(item.sequenceNumber)) && Number(item.sequenceNumber) > 0 &&
        envelope.sourceType === TPV_RUNTIME_POLICY.SOURCE_TYPE &&
        envelope.siteId === TPV_RUNTIME_POLICY.SITE_ID &&
        envelope.ledgerVersion === TPV_RUNTIME_POLICY.LEDGER_VERSION &&
        Number(envelope.schemaVersion) === TPV_RUNTIME_POLICY.SCHEMA_VERSION &&
        Boolean(String(envelope.sessionId || "").trim()) &&
        /^[a-f0-9]{64}$/i.test(String(item.hash || "")) &&
        /^[a-f0-9]{64}$/i.test(String(item.previousRecordHash || ""));
}

function _virtualRecord(item) {
    const envelope = item?.payloadFiscal && typeof item.payloadFiscal === "object"
        ? item.payloadFiscal
        : {};
    const record = envelope.ledgerRecord && typeof envelope.ledgerRecord === "object"
        ? envelope.ledgerRecord
        : envelope.sandboxRecord && typeof envelope.sandboxRecord === "object"
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
    };
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

async function _ensureCajaActual() {
    const caja = await _getCajaActual();
    if (!caja) throw new Error("TPV_CASH_REGISTER_NOT_SEEDED");
    assertTpvCajaIntegrity(caja, { allowBootstrap: true });
    return caja;
}

function _sessionFromCaja(caja) {
    const state = getTpvRuntimeState(caja);
    const sessionId = String(state?.sessionId || "").trim();
    const valid = ["ABIERTA", "CERRADA"].includes(caja?.cashRegisterStatus) &&
        caja?.snapshotSource === TPV_RUNTIME_POLICY.CASH_REGISTER_SOURCE &&
        state?.sourceType === TPV_RUNTIME_POLICY.SOURCE_TYPE &&
        state?.siteId === TPV_RUNTIME_POLICY.SITE_ID &&
        state?.ledgerVersion === TPV_RUNTIME_POLICY.LEDGER_VERSION &&
        Number(state?.schemaVersion) === TPV_RUNTIME_POLICY.SCHEMA_VERSION &&
        Boolean(sessionId) &&
        /^[a-f0-9]{64}$/i.test(String(state?.eventHash || ""));
    if (!valid) return null;
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
        operatorId: state.operatorId || caja.openedBy || null,
        actorId: state.actorId || caja.openedBy || null,
        operatorDisplayName: String(state.operatorDisplayName || "").trim() || null,
        operatorResourceId: String(state.operatorResourceId || "").trim() || null,
        payload: {
            sessionId,
            sourceType: TPV_RUNTIME_POLICY.SOURCE_TYPE,
            siteId: TPV_RUNTIME_POLICY.SITE_ID,
            ledgerVersion: TPV_RUNTIME_POLICY.LEDGER_VERSION,
            schemaVersion: TPV_RUNTIME_POLICY.SCHEMA_VERSION,
        },
        payloadFiscal: { requestFingerprint: state.requestFingerprint || null },
        traceId: caja.traceId || null,
        _createdDate: caja._createdDate,
        _updatedDate: caja._updatedDate,
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
            const preflightRuntimeState = getTpvRuntimeState(caja);
            const canonicalRuntime = caja.snapshotSource === TPV_RUNTIME_POLICY.CASH_REGISTER_SOURCE &&
                preflightRuntimeState.sourceType === TPV_RUNTIME_POLICY.SOURCE_TYPE &&
                preflightRuntimeState.siteId === TPV_RUNTIME_POLICY.SITE_ID &&
                preflightRuntimeState.ledgerVersion === TPV_RUNTIME_POLICY.LEDGER_VERSION &&
                Number(preflightRuntimeState.schemaVersion) === TPV_RUNTIME_POLICY.SCHEMA_VERSION &&
                /^[a-f0-9]{64}$/i.test(String(preflightRuntimeState.eventHash || "")) &&
                Boolean(String(preflightRuntimeState.sessionId || "").trim());
            if (!canonicalRuntime) throw new Error("TPV_CASH_REGISTER_INTEGRITY_FAILED");
            const conceptOperations = caja.conceptOperations && typeof caja.conceptOperations === "object"
                ? { ...caja.conceptOperations }
                : {};
            const sourceState = { ...getTpvRuntimeState({ conceptOperations }) };
            const appliedIds = Array.isArray(sourceState.appliedMovementIds) ? sourceState.appliedMovementIds : [];
            if (eventId && appliedIds.includes(eventId)) return caja;
            if (eventId && appliedIds.length >= MAX_TPV_PROJECTION_EVENTS) {
                throw new Error("TPV_PROJECTION_IDEMPOTENCY_LIMIT");
            }
            const now = new Date();
            const next = { ...caja, _updatedDate: now };
            next.lastOperationId = eventId || caja.lastOperationId;
            next.lastOperationAt = now;
            next.lastOperationStatus = "REGISTRADO";
            next.traceId = String(record.traceId || caja.traceId || "");
            next.snapshotSource = TPV_RUNTIME_POLICY.CASH_REGISTER_SOURCE;
            next.cashRegisterStatus = collection === TPV_COLLECTIONS.TICKET_Z ? "CERRADA" : "ABIERTA";

            if (collection === TPV_COLLECTIONS.VENTAS && record.status === "CONFIRMADA") {
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
            sourceState.sourceType = TPV_RUNTIME_POLICY.SOURCE_TYPE;
            sourceState.siteId = TPV_RUNTIME_POLICY.SITE_ID;
            sourceState.ledgerVersion = TPV_RUNTIME_POLICY.LEDGER_VERSION;
            sourceState.schemaVersion = TPV_RUNTIME_POLICY.SCHEMA_VERSION;
            sourceState.eventHash = String(eventHash || sourceState.eventHash || "");
            sourceState.sessionId = String(sourceState.sessionId || record.sessionId || record.payload?.sessionId || "");
            sourceState.appliedMovementIds = eventId ? [...appliedIds, eventId] : appliedIds;
            sourceState.lastProjectedAt = now;
            conceptOperations.tpvRuntime = sourceState;
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
        record?.status === "CONFIRMADA";
}

async function _projectPersistedTpvEvent(collection, record, recordId, hash, idempotencyKey, replayed) {
    if (!_shouldProject(collection, record)) return;
    try {
        await _writeCajaProjection(collection, record, recordId, hash);
    } catch (cause) {
        throw createPersistedTpvProjectionError(cause, {
            recordId,
            idempotencyKey,
            replayed,
        });
    }
}

function _sessionCajaPatch(caja, record, eventHash) {
    const openedAt = record.openedAt instanceof Date ? record.openedAt : new Date(record.openedAt || Date.now());
    const openingCash = Number(record.openingCashMinor || 0) / 100;
    return {
        ...caja,
        cashRegisterStatus: "ABIERTA",
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
        snapshotSource: TPV_RUNTIME_POLICY.CASH_REGISTER_SOURCE,
        traceId: String(record.payload?.traceId || "TPV_SESSION:" + record.sessionId),
        lastOperationId: "TPV_SESSION_OPEN:" + record.sessionId,
        lastOperationType: "TPV_SESSION_OPEN",
        lastOperationAmount: openingCash,
        lastOperationPaymentMethod: "EFECTIVO",
        lastOperationAt: openedAt,
        lastOperationStatus: "REGISTRADO",
        conceptOperations: {
            ...(caja.conceptOperations && typeof caja.conceptOperations === "object" ? caja.conceptOperations : {}),
            tpvRuntime: {
                sourceType: TPV_RUNTIME_POLICY.SOURCE_TYPE,
                siteId: TPV_RUNTIME_POLICY.SITE_ID,
                ledgerVersion: TPV_RUNTIME_POLICY.LEDGER_VERSION,
                schemaVersion: TPV_RUNTIME_POLICY.SCHEMA_VERSION,
                eventHash: String(eventHash || ""),
                sessionId: record.sessionId,
                actorId: String(record.actorId || record.operatorId || record.cashierMemberId || "").trim() || null,
                operatorId: String(record.operatorId || record.cashierMemberId || "").trim() || null,
                operatorDisplayName: String(record.operatorDisplayName || "").trim() || null,
                operatorResourceId: String(record.operatorResourceId || "").trim() || null,
                requestFingerprint: String(record.requestFingerprint || eventHash || "") || null,
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
    const transactionId = _testTransactionId(collection, key);
    for (const currentTransactionId of [transactionId]) {
        const result = await queryItems({
            dataCollectionId: BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA,
            filter: wql.and(
                wql.eq("movementType", movementType),
                wql.eq("transactionId", currentTransactionId)
            ),
            limit: 2,
            consistency: CONSISTENCY.STRONG,
        });
        if (result.items.length > 1) throw new Error("TPV_IDEMPOTENCY_INDEX_VIOLATION");
        if (result.items[0] && _isCanonicalTpvLedgerItem(result.items[0])) return _virtualRecord(result.items[0]);
    }
    return null;
}

function assertSameRequest(existing, fingerprint) {
    const existingFingerprint = existing?.payloadFiscal?.requestFingerprint ||
        existing?.payload?.requestFingerprint ||
        getTpvRuntimeState(existing).requestFingerprint;
    if (existingFingerprint !== fingerprint) throw new Error("TPV_IDEMPOTENCY_CONFLICT");
    return { item: existing, replayed: true };
}

function _buildTpvLedgerItem(collection, key, record, fingerprint) {
    const movementType = TPV_EVENT_MOVEMENT_TYPES[collection];
    if (!movementType) throw new Error("TPV_COLLECTION_NOT_ALLOWED");
    const now = record.createdAt || record.generatedAt || record.occurredAt || new Date();
    const timestamp = now instanceof Date ? now : new Date(now);
    if (Number.isNaN(timestamp.getTime())) throw new Error("TPV_RECORD_TIMESTAMP_INVALID");
    const transactionId = _testTransactionId(collection, key);
    const amount = _eventAmount(record);
    const sessionId = String(record.sessionId || record.payload?.sessionId || "").trim();
    if (!sessionId) throw new Error("TPV_SESSION_REQUIRED");
    const sequenceNumber = Number(record.sequenceNumber);
    const previousRecordHash = String(record.previousRecordHash || "");
    if (!Number.isSafeInteger(sequenceNumber) || sequenceNumber <= 0 ||
        !/^[a-f0-9]{64}$/i.test(previousRecordHash)) {
        throw new Error("TPV_LEDGER_SEQUENCE_OR_PREVIOUS_HASH_REQUIRED");
    }
    const traceId = "TPV:" + TPV_RUNTIME_POLICY.SITE_ID + ":" + sessionId;
    const envelope = {
        sourceType: TPV_RUNTIME_POLICY.SOURCE_TYPE,
        siteId: TPV_RUNTIME_POLICY.SITE_ID,
        ledgerVersion: TPV_RUNTIME_POLICY.LEDGER_VERSION,
        schemaVersion: TPV_RUNTIME_POLICY.SCHEMA_VERSION,
        sessionId,
        logicalCollection: collection,
        idempotencyKey: key,
        requestFingerprint: fingerprint,
        ledgerRecord: record,
    };
    const hashPayload = stableSerialize({
        sourceType: TPV_RUNTIME_POLICY.SOURCE_TYPE,
        siteId: TPV_RUNTIME_POLICY.SITE_ID,
        ledgerVersion: TPV_RUNTIME_POLICY.LEDGER_VERSION,
        schemaVersion: TPV_RUNTIME_POLICY.SCHEMA_VERSION,
        sessionId,
        logicalCollection: collection,
        transactionId,
        traceId,
        sequenceNumber,
        previousRecordHash,
        record,
    });
    const hash = createHash("sha256").update(hashPayload).digest("hex");
    return {
        _id: transactionId,
        hash,
        sequenceNumber,
        transactionId,
        previousRecordHash,
        recordTimestamp: timestamp,
        schemaVersion: String(TPV_RUNTIME_POLICY.SCHEMA_VERSION),
        traceId,
        movementType,
        totalAmount: amount,
        amount,
        taxBase: 0,
        taxAmount: 0,
        paymentMethod: String(record.paymentMethod || "OTROS").toUpperCase(),
        channelType: "PRESENCIAL",
        operationDescription: String(record.concept || record.description || "Operación TPV").slice(0, 180),
        staffResourceId: String(record.operatorResourceId || ""),
        recordSource: TPV_LEDGER_SOURCE,
        payloadFiscal: envelope,
        lineItems: { ledgerRecord: record.lineItems || [] },
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

export async function insertTpvEvent(collection, idempotencyKey, data, { ledgerType = "physical" } = {}) {

    assertTpvOperationalLedgerConfigured(ledgerType);
    if (collection === TPV_COLLECTIONS.AUDITORIA) {
        return appendTpvAudit({
            idempotencyKey,
            action: data?.action,
            actorId: data?.actorId,
            entityType: data?.entityType,
            entityId: data?.entityId,
            traceId: data?.payload?.traceId || data?.traceId,
            payload: data?.payload || {},
        });
    }

    _assertLogicalCollection(collection);
    const key = normalizeIdempotencyKey(idempotencyKey);
    const record = { ...data };
    const fingerprint = _fingerprintOf(record);

    if (collection === TPV_COLLECTIONS.SESIONES_CAJA) {
        return withCajaActualProjectionLock(
            "TPV_SESSION:" + key,
            async (lock) => {
                const caja = await _ensureCajaActual();
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
        await _projectPersistedTpvEvent(
            collection, existing, existing._id, existing.hash, key, true
        );
        return replay;
    }

    const latestPage = await queryItems({
        dataCollectionId: BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA,
        filter: wql.eq("recordSource", TPV_LEDGER_SOURCE),
        sort: ["sequenceNumber DESC"],
        limit: 1,
        consistency: CONSISTENCY.STRONG,
    });
    const latestPhysicalRecord = latestPage.items[0] || null;
    const previousSequence = latestPhysicalRecord ? Number(latestPhysicalRecord.sequenceNumber) : 0;
    const previousHash = latestPhysicalRecord ? String(latestPhysicalRecord.hash || "") : TPV_GENESIS_HASH;
    if (latestPhysicalRecord && (
        !Number.isSafeInteger(previousSequence) || previousSequence <= 0 ||
        !/^[a-f0-9]{64}$/i.test(previousHash)
    )) {
        throw new Error("TPV_PHYSICAL_LEDGER_CHAIN_BROKEN");
    }
    const physicalRecord = {
        ...record,
        sequenceNumber: previousSequence + 1,
        previousRecordHash: previousHash,
    };
    const ledgerItem = _buildTpvLedgerItem(collection, key, physicalRecord, fingerprint);
    let saved;
    try {
        saved = await insertItem(BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA, ledgerItem);
    } catch (error) {
        if (!_isDuplicateTpvKeyError(error)) throw error;
        const winner = await findByIdempotencyKey(collection, key);
        if (!winner) throw error;
        const replay = assertSameRequest(winner, fingerprint);
        await _projectPersistedTpvEvent(
            collection, winner, winner._id, winner.hash, key, true
        );
        return replay;
    }

    const item = _virtualRecord({
        ...ledgerItem,
        _id: saved?._id || ledgerItem._id,
        _createdDate: saved?._createdDate || new Date(),
        _updatedDate: saved?._updatedDate || new Date(),
    });
    await _projectPersistedTpvEvent(
        collection, record, item._id, item.hash, key, false
    );
    return { item, replayed: false };
}

export async function queryTpvRecords(collection, filter, options = {}) {

    _assertLogicalCollection(collection);
    if (collection === TPV_COLLECTIONS.VENTAS) {
        const pageSize = Math.min(1000, Math.max(1, Math.floor(Number(options.limit || 1000))));
        const maxRecords = Math.max(pageSize, Math.floor(Number(options.maxRecords || 10000)));
        let page = await queryItems({
            dataCollectionId: BUSINESS_COLLECTIONS.TRANSACCIONES_TPV,
            sort: ["createdAt ASC"],
            limit: pageSize,
            consistency: CONSISTENCY.STRONG,
        });
        const records = [];
        const appendSalesPage = (current) => records.push(...current.items.map((item) => ({
            ...item,
            saleId: item._id,
            totalMinor: item.totalVentaMinor,
            amountMinor: item.totalVentaMinor,
            taxMinor: item.impuestosTotalMinor,
            discountMinor: 0,
            paymentMethod: item.medioPago,
            cmsMovementType: "TPV_SALE",
            operationDescription: "Venta TPV",
            createdAt: item.createdAt,
        })).filter((item) => _matchesFilter(item, filter)));
        appendSalesPage(page);
        while (page.hasNext && records.length < maxRecords) {
            page = await page.next();
            appendSalesPage(page);
        }
        if (page.hasNext && options.allowTruncated !== true) throw new Error("TPV_QUERY_LIMIT_EXCEEDED");
        const sortSpec = Array.isArray(options.sort) && options.sort.length ? options.sort : ["createdAt ASC"];
        const [field, direction = "ASC"] = String(sortSpec[0]).split(/\\s+/);
        records.sort((a, b) => {
            const av = field.split(".").reduce((value, key) => value?.[key], a);
            const bv = field.split(".").reduce((value, key) => value?.[key], b);
            const comparison = av < bv ? -1 : av > bv ? 1 : 0;
            return direction.toUpperCase() === "DESC" ? -comparison : comparison;
        });
        return records.slice(0, maxRecords);
    }

    if (collection === TPV_COLLECTIONS.AUDITORIA) {
        const pageSize = Math.min(1000, Math.max(1, Math.floor(Number(options.limit || 1000))));
        const maxRecords = Math.max(pageSize, Math.floor(Number(options.maxRecords || 10000)));
        let page = await queryItems({
            dataCollectionId: OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO,
            filter: wql.eq("controlType", CONTROL_TYPE.TPV_AUDIT_EVENT),
            sort: ["processedAt DESC"],
            limit: pageSize,
            consistency: CONSISTENCY.STRONG,
        });
        const records = [];
        const appendAuditPage = (current) => records.push(...current.items.map((item) => ({
            ...item,
            action: item.payload?.action || "UNKNOWN",
            actorId: item.payload?.actorId || null,
            entityType: item.payload?.entityType || null,
            entityId: item.payload?.entityId || null,
            occurredAt: item.processedAt || null,
            source: item.payload?.source || "TPV_WEB_METHOD",
        })).filter((item) => _matchesFilter(item, filter)));
        appendAuditPage(page);
        while (page.hasNext && records.length < maxRecords) {
            page = await page.next();
            appendAuditPage(page);
        }
        if (page.hasNext && options.allowTruncated !== true) throw new Error("TPV_QUERY_LIMIT_EXCEEDED");
        return records.slice(0, maxRecords);
    }
    if (collection === TPV_COLLECTIONS.SESIONES_CAJA) {
        const session = _sessionFromCaja(await _getCajaActual());
        const sessions = session ? [session] : [];
        return sessions.filter((item) => _matchesFilter(item, filter));
    }
    const movementType = TPV_EVENT_MOVEMENT_TYPES[collection];
    const movementTypes = movementType ? [movementType] : [];
    if (!movementTypes.length) throw new Error("TPV_COLLECTION_NOT_ALLOWED");
    const pageSize = Math.min(1000, Math.max(1, Math.floor(Number(options.limit || 1000))));
    const maxRecords = Math.max(pageSize, Math.floor(Number(options.maxRecords || 10000)));
    const pages = await Promise.all(movementTypes.map((movementType) => queryItems({
        dataCollectionId: BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA,
        filter: wql.eq("movementType", movementType),
        sort: ["recordTimestamp ASC"],
        limit: pageSize,
        consistency: CONSISTENCY.STRONG,
    })));
    const records = [];
    const appendPage = (page) => records.push(...page.items
        .filter(_isCanonicalTpvLedgerItem)
        .map(_virtualRecord)
        .filter((item) => _matchesFilter(item, filter)));
    pages.forEach(appendPage);
    if (options.allowTruncated !== true) {
        while (pages.some((page) => page.hasNext) && records.length < maxRecords) {
            for (let index = 0; index < pages.length; index += 1) {
                if (pages[index].hasNext && records.length < maxRecords) {
                    pages[index] = await pages[index].next();
                    appendPage(pages[index]);
                }
            }
        }
        if (pages.some((page) => page.hasNext)) throw new Error("TPV_QUERY_LIMIT_EXCEEDED");
    }
    const sortSpec = Array.isArray(options.sort) && options.sort.length
        ? options.sort
        : ["recordTimestamp ASC"];
    if (sortSpec.length) {
        const [field, direction = "ASC"] = String(sortSpec[0]).split(/\s+/);
        records.sort((a, b) => {
            const av = field.split(".").reduce((v, k) => v?.[k], a);
            const bv = field.split(".").reduce((v, k) => v?.[k], b);
            const cmp = av < bv ? -1 : av > bv ? 1 : 0;
            return direction.toUpperCase() === "DESC" ? -cmp : cmp;
        });
    }
    return records.slice(0, maxRecords);
}

/**
 * Operational reader: returns only records written under the canonical TPV contract.
 * Historical rows are deliberately excluded from all normal business queries.
 */
export async function queryTpvOperationalLedgerRecords(options = {}) {
    const limit = Number(options.limit ?? 100);
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
        throw new Error("TPV_LEDGER_INVALID_LIMIT");
    }
    const result = await queryItems({
        dataCollectionId: BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA,
        filter: wql.eq("recordSource", TPV_LEDGER_SOURCE),
        sort: ["recordTimestamp DESC"],
        limit,
        consistency: CONSISTENCY.STRONG,
    });
    const records = result.items
        .filter(_isCanonicalTpvLedgerItem)
        .map(_virtualRecord)
        .sort((a, b) => new Date(b.recordTimestamp || 0).getTime() - new Date(a.recordTimestamp || 0).getTime())
        .slice(0, limit);
    return { records, hasMore: result.hasNext === true };
}

/**
 * Explicit historical reader only. It never participates in current operational
 * movement, audit, payment, cash-session or closure calculations.
 */
export async function queryHistoricalTpvLedgerRecords(options = {}) {
    const limit = Number(options.limit ?? 100);
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
        throw new Error("TPV_LEDGER_INVALID_LIMIT");
    }
    const [currentSource, legacy, previous] = await Promise.all([
        queryItems({
            dataCollectionId: BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA,
            filter: wql.eq("recordSource", TPV_LEDGER_SOURCE),
            sort: ["recordTimestamp DESC"],
            limit,
            consistency: CONSISTENCY.STRONG,
        }),
        queryItems({
            dataCollectionId: BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA,
            filter: wql.eq("recordSource", TPV_HISTORICAL_POLICY.LEGACY_LEDGER_SOURCE),
            sort: ["recordTimestamp DESC"],
            limit,
            consistency: CONSISTENCY.STRONG,
        }),
        queryItems({
            dataCollectionId: BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA,
            filter: wql.eq("recordSource", TPV_HISTORICAL_POLICY.CASH_REGISTER_SOURCE),
            sort: ["recordTimestamp DESC"],
            limit,
            consistency: CONSISTENCY.STRONG,
        }),
    ]);
    const records = [...currentSource.items, ...legacy.items, ...previous.items]
        .filter(_isHistoricalTpvLedgerItem)
        .map(_virtualRecord)
        .sort((a, b) => new Date(b.recordTimestamp || 0).getTime() - new Date(a.recordTimestamp || 0).getTime())
        .slice(0, limit);
    return { records, hasMore: currentSource.hasNext === true || legacy.hasNext === true || previous.hasNext === true };
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
    const key = normalizeIdempotencyKey(idempotencyKey);
    const eventId = "TPVAUDIT-" + createHash("sha256").update(key).digest("hex").slice(0, 32);
    const collection = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
    const auditFingerprint = createHash("sha256").update(stableSerialize({ action, actorId, entityType, entityId, traceId, payload })).digest("hex");
    const existing = await getItem(collection, eventId, CONSISTENCY.STRONG);
    if (existing) {
        if (existing.payload?.auditFingerprint !== auditFingerprint) throw new Error("TPV_AUDIT_IDEMPOTENCY_CONFLICT");
        return { item: existing, replayed: true };
    }

    const record = {
        _id: eventId,
        controlType: CONTROL_TYPE.TPV_AUDIT_EVENT,
        dedupeKey: key,
        traceId: String(traceId || "TPV_AUDIT"),
        eventId,
        eventType: "TPV_AUDIT",
        processedAt: new Date(),
        status: "COMPLETED",
        operationDescription: String(action || "UNKNOWN").slice(0, 180),
        payload: {
            ...payload,
            action: String(action || "UNKNOWN").slice(0, 80),
            actorId: String(actorId || "UNKNOWN").slice(0, 100),
            entityType: String(entityType || "TPV").slice(0, 80),
            entityId: String(entityId || "").slice(0, 120),
            source: "TPV_WEB_METHOD",
            traceId: String(traceId || "TPV_AUDIT"),
            auditFingerprint,
        },
    };
    try {
        const item = await insertItem(collection, record);
        return { item, replayed: false };
    } catch (error) {
        const winner = await getItem(collection, eventId, CONSISTENCY.STRONG);
        if (!winner) throw error;
        if (winner.dedupeKey !== key || winner.payload?.auditFingerprint !== auditFingerprint) {
            throw new Error("TPV_AUDIT_IDEMPOTENCY_CONFLICT");
        }
        return { item: winner, replayed: true };
    }
}

export async function latestTpvSession() {
    const sessions = await queryTpvRecords(
        TPV_COLLECTIONS.SESIONES_CAJA,
        undefined,
        { sort: ["_createdDate DESC"], limit: 1000 }
    );
    const session = sessions[0] || null;
    if (!session) return null;

    const closures = await queryTpvRecords(
        TPV_COLLECTIONS.TICKET_Z,
        wql.eq("sessionId", session.sessionId)
    );
    const closure = closures.find((item) => item.closed === true);
    if (closure) {
        return {
            ...session,
            status: "CERRADA",
            closedAt: session.closedAt || closure.generatedAt || closure._createdDate || null,
            closureReportId: closure.reportId || null,
        };
    }
    return session;
}

export async function latestOpenTpvSession() {
    const session = await latestTpvSession();
    return session?.status === "ABIERTA" ? session : null;
}


async function queryCommercialTpvSales(sessionId) {
    const records = [];
    let page = await queryItems({
        dataCollectionId: BUSINESS_COLLECTIONS.TRANSACCIONES_TPV,
        filter: wql.eq("sessionId", sessionId),
        limit: 100,
        consistency: CONSISTENCY.STRONG,
    });
    records.push(...page.items);
    while (page.hasNext && typeof page.next === "function") {
        page = await page.next();
        records.push(...page.items);
    }
    return records;
}

export async function getCommittedTpvSales(sessionId) {
    const records = await queryCommercialTpvSales(sessionId);
    return records.filter((item) => item.status === "CONFIRMED");
}

export async function getPendingTpvSales(sessionId) {
    const records = await queryCommercialTpvSales(sessionId);
    return records.filter((item) => item.status === "PENDING_PAYMENT");
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
            if (!Object.values(TPV_PAYMENT_METHOD).includes(method) ||
                !Number.isSafeInteger(amountMinor) || amountMinor <= 0) return true;
            const current = expectedByMethod.get(method) || { count: 0, amountMinor: 0 };
            current.count += 1;
            current.amountMinor += amountMinor;
            expectedByMethod.set(method, current);
        }

        const refundPayments = payments.filter((payment) =>
            payment.status === "REEMBOLSO_CONFIRMADO" &&
            payment.payload?.refundId === refund.refundId
        );
        const refundCashMovements = movements.filter((movement) =>
            movement.status === "CONFIRMADO" &&
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
        item.status === "CONFIRMADO" &&
        item.payload?.sessionId === sessionId
    );
}

export async function getTpvCashMovements(sessionId) {
    return queryTpvRecords(
        TPV_COLLECTIONS.MOVIMIENTOS_CAJA,
        wql.eq("sessionId", sessionId)
    );
}
