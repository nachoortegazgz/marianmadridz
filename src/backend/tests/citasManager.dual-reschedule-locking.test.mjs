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
  const lockAcquire = handler.indexOf('_lockSlotKeyOrFail(', lockPhase);
  const journal = handler.indexOf('const createdJournal = await _createDualRescheduleJournal');
  const nativeF1 = handler.indexOf('f1Result = await _rescheduleBookingNative', journal);
  assert.ok(lockPhase >= 0 && lockAcquire > lockPhase && journal > lockAcquire && nativeF1 > journal,
    'locks must be acquired before journal insertion and native reschedule');
  assert.match(handler.slice(lockPhase, journal), /originalF1Slot\.slotStart/);
  assert.match(handler.slice(lockPhase, journal), /originalF2Slot\.slotStart/);
  assert.match(handler.slice(lockPhase, journal), /slotF1Input\.localStartDate/);
  assert.match(handler.slice(lockPhase, journal), /dualF2Slot\.localStartDate/);
});

test('CM-DUAL-RESCHEDULE-LOCK-02 uses canonical lock ordering and releases only owned locks in finally', () => {
  assert.match(handler, /Array\.from\(lockServiceByKey\.keys\(\)\)\.sort\(\)/);
  assert.match(handler, /_lockSlotKeyOrFail\(\s*key,\s*lockOwnerId/s);
  assert.match(handler, /acquiredLockVersions\[key\]\s*=\s*acquired\.version/);
  assert.match(handler, /acquiredLockTokens\[key\]\s*=\s*acquired\.lockToken/);
  assert.match(handler, /finally\s*\{[\s\S]*acquiredLockKeys\.length - 1[\s\S]*_unlockSlotKey\(lockKey,\s*lockOwnerId,\s*\{/);
});

test('CM-DUAL-RESCHEDULE-LOCK-03 never locks the exposure gap', () => {
  const lockPhase = handler.slice(handler.indexOf('const lockCandidates = ['), handler.indexOf('const createdJournal = await _createDualRescheduleJournal'));
  assert.doesNotMatch(lockPhase, /gapStart|gapEnd|exposureStart|exposureEnd/);
  assert.ok(source.includes('// The exposure gap is intentionally excluded: it remains bookable.'));
});
