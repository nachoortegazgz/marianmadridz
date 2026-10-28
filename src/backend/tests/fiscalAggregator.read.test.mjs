/*
=============================================================================
SUITE: fiscalAggregator.read (FASE1-P0 mandatory test)
Purpose: verify _read* adapters return the CANONICAL AEAT value when present
and the legacy value with a log.warn when not, and that _getBusinessTaxId no
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

test('READ-02 taxable amount falls back to legacy with warn', () => {
  const warns = [];
  const origWarn = loggerMod.logger.warn;
  loggerMod.logger.warn = (msg, meta) => { warns.push(msg); };
  try {
    const v = T.readTaxableAmount({ taxableAmount: 80, _id: 'M1' });
    assert.strictEqual(v, 80);
    assert.ok(warns.some((w) => String(w).includes('legacy-read')), 'expected legacy-read warning');
  } finally {
    loggerMod.logger.warn = origWarn;
  }
});

test('READ-03 tax amount prefers canonical taxAmount (cuotaTotal es alias legacy)', () => {
  // SSOT Apartado 5: la clave fisica canonica es taxAmount; cuotaTotal es
  // alias de lectura para documentos historicos pre-migracion.
  assert.strictEqual(T.readTaxAmount({ taxAmount: 21, cuotaTotal: 20, cuotaIva: 19 }), 21);
});

test('READ-04 tax rate prefers canonical tipoImpositivo', () => {
  assert.strictEqual(T.readTaxRate({ tipoImpositivo: 0.21, taxRate: 0.1, tasaIva: 0.04 }), 0.21);
});

test('READ-05 tax rate legacy emits warn', () => {
  const warns = [];
  const orig = loggerMod.logger.warn;
  loggerMod.logger.warn = (m) => { warns.push(m); };
  try {
    assert.strictEqual(T.readTaxRate({ tasaIva: 0.04, _id: 'M2' }), 0.04);
    assert.ok(warns.length >= 1, 'expected at least one legacy-read warning');
  } finally {
    loggerMod.logger.warn = orig;
  }
});

test('READ-06 fiscal aggregator prefers canonical ledger hash over legacy aliases', () => {
  assert.strictEqual(
    T.readRecordHash({ hash: 'AAA', currentRecordHash: 'BBB', hashCadena: 'CCC' }),
    'AAA'
  );
});

test('TAXID-01 business tax id reads DatosFiscales CONFIG_SISTEMA nifProductor', async () => {
  wixDataMock._reset();
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.DATOS_FISCALES, [
    { recordType: IC.RECORD_TYPE.CONFIG_SISTEMA, active: true, nifProductor: 'B12345678' },
  ]);
  const id = await T.getBusinessTaxId('trace-taxid-1');
  assert.strictEqual(id, 'B12345678');
  /* FIXTURE-FIX (2026-10-13): fiscalAggregator.web.js resuelve wix-data por la
     via dataAccess (API v2), que el mock registra como op 'query_v2'; el op
     'query' corresponde al builder legacy v1. Se aceptan ambos para no
     acoplar la asercion a la capa de acceso. */
  const collectionsQueried = wixDataMock._calls
    .filter((c) => c.op === 'query' || c.op === 'query_v2')
    .map((c) => c.collection);
  assert.ok(collectionsQueried.includes('DatosFiscales'), 'must query DatosFiscales');
  assert.ok(!collectionsQueried.includes('ConfiguracionFiscal'), 'FORBIDDEN collection must NOT be queried');
});

test('TAXID-02 legacy EMISOR adapter returns taxId with warn when no config row', async () => {
  wixDataMock._reset();
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.DATOS_FISCALES, [
    { thirdPartyType: 'EMISOR', active: true, taxId: 'b99999999' },
  ]);
  const warns = [];
  const orig = loggerMod.logger.warn;
  loggerMod.logger.warn = (m) => { warns.push(m); };
  try {
    const id = await T.getBusinessTaxId('trace-taxid-2');
    assert.strictEqual(id, 'B99999999');
    assert.ok(warns.length >= 1, 'expected legacy adapter warning');
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
