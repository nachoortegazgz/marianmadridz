import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sourceUrl = new URL("../../pages/Calendario%20de%20reservas%202.q39h6.js", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const onReadyIndex = source.indexOf("$w.onReady(() => {");
const bridgeIndex = source.indexOf("bridge = createWidgetBridge(widget", onReadyIndex);
const parseIndex = source.indexOf("const params = await parseUrlParams();", bridgeIndex);

test("calendar bridge listener is attached before asynchronous service lookup", () => {
    assert.ok(onReadyIndex >= 0, "calendar onReady handler must exist");
    assert.ok(bridgeIndex > onReadyIndex, "widget bridge must be initialized inside onReady");
    assert.ok(parseIndex > bridgeIndex, "URL parsing must happen only after bridge initialization");
});

test("calendar context resolves the explicit service identifier before publishing context", () => {
    assert.ok(source.includes("onContextReady: async () => {"));
    assert.ok(source.includes("serviceId: resolved.serviceId || params.serviceId || \"\""));
    assert.ok(source.includes("slug: resolved.slug || params.slug || \"\""));
    assert.ok(source.includes("return loadServiceContext(contextParams, traceId);"));
});

test("availability requests fail closed until the service context is ready", () => {
    assert.ok(source.includes("if (!currentServiceId || !currentService)"));
    assert.ok(source.includes('resultError("SERVICE_NOT_READY")'));
});
