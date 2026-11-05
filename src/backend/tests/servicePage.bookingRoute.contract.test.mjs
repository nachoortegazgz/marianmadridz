import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pageSource = readFileSync(
  new URL('../../pages/Pagina de servicio 2.xnfr4.js', import.meta.url),
  'utf8',
);
const bridgeSource = readFileSync(
  new URL('../../public/widgetBridge.js', import.meta.url),
  'utf8',
);

test('SERVICE-ROUTE-01 service page uses the canonical calendar route', () => {
  assert.match(
    bridgeSource,
    /CALENDARIO_2:\s*"\/booking-calendar\/calendario-2"/,
    'widgetBridge is the source of truth for the calendar route',
  );
  assert.match(
    pageSource,
    /const base = text\(URLS\?\.CALENDARIO_2\)/,
    'service page must consume URLS.CALENDARIO_2',
  );
  assert.doesNotMatch(
    pageSource,
    /const base = ["']\/calendario-2["']/,
    'service page must not hardcode the legacy route',
  );
});

test('SERVICE-ROUTE-02 canonical route remains a safe absolute site path', () => {
  const match = bridgeSource.match(
    /CALENDARIO_2:\s*"([^"]+)"/,
  );
  assert.ok(match, 'calendar route constant exists');
  assert.ok(match[1].startsWith('/'), 'route starts at the site root');
  assert.ok(!match[1].startsWith('//'), 'route is not protocol-relative');
});
