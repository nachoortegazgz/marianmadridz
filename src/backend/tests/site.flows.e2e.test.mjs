/*
=============================================================================
MODULE: backend/tests/site.flows.e2e.test.mjs
PURPOSE: E2E de FLUJOS COMPLETOS del sitio con mocks funcionales (LH-18).
Cubre los flujos que no tenian test end-to-end continuo:
  FLOW-SEC-*   seguridad/roles (security.js) sobre identidad mockeada
  FLOW-HOR-*   fichaje horario completo (horario.web.js, RD 8/2019)
  FLOW-CAJA-*  caja: alta manual -> estado cajero -> cierre Z -> integridad
               hash-chain (cajas.web.js, Ley 11/2021)
Exige payloads correctos y flujos continuos (cada paso consume el estado
persistido por el anterior en el mock wixData). No usa HTTP: webMethods se
invocan directamente (semantica Velo equivalente).
=============================================================================
*/

import { test } from 'node:test';
import assert from 'node:assert';

import { wixDataMock, mocks } from './loader.mjs';

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

// LH-18b: secrets fiscales validos (>=32 chars key, >=9 NIF) + invalidacion
// de la cache interna de cajas.web para que el flujo E2E vea los overrides.
async function setupFiscalSecrets() {
  const state = globalThis.__mmSecretsState || (globalThis.__mmSecretsState = { _map: {}, _default: 'mock-secret' });
  state._map.SECRET_FISCALKEY = 'A'.repeat(40);
  state._map.FISCAL_NIF_EMISOR = 'B12345678';
  // LH-19 (FLOW-CAJA-01): el signer X.509 delegado es un microservicio externo;
  // en E2E offline se mockea su contrato HTTP (POST {hash,...} -> {signature}).
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

test('FLOW-HOR-01 flujo continuo: contexto -> fichar ENTRADA -> estado jornada -> historial -> firma valida', async () => {
  wixDataMock._reset();
  await seedStaff();
  setMember({ _id: GUID_MEMBER, contactId: GUID_CONTACT, loginEmail: 'marta@test.local' });
  const { horario, engine } = await freshImports();

  // Paso 1: contexto staff via webMethod con payload correcto
  const ctxRes = await horario.getMyStaffContext({ traceId: 'flow-hor-ctx' });
  assert.strictEqual(ctxRes.status, 'OK');
  assert.strictEqual(ctxRes.data.resourceId, GUID_RESOURCE);

  // Paso 2: fichar ENTRADA (payload canonico clockEventType)
  const inRes = await horario.registrarFichaje({ clockEventType: 'ENTRADA', userAgent: 'e2e-test' });
  assert.strictEqual(inRes.status, 'OK', JSON.stringify(inRes.error));
  assert.ok(inRes.data.id, 'registro persistido con id');

  // Paso 3: la fila escrita es canonical (schema v8.1) y esta firmada
  const rows = wixDataMock._store.get('RegistrosHorariosStaff') || [];
  assert.strictEqual(rows.length, 1);
  const row = rows[0];
  assert.strictEqual(row.clockEventType, 'ENTRADA');
  assert.strictEqual(row.recordType, 'REGULAR');
  assert.strictEqual(row.registeredBy, 'SELF');
  assert.ok(row.dayKey && /^\d{4}-\d{2}-\d{2}$/.test(row.dayKey));
  assert.ok(typeof row.signature === 'string' && row.signature.length === 64);

  // Paso 4: integridad RD 8/2019 - verificacion HMAC del registro firmado
  assert.strictEqual(await engine.verifyTimeclockSignature(row), true);
  // alteracion -> firma invalida (append-only integrity)
  assert.strictEqual(await engine.verifyTimeclockSignature({ ...row, clockEventType: 'SALIDA' }), false);

  // Paso 5: estado de jornada consume el registro anterior (flujo continuo)
  const estado = await horario.getEstadoJornada({});
  assert.strictEqual(estado.status, 'OK');
  assert.ok(estado.data, 'jornada abierta visible');

  // Paso 6: historial del dia incluye el fichaje
  const hist = await horario.getHistorialFichajes({ dayKey: row.dayKey });
  assert.strictEqual(hist.status, 'OK');
  const items = hist.data?.items || hist.data || [];
  assert.ok(items.length >= 1, 'historial contiene el fichaje');
});

test('FLOW-HOR-02 payload invalido => rechazo controlado SIN escritura', async () => {
  const { horario } = await freshImports();
  const before = (wixDataMock._store.get('RegistrosHorariosStaff') || []).length;
  const bad = await horario.registrarFichaje({ clockEventType: 'NOEXISTE' });
  assert.strictEqual(bad.status, 'ERROR');
  assert.ok(bad.error.code, 'error code presente');
  const after = (wixDataMock._store.get('RegistrosHorariosStaff') || []).length;
  assert.strictEqual(after, before, 'rechazo antes de insert');
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

test('FLOW-HOR-04 manager adjustment writes the verified target site-member ID', async () => {
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
  assert.strictEqual(result.status, 'OK', JSON.stringify(result.error));
  const rows = wixDataMock._store.get('RegistrosHorariosStaff') || [];
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].memberId, GUID_MEMBER);
  assert.strictEqual(rows[0].registeredByMemberId, GUID_MEMBER);
});

// ===========================================================================
// FLOW-CAJA: ledger manual -> estado -> cierre Z -> verificacion cadena
// ===========================================================================

test('FLOW-CAJA-01 flujo continuo: venta EFECTIVO -> caja incrementada -> cierre Z -> hash-chain integra', async () => {
  wixDataMock._reset();
  await seedStaff({ resourceId: GUID_ADMIN_RESOURCE });
  setMember({ _id: GUID_MEMBER, contactId: GUID_CONTACT, loginEmail: 'marta@test.local' });
  const { cajas } = await freshImports();
  await setupFiscalSecrets();

  // Paso 1: alta manual con payload canonic (v5010.7: totalAmount/operationDescription)
  const tx = await cajas.registerManualTransaction({
    totalAmount: 50.0,
    tipoFactura: 'F2',
    operationDescription: 'Venta mostrador e2e',
    paymentMethod: 'EFECTIVO',
    movementType: 'VENTA',
    tipoImpositivo: 21,
    transactionId: 'e2e-tx-0001',
  });
  assert.strictEqual(tx.status, 'SUCCESS', JSON.stringify(tx.error));
  const mov = tx.data;
  // MovimientosCaja canonicalizes its internal digest as "hash". The
  // public receipt endpoint projects this as "recordHash"; the ledger row
  // itself must not keep the duplicate legacy key.
  assert.ok(mov.hash && mov.previousRecordHash !== undefined && mov.digitalSignature,
    'movimiento con cadena fiscal (hash + previousRecordHash + digitalSignature): ' +
      JSON.stringify({ hash: mov.hash, prh: mov.previousRecordHash, sig: mov.digitalSignature }));
  assert.strictEqual(mov.recordHash, undefined, 'legacy recordHash must not persist on MovimientosCaja');
  assert.strictEqual(mov.paymentMethod, 'EFECTIVO');

  // Paso 1b: idempotencia - mismo transactionId devuelve el registro original
  const dup = await cajas.registerManualTransaction({
    totalAmount: 50.0, tipoFactura: 'F2', operationDescription: 'repeat', paymentMethod: 'EFECTIVO',
    transactionId: 'e2e-tx-0001',
  });
  assert.strictEqual(dup.status, 'SUCCESS');
  assert.strictEqual(dup.idempotent, true);

  // Paso 2: getCashierState refleja la operacion (flujo continuo sobre CajaActual)
  const state = await cajas.getCashierState({});
  assert.strictEqual(state.status, 'SUCCESS');
  assert.ok((state.data.totalOperations ?? 0) >= 1, 'operaciones contabilizadas: ' + JSON.stringify(state.data));

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
  movCol.push({ _id: 'mov-hist-2020', invoiceIssueDate: diaCerrado, sequenceNumber: 999998 });
  wixDataMock._store.set('MovimientosCaja', movCol);
  const zOld = await cajas.registerZClosing(diaCerrado, {});
  assert.strictEqual(zOld.status, 'SUCCESS', JSON.stringify(zOld.error));
  // AUDIT-TEST-PURITY: transaccion con transactionId PROPIO. La primera version
  // del test reutilizaba 'e2e-tx-0001' y la capa de idempotencia devolvia el
  // registro original (SUCCESS) antes de evaluar PERIOD_CLOSED, enmascarando el
  // invariante que se queria probar.
  const txAfterZ = await cajas.registerManualTransaction({
    totalAmount: 10, tipoFactura: 'F2', operationDescription: 'venta post-cierre', paymentMethod: 'EFECTIVO',
    transactionId: 'e2e-tx-postz-' + Date.now(),
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

test('FLOW-CAJA-03 traducion legacy ONLINE -> WIX_PAYMENTS en la frontera (CAJA-01 SSOT)', async () => {
  const { cajas } = await freshImports();
  // AUDIT-TEST-PURITY: registerManualTransaction exige rol CAJERO (guard de
  // acceso). Sin miembro, ACCESS_DENIED enmascaraba el contrato a probar.
  // SEC-R2: seed de identidad staff ADMIN (rol canónico para isCajero) —
  // mismo patrón que FLOW-CAJA-01; sin esto el guard rechaza antes de
  // llegar a la validación del método de pago.
  await seedStaff({ resourceId: GUID_ADMIN_RESOURCE });
  setMember({ _id: GUID_MEMBER, contactId: GUID_CONTACT, loginEmail: 'marta@test.local' });
  await setupFiscalSecrets();
  // LH-27 (v13.0): FLOW-CAJA-01 cierra el Z del día de operación y FLOW-CAJA-02
  // opera sobre el mismo periodo compartido. En producción cada sesión de caja
  // abre un periodo nuevo; aquí se purga solo el ledger y los cierres Z para
  // simular un periodo abierto SIN recrear CajaActual (destruirla violaba la
  // invariante HOOK-CIERREZ-01 append-only cuando existía de tests previos).
  // El resto de colecciones (SecuenciaTickets, tokens display) se conservan.
  wixDataMock._store.set('MovimientosCaja', []);
  wixDataMock._store.delete('HistoricoCierresZ');
  try {
    const tx = await cajas.registerManualTransaction({
      totalAmount: 30, tipoFactura: 'F2', operationDescription: 'Pago online legado',
      paymentMethod: 'ONLINE', transactionId: 'e2e-tx-legacy-online-' + Date.now(),
    });
    if (tx.status === 'SUCCESS') {
      assert.strictEqual(tx.data.paymentMethod, 'WIX_PAYMENTS',
        'legacy ONLINE normalizado al enum real');
    } else {
      // contrato alternativo valido: rechazo explicito del metodo legacy
      assert.strictEqual(tx.error.code, 'INVALID_PAYMENT_METHOD');
    }
  } finally {
    setMember(null);
  }
});


test('FLOW-CAJA-04 transactionId concurrente no crea movimientos duplicados', async () => {
  wixDataMock._reset();
  const { cajas } = await freshImports();
  await seedStaff({ resourceId: GUID_ADMIN_RESOURCE });
  setMember({ _id: GUID_MEMBER, contactId: GUID_CONTACT, loginEmail: 'marta@test.local' });
  await setupFiscalSecrets();

  const transactionId = 'e2e-concurrent-ledger-' + Date.now();
  const payload = {
    totalAmount: 30,
    tipoFactura: 'F2',
    operationDescription: 'Prueba idempotencia concurrente',
    paymentMethod: 'EFECTIVO',
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
