import test from "node:test";
import assert from "node:assert/strict";
import { _roundMoney } from "public/mmUtils";

test("MONEY-01 rounds finite numeric amounts using the canonical currency precision", () => {
    assert.equal(_roundMoney(12.345), 12.35);
    assert.equal(_roundMoney("12.34"), 12.34);
    assert.equal(_roundMoney(-12.345), -12.34);
    assert.equal(_roundMoney(12), 12);
});

test("MONEY-02 rejects invalid values instead of silently converting them to zero", () => {
    for (const value of [
        null,
        undefined,
        "",
        "   ",
        "not-a-number",
        NaN,
        Infinity,
        -Infinity,
        true,
        false,
        {},
        [],
    ]) {
        assert.throws(
            () => _roundMoney(value),
            { code: "INVALID_MONEY_AMOUNT" },
            "expected invalid amount to be rejected: " + String(value)
        );
    }
});
