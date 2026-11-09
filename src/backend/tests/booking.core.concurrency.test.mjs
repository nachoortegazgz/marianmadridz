/*
=============================================================================
SUITE: booking.core.concurrency (FASE5 - bateria extendida modulos Bookings)
Purpose: exercise bookingCore.js primitives OFFLINE against the loader mocks:
  slot-key format + fail-closed date validation, mutex lock lifecycle in
  ControlOperativo (acquire / busy / owner-renew / expired reclaim / unlock),
  idempotency transactions (_initTransaction dedupe by payloadHash, COMPLETED
  replay, FAILED preclusion, TRANSACTION_PREVIOUSLY_FAILED), CitasF2
  persistence contract (SSOT-12 traceId mandatory, dual pairToken required,
  revision conflict rejection) and enum frontier translation.
Runs offline via tests/loader.mjs mocks (wix-data legacy builder). G10 ASCII.
=============================================================================
*/
import test from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';

const { wixDataMock } = await import('./loader.mjs');
const BC = await import('backend/booking/bookingCore.js');
const BU = await import('backend/booking/bookingUtils.js');
const IC = await import('backend/internalConfig');

// GUID valido segun mmUtils._looksLikeGuid (forma estandar v4-like)
const RES_A = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const RES_B = '11111111-2222-4333-8444-555555555555';
const SVC = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CONTROL = IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
const CITAS = IC.BUSINESS_COLLECTIONS.CITAS_F2;

function guidFromSlotKey(key) {
  return BC.parseResourceIdFromSlotKey(key);
}

function baseParams(over = {}) {
  return Object.assign({
    bookingId: 'aaaaaaaa-aaaa-4aaa-8aaa-' + Math.random().toString(16).slice(2, 14).padEnd(12, '0'),
    serviceId: SVC,
    resourceId: RES_A,
    scheduleId: RES_B,
    startDate: new Date('2026-10-15T08:00:00Z'),
    endDate: new Date('2026-10-15T09:00:00Z'),
    bookingType: 'SIMPLE',
    traceId: 'tr-unit-ok',
    contactDetails: { firstName: 'Ana', email: 'ana@example.com' },
    totalAmount: 45,
  }, over);
}

// ---------------------------------------------------------------------------
// SLOT KEYS (CORE-13)
// ---------------------------------------------------------------------------

test('BCORE-SLOT-01 generateSlotKey canonical shape slot_svc8_res_start_end', () => {
  const key = BC.generateSlotKey(SVC, RES_A, new Date('2026-10-15T08:00:00Z'), new Date('2026-10-15T09:00:00Z'));
  const parts = key.split('_');
  assert.strictEqual(parts.length, 5, 'slot key debe tener 5 segmentos: ' + key);
  assert.strictEqual(parts[0], 'slot');
  assert.strictEqual(parts[1], SVC.slice(0, 8));
  assert.strictEqual(parts[2], RES_A);
  assert.ok(/^\d+$/.test(parts[3]) && /^\d+$/.test(parts[4]));
  assert.ok(Number(parts[4]) > Number(parts[3]), 'endEpochMin debe superar startEpochMin');
});

test('BCORE-SLOT-02 generateSlotKey rejects inverted/equal dates (INVALID_DATES)', () => {
  const d1 = new Date('2026-10-15T09:00:00Z');
  const d2 = new Date('2026-10-15T08:00:00Z');
  assert.throws(() => BC.generateSlotKey(SVC, RES_A, d1, d2), (e) => e.code === BC.ERROR_CODES.INVALID_DATES || /Invalid slot dates/.test(e.message));
  assert.throws(() => BC.generateSlotKey(SVC, RES_A, d1, d1));
});

test('BCORE-SLOT-03 generateSlotKey requires GUID resourceId (LOCK_KEY_OR_OWNER_INVALID)', () => {
  assert.throws(
    () => BC.generateSlotKey(SVC, 'not-a-guid', new Date('2026-10-15T08:00:00Z'), new Date('2026-10-15T09:00:00Z')),
    (e) => /resourceId is required/.test(e.message)
  );
});

test('BCORE-SLOT-04 _parseResourceIdFromSlotKey roundtrip + tamper rejection', () => {
  const key = BC.generateSlotKey(SVC, RES_A, new Date('2026-10-15T08:00:00Z'), new Date('2026-10-15T09:00:00Z'));
  assert.strictEqual(guidFromSlotKey(key), RES_A);
  // manipulacion: end <= start -> rechazo
  const bad = 'slot_' + SVC.slice(0, 8) + '_' + RES_A + '_999_999';
  assert.strictEqual(guidFromSlotKey(bad), '');
  assert.strictEqual(guidFromSlotKey('basura'), '');
});

// ---------------------------------------------------------------------------
// MUTEX LOCKS (ControlOperativo SLOT_LOCK)
// ---------------------------------------------------------------------------

