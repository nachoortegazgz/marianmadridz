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

test('FDOC-STORAGE-01 package creation fails closed until a dedicated immutable store exists', () => {
  const handler = extractBlock(
    'export const createManagerPackageVersion = webMethod(',
    '// BLOQUE 4 - HISTORIAL DE PAQUETES'
  );
  assert.match(handler, /PACKAGE_SNAPSHOT_STORAGE_NOT_CONFIGURED/);
  assert.match(handler, /HistoricoCierresZ está reservado a cierres Z/);
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

test('FDOC-HISTORY-01 legacy monthly and quarterly identifiers remain disjoint', () => {
  assert.ok(source.includes('_packagePeriodPrefix(year, "MONTHLY", month)'));
  assert.ok(source.includes('_packagePeriodPrefix(year, "QUARTERLY", quarter)'));
  assert.ok(source.includes('${year}_${periodKey}_PAQUETE_GESTORIA_'));
});
