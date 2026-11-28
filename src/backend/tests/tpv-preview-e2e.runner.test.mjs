import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const runnerUrl = new URL("../../../scripts/wix-preview-tpv-e2e.mjs", import.meta.url);
const workflowUrl = new URL("../../../.github/workflows/wix-tpv-preview.yml", import.meta.url);

test("TPV E2E preflight never closes or adopts a pre-existing cash session", async () => {
    const runner = await readFile(runnerUrl, "utf8");
    assert.ok(runner.includes("PREEXISTING_OPEN_SESSION_NOT_TOUCHED"));
    assert.ok(!runner.includes('invokeWidget(frame, "SESSION_CLOSE"'));
    assert.ok(!runner.includes("close-existing-session"));
});

test("TPV E2E covers opening float, cash movement, partial count, pending sale, X and Z", async () => {
    const runner = await readFile(runnerUrl, "utf8");
    assert.ok(runner.includes('fill("300,00")'));
    assert.ok(runner.includes("PARTIAL_CASH_COUNT"));
    assert.ok(runner.includes("SALE_REGISTER"));
    assert.ok(runner.includes("assertPending(saleEnvelope"));
    assert.ok(runner.includes("TICKET_X"));
    assert.ok(runner.includes("TICKET_Z"));
    assert.ok(runner.includes("TICKET_Z_CLOSED"));
    assert.ok(runner.includes("pendingSalesCount"));
});

test("Preview workflow executes the TPV E2E runner against an Editor Preview URL", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    assert.match(workflow, /preview_url:/);
    assert.match(workflow, /node scripts\\/wix-preview-tpv-e2e\\.mjs/);
    assert.doesNotMatch(workflow, /npm run wix preview/);
    assert.match(workflow, /cancel-in-progress: false/);
    assert.match(workflow, /WIX_STORAGE_STATE_B64/);
});
