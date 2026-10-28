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
