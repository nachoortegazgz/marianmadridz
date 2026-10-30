/*
=============================================================================
SUITE: reservas.web.js v10 (FASE5, bateria offline)
Purpose: coverage of the availability engine public surface with REAL module
  code (no reimplementation): service catalog mapping (_mapServiceImport2ToUX),
  slug/GUID resolution (_getServiceBySlugOrIdInternal / _resolveServiceIdInternal),
  RAM cache + cycle guard (C4), DTO minimization (RES-23/C10), hidden-service
  rejection at entry points (C9), canonical add-on contract (SAGA-23), staff
  display names (MapaStaff + RES-15 legacy fallback), load-balanced ranking
  (RES-16/17), certified dual slots via mocked Bookings Writer V2
  (availabilityTimeSlots), exact-slot staff resolution for bookingSaga
  (RES-12 contract), DAYS_CACHE persistence (PEND-09/RES-18) and cache
  invalidation (C2 pagination).
Harness notes:
  - LH-09: overrides for 'mock:@wix/bookings::availabilityTimeSlots' MUST be
    registered BEFORE importing reservas.web.js so the ESM binding captures
    the test function (dynamic named-import returns the live namespace).
  - Module-level Maps (serviceCatalogRAM / availabilityCache) persist across
    tests in the same process; fixtures are keyed by unique GUIDs per test to
    avoid cross-contamination.
Runs offline via tests/loader.mjs. G10 ASCII strict.
=============================================================================
*/
import test from 'node:test';
import assert from 'node:assert';

const { wixDataMock, mocks } = await import('./loader.mjs');
const IC = await import('backend/internalConfig.js');

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

const SVC_COL = 'ServiciosCatalogo';
const CITAS_COL = 'CitasF2';
const CONTROL_COL = 'ControlOperativo';

// Staff fixtures follow the native Wix Bookings Staff Members response.
const _apiStaff = new Map(); // resourceId -> seed record
function _toStaffMember(record) {
  const resourceId = String(record.resourceId || record.id || '');
  const scheduleId = String(record.scheduleId || '');
  const memberId = String(record.memberId || record.userId || '');
  const resource = {
    id: resourceId,
    workingHoursSchedules: scheduleId ? [{ id: scheduleId }] : [],
    ...(scheduleId ? { eventsSchedule: { id: scheduleId } } : {}),
  };
  const identityId = {};
  if (memberId) identityId.memberId = memberId;
  if (record.wixUserId) identityId.wixUserId = String(record.wixUserId);
  return {
    id: String(record.staffMemberId || guid()),
    resourceId,
    name: String(record.name || record.displayName || ''),
    email: String(record.email || ''),
    serviceProvider: true,
    resource,
    associatedWixIdentity: {
      identificationData: { id: identityId },
      connection: { status: memberId ? 'CONNECTED' : 'UNKNOWN' },
    },
    role: String(record.role || ''), // Test-only field for role consumers outside Layer 1.
  };
}
function seedStaffApi(records) {
  for (const record of records) {
    _apiStaff.set(String(record.resourceId || record.id), record);
  }
  mocks.sdk['bookings::staffMembers'] = {
    queryStaffMembers: async (query = {}) => {
      const members = [..._apiStaff.values()].map(_toStaffMember);
      const rawFilter = query?.filter?.resourceId;
      const requestedResourceId = rawFilter && typeof rawFilter === 'object'
        ? String(rawFilter.$eq || '')
        : String(rawFilter || '');
      const filtered = requestedResourceId
        ? members.filter((member) => member.resourceId === requestedResourceId)
        : members;
      return {
        staffMembers: filtered.slice(0, query?.cursorPaging?.limit || 100),
        pagingMetadata: { hasNext: false, cursors: {} },
      };
    },
  };
}
async function invalidateStaffCache() {
  const st = await import('backend/staff.js');
  if (typeof st.invalidateStaffCache === 'function') st.invalidateStaffCache();
}

const STAFF_TYPE = '1cd44cf8-756f-41c3-bd90-3e2ffcaf1155'; // internalConfig API

let seq = 0;
function guid() {
  seq += 1;
  const h = String(seq).padStart(8, '0');
  return `${h}-${h.slice(0, 4)}-4${h.slice(4, 7)}-8${h.slice(0, 3)}-${h}${h}${h}abcdef`.slice(0, 36);
}

// Slots API mock state (LH-09 override, mutable per test)
const slotsState = {
  responses: new Map(), // serviceId -> array of raw timeSlots
  calls: [],            // payload audit trail
};

const nativeBookingsState = { bookings: [], error: null, calls: [] };

async function listAvailability(payload) {
  slotsState.calls.push(payload);
  const svc = String(payload.serviceId);
  // Writer V2 semantics: a slot survives the resourceTypes filter when it
  // has NO staff-resource group at all (unrestricted/fallback slots, e.g.
  // location-based availability) OR when at least one of its staff resources
  // is in the requested set. Groups of OTHER resource types never qualify.
  let slots = (slotsState.responses.get(svc) || []).slice();
  const reqRes = payload.resourceTypes?.[0]?.resourceIds;
  if (Array.isArray(reqRes) && reqRes.length) {
    slots = slots.filter((s) => {
      const groups = (s.availableResources || []).filter((g) => g.resourceTypeId === STAFF_TYPE);
      if (groups.length === 0) return true;
      const ids = groups.flatMap((g) => (g.resources || []).map((r) => String(r.id ?? r)));
      return reqRes.some((rid) => ids.includes(String(rid)));
    });
  }
  return { timeSlots: slots };
}

function availSlot(startLocal, endLocal, staffIds) {
  return {
    localStartDate: startLocal,
    localEndDate: endLocal,
    bookable: true,
    availableResources: [
      { resourceTypeId: STAFF_TYPE, resources: staffIds.map((id) => ({ id })) },
    ],
  };
}

// Register the @wix/bookings override BEFORE importing the module under test.
// LH-10: namespace members are keyed MODULE_KEY::rootName::member so the
// stub's availabilityTimeSlots Proxy delegates to the live test function.
mocks.webMethods.register('@wix/bookings', 'availabilityTimeSlots::listAvailabilityTimeSlots',
  async (payload) => listAvailability(payload));
mocks.webMethods.register('@wix/bookings', 'extendedBookings::queryExtendedBookings',
  async (query, options) => {
    nativeBookingsState.calls.push({ query, options });
    if (nativeBookingsState.error) throw nativeBookingsState.error;
    return {
      extendedBookings: nativeBookingsState.bookings.map((booking) => ({ booking })),
      pagingMetadata: { cursors: {} },
    };
  });

const RW = await import('backend/reservas.web.js');

function resetState() {
  wixDataMock._reset();
  slotsState.responses.clear();
  slotsState.calls.length = 0;
  nativeBookingsState.bookings = [];
  nativeBookingsState.error = null;
  nativeBookingsState.calls.length = 0;
}

function seedService(row) {
  const rows = wixDataMock._store.get(SVC_COL) || [];
  rows.push({ _id: row.serviceId, ...row });
  wixDataMock._store.set(SVC_COL, rows);
  return row;
}

function baseServiceRow(over = {}) {
  return {
    serviceId: guid(),
    slug: null,
    title: 'Peluqueria',
    tagLine: null,
    description: null,
    price: 60,
    currency: 'EUR',
    location: 'Zaragoza',
    locationId: guid(),
    mainMedia: null,
    totalDuration: 90,
    phase1Duration: 60,
    phase2Duration: 0,
    exposureDuration: 0,
    allowCombine: false,
    linkedPhases: null,
    clientHidden: false,
    addOnOptions: [],
    onlinePayment: true,
    inPersonPayment: true,
    ...over,
  };
}

