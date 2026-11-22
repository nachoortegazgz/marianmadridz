/*
=============================================================================
SUITE: data.hooks (v13.0-MINIMAL alignment, 2026-10-14)
Purpose: sell the RETIREMENT decisions DATA-01..DATA-05 (hooks that added
friction without real benefit: duplicated point-of-use validation and
compliance-free collections) AND verify the conserved legal guards
(Ley 11/2021 caja ledger, RD 8/2019 time clock, WEBHOOK_EVENT append-only). Runs offline via tests/loader.mjs mocks.
G10 ASCII strict.
=============================================================================
*/
import test from 'node:test';
import assert from 'node:assert';

const { wixDataMock } = await import('./loader.mjs');
const H = await import('backend/data');
const IC = await import('backend/internalConfig');

// -----------------------------------------------------------------------------
// ServiciosCatalogo dual: exposureDuration is mandatory and may explicitly be 0.
// -----------------------------------------------------------------------------

test('HOOK-SVC-DUAL-01 requires explicit numeric exposureDuration', () => {
  const dualBase = {
    serviceId: 'a90462eb-dae7-4180-82ae-89aaa9cbb394',
    linkedPhases: '87b13644-36b4-4679-b15b-307100ad3cae',
    allowCombine: true,
    phase1Duration: 50,
    phase2Duration: 60,
    totalDuration: 150,
  };
  assert.throws(() => H.ServiciosCatalogo_beforeInsert({ ...dualBase }), /exposureDuration explicito/);
  assert.throws(() => H.ServiciosCatalogo_beforeInsert({ ...dualBase, exposureDuration: '' }), /exposureDuration explicito/);
  assert.throws(() => H.ServiciosCatalogo_beforeInsert({ ...dualBase, exposureDuration: '40' }), /exposureDuration explicito/);
  assert.throws(() => H.ServiciosCatalogo_beforeInsert({ ...dualBase, exposureDuration: -1 }), /exposureDuration explicito/);
  assert.doesNotThrow(() => H.ServiciosCatalogo_beforeInsert({ ...dualBase, exposureDuration: 40 }));
  assert.doesNotThrow(() => H.ServiciosCatalogo_beforeInsert({ ...dualBase, exposureDuration: 0, totalDuration: 110 }));
});

// -----------------------------------------------------------------------------
// SSOT 15.2: CitasF2 schema guard is retained at the CMS boundary.
// -----------------------------------------------------------------------------

test('HOOK-CITAS-01 validates canonical enums, traceId and pairToken', () => {
  const valid = {
    bookingId: '11111111-1111-4111-8111-111111111111',
    scheduleId: '22222222-2222-4222-8222-222222222222',
    bookingType: 'SIMPLE',
    bookingStatus: 'PENDING',
    paymentStatus: 'NOT_PAID',
    serviceId: '33333333-3333-4333-8333-333333333333',
    resourceId: '44444444-4444-4444-8444-444444444444',
    slotStart: new Date('2026-11-12T08:30:00.000Z'),
    slotEnd: new Date('2026-11-12T09:00:00.000Z'),
    totalAmount: 100,
    dateYmd: '2026-11-12',
    traceId: 'trace-citas-001',
  };
  assert.doesNotThrow(() => H.CitasF2_beforeInsert({ ...valid }));
  assert.doesNotThrow(() => H.CitasF2_beforeUpdate({ ...valid }));
  assert.throws(() => H.CitasF2_beforeInsert({ ...valid, bookingStatus: 'INVALID' }), /bookingStatus/);
  assert.throws(() => H.CitasF2_beforeInsert({ ...valid, bookingType: 'DUAL_F1' }), /pairToken/);
  assert.throws(() => H.CitasF2_beforeInsert({ ...valid, traceId: '' }), /traceId/);
  assert.throws(() => H.CitasF2_beforeInsert({ ...valid, bookingId: 'not-a-guid' }), /GUID/);
  assert.throws(() => H.CitasF2_beforeInsert((({ scheduleId, ...rest }) => rest)(valid)), /scheduleId/);
  assert.throws(() => H.CitasF2_beforeInsert({ ...valid, scheduleId: 'invalid-schedule' }), /scheduleId.*GUID/);
  assert.throws(() => H.CitasF2_beforeInsert({ ...valid, serviceId: 'invalid-service' }), /serviceId.*GUID/);
  assert.throws(() => H.CitasF2_beforeInsert({ ...valid, resourceId: 'invalid-resource' }), /resourceId.*GUID/);

  assert.throws(() => H.CitasF2_beforeRemove({}), /cancelacion formal/);
});

