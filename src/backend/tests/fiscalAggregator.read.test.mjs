/*
=============================================================================
SUITE: fiscalAggregator.read (FASE1-P0 mandatory test)
Purpose: verify _read* adapters return the CANONICAL AEAT value when present
and the historical value with a log.warn when not, and that _getBusinessTaxId no
longer touches the FORBIDDEN ConfiguracionFiscal collection.
Runs offline via tests/loader.mjs mocks. G10 ASCII strict.
=============================================================================
*/
import test from 'node:test';
import assert from 'node:assert';

const { wixDataMock } = await import('./loader.mjs');
// ADR-06 Etapa A: convencion unica backend/<modulo>.web.js (incl. tests)
const FA = await import('backend/fiscalAggregator.web.js');
const IC = await import('backend/internalConfig');
const loggerMod = await import('backend/logger');

const T = FA.__test__;

test('READ-01 taxable amount prefers canonical baseImponibleOImporteNoSujeto', () => {
  const v = T.readTaxableAmount({
    baseImponibleOImporteNoSujeto: 100,
    taxableBaseOrNonSubjectAmount: 90,
    taxableAmount: 80,
  });
  assert.strictEqual(v, 100);
});

test('READ-02 taxable amount falls back to historical with warn', () => {
  const warns = [];
  const origWarn = loggerMod.logger.warn;
  loggerMod.logger.warn = (msg, meta) => { warns.push(msg); };
  try {
    const v = T.readTaxableAmount({ taxableAmount: 80, _id: 'M1' });
    assert.strictEqual(v, 80);
    assert.ok(warns.some((w) => String(w).includes('historical-field-read')), 'expected historical-field-read warning');
  } finally {
    loggerMod.logger.warn = origWarn;
  }
});

test('READ-03 tax amount prefers canonical taxAmount (cuotaTotal es alias historical)', () => {
  // SSOT Apartado 5: la clave fisica canonica es taxAmount; cuotaTotal es
  // alias de lectura para documentos historicos pre-migracion.
  assert.strictEqual(T.readTaxAmount({ taxAmount: 21, cuotaTotal: 20, cuotaIva: 19 }), 21);
});

test('READ-04 tax rate prefers canonical tipoImpositivo', () => {
  assert.strictEqual(T.readTaxRate({ tipoImpositivo: 0.21, taxRate: 0.1, tasaIva: 0.04 }), 0.21);
});

test('READ-05 tax rate historical emits warn', () => {
  const warns = [];
  const orig = loggerMod.logger.warn;
  loggerMod.logger.warn = (m) => { warns.push(m); };
  try {
    assert.strictEqual(T.readTaxRate({ tasaIva: 0.04, _id: 'M2' }), 0.04);
    assert.ok(warns.length >= 1, 'expected at least one historical-field-read warning');
  } finally {
    loggerMod.logger.warn = orig;
  }
});

test('READ-06 fiscal aggregator prefers canonical ledger hash over historical aliases', () => {
  assert.strictEqual(
    T.readRecordHash({ hash: 'AAA', currentRecordHash: 'BBB', hashCadena: 'CCC' }),
    'AAA'
  );
});

test('TAXID-01 business tax id reads DatosFiscales CONFIG_SISTEMA taxId', async () => {
  wixDataMock._reset();
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.DATOS_FISCALES, [
    { recordType: IC.RECORD_TYPE.CONFIG_SISTEMA, taxId: 'B12345678', legalName: 'Marian Madrid', thirdPartyType: 'EMISOR' },
  ]);
  const id = await T.getBusinessTaxId('trace-taxid-1');
  assert.strictEqual(id, 'B12345678');
  /* FIXTURE-FIX (2026-10-13): fiscalAggregator.web.js resuelve wix-data por la
     via dataAccess (API v2), que el mock registra como op 'query_v2'; el op
     'query' corresponde al builder historical v1. Se aceptan ambos para no
     acoplar la asercion a la capa de acceso. */
  const collectionsQueried = wixDataMock._calls
    .filter((c) => c.op === 'query' || c.op === 'query_v2')
    .map((c) => c.collection);
  assert.ok(collectionsQueried.includes('DatosFiscales'), 'must query DatosFiscales');
  assert.ok(!collectionsQueried.includes('ConfiguracionFiscal'), 'FORBIDDEN collection must NOT be queried');
});

