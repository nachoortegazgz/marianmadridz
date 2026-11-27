import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const backendRoot = new URL("../", import.meta.url);

test("TPV operational reader has no environment classifier and validates ledger integrity", async () => {
    const [config, validation, repository] = await Promise.all([
        readFile(new URL("../internalConfig.js", import.meta.url), "utf8"),
        readFile(new URL("../validation.js", import.meta.url), "utf8"),
        readFile(new URL("../tpv/tpvRepository.js", import.meta.url), "utf8"),
    ]);

    assert.doesNotMatch(config, /TPV_HISTORICAL_POLICY/);
    assert.doesNotMatch(validation, /isExplicitSimulationLedgerRecord|TPV_HISTORICAL_POLICY/);
    assert.doesNotMatch(repository, /_isHistoricalTpvLedgerItem|TPV_HISTORICAL_POLICY/);
    assert.match(repository, /item\.transactionId/);
    assert.match(repository, /item\.hash/);
    assert.match(repository, /envelope\.siteId/);
    assert.match(repository, /envelope\.requestFingerprint/);
    await assert.rejects(
        readFile(new URL("../tpv/tpvHistoricalCompat.js", import.meta.url), "utf8"),
        { code: "ENOENT" }
    );
});
