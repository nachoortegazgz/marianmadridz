import assert from "node:assert/strict";
import { test } from "node:test";
import { getSecretValue } from "backend/secretAccess";

test("getSecretValue returns the secret value from the official SDK response", async () => {
  const state = globalThis.__mmSecretsState || (globalThis.__mmSecretsState = { _map: {}, _default: "mock-secret" });
  state._map.MIGRATION_TEST_SECRET = "sdk-secret-value";
  assert.equal(await getSecretValue("MIGRATION_TEST_SECRET"), "sdk-secret-value");
  delete state._map.MIGRATION_TEST_SECRET;
});

test("getSecretValue rejects an empty name and returns the configured test default for unknown names", async () => {
  assert.equal(await getSecretValue(""), "");
  assert.equal(await getSecretValue("UNCONFIGURED_SECRET"), "mock-secret");
});
