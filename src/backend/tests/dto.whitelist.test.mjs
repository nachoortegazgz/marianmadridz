/*
=============================================================================
SUITE: dto.whitelist (FASE3/4 mandatory contract test)
Purpose: no public webMethod response may leak internal/fiscal fields:
margin, internalNotes, tipoImpositivo, codigoImpuesto, payloadFiscal,
nifEmisor, cuentaContable*, previousRecordHash. recordHash is ONLY allowed
in the Verifactu receipt DTO (AEAT public QR contract).
Runs offline via tests/loader.mjs mocks. G10 ASCII strict.
=============================================================================
*/
import test from 'node:test';
import assert from 'node:assert';

const { wixDataMock, mocks } = await import('./loader.mjs');
// ADR-06 Etapa A: convencion unica backend/<modulo>.web.js (incl. tests)
const RW = await import('backend/reservas.web.js');
const CW = await import('backend/cajas.web.js');
const IC = await import('backend/internalConfig');

const FORBIDDEN_KEYS = [
  'margin', 'internalNotes', 'tipoImpositivo', 'codigoImpuesto',
  'payloadFiscal', 'nifEmisor', 'previousRecordHash',
  'cuentaContableContrapartida', 'cuentaContableCliente', 'cuentaContableIngresos',
];

// RES-30 (P0): el bookingId NO es credencial. La superficie publica exige
// token opaco de un solo uso emitido por generateDisplayToken sobre una
// reserva CONFIRMED existente. Helper shared por los DTO tests.
// AUDIT-TOKEN-P0-01: la emision exige ademas identidad de miembro PROPIETARIO
// (o credencial previa para anonimos). Los fixtures sembrados son huerfanos
// (sin contactDetails.memberId), asi que la via de emision en test es la del
// miembro autenticado propietario: se siembra el memberId y se simula la
// sesion via __mmMembersState (contrato loader LH-24).
const OWNER_MEMBER_ID = 'member-owner-dto-0001';

function resetRateLimitRows() {
  const collection = IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
  const rows = wixDataMock._store.get(collection) || [];
  wixDataMock._store.set(collection, rows.filter((row) => row.controlType !== 'RATE_LIMIT'));
}

function mockVisitor(memberId) {
  globalThis.__mmMembersState._current = memberId
    ? { _id: memberId }
    : null;
}

async function issueToken(bookingId, { ownerId = OWNER_MEMBER_ID } = {}) {
  // Reset only the persistent RATE_LIMIT test rows; preserve booking fixtures.
  resetRateLimitRows();
  // Semilla de propiedad fail-closed: la reserva debe tener dueno conocido.
  const rows = wixDataMock._store.get(IC.BUSINESS_COLLECTIONS.CITAS_F2) || [];
  const rec = rows.find((r) => r.bookingId === bookingId);
  if (rec && ownerId) rec.contactDetails = { ...(rec.contactDetails || {}), memberId: ownerId };
  mockVisitor(ownerId || null);
  try {
    const gen = await RW.generateDisplayToken({ bookingId });
    assert.strictEqual(gen.ok, true, `token issuance failed: ${gen.error}`);
    return gen.token;
  } finally {
    mockVisitor(null);
    resetRateLimitRows();
  }
}

// RES-30 (P0): el bookingId NO es credencial y ademas debe pasar la validacion
// de forma _looksLikeGuid (mismo estandar que la superficie publica canonesa
// probada en reservas.web.test.mjs con GUID_OK). Los ids legibles tipo
// 'BK-77' quedan rechazados en INVALID_PAYLOAD fail-fast (anti-enumeracion).
const DTO_GUID_1 = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001';
const DTO_GUID_2 = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0002';
const DTO_GUID_3 = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0003';
const DTO_GUID_LEGACY = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0004';

function _deepKeys(obj, acc = []) {
  if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      acc.push(k);
      _deepKeys(obj[k], acc);
    }
  }
  return acc;
}

