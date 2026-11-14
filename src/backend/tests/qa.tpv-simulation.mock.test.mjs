import test from 'node:test';
import assert from 'node:assert/strict';

import { createQaTpvSimulator } from './fixtures/qaTpvSimulation.mock.mjs';
import { QA_TEST_RUN_ID, QA_TEST_SITE_ID } from './fixtures/qaSyntheticParties.mjs';

const config = Object.freeze({
  environment: 'TEST',
  enabled: true,
  siteId: QA_TEST_SITE_ID,
  testSiteId: QA_TEST_SITE_ID,
  testRunId: QA_TEST_RUN_ID,
});

const line = (amount) => ({
  quantity: 1,
  pvpUnitario: amount,
  taxBase: amount,
  taxAmount: 0,
});

test('QA-TPV-01 simulator fails closed unless owner-designated QA TEST context is explicit', () => {
  for (const override of [
    { enabled: false },
    { environment: 'PRODUCTION' },
    { siteId: '188bed94-177c-4bc9-a9f0-35080d874f3e' },
    { testSiteId: 'different-site' },
    { testRunId: 'invalid' },
  ]) {
    assert.throws(
      () => createQaTpvSimulator({ ...config, ...override }),
      /QA_TPV_SIMULATOR_DISABLED/
    );
  }
});

test('QA-TPV-02 synthetic cash sale validates line and tender reconciliation', () => {
  const simulator = createQaTpvSimulator(config);
  const result = simulator.simulateSale({
    idempotencyKey: 'qa-cash-50',
    totalAmount: 50,
    lineItems: [line(50)],
    tenders: [{ method: 'EFECTIVO', amount: 50 }],
  });
  assert.equal(result.status, 'SETTLED');
  assert.equal(result.totalMinor, 5000);
  assert.equal(result.settledMinor, 5000);
  assert.equal(result.pendingMinor, 0);
  assert.equal(result.realPayment, false);
  assert.equal(result.persisted, false);
  assert.equal(result.isSynthetic, true);
});

test('QA-TPV-03 mixed cash card and Bizum sale reconciles exactly to 100 EUR', () => {
  const simulator = createQaTpvSimulator(config);
  const result = simulator.simulateSale({
    idempotencyKey: 'qa-mixed-100',
    totalAmount: 100,
    lineItems: [line(100)],
    tenders: [
      { method: 'EFECTIVO', amount: 40 },
      { method: 'TARJETAS', amount: 35 },
      { method: 'BIZUM', amount: 25 },
    ],
  });
  assert.equal(result.status, 'SETTLED');
  assert.deepEqual(result.tenders.map((item) => item.method), ['EFECTIVO', 'TARJETAS', 'BIZUM']);
  assert.equal(result.settledMinor, 10000);
});

test('QA-TPV-04 OTROS is accepted as settled; OTROS_PENDIENTE is tracked but not settled', () => {
  const simulator = createQaTpvSimulator(config);
  const settled = simulator.simulateSale({
    idempotencyKey: 'qa-other-settled',
    totalAmount: 20,
    lineItems: [line(20)],
    tenders: [{ method: 'OTROS', amount: 20 }],
  });
  assert.equal(settled.status, 'SETTLED');
  assert.equal(settled.settledMinor, 2000);

  const pending = simulator.simulateSale({
    idempotencyKey: 'qa-other-pending',
    totalAmount: 20,
    lineItems: [line(20)],
    tenders: [{ method: 'OTROS_PENDIENTE', amount: 20 }],
  });
  assert.equal(pending.status, 'PARTIALLY_SETTLED');
  assert.equal(pending.settledMinor, 0);
  assert.equal(pending.pendingMinor, 2000);
});

test('QA-TPV-05 rejects invalid line arithmetic, totals, tenders and unknown payment methods', () => {
  const simulator = createQaTpvSimulator(config);
  const valid = {
    totalAmount: 50,
    lineItems: [line(50)],
    tenders: [{ method: 'EFECTIVO', amount: 50 }],
  };
  assert.throws(
    () => simulator.simulateSale({ ...valid, idempotencyKey: 'bad-line', lineItems: [{ ...line(50), taxBase: 49 }] }),
    /QA_TPV_LINE_TAX_RECONCILIATION_FAILED/
  );
  assert.throws(
    () => simulator.simulateSale({ ...valid, idempotencyKey: 'bad-total', totalAmount: 51 }),
    /QA_TPV_TOTAL_RECONCILIATION_FAILED/
  );
  assert.throws(
    () => simulator.simulateSale({ ...valid, idempotencyKey: 'bad-method', tenders: [{ method: 'UNKNOWN', amount: 50 }] }),
    /QA_TPV_INVALID_PAYMENT_METHOD/
  );
  assert.throws(
    () => simulator.simulateSale({ ...valid, idempotencyKey: 'bad-underpay', tenders: [{ method: 'EFECTIVO', amount: 49 }] }),
    /QA_TPV_TENDER_RECONCILIATION_FAILED/
  );
});

test('QA-TPV-06 duplicate operation is idempotent and conflicting key reuse is rejected', () => {
  const simulator = createQaTpvSimulator(config);
  const request = {
    idempotencyKey: 'qa-idempotent-001',
    totalAmount: 50,
    lineItems: [line(50)],
    tenders: [{ method: 'EFECTIVO', amount: 50 }],
  };
  const first = simulator.simulateSale(request);
  assert.strictEqual(simulator.simulateSale(request), first);
  assert.throws(
    () => simulator.simulateSale({ ...request, totalAmount: 51 }),
    /QA_TPV_TOTAL_RECONCILIATION_FAILED/
  );
  assert.throws(
    () => simulator.simulateSale({ ...request, tenders: [{ method: 'EFECTIVO', amount: 49 }, { method: 'OTROS', amount: 1 }] }),
    /QA_TPV_IDEMPOTENCY_CONFLICT/
  );
});

test('QA-TPV-07 decimal quantity and precision are handled in minor currency units', () => {
  const simulator = createQaTpvSimulator(config);
  const result = simulator.simulateSale({
    idempotencyKey: 'qa-decimal-quantity',
    totalAmount: 15,
    lineItems: [{
      quantity: 1.5,
      pvpUnitario: 10,
      taxBase: 15,
      taxAmount: 0,
    }],
    tenders: [{ method: 'EFECTIVO', amount: 15 }],
  });
  assert.equal(result.totalMinor, 1500);
});