test('HOOK-CMS-DATETIME-01 normalizes all CitasF2 DateTime fields to Date objects', () => {
  const item = {
    bookingId: '11111111-1111-4111-8111-111111111111',
    scheduleId: '22222222-2222-4222-8222-222222222222',
    bookingType: 'SIMPLE',
    bookingStatus: 'PENDING',
    paymentStatus: 'NOT_PAID',
    serviceId: '33333333-3333-4333-8333-333333333333',
    resourceId: '44444444-4444-4444-8444-444444444444',
    totalAmount: 100,
    dateYmd: '2026-11-12',
    traceId: 'trace-citas-datetime',
    slotStart: '2026-11-12T08:30:00.000Z',
    slotEnd: '2026-11-12T09:00:00.000Z',
    privacyNoticeAcceptedAt: '2026-11-12T08:20:00.000Z',
    invoicingDate: '2026-11-12T09:20:00.000Z',
  };
  H.CitasF2_beforeInsert(item);
  for (const field of ['slotStart', 'slotEnd', 'privacyNoticeAcceptedAt', 'invoicingDate']) {
    assert.ok(item[field] instanceof Date, `${field} must be a Date`);
  }
  assert.strictEqual(item.slotStart.toISOString(), '2026-11-12T08:30:00.000Z');
  assert.strictEqual(item.slotEnd.toISOString(), '2026-11-12T09:00:00.000Z');
  assert.throws(() => H.CitasF2_beforeInsert({ ...item, slotStart: 'not-a-date' }), /DATETIME/);
});

test('HOOK-CMS-DATETIME-03 normalizes timeclock recordedAt', () => {
  const item = {
    resourceId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001',
    memberId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0002',
    recordId: 'clock-record-sandbox-001',
    clockEventType: IC.CLOCK_EVENT_TYPE.ENTRADA,
    recordType: IC.RECORD_TYPE_HORARIOS.REGULAR,
    source: IC.CLOCK_RECORD_SOURCE.WIX_WEB_METHOD,
    recordedAt: '2026-11-05T10:10:00.000Z',
    recordedTime: '2026-11-05T10:10:00.000Z',
    workDate: '2026-11-05',
    dayKey: '2026-11-05',
    monthKey: '2026-11',
    timeZone: IC.SDK_CONFIG.TZ,
    schemaVersion: IC.TIMECLOCK_SCHEMA_VERSION,
    recordHash: 'b'.repeat(64),
    traceId: 'trace-timeclock-datetime',
    signature: 'a'.repeat(64),
  };
  H.RegistrosHorariosStaff_beforeInsert(item);
  assert.ok(item.recordedAt instanceof Date);
  assert.ok(item.recordedTime instanceof Date);
  assert.strictEqual(typeof item.workDate, 'string');
  assert.strictEqual(item.workDate, '2026-11-05');
  assert.strictEqual(item.recordedAt.toISOString(), '2026-11-05T10:10:00.000Z');
  assert.strictEqual(item.recordedTime.toISOString(), '2026-11-05T10:10:00.000Z');
  assert.throws(() => H.RegistrosHorariosStaff_beforeInsert({ ...item, recordedTime: 'invalid' }), /DATETIME/);
  assert.throws(() => H.RegistrosHorariosStaff_beforeInsert({ ...item, recordHash: 'invalid' }), /recordHash/);
});

// -----------------------------------------------------------------------------
test('HOOK-APPEND-02 retired blocked-collection hooks are gone (ADR-02)', () => {
  assert.strictEqual(H.SecuenciaTickets_beforeUpdate, undefined);
});

// -----------------------------------------------------------------------------
// MovimientosCaja hardening (traceId + recordHash + schemaVersion) — SSOT v13
// -----------------------------------------------------------------------------

function cajaBase() {
  return {
    eventType: IC.EVENT_TYPE ? Object.values(IC.EVENT_TYPE)[0] : 'VENTA_LINEA',
    movementType: IC.MOVEMENT_TYPE.VENTA,
    amount: 100,
    totalAmount: 100,
    numSerieFactura: 'FAC-SANDBOX-0001',
    sequenceNumber: 1,
    transactionId: 'TX-SANDBOX-0001',
    previousRecordHash: 'b'.repeat(64),
    recordTimestamp: new Date('2026-11-20T10:00:00.000Z'),
    schemaVersion: 'LEDGER_V5_FISCAL',
    traceId: 'trace-caja-001',
    paymentMethod: IC.PAYMENT_METHOD.EFECTIVO,
    channelType: IC.CHANNEL_TYPE.PRESENCIAL,
    operationDescription: 'Synthetic hook contract fixture',
    staffResourceId: 'CAJA_LOCAL',
    tipoFactura: IC.TIPO_FACTURA.F2,
    fechaExpedicionFactura: '2026-11-20',
    tipoImpositivo: 0.21,
    fiscalPeriod: '2026-11',
    thirdPartyId: null,
    hash: 'a'.repeat(64),
  };
}

