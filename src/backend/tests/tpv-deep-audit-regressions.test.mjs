import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const repoRoot = new URL("../../../", import.meta.url);
const source = (path) => readFile(new URL(path, repoRoot), "utf8");

test("TPV audit export uses the backend ADMIN authorization guard", async () => {
    const movements = await source("src/backend/tpv/tpvMovimientos.web.js");
    const start = movements.indexOf("export const exportarAuditoriaTPV");
    assert.notEqual(start, -1);
    const handler = movements.slice(start);
    assert.match(handler, /await requireAdmin\(traceId\)/);
    assert.doesNotMatch(handler, /requireCajero/);
});

test("TPV ADMIN capabilities match the server authorization policy", async () => {
    const permissions = await source("src/backend/tpv/tpvPermisos.web.js");
    assert.match(permissions, /issueTicketZ: staff\.rolWebsite === "ADMIN"/);
    assert.match(permissions, /exportAudit: staff\.rolWebsite === "ADMIN"/);
});

test("cash session state read returns normalized errors with trace correlation", async () => {
    const caja = await source("src/backend/tpv/tpvCaja.web.js");
    const start = caja.indexOf("export const obtenerEstadoCaja");
    const end = caja.indexOf("export const abrirSesionCaja", start);
    assert.ok(start >= 0 && end > start);
    const handler = caja.slice(start, end);
    assert.match(handler, /try\s*\{/);
    assert.match(handler, /normalizeTpvError\(error, "TPV_SESSION_READ_FAILED"\)/);
    assert.match(handler, /traceId,/);
});

test("Bookings payment idempotency reads the canonical root orderId with legacy fallback", async () => {
    const citas = await source("src/backend/citasManager.web.js");
    assert.ok(
        citas.split('cita?.[FIELD_ORDER_ID] || meta.orderId || ""').length - 1 >= 3
    );
});

test("refund webhook processed markers use the event types checked by their handlers", async () => {
    const events = await source("src/backend/events.js");
    assert.match(events, /markEventAsProcessed\(eventId, "ORDER_PAYMENT_STATUS_UPDATED", traceId, \{ orderId, refund: true \}\)/);
    assert.match(events, /markEventAsProcessed\(eventId, "ORDER_UPDATED", traceId, \{ orderId, refund: true \}\)/);
});

test("Madrid GMT offset regex matches numeric hour and minute groups", async () => {
    const fiscal = await source("src/backend/fiscalHashPayload.js");
    assert.match(fiscal, /\/GMT\(\[\+\-\]\)\(\\d\{2\}\):\?\(\\d\{2\}\)\//);
    assert.doesNotMatch(fiscal, /GMT\(\[\+\-\]\)\(\\\\d/);
});