function basePricingPlanRow(over = {}) {
  return {
    _id: guid(),
    catalogEntryType: 'PRICING_PLAN',
    pricingPlanId: guid(),
    sessionCount: 5,
    slug: 'plan-rayos-v-' + seq,
    title: 'Rayos V — Plan 5 sesiones',
    description: 'Cinco sesiones presenciales de Rayos V.',
    tagLine: 'Cinco sesiones de Rayos V',
    price: 75,
    currency: 'EUR',
    location: 'Zaragoza',
    mainMedia: null,
    recomendaciones: ['Acudir con la piel limpia.'],
    clientHidden: false,
    allowCombine: false,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// CATALOG MAPPING (_mapServiceImport2ToUX)
// ---------------------------------------------------------------------------

test('RES-MAP-01 simple service maps canonical keys and durations', async () => {
  resetState();
  await invalidateStaffCache();
  // Sin totalDuration almacenado, una fase simple deriva la duración de phase1Duration.
  // El fallback de 30 minutos solo aplica cuando no hay duración positiva.
  const row = baseServiceRow({ totalDuration: 0 });
  seedService(row);
  const mapped = await RW._mapServiceImport2ToUX(row);
  assert.strictEqual(mapped.serviceId, row.serviceId);
  assert.strictEqual(mapped.title, 'Peluqueria');
  assert.strictEqual(mapped.price, 60);
  assert.strictEqual(mapped.currency, 'EUR');
  assert.strictEqual(mapped.totalDuration, 60, 'simple => phase1 only (stored 0)');
  assert.strictEqual(mapped.allowCombine, false);
  assert.strictEqual(mapped.linkedPhases, null);
  assert.ok(!('availableStaff' in mapped));
  assert.ok(!('staffOptions' in mapped));
  assert.ok(!('status' in mapped));
  assert.strictEqual(mapped.locationId, row.locationId, 'locationId es texto en CMS');
});

test('RES-MAP-01B preserves a native 20-minute service duration', async () => {
  resetState();
  await invalidateStaffCache();
  const row = baseServiceRow({
    totalDuration: 20,
    phase1Duration: 20,
    phase2Duration: 0,
    exposureDuration: 0,
  });
  seedService(row);
  const mapped = await RW._mapServiceImport2ToUX(row);
  assert.strictEqual(mapped.totalDuration, 20, 'never inflate a valid native duration to 30 minutes');
});

test('RES-MAP-01C uses the 30-minute fallback only when duration data is absent', async () => {
  resetState();
  await invalidateStaffCache();
  const row = baseServiceRow({
    totalDuration: 0,
    phase1Duration: 0,
    phase2Duration: 0,
    exposureDuration: 0,
  });
  seedService(row);
  const mapped = await RW._mapServiceImport2ToUX(row);
  assert.strictEqual(mapped.totalDuration, 30, 'fallback applies only when no positive duration exists');
});

test('RES-MAP-02 dual service computes total=p1+exp+p2 and keeps linkedPhases', async () => {
  resetState();
  await invalidateStaffCache();
  const linked = guid();
  const row = baseServiceRow({
    allowCombine: true,
    linkedPhases: linked,
    phase1Duration: 60,
    exposureDuration: 15,
    phase2Duration: 30,
    totalDuration: 0,
  });
  seedService(row);
  seedService(baseServiceRow({ serviceId: linked, clientHidden: true, allowCombine: false }));
  const mapped = await RW._mapServiceImport2ToUX(row);
  assert.strictEqual(mapped.allowCombine, true);
  assert.strictEqual(mapped.totalDuration, 105, '60+15+30');
  assert.strictEqual(mapped.linkedPhases, linked);
});

test('RES-MAP-03 C9 semantic: hidden parent never dual-reservable (allowCombine=false)', async () => {
  resetState();
  await invalidateStaffCache();
  const linked = guid();
  seedService(baseServiceRow({ serviceId: linked }));
  const row = baseServiceRow({ allowCombine: true, linkedPhases: linked, clientHidden: true });
  seedService(row);
  const mapped = await RW._mapServiceImport2ToUX(row);
  assert.strictEqual(mapped.clientHidden, true);
  assert.strictEqual(mapped.allowCombine, false, 'hidden => not dual');
  assert.strictEqual(mapped.linkedPhases, null);
});

test('RES-MAP-04 fail-closed: missing/non-GUID serviceId throws', async () => {
  resetState();
  await invalidateStaffCache();
  await assert.rejects(
    () => RW._mapServiceImport2ToUX({ serviceId: 'not-a-guid', title: 'X' }),
    /serviceId missing or not a GUID/,
  );
});

test('RES-MAP-05 fail-closed: allowCombine without GUID linkedPhases throws', async () => {
  resetState();
  await invalidateStaffCache();
  await assert.rejects(
    () => RW._mapServiceImport2ToUX(baseServiceRow({ allowCombine: true, linkedPhases: 'slug-f2' })),
    /linkedPhases missing or not a GUID/,
  );
});

test('RES-MAP-06 fail-closed: allowCombine with unresolvable linked service throws', async () => {
  resetState();
  await invalidateStaffCache();
  const row = baseServiceRow({ allowCombine: true, linkedPhases: guid() });
  seedService(row); // linked NOT seeded
  await assert.rejects(
    () => RW._mapServiceImport2ToUX(row),
    /linked service unavailable or unresolvable/,
  );
});

test('RES-MAP-07 RES-14: hidden F2 linked child is accepted (design of 24 F2)', async () => {
  resetState();
  await invalidateStaffCache();
  const f2 = guid();
  seedService(baseServiceRow({ serviceId: f2, clientHidden: true }));
  const row = baseServiceRow({ allowCombine: true, linkedPhases: f2 });
  seedService(row);
  const mapped = await RW._mapServiceImport2ToUX(row);
  assert.strictEqual(mapped.allowCombine, true);
});

test('RES-MAP-08 service DTO has no catalog staff/status fields', async () => {
  resetState();
  const row = baseServiceRow();
  seedService(row);
  const mapped = await RW._mapServiceImport2ToUX(row);
  assert.ok(!('availableStaff' in mapped));
  assert.ok(!('staffOptions' in mapped));
  assert.ok(!('status' in mapped));
});

test('RES-MAP-09 addOnOptions canonical addonId, non-GUID silently dropped', async () => {
  resetState();
  await invalidateStaffCache();
  const a1 = guid();
  const row = baseServiceRow({
    addOnOptions: [
      { addonId: a1, name: 'Barba', price: 10 },
      { addonId: 'not-a-guid', name: 'Basura', price: 5 },
    ],
  });
  seedService(row);
  const mapped = await RW._mapServiceImport2ToUX(row);
  assert.strictEqual(mapped.addOnOptions.length, 1);
  assert.strictEqual(mapped.addOnOptions[0].addonId, a1);
  assert.strictEqual(mapped.addOnOptions[0].price, 10);
});

test('RES-MAP-10 RES-22: mainMedia tolerant to string URL and Image object', async () => {
  resetState();
  await invalidateStaffCache();
  const s1 = baseServiceRow({ mainMedia: 'https://cdn.example/img.jpg' });
  const m1 = await RW._mapServiceImport2ToUX(s1);
  assert.match(String(m1.mainMedia), /img\.jpg/);
  const s2 = baseServiceRow({ mainMedia: { url: 'https://cdn.example/obj.png' } });
  const m2 = await RW._mapServiceImport2ToUX(s2);
  assert.match(String(m2.mainMedia), /obj\.png/);
});

// ---------------------------------------------------------------------------
// LOOKUP / RESOLUTION / CACHE / CYCLE GUARD
// ---------------------------------------------------------------------------

// v10.6 (ADR-01 RESUELTA): el DTO publico del widget AHORA expone
// linkedPhases (normalizado a GUID valido o null) y clientHidden (booleano).
// Ambos son CRITICOS para reservas duales y ocultacion de servicios.
// La lista de claves prohibidas (RES-23) se mantiene para los internos reales:
// availableStaff, staffOptions y status siguen sin salir al cliente.
test('RES-LOOK-01 slug lookup SUCCESS + DTO contract v10.6 (RES-23 + RES-P1-02)', async () => {
  resetState();
  await invalidateStaffCache();
  const row = baseServiceRow({ slug: 'corte-hombre-' + seq });
  seedService(row);
  const res = await RW.getServiceBySlugOrId(row.slug);
  assert.strictEqual(res.status, 'SUCCESS');
  // Internos prohibidos: nunca deben exponerse.
  for (const banned of ['availableStaff', 'staffOptions', 'status']) {
    assert.ok(!(banned in res.data), `DTO must not expose ${banned}`);
  }
  // Publicos obligatorios v10.6: presentes y normalizados.
  assert.ok('linkedPhases' in res.data, 'DTO must expose linkedPhases');
  assert.ok('clientHidden' in res.data, 'DTO must expose clientHidden');
  assert.strictEqual(typeof res.data.clientHidden, 'boolean');
  assert.strictEqual(
    res.data.linkedPhases,
    null,
    'non-GUID linkedPhases must normalize to null'
  );
  assert.strictEqual(res.data.serviceId, row.serviceId);
});

test('RES-LOOK-01B dual service: linkedPhases GUID preserved end-to-end (v10.6)', async () => {
  resetState();
  await invalidateStaffCache();
  // Parent dual valido: F2 debe existir y resolverse (regla C4/allowCombine).
  const f2 = baseServiceRow({ slug: 'dual-fase2-' + seq });
  seedService(f2);
  const row = baseServiceRow({
    slug: 'dual-public-' + seq,
    allowCombine: true,
    linkedPhases: f2.serviceId,
  });
  seedService(row);
  const res = await RW.getServiceBySlugOrId(row.slug);
  assert.strictEqual(res.status, 'SUCCESS');
  assert.strictEqual(res.data.linkedPhases, f2.serviceId, 'dual GUID must survive DTO');
  assert.strictEqual(res.data.clientHidden, false);
});

test('RES-PLAN-01 native Pricing Plan maps to a purchasable catalog entry, never a Bookings service', async () => {
  resetState();
  await invalidateStaffCache();
  const row = basePricingPlanRow({ slug: 'rayos-v-plan-5-sesiones-' + seq });
  seedService(row);

  const internal = await RW._getServiceBySlugOrIdInternal(row.slug);
  assert.strictEqual(internal.status, 'SUCCESS');
  assert.strictEqual(internal.data.catalogEntryType, 'PRICING_PLAN');
  assert.strictEqual(internal.data.pricingPlanId, row.pricingPlanId);
  assert.strictEqual(internal.data.sessionCount, 5);
  assert.strictEqual(internal.data.price, 75);
  assert.strictEqual(internal.data.currency, 'EUR');
  assert.strictEqual(internal.data.primaryActionLabel, 'Comprar bono');
  assert.strictEqual(internal.data.allowCombine, false);
  assert.ok(!Object.prototype.hasOwnProperty.call(internal.data, 'serviceId'));

  const publicResult = await RW.getServiceBySlugOrId(row.slug);
  assert.strictEqual(publicResult.status, 'SUCCESS');
  assert.strictEqual(publicResult.data.catalogEntryType, 'PRICING_PLAN');
  assert.strictEqual(publicResult.data.pricingPlanId, row.pricingPlanId);
  assert.ok(!Object.prototype.hasOwnProperty.call(publicResult.data, 'serviceId'));
  assert.strictEqual(await RW._resolveServiceIdInternal(row.slug), null,
    'pricing plan slug must never resolve as an appointment service');
});

test('RES-PLAN-02 hidden native Pricing Plan is not exposed to anonymous catalog lookup', async () => {
  resetState();
  await invalidateStaffCache();
  const row = basePricingPlanRow({
    slug: 'hidden-rayos-plan-' + seq,
    clientHidden: true,
  });
  seedService(row);

  const result = await RW.getServiceBySlugOrId(row.slug);
  assert.strictEqual(result.status, 'ERROR');
  assert.strictEqual(result.error.code, 'SERVICE_NOT_AVAILABLE');
  assert.strictEqual(result.data, null);
});

test('RES-PLAN-03 invalid native plan ID or session count fails closed', async () => {
  resetState();
  await invalidateStaffCache();
  const badPlanId = basePricingPlanRow({
    slug: 'bad-plan-id-' + seq,
    pricingPlanId: 'not-a-guid',
  });
  const badSessionCount = basePricingPlanRow({
    slug: 'bad-session-count-' + seq,
    sessionCount: 0,
  });
  seedService(badPlanId);
  seedService(badSessionCount);

  const invalidIdResult = await RW.getServiceBySlugOrId(badPlanId.slug);
  const invalidCountResult = await RW.getServiceBySlugOrId(badSessionCount.slug);
  assert.strictEqual(invalidIdResult.status, 'ERROR');
  assert.strictEqual(invalidCountResult.status, 'ERROR');
  assert.strictEqual(invalidIdResult.data, null);
  assert.strictEqual(invalidCountResult.data, null);
});

test('RES-LINK-CYCLE-02 indirect A-to-B-to-A dual configuration fails closed', async () => {
  resetState();
  await invalidateStaffCache();
  const idA = guid();
  const idB = guid();
  const rowA = baseServiceRow({
    serviceId: idA,
    slug: 'cycle-a-' + seq,
    allowCombine: true,
    linkedPhases: idB,
    phase1Duration: 30,
    exposureDuration: 0,
    phase2Duration: 30,
    totalDuration: 60,
  });
  const rowB = baseServiceRow({
    serviceId: idB,
    slug: 'cycle-b-' + seq,
    allowCombine: true,
    linkedPhases: idA,
    phase1Duration: 30,
    exposureDuration: 0,
    phase2Duration: 30,
    totalDuration: 60,
  });
  seedService(rowA);
  seedService(rowB);

  const result = await RW.getServiceBySlugOrId(rowA.slug);
  assert.strictEqual(result.status, 'ERROR');
  assert.strictEqual(result.data, null);
});

test('RES-LOOK-02 unknown slug -> SERVICE_NOT_FOUND', async () => {
  resetState();
  await invalidateStaffCache();
  const res = await RW.getServiceBySlugOrId('no-existe-' + seq);
  assert.strictEqual(res.status, 'ERROR');
  assert.strictEqual(res.error.code, 'SERVICE_NOT_FOUND');
});

test('RES-LOOK-03 C9 entry point: hidden parent rejected as SERVICE_NOT_AVAILABLE', async () => {
  resetState();
  await invalidateStaffCache();
  const row = baseServiceRow({ slug: 'oculto-' + seq, clientHidden: true });
  seedService(row);
  const res = await RW.getServiceBySlugOrId(row.slug);
  assert.strictEqual(res.status, 'ERROR');
  assert.strictEqual(res.error.code, 'SERVICE_NOT_AVAILABLE');
});

test('RES-LOOK-04 C4 cycle guard: A->B->A yields SERVICE_LINK_CYCLE', async () => {
  resetState();
  await invalidateStaffCache();
  const a = guid();
  const b = guid();
  // Self-linked dual service: visiting A again inside its own mapping.
  const rowA = baseServiceRow({ serviceId: a, slug: null, allowCombine: true, linkedPhases: a });
  seedService(rowA);
  const res = await RW._getServiceBySlugOrIdInternal(a, null, new Set([String(a).toLowerCase()]));
  assert.strictEqual(res.status, 'ERROR');
  assert.strictEqual(res.error.code, 'SERVICE_LINK_CYCLE');
  void b;
});

test('RES-LOOK-05 _resolveServiceIdInternal: GUID passthrough, slug resolves, junk null', async () => {
  resetState();
  await invalidateStaffCache();
  const row = baseServiceRow({ slug: 'resolver-' + seq });
  seedService(row);
  assert.strictEqual(await RW._resolveServiceIdInternal(row.serviceId), row.serviceId);
  assert.strictEqual(await RW._resolveServiceIdInternal(row.slug), row.serviceId);
  assert.strictEqual(await RW._resolveServiceIdInternal(''), null);
  assert.strictEqual(await RW._resolveServiceIdInternal('inexistent-' + seq), null);
});

test('RES-LOOK-06 resolveServiceId webMethod envelope contract', async () => {
  resetState();
  await invalidateStaffCache();
  const row = baseServiceRow({ slug: 'wm-resolver-' + seq });
  seedService(row);
  const ok = await RW.resolveServiceId(row.slug);
  assert.strictEqual(ok.status, 'SUCCESS');
  assert.strictEqual(ok.data, row.serviceId);
  const bad = await RW.resolveServiceId('nadie-' + seq);
  assert.strictEqual(bad.status, 'ERROR');
  assert.strictEqual(bad.error.code, 'SERVICE_NOT_FOUND');
});

test('RES-LOOK-07 RAM cache hit: second lookup skips DB query (cache observability)', async () => {
  resetState();
  await invalidateStaffCache();
  const row = baseServiceRow({ slug: 'cached-' + seq });
  seedService(row);
  const before = wixDataMock._calls.length;
  const r1 = await RW._getServiceBySlugOrIdInternal(row.slug);
  assert.strictEqual(r1.status, 'SUCCESS');
  const mid = wixDataMock._calls.length;
  assert.ok(mid > before, 'first lookup queries DB');
  const r2 = await RW._getServiceBySlugOrIdInternal(row.slug);
  assert.strictEqual(r2.status, 'SUCCESS');
  assert.strictEqual(wixDataMock._calls.length, mid, 'second lookup served from RAM cache');
});

// ---------------------------------------------------------------------------
// TO-PUBLIC DTO (pure)
// ---------------------------------------------------------------------------

test('RES-DTO-01 _toPublicService uses explicit public allowlist and strips internal CMS fields', () => {
  const GID = '9f8e7d6c-5b4a-3210-fedc-ba9876543210';
  const addonId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const pub = RW._toPublicService({
    serviceId: GID, slug: 'corte', linkedPhases: 'y', clientHidden: true,
    availableStaff: ['z'], staffOptions: [{ secret: true }], status: 'ACTIVE',
    title: 'T', description: 'Public description', tagLine: 'Public line',
    location: 'Zaragoza', price: 25, currency: 'EUR', totalDuration: 30,
    margin: 90, precioCosteBase: 4, internalNotes: 'CONFIDENTIAL',
    ownerEmail: 'private@example.com', arbitraryPrivateField: 'private',
    addOnOptions: [
      { addonId, name: 'Mascarilla', price: 5, internalNotes: 'PRIVATE', margin: 4 },
      { addonId: 'not-a-guid', name: 'Invalid', price: 1 },
    ],
    recommendations: ['Public tip', { internalNotes: 'PRIVATE' }],
  });
  assert.deepStrictEqual(
    Object.keys(pub).sort(),
    [
      'addOnOptions', 'allowCombine', 'catalogEntryType', 'clientHidden',
      'currency', 'description', 'exposureDuration', 'linkedPhases',
      'location', 'mainMedia', 'phase1Duration', 'phase2Duration',
      'price', 'primaryActionLabel', 'recommendations',
      'serviceId', 'slug', 'tagLine', 'title', 'totalDuration',
    ].sort()
  );
  assert.strictEqual(pub.linkedPhases, null);
  assert.strictEqual(pub.clientHidden, true);
  assert.strictEqual(pub.serviceId, GID);
  assert.deepStrictEqual(pub.addOnOptions, [{ addonId, name: 'Mascarilla', price: 5 }]);
  assert.deepStrictEqual(pub.recommendations, ['Public tip']);
  for (const key of ['margin', 'precioCosteBase', 'internalNotes', 'ownerEmail', 'arbitraryPrivateField', 'availableStaff', 'staffOptions', 'status']) {
    assert.ok(!(key in pub), key + ' must never be exposed');
  }

  const dual = RW._toPublicService({
    serviceId: GID, title: 'D', linkedPhases: GID, staffOptions: [{ x: 1 }],
  });
  assert.strictEqual(dual.linkedPhases, GID);
  assert.strictEqual(dual.clientHidden, false);
  assert.ok(!('staffOptions' in dual), 'staffOptions must be stripped');

  assert.strictEqual(RW._toPublicService(null), null);
  assert.strictEqual(RW._toPublicService(undefined), null);
  assert.strictEqual(RW._toPublicService('junk'), null);
});

// ---------------------------------------------------------------------------
// ADDON CONTEXT (public export of internal resolver)
// ---------------------------------------------------------------------------

test('RES-ADDON-01 valid addon kept, unknown/non-GUID dropped', async () => {
  resetState();
  await invalidateStaffCache();
  const a1 = guid();
  const a2 = guid();
  const service = { addOnOptions: [{ addonId: a1, name: 'A1', price: 10 }] };
  const ctx = await RW._resolveAddonContextPublic(service, [a1, a2, 'junk', null]);
  assert.ok(ctx, 'context returned');
  const native = (ctx.nativeAddonIds || []).map(String);
  assert.ok(native.includes(a1), 'catalog addon accepted');
  assert.ok(!native.includes(a2), 'unknown addon rejected');
});

// ---------------------------------------------------------------------------
// STAFF DISPLAY NAME
// ---------------------------------------------------------------------------

test('RES-STAFF-01 MapaStaff displayName resolved; non-GUID falls back default', async () => {
  resetState();
  await invalidateStaffCache();
  const st = guid();
  seedStaffApi([{ id: st, name: 'Marta', role: 'STYLIST' }]);
  assert.strictEqual(await RW._getStaffDisplayNamePublic(st), 'Marta');
  // SSOT internalConfig.STAFF_DEFAULT_NAME (RES-24/PEND-06): no 'Equipo'.
  // El fallback generico es la constante SSOT ("STAFF"), no una identidad
  // hardcodeada: "Marian Madrid" era un rastro de legacy que filtraba la
  // identidad de la propietaria en slots sin resolver.
  assert.strictEqual(await RW._getStaffDisplayNamePublic('no-guid'), IC.STAFF_DEFAULT_NAME);
});

// ---------------------------------------------------------------------------
// CERTIFIED DUAL SLOTS (engine + mocked Writer V2)
// ---------------------------------------------------------------------------

test('RES-DUAL-01 invalid dateYMD -> INVALID_PARAMS (no SDK call)', async () => {
  resetState();
  await invalidateStaffCache();
  const res = await RW._getCertifiedDualSlotsInternal(guid(), '', '2026-13-45');
  assert.strictEqual(res.status, 'ERROR');
  assert.strictEqual(res.error.code, 'INVALID_PARAMS');
  assert.strictEqual(slotsState.calls.length, 0);
});

test('RES-DUAL-02 non-GUID resourceId -> INVALID_RESOURCE_ID (C3)', async () => {
  resetState();
  await invalidateStaffCache();
  const row = baseServiceRow();
  seedService(row);
  const res = await RW._getCertifiedDualSlotsInternal(row.serviceId, 'staff-name', '2026-10-20');
  assert.strictEqual(res.status, 'ERROR');
  assert.strictEqual(res.error.code, 'INVALID_RESOURCE_ID');
});

test('RES-DUAL-03 simple service -> slotF2 null entries with candidates + pairToken', async () => {
  resetState();
  await invalidateStaffCache();
  const st1 = guid();
  const row = baseServiceRow({ });
  seedService(row);
  seedStaffApi([{ id: st1, name: 'Ana', role: 'STYLIST' }]);
  slotsState.responses.set(row.serviceId, [availSlot('2026-10-20T09:00:00', '2026-10-20T10:00:00', [st1])]);
  const res = await RW._getCertifiedDualSlotsInternal(row.serviceId, '', '2026-10-20');
  assert.strictEqual(res.status, 'SUCCESS');
  assert.strictEqual(res.data.length, 1);
  const pair = res.data[0];
  assert.strictEqual(pair.slotF2, null);
  assert.strictEqual(pair.slotF1.localStartDate, '2026-10-20T09:00:00');
  assert.ok(pair.pairToken, 'pairToken present');
  assert.deepStrictEqual(pair.candidateResourceIds, [st1]);
  assert.strictEqual(pair.serviceId, row.serviceId);
});

test('RES-DUAL-04 dual pair: exact exposure gap, same staff, DUAL_CACHE persisted (RES-18)', async () => {
  resetState();
  await invalidateStaffCache();
  const st1 = guid();
  const f2 = guid();
  const row = baseServiceRow({
    allowCombine: true, linkedPhases: f2,
    exposureDuration: 10, phase2Duration: 30,
  });
  seedService(row);
  seedService(baseServiceRow({ serviceId: f2, clientHidden: true }));
  seedStaffApi([{ id: st1, name: 'Ana', role: 'STYLIST' }]);
  slotsState.responses.set(row.serviceId, [availSlot('2026-10-20T09:00:00', '2026-10-20T10:00:00', [st1])]);
  slotsState.responses.set(f2, [availSlot('2026-10-20T10:10:00', '2026-10-20T10:40:00', [st1])]);
  const res = await RW._getCertifiedDualSlotsInternal(row.serviceId, '', '2026-10-20');
  assert.strictEqual(res.status, 'SUCCESS');
  assert.strictEqual(res.data.length, 1);
  const p = res.data[0];
  assert.strictEqual(p.slotF1.resourceId, st1);
  assert.strictEqual(p.slotF2.resourceId, st1, 'same-staff pairing');
  assert.strictEqual(p.slotF2.localStartDate, '2026-10-20T10:10:00');
  const ctrl = (wixDataMock._store.get(CONTROL_COL) || []).find((r) => r.controlType === 'DUAL_CACHE');
  assert.ok(ctrl, 'DUAL_CACHE record persisted in ControlOperativo');
  assert.strictEqual(ctrl.dateYmd, '2026-10-20');
  const payload = ctrl.payload;
  assert.strictEqual(payload.linkedPhases, f2);
  assert.strictEqual(payload.f2Start, '2026-10-20T10:10:00');
});

test('RES-DUAL-05 gap below exposure -> no pair (fail-closed empty)', async () => {
  resetState();
  await invalidateStaffCache();
  const st1 = guid();
  const f2 = guid();
  const row = baseServiceRow({
    allowCombine: true, linkedPhases: f2, exposureDuration: 30,
  });
  seedService(row);
  seedService(baseServiceRow({ serviceId: f2, clientHidden: true }));
  seedStaffApi([{ id: st1, name: 'Ana', role: 'STYLIST' }]);
  slotsState.responses.set(row.serviceId, [availSlot('2026-10-20T09:00:00', '2026-10-20T10:00:00', [st1])]);
  slotsState.responses.set(f2, [availSlot('2026-10-20T10:10:00', '2026-10-20T10:40:00', [st1])]);
  const res = await RW._getCertifiedDualSlotsInternal(row.serviceId, '', '2026-10-20');
  assert.strictEqual(res.status, 'SUCCESS');
  assert.strictEqual(res.data.length, 0, 'gap 10 < exposure 30 => rejected');
});

test('RES-DUAL-06 different-staff F2 -> no pair (same-staff rule)', async () => {
  resetState();
  await invalidateStaffCache();
  const st1 = guid();
  const st2 = guid();
  const f2 = guid();
  const row = baseServiceRow({ allowCombine: true, linkedPhases: f2, exposureDuration: 5 });
  seedService(row);
  seedService(baseServiceRow({ serviceId: f2, clientHidden: true }));
  slotsState.responses.set(row.serviceId, [availSlot('2026-10-20T09:00:00', '2026-10-20T10:00:00', [st1])]);
  slotsState.responses.set(f2, [availSlot('2026-10-20T10:10:00', '2026-10-20T10:40:00', [st2])]);
  const res = await RW._getCertifiedDualSlotsInternal(row.serviceId, '', '2026-10-20');
  assert.strictEqual(res.data.length, 0);
});

test('RES-DUAL-07 hidden parent -> SERVICE_NOT_AVAILABLE at engine level (C9)', async () => {
  resetState();
  await invalidateStaffCache();
  const row = baseServiceRow({ clientHidden: true });
  seedService(row);
  const res = await RW._getCertifiedDualSlotsInternal(row.serviceId, '', '2026-10-20');
  assert.strictEqual(res.error.code, 'SERVICE_NOT_AVAILABLE');
});

test('RES-DUAL-08 getAvailableSlots (RES-13) delegates single-service branch', async () => {
  resetState();
  await invalidateStaffCache();
  const st1 = guid();
  const row = baseServiceRow({ });
  seedService(row);
  slotsState.responses.set(row.serviceId, [availSlot('2026-10-21T11:00:00', '2026-10-21T12:00:00', [st1])]);
  const res = await RW.getAvailableSlots(row.serviceId, '', '2026-10-21');
  assert.strictEqual(res.status, 'SUCCESS');
  assert.strictEqual(res.data.length, 1);
  assert.strictEqual(res.data[0].slotF2, null);
});

// ---------------------------------------------------------------------------
// EXACT STAFF RESOLUTION (RES-12 contract consumed by bookingSaga)
// ---------------------------------------------------------------------------

test('RES-RSF-01 missing f1Start -> INVALID_SLOT_RECHECK', async () => {
  resetState();
  await invalidateStaffCache();
  const res = await RW._resolveStaffForSlotInternal({ serviceId: guid(), f1Start: '' });
  assert.strictEqual(res.error.code, 'INVALID_SLOT_RECHECK');
});

test('RES-RSF-02 unknown service -> SERVICE_NOT_FOUND', async () => {
  resetState();
  await invalidateStaffCache();
  // CONTRATO REAL (reservas.web.js:1365-1380): dos compuertas distintas.
  // a) id NO-GUID -> _resolveServiceIdInternal devuelve null -> SERVICE_NOT_FOUND.
  // b) GUID valido ausente del catalogo -> resolve pasa (passthrough) y la
  //    compuerta de config devuelve SERVICE_CONFIG_MISSING. Se fijan AMBAS.
  const junk = await RW._resolveStaffForSlotInternal({ serviceId: 'not-a-guid', f1Start: '2026-10-20T09:00:00' });
  assert.strictEqual(junk.error.code, 'SERVICE_NOT_FOUND');
  const missingGuid = await RW._resolveStaffForSlotInternal({ serviceId: guid(), f1Start: '2026-10-20T09:00:00' });
  assert.strictEqual(missingGuid.error.code, 'SERVICE_CONFIG_MISSING');
});

test('RES-RSF-03 exact F1 match success with slotF1 injected serviceId', async () => {
  resetState();
  await invalidateStaffCache();
  const st1 = guid();
  const row = baseServiceRow({ });
  seedService(row);
  seedStaffApi([{ id: st1, name: 'Ana', role: 'STYLIST' }]);
  slotsState.responses.set(row.serviceId, [
    availSlot('2026-10-20T09:00:00', '2026-10-20T10:00:00', [st1]),
    availSlot('2026-10-20T12:00:00', '2026-10-20T13:00:00', [st1]),
  ]);
  const res = await RW._resolveStaffForSlotInternal({
    serviceId: row.serviceId,
    f1Start: '2026-10-20T12:00:00',
    f1End: '2026-10-20T13:00:00',
  });
  assert.strictEqual(res.status, 'SUCCESS');
  assert.strictEqual(res.data.resourceId, st1);
  assert.strictEqual(res.data.resourceName, 'Ana');
  assert.strictEqual(res.data.slotF1.serviceId, row.serviceId, '_attachServiceId injection');
  assert.strictEqual(res.data.slotF2, null);
  assert.strictEqual(res.data.dateYMD, '2026-10-20');
});

test('RES-RSF-04 slot taken (no exact match) -> SLOT_UNAVAILABLE', async () => {
  resetState();
  await invalidateStaffCache();
  const st1 = guid();
  const row = baseServiceRow({ });
  seedService(row);
  slotsState.responses.set(row.serviceId, [availSlot('2026-10-20T09:00:00', '2026-10-20T10:00:00', [st1])]);
  const res = await RW._resolveStaffForSlotInternal({
    serviceId: row.serviceId, f1Start: '2026-10-20T15:00:00',
  });
  assert.strictEqual(res.error.code, 'SLOT_UNAVAILABLE');
});

test('RES-RSF-05 requested staff not in candidates -> STAFF_NOT_AVAILABLE', async () => {
  resetState();
  await invalidateStaffCache();
  const st1 = guid();
  const other = guid();
  const row = baseServiceRow({ });
  seedService(row);
  // El mock de Slots API debe respetar resourceTypes.resourceIds igual que
  // Writer V2 real: sin slots para 'other' la compuerta F1 devuelve
  // SLOT_UNAVAILABLE (rama ya cubierta por RSF-04). Para alcanzar la
  // compuerta ESPECIFICA de staff (reservas.web.js:1573-1581, "Selected
  // staff is not available") el slot debe existir para el recurso pedido
  // pero sus candidatos normalizados no incluirlo (p.ej. slot sin resources).
  // El mock respeta resourceTypes.resourceIds como Writer V2 real (slot con
  // recursos [st1] no se devuelve cuando se pide 'other'). Para alcanzar la
  // compuerta ESPECIFICA "Selected staff is not available" (reservas.web.js
  // ~1573) el slot debe SURVIVIR al filtro de recursos pero sus candidatos
  // normalizados no incluir el pedido: slot sin resources + requestedResourceId.
  slotsState.responses.set(row.serviceId, [availSlot('2026-10-20T09:00:00', '2026-10-20T10:00:00', [])]);
  const res = await RW._resolveStaffForSlotInternal({
    serviceId: row.serviceId, f1Start: '2026-10-20T09:00:00', requestedResourceId: other,
  });
  assert.strictEqual(res.error.code, 'STAFF_UNAVAILABLE_SELECTED');
});

test('RES-RSF-06 simple service with F2 context -> UNEXPECTED_F2_CONTEXT', async () => {
  resetState();
  await invalidateStaffCache();
  const st1 = guid();
  const row = baseServiceRow({ });
  seedService(row);
  slotsState.responses.set(row.serviceId, [availSlot('2026-10-20T09:00:00', '2026-10-20T10:00:00', [st1])]);
  const res = await RW._resolveStaffForSlotInternal({
    serviceId: row.serviceId, f1Start: '2026-10-20T09:00:00', f2Start: '2026-10-20T10:30:00',
  });
  assert.strictEqual(res.error.code, 'UNEXPECTED_F2_CONTEXT');
});

test('RES-RSF-07 dual exact match success: both slots normalized, same staff', async () => {
  resetState();
  await invalidateStaffCache();
  const st1 = guid();
  const f2svc = guid();
  const row = baseServiceRow({
    allowCombine: true, linkedPhases: f2svc, exposureDuration: 10,
  });
  seedService(row);
  seedService(baseServiceRow({ serviceId: f2svc, clientHidden: true }));
  seedStaffApi([{ id: st1, name: 'Ana', role: 'STYLIST' }]);
  slotsState.responses.set(row.serviceId, [availSlot('2026-10-20T09:00:00', '2026-10-20T10:00:00', [st1])]);
  slotsState.responses.set(f2svc, [availSlot('2026-10-20T10:10:00', '2026-10-20T10:40:00', [st1])]);
  const res = await RW._resolveStaffForSlotInternal({
    serviceId: row.serviceId,
    f1Start: '2026-10-20T09:00:00', f1End: '2026-10-20T10:00:00',
    f2Start: '2026-10-20T10:10:00', f2End: '2026-10-20T10:40:00',
  });
  assert.strictEqual(res.status, 'SUCCESS');
  assert.strictEqual(res.data.slotF2.serviceId, f2svc);
  assert.strictEqual(res.data.resourceId, st1);
});

test('RES-RSF-08 dual F2 on different day -> F2_DIFFERENT_DAY', async () => {
  resetState();
  await invalidateStaffCache();
  const st1 = guid();
  const f2svc = guid();
  const row = baseServiceRow({
    allowCombine: true, linkedPhases: f2svc, exposureDuration: 10,
  });
  seedService(row);
  seedService(baseServiceRow({ serviceId: f2svc, clientHidden: true }));
  slotsState.responses.set(row.serviceId, [availSlot('2026-10-20T09:00:00', '2026-10-20T10:00:00', [st1])]);
  const res = await RW._resolveStaffForSlotInternal({
    serviceId: row.serviceId, f1Start: '2026-10-20T09:00:00', f2Start: '2026-10-21T10:15:00',
  });
  assert.strictEqual(res.error.code, 'F2_DIFFERENT_DAY');
});

test('RES-RSF-09 dual without f2Start -> F2_SLOT_REQUIRED', async () => {
  resetState();
  await invalidateStaffCache();
  const st1 = guid();
  const f2svc = guid();
  const row = baseServiceRow({
    allowCombine: true, linkedPhases: f2svc, exposureDuration: 10,
  });
  seedService(row);
  seedService(baseServiceRow({ serviceId: f2svc, clientHidden: true }));
  slotsState.responses.set(row.serviceId, [availSlot('2026-10-20T09:00:00', '2026-10-20T10:00:00', [st1])]);
  const res = await RW._resolveStaffForSlotInternal({
    serviceId: row.serviceId, f1Start: '2026-10-20T09:00:00',
  });
  assert.strictEqual(res.error.code, 'F2_SLOT_REQUIRED');
});

test('RES-RSF-10 dual gap outside range -> INVALID_GAP', async () => {
  resetState();
  await invalidateStaffCache();
  const st1 = guid();
  const f2svc = guid();
  const row = baseServiceRow({
    allowCombine: true, linkedPhases: f2svc, exposureDuration: 30,
  });
  seedService(row);
  seedService(baseServiceRow({ serviceId: f2svc, clientHidden: true }));
  slotsState.responses.set(row.serviceId, [availSlot('2026-10-20T09:00:00', '2026-10-20T10:00:00', [st1])]);
  slotsState.responses.set(f2svc, [availSlot('2026-10-20T10:05:00', '2026-10-20T10:35:00', [st1])]);
  const res = await RW._resolveStaffForSlotInternal({
    serviceId: row.serviceId,
    f1Start: '2026-10-20T09:00:00', f1End: '2026-10-20T10:00:00',
    f2Start: '2026-10-20T10:05:00',
  });
  assert.strictEqual(res.error.code, 'INVALID_GAP');
});

test('RES-RSF-11 dual gap longer than exposure -> INVALID_GAP (exact, not minimum)', async () => {
  resetState();
  await invalidateStaffCache();
  const st1 = guid();
  const f2svc = guid();
  const row = baseServiceRow({
    allowCombine: true, linkedPhases: f2svc, exposureDuration: 30,
  });
  seedService(row);
  seedService(baseServiceRow({ serviceId: f2svc, clientHidden: true }));
  slotsState.responses.set(row.serviceId, [availSlot('2026-10-20T09:00:00', '2026-10-20T10:00:00', [st1])]);
  slotsState.responses.set(f2svc, [availSlot('2026-10-20T10:35:00', '2026-10-20T11:05:00', [st1])]);
  const res = await RW._resolveStaffForSlotInternal({
    serviceId: row.serviceId,
    f1Start: '2026-10-20T09:00:00', f1End: '2026-10-20T10:00:00',
    f2Start: '2026-10-20T10:35:00',
  });
  assert.strictEqual(res.error.code, 'INVALID_GAP');
});

// ---------------------------------------------------------------------------
// LOAD BALANCING (RES-16/17) via certified dual ranking
// ---------------------------------------------------------------------------

test('RES-BAL-01 least-loaded staff chosen (PENDING counts, Date slotStart/slotEnd)', async () => {
  resetState();
  await invalidateStaffCache();
  const stBusy = guid();
  const stFree = guid();
  const row = baseServiceRow({ });
  seedService(row);
  // stBusy already has a PENDING booking of 60 min that day (Date objects)
  wixDataMock._seed(CITAS_COL, [{
    _id: 'c1', bookingId: 'bk1', dateYmd: '2026-10-22',
    bookingStatus: 'PENDING', resourceId: stBusy,
    slotStart: new Date('2026-10-22T08:00:00Z'), slotEnd: new Date('2026-10-22T09:00:00Z'),
  }]);
  seedStaffApi([
    { id: stBusy, name: 'Zoe Busy', role: 'STYLIST' },
    { id: stFree, name: 'Aaron Free', role: 'STYLIST' },
  ]);
  slotsState.responses.set(row.serviceId, [
    availSlot('2026-10-22T10:00:00', '2026-10-22T11:00:00', [stBusy, stFree]),
  ]);
  const res = await RW._getCertifiedDualSlotsInternal(row.serviceId, '', '2026-10-22');
  assert.strictEqual(res.status, 'SUCCESS');
  assert.strictEqual(res.data[0].resourceId, stFree, 'free staff ranked first');
});

test('RES-BAL-02 CANCELED bookings ignored in load computation', async () => {
  resetState();
  await invalidateStaffCache();
  const stA = guid();
  const stB = guid();
  const row = baseServiceRow({ });
  seedService(row);
  wixDataMock._seed(CITAS_COL, [{
    _id: 'c1', bookingId: 'bk1', dateYmd: '2026-10-23',
    bookingStatus: 'CANCELED', resourceId: stA,
    slotStart: new Date('2026-10-23T08:00:00Z'), slotEnd: new Date('2026-10-23T18:00:00Z'),
  }]);
  seedStaffApi([
    { id: stA, name: 'AAA', role: 'STYLIST' },
    { id: stB, name: 'BBB', role: 'STYLIST' },
  ]);
  slotsState.responses.set(row.serviceId, [
    availSlot('2026-10-23T10:00:00', '2026-10-23T11:00:00', [stA, stB]),
  ]);
  const res = await RW._getCertifiedDualSlotsInternal(row.serviceId, '', '2026-10-23');
  // equal load (0 vs 0) -> alphabetical tiebreak AAA
  assert.strictEqual(res.data[0].resourceId, stA);
});

test('RES-BAL-03 native Wix bookings count once with custom ledger deduplication', async () => {
  resetState();
  await invalidateStaffCache();
  const stA = guid();
  const stB = guid();
  const row = baseServiceRow({});
  seedService(row);
  wixDataMock._seed(CITAS_COL, [{
    _id: 'c-custom',
    bookingId: 'native-duplicate',
    dateYmd: '2026-10-22',
    bookingStatus: 'PENDING',
    paymentStatus: 'NOT_PAID',
    resourceId: stA,
    slotStart: new Date('2026-10-22T08:00:00Z'),
    slotEnd: new Date('2026-10-22T09:00:00Z'),
  }]);
  seedStaffApi([
    { id: stA, name: 'Ana', role: 'STYLIST' },
    { id: stB, name: 'Bea', role: 'STYLIST' },
  ]);
  nativeBookingsState.bookings = [
    {
      id: 'native-duplicate',
      status: 'CONFIRMED',
      paymentStatus: 'UNDEFINED',
      startDate: '2026-10-22T08:00:00.000Z',
      endDate: '2026-10-22T09:00:00.000Z',
      bookedEntity: { slot: { resource: { _id: stA } } },
    },
    {
      id: 'native-only-b',
      status: 'CONFIRMED',
      paymentStatus: 'UNDEFINED',
      startDate: '2026-10-22T08:00:00.000Z',
      endDate: '2026-10-22T09:30:00.000Z',
      bookedEntity: { slot: { resource: { _id: stB } } },
    },
  ];
  slotsState.responses.set(row.serviceId, [
    availSlot('2026-10-22T10:00:00', '2026-10-22T11:00:00', [stA, stB]),
  ]);

  const result = await RW._getCertifiedDualSlotsInternal(row.serviceId, '', '2026-10-22');

  assert.strictEqual(result.status, 'SUCCESS');
  assert.strictEqual(result.data[0].resourceId, stA,
    'A has 60 minutes; B has 90 native minutes; duplicate native A booking is not counted twice');
  assert.strictEqual(nativeBookingsState.calls.length, 1, 'native Bookings Reader queried once');
  const filter = nativeBookingsState.calls[0].query.filter;
  assert.ok(Array.isArray(filter.$and), 'native query is restricted to the Madrid-day UTC range');
});

test('RES-BAL-04 native reader failure refuses assignment with incomplete daily load', async () => {
  resetState();
  await invalidateStaffCache();
  const stBusy = guid();
  const stFree = guid();
  const row = baseServiceRow({});
  seedService(row);
  wixDataMock._seed(CITAS_COL, [{
    _id: 'c1',
    bookingId: 'bk-busy',
    dateYmd: '2026-10-23',
    bookingStatus: 'PENDING',
    paymentStatus: 'NOT_PAID',
    resourceId: stBusy,
    slotStart: new Date('2026-10-23T08:00:00Z'),
    slotEnd: new Date('2026-10-23T09:00:00Z'),
  }]);
  seedStaffApi([
    { id: stBusy, name: 'Zoe Busy', role: 'STYLIST' },
    { id: stFree, name: 'Aaron Free', role: 'STYLIST' },
  ]);
  nativeBookingsState.error = new Error('native reader unavailable');
  slotsState.responses.set(row.serviceId, [
    availSlot('2026-10-23T10:00:00', '2026-10-23T11:00:00', [stBusy, stFree]),
  ]);

  await assert.rejects(
    () => RW._getCertifiedDualSlotsInternal(row.serviceId, '', '2026-10-23'),
    (error) => error && error.code === 'BOOKING_LOAD_UNAVAILABLE',
    'must refuse to rank or expose an assignment when native workload is unavailable'
  );
});

// ---------------------------------------------------------------------------
// AVAILABLE DAYS (writer payload + DAYS_CACHE write) — uses real clock window
// ---------------------------------------------------------------------------

test('RES-DAYS-01 payload contract + day extraction + DAYS_CACHE persisted', async () => {
  resetState();
  await invalidateStaffCache();
  const st1 = guid();
  const row = baseServiceRow({ });
  seedService(row);
  const nowMadrid = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date());
  const today = nowMadrid.slice(0, 10);
  const tomorrow = new Date(Date.parse(today + 'T12:00:00Z') + 86400000)
    .toLocaleDateString('sv-SE', { timeZone: 'UTC' });
  slotsState.responses.set(row.serviceId, [availSlot(tomorrow + 'T09:00:00', tomorrow + 'T10:00:00', [st1])]);
  const y = Number(tomorrow.slice(0, 4));
  const m = Number(tomorrow.slice(5, 7));
  const res = await RW.getAvailableDays(row.serviceId, '', y, m);
  assert.strictEqual(res.status, 'SUCCESS');
  assert.ok(Array.isArray(res.data));
  assert.ok(res.data.includes(tomorrow), 'tomorrow slot surfaces as available day');
  const call = slotsState.calls.find((c) => c.serviceId === row.serviceId);
  assert.ok(call, 'Writer V2 called');
  assert.strictEqual(call.timeZone, 'Europe/Madrid');
  assert.strictEqual(call.bookable, true);
  assert.strictEqual(call.timeSlotsPerDay, 1);
  const daysRec = (wixDataMock._store.get(CONTROL_COL) || []).find((r) => r.controlType === 'DAYS_CACHE');
  assert.ok(daysRec, 'DAYS_CACHE record written (PEND-09)');
  const payload = daysRec.payload;
  assert.ok(Array.isArray(payload.emptyDaysYmds));
});

test('RES-DAYS-02 invalid month -> INVALID_PARAMS', async () => {
  resetState();
  await invalidateStaffCache();
  const row = baseServiceRow();
  seedService(row);
  const res = await RW.getAvailableDays(row.serviceId, '', 2026, 13);
  assert.strictEqual(res.error.code, 'INVALID_PARAMS');
});

// ---------------------------------------------------------------------------
// CACHE INVALIDATION (C2) + expired dual purge
// ---------------------------------------------------------------------------

test('RES-INV-01 invalidate removes DUAL_CACHE rows for the day', async () => {
  resetState();
  await invalidateStaffCache();
  const row = baseServiceRow();
  seedService(row);
  const ymd = '2026-10-24';
  wixDataMock._seed(CONTROL_COL, [
    { _id: 'd1', controlType: 'DUAL_CACHE', serviceId: row.serviceId, dateYmd: ymd, resourceId: '', expiresAt: new Date(Date.now() + 60000) },
    { _id: 'd2', controlType: 'DUAL_CACHE', serviceId: row.serviceId, dateYmd: ymd, resourceId: '', expiresAt: new Date(Date.now() + 60000) },
    { _id: 'd3', controlType: 'DUAL_CACHE', serviceId: row.serviceId, dateYmd: '2026-10-25', resourceId: '', expiresAt: new Date(Date.now() + 60000) },
  ]);
  const out = await RW._invalidateCachesInternal(row.serviceId, ymd, '');
  assert.strictEqual(out.ok, true);
  const left = (wixDataMock._store.get(CONTROL_COL) || []).filter((r) => r.controlType === 'DUAL_CACHE');
  assert.deepStrictEqual(left.map((r) => r._id).sort(), ['d3'], 'only target-day rows removed');
});

test('RES-INV-02 cleanExpiredDualSlots removes expired, keeps alive', async () => {
  resetState();
  await invalidateStaffCache();
  wixDataMock._seed(CONTROL_COL, [
    { _id: 'x1', controlType: 'DUAL_CACHE', expiresAt: new Date(Date.now() - 1000) },
    { _id: 'x2', controlType: 'DUAL_CACHE', expiresAt: new Date(Date.now() + 600000) },
  ]);
  const res = await RW._cleanExpiredDualSlotsInternal({ limit: 10 });
  assert.strictEqual(res.status, 'SUCCESS');
  assert.strictEqual(res.data.removed, 1);
  const left = (wixDataMock._store.get(CONTROL_COL) || []).map((r) => r._id);
  assert.deepStrictEqual(left, ['x2']);
});

test('RES-INV-03 invalidate with invalid params is a safe no-op', async () => {
  resetState();
  await invalidateStaffCache();
  const out = await RW._invalidateCachesInternal('', 'bad-date', '');
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.skipped, true);
});

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// DTO-WHITELIST SURFACE (getConfirmedBookingForDisplay)
// RES-30: el bookingId NO es credencial. Los visitantes acceden SOLO con
// token opaco (generateDisplayToken). El contrato de errores exige:
// INVALID_PAYLOAD (forma) -> AUTH_REQUIRED (visitante sin token) ->
// TOKEN_* (credencial invalida) -> NOT_FOUND / NOT_CONFIRMED (estado).
// Helpers: guid valido + reserva CONFIRMED sembrada + emision de token.
// ---------------------------------------------------------------------------

