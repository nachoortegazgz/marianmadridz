import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sagaSource = readFileSync(join(here, '..', 'booking', 'bookingSaga.js'), 'utf8');

test('SAGA-GAP-01 enforces the exact per-service exposureDuration', () => {
  assert.match(
    sagaSource,
    /const expectedGapMinutes = Number\(minimumGapMinutes\)/,
  );
  assert.match(
    sagaSource,
    /if \(gapMinutes !== expectedGapMinutes\)/,
    'the actual gap must equal the catalog value, not just exceed a minimum',
  );
  assert.match(
    sagaSource,
    /actual gap must exactly match ServiciosCatalogo\.exposureDuration/,
  );
  assert.doesNotMatch(
    sagaSource,
    /MINUTOS_MAX_HUECO_DUAL/,
    'a global gap cap must not override the service catalog',
  );
});


test('SAGA-DUAL-CATALOG-01 distinguishes a missing linked phase from a transient CMS outage', async () => {
  wixDataMock._reset();
  await assert.rejects(
    _validateLinkedPhaseService('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa22', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'trace-dual-missing'),
    (error) => error.code === 'SERVICE_NOT_FOUND',
  );

  wixDataMock._reset();
  wixDataMock._findErrors.set(
    IC.BUSINESS_COLLECTIONS.SERVICIOS_CATALOGO,
    new Error('CMS_READ_UNAVAILABLE'),
  );
  await assert.rejects(
    _validateLinkedPhaseService('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa22', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'trace-dual-outage'),
    /CMS_READ_UNAVAILABLE/,
  );
});
