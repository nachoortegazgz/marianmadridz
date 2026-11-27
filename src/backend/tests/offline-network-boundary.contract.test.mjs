import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { load } from "./loader.mjs";

test("fiscal writers have no global environment disable switches", async () => {
    const config = await readFile(new URL("../internalConfig.js", import.meta.url), "utf8");
    assert.doesNotMatch(config, /FISCAL_RUNTIME_POLICY|LEDGER_WRITES_ENABLED|ACCOUNTING_LEDGER_WRITES_ENABLED|ALLOW_SIMULATION_RECORDS/);
});

test("offline loader does not rewrite business configuration", async () => {
    const loader = await readFile(new URL("./loader.mjs", import.meta.url), "utf8");
    assert.doesNotMatch(loader, /LEDGER_WRITES_ENABLED|ACCOUNTING_LEDGER_WRITES_ENABLED|ALLOW_SIMULATION_RECORDS|internalConfigUrl/);
    assert.match(loader, /Only infrastructure adapters are replaced by deterministic in-memory doubles/);
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
