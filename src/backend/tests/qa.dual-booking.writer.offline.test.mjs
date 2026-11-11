import test from 'node:test';
import assert from 'node:assert/strict';

const { wixDataMock, mocks } = await import('./loader.mjs');
const IC = await import('backend/internalConfig.js');

const F1_SERVICE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11';
const F2_SERVICE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const RESOURCE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const SCHEDULE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const LOCATION_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const BOOKING_F1_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const BOOKING_F2_ID = '11111111-1111-4111-8111-111111111112';
const F1_START = '2026-11-10T09:00:00';
const F1_END = '2026-11-10T09:30:00';
const F2_START = '2026-11-10T10:00:00';
const F2_END = '2026-11-10T10:40:00';

const writerCalls = [];
const confirmationCalls = [];
const cancellationCalls = [];
const slotsState = { calls: [], failAt: null };

const staffMember = {
  _id: '22222222-2222-4222-8222-222222222222',
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

const slotF1 = {
  localStartDate: F1_START,
  localEndDate: F1_END,
  bookable: true,
  resourceId: RESOURCE_ID,
  scheduleId: SCHEDULE_ID,
  serviceId: F1_SERVICE_ID,
  location: { _id: LOCATION_ID },
  availableResources: [{
    resourceTypeId: IC.API.STAFF_RESOURCE_TYPE_ID,
    resources: [{ id: RESOURCE_ID, _id: RESOURCE_ID }],
  }],
};

const slotF2 = {
  ...slotF1,
  localStartDate: F2_START,
  localEndDate: F2_END,
  serviceId: F2_SERVICE_ID,
};

mocks.webMethods.register('@wix/bookings', 'availabilityTimeSlots::listAvailabilityTimeSlots',
  async (payload) => {
    slotsState.calls.push(payload);
    const slot = payload.serviceId === F2_SERVICE_ID ? slotF2 : slotF1;
    return { timeSlots: [slot] };
  });
mocks.webMethods.register('@wix/bookings', 'availabilityTimeSlots::getAvailabilityTimeSlot',
  async (...args) => {
    const requested = args.flat().find((value) => value && typeof value === 'object' && value.serviceId);
    return requested?.serviceId === F2_SERVICE_ID ? slotF2 : slotF1;
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
    if (slotsState.failAt === writerCalls.length) {
      throw new Error('synthetic F2 Writer failure');
    }
    const bookingId = writerCalls.length === 1 ? BOOKING_F1_ID : BOOKING_F2_ID;
    return {
      booking: {
        id: bookingId,
        revision: 1,
        status: 'CREATED',
        bookedEntity: {
          slot: {
            resource: { _id: RESOURCE_ID },
          },
        },
        doubleBooked: false,
      },
    };
  },
  confirmOrDeclineBooking: async (bookingId, options) => {
    confirmationCalls.push({ bookingId, options });
    return {
      booking: {
        id: bookingId,
        status: 'CONFIRMED',
        bookedEntity: { slot: { resource: { _id: RESOURCE_ID } } },
      },
    };
  },
  getBooking: async (bookingId) => ({
    booking: {
      id: bookingId,
      revision: 2,
      status: cancellationCalls.some((call) => call.bookingId === bookingId) ? 'CANCELED' : 'CONFIRMED',
    },
  }),
  cancelBooking: async (bookingId, options) => {
    cancellationCalls.push({ bookingId, options });
    return { booking: { id: bookingId, status: 'CANCELED' } };
  },
};

const { executeBookingSaga } = await import('backend/booking/bookingSaga.js');

function seedCatalog() {
  wixDataMock._reset();
  writerCalls.length = 0;
  confirmationCalls.length = 0;
  cancellationCalls.length = 0;
  slotsState.calls.length = 0;
  slotsState.failAt = null;

  wixDataMock._seed('ServiciosCatalogo', [
    {
      _id: F1_SERVICE_ID,
      serviceId: F1_SERVICE_ID,
      slug: 'qa-servicio-dual',
      title: 'QA Servicio Dual',
      serviceType: 'APPOINTMENT',
      price: 80,
      currency: 'EUR',
      location: 'QA Salon',
      locationId: LOCATION_ID,
      totalDuration: 100,
      phase1Duration: 30,
      exposureDuration: 30,
      phase2Duration: 40,
      allowCombine: true,
      linkedPhases: F2_SERVICE_ID,
      clientHidden: false,
      addOnOptions: [],
      onlinePayment: true,
      inPersonPayment: true,
    },
    {
      _id: F2_SERVICE_ID,
      serviceId: F2_SERVICE_ID,
      slug: 'qa-servicio-dual-f2',
      title: 'QA Servicio Dual F2',
      serviceType: 'APPOINTMENT',
      price: 0,
      currency: 'EUR',
      location: 'QA Salon',
      locationId: LOCATION_ID,
      totalDuration: 40,
      phase1Duration: 40,
      phase2Duration: 0,
      exposureDuration: 0,
      allowCombine: false,
      linkedPhases: null,
      clientHidden: true,
      addOnOptions: [],
      onlinePayment: false,
      inPersonPayment: true,
    },
  ]);
}

function bookingPayload(traceId) {
  return {
    traceId,
    firstName: 'Cliente',
    lastName: 'QA Dual',
    email: 'qa.dual@example.test',
    phone: '+34000000000',
    memberId: '33333333-3333-4333-8333-333333333333',
    contactId: '44444444-4444-4444-8444-444444444444',
    rgpdConsent: true,
    serviceId: F1_SERVICE_ID,
    channelType: IC.CHANNEL_TYPE.PRESENCIAL,
    slotF1: { localStartDate: F1_START, localEndDate: F1_END },
    slotF2: { localStartDate: F2_START, localEndDate: F2_END },
  };
}

test('QA-DUAL-BOOKING-01 creates two independent Bookings V2 appointments and two linked CitasF2 rows', async () => {
  seedCatalog();

  const result = await executeBookingSaga(bookingPayload('trace-qa-dual-success-001'));

  assert.equal(result.status, 'SUCCESS', JSON.stringify(result));
  assert.equal(result.data.isDual, true);
  assert.equal(result.data.bookingId, BOOKING_F1_ID);
  assert.deepEqual(result.data.bookingIds, [BOOKING_F1_ID, BOOKING_F2_ID]);
  assert.equal(writerCalls.length, 2, 'dual booking must create two independent native bookings');
  assert.equal(confirmationCalls.length, 2, 'both independent bookings must be confirmed');
  assert.ok(slotsState.calls.some((call) => call.serviceId === F1_SERVICE_ID), 'F1 native availability must be queried');
  assert.ok(slotsState.calls.some((call) => call.serviceId === F2_SERVICE_ID), 'F2 native availability must be queried');

  const bodyF1 = writerCalls[0].booking;
  const bodyF2 = writerCalls[1].booking;
  assert.equal(bodyF1.bookedEntity.slot.serviceId, F1_SERVICE_ID);
  assert.equal(bodyF2.bookedEntity.slot.serviceId, F2_SERVICE_ID);
  assert.equal(bodyF1.bookedEntity.slot.resource.id || bodyF1.bookedEntity.slot.resource._id, RESOURCE_ID);
  assert.equal(bodyF2.bookedEntity.slot.resource.id || bodyF2.bookedEntity.slot.resource._id, RESOURCE_ID);
  assert.equal(bodyF2.selectedPaymentOption, 'OFFLINE');
  assert.equal(writerCalls[1].options, undefined, 'native availability validation remains enabled for F2');

  const citas = wixDataMock._store.get('CitasF2') || [];
  assert.equal(citas.length, 2, 'two independent native bookings must produce two CitasF2 rows');
  const citaF1 = citas.find((item) => item.bookingType === IC.BOOKING_TYPE.DUAL_F1);
  const citaF2 = citas.find((item) => item.bookingType === IC.BOOKING_TYPE.DUAL_F2);
  assert.ok(citaF1);
  assert.ok(citaF2);
  assert.equal(citaF1.bookingId, BOOKING_F1_ID);
  assert.equal(citaF2.bookingId, BOOKING_F2_ID);
  assert.equal(citaF1.serviceId, F1_SERVICE_ID);
  assert.equal(citaF2.serviceId, F2_SERVICE_ID);
  assert.equal(citaF1.pairToken, result.data.pairToken);
  assert.equal(citaF2.pairToken, result.data.pairToken);
  assert.equal(citaF1.resourceId, RESOURCE_ID);
  assert.equal(citaF2.resourceId, RESOURCE_ID);
  assert.equal(citaF1.totalAmount, 80);
  assert.equal(citaF2.totalAmount, 0);
  assert.equal(citaF1.bookingStatus, IC.CITAS_BOOKING_STATUS.CONFIRMED);
  assert.equal(citaF2.bookingStatus, IC.CITAS_BOOKING_STATUS.CONFIRMED);
  assert.equal(cancellationCalls.length, 0);
});

test('QA-DUAL-BOOKING-02 F2 Writer failure compensates the already-created F1 booking', async () => {
  seedCatalog();
  slotsState.failAt = 2;

  const result = await executeBookingSaga(bookingPayload('trace-qa-dual-f2-failure-001'));

  assert.equal(result.status, 'ERROR');
  assert.equal(writerCalls.length, 2, 'F1 succeeds and F2 is attempted once');
  assert.equal(confirmationCalls.length, 0, 'confirmation must not run after F2 creation fails');
  assert.equal(cancellationCalls.length, 1, 'partial saga must compensate F1');
  assert.equal(cancellationCalls[0].bookingId, BOOKING_F1_ID);
  assert.equal(cancellationCalls[0].options.revision, '2', 'compensation uses the freshly-read native revision');
  assert.equal((wixDataMock._store.get('CitasF2') || []).length, 0, 'persistence is not reached when F2 Writer fails');
  assert.ok(slotsState.calls.some((call) => call.serviceId === F1_SERVICE_ID));
  assert.ok(slotsState.calls.some((call) => call.serviceId === F2_SERVICE_ID));
});

test.after(() => {
  mocks.webMethods.clear();
  mocks.sdk['bookings::staffMembers'] = {};
  mocks.sdk['@wix/bookings::bookings'] = {};
});

test('QA-DUAL-BOOKING-03 partial CitasF2 persistence marks the written projection compensated and cancels both bookings', async () => {
  seedCatalog();
  const originalInsert = wixDataMock.insert;
  let citaInsertCount = 0;
  wixDataMock.insert = async (collection, item) => {
    if (collection === 'CitasF2') {
      citaInsertCount += 1;
      if (citaInsertCount === 2) {
        throw new Error('synthetic second CitasF2 insert failure');
      }
    }
    return originalInsert(collection, item);
  };

  let result;
  try {
    result = await executeBookingSaga(bookingPayload('trace-qa-dual-cms-partial-001'));
  } finally {
    wixDataMock.insert = originalInsert;
  }

  assert.equal(result.status, 'ERROR');
  assert.equal(writerCalls.length, 2, 'both native bookings were created before CMS persistence');
  assert.equal(confirmationCalls.length, 2, 'both native bookings were confirmed before CMS persistence');
  assert.equal(cancellationCalls.length, 2, 'partial persistence must compensate both native bookings');
  assert.deepEqual(
    cancellationCalls.map((call) => call.bookingId).sort(),
    [BOOKING_F1_ID, BOOKING_F2_ID].sort()
  );

  const citas = wixDataMock._store.get('CitasF2') || [];
  assert.equal(citas.length, 1, 'the first insert remains as an auditable projection, not an active orphan');
  assert.equal(citas[0].bookingId, BOOKING_F1_ID);
  assert.equal(citas[0].bookingStatus, IC.CITAS_BOOKING_STATUS.CANCELED);
  assert.equal(citas[0].meta.compensated, true);
  assert.equal(citas[0].meta.compensationTraceId, 'trace-qa-dual-cms-partial-001');
});
