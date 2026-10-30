import { parseTapSummary } from "./tapSummary.mjs";
// Runner canónico: ejecuta todas las suites con el loader de mocks (--loader).
// Uso: node --no-warnings --loader ./src/backend/tests/loader.mjs src/backend/tests/run-all.mjs
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
// Node interpreta --loader como URL. Convertir rutas absolutas evita que
// Windows trate "C:\\..." como un esquema URL (ERR_UNSUPPORTED_ESM_URL_SCHEME).
const loaderUrl = pathToFileURL(join(here, 'loader.mjs')).href;
// ZC-08: incluye *.test.mjs y runners E2E *.runner.mjs (audit.e2e.runner);
// el filtro anterior dejaba la auditoria heredada fuera del gate canonico.
const suites = readdirSync(here)
  .filter((f) => (f.endsWith('.test.mjs') || f.endsWith('.runner.mjs')) && !f.startsWith('_dbg') && f !== 'run-all.mjs')
  .sort();

let totalPass = 0;
let totalFail = 0;
let failedSuites = 0;
const report = [];

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
    output = (error.stdout || '') + (error.stderr || '');
  }

  const { pass, fail, tests } = parseTapSummary(output);
  const status = exitCode === 0 && fail === 0 && pass > 0 && tests > 0 ? 'OK' : 'FAIL';

  totalPass += pass;
  totalFail += fail;
  if (status !== 'OK') failedSuites += 1;
  report.push({
    suite, pass, fail, tests, exitCode, status,
    // Preserve diagnostics for failed suites so imports and assertions are visible in CI.
    diagnostics: status === 'OK' ? '' : output.slice(-4500),
  });
}

console.log('\\n=== RESUMEN SUITES (run-all) ===');
for (const result of report) {
  console.log(`${result.status.padEnd(4)} ${result.suite.padEnd(42)} tests=${result.tests} pass=${result.pass} fail=${result.fail} exit=${result.exitCode}`);
  if (result.status !== 'OK' && result.diagnostics) {
    console.error('\\n--- Diagnostics: ' + result.suite + ' (last 4500 chars) ---\\n' + result.diagnostics + '\\n--- End diagnostics ---');
  }
}

console.log(`TOTAL: suites=${report.length} pass=${totalPass} fail=${totalFail} failedSuites=${failedSuites}`);
if (report.length === 0 || failedSuites > 0) {
  console.error('run-all: una o más suites no se ejecutaron correctamente o devolvieron fallos.');
  process.exit(1);
}
process.exit(0);