const GUID_OK = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

async function seedConfirmedBooking(bookingId, extra = {}) {
  wixDataMock._seed(CITAS_COL, [{
    _id: 'r-' + bookingId.slice(-4),
    bookingId,
    bookingStatus: 'CONFIRMED',
    paymentStatus: 'PAID',
    pairToken: 'pt',
    serviceId: 'svc',
    dateYmd: '2026-10-25',
    slotStart: new Date('2026-10-25T09:00:00Z'),
    slotEnd: new Date('2026-10-25T10:00:00Z'),
    resourceId: 'res',
    totalPrice: 60,
    margin: 0.4,
    internalNotes: 'secreto',
    tipoImpositivo: 'IVARIA',
    codigoImpuesto: 'X',
    payloadFiscal: {},
    nifEmisor: 'B123',
    previousRecordHash: 'h',
    cuentaContable4300: '4300',
    ...extra,
  }]);
}

// AUDIT-TOKEN-P0-01: la emision exige identidad de miembro PROPIETARIO (o
// credencial previa para anonimos). En test se usa la via de miembro: se
// siembra contactDetails.memberId en la reserva y se simula la sesion via
// __mmMembersState (contrato loader LH-18/LH-24), restaurando el estado al
// terminar para no contaminar otros casos.
const DISPLAY_OWNER_ID = 'member-display-owner-0001';