test('BCORE-LOCK-01 acquire fresh lock writes SLOT_LOCK row with TTL expiry', async () => {
  wixDataMock._reset();
  const key = BC.generateSlotKey(SVC, RES_A, new Date('2026-10-15T08:00:00Z'), new Date('2026-10-15T09:00:00Z'));
  const res = await BC._lockSlotKeyOrFail(key, 'owner-1', 60000, SVC);
  // CORE-39/CORE-45 (v5014): el contrato del lock exitoso es ahora
  // { ok, acquired, version, lockToken } — la saga propaga la version CAS y el
  // token opaco para renovar/liberar sin afectar generaciones posteriores. deepStrictEqual
  // sobre el objeto completo quedo obsoleto; se valida forma + extras.
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.acquired, true);
  assert.ok(typeof res.lockToken === 'string' && res.lockToken.length > 0, 'lockToken opaco emitido');
  const rows = wixDataMock._store.get(CONTROL) || [];
  assert.strictEqual(rows.length, 1);
  const row = rows[0];
  assert.strictEqual(row.controlType, IC.CONTROL_TYPE.SLOT_LOCK);
  assert.strictEqual(row.dedupeKey, key);
  assert.strictEqual(row.resourceId, RES_A);
  assert.strictEqual(row.serviceId, SVC, 'SLOT_LOCK debe guardar el serviceId de la fase bloqueada');
  assert.strictEqual(row.version, 0, 'SLOT_LOCK starts with CAS version zero');
  assert.ok(row.expiresAt instanceof Date);
  const ttl = row.expiresAt.getTime() - Date.now();
  assert.ok(ttl > 0 && ttl <= 60000 + 5000, 'TTL aplicado dentro de tolerancia');
});

test('BCORE-LOCK-02 second owner is refused while lock active (HELD_BY_ANOTHER)', async () => {
  wixDataMock._reset();
  const key = BC.generateSlotKey(SVC, RES_A, new Date('2026-10-15T08:00:00Z'), new Date('2026-10-15T09:00:00Z'));
  await BC._lockSlotKeyOrFail(key, 'owner-1', 60000, SVC);
  const busy = await BC._lockSlotKeyOrFail(key, 'owner-2', 60000, SVC);
  assert.strictEqual(busy.ok, false);
  assert.strictEqual(busy.message, BC.ERROR_CODES.LOCK_HELD_BY_ANOTHER_OWNER);
});

test('BCORE-LOCK-03 same owner re-acquire renews instead of duplicating', async () => {
  wixDataMock._reset();
  const key = BC.generateSlotKey(SVC, RES_A, new Date('2026-10-15T08:00:00Z'), new Date('2026-10-15T09:00:00Z'));
  const first = await BC._lockSlotKeyOrFail(key, 'owner-1', 60000, SVC);
  const again = await BC._lockSlotKeyOrFail(key, 'owner-1', 60000, SVC);
  assert.strictEqual(again.ok, true);
  assert.strictEqual(again.lockToken, first.lockToken, 'same lease generation retains its fencing token');
  assert.strictEqual(again.renewed, true);
  const rows = wixDataMock._store.get(CONTROL) || [];
  assert.strictEqual(rows.length, 1, 'sin filas duplicadas tras renewal');
});

test('BCORE-LOCK-04 expired lock is reclaimed by next owner', async () => {
  wixDataMock._reset();
  const key = BC.generateSlotKey(SVC, RES_A, new Date('2026-10-15T08:00:00Z'), new Date('2026-10-15T09:00:00Z'));
  const first = await BC._lockSlotKeyOrFail(key, 'owner-1', 60000, SVC);
  // forzar expiracion en el store (el mock revive fechas ISO a Date)
  const rows = wixDataMock._store.get(CONTROL);
  rows[0].expiresAt = new Date(Date.now() - 1000);
  const taken = await BC._lockSlotKeyOrFail(key, 'owner-2', 60000, SVC);
  assert.strictEqual(taken.ok, true);
  assert.strictEqual(taken.acquired, true);
  assert.strictEqual(taken.reclaimed, true);
  const payload = wixDataMock._store.get(CONTROL)[0].payload;
  assert.strictEqual(payload.lockOwnerId, 'owner-2');
  assert.notStrictEqual(payload.lockToken, first.lockToken, 'reclaim rotates the fencing token');
  const staleRenewal = await BC._renewLock(key, 'owner-1', 60000, {
    expectedVersion: taken.version,
    expectedLockToken: first.lockToken,
    serviceId: SVC,
  });
  assert.strictEqual(staleRenewal.ok, false, 'previous owner cannot renew a reclaimed lease');
  assert.strictEqual(staleRenewal.reason, BC.ERROR_CODES.LOCK_OWNERSHIP_CHANGED);
});

