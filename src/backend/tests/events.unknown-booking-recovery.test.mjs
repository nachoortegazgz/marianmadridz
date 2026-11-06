import test from 'node:test';
import assert from 'node:assert/strict';

import { wixDataMock } from './loader.mjs';
const IC = await import('backend/internalConfig.js');
const { reconcileUnknownTransaction } = await import('backend/events.js');

const TX_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10';
const SERVICE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const SIMPLE_BOOKING_ID = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
const F1_BOOKING_ID = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
const F2_BOOKING_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';

function seedUnknownTransaction() {
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
    },
  }]);
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
});
