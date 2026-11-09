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
import { fileURLToPath } from 'node:url';

const { wixDataMock, mocks } = await import('./loader.mjs');
const CR = await import('backend/crons.js');
const IC = await import('backend/internalConfig');

const here = path.dirname(fileURLToPath(import.meta.url));
const backendPath = (name) => path.resolve(here, '..', name);
const JOBS_CONFIG_PATH = backendPath('jobs.config');

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
  assert.strictEqual(typeof CR.cleanExpiredBookingControl, 'function');
});

test('CRON-DUAL-CACHE-01 cleanupExpiredDualCache drains expired rows only', async () => {
  wixDataMock._reset();
  const C = IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
  const now = new Date();
  wixDataMock._seed(C, [
    { _id: 'dual-expired-1', controlType: IC.CONTROL_TYPE.DUAL_CACHE, expiresAt: new Date(now.getTime() - 2000) },
    { _id: 'dual-expired-2', controlType: IC.CONTROL_TYPE.DUAL_CACHE, expiresAt: new Date(now.getTime() - 1000) },
    { _id: 'dual-active', controlType: IC.CONTROL_TYPE.DUAL_CACHE, expiresAt: new Date(now.getTime() + 60000) },
    { _id: 'tx-preserve', controlType: IC.CONTROL_TYPE.IDEMPOTENCY, expiresAt: new Date(now.getTime() - 60000) },
    { _id: 'webhook-preserve', controlType: IC.CONTROL_TYPE.WEBHOOK_EVENT, expiresAt: new Date(now.getTime() - 60000) },
  ]);
  const result = await CR.cleanupExpiredDualCache();
  assert.equal(result.removed, 2);
  assert.equal(result.failed, 0);
  const remaining = (wixDataMock._store.get(C) || []).map((row) => row._id).sort();
  assert.deepStrictEqual(remaining, ['dual-active', 'tx-preserve', 'webhook-preserve']);
});

test('CRON-DUAL-RESCHEDULE-01 legacy reconciler must not rewrite dual-reschedule journals', async () => {
  wixDataMock._reset();
  let nativeReads = 0;
  mocks.sdk['bookings::getBooking'] = async (bookingId) => {
    nativeReads++;
    return { booking: { id: bookingId } };
  };

  const C = IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
  const journalId = `DR_${'a'.repeat(64)}`;
  wixDataMock._seed(C, [{
    _id: journalId,
    controlType: IC.CONTROL_TYPE.SYSTEM_FLAG,
    pairToken: 'pair-reschedule-guard',
    version: 3,
    payload: {
      operationType: 'DUAL_RESCHEDULE',
      status: 'REPAIR_REQUIRED',
      reason: 'DUAL_RESCHEDULE_F2_RESULT_UNCERTAIN_NO_AUTOMATIC_ROLLBACK',
    },
  }]);
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.CITAS_F2, [
    { _id: 'f1-cita', pairToken: 'pair-reschedule-guard', bookingType: IC.BOOKING_TYPE.DUAL_F1, bookingId: '11111111-1111-4111-8111-111111111111' },
    { _id: 'f2-cita', pairToken: 'pair-reschedule-guard', bookingType: IC.BOOKING_TYPE.DUAL_F2, bookingId: '22222222-2222-4222-8222-222222222222' },
  ]);

  const result = await CR.reconcileInconsistentDualPairs();
  const journal = (wixDataMock._store.get(C) || []).find((row) => row._id === journalId);

  assert.equal(result.processed, 0, 'the legacy reconciler must skip operationType DUAL_RESCHEDULE');
  assert.equal(result.reconciled, 0);
  assert.equal(nativeReads, 0, 'must not treat mere booking existence as reschedule recovery');
  assert.equal(journal.payload.status, 'REPAIR_REQUIRED');
  assert.equal(journal.payload.reason, 'DUAL_RESCHEDULE_F2_RESULT_UNCERTAIN_NO_AUTOMATIC_ROLLBACK');

  delete mocks.sdk['bookings::getBooking'];
});


