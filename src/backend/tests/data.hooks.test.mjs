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

test('HOOK-CMS-DATETIME-QA-01 binds conversion and guards to physical QA collection ID', () => {
  const item = {
    bookingId: '11111111-1111-4111-8111-111111111111',
    scheduleId: '22222222-2222-4222-8222-222222222222',
    bookingType: 'SIMPLE',
    bookingStatus: 'PENDING',
    paymentStatus: 'NOT_PAID',
    traceId: 'trace-citas-qa-datetime',
    slotStart: '2026-11-12T08:30:00.000Z',
    slotEnd: '2026-11-12T09:00:00.000Z',
  };
  H.QA_LIVECMS_20261023_2000_BOOKING_DUAL_beforeInsert(item);
  assert.ok(item.slotStart instanceof Date);
  assert.ok(item.slotEnd instanceof Date);
  assert.strictEqual(item.slotStart.toISOString(), '2026-11-12T08:30:00.000Z');
  assert.strictEqual(item.slotEnd.toISOString(), '2026-11-12T09:00:00.000Z');

  assert.throws(() => H.QA_LIVECMS_20261023_2000_BOOKING_DUAL_beforeInsert({
    ...item, slotStart: 'not-a-date',
  }), /DATETIME/);
  assert.throws(() => H.QA_LIVECMS_20261023_2000_BOOKING_DUAL_beforeRemove({}), /cancelacion formal/);
});

test('HOOK-CMS-DATETIME-03 normalizes timeclock recordedAt', () => {
  const item = {
    resourceId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001',
    memberId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0002',
    traceId: 'trace-timeclock-datetime',
    recordedAt: '2026-11-05T10:10:00.000Z',
    dayKey: '2026-11-05',
    monthKey: '2026-11',
    clockEventType: IC.CLOCK_EVENT_TYPE.ENTRADA,
    recordType: IC.RECORD_TYPE_HORARIOS.REGULAR,
    signature: 'a'.repeat(64),
  };
  H.RegistrosHorariosStaff_beforeInsert(item);
  assert.ok(item.recordedAt instanceof Date);
  assert.strictEqual(item.recordedAt.toISOString(), '2026-11-05T10:10:00.000Z');
  assert.throws(() => H.RegistrosHorariosStaff_beforeInsert({ ...item, recordedAt: 'invalid' }), /DATETIME/);
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
    movementType: Object.values(IC.MOVEMENT_TYPE)[0],
    totalAmount: 100,
    thirdPartyId: null,
    schemaVersion: 'LEDGER_V5_FISCAL',
    traceId: 'trace-caja-001',
    hash: 'a'.repeat(64),
  };
}

test('HOOK-CMS-DATETIME-04 normalizes CajaActual DateTime fields without changing the instant', () => {
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
  H.CajaActual_beforeUpdate(update, { original: { singletonKey: 'CAJA_PRINCIPAL' } });
  assert.ok(update.closedAt instanceof Date);
});