test('HOOK-CMS-DATETIME-04 normalizes CajaActual DateTime fields without changing the instant', async () => {
  wixDataMock._reset();
  wixDataMock._seed('CajaActual', [{
    _id: 'SINGLE_ITEM_ID',
    singletonKey: 'CAJA_PRINCIPAL',
  }]);
  const item = {
    _id: 'SINGLE_ITEM_ID',
    singletonKey: 'CAJA_PRINCIPAL',
    openedAt: '2026-11-11T09:30:00+01:00',
    closedAt: null,
    lastMovementAt: { $date: '2026-11-11T09:45:00+01:00' },
  };
  H.CajaActual_beforeInsert(item);
  assert.ok(item.openedAt instanceof Date);
  assert.ok(item.lastMovementAt instanceof Date);
  assert.strictEqual(item.openedAt.toISOString(), '2026-11-11T08:30:00.000Z', 'the source offset must preserve the same instant');
  assert.strictEqual(item.lastMovementAt.toISOString(), '2026-11-11T08:45:00.000Z');
  assert.throws(() => H.CajaActual_beforeInsert({
    _id: 'SINGLE_ITEM_ID',
    singletonKey: 'CAJA_PRINCIPAL',
    openedAt: 'not-a-date',
  }), /DATETIME/);
  const update = { _id: 'SINGLE_ITEM_ID', singletonKey: 'CAJA_PRINCIPAL', closedAt: '2026-11-11T10:00:00.000Z' };
  await H.CajaActual_beforeUpdate(update, { original: { singletonKey: 'IGNORED_UNTRUSTED_CONTEXT' } });
  assert.ok(update.closedAt instanceof Date);
  wixDataMock._reset();
});

test('HOOK-CAJA-00 permits projection idempotency metadata on CajaActual principal', async () => {
  wixDataMock._reset();
  const previous = { _id: 'CAJA_PRINCIPAL', singletonKey: 'CAJA_PRINCIPAL', sequenceCounters: { seqGlobal: 5, appliedMovementIds: ['movement-1'] } };
  const next = { _id: 'CAJA_PRINCIPAL', singletonKey: 'CAJA_PRINCIPAL', sequenceCounters: { seqGlobal: 5, appliedMovementIds: ['movement-1', 'movement-2'] } };
  wixDataMock._seed('CajaActual', [previous]);
  assert.strictEqual(await H.CajaActual_beforeUpdate(next), next);
  wixDataMock._reset();
});

test('HOOK-CAJA-00 blocks update when persisted CajaActual state cannot be read', async () => {
  wixDataMock._reset();
  const item = { _id: 'MISSING_CAJA', singletonKey: 'CAJA_PRINCIPAL' };
  await assert.rejects(
    () => H.CajaActual_beforeUpdate(item, { original: { singletonKey: 'CAJA_PRINCIPAL' } }),
    /no pudo recuperar el estado previo/
  );
  wixDataMock._reset();
});

test('HOOK-CAJA-01 rejects write without traceId', () => {
  const item = cajaBase();
  delete item.traceId;
  assert.throws(() => H.MovimientosCaja_beforeInsert(item), /traceId/);
});

test('HOOK-CAJA-02 rejects missing schemaVersion', () => {
  const item = { ...cajaBase() };
  delete item.schemaVersion;
  assert.throws(() => H.MovimientosCaja_beforeInsert(item), /schemaVersion/);
});

test('HOOK-CAJA-04 accepts valid baseline', () => {
  assert.doesNotThrow(() => H.MovimientosCaja_beforeInsert(cajaBase()));
});

test('HOOK-CMS-DATETIME-05 normalizes MovimientosCaja DateTime fields only', () => {
  const item = {
    ...cajaBase(),
    recordTimestamp: '2026-11-11T08:30:00.000Z',
    generationTimestamp: new Date('2026-11-11T08:31:00.000Z'),
    fechaEnvioAEAT: { $date: '2026-11-11T08:32:00.000Z' },
    fechaOperacion: '2026-11-11',
  };
  H.MovimientosCaja_beforeInsert(item);
  for (const field of ['recordTimestamp', 'generationTimestamp', 'fechaEnvioAEAT']) {
    assert.ok(item[field] instanceof Date, `${field} must be a Date`);
  }
  assert.strictEqual(item.recordTimestamp.toISOString(), '2026-11-11T08:30:00.000Z');
  assert.strictEqual(item.fechaOperacion, '2026-11-11', 'CMS DATE remains a YYYY-MM-DD string');
  assert.throws(() => H.MovimientosCaja_beforeInsert({
    ...cajaBase(),
    recordTimestamp: 'not-a-date',
  }), /DATETIME/);
});

test('HOOK-CAJA-03 preserves append-only integrity for non-TPV synthetic cash movements', async () => {
  wixDataMock._reset();
  const row = { _id: 'cash-movement-real', movementType: 'VENTA', recordSource: 'INTERNAL', traceId: 'real-ledger', sequenceNumber: 1 };
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA, [row]);
  await assert.rejects(() => H.MovimientosCaja_beforeUpdate({ ...row, totalAmount: 99 }), /Modificacion de MovimientosCaja/);
  await assert.rejects(() => H.MovimientosCaja_beforeRemove(row._id), /Borrado de MovimientosCaja/);
});

test('HOOK-CAJA-05 rejects write without hash (ledger integrity)', () => {
  // MATRIZ v15 (MovimientosCaja): la huella canónica del dominio caja/fiscal
  // es "hash"; "recordHash" queda como alias histórico de lectura.
  const item = { ...cajaBase() };
  delete item.hash;
  assert.throws(() => H.MovimientosCaja_beforeInsert(item), /hash/);
});

