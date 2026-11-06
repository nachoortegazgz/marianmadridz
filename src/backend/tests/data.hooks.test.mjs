/*
=============================================================================
SUITE: data.hooks (v13.0-MINIMAL alignment, 2026-10-14)
Purpose: sell the RETIREMENT decisions DATA-01..DATA-05 (hooks that added
friction without real benefit: duplicated point-of-use validation and
compliance-free collections) AND verify the conserved legal guards
(Ley 11/2021 caja ledger, PGC double entry, RD 8/2019 time clock,
WEBHOOK_EVENT append-only). Runs offline via tests/loader.mjs mocks.
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
  assert.throws(() => H.CitasF2_beforeRemove({}), /cancelacion formal/);
});

test('HOOK-CMS-DATETIME-01 normalizes CitasF2 slot dates to Date objects', () => {
  const item = {
    bookingId: '11111111-1111-4111-8111-111111111111',
    bookingType: 'SIMPLE',
    bookingStatus: 'PENDING',
    paymentStatus: 'NOT_PAID',
    traceId: 'trace-citas-datetime',
    slotStart: '2026-11-12T08:30:00.000Z',
    slotEnd: '2026-11-12T09:00:00.000Z',
  };
  H.CitasF2_beforeInsert(item);
  assert.ok(item.slotStart instanceof Date);
  assert.ok(item.slotEnd instanceof Date);
  assert.strictEqual(item.slotStart.toISOString(), '2026-11-12T08:30:00.000Z');
  assert.strictEqual(item.slotEnd.toISOString(), '2026-11-12T09:00:00.000Z');
  assert.throws(() => H.CitasF2_beforeInsert({ ...item, slotStart: 'not-a-date' }), /DATETIME/);
});

test('HOOK-CMS-DATETIME-QA-01 binds conversion and guards to physical QA collection ID', () => {
  const item = {
    bookingId: '11111111-1111-4111-8111-111111111111',
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

test('HOOK-CMS-DATETIME-02 normalizes inventory DATETIME fields', () => {
  const stock = { stockOnHand: 4, stockReserved: 1, stockAvailable: 3, lastSyncAt: '2026-11-05T10:00:00.000Z' };
  H.InventarioStockVenta_beforeInsert(stock);
  assert.ok(stock.lastSyncAt instanceof Date);

  const movement = {
    traceId: 'trace-inventory-datetime',
    movementToken: 'movement-datetime-1',
    movementType: 'AJUSTE',
    reason: 'Ajuste de prueba',
    quantity: 1,
    recordTimestamp: '2026-11-05T10:05:00.000Z',
  };
  H.MovimientosInventario_beforeInsert(movement);
  assert.ok(movement.recordTimestamp instanceof Date);
  assert.throws(() => H.MovimientosInventario_beforeInsert({ ...movement, recordTimestamp: 'invalid' }), /DATETIME/);
});

test('HOOK-CMS-DATETIME-03 normalizes timeclock recordedAt', () => {
  const item = { traceId: 'trace-timeclock-datetime', recordedAt: '2026-11-05T10:10:00.000Z' };
  H.RegistrosHorariosStaff_beforeInsert(item);
  assert.ok(item.recordedAt instanceof Date);
  assert.strictEqual(item.recordedAt.toISOString(), '2026-11-05T10:10:00.000Z');
  assert.throws(() => H.RegistrosHorariosStaff_beforeInsert({ ...item, recordedAt: 'invalid' }), /DATETIME/);
});

// -----------------------------------------------------------------------------
// SSOT 5.13 / 15.1: inventory movements are append-only; stock projection
// updates remain allowed only when the stock invariant is satisfied.
// -----------------------------------------------------------------------------

test('HOOK-INVENTORY-01 movements ledger blocks update/remove', () => {
  assert.throws(() => H.MovimientosInventario_beforeUpdate({}), /append-only/);
  assert.throws(() => H.MovimientosInventario_beforeRemove({}), /append-only/);
});

test('HOOK-INVENTORY-02 stock projection update enforces invariant', () => {
  assert.doesNotThrow(() => H.InventarioStockVenta_beforeUpdate({
    stockOnHand: 10, stockReserved: 3, stockAvailable: 7,
  }));
  assert.throws(() => H.InventarioStockVenta_beforeUpdate({
    stockOnHand: 10, stockReserved: 3, stockAvailable: 8,
  }), /Invariante de stock/);
});

test('HOOK-APPEND-02 retired blocked-collection hooks are gone (ADR-02)', () => {
  assert.strictEqual(H.SecuenciaTickets_beforeUpdate, undefined);
  assert.strictEqual(H.InventarioStockVentaCierre_beforeUpdate, undefined);
  assert.strictEqual(H.InventarioStockVentaCierre_beforeRemove, undefined);
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

test('HOOK-CAJA-03 update/remove remain forbidden', () => {
  assert.throws(() => H.MovimientosCaja_beforeUpdate({}), /FISCAL_VIOLATION/);
  assert.throws(() => H.MovimientosCaja_beforeRemove({}), /FISCAL_VIOLATION/);
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

test('HOOK-CONTROL-01 canonicalizes duplicate ControlOperativo columns', () => {
  const expiresAt = new Date('2026-11-05T12:00:00.000Z');
  const item = {
    controlType: 'IDEMPOTENCY',
    attempt: 2,
    leaseExpiresAt: expiresAt,
    createdAt: new Date(),
    updatedAt: new Date(),
    payloadJson: JSON.stringify({ lockOwnerId: 'qa-owner' }),
  };
  H.ControlOperativo_beforeInsert(item);
  assert.equal(item.attempts, 2);
  assert.equal(item.expiresAt, expiresAt);
  assert.ok(!('attempt' in item));
  assert.ok(!('leaseExpiresAt' in item));
  assert.ok(!('createdAt' in item));
  assert.ok(!('updatedAt' in item));
  assert.deepEqual(item.payload, { lockOwnerId: 'qa-owner' });
  assert.ok(!('payloadJson' in item));
});

// -----------------------------------------------------------------------------
// DatosFiscales — schema físico CMS (rev. 10)
// -----------------------------------------------------------------------------

test('HOOK-FISCAL-CONFIG-01 accepts physical CMS fields and BOOLEAN flags', () => {
  const config = {
    recordType: IC.RECORD_TYPE.CONFIG_SISTEMA,
    taxId: 'B12345678',
    legalName: 'Marian Madrid',
    thirdPartyType: 'EMISOR',
    verifactuEnabled: true,
    verifactuVersion: '1.0',
    tipoUsoPosibleMultiOT: true,
    indicadorMultiplesOT: false,
    fechaInicioVerifactu: '2026-01-01',
  };
  assert.doesNotThrow(() => H.DatosFiscales_beforeInsert({ ...config }));
  assert.throws(
    () => H.DatosFiscales_beforeInsert({ ...config, tipoUsoPosibleMultiOT: 'S' }),
    /BOOLEAN/
  );
  assert.throws(
    () => H.DatosFiscales_beforeInsert({ ...config, nifProductor: 'B12345678' }),
    /no existe en el esquema físico/
  );
});

test('HOOK-FISCAL-CONFIG-02 staff fiscal master does not require absent identity columns', () => {
  assert.doesNotThrow(() => H.DatosFiscales_beforeInsert({
    recordType: IC.RECORD_TYPE.TERCERO,
    taxId: 'B12345678',
    legalName: 'Staff fiscal identity',
    thirdPartyType: 'STAFF',
  }));
});

test('HOOK-FISCAL-CONFIG-03 legacy aliases are normalized and removed before persistence', () => {
  const item = {
    recordType: IC.RECORD_TYPE.TERCERO,
    nifCif: 'B12345678',
    razonSocial: 'Proveedor',
    tipoTercero: 'PROVEEDOR',
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
// LibroAsientosContablesDetalle (PGC partida doble minima) — CONSERVED
// -----------------------------------------------------------------------------

function validLibroEntry() {
  return {
    entryId: 'ASIENTO_11111111-1111-4111-8111-111111111111',
    recordTimestamp: new Date('2026-11-05T10:00:00.000Z'),
    concept: 'Venta mostrador',
    lineNumber: 1,
    origenTipo: 'MOVIMIENTOCAJA',
    origenRegistro: 'MovimientosCaja',
    sourceMovementId: '11111111-1111-4111-8111-111111111111',
    entryDate: '2026-11-05',
    fiscalPeriod: '2026-11',
    accountCode: '572000',
    debitAmount: 10,
    creditAmount: 10,
    recordHash: 'a'.repeat(64),
    previousRecordHash: 'b'.repeat(64),
    traceId: 't1',
  };
}

test('HOOK-LIBRO-01 enforces the full CMS provenance contract and blocks update/remove', () => {
  const missingTrace = validLibroEntry();
  delete missingTrace.traceId;
  assert.throws(() => H.LibroAsientosContablesDetalle_beforeInsert(missingTrace), /traceId/);

  const missingSource = validLibroEntry();
  delete missingSource.sourceMovementId;
  assert.throws(() => H.LibroAsientosContablesDetalle_beforeInsert(missingSource), /sourceMovementId/);

  const missingPreviousHash = validLibroEntry();
  delete missingPreviousHash.previousRecordHash;
  assert.throws(() => H.LibroAsientosContablesDetalle_beforeInsert(missingPreviousHash), /previousRecordHash/);

  const legacy = validLibroEntry();
  legacy.debit = 10;
  assert.throws(() => H.LibroAsientosContablesDetalle_beforeInsert(legacy), /legacy/);

  assert.doesNotThrow(() => H.LibroAsientosContablesDetalle_beforeInsert(validLibroEntry()));
  assert.throws(() => H.LibroAsientosContablesDetalle_beforeUpdate({}), /append-only/);
  assert.throws(() => H.LibroAsientosContablesDetalle_beforeRemove({}), /append-only/);
});

test('HOOK-LIBRO-02 AEAT snapshot requires fiscal system identity only when a snapshot is written', () => {
  const withSnapshot = { ...validLibroEntry(), payloadFiscal: {
    numSerieFactura: 'FAC-2026-00001',
    descripcionOperacion: 'Venta mostrador',
  } };
  assert.throws(() => H.LibroAsientosContablesDetalle_beforeInsert(withSnapshot), /idSistemaInformatico/);
  withSnapshot.idSistemaInformatico = 'WIX-MARIAN-01';
  assert.doesNotThrow(() => H.LibroAsientosContablesDetalle_beforeInsert(withSnapshot));
});

// -----------------------------------------------------------------------------
// HistoricoCierresZ — CONSERVED (update restricted to signature fields)
// -----------------------------------------------------------------------------

test('HOOK-CIERREZ-01 insert needs traceId; update limited to signature fields', () => {
  assert.throws(() => H.HistoricoCierresZ_beforeInsert({}), /traceId/);
  assert.doesNotThrow(() => H.HistoricoCierresZ_beforeInsert({ traceId: 't1' }));
  assert.doesNotThrow(() => H.HistoricoCierresZ_beforeUpdate({
    _id: 'x', closingSignature: 'sig', csvAEAT: 'csv',
  }));
  assert.throws(() => H.HistoricoCierresZ_beforeUpdate({
    _id: 'x', totalImporte: 999,
  }), /signature\/verification/);
  assert.throws(() => H.HistoricoCierresZ_beforeRemove({}), /append-only/);
});

// -----------------------------------------------------------------------------
// RegistrosHorariosStaff (RD 8/2019) — CONSERVED as append-only minimal guard
// -----------------------------------------------------------------------------

test('HOOK-CLOCK-01 insert requires traceId', () => {
  /* DEC-IC-02: el alias TIMECLOCK_TYPE fue eliminado; consumidores usan
     CLOCK_EVENT_TYPE directamente (SSOT). */
  assert.throws(() => H.RegistrosHorariosStaff_beforeInsert({
    clockEventType: IC.CLOCK_EVENT_TYPE.ENTRADA,
  }), /traceId/);
  assert.doesNotThrow(() => H.RegistrosHorariosStaff_beforeInsert({
    clockEventType: IC.CLOCK_EVENT_TYPE.ENTRADA, traceId: 't1',
  }));
});

test('HOOK-CLOCK-02 update/remove forbidden (RD 8/2019)', () => {
  assert.throws(() => H.RegistrosHorariosStaff_beforeUpdate({}), /append-only/);
  assert.throws(() => H.RegistrosHorariosStaff_beforeRemove({}), /append-only/);
});

// keep wixDataMock referenced so loader seeds reset between suites
test('HOOK-MOCK-00 loader mock available', () => {
  wixDataMock._reset();
  assert.ok(true);
});
