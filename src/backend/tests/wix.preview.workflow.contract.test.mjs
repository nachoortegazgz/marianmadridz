import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflowUrl = new URL("../../../.github/workflows/wix-tpv-preview.yml", import.meta.url);
const runnerUrl = new URL("../../../scripts/wix-preview-tpv-e2e.mjs", import.meta.url);

test("WIX-PREVIEW-01 TPV Editor Preview E2E is manually dispatchable with an explicit Preview URL", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    assert.match(workflow, /workflow_dispatch:/);
    assert.match(workflow, /preview_url:[\s\S]*?required: true[\s\S]*?type: string/);
    assert.doesNotMatch(workflow, /^\s{2}push:/m);
    assert.doesNotMatch(workflow, /^\s{2}pull_request:/m);
});

test("WIX-PREVIEW-02 workflow targets the configured Wix Editor site and never publishes", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    assert.match(workflow, /188bed94-177c-4bc9-a9f0-35080d874f3e/);
    assert.match(workflow, /uiVersion/);
    assert.match(workflow, /WIX_PREVIEW_URL/);
    assert.match(workflow, /WIX_PREVIEW_URL must be an HTTPS Wix Editor Preview URL/);
    assert.doesNotMatch(workflow, /npm run wix preview|\bwix publish\b|npm run wix publish/i);
});

test("WIX-PREVIEW-03 workflow executes the TPV E2E runner and does not cancel an active cash session", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    assert.match(workflow, /node scripts\/wix-preview-tpv-e2e\.mjs/);
    assert.match(workflow, /cancel-in-progress: false/);
    assert.match(workflow, /timeout-minutes: 45/);
});

test("WIX-PREVIEW-04 authenticated browser state is secret-backed and never uploaded", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    assert.match(workflow, /secrets\.WIX_STORAGE_STATE_B64/);
    assert.match(workflow, /base64 --decode/);
    assert.match(workflow, /RUNNER_TEMP/);
    assert.match(workflow, /chmod 600/);
    assert.match(workflow, /Upload E2E report only \(never storageState\)/);
    assert.doesNotMatch(workflow, /path:.*storage-state\.json/);
});

test("WIX-PREVIEW-05 runner is non-destructive and verifies the native Wix order, Ticket X and Ticket Z", async () => {
    const runner = await readFile(runnerUrl, "utf8");
    assert.match(runner, /PREEXISTING_OPEN_SESSION_NOT_TOUCHED/);
    assert.doesNotMatch(runner, /invokeWidget\(frame,\s*"SESSION_CLOSE"/);
    assert.match(runner, /PARTIAL_CASH_COUNT/);
    assert.match(runner, /SALE_READBACK/);
    assert.match(runner, /cashSaleIdempotencyKey/);
    assert.match(runner, /PAGO_TPV_CONFIRMADO/);
    assert.match(runner, /cashierProjection/);
    assert.match(runner, /orderPersisted/);
    assert.match(runner, /TICKET_X/);
    assert.match(runner, /TICKET_Z/);
    assert.match(runner, /TICKET_Z_CLOSED/);
});

test("WIX-PREVIEW-06 read-only smoke is the default and exits before all operational writes", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    const runner = await readFile(runnerUrl, "utf8");
    assert.match(workflow, /default: read-only/);
    assert.match(workflow, /confirm_writes:[\s\S]*?default: NO/);
    assert.match(workflow, /data_isolation_confirmed:[\s\S]*?default: NO/);
    assert.match(runner, /WIX_TPV_E2E_MODE \|\| "read-only"/);
    assert.match(runner, /executionMode === "e2e"/);
    assert.match(runner, /WIX_TPV_E2E_ALLOW_WRITES=YES/);
    assert.match(runner, /WIX_TPV_DATA_ISOLATION_CONFIRMED=YES/);
    assert.ok(
        runner.indexOf('if (executionMode === "read-only")') <
        runner.indexOf('phase = "session-open"'),
        "Read-only return must precede SESSION_OPEN"
    );
    assert.match(runner, /report\.result = "PASS_READ_ONLY"/);
    assert.match(runner, /noBusinessWritesInvoked/);
});