test('CRON-PAYMENT-RECOVERY-01 repairs CitasF2 from the existing paid ORDER movement without creating another movement', async () => {
  wixDataMock._reset();
  const C = IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
  const orderId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const f1Id = '11111111-1111-4111-8111-111111111111';
  const f2Id = '22222222-2222-4222-8222-222222222222';
  const movementId = 'cash-movement-recovery';
  const pairToken = 'pair-payment-recovery';

  wixDataMock._seed(C, [{
    _id: 'payment-recovery-alert',
    controlType: IC.CONTROL_TYPE.ALERT,
    alertType: 'PAYMENT_STATE_UPDATE_REQUIRED',
    status: IC.CONTROL_STATUS.OPEN,
    payload: {
      eventType: 'PAYMENT_STATE_UPDATE_REQUIRED',
      data: { orderId, transactionId: 'ORDER-' + orderId, cashMovementId: movementId },
    },
  }]);
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.CITAS_F2, [
    { _id: 'cita-f1-recovery', bookingId: f1Id, scheduleId: '33333333-3333-4333-8333-333333333333', traceId: 'trace-cron-recovery-f1', bookingType: IC.BOOKING_TYPE.DUAL_F1,
      pairToken, bookingStatus: 'PENDING', paymentStatus: 'PENDING_PAYMENT', orderId,
      totalAmount: 45.5, meta: { pairToken, orderId } },
    { _id: 'cita-f2-recovery', bookingId: f2Id, scheduleId: '44444444-4444-4444-8444-444444444444', traceId: 'trace-cron-recovery-f2', bookingType: IC.BOOKING_TYPE.DUAL_F2,
      pairToken, bookingStatus: 'PENDING', paymentStatus: 'PENDING_PAYMENT', orderId,
      totalAmount: 0, meta: { pairToken, orderId, linkedF1BookingId: f1Id, noFee: true } },
  ]);
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA, [{
    _id: movementId,
    transactionId: 'ORDER-' + orderId,
    orderId,
    totalAmount: 45.5,
    paymentMethod: IC.PAYMENT_METHOD.WIX_PAYMENTS,
    linkedBookingIds: [f1Id],
  }]);
  mocks.sdk['@wix/ecom::orders'] = {
    getOrder: async (id) => ({
      id,
      paymentStatus: 'PAID',
      priceSummary: { total: { amount: '45.50' } },
      lineItems: [{
        catalogReference: {
          appId: IC.WIX_CATALOG_APP_IDS.BOOKINGS,
          catalogItemId: f1Id,
        },
      }],
    }),
  };

  const result = await CR.runPendingCompensationsJob();
  assert.equal(result.paymentStatesRecovered, 1);
  assert.equal(result.paymentStatesFailed, 0);
  assert.equal(result.paymentStatesManualRequired, 0);
  const rows = wixDataMock._store.get(IC.BUSINESS_COLLECTIONS.CITAS_F2) || [];
  assert.equal(rows.find(row => row.bookingId === f1Id).paymentStatus, IC.PAYMENT_STATUS.PAID);
  assert.equal(rows.find(row => row.bookingId === f2Id).paymentStatus, IC.PAYMENT_STATUS.PAID);
  assert.equal(rows.find(row => row.bookingId === f1Id).bookingStatus, 'PENDING');
  assert.equal(rows.find(row => row.bookingId === f2Id).bookingStatus, 'PENDING');
  const alert = (wixDataMock._store.get(C) || []).find(row => row._id === 'payment-recovery-alert');
  assert.equal(alert.status, IC.CONTROL_STATUS.RESOLVED);
  assert.equal((wixDataMock._store.get(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA) || []).length, 1);
  delete mocks.sdk['@wix/ecom::orders'];
});

test('CRON-DISPLAY-01 cleanExpiredDisplayTokens removes only expired display tokens', async () => {
  wixDataMock._reset();
  const C = IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
  const now = new Date();
  wixDataMock._seed(C, [
    { _id: 'display-expired', controlType: IC.CONTROL_TYPE.DISPLAY_TOKEN, expiresAt: new Date(now.getTime() - 1000) },
    { _id: 'display-active', controlType: IC.CONTROL_TYPE.DISPLAY_TOKEN, expiresAt: new Date(now.getTime() + 60000) },
    { _id: 'webhook-preserve', controlType: IC.CONTROL_TYPE.WEBHOOK_EVENT, expiresAt: new Date(now.getTime() - 60000) },
  ]);
  const result = await CR.cleanExpiredDisplayTokens();
  assert.equal(result.removed, 1);
  assert.equal(result.failed, 0);
  const remaining = (wixDataMock._store.get(C) || []).map((row) => row._id).sort();
  assert.deepStrictEqual(remaining, ['display-active', 'webhook-preserve']);
});

