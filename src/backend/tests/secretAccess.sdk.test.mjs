import assert from "node:assert/strict";
import { test } from "node:test";
import { getSecretValue } from "backend/secretAccess";

test("getSecretValue returns the exact non-empty secret value from the official SDK response", async () => {
  const state = globalThis.__mmSecretsState || (globalThis.__mmSecretsState = { _map: {}, _default: "mock-secret" });
  state._map.MIGRATION_TEST_SECRET = "sdk-secret-value";
  assert.equal(await getSecretValue("MIGRATION_TEST_SECRET"), "sdk-secret-value");
  delete state._map.MIGRATION_TEST_SECRET;
});

test("getSecretValue rejects empty or non-string secret names", async () => {
  await assert.rejects(getSecretValue(""), { code: "SECRET_NAME_REQUIRED" });
  await assert.rejects(getSecretValue("   "), { code: "SECRET_NAME_REQUIRED" });
  await assert.rejects(getSecretValue(null), { code: "SECRET_NAME_REQUIRED" });
});

test("getSecretValue propagates provider errors instead of returning an empty string", async () => {
  const state = globalThis.__mmSecretsState;
  state._error = Object.assign(new Error("Secrets provider unavailable"), { code: "PROVIDER_DOWN" });
  try {
    await assert.rejects(getSecretValue("FISCAL_NIF_EMISOR"), {
      code: "SECRET_PROVIDER_ERROR",
      providerCode: "PROVIDER_DOWN",
    });
  } finally {
    delete state._error;
  }
});

test("getSecretValue rejects malformed and empty SDK responses", async () => {
  const state = globalThis.__mmSecretsState;
  state._map.MALFORMED_SECRET = null;
  state._map.EMPTY_SECRET = "";
  try {
    await assert.rejects(getSecretValue("MALFORMED_SECRET"), {
      code: "SECRET_RESPONSE_INVALID",
    });
    await assert.rejects(getSecretValue("EMPTY_SECRET"), {
      code: "SECRET_VALUE_EMPTY",
    });
  } finally {
    delete state._map.MALFORMED_SECRET;
    delete state._map.EMPTY_SECRET;
  }
});

test("getSecretValue returns the configured test default for unregistered names", async () => {
  assert.equal(await getSecretValue("UNCONFIGURED_SECRET"), "mock-secret");
});
