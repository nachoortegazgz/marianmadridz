import test from "node:test";
import assert from "node:assert/strict";
import { wixDataMock } from "./loader.mjs";

const events = await import("backend/events.js");

const BOOKING_ID = "11111111-1111-4111-8111-111111111111";
const F2_BOOKING_ID = "99999999-9999-4999-8999-999999999999";
const SERVICE_ID = "22222222-2222-4222-8222-222222222222";
const RESOURCE_ID = "33333333-3333-4333-8333-333333333333";
const SCHEDULE_ID = "44444444-4444-4444-8444-444444444444";
const PAIR_TOKEN = "55555555-5555-4555-8555-555555555555";

function nativeBooking(overrides = {}) {
  return {
    _id: BOOKING_ID,
    revision: 3,
    status: "CONFIRMED",
    paymentStatus: "UNDEFINED",
    selectedPaymentOption: "OFFLINE",
    internalBusinessNote: "NOTA INTERNA QA EN AGENDA",
    formSubmissionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    startDate: "2026-10-22T09:00:00.000Z",
    endDate: "2026-10-22T09:30:00.000Z",
    bookedEntity: {
      title: "QA Corte Clásico",
      slot: {
        serviceId: SERVICE_ID,
        scheduleId: SCHEDULE_ID,
        startDate: "2026-10-22T09:00:00.000Z",
        endDate: "2026-10-22T09:30:00.000Z",
        resource: { id: RESOURCE_ID, name: "QA Staff" },
        location: { id: "66666666-6666-4666-8666-666666666666", locationType: "BUSINESS" },
      },
    },
    contactDetails: {
      firstName: "QA",
      lastName: "Native Booking",
      email: "qa.native.booking@example.com",
      phone: "+34600000000",
      contactId: "77777777-7777-4777-8777-777777777777",
    },
    additionalFields: [
      { id: "88888888-8888-4888-8888-888888888888", label: "Observaciones", value: "NOTA QA: conservar en el registro" },
    ],
    ...overrides,
  };
}

function bookingConfirmedEvent(eventId, booking) {
  return { metadata: { id: eventId }, data: { booking } };
}

function seedCita(overrides = {}) {
  return {
    _id: "cita-row-1",
    bookingId: BOOKING_ID,
    serviceId: SERVICE_ID,
    scheduleId: SCHEDULE_ID,
    resourceId: RESOURCE_ID,
    slotStart: new Date("2026-10-22T09:00:00.000Z"),
    slotEnd: new Date("2026-10-22T09:30:00.000Z"),
    bookingType: "DUAL_F1",
    pairToken: PAIR_TOKEN,
    bookingStatus: "PENDING",
    paymentStatus: "NOT_PAID",
    totalAmount: 42,
    contactDetails: { firstName: "QA", email: "qa.native.booking@example.com" },
    meta: { pairToken: PAIR_TOKEN, customSaga: true },
    traceId: "trace-custom-saga",
    revision: 2,
    ...overrides,
  };
}

test("EVENT-BOOKING-01 native confirmation creates a canonical CitasF2 projection", async () => {
  wixDataMock._reset();
  const result = await events.wixBookingsV2_onBookingConfirmed(
    bookingConfirmedEvent("evt-native-confirm-001", nativeBooking())
  );

  assert.equal(result.status, "OK");
  assert.equal(result.ledgerCreated, true);

  const rows = wixDataMock._store.get("CitasF2") || [];
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.bookingId, BOOKING_ID);
  assert.equal(row.serviceId, SERVICE_ID);
  assert.equal(row.scheduleId, SCHEDULE_ID);
  assert.equal(row.resourceId, RESOURCE_ID);
  assert.equal(row.bookingType, "SIMPLE");
  assert.equal(row.bookingStatus, "CONFIRMED");
  assert.equal(row.paymentStatus, "NOT_PAID");
  assert.equal(row.totalAmount, 0);
  assert.equal(row.meta.source, "WIX_BOOKINGS_NATIVE");
  assert.equal(row.meta.selectedPaymentOption, "OFFLINE");
  assert.equal(row.meta.channelType, "PRESENCIAL");
  assert.equal(row.meta.contactId, "77777777-7777-4777-8777-777777777777");
  assert.equal(row.meta.amountReconciliationRequired, true);
  assert.equal(row.meta.appointmentNote, "NOTA INTERNA QA EN AGENDA");
  assert.equal(row.meta.formSubmissionId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.deepEqual(row.meta.appointmentNotes, [
    { label: "Observaciones", value: "NOTA QA: conservar en el registro" },
  ]);

  const markers = wixDataMock._store.get("ControlOperativo") || [];
  assert.equal(markers.filter(row => row.dedupeKey === "WEBHOOK_evt-native-confirm-001").length, 1);
});