async function issueDisplayToken(bookingId) {
  const rows = wixDataMock._store.get(CITAS_COL) || [];
  const rec = rows.find((r) => r.bookingId === bookingId);
  if (rec) {
    rec.contactDetails = { ...(rec.contactDetails || {}), memberId: DISPLAY_OWNER_ID };
  }
  globalThis.__mmMembersState = globalThis.__mmMembersState || { _current: null };
  const prev = globalThis.__mmMembersState._current;
  globalThis.__mmMembersState._current = { _id: DISPLAY_OWNER_ID };
  try {
    const gen = await RW.generateDisplayToken({ bookingId });
    assert.strictEqual(gen.ok, true, `token issuance failed: ${gen.error}`);
    return gen.token;
  } finally {
    globalThis.__mmMembersState._current = prev;
  }
}

test('RES-DISPLAY-01 missing bookingId -> INVALID_PAYLOAD without CMS read', async () => {
  resetState();
  await invalidateStaffCache();
  const before = wixDataMock._calls.length;
  const res = await RW.getConfirmedBookingForDisplay({});
  assert.deepStrictEqual(res, { ok: false, data: null, error: 'INVALID_PAYLOAD' });
  assert.strictEqual(wixDataMock._calls.length, before, 'no DB access');
});

test('RES-DISPLAY-02 whitelist projection: forbidden fiscal fields never leak', async () => {
  resetState();
  await invalidateStaffCache();
  const bid = GUID_OK;
  await seedConfirmedBooking(bid);
  const token = await issueDisplayToken(bid);
  const res = await RW.getConfirmedBookingForDisplay({ displayToken: token });
  assert.strictEqual(res.ok, true, JSON.stringify(res));
  const allowed = new Set(['bookingId', 'bookingStatus', 'paymentStatus', 'pairToken',
    'serviceId', 'dateYmd', 'slotStart', 'slotEnd', 'resourceId']);
  for (const k of Object.keys(res.data)) {
    assert.ok(allowed.has(k), `field ${k} not whitelisted`);
  }
  // RES-30: ningun importe (totalPrice/totalAmount) sale en la proyeccion publica.
  assert.ok(!('totalPrice' in res.data) && !('totalAmount' in res.data));
});

