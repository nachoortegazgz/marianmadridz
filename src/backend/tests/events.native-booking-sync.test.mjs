import test from "node:test";
import assert from "node:assert/strict";
import { wixDataMock } from "./loader.mjs";
import * as IC from "backend/internalConfig.js";

const events = await import("backend/events.js");

const BOOKING_ID = "11111111-1111-4111-8111-111111111111";
const F2_BOOKING_ID = "99999999-9999-4999-8999-999999999999";
const SERVICE_ID = "22222222-2222-4222-8222-222222222222";
const RESOURCE_ID = "33333333-3333-4333-8333-333333333333";
const SCHEDULE_ID = "44444444-4444-4444-8444-444444444444";
const PAIR_TOKEN = "55555555-5555-4555-8555-555555555555";

function nativeBooking(overrides = {}) {
  return {
    id: BOOKING_ID,
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
  return {
    metadata: { id: eventId },
    data: { booking: { ...booking, _id: booking.id } },
  };
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

test("EVENT-BOOKING-02 confirmation preserves custom dual row when webhook omits resource", async () => {
  wixDataMock._reset();
  wixDataMock._store.set("CitasF2", [seedCita()]);

  const booking = nativeBooking({
    id: BOOKING_ID,
    status: "CONFIRMED",
    bookedEntity: { title: "QA Corte Clásico", slot: { serviceId: SERVICE_ID } },
  });
  const result = await events.wixBookingsV2_onBookingConfirmed(
    bookingConfirmedEvent("evt-native-confirm-002", booking)
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
    bookingConfirmedEvent("evt-native-confirm-003", nativeBooking({ id: "99999999-9999-4999-8999-999999999999" }))
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



const STAFF_MEMBER_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

test("EVENT-BOOKING-07 maps staffMemberId to resourceId and scheduleId for a new native projection", async () => {
  wixDataMock._reset();
  wixDataMock._store.set("MapaStaff", [{
    _id: "mapa-staff-1",
    staffMemberId: STAFF_MEMBER_ID,
    resourceId: RESOURCE_ID,
    scheduleId: SCHEDULE_ID,
    active: true,
    rolBookings: "STAFF",
    rolWebsite: "ESTILISTA",
  }]);

  const booking = nativeBooking({
    id: "88888888-8888-4888-8888-888888888888",
    staffMemberId: STAFF_MEMBER_ID,
    bookedEntity: {
      title: "QA booking mapped staff",
      slot: { serviceId: SERVICE_ID, startDate: "2026-10-22T09:00:00.000Z", endDate: "2026-10-22T09:30:00.000Z" },
    },
  });
  const result = await events.wixBookingsV2_onBookingConfirmed(
    bookingConfirmedEvent("evt-native-confirm-007", booking)
  );

  assert.equal(result.status, "OK");
  assert.equal(result.ledgerCreated, true);
  const row = (wixDataMock._store.get("CitasF2") || [])[0];
  assert.equal(row.resourceId, RESOURCE_ID);
  assert.equal(row.scheduleId, SCHEDULE_ID);
});

test("EVENT-BOOKING-08 refuses ambiguous active MapaStaff mappings", async () => {
  wixDataMock._reset();
  wixDataMock._store.set("MapaStaff", [
    { _id: "mapa-staff-a", staffMemberId: STAFF_MEMBER_ID, resourceId: RESOURCE_ID, scheduleId: SCHEDULE_ID, active: true },
    { _id: "mapa-staff-b", staffMemberId: STAFF_MEMBER_ID, resourceId: "99999999-9999-4999-8999-999999999999", scheduleId: SCHEDULE_ID, active: true },
  ]);
  const booking = nativeBooking({
    _id: "77777777-7777-4777-8777-777777777777",
    staffMemberId: STAFF_MEMBER_ID,
    bookedEntity: { title: "QA ambiguous mapping", slot: { serviceId: SERVICE_ID } },
  });

  const result = await events.wixBookingsV2_onBookingConfirmed(
    bookingConfirmedEvent("evt-native-confirm-008", booking)
  );
  assert.equal(result.status, "RETRY_REQUIRED");
  assert.equal(result.reason, "MAPA_STAFF_ACTIVE_MAPPING_AMBIGUOUS");
  assert.equal((wixDataMock._store.get("CitasF2") || []).length, 0);
  assert.equal((wixDataMock._store.get("ControlOperativo") || []).length, 0);
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
        id: BOOKING_ID,
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
  assert.equal(rows[0].bookingStatus, "CANCELLED");

  const markers = wixDataMock._store.get("ControlOperativo") || [];
  assert.equal(markers.filter(row => row.dedupeKey === "WEBHOOK_evt-native-cancel-006").length, 1);
});


test("EVENT-PAYMENT-09 official Wix eCommerce paid event appends WIX_PAYMENTS ledger and reconciles the full dual booking idempotently", async () => {
  wixDataMock._reset();

  const secretState = globalThis.__mmSecretsState || (globalThis.__mmSecretsState = { _map: {}, _default: "mock-secret" });
  secretState._map.FISCAL_NIF_EMISOR = "B12345678";

  wixDataMock._seed("CitasF2", [
    seedCita({
      bookingStatus: "PENDING",
      paymentStatus: "PENDING_PAYMENT",
      totalAmount: 45.5,
      meta: { pairToken: PAIR_TOKEN, customSaga: true, paymentStatus: "PENDING_PAYMENT" },
    }),
    seedCita({
      _id: "cita-row-f2-paid",
      bookingId: F2_BOOKING_ID,
      bookingType: "DUAL_F2",
      bookingStatus: "PENDING",
      paymentStatus: "PENDING_PAYMENT",
      totalAmount: 45.5,
      meta: {
        pairToken: PAIR_TOKEN,
        customSaga: true,
        linkedF1BookingId: BOOKING_ID,
        paymentStatus: "PENDING_PAYMENT",
        noFee: true,
      },
    }),
  ]);

  const orderId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const eventId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const event = {
    metadata: {
      id: eventId,
      entityId: orderId,
      eventTime: "2026-11-09T10:00:00.000Z",
      triggeredByAnonymizeRequest: false,
    },
    data: {
      order: {
        _id: orderId,
        paymentStatus: "PAID",
        currency: "EUR",
        priceSummary: {
          totalPrice: { amount: "45.50" },
        },
        lineItems: [{
          catalogReference: {
            appId: IC.WIX_CATALOG_APP_IDS.BOOKINGS,
            catalogItemId: BOOKING_ID,
          },
          quantity: 1,
          price: { amount: "120.00" },
          totalPriceAfterTax: { amount: "120.00" },
        }],
      },
      previousPaymentStatus: "PENDING",
    },
  };

  const result = await events.wixEcom_onOrderPaymentStatusUpdated(event);
  assert.equal(result.status, "OK");

  const movements = wixDataMock._store.get(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA) || [];
  assert.equal(movements.length, 1, "paid webhook must append a ledger movement; recovery/control state: " + JSON.stringify(wixDataMock._store.get(IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO) || []));
  const movement = movements[0];
  assert.equal(movement.transactionId, "ORDER-" + orderId);
  assert.equal(movement.orderId, orderId);
  assert.equal(movement.totalAmount, 45.5, "official priceSummary.totalPrice must take precedence over the line-item fallback");
  assert.equal(movement.paymentMethod, IC.PAYMENT_METHOD.WIX_PAYMENTS);
  assert.equal(movement.movementType, IC.MOVEMENT_TYPE.VENTA_ONLINE);
  assert.equal(movement.channelType, IC.CHANNEL_TYPE.ONLINE);
  assert.deepEqual(movement.linkedBookingIds, [BOOKING_ID]);
  assert.match(movement.hash, /^[a-f0-9]{64}$/i);

  const citas = wixDataMock._store.get("CitasF2") || [];
  assert.equal(citas.length, 2);
  for (const row of citas) {
    assert.equal(row.paymentStatus, IC.PAYMENT_STATUS.PAID);
    assert.equal(row.meta.paymentStatus, IC.PAYMENT_STATUS.PAID);
    assert.equal(row.meta.orderId, orderId);
    assert.equal(row.bookingStatus, "PENDING", "payment must not approve/confirm the appointment");
    assert.equal(row.pairToken, PAIR_TOKEN);
  }

  const controlRows = wixDataMock._store.get(IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO) || [];
  assert.equal(
    controlRows.filter(row => row.dedupeKey === "WEBHOOK_" + eventId).length,
    1,
    "official metadata.id must be persisted as the webhook idempotency marker"
  );

  const sameEventReplay = await events.wixEcom_onOrderPaymentStatusUpdated(event);
  assert.equal(sameEventReplay.status, "OK");
  assert.equal(sameEventReplay.duplicate, true);
  assert.equal((wixDataMock._store.get(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA) || []).length, 1);

  const newEventReplay = await events.wixEcom_onOrderPaymentStatusUpdated({
    ...event,
    metadata: { ...event.metadata, id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" },
  });
  assert.equal(newEventReplay.status, "OK");
  assert.equal((wixDataMock._store.get(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA) || []).length, 1,
    "stable ORDER-{orderId} transaction id must prevent a second fiscal movement");
});