test('BCORE-LOCK-03B renewal requires matching owner, fencing token and CAS version; preserves service metadata', async () => {
  wixDataMock._reset();
  const key = BC.generateSlotKey(SVC, RES_A, new Date('2026-10-15T08:00:00Z'), new Date('2026-10-15T09:00:00Z'));
  const acquired = await BC._lockSlotKeyOrFail(key, 'owner-1', 60000, SVC);

  const staleToken = await BC._renewLock(key, 'owner-1', 60000, {
    expectedVersion: acquired.version,
    expectedLockToken: 'stale-token',
    serviceId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  });
  assert.strictEqual(staleToken.ok, false);
  assert.strictEqual(staleToken.reason, BC.ERROR_CODES.LOCK_OWNERSHIP_CHANGED);

  const staleRevision = await BC._renewLock(key, 'owner-1', 60000, {
    expectedVersion: 'stale-version',
    expectedLockToken: acquired.lockToken,
    serviceId: SVC,
  });
  assert.strictEqual(staleRevision.ok, false);
  assert.strictEqual(staleRevision.reason, BC.ERROR_CODES.LOCK_CONFLICT);

  const foreignOwner = await BC._renewLock(key, 'owner-x', 60000, {
    expectedVersion: acquired.version,
    expectedLockToken: acquired.lockToken,
    serviceId: SVC,
  });
  assert.strictEqual(foreignOwner.ok, false);
  assert.strictEqual(foreignOwner.reason, BC.ERROR_CODES.LOCK_OWNERSHIP_CHANGED);

  const renewed = await BC._renewLock(key, 'owner-1', 60000, {
    expectedVersion: acquired.version,
    expectedLockToken: acquired.lockToken,
    serviceId: SVC,
  });
  assert.strictEqual(renewed.ok, true);
  assert.strictEqual(renewed.lockToken, acquired.lockToken);
  const row = (wixDataMock._store.get(CONTROL) || [])[0];
  assert.strictEqual(row.serviceId, SVC, 'opaque lock token must never overwrite serviceId');
  assert.strictEqual(row.payload.lockToken, acquired.lockToken);
  assert.strictEqual(renewed.newVersion, acquired.version + 1);
  assert.strictEqual(row.version, renewed.newVersion);
});

test('BCORE-LOCK-03C concurrent renewals from one CAS version allow only one writer', async () => {
  wixDataMock._reset();
  const key = BC.generateSlotKey(SVC, RES_A, new Date('2026-10-15T08:00:00Z'), new Date('2026-10-15T09:00:00Z'));
  const acquired = await BC._lockSlotKeyOrFail(key, 'owner-1', 60000, SVC);

  const attempts = await Promise.all([
    BC._renewLock(key, 'owner-1', 60000, {
      expectedVersion: acquired.version,
      expectedLockToken: acquired.lockToken,
      serviceId: SVC,
    }),
    BC._renewLock(key, 'owner-1', 60000, {
      expectedVersion: acquired.version,
      expectedLockToken: acquired.lockToken,
      serviceId: SVC,
    }),
  ]);

  assert.strictEqual(attempts.filter((result) => result.ok).length, 1);
  assert.strictEqual(attempts.filter((result) => !result.ok).length, 1);
  const row = (wixDataMock._store.get(CONTROL) || [])[0];
  assert.strictEqual(row.version, acquired.version + 1);
});

test('BCORE-LOCK-05 invalid slot key or empty owner rejected without DB touch', async () => {
  wixDataMock._reset();
  const before = (wixDataMock._calls || []).length;
  const r1 = await BC._lockSlotKeyOrFail('no-slot-key', 'owner-1', 60000);
  const r2 = await BC._lockSlotKeyOrFail('slot_x_' + RES_A + '_1_2', '', 60000);
  assert.strictEqual(r1.message, BC.ERROR_CODES.LOCK_KEY_OR_OWNER_INVALID);
  assert.strictEqual(r2.message, BC.ERROR_CODES.LOCK_KEY_OR_OWNER_INVALID);
  assert.strictEqual((wixDataMock._calls || []).length, before, 'fail-fast sin operaciones DB');
});

