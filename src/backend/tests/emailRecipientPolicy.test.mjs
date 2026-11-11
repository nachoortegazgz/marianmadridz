import test from "node:test";
import assert from "node:assert/strict";
import {
  isAllowedEmailRecipient,
  areAllowedEmailRecipients,
} from "backend/emailRecipientPolicy";

test("EMAIL-QA-01 accepts only exact marianmadrid.es mailboxes and the authorized Gmail address", () => {
  assert.equal(isAllowedEmailRecipient("qa@marianmadrid.es"), true);
  assert.equal(isAllowedEmailRecipient("nacho+test@marianmadrid.es"), true);
  assert.equal(isAllowedEmailRecipient("NACHOORTEGAZGZ@GMAIL.COM"), true);
  assert.equal(isAllowedEmailRecipient("nachoortegazgz@gmail.com"), true);
});

test("EMAIL-QA-02 rejects external domains and domain lookalikes", () => {
  for (const email of [
    "other@gmail.com",
    "qa@marianmadrid.com",
    "qa@marianmadrid.es.evil.test",
    "qa@mail.marianmadrid.es",
    "qa@evilmarianmadrid.es",
  ]) assert.equal(isAllowedEmailRecipient(email), false, email);
});

test("EMAIL-QA-03 rejects malformed, decorated and header-injection recipient values", () => {
  for (const email of [
    "",
    " qa@marianmadrid.es",
    "qa@marianmadrid.es ",
    "QA Name <qa@marianmadrid.es>",
    "qa@marianmadrid.es,other@example.com",
    "qa@marianmadrid.es\r\nBcc:other@example.com",
    null,
    42,
  ]) assert.equal(isAllowedEmailRecipient(email), false, String(email));
});

test("EMAIL-QA-04 validates every recipient and rejects empty or mixed recipient lists", () => {
  assert.equal(areAllowedEmailRecipients("qa@marianmadrid.es"), true);
  assert.equal(areAllowedEmailRecipients([
    "qa@marianmadrid.es",
    "nachoortegazgz@gmail.com",
  ]), true);
  assert.equal(areAllowedEmailRecipients([
    "qa@marianmadrid.es",
    "other@example.com",
  ]), false);
  assert.equal(areAllowedEmailRecipients([]), false);
});

test("EMAIL-QA-05 central Resend dispatch validates recipients before reading secrets or calling provider", async () => {
  const { readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(here, "..", "fiscalDocuments.web.js"), "utf8");
  const start = source.indexOf("async function _dispatchEmailViaResend({");
  const end = source.indexOf("\n}", start);
  assert.notEqual(start, -1);
  assert.ok(end > start);
  const dispatch = source.slice(start, end);
  const allowlist = dispatch.indexOf("areAllowedEmailRecipients(to)");
  assert.notEqual(allowlist, -1);
  assert.ok(allowlist < dispatch.indexOf("_getResendApiKey()"));
  assert.ok(allowlist < dispatch.indexOf("wixFetch(RESEND_ENDPOINT"));
  assert.ok(dispatch.includes("EMAIL_RECIPIENT_NOT_ALLOWED"));
});
