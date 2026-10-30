/*
=============================================================================
SUITE: booking.utils.availability + saga validation (FASE5)
Purpose: offline coverage of the Wix Bookings availability adapters
  (normalizeSlotShape / normalizeAvailabilitySlot / getResourceIdsFromSlot),
  deterministic staff picking, add-on catalog resolution against the native
  ComplementosCatalogo contract, linked-phase F2 duration with cycle guard,
  and the fail-closed validation gates of executeBookingSaga (email/RGPD/
  service/slot dates) plus BookingSagaOrchestrator compensation semantics.
Runs offline via tests/loader.mjs mocks. G10 ASCII strict.
=============================================================================
*/
import test from 'node:test';
import assert from 'node:assert';

const { wixDataMock, mocks } = await import('./loader.mjs');
const BU = await import('backend/booking/bookingUtils.js');
const BC = await import('backend/booking/bookingCore.js');
const BS = await import('backend/booking/bookingSaga.js');
const IC = await import('backend/internalConfig');

const STAFF_TYPE = IC.API.STAFF_RESOURCE_TYPE_ID;
const GUID_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const GUID_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const GUID_3 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

// ---------------------------------------------------------------------------
// SLOT SHAPE NORMALIZATION (Wix Bookings Writer V2 devuelve ambas formas)
// ---------------------------------------------------------------------------

test('BUTIL-SLOT-01 normalizeSlotShape flattens nested slot, outer wins', () => {
  const nested = BU.normalizeSlotShape({
    slot: { localStartDate: '2026-10-15T09:00:00', _id: 'S1' },
    resourceId: GUID_1,
  });
  assert.strictEqual(nested.localStartDate, '2026-10-15T09:00:00');
  assert.strictEqual(nested.resourceId, GUID_1);
  const flat = BU.normalizeSlotShape({ localStartDate: 'x' });
  assert.strictEqual(flat.localStartDate, 'x');
  assert.strictEqual(BU.normalizeSlotShape(null), null);
});

test('BUTIL-SLOT-02 normalizeAvailabilitySlot rejects invalid ranges (null)', () => {
  const ok = BU.normalizeAvailabilitySlot({
    localStartDate: '2026-10-15T09:00:00',
    localEndDate: '2026-10-15T10:00:00',
  });
  assert.ok(ok && ok.localStartDate && ok.localEndDate);
  // end <= start -> rango invalido -> null (fail-closed)
  const bad = BU.normalizeAvailabilitySlot({
    localStartDate: '2026-10-15T10:00:00',
    localEndDate: '2026-10-15T09:00:00',
  });
  assert.strictEqual(bad, null);
  assert.strictEqual(BU.normalizeAvailabilitySlot({}), null);
});

// ---------------------------------------------------------------------------
// RESOURCE IDS DESDE SLOTS (UTILS-13, fail-closed sin staffResourceTypeId)
// ---------------------------------------------------------------------------

test('BUTIL-RES-01 extracts only STAFF-type group ids, deduped', () => {
  const slot = {
    availableResources: [
      { resourceTypeId: 'room-type-99', resources: [{ id: GUID_3 }] },
      {
        resourceTypeId: STAFF_TYPE,
        resources: [{ id: GUID_1 }, { _id: GUID_2 }, { id: 'no-guid' }, GUID_1],
      },
    ],
  };
  const ids = BU.getResourceIdsFromSlot(slot, STAFF_TYPE);
  assert.deepStrictEqual(ids.sort(), [GUID_1, GUID_2].sort());
});

test('BUTIL-RES-02 missing staffResourceTypeId returns empty (never confuses room/staff)', () => {
  const slot = { availableResources: [{ resourceTypeId: STAFF_TYPE, resources: [GUID_1] }] };
  assert.deepStrictEqual(BU.getResourceIdsFromSlot(slot, ''), []);
  assert.deepStrictEqual(BU.getResourceIdsFromSlot(slot, null), []);
});

