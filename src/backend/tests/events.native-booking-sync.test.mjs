import test from "node:test";
import assert from "node:assert/strict";
import { wixDataMock, mocks } from "./loader.mjs";
import * as IC from "backend/internalConfig.js";

let activeOrder = null;
let activeOrderTransactions = { orderId: "", payments: [], refunds: [] };
mocks.sdk["@wix/ecom::orderTransactions"] = {
  listTransactionsForSingleOrder: async (orderId) => ({
    orderTransactions: { ...activeOrderTransactions, orderId },
  }),
};

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

function seedCajaPrincipal() {
  const operationDate = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.CAJA_ACTUAL, [{
    _id: "SINGLE_ITEM_ID",
    singletonKey: "CAJA_PRINCIPAL",
    isOpen: true,
    cashRegisterStatus: "ABIERTA",
    operationDate,
    openingAmount: 300,
    cashAmount: 300,
    totalInAmount: 300,
    expectedCash: 300,
    cardAmount: 0,
    voucherAmount: 0,
    otherAmount: 0,
    salesCount: 0,
    sequenceCounters: {},
  }]);
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

test("EVENT-BOOKING-CREATED-01 native creation persists a pending projection and confirmation advances it", async () => {
  wixDataMock._reset();
  const createdBooking = nativeBooking({ status: "CREATED", paymentStatus: "UNDEFINED" });
  const createdResult = await events.wixBookings_onBookingCreated(
    bookingConfirmedEvent("evt-native-created-001", createdBooking)
  );

  assert.equal(createdResult.status, "OK");
  assert.equal(createdResult.ledgerCreated, true);
  let rows = wixDataMock._store.get("CitasF2") || [];
  assert.equal(rows.length, 1);
  assert.equal(rows[0].bookingStatus, "PENDING");
  assert.equal(rows[0].paymentStatus, "NOT_PAID");

  const confirmedResult = await events.wixBookingsV2_onBookingConfirmed(
    bookingConfirmedEvent("evt-native-confirm-after-created-001", nativeBooking({ status: "CONFIRMED" }))
  );
  assert.equal(confirmedResult.status, "OK");
  rows = wixDataMock._store.get("CitasF2") || [];
  assert.equal(rows.length, 1);
  assert.equal(rows[0].bookingStatus, "CONFIRMED");

  const markers = wixDataMock._store.get("ControlOperativo") || [];
  assert.equal(markers.filter(row => row.controlType === IC.CONTROL_TYPE.WEBHOOK_EVENT && row.eventId === "evt-native-created-001").length, 1);
  assert.equal(markers.filter(row => row.controlType === IC.CONTROL_TYPE.WEBHOOK_EVENT && row.eventId === "evt-native-confirm-after-created-001").length, 1);
});

test("EVENT-BOOKING-CREATED-02 late creation delivery never downgrades a custom dual projection", async () => {
  wixDataMock._reset();
  wixDataMock._store.set("CitasF2", [seedCita({
    bookingStatus: "CONFIRMED",
    paymentStatus: "NOT_PAID",
    meta: { pairToken: PAIR_TOKEN, customSaga: true },
  })]);

  const result = await events.wixBookings_onBookingCreated(
    bookingConfirmedEvent("evt-native-created-late-002", nativeBooking({ status: "CREATED" }))
  );

  assert.equal(result.status, "OK");
  assert.equal(result.ledgerCreated, false);
  const rows = wixDataMock._store.get("CitasF2") || [];
  assert.equal(rows.length, 1);
  assert.equal(rows[0].bookingType, "DUAL_F1");
  assert.equal(rows[0].pairToken, PAIR_TOKEN);
  assert.equal(rows[0].bookingStatus, "CONFIRMED");
  assert.equal(rows[0].meta.customSaga, true);
});

test("EVENT-BOOKING-CREATED-03 insertOnly race preserves a concurrent pending dual projection", async () => {
  wixDataMock._reset();
  const originalQuery = wixDataMock.query;
  let citasQueryCount = 0;
  wixDataMock.query = function (collection) {
    const query = originalQuery(collection);
    if (collection !== "CitasF2") return query;
    const originalFind = query.find;
    query.find = async (options) => {
      citasQueryCount += 1;
      if (citasQueryCount === 1) {
        return { items: [], length: 0, total: 0, totalCount: 0 };
      }
      if (citasQueryCount === 2) {
        wixDataMock._store.set("CitasF2", [seedCita({
          bookingStatus: "PENDING",
          paymentStatus: "NOT_PAID",
          meta: { pairToken: PAIR_TOKEN, customSaga: true },
        })]);
      }
      return originalFind(options);
    };
    return query;
  };

  try {
    const result = await events.wixBookings_onBookingCreated(
      bookingConfirmedEvent(
        "evt-native-created-insert-race-004",
        nativeBooking({ status: "CREATED" })
      )
    );

    assert.equal(result.status, "OK");
    assert.equal(result.ledgerCreated, false);
    const rows = wixDataMock._store.get("CitasF2") || [];
    assert.equal(rows.length, 1);
    assert.equal(rows[0].bookingType, "DUAL_F1");
    assert.equal(rows[0].pairToken, PAIR_TOKEN);
    assert.equal(rows[0].bookingStatus, "PENDING");
    assert.equal(rows[0].meta.customSaga, true);
  } finally {
    wixDataMock.query = originalQuery;
  }
});