test("EVENT-BOOKING-02 confirmation preserves custom dual metadata and pair token", async () => {
  wixDataMock._reset();
  wixDataMock._store.set("CitasF2", [seedCita()]);

  const result = await events.wixBookingsV2_onBookingConfirmed(
    bookingConfirmedEvent("evt-native-confirm-002", nativeBooking({ _id: BOOKING_ID, status: "CONFIRMED" }))
  );

  assert.equal(result.status, "OK");
  assert.equal(result.ledgerCreated, false);
  const rows = wixDataMock._store.get("CitasF2") || [];
  assert.equal(rows.length, 1);
  assert.equal(rows[0].bookingType, "DUAL_F1");
  assert.equal(rows[0].pairToken, PAIR_TOKEN);
  assert.equal(rows[0].meta.customSaga, true);
  assert.equal(rows[0].bookingStatus, "CONFIRMED");
});

test("EVENT-BOOKING-03 repairs a processed webhook whose CitasF2 row is missing", async () => {
  wixDataMock._reset();
  wixDataMock._store.set("ControlOperativo", [{
    _id: "webhook-marker-existing",
    controlType: "WEBHOOK_EVENT",
    dedupeKey: "WEBHOOK_evt-native-confirm-003",
    eventId: "evt-native-confirm-003",
    status: "COMPLETED",
    traceId: "trace-old",
    payload: { eventType: "BOOKING_CONFIRMED" },
  }]);

  const result = await events.wixBookingsV2_onBookingConfirmed(
    bookingConfirmedEvent("evt-native-confirm-003", nativeBooking({ _id: "99999999-9999-4999-8999-999999999999" }))
  );

  assert.equal(result.status, "OK");
  assert.equal(result.ledgerCreated, true);
  const rows = wixDataMock._store.get("CitasF2") || [];
  assert.equal(rows.length, 1);
  assert.equal(rows[0].bookingId, "99999999-9999-4999-8999-999999999999");
  const markers = wixDataMock._store.get("ControlOperativo") || [];
  assert.equal(markers.filter(row => row.dedupeKey === "WEBHOOK_evt-native-confirm-003").length, 1);
});

