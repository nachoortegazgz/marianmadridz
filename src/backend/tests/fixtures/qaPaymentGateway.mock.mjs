import { createHash } from 'node:crypto';

const AUTHORIZATION_OUTCOMES = Object.freeze({
  APPROVED: 'AUTHORIZED',
  PENDING: 'PENDING',
  DECLINED: 'DECLINED',
  TIMEOUT: 'TIMEOUT',
});

const ALLOWED_CURRENCIES = new Set(['EUR']);

function toMinorUnits(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('QA_PAYMENT_INVALID_AMOUNT');
  }
  const minor = Math.round((amount + Number.EPSILON) * 100);
  if (Math.abs(amount * 100 - minor) > 1e-7) {
    throw new Error('QA_PAYMENT_INVALID_PRECISION');
  }
  return minor;
}

function makeId(prefix, idempotencyKey) {
  const digest = createHash('sha256').update(String(idempotencyKey)).digest('hex').slice(0, 24);
  return prefix + digest;
}

function assertIdempotent(cache, key, fingerprint) {
  const previous = cache.get(key);
  if (!previous) return null;
  if (previous.fingerprint !== fingerprint) {
    throw new Error('QA_PAYMENT_IDEMPOTENCY_CONFLICT');
  }
  return { ...previous.result };
}

function storeIdempotent(cache, key, fingerprint, result) {
  cache.set(key, { fingerprint, result: { ...result } });
  return { ...result };
}

/**
 * In-memory QA-only PSP double.
 *
 * This module is deliberately located under tests/ and is not imported by
 * production backend code. It has no network client, secrets, Wix SDK calls,
 * CMS writes, webhook dispatch, fiscal ledger writes, or stock side effects.
 */
export function createQaPaymentGateway(config = {}) {
  if (
    config.environment !== 'QA' ||
    config.enabled !== true ||
    typeof config.siteId !== 'string' ||
    !config.siteId ||
    config.siteId !== config.qaSiteId
  ) {
    throw new Error('QA_PAYMENT_SIMULATOR_DISABLED');
  }

  const operations = new Map();
  const transactions = new Map();

  function validateRequest({ amount, currency, idempotencyKey }) {
    const amountMinor = toMinorUnits(amount);
    const normalizedCurrency = String(currency || '').trim().toUpperCase();
    if (!ALLOWED_CURRENCIES.has(normalizedCurrency)) {
      throw new Error('QA_PAYMENT_UNSUPPORTED_CURRENCY');
    }
    const key = String(idempotencyKey || '').trim();
    if (!key || key.length > 128) {
      throw new Error('QA_PAYMENT_INVALID_IDEMPOTENCY_KEY');
    }
    return { amountMinor, currency: normalizedCurrency, idempotencyKey: key };
  }

  async function authorize(input = {}) {
    const request = validateRequest(input);
    const outcome = String(input.outcome || 'APPROVED').trim().toUpperCase();
    const status = AUTHORIZATION_OUTCOMES[outcome];
    if (!status) throw new Error('QA_PAYMENT_INVALID_OUTCOME');

    const operationKey = 'authorize:' + request.idempotencyKey;
    const fingerprint = JSON.stringify({ ...request, outcome });
    const cached = assertIdempotent(operations, operationKey, fingerprint);
    if (cached) return cached;

    const transactionId = makeId('qa_psp_', request.idempotencyKey);
    const result = {
      provider: 'QA_MOCK',
      simulated: true,
      transactionId,
      status,
      amountMinor: request.amountMinor,
      currency: request.currency,
      retryable: status === 'PENDING' || status === 'TIMEOUT',
      idempotencyKey: request.idempotencyKey,
    };

    transactions.set(transactionId, {
      status,
      authorizedMinor: status === 'AUTHORIZED' ? request.amountMinor : 0,
      capturedMinor: 0,
      refundedMinor: 0,
      currency: request.currency,
    });
    return storeIdempotent(operations, operationKey, fingerprint, result);
  }

  async function capture(input = {}) {
    const request = validateRequest(input);
    const transactionId = String(input.transactionId || '').trim();
    const operationKey = 'capture:' + request.idempotencyKey;
    const fingerprint = JSON.stringify({ ...request, transactionId });
    const cached = assertIdempotent(operations, operationKey, fingerprint);
    if (cached) return cached;

    const transaction = transactions.get(transactionId);
    if (!transaction || transaction.status !== 'AUTHORIZED') {
      throw new Error('QA_PAYMENT_NOT_AUTHORIZED');
    }
    if (transaction.currency !== request.currency || request.amountMinor > transaction.authorizedMinor) {
      throw new Error('QA_PAYMENT_CAPTURE_MISMATCH');
    }

    transaction.capturedMinor += request.amountMinor;
    transaction.status = 'CAPTURED';
    const result = {
      provider: 'QA_MOCK',
      simulated: true,
      transactionId,
      status: 'CAPTURED',
      capturedMinor: transaction.capturedMinor,
      currency: transaction.currency,
      idempotencyKey: request.idempotencyKey,
    };
    return storeIdempotent(operations, operationKey, fingerprint, result);
  }

  async function refund(input = {}) {
    const request = validateRequest(input);
    const transactionId = String(input.transactionId || '').trim();
    const operationKey = 'refund:' + request.idempotencyKey;
    const fingerprint = JSON.stringify({ ...request, transactionId });
    const cached = assertIdempotent(operations, operationKey, fingerprint);
    if (cached) return cached;

    const transaction = transactions.get(transactionId);
    if (!transaction || !['CAPTURED', 'PARTIALLY_REFUNDED'].includes(transaction.status)) {
      throw new Error('QA_PAYMENT_NOT_CAPTURED');
    }
    if (
      transaction.currency !== request.currency ||
      request.amountMinor > transaction.capturedMinor - transaction.refundedMinor
    ) {
      throw new Error('QA_PAYMENT_REFUND_EXCEEDS_CAPTURE');
    }

    transaction.refundedMinor += request.amountMinor;
    transaction.status = transaction.refundedMinor === transaction.capturedMinor
      ? 'REFUNDED'
      : 'PARTIALLY_REFUNDED';
    const result = {
      provider: 'QA_MOCK',
      simulated: true,
      transactionId,
      status: transaction.status,
      refundedMinor: transaction.refundedMinor,
      remainingCapturedMinor: transaction.capturedMinor - transaction.refundedMinor,
      currency: transaction.currency,
      idempotencyKey: request.idempotencyKey,
    };
    return storeIdempotent(operations, operationKey, fingerprint, result);
  }

  return Object.freeze({ authorize, capture, refund });
}
