import { fromMinorUnits, toMinorUnits } from "backend/tpv/tpvUtils";
import { TPV_CATALOG_APP_IDS, SDK_CONFIG } from "backend/internalConfig";

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RATE_SCALE = 1_000_000n;

function fail(code) {
    const error = new Error(code);
    error.code = code;
    throw error;
}

function money(value, field) {
    return fromMinorUnits(toMinorUnits(value, field)).toFixed(2);
}

function price(value, field) {
    return { amount: money(value, field) };
}

function decimalToRateUnits(value) {
    const raw = String(value ?? "").trim();
    const match = /^([+-]?)(\d+)(?:\.(\d{1,6}))?$/.exec(raw);
    if (!match) fail("TPV_ORDER_TAX_RATE_INVALID");
    const whole = BigInt(match[2]);
    const fraction = BigInt((match[3] || "").padEnd(6, "0"));
    const units = whole * RATE_SCALE + fraction;
    return match[1] === "-" ? -units : units;
}

function rateUnitsToString(units) {
    const negative = units < 0n;
    const absolute = negative ? -units : units;
    const whole = absolute / RATE_SCALE;
    const fraction = (absolute % RATE_SCALE).toString().padStart(6, "0").replace(/0+$/, "");
    return (negative ? "-" : "") + whole.toString() + (fraction ? "." + fraction : "");
}

function mapTaxBreakdown(items) {
    if (!Array.isArray(items) || items.length === 0) {
        fail("TPV_ORDER_TAX_BREAKDOWN_INVALID");
    }

    let totalRate = 0n;
    const taxBreakdown = items.map((item) => {
        if (!item || typeof item !== "object") fail("TPV_ORDER_TAX_BREAKDOWN_INVALID");
        totalRate += decimalToRateUnits(item.rate);
        const result = {
            rate: String(item.rate),
            ...(item.taxName ? { taxName: String(item.taxName).slice(0, 200) } : {}),
            ...(item.taxType ? { taxType: String(item.taxType).slice(0, 200) } : {}),
            ...(item.jurisdiction ? { jurisdiction: String(item.jurisdiction).slice(0, 200) } : {}),
            ...(item.jurisdictionType ? { jurisdictionType: String(item.jurisdictionType) } : {}),
            ...(item.taxableAmount !== undefined ? { taxableAmount: price(item.taxableAmount, "ORDER_TAXABLE_AMOUNT") } : {}),
            ...(item.taxAmount !== undefined ? { taxAmount: price(item.taxAmount, "ORDER_TAX_AMOUNT") } : {}),
            ...(item.nonTaxableAmount !== undefined ? { nonTaxableAmount: price(item.nonTaxableAmount, "ORDER_NON_TAXABLE_AMOUNT") } : {}),
            ...(item.exemptAmount !== undefined ? { exemptAmount: price(item.exemptAmount, "ORDER_EXEMPT_AMOUNT") } : {}),
        };
        if (result.taxAmount === undefined) fail("TPV_ORDER_TAX_AMOUNT_MISSING");
        return result;
    });

    return { taxRate: rateUnitsToString(totalRate), taxBreakdown };
}

/**
 * Maps a backend-prepared, Wix-tax-verified sale into the native Wix eCommerce
 * Create Order contract. No client-supplied price, tax, quantity or total is read.
 */