test("EVENT-BOOKING-CREATED-04 duplicate delivery is idempotent", async () => {
  wixDataMock._reset();
  const event = bookingConfirmedEvent(
    "evt-native-created-duplicate-003",
    nativeBooking({ status: "CREATED" })
  );

  const first = await events.wixBookings_onBookingCreated(event);
  const replay = await events.wixBookings_onBookingCreated(event);

  assert.equal(first.status, "OK");
  assert.equal(replay.status, "OK");
  assert.equal(replay.duplicate, true);
  assert.equal((wixDataMock._store.get("CitasF2") || []).length, 1);
  assert.equal((wixDataMock._store.get("ControlOperativo") || []).filter(
    row => row.controlType === IC.CONTROL_TYPE.WEBHOOK_EVENT && row.eventId === "evt-native-created-duplicate-003" && row.payload?.eventType === "BOOKING_CREATED"
  ).length, 1);
});

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
  assert.equal(markers.filter(row => row.controlType === IC.CONTROL_TYPE.WEBHOOK_EVENT && row.eventId === "evt-native-confirm-001" && row.payload?.eventType === "BOOKING_CONFIRMED").length, 1);
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

  const orderId = "44444444-4444-4444-8444-444444444444";
  activeOrder = {
    _id: orderId,
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
  };
  activeOrderTransactions = { orderId, payments: [], refunds: [] };
  const result = await events.wixEcom_onOrderPaymentStatusUpdated({
    metadata: { id: "evt-order-paid-pending-004" },
    data: { order: activeOrder, previousPaymentStatus: "NOT_PAID" },
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
    assert.equal(row.meta.orderId, orderId);
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
    metadata: { id: "order-canceled-dual-event-005" },
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
    assert.equal(row.bookingStatus, "CANCELED");
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

  await assert.rejects(
    events.wixBookingsV2_onBookingConfirmed(
      bookingConfirmedEvent("evt-native-confirm-008", booking)
    ),
    /MAPA_STAFF_ACTIVE_MAPPING_AMBIGUOUS/
  );
  assert.equal((wixDataMock._store.get("CitasF2") || []).length, 0);
  const controls = wixDataMock._store.get("ControlOperativo") || [];
  assert.equal(controls.filter(row => row.controlType === IC.CONTROL_TYPE.WEBHOOK_EVENT).length, 0);
  assert.equal(controls.filter(row => row.controlType === IC.CONTROL_TYPE.WEBHOOK_CLAIM && row.status === IC.WEBHOOK_CLAIM_STATUS.FAILED_RETRYABLE).length, 1);
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
  assert.equal(rows[0].bookingStatus, "CANCELED");

  const markers = wixDataMock._store.get("ControlOperativo") || [];
  assert.equal(markers.filter(row => row.controlType === IC.CONTROL_TYPE.WEBHOOK_EVENT && row.eventId === "evt-native-cancel-006" && row.payload?.eventType === "BOOKING_CANCELED").length, 1);
});


