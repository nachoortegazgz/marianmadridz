import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const calendar = readFileSync(resolve(process.cwd(), "#html1.txt"), "utf8");
const bridge = readFileSync(resolve(process.cwd(), "src/public/widgetBridge.js"), "utf8");

test("initial wildcard is restricted to the data-free READY message", () => {
  assert.ok(calendar.includes('type===MESSAGE_TYPES.READY?"*":""'));
  assert.ok(calendar.includes("event.source!==window.parent"));
  assert.ok(calendar.includes("state.connected=true;"));
  assert.ok(calendar.includes("clearTimeout(handshakeTimer);handshakeTimer=null;"));
  assert.ok(calendar.includes("if(state.bridgeId&&text(m.bridgeId)!==state.bridgeId)return"));
  assert.ok(!calendar.includes("allowAnyOriginFallback"));
});

test("bridge allowlist includes the canonical custom domain", () => {
  assert.ok(bridge.includes('".marianmadrid.es"'));
});

test("duplicate READY messages do not republish context", () => {
  assert.ok(bridge.includes("if (handshakeCompleted) return;"));
});
