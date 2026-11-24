import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("booking page explains recoverable parameter and availability errors", async () => {
    const source = await readFile(
        new URL("../../pages/Calendario%20de%20reservas%202.q39h6.js", import.meta.url),
        "utf8"
    );
    for (const code of [
        "INVALID_PARAMS",
        "INVALID_DATES",
        "SERVICE_NOT_FOUND",
        "SLOT_UNAVAILABLE",
        "STAFF_UNAVAILABLE_DUAL",
        "F2_SLOT_REQUIRED",
        "DUAL_NOT_ALLOWED",
        "LOCATION_MISMATCH",
        "RATE_LIMITED",
        "CHECKOUT_FAILED",
        "BOOKING_CREATION_FAILED",
    ]) {
        assert.match(source, new RegExp('normalized === "' + code + '"'));
    }
    assert.match(source, /AAAA-MM-DD/);
    assert.match(source, /actualiza los horarios/i);
    assert.match(source, /no repitas la operación a ciegas/i);
});
