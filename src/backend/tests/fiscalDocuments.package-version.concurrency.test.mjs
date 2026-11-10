import test from 'node:test';
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
  assert.match(handler, /requireMarianManager\(traceId\)/);
  assert.match(handler, /periodType !== "QUARTERLY"/);
  assert.match(handler, /_looksLikeGuid\(operationId\)/);
  assert.match(handler, /getQuarterlyTaxSummaryInternal\(year, quarter/);
  assert.match(handler, /getLibroRegistroFacturasExpedidasInternal\(year, quarter/);
  assert.match(handler, /summaryRes\?\.status !== "SUCCESS"/);
  assert.match(handler, /bookRes\?\.status !== "SUCCESS"/);
  assert.match(handler, /PACKAGE_SOURCE_DATA_INCOMPLETE/);
});

test('FDOC-STORAGE-02 snapshot creation is idempotent and uses create-only insert, never upsert', () => {
  const handler = extractBlock(
    'export const createManagerPackageVersion = webMethod(',
    '// =============================================================================\n// BLOQUE 4 - HISTORIAL DE PAQUETES'
  );
  assert.match(source, /CONTROL_TYPE\.IDEMPOTENCY/);
  assert.match(source, /MANAGER_PACKAGE_CREATE:/);
  assert.match(source, /PACKAGE_SNAPSHOT_IN_PROGRESS/);
  assert.match(source, /PACKAGE_SNAPSHOT_RECOVERY_REQUIRED/);
  assert.match(handler, /dalInsert\(DOCS_COL, snapshot\)/);
  assert.doesNotMatch(handler, /dalSave|dalUpdate\(DOCS_COL|dalRemove\(DOCS_COL/);
});

test('FDOC-STORAGE-03 canonical hash and 450 KiB cap protect immutable CMS snapshots', () => {
  assert.match(source, /PACKAGE_MAX_ITEM_BYTES = 450 \* 1024/);
  assert.match(source, /Buffer\.byteLength\(_stableSerialize\(snapshot\), "utf8"\)/);
  assert.match(source, /hashSHA256\(_stableSerialize\(base\)\)/);
  assert.match(source, /PACKAGE_VERSION_ALLOCATION_ATTEMPTS/);
  assert.match(source, /dalQuery\(DOCS_COL\)[\s\S]*?\.limit\(1000\)[\s\S]*?find\(STRONG_READ\)/);
  assert.match(source, /_verifyPackageSnapshot\(doc\)/);
});

test('FDOC-STORAGE-04 snapshot creation never fabricates mandatory Z-closing fields or mutates ledgers', () => {
  const handler = extractBlock(
    'export const createManagerPackageVersion = webMethod(',
    '// =============================================================================\n// BLOQUE 4 - HISTORIAL DE PAQUETES'
  );
  for (const field of ['fiscalPeriod', 'operationDate', 'closedBy', 'recordDomain', 'totalCash', 'totalCard', 'totalBizum', 'totalOnline']) {
    assert.doesNotMatch(handler, new RegExp(field + '\\s*:'));
  }
  assert.doesNotMatch(handler, /BUSINESS_COLLECTIONS\.(MOVIMIENTOS_CAJA|LIBRO_ASIENTOS_CONTABLES_DETALLE|HISTORICO_CIERRES_Z)/);
});

test('FDOC-STORAGE-05 package list returns metadata only; download verifies hash before building CSV', () => {
  const prepared = extractBlock(
    'export const getPreparedManagerPackages = webMethod(',
    '// =============================================================================\n// BLOQUE 5 - DESCARGAR VERSION'
  );
  assert.match(prepared, /periodLabel/);
  assert.doesNotMatch(prepared, /invoiceData|summaryData/);
  const download = extractBlock(
    'export const downloadManagerPackageVersion = webMethod(',
    '// =============================================================================\n// BLOQUE 6 - DESTINATARIOS'
  );
  assert.match(download, /_verifyPackageSnapshot\(doc\)/);
  assert.match(download, /PACKAGE_SNAPSHOT_HASH_INVALID/);
  assert.match(download, /csvContent/);
});

test('FDOC-STORAGE-06 CSV output uses real line breaks and preview uses manager-safe internal aggregators', () => {
  assert.match(source, /\.join\("\\\\n"\)/);
  const preview = extractBlock(
    'export const previewManagerPackage = webMethod(',
    '// =============================================================================\n// BLOQUE 3 - CREAR VERSION DE PAQUETE'
  );
  assert.match(preview, /getQuarterlyTaxSummaryInternal/);
  assert.doesNotMatch(preview, /getQuarterlyTaxSummary\(/);
  assert.match(preview, /summaryRes\?\.status !== "SUCCESS"/);
});

test('FDOC-STORAGE-03 accountant dispatch remains disabled in canonical configuration', () => {
  assert.ok(config.includes('ACCOUNTANT_SEND_ENABLED: false'));
  assert.ok(source.includes('ACCOUNTANT_SEND_ENABLED = SDK_CONFIG.EMAIL.ACCOUNTANT_SEND_ENABLED === true'));
  assert.ok(source.includes('ACCOUNTANT_SEND_DISABLED'));
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
