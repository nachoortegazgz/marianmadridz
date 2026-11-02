import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sagaSource = readFileSync(join(here, '..', 'booking', 'bookingSaga.js'), 'utf8');
await import('./loader.mjs');
const { _validateDualGap } = await import('backend/booking/bookingSaga.js');

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


test('SAGA-GAP-02 accepts the exact positive exposure gap from the service catalog', () => {
  assert.deepEqual(
    _validateDualGap('2026-11-04T10:00:00', '2026-11-04T10:20:00', 'trace-gap-20', 20),
    { gapMinutes: 20, expectedGapMinutes: 20 },
  );
});

test('SAGA-GAP-03 accepts a zero-minute gap only when the catalog configures zero', () => {
  assert.deepEqual(
    _validateDualGap('2026-11-04T10:00:00', '2026-11-04T10:00:00', 'trace-gap-0', 0),
    { gapMinutes: 0, expectedGapMinutes: 0 },
  );
});

test('SAGA-GAP-04 rejects short, long, negative and invalid catalog gaps', () => {
  assert.throws(
    () => _validateDualGap('2026-11-04T10:00:00', '2026-11-04T10:19:00', 'trace-gap-short', 20),
    (error) => error.code === 'INVALID_PAYLOAD',
  );
  assert.throws(
    () => _validateDualGap('2026-11-04T10:00:00', '2026-11-04T10:21:00', 'trace-gap-long', 20),
    (error) => error.code === 'INVALID_PAYLOAD',
  );
  assert.throws(
    () => _validateDualGap('2026-11-04T10:00:00', '2026-11-04T09:59:00', 'trace-gap-negative', 20),
    (error) => error.code === 'INVALID_PAYLOAD',
  );
  assert.throws(
    () => _validateDualGap('2026-11-04T10:00:00', '2026-11-04T10:20:00', 'trace-gap-invalid', Number.NaN),
    (error) => error.code === 'INVALID_PAYLOAD',
  );
});

test('SAGA-GAP-05 rejects malformed phase timestamps', () => {
  assert.throws(
    () => _validateDualGap('not-a-date', '2026-11-04T10:20:00', 'trace-gap-date', 20),
    (error) => error.code === 'INVALID_DATES',
  );
});
