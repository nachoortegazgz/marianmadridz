import test from "node:test";
import assert from "node:assert/strict";
import { wixDataMock, mocks } from "./loader.mjs";

const bookingsReaderKey = "@wix/bookings::@wix/bookings::extendedBookings::queryExtendedBookings";
let readerCalls = [];
let confirmedPage = 0;

const SERVICE_ID = "11111111-1111-4111-8111-111111111111";
const SCHEDULE_ID = "22222222-2222-4222-8222-222222222222";
const RESOURCE_ID = "33333333-3333-4333-8333-333333333333";

const booking = (id, overrides = {}) => ({
  id,
  revision: 3,
  status: "CONFIRMED",
  paymentStatus: "NOT_PAID",
  selectedPaymentOption: "OFFLINE",
  startDate: "2026-10-22T09:00:00.000Z",
  endDate: "2026-10-22T09:30:00.000Z",
  bookedEntity: {
    title: "QA Booking Reconciliation",
    slot: {
      serviceId: SERVICE_ID,
      scheduleId: SCHEDULE_ID,
      startDate: "2026-10-22T09:00:00.000Z",
      endDate: "2026-10-22T09:30:00.000Z",
      resource: { _id: RESOURCE_ID, name: "QA Staff" },
    },
  },
  contactDetails: {
    firstName: "QA",
    lastName: "Booking",
    email: "qa.booking.reconcile@example.com",
    phone: "+34600000000",
  },
  ...overrides,
});

const CONFIRMED_VALID = booking("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1");
const CONFIRMED_NO_RESOURCE = booking("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2", {
  bookedEntity: {
    title: "QA no resource",
    slot: {
      serviceId: SERVICE_ID,
      scheduleId: SCHEDULE_ID,
      startDate: "2026-10-22T09:00:00.000Z",
      endDate: "2026-10-22T09:30:00.000Z",
      resourceSelections: [{ selectionMethod: "NO_SELECTION" }],
    },
  },
});
const CONFIRMED_PAID = booking("cccccccc-cccc-4ccc-8ccc-ccccccccccc3", {
  paymentStatus: "PAID",
});
const CONFIRMED_EXISTING = booking("dddddddd-dddd-4ddd-8ddd-ddddddddddd4");
const CANCELED_PAID = booking("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5", {
  status: "CANCELED",
  paymentStatus: "PAID",
});

mocks.sdk[bookingsReaderKey] = async (query) => {
  readerCalls.push(query);
  const status = query?.filter?.status;
  if (status === "CANCELED") {
    return {
      extendedBookings: [{ booking: CANCELED_PAID }],
      pagingMetadata: { cursors: { next: null } },
    };
  }
  if (status !== "CONFIRMED") {
    throw new Error("Unexpected Bookings Reader filter");
  }
  if (query?.cursorPaging?.cursor) {
    confirmedPage++;
    return {
      extendedBookings: [{ booking: CONFIRMED_PAID }, { booking: CONFIRMED_EXISTING }],
      pagingMetadata: { cursors: { next: null } },
    };
  }
  confirmedPage = 0;
  return {
    extendedBookings: [{ booking: CONFIRMED_VALID }, { booking: CONFIRMED_NO_RESOURCE }],
    pagingMetadata: { cursors: { next: "confirmed-page-2" } },
  };
};

const CR = await import("backend/crons.js");
const IC = await import("backend/internalConfig.js");

function seedExistingProjection() {
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.CITAS_F2, [{
    _id: "cita-existing-confirmed",
    bookingId: CONFIRMED_EXISTING.id,
    serviceId: SERVICE_ID,
    scheduleId: SCHEDULE_ID,
    resourceId: RESOURCE_ID,
    slotStart: new Date("2026-10-22T09:00:00.000Z"),
    slotEnd: new Date("2026-10-22T09:30:00.000Z"),
    bookingType: "SIMPLE",
    bookingStatus: "CONFIRMED",
    paymentStatus: "NOT_PAID",
    totalAmount: 0,
    meta: { source: "WIX_BOOKINGS_NATIVE", amountReconciliationRequired: true },
    traceId: "trace-existing",
  }]);
  wixDataMock._seed(IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO, [{
    _id: "booking-confirmed-marker-existing",
    controlType: IC.CONTROL_TYPE.WEBHOOK_EVENT,
    dedupeKey: "WEBHOOK_existing-booking-event",
    eventId: "existing-booking-event",
    status: IC.CONTROL_STATUS.COMPLETED,
    traceId: "trace-existing",
    payload: {
      eventType: "BOOKING_CONFIRMED",
      processedAt: new Date().toISOString(),
      metadata: { bookingId: CONFIRMED_EXISTING.id },
    },
  }]);
}

