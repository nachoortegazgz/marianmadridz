/**
 * Shared Wix Orders amount and VAT resolver.
 * Pure normalization only: no persistence, network calls or event side effects.
 */
/**
 * Resolve the authoritative Wix order amount for the fiscal ledger.
 * An explicit zero is valid and must not fall back to undiscounted prices.
 */
export function resolveOrderLedgerAmount(order) {
    const orderTotalCandidates = [
        order?.priceSummary?.totalPrice?.amount,
        order?.priceSummary?.total?.amount,
        order?.payNow?.total?.amount,
        order?.payNow?.totalPrice?.amount,
        order?.totals?.total?.amount,
    ];
    for (const rawOrderTotal of orderTotalCandidates) {
        if (
            rawOrderTotal === undefined ||
            rawOrderTotal === null ||
            String(rawOrderTotal).trim() === ""
        ) {
            continue;
        }
        const validType = typeof rawOrderTotal === "number" ||
            (typeof rawOrderTotal === "string" && rawOrderTotal.trim() !== "");
        const orderTotal = validType ? Number(rawOrderTotal) : Number.NaN;
        if (!Number.isFinite(orderTotal) || orderTotal < 0) {
            throw new Error("FISCAL_ORDER_TOTAL_INVALID");
        }
        return orderTotal;
    }

    const lineItems = Array.isArray(order?.lineItems) ? order.lineItems : [];
    if (!lineItems.length) throw new Error("FISCAL_ORDER_TOTAL_MISSING");
    return lineItems.reduce((sum, item) => {
        const lineTotalCandidates = [
            item?.totalPriceAfterTax?.amount,
            item?.totalPriceBeforeTax?.amount,
            item?.totalPrice?.amount,
        ];
        for (const rawLineTotal of lineTotalCandidates) {
            if (
                rawLineTotal === undefined ||
                rawLineTotal === null ||
                String(rawLineTotal).trim() === ""
            ) {
                continue;
            }
            const validType = typeof rawLineTotal === "number" ||
                (typeof rawLineTotal === "string" && rawLineTotal.trim() !== "");
            const lineTotal = validType ? Number(rawLineTotal) : Number.NaN;
            if (!Number.isFinite(lineTotal) || lineTotal < 0) {
                throw new Error("FISCAL_ORDER_LINE_TOTAL_INVALID");
            }
            return sum + lineTotal;
        }

        const rawUnitPrice = item?.price?.amount ?? item?.price;
        const rawQuantity = item?.quantity;
        const validPriceType = typeof rawUnitPrice === "number" ||
            (typeof rawUnitPrice === "string" && rawUnitPrice.trim() !== "");
        const validQuantityType = typeof rawQuantity === "number" ||
            (typeof rawQuantity === "string" && rawQuantity.trim() !== "");
        const unitPrice = validPriceType ? Number(rawUnitPrice) : Number.NaN;
        const quantity = validQuantityType ? Number(rawQuantity) : Number.NaN;
        if (!Number.isFinite(unitPrice) || unitPrice < 0 ||
            !Number.isFinite(quantity) || quantity <= 0) {
            throw new Error("FISCAL_ORDER_LINE_AMOUNT_INVALID");
        }
        return sum + unitPrice * quantity;
    }, 0);
}

/**
 * Resolve the fiscal VAT breakdown from the current Wix Orders schema.
 * Uses Order.taxInfo and OrderLineItem.taxInfo; deprecated taxSummary/taxDetails
 * and a hard-coded VAT rate are deliberately not accepted.
 */
