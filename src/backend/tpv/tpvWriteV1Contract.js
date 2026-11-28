import { toMinorUnits } from "backend/tpv/tpvUtils";

const SUPPORTED_WRITE_V1_PAYMENT_METHODS = new Set([
    "EFECTIVO",
    "TARJETA",
]);

function normalizeRate(value) {
    const rate = Number(value);
    if (!Number.isFinite(rate) || rate < 0 || rate > 1) return null;
    return rate.toFixed(6);
}

/**
 * Evaluates the narrow operational writer contract.
 * An empty tender list is an unpaid commercial intent, not a payment.
 * This function never authorizes persistence or confirms that money was received.
 */
export function getTpvWriteV1Blockers({ lineas, pagos, totalVenta } = {}) {
    const blockers = [];

    if (!Array.isArray(lineas) || lineas.length === 0) {
        blockers.push("TPV_WRITE_V1_LINES_REQUIRED");
    } else {
        const rates = new Set();
        let unverifiableRate = false;

        for (const line of lineas) {
            const breakdown = line?.desgloseImpuestos;
            if (!Array.isArray(breakdown) || breakdown.length === 0) {
                unverifiableRate = true;
                continue;
            }
            for (const detail of breakdown) {
                const rate = normalizeRate(detail?.rate);
                if (rate === null) {
                    unverifiableRate = true;
                    continue;
                }
                rates.add(rate);
            }
        }

        if (unverifiableRate) blockers.push("TPV_WRITE_V1_TAX_RATE_UNVERIFIABLE");
        if (rates.size > 1) blockers.push("TPV_WRITE_V1_MULTI_VAT_UNSUPPORTED");
    }

    if (pagos !== undefined && pagos !== null && !Array.isArray(pagos)) {
        blockers.push("TPV_WRITE_V1_PAYMENTS_INVALID");
    } else if (Array.isArray(pagos) && pagos.length > 1) {
        blockers.push("TPV_WRITE_V1_SPLIT_TENDER_UNSUPPORTED");
    } else if (Array.isArray(pagos) && pagos.length === 1) {
        const payment = pagos[0];
        const method = String(payment?.medioPago || "").trim().toUpperCase();
        if (!SUPPORTED_WRITE_V1_PAYMENT_METHODS.has(method)) {
            blockers.push("TPV_WRITE_V1_PAYMENT_METHOD_UNSUPPORTED");
        }

        try {
            const appliedMinor = toMinorUnits(payment?.importeAplicado, "PAYMENT_APPLIED");
            const totalMinor = toMinorUnits(totalVenta, "SALE_TOTAL");
            if (appliedMinor <= 0 || appliedMinor !== totalMinor) {
                blockers.push("TPV_WRITE_V1_PAYMENT_TOTAL_MISMATCH");
            }
        } catch {
            blockers.push("TPV_WRITE_V1_PAYMENT_TOTAL_MISMATCH");
        }
    }

    return Object.freeze([...new Set(blockers)]);
}
