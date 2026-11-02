import test from "node:test";
import assert from "node:assert/strict";

const { wixDataMock, mocks } = await import("./loader.mjs");
const IC = await import("backend/internalConfig.js");

const SERVICE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11";
const LINKED_SERVICE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa22";
const RESOURCE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SCHEDULE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const LOCATION_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const BOOKING_F1_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const BOOKING_F2_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";

const SLOT_F1 = {
  localStartDate: "2026-11-04T10:00:00",
  localEndDate: "2026-11-04T11:00:00",
  bookable: true,
  resourceId: RESOURCE_ID,
  scheduleId: SCHEDULE_ID,
  serviceId: SERVICE_ID,
  location: { _id: LOCATION_ID },
  availableResources: [{
    resourceTypeId: IC.API.STAFF_RESOURCE_TYPE_ID,
    resources: [{ id: RESOURCE_ID, _id: RESOURCE_ID }],
  }],
};
const SLOT_F2 = {
  localStartDate: "2026-11-04T11:20:00",
  localEndDate: "2026-11-04T11:50:00",
  bookable: true,
  resourceId: RESOURCE_ID,
  scheduleId: SCHEDULE_ID,
  serviceId: LINKED_SERVICE_ID,
  location: { _id: LOCATION_ID },
  availableResources: [{
    resourceTypeId: IC.API.STAFF_RESOURCE_TYPE_ID,
    resources: [{ id: RESOURCE_ID, _id: RESOURCE_ID }],
  }],
};

const writerCalls = [];
const confirmationCalls = [];
const availabilityCalls = [];
let slotReadIndex = 0;
const staffMember = {
  _id: "11111111-1111-4111-8111-111111111111",
  resourceId: RESOURCE_ID,
  name: "Profesional QA",
  email: "qa.staff@example.test",
  serviceProvider: true,
  resource: {
    _id: RESOURCE_ID,
    workingHoursSchedules: [{ _id: SCHEDULE_ID }],
    eventsSchedule: { _id: SCHEDULE_ID },
  },
};

mocks.webMethods.register("@wix/bookings", "availabilityTimeSlots::listAvailabilityTimeSlots",
  async (payload) => {
    availabilityCalls.push(payload);
    return {
      timeSlots: [payload?.serviceId === LINKED_SERVICE_ID ? SLOT_F2 : SLOT_F1],
    };
  });
mocks.webMethods.register("@wix/bookings", "availabilityTimeSlots::getAvailabilityTimeSlot",
  async (...args) => {
    const result = slotReadIndex % 2 === 0 ? SLOT_F1 : SLOT_F2;
    slotReadIndex += 1;
    return result;
  });
mocks.sdk["bookings::staffMembers"] = {
  queryStaffMembers: async () => ({
    staffMembers: [staffMember],
    pagingMetadata: { hasNext: false, cursors: {} },
  }),
};
mocks.sdk["@wix/bookings::bookings"] = {
  createBooking: async (booking, options) => {
    writerCalls.push({ booking, options });
    const id = writerCalls.length === 1 ? BOOKING_F1_ID : BOOKING_F2_ID;
    return {
      booking: {
        id,
        revision: 1,
        bookingStatus: "CREATED",
        doubleBooked: false,
      },
    };
  },
  confirmOrDeclineBooking: async (bookingId, options) => {
    confirmationCalls.push({ bookingId, options });
    return { booking: { id: bookingId, bookingStatus: "CONFIRMED" } };
  },
};

const { executeBookingSaga } = await import("backend/booking/bookingSaga.js");

