import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'citasManager.web.js'), 'utf8');
const start = source.indexOf('export const rescheduleDualBookings = webMethod(');
const end = source.indexOf('\n);', start);
const handler = source.slice(start, end < 0 ? source.length : end);

test('CM-DUAL-RESCHEDULE-LOCK-01 locks original and target F1/F2 intervals before native writes', () => {
  assert.notEqual(start, -1, 'dual reschedule webMethod must exist');
  assert.match(source, /generateSlotKey,\s*_lockSlotKeyOrFail,\s*_unlockSlotKey/);
  const lockPhase = handler.indexOf('const lockCandidates = [');
  const journal = handler.indexOf('const journalDedupeKey =');
  const nativeF1 = handler.indexOf('const f1Result = await _rescheduleBookingNative');
  assert.ok(lockPhase >= 0 && journal > lockPhase && nativeF1 > journal,
    'locks must be acquired before journaled native reschedule');
  assert.match(handler.slice(lockPhase, journal), /originalF1\.slotStart/);
  assert.match(handler.slice(lockPhase, journal), /originalF2\.slotStart/);
  assert.match(handler.slice(lockPhase, journal), /slotF1Input\.localStartDate/);
  assert.match(handler.slice(lockPhase, journal), /dualF2Slot\.localStartDate/);
});

test('CM-DUAL-RESCHEDULE-LOCK-02 uses canonical lock ordering and releases only owned locks in finally', () => {
  assert.match(handler, /Array\.from\(lockServiceByKey\.keys\(\)\)\.sort\(\)/);
  assert.match(handler, /_lockSlotKeyOrFail\(\s*key,\s*lockOwnerId/s);
  assert.match(handler, /finally\s*\{[\s\S]*acquiredLockKeys\.length - 1[\s\S]*_unlockSlotKey\(acquiredLockKeys\[i\],\s*lockOwnerId\)/);
});

test('CM-DUAL-RESCHEDULE-LOCK-03 never locks the exposure gap', () => {
  const lockPhase = handler.slice(handler.indexOf('const lockCandidates = ['), handler.indexOf('const journalDedupeKey ='));
  assert.doesNotMatch(lockPhase, /gapStart|gapEnd|exposureStart|exposureEnd/);
  assert.ok(source.includes('// The exposure gap is intentionally excluded: it remains bookable.'));
});