test('BUTIL-RES-03 flat single-resource slot falls back to direct id', () => {
  const ids = BU.getResourceIdsFromSlot({ resource: { id: GUID_1 } }, STAFF_TYPE);
  assert.deepStrictEqual(ids, [GUID_1]);
  assert.deepStrictEqual(BU.getResourceIdsFromSlot({ resource: { id: 'basura' } }, STAFF_TYPE), []);
});

// ---------------------------------------------------------------------------
// PICK STAFF BY LOWEST LOAD (UTILS-14 determinista)
// ---------------------------------------------------------------------------

test('BUTIL-PICK-01 lowest load wins; corrupt loads treated as Infinity', () => {
  assert.strictEqual(
    BU.pickStaffByLowestLoad([GUID_1, GUID_2], { [GUID_1]: 5, [GUID_2]: 2 }),
    GUID_2
  );
  assert.strictEqual(
    BU.pickStaffByLowestLoad([GUID_1, GUID_2], { [GUID_1]: NaN, [GUID_2]: 0 }),
    GUID_2
  );
  assert.strictEqual(
    BU.pickStaffByLowestLoad([GUID_1, GUID_2], { [GUID_1]: -3, [GUID_2]: -1 }),
    GUID_1, 'desempate: primer candidato'
  );
  assert.strictEqual(BU.pickStaffByLowestLoad([], {}), null);
});

// ---------------------------------------------------------------------------
// ADD-ONS (UTILS-09/10)
// ---------------------------------------------------------------------------

test('BUTIL-ADDON-01 normalizeCatalogAddOn canonical projection + fail-closed', () => {
  const n = BU.normalizeCatalogAddOn({ id: GUID_1, name: 'Cepillado', price: 15 });
  assert.deepStrictEqual(n, { addOnId: GUID_1, name: 'Cepillado', price: 15 });
  assert.strictEqual(BU.normalizeCatalogAddOn({ id: GUID_1, name: '', price: 15 }), null);
  assert.strictEqual(BU.normalizeCatalogAddOn({ id: GUID_1, name: 'X', price: -1 }), null);
  assert.strictEqual(BU.normalizeCatalogAddOn({ id: 'not-guid', name: 'X', price: 1 }), null);
});

test('BUTIL-ADDON-02 resolveAddOnIds filters foreign ids, dedupes, caps limit', () => {
  const catalog = [
    { addOnId: GUID_1, name: 'A', price: 1 },
    { addOnId: GUID_2, name: 'B', price: 2 },
  ];
  const res = BU.resolveAddOnIds(catalog, [GUID_1, GUID_1, GUID_3, GUID_2], 5);
  assert.deepStrictEqual(res.addOnIds, [GUID_1, GUID_2]);
  assert.deepStrictEqual(res.rejectedAddOnIds, [GUID_3]);
  const capped = BU.resolveAddOnIds(catalog, [GUID_1, GUID_2], 1);
  assert.deepStrictEqual(capped.addOnIds, [GUID_1]);
});

test('BUTIL-AMOUNT-01 service total is persisted from the canonical catalog price', () => {
  assert.deepStrictEqual(
    BU.calculateBookingAmount({ price: 19, addOnOptions: [] }, []),
    {
      totalAmount: 19,
      amountSource: 'SERVICIOS_CATALOGO',
      amountReconciliationRequired: false,
      missingAddonIds: [],
    }
  );
});

test('BUTIL-AMOUNT-02 selected add-on prices are included exactly once', () => {
  const result = BU.calculateBookingAmount({
    price: 42,
    addOnOptions: [
      { addonId: GUID_1, name: 'Tratamiento', price: 5 },
      { addonId: GUID_2, name: 'Extra', price: 15 },
    ],
  }, [GUID_1, GUID_2, GUID_1]);
  assert.equal(result.totalAmount, 62);
  assert.equal(result.amountReconciliationRequired, false);
  assert.deepStrictEqual(result.missingAddonIds, []);
});