test('DTO-01 getConfirmedBookingForDisplay returns whitelisted DTO only', async () => {
  wixDataMock._reset();
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.CITAS_F2, [{
    _id: 'r1',
    bookingId: DTO_GUID_1,
    bookingStatus: 'CONFIRMED',
    paymentStatus: 'PAID',
    pairToken: 'PT-1',
    serviceId: 'SVC-9',
    dateYmd: '2026-10-05',
    slotStart: '2026-10-05T10:00:00Z',
    slotEnd: '2026-10-05T11:00:00Z',
    resourceId: 'RES-2',
    totalPrice: 4500,
    // fields that MUST NOT leak:
    margin: 1200,
    internalNotes: 'notas internas',
    tipoImpositivo: 21,
    payloadFiscal: { x: 1 },
    nifEmisor: 'B12345678',
    previousRecordHash: 'abc',
  }]);
  // RES-30/31: la superficie publica de display exige token opaco.
  const displayToken = await issueToken(DTO_GUID_1);
  const res = await RW.getConfirmedBookingForDisplay({ displayToken });
  assert.strictEqual(res.ok, true, JSON.stringify(res));
  const keys = _deepKeys(res.data);
  for (const bad of FORBIDDEN_KEYS) {
    assert.ok(!keys.includes(bad), `leaked forbidden key: ${bad}`);
  }
  assert.strictEqual(res.data.bookingId, DTO_GUID_1);
  assert.strictEqual(res.data.bookingStatus, 'CONFIRMED');
});

// DTO-02 (actualizado v12): la rama legacy rec.status fue ELIMINADA del
// lector canonico por RES-R3-13 (CitasF2 usa bookingStatus como KEY FIELD).
// El test ahora verifica el contrato vigente: fila canonical legible +
// proyeccion whitelist; y como asercion negativa que una fila SOLO legacy
// 'status' ya NO es visible (comportamiento deliberado post-v12).
test('DTO-02 canonical bookingStatus row readable via whitelist projection', async () => {
  wixDataMock._reset();
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.CITAS_F2, [{
    _id: 'r2', bookingId: DTO_GUID_2, bookingStatus: 'CONFIRMED', paymentStatus: 'PAID',
    totalAmount: 30, internalNotes: 'x',
  }]);
  const tk2 = await issueToken(DTO_GUID_2);
  const res = await RW.getConfirmedBookingForDisplay({ displayToken: tk2 });
  assert.strictEqual(res.ok, true, JSON.stringify(res));
  assert.strictEqual(res.data.bookingStatus, 'CONFIRMED');
  assert.ok(!_deepKeys(res.data).includes('internalNotes'));
  // Legacy-only row (campo 'status') no proyecta: rama eliminada RES-R3-13.
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.CITAS_F2, [{
    _id: 'r2b', bookingId: DTO_GUID_LEGACY, status: 'CONFIRMED',
  }]);
  // AUDIT-TOKEN-P0-01: el emisor evalua identidad ANTES que estado. Para
  // llegar a NOT_CONFIRMED hay que autenticar como miembro (cualquiera: la
  // verificacion de propiedad es posterior al chequeo de estado en el
  // contrato del emisor). Sin sesion la respuesta correcta y probada en
  // reservas.web (RES-DISPLAY-03) es AUTH_REQUIRED anti-enumeracion.
  mockVisitor(OWNER_MEMBER_ID);
  try {
    const genLegacy = await RW.generateDisplayToken({ bookingId: DTO_GUID_LEGACY });
    assert.strictEqual(genLegacy.ok, false);
    assert.strictEqual(genLegacy.error, 'NOT_CONFIRMED');
  } finally {
    mockVisitor(null);
  }
});

// ============================================================================
// AUDIT-TOKEN-P0-01/02 (P0 SECURITY): autorizacion real de emision y propiedad
// ============================================================================

test('DTO-06 rejects token issuance without ownership (anonymous, no credential)', async () => {
  wixDataMock._reset();
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.CITAS_F2, [{
    _id: 'r6', bookingId: DTO_GUID_1, bookingStatus: 'CONFIRMED',
  }]);
  mockVisitor(null);
  const gen = await RW.generateDisplayToken({ bookingId: DTO_GUID_1 });
  assert.strictEqual(gen.ok, false);
  assert.strictEqual(gen.error, 'AUTH_REQUIRED', 'bookingId alone must never authorize issuance');
});

test('DTO-07 rejects member when booking has no owner (fail-closed)', async () => {
  wixDataMock._reset();
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.CITAS_F2, [{
    _id: 'r7', bookingId: DTO_GUID_1, bookingStatus: 'CONFIRMED',
    // contactDetails SIN memberId: huerfana historica => inaccesible hasta backfill
  }]);
  mockVisitor(OWNER_MEMBER_ID);
  try {
    const gen = await RW.generateDisplayToken({ bookingId: DTO_GUID_1 });
    assert.strictEqual(gen.ok, false);
    assert.strictEqual(gen.error, 'ACCESS_DENIED');
  } finally {
    mockVisitor(null);
  }
});

