import test from 'node:test';
import assert from 'node:assert/strict';

const { wixDataMock, mocks } = await import('./loader.mjs');
const IC = await import('backend/internalConfig.js');

const SERVICE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11';
const RESOURCE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SCHEDULE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const LOCATION_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const BOOKING_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const SLOT_START = '2026-11-04T10:00:00';
const SLOT_END = '2026-11-04T11:00:00';

const writerCalls = [];
const confirmationCalls = [];
const slotsState = { calls: [], getCalls: [] };
const staffMember = {
  _id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  resourceId: RESOURCE_ID,
  name: 'Profesional QA',
  email: 'qa.staff@example.test',
  serviceProvider: true,
  resource: {
    _id: RESOURCE_ID,
    workingHoursSchedules: [{ _id: SCHEDULE_ID }],
    eventsSchedule: { _id: SCHEDULE_ID },
  },
};

const slotFixture = {
  localStartDate: SLOT_START,
  localEndDate: SLOT_END,
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

mocks.webMethods.register('@wix/bookings', 'availabilityTimeSlots::listAvailabilityTimeSlots',
  async (payload) => {
    slotsState.calls.push(payload);
    return { timeSlots: [slotFixture] };
  });
mocks.webMethods.register('@wix/bookings', 'availabilityTimeSlots::getAvailabilityTimeSlot',
  async (...args) => {
    slotsState.getCalls.push(args);
    return slotFixture;
  });
mocks.sdk['bookings::staffMembers'] = {
  queryStaffMembers: async () => ({
    staffMembers: [staffMember],
    pagingMetadata: { hasNext: false, cursors: {} },
  }),
};
mocks.sdk['@wix/bookings::bookings'] = {
  createBooking: async (booking, options) => {
    writerCalls.push({ booking, options });
    return {
      booking: {
        id: BOOKING_ID,
        revision: 1,
        bookingStatus: 'CREATED',
        doubleBooked: false,
      },
    };
  },
  confirmOrDeclineBooking: async (bookingId, options) => {
    confirmationCalls.push({ bookingId, options });
    return { booking: { id: bookingId, bookingStatus: 'CONFIRMED' } };
  },
};

const { executeBookingSaga } = await import('backend/booking/bookingSaga.js');

test('QA-SIMPLE-BOOKING-01 resolves real catalogue and staff mocks, creates one Writer V2 booking and persists CitasF2', async () => {
  wixDataMock._reset();
  writerCalls.length = 0;
  confirmationCalls.length = 0;
  slotsState.calls.length = 0;
  slotsState.getCalls.length = 0;

  wixDataMock._seed('ServiciosCatalogo', [{
    _id: SERVICE_ID,
    serviceId: SERVICE_ID,
    slug: 'qa-corte-simple',
    title: 'QA Corte Simple',
    price: 50,
    currency: 'EUR',
    location: 'QA Salon',
    locationId: LOCATION_ID,
    totalDuration: 60,
    phase1Duration: 60,
    phase2Duration: 0,
    exposureDuration: 0,
    allowCombine: false,
    linkedPhases: null,
    clientHidden: false,
    addOnOptions: [],
    onlinePayment: true,
    inPersonPayment: true,
  }]);

  const result = await executeBookingSaga({
    traceId: 'trace-qa-simple-001',
    firstName: 'Cliente',
    lastName: 'QA Simple',
    email: 'qa.simple@example.test',
    rgpdConsent: true,
    serviceId: SERVICE_ID,
    channelType: IC.CHANNEL_TYPE.PRESENCIAL,
    slotF1: {
      localStartDate: SLOT_START,
      localEndDate: SLOT_END,
    },
  });

  assert.equal(result.status, 'SUCCESS', JSON.stringify(result));
  assert.equal(result.data.isDual, false);
  assert.equal(result.data.bookingId, BOOKING_ID);
  assert.deepEqual(result.data.bookingIds, [BOOKING_ID]);
  assert.equal(result.data.requiresPayment, false);
  assert.equal(writerCalls.length, 1, 'simple booking must call Bookings Writer V2 exactly once');
  assert.equal(confirmationCalls.length, 1, 'in-person booking must confirm exactly once');
  assert.ok(slotsState.calls.length > 0, 'real availability adapter must be consulted');
  assert.ok(slotsState.getCalls.length > 0, 'exact slot must be rechecked');

  const body = writerCalls[0].booking;
  assert.equal(body.contactDetails.email, 'qa.simple@example.test');
  assert.equal(body.bookedEntity.slot.serviceId, SERVICE_ID);
  assert.equal(body.bookedEntity.slot.scheduleId, SCHEDULE_ID);
  assert.equal(body.bookedEntity.slot.resource._id, RESOURCE_ID);
  assert.equal(body.totalParticipants, 1);

  const citas = wixDataMock._store.get('CitasF2') || [];
  assert.equal(citas.length, 1, 'one Wix booking must produce one CitasF2 record');
  assert.equal(citas[0].bookingId, BOOKING_ID);
  assert.equal(citas[0].serviceId, SERVICE_ID);
  assert.equal(citas[0].resourceId, RESOURCE_ID);
  assert.equal(citas[0].scheduleId, SCHEDULE_ID);
  assert.equal(citas[0].bookingType, IC.BOOKING_TYPE.SIMPLE);
  assert.equal(citas[0].status, undefined, 'legacy status alias must not be persisted');
  assert.equal(citas[0].pairToken, null, 'simple booking must not persist a dual pair token');
  assert.equal(citas[0].contactDetails.email, 'qa.simple@example.test');
});

test.after(() => {
  mocks.webMethods.clear();
  mocks.sdk['bookings::staffMembers'] = {};
  mocks.sdk['@wix/bookings::bookings'] = {};
});