test('BUTIL-AMOUNT-03 unknown add-on price is flagged instead of silently undercharging', () => {
  const result = BU.calculateBookingAmount({
    price: 19,
    addOnOptions: [],
  }, [GUID_3]);
  assert.equal(result.totalAmount, 19);
  assert.equal(result.amountReconciliationRequired, true);
  assert.deepStrictEqual(result.missingAddonIds, [GUID_3]);
});

test('BUTIL-AMOUNT-04 missing base price is flagged for reconciliation', () => {
  const result = BU.calculateBookingAmount({ addOnOptions: [] }, []);
  assert.equal(result.totalAmount, 0);
  assert.equal(result.amountReconciliationRequired, true);
});

// ---------------------------------------------------------------------------
// DURACION FASE VINCULADA (F2) con guardia de ciclos
// ---------------------------------------------------------------------------

test('BUTIL-F2DUR-01 requires explicit positive phase2Duration (no fallback)', async () => {
  const svc = (data) => async () => ({ status: 'SUCCESS', data });
  assert.strictEqual(await BU.resolveLinkedPhase2Duration(GUID_1, 't', new Set(), svc({ phase2Duration: 45, totalDuration: 90 })), 45);
  assert.strictEqual(await BU.resolveLinkedPhase2Duration(GUID_1, 't', new Set(), svc({ totalDuration: 90 })), 0);
  assert.strictEqual(await BU.resolveLinkedPhase2Duration(GUID_1, 't', new Set(), svc({ phase1Duration: 30 })), 0);
  assert.strictEqual(await BU.resolveLinkedPhase2Duration(GUID_1, 't', new Set(), svc({ phase2Duration: 0, totalDuration: 90 })), 0);
  assert.strictEqual(await BU.resolveLinkedPhase2Duration(GUID_1, 't', new Set(), svc({})), 0);
});

test('BUTIL-F2DUR-02 cycle in visited set returns 0 without calling service', async () => {
  let called = 0;
  const fn = async () => { called += 1; return { status: 'SUCCESS', data: { phase2Duration: 10 } }; };
  const visited = new Set([GUID_1]);
  const out = await BU.resolveLinkedPhase2Duration(GUID_1, 't', visited, fn);
  assert.strictEqual(out, 0);
  assert.strictEqual(called, 0, 'guarda de ciclo: sin llamada al catalogo');
});

test('BUTIL-F2DUR-03 non-GUID or failing service fn degrade to 0 (never throws)', async () => {
  assert.strictEqual(await BU.resolveLinkedPhase2Duration('texto', 't', new Set(), async () => ({ status: 'SUCCESS', data: {} })), 0);
  assert.strictEqual(await BU.resolveLinkedPhase2Duration(GUID_1, 't', new Set(), async () => { throw new Error('boom'); }), 0);
  assert.strictEqual(await BU.resolveLinkedPhase2Duration(GUID_1, 't', new Set(), null), 0);
});

// ---------------------------------------------------------------------------
// BOOKING CORE: bookedAddOns body shape (SAGA-14: nivel raiz, no en slot)
// ---------------------------------------------------------------------------

test('BCORE-ADDONBODY-01 _buildBookedAddOns emits root-level addOn array', () => {
  const built = BC._buildBookedAddOns([GUID_1, GUID_2]);
  assert.ok(Array.isArray(built));
  assert.strictEqual(built.length, 2);
  for (const item of built) {
    assert.ok(item && typeof item === 'object');
    const vals = JSON.stringify(item);
    assert.ok(vals.includes(GUID_1) || vals.includes(GUID_2));
  }
  assert.deepStrictEqual(BC._buildBookedAddOns([]), []);
  assert.deepStrictEqual(BC._buildBookedAddOns(null), []);
});

