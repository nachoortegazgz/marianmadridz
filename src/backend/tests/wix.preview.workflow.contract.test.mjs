import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflowUrl = new URL("../../../.github/workflows/wix-tpv-preview.yml", import.meta.url);
const packageUrl = new URL("../../../package.json", import.meta.url);
const lockUrl = new URL("../../../package-lock.json", import.meta.url);

test("WIX-PREVIEW-01 preview workflow is manual and defaults to no preview creation", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    assert.match(workflow, /workflow_dispatch:/);
    assert.match(workflow, /create_preview:[\s\S]*?type: boolean[\s\S]*?default: false/);
    assert.doesNotMatch(workflow, /^\s{2}(push|pull_request):/m);
});

test("WIX-PREVIEW-02 preview is restricted to main and the configured Marian Madrid site", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    assert.match(workflow, /github\.ref\s*!=\s*['"]refs\/heads\/main['"]/);
    assert.match(workflow, /188bed94-177c-4bc9-a9f0-35080d874f3e/);
    assert.match(workflow, /if \(!uiVersion\)/);
});

test("WIX-PREVIEW-03 preview requires Wix CLI credentials and a locked npm install", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    assert.match(workflow, /secrets\.CLI_API_KEY/);
    assert.match(workflow, /Wix CLI for Sites - Git Integration/);
    assert.match(workflow, /npm ci/);
    assert.match(workflow, /@wix\/cli@1\.2\.14/);
    assert.match(workflow, /node-version: ["']24\.22\.1["']/);
});

test("WIX-PREVIEW-04 Wix preview is opt-in and workflow never publishes", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    assert.match(workflow, /inputs\.create_preview/);
    assert.match(workflow, /npm run wix preview/);
    assert.doesNotMatch(workflow, /npm run wix publish|\bwix publish\b/i);
});

test("WIX-PREVIEW-05 Playwright is not claimed as installed until manifest and lock agree", async () => {
    const pkg = JSON.parse(await readFile(packageUrl, "utf8"));
    const lock = JSON.parse(await readFile(lockUrl, "utf8"));
    const declared = pkg.devDependencies?.["@playwright/test"];
    const locked = lock.packages?.[""]?.devDependencies?.["@playwright/test"];
    assert.equal(declared, locked, "Playwright must be declared identically in package.json and package-lock.json");
});
