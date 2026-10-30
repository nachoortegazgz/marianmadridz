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
  const confirmEnd = source.indexOf('async function _getValidatedPaidOrder(', confirmStart);
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
  const writerEnd = source.indexOf('async function _assertBookingOwner(', writerStart);
  assert.ok(writerStart >= 0 && writerEnd > writerStart, 'payment state writer must exist');
  const writer = source.slice(writerStart, writerEnd);
  assert.doesNotMatch(
    writer,
    /\[FIELD_STATUS\]\s*:/,
    'payment confirmation must not write bookingStatus',
  );

  const lineItemsStart = source.indexOf('function _getOrderBookingLineItems(');
  const lineItemsEnd = source.indexOf('function _getBookingLineItemsTotal(', lineItemsStart);
  assert.ok(lineItemsStart >= 0 && lineItemsEnd > lineItemsStart, 'order booking item resolver must exist');
  const lineItemsResolver = source.slice(lineItemsStart, lineItemsEnd);
  assert.match(lineItemsResolver, /WIX_CATALOG_APP_IDS\.BOOKINGS/);
  assert.equal(lineItemsResolver.includes('const bookingsAppId = APP_IDS.BOOKINGS;'), false);

  const webhookOrderResolver = eventsSource.split('\n').filter(line => line.trim() === 'const bookingsAppId = WIX_CATALOG_APP_IDS.BOOKINGS;');
  assert.equal(webhookOrderResolver.length, 2, 'paid and canceled order webhooks must use the Bookings catalog GUID');

  const confirmStart = source.indexOf('export const confirmPayment = webMethod(');
  const confirmEnd = source.indexOf('async function _getValidatedPaidOrder(', confirmStart);
  assert.ok(confirmStart >= 0 && confirmEnd > confirmStart, 'staff payment method must exist');
  const confirmFlow = source.slice(confirmStart, confirmEnd);
  const pairExpansionIndex = confirmFlow.indexOf('const pairedCitas = await _findCitasByPairToken(pairToken)');
  const paymentValidationIndex = confirmFlow.indexOf('await _validatePaymentCitaSet(citas, orderId, traceId)');
  assert.ok(pairExpansionIndex >= 0, 'staff payment reconciliation must expand the dual pair');
  assert.ok(paymentValidationIndex > pairExpansionIndex, 'paired F2 must be included before payment validation');
  assert.match(confirmFlow, /const linkedBookingIds = citas\.map/);
});
