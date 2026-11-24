import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { load } from "./loader.mjs";

test("production fiscal and accounting gates remain fail-closed", async () => {
    const config = await readFile(new URL("../internalConfig.js", import.meta.url), "utf8");
    assert.match(config, /LEDGER_WRITES_ENABLED:\s*false/);
    assert.match(config, /ACCOUNTING_LEDGER_WRITES_ENABLED:\s*false/);
    assert.match(config, /ALLOW_SIMULATION_RECORDS:\s*false/);
});

test("offline loader overrides fiscal gates only in the test loader", async () => {
    const [config, loader] = await Promise.all([
        readFile(new URL("../internalConfig.js", import.meta.url), "utf8"),
        readFile(new URL("./loader.mjs", import.meta.url), "utf8"),
    ]);
    assert.match(loader, /\.replace\("LEDGER_WRITES_ENABLED: false", "LEDGER_WRITES_ENABLED: true"\)/);
    assert.match(loader, /\.replace\("ACCOUNTING_LEDGER_WRITES_ENABLED: false", "ACCOUNTING_LEDGER_WRITES_ENABLED: true"\)/);
    assert.match(loader, /\.replace\("ALLOW_SIMULATION_RECORDS: false", "ALLOW_SIMULATION_RECORDS: true"\)/);
    assert.doesNotMatch(config, /process\.env|globalThis\.__mm.*Policy/);
});

test("wix-fetch offline adapter blocks every host except the installed signer mock", async () => {
    const { source } = await load("mock:wix-fetch", {}, async () => ({ format: "module", source: "" }));
    const shimUrl = "data:text/javascript;base64," + Buffer.from(source).toString("base64");
    const shim = await import(shimUrl);
    const originalFetch = globalThis.fetch;
    const originalFlag = globalThis.__mmSignerFetchInstalled;
    const calls = [];

    try {
        globalThis.fetch = async (input, init) => {
            calls.push({ input, init });
            return { ok: true, status: 200 };
        };
        delete globalThis.__mmSignerFetchInstalled;

        await assert.rejects(
            shim.fetch("https://signer.mock.local/sign"),
            /OFFLINE_FETCH_MOCK_NOT_INSTALLED/
        );
        globalThis.__mmSignerFetchInstalled = true;

        await assert.rejects(
            shim.fetch("https://example.com/"),
            /OFFLINE_EXTERNAL_FETCH_BLOCKED/
        );
        await assert.rejects(
            shim.fetch("http://signer.mock.local/sign"),
            /OFFLINE_EXTERNAL_FETCH_BLOCKED/
        );
        assert.equal(calls.length, 0, "blocked destinations must never reach Node fetch");

        const response = await shim.fetch("https://signer.mock.local/sign", { method: "POST" });
        assert.equal(response.status, 200);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].input, "https://signer.mock.local/sign");
    } finally {
        globalThis.fetch = originalFetch;
        if (originalFlag === undefined) delete globalThis.__mmSignerFetchInstalled;
        else globalThis.__mmSignerFetchInstalled = originalFlag;
    }
});

test("signer flow mock has no fallback to native network", async () => {
    const source = await readFile(new URL("./site.flows.offline.test.mjs", import.meta.url), "utf8");
    assert.match(source, /throw new Error\('OFFLINE_EXTERNAL_FETCH_BLOCKED'\)/);
    assert.doesNotMatch(source, /const realFetch = globalThis\.fetch|return realFetch\s*\?/);
});
