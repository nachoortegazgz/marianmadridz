import test from 'node:test';
import assert from 'node:assert/strict';

const { wixDataMock } = await import('./loader.mjs');
const IC = await import('backend/internalConfig.js');
const { wixBookingsV2_onBookingCanceled, buildCancellationRectificationTransactionId } = await import('backend/events.js');

const BOOKING_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const CITA_ID = '22222222-2222-4222-8222-222222222222';
const CITA_COLLECTION = IC.BUSINESS_COLLECTIONS.CITAS_F2;
const CONTROL_COLLECTION = IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;

function canceledEvent() {
  return {
    metadata: { id: EVENT_ID },
    data: {
      booking: { id: BOOKING_ID, _id: BOOKING_ID, status: 'CANCELED' },
    },
  };
}

function seedCita() {
  wixDataMock._seed(CITA_COLLECTION, [{
    _id: CITA_ID,
    bookingId: BOOKING_ID,
    scheduleId: '99999999-9999-4999-8999-999999999999',
    traceId: 'trace-test-cita-cancel',
    bookingStatus: IC.CITAS_BOOKING_STATUS.CONFIRMED,
    paymentStatus: IC.CITAS_PAYMENT_STATUS.NOT_PAID,
    meta: {},
  }]);
  wixDataMock._seed(CONTROL_COLLECTION, []);
}

test.beforeEach(() => wixDataMock._reset());

test('BOOKING_CANCELED persists CitasF2 before marking the webhook processed', async () => {
  seedCita();

  const result = await wixBookingsV2_onBookingCanceled(canceledEvent());

  assert.equal(result.status, 'OK');
  const cita = wixDataMock._store.get(CITA_COLLECTION).find((row) => row.bookingId === BOOKING_ID);
  assert.equal(cita.bookingStatus, IC.CITAS_BOOKING_STATUS.CANCELED);
  const eventRows = wixDataMock._store.get(CONTROL_COLLECTION) || [];
  assert.equal(eventRows.filter((row) => row.eventId === EVENT_ID).length, 1);
});

test('BOOKING_CANCELED does not mark the event processed when CitasF2 is missing', async () => {
  wixDataMock._seed(CITA_COLLECTION, []);
  wixDataMock._seed(CONTROL_COLLECTION, []);

  await assert.rejects(
    wixBookingsV2_onBookingCanceled(canceledEvent()),
    /CITASF2_CANCEL_SYNC_FAILED:NOT_FOUND/,
  );
  assert.equal((wixDataMock._store.get(CONTROL_COLLECTION) || []).some((row) => row.eventId === EVENT_ID), false);
});

test('BOOKING_CANCELED propagates CitasF2 read failures instead of treating them as missing', async () => {
  seedCita();
  wixDataMock._findErrors.set(CITA_COLLECTION, new Error('CMS_READ_UNAVAILABLE'));

  await assert.rejects(
    wixBookingsV2_onBookingCanceled(canceledEvent()),
    /CMS_READ_UNAVAILABLE/,
  );
  assert.equal((wixDataMock._store.get(CONTROL_COLLECTION) || []).some((row) => row.eventId === EVENT_ID), false);
});


test('BOOKING_CANCELED replay reconciles a stale CitasF2 row even when the event marker already exists', async () => {
  seedCita();
  wixDataMock._store.set(CONTROL_COLLECTION, [{
    _id: 'existing-webhook-marker',
    controlType: IC.CONTROL_TYPE.WEBHOOK_EVENT,
    dedupeKey: `WEBHOOK_${EVENT_ID}`,
    eventId: EVENT_ID,
    status: IC.CONTROL_STATUS.COMPLETED,
    payload: { eventType: 'BOOKING_CANCELED' },
  }]);

  const result = await wixBookingsV2_onBookingCanceled(canceledEvent());

  assert.equal(result.status, 'OK');
  const cita = wixDataMock._store.get(CITA_COLLECTION).find((row) => row.bookingId === BOOKING_ID);
  assert.equal(cita.bookingStatus, IC.CITAS_BOOKING_STATUS.CANCELED);
});


