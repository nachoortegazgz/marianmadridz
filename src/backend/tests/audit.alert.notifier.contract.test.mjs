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
  assert.match(auditSource, /_summarizeAlertData\(data\)/);
  assert.match(auditSource, /normalizedLevel === "ERROR" \|\| normalizedLevel === "CRITICAL"/);
  assert.match(auditSource, /makeTraceId\("audit-error"\)/);
  assert.match(cronSource, /import \{ notifyOperationalAlert \} from "backend\/audit"/);
  assert.match(cronSource, /await notifyOperationalAlert\(\{/);
  const nightlyJob = cronSource.slice(
    cronSource.indexOf("export async function verifyNightlyZClosing"),
    cronSource.indexOf("// CRON 8: cleanAuditLogs"),
  );
  assert.doesNotMatch(nightlyJob, /dalInsert\(C,/);
});

test("audit entry points share one normalized event handler and persistence path", () => {
  assert.match(auditSource, /async function _persistAuditRecord/);
  assert.match(auditSource, /async function _logAuditEvent\\(/);
  assert.match(auditSource, /await _persistAuditRecord\\(record, timeoutLabel\\);/);
  assert.match(auditSource, /return _logAuditEvent\\(\\{ eventType, level, message, data, traceId, entityId, source \\}\\);/);
  assert.match(auditSource, /timeoutLabel: "audit_insert",\\s*timeoutAlerts: true/);

  const publicEntries = auditSource.slice(auditSource.indexOf("export async function logAuditEvent("));
  assert.equal((publicEntries.match(/_normalizeLevel\\(/g) || []).length, 0);
  assert.equal((publicEntries.match(/_buildControlOperativoRecord\\(/g) || []).length, 0);
});
