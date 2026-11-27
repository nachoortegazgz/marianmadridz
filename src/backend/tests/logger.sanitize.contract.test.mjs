import test from "node:test";
import assert from "node:assert/strict";
import { logger } from "backend/logger";

test("LOGGER-SEC-01 redacts secrets and contact PII in messages, URLs, stacks and nested context", () => {
    const originalInfo = console.info;
    const originalError = console.error;
    const output = [];
    console.info = (line) => output.push(String(line));
    console.error = (line) => output.push(String(line));

    try {
        logger.info(
            "GET https://api.example.test/path?api_key=top-secret Bearer access-token user@example.com",
            {
                resendApiKey: "resend-secret",
                emailAddress: "person@example.com",
                mobilePhone: "+34600111222",
                nested: { client_secret: "client-secret" },
            },
            "trace-redaction"
        );

        const error = new Error("provider failed access_token=private-token");
        error.stack = "Error: provider failed?token=stack-secret at /home/private-user/app.js:1:1";
        logger.errorWithStack(error, {
            requestUrl: "https://api.example.test/?access_token=url-secret",
        }, "trace-error");
    } finally {
        console.info = originalInfo;
        console.error = originalError;
    }

    const joined = output.join("\n");
    for (const secret of [
        "top-secret", "access-token", "resend-secret", "client-secret",
        "private-token", "stack-secret", "url-secret",
        "user@example.com", "person@example.com", "+34600111222",
    ]) {
        assert.equal(joined.includes(secret), false, "log leaked " + secret);
    }
    assert.match(joined, /REDACTED_SECRET/);
    assert.match(joined, /REDACTED_EMAIL/);
    assert.match(joined, /REDACTED_PII/);
    assert.match(joined, /trace-redaction/);
    assert.match(joined, /trace-error/);
});
