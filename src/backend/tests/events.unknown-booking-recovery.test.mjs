import test from 'node:test';
import assert from 'node:assert/strict';

import { wixDataMock, mocks } from './loader.mjs';
const IC = await import('backend/internalConfig.js');

let readerResponses = [];
let readerQueries = [];
mocks.sdk["@wix/bookings::@wix/bookings::extendedBookings::queryExtendedBookings"] = async (query) => {
  readerQueries.push(query);
  return readerResponses.shift() || { extendedBookings: [], pagingMetadata: { cursors: { next: null } } };
};

const { reconcileUnknownTransaction } = await import('backend/events.js');

const TX_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10';
const SERVICE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const SIMPLE_BOOKING_ID = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
const F1_BOOKING_ID = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
const F2_BOOKING_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
const RESOURCE_ID = '11111111-2222-4333-8444-555555555555';
const SCHEDULE_ID = '66666666-7777-4888-8999-aaaaaaaaaaaa';
const CONTACT_ID = '99999999-aaaa-4bbb-8ccc-dddddddddddd';
const START_DATE = '2026-11-07T08:00:00.000Z';
const END_DATE = '2026-11-07T08:50:00.000Z';

function writerPhase(phase, bookingType, serviceId, startDate = START_DATE, endDate = END_DATE) {
  return {
    phase,
    status: 'INTENT',
    bookingType,
    serviceId,
    scheduleId: SCHEDULE_ID,
    resourceId: RESOURCE_ID,
    startDate,
    endDate,
    createdDateFrom: new Date(Date.now() - 120000).toISOString(),
    contactId: CONTACT_ID,
    contactEmail: null,
    totalAmount: phase === 'F1' ? 25 : 0,
    paymentStatus: 'NOT_PAID',
    bookingStatus: 'CONFIRMED',
    privacyNoticeVersion: 'v1',
    privacyNoticeAcceptedAt: new Date().toISOString(),
    privacyNoticePurpose: 'BOOKING',
    meta: { pairToken: TX_ID },
  };
}

function writerIntent(dual = false) {
  return {
    schemaVersion: 1,
    bookingType: dual ? 'DUAL' : 'SIMPLE',
    isDual: dual,
    phases: {
      F1: writerPhase('F1', dual ? IC.BOOKING_TYPE.DUAL_F1 : IC.BOOKING_TYPE.SIMPLE, SERVICE_ID),
      ...(dual ? {
        F2: writerPhase('F2', IC.BOOKING_TYPE.DUAL_F2, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
          '2026-11-07T09:30:00.000Z', '2026-11-07T10:30:00.000Z'),
      } : {}),
    },
  };
}

function nativeBooking(bookingId, intent) {
  return {
    _id: bookingId,
    revision: 1,
    status: 'CONFIRMED',
    paymentStatus: 'NOT_PAID',
    startDate: intent.startDate,
    endDate: intent.endDate,
    createdDate: new Date().toISOString(),
    contactDetails: { contactId: CONTACT_ID, email: 'qa@example.test', firstName: 'QA', lastName: 'Browser' },
    bookedEntity: {
      slot: {
        serviceId: intent.serviceId,
        scheduleId: SCHEDULE_ID,
        resource: { _id: RESOURCE_ID },
      },
    },
  };
}


function seedUnknownTransaction(writerIntent = null) {
  wixDataMock._reset();
  wixDataMock._seed('ControlOperativo', [{
    _id: TX_ID,
    controlType: IC.CONTROL_TYPE.IDEMPOTENCY,
    dedupeKey: 'TX_' + TX_ID,
    serviceId: SERVICE_ID,
    traceId: 'trace-qa-unknown-booking-001',
    payload: {
      status: 'RESULT_UNKNOWN',
      serviceId: SERVICE_ID,
      payloadHash: 'synthetic-payload-hash',
      ownerTraceId: 'trace-qa-unknown-booking-001',
      uncertainStep: 'CreateBookings',
      ...(writerIntent ? { writerIntent } : {}),
    },
  }]);
}

function alertRecords() {
  return (wixDataMock._store.get('ControlOperativo') || []).filter(
    (row) => row.controlType === IC.CONTROL_TYPE.ALERT
  );
}

