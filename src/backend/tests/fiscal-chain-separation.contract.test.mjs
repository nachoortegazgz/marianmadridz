import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");
const read = (path) => readFileSync(join(root, path), "utf8");

const cajas = read("src/backend/cajas.web.js");
const eventLog = read("src/backend/eventLog.js");
const data = read("src/backend/data.js");

test("FISCAL-CHAIN-01 both writers explicitly use the internal chain builder, not the AEAT hash contract", () => {
  assert.match(cajas, /function _buildInternalFiscalChainPayload\(/);
  assert.match(eventLog, /function _buildInternalFiscalChainPayload\(/);
  assert.match(cajas, /hashChain\(previousRecordHash, fiscalChainPayload\)/);
  assert.match(eventLog, /hashChain\(previousRecordHash, fiscalChainPayload\)/);
  assert.doesNotMatch(cajas, /function _buildAEATPayload|computeAeatAltaHash|buildAeatAltaHashInput/);
  assert.doesNotMatch(eventLog, /function _buildAEATPayload|computeAeatAltaHash|buildAeatAltaHashInput/);
});

test("FISCAL-CHAIN-02 preserve the existing persisted aeatPayload field mapping", () => {
  assert.match(cajas, /aeatPayload:\s*fiscalChainPayload/);
  assert.match(data, /nestedFields\.aeatPayload\s*=\s*item\.aeatPayload/);
  assert.match(data, /delete item\.aeatPayload/);
});

test("FISCAL-CHAIN-03 official AEAT hash helper remains isolated until writer-field reconciliation", () => {
  assert.doesNotMatch(cajas, /from ["\']backend\/aeatHash["\']/);
  assert.doesNotMatch(eventLog, /from ["\']backend\/aeatHash["\']/);
});
