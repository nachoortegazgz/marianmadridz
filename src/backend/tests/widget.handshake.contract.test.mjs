import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const calendar = readFileSync(resolve(process.cwd(), "#html1.txt"), "utf8");
const bridge = readFileSync(resolve(process.cwd(), "src/public/widgetBridge.js"), "utf8");

test("widget postMessage uses an explicit parent origin and fails closed when unresolved", () => {
  assert.ok(calendar.includes('allowAnyOriginFallback:false'));
  assert.ok(calendar.includes('const target=parentOrigin||(CONFIG.allowAnyOriginFallback?"*":"")'));
  assert.ok(calendar.includes('if(!target)'));
  assert.ok(calendar.includes('window.parent.postMessage({version:CONFIG.version,type,messageId:makeMessageId(type.toLowerCase()),bridgeId:state.bridgeId,payload},target)'));
  assert.ok(calendar.includes("e.source!==window.parent"));
  assert.ok(calendar.includes("state.connected=true;"));
  assert.ok(calendar.includes("clearTimeout(handshakeTimer);"));
  assert.ok(calendar.includes("if(m.bridgeId)state.bridgeId=text(m.bridgeId);"));
  assert.ok(calendar.includes('target==="*"'));
});

test("bridge allowlist includes the canonical custom domain and member profile response", () => {
  assert.ok(bridge.includes('".marianmadrid.es"'));
  assert.ok(bridge.includes('PROFILE: "MM_PROFILE"'));
  assert.ok(calendar.includes('PROFILE: "MM_PROFILE"'));
  assert.ok(calendar.includes('m.type===MESSAGE_TYPES.PROFILE'));
});

test("duplicate READY messages do not republish context", () => {
  assert.ok(bridge.includes("if (handshakeCompleted) return;"));
});