test("QA-DUAL-BOOKING-01 creates two linked Writer V2 appointments with the catalog exposure gap", async () => {
  wixDataMock._reset();
  writerCalls.length = 0;
  confirmationCalls.length = 0;
  availabilityCalls.length = 0;
  slotReadIndex = 0;

  wixDataMock._seed("ServiciosCatalogo", [
    {
      _id: SERVICE_ID,
      serviceId: SERVICE_ID,
      slug: "qa-servicio-dual",
      title: "QA Servicio Dual",
      price: 80,
      currency: "EUR",
      location: "QA Salon",
      locationId: LOCATION_ID,
      totalDuration: 110,
      phase1Duration: 60,
      phase2Duration: 30,
      exposureDuration: 20,
      allowCombine: true,
      linkedPhases: LINKED_SERVICE_ID,
      clientHidden: false,
      addOnOptions: [],
      onlinePayment: false,
      inPersonPayment: true,
    },
    {
      _id: LINKED_SERVICE_ID,
      serviceId: LINKED_SERVICE_ID,
      title: "QA Fase 2",
      serviceType: "APPOINTMENT",
      phase2Duration: 30,
      locationId: LOCATION_ID,
      clientHidden: true,
    },
  ]);

  const payload = {
    traceId: "trace-qa-dual-001",
    firstName: "Cliente",
    lastName: "QA Dual",
    email: "qa.dual@example.test",
    rgpdConsent: true,
    serviceId: SERVICE_ID,
    channelType: IC.CHANNEL_TYPE.PRESENCIAL,
    slotF1: {
      localStartDate: SLOT_F1.localStartDate,
      localEndDate: SLOT_F1.localEndDate,
    },
    slotF2: {
      localStartDate: SLOT_F2.localStartDate,
      localEndDate: SLOT_F2.localEndDate,
    },
  };

  const result = await executeBookingSaga(payload);
  assert.equal(result.status, "SUCCESS", JSON.stringify(result));
  assert.equal(result.data.isDual, true);
  assert.deepEqual(result.data.bookingIds, [BOOKING_F1_ID, BOOKING_F2_ID]);
  assert.equal(result.data.requiresPayment, false);
  assert.equal(writerCalls.length, 2, "dual booking must create exactly F1 and F2");
  assert.equal(confirmationCalls.length, 2, "both phases must be confirmed");
  assert.ok(availabilityCalls.some((call) => call.serviceId === SERVICE_ID));
  assert.ok(availabilityCalls.some((call) => call.serviceId === LINKED_SERVICE_ID));

  assert.equal(writerCalls[0].booking.bookedEntity.slot.serviceId, SERVICE_ID);
  assert.equal(writerCalls[1].booking.bookedEntity.slot.serviceId, LINKED_SERVICE_ID);
  assert.equal(writerCalls[0].booking.bookedEntity.slot.resource._id, RESOURCE_ID);
  assert.equal(writerCalls[1].booking.bookedEntity.slot.resource._id, RESOURCE_ID);

  const citas = wixDataMock._store.get("CitasF2") || [];
  assert.equal(citas.length, 2, "F1 and F2 must both persist to CitasF2");
  const f1 = citas.find((cita) => cita.bookingId === BOOKING_F1_ID);
  const f2 = citas.find((cita) => cita.bookingId === BOOKING_F2_ID);
  assert.ok(f1);
  assert.ok(f2);
  assert.equal(f1.bookingType, IC.BOOKING_TYPE.DUAL_F1);
  assert.equal(f2.bookingType, IC.BOOKING_TYPE.DUAL_F2);
  assert.equal(f1.pairToken, f2.pairToken, "both phases share one pair token");
  assert.equal(f1.resourceId, RESOURCE_ID);
  assert.equal(f2.resourceId, RESOURCE_ID);
  assert.equal(f2.meta.linkedF1BookingId, BOOKING_F1_ID);

  const replay = await executeBookingSaga({
    ...payload,
    traceId: "trace-qa-dual-001-replay",
  });
  assert.equal(replay.status, "SUCCESS", JSON.stringify(replay));
  assert.equal(replay.idempotent, true);
  assert.equal(writerCalls.length, 2, "idempotent replay must not create F1 or F2 again");
  assert.equal(confirmationCalls.length, 2);
  assert.equal((wixDataMock._store.get("CitasF2") || []).length, 2);
});

test.after(() => {
  mocks.webMethods.clear();
  mocks.sdk["bookings::staffMembers"] = {};
  mocks.sdk["@wix/bookings::bookings"] = {};
});
