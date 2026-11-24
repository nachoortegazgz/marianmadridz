/*
=============================================================================
MODULE: backend/fiscalLedgerLock.js
RESPONSIBILITY: Serialize every append to MovimientosCaja so sequenceNumber,
invoice numbering and previousRecordHash are read and committed as one
critical section across eventLog.js and cajas.web.js.
STANDARDS: Wix CMS ControlOperativo SLOT_LOCK; no business data is mutated.
=============================================================================
*/

import {
    query as dalQuery,
    getItem as dalGet,
    insertItem as dalInsert,
    updateItem as dalUpdate,
    bulkPatchItems,
} from "backend/dataAccess";
import {
    BUSINESS_COLLECTIONS,
    CONTROL_TYPE,
    FISCAL_LEDGER_LOCK_CONFIG,
    SINGLETONS,
    SDK_CONFIG,
} from "backend/internalConfig";
import { makeTraceId } from "public/mmUtils";
import { createActionableError } from "backend/errors/actionableError";

const CONTROL_COL = BUSINESS_COLLECTIONS.CONTROL_OPERATIVO;
const CASH_COL = BUSINESS_COLLECTIONS.CAJA_ACTUAL;
const LOCK_ID = FISCAL_LEDGER_LOCK_CONFIG.ID;
const SEQUENCE_RETRIES = 5;
const LOCK_DEDUPE_KEY = FISCAL_LEDGER_LOCK_CONFIG.DEDUPE_KEY;
const LOCK_TTL_MS = FISCAL_LEDGER_LOCK_CONFIG.TTL_MS;
const DEFAULT_WAIT_MS = FISCAL_LEDGER_LOCK_CONFIG.WAIT_MS;
const POLL_MS = FISCAL_LEDGER_LOCK_CONFIG.POLL_MS;
const LOCK_SERVICE_ID = FISCAL_LEDGER_LOCK_CONFIG.SERVICE_ID;
const LOCK_RESOURCE_ID = FISCAL_LEDGER_LOCK_CONFIG.RESOURCE_ID;

function _readPayload(item) {
    return item?.payload && typeof item.payload === "object" && !Array.isArray(item.payload)
        ? item.payload
        : {};
}

function _isDuplicate(error) {
    const code = String(error?.code || "");
    const message = String(error?.message || "");
    return code === "WDE0074" ||
        code === "WD_ITEM_ALREADY_EXISTS" ||
        code === "WDE0023" ||
        /already exists|already been used/i.test(message);
}

function _isNotFound(error) {
    return String(error?.code || "") === "WDE0073" ||
        /WDE0073|item not found/i.test(String(error?.message || ""));
}

function _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getCashRegisterSingleton() {
    const result = await dalQuery(CASH_COL)
        .eq("singletonKey", SINGLETONS.CAJA_PRINCIPAL)
        .limit(2)
        .find({ consistencyMode: "strong" });
    const matches = result?.items || [];
    if (matches.length > 1) throw new Error("CAJA_PRINCIPAL_DUPLICATE_SINGLETON");
    return matches[0] || null;
}

function _localYear() {
    return new Intl.DateTimeFormat("en", {
        timeZone: SDK_CONFIG?.TZ || "Europe/Madrid",
        year: "numeric",
    }).format(new Date());
}

function _counter(value) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? number : 0;
}

function _sequenceUnknown(writeError, readError) {
    const error = new Error("SEQUENCE_RESULT_UNKNOWN");
    error.code = "SEQUENCE_RESULT_UNKNOWN";
    error.writeError = writeError?.message || "unknown";
    error.readError = readError?.message || "unknown";
    return error;
}

