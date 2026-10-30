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

const { wixDataMock } = await import('./loader.mjs');
const BC = await import('backend/booking/bookingCore.js');
const BU = await import('backend/booking/bookingUtils.js');
const IC = await import('backend/internalConfig');

// GUID valido segun mmUtils._looksLikeGuid (forma estandar v4-like)
const RES_A = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const RES_B = '11111111-2222-4333-8444-555555555555';
const SVC = 'svc9f8e7d6c';
const CONTROL = IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
const CITAS = IC.BUSINESS_COLLECTIONS.CITAS_F2;

function guidFromSlotKey(key) {
  return BC.parseResourceIdFromSlotKey(key);
}

function baseParams(over = {}) {
  return Object.assign({
    bookingId: 'BK-' + Math.random().toString(36).slice(2, 8),
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
  const res = await BC._lockSlotKeyOrFail(key, 'owner-1', 60000);
  // CORE-39/CORE-45 (v5014): el contrato del lock exitoso es ahora
  // { ok, acquired, revision, lockToken } — la saga necesita el lockToken y
  // la _revision para unlock/renew atomicos con optimismo. deepStrictEqual
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
  assert.ok(row.expiresAt instanceof Date);
  const ttl = row.expiresAt.getTime() - Date.now();
  assert.ok(ttl > 0 && ttl <= 60000 + 5000, 'TTL aplicado dentro de tolerancia');
});

test('BCORE-LOCK-02 second owner is refused while lock active (HELD_BY_ANOTHER)', async () => {
  wixDataMock._reset();
  const key = BC.generateSlotKey(SVC, RES_A, new Date('2026-10-15T08:00:00Z'), new Date('2026-10-15T09:00:00Z'));
  await BC._lockSlotKeyOrFail(key, 'owner-1', 60000);
  const busy = await BC._lockSlotKeyOrFail(key, 'owner-2', 60000);
  assert.strictEqual(busy.ok, false);
  assert.strictEqual(busy.message, BC.ERROR_CODES.LOCK_HELD_BY_ANOTHER_OWNER);
});

test('BCORE-LOCK-03 same owner re-acquire renews instead of duplicating', async () => {
  wixDataMock._reset();
  const key = BC.generateSlotKey(SVC, RES_A, new Date('2026-10-15T08:00:00Z'), new Date('2026-10-15T09:00:00Z'));
  await BC._lockSlotKeyOrFail(key, 'owner-1', 60000);
  const again = await BC._lockSlotKeyOrFail(key, 'owner-1', 60000);
  assert.strictEqual(again.ok, true);
  assert.strictEqual(again.renewed, true);
  const rows = wixDataMock._store.get(CONTROL) || [];
  assert.strictEqual(rows.length, 1, 'sin filas duplicadas tras renewal');
});

test('BCORE-LOCK-04 expired lock is reclaimed by next owner', async () => {
  wixDataMock._reset();
  const key = BC.generateSlotKey(SVC, RES_A, new Date('2026-10-15T08:00:00Z'), new Date('2026-10-15T09:00:00Z'));
  await BC._lockSlotKeyOrFail(key, 'owner-1', 60000);
  // forzar expiracion en el store (el mock revive fechas ISO a Date)
  const rows = wixDataMock._store.get(CONTROL);
  rows[0].expiresAt = new Date(Date.now() - 1000);
  const taken = await BC._lockSlotKeyOrFail(key, 'owner-2', 60000);
  assert.strictEqual(taken.ok, true);
  assert.strictEqual(taken.acquired, true);
  assert.strictEqual(taken.reclaimed, true);
  const payload = wixDataMock._store.get(CONTROL)[0].payload;
  assert.strictEqual(payload.lockOwnerId, 'owner-2');
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
  await BC._lockSlotKeyOrFail(key, 'owner-1', 60000);
  const foreign = await BC._unlockSlotKey(key, 'owner-x');
  assert.strictEqual(foreign.ok, false);
  assert.strictEqual(foreign.skipped, true);
  assert.strictEqual((wixDataMock._store.get(CONTROL) || []).length, 1);
  const mine = await BC._unlockSlotKey(key, 'owner-1');
  assert.strictEqual(mine.ok, true);
  assert.strictEqual((wixDataMock._store.get(CONTROL) || []).length, 0);
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
  const f2ServiceId = 'svc2f8e7d6c';

  const f1Key = BC.generateSlotKey(SVC, RES_A, f1Start, f1End);
  const f2Key = BC.generateSlotKey(f2ServiceId, RES_A, f2Start, f2End);
  const gapKey = BC.generateSlotKey(SVC, RES_A, gapStart, gapEnd);

  const f1Lock = await BC._lockSlotKeyOrFail(f1Key, 'dual-booking', 60000);
  const f2Lock = await BC._lockSlotKeyOrFail(f2Key, 'dual-booking', 60000);
  assert.strictEqual(f1Lock.ok, true, 'F1 slot lock acquired');
  assert.strictEqual(f2Lock.ok, true, 'F2 slot lock acquired');

  const gapLock = await BC._lockSlotKeyOrFail(gapKey, 'simple-booking', 60000);
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
});

// ---------------------------------------------------------------------------
// IDEMPOTENCIA (TX sobre pairToken como _id)
// ---------------------------------------------------------------------------

test('BCORE-TX-01 first init creates IN_PROGRESS transaction (isNew)', async () => {
  wixDataMock._reset();
  const res = await BC._initTransaction('pt-new-1', 'hashA', 'tr-1');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.isNew, true);
  const row = (wixDataMock._store.get(CONTROL) || []).find((r) => r._id === 'pt-new-1');
  assert.ok(row, 'fila TX persistida con _id = pairToken');
  assert.strictEqual(row.controlType, IC.CONTROL_TYPE.IDEMPOTENCY);
  const payload = row.payload;
  // CORE-41 (v5014): el estado inicial es IN_PROGRESS (lease activo), no
  // PENDING. Un crash entre insert y heartbeat deja lease expirado que
  // claimTransaction puede reclamar; PENDING no expresaba propiedad activa.
  assert.strictEqual(payload.status, 'IN_PROGRESS');
  assert.strictEqual(payload.payloadHash, 'hashA');
});

