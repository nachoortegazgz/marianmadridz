import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const auditSource = readFileSync(new URL("../audit.js", import.meta.url), "utf8");
const cronSource = readFileSync(new URL("../crons.js", import.meta.url), "utf8");

test("operational alerts have one centralized, deduplicated writer", () => {
  assert.match(auditSource, /export async function notifyOperationalAlert/);
  assert.match(auditSource, /getItem as dalGet/);
  assert.match(auditSource, /dedupeKey: id/);
  assert.match(auditSource, /consistentRead: true/);
  assert.match(cronSource, /import \{ notifyOperationalAlert \} from "backend\/audit"/);
  assert.match(cronSource, /await notifyOperationalAlert\(\{/);
  assert.doesNotMatch(
    cronSource.slice(
      cronSource.indexOf("export async function verifyNightlyZClosing"),
      cronSource.indexOf("// CRON 8: cleanAuditLogs")
    ),
    /dalInsert\(C,/,
    "the cron must not create operational alerts directly",
  );
});

test("audit write paths share one persistence implementation", () => {
  assert.match(auditSource, /async function _persistAuditRecord/);
  assert.match(auditSource, /await _persistAuditRecord\(record\);/);
  assert.match(auditSource, /await _persistAuditRecord\(record, "audit_insert"\);/);
});
