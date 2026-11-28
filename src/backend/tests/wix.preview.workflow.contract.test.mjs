import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflowUrl = new URL("../../../.github/workflows/wix-tpv-preview.yml", import.meta.url);
const runnerUrl = new URL("../../../scripts/wix-preview-tpv-e2e.mjs", import.meta.url);
const docsUrl = new URL("../../../tests/runtime/RUNTIME-TEST-PLAN.md", import.meta.url);

test("WIX-PREVIEW-01 Editor Preview E2E is manually dispatchable with an explicit Preview URL", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    const start = workflow.indexOf("preview_url:");
    const end = workflow.indexOf("\n\npermissions:", start);
    const input = workflow.slice(start, end);
    assert.ok(workflow.includes("workflow_dispatch:"));
    assert.ok(start >= 0 && end > start);
    assert.ok(input.includes("required: true"));
    assert.ok(input.includes("type: string"));
    assert.ok(!workflow.includes("  push:"));
    assert.ok(!workflow.includes("  pull_request:"));
});

test("WIX-PREVIEW-02 workflow is bound to the Marian Madrid Editor site", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    assert.ok(workflow.includes("188bed94-177c-4bc9-a9f0-35080d874f3e"));
    assert.ok(workflow.includes("uiVersion"));
    assert.ok(workflow.includes("marianmadrid.es"));
});

test("WIX-PREVIEW-03 workflow uses pinned Node and Playwright without the wrong CLI project type", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    assert.ok(workflow.includes("npm ci"));
    assert.ok(workflow.includes('node-version: "24.22.1"'));
    assert.ok(workflow.includes("@playwright/test@1.65.1"));
    assert.ok(!workflow.includes("secrets.CLI_API_KEY"));
    assert.ok(!workflow.includes("@wix/cli"));
    assert.ok(!workflow.includes("npm run wix preview"));
});

test("WIX-PREVIEW-04 workflow runs Editor Preview E2E and never publishes", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    assert.ok(workflow.includes("node scripts/wix-preview-tpv-e2e.mjs"));
    assert.ok(!workflow.includes("npm run wix preview"));
    assert.ok(!workflow.includes("wix publish"));
    assert.ok(workflow.includes("cancel-in-progress: false"));
});

test("WIX-PREVIEW-05 authenticated state is secret-backed, temporary and never uploaded", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    assert.ok(workflow.includes("secrets.WIX_STORAGE_STATE_B64"));
    assert.ok(workflow.includes("base64 --decode"));
    assert.ok(workflow.includes("RUNNER_TEMP"));
    assert.ok(workflow.includes("chmod 600"));
    assert.ok(workflow.includes("Upload E2E report only (never storageState)"));
    assert.ok(!workflow.includes("path: ${{ runner.temp }}/wix-auth/storage-state.json"));
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
    assert.ok(docs.includes("colecciones de aplicaciones Wix"));
});