test('BCORE-LOCK-06 unlock only by owner; foreign unlock skipped, missing ok', async () => {
  wixDataMock._reset();
  const key = BC.generateSlotKey(SVC, RES_A, new Date('2026-10-15T08:00:00Z'), new Date('2026-10-15T09:00:00Z'));
  const acquired = await BC._lockSlotKeyOrFail(key, 'owner-1', 60000, SVC);
  const foreign = await BC._unlockSlotKey(key, 'owner-x', {
    expectedVersion: acquired.version,
    expectedLockToken: acquired.lockToken,
  });
  assert.strictEqual(foreign.ok, false);
  assert.strictEqual(foreign.skipped, true);
  assert.strictEqual((wixDataMock._store.get(CONTROL) || []).length, 1);
  const mine = await BC._unlockSlotKey(key, 'owner-1', {
    expectedVersion: acquired.version,
    expectedLockToken: acquired.lockToken,
  });
  assert.strictEqual(mine.ok, true);
  const releasedRow = (wixDataMock._store.get(CONTROL) || [])[0];
  assert.strictEqual(releasedRow.payload.lockStatus, 'RELEASED');
  assert.strictEqual(releasedRow.expiresAt.getTime(), 0, 'release expires the lease via conditional patch');
  assert.strictEqual(releasedRow.version, acquired.version + 1);
  const staleRelease = await BC._unlockSlotKey(key, 'owner-1', {
    expectedVersion: acquired.version,
    expectedLockToken: acquired.lockToken,
  });
  assert.strictEqual(staleRelease.ok, false, 'stale release cannot alter the tombstone');
  assert.strictEqual(staleRelease.reason, BC.ERROR_CODES.LOCK_CONFLICT);
  wixDataMock._store.set(CONTROL, []);
  const missing = await BC._unlockSlotKey(key, 'owner-1');
  assert.deepStrictEqual(missing, { ok: true, missing: true });
});

test('BCORE-GAP-01 same professional can be locked for a simple booking inside a dual exposure gap', async () => {
  wixDataMock._reset();

  const f1Start = new Date('2026-10-22T08:00:00Z');
  const f1End = new Date('2026-10-22T08:30:00Z');
  const gapStart = new Date('2026-10-22T08:35:00Z');
  const gapEnd = new Date('2026-10-22T08:55:00Z');
  const f2Start = new Date('2026-10-22T09:00:00Z');
  const f2End = new Date('2026-10-22T09:40:00Z');
  const f2ServiceId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  const f1Key = BC.generateSlotKey(SVC, RES_A, f1Start, f1End);
  const f2Key = BC.generateSlotKey(f2ServiceId, RES_A, f2Start, f2End);
  const gapKey = BC.generateSlotKey(SVC, RES_A, gapStart, gapEnd);

  const f1Lock = await BC._lockSlotKeyOrFail(f1Key, 'dual-booking', 60000, SVC);
  const f2Lock = await BC._lockSlotKeyOrFail(f2Key, 'dual-booking', 60000, f2ServiceId);
  assert.strictEqual(f1Lock.ok, true, 'F1 slot lock acquired');
  assert.strictEqual(f2Lock.ok, true, 'F2 slot lock acquired');

  const gapLock = await BC._lockSlotKeyOrFail(gapKey, 'simple-booking', 60000, SVC);
  assert.strictEqual(gapLock.ok, true, 'gap slot remains independently bookable');
  assert.strictEqual(gapLock.acquired, true);

  const rows = wixDataMock._store.get(CONTROL) || [];
  assert.strictEqual(rows.length, 3, 'only F1, F2 and the separate gap booking are locked');
  assert.deepStrictEqual(
    rows.map((row) => row.dedupeKey).sort(),
    [f1Key, f2Key, gapKey].sort(),
    'the exposure interval itself is not a lock and does not collide with the gap booking'
  );
  assert.ok(rows.every((row) => row.resourceId === RES_A), 'all three slots belong to the same professional');
  assert.strictEqual(rows.find((row) => row.dedupeKey === f1Key).serviceId, SVC);
  assert.strictEqual(rows.find((row) => row.dedupeKey === f2Key).serviceId, f2ServiceId);
  assert.strictEqual(rows.find((row) => row.dedupeKey === gapKey).serviceId, SVC);
});

// ---------------------------------------------------------------------------
// IDEMPOTENCIA (TX sobre pairToken como _id)
// ---------------------------------------------------------------------------

test('BCORE-TX-01 first init creates IN_PROGRESS transaction (isNew)', async () => {
  wixDataMock._reset();
  const res = await BC._initTransaction('pt-new-1', 'hashA', 'tr-1', SVC);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.isNew, true);
  const row = (wixDataMock._store.get(CONTROL) || []).find((r) => r._id === 'pt-new-1');
  assert.ok(row, 'fila TX persistida con _id = pairToken');
  assert.strictEqual(row.controlType, IC.CONTROL_TYPE.IDEMPOTENCY);
  // The canonical lease field is the CMS DATETIME expiresAt, never the
  // retired leaseExpiresAt/leasesExpireAt variants.
  assert.ok(row.expiresAt instanceof Date, 'IDEMPOTENCY expiry must be persisted as Date in expiresAt');
  assert.ok(row.expiresAt.getTime() > Date.now(), 'IDEMPOTENCY lease must be active on creation');
  assert.strictEqual(row.leaseExpiresAt, undefined);
  assert.strictEqual(row.leasesExpireAt, undefined);
  const payload = row.payload;
  // CORE-41 (v5014): el estado inicial es IN_PROGRESS (lease activo), no
  // PENDING. Un crash entre insert y heartbeat deja lease expirado que
  // claimTransaction puede reclamar; PENDING no expresaba propiedad activa.
  assert.strictEqual(payload.status, 'IN_PROGRESS');
  assert.strictEqual(payload.payloadHash, 'hashA');
  assert.strictEqual(row.serviceId, SVC);
  assert.strictEqual(payload.serviceId, SVC);
});