test('CRON-LOCK-01 cleanExpiredLocks conditionally purges only still-expired SLOT_LOCK rows', async () => {
  wixDataMock._reset();
  const C = IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
  const now = new Date();
  wixDataMock._seed(C, [
    { _id: 'lock-expired', controlType: IC.CONTROL_TYPE.SLOT_LOCK, expiresAt: new Date(now.getTime() - 1000), version: 2 },
    { _id: 'lock-active', controlType: IC.CONTROL_TYPE.SLOT_LOCK, expiresAt: new Date(now.getTime() + 60000), version: 4 },
    { _id: 'dual-expired', controlType: IC.CONTROL_TYPE.DUAL_CACHE, expiresAt: new Date(now.getTime() - 1000) },
    { _id: 'webhook-expired', controlType: IC.CONTROL_TYPE.WEBHOOK_EVENT, expiresAt: new Date(now.getTime() - 1000) },
  ]);

  const result = await CR.cleanExpiredLocks();
  assert.equal(result.removed, 1);
  assert.equal(result.skipped, 0);
  assert.equal(result.failed, 0);
  const remaining = (wixDataMock._store.get(C) || []).map((row) => row._id).sort();
  assert.deepStrictEqual(remaining, ['dual-expired', 'lock-active', 'webhook-expired']);
});

test('CRON-RL-01 cleanExpiredRateLimits removes only expired RATE_LIMIT rows', async () => {
  wixDataMock._reset();
  const C = IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
  const now = new Date();
  wixDataMock._seed(C, [
    {
      _id: 'rl-expired',
      controlType: IC.CONTROL_TYPE.RATE_LIMIT,
      status: IC.CONTROL_STATUS.ACTIVE,
      expiresAt: new Date(now.getTime() - 1000),
      version: 2,
    },
    {
      _id: 'rl-active',
      controlType: IC.CONTROL_TYPE.RATE_LIMIT,
      status: IC.CONTROL_STATUS.ACTIVE,
      expiresAt: new Date(now.getTime() + 60000),
      version: 4,
    },
    {
      _id: 'webhook-old',
      controlType: IC.CONTROL_TYPE.WEBHOOK_EVENT,
      status: IC.CONTROL_STATUS.CLOSED,
      expiresAt: new Date(now.getTime() - 60000),
      version: 1,
    },
  ]);

  const result = await CR.cleanExpiredRateLimits();
  assert.equal(result.removed, 1);
  assert.equal(result.failed, 0);

  const remaining = (wixDataMock._store.get(C) || []).map((row) => row._id).sort();
  assert.deepStrictEqual(remaining, ['rl-active', 'webhook-old']);
});


test('CRON-DAYS-CACHE-01 cleanExpiredDaysCache conditionally drains expired rows', async () => {
  wixDataMock._reset();
  const C = IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
  const now = new Date();
  wixDataMock._seed(C, [
    { _id: 'days-expired-1', controlType: IC.CONTROL_TYPE.DAYS_CACHE, expiresAt: new Date(now.getTime() - 2000) },
    { _id: 'days-expired-2', controlType: IC.CONTROL_TYPE.DAYS_CACHE, expiresAt: new Date(now.getTime() - 1000) },
    { _id: 'days-active', controlType: IC.CONTROL_TYPE.DAYS_CACHE, expiresAt: new Date(now.getTime() + 60000) },
    { _id: 'rate-expired', controlType: IC.CONTROL_TYPE.RATE_LIMIT, expiresAt: new Date(now.getTime() - 60000) },
  ]);
  const result = await CR.cleanExpiredDaysCache();
  assert.equal(result.removed, 2);
  assert.equal(result.skipped, 0);
  assert.equal(result.failed, 0);
  assert.deepStrictEqual((wixDataMock._store.get(C) || []).map((row) => row._id).sort(), ['days-active', 'rate-expired']);
});

