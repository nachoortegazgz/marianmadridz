/*
=============================================================================
MODULE: backend/refundTransactions.js
RESPONSIBILITY: Normalize Wix eCommerce order refund transactions for the
                Velo order-transactions event handler.
SAFETY: Only fully terminal refunds with a reconciled successful amount may
        reach the fiscal refund writer. No Wix or CMS calls in this module.
=============================================================================
*/

const FINAL_REFUND_STATUSES = new Set(["SUCCEEDED", "FAILED"]);

function _amountToCents(value, field, allowZero = false) {
    const raw = value && typeof value === "object" ? value.amount : value;
    if (raw === undefined || raw === null || String(raw).trim() === "") {
        throw new Error("REFUND_AMOUNT_MISSING:" + field);
    }
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < 0 || (!allowZero && amount === 0)) {
        throw new Error("REFUND_AMOUNT_INVALID:" + field);
    }
    const cents = Math.round((amount + Number.EPSILON) * 100);
    if (!Number.isSafeInteger(cents) || Math.abs(amount * 100 - cents) > 0.000001) {
        throw new Error("REFUND_AMOUNT_PRECISION_INVALID:" + field);
    }
    return cents;
}

/**
 * Returns refunds that are fully terminal and whose successful transaction
 * amounts exactly reconcile to Wix's aggregated summary.refunded amount.
 *
 * A refund with any PENDING/STARTED/SCHEDULED/unknown transaction is deferred.
 * Failed transactions contribute zero. The caller must still enforce ledger
 * idempotency and the original-order cumulative refund cap.
 */
export function resolveCompletedRefunds(orderTransactions) {
    const refunds = Array.isArray(orderTransactions?.refunds)
        ? orderTransactions.refunds
        : [];
    const seenRefundIds = new Set();
    const completed = [];

    for (const refund of refunds) {
        const refundId = String(refund?.id || refund?._id || "").trim();
        if (!refundId) throw new Error("REFUND_ID_MISSING");
        if (seenRefundIds.has(refundId)) throw new Error("REFUND_DUPLICATE_ID_IN_ORDER");
        seenRefundIds.add(refundId);

        const transactions = Array.isArray(refund?.transactions)
            ? refund.transactions
            : [];
        if (!transactions.length) continue;

        const statuses = transactions.map((transaction) =>
            String(transaction?.refundStatus || "").trim().toUpperCase()
        );
        if (statuses.some((status) => !FINAL_REFUND_STATUSES.has(status))) {
            continue;
        }

        const successfulTransactions = transactions.filter((transaction) =>
            String(transaction?.refundStatus || "").trim().toUpperCase() === "SUCCEEDED"
        );
        if (!successfulTransactions.length) {
            const summaryAmount = refund?.summary?.refunded?.amount;
            if (summaryAmount !== undefined && summaryAmount !== null) {
                const summaryCents = _amountToCents(
                    summaryAmount,
                    "summary.refunded",
                    true
                );
                if (summaryCents !== 0) {
                    throw new Error("REFUND_SUMMARY_AMOUNT_MISMATCH");
                }
            }
            continue;
        }

        const successfulCents = successfulTransactions.reduce(
            (sum, transaction) =>
                sum + _amountToCents(transaction?.amount, "transaction.amount"),
            0
        );
        const summaryCents = _amountToCents(
            refund?.summary?.refunded,
            "summary.refunded"
        );
        if (summaryCents !== successfulCents) {
            throw new Error("REFUND_SUMMARY_AMOUNT_MISMATCH");
        }

        completed.push({
            refundId,
            refundAmount: summaryCents / 100,
        });
    }

    return completed;
}