test('DUAL-CANCEL-01 one canceled phase does not refund a paid dual booking and creates a repair flag', async () => {
  const pairToken = '33333333-3333-4333-8333-333333333333';
  const f1 = '44444444-4444-4444-8444-444444444444';
  const f2 = '55555555-5555-4555-8555-555555555555';
  const orderId = '66666666-6666-4666-8666-666666666666';
  wixDataMock._seed(CITA_COLLECTION, [
    {
      _id: 'dual-cita-f1',
      bookingId: f1,
      scheduleId: '77777777-7777-4777-8777-777777777771',
      traceId: 'trace-test-dual-f1',
      pairToken,
      orderId,
      bookingStatus: IC.CITAS_BOOKING_STATUS.CONFIRMED,
      paymentStatus: IC.CITAS_PAYMENT_STATUS.PAID,
      serviceId: '77777777-7777-4777-8777-777777777777',
    },
    {
      _id: 'dual-cita-f2',
      bookingId: f2,
      scheduleId: '88888888-8888-4888-8888-888888888881',
      traceId: 'trace-test-dual-f2',
      pairToken,
      orderId,
      bookingStatus: IC.CITAS_BOOKING_STATUS.CONFIRMED,
      paymentStatus: IC.CITAS_PAYMENT_STATUS.PAID,
      serviceId: '88888888-8888-4888-8888-888888888888',
    },
  ]);
  wixDataMock._seed(CONTROL_COLLECTION, []);
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA, [{
    _id: 'original-dual-ledger',
    orderId,
    movementType: IC.MOVEMENT_TYPE.VENTA_ONLINE,
    totalAmount: 120,
    taxBase: 99.17,
    taxAmount: 20.83,
    tipoImpositivo: 0.21,
    linkedBookingIds: [f1, f2],
    transactionId: `ORDER-${orderId}`,
  }]);

  const result = await wixBookingsV2_onBookingCanceled({
    metadata: { id: '99999999-9999-4999-8999-999999999991' },
    data: { booking: { _id: f1, id: f1, status: 'CANCELED' } },
  });

  assert.equal(result.status, 'OK');
  assert.equal(result.dualCancellationState, 'REPAIR_REQUIRED');
  const ledgerRows = wixDataMock._store.get(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA) || [];
  assert.equal(ledgerRows.some((row) => row.movementType === IC.MOVEMENT_TYPE.REEMBOLSO), false);
  const flag = (wixDataMock._store.get(CONTROL_COLLECTION) || []).find((row) =>
    row.alertType === 'DUAL_BOOKING_CANCELLATION_MISMATCH'
  );
  assert.equal(flag.status, 'REPAIR_REQUIRED');
  assert.deepEqual(flag.payload.bookingIds.sort(), [f1, f2].sort());
});

test('DUAL-CANCEL-02 the second phase resolves the pair and uses a stable pair-level rectification key', async () => {
  const pairToken = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
  const f1 = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
  const f2 = 'cccccccc-3333-4333-8333-cccccccccccc';
  const orderId = 'dddddddd-4444-4444-8444-dddddddddddd';
  wixDataMock._seed(CITA_COLLECTION, [
    {
      _id: 'dual-cita-f1',
      bookingId: f1,
      pairToken,
      orderId,
      bookingStatus: IC.CITAS_BOOKING_STATUS.CANCELED,
      paymentStatus: IC.CITAS_PAYMENT_STATUS.NOT_PAID,
      serviceId: 'eeeeeeee-5555-4555-8555-eeeeeeeeeeee',
    },
    {
      _id: 'dual-cita-f2',
      bookingId: f2,
      pairToken,
      orderId,
      bookingStatus: IC.CITAS_BOOKING_STATUS.CONFIRMED,
      paymentStatus: IC.CITAS_PAYMENT_STATUS.NOT_PAID,
      serviceId: 'ffffffff-6666-4666-8666-ffffffffffff',
    },
  ]);
  wixDataMock._seed(CONTROL_COLLECTION, []);
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA, []);

  const result = await wixBookingsV2_onBookingCanceled({
    metadata: { id: '99999999-9999-4999-8999-999999999992' },
    data: { booking: { _id: f2, id: f2, status: 'CANCELED' } },
  });

  assert.equal(result.status, 'OK');
  assert.equal(result.dualCancellationState, 'RESOLVED');
  assert.equal(buildCancellationRectificationTransactionId(pairToken, f2), `RECT-PAIR-${pairToken}`);
  assert.equal(buildCancellationRectificationTransactionId(null, f2), `RECT-${f2}`);
  const flag = (wixDataMock._store.get(CONTROL_COLLECTION) || []).find((row) =>
    row.alertType === 'DUAL_BOOKING_CANCELLATION_MISMATCH'
  );
  assert.equal(flag.status, 'RESOLVED');
  assert.equal(flag.payload.fiscalStatus, 'NOT_REQUIRED');
});
