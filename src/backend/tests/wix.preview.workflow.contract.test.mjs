import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflowUrl = new URL("../../../.github/workflows/wix-tpv-preview.yml", import.meta.url);
const runnerUrl = new URL("../../../scripts/wix-preview-tpv-e2e.mjs", import.meta.url);
const docsUrl = new URL("../../../tests/runtime/RUNTIME-TEST-PLAN.md", import.meta.url);

test("WIX-PREVIEW-01 Editor Preview E2E is manually dispatchable with an explicit Preview URL", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    assert.match(workflow, /workflow_dispatch:/);
    assert.match(workflow, /preview_url:[\\s\\S]*?required: true[\\s\\S]*?type: string/);
    assert.doesNotMatch(workflow, /^\\s{2}push:/m);
    assert.doesNotMatch(workflow, /^\\s{2}pull_request:/m);
});

test("WIX-PREVIEW-02 workflow is bound to the Marian Madrid Editor site", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    assert.match(workflow, /188bed94-177c-4bc9-a9f0-35080d874f3e/);
    assert.match(workflow, /uiVersion/);
    assert.match(workflow, /marianmadrid\\.es/);
});

test("WIX-PREVIEW-03 workflow uses pinned Node and Playwright without the wrong CLI project type", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    assert.match(workflow, /npm ci/);
    assert.match(workflow, /node-version: ["']24\\.22\\.1["']/);
    assert.match(workflow, /@playwright\\/test@1\\.65\\.1/);
    assert.doesNotMatch(workflow, /secrets\\.CLI_API_KEY|@wix\\/cli|npm run wix preview/);
});

test("WIX-PREVIEW-04 workflow runs Editor Preview E2E and never publishes", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    assert.match(workflow, /node scripts\\/wix-preview-tpv-e2e\\.mjs/);
    assert.doesNotMatch(workflow, /npm run wix preview|npm run wix publish|\\bwix publish\\b/i);
    assert.match(workflow, /cancel-in-progress: false/);
});

test("WIX-PREVIEW-05 authenticated state is secret-backed, temporary and never uploaded", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    assert.match(workflow, /secrets\\.WIX_STORAGE_STATE_B64/);
    assert.match(workflow, /base64 --decode/);
    assert.match(workflow, /RUNNER_TEMP/);
    assert.match(workflow, /chmod 600/);
    assert.match(workflow, /Upload E2E report only \\(never storageState\\)/);
    assert.doesNotMatch(workflow, /path:.*storage-state\\.json/);
});

test("WIX-PREVIEW-06 TPV E2E performs business writes through the bridge without touching pre-existing sessions", async () => {
    const runner = await readFile(runnerUrl, "utf8");
    const docs = await readFile(docsUrl, "utf8");
    for (const operation of ["CASHIER_STATE", "SESSION_OPEN", "CASH_MOVEMENT", "PARTIAL_CASH_COUNT",
        "SALE_REGISTER", "TICKET_X", "TICKET_Z", "CASH_MOVEMENTS_EXPORT", "AUDIT_LIST"]) {
        assert.ok(runner.includes(operation), "runner must execute " + operation);
    }
    assert.ok(runner.includes("PREEXISTING_OPEN_SESSION_NOT_TOUCHED"));
    assert.ok(!runner.includes('invokeWidget(frame, "SESSION_CLOSE"'));
    assert.ok(!runner.includes("close-existing-session"));
    assert.ok(docs.includes("Sandbox está deshabilitado por defecto"));
    assert.ok(docs.includes("Wix app collections"));
});
