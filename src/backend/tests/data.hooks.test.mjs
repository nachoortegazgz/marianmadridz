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

test('HOOK-CAJA-SEQ-01 normalizes object JSON and rejects invalid sequenceCounters types', () => {
  const base = (sequenceCounters, includeSequenceCounters = true) => ({
    _id: 'SINGLE_ITEM_ID',
    singletonKey: 'CAJA_PRINCIPAL',
    ...(includeSequenceCounters ? { sequenceCounters } : {}),
  });

  const objectValue = { seqGlobal: 7, appliedMovementIds: ['movement-1'] };
  const objectItem = base(objectValue);
  H.CajaActual_beforeInsert(objectItem);
  assert.strictEqual(objectItem.sequenceCounters, objectValue);

  const jsonItem = base('{"seqGlobal":8}');
  H.CajaActual_beforeInsert(jsonItem);
  assert.deepStrictEqual(jsonItem.sequenceCounters, { seqGlobal: 8 });

  const nullItem = base(null);
  assert.doesNotThrow(() => H.CajaActual_beforeInsert(nullItem));

  for (const invalid of [[], 0, 1, false, true, 'null', '[]', '"value"', '42', 'true', 'not-json']) {
    assert.throws(
      () => H.CajaActual_beforeInsert(base(invalid)),
      /CajaActual\.sequenceCounters debe ser un objeto JSON valido/,
      'invalid sequenceCounters must be rejected'
    );
  }
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

test('HOOK-TPV-SALE-01 validates TransaccionesTPV and permits validated commercial-intent updates', async () => {
  const item = {
    _id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    sessionId: 'TPV-SESSION-20261125',
    orderId: null,
    lineas: [{
      tipoLinea: 'PRODUCTO',
      itemId: 'e556070a-6d6a-402e-8422-11133033ea76',
      cantidad: 1,
      precioUnitario: 10,
      subtotalNeto: 10,
      impuestosImporte: 2.1,
      totalLinea: 12.1,
    }],
    subtotalNeto: 10,
    subtotalNetoMinor: 1000,
    impuestosTotal: 2.1,
    impuestosTotalMinor: 210,
    totalVenta: 12.1,
    totalVentaMinor: 1210,
    medioPago: null,
    paymentSelection: [],
    operatorResourceId: 'e556070a-6d6a-402e-8422-11133033ea76',
    operatorId: '0114748d-2806-3928-9b97-ff0d09853759',
    createdAt: new Date('2026-11-25T10:00:00.000Z'),
    status: 'PENDING_PAYMENT',
    sourceType: 'TPV',
    recordTimestamp: new Date('2026-11-25T10:00:00.000Z'),
    requiresReconciliation: true,
    draftOrderReason: 'DRAFT_ORDER_API_UNAVAILABLE',
    requestFingerprint: 'a'.repeat(64),
    currency: 'EUR',
    traceId: 'tpv-sale-hook-test',
  };
  assert.doesNotThrow(() => H.TransaccionesTPV_beforeInsert(item));
  wixDataMock._reset();
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.TRANSACCIONES_TPV, [item]);
  const updatedIntent = { ...item, draftOrderReason: "QA_RESETTABLE" };
  assert.equal(await H.TransaccionesTPV_beforeUpdate(updatedIntent), updatedIntent);
  const paidIntent = await H.TransaccionesTPV_beforeUpdate({ ...item, status: "PAID" });
  assert.equal(paidIntent.status, "PAID");
  await assert.rejects(
    () => H.TransaccionesTPV_beforeRemove(item._id),
    (error) => error?.code === "TPV_TRANSACTIONS_APPEND_ONLY" && error?.retryable === false
  );
  await assert.rejects(
    () => H.TransaccionesTPV_beforeRemove({ _id: item._id }),
    (error) => error?.code === "TPV_TRANSACTIONS_APPEND_ONLY"
  );
  wixDataMock._reset();

  const alternate = { ...item, sourceType: "TPV" };
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.TRANSACCIONES_TPV, [alternate]);
  await assert.rejects(
    () => H.TransaccionesTPV_beforeRemove(alternate._id),
    (error) => error?.code === "TPV_TRANSACTIONS_APPEND_ONLY"
  );
  wixDataMock._reset();
  await assert.rejects(
    () => H.TransaccionesTPV_beforeRemove("missing-tpv-intent"),
    /TransaccionesTPV remove target not found/
  );
});

