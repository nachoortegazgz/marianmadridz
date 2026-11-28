import { fromMinorUnits, toMinorUnits } from "backend/tpv/tpvUtils";
import { TPV_CATALOG_APP_IDS } from "backend/internalConfig";

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(code) {
    const error = new Error(code);
    error.code = code;
    throw error;
}

export function normalizeTpvSaleLineRequests(lines) {
    if (!Array.isArray(lines) || lines.length === 0 || lines.length > 100) {
        fail("TPV_LINES_REQUIRED_OR_LIMIT_EXCEEDED");
    }

    return lines.map((line) => {
        if (!line || typeof line !== "object" || Array.isArray(line)) {
            fail("TPV_INVALID_LINE");
        }

        const tipoLinea = String(line.tipoLinea || "").trim().toUpperCase();
        if (!["PRODUCTO", "SERVICIO"].includes(tipoLinea)) {
            fail("TPV_LINE_TAX_CLASSIFICATION_UNSUPPORTED");
        }

        const itemId = String(line.itemId || "").trim();
        if (!GUID_RE.test(itemId)) fail("TPV_CATALOG_ITEM_ID_INVALID");

        const cantidad = Number(line.cantidad);
        if (!Number.isSafeInteger(cantidad) || cantidad <= 0 || cantidad > 100000) {
            fail("TPV_INVALID_QUANTITY");
        }

        const descuentoMinor = toMinorUnits(line.descuentoImporte ?? 0, "DISCOUNT");
        if (descuentoMinor !== 0) fail("TPV_DISCOUNT_NOT_CONFIGURED");

        const varianteId = line.varianteId ? String(line.varianteId).trim() : null;
        if (varianteId && (tipoLinea !== "PRODUCTO" || !GUID_RE.test(varianteId))) {
            fail("TPV_INVALID_VARIANT_ID");
        }

        return Object.freeze({
            tipoLinea,
            itemId,
            ...(varianteId ? { varianteId } : {}),
            cantidad,
            profesionalId: line.profesionalId ? String(line.profesionalId).trim() : null,
            stockAfectado: false,
        });
    });
}

export function assertTpvPaymentMethodsSupported(payments) {
    if (payments === undefined || payments === null) return true;
    if (!Array.isArray(payments)) fail("TPV_INVALID_PAYMENTS");
    if (payments.some((payment) =>
        ["BONO", "TARJETA_REGALO"].includes(String(payment?.medioPago || "").trim().toUpperCase())
    )) {
        fail("TPV_PAYMENT_METHOD_NOT_VERIFIED");
    }
    return true;
}

export function buildTpvTaxCalculationLines(catalogLines, taxIncludedInPrice) {
    if (!Array.isArray(catalogLines) || catalogLines.length === 0 || catalogLines.length > 100) {
        fail("TPV_TAX_LINES_INVALID");
    }
    if (typeof taxIncludedInPrice !== "boolean") fail("TPV_TAX_SETTINGS_UNAVAILABLE");

    return catalogLines.map((line, index) => {
        if (!line || !GUID_RE.test(String(line.itemId || ""))) fail("TPV_CATALOG_ITEM_ID_INVALID");
        if (!["PRODUCTO", "SERVICIO"].includes(line.tipoLinea)) fail("TPV_LINE_TAX_CLASSIFICATION_UNSUPPORTED");

        const quantity = Number(line.cantidad);
        if (!Number.isSafeInteger(quantity) || quantity <= 0) fail("TPV_INVALID_QUANTITY");

        const priceMinor = toMinorUnits(line.precioUnitario, "CATALOG_PRICE");
        if (priceMinor <= 0) fail("TPV_CATALOG_PRICE_UNAVAILABLE");
        if (String(line.currency || "").toUpperCase() !== "EUR") fail("TPV_CATALOG_CURRENCY_MISMATCH");

        const appId = String(line.appId || "").trim();
        const expectedAppId = line.tipoLinea === "PRODUCTO"
            ? TPV_CATALOG_APP_IDS.WIX_STORES
            : TPV_CATALOG_APP_IDS.WIX_BOOKINGS;
        if (appId !== expectedAppId) fail("TPV_TAX_CATALOG_APP_NOT_ALLOWED");

        const taxGroupId = line.taxGroupId ? String(line.taxGroupId).trim() : null;
        if (taxGroupId && !GUID_RE.test(taxGroupId)) fail("TPV_TAX_GROUP_ID_INVALID");

        return {
            _id: "TPV_LINE_" + String(index + 1),
            itemName: String(line.concepto || "").trim().slice(0, 250),
            quantity,
            price: fromMinorUnits(priceMinor).toFixed(2),
            appId,
            ...(taxGroupId ? { taxGroupId } : {}),
            taxIncludedInPrice,
            addressIndex: { singleAddress: 0 },
        };
    });
}

