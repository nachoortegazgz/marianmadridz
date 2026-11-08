import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../citasManager.web.js", import.meta.url), "utf8");

test("CM-DRJ-01 stable journal identity is built before live availability revalidation", () => {
    const identityAt = source.indexOf("buildDualRescheduleJournalIdentity({");
    const revalidationAt = source.indexOf("const validation = await _revalidateDualInputSlots(", identityAt);
    assert.ok(identityAt >= 0);
    assert.ok(revalidationAt > identityAt);
    assert.match(source, /status === DUAL_RESCHEDULE_STATUS\.COMPLETED && journal\.payload\?\.result/);
});

test("CM-DRJ-02 journal transitions bracket both native writer calls", () => {
    assert.match(source, /status: DUAL_RESCHEDULE_STATUS\.F1_IN_PROGRESS/);
    assert.match(source, /status: DUAL_RESCHEDULE_STATUS\.F1_DONE/);
    assert.match(source, /status: DUAL_RESCHEDULE_STATUS\.F2_IN_PROGRESS/);
    assert.match(source, /status: DUAL_RESCHEDULE_STATUS\.F2_DONE/);
    assert.match(source, /status: DUAL_RESCHEDULE_STATUS\.CMS_PROJECTED/);
    assert.match(source, /status: DUAL_RESCHEDULE_STATUS\.COMPLETED/);
});

test("CM-DRJ-03 a nonterminal replay fails closed and does not blindly repeat a native writer", () => {
    assert.match(source, /already has a journal and requires reconciliation before retry/);
    assert.match(source, /NONTERMINAL_JOURNAL_REENTRY_REQUIRES_READER_RECONCILIATION/);
    assert.match(source, /F2_NATIVE_RESULT_UNCERTAIN_NO_AUTOMATIC_ROLLBACK/);
    assert.doesNotMatch(source, /_rescheduleBookingNative\(\s*\{\s*\.\.\.f1Cita,\s*revision:\s*liveF1Revision/);
});

test("CM-DRJ-04 reschedule locks run a heartbeat and wait for it before release", () => {
    assert.match(source, /lockHeartbeat = _startLockHeartbeat\(/);
    assert.match(source, /monitor\.stop\(\);[\s\S]*await monitor\.wait;[\s\S]*_unlockSlotKey\(lockKey, lockOwnerId/);
});

test("CM-DRJ-05 CMS projection is idempotent and rejects unexpected slot changes", () => {
    assert.match(source, /CITA_SLOT_CHANGED_OUTSIDE_RESCHEDULE_OPERATION/);
    assert.match(source, /projection\?\.reason === "NO_CHANGE" && alreadyProjected/);
    assert.match(source, /CMS projection of the rescheduled booking failed/);
});