test('HOOK-CAJA-TPV-01 accepts physical TPV events without fiscal invoice fields', () => {
  const item = {
    _id: 'TPV-physical-hook-001',
    transactionId: 'TPV-physical-hook-001',
    movementType: 'TPV_PAYMENT',
    recordSource: 'TPV_LEDGER',
    sequenceNumber: 1,
    previousRecordHash: '0'.repeat(64),
    hash: 'a'.repeat(64),
    amount: 10,
    totalAmount: 10,
    recordTimestamp: new Date('2026-11-25T10:00:00.000Z'),
    schemaVersion: '3',
    traceId: 'TPV:' + IC.TPV_RUNTIME_POLICY.SITE_ID + ':SESSION-TEST',
    paymentMethod: IC.PAYMENT_METHOD.EFECTIVO,
    channelType: IC.CHANNEL_TYPE.PRESENCIAL,
    operationDescription: 'Movimiento físico de caja',
    staffResourceId: 'resource-test',
    payloadFiscal: {
      sourceType: IC.TPV_RUNTIME_POLICY.SOURCE_TYPE,
      siteId: IC.TPV_RUNTIME_POLICY.SITE_ID,
      ledgerVersion: IC.TPV_RUNTIME_POLICY.LEDGER_VERSION,
      schemaVersion: IC.TPV_RUNTIME_POLICY.SCHEMA_VERSION,
      sessionId: 'SESSION-TEST',
      logicalCollection: IC.TPV_COLLECTIONS.PAGOS,
      idempotencyKey: 'TPV-TEST-IDEMPOTENCY',
      requestFingerprint: 'f'.repeat(64),
    },
    lineItems: { ledgerRecord: [] },
  };
  assert.doesNotThrow(() => H.MovimientosCaja_beforeInsert(item));
  assert.equal(item.recordSource, 'TPV_LEDGER');
  assert.equal(item.tipoFactura, undefined);
});

