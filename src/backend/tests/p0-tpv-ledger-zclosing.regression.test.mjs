import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const backend = resolve(here, "..");

async function source(name) {
    return readFile(resolve(backend, name), "utf8");
}

function section(code, startToken, endToken) {
    const start = code.indexOf(startToken);
    assert.ok(start >= 0, `missing section: ${startToken}`);
    const end = endToken ? code.indexOf(endToken, start + startToken.length) : code.length;
    assert.ok(end >= 0, `missing section end: ${endToken}`);
    return code.slice(start, end);
}

test("P0-LEDGER-01 fiscal readers exclude the independent TPV movement chain", async () => {
    const [cajas, eventLog, aggregator] = await Promise.all([
        source("cajas.web.js"),
        source("eventLog.js"),
        source("fiscalAggregator.web.js"),
    ]);

    const fiscalReaders = [
        section(cajas, "async function _getLastMovement()", "async function _assertPeriodNotClosed"),
        section(cajas, "async function _countMovementsOfDay(diaKey)", "async function _registerZClosing"),
        section(cajas, "async function _registerZClosing", "export const registerZClosing"),
        section(cajas, "export async function verifyFiscalHashChainIntegrity", "\nexport "),
        section(eventLog, "async function _getLastCashEvent()", "// ============================================================================\n// SECCION 3"),
        section(eventLog, "const pending = await dalQuery(MOVIMIENTOS_CAJA_COL)", "for (const evento of (pending.items || []))"),
        section(aggregator, "async function _fetchQuarterMovements(months, options = {})", "function _getFiscalFetchLimitError"),
    ];

    for (const reader of fiscalReaders) {
        assert.match(reader, /\.ne\("recordSource", TPV_LEDGER_SOURCE\)/);
    }
    assert.match(cajas, /TPV_LEDGER_SOURCE,/);
    assert.match(eventLog, /TPV_LEDGER_SOURCE,/);
    assert.match(aggregator, /TPV_LEDGER_SOURCE,/);
});

test("P0-LEDGER-02 opening a TPV session preserves fiscal sequence and idempotency counters", async () => {
    const repository = await source("tpv/tpvRepository.js");
    const openProjection = section(
        repository,
        "function _sessionCajaPatch(caja, record, eventHash)",
        "async function findByIdempotencyKey"
    );

    assert.match(openProjection, /const existingSequenceCounters = caja\.sequenceCounters == null \? \{\} : caja\.sequenceCounters/);
    assert.match(openProjection, /sequenceCounters: \{ \.\.\.existingSequenceCounters \}/);
    assert.doesNotMatch(openProjection, /sequenceCounters: \{\s*\}/);
    assert.match(openProjection, /TPV_SHARED_SEQUENCE_COUNTERS_INVALID/);
});

test("P0-Z-01 nightly Z job is observational and never fabricates a system closer", async () => {
    const cron = await source("crons.js");
    const nightly = section(
        cron,
        "export async function verifyNightlyZClosing()",
        "// =============================================================================\n// CRON: cleanExpiredBookingControl"
    );

    assert.doesNotMatch(nightly, /registerZClosingInternal/);
    assert.match(nightly, /NIGHTLY_Z_CLOSING_MANUAL_REQUIRED/);
    assert.match(nightly, /recordDomain/);
});

test("P0-Z-02 public Z close does not trust recordDomain supplied by the browser", async () => {
    const cajas = await source("cajas.web.js");
    const zClose = section(cajas, "async function _registerZClosing", "export const registerZClosing");

    assert.match(zClose, /const recordDomain = authorizeCashier \? "" : _safeTrim\(options\?\.recordDomain\)/);
    assert.match(zClose, /Z_CLOSING_REQUIRED_FIELDS_UNRESOLVED/);
});
