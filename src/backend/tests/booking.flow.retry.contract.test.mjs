import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createWidgetBridge, PROTOCOL_UI, MESSAGE_TYPES } from "../../public/widgetBridge.js";
import { _executeWithRetry } from "../../public/mmUtils.js";

const calendarUrl = new URL("../../pages/Calendario%20de%20reservas%202.q39h6.js", import.meta.url);
const serviceUrl = new URL("../../pages/Pagina%20de%20servicio%202.xnfr4.js", import.meta.url);
const calendarSource = await readFile(calendarUrl, "utf8");
const sagaSource = await readFile(new URL("../booking/bookingSaga.js", import.meta.url), "utf8");
const availabilitySource = await readFile(new URL("../reservas.web.js", import.meta.url), "utf8");
const bookingUtilsSource = await readFile(new URL("../booking/bookingUtils.js", import.meta.url), "utf8");
const serviceSource = await readFile(serviceUrl, "utf8");
const bridgeSource = await readFile(new URL("../../public/widgetBridge.js", import.meta.url), "utf8");
const calendarWidgetSource = await readFile(new URL("../../../%23html1.txt", import.meta.url), "utf8");
const serviceWidgetSource = await readFile(new URL("../../../%23htmlWidgetCustomService.txt", import.meta.url), "utf8");

test("BOOK-FLOW-CONTRACT-01 protocol exposes expanded time windows and exactly three context attempts", () => {
  assert.equal(PROTOCOL_UI.HANDSHAKE_TIMEOUT_MS, 30000);
  assert.equal(PROTOCOL_UI.CONTEXT_TIMEOUT_MS, 120000);
  assert.equal(PROTOCOL_UI.CONTEXT_ATTEMPT_TIMEOUT_MS, 30000);
  assert.equal(PROTOCOL_UI.CONTEXT_ATTEMPTS, 3);
  assert.equal(PROTOCOL_UI.RETRY_BASE_DELAY_MS, 500);
  assert.equal(PROTOCOL_UI.RETRY_MAX_DELAY_MS, 4000);
});


test("BOOK-FLOW-WIDGET-BRAND-01 both widgets share the approved image, typography and protocol", () => {
  const sharedImage = "https://static.wixstatic.com/media/ab7708_588ab0ed2d7f42f4a63edb9e9c76da1c~mv2.jpg";
  for (const source of [calendarWidgetSource, serviceWidgetSource]) {
    assert.ok(source.includes(sharedImage));
    assert.match(source, /Libre\+Baskerville|Libre Baskerville/);
    assert.match(source, /Brandon Grotesque/);
  }
  for (const type of ["MM_READY", "MM_CONTEXT", "MM_AVAIL", "MM_BOOK", "MM_NAV"]) {
    assert.ok(calendarWidgetSource.includes(type), `calendar widget missing protocol message: ${type}`);
  }
  for (const type of ["MM_READY", "MM_CONTEXT", "MM_AVAIL", "MM_SELECT", "MM_BOOK", "MM_NAV"]) {
    assert.ok(serviceWidgetSource.includes(type), `service widget missing protocol message: ${type}`);
  }
});
test("BOOK-FLOW-TIMING-01 module deadlines fit the configured widget watchdogs", () => {
  assert.match(calendarWidgetSource, /contextTimeoutMs:120000/);
  assert.match(calendarWidgetSource, /bookingTimeoutMs:150000/);
  assert.match(serviceWidgetSource, /CONTEXT_TIMEOUT_MS:\s*155000/);
  assert.match(serviceWidgetSource, /BOOK_NOTICE_TIMEOUT_MS:\s*60000/);
  assert.match(calendarSource, /contextTimeoutMs:\s*110000/);
  assert.match(calendarSource, /contextAttemptTimeoutMs:\s*30000/);
  assert.match(serviceSource, /handshakeTimeoutMs:\s*45000/);
  assert.match(serviceSource, /contextTimeoutMs:\s*120000/);
  assert.match(serviceSource, /contextAttemptTimeoutMs:\s*30000/);
  assert.match(calendarSource, /processDualBooking\(requestPayload\)[\s\S]{0,100}120000/);
  assert.match(calendarWidgetSource, /bookingTimeoutMs:150000/);
});

