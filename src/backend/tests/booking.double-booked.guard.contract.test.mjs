import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'booking', 'bookingSaga.js'), 'utf8').replace(/\r\n/g, '\n');

test('BOOKING-DOUBLE-01 aborts saga when Wix flags a double-booked slot', () => {
  const guardStart = source.indexOf('function _checkDoubleBookingFlag(');
  const guardEnd = source.indexOf('// BLOCK 8 - GAP VALIDACION', guardStart);
  assert.ok(guardStart >= 0 && guardEnd > guardStart, 'double-booking guard must exist');

  const guard = source.slice(guardStart, guardEnd);
  assert.match(guard, /booking\.doubleBooked\s*===\s*true/);
  assert.match(guard, /throw createBookingError\(/, 'double-booking must abort the saga');
  assert.match(guard, /ERROR_CODES\.BOOKING_CREATION_FAILED/);

  const f1Start = source.indexOf('const bookingF1 = (resF1 && resF1.booking) || resF1;');
  const f1End = source.indexOf('let bookingF2 = null;', f1Start);
  assert.ok(f1Start >= 0 && f1End > f1Start, 'F1 creation block must exist');
  const f1 = source.slice(f1Start, f1End);
  assert.ok(f1.indexOf('createdBookings.push({') < f1.indexOf('_checkDoubleBookingFlag(bookingF1'),
    'F1 must be tracked before the guard can throw so compensation can cancel it');

  const f2Start = source.indexOf('bookingF2 = (resF2 && resF2.booking) || resF2;');
  const f2End = source.indexOf('return {', f2Start);

  assert.ok(f2Start >= 0 && f2End > f2Start, 'F2 creation block must exist');
  const f2 = source.slice(f2Start, f2End);
  assert.ok(f2.indexOf('createdBookings.push({') < f2.indexOf('_checkDoubleBookingFlag(bookingF2'),
    'F2 must be tracked before the guard can throw so compensation can cancel both phases');

  const confirmIndex = source.indexOf('_checkDoubleBookingFlag(confirmResult, "CONFIRM_" + booking.phase, traceId);');
  assert.ok(confirmIndex >= 0, 'confirmation result must also be checked for double booking');
  assert.match(source, /async function _compensateCreatedBookings\(/,
    'saga compensation must exist for created bookings');
});


test('COMPENSATION-QUEUE-01 producer matches cron query and lifecycle contract', () => {
  const cron = readFileSync(join(here, '..', 'crons.js'), 'utf8').replace(/\r\n/g, '\n');
  const producerStart = source.indexOf('await elevatedInsert(COMPENSACIONES_COL, {');
  const producerEnd = source.indexOf('\n                });', producerStart);
  assert.ok(producerStart >= 0 && producerEnd > producerStart, 'compensation producer must exist');
  const producer = source.slice(producerStart, producerEnd);
  assert.match(producer, /controlType:\s*CONTROL_TYPE\.COMPENSATION/);
  assert.match(producer, /status:\s*"PENDING"/);
  assert.match(producer, /attempts:\s*0/);
  assert.match(producer, /revision:\s*hasValidRevision\s*\?\s*revision\s*:\s*null/);

  const jobStart = cron.indexOf('export async function runPendingCompensationsJob()');
  const jobEnd = cron.indexOf('// =============================================================================\n// CRON 4:', jobStart);
  assert.ok(jobStart >= 0 && jobEnd > jobStart, 'compensation consumer must exist');
  const job = cron.slice(jobStart, jobEnd);
  assert.match(job, /\.eq\("controlType",\s*CONTROL_TYPE\.COMPENSATION\)/);
  assert.match(job, /\.eq\("status",\s*status\)/);
  assert.match(job, /\.lt\("attempts",\s*MAX_COMPENSATION_ATTEMPTS\)/);
  assert.match(job, /status:\s*COMPENSATION_STATUS\.EXECUTED/);
  assert.match(job, /status:\s*payload\.status/);
  assert.match(job, /attempts,/);
  assert.match(cron, /CANCEL_BOOKING requires a valid revision/);
  assert.match(cron, /revision:\s*String\(revision\)/);
});
