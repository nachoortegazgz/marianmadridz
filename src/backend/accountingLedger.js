/*
=============================================================================
MODULE: backend/accountingLedger.js
RESPONSIBILITY: Append-only, balanced journal lines for the physical PGC
ledger collection. This module provides the safe posting primitive only.
Automatic event-to-account mapping remains disabled until the business owner
approves the PGC chart/rules; callers must supply server-side approved lines.
=============================================================================
*/

import {
    getItem as dalGet,
    insertItem as dalInsert,
    updateItem as dalUpdate,
    removeById as dalRemove,
    query as dalQuery,
} from "backend/dataAccess";
import {
    BUSINESS_COLLECTIONS,
    CONTROL_TYPE,
    ACCOUNTING_LEDGER_LOCK_CONFIG,
} from "backend/internalConfig";
import { hashSHA256, hashChain } from "backend/securityEngine";
import { makeTraceId, _safeTrim } from "public/mmUtils";
import { logger } from "backend/logger";

const log = logger;
const CONTROL_COL = BUSINESS_COLLECTIONS.CONTROL_OPERATIVO;
const ACCOUNTING_COL = BUSINESS_COLLECTIONS.LIBRO_ASIENTOS_CONTABLES_DETALLE;
const GENESIS_HASH = "0".repeat(64);
const STRONG_READ = { consistencyMode: "strong" };
const MAX_LINES = 20;

function _readPayload(item) {
    return item?.payload && typeof item.payload === "object" && !Array.isArray(item.payload)
        ? item.payload
        : {};
}

function _isDuplicate(error) {
    const code = String(error?.code || "");
    const message = String(error?.message || "");
    return ["WDE0074", "WD_ITEM_ALREADY_EXISTS", "WDE0023", "WDE0123"].includes(code) ||
        /already exists|duplicated values|already been used/i.test(message);
}

function _isNotFound(error) {
    return String(error?.code || "") === "WDE0073" ||
        /WDE0073|item not found/i.test(String(error?.message || ""));
}

function _roundMoney(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function _normalizeEntry(input, traceId) {
    const entryId = _safeTrim(input?.entryId);
    const sourceMovementId = _safeTrim(input?.sourceMovementId);
    const concept = _safeTrim(input?.concept);
    const origenTipo = _safeTrim(input?.origenTipo);
    const origenRegistro = _safeTrim(input?.origenRegistro);
    const entryDateText = _safeTrim(input?.entryDate).slice(0, 10);
    const fiscalPeriod = _safeTrim(input?.fiscalPeriod);
    const lines = Array.isArray(input?.lines) ? input.lines : [];

    if (entryId.length < 8 || entryId.length > 128) {
        return { ok: false, code: "ACCOUNTING_ENTRY_ID_INVALID" };
    }
    if (!sourceMovementId || sourceMovementId.length > 128) {
        return { ok: false, code: "ACCOUNTING_SOURCE_MOVEMENT_REQUIRED" };
    }
    if (!concept || concept.length > 250 || !origenTipo || origenTipo.length > 50 ||
        !origenRegistro || origenRegistro.length > 100) {
        return { ok: false, code: "ACCOUNTING_ENTRY_METADATA_INVALID" };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDateText) ||
        !/^\d{4}-\d{2}$/.test(fiscalPeriod) ||
        entryDateText.slice(0, 7) !== fiscalPeriod) {
        return { ok: false, code: "ACCOUNTING_FISCAL_PERIOD_INVALID" };
    }
    if (lines.length < 2 || lines.length > MAX_LINES) {
        return { ok: false, code: "ACCOUNTING_LINES_COUNT_INVALID" };
    }

    const normalizedLines = lines.map((line) => ({
        lineNumber: Number(line?.lineNumber),
        accountCode: _safeTrim(line?.accountCode),
        debitAmount: _roundMoney(line?.debitAmount),
        creditAmount: _roundMoney(line?.creditAmount),
    })).sort((a, b) => a.lineNumber - b.lineNumber);

    const seenLineNumbers = new Set();
    for (let index = 0; index < normalizedLines.length; index += 1) {
        const line = normalizedLines[index];
        if (
            !Number.isSafeInteger(line.lineNumber) ||
            line.lineNumber !== index + 1 ||
            seenLineNumbers.has(line.lineNumber) ||
            !/^\d{6}$/.test(line.accountCode) ||
            !Number.isFinite(line.debitAmount) ||
            !Number.isFinite(line.creditAmount) ||
            line.debitAmount < 0 ||
            line.creditAmount < 0 ||
            (line.debitAmount > 0 && line.creditAmount > 0) ||
            (line.debitAmount === 0 && line.creditAmount === 0)
        ) {
            return { ok: false, code: "ACCOUNTING_LINE_INVALID" };
        }
        seenLineNumbers.add(line.lineNumber);
    }

    const totalDebit = _roundMoney(normalizedLines.reduce((sum, line) => sum + line.debitAmount, 0));
    const totalCredit = _roundMoney(normalizedLines.reduce((sum, line) => sum + line.creditAmount, 0));
    if (totalDebit <= 0 || Math.abs(totalDebit - totalCredit) > 0.009) {
        return { ok: false, code: "ACCOUNTING_ENTRY_UNBALANCED" };
    }

    return {
        ok: true,
        value: {
            entryId,
            sourceMovementId,
            cashMovementId: _safeTrim(input?.cashMovementId || sourceMovementId),
            concept,
            origenTipo,
            origenRegistro,
            entryDate: new Date(`${entryDateText}T12:00:00.000Z`),
            fiscalPeriod,
            lines: normalizedLines,
            totalDebit,
            totalCredit,
            traceId: _safeTrim(traceId) || makeTraceId("accounting-ledger"),
        },
    };
}