export async function allocateFiscalSequence(lock, lastMovement) {
    await assertFiscalLedgerLock(lock);
    const yearKey = _localYear();
    const invoiceMatch = /^FAC-(\d{4})-(\d{5})$/.exec(String(lastMovement?.numSerieFactura || ""));
    const lastYearSequence = invoiceMatch?.[1] === yearKey ? _counter(invoiceMatch[2]) : 0;

    for (let attempt = 0; attempt < SEQUENCE_RETRIES; attempt += 1) {
        const cashRegister = await getCashRegisterSingleton();
        if (!cashRegister) {
            const error = new Error("CAJA_PRINCIPAL_MISSING");
            error.code = "CAJA_PRINCIPAL_MISSING";
            throw error;
        }

        const counters = { ...(cashRegister.sequenceCounters || {}) };
        const previousGlobal = Math.max(_counter(counters.seqGlobal), _counter(lastMovement?.sequenceNumber));
        const previousYear = Math.max(_counter(counters[yearKey]), lastYearSequence);
        const sequenceNumber = previousGlobal + 1;
        const yearSequence = previousYear + 1;
        const allocated = {
            sequenceNumber,
            yearSequence,
            numSerieFactura: "FAC-" + yearKey + "-" + String(yearSequence).padStart(5, "0"),
        };

        try {
            await dalUpdate(CASH_COL, {
                ...cashRegister,
                sequenceCounters: {
                    ...counters,
                    seqGlobal: sequenceNumber,
                    [yearKey]: yearSequence,
                },
                _updatedDate: new Date(),
            });
            return allocated;
        } catch (writeError) {
            let latest;
            try {
                latest = await getCashRegisterSingleton();
            } catch (readError) {
                throw _sequenceUnknown(writeError, readError);
            }
            if (!latest) throw _sequenceUnknown(writeError, new Error("CAJA_PRINCIPAL_MISSING"));

            const observed = latest.sequenceCounters || {};
            if (
                _counter(observed.seqGlobal) === sequenceNumber &&
                _counter(observed[yearKey]) === yearSequence
            ) return allocated;

            if (
                _counter(observed.seqGlobal) !== previousGlobal ||
                _counter(observed[yearKey]) !== previousYear
            ) throw _sequenceUnknown(writeError, new Error("SEQUENCE_COUNTER_CHANGED"));

            if (attempt === SEQUENCE_RETRIES - 1) {
                const error = new Error("SEQUENCE_ERROR: " + (writeError?.message || "unknown"));
                error.code = "SEQUENCE_ERROR";
                error.cause = writeError;
                throw error;
            }
            await _sleep(100 * (attempt + 1));
        }
    }
    throw new Error("SEQUENCE_ERROR");
}

export async function rollbackFiscalSequence(lock, sequence) {
    if (!sequence || !_counter(sequence.sequenceNumber)) return false;
    const invoiceMatch = /^FAC-(\d{4})-(\d{5})$/.exec(String(sequence.numSerieFactura || ""));
    if (!invoiceMatch) return false;
    const yearKey = invoiceMatch[1];

    try {
        await assertFiscalLedgerLock(lock);
        for (let attempt = 0; attempt < SEQUENCE_RETRIES; attempt += 1) {
            const cashRegister = await getCashRegisterSingleton();
            if (!cashRegister) return false;
            const counters = { ...(cashRegister.sequenceCounters || {}) };
            if (
                _counter(counters.seqGlobal) !== _counter(sequence.sequenceNumber) ||
                _counter(counters[yearKey]) !== _counter(sequence.yearSequence)
            ) return false;

            try {
                await dalUpdate(CASH_COL, {
                    ...cashRegister,
                    sequenceCounters: {
                        ...counters,
                        seqGlobal: _counter(sequence.sequenceNumber) - 1,
                        [yearKey]: _counter(sequence.yearSequence) - 1,
                    },
                    _updatedDate: new Date(),
                });
                return true;
            } catch (_) {
                let latest;
                try {
                    latest = await getCashRegisterSingleton();
                } catch (_) {
                    return false;
                }
                if (!latest) return false;
                const observed = latest.sequenceCounters || {};
                if (
                    _counter(observed.seqGlobal) === _counter(sequence.sequenceNumber) - 1 &&
                    _counter(observed[yearKey]) === _counter(sequence.yearSequence) - 1
                ) return true;
                if (
                    _counter(observed.seqGlobal) !== _counter(sequence.sequenceNumber) ||
                    _counter(observed[yearKey]) !== _counter(sequence.yearSequence)
                ) return false;
                if (attempt === SEQUENCE_RETRIES - 1) return false;
                await _sleep(100 * (attempt + 1));
            }
        }
    } catch (_) {
        return false;
    }
    return false;
}

function _lockVersion(item) {
    const raw = item?.version;
    if (raw === undefined || raw === null || raw === "") return null;
    const value = Number(raw);
    return Number.isSafeInteger(value) && value >= 0 ? value : Number.NaN;
}

function _lockOwner(item) {
    return String(_readPayload(item).lockOwnerId || "");
}

function _lockPatchSucceeded(result) {
    const errors = Array.isArray(result?.errors) ? result.errors : [];
    if (errors.length) {
        if (errors.every(_isNotFound)) return false;
        const error = new Error(errors.map((entry) => entry?.message || entry?.code || "unknown").join("; "));
        error.code = errors[0]?.code || "FISCAL_LEDGER_LOCK_PATCH_FAILED";
        throw error;
    }
    return Array.isArray(result?.updatedItemIds) && result.updatedItemIds.includes(LOCK_ID);
}