// ---------------------------------------------------------------------------
// SAGA: compuertas de validacion fail-closed (PHASE 0)
// CONTRATO (verificado 2026-10-14): executeBookingSaga NUNCA lanza hacia el
// caller. El catch exterior normaliza cualquier error interno (incluidos los
// createBookingError del Phase 0) y lo devuelve como envelope
// { status:'ERROR', data:null, error:{ code, message } }. Los tests de la
// version inicial asumian throw -> 4 falsos negativos (hallazgo LH-08/T).
// Ademas, bookingSaga importa los internos de reservas.web.js; bajo el stub
// generico del loader esos internos devuelven MOCK_NO_HANDLER, por lo que
// para las compuertas posteriores a email/RGPD hay que registrar overrides
// minimos (LH-08 webMethods.register) que simulen el contrato real:
//   _resolveServiceIdInternal(slug) -> id o '' si desconocido
//   _getServiceBySlugOrIdInternal(id) -> { status:'OK', data: servicio }
// ---------------------------------------------------------------------------

const RESERVAS_SPEC = 'backend/reservas.web.js';

function seedPaymentTestService(serviceId, overrides = {}) {
  const row = {
    _id: serviceId,
    serviceId,
    slug: null,
    title: 'Servicio de prueba',
    description: null,
    tagLine: null,
    price: 50,
    currency: 'EUR',
    location: 'Zaragoza',
    locationId: GUID_2,
    mainMedia: null,
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
    ...overrides,
  };
  wixDataMock._store.set('ServiciosCatalogo', [row]);
}

async function sagaEnvelope(payload) {
  // Devuelve el envelope retornado por la saga; falla el test si la
  // produccion cambia a throw sin actualizar este contrato.
  return await BS.executeBookingSaga(payload);
}

function assertRejected(env, expectedCodePart, msg) {
  assert.ok(env && env.status === 'ERROR', msg + ' (status=' + (env && env.status) + ')');
  assert.ok(env.error && env.error.message, msg + ' (falta message)');
  const hay = (env.error.code || '') + ' ' + env.error.message;
  assert.ok(new RegExp(expectedCodePart, 'i').test(hay), msg + ': ' + hay);
}

test('BSAGA-VAL-01 missing email rejected INVALID_PAYLOAD before any SDK call', async () => {
  wixDataMock._reset();
  const env = await sagaEnvelope({ rgpdConsent: true, traceId: 'tr-1' });
  assertRejected(env, 'INVALID_PAYLOAD|email', 'debe rechazar sin email');
  assert.match(env.error.message, /email/i);
});

test('BSAGA-VAL-02 missing RGPD consent rejected (LOPD gate)', async () => {
  wixDataMock._reset();
  const env = await sagaEnvelope({ email: 'a@b.com', traceId: 'tr-2' });
  assertRejected(env, 'rgpd', 'debe rechazar sin consentimiento RGPD');
});

test('BSAGA-VAL-03 unknown service slug rejected SERVICE_NOT_FOUND', async () => {
  wixDataMock._reset();
  // Override: slug desconocido -> resolucion vacia (contrato reservas.web.js)
  mocks.webMethods.register(RESERVAS_SPEC, '_resolveServiceIdInternal', async (raw) => raw === GUID_1 ? GUID_1 : '');
  try {
    const env = await sagaEnvelope({
      email: 'a@b.com', rgpdConsent: true, serviceId: 'slug-inexistente',
      slotF1: { localStartDate: '2026-10-15T09:00:00', localEndDate: '2026-10-15T10:00:00' },
      traceId: 'tr-3',
    });
    assertRejected(env, 'SERVICE_NOT_FOUND', 'debe rechazar servicio inexistente');
  } finally {
    mocks.webMethods.clear();
  }
});

test('BSAGA-VAL-04 inverted F1 dates rejected INVALID_DATES', async () => {
  wixDataMock._reset();
  mocks.webMethods.register(RESERVAS_SPEC, '_resolveServiceIdInternal', async (raw) => raw === GUID_1 ? GUID_1 : '');
  mocks.webMethods.register(RESERVAS_SPEC, '_getServiceBySlugOrIdInternal', async () => ({
    status: 'OK', data: { _id: GUID_1, allowCombine: false }, error: null,
  }));
  try {
    const env = await sagaEnvelope({
      email: 'a@b.com', rgpdConsent: true, serviceId: GUID_1,
      slotF1: { localStartDate: '2026-10-15T10:00:00', localEndDate: '2026-10-15T09:00:00' },
      traceId: 'tr-4',
    });
    assertRejected(env, 'INVALID_DATES', 'debe rechazar fechas invertidas');
  } finally {
    mocks.webMethods.clear();
  }
});

