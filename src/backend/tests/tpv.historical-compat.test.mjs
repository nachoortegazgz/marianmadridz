import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("TPV ledger readers do not branch on synthetic or smoke markers", async () => {
    const [validation, eventLog, aggregator, config, repository] = await Promise.all([
        readFile(new URL("../validation.js", import.meta.url), "utf8"),
        readFile(new URL("../eventLog.js", import.meta.url), "utf8"),
        readFile(new URL("../fiscalAggregator.web.js", import.meta.url), "utf8"),
        readFile(new URL("../internalConfig.js", import.meta.url), "utf8"),
        readFile(new URL("../tpv/tpvRepository.js", import.meta.url), "utf8"),
    ]);

    assert.doesNotMatch(validation, /isExplicitSimulationLedgerRecord/);
    const headReaderStart = eventLog.indexOf("async function _getLastCashEvent()");
    const headReaderEnd = eventLog.indexOf("\n}", headReaderStart) + 2;
    const headReader = eventLog.slice(headReaderStart, headReaderEnd);
    assert.ok(headReaderStart >= 0 && headReaderEnd > headReaderStart);
    assert.doesNotMatch(headReader, /isExplicitSimulationLedgerRecord|SMOKE_TEST|recordSource/);
    assert.match(headReader, /return \(res\?\.items \|\| \[\]\)\[0\] \|\| null/);
    assert.doesNotMatch(aggregator, /isExplicitSimulationLedgerRecord|SIMULATED_ONLY|SMOKE_TEST/);
    assert.match(aggregator, /return \{ items: allItems, reachedMaxPages, totalPages: page - 1 \}/);
    const reconciliationStart = eventLog.indexOf("export async function reconciliarProyecciones()");
    const reconciliationEnd = eventLog.indexOf("for (const evento", reconciliationStart);
    const reconciliationQuery = eventLog.slice(reconciliationStart, reconciliationEnd);
    assert.ok(reconciliationStart >= 0 && reconciliationEnd > reconciliationStart);
    assert.doesNotMatch(reconciliationQuery, /SMOKE_TEST|recordSource/);
    assert.match(reconciliationQuery, /\.gt\("sequenceNumber", 0\)/);

    // Keep neutral TPV origin and ledger integrity metadata; neither denotes
    // whether an operation or record is synthetic or real.
    assert.match(config, /SOURCE_TYPE: "TPV"/);
    assert.match(repository, /item\.transactionId/);
    assert.match(repository, /item\.hash/);
    assert.match(repository, /envelope\.siteId/);
});