test('TAXID-02 historical EMISOR adapter returns taxId with warn when no config row', async () => {
  wixDataMock._reset();
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.DATOS_FISCALES, [
    { recordType: IC.RECORD_TYPE.TERCERO, thirdPartyType: 'EMISOR', taxId: 'b99999999' },
  ]);
  const warns = [];
  const orig = loggerMod.logger.warn;
  loggerMod.logger.warn = (m) => { warns.push(m); };
  try {
    const id = await T.getBusinessTaxId('trace-taxid-2');
    assert.strictEqual(id, 'B99999999');
    assert.ok(warns.length >= 1, 'expected historical adapter warning');
  } finally {
    loggerMod.logger.warn = orig;
  }
});

test('TAXID-03 throws FISCAL_CONFIG_MISSING when nothing found (SSOT v20.1: placeholder BXXXXXXXX ERRADICADO)', async () => {
  wixDataMock._reset();
  // Decision documentada (docs/adr/ADR-08-fiscal-taxid-throw.md): sin NIF real
  // no se publica resumen fiscal -> _getBusinessTaxId LANZA, no devuelve
  // placeholder. El fallback "BXXXXXXXX" quedo erradicado en v20.1.
  await assert.rejects(
    () => T.getBusinessTaxId('trace-taxid-3'),
    /FISCAL_CONFIG_MISSING/
  );
});

test('DEDUPE-01 prepareScheduledManagerPackages removed from aggregator', () => {
  assert.strictEqual(FA.prepareScheduledManagerPackages, undefined);
});


test('FISCAL-PAGING-01 truncated quarterly summary is rejected, never returned as a successful partial report', async () => {
  wixDataMock._reset();
  const movements = Array.from({ length: 5001 }, (_, index) => ({
    _id: `fiscal-paging-${index + 1}`,
    fiscalPeriod: '2026-01',
    sequenceNumber: index + 1,
    movementType: 'VENTA',
    accountingAmount: 10,
    taxBase: 8.26,
    taxAmount: 1.74,
    totalAmount: 10,
    paymentMethod: 'EFECTIVO',
    tipoImpositivo: 0.21,
  }));
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA, movements);

  const result = await FA.getQuarterlyTaxSummaryInternal(2026, 1, { traceId: 'trace-fiscal-page-cap-001' });

  assert.equal(result.status, 'ERROR');
  assert.equal(result.data, null);
  assert.equal(result.error.code, 'FISCAL_DATASET_LIMIT_EXCEEDED');
});

test('FISCAL-PAGING-02 truncated sales ledger is rejected, never returned as a successful partial export', async () => {
  wixDataMock._reset();
  const movements = Array.from({ length: 5001 }, (_, index) => ({
    _id: `fiscal-ledger-paging-${index + 1}`,
    fiscalPeriod: '2026-01',
    sequenceNumber: index + 1,
    movementType: 'VENTA',
    accountingAmount: 10,
    taxBase: 8.26,
    taxAmount: 1.74,
    totalAmount: 10,
    paymentMethod: 'EFECTIVO',
    tipoImpositivo: 0.21,
  }));
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA, movements);

  const result = await FA.getLibroRegistroFacturasExpedidasInternal(2026, 1, { traceId: 'trace-fiscal-page-cap-002' });

  assert.equal(result.status, 'ERROR');
  assert.equal(result.data, null);
  assert.equal(result.error.code, 'FISCAL_DATASET_LIMIT_EXCEEDED');
});


test('FISCAL-SIGN-01 refunds net taxable base and tax by accounting sign', () => {
  const state = T.initTaxAccumulator(['2026-01']);
  T.accumulatePage([{
    _id: 'refund-sign-1',
    fiscalPeriod: '2026-01',
    movementType: 'REEMBOLSO',
    operationNature: 'DEVOLUCION',
    paymentMethod: 'WIX_PAYMENTS',
    accountingAmount: -10,
    accountingSign: -1,
    taxBase: 8.26,
    taxAmount: 1.74,
    tipoImpositivo: 0.21,
  }], state);

  assert.equal(state.totalTaxableAmount, -8.26);
  assert.equal(state.totalTaxAmount, -1.74);
  assert.equal(state.totalInvoiced, -10);
  assert.equal(state.breakdownByPaymentMethod.online, -10);
  assert.equal(state.breakdownByMonth['2026-01'].taxableAmount, -8.26);
});