test("EVENT-PAYMENT-09 official Wix eCommerce paid event appends WIX_PAYMENTS ledger and reconciles the full dual booking idempotently", async () => {
  wixDataMock._reset();
  seedCajaPrincipal();

  const secretState = globalThis.__mmSecretsState || (globalThis.__mmSecretsState = { _map: {}, _default: "mock-secret" });
  secretState._map.FISCAL_NIF_EMISOR = "B12345678";

  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.DATOS_FISCALES, [{
    _id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    recordType: "TERCERO",
    taxId: "B12345678",
    legalName: "MARIAN MADRID",
    thirdPartyType: "EMISOR",
    address: null,
  }]);

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
      totalAmount: 0,
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
        taxIncludedInPrices: true,
        taxInfo: { totalTax: { amount: "7.90" }, taxBreakdown: [] },
        priceSummary: {
          subtotal: { amount: "37.60" },
          tax: { amount: "7.90" },
          total: { amount: "45.50" },
          totalPrice: { amount: "45.50" },
        },
        lineItems: [{
          catalogReference: {
            appId: IC.WIX_CATALOG_APP_IDS.BOOKINGS,
            catalogItemId: BOOKING_ID,
          },
          productName: { original: "QA booking service" },
          quantity: 1,
          price: { amount: "120.00" },
          totalPriceAfterTax: { amount: "45.50" },
          taxInfo: {
            taxableAmount: { amount: "37.60" },
            taxAmount: { amount: "7.90" },
            taxRate: "0.21",
            taxBreakdown: [],
          },
        }],
      },
      previousPaymentStatus: "PENDING",
    },
  };

  activeOrder = event.data.order;
  activeOrderTransactions = { orderId, payments: [], refunds: [] };
  const result = await events.wixEcom_onOrderPaymentStatusUpdated(event);
  assert.equal(result.status, "OK");

  const movements = wixDataMock._store.get(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA) || [];
  assert.equal(movements.length, 1, "paid webhook must append a ledger movement; recovery/control state: " + JSON.stringify(wixDataMock._store.get(IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO) || []));
  const movement = movements[0];
  assert.ok(movement.recordTimestamp instanceof Date, "CMS recordTimestamp must be a DateTime value");
  assert.ok(movement.generationTimestamp instanceof Date, "CMS generationTimestamp must be a DateTime value");
  assert.ok(Number.isFinite(movement.recordTimestamp.getTime()));
  assert.ok(Number.isFinite(movement.generationTimestamp.getTime()));
  assert.ok(movement.payloadFiscal?.generationTimestamp && typeof movement.payloadFiscal.generationTimestamp === "object",
    "the fiscal payload keeps its separate generation timestamp structure");
  const cajaRows = wixDataMock._store.get(IC.BUSINESS_COLLECTIONS.CAJA_ACTUAL) || [];
  assert.equal(cajaRows.length, 1, "fiscal sequence must remain on the only CajaActual item");
  assert.equal(cajaRows[0]._id, "SINGLE_ITEM_ID");
  assert.equal(cajaRows[0].sequenceCounters.seqGlobal, 1);
  assert.equal(movement.transactionId, "ORDER-" + orderId);
  assert.equal(movement.orderId, orderId);
  assert.equal(movement.totalAmount, 45.5, "official priceSummary.totalPrice must take precedence over the line-item fallback");
  assert.equal(movement.taxBase, 37.6);
  assert.equal(movement.taxAmount, 7.9);
  assert.equal(movement.tipoImpositivo, 21);
  assert.equal(movement.desgloseDetallado?.[0]?.cuota, 7.9);
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
    controlRows.filter(row => row.controlType === IC.CONTROL_TYPE.WEBHOOK_EVENT && row.eventId === eventId).length,
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