test('RES-DISPLAY-03 CANCELED hidden (NOT_CONFIRMED), legacy CANCELED normalized', async () => {
  resetState();
  await invalidateStaffCache();
  const b1 = GUID_OK;
  wixDataMock._seed(CITAS_COL, [{ _id: 'r1', bookingId: b1, bookingStatus: 'CANCELLED' }]);
  // Sin token: AUTH_REQUIRED primero (no se revela que la reserva existe ni su estado).
  const noTok = await RW.getConfirmedBookingForDisplay({ bookingId: b1 });
  assert.strictEqual(noTok.error, 'AUTH_REQUIRED');
  // AUDIT-TOKEN-P0-01: sin identidad ni credencial previa la emision se niega
  // ANTES de tocar BD (AUTH_REQUIRED precede a NOT_CONFIRMED por contrato).
  const gen = await RW.generateDisplayToken({ bookingId: b1 });
  assert.strictEqual(gen.ok, false);
  assert.strictEqual(gen.error, 'AUTH_REQUIRED');
  // Via miembro propietario autenticado: la reserva CANCELLED (huerfana o con
  // dueno) jamas obtiene token -> NOT_CONFIRMED sin emitir.
  globalThis.__mmMembersState = globalThis.__mmMembersState || { _current: null };
  globalThis.__mmMembersState._current = { _id: DISPLAY_OWNER_ID };
  try {
    const rowsB1 = wixDataMock._store.get(CITAS_COL);
    const rb1 = rowsB1.find((r) => r.bookingId === b1);
    if (rb1) rb1.contactDetails = { memberId: DISPLAY_OWNER_ID };
    const genAuth = await RW.generateDisplayToken({ bookingId: b1 });
    assert.strictEqual(genAuth.ok, false, 'cancelled booking must never receive a token');
    assert.strictEqual(genAuth.error, 'NOT_CONFIRMED');
    // Legacy-only row (campo 'status'): el lector v12 solo conoce bookingStatus,
    // por lo que tampoco es confirmable ni tokenizable.
    const b2 = 'ffffffff-1111-4222-9333-cccccccccccc';
    wixDataMock._store.get(CITAS_COL).push({ _id: 'r2', bookingId: b2, status: 'canceled' });
    const gen2 = await RW.generateDisplayToken({ bookingId: b2 });
    assert.strictEqual(gen2.ok, false, 'legacy canceled must not receive a token');
    assert.strictEqual(gen2.error, 'NOT_CONFIRMED');
  } finally {
    globalThis.__mmMembersState._current = null;
  }
});

