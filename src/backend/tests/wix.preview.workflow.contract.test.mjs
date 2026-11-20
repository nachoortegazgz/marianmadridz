import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflowUrl = new URL("../../../.github/workflows/wix-tpv-preview.yml", import.meta.url);
const packageUrl = new URL("../../../package.json", import.meta.url);
const lockUrl = new URL("../../../package-lock.json", import.meta.url);
const smokeUrl = new URL("../../../scripts/wix-preview-smoke.mjs", import.meta.url);

test("WIX-PREVIEW-01 preview workflow is manual by request or follows successful main quality CI", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    assert.match(workflow, /workflow_dispatch:/);
    assert.match(workflow, /create_preview:[\s\S]*?type: boolean[\s\S]*?default: false/);
    assert.doesNotMatch(workflow, /^\s{2}workflow_run:/m);
    assert.doesNotMatch(workflow, /^\s{2}(push|pull_request):/m);
});

test("WIX-PREVIEW-02 preview is restricted to main and the configured Marian Madrid site", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
    assert.match(workflow, /188bed94-177c-4bc9-a9f0-35080d874f3e/);
    assert.match(workflow, /if \(!uiVersion\)/);
});

test("WIX-PREVIEW-03 preview requires Wix CLI credentials, locked dependencies and pinned CLI", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    assert.match(workflow, /secrets\.CLI_API_KEY/);
    assert.match(workflow, /Wix CLI for Sites - Git Integration/);
    assert.match(workflow, /npm ci/);
    assert.match(workflow, /@wix\/cli@1\.2\.14/);
    assert.match(workflow, /node-version: ["']24\.22\.1["']/);
});

test("WIX-PREVIEW-04 workflow selects remote main source, creates Preview only and never publishes", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    assert.match(workflow, /npm run wix preview -- --source remote/);
    assert.ok(workflow.includes("timeout-minutes: 10"));
    assert.doesNotMatch(workflow, /npm run wix publish|\bwix publish\b/i);
    assert.doesNotMatch(workflow, /pty|script --quiet|printf|wix preview -- --help/i);
});

test("WIX-PREVIEW-05 Playwright remains isolated from the Wix site's runtime dependency graph", async () => {
    const pkg = JSON.parse(await readFile(packageUrl, "utf8"));
    const lock = JSON.parse(await readFile(lockUrl, "utf8"));
    assert.equal(pkg.devDependencies?.["@playwright/test"], undefined);
    assert.equal(lock.packages?.[""]?.devDependencies?.["@playwright/test"], undefined);
    const workflow = await readFile(workflowUrl, "utf8");
    assert.match(workflow, /@playwright\/test@1\.65\.1/);
    assert.match(workflow, /node scripts\/wix-preview-smoke\.mjs/);
});

test("WIX-PREVIEW-06 browser smoke blocks non-read HTTP methods and never submits forms", async () => {
    const smoke = await readFile(smokeUrl, "utf8");
    assert.match(smoke, /blockedbyclient/);
    assert.match(smoke, /GET.*HEAD.*OPTIONS/s);
    assert.doesNotMatch(smoke, /\.click\(|\.fill\(|\.submit\(/);
});