test("EVENT-REFUND-01 defers incomplete refunds, records successful terminal amounts and replays idempotently", async () => {
  wixDataMock._reset();
  seedCajaPrincipal();

  const secretState = globalThis.__mmSecretsState || (globalThis.__mmSecretsState = { _map: {}, _default: "mock-secret" });
  secretState._map.FISCAL_NIF_EMISOR = "B12345678";
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.DATOS_FISCALES, [{
    _id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    recordType: "TERCERO",
    taxId: "B12345678",
    legalName: "MARIAN MADRID",
    thirdPartyType: "EMISOR",
    address: null,
  }]);
  wixDataMock._seed("CitasF2", [seedCita({
    bookingStatus: "PENDING",
    paymentStatus: "PENDING_PAYMENT",
    totalAmount: 45.5,
    meta: { pairToken: PAIR_TOKEN, customSaga: true, paymentStatus: "PENDING_PAYMENT" },
  })]);

  const orderId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const refundId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  activeOrder = {
    _id: orderId,
    paymentStatus: "PAID",
    currency: "EUR",
    taxIncludedInPrices: true,
    taxInfo: { totalTax: { amount: "7.90" }, taxBreakdown: [] },
    priceSummary: {
      subtotal: { amount: "37.60" },
      tax: { amount: "7.90" },
      total: { amount: "45.50" },
      totalPrice: { amount: "45.50" },
    },
    lineItems: [{
      catalogReference: {
        appId: IC.WIX_CATALOG_APP_IDS.BOOKINGS,
        catalogItemId: BOOKING_ID,
      },
      productName: { original: "QA booking service" },
      quantity: 1,
      price: { amount: "120.00" },
      totalPriceAfterTax: { amount: "45.50" },
      taxInfo: {
        taxableAmount: { amount: "37.60" },
        taxAmount: { amount: "7.90" },
        taxRate: "0.21",
        taxBreakdown: [],
      },
    }],
  };
  activeOrderTransactions = { orderId, payments: [], refunds: [] };

  const paid = await events.wixEcom_onOrderPaymentStatusUpdated({
    metadata: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1" },
    data: { order: activeOrder, previousPaymentStatus: "NOT_PAID" },
  });
  assert.equal(paid.status, "OK");
  assert.equal((wixDataMock._store.get(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA) || []).length, 1);

  await assert.rejects(
    events.wixEcom_onOrderPaymentStatusUpdated({
      metadata: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb7" },
      data: {
        order: { ...activeOrder, currency: "USD", paymentStatus: "PARTIALLY_REFUNDED" },
        previousPaymentStatus: "PAID",
      },
    }),
    /REFUND_CURRENCY_UNSUPPORTED/
  );
  assert.equal((wixDataMock._store.get(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA) || []).length, 1,
    "refunds outside the canonical EUR site currency must not append a fiscal correction");

  activeOrderTransactions = {
    orderId,
    payments: [],
    refunds: [{
      id: refundId,
      transactions: [
        { paymentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", refundStatus: "SUCCEEDED", amount: { amount: "10.00" } },
        { paymentId: "ffffffff-ffff-4fff-8fff-ffffffffffff", refundStatus: "PENDING", amount: { amount: "5.00" } },
      ],
      summary: { refunded: { amount: "10.00" } },
    }],
  };
  await assert.rejects(
    events.wixEcom_onOrderPaymentStatusUpdated({
      metadata: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2" },
      data: {
        order: { ...activeOrder, paymentStatus: "PARTIALLY_REFUNDED" },
        previousPaymentStatus: "PAID",
      },
    }),
    /REFUND_TRANSACTIONS_PENDING/
  );
  assert.equal((wixDataMock._store.get(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA) || []).length, 1,
    "a refund with a pending transaction must not append a fiscal correction");

  activeOrderTransactions.refunds[0].transactions[1].refundStatus = "FAILED";
  const completed = await events.wixEcom_onOrderUpdated({
    metadata: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3" },
    data: { order: { ...activeOrder, paymentStatus: "PARTIALLY_REFUNDED" } },
  });
  assert.equal(completed.status, "OK");
  assert.equal(completed.completedRefundCount, 1);

  const movements = wixDataMock._store.get(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA) || [];
  assert.equal(movements.length, 2);
  const refundMovement = movements.find(row => row.transactionId === "REFUND-" + orderId + "-" + refundId);
  assert.ok(refundMovement);
  assert.equal(refundMovement.totalAmount, -10);
  assert.equal(refundMovement.taxBase, -8.26);
  assert.equal(refundMovement.taxAmount, -1.74);

  let cita = (wixDataMock._store.get("CitasF2") || []).find(row => row.bookingId === BOOKING_ID);
  assert.equal(cita.paymentStatus, IC.PAYMENT_STATUS.PARTIALLY_REFUNDED);
  assert.equal(cita.bookingStatus, "PENDING");

  const secondRefundId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  activeOrderTransactions.refunds.push({
    id: secondRefundId,
    transactions: [
      { paymentId: "99999999-9999-4999-8999-999999999999", refundStatus: "SUCCEEDED", amount: { amount: "35.50" } },
    ],
    summary: { refunded: { amount: "35.50" } },
  });
  const fullyRefunded = await events.wixEcom_onOrderUpdated({
    metadata: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4" },
    data: { order: { ...activeOrder, paymentStatus: "FULLY_REFUNDED" } },
  });
  assert.equal(fullyRefunded.status, "OK");
  assert.equal(fullyRefunded.completedRefundCount, 2);
  let finalMovements = wixDataMock._store.get(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA) || [];
  assert.equal(finalMovements.length, 3);
  const finalRefundMovement = finalMovements.find(row => row.transactionId === "REFUND-" + orderId + "-" + secondRefundId);
  assert.ok(finalRefundMovement);
  assert.equal(finalRefundMovement.totalAmount, -35.5);
  assert.equal(finalRefundMovement.taxBase, -29.34);
  assert.equal(finalRefundMovement.taxAmount, -6.16);
  cita = (wixDataMock._store.get("CitasF2") || []).find(row => row.bookingId === BOOKING_ID);
  assert.equal(cita.paymentStatus, IC.PAYMENT_STATUS.REFUNDED);

  const replay = await events.wixEcom_onOrderUpdated({
    metadata: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5" },
    data: { order: { ...activeOrder, paymentStatus: "FULLY_REFUNDED" } },
  });
  assert.equal(replay.status, "OK");
  assert.equal((wixDataMock._store.get(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA) || []).length, 3,
    "a completed refund replay must not append a second rectification");

  const concurrentResults = await Promise.all([
    events.wixEcom_onOrderUpdated({
      metadata: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb6" },
      data: { order: { ...activeOrder, paymentStatus: "FULLY_REFUNDED" } },
    }),
    events.wixEcom_onOrderUpdated({
      metadata: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb7" },
      data: { order: { ...activeOrder, paymentStatus: "FULLY_REFUNDED" } },
    }),
  ]);
  assert.equal(concurrentResults.every(result => result.status === "OK"), true);
  finalMovements = wixDataMock._store.get(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA) || [];
  assert.equal(finalMovements.length, 3, "concurrent refund events must not duplicate fiscal rectifications");
  assert.equal(finalMovements.filter(row => row.transactionId === "REFUND-" + orderId + "-" + refundId).length, 1);
  assert.equal(finalMovements.filter(row => row.transactionId === "REFUND-" + orderId + "-" + secondRefundId).length, 1);
});

