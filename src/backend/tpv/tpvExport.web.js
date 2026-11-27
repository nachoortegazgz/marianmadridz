import { Permissions, webMethod } from "wix-web-module";
import { requireAdmin } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { BUSINESS_COLLECTIONS, TPV_LEDGER_SOURCE } from "backend/internalConfig";
import { CONSISTENCY, queryItems, wql } from "backend/dataAccess";

const PAGE_SIZE = 1000;
const EXPORT_FIELDS = Object.freeze([
    "_id",
    "recordTimestamp",
    "sessionId",
    "movementType",
    "paymentMethod",
    "totalAmount",
    "operationDescription",
    "staffResourceId",
    "sequenceNumber",
    "transactionId",
]);

function parseDate(value, field) {
    const date = value instanceof Date ? value : new Date(value);
    if (!value || Number.isNaN(date.getTime())) throw new Error("TPV_EXPORT_INVALID_" + field);
    return date;
}

function safeText(value) {
    const text = value === null || value === undefined ? "" : String(value);
    return /^[=+@\-\t\r]/.test(text) ? "'" + text : text;
}

function csvCell(value) {
    const text = typeof value === "string" ? safeText(value) : String(value ?? "");
    return '"' + text.replace(/"/g, '""') + '"';
}

function projectRecord(item) {
    const envelope = item.payloadFiscal && typeof item.payloadFiscal === "object"
        ? item.payloadFiscal
        : {};
    const record = {
        _id: item._id,
        recordTimestamp: item.recordTimestamp || null,
        sessionId: envelope.sessionId || null,
        movementType: item.movementType || null,
        paymentMethod: item.paymentMethod || null,
        totalAmount: item.totalAmount ?? null,
        operationDescription: item.operationDescription || null,
        staffResourceId: item.staffResourceId || null,
        sequenceNumber: item.sequenceNumber ?? null,
        transactionId: item.transactionId || null,
    };
    return Object.fromEntries(EXPORT_FIELDS.map((field) => [field, record[field]]));
}

function toCsv(records) {
    const header = EXPORT_FIELDS.map(csvCell).join(",");
    const rows = records.map((record) =>
        EXPORT_FIELDS.map((field) => csvCell(record[field])).join(",")
    );
    return [header, ...rows].join("\r\n");
}

export const exportarMovimientos = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-movements-export");
        await requireAdmin(traceId);
        try {
            const desde = parseDate(input.desde, "DESDE");
            const hasta = parseDate(input.hasta, "HASTA");
            if (desde > hasta) throw new Error("TPV_EXPORT_DATE_RANGE_INVALID");
            const formato = String(input.formato || "json").toLowerCase();
            if (!["json", "csv"].includes(formato)) throw new Error("TPV_EXPORT_FORMAT_INVALID");
            const sessionId = String(input.sessionId || "").trim();
            const rawCursor = input.cursor === undefined || input.cursor === null || input.cursor === ""
                ? 0
                : Number(input.cursor);
            if (!Number.isSafeInteger(rawCursor) || rawCursor < 0) throw new Error("TPV_EXPORT_CURSOR_INVALID");

            const page = await queryItems({
                dataCollectionId: BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA,
                filter: wql.and(
                    wql.eq("recordSource", TPV_LEDGER_SOURCE),
                    wql.gte("recordTimestamp", desde),
                    wql.lte("recordTimestamp", hasta)
                ),
                sort: ["recordTimestamp ASC"],
                limit: PAGE_SIZE,
                offset: rawCursor,
                consistency: CONSISTENCY.STRONG,
            });
            const records = page.items
                .filter((item) => !sessionId || item.payloadFiscal?.sessionId === sessionId)
                .map(projectRecord);
            return {
                status: "SUCCESS",
                formato,
                nRegistros: records.length,
                contenido: formato === "csv" ? toCsv(records) : records,
                nextCursor: page.hasNext ? String(rawCursor + page.items.length) : null,
                hasMore: page.hasNext,
                traceId,
            };
        } catch (error) {
            return {
                status: "ERROR",
                formato: String(input.formato || "json").toLowerCase(),
                nRegistros: 0,
                contenido: null,
                nextCursor: null,
                hasMore: false,
                error: { code: String(error?.code || error?.message || "TPV_MOVEMENTS_EXPORT_FAILED") },
                traceId,
            };
        }
    }
);