function transactionPayload() {
  const row = (wixDataMock._store.get('ControlOperativo') || [])[0];
  return row?.payload || {};
}

test('QA-UNKNOWN-BOOKING-01 a single SIMPLE projection reconciles to its native bookingId', async () => {
  seedUnknownTransaction();
  wixDataMock._seed('CitasF2', [{
    _id: 'cita-simple-projection-1',
    pairToken: TX_ID,
    bookingType: IC.BOOKING_TYPE.SIMPLE,
    bookingId: SIMPLE_BOOKING_ID,
  }]);

  const result = await reconcileUnknownTransaction(TX_ID, 'trace-qa-reconcile-simple-001');

  assert.equal(result.ok, true);
  assert.equal(result.reconciled, true);
  assert.deepEqual(result.bookingIds, [SIMPLE_BOOKING_ID]);
  assert.equal(transactionPayload().status, 'COMPLETED');
  assert.deepEqual(transactionPayload().bookingIds, [SIMPLE_BOOKING_ID]);
  assert.equal(transactionPayload().reconciliationMode, 'SIMPLE_PROJECTION');
});

test('QA-UNKNOWN-BOOKING-02 exactly one DUAL_F1 and one DUAL_F2 projection reconcile by native bookingIds', async () => {
  seedUnknownTransaction();
  wixDataMock._seed('CitasF2', [
    {
      _id: 'cita-dual-f1-projection',
      pairToken: TX_ID,
      bookingType: IC.BOOKING_TYPE.DUAL_F1,
      bookingId: F1_BOOKING_ID,
    },
    {
      _id: 'cita-dual-f2-projection',
      pairToken: TX_ID,
      bookingType: IC.BOOKING_TYPE.DUAL_F2,
      bookingId: F2_BOOKING_ID,
    },
  ]);

  const result = await reconcileUnknownTransaction(TX_ID, 'trace-qa-reconcile-dual-002');

  assert.equal(result.ok, true);
  assert.equal(result.reconciled, true);
  assert.deepEqual(result.bookingIds, [F1_BOOKING_ID, F2_BOOKING_ID]);
  assert.equal(transactionPayload().status, 'COMPLETED');
  assert.deepEqual(transactionPayload().bookingIds, [F1_BOOKING_ID, F2_BOOKING_ID]);
  assert.equal(transactionPayload().reconciliationMode, 'DUAL_PROJECTIONS');
});

test('QA-UNKNOWN-BOOKING-03 no CitasF2 projection remains REPAIR_REQUIRED, never FAILED_FINAL', async () => {
  seedUnknownTransaction();

  const result = await reconcileUnknownTransaction(TX_ID, 'trace-qa-reconcile-none-003');

  assert.equal(result.ok, true);
  assert.equal(result.reconciled, false);
  assert.equal(result.reason, 'MANUAL_RECONCILIATION_REQUIRED');
  assert.equal(result.reconciliationReason, 'NO_CITAS_PROJECTION');
  assert.equal(transactionPayload().status, 'REPAIR_REQUIRED');
  assert.equal(transactionPayload().manualReconciliationRequired, true);
  assert.notEqual(transactionPayload().status, 'FAILED_FINAL');
  assert.equal(alertRecords().length, 1, 'manual repair must create one operational alert');
  assert.equal(alertRecords()[0].payload.eventType, 'BOOKING_RESULT_UNKNOWN');
});

test('QA-UNKNOWN-BOOKING-04 a partial dual projection remains REPAIR_REQUIRED with known native bookingId', async () => {
  seedUnknownTransaction();
  wixDataMock._seed('CitasF2', [{
    _id: 'cita-dual-f1-only',
    pairToken: TX_ID,
    bookingType: IC.BOOKING_TYPE.DUAL_F1,
    bookingId: F1_BOOKING_ID,
  }]);

  const result = await reconcileUnknownTransaction(TX_ID, 'trace-qa-reconcile-partial-004');

  assert.equal(result.ok, true);
  assert.equal(result.reconciled, false);
  assert.equal(result.reason, 'MANUAL_RECONCILIATION_REQUIRED');
  assert.equal(result.reconciliationReason, 'PARTIAL_CITAS_PROJECTION');
  assert.equal(transactionPayload().status, 'REPAIR_REQUIRED');
  assert.deepEqual(transactionPayload().knownBookingIds, [F1_BOOKING_ID]);
  assert.equal(alertRecords().length, 1, 'partial dual projection must create a deduplicated operational alert');
});