test("EVENT-BOOKING-RESCHEDULE-01 native reschedule updates only the affected CitasF2 phase and flags its dual sibling", async () => {
  wixDataMock._reset();
  wixDataMock._store.set("CitasF2", [
    seedCita({
      revision: 3,
      paymentStatus: "PAID",
      bookingStatus: "CONFIRMED",
      orderId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }),
    seedCita({
      _id: "cita-row-f2",
      bookingId: F2_BOOKING_ID,
      bookingType: "DUAL_F2",
      revision: 3,
      paymentStatus: "PAID",
      bookingStatus: "CONFIRMED",
      meta: { pairToken: PAIR_TOKEN, customSaga: true, linkedF1BookingId: BOOKING_ID },
    }),
  ]);

  const result = await events.wixBookings_onBookingRescheduled({
    metadata: { id: "native-reschedule-event-01" },
    data: {
      booking: {
        id: BOOKING_ID,
        _id: BOOKING_ID,
        revision: 4,
        startDate: "2026-11-10T11:00:00",
        endDate: "2026-11-10T11:30:00",
        bookedEntity: {
          slot: {
            serviceId: SERVICE_ID,
            scheduleId: SCHEDULE_ID,
            startDate: "2026-11-10T11:00:00",
            endDate: "2026-11-10T11:30:00",
            resource: { id: RESOURCE_ID, scheduleId: SCHEDULE_ID },
          },
        },
      },
    },
  });

  assert.equal(result.status, "OK", JSON.stringify(result));
  assert.equal(result.pairRepairRequired, true);
  assert.equal(result.updated, true);
  const rows = wixDataMock._store.get("CitasF2") || [];
  const f1 = rows.find(row => row.bookingId === BOOKING_ID);
  const f2 = rows.find(row => row.bookingId === F2_BOOKING_ID);
  assert.equal(new Date(f1.slotStart).toISOString(), "2026-11-10T10:00:00.000Z");
  assert.equal(new Date(f1.slotEnd).toISOString(), "2026-11-10T10:30:00.000Z");
  assert.equal(f1.dateYmd, "2026-11-10");
  assert.equal(f1.revision, 4);
  assert.equal(f1.paymentStatus, "PAID");
  assert.equal(f1.bookingStatus, "CONFIRMED");
  assert.equal(f1.orderId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.equal(new Date(f2.slotStart).toISOString(), "2026-10-22T09:00:00.000Z");
  assert.equal(f2.paymentStatus, "PAID");
  assert.equal(f2.pairToken, PAIR_TOKEN);

  const alerts = (wixDataMock._store.get("ControlOperativo") || []).filter(
    row => row.alertType === "DUAL_BOOKING_NATIVE_RESCHEDULE_MISMATCH"
  );
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].status, "OPEN");
  assert.equal(alerts[0].payload.data.bookingId, BOOKING_ID);
  assert.equal(alerts[0].payload.data.pairedBookingId, F2_BOOKING_ID);
});