test('BCORE-TX-02 completed tx replays without re-execution (isNew false)', async () => {
  wixDataMock._reset();
  await BC._initTransaction('pt-done', 'hashA', 'tr-1', SVC);
  await BC._completeTransaction('pt-done', { bookingId: 'BK-1' }, 'tr-1');
  const replay = await BC._initTransaction('pt-done', 'hashA', 'tr-2', SVC);
  assert.strictEqual(replay.success, true);
  assert.strictEqual(replay.isNew, false);
  assert.strictEqual(replay.existing.status, 'COMPLETED');
  assert.strictEqual(replay.existing.bookingId, 'BK-1');
  assert.strictEqual(replay.existing.serviceId, SVC);
});

test('BCORE-TX-03 same pairToken different payloadHash -> PAYLOAD_MISMATCH', async () => {
  wixDataMock._reset();
  await BC._initTransaction('pt-mis', 'hashA', 'tr-1', SVC);
  await BC._completeTransaction('pt-mis', { bookingId: 'BK-2' }, 'tr-1');
  const clash = await BC._initTransaction('pt-mis', 'hashB', 'tr-2', SVC);
  assert.strictEqual(clash.success, false);
  assert.strictEqual(clash.error, BC.ERROR_CODES.PAIR_TOKEN_PAYLOAD_MISMATCH);
});

test('BCORE-TX-04 previously FAILED tx precludes silent retry', async () => {
  wixDataMock._reset();
  await BC._initTransaction('pt-fail', 'hashA', 'tr-1', SVC);
  await BC._failTransaction('pt-fail', 'boom');
  const retry = await BC._initTransaction('pt-fail', 'hashA', 'tr-2', SVC);
  assert.strictEqual(retry.success, false);
  assert.strictEqual(retry.error, BC.ERROR_CODES.TRANSACTION_PREVIOUSLY_FAILED);
});

test('BCORE-TX-05 empty pairToken rejected immediately', async () => {
  wixDataMock._reset();
  const res = await BC._initTransaction('', 'hashA', 'tr-1', SVC);
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.error, 'INVALID_PAIR_TOKEN');
});

