import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createWidgetBridge, PROTOCOL_UI, MESSAGE_TYPES } from "../../public/widgetBridge.js";
import { _executeWithRetry } from "../../public/mmUtils.js";

const calendarUrl = new URL("../../pages/Calendario%20de%20reservas%202.q39h6.js", import.meta.url);
const serviceUrl = new URL("../../pages/Pagina%20de%20servicio%202.xnfr4.js", import.meta.url);
const calendarSource = await readFile(calendarUrl, "utf8");
const serviceSource = await readFile(serviceUrl, "utf8");
const bridgeSource = await readFile(new URL("../../public/widgetBridge.js", import.meta.url), "utf8");

test("BOOK-FLOW-CONTRACT-01 protocol exposes expanded time windows and exactly three context attempts", () => {
  assert.equal(PROTOCOL_UI.HANDSHAKE_TIMEOUT_MS, 30000);
  assert.equal(PROTOCOL_UI.CONTEXT_TIMEOUT_MS, 120000);
  assert.equal(PROTOCOL_UI.CONTEXT_ATTEMPT_TIMEOUT_MS, 30000);
  assert.equal(PROTOCOL_UI.CONTEXT_ATTEMPTS, 3);
  assert.equal(PROTOCOL_UI.RETRY_BASE_DELAY_MS, 500);
  assert.equal(PROTOCOL_UI.RETRY_MAX_DELAY_MS, 4000);
});

test("BOOK-FLOW-RETRY-01 shared retry helper performs three total attempts with exponential backoff enabled", async () => {
  let attempts = 0;
  const result = await _executeWithRetry(async () => {
    attempts += 1;
    if (attempts < 3) {
      const error = new Error("transient");
      error.code = "TEMPORARY_FAILURE";
      throw error;
    }
    return "ok";
  }, 2, 1, () => true);

  assert.equal(result, "ok");
  assert.equal(attempts, 3);
});

test("BOOK-FLOW-BRIDGE-01 failed context is retried and correlated MM_CONTEXT is delivered", async () => {
  const listeners = [];
  const sent = [];
  let attempts = 0;
  let resolveContext;
  let rejectContext;
  const contextReceived = new Promise((resolve, reject) => {
    resolveContext = resolve;
    rejectContext = reject;
  });
  const watchdog = setTimeout(() => rejectContext(new Error("context response timed out")), 5000);
  const widget = {
    onMessage(handler) {
      listeners.push(handler);
      return () => {};
    },
    postMessage(message) {
      sent.push(message);
      if (message.type === MESSAGE_TYPES.CONTEXT) resolveContext(message);
    },
  };

  const bridge = createWidgetBridge(widget, {
    allowOpaqueOrigin: true,
    handshakeTimeoutMs: 4000,
    contextTimeoutMs: 4500,
    contextAttemptTimeoutMs: 1000,
    onContextReady: async () => {
      attempts += 1;
      if (attempts < 3) {
        const error = new Error("temporary context failure");
        error.code = "TEMPORARY_FAILURE";
        throw error;
      }
      return { serviceId: "service-guid", title: "Servicio QA" };
    },
    onError: () => {},
  });

  try {
    assert.equal(listeners.length, 1, "bridge listener must be installed synchronously");
    listeners[0]({
      origin: "null",
      data: {
        type: MESSAGE_TYPES.READY,
        version: 1,
        messageId: "ready-flow-001",
        payload: {},
      },
    });

    const response = await contextReceived;
    assert.equal(attempts, 3);
    assert.equal(response.type, MESSAGE_TYPES.CONTEXT);
    assert.equal(response.messageId, "ready-flow-001");
    assert.equal(response.payload.serviceId, "service-guid");
    assert.equal(response.payload.title, "Servicio QA");
    assert.equal(sent.filter((message) => message.type === MESSAGE_TYPES.CONTEXT).length, 1);
  } finally {
    clearTimeout(watchdog);
    bridge.destroy();
  }
});

test("BOOK-FLOW-SERVICE-01 installs the service-page bridge before asynchronous URL/CMS lookup", () => {
  const readyIndex = serviceSource.indexOf("$w.onReady(async () => {");
  const bridgeIndex = serviceSource.indexOf("bridge = createWidgetBridge(", readyIndex);
  const lookupIndex = serviceSource.indexOf("lookupValue = await resolveServiceLookup();", bridgeIndex);
  const loadIndex = serviceSource.indexOf("resolvedService = await loadService(lookupValue, traceId);", bridgeIndex);

  assert.ok(readyIndex >= 0);
  assert.ok(bridgeIndex > readyIndex);
  assert.ok(lookupIndex > bridgeIndex, "URL lookup must run only after the bridge listener is installed");
  assert.ok(loadIndex > lookupIndex, "CMS service load must follow URL resolution");
  assert.match(serviceSource, /contextTimeoutMs:\s*120000/);
});

test("BOOK-FLOW-AVAIL-01 availability reads use three attempts while booking side effects are not blindly retried in the page", () => {
  assert.match(calendarSource, /runAvailabilityWithRetry/);
  assert.match(calendarSource, /AVAILABILITY_ATTEMPT_TIMEOUT_MS\s*=\s*45000/);
  assert.match(calendarSource, /_executeWithRetry\(async \(\) =>/);
  assert.match(calendarSource, /}, 2, 500, isRetryableReadError\)/);
  assert.match(calendarSource, /contextTimeoutMs:\s*120000/);
  assert.match(calendarSource, /processDualBooking\(requestPayload\)/);
  assert.doesNotMatch(calendarSource.slice(calendarSource.indexOf("async function runAvailabilityWithRetry"), calendarSource.indexOf("function resultError")), /processDualBooking/);
  assert.match(bridgeSource, /PROTOCOL_UI\.CONTEXT_ATTEMPTS/);
});