test("EVENT-BOOKING-RESCHEDULE-02 duplicate native reschedule event is idempotent", async () => {
  wixDataMock._reset();
  wixDataMock._store.set("CitasF2", [
    seedCita({
      revision: 4,
      slotStart: new Date("2026-11-10T10:00:00.000Z"),
      slotEnd: new Date("2026-11-10T10:30:00.000Z"),
      dateYmd: "2026-11-10",
    }),
    seedCita({
      _id: "cita-row-f2",
      bookingId: F2_BOOKING_ID,
      bookingType: "DUAL_F2",
      meta: { pairToken: PAIR_TOKEN, customSaga: true },
    }),
  ]);
  wixDataMock._store.set("ControlOperativo", [{
    _id: "processed-event-marker",
    controlType: IC.CONTROL_TYPE.WEBHOOK_EVENT,
    dedupeKey: "WEBHOOK_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02",
    eventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02",
    status: IC.CONTROL_STATUS.COMPLETED,
    payload: { eventType: "BOOKING_RESCHEDULED" },
  }]);

  const result = await events.wixBookings_onBookingRescheduled({
    metadata: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02" },
    data: {
      booking: {
        id: BOOKING_ID,
        revision: 4,
        startDate: "2026-11-10T10:00:00.000Z",
        endDate: "2026-11-10T10:30:00.000Z",
        bookedEntity: {
          slot: {
            serviceId: SERVICE_ID,
            scheduleId: SCHEDULE_ID,
            resource: { id: RESOURCE_ID, scheduleId: SCHEDULE_ID },
          },
        },
      },
    },
  });

  assert.equal(result.status, "OK", JSON.stringify(result));
  assert.equal(result.updated, false);
  assert.equal((wixDataMock._store.get("ControlOperativo") || []).filter(
    row => row.alertType === "DUAL_BOOKING_NATIVE_RESCHEDULE_MISMATCH"
  ).length, 1);
});

test("EVENT-BOOKING-RESCHEDULE-03 missing CitasF2 projection is retriable and never creates a partial row", async () => {
  wixDataMock._reset();
  await assert.rejects(
    events.wixBookings_onBookingRescheduled({
      metadata: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03" },
      data: {
        booking: {
          id: BOOKING_ID,
          revision: 4,
          startDate: "2026-11-10T10:00:00.000Z",
          endDate: "2026-11-10T10:30:00.000Z",
          bookedEntity: { slot: { serviceId: SERVICE_ID } },
        },
      },
    }),
    /RESCHEDULED_BOOKING_CITASF2_NOT_FOUND/
  );
  assert.equal((wixDataMock._store.get("CitasF2") || []).length, 0);
  const controlRows = wixDataMock._store.get("ControlOperativo") || [];
  assert.equal(controlRows.filter(row => row.controlType === IC.CONTROL_TYPE.WEBHOOK_EVENT).length, 0);
  assert.equal(controlRows.filter(row => row.controlType === IC.CONTROL_TYPE.WEBHOOK_CLAIM && row.status === IC.WEBHOOK_CLAIM_STATUS.FAILED_RETRYABLE).length, 1);
});

test("EVENT-BOOKING-RESCHEDULE-04 older native reschedule revision cannot roll a newer CitasF2 slot back", async () => {
  wixDataMock._reset();
  wixDataMock._store.set("CitasF2", [
    seedCita({
      revision: 5,
      slotStart: new Date("2026-11-12T10:00:00.000Z"),
      slotEnd: new Date("2026-11-12T10:30:00.000Z"),
      dateYmd: "2026-11-12",
    }),
  ]);
  const result = await events.wixBookings_onBookingRescheduled({
    metadata: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04" },
    data: {
      booking: {
        id: BOOKING_ID,
        revision: 4,
        startDate: "2026-11-10T10:00:00.000Z",
        endDate: "2026-11-10T10:30:00.000Z",
        bookedEntity: {
          slot: {
            serviceId: SERVICE_ID,
            scheduleId: SCHEDULE_ID,
            resource: { id: RESOURCE_ID, scheduleId: SCHEDULE_ID },
          },
        },
      },
    },
  });
  assert.equal(result.status, "OK");
  assert.equal(result.stale, true);
  const row = (wixDataMock._store.get("CitasF2") || [])[0];
  assert.equal(new Date(row.slotStart).toISOString(), "2026-11-12T10:00:00.000Z");
  assert.equal(row.revision, 5);
});


test("EVENT-BOOKING-09 native SDK resource _id is accepted by the CitasF2 projection writer", async () => {
  wixDataMock._reset();
  const booking = nativeBooking({
    id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    bookedEntity: {
      title: "QA booking SDK resource id",
      slot: {
        serviceId: SERVICE_ID,
        scheduleId: SCHEDULE_ID,
        startDate: "2026-10-22T09:00:00.000Z",
        endDate: "2026-10-22T09:30:00.000Z",
        resource: { _id: RESOURCE_ID, name: "QA SDK Staff" },
      },
    },
  });
  const result = await events.wixBookingsV2_onBookingConfirmed(
    bookingConfirmedEvent("evt-native-confirm-009", booking)
  );
  assert.equal(result.status, "OK");
  const row = (wixDataMock._store.get("CitasF2") || [])[0];
  assert.equal(row.resourceId, RESOURCE_ID);
  assert.equal(row.scheduleId, SCHEDULE_ID);
});