test('HOOK-CAJA-06 normalizes legacy recordHash alias to canonical hash', () => {
  // Historicos pre-migracion: "recordHash" es alias tolerado de entrada; la
  // normalizacion destructiva debe promoverlo a hash y purgar el alias.
  const item = { ...cajaBase(), recordHash: 'b'.repeat(64) };
  delete item.hash;
  assert.doesNotThrow(() => H.MovimientosCaja_beforeInsert(item));
  assert.equal(item.hash, 'b'.repeat(64));
  assert.ok(!("recordHash" in item), "el alias 'recordHash' debe eliminarse del documento");
});

test('HOOK-CAJA-08 enforces all physical required fields and channel enum', () => {
  const valid = cajaBase();
  assert.doesNotThrow(() => H.MovimientosCaja_beforeInsert({ ...valid }));
  for (const field of ['numSerieFactura', 'transactionId', 'previousRecordHash', 'paymentMethod', 'channelType', 'operationDescription', 'staffResourceId', 'tipoFactura', 'fechaExpedicionFactura', 'fiscalPeriod']) {
    const invalid = { ...valid, [field]: '' };
    assert.throws(() => H.MovimientosCaja_beforeInsert(invalid), new RegExp(field));
  }
  assert.throws(() => H.MovimientosCaja_beforeInsert({ ...valid, channelType: 'POS' }), /channelType/);
});

test('HOOK-CAJA-07 persists exact CMS field IDs and OBJECT payloads', () => {
  const item = {
    ...cajaBase(),
    totalAmount: 15,
    fiscalRole: 'RECEPTOR',
    nifEmisor: 'B12345674',
    nifDestinatario: '12345678Z',
    irpfWithholdingRate: 0.15,
    irpfWithholdingAmount: 15,
    lineItems: [{ productId: 'p1', variantId: 'v1' }],
    aeatPayload: 'NumSerieFactura=FAC-1',
    customerEmail: 'synthetic@example.test',
  };
  H.MovimientosCaja_beforeInsert(item);
  assert.equal(item.NIFEmisor, 'B12345674');
  assert.equal(item.NIFDestinatario, '12345678Z');
  assert.equal(item.IRPFWithholdingRate, 0.15);
  assert.equal(item.IRPFWithholdingAmount, 15);
  assert.ok(!('nifEmisor' in item));
  assert.ok(!('nifDestinatario' in item));
  assert.ok(!('irpfWithholdingRate' in item));
  assert.ok(!('irpfWithholdingAmount' in item));
  assert.deepEqual(item.lineItems, { items: [{ productId: 'p1', variantId: 'v1' }] });
  assert.equal(item.payloadFiscal.aeatPayload, 'NumSerieFactura=FAC-1');
  assert.equal(item.payloadFiscal.customerEmail, 'synthetic@example.test');
  assert.ok(!('aeatPayload' in item));
  assert.ok(!('customerEmail' in item));
  assert.equal(H.readIssuerTaxId(item), 'B12345674');
  assert.equal(H.readRecipientTaxId(item), '12345678Z');
});

test('HOOK-CMS-DATETIME-06 normalizes ControlOperativo DateTime fields', () => {
  const item = {
    controlType: 'IDEMPOTENCY',
    dedupeKey: 'IDEMPOTENCY:synthetic-date',
    traceId: 'trace-control-datetime',
    expiresAt: '2026-11-12T12:00:00.000Z',
    windowStart: '2026-11-12T11:00:00.000Z',
    processedAt: '2026-11-12T11:00:00.000Z',
    payload: {},
  };
  H.ControlOperativo_beforeInsert(item);
  for (const field of ['expiresAt', 'windowStart', 'processedAt']) assert.ok(item[field] instanceof Date);
  assert.throws(() => H.ControlOperativo_beforeInsert({
    controlType: 'IDEMPOTENCY',
    dedupeKey: 'IDEMPOTENCY:synthetic-date-invalid',
    traceId: 'trace-control-datetime-invalid',
    expiresAt: 'invalid',
  }), /DATETIME/);
});

test('HOOK-CONTROL-01 rejects retired ControlOperativo fields on new writes', () => {
  const base = {
    controlType: 'IDEMPOTENCY',
    dedupeKey: 'IDEMPOTENCY:synthetic-owner',
    traceId: 'trace-control-01',
    attempts: 2,
    expiresAt: new Date('2026-11-05T12:00:00.000Z'),
    payload: { lockOwnerId: 'synthetic-owner' },
  };
  for (const field of [
    'payloadJson', 'attempt', 'leaseExpiresAt', 'leasesExpireAt',
    'createdAt', 'updatedAt',
  ]) {
    assert.throws(
      () => H.ControlOperativo_beforeInsert({ ...base, [field]: 'retired-value' }),
      /fields not allowed/
    );
  }
  assert.doesNotThrow(() => H.ControlOperativo_beforeInsert({ ...base }));
});

