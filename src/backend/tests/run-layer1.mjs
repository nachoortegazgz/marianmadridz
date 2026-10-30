import { parseTapSummary } from "./tapSummary.mjs";
// Layer 1 gate: shared infrastructure, booking core, staff availability and public booking contracts.
// Kept separate from caja/fiscal suites so layer 1 can be evaluated before layer 2.
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const loaderUrl = pathToFileURL(join(here, 'loader.mjs')).href;
const suites = [
  'citasManager.rate-limit-contract.test.mjs',
  'security.rateLimiter.test.mjs',
  'booking.availability.saga.test.mjs',
  'booking.core.concurrency.test.mjs',
  'controlOperativo.hooks.test.mjs',
  'reservas.web.test.mjs',
  'unit.ssot.v5011.test.mjs',
];

let passTotal = 0;
let failTotal = 0;
let failed = 0;

for (const suite of suites) {
  let output = '';
  let exitCode = 0;
  try {
    output = execFileSync(
      process.execPath,
      ['--no-warnings', '--loader', loaderUrl, join(here, suite)],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
  } catch (error) {
    exitCode = Number.isInteger(error.status) ? error.status : 1;
    output = String(error.stdout || '') + String(error.stderr || '');
  }

  const { pass, fail, tests } = parseTapSummary(output);
  const ok = exitCode === 0 && tests > 0 && fail === 0 && pass > 0;
  passTotal += pass;
  failTotal += fail;
  if (!ok) failed += 1;
  console.log(`${ok ? 'OK' : 'FAIL'} ${suite.padEnd(42)} tests=${tests} pass=${pass} fail=${fail} exit=${exitCode}`);
  if (!ok) console.error('\\n--- Diagnostics: ' + suite + ' ---\\n' + output.slice(-18000) + '\\n--- End diagnostics ---');
}

console.log(`LAYER 1 TOTAL: suites=${suites.length} pass=${passTotal} fail=${failTotal} failedSuites=${failed}`);
if (failed > 0) process.exit(1);