test("EVENT-BOOKING-10 controlled reconciliation projects confirmed unpaid bookings and is idempotent", async () => {
  wixDataMock._reset();
  const booking = nativeBooking({
    id: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff",
    status: "CONFIRMED",
    paymentStatus: "NOT_PAID",
    bookedEntity: {
      title: "QA booking reconciliation",
      slot: {
        serviceId: SERVICE_ID,
        scheduleId: SCHEDULE_ID,
        startDate: "2026-10-22T09:00:00.000Z",
        endDate: "2026-10-22T09:30:00.000Z",
        resource: { _id: RESOURCE_ID, name: "QA SDK Staff" },
      },
    },
  });
  const first = await events.reconcileConfirmedNativeBookingProjectionInternal(booking, "trace-reconcile-booking");
  assert.equal(first.ok, true);
  assert.equal(first.created, true);
  assert.equal(first.amountReconciliationRequired, true);

  const rows = wixDataMock._store.get("CitasF2") || [];
  assert.equal(rows.length, 1);
  assert.equal(rows[0].bookingId, booking.id);
  assert.equal(rows[0].bookingStatus, "CONFIRMED");
  assert.equal(rows[0].paymentStatus, "NOT_PAID");
  assert.equal(rows[0].totalAmount, 0);
  assert.equal(rows[0].meta.amountReconciliationRequired, true);

  const markers = wixDataMock._store.get("ControlOperativo") || [];
  assert.equal(markers.filter(row => row.payload?.eventType === "BOOKING_CONFIRMED_RECONCILED").length, 1);

  const replay = await events.reconcileConfirmedNativeBookingProjectionInternal(booking, "trace-reconcile-booking");
  assert.equal(replay.ok, true);
  assert.equal(replay.created, false);
  assert.equal((wixDataMock._store.get("CitasF2") || []).length, 1);
  assert.equal((wixDataMock._store.get("ControlOperativo") || []).filter(row => row.payload?.eventType === "BOOKING_CONFIRMED_RECONCILED").length, 1);
});

test("EVENT-BOOKING-11 controlled reconciliation refuses PAID bookings without ledger proof", async () => {
  wixDataMock._reset();
  const booking = nativeBooking({
    id: "cccccccc-dddd-4eee-8fff-aaaaaaaaaaaa",
    status: "CONFIRMED",
    paymentStatus: "PAID",
  });
  const result = await events.reconcileConfirmedNativeBookingProjectionInternal(booking, "trace-paid-booking");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "NATIVE_BOOKING_PAYMENT_REQUIRES_LEDGER_RECONCILIATION");
  assert.equal((wixDataMock._store.get("CitasF2") || []).length, 0);
  assert.equal((wixDataMock._store.get("ControlOperativo") || []).length, 0);
});


test("EVENT-ORDER-NATIVE-STOCK-10 order-created marks mixed Wix catalog orders without custom stock writes", async () => {
  wixDataMock._reset();
  const orderId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const eventId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const event = {
    metadata: { id: eventId },
    data: {
      order: {
        _id: orderId,
        status: "APPROVED",
        paymentStatus: "NOT_PAID",
        lineItems: [
          {
            catalogReference: {
              appId: IC.WIX_CATALOG_APP_IDS.BOOKINGS,
              catalogItemId: BOOKING_ID,
            },
          },
          {
            catalogReference: {
              appId: IC.WIX_CATALOG_APP_IDS.STORES,
              catalogItemId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            },
          },
        ],
      },
    },
  };

  const first = await events.wixEcom_onOrderCreated(event);
  const replay = await events.wixEcom_onOrderCreated(event);

  assert.equal(first.status, "OK");
  assert.equal(first.inventoryManagedBy, "WIX_NATIVE");
  assert.equal(replay.status, "OK");
  assert.equal(replay.duplicate, true);

  const markers = wixDataMock._store.get(IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO) || [];
  const marker = markers.find(row => row.controlType === IC.CONTROL_TYPE.WEBHOOK_EVENT && row.eventId === eventId);
  assert.ok(marker);
  assert.equal(marker.payload?.metadata?.inventoryAuthority, "WIX_CATALOG_OWNER");
  assert.equal(marker.payload?.metadata?.inventoryAction, "NO_CUSTOM_STOCK_WRITE");
  assert.equal((wixDataMock._store.get(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_INVENTARIO) || []).length, 0);
  assert.equal((wixDataMock._store.get(IC.BUSINESS_COLLECTIONS.INVENTARIO_STOCK_VENTA) || []).length, 0);
});


