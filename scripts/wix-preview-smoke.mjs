import assert from "node:assert/strict";
import { createRequire } from "node:module";

const previewUrl = process.env.WIX_PREVIEW_URL;
const moduleRoot = process.env.PLAYWRIGHT_MODULE_ROOT;
const reportPath = process.env.WIX_SMOKE_REPORT;

assert.ok(previewUrl, "WIX_PREVIEW_URL is required");
assert.ok(moduleRoot, "PLAYWRIGHT_MODULE_ROOT is required");
assert.ok(reportPath, "WIX_SMOKE_REPORT is required");

const require = createRequire(`${moduleRoot}/wix-preview-smoke-loader.cjs`);
const { chromium } = require("playwright");

const allowedHost = (hostname) =>
    hostname === "wix.to" ||
    hostname === "wixsite.com" ||
    hostname.endsWith(".wixsite.com") ||
    hostname === "wix.com" ||
    hostname.endsWith(".wix.com") ||
    hostname.endsWith(".wixstudio.com");

const startUrl = new URL(previewUrl);
assert.ok(["http:", "https:"].includes(startUrl.protocol), "Preview URL must use HTTP(S)");
assert.ok(allowedHost(startUrl.hostname), "Initial URL must be a Wix Preview host, never a custom/live domain");

const blockedRequests = [];
const pageErrors = [];
const consoleErrors = [];
let browser;

try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();

    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
    });

    // Prevent every non-read HTTP request from reaching Wix or a third party.
    await page.route("**/*", async (route) => {
        const method = route.request().method().toUpperCase();
        if (["GET", "HEAD", "OPTIONS"].includes(method)) {
            await route.continue();
            return;
        }
        blockedRequests.push({
            method,
            host: new URL(route.request().url()).hostname,
        });
        await route.abort("blockedbyclient");
    });

    const response = await page.goto(previewUrl, {
        waitUntil: "domcontentloaded",
        timeout: 90000,
    });

    assert.ok(response, "Main document did not return an HTTP response");
    assert.ok(response.status() >= 200 && response.status() < 400, `Unexpected main document status: ${response.status()}`);

    await page.locator("body").waitFor({ state: "visible", timeout: 30000 });
    const bodyText = (await page.locator("body").innerText({ timeout: 15000 })).trim();
    assert.ok(bodyText.length > 0, "Rendered page body is empty");

    const finalUrl = new URL(page.url());
    assert.ok(allowedHost(finalUrl.hostname), "Preview redirected outside Wix Preview infrastructure");

    const report = {
        result: "PASS",
        httpStatus: response.status(),
        finalHost: finalUrl.hostname,
        title: await page.title(),
        renderedTextLength: bodyText.length,
        blockedNonReadRequests: blockedRequests,
        pageErrorCount: pageErrors.length,
        pageErrors: pageErrors.slice(0, 20),
        consoleErrorCount: consoleErrors.length,
        consoleErrors: consoleErrors.slice(0, 20),
        interactionsPerformed: 0,
        formsSubmitted: 0,
        timestamp: new Date().toISOString(),
    };

    const { writeFile } = await import("node:fs/promises");
    await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} catch (error) {
    const { writeFile } = await import("node:fs/promises");
    const report = {
        result: "FAIL",
        error: error instanceof Error ? error.message : String(error),
        blockedNonReadRequests: blockedRequests,
        pageErrors: pageErrors.slice(0, 20),
        consoleErrors: consoleErrors.slice(0, 20),
        interactionsPerformed: 0,
        formsSubmitted: 0,
        timestamp: new Date().toISOString(),
    };
    await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
    throw error;
} finally {
    await browser?.close();
}
