import test from "node:test";
import assert from "node:assert/strict";

import {
    AEAT_HASH_SPEC_VERSION,
    buildAeatAltaHashInput,
    computeAeatAltaHash,
    buildAeatAnulacionHashInput,
    computeAeatAnulacionHash,
} from "backend/aeatHash.js";

test("AEAT-HASH-01 matches official v0.1.2 first RegistroAlta vector", () => {
    const fields = {
        issuerTaxId: "89890001K",
        invoiceNumber: "12345678/G33",
        issueDate: "01-01-2024",
        invoiceType: "F1",
        totalTax: "12.35",
        totalAmount: "123.45",
        previousHash: "",
        isFirstRecord: true,
        generatedAt: "2024-01-01T19:20:30+01:00",
    };

    assert.equal(AEAT_HASH_SPEC_VERSION, "0.1.2");
    assert.equal(
        buildAeatAltaHashInput(fields),
        "IDEmisorFactura=89890001K&NumSerieFactura=12345678/G33&FechaExpedicionFactura=01-01-2024&TipoFactura=F1&CuotaTotal=12.35&ImporteTotal=123.45&Huella=&FechaHoraHusoGenRegistro=2024-01-01T19:20:30+01:00"
    );
    assert.equal(
        computeAeatAltaHash(fields),
        "3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60"
    );
});

test("AEAT-HASH-02 matches official v0.1.2 chained RegistroAlta vector", () => {
    assert.equal(
        computeAeatAltaHash({
            issuerTaxId: "89890001K",
            invoiceNumber: "12345679/G34",
            issueDate: "01-01-2024",
            invoiceType: "F1",
            totalTax: "12.35",
            totalAmount: "123.45",
            previousHash: "3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60",
            isFirstRecord: false,
            generatedAt: "2024-01-01T19:20:35+01:00",
        }),
        "F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97"
    );
});

test("AEAT-HASH-03 matches official v0.1.2 RegistroAnulacion vector", () => {
    assert.equal(
        computeAeatAnulacionHash({
            issuerTaxId: "89890001K",
            canceledInvoiceNumber: "12345679/G34",
            canceledIssueDate: "01-01-2024",
            previousHash: "F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97",
            isFirstRecord: false,
            generatedAt: "2024-01-01T19:20:40+01:00",
        }),
        "177547C0D57AC74748561D054A9CEC14B4C4EA23D1BEFD6F2E69E3A388F90C68"
    );
});

test("AEAT-HASH-04 normalizes one/two decimal lexical equivalents and trims values", () => {
    const base = {
        issuerTaxId: " 89890001K ",
        invoiceNumber: "12345678/G33",
        issueDate: "01-01-2024",
        invoiceType: "F1",
        totalTax: "12.35",
        previousHash: "",
        isFirstRecord: true,
        generatedAt: "2024-01-01T19:20:30+01:00",
    };
    const oneDecimal = computeAeatAltaHash({ ...base, totalAmount: "123.1" });
    const twoDecimals = computeAeatAltaHash({ ...base, totalAmount: "123.10" });
    assert.equal(oneDecimal, twoDecimals);
});

test("AEAT-HASH-05 rejects missing fields, invalid amounts and invalid previous hashes", () => {
    assert.throws(() => buildAeatAltaHashInput({}), /AEAT_HASH_FIRST_RECORD_FLAG_REQUIRED/);
    assert.throws(() => buildAeatAltaHashInput({
        issuerTaxId: "89890001K",
        invoiceNumber: "1",
        issueDate: "01-01-2024",
        invoiceType: "F1",
        totalTax: "1,25",
        totalAmount: "2.00",
        previousHash: "",
        isFirstRecord: true,
        generatedAt: "2024-01-01T19:20:30+01:00",
    }), /AEAT_HASH_AMOUNT_INVALID/);
    assert.throws(() => buildAeatAltaHashInput({
        issuerTaxId: "89890001K",
        invoiceNumber: "1",
        issueDate: "01-01-2024",
        invoiceType: "F1",
        totalTax: "1.25",
        totalAmount: "2.00",
        previousHash: "",
        isFirstRecord: false,
        generatedAt: "2024-01-01T19:20:30+01:00",
    }), /AEAT_HASH_PREVIOUS_HASH_INVALID/);
});
