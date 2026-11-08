import test from "node:test";
import assert from "node:assert/strict";

import {
    buildDualRescheduleJournalIdentity,
    DUAL_RESCHEDULE_STATUS,
    isDualRescheduleTerminalStatus,
} from "../booking/dualRescheduleJournal.js";

const baseInput = {
    pairToken: "pair-123",
    f1BookingId: "booking-f1",
    f2BookingId: "booking-f2",
    f1ServiceId: "service-f1",
    f2ServiceId: "service-f2",
    resourceId: "resource-1",
    targetF1Start: "2026-11-09T09:00:00",
    targetF1End: "2026-11-09T10:00:00",
    targetF2Start: "2026-11-09T10:10:00",
    targetF2End: "2026-11-09T10:40:00",
};

test("DRJ-01 same pair and target produce the same journal identity across retries", async () => {
    const first = await buildDualRescheduleJournalIdentity(baseInput);
    const retry = await buildDualRescheduleJournalIdentity({
        ...baseInput,
        traceId: "different-transport-trace",
    });
    assert.equal(first.journalId, retry.journalId);
    assert.equal(first.dedupeKey, retry.dedupeKey);
    assert.match(first.journalId, /^DR_[a-f0-9]{64}$/);
});

test("DRJ-02 a different target or explicit operationId creates a distinct identity", async () => {
    const first = await buildDualRescheduleJournalIdentity(baseInput);
    const changedTarget = await buildDualRescheduleJournalIdentity({
        ...baseInput,
        targetF1Start: "2026-11-09T09:30:00",
    });
    const explicitOperation = await buildDualRescheduleJournalIdentity({
        ...baseInput,
        operationId: "attempt-2",
    });
    assert.notEqual(first.journalId, changedTarget.journalId);
    assert.notEqual(first.journalId, explicitOperation.journalId);
});

test("DRJ-03 identity rejects missing critical dimensions", async () => {
    await assert.rejects(
        buildDualRescheduleJournalIdentity({ ...baseInput, pairToken: "" }),
        /DUAL_RESCHEDULE_IDENTITY_INVALID:pairToken/
    );
});

test("DRJ-04 only completed, compensated and repair-required are terminal", () => {
    assert.equal(isDualRescheduleTerminalStatus(DUAL_RESCHEDULE_STATUS.COMPLETED), true);
    assert.equal(isDualRescheduleTerminalStatus(DUAL_RESCHEDULE_STATUS.COMPENSATED), true);
    assert.equal(isDualRescheduleTerminalStatus(DUAL_RESCHEDULE_STATUS.REPAIR_REQUIRED), true);
    assert.equal(isDualRescheduleTerminalStatus(DUAL_RESCHEDULE_STATUS.F1_DONE), false);
});