test('CRON-Z-ENTRY-01 cron uses a backend-only internal closing entry point', () => {
  const cronSource = fs.readFileSync(backendPath('crons.js'), 'utf8').replace(/\r\n/g, '\n');
  const cashSource = fs.readFileSync(backendPath('cajas.web.js'), 'utf8').replace(/\r\n/g, '\n');
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

test('CRON-CONTROL-01 purges only terminal transactions and resolved flags after 24 hours', async () => {
  wixDataMock._reset();
  const C = IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
  const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
  const recent = new Date(Date.now() - 23 * 60 * 60 * 1000);
  wixDataMock._seed(C, [
    { _id: 'tx-completed-old', controlType: IC.CONTROL_TYPE.IDEMPOTENCY, status: 'COMPLETED', _updatedDate: old },
    { _id: 'tx-failed-final-old', controlType: IC.CONTROL_TYPE.IDEMPOTENCY, payload: { status: 'FAILED_FINAL' }, _updatedDate: old },
    { _id: 'tx-completed-recent', controlType: IC.CONTROL_TYPE.IDEMPOTENCY, status: 'COMPLETED', _updatedDate: recent },
    { _id: 'tx-in-progress-old', controlType: IC.CONTROL_TYPE.IDEMPOTENCY, status: 'IN_PROGRESS', _updatedDate: old },
    { _id: 'tx-retryable-old', controlType: IC.CONTROL_TYPE.IDEMPOTENCY, status: 'FAILED_RETRYABLE', _updatedDate: old },
    { _id: 'tx-unknown-old', controlType: IC.CONTROL_TYPE.IDEMPOTENCY, status: 'RESULT_UNKNOWN', _updatedDate: old },
    { _id: 'webhook-old', controlType: IC.CONTROL_TYPE.WEBHOOK_EVENT, status: 'CLOSED', _updatedDate: old },
    { _id: 'flag-completed-old', controlType: IC.CONTROL_TYPE.SYSTEM_FLAG, payload: { status: 'COMPLETED' }, _updatedDate: old },
    { _id: 'flag-reconciled-old', controlType: IC.CONTROL_TYPE.SYSTEM_FLAG, payload: { status: 'RECONCILED' }, _updatedDate: old },
    { _id: 'flag-resolved-old', controlType: IC.CONTROL_TYPE.SYSTEM_FLAG, payload: { status: 'RESOLVED' }, _updatedDate: old },
    { _id: 'flag-status-conflict', controlType: IC.CONTROL_TYPE.SYSTEM_FLAG, status: 'IN_PROGRESS', payload: { status: 'RESOLVED' }, _updatedDate: old },
    { _id: 'flag-repair-old', controlType: IC.CONTROL_TYPE.SYSTEM_FLAG, payload: { status: 'REPAIR_REQUIRED' }, _updatedDate: old },
    { _id: 'flag-completion-retry-old', controlType: IC.CONTROL_TYPE.SYSTEM_FLAG, payload: { status: 'COMPLETION_RETRY_REQUIRED' }, _updatedDate: old },
    { _id: 'compensation-old', controlType: IC.CONTROL_TYPE.COMPENSATION, status: 'EXECUTED', _updatedDate: old },
  ]);

  const result = await CR.cleanExpiredBookingControl();
  assert.equal(result.removed, 5);
  assert.equal(result.failed, 0);
  const remaining = (wixDataMock._store.get(C) || []).map((row) => row._id).sort();
  assert.deepStrictEqual(remaining, [
    'compensation-old',
    'flag-completion-retry-old',
    'flag-repair-old',
    'flag-status-conflict',
    'tx-completed-recent',
    'tx-in-progress-old',
    'tx-retryable-old',
    'tx-unknown-old',
    'webhook-old',
  ]);
});

test('CRON-AUDIT-01 cleanAuditLogs purges only terminal rows past retention', async () => {
  wixDataMock._reset();
  const old = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
  const recent = new Date();
  const C = IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
  // [CRON-AUDIT-01] ALERT operativas nacen OPEN; logs INFO/WARNING se
  // almacenan como COMPLETED. Solo estados terminales con retencion vencida
  // son purgables. Se siembra por tanto:
  //  a1 ALERT CLOSED antigua -> purgable
  //  a3 ALERT RESOLVED antigua -> purgable
  //  a5 ALERT COMPLETED antigua (INFO/WARNING audit) -> purgable
  //  a2 ALERT OPEN reciente -> sobrevive (no terminal Y no retenida)
  //  c1 COMP EXECUTED antigua -> purgable
  //  c2 COMP PENDING antigua -> sobrevive (no terminal)
  //  c3 COMP FAILED antigua -> sobrevive (recuperacion ambigua)
  //  w1 WEBHOOK_EVENT antigua CLOSED -> sobrevive SIEMPRE (ADR-05)
  //  l1 SLOT_LOCK antigua -> sobrevive (no es tipo purgable)
  //  a4 ALERT CLOSED reciente -> sobrevive (dentro de retencion)
  wixDataMock._seed(C, [
    { _id: 'a1', controlType: IC.CONTROL_TYPE.ALERT, status: IC.CONTROL_STATUS.CLOSED, _createdDate: old },
    { _id: 'a3', controlType: IC.CONTROL_TYPE.ALERT, status: IC.CONTROL_STATUS.RESOLVED, _createdDate: old },
    { _id: 'a5', controlType: IC.CONTROL_TYPE.ALERT, status: IC.CONTROL_STATUS.COMPLETED, _createdDate: old },
    { _id: 'c1', controlType: IC.CONTROL_TYPE.COMPENSATION, status: IC.CONTROL_STATUS.EXECUTED, _createdDate: old },
    { _id: 'c2', controlType: IC.CONTROL_TYPE.COMPENSATION, status: IC.CONTROL_STATUS.PENDING, _createdDate: old },
    { _id: 'c3', controlType: IC.CONTROL_TYPE.COMPENSATION, status: IC.CONTROL_STATUS.FAILED, _createdDate: old },
    { _id: 'w1', controlType: IC.CONTROL_TYPE.WEBHOOK_EVENT, status: IC.CONTROL_STATUS.CLOSED, _createdDate: old },
    { _id: 'l1', controlType: IC.CONTROL_TYPE.SLOT_LOCK, status: IC.CONTROL_STATUS.ACTIVE, _createdDate: old },
    { _id: 'a2', controlType: IC.CONTROL_TYPE.ALERT, status: IC.CONTROL_STATUS.OPEN, _createdDate: recent },
    { _id: 'a4', controlType: IC.CONTROL_TYPE.ALERT, status: IC.CONTROL_STATUS.CLOSED, _createdDate: recent },
  ]);
  const result = await CR.cleanAuditLogs();
  assert.equal(result.removed, 4);
  assert.equal(result.failed, 0);
  const remaining = (wixDataMock._store.get(C) || []).map((r) => r._id).sort();
  // [CRON-AUDIT-FIX-01] WEBHOOK_EVENT w1 is NEVER purged: append-only ledger
  // per ADR-05 (hook ControlOperativo_beforeRemove blocks it; cron aligned).
  assert.deepStrictEqual(remaining, ['a2', 'a4', 'c2', 'c3', 'l1', 'w1'],
    'terminal ALERT and EXECUTED compensation rows are purged; FAILED and WEBHOOK_EVENT remain');
});


test('CRON-DUAL-RECONCILE-02 only reconciles a fully consistent dual pair and unique ledger movement', async () => {
  wixDataMock._reset();
  const C = IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
  const pairToken = 'pair-strict-reconcile';
  const orderId = 'order-strict-reconcile';
  const f1Id = '11111111-1111-4111-8111-111111111111';
  const f2Id = '22222222-2222-4222-8222-222222222222';
  const movementId = 'cash-movement-strict';
  const flagId = 'dual-flag-strict';
  wixDataMock._seed(C, [{
    _id: flagId, controlType: IC.CONTROL_TYPE.SYSTEM_FLAG,
    payload: { reason: 'DUAL_INCONSISTENT', status: 'REPAIR_REQUIRED', pairToken },
  }]);
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.CITAS_F2, [
    { _id: 'f1-row', pairToken, bookingType: IC.BOOKING_TYPE.DUAL_F1, bookingId: f1Id,
      orderId, paymentStatus: 'PAID', totalAmount: 45.5, cashMovementId: movementId },
    { _id: 'f2-row', pairToken, bookingType: IC.BOOKING_TYPE.DUAL_F2, bookingId: f2Id,
      orderId, paymentStatus: 'PAID', totalAmount: 0, cashMovementId: movementId,
      meta: { linkedF1BookingId: f1Id } },
  ]);
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA, [{
    _id: movementId, transactionId: 'ORDER-' + orderId, orderId,
    totalAmount: 45.5, linkedBookingIds: [f1Id, f2Id],
  }]);
  mocks.sdk['bookings::getBooking'] = async id => ({ booking: { id } });

  const result = await CR.reconcileInconsistentDualPairs();
  const flag = (wixDataMock._store.get(C) || []).find(row => row._id === flagId);
  assert.equal(result.reconciled, 1);
  assert.equal(flag.payload.status, 'RECONCILED');
  assert.equal(flag.payload.verified.movementId, movementId);
  delete mocks.sdk['bookings::getBooking'];
});