test('BCORE-TX-07 writer intent phases persist and update without losing sibling phase', async () => {
  wixDataMock._reset();
  const intent = {
    schemaVersion: 1,
    bookingType: 'DUAL',
    isDual: true,
    phases: {
      F1: { phase: 'F1', status: 'PREPARED', serviceId: SVC, contactEmail: 'qa@example.test' },
      F2: { phase: 'F2', status: 'PREPARED', serviceId: RES_B, contactEmail: 'qa@example.test' },
    },
  };
  await BC._initTransaction('pt-writer-intent', 'hash-writer-intent', 'tr-writer-intent', SVC, 'owner-1', intent);

  const started = await BC.updateBookingWriterIntent(
    'pt-writer-intent', 'F1', 'INTENT', { writerCallStartedAt: new Date().toISOString() }, 'tr-writer-intent'
  );
  assert.equal(started.ok, true);
  const completed = await BC.updateBookingWriterIntent(
    'pt-writer-intent', 'F1', 'CREATED', { bookingId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, 'tr-writer-intent'
  );
  assert.equal(completed.ok, true);

  const row = (wixDataMock._store.get(CONTROL) || []).find((item) => item._id === 'pt-writer-intent');
  assert.equal(row.payload.writerIntent.phases.F1.status, 'CREATED');
  assert.equal(row.payload.writerIntent.phases.F1.bookingId, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  assert.equal(row.payload.writerIntent.phases.F2.status, 'PREPARED');
  assert.equal(row.payload.writerIntent.phases.F2.contactEmail, 'qa@example.test');
});

test('BCORE-TX-06 oversized result is dropped but state preserved (TX_PAYLOAD cap)', async () => {
  wixDataMock._reset();
  await BC._initTransaction('pt-big', 'hashA', 'tr-1', SVC);
  const fat = { bookingId: 'BK-9', blob: 'x'.repeat(6000) };
  await BC._completeTransaction('pt-big', fat, 'tr-1');
  const row = (wixDataMock._store.get(CONTROL) || []).find((r) => r._id === 'pt-big');
  const payload = row.payload;
  assert.strictEqual(payload.status, 'COMPLETED');
  assert.strictEqual(payload.resultDropped, true);
  assert.strictEqual(payload.bookingId, 'BK-9');
  assert.strictEqual(row.serviceId, SVC);
});

// ---------------------------------------------------------------------------
// PERSISTENCIA CitasF2 (contrato SSOT)
// ---------------------------------------------------------------------------

test('BCORE-PER-01 valid simple booking persists canonical CitasF2 doc', async () => {
  wixDataMock._reset();
  const acceptedAt = new Date('2026-11-05T10:30:00.000Z');
  const out = await BC._persistBooking(baseParams({
    privacyNoticeVersion: 'notice-test-v1',
    privacyNoticeAcceptedAt: acceptedAt,
    privacyNoticePurpose: 'GESTION_RESERVA',
  }), 'tr-persist-1');
  assert.strictEqual(out.created, true);
  const doc = out.item;
  assert.strictEqual(doc.serviceId, SVC);
  assert.strictEqual(doc.scheduleId, RES_B);
  assert.strictEqual(doc.resourceId, RES_A);
  // MATRIZ v15: staffResourceId fue retirado del contrato CitasF2;
  // resourceId es la unica identidad de recurso persistida.
  assert.strictEqual(doc.staffResourceId, undefined);
  assert.strictEqual(doc.dateYmd, '2026-10-15'); // Europe/Madrid desde 08:00Z
  assert.strictEqual(doc.traceId, 'tr-persist-1');
  // SSOT-KEYFIELD-01: la clave canonica del estado interno en CitasF2 es
  // BOOKING_FIELDS.STATUS ("bookingStatus"); el alias legacy "status" esta
  // ERRADICADO y no debe existir en el documento persistido.
  assert.ok(Object.values(IC.CITAS_BOOKING_STATUS).includes(doc.bookingStatus));
  assert.strictEqual(doc.status, undefined);
  assert.ok(Object.values(IC.CITAS_PAYMENT_STATUS).includes(doc.paymentStatus));
  assert.deepStrictEqual(doc.contactDetails, { firstName: 'Ana', email: 'ana@example.com' });
  assert.strictEqual(doc.privacyNoticeVersion, 'notice-test-v1');
  assert.strictEqual(doc.privacyNoticeAcceptedAt.toISOString(), acceptedAt.toISOString());
  assert.strictEqual(doc.privacyNoticePurpose, 'GESTION_RESERVA');
  assert.ok(doc.meta && typeof doc.meta === 'object');
});

test('BCORE-PER-02 missing traceId rejected (SSOT-12 audit trail)', async () => {
  wixDataMock._reset();
  await assert.rejects(
    () => BC._persistBooking(baseParams({ traceId: '' }), ''),
    (e) => e.code === BC.ERROR_CODES.INVALID_PAYLOAD
  );
});

test('BCORE-PER-03 dual booking type without pairToken rejected', async () => {
  wixDataMock._reset();
  await assert.rejects(
    () => BC._persistBooking(baseParams({ bookingType: 'DUALF1', traceId: 'tr-d', pairToken: '' }), 'tr-d'),
    (e) => /pairToken/i.test(e.message)
  );
});

test('BCORE-PER-04 non-GUID scheduleId rejected before write', async () => {
  wixDataMock._reset();
  await assert.rejects(
    () => BC._persistBooking(baseParams({ scheduleId: 'sched-legacy-text' }), 'tr-s'),
    (e) => /scheduleId/.test(e.message)
  );
  const rows = wixDataMock._store.get(CITAS) || [];
  assert.strictEqual(rows.length, 0, 'fail-closed: nada escrito');
});

test('BCORE-PER-05 same bookingId upsert keeps single row; lower revision rejected', async () => {
  wixDataMock._reset();
  const duplicateBookingId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const p = baseParams({ bookingId: duplicateBookingId });
  const first = await BC._persistBooking(p, 'tr-a');
  assert.strictEqual(first.created, true);
  const second = await BC._persistBooking(Object.assign({}, p, { revision: 2, totalAmount: 50 }), 'tr-b');
  assert.strictEqual(second.created, false, 'update, no insert nuevo');
  const rows = wixDataMock._store.get(CITAS) || [];
  assert.strictEqual(rows.filter((r) => r.bookingId === duplicateBookingId).length, 1);
  await assert.rejects(
    () => BC._persistBooking(Object.assign({}, p, { revision: 1 }), 'tr-c'),
    (e) => /revision conflict/i.test(e.message)
  );
});

// ---------------------------------------------------------------------------
// ENUMS EN FRONTERA WIX <-> CMS (CORE-11/20)
// ---------------------------------------------------------------------------

test('BCORE-ENUM-01 native->CMS booking status translation incl. CANCELED alias', () => {
  assert.strictEqual(BC._toCmsBookingStatus('CREATED'), IC.CITAS_BOOKING_STATUS.PENDING);
  assert.strictEqual(BC._toCmsBookingStatus('CONFIRMED'), IC.CITAS_BOOKING_STATUS.CONFIRMED);
  assert.strictEqual(BC._toCmsBookingStatus('CANCELED'), IC.CITAS_BOOKING_STATUS.CANCELED);
  assert.strictEqual(BC._toCmsBookingStatus('DECLINED'), IC.CITAS_BOOKING_STATUS.CANCELED);
});

test('BCORE-ENUM-02 unknown status does not crash frontier (returns null/undefined-safe)', () => {
  const weird = BC._toCmsBookingStatus('ESTADO-MISTERIOSO');
  assert.ok(!weird || Object.values(IC.CITAS_BOOKING_STATUS).includes(weird));
});

// ---------------------------------------------------------------------------
// PAIR TOKEN DUAL (bookingUtils, contrato compartido con saga)
// ---------------------------------------------------------------------------

test('BCORE-PAIR-01 pair token deterministic across calls and input shapes', () => {
  const input = {
    serviceId: SVC, linkedPhases: 'F1+F2', dateYmd: '2026-10-15',
    f1Start: '2026-10-15T09:00:00', f1End: '2026-10-15T10:00:00',
    f2Start: '2026-10-15T10:15:00', f2End: '2026-10-15T11:15:00',
    resourceId: RES_A,
  };
  const t1 = BU._buildPairTokenDeterministic(input);
  const t2 = BU._buildPairTokenDeterministic(Object.assign({}, input));
  assert.strictEqual(t1, t2);
  assert.notStrictEqual(t1, BU._buildPairTokenDeterministic(Object.assign({}, input, { f2Start: '2026-10-15T10:30:00' })));
});

test('BCORE-PAIR-02 inverted phase order fails closed', () => {
  assert.throws(() => BU._buildPairFingerprint({
    serviceId: SVC, linkedPhases: 'F1+F2',
    f1Start: '2026-10-15T11:00:00', f1End: '2026-10-15T12:00:00',
    f2Start: '2026-10-15T09:00:00', f2End: '2026-10-15T10:00:00',
    resourceId: RES_A,
  }));
});


// ---------------------------------------------------------------------------
// LOCATION CONTRACT (CORE-53..57)
// ---------------------------------------------------------------------------

test('BCORE-LOC-01 Writer location prefers the slot returned by Wix', () => {
  const resolved = BC._resolveWriteLocation({ _id: RES_A, locationType: 'BUSINESS' }, { locationId: RES_B });
  assert.deepStrictEqual(resolved, { _id: RES_A, locationType: 'OWNER_BUSINESS' });
});

test('BCORE-LOC-02 Writer location falls back to service config when slot lacks location', () => {
  const resolved = BC._resolveWriteLocation(null, { locationId: RES_B });
  assert.deepStrictEqual(resolved, { _id: RES_B, locationType: 'OWNER_BUSINESS' });
});

test('BCORE-LOC-03 Writer location rejects invalid ids and ignores REST aliases', () => {
  assert.strictEqual(BC._resolveWriteLocation({ _id: 'not-a-guid' }, { locationId: 'also-invalid' }), null);
  assert.deepStrictEqual(
    BC._resolveWriteLocation({ id: RES_A }, { locationId: RES_B }),
    { _id: RES_B, locationType: 'OWNER_BUSINESS' }
  );
});



// ---------------------------------------------------------------------------
// DUAL PAIR PERSISTENCE CONTRACT (CitasF2)
// ---------------------------------------------------------------------------

test('BCORE-DUAL-PER-01 F1 and F2 persist independently with shared pair identity', async () => {
  wixDataMock._reset();
  const pairToken = 'pair-test-persistence-01';
  const f1 = await BC._persistBooking(baseParams({
    bookingId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    bookingType: 'DUAL_F1',
    pairToken,
    traceId: 'tr-dual-f1',
    startDate: new Date('2026-10-15T08:00:00Z'),
    endDate: new Date('2026-10-15T09:00:00Z'),
    meta: {
      pairToken,
      f1Start: '2026-10-15T10:00:00',
      f1End: '2026-10-15T11:00:00',
      f2Start: '2026-10-15T11:15:00',
      f2End: '2026-10-15T12:15:00',
      addOnIds: ['addon-1'],
    },
  }), 'tr-dual-f1');
  const f2 = await BC._persistBooking(baseParams({
    bookingId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    serviceId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    bookingType: 'DUAL_F2',
    pairToken,
    traceId: 'tr-dual-f2',
    startDate: new Date('2026-10-15T09:15:00Z'),
    endDate: new Date('2026-10-15T10:15:00Z'),
    meta: {
      pairToken,
      linkedF1BookingId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      noFee: true,
    },
  }), 'tr-dual-f2');

  assert.strictEqual(f1.created, true);
  assert.strictEqual(f2.created, true);
  const rows = wixDataMock._store.get(CITAS) || [];
  assert.strictEqual(rows.length, 2);
  const persistedF1 = rows.find((row) => row.bookingId === 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  const persistedF2 = rows.find((row) => row.bookingId === 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
  assert.ok(persistedF1 && persistedF2);
  assert.strictEqual(persistedF1.bookingType, 'DUAL_F1');
  assert.strictEqual(persistedF2.bookingType, 'DUAL_F2');
  assert.strictEqual(persistedF1.pairToken, pairToken);
  assert.strictEqual(persistedF2.pairToken, pairToken);
  assert.strictEqual(persistedF1.traceId, 'tr-dual-f1');
  assert.strictEqual(persistedF2.traceId, 'tr-dual-f2');
  assert.strictEqual(persistedF1.meta.f1Start, '2026-10-15T10:00:00');
  assert.deepStrictEqual(persistedF1.meta.addOnIds, ['addon-1']);
  assert.strictEqual(persistedF2.meta.linkedF1BookingId, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  assert.strictEqual(persistedF2.meta.noFee, true);
  assert.ok(persistedF1.slotStart instanceof Date);
  assert.ok(persistedF2.slotStart instanceof Date);
  assert.strictEqual(persistedF1.status, undefined);
  assert.strictEqual(persistedF2.status, undefined);
});


// ---------------------------------------------------------------------------
// END-TO-END PERSISTENCE CONTRACT REGRESSIONS
// ---------------------------------------------------------------------------
test('PERSIST-01 fiscal third-party writer uses the canonical TERCERO record type and EMISOR fallback', async () => {
  const source = await readFile(new URL('../eventLog.js', import.meta.url), 'utf8');
  assert.match(source, /recordType:\s*RECORD_TYPE\.TERCERO/);
  assert.match(source, /input\.nifDestinatario\s*\?\s*THIRD_PARTY_TYPE\.CLIENTE\s*:\s*THIRD_PARTY_TYPE\.EMISOR/);
});

test('PERSIST-02 cash ledger idempotency claim writes required dedupeKey', async () => {
  const source = await readFile(new URL('../cajas.web.js', import.meta.url), 'utf8');
  assert.match(source, /controlType:\s*"LEDGER_IDEMPOTENCY",[\s\S]{0,180}dedupeKey:\s*transactionId/);
});

test('PERSIST-06 online fiscal events populate required staffResourceId from the channel resource', async () => {
  const source = await readFile(new URL('../eventLog.js', import.meta.url), 'utf8');
  assert.match(source, /staffResourceId:\s*_safeTrim\([\s\S]{0,160}input\.staffResourceId\s*\|\|\s*input\.resourceId\s*\|\|\s*"CAJA_LOCAL"/);
});

test('PERSIST-08 online payment flow projects CajaActual and retries idempotently', async () => {
  const eventLog = await readFile(new URL('../eventLog.js', import.meta.url), 'utf8');
  const events = await readFile(new URL('../events.js', import.meta.url), 'utf8');
  assert.match(eventLog, /updateCajaActualFromMovement\(cabecera,\s*traceId\)/);
  assert.match(events, /updateCajaActualFromMovement\(existingLedgerRes\.items\[0\],\s*traceId\)/);
  const caja = await readFile(new URL('../cajas.web.js', import.meta.url), 'utf8');
  assert.match(caja, /appliedMovementIds\.includes\(movementKey\)/);
  assert.match(caja, /dalUpdate\(CAJA_ACTUAL_COL,\s*cashRegister\)/);
});

test('PERSIST-07 booking frontend sends the version of the displayed privacy notice', async () => {
  const source = await readFile(new URL('../../pages/Calendario de reservas 2.q39h6.js', import.meta.url), 'utf8');
  assert.match(source, /BOOKING_PRIVACY_NOTICE_VERSION\s*=\s*"RESERVAS_PRIVACIDAD_2026-11-05_V1"/);
  assert.match(source, /privacyNoticeVersion:\s*BOOKING_PRIVACY_NOTICE_VERSION/);
});

test('PERSIST-05 booking privacy metadata reaches the CitasF2 writer', async () => {
  const source = await readFile(new URL('../booking/bookingSaga.js', import.meta.url), 'utf8');
  assert.match(source, /privacyNoticeVersion:\s*unsafePayload\?\.privacyNoticeVersion/);
  assert.match(source, /privacyNoticeAcceptedAt:\s*unsafePayload\?\.privacyNoticeAcceptedAt/);
  assert.match(source, /privacyNoticePurpose:\s*unsafePayload\?\.privacyNoticePurpose/);
  const core = await readFile(new URL('../booking/bookingCore.js', import.meta.url), 'utf8');
  assert.match(core, /privacyNoticeAcceptedAt:\s*p\.privacyNoticeAcceptedAt/);
});
