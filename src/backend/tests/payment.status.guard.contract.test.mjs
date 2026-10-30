import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'citasManager.web.js'), 'utf8').replace(/\r\n/g, '\n');
const eventsSource = readFileSync(join(here, '..', 'events.js'), 'utf8').replace(/\r\n/g, '\n');

test('PAY-GUARD-01 rejects noncanonical booking states before ledger registration', () => {
  const validateStart = source.indexOf('async function _validatePaymentCitaSet(');
  const validateEnd = source.indexOf('async function _validatePaymentIdempotency(', validateStart);
  assert.ok(validateStart >= 0 && validateEnd > validateStart, 'payment validation function must exist');

  const validator = source.slice(validateStart, validateEnd);
  assert.match(
    validator,
    /BLOCKED_PAYMENT_STATES\.has\(bookingStatus\)\s*\|\|\s*\(bookingStatus\s*&&\s*!ALLOWED_PAYMENT_CONFIRMATION_STATES\.has\(bookingStatus\)\)/,
    'payment validation must reject terminal and unknown non-empty booking states',
  );

  const confirmStart = source.indexOf('export const confirmPayment = webMethod(');
  const confirmEnd = source.indexOf('// =============================================================================\n// BLOQUE 4 - ORDER VALIDATION', confirmStart);
  assert.ok(confirmStart >= 0 && confirmEnd > confirmStart, 'confirmPayment method must exist');
  const confirmFlow = source.slice(confirmStart, confirmEnd);

  const validationIndex = confirmFlow.indexOf('await _validatePaymentCitaSet(citas, orderId, traceId)');
  const orderIndex = confirmFlow.indexOf('await _getValidatedPaidOrder(');
  const ledgerIndex = confirmFlow.indexOf('await registerBookingPayment(');
  assert.ok(validationIndex >= 0, 'payment state validation must be called');
  assert.ok(orderIndex > validationIndex, 'state validation must precede paid-order processing');
  assert.ok(ledgerIndex > validationIndex, 'state validation must precede ledger registration');
});


test('PAY-GUARD-02 payment confirmation preserves booking approval state and uses the catalog GUID', () => {
  const writerStart = source.indexOf('async function _setCitasPaymentState(');
  const writerEnd = source.indexOf('// =============================================================================\\n// BLOQUE 5', writerStart);
  assert.ok(writerStart >= 0 && writerEnd > writerStart, 'payment state writer must exist');
  const writer = source.slice(writerStart, writerEnd);
  assert.doesNotMatch(
    writer,
    /\\[FIELD_STATUS\\]\\s*:/,
    'payment confirmation must not write bookingStatus',
  );

  const lineItemsStart = source.indexOf('function _getOrderBookingLineItems(');
  const lineItemsEnd = source.indexOf('function _getBookingLineItemsTotal(', lineItemsStart);
  assert.ok(lineItemsStart >= 0 && lineItemsEnd > lineItemsStart, 'order booking item resolver must exist');
  const lineItemsResolver = source.slice(lineItemsStart, lineItemsEnd);
  assert.match(lineItemsResolver, /WIX_CATALOG_APP_IDS\\.BOOKINGS/);
  assert.equal(lineItemsResolver.includes('const bookingsAppId = APP_IDS.BOOKINGS;'), false);

  const webhookOrderResolver = eventsSource.match(/const bookingsAppId = WIX_CATALOG_APP_IDS\\.BOOKINGS;/g) || [];
  assert.equal(webhookOrderResolver.length, 2, 'paid and canceled order webhooks must use the Bookings catalog GUID');
});