test("BOOK-FLOW-IDEMPOTENCY-02 completed replay is checked before staff availability", () => {
  const replayIndex = sagaSource.indexOf("_inspectTransactionReplay(candidatePairToken, payloadHash)");
  const staffIndex = sagaSource.indexOf("_resolveStaffForSlotInternal({");
  assert.ok(replayIndex > 0 && staffIndex > replayIndex, "completed replay must bypass current staff availability");
  assert.match(sagaSource, /transactionStarted && pairToken/);
});

test("BOOK-FLOW-FAIL-CLOSED-01 confirmation requires matching staff, confirmed status and complete persistence", () => {
  assert.match(sagaSource, /_assertBookingResourceMatches\(bookingF1, "F1", finalResourceId/);
  assert.match(sagaSource, /_assertBookingResourceMatches\(bookingF2, "F2", finalResourceId/);
  assert.match(sagaSource, /confirmedStatus !== BOOKING_STATUS_CONFIRMED/);
  assert.match(sagaSource, /CITA_PERSIST_FAILED/);
  assert.match(sagaSource, /BOOKING_RECONCILIATION_PENDING/);
  assert.match(calendarSource, /validateBookingResultForConfirmation/);
  assert.match(calendarSource, /CHECKOUT_ASSOCIATION_FAILED/);
  assert.match(calendarSource, /BOOKING_NOT_CONFIRMED/);
});

test("BOOK-FLOW-STAFF-BALANCE-01 dual phases use the common available staff pool and one selected resource", () => {
  assert.match(availabilitySource, /candidateResourceIds = candidateResourceIds\.filter\(\(id\) => candidatesF2\.includes\(id\)\)/);
  assert.match(availabilitySource, /_pickLeastLoadedResource\(candidateResourceIds, dateYMD, traceId\)/);
  assert.match(availabilitySource, /STAFF-BALANCE-02: common staff assigned to requested phases/);
  assert.match(sagaSource, /_forceStaffInPristineSlot\([\s\S]{0,300}finalResourceId[\s\S]{0,150}linkedPhases/);
  assert.match(sagaSource, /selectedPaymentOption: BOOKING_PAYMENT_OPTION_OFFLINE/);
  assert.match(sagaSource, /bookingBodyF1\.selectedPaymentOption = isOnline/);
});

test("BOOK-FLOW-IDEMPOTENCY-01 pair fingerprint and payload hash exclude auto-balanced resourceId", () => {
  const fingerprintBlock = bookingUtilsSource.slice(
    bookingUtilsSource.indexOf("const EXPECTED_PAIR_FINGERPRINT_FIELDS"),
    bookingUtilsSource.indexOf("const DATE_YMD_LOCAL"),
  );
  assert.doesNotMatch(fingerprintBlock, /resourceId/);
  assert.match(fingerprintBlock, /customerKey/);
  const tokenBlock = sagaSource.slice(
    sagaSource.indexOf("function _resolveStablePairToken"),
    sagaSource.indexOf("function _resolveUnifiedPairToken"),
  );
  const unifiedTokenBlock = sagaSource.slice(
    sagaSource.indexOf("function _resolveUnifiedPairToken"),
    sagaSource.indexOf("// BLOCK 2 - META"),
  );
  assert.doesNotMatch(tokenBlock, /resourceId/);
  assert.match(unifiedTokenBlock, /customerKey/);
  const payloadHashBlock = sagaSource.slice(
    sagaSource.indexOf("const payloadHash"),
    sagaSource.indexOf("const txResult"),
  );
  assert.doesNotMatch(payloadHashBlock, /resourceId/);
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
  assert.match(calendarSource, /contextTimeoutMs:\s*110000/);
  assert.match(calendarSource, /contextAttemptTimeoutMs:\s*30000/);
  assert.match(calendarSource, /processDualBooking\(requestPayload\)/);
  assert.doesNotMatch(calendarSource.slice(calendarSource.indexOf("async function runAvailabilityWithRetry"), calendarSource.indexOf("function resultError")), /processDualBooking/);
  assert.match(bridgeSource, /PROTOCOL_UI\.CONTEXT_ATTEMPTS/);
});