// -----------------------------------------------------------------------------
// MapaStaff — physical staff mapping schema (current site)
test("HOOK-MAPASTAFF-01 validates native Wix identity keys without fiscal discriminators", () => {
  const staff = {
    recordType: IC.RECORD_TYPE.STAFF,
    staffMemberId: "0114748d-2806-3928-9b97-ff0d09853759",
    resourceId: "e556070a-6d6a-402e-8422-11133033ea76",
    scheduleId: "06af20d4-1ec3-49fa-9075-f0691dfa7fd4",
    memberId: "e52404b1-7a72-4b99-b231-66c4dc413421",
    schemaVersion: 1,
  };
  assert.doesNotThrow(() => H.MapaStaff_beforeInsert({ ...staff }));
  assert.doesNotThrow(() => H.MapaStaff_beforeUpdate({ ...staff }));
  assert.throws(() => H.MapaStaff_beforeInsert({ ...staff, scheduleId: undefined }), /scheduleId/);
});

test("HOOK-MAPASTAFF-02 CONFIG_SISTEMA uses the physical MapaStaff schema and protected singleton", () => {
  const config = {
    recordType: IC.RECORD_TYPE.CONFIG_SISTEMA,
    taxId: "B12345674",
    legalName: "Entidad fiscal de prueba",
    displayName: "Entidad fiscal de prueba",
    address: "Zaragoza",
    verifactuEnabled: false,
    thirdPartyType: null,
    schemaVersion: 1,
    traceId: "test-config-sistema",
  };
  const inserted = H.MapaStaff_beforeInsert({ ...config });
  assert.equal(inserted._id, "CONFIG_SISTEMA_FISCAL");
  assert.doesNotThrow(() => H.MapaStaff_beforeInsert({ ...config }));
  assert.throws(() => H.MapaStaff_beforeInsert({ ...config, taxId: "INVALID" }), /taxId.*valid NIF/);
  assert.throws(() => H.MapaStaff_beforeInsert({ ...config, thirdPartyType: "EMISOR" }), /thirdPartyType.*null/);
  assert.throws(() => H.MapaStaff_beforeInsert({ ...config, fechaInicioVerifactu: "01/01/2026" }), /YYYY-MM-DD/);
  assert.throws(() => H.MapaStaff_beforeInsert({ ...config, recordType: "config_sistema" }), /recordType invalido/);
  assert.throws(() => H.MapaStaff_beforeInsert({ ...config, fechaInicioVerifactu: "   " }), /solo espacios/);
  assert.throws(() => H.MapaStaff_beforeRemove({ ...config, _id: "CONFIG_SISTEMA_FISCAL" }), /SINGLETON_PROTECTED/);
});

test("HOOK-MAPASTAFF-03 TERCERO and GESTORIA use live fiscal fields; email remains optional until configured", () => {
  const thirdParty = {
    recordType: IC.RECORD_TYPE.TERCERO,
    taxId: "B12345674",
    legalName: "Proveedor de prueba",
    thirdPartyType: "PROVEEDOR",
    address: "Zaragoza",
    schemaVersion: 1,
    traceId: "test-third-party",
  };
  assert.doesNotThrow(() => H.MapaStaff_beforeInsert({ ...thirdParty }));

  const accountant = {
    recordType: IC.RECORD_TYPE.GESTORIA,
    taxId: "B12345674",
    legalName: "Gestoría de prueba",
    displayName: "Gestoría de prueba",
    thirdPartyType: "GESTORIA",
    phoneFiscal: "600000000",
    address: "Zaragoza",
    schemaVersion: 1,
    traceId: "test-accountant",
  };
  assert.doesNotThrow(() => H.MapaStaff_beforeInsert({ ...accountant }));
  assert.throws(() => H.MapaStaff_beforeInsert({ ...thirdParty, taxId: "12345678A" }), /taxId/);
  assert.throws(() => H.MapaStaff_beforeInsert({ ...accountant, emailFiscal: "invalid" }), /emailFiscal must be valid/);
});

test("HOOK-CAJA-01 normalizes JSON sequenceCounters and clears a prior-session closedAt", async () => {
  wixDataMock._reset();
  const openedAt = new Date("2026-11-14T06:00:00.000Z");
  const priorClosedAt = new Date("2026-11-12T23:00:00.000Z");
  const item = {
    _id: "CAJA_PRINCIPAL",
    singletonKey: "CAJA_PRINCIPAL",
    cashRegisterStatus: "ABIERTA",
    openedAt,
  };
  const original = {
    ...item,
    closedAt: priorClosedAt,
    sequenceCounters: "{}",
  };
  wixDataMock._seed("CajaActual", [original]);

  await H.CajaActual_beforeUpdate(item, { original: { cashRegisterStatus: "UNTRUSTED" } });
  assert.deepEqual(item.sequenceCounters, {});
  assert.equal(item.closedAt, null);

  const inserted = {
    _id: "CAJA_PRINCIPAL",
    singletonKey: "CAJA_PRINCIPAL",
    cashRegisterStatus: "ABIERTA",
    openedAt,
    closedAt: priorClosedAt,
    sequenceCounters: "{}",
  };
  H.CajaActual_beforeInsert(inserted);
  assert.deepEqual(inserted.sequenceCounters, {});
  assert.equal(inserted.closedAt, null);

  assert.throws(() => H.CajaActual_beforeInsert({
    _id: "CAJA_PRINCIPAL",
    singletonKey: "CAJA_PRINCIPAL",
    sequenceCounters: "not-json",
  }), /sequenceCounters debe ser un objeto JSON valido/);
  wixDataMock._reset();
});

