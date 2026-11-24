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
    makeTpvPayload,
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

/**
 * The current CMS contract still contains only historical QA ledger rows.
 * No canonical operational TPV writer is configured yet. Keep all writes
 * fail-closed; historical reads remain available through dedicated readers.
 */
export function assertTpvOperationalLedgerConfigured() {
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
    if (!item || typeof item !== "object" || Array.isArray(item) ||
        !(Object.values(TPV_EVENT_MOVEMENT_TYPES).includes(item.movementType) ||
            Object.values(TPV_LEGACY_EVENT_MOVEMENT_TYPES).includes(item.movementType))) return false;
    const envelope = item.payloadFiscal && typeof item.payloadFiscal === "object" ? item.payloadFiscal : {};
    const validHash = /^[a-f0-9]{64}$/i.test(String(item.hash || "")) && Number(item.sequenceNumber) === 0;
    const validFingerprint = /^[a-f0-9]{64}$/i.test(String(envelope.requestFingerprint || ""));
    const validCommon = [TPV_EVENT_MOVEMENT_TYPES, TPV_LEGACY_EVENT_MOVEMENT_TYPES]
        .some((types) => types[envelope.logicalCollection] === item.movementType) &&
        (envelope.isSynthetic === undefined || envelope.isSynthetic === true) &&
        (envelope.realPayment === undefined || envelope.realPayment === false) &&
        envelope.externalSideEffects === false && validHash && validFingerprint;
    const validSessionOrAudit = envelope.logicalCollection === TPV_COLLECTIONS.AUDITORIA ||
        Boolean(String(envelope.sessionId || "").trim());
    const validTraceForSite = String(item.traceId || "").startsWith("TPV:" + TPV_RUNTIME_POLICY.SITE_ID + ":");
    const currentRecordSources = [TPV_LEDGER_SOURCE, TPV_HISTORICAL_POLICY.CASH_REGISTER_SOURCE];
    const historicalV2 = currentRecordSources.includes(item.recordSource) &&
        envelope.sourceType === TPV_HISTORICAL_POLICY.SOURCE_TYPE &&
        envelope.siteId === TPV_RUNTIME_POLICY.SITE_ID &&
        envelope.ledgerVersion === TPV_HISTORICAL_POLICY.LEDGER_VERSION &&
        Number(envelope.schemaVersion) === TPV_HISTORICAL_POLICY.SCHEMA_VERSION &&
        envelope.reconciliationStatus === TPV_HISTORICAL_POLICY.RECONCILIATION_STATUS &&
        validSessionOrAudit && validTraceForSite;
    const legacyRunId = String(envelope.legacyRunId || envelope.sandboxRunId || "").trim();
    const legacy = [
        TPV_HISTORICAL_POLICY.LEGACY_LEDGER_SOURCE,
        TPV_HISTORICAL_POLICY.CASH_REGISTER_SOURCE,
        TPV_HISTORICAL_POLICY.LEGACY_CASH_REGISTER_SOURCE,
    ].includes(item.recordSource) &&
        legacyRunId === TPV_HISTORICAL_POLICY.LEGACY_RUN_ID &&
        (String(item.traceId || "").startsWith("TPV:" + legacyRunId + ":") ||
            String(item.traceId || "") === legacyRunId);
    return validCommon && (historicalV2 || legacy);
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
        sequenceNumber: item.sequenceNumber,
        hash: item.hash,
        previousRecordHash: item.previousRecordHash,
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
        expectedCashMinor: Math.round(Number(caja.expectedCash || 0) * 100),
        countedCashMinor: Math.round(Number(caja.countedCash || 0) * 100),
        differenceMinor: Math.round(Number(caja.difference || 0) * 100),
        operatorId: state.operatorId || caja.openedBy || null,
        actorId: state.actorId || caja.openedBy || null,
        operatorDisplayName: state.operatorDisplayName || null,
        operatorResourceId: state.operatorResourceId || null,
        traceId: caja.traceId || null,
        hash: state.eventHash,
        payload: {
            sessionId,
            siteId: TPV_RUNTIME_POLICY.SITE_ID,
            sourceType: TPV_RUNTIME_POLICY.SOURCE_TYPE,
            ledgerVersion: TPV_RUNTIME_POLICY.LEDGER_VERSION,
            schemaVersion: TPV_RUNTIME_POLICY.SCHEMA_VERSION,
        },
        persisted: true,
    };
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


export async function getCommittedTpvSales(sessionId) {
    const records = await queryTpvRecords(TPV_COLLECTIONS.VENTAS, undefined);
    return records.filter((item) =>
        ["CONFIRMADA"].includes(item.status) &&
        item.payload?.sessionId === sessionId
    );
}

export async function getPendingTpvSales(sessionId) {
    const records = await queryTpvRecords(TPV_COLLECTIONS.VENTAS, undefined);
    const committedIds = new Set(records
        .filter((item) => ["CONFIRMADA", "CONFIRMADA_SINTETICA"].includes(item.status))
        .map((item) => item.saleId));
    return records.filter((item) =>
        ["PREPARADA"].includes(item.status) &&
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
            ["CONFIRMADO"].includes(movement.status) &&
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
        ["CONFIRMADO"].includes(item.status) &&
        item.payload?.sessionId === sessionId
    );
}

export async function getTpvCashMovements(sessionId) {
    return queryTpvRecords(
        TPV_COLLECTIONS.MOVIMIENTOS_CAJA,
        wql.eq("sessionId", sessionId)
    );
}
