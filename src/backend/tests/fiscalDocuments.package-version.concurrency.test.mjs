import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'fiscalDocuments.web.js'), 'utf8');
const config = readFileSync(join(here, '..', 'internalConfig.js'), 'utf8');
const start = source.indexOf('export const createManagerPackageVersion = webMethod(');
const end = source.indexOf('\n});', start);
const handler = source.slice(start, end < 0 ? source.length : end);

test('FDOC-VERSION-01 fiscal package versions use insert, never upsert', () => {
  assert.notEqual(start, -1, 'createManagerPackageVersion must exist');
  assert.match(source, /insertItem as dalInsert/);
  assert.doesNotMatch(source, /saveItem as dalSave/);
  assert.match(handler, /dalInsert\(DOCS_COL,\s*record\)/);
  assert.doesNotMatch(handler, /dalSave\s*\(/);
});

test('FDOC-VERSION-02 deterministic version collision fails closed with a retryable conflict', () => {
  assert.match(source, /DOC_GESTORIA_\$\{year\}_T\$\{quarter\}_PAQUETE_GESTORIA_V\$\{vStr\}/);
  assert.match(handler, /PACKAGE_VERSION_CONFLICT/);
  assert.match(handler, /WDE0074|WD_ITEM_ALREADY_EXISTS|already exists|duplicated/i);
  assert.match(handler, /Actualiza el historial y vuelve a intentarlo/);
});

test('FDOC-VERSION-03 fiscal package history remains a snapshot and is not mutated after creation', () => {
  assert.match(handler, /packageStatus:\s*"PREPARED"/);
  assert.match(handler, /packageVersion:\s*nextVersion/);
  assert.doesNotMatch(handler, /dalUpdate|dalSave|dalRemove/);
});


test('FDOC-DISPATCH-01 accountant email dispatch fails closed until immutable dispatch snapshots are implemented', () => {
  assert.match(source, /ACCOUNTANT_SEND_ENABLED\s*=\s*SDK_CONFIG\.EMAIL\.ACCOUNTANT_SEND_ENABLED\s*===\s*true/);
  assert.match(config, /ACCOUNTANT_SEND_ENABLED:\s*false/);
  assert.match(source, /function _accountantSendDisabledResult\(traceId\)/);
  for (const methodName of ['sendManagerPackageToAccountant', 'sendSpecificDocumentToAccountant']) {
    const start = source.indexOf(`export const ${methodName} = webMethod(`);
    assert.notEqual(start, -1, `${methodName} must exist`);
    const next = source.indexOf('\nexport const ', start + 20);
    const handler = source.slice(start, next < 0 ? source.length : next);
    assert.match(handler, /await requireMarianManager\(traceId\);[\s\S]*?if \(!ACCOUNTANT_SEND_ENABLED\)/);
    assert.match(handler, /return _accountantSendDisabledResult\(traceId\)/);
  }
});


test('FDOC-SNAPSHOT-01 monthly and quarterly package identities are disjoint and deterministic', () => {
  assert.match(source, /_formatMonthlyDocumentId\(year, month, version = 1\)/);
  assert.match(source, /DOC_GESTORIA_\$\{year\}_M\$\{String\(month\)\.padStart\(2, "0"\)\}_PAQUETE_GESTORIA_V/);
  assert.match(source, /_formatPackageDocumentId\(year, periodType, periodValue, nextVersion\)/);
  assert.match(source, /periodType,\s*fiscalMonth:/);
});

test('FDOC-SNAPSHOT-02 package creation rejects incomplete fiscal source reads', () => {
  assert.match(source, /summaryRes\?\.status !== "SUCCESS"/);
  assert.match(source, /bookRes\?\.status !== "SUCCESS"/);
  assert.match(source, /PACKAGE_SOURCE_DATA_UNAVAILABLE/);
  assert.match(source, /_filterInvoicesByMonth\(quarterInvoices, year, month\)/);
});

test('FDOC-SNAPSHOT-03 monthly history uses its own month prefix', () => {
  assert.match(source, /_packagePeriodPrefix\(year, "MONTHLY", month\)/);
  assert.match(source, /_packagePeriodPrefix\(year, "QUARTERLY", quarter\)/);
});

test('FDOC-SNAPSHOT-04 dispatch builds its payload only from the persisted snapshot', () => {
  const start = source.indexOf('export const sendManagerPackageToAccountant = webMethod(');
  const end = source.indexOf('// BLOQUE 9 - ENVIO DE DOCUMENTO CONCRETO', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const handler = source.slice(start, end);
  assert.match(handler, /params\.documentId/);
  assert.match(handler, /dalGet\(DOCS_COL, documentId, "strong"\)/);
  assert.match(handler, /_buildCsvFromInvoices\(doc\.invoiceData\)/);
  assert.doesNotMatch(handler, /getQuarterlyTaxSummary|getLibroRegistroFacturasExpedidasInternal/);
});

test('FDOC-SNAPSHOT-05 CSV mapping matches fiscal aggregator field names', () => {
  assert.match(source, /invoiceNumber.*numSerieFactura/);
  assert.match(source, /fechaExpedicion.*fechaOperacion/);
  assert.match(source, /taxableAmount.*taxBase/);
  assert.match(source, /hashCompleto.*recordHash.*hash/);
});

test('FDOC-SNAPSHOT-06 monthly filtering scopes by both fiscal year and month', () => {
  assert.match(source, /_filterInvoicesByMonth\(invoices, year, month\)/);
  assert.match(source, /Number\(match\[1\]\) === year && Number\(match\[2\]\) === month/);
});
