import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { askMarianAI } from "backend/aiAgent.web";

const here = dirname(fileURLToPath(import.meta.url));
const agentSource = readFileSync(join(here, "..", "aiAgent.web.js"), "utf8");

test("AGENT-QA-01 an unconfigured external AI agent fails closed and preserves traceability", async () => {
  const traceId = "trace-agent-synthetic-001";
  const result = await askMarianAI({ traceId });

  assert.deepEqual(result, {
    status: "ERROR",
    data: null,
    error: {
      code: "AI_PROVIDER_NOT_CONFIGURED",
      message: "El proveedor de IA no esta configurado; la consulta no se ha procesado.",
      traceId,
    },
  });
});

test("AGENT-QA-02 the current AI agent contract does not fabricate provider output or invoke an unconfigured transport", () => {
  assert.match(agentSource, /AI_PROVIDER_NOT_CONFIGURED/);
  assert.match(agentSource, /data:\s*null/);
  assert.doesNotMatch(agentSource, /fetch\s*\(|wixFetch\s*\(|wix-fetch|Secrets\.getSecret|RESEND_ENDPOINT/);
});

test("AGENT-QA-03 malformed or absent trace identifiers do not turn provider absence into a success response", async () => {
  for (const traceId of [undefined, null, "", 0, { id: "forged" }]) {
    const result = await askMarianAI({ traceId });
    assert.equal(result.status, "ERROR");
    assert.equal(result.data, null);
    assert.equal(result.error.code, "AI_PROVIDER_NOT_CONFIGURED");
  }
});
