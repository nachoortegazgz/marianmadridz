import test from "node:test";
import assert from "node:assert/strict";

const { createBookingError, normalizeError } = await import("backend/booking/bookingCore.js");
const { successResponse, errorResponse } = await import("backend/responseUtils.js");

test("booking failures use native Error and preserve code/details", () => {
    const details = { traceId: "trace-1", uncertainStep: "BOOKING_CREATE" };
    const error = createBookingError("BOOKING_CREATION_FAILED", "Booking failed", details);

    assert.ok(error instanceof Error);
    assert.equal(error.name, "Error");
    assert.equal(error.code, "BOOKING_CREATION_FAILED");
    assert.deepEqual(error.details, details);
    assert.equal("timestamp" in error, false);
});

test("normalizeError preserves native Error code and details", () => {
    const error = createBookingError("TRANSACTION_TIMEOUT", "Timed out", {
        uncertainStep: "BOOKING_CREATE",
    });
    const normalized = normalizeError(error);

    assert.equal(normalized.code, "TRANSACTION_TIMEOUT");
    assert.equal(normalized.message, "Timed out");
    assert.deepEqual(normalized.details, { uncertainStep: "BOOKING_CREATE" });
    assert.ok(normalized.stack);
});

test("response metadata clones objects and ignores primitive values", () => {
    const meta = { traceId: "trace-2", nested: { value: 1 } };
    const success = successResponse({ ok: true }, meta);
    const primitive = successResponse(null, "unused");

    assert.deepEqual(success.meta.traceId, "trace-2");
    assert.notEqual(success.meta.nested, meta.nested);
    assert.deepEqual(primitive.meta, { timestamp: primitive.meta.timestamp });
});

test("errorResponse accepts native Error without changing the public envelope", () => {
    const error = createBookingError("CHECKOUT_FAILED", "Checkout failed", {
        traceId: "trace-3",
    });
    const response = errorResponse(error);

    assert.equal(response.status, "ERROR");
    assert.equal(response.data, null);
    assert.deepEqual(response.error, {
        code: "CHECKOUT_FAILED",
        message: "Checkout failed",
    });
});

test("response error messages never stringify plain objects as [object Object]", () => {
    const response = errorResponse("INVALID_PROVIDER_ERROR", {
        detail: "not a message",
    });
    assert.equal(response.error.code, "INVALID_PROVIDER_ERROR");
    assert.equal(response.error.message, "Error interno");
    assert.notEqual(response.error.message, "[object Object]");
});


test("response metadata preserves useful fields and replaces circular references with a JSON-safe marker", () => {
    const shared = { value: 7 };
    const meta = {
        traceId: "trace-circular",
        first: shared,
        second: shared,
        createdAt: new Date("2026-11-28T00:00:00.000Z"),
    };
    meta.self = meta;
    meta.nested = { parent: meta };

    const response = successResponse({ ok: true }, meta);
    assert.equal(response.meta.traceId, "trace-circular");
    assert.equal(response.meta.self, "[Circular]");
    assert.equal(response.meta.nested.parent, "[Circular]");
    assert.deepEqual(response.meta.first, { value: 7 });
    assert.deepEqual(response.meta.second, { value: 7 });
    assert.equal(response.meta.createdAt, "2026-11-28T00:00:00.000Z");
    assert.doesNotThrow(() => JSON.stringify(response));
});