test('CRON-DUAL-RECONCILE-04 refuses a non-zero F2 even when the ledger matches F1', async () => {
  wixDataMock._reset();
  const C = IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
  const pairToken = 'pair-nonzero-f2';
  const orderId = 'order-nonzero-f2';
  const f1Id = '11111111-1111-4111-8111-111111111111';
  const f2Id = '22222222-2222-4222-8222-222222222222';
  const movementId = 'cash-movement-nonzero-f2';
  const flagId = 'dual-flag-nonzero-f2';
  wixDataMock._seed(C, [{
    _id: flagId, controlType: IC.CONTROL_TYPE.SYSTEM_FLAG,
    payload: { reason: 'DUAL_INCONSISTENT', status: 'REPAIR_REQUIRED', pairToken },
  }]);
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.CITAS_F2, [
    { _id: 'f1-row', pairToken, bookingType: IC.BOOKING_TYPE.DUAL_F1, bookingId: f1Id,
      orderId, paymentStatus: 'PAID', totalAmount: 45.5 },
    { _id: 'f2-row', pairToken, bookingType: IC.BOOKING_TYPE.DUAL_F2, bookingId: f2Id,
      orderId, paymentStatus: 'PAID', totalAmount: 45.5, meta: { linkedF1BookingId: f1Id } },
  ]);
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA, [{
    _id: movementId, transactionId: 'ORDER-' + orderId, orderId,
    totalAmount: 45.5, linkedBookingIds: [f1Id, f2Id],
  }]);
  mocks.sdk['bookings::getBooking'] = async id => ({ booking: { id } });

  const result = await CR.reconcileInconsistentDualPairs();
  const flag = (wixDataMock._store.get(C) || []).find(row => row._id === flagId);
  assert.equal(result.reconciled, 0);
  assert.equal(result.failed, 1);
  assert.equal(flag.payload.status, 'REPAIR_REQUIRED');
  delete mocks.sdk['bookings::getBooking'];
});

