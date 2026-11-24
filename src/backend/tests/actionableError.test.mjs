import test from "node:test";
import assert from "node:assert/strict";
import {
    createActionableError,
    isActionableError,
    toPublicShape,
} from "../errors/actionableError.js";

test("createActionableError validates required fields and exposes safe public shape", () => {
    const error = createActionableError({
        code: "LEDGER_APPEND_ONLY",
        userMessage: "Los ledgers no se modifican.",
        technicalDetail: "Internal collection details",
        remediation: ["Registrar un asiento rectificativo."],
        contextSnapshot: { collection: "MovimientosCaja", nif: "12345678Z" },
        retryable: false,
    });
    assert.equal(isActionableError(error), true);
    assert.deepEqual(toPublicShape(error), {
        code: "LEDGER_APPEND_ONLY",
        userMessage: "Los ledgers no se modifican.",
        remediation: ["Registrar un asiento rectificativo."],
    });
    assert.equal(error.contextSnapshot.nif, "[REDACTED]");
    assert.equal("technicalDetail" in toPublicShape(error), false);
});

test("createActionableError rejects missing contract fields", () => {
    assert.throws(() => createActionableError({ userMessage: "x", remediation: ["y"] }), /ACTIONABLE_ERROR_CODE_REQUIRED/);
    assert.throws(() => createActionableError({ code: "X", userMessage: "x".repeat(121), remediation: ["y"] }), /ACTIONABLE_ERROR_USER_MESSAGE_INVALID/);
    assert.throws(() => createActionableError({ code: "X", userMessage: "x", remediation: [] }), /ACTIONABLE_ERROR_REMEDIATION_REQUIRED/);
});

test("isActionableError rejects ordinary errors", () => {
    assert.equal(isActionableError(new Error("ordinary")), false);
    assert.equal(toPublicShape(new Error("ordinary")), null);
});
