import test from 'node:test';
import assert from 'node:assert/strict';

const { mocks } = await import('./loader.mjs');
const staff = await import('../staff.js');

const RESOURCE_ID = '11111111-1111-4111-8111-111111111111';
const STAFF_MEMBER_ID = '22222222-2222-4222-8222-222222222222';
const CONTACT_ID = '33333333-3333-4333-8333-333333333333';
const SCHEDULE_ID = '44444444-4444-4444-8444-444444444444';

test('STAFF-SDK-01 resolves resourceId, staff _id, contactId and schedule _id from native SDK shape', async () => {
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
            workingHoursSchedules: [{ _id: SCHEDULE_ID }],
            eventsSchedule: { _id: SCHEDULE_ID },
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
    scheduleId: SCHEDULE_ID,
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].query.filter, { resourceId: { $eq: RESOURCE_ID } });
  assert.deepEqual(calls[0].options.fields, ['RESOURCE_DETAILS', 'ASSOCIATED_IDENTITY_STATUS']);

  const byContact = await staff.findStaffByContactId(CONTACT_ID);
  assert.equal(byContact.resourceId, RESOURCE_ID);
  assert.equal(byContact.staffMemberId, STAFF_MEMBER_ID);
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
