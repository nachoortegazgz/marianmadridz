import { parseTapSummary } from "./tapSummary.mjs";
// Layer 1 gate: shared infrastructure, booking core, staff availability and public booking contracts.
// Includes offline shared fiscal-lock CAS and writer-contract tests; runtime fiscal flows remain in Layer 2.
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const loaderUrl = pathToFileURL(join(here, 'loader.mjs')).href;
const suites = [
  'citasManager.rate-limit-contract.test.mjs',
  'citasManager.dual-reschedule-locking.test.mjs',
  'security.rateLimiter.test.mjs',
  'booking.cart-v2.checkout.test.mjs',
  'tpv.web-modules.contract.test.mjs',
  'tpv.caja-singleton-bootstrap.regression.test.mjs',
  'tpv-record-nature.test.mjs',
  'tpv.sale-preparation.core.test.mjs',
  'tpv-ui.qa-source.test.mjs',
  'tpv.qa.persistence.policy.test.mjs',
  'tpv-widget.contract.test.mjs',
  'tpv.native-order-payload.test.mjs',
  'tpv.native-commerce.contract.test.mjs',
  'members.sdk.contract.test.mjs',
  'booking.members-required.contract.test.mjs',
  'staff.identity.contract.test.mjs',
  'booking.availability.saga.test.mjs',
  'qa.simple-booking.writer.offline.test.mjs',
  'qa.dual-booking.writer.offline.test.mjs',
  'events.unknown-booking-recovery.test.mjs',
  'crons.booking-projection-reconciliation.test.mjs',
  'events.booking-canceled.integrity.test.mjs',
  'booking.core.concurrency.test.mjs',
  'controlOperativo.hooks.test.mjs',
  'fiscalLedgerWriters.locking.test.mjs',
  'fiscalLedgerLock.test.mjs',
  'serviciosCatalogo.hooks.test.mjs',
  'events.backend-events.contract.test.mjs',
  'reservas.web.test.mjs',
  'servicePage.bookingRoute.contract.test.mjs',
  'htmlComponents.source-contract.test.mjs',
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
  if (!ok) {
    failed += 1;
    const failureLines = output.split(/\r?\n/)
      .filter((line) => /^(not ok |Error:|AssertionError|TypeError:|ReferenceError:|SyntaxError:|ERR_[A-Z_]+)/.test(line.trim()))
      .slice(0, 12);
    const failureSummary = (failureLines.length
      ? failureLines.join(' | ')
      : output.slice(-1800).replace(/\s+/g, ' ')).slice(0, 3000);
    const annotation = failureSummary
      .replace(/%/g, '%25')
      .replace(/\r/g, '%0D')
      .replace(/\n/g, '%0A');
    console.error(`::error title=Offline suite failure (${suite})::${annotation}`);
  }
  console.log(`${ok ? 'OK' : 'FAIL'} ${suite.padEnd(42)} tests=${tests} pass=${pass} fail=${fail} exit=${exitCode}`);
  if (!ok) console.error('\\n--- Diagnostics: ' + suite + ' ---\\n' + output.slice(-18000) + '\\n--- End diagnostics ---');
}

console.log(`LAYER 1 TOTAL: suites=${suites.length} pass=${passTotal} fail=${failTotal} failedSuites=${failed}`);
if (failed > 0) process.exit(1);
