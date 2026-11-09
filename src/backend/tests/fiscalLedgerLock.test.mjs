import { test } from "node:test";
import assert from "node:assert/strict";
import { wixDataMock } from "./loader.mjs";
import {
  acquireFiscalLedgerLock,
  releaseFiscalLedgerLock,
} from "../fiscalLedgerLock.js";

const CONTROL = "ControlOperativo";

test("FISCAL-LOCK-01 serializes concurrent fiscal ledger writers", async () => {
  wixDataMock._reset();
  const first = await acquireFiscalLedgerLock("trace-fiscal-lock-001", { waitMs: 0 });
  await assert.rejects(
    () => acquireFiscalLedgerLock("trace-fiscal-lock-002", { waitMs: 0 }),
    (error) => error?.code === "FISCAL_LEDGER_LOCK_BUSY",
  );

  const released = await releaseFiscalLedgerLock(first);
  assert.equal(released.released, true);

  const second = await acquireFiscalLedgerLock("trace-fiscal-lock-003", { waitMs: 0 });
  assert.notEqual(second.ownerId, first.ownerId);
  await releaseFiscalLedgerLock(second);
});

test("FISCAL-LOCK-02 reclaims only an expired lock", async () => {
  wixDataMock._reset();
  wixDataMock._seed(CONTROL, [{
    _id: "FISCAL_LEDGER_CHAIN_LOCK",
    controlType: "SLOT_LOCK",
    dedupeKey: "FISCAL_LEDGER_HASH_SEQUENCE",
    serviceId: "00000000-0000-4000-8000-000000000001",
    resourceId: "00000000-0000-4000-8000-000000000002",
    expiresAt: new Date(Date.now() - 1000),
    payload: { lockOwnerId: "expired-owner", lockStatus: "ACTIVE" },
    traceId: "trace-expired-lock",
  }]);

  const lock = await acquireFiscalLedgerLock("trace-fiscal-lock-004", { waitMs: 0 });
  assert.notEqual(lock.ownerId, "expired-owner");
  const stored = wixDataMock._store.get(CONTROL).find((row) => row._id === lock.id);
  assert.equal(stored.payload.lockOwnerId, lock.ownerId);
  await releaseFiscalLedgerLock(lock);
});

test("FISCAL-LOCK-03 a previous owner cannot release a reclaimed lock", async () => {
  wixDataMock._reset();
  const first = await acquireFiscalLedgerLock("trace-fiscal-lock-005", { waitMs: 0 });
  const row = wixDataMock._store.get(CONTROL).find((item) => item._id === first.id);
  row.payload = { ...row.payload, lockOwnerId: "new-owner" };

  const result = await releaseFiscalLedgerLock(first);
  assert.deepEqual(result, { released: false, reason: "OWNERSHIP_CHANGED" });
  assert.equal(wixDataMock._store.get(CONTROL).length, 1);
});

test("FISCAL-LOCK-04 release reports CMS read failure without throwing", async () => {
  wixDataMock._reset();
  const lock = await acquireFiscalLedgerLock("trace-fiscal-lock-release-read-001", { waitMs: 0 });
  const originalGet = wixDataMock.get;
  wixDataMock.get = async () => {
    throw Object.assign(new Error("simulated CMS read outage"), { code: "CMS_UNAVAILABLE" });
  };

  try {
    const result = await releaseFiscalLedgerLock(lock);
    assert.deepEqual(result, {
      released: false,
      reason: "RELEASE_READ_FAILED",
      errorCode: "CMS_UNAVAILABLE",
    });
  } finally {
    wixDataMock.get = originalGet;
  }
});