// -----------------------------------------------------------------------------
// HistoricoCierresZ — CONSERVED (update restricted to signature fields)
// -----------------------------------------------------------------------------

test('HOOK-CIERREZ-01 insert needs traceId; updates use persisted strong state and allow recovery fields only', async () => {
  wixDataMock._reset();
  assert.throws(() => H.HistoricoCierresZ_beforeInsert({}), /traceId/);
  const closing = {
    traceId: 't1',
    closeDate: '2026-11-11',
    operationDate: '2026-11-11',
    fiscalPeriod: '2026-11',
    totalTaxAmount: 21,
    totalTaxBase: 100,
    totalOnline: 0,
    totalBizum: 0,
    totalCard: 0,
    totalCash: 121,
    closedBy: 'e556070a-6d6a-402e-8422-11133033ea76',
    recordDomain: 'CASH_REGISTER',
    closedAt: '2026-11-11T20:00:00.000Z',
    verifiedAt: '2026-11-11T20:01:00.000Z',
    sentAt: '2026-11-11T20:02:00.000Z',
  };
  H.HistoricoCierresZ_beforeInsert(closing);
  assert.throws(() => H.HistoricoCierresZ_beforeInsert({ ...closing, recordDomain: '' }), /recordDomain/);
  assert.throws(() => H.HistoricoCierresZ_beforeInsert({ ...closing, totalCash: '121' }), /totalCash/);
  for (const field of ['closedAt', 'verifiedAt', 'sentAt']) assert.ok(closing[field] instanceof Date);

  const persisted = {
    ...closing,
    _id: 'Z_2026-11-11',
    closingSignature: '',
    closingSignatureStatus: 'PENDING_SIGNATURE',
    csvAEAT: null,
    approverUser: null,
  };
  wixDataMock._seed('HistoricoCierresZ', [persisted]);
  const recoveryUpdate = {
    ...persisted,
    closingSignature: 'signature-recovered',
    closingSignatureStatus: 'SIGNED',
    verifiedAt: new Date('2026-11-11T20:05:00.000Z'),
    approverUser: 'authorized-recovery',
  };
  assert.strictEqual(await H.HistoricoCierresZ_beforeUpdate(recoveryUpdate), recoveryUpdate);

  const illegalUpdate = { ...persisted, totalCash: 999 };
  await assert.rejects(
    () => H.HistoricoCierresZ_beforeUpdate(illegalUpdate),
    /append-only/
  );
  await assert.rejects(
    () => H.HistoricoCierresZ_beforeUpdate({ _id: 'Z_MISSING', closingSignature: 'x' }),
    /no pudo recuperar el estado previo/
  );
  assert.throws(() => H.HistoricoCierresZ_beforeRemove('x'), /append-only/);
  wixDataMock._reset();
});

// -----------------------------------------------------------------------------
// RegistrosHorariosStaff (RD 8/2019) — CONSERVED as append-only minimal guard
// -----------------------------------------------------------------------------

test('HOOK-CLOCK-01 insert requires canonical fields and HMAC signature', () => {
  /* DEC-IC-02: el alias TIMECLOCK_TYPE fue eliminado; consumidores usan
     CLOCK_EVENT_TYPE directamente (SSOT). */
  const base = {
    resourceId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001',
    memberId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0002',
    recordId: 'clock-record-sandbox-002',
    source: IC.CLOCK_RECORD_SOURCE.WIX_WEB_METHOD,
    workDate: '2026-11-12',
    timeZone: IC.SDK_CONFIG.TZ,
    recordHash: 'b'.repeat(64),
    schemaVersion: IC.TIMECLOCK_SCHEMA_VERSION,
    recordedAt: '2026-11-12T09:00:00.000Z',
    dayKey: '2026-11-12',
    monthKey: '2026-11',
    clockEventType: IC.CLOCK_EVENT_TYPE.ENTRADA,
    recordType: IC.RECORD_TYPE_HORARIOS.REGULAR,
    signature: 'a'.repeat(64),
  };
  assert.throws(() => H.RegistrosHorariosStaff_beforeInsert({
    clockEventType: IC.CLOCK_EVENT_TYPE.ENTRADA,
  }), /resourceId/);
  assert.throws(() => H.RegistrosHorariosStaff_beforeInsert(base), /traceId/);

  const valid = { ...base, traceId: 't1' };
  assert.strictEqual(H.RegistrosHorariosStaff_beforeInsert(valid), valid);
  assert.ok(valid.recordedAt instanceof Date);
  assert.throws(() => H.RegistrosHorariosStaff_beforeInsert({ ...valid, signature: '' }), /HMAC signature/);
  assert.throws(() => H.RegistrosHorariosStaff_beforeInsert({ ...valid, dayKey: '' }), /dayKey/);
});