test('BCORE-TX-02 completed tx replays without re-execution (isNew false)', async () => {
  wixDataMock._reset();
  await BC._initTransaction('pt-done', 'hashA', 'tr-1');
  await BC._completeTransaction('pt-done', { bookingId: 'BK-1' }, 'tr-1');
  const replay = await BC._initTransaction('pt-done', 'hashA', 'tr-2');
  assert.strictEqual(replay.success, true);
  assert.strictEqual(replay.isNew, false);
  assert.strictEqual(replay.existing.status, 'COMPLETED');
  assert.strictEqual(replay.existing.bookingId, 'BK-1');
});

test('BCORE-TX-03 same pairToken different payloadHash -> PAYLOAD_MISMATCH', async () => {
  wixDataMock._reset();
  await BC._initTransaction('pt-mis', 'hashA', 'tr-1');
  await BC._completeTransaction('pt-mis', { bookingId: 'BK-2' }, 'tr-1');
  const clash = await BC._initTransaction('pt-mis', 'hashB', 'tr-2');
  assert.strictEqual(clash.success, false);
  assert.strictEqual(clash.error, BC.ERROR_CODES.PAIR_TOKEN_PAYLOAD_MISMATCH);
});

test('BCORE-TX-04 previously FAILED tx precludes silent retry', async () => {
  wixDataMock._reset();
  await BC._initTransaction('pt-fail', 'hashA', 'tr-1');
  await BC._failTransaction('pt-fail', 'boom');
  const retry = await BC._initTransaction('pt-fail', 'hashA', 'tr-2');
  assert.strictEqual(retry.success, false);
  assert.strictEqual(retry.error, BC.ERROR_CODES.TRANSACTION_PREVIOUSLY_FAILED);
});

test('BCORE-TX-05 empty pairToken rejected immediately', async () => {
  wixDataMock._reset();
  const res = await BC._initTransaction('', 'hashA', 'tr-1');
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.error, 'INVALID_PAIR_TOKEN');
});

