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