test("EVENT-BOOKING-04 payment webhook updates payment without confirming a pending booking", async () => {
  wixDataMock._reset();
  wixDataMock._store.set("CitasF2", [
    seedCita({
      bookingStatus: "PENDING",
      paymentStatus: "PENDING_PAYMENT",
      meta: { pairToken: PAIR_TOKEN, customSaga: true, paymentStatus: "PENDING_PAYMENT" },
    }),
    seedCita({
      _id: "cita-row-f2",
      bookingId: F2_BOOKING_ID,
      bookingType: "DUAL_F2",
      bookingStatus: "PENDING",
      paymentStatus: "PENDING_PAYMENT",
      meta: {
        pairToken: PAIR_TOKEN,
        customSaga: true,
        linkedF1BookingId: BOOKING_ID,
        paymentStatus: "PENDING_PAYMENT",
        noFee: true,
      },
    }),
  ]);

  const result = await events.wixEcom_onOrderPaymentStatusUpdated({
    id: "evt-order-paid-pending-004",
    order: {
      _id: "order-paid-pending-004",
      paymentStatus: "PAID",
      priceSummary: { total: { amount: "0.00" } },
      lineItems: [{
        catalogReference: {
          appId: "13d21c63-b5ec-5912-8397-c3a5ddb27a97",
          catalogItemId: BOOKING_ID,
        },
        quantity: 1,
        price: { amount: "0.00" },
      }],
    },
  });

  assert.equal(result.status, "OK");
  const rows = wixDataMock._store.get("CitasF2") || [];
  assert.equal(rows.length, 2);
  const f1 = rows.find(row => row.bookingId === BOOKING_ID);
  const f2 = rows.find(row => row.bookingId === F2_BOOKING_ID);
  assert.ok(f1);
  assert.ok(f2);
  for (const row of [f1, f2]) {
    assert.equal(row.bookingStatus, "PENDING");
    assert.equal(row.paymentStatus, "PAID");
    assert.equal(row.meta.paymentStatus, "PAID");
    assert.equal(row.meta.orderId, "order-paid-pending-004");
    assert.equal(row.pairToken, PAIR_TOKEN);
  }
  assert.equal(f1.bookingType, "DUAL_F1");
  assert.equal(f2.bookingType, "DUAL_F2");
  assert.equal(f2.meta.noFee, true);
});


test("EVENT-BOOKING-05 order cancellation matches the Bookings catalog GUID and cancels both dual rows", async () => {
  wixDataMock._reset();
  wixDataMock._store.set("CitasF2", [
    seedCita({
      bookingStatus: "PENDING",
      meta: { pairToken: PAIR_TOKEN, customSaga: true },
    }),
    seedCita({
      _id: "cita-row-f2-cancel",
      bookingId: F2_BOOKING_ID,
      bookingType: "DUAL_F2",
      bookingStatus: "PENDING",
      meta: {
        pairToken: PAIR_TOKEN,
        customSaga: true,
        linkedF1BookingId: BOOKING_ID,
        noFee: true,
      },
    }),
  ]);

  const result = await events.wixEcom_onOrderCanceled({
    order: {
      _id: "order-canceled-dual-005",
      lineItems: [{
        catalogReference: {
          appId: "13d21c63-b5ec-5912-8397-c3a5ddb27a97",
          catalogItemId: BOOKING_ID,
        },
      }],
    },
  });

  assert.equal(result.status, "OK");
  const rows = wixDataMock._store.get("CitasF2") || [];
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.equal(row.bookingStatus, "CANCELLED");
    assert.equal(row.pairToken, PAIR_TOKEN);
  }
});


test("EVENT-BOOKING-06 native Bookings V2 cancellation consumes metadata.id + data.booking._id", async () => {
  wixDataMock._reset();
  wixDataMock._store.set("CitasF2", [
    seedCita({
      bookingStatus: "CONFIRMED",
      paymentStatus: "NOT_PAID",
      meta: { pairToken: PAIR_TOKEN, customSaga: true },
    }),
  ]);

  const result = await events.wixBookingsV2_onBookingCanceled({
    metadata: { id: "evt-native-cancel-006" },
    data: {
      booking: {
        _id: BOOKING_ID,
        status: "CANCELED",
      },
    },
  });

  assert.equal(result.status, "OK");
  assert.equal(result.eventId, "evt-native-cancel-006");

  const rows = wixDataMock._store.get("CitasF2") || [];
  assert.equal(rows.length, 1);
  assert.equal(rows[0].bookingId, BOOKING_ID);
  assert.equal(rows[0].bookingStatus, "CANCELED");

  const markers = wixDataMock._store.get("ControlOperativo") || [];
  assert.equal(markers.filter(row => row.dedupeKey === "WEBHOOK_evt-native-cancel-006").length, 1);
});
