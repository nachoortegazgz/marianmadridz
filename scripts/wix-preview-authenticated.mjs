import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";

const previewUrl = process.env.WIX_PREVIEW_URL;
const statePath = process.env.WIX_STORAGE_STATE_PATH;
const reportPath = process.env.WIX_RUNTIME_REPORT;
const moduleRoot = process.env.PLAYWRIGHT_MODULE_ROOT;
assert.ok(previewUrl && statePath && reportPath && moduleRoot, "Missing Preview runner configuration");

const state = JSON.parse(await readFile(statePath, "utf8"));
assert.ok(Array.isArray(state.cookies) && Array.isArray(state.origins), "Invalid Playwright storageState");
const require = createRequire(`${moduleRoot}/@playwright/test/index.js`);
const { chromium } = require("playwright");
const wixHost = (h) => h === "wix.to" || h === "wix.com" ||
    h.endsWith(".wix.com") || h === "wixsite.com" || h.endsWith(".wixsite.com");
const start = new URL(previewUrl);
assert.equal(start.protocol, "https:");
assert.ok(wixHost(start.hostname), "Preview URL is not a Wix host");

const report = {
    result: "FAIL",
    authenticatedBrowser: false,
    businessWebMethodsInvoked: 0,
    note: "Authentication bootstrap only; no TPV operation is invoked in this stage.",
    timestamp: new Date().toISOString(),
};
let browser;
try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ storageState: state, serviceWorkers: "block" });
    const page = await context.newPage();
    const response = await page.goto(previewUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    assert.ok(response, "Preview returned no main-document response");
    assert.ok(response.status() >= 200 && response.status() < 400, `Preview HTTP ${response.status()}`);
    await page.locator("body").waitFor({ state: "visible", timeout: 30000 });
    const finalUrl = new URL(page.url());
    assert.ok(wixHost(finalUrl.hostname), "Preview redirected outside Wix");
    const text = (await page.locator("body").innerText()).trim();
    assert.ok(text.length > 0, "Preview body is empty");
    assert.ok(!/sign in|log in|iniciar sesión|inicia sesión/i.test(text), "Wix login screen returned; stored session not accepted");
    Object.assign(report, {
        result: "PASS",
        authenticatedBrowser: true,
        httpStatus: response.status(),
        finalHost: finalUrl.hostname,
        renderedTextLength: text.length,
        timestamp: new Date().toISOString(),
    });
    await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
    throw error;
} finally {
    await browser?.close();
}