test('HOOK-CAJA-TPV-02 rejects legacy and environment-labelled TPV discriminators on new inserts', () => {
  for (const movementType of new Set(Object.values(IC.TPV_LEGACY_EVENT_MOVEMENT_TYPES))) {
    assert.throws(() => H.MovimientosCaja_beforeInsert({
      ...cajaBase(),
      recordSource: "TPV_LEDGER",
      movementType,
    }), /SCHEMA_VIOLATION/);
  }
  for (const recordSource of ["TPV_SYNTHETIC", "TPV_SANDBOX_SYNTHETIC", "SANDBOX_LOGICAL_PAGOS"]) {
    assert.throws(() => H.MovimientosCaja_beforeInsert({
      ...cajaBase(),
      recordSource,
      movementType: "TPV_PAYMENT",
    }), /SCHEMA_VIOLATION/);
  }
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
  assert.throws(
    () => H.MovimientosCaja_beforeUpdate({ ...row, totalAmount: 99 }),
    (error) => error?.code === "MOVIMIENTOS_CAJA_APPEND_ONLY" && error?.retryable === false
  );
  assert.throws(
    () => H.MovimientosCaja_beforeRemove(row._id),
    (error) => error?.code === "MOVIMIENTOS_CAJA_APPEND_ONLY" && error?.retryable === false
  );
  assert.throws(
    () => H.LibroAsientosContablesDetalle_beforeRemove(),
    (error) => error?.code === "ACCOUNTING_LEDGER_APPEND_ONLY" && error?.retryable === false
  );
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
  assert.throws(() => H.MapaStaff_beforeRemove({ ...config, _id: "CONFIG_SISTEMA_FISCAL" }), /CMS_DELETE_PROHIBITED/);
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

test('HOOK-CIERREZ-01 validates inserts and keeps historical closures append-only', async () => {
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

  const signatureRecoveryAttempt = {
    ...closing,
    _id: 'Z_2026-11-11',
    closingSignature: 'signature-recovered',
    closingSignatureStatus: 'SIGNED',
    verifiedAt: new Date('2026-11-11T20:05:00.000Z'),
    approverUser: 'authorized-recovery',
  };
  assert.throws(
    () => H.HistoricoCierresZ_beforeUpdate(signatureRecoveryAttempt),
    (error) => error?.code === "HISTORICO_CIERRES_Z_APPEND_ONLY" && error?.retryable === false
  );

  const illegalUpdate = { ...closing, _id: 'Z_2026-11-11', totalCash: 999 };
  assert.throws(
    () => H.HistoricoCierresZ_beforeUpdate(illegalUpdate),
    (error) => error?.code === "HISTORICO_CIERRES_Z_APPEND_ONLY" && error?.retryable === false
  );
  assert.throws(
    () => H.HistoricoCierresZ_beforeRemove('x'),
    (error) => error?.code === "HISTORICO_CIERRES_Z_APPEND_ONLY" && error?.retryable === false
  );
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
  assert.throws(
    () => H.RegistrosHorariosStaff_beforeUpdate({ _id: 'synthetic-clock-1' }),
    (error) => error?.code === "STAFF_TIME_LEDGER_APPEND_ONLY" && error?.retryable === false
  );
  assert.throws(
    () => H.RegistrosHorariosStaff_beforeRemove('synthetic-clock-1'),
    (error) => error?.code === "STAFF_TIME_LEDGER_APPEND_ONLY" && error?.retryable === false
  );
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
  assert.throws(
    () => H.LibroAsientosContablesDetalle_beforeUpdate({ _id: 'synthetic-accounting-1' }),
    (error) => error?.code === "ACCOUNTING_LEDGER_APPEND_ONLY" && error?.retryable === false
  );
  assert.throws(
    () => H.LibroAsientosContablesDetalle_beforeRemove('synthetic-accounting-1'),
    (error) => error?.code === "ACCOUNTING_LEDGER_APPEND_ONLY" && error?.retryable === false
  );
});


test('HOOK-REMOVED-01 deleted CMS collection hooks are not exported', () => {
  assert.equal(H.PaquetesGestoria_beforeInsert, undefined);
  assert.equal(H.PaquetesGestoria_beforeUpdate, undefined);
  assert.equal(H.PaquetesGestoria_beforeRemove, undefined);
  assert.equal(H.TpvSandboxIdentities_beforeInsert, undefined);
  assert.equal(H.TpvSandboxIdentities_beforeUpdate, undefined);
  assert.equal(H.TpvSandboxIdentities_beforeRemove, undefined);
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

test('HOOK-CAJA-04 preserves canonical TPV rows as append-only records', async () => {
  const row = {
    _id: 'TPV_HOOK_TEST_ROW',
    transactionId: 'TPV-HOOK-TRANSACTION-001',
    traceId: 'trace-tpv-hook-001',
    movementType: 'TPV_PAYMENT',
    recordSource: 'TPV_LEDGER',
    sequenceNumber: 1,
    hash: 'a'.repeat(64),
    payloadFiscal: {
      sourceType: IC.TPV_RUNTIME_POLICY.SOURCE_TYPE,
      siteId: IC.TPV_RUNTIME_POLICY.SITE_ID,
      ledgerVersion: IC.TPV_RUNTIME_POLICY.LEDGER_VERSION,
      schemaVersion: IC.TPV_RUNTIME_POLICY.SCHEMA_VERSION,
      sessionId: 'SESSION-HOOK-001',
      logicalCollection: IC.TPV_COLLECTIONS.PAGOS,
      idempotencyKey: 'TPV-HOOK-IDEMPOTENCY-001',
      requestFingerprint: 'f'.repeat(64),
    },
    lineItems: { ledgerRecord: [] },
  };
  wixDataMock._reset();
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA, [row]);
  assert.throws(
    () => H.MovimientosCaja_beforeUpdate({ ...row, payloadFiscal: { ...row.payloadFiscal, sandboxRecord: { amountMinor: 7500 } } }),
    (error) => error?.code === "MOVIMIENTOS_CAJA_APPEND_ONLY" && error?.retryable === false
  );
  assert.throws(
    () => H.MovimientosCaja_beforeRemove(row._id),
    (error) => error?.code === "MOVIMIENTOS_CAJA_APPEND_ONLY" && error?.retryable === false
  );
});
