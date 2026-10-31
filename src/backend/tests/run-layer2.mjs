import { parseTapSummary } from "./tapSummary.mjs";
// Layer 2 gate: cash ledger, fiscal projection, receipt DTOs and operational close flows.
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const loaderUrl = pathToFileURL(join(here, 'loader.mjs')).href;
const suites = [
  'controlOperativo.hooks.test.mjs',
  'crons.jobsConfigParity.test.mjs',
  'data.hooks.test.mjs',
  'dto.whitelist.test.mjs',
  'fiscalAggregator.read.test.mjs',
  'site.flows.e2e.test.mjs',
  'orderLedgerAmount.test.mjs',
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

console.log(`LAYER 2 TOTAL: suites=${suites.length} pass=${passTotal} fail=${failTotal} failedSuites=${failed}`);
if (failed > 0) process.exit(1);