export function resolveOrderFiscalTaxData(order) {
    const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
    const readMoney = (value, field) => {
        const raw = value && typeof value === "object" ? value.amount : value;
        if (raw === undefined || raw === null || String(raw).trim() === "") {
            throw new Error("FISCAL_TAX_FIELD_MISSING:" + field);
        }
        const validType = typeof raw === "number" ||
            (typeof raw === "string" && raw.trim() !== "");
        const amount = validType ? Number(raw) : Number.NaN;
        if (!Number.isFinite(amount) || amount < 0) {
            throw new Error("FISCAL_TAX_FIELD_INVALID:" + field);
        }
        return roundMoney(amount);
    };

    const lineItems = Array.isArray(order?.lineItems) ? order.lineItems : [];
    if (!lineItems.length) throw new Error("FISCAL_TAX_LINE_ITEMS_MISSING");
    const orderTaxInfo = order?.taxInfo;
    if (!orderTaxInfo || orderTaxInfo.taxExempt === true) {
        throw new Error("FISCAL_TAX_INFO_MISSING_OR_EXEMPT");
    }
    const totalExempt = orderTaxInfo.totalExempt?.amount == null
        ? 0
        : readMoney(orderTaxInfo.totalExempt, "taxInfo.totalExempt");
    if (totalExempt > 0) throw new Error("FISCAL_TAX_EXEMPTION_REQUIRES_POLICY");

    let taxBase = 0;
    let taxAmount = 0;
    let lineTotal = 0;
    const rates = new Set();
    const breakdown = [];

    for (let index = 0; index < lineItems.length; index++) {
        const item = lineItems[index];
        const taxInfo = item?.taxInfo;
        if (!taxInfo) throw new Error("FISCAL_LINE_TAX_INFO_MISSING:" + index);
        const exemptAmount = taxInfo.exemptAmount?.amount == null
            ? 0
            : readMoney(taxInfo.exemptAmount, "lineItems[" + index + "].taxInfo.exemptAmount");
        if (exemptAmount > 0) {
            throw new Error("FISCAL_LINE_EXEMPTION_REQUIRES_POLICY:" + index);
        }
        if (Array.isArray(taxInfo.taxBreakdown) && taxInfo.taxBreakdown.length > 1) {
            throw new Error("FISCAL_MULTIPLE_JURISDICTION_TAXES_UNSUPPORTED:" + index);
        }

        const base = readMoney(taxInfo.taxableAmount, "lineItems[" + index + "].taxInfo.taxableAmount");
        const tax = readMoney(taxInfo.taxAmount, "lineItems[" + index + "].taxInfo.taxAmount");
        const rawRate = taxInfo.taxRate ?? taxInfo.taxBreakdown?.[0]?.rate;
        const validRateType = typeof rawRate === "number" ||
            (typeof rawRate === "string" && rawRate.trim() !== "");
        const rate = validRateType ? Number(rawRate) : Number.NaN;
        if (!Number.isFinite(rate) || rate <= 0 || rate > 1) {
            throw new Error("FISCAL_LINE_TAX_RATE_INVALID:" + index);
        }
        if (Math.abs(roundMoney(base * rate) - tax) > 0.02) {
            throw new Error("FISCAL_LINE_TAX_CALCULATION_MISMATCH:" + index);
        }

        const rawLineTotal = item?.totalPriceAfterTax?.amount;
        if (rawLineTotal === undefined || rawLineTotal === null || String(rawLineTotal).trim() === "") {
            throw new Error("FISCAL_LINE_TOTAL_AFTER_TAX_MISSING:" + index);
        }
        const afterTax = readMoney(item.totalPriceAfterTax, "lineItems[" + index + "].totalPriceAfterTax");
        if (Math.abs(roundMoney(base + tax) - afterTax) > 0.02) {
            throw new Error("FISCAL_LINE_TOTAL_TAX_MISMATCH:" + index);
        }

        taxBase += base;
        taxAmount += tax;
        lineTotal += afterTax;
        rates.add(rate);
        breakdown.push({
            base,
            tipo: roundMoney(rate * 100),
            cuota: tax,
            operationDescription: String(item?.productName?.original || item?.name || "Wix order line").slice(0, 180),
            units: (() => {
                const rawQuantity = item?.quantity;
                const validType = typeof rawQuantity === "number" ||
                    (typeof rawQuantity === "string" && rawQuantity.trim() !== "");
                const quantity = validType ? Number(rawQuantity) : Number.NaN;
                if (!Number.isFinite(quantity) || quantity <= 0) {
                    throw new Error("FISCAL_ORDER_LINE_QUANTITY_INVALID:" + index);
                }
                return quantity;
            })(),
            magnitude: 1,
        });
    }

    taxBase = roundMoney(taxBase);
    taxAmount = roundMoney(taxAmount);
    lineTotal = roundMoney(lineTotal);
    const officialTax = readMoney(orderTaxInfo.totalTax, "taxInfo.totalTax");
    if (Math.abs(taxAmount - officialTax) > 0.01) {
        throw new Error("FISCAL_ORDER_TAX_TOTAL_MISMATCH");
    }
    if (order?.priceSummary?.tax?.amount != null) {
        const summaryTax = readMoney(order.priceSummary.tax, "priceSummary.tax");
        if (Math.abs(summaryTax - officialTax) > 0.01) {
            throw new Error("FISCAL_PRICE_SUMMARY_TAX_MISMATCH");
        }
    }
    const orderTotal = roundMoney(resolveOrderLedgerAmount(order));
    if (Math.abs(lineTotal - orderTotal) > 0.02) {
        throw new Error("FISCAL_ORDER_TOTAL_HAS_UNSUPPORTED_FEES_OR_SHIPPING");
    }
    if (rates.size !== 1) throw new Error("FISCAL_MULTIPLE_VAT_RATES_UNSUPPORTED");

    return {
        taxBase,
        taxAmount,
        tipoImpositivo: Array.from(rates)[0],
        breakdown,
    };
}

