import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("cash receipt lookup does not suppress rows based on environment markers", async () => {
  const source = await readFile(new URL("../cajas.web.js", import.meta.url), "utf8");
  const handlerStart = source.indexOf("export const getMovimientoByBooking");
  assert.notEqual(handlerStart, -1);
  const handler = source.slice(handlerStart, source.indexOf("\nexport ", handlerStart + 10) > -1
    ? source.indexOf("\nexport ", handlerStart + 10)
    : source.length);
  assert.doesNotMatch(handler, /isExplicitSimulationLedgerRecord|SIMULATED|SYNTHETIC|REAL/);
});
