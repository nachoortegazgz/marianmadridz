// Canonical runner for the audit report. A run without a clean report fails CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runFullAudit } from '../__tests__/audit.e2e.js';

test('E2E-AUDIT-FULL reports zero flow, integrity, and critical failures', async () => {
  const report = await runFullAudit();
  assert.equal(report.overallStatus, 'ALL_TESTS_PASSED_NO_DATA_LOSS_DETECTED', JSON.stringify({
    overallStatus: report.overallStatus,
    summary: report.summary,
    criticalIssues: report.criticalIssues,
    warnings: report.warnings,
  }));
  assert.ok(report.summary.totalFlows >= 8, 'all eight canonical flow checks must run');
  assert.ok(report.summary.totalChecks > 0, 'integrity checks must run');
  assert.equal(report.summary.failedFlows, 0);
  assert.equal(report.summary.failedChecks, 0);
  assert.equal(report.criticalIssuesCount, 0);
  assert.equal(report.criticalIssues.length, 0);
});