test('FISCAL-PAYMENT-01 transfer and Wix Payments use distinct payment buckets', () => {
  const state = T.initTaxAccumulator(['2026-01']);
  T.accumulatePage([
    {
      _id: 'transfer-bucket-1',
      fiscalPeriod: '2026-01',
      movementType: 'VENTA',
      operationNature: 'VENTA',
      paymentMethod: 'TRANSFERENCIA',
      accountingAmount: 50,
      accountingSign: 1,
      taxBase: 41.32,
      taxAmount: 8.68,
      tipoImpositivo: 0.21,
    },
    {
      _id: 'wix-payments-bucket-1',
      fiscalPeriod: '2026-01',
      movementType: 'VENTA_ONLINE',
      operationNature: 'VENTA',
      paymentMethod: 'WIX_PAYMENTS',
      accountingAmount: 20,
      accountingSign: 1,
      taxBase: 16.53,
      taxAmount: 3.47,
      tipoImpositivo: 0.21,
    },
  ], state);

  assert.equal(state.breakdownByPaymentMethod.transferencia, 50);
  assert.equal(state.breakdownByPaymentMethod.online, 20);
});


test('FISCAL-SMOKE-01 explicit smoke-test movements are excluded from quarterly totals', async () => {
  wixDataMock._reset();
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.DATOS_FISCALES, [
    { recordType: IC.RECORD_TYPE.CONFIG_SISTEMA, taxId: 'B12345678', legalName: 'Marian Madrid', thirdPartyType: 'EMISOR' },
  ]);
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA, [
    {
      _id: 'smoke-movement-001',
      fiscalPeriod: '2026-11',
      sequenceNumber: 0,
      recordSource: 'SMOKE_TEST',
      eventType: 'SIMULATED_PAYMENT',
      movementType: 'VENTA_POS_SIMULADA',
      accountingAmount: 25,
      taxBase: 20.66,
      taxAmount: 4.34,
      totalAmount: 25,
      paymentMethod: 'EFECTIVO',
      tipoImpositivo: 0.21,
      hash: 'SIMULATED_HASH',
      previousRecordHash: 'SIMULATED_PREVIOUS_HASH',
    },
    {
      _id: 'unmarked-simulated-movement-001',
      fiscalPeriod: '2026-11',
      sequenceNumber: 5,
      eventType: 'RESERVA_CONFIRMADA',
      movementType: 'SIMULATED_PAYMENT',
      accountingAmount: 999,
      taxBase: 825.62,
      taxAmount: 173.38,
      totalAmount: 999,
      paymentMethod: 'WIX_PAYMENTS',
      tipoImpositivo: 0.21,
      hash: 'b'.repeat(64),
      previousRecordHash: 'a'.repeat(64),
    },
    {
      _id: 'real-movement-001',
      fiscalPeriod: '2026-11',
      sequenceNumber: 1,
      recordSource: 'INTERNAL',
      eventType: 'VENTA_LINEA',
      movementType: 'VENTA_ONLINE',
      accountingAmount: 27.71,
      taxBase: 22.9,
      taxAmount: 4.81,
      totalAmount: 27.71,
      paymentMethod: 'WIX_PAYMENTS',
      tipoImpositivo: 0.21,
      hash: 'a'.repeat(64),
      previousRecordHash: '0'.repeat(64),
    },
  ]);

  const result = await FA.getQuarterlyTaxSummaryInternal(2026, 4, { traceId: 'trace-fiscal-smoke-001' });

  assert.equal(result.status, 'SUCCESS', JSON.stringify(result.error));
  assert.equal(result.data.totalOperaciones, 1);
  assert.equal(result.data.totalOperacionesFiscales, 1);
  assert.equal(result.data.totales.totalVentasBrutas, 27.71);
  assert.equal(result.data.borradorIva.baseImponibleRegistrada, 22.9);
  assert.equal(result.data.borradorIva.cuotaIvaRegistrada, 4.81);
});