test('BSAGA-VAL-05 contract freeze: saga returns envelope, never throws', async () => {
  wixDataMock._reset();
  // Payload totalmente invalido (null): el contrato exige envelope ERROR,
  // no excepcion. Regresion guard ante refactor que cambie throw-vs-return.
  let threw = false;
  let env = null;
  try {
    env = await BS.executeBookingSaga(null);
  } catch (e) {
    threw = true;
  }
  assert.ok(!threw, 'executeBookingSaga no debe lanzar (contrato envelope)');
  assert.strictEqual(env.status, 'ERROR');
  assert.ok(env.error && env.error.code, 'error.code presente');
});

test('BSAGA-PAY-01 online channel is rejected when service disables online payment', async () => {
  wixDataMock._reset();
  const serviceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01';
  seedPaymentTestService(serviceId, { onlinePayment: false });
  try {
    const env = await sagaEnvelope({
      email: 'client@example.com',
      rgpdConsent: true,
      serviceId,
      channelType: IC.CHANNEL_TYPE.ONLINE,
      slotF1: { localStartDate: '2026-10-15T09:00:00', localEndDate: '2026-10-15T10:00:00' },
      traceId: 'tr-pay-1',
    });
    assertRejected(env, 'INVALID_PAYLOAD|online payment is disabled', 'online desactivado debe rechazarse');
  } finally {
    mocks.webMethods.clear();
  }
});

test('BSAGA-PAY-02 in-person channel is rejected when service disables in-person payment', async () => {
  wixDataMock._reset();
  const serviceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02';
  seedPaymentTestService(serviceId, { inPersonPayment: false });
  try {
    const env = await sagaEnvelope({
      email: 'client@example.com',
      rgpdConsent: true,
      serviceId,
      channelType: IC.CHANNEL_TYPE.PRESENCIAL,
      slotF1: { localStartDate: '2026-10-15T09:00:00', localEndDate: '2026-10-15T10:00:00' },
      traceId: 'tr-pay-2',
    });
    assertRejected(env, 'INVALID_PAYLOAD|in-person payment is disabled', 'presencial desactivado debe rechazarse');
  } finally {
    mocks.webMethods.clear();
  }
});

test('BSAGA-PAY-03 rejects unknown channel values instead of treating them as in-person', async () => {
  wixDataMock._reset();
  const serviceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03';
  seedPaymentTestService(serviceId);
  try {
    const env = await sagaEnvelope({
      email: 'client@example.com',
      rgpdConsent: true,
      serviceId,
      channelType: 'WIX_PAYMENTS',
      slotF1: { localStartDate: '2026-10-15T09:00:00', localEndDate: '2026-10-15T10:00:00' },
      traceId: 'tr-pay-3',
    });
    assertRejected(env, 'INVALID_PAYLOAD|invalid payment channel', 'canal desconocido debe rechazarse');
  } finally {
    mocks.webMethods.clear();
  }
});

// ---------------------------------------------------------------------------
// SAGA ORCHESTRATOR: compensacion LIFO, tolerante a fallos del compensador
// ---------------------------------------------------------------------------

test('BSAGA-ORCH-01 success path returns ordered results, no compensation', async () => {
  const trail = [];
  const o = new BS.BookingSagaOrchestrator('tr-o1');
  o.addStep('A', async () => { trail.push('execA'); return 1; }, async () => trail.push('compA'));
  o.addStep('B', async () => { trail.push('execB'); return 2; }, async () => trail.push('compB'));
  const results = await o.execute();
  assert.deepStrictEqual(results, [1, 2]);
  assert.deepStrictEqual(trail, ['execA', 'execB']);
});

