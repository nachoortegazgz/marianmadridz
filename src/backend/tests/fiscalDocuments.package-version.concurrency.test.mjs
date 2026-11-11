import test from 'node:test';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'fiscalDocuments.web.js'), 'utf8');
const config = readFileSync(join(here, '..', 'internalConfig.js'), 'utf8');

function extractBlock(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `Missing block: ${startMarker}`);
  assert.notEqual(end, -1, `Missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

function assertDisabledBeforeOperations(handler, operations) {
  const guard = handler.indexOf('if (!ACCOUNTANT_SEND_ENABLED)');
  assert.notEqual(guard, -1, 'Dispatch must have an explicit disabled guard');
  for (const operation of operations) {
    const operationIndex = handler.indexOf(operation);
    assert.notEqual(operationIndex, -1, `Expected operation in handler: ${operation}`);
    assert.ok(guard < operationIndex, `Disabled guard must precede ${operation}`);
  }
  assert.match(handler, /_accountantSendDisabledResult\(traceId\)/);
}

test('FDOC-STORAGE-01 snapshot creation requires manager authorization, quarterly period and stable operation UUID', () => {
  const handler = extractBlock(
    'export const createManagerPackageVersion = webMethod(',
    '// =============================================================================\n// BLOQUE 4 - HISTORIAL DE PAQUETES'
  );
  for (const contract of [
    'requireMarianManager(traceId)',
    'periodType !== "QUARTERLY"',
    '_looksLikeGuid(operationId)',
    'getQuarterlyTaxSummaryInternal(year, quarter',
    'getLibroRegistroFacturasExpedidasInternal(year, quarter',
    'summaryRes?.status !== "SUCCESS"',
    'bookRes?.status !== "SUCCESS"',
    'PACKAGE_SOURCE_DATA_INCOMPLETE',
  ]) assert.ok(handler.includes(contract), 'Missing snapshot contract: ' + contract);
});

test('FDOC-STORAGE-02 snapshot creation is idempotent and uses create-only insert, never upsert', () => {
  const handler = extractBlock(
    'export const createManagerPackageVersion = webMethod(',
    '// =============================================================================\n// BLOQUE 4 - HISTORIAL DE PAQUETES'
  );
  for (const contract of [
    'CONTROL_TYPE.IDEMPOTENCY',
    'MANAGER_PACKAGE_CREATE:',
    'PACKAGE_SNAPSHOT_IN_PROGRESS',
    'PACKAGE_SNAPSHOT_RECOVERY_REQUIRED',
  ]) assert.ok(source.includes(contract), 'Missing idempotency contract: ' + contract);
  assert.ok(handler.includes('dalInsert(DOCS_COL, snapshot)'));
  assert.ok(!handler.includes('_id: _formatDocumentId'));
  assert.ok(!source.includes('"WDE0123"'));
  assert.doesNotMatch(handler, /dalSave|dalUpdate\(DOCS_COL|dalRemove\(DOCS_COL/);
});

test('FDOC-STORAGE-03 canonical hash and 450 KiB cap protect immutable CMS snapshots', () => {
  for (const contract of [
    'PACKAGE_MAX_ITEM_BYTES = 450 * 1024',
    'Buffer.byteLength(_stableSerialize(snapshot), "utf8")',
    'hashSHA256(_stableSerialize(base))',
    'PACKAGE_VERSION_ALLOCATION_ATTEMPTS',
    'function _uuidV8FromHash(hashHex)',
    'const claimId = _uuidV8FromHash(operationHash)',
    '_uuidV8FromHash(await hashSHA256(key))',
    '_id: itemId',
    '_normalizeSnapshotJson',
    'JSON.stringify(value)',
    'snapshotInsertUncertain',
    '!snapshotInserted && !snapshotInsertUncertain',
    'dalQuery(DOCS_COL)',
    '.limit(1000)',
    '.find(STRONG_READ)',
    '_verifyPackageSnapshot(doc)',
  ]) assert.ok(source.includes(contract), 'Missing integrity contract: ' + contract);
});

test('FDOC-STORAGE-04 snapshot creation never fabricates Z-closing fields or mutates ledgers', () => {
  const handler = extractBlock(
    'export const createManagerPackageVersion = webMethod(',
    '// =============================================================================\n// BLOQUE 4 - HISTORIAL DE PAQUETES'
  );
  for (const field of ['fiscalPeriod', 'operationDate', 'closedBy', 'recordDomain', 'totalCash', 'totalCard', 'totalBizum', 'totalOnline']) {
    assert.doesNotMatch(handler, new RegExp(field + '\\s*:'));
  }
  for (const collection of ['MOVIMIENTOS_CAJA', 'LIBRO_ASIENTOS_CONTABLES_DETALLE', 'HISTORICO_CIERRES_Z']) {
    assert.ok(!handler.includes('BUSINESS_COLLECTIONS.' + collection));
  }
});

test('FDOC-STORAGE-05 package list returns metadata only; download verifies hash before building CSV', () => {
  const prepared = extractBlock(
    'export const getPreparedManagerPackages = webMethod(',
    '// =============================================================================\n// BLOQUE 5 - DESCARGAR VERSION'
  );
  assert.ok(prepared.includes('periodLabel'));
  assert.ok(prepared.includes('.find(STRONG_READ)'));
  assert.ok(!prepared.includes('invoiceData'));
  assert.ok(!prepared.includes('summaryData'));
  const download = extractBlock(
    'export const downloadManagerPackageVersion = webMethod(',
    '// =============================================================================\n// BLOQUE 6 - DESTINATARIOS'
  );
  assert.ok(download.includes('_verifyPackageSnapshot(doc)'));
  assert.ok(download.includes('PACKAGE_SNAPSHOT_HASH_INVALID'));
  assert.ok(download.includes('csvContent'));
});

test('FDOC-STORAGE-06 CSV output uses real line breaks and preview uses manager-safe internal aggregators', () => {
  assert.ok(source.includes('.join("\\n")'));
  const preview = extractBlock(
    'export const previewManagerPackage = webMethod(',
    '// =============================================================================\n// BLOQUE 3 - CREAR VERSION DE PAQUETE'
  );
  assert.ok(preview.includes('_rateLimitManagerPackageRead'));
  assert.ok(preview.includes('getQuarterlyTaxSummaryInternal'));
  assert.ok(!preview.includes('getQuarterlyTaxSummary('));
  assert.ok(preview.includes('summaryRes?.status !== "SUCCESS"'));
});

test('FDOC-DISPATCH-03 accountant dispatch remains disabled in canonical configuration', () => {
  assert.ok(config.includes('ACCOUNTANT_SEND_ENABLED: false'));
  assert.ok(source.includes('ACCOUNTANT_SEND_ENABLED = SDK_CONFIG.EMAIL.ACCOUNTANT_SEND_ENABLED === true'));
  assert.ok(source.includes('ACCOUNTANT_SEND_DISABLED'));
});

test('FDOC-DISPATCH-04 package dispatch requires a prepared, hash-verified persisted snapshot', () => {
  const handler = extractBlock(
    'export const sendManagerPackageToAccountant = webMethod(',
    '// BLOQUE 9 - ENVIO DE DOCUMENTO CONCRETO'
  );
  assert.ok(handler.includes('doc.packageStatus !== "PREPARED"'));
  assert.ok(handler.includes('!(await _verifyPackageSnapshot(doc))'));
  assert.ok(!handler.includes('doc.closingType'));
  assert.ok(handler.indexOf('_verifyPackageSnapshot(doc)') < handler.indexOf('_dispatchEmailViaResend('));
});
test('FDOC-DISPATCH-01 package dispatch checks the disabled guard before lookup or email dispatch', () => {
  const handler = extractBlock(
    'export const sendManagerPackageToAccountant = webMethod(',
    '// BLOQUE 9 - ENVIO DE DOCUMENTO CONCRETO'
  );
  assertDisabledBeforeOperations(handler, ['_resolveRecipientById(', '_dispatchEmailViaResend(']);
  assert.doesNotMatch(handler, /dalInsert|dalUpdate/);
});

test('FDOC-DISPATCH-02 specific-document dispatch checks the disabled guard before lookup or email dispatch', () => {
  const handler = extractBlock(
    'export const sendSpecificDocumentToAccountant = webMethod(',
    '\n  }\n);'
  );
  assertDisabledBeforeOperations(handler, ['_resolveRecipientById(', '_dispatchEmailViaResend(']);
  assert.doesNotMatch(handler, /dalInsert|dalUpdate/);
});

test('FDOC-STORE-01 package read models use PaquetesGestoria, never the Z-closing ledger', () => {
  assert.ok(source.includes('const DOCS_COL = BUSINESS_COLLECTIONS.PAQUETES_GESTORIA'));
  assert.doesNotMatch(source, /BUSINESS_COLLECTIONS\.HISTORICO_CIERRES_Z/);
  const history = extractBlock(
    'export const getManagerPackageHistory = webMethod(',
    'export const getPreparedManagerPackages'
  );
  assert.match(history, /\.eq\("periodType", periodType\)/);
  assert.match(history, /\.eq\("fiscalMonth", month\)/);
  assert.match(history, /\.eq\("fiscalQuarter", quarter\)/);
  assert.doesNotMatch(history, /closingType|inventoryClosingId/);
  const prepared = extractBlock(
    'export const getPreparedManagerPackages = webMethod(',
    '// BLOQUE 5 - DESCARGAR VERSION'
  );
  assert.match(prepared, /\.eq\("packageStatus", "PREPARED"\)/);
});



test('FDOC-CSV-01 text cells escape delimiters, quotes and neutralize spreadsheet formulas', () => {
  const start = source.indexOf('function _csvCell(value) {');
  const end = source.indexOf('\n}', start) + 2;
  assert.notEqual(start, -1, 'CSV cell encoder must exist');
  assert.ok(end > start, 'CSV cell encoder must be complete');
  const csvCell = vm.runInNewContext('(' + source.slice(start, end) + ')');
  assert.equal(csvCell('A;"B"'), '"A;""B"""');
  assert.equal(csvCell('=1+1'), '"\'=1+1"');
  assert.equal(csvCell('\t=1+1'), '"\'\t=1+1"');
  assert.equal(csvCell('normal text'), '"normal text"');

  const builderStart = source.indexOf('function _buildCsvFromInvoices(invoices) {');
  const builderEnd = source.indexOf('\n}', builderStart);
  const builder = source.slice(builderStart, builderEnd);
  for (const call of ['_csvCell(number)', '_csvCell(date)', '_csvCell(type)', '_csvCell(method)', '_csvCell(hash)']) {
    assert.ok(builder.includes(call), 'Missing safe CSV encoding: ' + call);
  }
  assert.ok(builder.includes('.join(";")'));
  assert.ok(builder.includes('.join("\\n")'));
});


test('FDOC-STORAGE-07 every recovered or newly inserted snapshot is hash-verified before success', () => {
  const claim = extractBlock(
    'async function _claimPackageOperation(operationId, period, traceId) {',
    'async function _readNextQuarterPackageVersion'
  );
  assert.ok((claim.match(/_verifyPackageSnapshot\(/g) || []).length >= 4);
  const handler = extractBlock(
    'export const createManagerPackageVersion = webMethod(',
    '// =============================================================================\n// BLOQUE 4 - HISTORIAL DE PAQUETES'
  );
  assert.ok(handler.includes('if (!(await _verifyPackageSnapshot(saved)))'));
});