test("CRON-BOOKING-PROJECTION-01 projects only confirmed unpaid bookings with complete resource data", async () => {
  wixDataMock._reset();
  readerCalls = [];
  confirmedPage = 0;
  seedExistingProjection();

  const result = await CR.reconcileMissingConfirmedBookingProjections();
  assert.equal(result.nativeConfirmedRead, 4);
  assert.equal(result.canceledPaidRead, 1);
  assert.equal(result.amountReconciliationRequired, 1);
  assert.equal(result.reconciled, 1);
  assert.equal(result.reviewRequired, 3);
  assert.equal(result.failed, 0);
  assert.ok(readerCalls.length >= 3);
  assert.equal(readerCalls[0].filter.status, "CONFIRMED");
  assert.equal(readerCalls[1].filter, undefined, "cursor pages must not repeat the first-page filter");
  assert.equal(readerCalls[1].cursorPaging.cursor, "confirmed-page-2");

  const citas = wixDataMock._store.get(IC.BUSINESS_COLLECTIONS.CITAS_F2) || [];
  const projected = citas.find(row => row.bookingId === CONFIRMED_VALID.id);
  assert.ok(projected);
  assert.equal(projected.bookingStatus, "CONFIRMED");
  assert.equal(projected.paymentStatus, "NOT_PAID");
  assert.equal(projected.totalAmount, 0);
  assert.equal(projected.meta.amountReconciliationRequired, true);
  assert.equal(citas.some(row => row.bookingId === CONFIRMED_NO_RESOURCE.id), false);
  assert.equal(citas.some(row => row.bookingId === CONFIRMED_PAID.id), false);
  assert.equal(citas.some(row => row.bookingId === CANCELED_PAID.id), false);

  const controls = wixDataMock._store.get(IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO) || [];
  const marker = controls.find(row => row.payload?.eventType === "BOOKING_CONFIRMED_RECONCILED");
  assert.ok(marker);
  assert.equal(marker.payload.metadata.bookingId, CONFIRMED_VALID.id);
  assert.ok(marker.traceId);

  const alerts = controls.filter(row => row.alertType);
  assert.equal(alerts.length, 3);
  assert.ok(alerts.some(row => row.alertType === "BOOKING_PROJECTION_RECONCILIATION_REQUIRED"));
  assert.ok(alerts.some(row => row.alertType === "BOOKING_PAID_PROJECTION_REVIEW_REQUIRED"));
  assert.ok(alerts.some(row => row.alertType === "CANCELED_PAID_BOOKING_FINANCIAL_REVIEW_REQUIRED"));

  assert.equal((wixDataMock._store.get(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA) || []).length, 0);
  assert.equal((wixDataMock._store.get(IC.BUSINESS_COLLECTIONS.LIBRO_ASIENTOS_CONTABLES_DETALLE) || []).length, 0);
  assert.equal((wixDataMock._store.get(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_INVENTARIO) || []).length, 0);
});

test("CRON-BOOKING-PROJECTION-02 replay is idempotent and does not duplicate projections or alerts", async () => {
  wixDataMock._reset();
  readerCalls = [];
  confirmedPage = 0;
  seedExistingProjection();

  await CR.reconcileMissingConfirmedBookingProjections();
  const firstRows = wixDataMock._store.get(IC.BUSINESS_COLLECTIONS.CITAS_F2) || [];
  const firstControls = wixDataMock._store.get(IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO) || [];
  const firstProjectionCount = firstRows.filter(row => row.bookingId === CONFIRMED_VALID.id).length;
  const firstAlertCount = firstControls.filter(row => row.alertType).length;

  readerCalls = [];
  confirmedPage = 0;
  const replay = await CR.reconcileMissingConfirmedBookingProjections();
  const rowsAfterReplay = wixDataMock._store.get(IC.BUSINESS_COLLECTIONS.CITAS_F2) || [];
  const controlsAfterReplay = wixDataMock._store.get(IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO) || [];
  assert.equal(replay.reconciled, 0);
  assert.equal(replay.skipped, 2);
  assert.equal(rowsAfterReplay.filter(row => row.bookingId === CONFIRMED_VALID.id).length, firstProjectionCount);
  assert.equal(controlsAfterReplay.filter(row => row.alertType).length, firstAlertCount);
});

test("CRON-BOOKING-PROJECTION-03 rejects malformed native booking identifiers", async () => {
  wixDataMock._reset();
  mocks.sdk[bookingsReaderKey] = async (query) => {
    if (query?.filter?.status === "CANCELED") {
      return { extendedBookings: [], pagingMetadata: { cursors: { next: null } } };
    }
    return {
      extendedBookings: [{ booking: booking("not-a-guid") }],
      pagingMetadata: { cursors: { next: null } },
    };
  };
  await assert.rejects(
    CR.reconcileMissingConfirmedBookingProjections(),
    /NATIVE_BOOKING_ID_INVALID_IN_READER/
  );
});