export function buildTpvNativeOrderPayload(prepared, buyer = {}, externalOrderId) {
    const correlationId = String(externalOrderId || "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(correlationId)) {
        fail("TPV_ORDER_EXTERNAL_ID_INVALID");
    }
    if (!prepared || typeof prepared !== "object" || !Array.isArray(prepared.lineas) ||
        prepared.lineas.length === 0 || prepared.lineas.length > 100) {
        fail("TPV_ORDER_PREPARATION_INVALID");
    }
    if (typeof prepared.taxIncludedInPrice !== "boolean") fail("TPV_ORDER_TAX_MODE_INVALID");
    if (String(prepared.taxCurrency || "").toUpperCase() !== SDK_CONFIG.CURRENCY_CODE) {
        fail("TPV_ORDER_CURRENCY_INVALID");
    }

    let subtotalMinor = 0;
    let taxMinor = 0;
    let totalMinor = 0;

    const lineItems = prepared.lineas.map((line, index) => {
        if (!line || !["PRODUCTO", "SERVICIO"].includes(line.tipoLinea) ||
            !GUID.test(String(line.itemId || "")) ||
            !Number.isSafeInteger(Number(line.cantidad)) || Number(line.cantidad) <= 0 ||
            !GUID.test(String(line.taxGroupId || "")) ||
            line.taxIncludedInPrice !== prepared.taxIncludedInPrice) {
            fail("TPV_ORDER_LINE_INVALID:" + index);
        }

        const expectedAppId = line.tipoLinea === "PRODUCTO"
            ? TPV_CATALOG_APP_IDS.WIX_STORES
            : TPV_CATALOG_APP_IDS.WIX_BOOKINGS;
        if (String(line.appId || "") !== expectedAppId) fail("TPV_ORDER_CATALOG_APP_INVALID:" + index);

        const quantity = Number(line.cantidad);
        const unitPriceMinor = toMinorUnits(line.precioUnitario, "ORDER_UNIT_PRICE");
        const lineSubtotalMinor = toMinorUnits(line.subtotalNeto, "ORDER_LINE_SUBTOTAL");
        const lineTaxMinor = toMinorUnits(line.impuestosImporte, "ORDER_LINE_TAX");
        const lineTotalMinor = toMinorUnits(line.totalLinea, "ORDER_LINE_TOTAL");
        const catalogLineTotalMinor = unitPriceMinor * quantity;
        const expectedCatalogAmountMinor = line.taxIncludedInPrice ? lineTotalMinor : lineSubtotalMinor;
        if (unitPriceMinor <= 0 || !Number.isSafeInteger(catalogLineTotalMinor) ||
            catalogLineTotalMinor !== expectedCatalogAmountMinor ||
            lineSubtotalMinor + lineTaxMinor !== lineTotalMinor) {
            fail("TPV_ORDER_LINE_TOTAL_MISMATCH:" + index);
        }
        if (line.varianteId && !GUID.test(String(line.varianteId))) {
            fail("TPV_ORDER_VARIANT_INVALID:" + index);
        }
        if (!String(line.concepto || "").trim()) fail("TPV_ORDER_LINE_NAME_MISSING:" + index);

        const { taxRate, taxBreakdown } = mapTaxBreakdown(line.desgloseImpuestos);
        const breakdownTaxMinor = taxBreakdown.reduce((sum, item) =>
            sum + toMinorUnits(item.taxAmount.amount, "ORDER_TAX_BREAKDOWN_AMOUNT"), 0);
        if (breakdownTaxMinor !== lineTaxMinor) fail("TPV_ORDER_TAX_BREAKDOWN_MISMATCH:" + index);

        subtotalMinor += lineSubtotalMinor;
        taxMinor += lineTaxMinor;
        totalMinor += lineTotalMinor;

        const catalogReference = {
            catalogItemId: line.itemId,
            appId: expectedAppId,
            options: line.tipoLinea === "PRODUCTO" && line.varianteId
                ? { variantId: line.varianteId }
                : {},
        };

        return {
            productName: { original: String(line.concepto || "").trim().slice(0, 250) },
            catalogReference,
            quantity,
            totalDiscount: price(0, "ORDER_LINE_DISCOUNT"),
            itemType: { preset: line.tipoLinea === "PRODUCTO" ? "PHYSICAL" : "SERVICE" },
            price: price(fromMinorUnits(unitPriceMinor), "ORDER_UNIT_PRICE"),
            totalPriceBeforeTax: price(fromMinorUnits(lineSubtotalMinor), "ORDER_LINE_SUBTOTAL"),
            totalPriceAfterTax: price(fromMinorUnits(lineTotalMinor), "ORDER_LINE_TOTAL"),
            paymentOption: "FULL_PAYMENT_OFFLINE",
            taxInfo: {
                taxableAmount: price(fromMinorUnits(lineSubtotalMinor), "ORDER_TAXABLE_AMOUNT"),
                taxAmount: price(fromMinorUnits(lineTaxMinor), "ORDER_TAX_AMOUNT"),
                taxRate,
                taxGroupId: line.taxGroupId,
                taxIncludedInPrice: line.taxIncludedInPrice,
                taxBreakdown,
            },
        };
    });

    const expectedSubtotalMinor = toMinorUnits(prepared.subtotalNeto, "ORDER_SUBTOTAL");
    const expectedTaxMinor = toMinorUnits(prepared.impuestosTotal, "ORDER_TAX");
    const expectedTotalMinor = toMinorUnits(prepared.totalVenta, "ORDER_TOTAL");
    if (subtotalMinor !== expectedSubtotalMinor || taxMinor !== expectedTaxMinor ||
        totalMinor !== expectedTotalMinor || subtotalMinor + taxMinor !== totalMinor) {
        fail("TPV_ORDER_SUMMARY_MISMATCH");
    }

    const buyerContactId = String(buyer.contactId || "").trim();
    if (buyerContactId && !GUID.test(buyerContactId)) fail("TPV_ORDER_BUYER_CONTACT_INVALID");
    const buyerEmail = String(buyer.email || "").trim().toLowerCase();
    if (buyerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) {
        fail("TPV_ORDER_BUYER_EMAIL_INVALID");
    }

    const order = {
        ...(buyerContactId ? {
            buyerInfo: {
                contactId: buyerContactId,
                ...(buyerEmail ? { email: buyerEmail } : {}),
            },
        } : {}),
        lineItems,
        status: "APPROVED",
        paymentStatus: "NOT_PAID",
        priceSummary: {
            subtotal: price(fromMinorUnits(subtotalMinor), "ORDER_SUBTOTAL"),
            shipping: price(0, "ORDER_SHIPPING"),
            tax: price(fromMinorUnits(taxMinor), "ORDER_TAX"),
            discount: price(0, "ORDER_DISCOUNT"),
            total: price(fromMinorUnits(totalMinor), "ORDER_TOTAL"),
        },
        channelInfo: { type: "POS", externalOrderId: correlationId },
        currency: SDK_CONFIG.CURRENCY_CODE,
        taxIncludedInPrices: prepared.taxIncludedInPrice,
    };

    return Object.freeze({
        order: Object.freeze(order),
        options: Object.freeze({
            settings: Object.freeze({
                orderApprovalStrategy: "DEFAULT",
                notifications: Object.freeze({
                    sendNotificationToBuyer: false,
                    sendNotificationsToBusiness: false,
                }),
            }),
        }),
    });
}