test('RES-DISPLAY-04 unknown booking -> NOT_FOUND', async () => {
  resetState();
  await invalidateStaffCache();
  wixDataMock._seed(CITAS_COL, []);
  // Reserva desconocida: sin identidad ni credencial, la emision se niega por
  // AUTH_REQUIRED ANTES de tocar BD (anti-enumeracion, AUDIT-TOKEN-P0-01).
  const ghost = 'deadbeef-0000-4000-8000-000000000000';
  const genAnon = await RW.generateDisplayToken({ bookingId: ghost });
  assert.strictEqual(genAnon.ok, false);
  assert.strictEqual(genAnon.error, 'AUTH_REQUIRED');
  // Via miembro autenticado: la reserva inexistente responde NOT_FOUND.
  globalThis.__mmMembersState = globalThis.__mmMembersState || { _current: null };
  globalThis.__mmMembersState._current = { _id: DISPLAY_OWNER_ID };
  try {
    const gen = await RW.generateDisplayToken({ bookingId: ghost });
    assert.strictEqual(gen.ok, false);
    assert.strictEqual(gen.error, 'NOT_FOUND');
  } finally {
    globalThis.__mmMembersState._current = null;
  }
  // ...y si aun asi alguien presenta un token fabricado, fail-closed TOKEN_ALREADY_CONSUMED.
  const res = await RW.getConfirmedBookingForDisplay({ displayToken: 'forged-token-xyz' });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.error, 'TOKEN_NOT_FOUND');
});

