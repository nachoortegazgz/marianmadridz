import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'fiscalDocuments.web.js'), 'utf8');
const config = readFileSync(join(here, '..', 'internalConfig.js'), 'utf8');

test('FDOC-STORAGE-01 package creation fails closed until a dedicated immutable store exists', () => {
  const start = source.indexOf('export const createManagerPackageVersion = webMethod(');
  const end = source.indexOf('// BLOQUE 4 - HISTORIAL DE PAQUETES', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const handler = source.slice(start, end);
  assert.match(handler, /PACKAGE_SNAPSHOT_STORAGE_NOT_CONFIGURED/);
  assert.match(handler, /HistoricoCierresZ está reservado a cierres Z/);
  assert.doesNotMatch(handler, /dalInsert|dalUpdate|dalSave|dalRemove/);
});

test('FDOC-STORAGE-02 package creation never fabricates mandatory Z-closing fields', () => {
  const start = source.indexOf('export const createManagerPackageVersion = webMethod(');
  const end = source.indexOf('// BLOQUE 4 - HISTORIAL DE PAQUETES', start);
  const handler = source.slice(start, end);
  for (const field of ['fiscalPeriod', 'operationDate', 'closedBy', 'recordDomain', 'totalCash', 'totalCard', 'totalBizum', 'totalOnline']) {
    assert.doesNotMatch(handler, new RegExp(field + '\\s*:'));
  }
});

test('FDOC-STORAGE-03 accountant dispatch remains disabled in canonical configuration', () => {
  assert.match(config, /ACCOUNTANT_SEND_ENABLED:\\s*false/);
  assert.match(source, /ACCOUNTANT_SEND_ENABLED\\s*=\\s*SDK_CONFIG\\.EMAIL\\.ACCOUNTANT_SEND_ENABLED\\s*===\\s*true/);
  assert.match(source, /ACCOUNTANT_SEND_DISABLED/);
});

test('FDOC-DISPATCH-01 accountant dispatch requires a persisted package snapshot', () => {
  const start = source.indexOf('export const sendManagerPackageToAccountant = webMethod(');
  const end = source.indexOf('// BLOQUE 9 - ENVIO DE DOCUMENTO CONCRETO', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const handler = source.slice(start, end);
  assert.match(handler, /params\\.documentId/);
  assert.match(handler, /dalGet\\(DOCS_COL, documentId, "strong"\\)/);
  assert.match(handler, /_buildCsvFromInvoices\\(doc\\.invoiceData\\)/);
  assert.doesNotMatch(handler, /getQuarterlyTaxSummary|getLibroRegistroFacturasExpedidasInternal/);
});

test('FDOC-CSV-01 CSV maps the persisted fiscal aggregator fields', () => {
  assert.match(source, /invoiceNumber.*numSerieFactura/);
  assert.match(source, /fechaExpedicion.*fechaOperacion/);
  assert.match(source, /taxableAmount.*taxBase/);
  assert.match(source, /hashCompleto.*recordHash.*hash/);
});

test('FDOC-HISTORY-01 legacy monthly and quarterly identifiers remain disjoint', () => {
  assert.match(source, /_packagePeriodPrefix\\(year, "MONTHLY", month\\)/);
  assert.match(source, /_packagePeriodPrefix\\(year, "QUARTERLY", quarter\\)/);
  assert.match(source, /DOC_GESTORIA_\\$\\{year\\}_\\$\\{periodKey\\}_PAQUETE_GESTORIA_/);
});