const log = logger;
const queryExtendedBookingsElevated = auth.elevate(extendedBookings.queryExtendedBookings);
const getOrderElevated = auth.elevate(orders.getOrder);
const listTransactionsForSingleOrderElevated = auth.elevate(orderTransactions.listTransactionsForSingleOrder);
const READER_V2_PAGE_LIMIT = 100;
const READER_V2_MAX_PAGES = 5;

// ============================================================================
// CONSTANTES (ALN-01, ALN-05, ALN-06)
// ============================================================================

const CITAS_COL = BUSINESS_COLLECTIONS.CITAS_F2;
const MOVIMIENTOS_CAJA_COL = BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA;
const CONTROL_OPERATIVO_COL = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
const MAPA_STAFF_COL = BUSINESS_COLLECTIONS.MAPA_STAFF;

// ALN-05: VAT_ACCRUAL_STATUS no existe en internalConfig v12.0.
const VAT_ACCRUAL_DEVENGADO = "DEVENGADO";

// ALN-06: PAYMENT_METHOD.ONLINE no existe. WIX_PAYMENTS es el canonico
// para el ledger fiscal. El canal "ONLINE" se conserva en channelType.
const LEDGER_PAYMENT_METHOD_ONLINE = PAYMENT_METHOD.WIX_PAYMENTS;

const WEBHOOK_RETRIES = SDK_CONFIG.EVENTS.RETRY_ATTEMPTS;
const WEBHOOK_RETRY_DELAY_MS =
    SDK_CONFIG.EVENTS.RETRY_BASE_BACKOFF_MS;
const API_TIMEOUT_MS = SDK_CONFIG.TIMEOUTS.WEBHOOK_MS;

const EMISOR_FALLBACK_NAME = "MARIAN MADRID";
const EVENT_TTL_HOURS = 72;

const STRONG_READ = Object.freeze({ consistencyMode: "strong" });

// ============================================================================
// WIX-MANAGED BACKEND EVENTS
// ============================================================================

/*
 * Wix Editor Classic Velo event handlers receive the platform-delivered event object.
 * Wix verifies and decodes the signed delivery before invoking this handler.
 * This module does not expose an HTTP webhook endpoint and accepts no raw JWT.
 */
