import { createHash } from "node:crypto";

export const C3_EXPORT_SCHEMA_VERSION = "1.0.0";
export const C3_EXPORT_TYPE = "ACCOUNTING_QUARTERLY";

function sha256(value) {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalize(value) {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])
        );
    }
    return value;
}

function canonicalJson(value) {
    return JSON.stringify(canonicalize(value));
}

function requiredString(value, code, maxLength = 256) {
    const normalized = String(value ?? "").trim();
    if (!normalized || normalized.length > maxLength) throw new Error(code);
    return normalized;
}

function isoDate(value, code) {
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error(code);
    return date.toISOString();
}

function dateOnly(value, code) {
    const normalized = requiredString(value, code, 10);
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(normalized)) throw new Error(code);
    const date = new Date(normalized + "T00:00:00.000Z");
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
        throw new Error(code);
    }
    return normalized;
}

function countValue(value, code) {
    const count = Number(value);
    if (!Number.isSafeInteger(count) || count < 0) throw new Error(code);
    return count;
}

function toMinorUnits(value, code) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) throw new Error(code);
    const minor = Math.round(amount * 100);
    if (!Number.isSafeInteger(minor) || Math.abs(amount * 100 - minor) > 0.000001) {
        throw new Error(code);
    }
    return minor;
}

function toBasisPoints(value) {
    const match = /^(\d{1,3}(?:\.\d{1,2})?)%$/.exec(String(value ?? "").trim());
    if (!match) throw new Error("C3_EXPORT_TAX_RATE_INVALID");
    const rate = Number(match[1]);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
        throw new Error("C3_EXPORT_TAX_RATE_INVALID");
    }
    return Math.round(rate * 100);
}

function quarterPeriod(year, quarter) {
    if (!Number.isInteger(year) || year < 2000 || year > 2100 ||
        !Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
        throw new Error("C3_EXPORT_PERIOD_INVALID");
    }
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = startMonth + 3;
    const dateKey = (y, m) => `${y}-${String(m).padStart(2, "0")}-01`;
    return {
        periodStart: dateKey(year, startMonth),
        periodEndExclusive: endMonth === 13 ? dateKey(year + 1, 1) : dateKey(year, endMonth),
    };
}

function normalizeRecord(row) {
    if (row?.recordNature !== "REAL") {
        throw new Error("C3_EXPORT_SOURCE_RECORD_NOT_REAL");
    }
    const recordHash = requiredString(row.hashCompleto, "C3_EXPORT_RECORD_HASH_MISSING", 64).toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(recordHash)) throw new Error("C3_EXPORT_RECORD_HASH_INVALID");

    return {
        invoiceNumber: requiredString(row.invoiceNumber, "C3_EXPORT_INVOICE_NUMBER_MISSING", 100),
        issueDate: dateOnly(row.fechaExpedicion, "C3_EXPORT_ISSUE_DATE_INVALID"),
        invoiceType: requiredString(row.tipoFactura, "C3_EXPORT_INVOICE_TYPE_MISSING", 40),
        movementType: requiredString(row.movementType, "C3_EXPORT_MOVEMENT_TYPE_MISSING", 40),
        operationNature: requiredString(row.operationNature, "C3_EXPORT_OPERATION_NATURE_MISSING", 40),
        taxTreatment: requiredString(row.taxTreatment, "C3_EXPORT_TAX_TREATMENT_MISSING", 60),
        paymentMethod: requiredString(row.paymentMethod, "C3_EXPORT_PAYMENT_METHOD_MISSING", 40),
        taxableAmountMinor: toMinorUnits(row.taxableAmount, "C3_EXPORT_TAXABLE_AMOUNT_INVALID"),
        taxRateBasisPoints: toBasisPoints(row.taxRate),
        taxAmountMinor: toMinorUnits(row.taxAmount, "C3_EXPORT_TAX_AMOUNT_INVALID"),
        totalAmountMinor: toMinorUnits(row.totalAmount, "C3_EXPORT_TOTAL_AMOUNT_INVALID"),
        correctionReference: row.referenciaRectificativa == null
            ? null
            : requiredString(row.referenciaRectificativa, "C3_EXPORT_CORRECTION_REFERENCE_INVALID", 100),
        recordTimestamp: isoDate(row.fechaHoraRegistro, "C3_EXPORT_RECORD_TIMESTAMP_INVALID"),
        recordHash,
        transactionReference: requiredString(row.transactionId, "C3_EXPORT_TRANSACTION_ID_MISSING", 160),
    };
}