test('CRON-DUAL-RECONCILE-03 does not reconcile pairs with mismatched payment state', async () => {
  wixDataMock._reset();
  const C = IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
  const pairToken = 'pair-payment-mismatch';
  const flagId = 'dual-flag-payment-mismatch';
  wixDataMock._seed(C, [{
    _id: flagId, controlType: IC.CONTROL_TYPE.SYSTEM_FLAG,
    payload: { reason: 'DUAL_INCONSISTENT', status: 'REPAIR_REQUIRED', pairToken },
  }]);
  wixDataMock._seed(IC.BUSINESS_COLLECTIONS.CITAS_F2, [
    { _id: 'f1-row', pairToken, bookingType: IC.BOOKING_TYPE.DUAL_F1, bookingId: '11111111-1111-4111-8111-111111111111',
      orderId: 'order-mismatch', paymentStatus: 'PAID', totalAmount: 45.5 },
    { _id: 'f2-row', pairToken, bookingType: IC.BOOKING_TYPE.DUAL_F2, bookingId: '22222222-2222-4222-8222-222222222222',
      orderId: 'order-mismatch', paymentStatus: 'PENDING_PAYMENT', totalAmount: 45.5,
      meta: { linkedF1BookingId: '11111111-1111-4111-8111-111111111111' } },
  ]);
  const result = await CR.reconcileInconsistentDualPairs();
  const flag = (wixDataMock._store.get(C) || []).find(row => row._id === flagId);
  assert.equal(result.reconciled, 0);
  assert.equal(result.failed, 1);
  assert.equal(flag.payload.status, 'REPAIR_REQUIRED');
});