test('DTO-08 rejects member who is not the booking owner', async () => {
  wixDataMock._reset();
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.CITAS_F2, [{
    _id: 'r8', bookingId: DTO_GUID_1, bookingStatus: 'CONFIRMED',
    contactDetails: { memberId: OWNER_MEMBER_ID },
  }]);
  mockVisitor('member-intruder-9999');
  try {
    const gen = await RW.generateDisplayToken({ bookingId: DTO_GUID_1 });
    assert.strictEqual(gen.ok, false);
    assert.strictEqual(gen.error, 'ACCESS_DENIED');
  } finally {
    mockVisitor(null);
  }
});

test('DTO-09 anonymous visitor with valid prior credential can issue', async () => {
  wixDataMock._reset();
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.CITAS_F2, [{
    _id: 'r9', bookingId: DTO_GUID_1, bookingStatus: 'CONFIRMED',
  }]);
  mockVisitor(null);
  // Credencial previa del flujo de confirmacion por email: su hash coincide
  // con un registro DT_ ya emitido para ESTA reserva (prueba de tenencia).
  const priorCredential = 'CONF-CRED-9911';
  const CWIC = await import('backend/internalConfig');
  const MMU = await import('public/mmUtils.js');
  const CONTROL_COL = CWIC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
  wixDataMock._seed(CONTROL_COL, []);
  const list = wixDataMock._store.get(CONTROL_COL);
  // hash identico al que usa reservas.web (_hashKey de mmUtils)
  const tokenHash = MMU._hashKey(priorCredential);
  list.push({
    _id: `DT_${tokenHash}`, controlType: 'DISPLAY_TOKEN',
    bookingId: DTO_GUID_1, tokenHash, expiresAt: new Date(Date.now() + 60000),
    attempts: 0, maxAttempts: 3, consumedAt: null,
  });
  const gen = await RW.generateDisplayToken({ bookingId: DTO_GUID_1, confirmationToken: priorCredential });
  assert.strictEqual(gen.ok, true, JSON.stringify(gen));
  assert.ok(typeof gen.token === 'string' && gen.token.length > 10);
});

test('DTO-10 anonymous visitor with wrong credential rejected uniformly', async () => {
  wixDataMock._reset();
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.CITAS_F2, [{
    _id: 'r10', bookingId: DTO_GUID_1, bookingStatus: 'CONFIRMED',
  }]);
  mockVisitor(null);
  const gen = await RW.generateDisplayToken({ bookingId: DTO_GUID_1, confirmationToken: 'GUESS-WRONG' });
  assert.strictEqual(gen.ok, false);
  assert.strictEqual(gen.error, 'ACCESS_DENIED');
});

test('DTO-11 token bound to its booking cannot be replayed cross-booking', async () => {
  wixDataMock._reset();
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.CITAS_F2, [
    { _id: 'r11a', bookingId: DTO_GUID_1, bookingStatus: 'CONFIRMED' },
    { _id: 'r11b', bookingId: DTO_GUID_2, bookingStatus: 'CONFIRMED' },
  ]);
  const tk = await issueToken(DTO_GUID_1);
  // El id canonico es el binding del registro DT_, no el payload: presentar
  // bookingId ajeno junto al token NO reasigna el acceso (el token manda).
  const res = await RW.getConfirmedBookingForDisplay({ displayToken: tk, bookingId: DTO_GUID_2 });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.data.bookingId, DTO_GUID_1, 'token binding must win over payload bookingId');
});

test('DTO-12 concurrent double consumption yields exactly one success', async () => {
  wixDataMock._reset();
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.CITAS_F2, [{
    _id: 'r12', bookingId: DTO_GUID_1, bookingStatus: 'CONFIRMED',
  }]);
  const tk = await issueToken(DTO_GUID_1);
  const [a, b] = await Promise.all([
    RW.getConfirmedBookingForDisplay({ displayToken: tk }),
    RW.getConfirmedBookingForDisplay({ displayToken: tk }),
  ]);
  const oks = [a, b].filter((r) => r.ok === true).length;
  assert.strictEqual(oks, 1, `single-use violated: ${oks} successes`);
});