test('QA-UNKNOWN-BOOKING-05 unique exact Reader V2 match recovers a SIMPLE native Writer timeout', async () => {
  readerQueries = [];
  readerResponses = [{
    extendedBookings: [{ booking: nativeBooking(SIMPLE_BOOKING_ID, writerPhase('F1', IC.BOOKING_TYPE.SIMPLE, SERVICE_ID)) }],
    pagingMetadata: { cursors: { next: null } },
  }];
  seedUnknownTransaction(writerIntent(false));

  const result = await reconcileUnknownTransaction(TX_ID, 'trace-qa-reader-simple-005');

  assert.equal(result.ok, true);
  assert.equal(result.reconciled, true);
  assert.equal(result.mode, 'BOOKINGS_READER_V2');
  assert.deepEqual(result.bookingIds, [SIMPLE_BOOKING_ID]);
  assert.equal(transactionPayload().status, 'COMPLETED');
  assert.equal(transactionPayload().reconciliationMode, 'BOOKINGS_READER_V2');
  const projected = wixDataMock._store.get('CitasF2').find((row) => row.bookingId === SIMPLE_BOOKING_ID);
  assert.ok(projected);
  assert.equal(projected.bookingType, IC.BOOKING_TYPE.SIMPLE);
  assert.equal(readerQueries[0].filter['bookedEntity.item.slot.serviceId'], SERVICE_ID);
  assert.equal(readerQueries[0].filter['bookedEntity.item.slot.resource.id'], RESOURCE_ID);
  assert.equal(readerQueries[0].filter['contactDetails.contactId'], CONTACT_ID);
});

test('QA-UNKNOWN-BOOKING-06 exact F1 and F2 Reader V2 matches recover a dual Writer timeout', async () => {
  readerQueries = [];
  const intent = writerIntent(true);
  readerResponses = [
    {
      extendedBookings: [{ booking: nativeBooking(F1_BOOKING_ID, intent.phases.F1) }],
      pagingMetadata: { cursors: { next: null } },
    },
    {
      extendedBookings: [{ booking: nativeBooking(F2_BOOKING_ID, intent.phases.F2) }],
      pagingMetadata: { cursors: { next: null } },
    },
  ];
  seedUnknownTransaction(intent);

  const result = await reconcileUnknownTransaction(TX_ID, 'trace-qa-reader-dual-006');

  assert.equal(result.ok, true);
  assert.equal(result.reconciled, true);
  assert.deepEqual(result.bookingIds, [F1_BOOKING_ID, F2_BOOKING_ID]);
  assert.equal(transactionPayload().status, 'COMPLETED');
  const projected = wixDataMock._store.get('CitasF2');
  assert.equal(projected.length, 2);
  assert.deepEqual(projected.map((row) => row.bookingType).sort(), [IC.BOOKING_TYPE.DUAL_F1, IC.BOOKING_TYPE.DUAL_F2].sort());
});

test('QA-UNKNOWN-BOOKING-07 multiple exact Reader V2 candidates remain REPAIR_REQUIRED', async () => {
  readerQueries = [];
  const intent = writerIntent(false);
  readerResponses = [{
    extendedBookings: [
      { booking: nativeBooking(SIMPLE_BOOKING_ID, intent.phases.F1) },
      { booking: nativeBooking('ffffffff-ffff-4fff-8fff-fffffffffff1', intent.phases.F1) },
    ],
    pagingMetadata: { cursors: { next: null } },
  }];
  seedUnknownTransaction(intent);

  const result = await reconcileUnknownTransaction(TX_ID, 'trace-qa-reader-ambiguous-007');

  assert.equal(result.ok, true);
  assert.equal(result.reconciled, false);
  assert.equal(transactionPayload().status, 'REPAIR_REQUIRED');
  assert.equal(transactionPayload().reconciliationReason, 'READER_MULTIPLE_EXACT_MATCHES');
  assert.equal(wixDataMock._store.get('CitasF2')?.length || 0, 0);
  assert.equal(alertRecords().length, 1);
});
