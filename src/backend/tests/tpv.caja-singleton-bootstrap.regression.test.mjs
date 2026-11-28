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

test("CASHIER_STATE is read-only and never bootstraps CajaActual", async () => {
    const source = await readFile(pageUrl, "utf8");
    const start = source.indexOf("export const obtenerEstadoCaja = webMethod(");
    const end = source.indexOf("\nexport const abrirSesionCaja = webMethod(", start);
    assert.ok(start >= 0 && end > start);
    const reader = source.slice(start, end);
    assert.ok(reader.includes("await readTpvCajaSnapshot()"));
    assert.match(reader, /projectionStatus: "NOT_INITIALIZED"/);
    assert.ok(!reader.includes("initializeTpvCaja("));
});

test("SESSION_OPEN explicitly bootstraps CajaActual before acquiring the session lock", async () => {
    const source = await readFile(pageUrl, "utf8");
    const start = source.indexOf("export const abrirSesionCaja = webMethod(");
    const end = source.indexOf("\nexport const registrarArqueoParcial = webMethod(", start);
    assert.ok(start >= 0 && end > start);
    const writer = source.slice(start, end);
    assert.ok(writer.indexOf("await initializeTpvCaja(traceId);") < writer.indexOf("withTpvSessionLock("));
});
