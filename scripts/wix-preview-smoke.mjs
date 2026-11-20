import assert from "node:assert/strict";
import { createRequire } from "node:module";

const previewUrl = process.env.WIX_PREVIEW_URL;
const moduleRoot = process.env.PLAYWRIGHT_MODULE_ROOT;
const reportPath = process.env.WIX_SMOKE_REPORT;

assert.ok(previewUrl, "WIX_PREVIEW_URL is required");
assert.ok(moduleRoot, "PLAYWRIGHT_MODULE_ROOT is required");
assert.ok(reportPath, "WIX_SMOKE_REPORT is required");

const require = createRequire(`${moduleRoot}/@playwright/test/index.js`);
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
let pageErrorCount = 0;
let consoleErrorCount = 0;
let browser;

try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();

    page.on("pageerror", () => pageErrorCount += 1);
    page.on("console", (message) => {
        if (message.type() === "error") consoleErrorCount += 1;
    });

    // Prevent every non-read HTTP request from reaching Wix or a third party.
    await page.route("**/*", async (route) => {
        const method = route.request().method().toUpperCase();
        const requestUrl = new URL(route.request().url());
        const dynamicApiPath = /\/(?:_api|_functions|_serverless|api|graphql)(?:\/|$)/i.test(requestUrl.pathname);
        if (["GET", "HEAD", "OPTIONS"].includes(method) && !dynamicApiPath) {
            await route.continue();
            return;
        }
        blockedRequests.push({
            method,
            host: requestUrl.hostname,
            category: dynamicApiPath ? "dynamic-api" : "non-read-method",
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
        titleLength: (await page.title()).length,
        renderedTextLength: bodyText.length,
        blockedRequests,
        pageErrorCount,
        consoleErrorCount,
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
        pageErrorCount,
        consoleErrorCount,
        interactionsPerformed: 0,
        formsSubmitted: 0,
        timestamp: new Date().toISOString(),
    };
    await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
    throw error;
} finally {
    await browser?.close();
}
