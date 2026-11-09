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

test('FDOC-STORAGE-01 package creation remains fail-closed until snapshot guarantees are implemented', () => {
  const handler = extractBlock(
    'export const createManagerPackageVersion = webMethod(',
    '// =============================================================================\n// BLOQUE 4 - HISTORIAL DE PAQUETES'
  );
  assert.match(handler, /PACKAGE_SNAPSHOT_IMPLEMENTATION_PENDING/);
  assert.match(handler, /hash canónico, límite de tamaño y versionado concurrente seguro/);
  assert.doesNotMatch(handler, /dalInsert|dalUpdate|dalSave|dalRemove/);
});

test('FDOC-STORAGE-02 package creation never fabricates mandatory Z-closing fields', () => {
  const handler = extractBlock(
    'export const createManagerPackageVersion = webMethod(',
    '// BLOQUE 4 - HISTORIAL DE PAQUETES'
  );
  for (const field of ['fiscalPeriod', 'operationDate', 'closedBy', 'recordDomain', 'totalCash', 'totalCard', 'totalBizum', 'totalOnline']) {
    assert.doesNotMatch(handler, new RegExp(field + '\\s*:'));
  }
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