async function _acquireAccountingLedgerLock(traceId, waitMs = ACCOUNTING_LEDGER_LOCK_CONFIG.WAIT_MS) {
    const ownerId = makeTraceId("accounting-lock");
    const deadline = Date.now() + Math.max(0, Number(waitMs));
    while (true) {
        const now = new Date();
        const existing = await dalGet(CONTROL_COL, ACCOUNTING_LEDGER_LOCK_CONFIG.ID, "strong");
        if (existing) {
            const expiresAt = existing.expiresAt instanceof Date ? existing.expiresAt : new Date(existing.expiresAt);
            const existingOwner = String(_readPayload(existing).lockOwnerId || "");
            if (Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() <= now.getTime()) {
                try {
                    await dalRemove(CONTROL_COL, ACCOUNTING_LEDGER_LOCK_CONFIG.ID);
                    continue;
                } catch (error) {
                    if (_isNotFound(error)) continue;
                    const latest = await dalGet(CONTROL_COL, ACCOUNTING_LEDGER_LOCK_CONFIG.ID, "strong");
                    if (!latest || String(_readPayload(latest).lockOwnerId || "") !== existingOwner) continue;
                }
            }
            if (Date.now() >= deadline) {
                const error = new Error("ACCOUNTING_LEDGER_LOCK_BUSY");
                error.code = "ACCOUNTING_LEDGER_LOCK_BUSY";
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, Math.min(100, Math.max(1, deadline - Date.now()))));
            continue;
        }

        const acquiredAt = new Date();
        const lock = {
            _id: ACCOUNTING_LEDGER_LOCK_CONFIG.ID,
            controlType: CONTROL_TYPE.SLOT_LOCK,
            dedupeKey: ACCOUNTING_LEDGER_LOCK_CONFIG.DEDUPE_KEY,
            serviceId: ACCOUNTING_LEDGER_LOCK_CONFIG.SERVICE_ID,
            resourceId: ACCOUNTING_LEDGER_LOCK_CONFIG.RESOURCE_ID,
            status: "ACTIVE",
            expiresAt: new Date(acquiredAt.getTime() + ACCOUNTING_LEDGER_LOCK_CONFIG.TTL_MS),
            heartbeatAt: acquiredAt,
            payload: {
                lockOwnerId: ownerId,
                lockStatus: "ACTIVE",
                purpose: "ACCOUNTING_LEDGER_HASH_CHAIN",
                acquiredAt: acquiredAt.toISOString(),
            },
            traceId,
            _createdDate: acquiredAt,
            _updatedDate: acquiredAt,
        };
        try {
            const saved = await dalInsert(CONTROL_COL, lock);
            return { ownerId, revision: saved?._revision ?? null };
        } catch (error) {
            if (!_isDuplicate(error)) throw error;
            if (Date.now() >= deadline) {
                const busy = new Error("ACCOUNTING_LEDGER_LOCK_BUSY");
                busy.code = "ACCOUNTING_LEDGER_LOCK_BUSY";
                throw busy;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }
}

async function _assertAccountingLedgerLock(lock) {
    if (!lock?.ownerId) throw new Error("ACCOUNTING_LEDGER_LOCK_INVALID");
    const current = await dalGet(CONTROL_COL, ACCOUNTING_LEDGER_LOCK_CONFIG.ID, "strong");
    if (!current) throw new Error("ACCOUNTING_LEDGER_LOCK_LOST");
    const expiresAt = current.expiresAt instanceof Date ? current.expiresAt : new Date(current.expiresAt);
    if (_readPayload(current).lockOwnerId !== lock.ownerId ||
        !Number.isFinite(expiresAt.getTime()) ||
        expiresAt.getTime() <= Date.now()) {
        throw new Error("ACCOUNTING_LEDGER_LOCK_LOST");
    }
    return true;
}

async function _releaseAccountingLedgerLock(lock) {
    if (!lock?.ownerId) return { released: false, reason: "INVALID_OWNER" };
    const current = await dalGet(CONTROL_COL, ACCOUNTING_LEDGER_LOCK_CONFIG.ID, "strong");
    if (!current) return { released: true, missing: true };
    if (_readPayload(current).lockOwnerId !== lock.ownerId) {
        return { released: false, reason: "OWNERSHIP_CHANGED" };
    }
    try {
        await dalRemove(CONTROL_COL, ACCOUNTING_LEDGER_LOCK_CONFIG.ID);
        return { released: true };
    } catch (error) {
        if (_isNotFound(error)) return { released: true, missing: true };
        return { released: false, reason: error?.message || "RELEASE_FAILED" };
    }
}

async function _readEntryRows(entryId) {
    const result = await dalQuery(ACCOUNTING_COL)
        .eq("entryId", entryId)
        .ascending("lineNumber")
        .limit(MAX_LINES + 1)
        .find(STRONG_READ);
    return Array.isArray(result?.items) ? result.items : [];
}

function _verifyEntryRows(rows, entry) {
    if (rows.length !== entry.lines.length) return false;
    const sorted = [...rows].sort((a, b) => Number(a.lineNumber) - Number(b.lineNumber));
    for (let index = 0; index < entry.lines.length; index += 1) {
        const expected = entry.lines[index];
        const actual = sorted[index];
        if (
            Number(actual.lineNumber) !== expected.lineNumber ||
            actual.accountCode !== expected.accountCode ||
            _roundMoney(actual.debitAmount) !== expected.debitAmount ||
            _roundMoney(actual.creditAmount) !== expected.creditAmount ||
            actual.sourceMovementId !== entry.sourceMovementId ||
            !actual.recordHash ||
            !actual.previousRecordHash
        ) return false;
        if (index > 0 && actual.previousRecordHash !== sorted[index - 1].recordHash) return false;
    }
    return true;
}

async function _markEntryClaim(claim, status, payloadPatch = {}) {
    return dalUpdate(CONTROL_COL, {
        ...claim,
        status,
        payload: {
            ..._readPayload(claim),
            ...payloadPatch,
            updatedAt: new Date().toISOString(),
        },
        _updatedDate: new Date(),
    });
}

/**
 * Append balanced accounting lines to LibroAsientosContablesDetalle.
 * This is an internal primitive; do not expose account codes in frontend DTOs.
 * No account mapping is enabled until the PGC rule set is formally approved.
 */
export async function appendAccountingEntry(input, traceId) {
    const normalized = _normalizeEntry(input, traceId);
    if (!normalized.ok) {
        return { status: "ERROR", data: null, error: { code: normalized.code } };
    }
    const entry = normalized.value;
    const payloadHash = await hashSHA256(JSON.stringify({
        ...entry,
        entryDate: entry.entryDate.toISOString(),
    }));
    const claimDigest = await hashSHA256(entry.entryId);
    const claimId = `ACC_ENTRY_${claimDigest.slice(0, 48)}`;
    const now = new Date();
    let claim = await dalGet(CONTROL_COL, claimId, "strong");
    if (claim) {
        const payload = _readPayload(claim);
        if (payload.payloadHash !== payloadHash) {
            return { status: "ERROR", data: null, error: { code: "ACCOUNTING_ENTRY_PAYLOAD_MISMATCH" } };
        }
        if (claim.status === "COMPLETED") {
            return { status: "SUCCESS", data: { entryId: entry.entryId, idempotent: true }, error: null };
        }
        if (claim.status === "REPAIR_REQUIRED") {
            return { status: "ERROR", data: null, error: { code: "ACCOUNTING_ENTRY_REPAIR_REQUIRED" } };
        }
    } else {
        try {
            claim = await dalInsert(CONTROL_COL, {
                _id: claimId,
                controlType: CONTROL_TYPE.DEDUPE_KEY,
                dedupeKey: `ACCOUNTING_ENTRY:${entry.entryId}`,
                status: "PENDING",
                payload: {
                    payloadHash,
                    entryId: entry.entryId,
                    sourceMovementId: entry.sourceMovementId,
                    expectedLines: entry.lines.length,
                    lines: entry.lines,
                },
                traceId: entry.traceId,
                _createdDate: now,
                _updatedDate: now,
            });
        } catch (error) {
            if (!_isDuplicate(error)) throw error;
            claim = await dalGet(CONTROL_COL, claimId, "strong");
            if (!claim || _readPayload(claim).payloadHash !== payloadHash) {
                return { status: "ERROR", data: null, error: { code: "ACCOUNTING_ENTRY_PAYLOAD_MISMATCH" } };
            }
        }
    }

    let lock = null;
    let retainLock = false;
    try {
        lock = await _acquireAccountingLedgerLock(entry.traceId);
        await _assertAccountingLedgerLock(lock);

        const existingRows = await _readEntryRows(entry.entryId);
        if (existingRows.length) {
            if (_verifyEntryRows(existingRows, entry)) {
                await _markEntryClaim(claim, "COMPLETED", {
                    completedAt: new Date().toISOString(),
                    recoveredExistingRows: true,
                });
                return { status: "SUCCESS", data: { entryId: entry.entryId, lineCount: existingRows.length, idempotent: true }, error: null };
            }
            await _markEntryClaim(claim, "REPAIR_REQUIRED", {
                observedLineCount: existingRows.length,
                expectedLineCount: entry.lines.length,
                reason: "PARTIAL_OR_MISMATCHED_ENTRY",
            });
            return { status: "ERROR", data: null, error: { code: "ACCOUNTING_ENTRY_REPAIR_REQUIRED" } };
        }

        const lastResult = await dalQuery(ACCOUNTING_COL)
            .descending("recordTimestamp")
            .descending("lineNumber")
            .limit(1)
            .find(STRONG_READ);
        const lastRecord = lastResult?.items?.[0] || null;
        let previousRecordHash = _safeTrim(lastRecord?.recordHash) || GENESIS_HASH;
        const lastTimestamp = lastRecord?.recordTimestamp
            ? new Date(lastRecord.recordTimestamp).getTime()
            : 0;
        const timestampBase = Math.max(Date.now(), Number.isFinite(lastTimestamp) ? lastTimestamp + 1 : Date.now());

        const inserted = [];
        for (let index = 0; index < entry.lines.length; index += 1) {
            const line = entry.lines[index];
            const recordTimestamp = new Date(timestampBase + index);
            const hashPayload = {
                entryId: entry.entryId,
                recordTimestamp: recordTimestamp.toISOString(),
                concept: entry.concept,
                lineNumber: line.lineNumber,
                origenTipo: entry.origenTipo,
                origenRegistro: entry.origenRegistro,
                sourceMovementId: entry.sourceMovementId,
                entryDate: entry.entryDate.toISOString(),
                fiscalPeriod: entry.fiscalPeriod,
                accountCode: line.accountCode,
                debitAmount: line.debitAmount,
                creditAmount: line.creditAmount,
                traceId: entry.traceId,
            };
            const recordHash = await hashChain(previousRecordHash, hashPayload);
            const rowDigest = await hashSHA256(`${entry.entryId}|${line.lineNumber}`);
            const row = {
                _id: `ACC_${rowDigest.slice(0, 48)}`,
                entryId: entry.entryId,
                recordTimestamp,
                concept: entry.concept,
                lineNumber: line.lineNumber,
                origenTipo: entry.origenTipo,
                origenRegistro: entry.origenRegistro,
                sourceMovementId: entry.sourceMovementId,
                cashMovementId: entry.cashMovementId,
                entryDate: entry.entryDate,
                fiscalPeriod: entry.fiscalPeriod,
                accountCode: line.accountCode,
                debitAmount: line.debitAmount,
                creditAmount: line.creditAmount,
                previousRecordHash,
                recordHash,
                traceId: entry.traceId,
                _createdDate: recordTimestamp,
            };
            await _assertAccountingLedgerLock(lock);
            try {
                await dalInsert(ACCOUNTING_COL, row);
            } catch (error) {
                if (_isDuplicate(error)) {
                    const byId = await dalGet(ACCOUNTING_COL, row._id, "strong");
                    if (byId && byId.recordHash === recordHash) {
                        inserted.push(byId);
                        previousRecordHash = recordHash;
                        continue;
                    }
                }
                const observed = await _readEntryRows(entry.entryId).catch(() => null);
                if (observed === null) retainLock = true;
                await _markEntryClaim(claim, "REPAIR_REQUIRED", {
                    reason: "ACCOUNTING_LEDGER_INSERT_UNCERTAIN",
                    insertedLineCount: inserted.length,
                    observedLineCount: observed?.length ?? null,
                    lastError: error?.message || "INSERT_FAILED",
                });
                return {
                    status: "ERROR",
                    data: { entryId: entry.entryId, insertedLineCount: inserted.length },
                    error: { code: "ACCOUNTING_ENTRY_REPAIR_REQUIRED" },
                };
            }
            inserted.push(row);
            previousRecordHash = recordHash;
        }

        await _markEntryClaim(claim, "COMPLETED", {
            completedAt: new Date().toISOString(),
            lineCount: inserted.length,
            finalRecordHash: previousRecordHash,
        });
        return {
            status: "SUCCESS",
            data: { entryId: entry.entryId, lineCount: inserted.length, idempotent: false },
            error: null,
        };
    } catch (error) {
        log.error("appendAccountingEntry failed", {
            traceId: entry.traceId,
            entryId: entry.entryId,
            error: error?.message,
            code: error?.code,
        });
        return {
            status: "ERROR",
            data: null,
            error: { code: error?.code || "ACCOUNTING_LEDGER_WRITE_FAILED", message: error?.message || "No se pudo escribir el asiento." },
        };
    } finally {
        if (lock && !retainLock) {
            const released = await _releaseAccountingLedgerLock(lock);
            if (!released?.released) {
                log.error("ACCOUNTING_LEDGER_LOCK_RELEASE_FAILED", { traceId: entry.traceId, reason: released?.reason });
            }
        }
    }
}
