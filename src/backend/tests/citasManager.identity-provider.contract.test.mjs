import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mocks } from "./loader.mjs";
import { getBookingMemberProfile } from "backend/citasManager.web";

test("CITAS-IDENTITY-01 member provider outages are not reported as AUTH_REQUIRED", async () => {
    mocks.members._error = new Error("Members provider unavailable");
    try {
        await assert.rejects(getBookingMemberProfile(), {
            code: "MEMBER_IDENTITY_PROVIDER_UNAVAILABLE",
        });
    } finally {
        delete mocks.members._error;
        mocks.members._current = null;
    }
});

test("CITAS-IDENTITY-02 staff provider errors are not swallowed during admin ownership checks", async () => {
    const source = await readFile(new URL("../citasManager.web.js", import.meta.url), "utf8");
    const start = source.indexOf("async function _getStaffAccess(");
    const end = source.indexOf("function _validateProcessBookingPayload", start);
    assert.ok(start >= 0 && end > start);
    const staffLookup = source.slice(start, end);
    assert.doesNotMatch(staffLookup, /catch\s*\(/);

    const ownerStart = source.indexOf("async function _assertBookingOwner(");
    const ownerEnd = source.indexOf("// BOOKING LOOKUP", ownerStart);
    const ownership = source.slice(ownerStart, ownerEnd);
    assert.ok(ownership.indexOf("MEMBER_ID_MATCH") < ownership.indexOf("_getStaffAccess("));
});