test('HOOK-CLOCK-02 preserves append-only integrity for timeclock records', () => {
  assert.throws(() => H.RegistrosHorariosStaff_beforeUpdate({ _id: 'synthetic-clock-1' }), /append-only/);
  assert.throws(() => H.RegistrosHorariosStaff_beforeRemove('synthetic-clock-1'), /append-only/);
});

// keep wixDataMock referenced so loader seeds reset between suites
test('HOOK-MOCK-00 loader mock available', () => {
  wixDataMock._reset();
  assert.ok(true);
});

test('HOOK-CAJA-SINGLE-01 enforces the CajaActual single-item principal', async () => {
  wixDataMock._reset();
  const principal = { _id: 'SINGLE_ITEM_ID', singletonKey: 'CAJA_PRINCIPAL' };
  assert.strictEqual(H.CajaActual_beforeInsert(principal), principal);
  assert.throws(
    () => H.CajaActual_beforeInsert({ _id: 'CAJA_SEQ', singletonKey: 'CAJA_SEQ' }),
    /SINGLE_ITEM/,
  );

  const previous = {
    _id: 'SINGLE_ITEM_ID',
    singletonKey: 'CAJA_PRINCIPAL',
    sequenceCounters: { seqGlobal: 8, appliedMovementIds: ['movement-1'] },
  };
  const next = {
    ...previous,
    sequenceCounters: { seqGlobal: 9, appliedMovementIds: ['movement-1'] },
  };
  wixDataMock._seed('CajaActual', [previous]);
  assert.strictEqual(await H.CajaActual_beforeUpdate(next), next);
  wixDataMock._reset();
});


// -----------------------------------------------------------------------------
// Capa 2 — inventory and accounting ledgers are immutable append-only records.
// -----------------------------------------------------------------------------
test('HOOK-ACCOUNTING-LEDGER-01 validates complete inserts and preserves append-only integrity', () => {
  const valid = {
    _id: 'ACC_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    journalEntryId: 'ACC-SANDBOX-ENTRY-001',
    recordTimestamp: '2026-11-20T10:00:00.000Z',
    operationDescription: 'Asiento SANDBOX sintético',
    sequenceNumber: 1,
    movementType: 'MOVIMIENTO_CAJA',
    recordSource: 'MovimientosCaja',
    documentId: 'source-document-001',
    fechaOperacion: '2026-11-20',
    fiscalPeriod: '2026-11',
    amount: 121,
    accountingAmount: 121,
    accountingSign: 1,
    desgloseDetallado: { accountCode: '000001', debitAmount: 121, creditAmount: 0 },
    previousRecordHash: '0'.repeat(64),
    hash: 'a'.repeat(64),
    traceId: 'trace-accounting-hook-001',
  };
  const normalized = H.LibroAsientosContablesDetalle_beforeInsert({ ...valid, desgloseDetallado: { ...valid.desgloseDetallado } });
  assert.ok(normalized.recordTimestamp instanceof Date);
  assert.throws(() => H.LibroAsientosContablesDetalle_beforeInsert(null), /item invalido/);
  assert.throws(() => H.LibroAsientosContablesDetalle_beforeInsert([]), /item invalido/);
  assert.throws(() => H.LibroAsientosContablesDetalle_beforeInsert({ ...valid, hash: 'invalid' }), /SHA-256/);
  assert.throws(() => H.LibroAsientosContablesDetalle_beforeInsert({ ...valid, desgloseDetallado: { ...valid.desgloseDetallado, creditAmount: 1 } }), /debit\/credit/);
  assert.throws(() => H.LibroAsientosContablesDetalle_beforeInsert({ ...valid, desgloseDetallado: { ...valid.desgloseDetallado, accountCode: 'bad' } }), /accountCode/);
  assert.throws(() => H.LibroAsientosContablesDetalle_beforeInsert((({ journalEntryId, ...rest }) => rest)(valid)), /requires TEXT journalEntryId/);
  assert.throws(() => H.LibroAsientosContablesDetalle_beforeUpdate({ _id: 'synthetic-accounting-1' }), /append-only/);
  assert.throws(() => H.LibroAsientosContablesDetalle_beforeRemove('synthetic-accounting-1'), /append-only/);
});


test('HOOK-PACKAGE-01 validates immutable accountant package snapshot inserts', () => {
  const valid = {
    _id: 'DOC_GESTORIA_2026_T1_PAQUETE_GESTORIA_V0001',
    periodType: 'QUARTERLY',
    fiscalYear: 2026,
    fiscalQuarter: 1,
    packageVersion: 1,
    summaryData: { totalOperaciones: 1 },
    invoiceData: [{ invoiceNumber: 'F-1' }],
    packageStatus: 'PREPARED',
    createdAt: '2026-11-11T20:05:00.000Z',
    snapshotHash: 'a'.repeat(64),
    schemaVersion: '1.0',
    source: 'FISCAL_AGGREGATOR',
    traceId: 'trace-package-1',
  };
  assert.strictEqual(H.PaquetesGestoria_beforeInsert(valid), valid);
  assert.ok(valid.createdAt instanceof Date);
  assert.strictEqual(valid.createdAt.toISOString(), '2026-11-11T20:05:00.000Z');
  assert.throws(() => H.PaquetesGestoria_beforeInsert({ ...valid, createdAt: undefined }), /createdAt/);
  assert.throws(() => H.PaquetesGestoria_beforeInsert({ ...valid, snapshotHash: 'invalid' }), /SHA-256/);
  assert.throws(() => H.PaquetesGestoria_beforeInsert({ ...valid, fiscalMonth: 2 }), /no admite fiscalMonth/);
});