test('BCORE-TX-06 oversized result is dropped but state preserved (TX_PAYLOAD cap)', async () => {
  wixDataMock._reset();
  await BC._initTransaction('pt-big', 'hashA', 'tr-1');
  const fat = { bookingId: 'BK-9', blob: 'x'.repeat(2000) };
  await BC._completeTransaction('pt-big', fat, 'tr-1');
  const row = (wixDataMock._store.get(CONTROL) || []).find((r) => r._id === 'pt-big');
  const payload = row.payload;
  assert.strictEqual(payload.status, 'COMPLETED');
  assert.strictEqual(payload.resultDropped, true);
  assert.strictEqual(payload.bookingId, 'BK-9');
});

// ---------------------------------------------------------------------------
// PERSISTENCIA CitasF2 (contrato SSOT)
// ---------------------------------------------------------------------------

test('BCORE-PER-01 valid simple booking persists canonical CitasF2 doc', async () => {
  wixDataMock._reset();
  const out = await BC._persistBooking(baseParams(), 'tr-persist-1');
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
  const p = baseParams({ bookingId: 'BK-DUP' });
  const first = await BC._persistBooking(p, 'tr-a');
  assert.strictEqual(first.created, true);
  const second = await BC._persistBooking(Object.assign({}, p, { revision: 2, totalAmount: 50 }), 'tr-b');
  assert.strictEqual(second.created, false, 'update, no insert nuevo');
  const rows = wixDataMock._store.get(CITAS) || [];
  assert.strictEqual(rows.filter((r) => r.bookingId === 'BK-DUP').length, 1);
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
  assert.strictEqual(BC._toCmsBookingStatus('CANCELED'), IC.CITAS_BOOKING_STATUS.CANCELLED);
  assert.strictEqual(BC._toCmsBookingStatus('DECLINED'), IC.CITAS_BOOKING_STATUS.CANCELLED);
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

test('BCORE-LOC-03 Writer location rejects invalid ids without guessing', () => {
  assert.strictEqual(BC._resolveWriteLocation({ _id: 'not-a-guid' }, { locationId: 'also-invalid' }), null);
});



// ---------------------------------------------------------------------------
// DUAL PAIR PERSISTENCE CONTRACT (CitasF2)
// ---------------------------------------------------------------------------

test('BCORE-DUAL-PER-01 F1 and F2 persist independently with shared pair identity', async () => {
  wixDataMock._reset();
  const pairToken = 'pair-test-persistence-01';
  const f1 = await BC._persistBooking(baseParams({
    bookingId: 'BK-DUAL-F1',
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
    bookingId: 'BK-DUAL-F2',
    serviceId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    bookingType: 'DUAL_F2',
    pairToken,
    traceId: 'tr-dual-f2',
    startDate: new Date('2026-10-15T09:15:00Z'),
    endDate: new Date('2026-10-15T10:15:00Z'),
    meta: {
      pairToken,
      linkedF1BookingId: 'BK-DUAL-F1',
      noFee: true,
    },
  }), 'tr-dual-f2');

  assert.strictEqual(f1.created, true);
  assert.strictEqual(f2.created, true);
  const rows = wixDataMock._store.get(CITAS) || [];
  assert.strictEqual(rows.length, 2);
  const persistedF1 = rows.find((row) => row.bookingId === 'BK-DUAL-F1');
  const persistedF2 = rows.find((row) => row.bookingId === 'BK-DUAL-F2');
  assert.ok(persistedF1 && persistedF2);
  assert.strictEqual(persistedF1.bookingType, 'DUAL_F1');
  assert.strictEqual(persistedF2.bookingType, 'DUAL_F2');
  assert.strictEqual(persistedF1.pairToken, pairToken);
  assert.strictEqual(persistedF2.pairToken, pairToken);
  assert.strictEqual(persistedF1.traceId, 'tr-dual-f1');
  assert.strictEqual(persistedF2.traceId, 'tr-dual-f2');
  assert.strictEqual(persistedF1.meta.f1Start, '2026-10-15T10:00:00');
  assert.deepStrictEqual(persistedF1.meta.addOnIds, ['addon-1']);
  assert.strictEqual(persistedF2.meta.linkedF1BookingId, 'BK-DUAL-F1');
  assert.strictEqual(persistedF2.meta.noFee, true);
  assert.ok(persistedF1.slotStart instanceof Date);
  assert.ok(persistedF2.slotStart instanceof Date);
  assert.strictEqual(persistedF1.status, undefined);
  assert.strictEqual(persistedF2.status, undefined);
});
