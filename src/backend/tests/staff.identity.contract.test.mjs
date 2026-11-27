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
            identificationData: { contactId: CONTACT_ID, memberId: '66666666-6666-4666-8666-666666666666' },
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
    memberId: '66666666-6666-4666-8666-666666666666',
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
          identificationData: { contactId, memberId },
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
    mocks.members._current = { _id: '99999999-9999-4999-8999-999999999999', contactId };
    const denied = await securityWeb.checkStaffCollaboratorAccess({ traceId: 'member-sdk-manager-mismatch' });
    assert.equal(denied.status, 'SUCCESS');
    assert.equal(denied.data.isMarianManager, false);
    assert.equal(denied.data.authorized, false);
  } finally {
    mocks.members._current = null;
    staff.invalidateStaffCache();
  }
});

test('STAFF-SDK-04 pagination cap never returns an apparently complete partial staff result', async () => {
  staff.invalidateStaffCache();
  let calls = 0;
  mocks.sdk['bookings::staffMembers'] = {
    queryStaffMembers: async () => {
      calls += 1;
      return {
        staffMembers: calls === 1 ? [{
          _id: STAFF_MEMBER_ID,
          resourceId: RESOURCE_ID,
          name: 'Ana',
          resource: {},
        }] : [],
        pagingMetadata: {
          hasNext: true,
          cursors: { next: 'cursor-' + calls },
        },
      };
    },
  };

  await assert.rejects(
    staff.findStaffByResourceId(RESOURCE_ID),
    { code: 'STAFF_PAGINATION_LIMIT_EXCEEDED' }
  );
  assert.equal(calls, 20);

  staff.invalidateStaffCache();
  calls = 0;
  await assert.rejects(
    staff.listStaff(),
    { code: 'STAFF_PAGINATION_LIMIT_EXCEEDED' }
  );
  assert.equal(calls, 20);
});

test('STAFF-CONFIG-01 cache limits and API timeout come only from canonical SDK_CONFIG', async () => {
  const { SDK_CONFIG } = await import('../internalConfig.js');
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../staff.js', import.meta.url), 'utf8');

  assert.deepEqual(SDK_CONFIG.CACHE, {
    STAFF_TTL_MS: 300000,
    STAFF_MAX_ENTRIES: 100,
    SERVICES_TTL_MS: 120000,
    SERVICES_MAX_ENTRIES: 500,
    DAYS_CACHE_VERSION: "v1",
  });
  assert.equal(SDK_CONFIG.TIMEOUTS.API_MS, 15000);
  assert.match(source, /const CACHE_TTL_MS = SDK_CONFIG\.CACHE\.STAFF_TTL_MS;/);
  assert.match(source, /const CACHE_MAX_ENTRIES = SDK_CONFIG\.CACHE\.STAFF_MAX_ENTRIES;/);
  assert.match(source, /const API_TIMEOUT_MS = SDK_CONFIG\.TIMEOUTS\.API_MS;/);
  assert.doesNotMatch(source, /SDK_CONFIG\?\.CACHE|SDK_CONFIG\?\.TIMEOUTS\?\.API_MS/);
});


test('STAFF-SDK-05 provider outages and malformed responses are not converted to missing staff', async () => {
  staff.invalidateStaffCache();
  mocks.sdk['bookings::staffMembers'] = {
    queryStaffMembers: async () => { throw Object.assign(new Error('network unavailable'), { code: 'ECONNRESET' }); },
  };
  await assert.rejects(
    staff.findStaffByResourceId(RESOURCE_ID),
    { code: 'STAFF_PROVIDER_UNAVAILABLE' }
  );

  staff.invalidateStaffCache();
  await assert.rejects(
    staff.listStaff(),
    { code: 'STAFF_PROVIDER_UNAVAILABLE' }
  );

  staff.invalidateStaffCache();
  mocks.sdk['bookings::staffMembers'] = {
    queryStaffMembers: async () => ({ pagingMetadata: { hasNext: false, cursors: {} } }),
  };
  await assert.rejects(
    staff.findStaffByResourceId(RESOURCE_ID),
    { code: 'STAFF_PROVIDER_RESPONSE_INVALID' }
  );
});

test('SECURITY-STAFF-01 staff provider outage propagates through authorization instead of denying as absent', async () => {
  staff.invalidateStaffCache();
  mocks.members._current = {
    _id: '66666666-6666-4666-8666-666666666666',
    contactId: CONTACT_ID,
  };
  mocks.sdk['bookings::staffMembers'] = {
    queryStaffMembers: async () => { throw Object.assign(new Error('Bookings unavailable'), { code: 'ECONNRESET' }); },
  };

  const security = await import('../security.js');
  try {
    await assert.rejects(security.isAdmin('staff-provider-outage'), {
      code: 'STAFF_PROVIDER_UNAVAILABLE',
    });
  } finally {
    mocks.members._current = null;
    staff.invalidateStaffCache();
  }
});

test('SECURITY-STAFF-02 member provider outage is distinct from an unauthenticated member', async () => {
  const security = await import('../security.js');
  mocks.members._error = new Error('Members unavailable');
  try {
    await assert.rejects(security.isAdmin('member-provider-outage'), {
      code: 'MEMBER_IDENTITY_PROVIDER_UNAVAILABLE',
    });
  } finally {
    delete mocks.members._error;
    mocks.members._current = null;
  }
});


test('STAFF-SDK-06 CRM provider errors are not converted to an unlinked contact', async () => {
  staff.invalidateStaffCache();
  mocks.sdk['crm::contactsV5'] = {
    getContact: async () => { throw Object.assign(new Error('CRM unavailable'), { code: 'ECONNRESET' }); },
  };
  await assert.rejects(
    staff.getSiteMemberIdByContactId(CONTACT_ID),
    { code: 'STAFF_PROVIDER_UNAVAILABLE' }
  );

  mocks.sdk['crm::contactsV5'] = {
    getContact: async () => null,
  };
  await assert.rejects(
    staff.getSiteMemberIdByContactId(CONTACT_ID),
    { code: 'STAFF_PROVIDER_RESPONSE_INVALID' }
  );
});


test('TIME-CLOCK-IDENTITY-01 horario uses centralized identity and preserves staff provider errors', async () => {
  staff.invalidateStaffCache();
  mocks.members._current = {
    _id: '66666666-6666-4666-8666-666666666666',
    contactId: CONTACT_ID,
  };
  mocks.sdk['bookings::staffMembers'] = {
    queryStaffMembers: async () => { throw Object.assign(new Error('Bookings unavailable'), { code: 'ECONNRESET' }); },
  };

  const horario = await import('../horario.web.js');
  try {
    const result = await horario.getMyStaffContext({ traceId: 'timeclock-staff-provider-outage' });
    assert.equal(result.status, 'ERROR');
    assert.equal(result.error.code, 'STAFF_PROVIDER_UNAVAILABLE');
  } finally {
    mocks.members._current = null;
    staff.invalidateStaffCache();
  }
});
