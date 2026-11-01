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

// -----------------------------------------------------------------------------
// LibroAsientosContablesDetalle (PGC partida doble minima) — CONSERVED
// -----------------------------------------------------------------------------

test('HOOK-LIBRO-01 requires traceId/debitAmount/creditAmount and blocks update/remove', () => {
  assert.throws(
    () => H.LibroAsientosContablesDetalle_beforeInsert({ debitAmount: 1, creditAmount: 1 }),
    /traceId/,
  );
  assert.throws(
    () => H.LibroAsientosContablesDetalle_beforeInsert({ traceId: 't1', creditAmount: 1 }),
    /debitAmount/,
  );
  // MATRIZ v15: debit/credit erradicados por duplicidad -> escritura prohibida
  assert.throws(
    () => H.LibroAsientosContablesDetalle_beforeInsert({ traceId: 't1', debit: 10, credit: 10 }),
    /legacy/,
  );
  assert.doesNotThrow(() => H.LibroAsientosContablesDetalle_beforeInsert({
    traceId: 't1', debitAmount: 10, creditAmount: 10,
  }));
  assert.throws(() => H.LibroAsientosContablesDetalle_beforeUpdate({}), /append-only/);
  assert.throws(() => H.LibroAsientosContablesDetalle_beforeRemove({}), /append-only/);
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