test("EVENT-PAYMENT-10 a failed strong ledger preflight read fails closed and never appends a second movement", async () => {
  wixDataMock._reset();
  seedCajaPrincipal();

  const secretState = globalThis.__mmSecretsState || (globalThis.__mmSecretsState = { _map: {}, _default: "mock-secret" });
  secretState._map.FISCAL_NIF_EMISOR = "B12345678";
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.DATOS_FISCALES, [{
    _id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    recordType: "TERCERO",
    taxId: "B12345678",
    legalName: "MARIAN MADRID",
    thirdPartyType: "EMISOR",
    address: null,
  }]);

  const orderId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  const eventId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
  const order = {
    _id: orderId,
    paymentStatus: "PAID",
    currency: "EUR",
    taxIncludedInPrices: true,
    taxInfo: { totalTax: { amount: "7.90" }, taxBreakdown: [] },
    priceSummary: {
      subtotal: { amount: "37.60" },
      tax: { amount: "7.90" },
      total: { amount: "45.50" },
      totalPrice: { amount: "45.50" },
    },
    lineItems: [{
      catalogReference: {
        appId: IC.WIX_CATALOG_APP_IDS.STORES,
        catalogItemId: "11111111-1111-4111-8111-111111111111",
      },
      productName: { original: "QA synthetic store item" },
      quantity: 1,
      totalPriceAfterTax: { amount: "45.50" },
      taxInfo: {
        taxableAmount: { amount: "37.60" },
        taxAmount: { amount: "7.90" },
        taxRate: "0.21",
        taxBreakdown: [],
      },
    }],
  };
  activeOrder = order;
  activeOrderTransactions = { orderId, payments: [], refunds: [] };

  const preflightError = new Error("SYNTHETIC_LEDGER_READ_FAILURE");
  // dataAccess captures the elevated query function at module initialization;
  // the harness exposes _findErrors specifically for deterministic late faults.
  wixDataMock._findErrors.set(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA, preflightError);

  try {
    await assert.rejects(
      events.wixEcom_onOrderPaymentStatusUpdated({
        metadata: { id: eventId },
        data: { order, previousPaymentStatus: "PENDING" },
      }),
      /SYNTHETIC_LEDGER_READ_FAILURE/
    );
  } finally {
    wixDataMock._findErrors.delete(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA);
  }

  assert.equal(
    wixDataMock._calls.some(call => call.op === "query" && call.collection === IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA),
    true,
    "the injected failure must hit the existing-ledger strong read"
  );
  assert.equal((wixDataMock._store.get(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA) || []).length, 0,
    "a read failure must not be interpreted as an empty ledger");
  const claims = (wixDataMock._store.get(IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO) || [])
    .filter(row => row.controlType === IC.CONTROL_TYPE.WEBHOOK_CLAIM);
  assert.equal(claims.length, 1);
  assert.equal(claims[0].status, IC.WEBHOOK_CLAIM_STATUS.FAILED_RETRYABLE,
    "the failed event claim must remain retryable");
});


test("EVENT-PAYMENT-11 pending and failed PSP outcomes never create fiscal movements", async () => {
  const orderId = "22222222-2222-4222-8222-222222222222";
  const outcomes = ["PENDING", "NOT_PAID", "FAILED", "CANCELED", "PARTIALLY_PAID"];

  for (const [index, paymentStatus] of outcomes.entries()) {
    wixDataMock._reset();
    wixDataMock._seed("CitasF2", [seedCita({
      bookingStatus: "PENDING",
      paymentStatus: "PENDING_PAYMENT",
      meta: { pairToken: PAIR_TOKEN, customSaga: true, paymentStatus: "PENDING_PAYMENT" },
    })]);
    const order = {
      _id: orderId,
      paymentStatus,
      currency: "EUR",
      priceSummary: { total: { amount: "45.50" } },
      lineItems: [{
        catalogReference: {
          appId: IC.WIX_CATALOG_APP_IDS.BOOKINGS,
          catalogItemId: BOOKING_ID,
        },
        quantity: 1,
        price: { amount: "45.50" },
      }],
    };
    activeOrder = order;
    activeOrderTransactions = { orderId, payments: [], refunds: [] };

    const result = await events.wixEcom_onOrderPaymentStatusUpdated({
      metadata: { id: "psp-outcome-" + index + "-" + paymentStatus },
      data: { order, previousPaymentStatus: "PENDING" },
    });

    assert.equal(result.status, "OK", paymentStatus);
    assert.equal((wixDataMock._store.get(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA) || []).length, 0,
      paymentStatus + " must not append a sale movement");
    const cita = (wixDataMock._store.get("CitasF2") || []).find(row => row.bookingId === BOOKING_ID);
    assert.equal(cita.paymentStatus, "PENDING_PAYMENT", paymentStatus + " must not mark the booking paid");
  }
});