function _lockPayload(ownerId, acquiredAt, previousPayload = {}, traceId = "") {
    return {
        ...previousPayload,
        lockOwnerId: ownerId,
        lockStatus: "ACTIVE",
        acquiredAt: acquiredAt.toISOString(),
        lastTraceId: String(traceId || ""),
        purpose: "FISCAL_LEDGER_APPEND",
    };
}

function _lockResult(ownerId, version, expiresAt, traceId, revision = null) {
    return { id: LOCK_ID, ownerId, version, revision, expiresAt, traceId };
}

export async function acquireFiscalLedgerLock(traceId, options = {}) {
    const ownerId = makeTraceId("fiscal-lock");
    const lockTraceId = String(traceId || makeTraceId("fiscal-lock"));
    const waitMs = Math.max(0, Number(options.waitMs ?? DEFAULT_WAIT_MS));
    const deadline = Date.now() + waitMs;

    while (true) {
        const now = new Date();
        const existing = await dalGet(CONTROL_COL, LOCK_ID, "strong");

        if (existing) {
            const expiresAt = existing.expiresAt instanceof Date
                ? existing.expiresAt
                : new Date(existing.expiresAt);
            if (!Number.isFinite(expiresAt.getTime())) {
                const error = new Error("FISCAL_LEDGER_LOCK_INVALID_EXPIRY");
                error.code = "FISCAL_LEDGER_LOCK_INVALID_EXPIRY";
                throw error;
            }

            if (expiresAt.getTime() <= now.getTime()) {
                const currentVersion = _lockVersion(existing);
                if (Number.isNaN(currentVersion)) {
                    const error = new Error("FISCAL_LEDGER_LOCK_INVALID_VERSION");
                    error.code = "FISCAL_LEDGER_LOCK_INVALID_VERSION";
                    throw error;
                }

                const acquiredAt = new Date();
                const nextVersion = currentVersion === null ? 1 : currentVersion + 1;
                const nextExpiry = new Date(acquiredAt.getTime() + LOCK_TTL_MS);
                const condition = {
                    controlType: { $eq: CONTROL_TYPE.SLOT_LOCK },
                    expiresAt: { $eq: expiresAt },
                };
                if (currentVersion !== null) condition.version = { $eq: currentVersion };

                const modifications = [
                    { fieldPath: "expiresAt", action: "SET_FIELD", value: nextExpiry },
                    { fieldPath: "heartbeatAt", action: "SET_FIELD", value: acquiredAt },
                    { fieldPath: "payload", action: "SET_FIELD", value: _lockPayload(ownerId, acquiredAt, _readPayload(existing), lockTraceId) },
                    {
                        fieldPath: "version",
                        action: currentVersion === null ? "SET_FIELD" : "INCREMENT_FIELD",
                        value: 1,
                    },
                ];

                let patched;
                try {
                    patched = await bulkPatchItems(CONTROL_COL, [LOCK_ID], [modifications], {
                        condition: { filter: condition },
                    });
                } catch (error) {
                    if (_isNotFound(error)) continue;
                    throw error;
                }

                if (_lockPatchSucceeded(patched)) {
                    return _lockResult(ownerId, nextVersion, nextExpiry, lockTraceId);
                }

                // Another worker won the compare-and-swap. Re-read the row.
                continue;
            }

            if (Date.now() >= deadline) {
                throw createActionableError({
                    code: "FISCAL_LEDGER_LOCK_BUSY",
                    userMessage: "La caja está ocupada. Espera a que termine la operación en curso.",
                    technicalDetail: "Se agotó la ventana de espera del lock fiscal; el lock activo no se modifica ni se fuerza.",
                    remediation: ["Esperar a que finalice la operación que mantiene el bloqueo.", "Comprobar el estado y la expiración del lock en ControlOperativo.", "Si sigue activo después de expirar, solicitar revisión al administrador técnico; no eliminarlo manualmente."],
                    contextSnapshot: { lockId: LOCK_ID, waitMs, traceId: lockTraceId },
                    retryable: true,
                });
            }
            await _sleep(Math.min(POLL_MS, Math.max(1, deadline - Date.now())));
            continue;
        }

        const acquiredAt = new Date();
        const expiresAt = new Date(acquiredAt.getTime() + LOCK_TTL_MS);
        const lock = {
            _id: LOCK_ID,
            controlType: CONTROL_TYPE.SLOT_LOCK,
            dedupeKey: LOCK_DEDUPE_KEY,
            serviceId: LOCK_SERVICE_ID,
            resourceId: LOCK_RESOURCE_ID,
            version: 0,
            status: "ACTIVE",
            expiresAt,
            heartbeatAt: acquiredAt,
            payload: _lockPayload(ownerId, acquiredAt, {}, lockTraceId),
            traceId: lockTraceId,
            _createdDate: acquiredAt,
            _updatedDate: acquiredAt,
        };

        try {
            const saved = await dalInsert(CONTROL_COL, lock);
            return _lockResult(ownerId, 0, expiresAt, lockTraceId, saved?._revision ?? null);
        } catch (error) {
            if (!_isDuplicate(error)) throw error;
            if (Date.now() >= deadline) {
                throw createActionableError({
                    code: "FISCAL_LEDGER_LOCK_BUSY",
                    userMessage: "La caja está ocupada. Espera a que termine la operación en curso.",
                    technicalDetail: "Se agotó la ventana de espera del lock fiscal; el lock activo no se modifica ni se fuerza.",
                    remediation: ["Esperar a que finalice la operación que mantiene el bloqueo.", "Comprobar el estado y la expiración del lock en ControlOperativo.", "Si sigue activo después de expirar, solicitar revisión al administrador técnico; no eliminarlo manualmente."],
                    contextSnapshot: { lockId: LOCK_ID, waitMs, traceId: lockTraceId },
                    retryable: true,
                });
            }
            await _sleep(POLL_MS);
        }
    }
}

