import test from "node:test";
import assert from "node:assert/strict";
import {
    assertInsertAllowed,
    assertUpdateAllowed,
    assertRemoveAllowed,
} from "backend/dataAccessPolicy";
import {
    BUSINESS_COLLECTIONS,
    DATA_ACCESS_WRITE_POLICY,
} from "backend/internalConfig";
import { readFileSync } from "node:fs";

const collection = BUSINESS_COLLECTIONS.REGISTRO_INTEGRACION;
const event = () => ({
    _id: "12345678-1234-8123-8123-123456789012",
    eventId: "a".repeat(64),
    eventType: "C3_PACKAGE_PREPARED",
    sourceModule: "C3_EXPORT",
    sourceCollection: "WIX_CMS",
    sourceItemId: "artifact-1",
    occurredAt: new Date("2026-11-28T10:00:00.000Z"),
    traceId: "trace-c3-test",
    correlationId: "artifact-1",
    idempotencyKey: "C3_PACKAGE_PREPARED:artifact-1",
    schemaVersion: "1",
    payload: {
        exportId: "MM-C3-ACCOUNTING-2026-Q4-V1",
        artifactId: "artifact-1",
        fileName: "MM-C3-ACCOUNTING-2026-Q4-V1-artifact-1.json",
        contentChecksum: "b".repeat(64),
        year: 2026,
        quarter: 4,
        recordCount: 0,
        dataClassification: "SYNTHETIC_TEST",
        artifactPurpose: "ACCOUNTING_REVIEW_DRAFT",
        legalUseStatus: "INTERNAL_DRAFT_ONLY",
        reconciliationStatus: "SOURCE_RECONCILIATION_REQUIRED",
    },
    payloadHash: "c".repeat(64),
    deliveryStatus: "PENDING",
    deliveryAttempts: 0,
});

test("C3 outbox accepts a schema-aligned metadata-only append event", () => {
    assert.equal(DATA_ACCESS_WRITE_POLICY.insertCollections.includes(collection), true);
    assert.doesNotThrow(() => assertInsertAllowed(collection, event()));
});

test("C3 outbox rejects PII and unknown payload fields", () => {
    const pii = event();
    pii.payload.customer = "Test Customer";
    assert.throws(() => assertInsertAllowed(collection, pii), {
        code: "CMS_INSERT_INTEGRATION_EVENT_PII_PROHIBITED",
    });

    const unknown = event();
    unknown.payload.rawInvoice = "full invoice body";
    assert.throws(() => assertInsertAllowed(collection, unknown), {
        code: "CMS_INSERT_INTEGRATION_EVENT_PAYLOAD_INVALID",
    });
});

test("C3 outbox validates hashes, status, schema version and attempt count", () => {
    for (const [field, value] of [
        ["eventId", "not-a-hash"],
        ["payloadHash", "bad"],
        ["deliveryStatus", "SENT_MAYBE"],
        ["schemaVersion", 1],
        ["deliveryAttempts", -1],
    ]) {
        const candidate = event();
        candidate[field] = value;
        assert.throws(() => assertInsertAllowed(collection, candidate), undefined, field);
    }
});

test("C3 outbox is append-only at the data access policy boundary", () => {
    assert.equal(DATA_ACCESS_WRITE_POLICY.updateCollections.includes(collection), false);
    assert.equal(DATA_ACCESS_WRITE_POLICY.removeCollections.includes(collection), false);
    assert.throws(() => assertUpdateAllowed(collection, event()), {
        code: "LEDGER_APPEND_ONLY",
    });
    assert.throws(() => assertRemoveAllowed(collection, event()._id), {
        code: "LEDGER_APPEND_ONLY",
    });
});

test("C3 outbox uses deterministic IDs and verifies duplicate payload hashes", () => {
    const source = readFileSync(new URL("../exports/integrationOutbox.js", import.meta.url), "utf8");
    assert.match(source, /uuidV8FromHash\(eventId\)/);
    assert.match(source, /getItem\(COLLECTION, item\._id, CONSISTENCY\.STRONG\)/);
    assert.match(source, /existing\.payloadHash !== payloadHash/);
    assert.match(source, /insertItem\(COLLECTION, item\)/);
});

test("C3 export preparation persists the outbox and delivery is verified separately", () => {
    const source = readFileSync(new URL("../exports/exportService.web.js", import.meta.url), "utf8");
    assert.match(source, /appendC3PreparedEvent/);
    assert.match(source, /PENDING_CONFIGURATION/);
    assert.match(source, /no se ha enviado ningún archivo/i);
    assert.doesNotMatch(source, /Sites\.ReadWrite\.All|SharePoint.*upload/i);
});
