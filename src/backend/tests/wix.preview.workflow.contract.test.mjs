import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflowUrl = new URL("../../../.github/workflows/wix-tpv-preview.yml", import.meta.url);
const packageUrl = new URL("../../../package.json", import.meta.url);
const lockUrl = new URL("../../../package-lock.json", import.meta.url);
const generatorUrl = new URL("../../../scripts/generate-storage-state.js", import.meta.url);
const runnerUrl = new URL("../../../scripts/wix-preview-authenticated.mjs", import.meta.url);
const docsUrl = new URL("../../../docs/WIX-PREVIEW-AUTHENTICATED-RUNNER.md", import.meta.url);

test("WIX-PREVIEW-01 authenticated Preview runner is manually dispatchable", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    assert.match(workflow, /workflow_dispatch:/);
    assert.match(workflow, /create_preview:[\s\S]*?type: boolean[\s\S]*?default: true/);
    assert.match(workflow, /authenticated_browser:[\s\S]*?type: boolean[\s\S]*?default: true/);
    assert.doesNotMatch(workflow, /^\s{2}push:/m);
    assert.doesNotMatch(workflow, /^\s{2}pull_request:/m);
});

test("WIX-PREVIEW-02 Preview is restricted to main and the configured Marian Madrid site", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
    assert.match(workflow, /188bed94-177c-4bc9-a9f0-35080d874f3e/);
    assert.match(workflow, /uiVersion/);
});

test("WIX-PREVIEW-03 workflow requires Wix CLI credentials and pinned tooling", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    assert.match(workflow, /secrets\.CLI_API_KEY/);
    assert.match(workflow, /npm ci/);
    assert.match(workflow, /@wix\/cli@1\.2\.14/);
    assert.match(workflow, /node-version: ["']24\.22\.1["']/);
    assert.match(workflow, /@playwright\/test@1\.65\.1/);
});

test("WIX-PREVIEW-04 workflow creates Preview only and never publishes", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    assert.match(workflow, /npm run wix preview -- --source remote/);
    assert.match(workflow, /wix\.to/);
    assert.doesNotMatch(workflow, /npm run wix publish|\bwix publish\b/i);
});

test("WIX-PREVIEW-05 authenticated state is secret-backed, temporary and never uploaded", async () => {
    const workflow = await readFile(workflowUrl, "utf8");
    assert.match(workflow, /secrets\.WIX_STORAGE_STATE_B64/);
    assert.match(workflow, /base64 --decode/);
    assert.match(workflow, /RUNNER_TEMP/);
    assert.match(workflow, /chmod 600/);
    assert.match(workflow, /Upload report only \(never storageState\)/);
    assert.doesNotMatch(workflow, /path:.*storage-state\.json/);
});

test("WIX-PREVIEW-06 local generator and runner preserve manual authentication and avoid business writes", async () => {
    const generator = await readFile(generatorUrl, "utf8");
    const runner = await readFile(runnerUrl, "utf8");
    const docs = await readFile(docsUrl, "utf8");
    assert.match(generator, /headless: false/);
    assert.match(generator, /storageState\(\{ path: OUTPUT, indexedDB: true \}\)/);
    assert.match(generator, /\.local\/wix-preview-storage-state\.json/);
    assert.match(runner, /businessWebMethodsInvoked: 0/);
    assert.match(runner, /Authentication bootstrap only/);
    assert.doesNotMatch(runner, /abrirSesionCaja|registrarMovimientoCaja|generarTicketX|import\(['"]backend\//);
    assert.match(docs, /WIX_STORAGE_STATE_B64/);
    assert.match(docs, /no invoca webMethods de negocio/);
});
