/*
=============================================================================
MODULE: backend/tests/site.flows.offline.test.mjs
PURPOSE: Simulacion offline de flujos completos del sitio con mocks funcionales (LH-18).
Cubre los flujos que no tenian test offline continuo:
  FLOW-SEC-*   seguridad/roles (security.js) sobre identidad mockeada
  FLOW-HOR-*   fichaje horario completo (horario.web.js, RD 8/2019)
  FLOW-CAJA-*  caja: alta manual -> estado cajero -> cierre Z -> integridad
               hash-chain (cajas.web.js, Ley 11/2021)
Exige payloads correctos y flujos continuos (cada paso consume el estado
persistido por el anterior en el mock wixData). No usa HTTP: webMethods se
invocan directamente (semantica Velo equivalente).
=============================================================================
*/

import { test, beforeEach } from 'node:test';
import assert from 'node:assert';
import { hashChain } from 'backend/securityEngine';

import { wixDataMock, mocks } from './loader.mjs';

beforeEach(() => {
  const rows = wixDataMock._store.get('ControlOperativo') || [];
  wixDataMock._store.set(
    'ControlOperativo',
    rows.filter((row) => row.controlType !== 'RATE_LIMIT'),
  );
});

// ---------------------------------------------------------------------------
// Helpers de seed/identidad
// ---------------------------------------------------------------------------

const GUID_MEMBER = '22222222-2222-4222-8222-222222222222';
const GUID_CONTACT = '55555555-5555-4555-8555-555555555555';
const GUID_OTHER_CONTACT = '66666666-6666-4666-8666-666666666666';
const GUID_RESOURCE = '07f7344f-e7e4-4c53-854b-47fd82ac8d40';
const GUID_ADMIN_RESOURCE = 'e556070a-6d6a-402e-8422-11133033ea76';

// Native Wix Bookings and Contacts API response fixtures.
let _seedCounter = 0;
async function seedStaff(overrides = {}) {
  const rec = {
    siteMemberId: GUID_MEMBER,
    contactId: GUID_CONTACT,
    resourceId: GUID_RESOURCE,
    email: 'marta@test.local',
    displayName: 'Marta',
    scheduleId: 'sched-1',
    ...overrides,
  };
  const staffMember = {
    id: '44444444-4444-4444-8444-' + String(++_seedCounter).padStart(12, '0'),
    resourceId: rec.resourceId,
    name: rec.displayName,
    email: rec.email,
    serviceProvider: true,
    resource: {
      id: rec.resourceId,
      workingHoursSchedules: [{ id: rec.scheduleId }],
      eventsSchedule: { id: rec.scheduleId },
    },
    associatedWixIdentity: {
      identificationData: {
        contactId: rec.contactId,
        identityType: 'MEMBER',
        wixUserId: '77777777-7777-4777-8777-777777777777',
      },
      connectionStatus: 'CONNECTED',
      connection: { status: 'CONNECTED' },
    },
  };
  mocks.sdk['bookings::staffMembers'] = {
    queryStaffMembers: async (query = {}) => {
      const requested = query?.filter?.resourceId;
      const requestedId = requested && typeof requested === 'object'
        ? String(requested.$eq || '')
        : String(requested || '');
      const staffMembers = requestedId && staffMember.resourceId !== requestedId
        ? []
        : [staffMember];
      return { staffMembers, pagingMetadata: { hasNext: false, cursors: {} } };
    },
  };
  mocks.sdk['crm::contactsV5'] = {
    getContact: async (contactId) => {
      if (String(contactId) !== rec.contactId) {
        throw Object.assign(new Error('CONTACT_NOT_FOUND'), { code: 'CONTACT_NOT_FOUND' });
      }
      return { memberInfo: { memberId: rec.siteMemberId } };
    },
  };
  const st = await import('backend/staff.js');
  if (typeof st.invalidateStaffCache === 'function') st.invalidateStaffCache();
  return rec;
}
function setMember(member) {
  // LH-18: mocks.members getter returns membersMockState; set ._current.
  mocks.members._current = member;
}

function seedCajaPrincipal() {
  const rows = wixDataMock._store.get('CajaActual') || [];
  if (rows.some((row) => row.singletonKey === 'CAJA_PRINCIPAL')) return;
  const operationDate = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  wixDataMock._store.set('CajaActual', [{
    _id: 'SINGLE_ITEM_ID',
    singletonKey: 'CAJA_PRINCIPAL',
    isOpen: true,
    cashRegisterStatus: 'ABIERTA',
    operationDate,
    openedAt: new Date(Date.now() - 60_000),
    openedBy: GUID_ADMIN_RESOURCE,
    openingAmount: 300,
    cashAmount: 300,
    netAmount: 300,
    totalInAmount: 300,
    expectedCash: 300,
    cardAmount: 0,
    voucherAmount: 0,
    otherAmount: 0,
    salesCount: 0,
    sequenceCounters: {},
  }]);
}

// LH-18b: secrets fiscales validos (>=32 chars key, >=9 NIF) + invalidacion
// de la cache interna de cajas.web para que el flujo offline vea los overrides.
async function setupFiscalSecrets() {
  const state = globalThis.__mmSecretsState || (globalThis.__mmSecretsState = { _map: {}, _default: 'mock-secret' });
  state._map.SECRET_FISCALKEY = 'A'.repeat(40);
  state._map.FISCAL_NIF_EMISOR = 'B12345678';
  // LH-19 (FLOW-CAJA-01): el signer X.509 delegado es un microservicio externo;
  // en offline offline se mockea su contrato HTTP (POST {hash,...} -> {signature}).
  state._map.FISCAL_SIGNER_ENDPOINT = 'https://signer.mock.local/sign';
  state._map.FISCAL_SIGNER_BEARER = 'mock-bearer-token';
  if (!globalThis.__mmSignerFetchInstalled) {
    globalThis.__mmSignerFetchInstalled = true;
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      if (String(url).startsWith('https://signer.mock.local/')) {
        const body = JSON.parse(opts?.body || '{}');
        if (!body.hash) return { ok: false, status: 400, text: async () => 'missing hash' };
        const signature = 'MOCKX509SIG:' + String(body.hash).slice(0, 16);
        return {
          ok: true,
          status: 200,
          json: async () => ({ signature }),
          text: async () => JSON.stringify({ signature }),
        };
      }
      return realFetch ? realFetch(url, opts) : Promise.reject(new Error('offline fetch: ' + url));
    };
  }
  const cajas = await import('backend/cajas.web.js');
  if (typeof cajas._invalidateSecretCache === 'function') cajas._invalidateSecretCache();
}

async function freshImports() {
  // Each flow test imports modules fresh per process run is not possible in a
  // single node:test file (ESM cache). Modules are stateless w.r.t. identity
  // (they call members.getCurrentMember() per request), so one import shared
  // across tests is faithful to the runtime.
  const security = await import('backend/security');
  const horario = await import('backend/horario.web.js');
  const cajas = await import('backend/cajas.web.js');
  const engine = await import('backend/securityEngine');
  return { security, horario, cajas, engine };
}

// ===========================================================================
// FLOW-SEC: roles resueltos por identidad actual (security.js)
// ===========================================================================

test('FLOW-SEC-01 sin miembro => todos los guards deniegan acceso', async () => {
  const { security } = await freshImports();
  setMember(null);
  assert.strictEqual(await security.isAdmin(), false);
  assert.strictEqual(await security.isCajero(), false);
  assert.strictEqual(await security.isStaffCollaborator(), false);
  assert.strictEqual(await security.getMyStaffContext(), null);
  await assert.rejects(() => security.requireAdmin(), /ACCESS_DENIED/);
});

