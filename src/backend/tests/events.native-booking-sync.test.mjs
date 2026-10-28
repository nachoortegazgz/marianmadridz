import test from "node:test";
import assert from "node:assert/strict";
import { wixDataMock } from "./loader.mjs";

const events = await import("backend/events.js");

const BOOKING_ID = "11111111-1111-4111-8111-111111111111";
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