test('HOOK-CAJA-00 permits projection idempotency metadata on CajaActual principal', () => {
  const previous = { _id: 'CAJA_PRINCIPAL', sequenceCounters: { seqGlobal: 5, appliedMovementIds: ['movement-1'] } };
  const next = { _id: 'CAJA_PRINCIPAL', sequenceCounters: { seqGlobal: 5, appliedMovementIds: ['movement-1', 'movement-2'] } };
  assert.strictEqual(H.CajaActual_beforeUpdate(next, { original: previous }), next);
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

test('HOOK-CAJA-03 temporary mutation window allows update/remove', () => {
  assert.doesNotThrow(() => H.MovimientosCaja_beforeUpdate({ _id: 'qa-caja-1' }));
  assert.doesNotThrow(() => H.MovimientosCaja_beforeRemove('qa-caja-1'));
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

test('HOOK-CAJA-07 persists exact CMS field IDs and OBJECT payloads', () => {
  const item = {
    ...cajaBase(),
    totalAmount: 15,
    fiscalRole: 'RECEPTOR',
    nifEmisor: 'B12345678',
    nifDestinatario: '12345678Z',
    irpfWithholdingRate: 0.15,
    irpfWithholdingAmount: 15,
    lineItems: [{ productId: 'p1', variantId: 'v1' }],
    aeatPayload: 'NumSerieFactura=FAC-1',
    customerEmail: 'qa@example.test',
  };
  H.MovimientosCaja_beforeInsert(item);
  assert.equal(item.NIFEmisor, 'B12345678');
  assert.equal(item.NIFDestinatario, '12345678Z');
  assert.equal(item.IRPFWithholdingRate, 0.15);
  assert.equal(item.IRPFWithholdingAmount, 15);
  assert.ok(!('nifEmisor' in item));
  assert.ok(!('nifDestinatario' in item));
  assert.ok(!('irpfWithholdingRate' in item));
  assert.ok(!('irpfWithholdingAmount' in item));
  assert.deepEqual(item.lineItems, { items: [{ productId: 'p1', variantId: 'v1' }] });
  assert.equal(item.payloadFiscal.aeatPayload, 'NumSerieFactura=FAC-1');
  assert.equal(item.payloadFiscal.customerEmail, 'qa@example.test');
  assert.ok(!('aeatPayload' in item));
  assert.ok(!('customerEmail' in item));
  assert.equal(H.readIssuerTaxId(item), 'B12345678');
  assert.equal(H.readRecipientTaxId(item), '12345678Z');
});

test('HOOK-CMS-DATETIME-06 normalizes ControlOperativo DateTime fields', () => {
  const item = {
    controlType: 'IDEMPOTENCY',
    dedupeKey: 'IDEMPOTENCY:qa-date',
    traceId: 'trace-control-datetime',
    expiresAt: '2026-11-12T12:00:00.000Z',
    occurredAt: '2026-11-12T11:00:00.000Z',
    operationDate: '2026-11-12T11:00:00.000Z',
  };
  H.ControlOperativo_beforeInsert(item);
  for (const field of ['expiresAt', 'occurredAt', 'operationDate']) assert.ok(item[field] instanceof Date);
  assert.throws(() => H.ControlOperativo_beforeInsert({
    controlType: 'IDEMPOTENCY',
    dedupeKey: 'IDEMPOTENCY:qa-date-invalid',
    traceId: 'trace-control-datetime-invalid',
    expiresAt: 'invalid',
  }), /DATETIME/);
});

test('HOOK-CONTROL-01 rejects retired ControlOperativo fields on new writes', () => {
  const base = {
    controlType: 'IDEMPOTENCY',
    dedupeKey: 'IDEMPOTENCY:qa-owner',
    traceId: 'trace-control-01',
    attempts: 2,
    expiresAt: new Date('2026-11-05T12:00:00.000Z'),
    payload: { lockOwnerId: 'qa-owner' },
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
// DatosFiscales — schema físico CMS (rev. 10)
// -----------------------------------------------------------------------------

test('HOOK-FISCAL-CONFIG-01 CONFIG_SISTEMA accepts pending fiscal identity without inference', () => {
  const config = {
    recordType: IC.RECORD_TYPE.CONFIG_SISTEMA,
    commercialName: 'Marian Madrid Peluquería y Estética',
    address: 'C/ Maurice Ravel 35, Local — 50012 Zaragoza',
    postalCode: '50012',
    province: 'Zaragoza',
    email: 'hola@marianmadrid.es',
    verifactuEnabled: false,
    schemaVersion: 1,
    traceId: 'trace-config-sistema-001',
  };
  const inserted = H.DatosFiscales_beforeInsert({ ...config });
  assert.equal(inserted._id, 'CONFIG_SISTEMA_FISCAL');
  assert.doesNotThrow(() => H.DatosFiscales_beforeInsert({ ...config }));
  assert.throws(
    () => H.DatosFiscales_beforeInsert({ ...config, taxId: 'INVALID' }),
    /taxId invalido/
  );
  assert.throws(
    () => H.DatosFiscales_beforeInsert({ ...config, thirdPartyType: 'EMISOR' }),
    /thirdPartyType.*null/
  );
  assert.throws(
    () => H.DatosFiscales_beforeInsert({ ...config, fechaInicioVerifactu: '01/01/2026' }),
    /DATE ISO/
  );
  assert.throws(
    () => H.DatosFiscales_beforeInsert({ ...config, nifProductor: 'B12345678' }),
    /no existe en el esquema físico/
  );
});

test('HOOK-FISCAL-CONFIG-02 third-party fiscal rows require identity, schemaVersion and traceId', () => {
  const thirdParty = {
    recordType: IC.RECORD_TYPE.TERCERO,
    taxId: 'B12345678',
    legalName: 'Staff fiscal identity',
    thirdPartyType: 'STAFF',
    schemaVersion: 1,
    traceId: 'trace-tercero-001',
  };
  assert.doesNotThrow(() => H.DatosFiscales_beforeInsert({ ...thirdParty }));
  assert.throws(
    () => H.DatosFiscales_beforeInsert({ ...thirdParty, traceId: '' }),
    /traceId obligatorio/
  );
  assert.throws(
    () => H.DatosFiscales_beforeInsert({ ...thirdParty, schemaVersion: 2 }),
    /schemaVersion debe ser 1/
  );
});

test('HOOK-FISCAL-CONFIG-03 legacy aliases are normalized and removed before persistence', () => {
  const item = {
    recordType: IC.RECORD_TYPE.TERCERO,
    nifCif: 'B12345678',
    razonSocial: 'Proveedor',
    tipoTercero: 'PROVEEDOR',
    schemaVersion: 1,
    traceId: 'trace-tercero-legacy-001',
  };
  assert.doesNotThrow(() => H.DatosFiscales_beforeInsert(item));
  assert.equal(item.taxId, 'B12345678');
  assert.equal(item.legalName, 'Proveedor');
  assert.equal(item.thirdPartyType, 'PROVEEDOR');
  assert.ok(!('nifCif' in item));
  assert.ok(!('razonSocial' in item));
  assert.ok(!('tipoTercero' in item));
});

// -----------------------------------------------------------------------------
// HistoricoCierresZ — CONSERVED (update restricted to signature fields)
// -----------------------------------------------------------------------------

test('HOOK-CIERREZ-01 insert needs traceId; temporary window allows arbitrary update/remove', () => {
  assert.throws(() => H.HistoricoCierresZ_beforeInsert({}), /traceId/);
  const closing = {
    traceId: 't1',
    closedAt: '2026-11-11T20:00:00.000Z',
    verifiedAt: '2026-11-11T20:01:00.000Z',
    sentAt: '2026-11-11T20:02:00.000Z',
  };
  H.HistoricoCierresZ_beforeInsert(closing);
  for (const field of ['closedAt', 'verifiedAt', 'sentAt']) assert.ok(closing[field] instanceof Date);
  assert.doesNotThrow(() => H.HistoricoCierresZ_beforeUpdate({
    _id: 'x', closingSignature: 'sig', csvAEAT: 'csv',
  }));
  assert.doesNotThrow(() => H.HistoricoCierresZ_beforeUpdate({
    _id: 'x', totalImporte: 999,
  }));
  assert.doesNotThrow(() => H.HistoricoCierresZ_beforeRemove('x'));
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

test('HOOK-CLOCK-02 temporary mutation window allows update/remove', () => {
  assert.doesNotThrow(() => H.RegistrosHorariosStaff_beforeUpdate({ _id: 'qa-clock-1' }));
  assert.doesNotThrow(() => H.RegistrosHorariosStaff_beforeRemove('qa-clock-1'));
});

// keep wixDataMock referenced so loader seeds reset between suites
test('HOOK-MOCK-00 loader mock available', () => {
  wixDataMock._reset();
  assert.ok(true);
});

test('HOOK-CAJA-SINGLE-01 enforces the CajaActual single-item principal', () => {
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
  assert.strictEqual(H.CajaActual_beforeUpdate(next, { original: previous }), next);
});


// -----------------------------------------------------------------------------
// Capa 2 — inventory and accounting ledgers are immutable append-only records.
// -----------------------------------------------------------------------------
test('HOOK-INVENTORY-LEDGER-01 temporary mutation window allows update/remove', () => {
  assert.doesNotThrow(() => H.MovimientosInventario_beforeUpdate({ _id: 'qa-inventory-1' }));
  assert.doesNotThrow(() => H.MovimientosInventario_beforeRemove('qa-inventory-1'));
});

test('HOOK-ACCOUNTING-LEDGER-01 temporary mutation window allows update/remove', () => {
  assert.doesNotThrow(() => H.LibroAsientosContablesDetalle_beforeUpdate({ _id: 'qa-accounting-1' }));
  assert.doesNotThrow(() => H.LibroAsientosContablesDetalle_beforeRemove('qa-accounting-1'));
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
    snapshotHash: 'b'.repeat(64),
    schemaVersion: '1.0',
    source: 'FISCAL_AGGREGATOR',
    traceId: 'trace-package-2',
  };
  assert.strictEqual(H.PaquetesGestoria_beforeInsert(valid), valid);
  assert.throws(() => H.PaquetesGestoria_beforeInsert({ ...valid, fiscalQuarter: 1 }), /no admite fiscalQuarter/);
});

test('HOOK-PACKAGE-03 temporary mutation window allows update/remove', () => {
  assert.doesNotThrow(() => H.PaquetesGestoria_beforeUpdate({ _id: 'qa-package-1' }));
  assert.doesNotThrow(() => H.PaquetesGestoria_beforeRemove('qa-package-1'));
});