test('DTO-03 non-displayable booking states are hidden', async () => {
  wixDataMock._reset();
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.CITAS_F2, [{
    _id: 'r3', bookingId: DTO_GUID_3, bookingStatus: 'CANCELED',
  }]);
  // AUDIT-TOKEN-P0-01: identidad antes que estado. Autenticando como miembro
  // se supera el gate AUTH_REQUIRED y el emisor revela NOT_CONFIRMED (la
  // reserva existe pero no es mostrable). Sin sesion la respuesta seria
  // AUTH_REQUIRED (anti-enumeracion, probado en RES-DISPLAY-03).
  mockVisitor(OWNER_MEMBER_ID);
  try {
    const gen = await RW.generateDisplayToken({ bookingId: DTO_GUID_3 });
    assert.strictEqual(gen.ok, false);
    assert.strictEqual(gen.error, 'NOT_CONFIRMED');
  } finally {
    mockVisitor(null);
  }
  const res = await RW.getConfirmedBookingForDisplay({ bookingId: DTO_GUID_3 });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.error, 'AUTH_REQUIRED');
});

test('DTO-04 getMovimientoByBooking exposes only receipt-safe fields', async () => {
  wixDataMock._reset();
  const mod = await import('backend/cajas.web.js');
  // canonical serialized linkedBookingIds produced by _linkedBookingValue([id])
  const seed = [{
    _id: 'm1',
    // SSOT-KEYFIELD Apartado 5: claves canonicas del ledger (sin alias legacy
    // invoiceNumber/issuerTaxId/invoiceIssueDate).
    numSerieFactura: 'EM-2026-10-00000001',
    nifEmisor: 'B99999999',
    fechaExpedicionFactura: '2026-10-05',
    totalAmount: 45,
    hash: 'HASH1',
    recordTimestamp: '2026-10-05T10:05:00Z',
    operationDescription: 'Cobro reserva BK-80',
    linkedBookingIds: 'BK-80',
    // must not leak:
    tipoImpositivo: 21,
    codigoImpuesto: 'S1',
    payloadFiscal: { firma: 'x' },
    cuentaContableIngresos: '4300',
    previousRecordHash: 'GENESIS',
    internalNotes: 'no publico',
  }];
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA, seed);

  // SiteMember is not sufficient for fiscal-ledger access. Resolve a real
  // authorized cashier/admin identity through the same Bookings staff contract.
  const STAFF_CONTACT_ID = '33333333-3333-4333-8333-333333333333';
  const MARIAN_RESOURCE_ID = 'e556070a-6d6a-402e-8422-11133033ea76';
  globalThis.__mmMembersState._current = {
    _id: 'member-admin-dto-0001',
    contactId: STAFF_CONTACT_ID,
  };
  mocks.sdk['bookings::staffMembers'] = {
    queryStaffMembers: async () => ({
      staffMembers: [{
        _id: '22222222-2222-4222-8222-222222222222',
        resourceId: MARIAN_RESOURCE_ID,
        name: 'Marian',
        serviceProvider: true,
        resource: { workingHoursSchedules: [] },
        associatedWixIdentity: {
          identificationData: { contactId: STAFF_CONTACT_ID },
          connection: { status: 'CONNECTED' },
        },
      }],
      pagingMetadata: { hasNext: false, cursors: {} },
    }),
  };
  const staffModule = await import('../staff.js');
  staffModule.invalidateStaffCache();

  let res;
  try {
    res = await mod.getMovimientoByBooking({ bookingId: 'BK-80' });
  } finally {
    globalThis.__mmMembersState._current = null;
    staffModule.invalidateStaffCache();
  }

  // Envelope canónico de cajas.web.js: {status:'SUCCESS'|'ERROR', meta, data,
  // error:{code,message}}. El test lee el contrato real del módulo (sin alias
  // ok en producción: cero legacy).
  assert.strictEqual(res.status, 'SUCCESS', JSON.stringify(res));
  const keys = _deepKeys(res.data);
  for (const bad of ['tipoImpositivo', 'codigoImpuesto', 'payloadFiscal',
    'cuentaContableIngresos', 'previousRecordHash', 'internalNotes']) {
    assert.ok(!keys.includes(bad), `leaked: ${bad}`);
  }
  assert.strictEqual(res.data.recordHash, 'HASH1'); // AEAT QR field projected from canonical ledger hash
});

test('DTO-05 missing bookingId rejected without CMS call', async () => {
  wixDataMock._reset();
  const before = wixDataMock._calls.length;
  const a = await RW.getConfirmedBookingForDisplay({});
  const b = await CW.getMovimientoByBooking({});
  assert.strictEqual(a.ok, false);
  assert.strictEqual(b.status, 'ERROR');
  assert.strictEqual(b.error.code, 'INVALID_PAYLOAD');
  assert.strictEqual(wixDataMock._calls.length, before);
});