test('FLOW-SEC-02 miembro con ficha ESTILISTA => colaborator si, admin no', async () => {
  wixDataMock._reset();
  await seedStaff();
  setMember({ _id: GUID_MEMBER, contactId: GUID_CONTACT, loginEmail: 'marta@test.local' });
  const { security } = await freshImports();
  assert.strictEqual(await security.isStaffCollaborator(), true);
  assert.strictEqual(await security.isEstilista(), true);
  assert.strictEqual(await security.isAdmin(), false);
  const ctx = await security.getMyStaffContext();
  assert.strictEqual(ctx.resourceId, GUID_RESOURCE);
  assert.strictEqual(ctx.displayName, 'Marta');
});

test('FLOW-SEC-03 contactId joins Wix member and Bookings staff identities', async () => {
  wixDataMock._reset();
  await seedStaff({ resourceId: GUID_ADMIN_RESOURCE });
  setMember({ _id: GUID_MEMBER, contactId: GUID_CONTACT, loginEmail: 'marta@test.local' });
  const { security } = await freshImports();
  assert.strictEqual(await security.isAdmin(), true);
  const ctx = await security.getMyStaffContext();
  assert.strictEqual(ctx.memberId, GUID_MEMBER, 'context returns the authenticated site-member ID');
  assert.strictEqual(ctx.contactId, GUID_CONTACT, 'staff linkage uses the distinct contact ID');
});

test('FLOW-SEC-03b same email cannot replace a mismatched contact identity', async () => {
  wixDataMock._reset();
  await seedStaff({ resourceId: GUID_ADMIN_RESOURCE, contactId: GUID_OTHER_CONTACT });
  setMember({ _id: GUID_MEMBER, contactId: GUID_CONTACT, loginEmail: 'marta@test.local' });
  const { security } = await freshImports();
  assert.strictEqual(await security.isAdmin(), false);
  assert.strictEqual(await security.isStaffCollaborator(), false);
});

test('FLOW-SEC-04 only the canonical owner role can operate the cash register', async () => {
  const { security } = await freshImports();
  wixDataMock._reset();
  await seedStaff({ resourceId: GUID_ADMIN_RESOURCE });
  setMember({ _id: GUID_MEMBER, contactId: GUID_CONTACT, loginEmail: 'marta@test.local' });
  assert.strictEqual(await security.requireCajero(), true, 'Marian is authorized by canonical resource role');

  wixDataMock._reset();
  await seedStaff();
  setMember({ _id: GUID_MEMBER, contactId: GUID_CONTACT, loginEmail: 'marta@test.local' });
  await assert.rejects(() => security.requireCajero(), /ACCESS_DENIED: CAJERO/);
});

// ===========================================================================
// FLOW-HOR: fichaje horario completo (horario.web.js) - RD 8/2019
// ===========================================================================

test('FLOW-HOR-01 context is read-only while timeclock writer remains fail-closed', async () => {
  wixDataMock._reset();
  await seedStaff();
  setMember({ _id: GUID_MEMBER, contactId: GUID_CONTACT, loginEmail: 'marta@test.local' });
  const { horario } = await freshImports();

  const ctxRes = await horario.getMyStaffContext({ traceId: 'flow-hor-ctx' });
  assert.strictEqual(ctxRes.status, 'OK');
  assert.strictEqual(ctxRes.data.resourceId, GUID_RESOURCE);

  const inRes = await horario.registrarFichaje({ clockEventType: 'ENTRADA', userAgent: 'offline-test' });
  assert.strictEqual(inRes.status, 'ERROR');
  assert.strictEqual(inRes.error.code, 'CLOCKING_WRITES_DISABLED');
  assert.strictEqual((wixDataMock._store.get('RegistrosHorariosStaff') || []).length, 0);

  const state = await horario.getEstadoJornada({});
  assert.strictEqual(state.status, 'OK');
  assert.strictEqual(state.data.estado, 'SIN_INICIAR');
  assert.strictEqual(state.data.totalFichajes, 0);

  const history = await horario.getHistorialFichajes({ dayKey: state.data.dayKey });
  assert.strictEqual(history.status, 'OK');
  assert.strictEqual((history.data?.items || []).length, 0);
});

test('FLOW-HOR-02 staff writer is blocked before validating or inserting a command', async () => {
  wixDataMock._reset();
  await seedStaff();
  setMember({ _id: GUID_MEMBER, contactId: GUID_CONTACT, loginEmail: 'marta@test.local' });
  const { horario } = await freshImports();
  const before = (wixDataMock._store.get('RegistrosHorariosStaff') || []).length;
  const result = await horario.registrarFichaje({ clockEventType: 'NOEXISTE' });
  assert.strictEqual(result.status, 'ERROR');
  assert.strictEqual(result.error.code, 'CLOCKING_WRITES_DISABLED');
  assert.strictEqual((wixDataMock._store.get('RegistrosHorariosStaff') || []).length, before);
});

test('FLOW-HOR-03 miembro sin ficha staff => NOT_STAFF (no 500)', async () => {
  wixDataMock._reset();
  setMember({ _id: 'ffffffff-0000-4000-8000-ffffffffffff', contactId: GUID_OTHER_CONTACT, loginEmail: 'nadie@test.local' });
  const { horario } = await freshImports();
  const res = await horario.registrarFichaje({ clockEventType: 'ENTRADA' });
  assert.strictEqual(res.status, 'ERROR');
  assert.strictEqual(res.error.code, 'NOT_STAFF');
});

test('FLOW-STAFF-01 native staff identity and site-member ID resolve through canonical Contacts API', async () => {
  wixDataMock._reset();
  await seedStaff();
  const staffApi = await import('backend/staff.js');
  const staff = await staffApi.findStaffByContactId(GUID_CONTACT);
  assert.strictEqual(staff.contactId, GUID_CONTACT);
  assert.strictEqual(staff.resourceId, GUID_RESOURCE);
  assert.strictEqual(staff.roleWebsite, 'ESTILISTA');
  assert.strictEqual(staff.memberId, undefined, 'Bookings does not provide a site-member ID');
  assert.strictEqual(await staffApi.getSiteMemberIdByContactId(GUID_CONTACT), GUID_MEMBER);
});

test('FLOW-HOR-04 manager timeclock adjustments remain fail-closed until append-only correction QA', async () => {
  wixDataMock._reset();
  await seedStaff({ resourceId: GUID_ADMIN_RESOURCE });
  setMember({ _id: GUID_MEMBER, contactId: GUID_CONTACT, loginEmail: 'marta@test.local' });
  const { horario } = await freshImports();

  const result = await horario.registrarAjusteHorario({
    resourceId: GUID_ADMIN_RESOURCE,
    clockEventType: 'ENTRADA',
    adjustmentReason: 'Corrección de fichaje en prueba',
    traceId: 'flow-hor-adjustment',
  });
  assert.strictEqual(result.status, 'ERROR');
  assert.strictEqual(result.error.code, 'CLOCKING_ADJUSTMENTS_DISABLED');
  assert.strictEqual((wixDataMock._store.get('RegistrosHorariosStaff') || []).length, 0);
});

// ===========================================================================
// FLOW-CAJA: ledger manual -> estado -> cierre Z -> verificacion cadena
// ===========================================================================

