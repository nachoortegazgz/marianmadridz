#!/usr/bin/env node
"use strict";
const { createRequire } = require("node:module");
const { mkdir, chmod } = require("node:fs/promises");
const path = require("node:path");
const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");

const root = process.env.PLAYWRIGHT_MODULE_ROOT;
if (!root) throw new Error("Set PLAYWRIGHT_MODULE_ROOT to the global npm modules directory.");
const requireGlobal = createRequire(path.join(root, "_global-loader.cjs"));
const { chromium } = requireGlobal("playwright");
const DEFAULT_URL = "https://nachoortegazgz-marianmadrid.editor.wix.com/html/editor/web/renderer/external_preview/document/7007f035-995e-442f-8608-6a917b2b7e53?metaSiteId=188bed94-177c-4bc9-a9f0-35080d874f3e&dsOrigin=externalPreview&configName=externalPreview";
const OUTPUT = path.resolve(".local/wix-preview-storage-state.json");

(async () => {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    let browser;
    try {
        const input = process.env.WIX_PREVIEW_URL ||
            await rl.question("Preview URL [Enter = Preview Marian Madrid configurado]: ");
        const url = new URL(input.trim() || DEFAULT_URL);
        const wixHost = (h) => h === "wix.to" || h === "wix.com" ||
            h.endsWith(".wix.com") || h.endsWith(".wixsite.com");
        if (url.protocol !== "https:" || !wixHost(url.hostname)) {
            throw new Error("Solo se aceptan URLs HTTPS de Preview Wix.");
        }
        browser = await chromium.launch({ headless: false });
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 90000 });
        stdout.write("\nCompleta el login Wix manualmente y verifica que el Preview Marian Madrid queda visible.\n");
        stdout.write("No compartas cookies, contraseñas ni el archivo generado.\n");
        await rl.question("Pulsa Enter cuando la sesión esté autenticada y el Preview visible... ");
        const finalUrl = new URL(page.url());
        if (finalUrl.protocol !== "https:" || !wixHost(finalUrl.hostname)) {
            throw new Error("La ventana terminó fuera de un host Wix permitido.");
        }
        await page.locator("body").waitFor({ state: "visible", timeout: 15000 });
        await mkdir(path.dirname(OUTPUT), { recursive: true });
        await context.storageState({ path: OUTPUT, indexedDB: true });
        await chmod(OUTPUT, 0o600);
        stdout.write("\nStorage state guardado en " + OUTPUT + "\n");
        stdout.write("No se muestra su contenido. Sube su Base64 como secreto WIX_STORAGE_STATE_B64.\n");
    } finally {
        rl.close();
        await browser?.close();
    }
})().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
