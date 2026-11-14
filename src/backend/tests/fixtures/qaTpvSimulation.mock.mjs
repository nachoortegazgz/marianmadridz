import { createHash } from 'node:crypto';

const PAYMENT_METHODS = new Set([
  'EFECTIVO',
  'TARJETAS',
  'BIZUM',
  'OTROS',
  'OTROS_PENDIENTE',
]);

const SETTLED_METHODS = new Set([
  'EFECTIVO',
  'TARJETAS',
  'BIZUM',
  'OTROS',
]);

function toMinorUnits(value, code) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(code || 'QA_TPV_INVALID_AMOUNT');
  }
  const minor = Math.round((amount + Number.EPSILON) * 100);
  if (Math.abs(amount * 100 - minor) > 1e-7) {
    throw new Error('QA_TPV_INVALID_PRECISION');
  }
  return minor;
}

function normalizeQuantity(value) {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) {
    throw new Error('QA_TPV_INVALID_QUANTITY');
  }
  return quantity;
}

function makeOperationId(key) {
  return 'qa_tpv_' + createHash('sha256').update(key).digest('hex').slice(0, 24);
}

function validateLines(lineItems) {
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    throw new Error('QA_TPV_LINE_ITEMS_REQUIRED');
  }

  let totalMinor = 0;
  const lines = lineItems.map((line, index) => {
    const quantity = normalizeQuantity(line?.quantity);
    const unitMinor = toMinorUnits(line?.pvpUnitario, 'QA_TPV_INVALID_UNIT_PRICE');
    if (unitMinor <= 0) throw new Error('QA_TPV_INVALID_UNIT_PRICE');
    const subtotalMinor = Math.round(quantity * unitMinor);
    const taxBaseMinor = toMinorUnits(line?.taxBase, 'QA_TPV_INVALID_TAX_BASE');
    const taxMinor = toMinorUnits(line?.taxAmount, 'QA_TPV_INVALID_TAX_AMOUNT');
    if (taxBaseMinor + taxMinor !== subtotalMinor) {
      throw new Error('QA_TPV_LINE_TAX_RECONCILIATION_FAILED');
    }
    totalMinor += subtotalMinor;
    return Object.freeze({
      lineNumber: index + 1,
      quantity,
      unitMinor,
      taxBaseMinor,
      taxMinor,
      subtotalMinor,
    });
  });

  return { lines: Object.freeze(lines), totalMinor };
}

function validateTenders(tenders, totalMinor) {
  if (!Array.isArray(tenders) || tenders.length === 0) {
    throw new Error('QA_TPV_TENDERS_REQUIRED');
  }

  let settledMinor = 0;
  let pendingMinor = 0;
  const normalized = tenders.map((tender) => {
    const method = String(tender?.method || '').trim().toUpperCase();
    if (!PAYMENT_METHODS.has(method)) {
      throw new Error('QA_TPV_INVALID_PAYMENT_METHOD');
    }
    const amountMinor = toMinorUnits(tender?.amount, 'QA_TPV_INVALID_TENDER_AMOUNT');
    if (amountMinor <= 0) throw new Error('QA_TPV_INVALID_TENDER_AMOUNT');
    if (method === 'OTROS_PENDIENTE') pendingMinor += amountMinor;
    else if (SETTLED_METHODS.has(method)) settledMinor += amountMinor;
    return Object.freeze({ method, amountMinor, settled: method !== 'OTROS_PENDIENTE' });
  });

  if (settledMinor > totalMinor) throw new Error('QA_TPV_OVERPAYMENT');
  if (settledMinor + pendingMinor !== totalMinor) {
    throw new Error('QA_TPV_TENDER_RECONCILIATION_FAILED');
  }
  return {
    tenders: Object.freeze(normalized),
    settledMinor,
    pendingMinor,
    status: pendingMinor > 0 ? 'PARTIALLY_SETTLED' : 'SETTLED',
  };
}

/**
 * Pure, in-memory TPV simulation. No Wix SDK, CMS, payment provider,
 * fiscal signer, webhook, email, stock or external I/O is reachable here.
 */
export function createQaTpvSimulator(config = {}) {
  if (
    config.environment !== 'TEST' ||
    config.enabled !== true ||
    config.siteId !== config.testSiteId ||
    config.testSiteId !== '50b39f33-e753-4331-ab35-b2ed43dc97f7' ||
    typeof config.testRunId !== 'string' ||
    !/^TEST-RUN-[A-Z0-9-]{1,80}$/.test(config.testRunId)
  ) {
    throw new Error('QA_TPV_SIMULATOR_DISABLED');
  }

  const operations = new Map();
  const metadata = Object.freeze({
    isSynthetic: true,
    sourceEnvironment: 'TEST',
    testRunId: config.testRunId,
    realPayment: false,
    persisted: false,
  });

  function simulateSale(input = {}) {
    const idempotencyKey = String(input.idempotencyKey || '').trim();
    if (!idempotencyKey || idempotencyKey.length > 128) {
      throw new Error('QA_TPV_INVALID_IDEMPOTENCY_KEY');
    }

    const { lines, totalMinor } = validateLines(input.lineItems);
    const declaredTotalMinor = toMinorUnits(input.totalAmount, 'QA_TPV_INVALID_TOTAL');
    if (totalMinor !== declaredTotalMinor) {
      throw new Error('QA_TPV_TOTAL_RECONCILIATION_FAILED');
    }

    const tenderResult = validateTenders(input.tenders, totalMinor);
    const fingerprint = JSON.stringify({
      totalMinor,
      lines,
      tenders: tenderResult.tenders,
    });
    const previous = operations.get(idempotencyKey);
    if (previous) {
      if (previous.fingerprint !== fingerprint) {
        throw new Error('QA_TPV_IDEMPOTENCY_CONFLICT');
      }
      return previous.result;
    }

    const result = Object.freeze({
      operationId: makeOperationId(idempotencyKey),
      ...metadata,
      currency: 'EUR',
      totalMinor,
      settledMinor: tenderResult.settledMinor,
      pendingMinor: tenderResult.pendingMinor,
      status: tenderResult.status,
      lineItems: lines,
      tenders: tenderResult.tenders,
    });
    operations.set(idempotencyKey, { fingerprint, result });
    return result;
  }

  return Object.freeze({ simulateSale });
}
