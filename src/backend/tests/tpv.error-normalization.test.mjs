import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTpvError } from "backend/tpv/tpvError";
import { createActionableError } from "backend/errors/actionableError";

test("TPV errors never expose raw provider messages or secrets", () => {
    const error = new Error("Authorization: Bearer secret-token; customer email person@example.test");
    error.code = "WIX_PROVIDER_FAILURE";
    const normalized = normalizeTpvError(error, "TPV_OPERATION_FAILED");

    assert.equal(normalized.code, "WIX_PROVIDER_FAILURE");
    assert.equal(normalized.technicalDetail, "WIX_PROVIDER_FAILURE");
    assert.doesNotMatch(JSON.stringify(normalized), /secret-token|person@example\.test|Authorization/);
});

test("actionable TPV errors expose public guidance but not technical detail", () => {
    const error = createActionableError({
        code: "TPV_FISCAL_CONFIG_INVALID",
        userMessage: "No se puede completar la operación.",
        technicalDetail: "private key=super-secret",
        remediation: ["Revisar la configuración fiscal."],
        contextSnapshot: { traceId: "trace-safe" },
    });
    const normalized = normalizeTpvError(error);

    assert.equal(normalized.code, "TPV_FISCAL_CONFIG_INVALID");
    assert.equal(normalized.technicalDetail, "TPV_FISCAL_CONFIG_INVALID");
    assert.deepEqual(normalized.remediation, ["Revisar la configuración fiscal."]);
    assert.doesNotMatch(JSON.stringify(normalized), /super-secret|private key/);
});

test("untrusted error strings cannot become public error codes", () => {
    const normalized = normalizeTpvError("password=secret-value", "TPV_OPERATION_FAILED");
    assert.equal(normalized.code, "TPV_OPERATION_FAILED");
    assert.equal(normalized.technicalDetail, "TPV_OPERATION_FAILED");
    assert.doesNotMatch(JSON.stringify(normalized), /secret-value|password/);
});