function normalizeSummary(summary) {
    const counts = summary?.conteo || {};
    const totals = summary?.totales || {};
    const payment = summary?.desgloseFormaPago || {};
    const vatDraft = summary?.borradorIva || {};

    return {
        issuerTaxId: requiredString(summary?.nifEmisor, "C3_EXPORT_ISSUER_TAX_ID_MISSING", 32),
        operationCount: countValue(summary?.totalOperaciones, "C3_EXPORT_SUMMARY_COUNT_INVALID"),
        fiscalOperationCount: countValue(summary?.totalOperacionesFiscales, "C3_EXPORT_SUMMARY_COUNT_INVALID"),
        counts: {
            sales: countValue(counts.ventas ?? 0, "C3_EXPORT_SUMMARY_COUNT_INVALID"),
            refunds: countValue(counts.reembolsos ?? 0, "C3_EXPORT_SUMMARY_COUNT_INVALID"),
            tips: countValue(counts.propinas ?? 0, "C3_EXPORT_SUMMARY_COUNT_INVALID"),
            adjustments: countValue(counts.ajustes ?? 0, "C3_EXPORT_SUMMARY_COUNT_INVALID"),
        },
        totalsMinor: {
            grossSales: toMinorUnits(totals.totalVentasBrutas, "C3_EXPORT_SUMMARY_INVALID"),
            refunds: toMinorUnits(totals.totalReembolsos, "C3_EXPORT_SUMMARY_INVALID"),
            netInvoiced: toMinorUnits(totals.totalFacturadoNeto, "C3_EXPORT_SUMMARY_INVALID"),
            separateTips: toMinorUnits(totals.totalPropinasSeparadas, "C3_EXPORT_SUMMARY_INVALID"),
            separateAdjustments: toMinorUnits(totals.totalAjustesSeparados, "C3_EXPORT_SUMMARY_INVALID"),
            taxableBase: toMinorUnits(vatDraft.baseImponibleRegistrada, "C3_EXPORT_SUMMARY_INVALID"),
            taxAmount: toMinorUnits(vatDraft.cuotaIvaRegistrada, "C3_EXPORT_SUMMARY_INVALID"),
        },
        paymentBreakdownMinor: {
            cash: toMinorUnits(payment.efectivo, "C3_EXPORT_SUMMARY_INVALID"),
            card: toMinorUnits(payment.tarjeta, "C3_EXPORT_SUMMARY_INVALID"),
            bizum: toMinorUnits(payment.bizum, "C3_EXPORT_SUMMARY_INVALID"),
            online: toMinorUnits(payment.online, "C3_EXPORT_SUMMARY_INVALID"),
        },
        vatDraftStatus: requiredString(vatDraft.estado, "C3_EXPORT_VAT_DRAFT_STATUS_MISSING", 80),
    };
}

/**
 * Builds a deterministic, minimized, read-only accounting export artifact.
 * It never persists, emails, uploads, or changes source records.
 */
export function buildQuarterlyRegistryPackage({
    year,
    quarter,
    generatedAt,
    traceId,
    summary,
    rows,
}) {
    const period = quarterPeriod(year, quarter);
    const generatedAtIso = isoDate(generatedAt, "C3_EXPORT_GENERATED_AT_INVALID");
    const normalizedTraceId = requiredString(traceId, "C3_EXPORT_TRACE_ID_MISSING", 160);
    if (!Array.isArray(rows)) throw new Error("C3_EXPORT_ROWS_INVALID");

    const records = rows.map(normalizeRecord).sort((a, b) =>
        a.issueDate.localeCompare(b.issueDate) ||
        a.invoiceNumber.localeCompare(b.invoiceNumber) ||
        a.transactionReference.localeCompare(b.transactionReference)
    );
    const content = {
        issuer: normalizeSummary(summary),
        records,
    };
    const contentChecksum = sha256(canonicalJson(content));
    const exportId = `MM-C3-ACCOUNTING-${year}-Q${quarter}-V${C3_EXPORT_SCHEMA_VERSION}`;
    const artifactId = sha256(`${exportId}\n${contentChecksum}`);
    const manifest = {
        exportId,
        artifactId,
        exportType: C3_EXPORT_TYPE,
        schemaVersion: C3_EXPORT_SCHEMA_VERSION,
        sourceSystem: "WIX_CMS",
        period: { year, quarter, ...period, timeZone: "Europe/Madrid" },
        generatedAt: generatedAtIso,
        traceId: normalizedTraceId,
        recordCount: records.length,
        checksumAlgorithm: "SHA-256",
        contentChecksum,
        deliveryStatus: "PREPARED_NOT_DELIVERED",
    };

    return Object.freeze({ manifest, content });
}