export function mapTpvTaxCalculation({ catalogLines, taxResult, taxIncludedInPrice }) {
    if (!Array.isArray(catalogLines) || catalogLines.length === 0 ||
        !taxResult || typeof taxResult !== "object") {
        fail("TPV_TAX_RESULT_INVALID");
    }
    if (typeof taxIncludedInPrice !== "boolean") fail("TPV_TAX_SETTINGS_UNAVAILABLE");
    if (String(taxResult.currency || "").toUpperCase() !== "EUR") {
        fail("TPV_TAX_CURRENCY_MISMATCH");
    }
    if (Array.isArray(taxResult.errors) && taxResult.errors.length > 0) {
        fail("TPV_TAX_CALCULATION_FAILED");
    }

    const summary = taxResult.taxSummary;
    const details = taxResult.lineItemTaxDetails;
    if (!summary || !Array.isArray(details) || details.length !== catalogLines.length) {
        fail("TPV_TAX_RESULT_INCOMPLETE");
    }

    const detailById = new Map();
    for (const detail of details) {
        const id = String(detail?._id || detail?.id || "");
        if (!id || detailById.has(id)) fail("TPV_TAX_RESULT_LINE_ID_INVALID");
        detailById.set(id, detail);
    }

    let subtotalMinor = 0;
    let lineTaxMinor = 0;
    let totalSaleMinor = 0;

    const lineas = catalogLines.map((line, index) => {
        const lineId = "TPV_LINE_" + String(index + 1);
        const detail = detailById.get(lineId);
        if (!detail || !detail.taxSummary) fail("TPV_TAX_RESULT_LINE_MISSING");
        if (detail.taxIncludedInPrice !== taxIncludedInPrice) {
            fail("TPV_TAX_PRICE_MODE_MISMATCH");
        }

        const quantity = Number(line.cantidad);
        const unitPriceMinor = toMinorUnits(line.precioUnitario, "CATALOG_PRICE");
        const expectedFullPriceMinor = unitPriceMinor * quantity;
        const fullPriceMinor = toMinorUnits(detail.taxSummary.fullPrice, "FULL_PRICE");
        const taxableMinor = toMinorUnits(detail.taxSummary.taxableAmount, "TAXABLE_AMOUNT");
        const taxMinor = toMinorUnits(detail.taxSummary.taxAmount, "TAX_AMOUNT");
        const taxGroupId = String(detail.taxGroupId || "").trim();
        const taxBreakdown = Array.isArray(detail.taxBreakdown) ? detail.taxBreakdown : [];

        if (!Number.isSafeInteger(expectedFullPriceMinor) ||
            fullPriceMinor !== expectedFullPriceMinor ||
            !GUID_RE.test(taxGroupId) || taxBreakdown.length === 0) {
            fail("TPV_TAX_RESULT_LINE_INCONSISTENT");
        }

        const expectedLineTotalMinor = taxIncludedInPrice
            ? fullPriceMinor
            : fullPriceMinor + taxMinor;
        if (taxIncludedInPrice
            ? taxableMinor + taxMinor !== fullPriceMinor
            : taxableMinor !== fullPriceMinor) {
            fail("TPV_TAX_RESULT_LINE_INCONSISTENT");
        }

        subtotalMinor += taxableMinor;
        lineTaxMinor += taxMinor;
        totalSaleMinor += expectedLineTotalMinor;

        return Object.freeze({
            tipoLinea: line.tipoLinea,
            itemId: line.itemId,
            appId: line.appId,
            currency: String(line.currency || "").toUpperCase(),
            ...(line.varianteId ? { varianteId: line.varianteId } : {}),
            concepto: String(line.concepto || "").trim(),
            cantidad: quantity,
            precioUnitario: fromMinorUnits(unitPriceMinor),
            descuentoImporte: 0,
            subtotalNeto: fromMinorUnits(taxableMinor),
            impuestosImporte: fromMinorUnits(taxMinor),
            totalLinea: fromMinorUnits(expectedLineTotalMinor),
            taxIncludedInPrice,
            taxGroupId,
            desgloseImpuestos: taxBreakdown,
            profesionalId: line.profesionalId || null,
            stockAfectado: false,
        });
    });

    const summaryTaxMinor = toMinorUnits(summary.totalTax, "TAX_SUMMARY");
    const summaryTaxableMinor = toMinorUnits(summary.totalTaxableAmount, "TAXABLE_SUMMARY");
    const summaryIncludedTaxMinor = toMinorUnits(summary.totalTaxIncludedInPrice ?? 0, "TAX_INCLUDED");

    // Do not use totalAmount: the generic REST example and this site's live
    // response expose different tax-inclusion semantics. Reconcile explicit
    // taxable/tax totals and each line's fullPrice instead.
    if (summaryTaxMinor !== lineTaxMinor ||
        summaryTaxableMinor !== subtotalMinor ||
        summaryIncludedTaxMinor !== (taxIncludedInPrice ? lineTaxMinor : 0)) {
        fail("TPV_TAX_ROUNDING_MISMATCH");
    }

    return Object.freeze({
        lineas: Object.freeze(lineas),
        subtotalNeto: fromMinorUnits(subtotalMinor),
        impuestosTotal: fromMinorUnits(lineTaxMinor),
        totalVenta: fromMinorUnits(totalSaleMinor),
        taxIncludedInPrice,
        taxCalculatorIds: Object.freeze([...new Set(details
            .map((detail) => String(detail?.taxSummary?.appId || "").trim())
            .filter(Boolean))]),
        taxIncludedInPriceAmount: fromMinorUnits(summaryIncludedTaxMinor),
    });
}