test('CRON-ORDER-CREATED-01 reconciles bookings-only orders and flags product/mixed orders without stock or cash writes', async () => {
  wixDataMock._reset();
  const bookingsAppId = IC.WIX_CATALOG_APP_IDS.BOOKINGS;
  const storesAppId = IC.WIX_CATALOG_APP_IDS.STORES;
  const bookingOrderA = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    number: 20001,
    status: 'APPROVED',
    paymentStatus: 'NOT_PAID',
    lineItems: [{ catalogReference: { appId: bookingsAppId } }],
  };
  const bookingOrderB = {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    number: 20002,
    status: 'CANCELED',
    paymentStatus: 'NOT_PAID',
    lineItems: [{ catalogReference: { appId: bookingsAppId } }],
  };
  const mixedOrder = {
    id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
    number: 20003,
    status: 'APPROVED',
    paymentStatus: 'PAID',
    lineItems: [
      { catalogReference: { appId: bookingsAppId } },
      { catalogReference: { appId: storesAppId } },
    ],
  };
  const searches = [];
  mocks.sdk['@wix/ecom::orders'] = {
    searchOrders: async (search) => {
      searches.push(search);
      if (search.filter?.status === 'PENDING' || search.filter?.status === 'REJECTED') {
        return { orders: [], metadata: { hasNext: false, cursors: {} } };
      }
      if (!search.cursorPaging?.cursor) {
        return {
          orders: [bookingOrderA, mixedOrder],
          metadata: { hasNext: true, cursors: { next: 'orders-page-2' } },
        };
      }
      return {
        orders: [bookingOrderB],
        metadata: { hasNext: false, cursors: {} },
      };
    },
  };

  const result = await CR.reconcileUnmarkedOrderCreatedEvents();
  assert.equal(result.ordersRead, 3);
  assert.equal(result.reconciled, 2);
  assert.equal(result.reviewRequired, 1);
  assert.equal(result.failed, 0);
  assert.ok(searches.length >= 4, 'default orders and explicit PENDING/REJECTED searches must run');

  const rows = wixDataMock._store.get(IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO) || [];
  const markers = rows.filter(row =>
    row.controlType === IC.CONTROL_TYPE.WEBHOOK_EVENT &&
    row.payload?.eventType === 'ORDER_CREATED_RECONCILED'
  );
  const alerts = rows.filter(row =>
    row.controlType === IC.CONTROL_TYPE.ALERT &&
    row.alertType === 'ORDER_CREATED_RECONCILIATION_REQUIRED'
  );
  assert.equal(markers.length, 2);
  assert.equal(alerts.length, 1);
  assert.ok(markers.every(row => row.traceId && row.eventId && row.orderId));
  assert.ok(markers.every(row => row.payload?.metadata?.inventoryAction === 'NOT_REQUIRED_BOOKINGS_ONLY'));
  assert.equal(rows.some(row => row.orderId === mixedOrder.id && row.payload?.eventType === 'ORDER_CREATED_RECONCILED'), false);
  assert.equal((wixDataMock._store.get(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA) || []).length, 0);
  assert.equal((wixDataMock._store.get(IC.BUSINESS_COLLECTIONS.MOVIMIENTOS_INVENTARIO) || []).length, 0);

  const replay = await CR.reconcileUnmarkedOrderCreatedEvents();
  assert.equal(replay.reconciled, 0);
  assert.equal(replay.skipped, 2);
  const rowsAfterReplay = wixDataMock._store.get(IC.OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO) || [];
  assert.equal(rowsAfterReplay.filter(row => row.payload?.eventType === 'ORDER_CREATED_RECONCILED').length, 2);
  assert.equal(rowsAfterReplay.filter(row => row.alertType === 'ORDER_CREATED_RECONCILIATION_REQUIRED').length, 1);

  delete mocks.sdk['@wix/ecom::orders'];
});

test('CRON-ORDER-CREATED-02 fails closed when native order pagination cannot continue', async () => {
  wixDataMock._reset();
  mocks.sdk['@wix/ecom::orders'] = {
    searchOrders: async () => ({
      orders: [],
      metadata: { hasNext: true, cursors: {} },
    }),
  };
  await assert.rejects(
    CR.reconcileUnmarkedOrderCreatedEvents(),
    /ORDER_SEARCH_NEXT_CURSOR_MISSING/
  );
  delete mocks.sdk['@wix/ecom::orders'];
});
