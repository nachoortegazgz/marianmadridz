/*
=============================================================================
MODULE: backend/aeatHash.js
RESPONSIBILITY: Pure VERI*FACTU invoice-record hash contract (AEAT v0.1.2).
SCOPE: Hash input construction for RegistroAlta and RegistroAnulacion only.
IMPORTANT: This module is intentionally not wired to ledger writers. Writers
must be integrated only after their immutable source fields and XML contract
have been reconciled. Never recalculate historical hashes.
=============================================================================
*/

import { createHash } from "node:crypto";

export const AEAT_HASH_SPEC_VERSION = "0.1.2";

const ZERO_HASH = "0".repeat(64);
const HEX_64 = /^[0-9A-Fa-f]{64}$/;
const AMOUNT_PATTERN = /^-?\\d+(?:\\.\\d{1,2})?$/;

function _requiredText(value, fieldName) {
    if (value === null || value === undefined) {
        throw new TypeError("AEAT_HASH_FIELD_REQUIRED:" + fieldName);
    }
    const normalized = String(value).trim();
    if (!normalized) {
        throw new TypeError("AEAT_HASH_FIELD_REQUIRED:" + fieldName);
    }
    return normalized;
}

function _normalizeAmount(value, fieldName) {
    if (value === null || value === undefined || value === "") {
        throw new TypeError("AEAT_HASH_FIELD_REQUIRED:" + fieldName);
    }

    const raw = typeof value === "number"
        ? (Number.isFinite(value) ? value.toFixed(2) : "")
        : String(value).trim();

    if (!AMOUNT_PATTERN.test(raw)) {
        throw new TypeError("AEAT_HASH_AMOUNT_INVALID:" + fieldName);
    }

    // AEAT v0.1.2 treats 1 decimal and 2 decimals with a trailing zero as
    // equivalent lexical values (e.g. 123.1 and 123.10).
    return raw.replace(/(\\.\\d)0$/, "$1");
}

function _normalizePreviousHash(value, isFirstRecord) {
    if (typeof isFirstRecord !== "boolean") {
        throw new TypeError("AEAT_HASH_FIRST_RECORD_FLAG_REQUIRED");
    }

    const raw = value === null || value === undefined ? "" : String(value).trim();
    if (isFirstRecord) {
        if (raw && raw !== ZERO_HASH) {
            throw new TypeError("AEAT_HASH_FIRST_RECORD_MUST_NOT_HAVE_PREVIOUS_HASH");
        }
        return "";
    }

    if (!HEX_64.test(raw)) {
        throw new TypeError("AEAT_HASH_PREVIOUS_HASH_INVALID");
    }
    return raw.toUpperCase();
}

function _hash(input) {
    return createHash("sha256").update(input, "utf8").digest("hex").toUpperCase();
}

/**
 * Builds the exact AEAT v0.1.2 input string for RegistroAlta.
 * Field order and names follow the AEAT technical specification.
 */
export function buildAeatAltaHashInput({
    issuerTaxId,
    invoiceNumber,
    issueDate,
    invoiceType,
    totalTax,
    totalAmount,
    previousHash,
    isFirstRecord,
    generatedAt,
} = {}) {
    const huella = _normalizePreviousHash(previousHash, isFirstRecord);
    return [
        "IDEmisorFactura=" + _requiredText(issuerTaxId, "issuerTaxId"),
        "NumSerieFactura=" + _requiredText(invoiceNumber, "invoiceNumber"),
        "FechaExpedicionFactura=" + _requiredText(issueDate, "issueDate"),
        "TipoFactura=" + _requiredText(invoiceType, "invoiceType"),
        "CuotaTotal=" + _normalizeAmount(totalTax, "totalTax"),
        "ImporteTotal=" + _normalizeAmount(totalAmount, "totalAmount"),
        "Huella=" + huella,
        "FechaHoraHusoGenRegistro=" + _requiredText(generatedAt, "generatedAt"),
    ].join("&");
}

export function computeAeatAltaHash(fields) {
    return _hash(buildAeatAltaHashInput(fields));
}

/**
 * Builds the exact AEAT v0.1.2 input string for RegistroAnulacion.
 */
export function buildAeatAnulacionHashInput({
    issuerTaxId,
    canceledInvoiceNumber,
    canceledIssueDate,
    previousHash,
    isFirstRecord,
    generatedAt,
} = {}) {
    const huella = _normalizePreviousHash(previousHash, isFirstRecord);
    return [
        "IDEmisorFacturaAnulada=" + _requiredText(issuerTaxId, "issuerTaxId"),
        "NumSerieFacturaAnulada=" + _requiredText(canceledInvoiceNumber, "canceledInvoiceNumber"),
        "FechaExpedicionFacturaAnulada=" + _requiredText(canceledIssueDate, "canceledIssueDate"),
        "Huella=" + huella,
        "FechaHoraHusoGenRegistro=" + _requiredText(generatedAt, "generatedAt"),
    ].join("&");
}

export function computeAeatAnulacionHash(fields) {
    return _hash(buildAeatAnulacionHashInput(fields));
}
