import test from 'node:test';
import assert from 'node:assert/strict';

const { wixDataMock } = await import('./loader.mjs');
const IC = await import('backend/internalConfig.js');
const { wixBookingsV2_onBookingCanceled } = await import('backend/events.js');

const BOOKING_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const CITA_ID = '22222222-2222-4222-8222-222222222222';
const CITA_COLLECTION = IC.BUSINESS_COLLECTIONS.CITAS_F2;
const CONTROL_COLLECTION = IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;

function canceledEvent() {
  return {
    metadata: { id: EVENT_ID },
    data: { booking: { _id: BOOKING_ID, status: 'CANCELED' } },
  };
}

function seedCita() {
  wixDataMock._seed(CITA_COLLECTION, [{
    _id: CITA_ID,
    bookingId: BOOKING_ID,
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
  assert.equal(cita.bookingStatus, IC.CITAS_BOOKING_STATUS.CANCELLED || IC.CITAS_BOOKING_STATUS.CANCELED);
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