test('RES-DISPLAY-05 visitor without token on well-formed bookingId -> AUTH_REQUIRED', async () => {
  resetState();
  await invalidateStaffCache();
  const bid = GUID_OK;
  await seedConfirmedBooking(bid);
  const before = wixDataMock._calls.length;
  const res = await RW.getConfirmedBookingForDisplay({ bookingId: bid });
  assert.strictEqual(res.error, 'AUTH_REQUIRED');
  assert.strictEqual(wixDataMock._calls.length, before, 'AUTH gate before any CMS read');
});

test('RES-DISPLAY-06 token is single-use: replay after success is rejected', async () => {
  resetState();
  await invalidateStaffCache();
  const bid = GUID_OK;
  await seedConfirmedBooking(bid);
  const token = await issueDisplayToken(bid);
  const first = await RW.getConfirmedBookingForDisplay({ displayToken: token });
  assert.strictEqual(first.ok, true);
  const replay = await RW.getConfirmedBookingForDisplay({ displayToken: token });
  assert.strictEqual(replay.ok, false);
  // v3 delete-atomico (RES-R3-15): el consumo elimina la fila DT_. Un replay
  // posterior ya no encuentra credencial -> TOKEN_NOT_FOUND. Es el contrato
  // uniforme anti-enumeracion: no revela si el token existio o fue consumido
  // (mismo codigo que un token fabricado, RES-DISPLAY-05). El rechazo
  // concurrente interno usa TOKEN_ALREADY_CONSUMED, pero es observable
  // identico para el cliente.
  assert.strictEqual(replay.error, 'TOKEN_NOT_FOUND');
});

test('RES-DISPLAY-07 expired token -> TOKEN_EXPIRED', async () => {
  resetState();
  await invalidateStaffCache();
  const bid = GUID_OK;
  await seedConfirmedBooking(bid);
  const token = await issueDisplayToken(bid);
  // Caducar el registro DT_ directamente en el store del mock.
  const dt = (wixDataMock._store.get(CONTROL_COL) || [])
    .find((r) => r.controlType === 'DISPLAY_TOKEN');
  assert.ok(dt, 'DT record seeded by generateDisplayToken');
  dt.expiresAt = new Date(Date.now() - 1000);
  const res = await RW.getConfirmedBookingForDisplay({ displayToken: token });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.error, 'TOKEN_EXPIRED');
});

// ---------------------------------------------------------------------------
// CONTRACT FREEZE (guard de regresion)
// ---------------------------------------------------------------------------

test('RES-CONTRACT-01 exports surface frozen (v10)', () => {
  const expected = [
    '_getServiceBySlugOrIdInternal', '_resolveServiceIdInternal', '_mapServiceImport2ToUX',
    'getServiceForBookingInternal', 'getServiceBySlugOrId', 'resolveServiceId',
    '_toPublicService', '_resolveAddonContextPublic', '_getStaffDisplayNamePublic',
    'revalidateExactAvailabilitySlot', '_resolveStaffForSlotInternal',
    '_cleanExpiredDualSlotsInternal', '_getCertifiedDualSlotsInternal',
    '_invalidateCachesInternal', 'invalidateCachesInternal', 'getAvailableDays',
    'getCertifiedDualSlots', 'getAvailableSlots', 'resolveStaffForSlot',
    'getConfirmedBookingForDisplay',
  ];
  for (const name of expected) {
    assert.ok(name in RW, `missing export: ${name}`);
  }
});


// ---------------------------------------------------------------------------
// STAFF SELECTION, LOAD BALANCING, FAIL-CLOSED, AND EXPOSURE GAP REGRESSIONS
// ---------------------------------------------------------------------------

test('RES-STAFF-01 explicit staff selection is preserved for a simple slot', async () => {
  resetState();
  await invalidateStaffCache();
  const selected = guid();
  const other = guid();
  const row = baseServiceRow();
  seedService(row);
  seedStaffApi([
    { id: selected, name: 'Zoe', role: 'STYLIST' },
    { id: other, name: 'Ana', role: 'STYLIST' },
  ]);
  slotsState.responses.set(row.serviceId, [
    availSlot('2026-10-20T12:00:00', '2026-10-20T13:00:00', [other, selected]),
  ]);

  const res = await RW._resolveStaffForSlotInternal({
    serviceId: row.serviceId,
    f1Start: '2026-10-20T12:00:00',
    f1End: '2026-10-20T13:00:00',
    requestedResourceId: selected,
  });

  assert.strictEqual(res.status, 'SUCCESS');
  assert.strictEqual(res.data.resourceId, selected, 'never silently replace the selected staff member');
  assert.ok(
    slotsState.calls.some((payload) =>
      payload.resourceTypes?.some((group) => group.resourceIds?.includes(selected))
    ),
    'availability lookup must be scoped to the selected staff member'
  );
});

