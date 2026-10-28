/*
=============================================================================
SUITE: crons.jobsConfigParity (Plan de correccion item 1 mandatory test)
Purpose: verify every job declared in backend/jobs.config has a matching
named export in backend/crons.js (and vice versa no orphan exports wired to
nothing), and that the two nightly/weekly additions behave offline:
 - verifyNightlyZClosing is idempotent when the Z record already exists.
 - cleanAuditLogs removes only terminal ALERT/COMPENSATION rows older than
   the retention window; WEBHOOK_EVENT is NEVER purged (absolute append-only
   ledger, ADR-05 enforced by ControlOperativo_beforeRemove hook).
Runs offline via tests/loader.mjs mocks. G10 ASCII strict.
=============================================================================
*/
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const { wixDataMock } = await import('./loader.mjs');
const CR = await import('backend/crons.js');
const IC = await import('backend/internalConfig');

const JOBS_CONFIG_PATH = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..', 'jobs.config'
);

test('CRON-PARITY-01 every jobs.config functionName is exported by crons.js', () => {
  const cfg = JSON.parse(fs.readFileSync(JOBS_CONFIG_PATH, 'utf8'));
  const missing = cfg.jobs
    .filter((j) => j.functionLocation === '/crons.js')
    .map((j) => j.functionName)
    .filter((name) => typeof CR[name] !== 'function');
  assert.deepStrictEqual(missing, [], `jobs.config declares functions not exported by crons.js: ${missing.join(', ')}`);
});

test('CRON-PARITY-02 crons.js exports cover the two previously-missing jobs', () => {
  assert.strictEqual(typeof CR.verifyNightlyZClosing, 'function');
  assert.strictEqual(typeof CR.cleanAuditLogs, 'function');
});

test('CRON-Z-ENTRY-01 cron uses a backend-only internal closing entry point', () => {
  const cronSource = fs.readFileSync(path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'crons.js'), 'utf8');
  const cashSource = fs.readFileSync(path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'cajas.web.js'), 'utf8');
  assert.match(cronSource, /registerZClosingInternal/);
  assert.match(cashSource, /export async function registerZClosingInternal/);
  assert.match(cashSource, /export const registerZClosing = webMethod/);
});

test('CRON-Z-01 verifyNightlyZClosing is idempotent when the day is already closed', async () => {
  wixDataMock._reset();
  // The Z row for yesterday exists (manual closing by the cashier), so the
  // cron must verify-by-read and exit WITHOUT alerting or throwing.
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' })
    .format(new Date(Date.now() - 24 * 60 * 60 * 1000));
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.HISTORICO_CIERRES_Z, [
    { _id: `Z_${ymd}`, operationDate: ymd, closingStatus: 'CERRADO', closingSignatureStatus: 'SIGNED' },
  ]);
  await CR.verifyNightlyZClosing();
  const alerts = (wixDataMock._store.get(IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO) || [])
    .filter((r) => r.alertType);
  assert.deepStrictEqual(alerts, [], 'must NOT raise an alert when the day is verifiably closed');
});

test('CRON-Z-02 verifyNightlyZClosing raises MANUAL_REQUIRED alert when no close can be created', async () => {
  wixDataMock._reset();
  // No Z row or movements seeded: the internal close path returns NO_MOVEMENTS.
  // The cron records a deduplicated WARN alert without throwing.
  await CR.verifyNightlyZClosing();
  const alerts = (wixDataMock._store.get(IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO) || [])
    .filter((r) => r.alertType === 'NIGHTLY_Z_CLOSING_MANUAL_REQUIRED');
  assert.strictEqual(alerts.length, 1, 'exactly one deduped manual-required alert expected');
});

test('CRON-AUDIT-01 cleanAuditLogs purges only terminal rows past retention', async () => {
  wixDataMock._reset();
  const old = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
  const recent = new Date();
  const C = IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
  // [CRON-AUDIT-01] Semantica real de ciclo de vida en ControlOperativo:
  // las ALERT nacen OPEN (vivas) y solo son purgables cuando llegan a la
  // forma terminal CLOSED/RESOLVED. Se siembra por tanto:
  //  a1 ALERT CLOSED antigua -> purgable
  //  a3 ALERT RESOLVED antigua -> purgable
  //  a2 ALERT OPEN reciente -> sobrevive (no terminal Y no retenida)
  //  c1 COMP EXECUTED antigua -> purgable
  //  c2 COMP PENDING antigua -> sobrevive (no terminal)
  //  w1 WEBHOOK_EVENT antigua CLOSED -> sobrevive SIEMPRE (ADR-05)
  //  l1 SLOT_LOCK antigua -> sobrevive (no es tipo purgable)
  //  a4 ALERT CLOSED reciente -> sobrevive (dentro de retencion)
  wixDataMock._seed(C, [
    { _id: 'a1', controlType: IC.CONTROL_TYPE.ALERT, status: IC.CONTROL_STATUS.CLOSED, _createdDate: old },
    { _id: 'a3', controlType: IC.CONTROL_TYPE.ALERT, status: IC.CONTROL_STATUS.RESOLVED, _createdDate: old },
    { _id: 'c1', controlType: IC.CONTROL_TYPE.COMPENSATION, status: IC.CONTROL_STATUS.EXECUTED, _createdDate: old },
    { _id: 'c2', controlType: IC.CONTROL_TYPE.COMPENSATION, status: IC.CONTROL_STATUS.PENDING, _createdDate: old },
    { _id: 'w1', controlType: IC.CONTROL_TYPE.WEBHOOK_EVENT, status: IC.CONTROL_STATUS.CLOSED, _createdDate: old },
    { _id: 'l1', controlType: IC.CONTROL_TYPE.SLOT_LOCK, status: IC.CONTROL_STATUS.ACTIVE, _createdDate: old },
    { _id: 'a2', controlType: IC.CONTROL_TYPE.ALERT, status: IC.CONTROL_STATUS.OPEN, _createdDate: recent },
    { _id: 'a4', controlType: IC.CONTROL_TYPE.ALERT, status: IC.CONTROL_STATUS.CLOSED, _createdDate: recent },
  ]);
  await CR.cleanAuditLogs();
  const remaining = (wixDataMock._store.get(C) || []).map((r) => r._id).sort();
  // [CRON-AUDIT-FIX-01] WEBHOOK_EVENT w1 is NEVER purged: append-only ledger
  // per ADR-05 (hook ControlOperativo_beforeRemove blocks it; cron aligned).
  assert.deepStrictEqual(remaining, ['a2', 'a4', 'c2', 'l1', 'w1'],
    'only ALERT + terminal COMPENSATION past retention are purged; WEBHOOK_EVENT kept (ADR-05)');
});
