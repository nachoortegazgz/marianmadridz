import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const inventorySource = readFileSync(new URL("../inventario.web.js", import.meta.url), "utf8");

test("inventory mutex release targets the canonical SLOT_LOCK in finally", () => {
  const releaseStart = inventorySource.indexOf("async function releaseInventoryVariantLock");
  const movementStart = inventorySource.indexOf("export async function recordInventoryMovementSafe");
  const replayStart = inventorySource.indexOf("export const replayInventoryReconciliation");
  assert.ok(releaseStart >= 0 && movementStart > releaseStart && replayStart > movementStart);

  const releaseSource = inventorySource.slice(releaseStart, movementStart);
  const movementSource = inventorySource.slice(movementStart, replayStart);

  assert.match(releaseSource, /\.eq\("_id", lockId\)/);
  assert.match(releaseSource, /current\?\.controlType === CONTROL_TYPE\.SLOT_LOCK && current\.traceId === traceId/);
  assert.match(movementSource, /finally\s*\{\s*await releaseInventoryVariantLock\(lock\._id, traceId\)/);
});