test('RES-STAFF-02 explicit staff selection is preserved for both dual phases', async () => {
  resetState();
  await invalidateStaffCache();
  const selected = guid();
  const other = guid();
  const f2ServiceId = guid();
  const row = baseServiceRow({
    allowCombine: true,
    linkedPhases: f2ServiceId,
    exposureDuration: 15,
    phase1Duration: 30,
    phase2Duration: 30,
  });
  seedService(row);
  seedService(baseServiceRow({
    serviceId: f2ServiceId,
    clientHidden: true,
    phase1Duration: 30,
    totalDuration: 30,
    locationId: row.locationId,
  }));
  seedStaffApi([
    { id: selected, name: 'Zoe', role: 'STYLIST' },
    { id: other, name: 'Ana', role: 'STYLIST' },
  ]);
  slotsState.responses.set(row.serviceId, [
    availSlot('2026-10-20T09:00:00', '2026-10-20T09:30:00', [other, selected]),
  ]);
  slotsState.responses.set(f2ServiceId, [
    availSlot('2026-10-20T09:45:00', '2026-10-20T10:15:00', [other, selected]),
  ]);

  const res = await RW._resolveStaffForSlotInternal({
    serviceId: row.serviceId,
    f1Start: '2026-10-20T09:00:00',
    f1End: '2026-10-20T09:30:00',
    f2Start: '2026-10-20T09:45:00',
    f2End: '2026-10-20T10:15:00',
    requestedResourceId: selected,
  });

  assert.strictEqual(res.status, 'SUCCESS');
  assert.strictEqual(res.data.resourceId, selected);
  assert.strictEqual(res.data.slotF1.serviceId, row.serviceId);
  assert.strictEqual(res.data.slotF2.serviceId, f2ServiceId);
  assert.ok(
    slotsState.calls.some((payload) =>
      payload.serviceId === f2ServiceId &&
      payload.resourceTypes?.some((group) => group.resourceIds?.includes(selected))
    ),
    'F2 availability must be rechecked for the same selected staff member'
  );
});

test('RES-STAFF-03 selected staff unavailable in F2 is rejected, never auto-switched', async () => {
  resetState();
  await invalidateStaffCache();
  const selected = guid();
  const other = guid();
  const f2ServiceId = guid();
  const row = baseServiceRow({
    allowCombine: true,
    linkedPhases: f2ServiceId,
    exposureDuration: 15,
    phase1Duration: 30,
    phase2Duration: 30,
  });
  seedService(row);
  seedService(baseServiceRow({
    serviceId: f2ServiceId,
    clientHidden: true,
    phase1Duration: 30,
    totalDuration: 30,
    locationId: row.locationId,
  }));
  seedStaffApi([
    { id: selected, name: 'Zoe', role: 'STYLIST' },
    { id: other, name: 'Ana', role: 'STYLIST' },
  ]);
  slotsState.responses.set(row.serviceId, [
    availSlot('2026-10-20T09:00:00', '2026-10-20T09:30:00', [selected, other]),
  ]);
  slotsState.responses.set(f2ServiceId, [
    availSlot('2026-10-20T10:00:00', '2026-10-20T10:30:00', [other]),
  ]);

  const res = await RW._resolveStaffForSlotInternal({
    serviceId: row.serviceId,
    f1Start: '2026-10-20T09:00:00',
    f1End: '2026-10-20T09:30:00',
    f2Start: '2026-10-20T10:00:00',
    f2End: '2026-10-20T10:30:00',
    requestedResourceId: selected,
  });

  assert.strictEqual(res.status, 'ERROR');
  assert.strictEqual(res.error.code, 'STAFF_UNAVAILABLE_DUAL');
  assert.strictEqual(res.error.action, 'REQUIRES_STAFF_RESELECTION');
});

test('RES-RANK-01 unselected staff is balanced by booked minutes, not API order', async () => {
  resetState();
  await invalidateStaffCache();
  const heavilyBooked = guid();
  const freeStaff = guid();
  const row = baseServiceRow();
  seedService(row);
  seedStaffApi([
    { id: heavilyBooked, name: 'Ana', role: 'STYLIST' },
    { id: freeStaff, name: 'Zoe', role: 'STYLIST' },
  ]);
  slotsState.responses.set(row.serviceId, [
    availSlot('2026-10-20T12:00:00', '2026-10-20T13:00:00', [heavilyBooked, freeStaff]),
  ]);
  wixDataMock._seed(CITAS_COL, [{
    _id: guid(),
    bookingId: guid(),
    dateYmd: '2026-10-20',
    bookingStatus: 'CONFIRMED',
    resourceId: heavilyBooked,
    slotStart: '2026-10-20T08:00:00.000Z',
    slotEnd: '2026-10-20T10:00:00.000Z',
  }]);

  const res = await RW._resolveStaffForSlotInternal({
    serviceId: row.serviceId,
    f1Start: '2026-10-20T12:00:00',
    f1End: '2026-10-20T13:00:00',
  });

  assert.strictEqual(res.status, 'SUCCESS');
  assert.strictEqual(res.data.resourceId, freeStaff, 'staff with fewer booked minutes must win');
});

test('RES-RANK-02 failed workload read returns UPSTREAM_UNAVAILABLE, not fake zero load', async () => {
  resetState();
  await invalidateStaffCache();
  const staffA = guid();
  const staffB = guid();
  const row = baseServiceRow();
  seedService(row);
  seedStaffApi([
    { id: staffA, name: 'Ana', role: 'STYLIST' },
    { id: staffB, name: 'Zoe', role: 'STYLIST' },
  ]);
  slotsState.responses.set(row.serviceId, [
    availSlot('2026-10-20T12:00:00', '2026-10-20T13:00:00', [staffA, staffB]),
  ]);
  wixDataMock._findErrors.set(CITAS_COL, new Error('simulated CitasF2 outage'));

  const res = await RW._resolveStaffForSlotInternal({
    serviceId: row.serviceId,
    f1Start: '2026-10-20T12:00:00',
    f1End: '2026-10-20T13:00:00',
  });

  assert.strictEqual(res.status, 'ERROR');
  assert.strictEqual(res.error.code, 'UPSTREAM_UNAVAILABLE');
  assert.ok(!res.data, 'do not assign a professional with unknown workload');
});

test('RES-GAP-01 another simple service can use a slot inside the dual exposure gap', async () => {
  resetState();
  await invalidateStaffCache();
  const staff = guid();
  const f2ServiceId = guid();
  const simpleServiceId = guid();
  const locationId = guid();
  const dual = baseServiceRow({
    serviceId: guid(),
    locationId,
    allowCombine: true,
    linkedPhases: f2ServiceId,
    phase1Duration: 30,
    exposureDuration: 30,
    phase2Duration: 40,
    totalDuration: 100,
  });
  const f2 = baseServiceRow({
    serviceId: f2ServiceId,
    locationId,
    clientHidden: true,
    phase1Duration: 40,
    totalDuration: 40,
  });
  const simple = baseServiceRow({
    serviceId: simpleServiceId,
    locationId,
    phase1Duration: 15,
    phase2Duration: 0,
    exposureDuration: 0,
    allowCombine: false,
    totalDuration: 15,
  });
  seedService(dual);
  seedService(f2);
  seedService(simple);
  seedStaffApi([{ id: staff, name: 'Marian', role: 'STYLIST' }]);
  slotsState.responses.set(dual.serviceId, [
    availSlot('2026-10-20T09:00:00', '2026-10-20T09:30:00', [staff]),
  ]);
  slotsState.responses.set(f2ServiceId, [
    availSlot('2026-10-20T10:00:00', '2026-10-20T10:40:00', [staff]),
  ]);
  slotsState.responses.set(simpleServiceId, [
    availSlot('2026-10-20T09:30:00', '2026-10-20T09:45:00', [staff]),
  ]);

  const dualResult = await RW._getCertifiedDualSlotsInternal(dual.serviceId, '', '2026-10-20');
  assert.strictEqual(dualResult.status, 'SUCCESS');
  assert.strictEqual(dualResult.data.length, 1);
  assert.strictEqual(dualResult.data[0].slotF1.localEndDate, '2026-10-20T09:30:00');
  assert.strictEqual(dualResult.data[0].slotF2.localStartDate, '2026-10-20T10:00:00');

  const simpleResult = await RW._getCertifiedDualSlotsInternal(simpleServiceId, '', '2026-10-20');
  assert.strictEqual(simpleResult.status, 'SUCCESS');
  assert.strictEqual(simpleResult.data.length, 1);
  assert.strictEqual(simpleResult.data[0].resourceId, staff);
  assert.strictEqual(simpleResult.data[0].slotF1.localStartDate, '2026-10-20T09:30:00');
  assert.strictEqual(simpleResult.data[0].slotF1.localEndDate, '2026-10-20T09:45:00');
});


test('RES-RANK-03 completed appointments count toward daily load balancing', async () => {
  resetState();
  await invalidateStaffCache();
  const completedStaff = guid();
  const freeStaff = guid();
  const row = baseServiceRow();
  seedService(row);
  seedStaffApi([
    { id: completedStaff, name: 'Ana', role: 'STYLIST' },
    { id: freeStaff, name: 'Zoe', role: 'STYLIST' },
  ]);
  slotsState.responses.set(row.serviceId, [
    availSlot('2026-10-20T12:00:00', '2026-10-20T12:30:00', [completedStaff, freeStaff]),
  ]);
  wixDataMock._seed(CITAS_COL, [{
    _id: guid(),
    bookingId: guid(),
    dateYmd: '2026-10-20',
    bookingStatus: 'COMPLETED',
    paymentStatus: 'PAID',
    resourceId: completedStaff,
    slotStart: '2026-10-20T08:00:00.000Z',
    slotEnd: '2026-10-20T09:30:00.000Z',
  }]);

  const res = await RW._resolveStaffForSlotInternal({
    serviceId: row.serviceId,
    f1Start: '2026-10-20T12:00:00',
    f1End: '2026-10-20T12:30:00',
  });

  assert.strictEqual(res.status, 'SUCCESS');
  assert.strictEqual(res.data.resourceId, freeStaff, 'already completed work still counts toward today\'s load');
});
