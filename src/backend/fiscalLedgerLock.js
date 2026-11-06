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
    getItem as dalGet,
    insertItem as dalInsert,
    removeById as dalRemove,
} from "backend/dataAccess";
import { BUSINESS_COLLECTIONS, CONTROL_TYPE } from "backend/internalConfig";
import { makeTraceId } from "public/mmUtils";

const CONTROL_COL = BUSINESS_COLLECTIONS.CONTROL_OPERATIVO;
const LOCK_ID = "FISCAL_LEDGER_CHAIN_LOCK";
const LOCK_DEDUPE_KEY = "FISCAL_LEDGER_HASH_SEQUENCE";
const LOCK_TTL_MS = 10 * 60 * 1000;
const DEFAULT_WAIT_MS = 3000;
const POLL_MS = 100;

// These UUIDs are reserved identifiers for the singleton fiscal-ledger lock.
// They are not Wix service/resource IDs and are never sent to Bookings.
const LOCK_SERVICE_ID = "00000000-0000-4000-8000-000000000001";
const LOCK_RESOURCE_ID = "00000000-0000-4000-8000-000000000002";

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

export async function acquireFiscalLedgerLock(traceId, options = {}) {
    const ownerId = makeTraceId("fiscal-lock");
    const waitMs = Math.max(0, Number(options.waitMs ?? DEFAULT_WAIT_MS));
    const deadline = Date.now() + waitMs;

    while (true) {
        const now = new Date();
        const existing = await dalGet(CONTROL_COL, LOCK_ID, "strong");

        if (existing) {
            const expiresAt = existing.expiresAt instanceof Date
                ? existing.expiresAt
                : new Date(existing.expiresAt);
            const existingOwner = String(_readPayload(existing).lockOwnerId || "");

            if (Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() <= now.getTime()) {
                try {
                    await dalRemove(CONTROL_COL, LOCK_ID);
                    continue;
                } catch (error) {
                    if (_isNotFound(error)) continue;
                    // A competing worker may have reclaimed it. Re-read before
                    // deciding whether the lock is still unavailable.
                    const latest = await dalGet(CONTROL_COL, LOCK_ID, "strong");
                    if (!latest || String(_readPayload(latest).lockOwnerId || "") !== existingOwner) {
                        continue;
                    }
                }
            }

            if (Date.now() >= deadline) {
                const error = new Error("FISCAL_LEDGER_LOCK_BUSY");
                error.code = "FISCAL_LEDGER_LOCK_BUSY";
                throw error;
            }
            await _sleep(Math.min(POLL_MS, Math.max(1, deadline - Date.now())));
            continue;
        }

        const acquiredAt = new Date();
        const lock = {
            _id: LOCK_ID,
            controlType: CONTROL_TYPE.SLOT_LOCK,
            dedupeKey: LOCK_DEDUPE_KEY,
            serviceId: LOCK_SERVICE_ID,
            resourceId: LOCK_RESOURCE_ID,
            status: "ACTIVE",
            expiresAt: new Date(acquiredAt.getTime() + LOCK_TTL_MS),
            heartbeatAt: acquiredAt,
            payload: {
                lockOwnerId: ownerId,
                lockStatus: "ACTIVE",
                acquiredAt: acquiredAt.toISOString(),
                purpose: "MOVIMIENTOS_CAJA_SEQUENCE_AND_HASH_CHAIN",
            },
            traceId: String(traceId || makeTraceId("fiscal-lock")),
            _createdDate: acquiredAt,
            _updatedDate: acquiredAt,
        };

        try {
            const saved = await dalInsert(CONTROL_COL, lock);
            return {
                id: LOCK_ID,
                ownerId,
                revision: saved?._revision ?? null,
                expiresAt: lock.expiresAt,
                traceId: lock.traceId,
            };
        } catch (error) {
            if (!_isDuplicate(error)) throw error;
            if (Date.now() >= deadline) {
                const busy = new Error("FISCAL_LEDGER_LOCK_BUSY");
                busy.code = "FISCAL_LEDGER_LOCK_BUSY";
                throw busy;
            }
            await _sleep(POLL_MS);
        }
    }
}

export async function assertFiscalLedgerLock(lock) {
    if (!lock?.ownerId) throw new Error("FISCAL_LEDGER_LOCK_INVALID");
    const current = await dalGet(CONTROL_COL, LOCK_ID, "strong");
    if (!current) throw new Error("FISCAL_LEDGER_LOCK_LOST");
    const payload = _readPayload(current);
    const expiresAt = current.expiresAt instanceof Date
        ? current.expiresAt
        : new Date(current.expiresAt);
    if (
        payload.lockOwnerId !== lock.ownerId ||
        !Number.isFinite(expiresAt.getTime()) ||
        expiresAt.getTime() <= Date.now()
    ) {
        throw new Error("FISCAL_LEDGER_LOCK_LOST");
    }
    return true;
}

export async function releaseFiscalLedgerLock(lock) {
    if (!lock?.ownerId) return { released: false, reason: "INVALID_OWNER" };
    const current = await dalGet(CONTROL_COL, LOCK_ID, "strong");
    if (!current) return { released: true, missing: true };
    if (_readPayload(current).lockOwnerId !== lock.ownerId) {
        return { released: false, reason: "OWNERSHIP_CHANGED" };
    }
    try {
        await dalRemove(CONTROL_COL, LOCK_ID);
        return { released: true };
    } catch (error) {
        if (_isNotFound(error)) return { released: true, missing: true };
        return { released: false, reason: error?.message || "RELEASE_FAILED" };
    }
}
