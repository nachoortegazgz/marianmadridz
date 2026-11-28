import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const repositoryUrl = new URL("../tpv/tpvRepository.js", import.meta.url);
const pageUrl = new URL("../tpv/tpvCaja.web.js", import.meta.url);

test("TPV bootstrap creates the canonical singleton through the backend DAL", async () => {
    const source = await readFile(repositoryUrl, "utf8");
    const start = source.indexOf("export async function initializeTpvCaja(");
    const end = source.indexOf("\nexport async function readTpvCajaSnapshot", start);
    assert.ok(start >= 0 && end > start, "bootstrap implementation exists");
    const block = source.slice(start, end);

    assert.match(block, /withCajaActualProjectionLock\(/);
    assert.match(block, /_id:\s*SINGLETONS\.CAJA_ACTUAL_ITEM_ID/);
    assert.match(block, /singletonKey:\s*SINGLETONS\.CAJA_PRINCIPAL/);
    assert.match(block, /cashRegisterStatus:\s*"CERRADA"/);
    assert.match(block, /snapshotSource:\s*TPV_RUNTIME_POLICY\.CASH_REGISTER_SOURCE/);
    assert.match(block, /sequenceCounters:\s*\{\}/);
    assert.match(block, /await insertItem\(BUSINESS_COLLECTIONS\.CAJA_ACTUAL, bootstrap\)/);
    assert.match(block, /const saved = await _getCajaActual\(\)/);
    assert.match(block, /assertTpvCajaIntegrity\(saved, \{ allowBootstrap: true \}\)/);
    assert.doesNotMatch(block, /saveItem\(/);
});

test("TPV bootstrap receives the trace identifier from its authorized WebMethod", async () => {
    const source = await readFile(pageUrl, "utf8");
    assert.match(source, /await requireAdmin\(traceId\)[\s\S]*?initializeTpvCaja\(traceId\)/);
});

test("only an ADMIN read initializes a missing CajaActual singleton", async () => {
    const source = await readFile(pageUrl, "utf8");
    assert.match(source, /operator\.rolWebsite !== "ADMIN" \|\| code !== "TPV_CASH_REGISTER_NOT_PRESEEDED"/);
    assert.match(source, /await initializeTpvCaja\(traceId\);[\s\S]*?cajaActual = await readTpvCajaSnapshot\(\)/);
});