test('HOOK-PACKAGE-02 monthly package requires month and forbids quarter', () => {
  const valid = {
    periodType: 'MONTHLY',
    fiscalYear: 2026,
    fiscalMonth: 2,
    packageVersion: 1,
    summaryData: {},
    invoiceData: [],
    packageStatus: 'PREPARED',
    createdAt: '2026-11-20T10:00:00.000Z',
    snapshotHash: 'b'.repeat(64),
    schemaVersion: '1.0',
    source: 'FISCAL_AGGREGATOR',
    traceId: 'trace-package-2',
  };
  assert.strictEqual(H.PaquetesGestoria_beforeInsert(valid), valid);
  assert.throws(() => H.PaquetesGestoria_beforeInsert({ ...valid, fiscalQuarter: 1 }), /no admite fiscalQuarter/);
});

test('HOOK-PACKAGE-03 preserves immutable gestoría package snapshots', () => {
  assert.throws(() => H.PaquetesGestoria_beforeUpdate({ _id: 'synthetic-package-1' }), /append-only/);
  assert.throws(() => H.PaquetesGestoria_beforeRemove('synthetic-package-1'), /append-only/);
});

test('HOOK-CITAS-INSERT-01 enforces all physical required booking fields', () => {
  const valid = {
    _id: 'e556070a-6d6a-402e-8422-11133033ea76',
    bookingId: 'e556070a-6d6a-402e-8422-11133033ea76',
    scheduleId: 'e556070a-6d6a-402e-8422-11133033ea76',
    serviceId: 'e556070a-6d6a-402e-8422-11133033ea76',
    resourceId: 'e556070a-6d6a-402e-8422-11133033ea76',
    slotStart: new Date('2026-11-20T10:00:00.000Z'),
    slotEnd: new Date('2026-11-20T11:00:00.000Z'),
    totalAmount: 100,
    dateYmd: '2026-11-20',
    bookingType: Object.values(IC.BOOKING_TYPE)[0],
    bookingStatus: Object.values(IC.CITAS_BOOKING_STATUS)[0],
    paymentStatus: Object.values(IC.CITAS_PAYMENT_STATUS)[0],
    traceId: 'trace-citas-insert-001',
  };
  assert.doesNotThrow(() => H.CitasF2_beforeInsert({ ...valid }));
  assert.throws(() => H.CitasF2_beforeInsert({ ...valid, slotStart: undefined }), /slotStart/);
  assert.throws(() => H.CitasF2_beforeInsert({ ...valid, totalAmount: '100' }), /totalAmount/);
});

test('HOOK-ADDON-01 requires the physical taxIncluded boolean', () => {
  const valid = { _id: 'addon-sandbox-1', addonId: 'addon-sandbox-1', sku: 'ADDON-SANDBOX-1', taxIncluded: false };
  assert.strictEqual(H.ComplementosCatalogo_beforeInsert({ ...valid }).taxIncluded, false);
  assert.throws(() => H.ComplementosCatalogo_beforeInsert({ ...valid, taxIncluded: undefined }), /taxIncluded/);
  assert.throws(() => H.ComplementosCatalogo_beforeInsert({ ...valid, taxIncluded: 'false' }), /taxIncluded/);
});

test('HOOK-CAJA-04 keeps MovimientosCaja append-only for synthetic TPV rows', async () => {
  const runId = IC.TPV_RUNTIME_POLICY.SANDBOX_RUN_ID;
  const row = {
    _id: 'TPV_HOOK_TEST_ROW',
    hash: 'a'.repeat(64),
    sequenceNumber: 0,
    transactionId: 'TPVSANDBOX_HOOK_TEST_ROW',
    traceId: 'TPV:' + runId + ':SESSION-TEST',
    movementType: 'SIMULATED_TPV_PAYMENT',
    recordSource: 'TPV_SANDBOX_SYNTHETIC',
    payloadFiscal: {
      sandboxRunId: runId,
      requestFingerprint: 'f'.repeat(64),
      logicalCollection: IC.TPV_COLLECTIONS.PAGOS,
      idempotencyKey: 'SANDBOX-PAYMENT-1',
      sandboxRecord: { amountMinor: 5000, paymentMethod: 'EFECTIVO' },
      isSynthetic: true,
      realPayment: false,
      externalSideEffects: false,
    },
  };
  wixDataMock._reset();
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA, [row]);
  await assert.rejects(
    () => H.MovimientosCaja_beforeUpdate({ ...row, payloadFiscal: { ...row.payloadFiscal, sandboxRecord: { amountMinor: 7500 } } }),
    /append-only/
  );
  await assert.rejects(() => H.MovimientosCaja_beforeRemove(row._id), /append-only/);
});
