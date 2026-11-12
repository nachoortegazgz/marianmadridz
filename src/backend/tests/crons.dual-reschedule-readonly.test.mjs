import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cronSource = readFileSync(new URL("../crons.js", import.meta.url), "utf8");
const jobsConfig = readFileSync(new URL("../jobs.config", import.meta.url), "utf8");
const start = cronSource.indexOf("export async function inspectDualRescheduleJournalsReadOnly(");
const end = cronSource.indexOf("// CRON 12: reconcileInconsistentDualPairs", start);
const inspector = start >= 0 && end > start ? cronSource.slice(start, end) : "";

test("DRR-06 inspector is present and uses Bookings Reader V2", () => {
    assert.ok(inspector.length > 0, "read-only inspector must remain defined");
    assert.match(inspector, /queryExtendedBookingsElevated/);
    assert.match(inspector, /assessDualRescheduleReadState/);
    assert.match(inspector, /consistencyMode: "strong"/);
});

test("DRR-07 inspector cannot mutate CMS, bookings, alerts or fiscal state", () => {
    assert.doesNotMatch(inspector, /\b(dalInsert|dalUpdate|dalBulkRemove|notifyOperationalAlert|rescheduleBookingElevated|_updateCitaSafe|registrarEventoEconomico)\b/);
    assert.doesNotMatch(inspector, /\b(orders|bookings)\.(create|update|cancel|reschedule)/);
});

test("DRR-08 inspector is not scheduled automatically", () => {
    assert.doesNotMatch(jobsConfig, /inspectDualRescheduleJournalsReadOnly/);
});
