import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isExplicitSimulationLedgerRecord } from "../validation.js";

test("TPV filters only explicit smoke fixtures, not generic environment labels", async () => {
    const fixtures = [
        { recordSource: "SMOKE_TEST" },
        { movementType: "SIMULATED_TPV_PAYMENT" },
        { movementType: "VENTA_POS_SIMULADA" },
        { eventType: "TPV_SALE_SIMULATED" },
        { projectionStatus: "SIMULATED_ONLY" },
        { synthetic: true, recordSource: "TPV_QA_DEVELOPMENT", source: "TPV_FUNCTIONAL_TEST" },
        { desgloseDetallado: { accountCode: "SIMULATED" } },
        { hash: "SIMULATED_HASH" },
    ];
    for (const fixture of fixtures) {
        assert.equal(isExplicitSimulationLedgerRecord(fixture), true);
    }

    const ordinaryRecords = [
        { recordSource: "TPV_SYNTHETIC", movementType: "TPV_PAYMENT" },
        { sourceType: "SYNTHETIC", movementType: "TPV_PAYMENT" },
        { synthetic: true, movementType: "SALE" },
        { realPayment: false, movementType: "TPV_PAYMENT" },
        { movementType: "TPV_PAYMENT", hash: "invalid" },
    ];
    for (const record of ordinaryRecords) {
        assert.equal(isExplicitSimulationLedgerRecord(record), false);
    }

    const [config, repository] = await Promise.all([
        readFile(new URL("../internalConfig.js", import.meta.url), "utf8"),
        readFile(new URL("../tpv/tpvRepository.js", import.meta.url), "utf8"),
    ]);
    assert.doesNotMatch(config, /TPV_HISTORICAL_POLICY/);
    assert.doesNotMatch(repository, /_isHistoricalTpvLedgerItem|TPV_HISTORICAL_POLICY/);
    assert.match(repository, /item\.transactionId/);
    assert.match(repository, /item\.hash/);
    assert.match(repository, /envelope\.siteId/);
    await assert.rejects(
        readFile(new URL("../tpv/tpvHistoricalCompat.js", import.meta.url), "utf8"),
        { code: "ENOENT" }
    );
});