export async function assertFiscalLedgerLock(lock) {
    const expectedVersion = Number(lock?.version);
    if (
        !lock?.ownerId ||
        !Number.isSafeInteger(expectedVersion) ||
        expectedVersion < 0
    ) throw new Error("FISCAL_LEDGER_LOCK_INVALID");

    const current = await dalGet(CONTROL_COL, LOCK_ID, "strong");
    if (!current) throw new Error("FISCAL_LEDGER_LOCK_LOST");

    const expiresAt = current.expiresAt instanceof Date
        ? current.expiresAt
        : new Date(current.expiresAt);
    if (
        _lockOwner(current) !== lock.ownerId ||
        Number(current.version) !== expectedVersion ||
        !Number.isFinite(expiresAt.getTime()) ||
        expiresAt.getTime() <= Date.now()
    ) {
        throw new Error("FISCAL_LEDGER_LOCK_LOST");
    }
    return true;
}

export async function releaseFiscalLedgerLock(lock) {
    const expectedVersion = Number(lock?.version);
    if (!lock?.ownerId || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
        return { released: false, reason: "INVALID_OWNER" };
    }

    let current;
    try {
        current = await dalGet(CONTROL_COL, LOCK_ID, "strong");
    } catch (error) {
        return {
            released: false,
            reason: "RELEASE_READ_FAILED",
            errorCode: error?.code || null,
        };
    }
    if (!current) return { released: true, missing: true };

    const expiresAt = current.expiresAt instanceof Date
        ? current.expiresAt
        : new Date(current.expiresAt);
    if (
        _lockOwner(current) !== lock.ownerId ||
        Number(current.version) !== expectedVersion ||
        !Number.isFinite(expiresAt.getTime())
    ) {
        return { released: false, reason: "OWNERSHIP_CHANGED" };
    }

    const releasedAt = new Date();
    const condition = {
        controlType: { $eq: CONTROL_TYPE.SLOT_LOCK },
        version: { $eq: expectedVersion },
        expiresAt: { $eq: expiresAt },
    };
    const payload = {
        ..._readPayload(current),
        lockStatus: "RELEASED",
        releasedAt: releasedAt.toISOString(),
    };
    const modifications = [
        { fieldPath: "expiresAt", action: "SET_FIELD", value: releasedAt },
        { fieldPath: "heartbeatAt", action: "SET_FIELD", value: releasedAt },
        { fieldPath: "payload", action: "SET_FIELD", value: payload },
        { fieldPath: "version", action: "INCREMENT_FIELD", value: 1 },
    ];

    try {
        const patched = await bulkPatchItems(CONTROL_COL, [LOCK_ID], [modifications], {
            condition: { filter: condition },
        });
        if (_lockPatchSucceeded(patched)) {
            return { released: true, version: expectedVersion + 1 };
        }
        return { released: false, reason: "OWNERSHIP_CHANGED" };
    } catch (error) {
        if (_isNotFound(error)) return { released: true, missing: true };
        return { released: false, reason: error?.message || "RELEASE_FAILED" };
    }
}