test('BSAGA-ORCH-02 mid-failure compensates completed steps in reverse order', async () => {
  const trail = [];
  const o = new BS.BookingSagaOrchestrator('tr-o2');
  o.addStep('Lock', async () => 'L', async (r) => trail.push('un:' + r));
  o.addStep('CreateF1', async () => 'F1', async (r) => trail.push('cancel:' + r));
  o.addStep('CreateF2', async () => { throw new Error('fallo F2'); }, async () => trail.push('cancel:F2'));
  await assert.rejects(() => o.execute(), /fallo F2/);
  assert.deepStrictEqual(trail, ['cancel:F1', 'un:L'], 'orden LIFO estricto');
});

test('BSAGA-ORCH-03 compensation failure is swallowed (best-effort) not masked', async () => {
  const o = new BS.BookingSagaOrchestrator('tr-o3');
  o.addStep('A', async () => 'ok', async () => { throw new Error('comp boom'); });
  o.addStep('B', async () => { throw new Error('orig'); });
  await assert.rejects(() => o.execute(), /orig/, 'el error original propaga');
});

// ---------------------------------------------------------------------------
// META normalization (persisted meta string/object robustez)
// ---------------------------------------------------------------------------

test('BSAGA-META-01 _normalizePersistedMeta accepts JSON string, object, garbage', () => {
  assert.deepStrictEqual(BS._normalizePersistedMeta('{"pairToken":"p1"}'), { pairToken: 'p1' });
  assert.deepStrictEqual(BS._normalizePersistedMeta({ a: 1 }), { a: 1 });
  assert.deepStrictEqual(BS._normalizePersistedMeta('{no-json'), {});
  assert.deepStrictEqual(BS._normalizePersistedMeta('[1,2]'), {});
  assert.deepStrictEqual(BS._normalizePersistedMeta(null), {});
});


// ---------------------------------------------------------------------------
// LOAD RANKING AND GAP LOCK CONTRACT
// ---------------------------------------------------------------------------

test('BUTIL-RANK-01 shared ranking sorts by booked minutes then stable staff name', () => {
  const ranked = BU._rankResourcesByLoad(
    [GUID_1, GUID_2, GUID_3],
    { [GUID_1]: 90, [GUID_2]: 30, [GUID_3]: 30 },
    { [GUID_1]: 'Ana', [GUID_2]: 'Zoe', [GUID_3]: 'Bea' },
  );
  assert.deepStrictEqual(ranked, [GUID_3, GUID_2, GUID_1]);

  const invalidLoad = BU._rankResourcesByLoad(
    [GUID_1, GUID_2],
    { [GUID_1]: NaN, [GUID_2]: 30 },
    { [GUID_1]: 'Ana', [GUID_2]: 'Zoe' },
  );
  assert.deepStrictEqual(invalidLoad, [GUID_2, GUID_1], 'unknown load must rank last');
});

test('GAP-LOCK-01 saga mutex locks only F1 and F2, not the exposure interval', () => {
  const phases = [
    {
      rawSlot: { serviceId: GUID_1 },
      localStart: '2026-10-20T09:00:00',
      localEnd: '2026-10-20T09:30:00',
    },
    {
      rawSlot: { serviceId: GUID_2 },
      localStart: '2026-10-20T10:00:00',
      localEnd: '2026-10-20T10:40:00',
    },
  ];
  const keys = BC._buildLockKeys(phases, GUID_3);
  const expected = [
    BC.generateSlotKey(GUID_1, GUID_3, phases[0].localStart, phases[0].localEnd),
    BC.generateSlotKey(GUID_2, GUID_3, phases[1].localStart, phases[1].localEnd),
  ].sort();

  assert.deepStrictEqual(keys, expected);
  assert.strictEqual(keys.length, 2, 'must create locks for the two occupied phases only');
  assert.ok(!keys.some((key) => key.includes('2026-10-20T09:30:00') || key.includes('2026-10-20T10:00:00_')), 'no third lock for gap');
});
