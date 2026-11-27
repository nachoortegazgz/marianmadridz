import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("SECRET-FISCAL-01 issuer NIF cache is populated only after a successful secret read", async () => {
    const source = await readFile(new URL("../events.js", import.meta.url), "utf8");
    const start = source.indexOf("async function _getEmisorFiscal()");
    const end = source.indexOf("// EVENT STRUCTURE VALIDATION", start);
    assert.ok(start >= 0 && end > start);
    const body = source.slice(start, end);
    assert.match(body, /await getSecretValue\(SECRETS\.FISCAL_NIF_EMISOR\)/);
    assert.match(body, /nifEmisor:\s*normalizedNif/);
    assert.doesNotMatch(body, /catch\s*\(/);
    assert.doesNotMatch(body, /nifEmisor:\s*["']{2}/);
});

test("SECRET-TIMECLOCK-01 signature verification does not downgrade a missing key to an unverified result", async () => {
    const source = await readFile(new URL("../horario.web.js", import.meta.url), "utf8");
    const start = source.indexOf("async function _getTimeclockIntegrity");
    const end = source.indexOf("function _validateTimeclockSequence", start);
    assert.ok(start >= 0 && end > start);
    const body = source.slice(start, end);
    assert.match(body, /await getSecretValue\(SECRETS\.FISCAL_KEY\)/);
    assert.doesNotMatch(body, /if\s*\(!key\)/);
    assert.doesNotMatch(body, /allVerified:\s*false,[\s\S]{0,100}items\.length/);
});
