import test from 'node:test';
import assert from 'node:assert/strict';

const { mocks } = await import('./loader.mjs');
const staff = await import('../staff.js');

const RESOURCE_ID = '11111111-1111-4111-8111-111111111111';
const STAFF_MEMBER_ID = '22222222-2222-4222-8222-222222222222';
const CONTACT_ID = '33333333-3333-4333-8333-333333333333';
const WORKING_HOURS_SCHEDULE_ID = '44444444-4444-4444-8444-444444444444';
const EVENTS_SCHEDULE_ID = '55555555-5555-4555-8555-555555555555';

test('STAFF-SDK-01 separates working-hours schedule IDs from the staff events schedule ID', async () => {
  staff.invalidateStaffCache();
  const calls = [];
  mocks.sdk['bookings::staffMembers'] = {
    queryStaffMembers: async (query, options) => {
      calls.push({ query, options });
      return {
        staffMembers: [{
          _id: STAFF_MEMBER_ID,
          resourceId: RESOURCE_ID,
          name: 'Ana',
          serviceProvider: true,
          resource: {
            _id: RESOURCE_ID,
            workingHoursSchedules: [{ _id: WORKING_HOURS_SCHEDULE_ID }],
            eventsSchedule: { _id: EVENTS_SCHEDULE_ID },
          },
          associatedWixIdentity: {
            identificationData: { contactId: CONTACT_ID },
            connection: { status: 'CONNECTED' },
          },
        }],
        pagingMetadata: { hasNext: false, cursors: {} },
      };
    },
  };

  const byResource = await staff.findStaffByResourceId(RESOURCE_ID);
  assert.deepEqual(byResource, {
    staffMemberId: STAFF_MEMBER_ID,
    resourceId: RESOURCE_ID,
    contactId: CONTACT_ID,
    displayName: 'Ana',
    roleWebsite: '',
    workingHoursScheduleIds: [WORKING_HOURS_SCHEDULE_ID],
    workingHoursScheduleId: WORKING_HOURS_SCHEDULE_ID,
    eventsScheduleId: EVENTS_SCHEDULE_ID,
    scheduleId: EVENTS_SCHEDULE_ID,
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].query.filter, { resourceId: { $eq: RESOURCE_ID } });
  assert.deepEqual(calls[0].options.fields, ['RESOURCE_DETAILS', 'ASSOCIATED_IDENTITY_STATUS']);

  const byContact = await staff.findStaffByContactId(CONTACT_ID);
  assert.equal(byContact.resourceId, RESOURCE_ID);
  assert.equal(byContact.staffMemberId, STAFF_MEMBER_ID);
  assert.equal(await staff.getStaffEventsScheduleId(RESOURCE_ID), EVENTS_SCHEDULE_ID);
});

test('STAFF-SDK-03 missing events schedule fails closed instead of using working-hours schedule', async () => {
  staff.invalidateStaffCache();
  mocks.sdk['bookings::staffMembers'] = {
    queryStaffMembers: async () => ({
      staffMembers: [{
        _id: STAFF_MEMBER_ID,
        resourceId: RESOURCE_ID,
        name: 'Ana',
        resource: {
          workingHoursSchedules: [{ _id: WORKING_HOURS_SCHEDULE_ID }],
        },
      }],
      pagingMetadata: { hasNext: false, cursors: {} },
    }),
  };

  const result = await staff.findStaffByResourceId(RESOURCE_ID);
  assert.equal(result.workingHoursScheduleId, WORKING_HOURS_SCHEDULE_ID);
  assert.equal(result.eventsScheduleId, '');
  assert.equal(result.scheduleId, '');
  assert.equal(await staff.getStaffEventsScheduleId(RESOURCE_ID), null);
});

test('STAFF-SDK-02 disconnected staff identity never exposes a Contact ID', async () => {
  staff.invalidateStaffCache();
  mocks.sdk['bookings::staffMembers'] = {
    queryStaffMembers: async () => ({
      staffMembers: [{
        _id: STAFF_MEMBER_ID,
        resourceId: RESOURCE_ID,
        name: 'Ana',
        associatedWixIdentity: {
          identificationData: { contactId: CONTACT_ID },
          connection: { status: 'DISCONNECTED' },
        },
      }],
      pagingMetadata: { hasNext: false, cursors: {} },
    }),
  };

  const result = await staff.findStaffByResourceId(RESOURCE_ID);
  assert.equal(result.contactId, '');
});


test('SECWEB-MEMBER-01 manager identity matches canonical Wix contactId and fails closed on mismatch', async () => {
  const { STAFF } = await import('../internalConfig.js');
  const memberId = '55555555-5555-4555-8555-555555555555';
  const contactId = '66666666-6666-4666-8666-666666666666';
  const resourceId = STAFF.IDS[0];
  staff.invalidateStaffCache();
  mocks.members._current = { _id: memberId, contactId };

  mocks.sdk['bookings::staffMembers'] = {
    queryStaffMembers: async (query = {}) => {
      const requested = query?.filter?.resourceId?.$eq || '';
      const rows = [{
        _id: '77777777-7777-4777-8777-777777777777',
        resourceId,
        name: 'Marian',
        resource: { workingHoursSchedules: [], eventsSchedule: {} },
        associatedWixIdentity: {
          identificationData: { contactId },
          connection: { status: 'CONNECTED' },
        },
      }];
      return {
        staffMembers: requested && requested !== resourceId ? [] : rows,
        pagingMetadata: { hasNext: false, cursors: {} },
      };
    },
  };

  const securityWeb = await import('../security.web.js');
  try {
    const result = await securityWeb.checkStaffCollaboratorAccess({ traceId: 'member-sdk-manager-match' });
    assert.equal(result.status, 'SUCCESS');
    assert.equal(result.data.isMarianManager, true);
    assert.equal(result.data.isAdmin, true);

    staff.invalidateStaffCache();
    mocks.members._current = { _id: memberId, contactId: '88888888-8888-4888-8888-888888888888' };
    const denied = await securityWeb.checkStaffCollaboratorAccess({ traceId: 'member-sdk-manager-mismatch' });
    assert.equal(denied.status, 'SUCCESS');
    assert.equal(denied.data.isMarianManager, false);
    assert.equal(denied.data.authorized, false);
  } finally {
    mocks.members._current = null;
    staff.invalidateStaffCache();
  }
});
