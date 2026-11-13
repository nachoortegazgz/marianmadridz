import test from 'node:test';
import assert from 'node:assert/strict';

import { createQaPaymentGateway } from './fixtures/qaPaymentGateway.mock.mjs';

const QA_CONFIG = Object.freeze({
  environment: 'QA',
  enabled: true,
  siteId: 'site-qa-synthetic',
  qaSiteId: 'site-qa-synthetic',
});

test('QA-PSP-01 simulator is fail-closed outside the explicitly enabled QA context', () => {
  for (const config of [
    {},
    { ...QA_CONFIG, enabled: false },
    { ...QA_CONFIG, environment: 'PRODUCTION' },
    { ...QA_CONFIG, siteId: 'different-site' },
    { ...QA_CONFIG, qaSiteId: '' },
  ]) {
    assert.throws(() => createQaPaymentGateway(config), /QA_PAYMENT_SIMULATOR_DISABLED/);
  }
});

test('QA-PSP-02 authorization simulates approved, pending, declined and timeout outcomes', async () => {
  const gateway = createQaPaymentGateway(QA_CONFIG);
  const cases = [
    ['APPROVED', 'AUTHORIZED', false],
    ['PENDING', 'PENDING', true],
    ['DECLINED', 'DECLINED', false],
    ['TIMEOUT', 'TIMEOUT', true],
  ];

  for (const [outcome, expectedStatus, retryable] of cases) {
    const result = await gateway.authorize({
      amount: '12.50',
      currency: 'EUR',
      idempotencyKey: 'authorize-' + outcome.toLowerCase(),
      outcome,
    });
    assert.equal(result.provider, 'QA_MOCK');
    assert.equal(result.simulated, true);
    assert.equal(result.status, expectedStatus);
    assert.equal(result.amountMinor, 1250);
    assert.equal(result.currency, 'EUR');
    assert.equal(result.retryable, retryable);
    assert.match(result.transactionId, /^qa_psp_[a-f0-9]{24}$/);
  }
});

test('QA-PSP-03 authorization is idempotent and rejects key reuse with a different payload', async () => {
  const gateway = createQaPaymentGateway(QA_CONFIG);
  const request = {
    amount: 20,
    currency: 'EUR',
    idempotencyKey: 'authorize-idempotent-001',
    outcome: 'APPROVED',
  };
  const first = await gateway.authorize(request);
  const replay = await gateway.authorize(request);
  assert.deepEqual(replay, first);

  await assert.rejects(
    gateway.authorize({ ...request, amount: 21 }),
    /QA_PAYMENT_IDEMPOTENCY_CONFLICT/
  );
});

test('QA-PSP-04 capture requires authorization, respects amount and is idempotent', async () => {
  const gateway = createQaPaymentGateway(QA_CONFIG);
  const pending = await gateway.authorize({
    amount: 30,
    currency: 'EUR',
    idempotencyKey: 'authorize-pending-001',
    outcome: 'PENDING',
  });
  await assert.rejects(
    gateway.capture({
      transactionId: pending.transactionId,
      amount: 30,
      currency: 'EUR',
      idempotencyKey: 'capture-pending-001',
    }),
    /QA_PAYMENT_NOT_AUTHORIZED/
  );

  const approved = await gateway.authorize({
    amount: 30,
    currency: 'EUR',
    idempotencyKey: 'authorize-capture-001',
  });
  const captureRequest = {
    transactionId: approved.transactionId,
    amount: 25,
    currency: 'EUR',
    idempotencyKey: 'capture-001',
  };
  const first = await gateway.capture(captureRequest);
  const replay = await gateway.capture(captureRequest);
  assert.deepEqual(replay, first);
  assert.equal(first.status, 'CAPTURED');
  assert.equal(first.capturedMinor, 2500);
  assert.equal(first.simulated, true);

  await assert.rejects(
    gateway.capture({
      ...captureRequest,
      amount: 26,
      idempotencyKey: 'capture-over-authorized-001',
    }),
    /QA_PAYMENT_CAPTURE_MISMATCH/
  );
});

test('QA-PSP-05 partial and full refunds reconcile without exceeding captured amount', async () => {
  const gateway = createQaPaymentGateway(QA_CONFIG);
  const authorization = await gateway.authorize({
    amount: 40,
    currency: 'EUR',
    idempotencyKey: 'authorize-refund-001',
  });
  await gateway.capture({
    transactionId: authorization.transactionId,
    amount: 40,
    currency: 'EUR',
    idempotencyKey: 'capture-refund-001',
  });

  const partialRequest = {
    transactionId: authorization.transactionId,
    amount: 10,
    currency: 'EUR',
    idempotencyKey: 'refund-partial-001',
  };
  const partial = await gateway.refund(partialRequest);
  assert.equal(partial.status, 'PARTIALLY_REFUNDED');
  assert.equal(partial.refundedMinor, 1000);
  assert.equal(partial.remainingCapturedMinor, 3000);
  assert.deepEqual(await gateway.refund(partialRequest), partial);

  const final = await gateway.refund({
    transactionId: authorization.transactionId,
    amount: 30,
    currency: 'EUR',
    idempotencyKey: 'refund-final-001',
  });
  assert.equal(final.status, 'REFUNDED');
  assert.equal(final.refundedMinor, 4000);
  assert.equal(final.remainingCapturedMinor, 0);

  await assert.rejects(
    gateway.refund({
      transactionId: authorization.transactionId,
      amount: 0.01,
      currency: 'EUR',
      idempotencyKey: 'refund-excess-001',
    }),
    /QA_PAYMENT_NOT_CAPTURED/
  );
});

test('QA-PSP-06 invalid amounts, currency, precision, outcomes and idempotency keys fail closed', async () => {
  const gateway = createQaPaymentGateway(QA_CONFIG);
  const base = { currency: 'EUR', idempotencyKey: 'invalid-input-001' };

  for (const amount of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    await assert.rejects(
      gateway.authorize({ ...base, amount }),
      /QA_PAYMENT_INVALID_AMOUNT/
    );
  }

  await assert.rejects(
    gateway.authorize({ ...base, amount: 1.001 }),
    /QA_PAYMENT_INVALID_PRECISION/
  );
  await assert.rejects(
    gateway.authorize({ ...base, amount: 1, currency: 'USD' }),
    /QA_PAYMENT_UNSUPPORTED_CURRENCY/
  );
  await assert.rejects(
    gateway.authorize({ ...base, amount: 1, idempotencyKey: '', outcome: 'APPROVED' }),
    /QA_PAYMENT_INVALID_IDEMPOTENCY_KEY/
  );
  await assert.rejects(
    gateway.authorize({ ...base, amount: 1, outcome: 'UNKNOWN' }),
    /QA_PAYMENT_INVALID_OUTCOME/
  );
});