test('FLOW-CAJA-01 flujo continuo: venta EFECTIVO -> caja incrementada -> cierre Z -> hash-chain integra', async () => {
  wixDataMock._reset();
  seedCajaPrincipal();
  await seedStaff({ resourceId: GUID_ADMIN_RESOURCE });
  setMember({ _id: GUID_MEMBER, contactId: GUID_CONTACT, loginEmail: 'marta@test.local' });
  const { cajas } = await freshImports();
  await setupFiscalSecrets();

  // Paso 1: alta manual con payload canonic (v5010.7: totalAmount/operationDescription)
  const tx = await cajas.registerManualTransaction({
    totalAmount: 50.0,
    tipoFactura: 'F2',
    operationDescription: 'Venta mostrador offline (SIMULACION PREVIA A DESPLIEGUE REAL)',
    paymentMethod: 'EFECTIVO',
    movementType: 'VENTA',
    tipoImpositivo: 21,
    transactionId: 'offline-tx-0001',
    channelType: 'PRESENCIAL',
    resourceId: 'frontend-resource-id-must-be-ignored',
    linkedBookingIds: [
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    ],
  });
  assert.strictEqual(tx.status, 'SUCCESS', JSON.stringify(tx.error));
  const mov = tx.data;
  const persistedMovement = (wixDataMock._store.get('MovimientosCaja') || [])
    .find((item) => item.transactionId === mov.transactionId);
  assert.ok(persistedMovement?.hash, 'hash canónico persistido en CMS');
  // MovimientosCaja canonicalizes its internal digest as "hash". The
  // public receipt endpoint projects this as "recordHash"; the ledger row
  // itself must not keep the duplicate legacy key.
  assert.ok(mov.hash && mov.previousRecordHash !== undefined && mov.digitalSignature,
    'movimiento con cadena fiscal (hash + previousRecordHash + digitalSignature): ' +
      JSON.stringify({ hash: mov.hash, prh: mov.previousRecordHash, sig: mov.digitalSignature }));
  assert.strictEqual(mov.recordHash, undefined, 'legacy recordHash must not persist on MovimientosCaja');
  assert.strictEqual(mov.paymentMethod, 'EFECTIVO');
  assert.strictEqual(mov.channelType, 'PRESENCIAL');
  assert.strictEqual(mov.staffResourceId, GUID_ADMIN_RESOURCE, 'actor debe venir de la identidad autenticada, no del frontend');
  assert.deepStrictEqual(
    persistedMovement.linkedBookingIds,
    ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
    'booking references must be persisted as a canonical array',
  );
  const linkedMovement = await cajas.getMovimientoByBooking({ bookingId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' });
  assert.strictEqual(linkedMovement.status, 'SUCCESS', 'array booking reference must be queryable');
  const qr = new URL(mov.verificationQR);
  const [qrYear, qrMonth, qrDay] = String(mov.fechaExpedicionFactura).slice(0, 10).split('-');
  assert.equal(qr.searchParams.get('fecha'), `${qrDay}-${qrMonth}-${qrYear}`);
  assert.equal(qr.searchParams.get('importe'), '50.00');
  assert.ok(mov.operationDescription.includes('(SIMULACION PREVIA A DESPLIEGUE REAL)'), 'concepto claramente identificado como simulación');

  // Paso 1b: idempotencia - mismo transactionId devuelve el registro original
  const dup = await cajas.registerManualTransaction({
    totalAmount: 50.0, tipoFactura: 'F2', operationDescription: 'Reintento idempotente (SIMULACION PREVIA A DESPLIEGUE REAL)', paymentMethod: 'EFECTIVO',
    transactionId: 'offline-tx-0001',
  });
  assert.strictEqual(dup.status, 'SUCCESS');
  assert.strictEqual(dup.idempotent, true);

  // Paso 2: getCashierState refleja la operacion (flujo continuo sobre CajaActual)
  const state = await cajas.getCashierState({});
  assert.strictEqual(state.status, 'SUCCESS');
  assert.ok((state.data.totalOperations ?? 0) >= 1, 'operaciones contabilizadas: ' + JSON.stringify(state.data));
  assert.ok(state.data.lastOperation?.movementId === mov._id, 'última operación referencia el movimiento original');
  assert.deepStrictEqual(state.data.lastOperation.sourceMovementIds, [mov._id]);
  assert.strictEqual(state.data.lastOperation.actor.resourceId, GUID_ADMIN_RESOURCE);
  assert.strictEqual(state.data.lastOperation.hash, mov.hash);
  assert.strictEqual(state.data.sessionPayments.EFECTIVO.ticketCount, 1);
  assert.strictEqual(state.data.sessionPayments.EFECTIVO.amount, 50);

  // A read failure must not be represented as a legitimate zero-operation day.
  wixDataMock._findErrors.set('MovimientosCaja', new Error('synthetic CMS read failure'));
  const failedState = await cajas.getCashierState({});
  assert.strictEqual(failedState.status, 'ERROR', 'ledger read failure must fail closed');
  wixDataMock._findErrors.delete('MovimientosCaja');

  // Paso 3: cierre Z del dia de la operacion
  const diaKey = mov.invoiceIssueDate || new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  const z = await cajas.registerZClosing(diaKey, {});
  assert.strictEqual(z.status, 'SUCCESS', JSON.stringify(z.error));
  assert.ok(z.data._id.startsWith('Z_'));

  // Paso 3b: segundo cierre Z mismo dia => Z_ALREADY_CLOSED (invariantismo)
  const z2 = await cajas.registerZClosing(diaKey, {});
  assert.strictEqual(z2.status, 'ERROR');
  assert.strictEqual(z2.error.code, 'Z_ALREADY_CLOSED');

  // Paso 4 (AUDIT-2026-10-14): la caja es un singleton PERMANENTE; el cierre Z
  // de un dia NO la clausura para siempre (la normativa exige que al dia
  // siguiente vuelva a operar). El invariante real es doble:
  //   a) el periodo cerrado queda sellado en HistoricoCierresZ (paso 3b);
  //   b) ventear una venta en ese dia ya cerrado => rechazo determinista.
  // Se usa una fecha historica con cierre Z previo para probar (b) sin
  // acoplar el test a la hora local del runner.
  const diaCerrado = '2020-01-01';
  // Sembrar ANTES del cierre: el cierre Z exige movimientos del dia (NO_MOVEMENTS).
  const movCol = wixDataMock._store.get('MovimientosCaja') || [];
  movCol.push({
    _id: 'mov-hist-2020',
    transactionId: 'qa-historic-close-fixture-2020',
    invoiceIssueDate: diaCerrado,
    sequenceNumber: Number(persistedMovement.sequenceNumber) + 1,
    previousRecordHash: persistedMovement.hash,
    hash: 'a'.repeat(64),
    movementType: 'VENTA',
    paymentMethod: 'EFECTIVO',
    totalAmount: 24.50,
    accountingAmount: 24.50,
    operationDescription: 'Venta histórica de prueba (SIMULACION PREVIA A DESPLIEGUE REAL)',
    currency: 'EUR',
    staffResourceId: GUID_ADMIN_RESOURCE,
    traceId: 'trace-qa-historic-close-2020',
  });
  wixDataMock._store.set('MovimientosCaja', movCol);
  const zOld = await cajas.registerZClosing(diaCerrado, {});
  assert.strictEqual(zOld.status, 'SUCCESS', JSON.stringify(zOld.error));
  // AUDIT-TEST-PURITY: transaccion con transactionId PROPIO. La primera version
  // del test reutilizaba 'offline-tx-0001' y la capa de idempotencia devolvia el
  // registro original (SUCCESS) antes de evaluar PERIOD_CLOSED, enmascarando el
  // invariante que se queria probar.
  const txAfterZ = await cajas.registerManualTransaction({
    totalAmount: 10, tipoFactura: 'F2', operationDescription: 'Venta posterior a cierre (SIMULACION PREVIA A DESPLIEGUE REAL)', paymentMethod: 'EFECTIVO',
    transactionId: 'offline-tx-postz-' + Date.now(),
  });
  assert.strictEqual(txAfterZ.status, 'ERROR', 'periodo cerrado debe bloquear: ' + JSON.stringify(txAfterZ));
  assert.ok(/CLOSED|PERIODO/i.test(String(txAfterZ.error?.code) + String(txAfterZ.error?.message)),
    'codigo/mensaje de periodo cerrado: ' + JSON.stringify(txAfterZ.error));

  // Paso 5: integridad de cadena fiscal verificable end-to-end
  // (contrato real devuelto: { status, data:{ checked, breaksCount, breaks } })
  const chain = await cajas.verifyFiscalHashChainIntegrity({ limit: 100 });
  assert.ok(chain, 'verificacion ejecutada');
  assert.ok(chain.data && Number(chain.data.breaksCount) === 0,
    'cadena sin roturas: ' + JSON.stringify(chain));
});


test('FLOW-CAJA-07 Z closing verifies the previous day hash and nets refund VAT', async () => {
  wixDataMock._reset();
  await setupFiscalSecrets();
  const { cajas } = await freshImports();
  const genesis = '0'.repeat(64);
  wixDataMock._store.set('MovimientosCaja', [
    {
      _id: 'cross-day-001', sequenceNumber: 1,
      fechaExpedicionFactura: '2026-11-07',
      previousRecordHash: genesis, hash: 'hash-day-one',
      movementType: 'VENTA', paymentMethod: 'EFECTIVO',
      accountingSign: 1, accountingAmount: 50,
      taxBase: 41.32, taxAmount: 8.68, tipoImpositivo: 0.21,
    },
    {
      _id: 'cross-day-002', sequenceNumber: 2,
      fechaExpedicionFactura: '2026-11-08',
      previousRecordHash: 'hash-day-one', hash: 'hash-day-two',
      movementType: 'VENTA', paymentMethod: 'EFECTIVO',
      accountingSign: 1, accountingAmount: 121,
      taxBase: 100, taxAmount: 21, tipoImpositivo: 0.21,
    },
    {
      _id: 'cross-day-003', sequenceNumber: 3,
      fechaExpedicionFactura: '2026-11-08',
      previousRecordHash: 'hash-day-two', hash: 'hash-day-three',
      movementType: 'REEMBOLSO', paymentMethod: 'EFECTIVO',
      accountingSign: -1, accountingAmount: -121,
      taxBase: 100, taxAmount: 21, tipoImpositivo: 0.21,
    },
    {
      _id: 'cross-day-004', sequenceNumber: 4,
      fechaExpedicionFactura: '2026-11-08',
      previousRecordHash: 'hash-day-three', hash: 'hash-day-four',
      movementType: 'VENTA', paymentMethod: 'ONLINE',
      accountingSign: 1, accountingAmount: 5,
      taxBase: 4.13, taxAmount: 0.87, tipoImpositivo: 0.21,
    },
  ]);

  const result = await cajas.registerZClosingInternal('2026-11-08', {
    traceId: 'flow-caja-cross-day-001',
  });

  assert.equal(result.status, 'SUCCESS', JSON.stringify(result.error));
  assert.equal(result.data.startRecordHash, 'hash-day-one');
  assert.equal(result.data.endRecordHash, 'hash-day-four');
  assert.equal(result.data.isIntegrityVerified, true);
  assert.equal(result.data.closingSignatureStatus, 'SIGNED');
  assert.equal(result.data.netTaxableAmount, 4.13);
  assert.equal(result.data.netTaxAmount, 0.87);
  assert.equal(result.data.totalOnline, 5);
  assert.equal(result.data.totalRefunds, -121);
});

test('FLOW-CAJA-08 fiscal recovery queue deduplicates repeated compensation requests', async () => {
  wixDataMock._reset();
  const { cajas } = await freshImports();
  const request = {
    kind: 'FISCAL_LEDGER',
    transactionId: 'flow-caja-recovery-idem-001',
    totalAmount: 25,
    paymentMethod: 'EFECTIVO',
    movementType: 'VENTA',
    phase: 'WAIT_FOR_SIGNER',
    origin: 'FISCAL_SIGNER_DOWN',
    traceId: 'flow-caja-recovery-trace-001',
  };

  const results = await Promise.all([
    cajas.queueFiscalRecovery(request),
    cajas.queueFiscalRecovery({
      ...request,
      traceId: 'flow-caja-recovery-trace-002',
      lastError: 'retry after timeout',
    }),
  ]);
  const records = (wixDataMock._store.get('ControlOperativo') || [])
    .filter((row) => row.transactionId === request.transactionId);

  assert.equal(results.every((result) => result.queued), true);
  assert.equal(results.filter((result) => result.created).length, 1);
  assert.equal(results.filter((result) => result.duplicate).length, 1);
  assert.equal(records.length, 1);

  const bookingOnlyRequest = {
    kind: 'FISCAL_LEDGER',
    bookingIds: 'booking-recovery-002,booking-recovery-001',
    totalAmount: 15,
    paymentMethod: 'WIX_PAYMENTS',
    movementType: 'REEMBOLSO',
    phase: 'WAIT_FOR_SIGNER',
    origin: 'WIX_BOOKINGS_CANCEL_WEBHOOK',
  };
  const bookingOnlyResults = await Promise.all([
    cajas.queueFiscalRecovery({ ...bookingOnlyRequest, traceId: 'booking-only-trace-001' }),
    cajas.queueFiscalRecovery({ ...bookingOnlyRequest, traceId: 'booking-only-trace-002' }),
  ]);
  const bookingOnlyRecords = (wixDataMock._store.get('ControlOperativo') || [])
    .filter((row) => row.payload?.origin === bookingOnlyRequest.origin &&
      row.payload?.bookingIds === bookingOnlyRequest.bookingIds);

  assert.equal(bookingOnlyResults.every((result) => result.queued), true);
  assert.equal(bookingOnlyResults.filter((result) => result.created).length, 1);
  assert.equal(bookingOnlyResults.filter((result) => result.duplicate).length, 1);
  assert.equal(bookingOnlyRecords.length, 1);
});

test('FLOW-CAJA-08B fiscal recovery queue preserves the original rectification writer payload', async () => {
  wixDataMock._reset();
  const { cajas } = await freshImports();
  const fiscalPayload = {
    eventType: 'RECTIFICATIVA',
    movementType: 'REEMBOLSO',
    paymentMethod: 'WIX_PAYMENTS',
    totalAmount: -45.5,
    taxBase: -37.6,
    taxAmount: -7.9,
    tipoFactura: 'R1',
    previousInvoiceId: 'F2-2026-000123',
    correctionReason: 'OTRAS',
    transactionId: 'RECT-BOOKING-RECOVERY-001',
    linkedBookingIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    traceId: 'rectification-original-trace',
  };
  const queued = await cajas.queueFiscalRecovery({
    kind: 'FISCAL_LEDGER',
    transactionId: fiscalPayload.transactionId,
    bookingIds: fiscalPayload.linkedBookingIds,
    totalAmount: fiscalPayload.totalAmount,
    paymentMethod: fiscalPayload.paymentMethod,
    movementType: fiscalPayload.movementType,
    origin: 'WIX_BOOKINGS_CANCEL_WEBHOOK',
    recoveryProcessor: 'EVENT_LOG',
    recoveryScope: 'BOOKINGS_ONLY',
    fiscalPayload,
    traceId: 'rectification-queue-trace',
  });
  assert.equal(queued.queued, true);
  const record = (wixDataMock._store.get('ControlOperativo') || [])
    .find((row) => row.transactionId === fiscalPayload.transactionId);
  assert.ok(record);
  assert.equal(record.payload.recoveryProcessor, 'EVENT_LOG');
  assert.equal(record.payload.recoveryScope, 'BOOKINGS_ONLY');
  assert.deepEqual(record.payload.fiscalPayload, fiscalPayload);
});

test('FLOW-CAJA-09 fiscal hash audit checks more than one page before returning success', async () => {
  wixDataMock._reset();
  const { cajas } = await freshImports();
  const movements = [];
  let previousRecordHash = '0'.repeat(64);
  for (let sequenceNumber = 1; sequenceNumber <= 205; sequenceNumber += 1) {
    const numSerieFactura = `FAC-2026-${String(sequenceNumber).padStart(5, '0')}`;
    const recordTimestamp = new Date('2026-11-13T11:00:00.000Z');
    const hashPayload = [
      ['IDEmisorFactura', ''],
      ['NumSerieFactura', numSerieFactura],
      ['FechaExpedicionFactura', '13-11-2026'],
      ['TipoFactura', 'F1'],
      ['BaseImponibleOImporteNoSujeto', '10.00'],
      ['CuotaRepercutida', '2.10'],
      ['ImporteTotal', '12.10'],
      ['Huella', previousRecordHash],
      ['FechaHoraHusoGenRegistro', '2026-11-13T12:00:00+01:00'],
    ].map(([key, value]) => `${key}=${value}`).join('&');
    const hash = await hashChain(previousRecordHash, hashPayload);
    movements.push({
      _id: `audit-page-${sequenceNumber}`,
      sequenceNumber,
      recordSource: 'LIVE',
      movementType: 'VENTA_ONLINE',
      previousRecordHash,
      hash,
      numSerieFactura,
      fechaExpedicionFactura: '2026-11-13',
      tipoFactura: 'F1',
      taxBase: 10,
      taxAmount: 2.1,
      totalAmount: 12.1,
      recordTimestamp,
    });
    previousRecordHash = hash;
  }
  wixDataMock._store.set('MovimientosCaja', movements);

  const result = await cajas.verifyFiscalHashChainIntegrity({ limit: 200 });

  assert.equal(result.status, 'SUCCESS', JSON.stringify(result));
  assert.equal(result.data.checked, 205);
  assert.equal(result.data.complete, true);
  assert.equal(result.data.hasMore, false);
  assert.equal(result.data.breaksCount, 0);
});


test('FLOW-CAJA-10 missing hash fields never pass audit or Z close', async () => {
  wixDataMock._reset();
  await setupFiscalSecrets();
  const { cajas } = await freshImports();
  wixDataMock._store.set('MovimientosCaja', [{
    _id: 'missing-hash-001',
    sequenceNumber: 1,
    fechaExpedicionFactura: '2026-11-08',
    previousRecordHash: '0'.repeat(64),
    movementType: 'VENTA',
    paymentMethod: 'EFECTIVO',
    accountingSign: 1,
    accountingAmount: 50,
    taxBase: 41.32,
    taxAmount: 8.68,
    tipoImpositivo: 0.21,
  }]);

  const audit = await cajas.verifyFiscalHashChainIntegrity({ limit: 200 });
  assert.equal(audit.status, 'INTEGRITY_COMPROMISED');
  assert.equal(audit.data.breaks[0].reason, 'HASH_FIELDS_MISSING');

  const closing = await cajas.registerZClosingInternal('2026-11-08', {
    traceId: 'flow-caja-missing-hash-close-001',
  });
  assert.equal(closing.status, 'ERROR');
  assert.equal(closing.error.code, 'INTEGRITY_VIOLATION');
  assert.equal((wixDataMock._store.get('HistoricoCierresZ') || []).length, 0);

  wixDataMock._reset();
  const { cajas: missingPredecessorCajas } = await freshImports();
  wixDataMock._store.set('MovimientosCaja', [{
    _id: 'missing-predecessor-002',
    sequenceNumber: 2,
    fechaExpedicionFactura: '2026-11-08',
    previousRecordHash: '0'.repeat(64),
    hash: 'hash-sequence-two',
    movementType: 'VENTA',
    paymentMethod: 'EFECTIVO',
    accountingSign: 1,
    accountingAmount: 50,
    taxBase: 41.32,
    taxAmount: 8.68,
    tipoImpositivo: 0.21,
  }]);

  const predecessorAudit = await missingPredecessorCajas.verifyFiscalHashChainIntegrity({ limit: 200 });
  assert.equal(predecessorAudit.status, 'INTEGRITY_COMPROMISED');
  assert.equal(predecessorAudit.data.breaks[0].reason, 'GLOBAL_PREDECESSOR_MISSING');

  const predecessorClose = await missingPredecessorCajas.registerZClosingInternal('2026-11-08', {
    traceId: 'flow-caja-missing-predecessor-close-001',
  });
  assert.equal(predecessorClose.status, 'ERROR');
  assert.equal(predecessorClose.error.code, 'GLOBAL_PREDECESSOR_MISSING');
});

test('FLOW-CAJA-02 payload incorrecto => rechazos deterministas sin contaminar ledger', async () => {
  const { cajas } = await freshImports();
  await setupFiscalSecrets();
  const before = (wixDataMock._store.get('MovimientosCaja') || []).length;

  const neg = await cajas.registerManualTransaction({ totalAmount: -5, paymentMethod: 'EFECTIVO' });
  assert.strictEqual(neg.status, 'ERROR');
  assert.strictEqual(neg.error.code, 'INVALID_AMOUNT');

  const badMethod = await cajas.registerManualTransaction({ totalAmount: 10, tipoFactura: 'F2', paymentMethod: 'ONLINE-CRYPTO' });
  assert.strictEqual(badMethod.status, 'ERROR');
  assert.strictEqual(badMethod.error.code, 'INVALID_PAYMENT_METHOD');

  // > umbral NIF tercero sin recipientTaxId (Ley 11/2021 / Alcabala control)
  const big = await cajas.registerManualTransaction({ totalAmount: 5000, paymentMethod: 'TRANSFERENCIA' });
  assert.strictEqual(big.status, 'ERROR');
  assert.strictEqual(big.error.code, 'RECIPIENT_TAX_ID_REQUIRED');

  const after = (wixDataMock._store.get('MovimientosCaja') || []).length;
  assert.strictEqual(after, before, 'ningun rechazo escribio en el ledger');
});

test('FLOW-CAJA-03 rejects ONLINE as a payment method on new ledger writes', async () => {
  const { cajas } = await freshImports();
  await seedStaff({ resourceId: GUID_ADMIN_RESOURCE });
  setMember({ _id: GUID_MEMBER, contactId: GUID_CONTACT, loginEmail: 'marta@test.local' });
  await setupFiscalSecrets();
  seedCajaPrincipal();
  wixDataMock._store.set('MovimientosCaja', []);
  wixDataMock._store.delete('HistoricoCierresZ');
  const before = (wixDataMock._store.get('MovimientosCaja') || []).length;
  try {
    const tx = await cajas.registerManualTransaction({
      totalAmount: 30,
      tipoFactura: 'F2',
      operationDescription: 'Validacion del metodo de pago canonico',
      paymentMethod: 'ONLINE',
      transactionId: 'offline-tx-reject-online-' + Date.now(),
    });
    assert.equal(tx.status, 'ERROR');
    assert.equal(tx.error.code, 'INVALID_PAYMENT_METHOD');
    assert.equal((wixDataMock._store.get('MovimientosCaja') || []).length, before);
  } finally {
    setMember(null);
  }
});


test('FLOW-CAJA-05 CajaActual projects presencial cash movements and is idempotent', async () => {
  wixDataMock._reset();
  seedCajaPrincipal();
  const { cajas } = await freshImports();
  const movement = {
    _id: '11111111-1111-4111-8111-111111111111',
    transactionId: 'cash-projection-once-001',
    accountingAmount: 35,
    paymentMethod: 'EFECTIVO',
    channelType: 'PRESENCIAL',
    movementType: 'VENTA',
    totalAmount: 35,
    operationDescription: 'Cobro presencial en efectivo de prueba',
    currency: 'EUR',
    resourceId: 'cashier',
    staffResourceId: 'cashier',
    traceId: 'trace-caja-projection-001',
  };

  const first = await cajas.updateCajaActualFromMovement(movement, movement.traceId);
  const replay = await cajas.updateCajaActualFromMovement(movement, movement.traceId);
  const rows = wixDataMock._store.get('CajaActual') || [];
  const register = rows.find((row) => row.singletonKey === 'CAJA_PRINCIPAL');

  assert.strictEqual(first.status, 'SUCCESS');
  assert.strictEqual(replay.status, 'SUCCESS');
  assert.strictEqual(replay.idempotent, true);
  assert.ok(register, 'CajaActual principal debe quedar persistida');
  assert.strictEqual(register.cashAmount, 335);
  assert.strictEqual(register.cardAmount, 0);
  assert.strictEqual(register.voucherAmount, 0);
  assert.strictEqual(register.otherAmount, 0);
  assert.strictEqual(register.netAmount, 335);
  assert.strictEqual(register.salesCount, 1);
  assert.deepStrictEqual(register.sequenceCounters.appliedMovementIds, [movement._id]);
});

test('FLOW-CAJA-05A projection never creates or opens CajaActual implicitly', async () => {
  wixDataMock._reset();
  const { cajas } = await freshImports();
  const movement = {
    _id: 'movement-without-session-001',
    transactionId: 'transaction-without-session-001',
    accountingAmount: 20,
    paymentMethod: 'EFECTIVO',
    channelType: 'PRESENCIAL',
    movementType: 'VENTA',
    traceId: 'trace-without-session-001',
  };
  const result = await cajas.updateCajaActualFromMovement(movement, movement.traceId);
  assert.equal(result.status, 'PENDING_RECONCILIATION');
  assert.equal((wixDataMock._store.get('CajaActual') || []).length, 0);
});

test('FLOW-CAJA-05B card and Bizum update session totals without changing physical cash', async () => {
  wixDataMock._reset();
  seedCajaPrincipal();
  const { cajas } = await freshImports();
  const registerBefore = wixDataMock._store.get('CajaActual')[0];
  const originalCash = registerBefore.cashAmount;

  for (const [method, amountField] of [['TARJETA', 'cardAmount'], ['BIZUM', 'voucherAmount']]) {
    const movement = {
      _id: 'movement-' + method.toLowerCase() + '-001',
      transactionId: 'transaction-' + method.toLowerCase() + '-001',
      accountingAmount: 42.5,
      paymentMethod: method,
      channelType: 'PRESENCIAL',
      movementType: 'VENTA',
      traceId: 'trace-' + method.toLowerCase() + '-001',
      staffResourceId: GUID_ADMIN_RESOURCE,
      recordTimestamp: new Date(),
    };
    const first = await cajas.updateCajaActualFromMovement(movement, movement.traceId);
    const replay = await cajas.updateCajaActualFromMovement(movement, movement.traceId);
    const register = wixDataMock._store.get('CajaActual')[0];
    assert.equal(first.status, 'SUCCESS');
    assert.equal(replay.idempotent, true);
    assert.equal(register[amountField], 42.5);
    assert.equal(register.cashAmount, originalCash, method + ' nunca modifica el efectivo físico');
    assert.equal(register.netAmount, originalCash);
  }
});

test('FLOW-CAJA-06 CajaActual resolves singletonKey when Wix assigned a different physical _id', async () => {
  wixDataMock._reset();
  wixDataMock._store.set('CajaActual', [{
    _id: 'SINGLE_ITEM_ID',
    singletonKey: 'CAJA_PRINCIPAL',
    isOpen: true,
    cashRegisterStatus: 'ABIERTA',
    operationDate: '2026-11-06',
    openingAmount: 300,
    cashAmount: 300,
    netAmount: 300,
    totalInAmount: 300,
    expectedCash: 300,
    cardAmount: 0,
    voucherAmount: 0,
    otherAmount: 0,
    salesCount: 0,
    sequenceCounters: {},
  }]);
  const { cajas } = await freshImports();
  const movement = {
    _id: '22222222-2222-4222-8222-222222222222',
    transactionId: 'cash-projection-existing-singleton-001',
    accountingAmount: 35,
    paymentMethod: 'WIX_PAYMENTS',
    traceId: 'trace-caja-existing-singleton-001',
  };

  const first = await cajas.updateCajaActualFromMovement(movement, movement.traceId);
  const replay = await cajas.updateCajaActualFromMovement(movement, movement.traceId);
  const rows = wixDataMock._store.get('CajaActual') || [];
  const register = rows.find((row) => row.singletonKey === 'CAJA_PRINCIPAL');

  assert.strictEqual(first.status, 'SUCCESS');
  assert.strictEqual(replay.status, 'SUCCESS');
  assert.strictEqual(first.skipped, true);
  assert.strictEqual(replay.skipped, true);
  assert.strictEqual(rows.length, 1, 'no debe crear un segundo singleton');
  assert.strictEqual(register._id, 'SINGLE_ITEM_ID', 'debe conservar el _id físico de Wix');
  assert.strictEqual(register.cashAmount, 300, 'el cobro online no altera efectivo');
  assert.strictEqual(register.otherAmount, 0);
  assert.strictEqual(register.netAmount, 300);
  assert.strictEqual(register.salesCount, 0);
  assert.strictEqual(register.sequenceCounters.appliedMovementIds, undefined);
});

test('FLOW-CAJA-04 transactionId concurrente no crea movimientos duplicados', async () => {
  wixDataMock._reset();
  seedCajaPrincipal();
  const { cajas } = await freshImports();
  await seedStaff({ resourceId: GUID_ADMIN_RESOURCE });
  setMember({ _id: GUID_MEMBER, contactId: GUID_CONTACT, loginEmail: 'marta@test.local' });
  await setupFiscalSecrets();

  const transactionId = 'offline-concurrent-ledger-' + Date.now();
  const payload = {
    totalAmount: 30,
    tipoFactura: 'F2',
    operationDescription: 'Prueba idempotencia concurrente',
    paymentMethod: 'EFECTIVO',
    channelType: 'PRESENCIAL',
    transactionId,
  };

  try {
    const results = await Promise.all([
      cajas.registerManualTransaction(payload),
      cajas.registerManualTransaction(payload),
    ]);
    const movements = (wixDataMock._store.get('MovimientosCaja') || [])
      .filter((row) => row.transactionId === transactionId);

    assert.strictEqual(movements.length, 1, 'solo puede persistirse un movimiento por transactionId');
    assert.ok(results.some((result) => result.status === 'SUCCESS'), 'una petición debe completar el movimiento');
    assert.ok(results.every((result) =>
      result.status === 'SUCCESS' || result.error?.code === 'IDEMPOTENCY_IN_PROGRESS'
    ), 'la petición concurrente debe recuperar el movimiento o fallar cerrada');
    const claims = (wixDataMock._store.get('ControlOperativo') || [])
      .filter((row) => row.controlType === 'LEDGER_IDEMPOTENCY' && row.transactionId === transactionId);
    assert.strictEqual(claims.length, 1, 'solo puede existir una reserva atomica');
  } finally {
    setMember(null);
  }
});

test('FLOW-CAJA-07 devoluciones y reembolsos reducen caja y conservan cadena fiscal (FACSIMIL QA)', async () => {
  const refundTypes = ['REEMBOLSO', 'DEVOLUCION', 'DEVOLUCION_SERVICIO'];

  for (const movementType of refundTypes) {
    wixDataMock._reset();
    await seedStaff({ resourceId: GUID_ADMIN_RESOURCE });
    setMember({ _id: GUID_MEMBER, contactId: GUID_CONTACT, loginEmail: 'marta@test.local' });
    await setupFiscalSecrets();
    const { cajas } = await freshImports();

    // Saldo de apertura ficticio: el reembolso debe descontarse sin crear
    // movimientos reales ni tocar CMS fuera del mock de esta suite.
    wixDataMock._store.set('CajaActual', [{
      _id: 'SINGLE_ITEM_ID',
      singletonKey: 'CAJA_PRINCIPAL',
      cashRegisterStatus: 'ABIERTA',
      isOpen: true,
      operationDate: '2026-11-06',
      openedAt: new Date(Date.now() - 60_000),
      openingAmount: 100,
      cashAmount: 100,
      totalInAmount: 100,
      netAmount: 100,
      expectedCash: 100,
      cardAmount: 0,
      voucherAmount: 0,
      otherAmount: 0,
      salesCount: 0,
      sequenceCounters: {},
    }]);

    try {
      const result = await cajas.registerManualTransaction({
        totalAmount: 12.10,
        tipoFactura: 'R1',
        movementType,
        operationDescription: `Devolucion simulada ${movementType} (SIMULACION PREVIA A DESPLIEGUE REAL)`,
        paymentMethod: 'EFECTIVO',
        channelType: 'PRESENCIAL',
        transactionId: `facsimil-refund-${movementType.toLowerCase()}`,
        correctionReason: 'OTRAS',
        previousInvoiceId: 'FACSIMIL-FAC-2026-00001',
      });

      assert.strictEqual(result.status, 'SUCCESS', JSON.stringify(result.error));
      assert.strictEqual(result.data.movementType, movementType);
      assert.strictEqual(result.data.eventType, 'RECTIFICATIVA');
      assert.strictEqual(result.data.accountingSign, -1);
      assert.strictEqual(result.data.accountingAmount, -12.10);
      assert.match(result.data.hash, /^[0-9a-f]{64}$/i);
      assert.ok(result.data.previousRecordHash);
      assert.ok(String(result.data.digitalSignature).startsWith('MOCKX509SIG:'));
      assert.ok(result.data.operationDescription.includes('(SIMULACION PREVIA A DESPLIEGUE REAL)'));

      const movements = wixDataMock._store.get('MovimientosCaja') || [];
      assert.strictEqual(movements.length, 1, 'un único movimiento rectificativo en el ledger mock');
      assert.strictEqual(movements[0].transactionId, `facsimil-refund-${movementType.toLowerCase()}`);

      const cashRegister = (wixDataMock._store.get('CajaActual') || [])
        .find((row) => row.singletonKey === 'CAJA_PRINCIPAL');
      assert.ok(cashRegister, 'CajaActual singleton conservado');
      assert.strictEqual(cashRegister._id, 'SINGLE_ITEM_ID');
      assert.strictEqual(cashRegister.cashAmount, 87.90, 'el reembolso resta efectivo');
      assert.strictEqual(cashRegister.netAmount, 87.90, 'netAmount concilia con el efectivo disponible');
      assert.deepStrictEqual(cashRegister.sequenceCounters.appliedMovementIds, [result.data._id]);

      const chain = await cajas.verifyFiscalHashChainIntegrity({ limit: 20 });
      assert.strictEqual(Number(chain.data?.breaksCount), 0, JSON.stringify(chain));
    } finally {
      setMember(null);
    }
  }
});


test('FLOW-CAJA-11 simulation cash state blocks manual writes, state display and Z close', async () => {
  wixDataMock._reset();
  const operationDate = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  wixDataMock._store.set('CajaActual', [{
    _id: 'SINGLE_ITEM_ID',
    singletonKey: 'CAJA_PRINCIPAL',
    isOpen: true,
    cashRegisterStatus: 'SIMULACION',
    operationDate,
    netAmount: 300,
    cashAmount: 300,
    sequenceCounters: { seqGlobal: 0, appliedMovementIds: [] },
  }]);
  await seedStaff({ resourceId: GUID_ADMIN_RESOURCE });
  setMember({ _id: GUID_MEMBER, contactId: GUID_CONTACT, loginEmail: 'marta@test.local' });
  const { cajas } = await freshImports();
  await setupFiscalSecrets();

  const before = (wixDataMock._store.get('MovimientosCaja') || []).length;
  const tx = await cajas.registerManualTransaction({
    totalAmount: 25,
    paymentMethod: 'EFECTIVO',
    movementType: 'VENTA',
    transactionId: 'blocked-simulation-cash-001',
  });
  assert.equal(tx.status, 'ERROR');
  assert.equal(tx.error.code, 'CASH_REGISTER_SIMULATION_STATE');
  assert.equal((wixDataMock._store.get('MovimientosCaja') || []).length, before);

  const state = await cajas.getCashierState({});
  assert.equal(state.status, 'ERROR');
  assert.equal(state.error.code, 'CASH_REGISTER_SIMULATION_STATE');
  assert.equal(state.data, null);

  const closing = await cajas.registerZClosingInternal(operationDate, {
    traceId: 'blocked-simulation-z-001',
  });
  assert.equal(closing.status, 'ERROR');
  assert.equal(closing.error.code, 'CASH_REGISTER_SIMULATION_STATE');
  assert.equal((wixDataMock._store.get('HistoricoCierresZ') || []).length, 0);

  const projection = await cajas.updateCajaActualFromMovement({
    _id: 'simulation-projection-movement',
    transactionId: 'simulation-projection-movement',
    accountingAmount: 10,
    paymentMethod: 'EFECTIVO',
    channelType: 'PRESENCIAL',
  }, 'trace-simulation-projection-001');
  assert.equal(projection.status, 'PENDING_RECONCILIATION');
  const register = wixDataMock._store.get('CajaActual')[0];
  assert.equal(register.cashRegisterStatus, 'SIMULACION');
  assert.equal(register.cashAmount, 300);
});

test('FLOW-CAJA-12 explicit smoke rows are excluded from live fiscal sequence, count and integrity audit', async () => {
  wixDataMock._reset();
  seedCajaPrincipal();
  await seedStaff({ resourceId: GUID_ADMIN_RESOURCE });
  setMember({ _id: GUID_MEMBER, contactId: GUID_CONTACT, loginEmail: 'marta@test.local' });
  const { cajas } = await freshImports();
  await setupFiscalSecrets();
  const operationDate = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  wixDataMock._store.set('MovimientosCaja', [{
    _id: 'smoke-movement-existing',
    sequenceNumber: 0,
    fechaExpedicionFactura: operationDate,
    fiscalPeriod: operationDate.slice(0, 7),
    recordSource: 'SMOKE_TEST',
    eventType: 'SIMULATED_PAYMENT',
    movementType: 'VENTA_POS_SIMULADA',
    accountingAmount: 25,
    amount: 25,
    totalAmount: 25,
    taxBase: 20.66,
    taxAmount: 4.34,
    paymentMethod: 'EFECTIVO',
    tipoImpositivo: 0.21,
    previousRecordHash: 'SIMULATED_PREVIOUS_HASH',
    hash: 'SIMULATED_HASH',
    traceId: 'SMOKE_TEST',
  }]);

  const tx = await cajas.registerManualTransaction({
    totalAmount: 25,
    tipoFactura: 'F2',
    operationDescription: 'Venta QA de aislamiento de ledger',
    paymentMethod: 'EFECTIVO',
    movementType: 'VENTA',
    transactionId: 'real-after-smoke-001',
  });
  assert.equal(tx.status, 'SUCCESS', JSON.stringify(tx.error));
  assert.equal(tx.data.sequenceNumber, 1);
  assert.equal(tx.data.previousRecordHash, '0'.repeat(64));

  const state = await cajas.getCashierState({});
  assert.equal(state.status, 'SUCCESS', JSON.stringify(state.error));
  assert.equal(state.data.totalOperations, 1);

  const audit = await cajas.verifyFiscalHashChainIntegrity({ limit: 20 });
  assert.equal(audit.status, 'SUCCESS', JSON.stringify(audit));
  assert.equal(audit.data.checked, 1);
  assert.equal(audit.data.breaksCount, 0);
});


test('FLOW-HOR-05 unsigned legacy timeclock rows are visible as unverified and excluded from calculations', async () => {
  wixDataMock._reset();
  await seedStaff();
  setMember({ _id: GUID_MEMBER, contactId: GUID_CONTACT, loginEmail: 'marta@test.local' });
  const { horario } = await freshImports();
  const now = new Date();
  const dayKey = now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  const monthKey = dayKey.slice(0, 7);
  wixDataMock._store.set('RegistrosHorariosStaff', [{
    _id: 'legacy-unsigned-clock-001',
    resourceId: GUID_RESOURCE,
    memberId: GUID_MEMBER,
    staffName: 'Marta',
    recordedAt: now,
    recordedTime: now.toTimeString().slice(0, 8),
    dayKey,
    monthKey,
    clockEventType: 'ENTRADA',
    recordType: 'REGULAR',
    registeredBy: 'SELF',
    registeredByMemberId: GUID_MEMBER,
    adjustmentReason: null,
    traceId: 'QA_LIVECMS_UNSIGNED_TIME_001',
  }]);

  const state = await horario.getEstadoJornada({ dayKey });
  assert.equal(state.status, 'ERROR');
  assert.equal(state.error.code, 'TIMECLOCK_INTEGRITY_UNVERIFIED');

  const hours = await horario.calcularHorasTrabajadas({ dayKey });
  assert.equal(hours.status, 'ERROR');
  assert.equal(hours.error.code, 'TIMECLOCK_INTEGRITY_UNVERIFIED');

  const history = await horario.getHistorialFichajes({ startDateYMD: dayKey, endDateYMD: dayKey });
  assert.equal(history.status, 'OK');
  assert.equal(history.data.items.length, 1);
  assert.equal(history.data.items[0].integrityStatus, 'UNVERIFIED');
  assert.equal(Object.prototype.hasOwnProperty.call(history.data.items[0], 'signature'), false);

  const summary = await horario.getResumenHoras({ monthKey });
  assert.equal(summary.status, 'ERROR');
  assert.equal(summary.error.code, 'TIMECLOCK_INTEGRITY_UNVERIFIED');
});


test('FLOW-HOR-06 bounded cross-month range aggregates multiple shifts and pauses in one read', async () => {
  wixDataMock._reset();
  await seedStaff();
  setMember({ _id: GUID_MEMBER, contactId: GUID_CONTACT, loginEmail: 'marta@test.local' });
  await setupFiscalSecrets();
  const { horario, engine } = await freshImports();

  const definitions = [
    ['2026-10-31T09:00:00+01:00', '2026-10-31', '2026-10', 'ENTRADA'],
    ['2026-10-31T12:00:00+01:00', '2026-10-31', '2026-10', 'PAUSA_INICIO'],
    ['2026-10-31T12:30:00+01:00', '2026-10-31', '2026-10', 'PAUSA_FIN'],
    ['2026-10-31T13:00:00+01:00', '2026-10-31', '2026-10', 'SALIDA'],
    ['2026-11-01T14:00:00+01:00', '2026-11-01', '2026-11', 'ENTRADA'],
    ['2026-11-01T17:00:00+01:00', '2026-11-01', '2026-11', 'SALIDA'],
  ];
  const records = [];
  for (let index = 0; index < definitions.length; index += 1) {
    const [iso, dayKey, monthKey, clockEventType] = definitions[index];
    const recordedAt = new Date(iso);
    const record = {
      resourceId: GUID_RESOURCE,
      memberId: GUID_MEMBER,
      staffName: 'Marta',
      recordedAt,
      recordedTime: iso.slice(11, 19),
      dayKey,
      monthKey,
      clockEventType,
      recordType: 'REGULAR',
      registeredBy: 'SELF',
      registeredByMemberId: GUID_MEMBER,
      adjustmentReason: null,
      deviceIpAddress: null,
      meta: {},
      traceId: 'trace-timeclock-range-' + index,
    };
    record.signature = await engine.signTimeclockRecord(record);
    records.push(record);
  }
  wixDataMock._store.set('RegistrosHorariosStaff', records);

  const result = await horario.calcularHorasTrabajadas({
    startDateYMD: '2026-10-31',
    endDateYMD: '2026-11-01',
  });
  assert.equal(result.status, 'OK', JSON.stringify(result.error));
  assert.equal(result.data.minutosTrabajados, 390);
  assert.equal(result.data.minutosPausa, 30);
  assert.equal(result.data.totalFichajesProcesados, 6);
  assert.equal(result.data.diasProcesados, 2);
  assert.equal(result.data.jornadasAbiertas, 0);

  const history = await horario.getHistorialFichajes({
    startDateYMD: '2026-10-31',
    endDateYMD: '2026-11-01',
    limit: 500,
  });
  assert.equal(history.status, 'OK', JSON.stringify(history.error));
  assert.equal(history.data.items.length, 6);
  assert.ok(history.data.items.every((item) => item.integrityStatus === 'VERIFIED'));
});


test('FLOW-HOR-07 signed but invalid event sequence is surfaced and cannot produce hours', async () => {
  wixDataMock._reset();
  await seedStaff();
  setMember({ _id: GUID_MEMBER, contactId: GUID_CONTACT, loginEmail: 'marta@test.local' });
  await setupFiscalSecrets();
  const { horario, engine } = await freshImports();
  const now = new Date();
  const dayKey = now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  const monthKey = dayKey.slice(0, 7);
  const record = {
    resourceId: GUID_RESOURCE,
    memberId: GUID_MEMBER,
    staffName: 'Marta',
    recordedAt: now,
    recordedTime: now.toLocaleTimeString('sv-SE', { timeZone: 'Europe/Madrid', hour12: false }),
    dayKey,
    monthKey,
    clockEventType: 'PAUSA_FIN',
    recordType: 'REGULAR',
    registeredBy: 'SELF',
    registeredByMemberId: GUID_MEMBER,
    adjustmentReason: null,
    deviceIpAddress: null,
    meta: {},
    traceId: 'trace-timeclock-invalid-sequence-001',
  };
  record.signature = await engine.signTimeclockRecord(record);
  wixDataMock._store.set('RegistrosHorariosStaff', [record]);

  const state = await horario.getEstadoJornada({ dayKey });
  assert.equal(state.status, 'ERROR');
  assert.equal(state.error.code, 'TIMECLOCK_SEQUENCE_INVALID');

  const hours = await horario.calcularHorasTrabajadas({ dayKey });
  assert.equal(hours.status, 'ERROR');
  assert.equal(hours.error.code, 'TIMECLOCK_SEQUENCE_INVALID');

  const history = await horario.getHistorialFichajes({
    startDateYMD: dayKey,
    endDateYMD: dayKey,
    limit: 500,
  });
  assert.equal(history.status, 'OK');
  assert.equal(history.data.items[0].integrityStatus, 'VERIFIED');
  assert.equal(history.data.items[0].sequenceStatus, 'INVALID');
});



test('FLOW-HOR-08 counts completed pauses but excludes in-progress time for an open shift', async () => {
  wixDataMock._reset();
  await seedStaff();
  setMember({ _id: GUID_MEMBER, contactId: GUID_CONTACT, loginEmail: 'marta@test.local' });
  await setupFiscalSecrets();
  const { horario, engine } = await freshImports();

  const definitions = [
    ['2026-11-10T09:00:00+01:00', 'ENTRADA'],
    ['2026-11-10T10:00:00+01:00', 'PAUSA_INICIO'],
    ['2026-11-10T10:15:00+01:00', 'PAUSA_FIN'],
  ];
  const records = [];
  for (let index = 0; index < definitions.length; index += 1) {
    const [iso, clockEventType] = definitions[index];
    const recordedAt = new Date(iso);
    const record = {
      resourceId: GUID_RESOURCE,
      memberId: GUID_MEMBER,
      staffName: 'Marta',
      recordedAt,
      recordedTime: iso.slice(11, 19),
      dayKey: '2026-11-10',
      monthKey: '2026-11',
      clockEventType,
      recordType: 'REGULAR',
      registeredBy: 'SELF',
      registeredByMemberId: GUID_MEMBER,
      adjustmentReason: null,
      deviceIpAddress: null,
      meta: {},
      traceId: 'trace-timeclock-open-shift-' + index,
    };
    record.signature = await engine.signTimeclockRecord(record);
    records.push(record);
  }
  wixDataMock._store.set('RegistrosHorariosStaff', records);

  const result = await horario.calcularHorasTrabajadas({
    startDateYMD: '2026-11-10',
    endDateYMD: '2026-11-10',
  });
  assert.equal(result.status, 'OK', JSON.stringify(result.error));
  assert.equal(result.data.minutosTrabajados, 0);
  assert.equal(result.data.minutosPausa, 15);
  assert.equal(result.data.jornadasAbiertas, 1);
  assert.equal(result.data.integrityStatus, 'VERIFIED');
});
