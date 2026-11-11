import test from "node:test";
import assert from "node:assert/strict";
import { resolveCompletedRefunds } from "backend/refundTransactions.js";

const refund = (overrides = {}) => ({
    id: "refund-11111111",
    transactions: [
        { paymentId: "payment-1", refundStatus: "SUCCEEDED", amount: { amount: "10.00" } },
    ],
    summary: { refunded: { amount: "10.00" } },
    ...overrides,
});

test("REFUND-TX-01 defers pending, started, scheduled and unknown transaction states", () => {
    for (const refundStatus of ["PENDING", "STARTED", "SCHEDULED", "UNKNOWN"]) {
        const result = resolveCompletedRefunds({
            refunds: [refund({
                transactions: [
                    { refundStatus: "SUCCEEDED", amount: { amount: "10.00" } },
                    { refundStatus, amount: { amount: "5.00" } },
                ],
            })],
        });
        assert.deepEqual(result, [], refundStatus + " must not be fiscally processed");
    }
});

test("REFUND-TX-02 ignores a refund whose terminal transactions all failed", () => {
    const result = resolveCompletedRefunds({
        refunds: [refund({
            transactions: [
                { refundStatus: "FAILED", amount: { amount: "10.00" } },
            ],
            summary: { refunded: { amount: "0.00" } },
        })],
    });
    assert.deepEqual(result, []);
});

test("REFUND-TX-03 accepts only the successful amount in a terminal mixed refund", () => {
    const result = resolveCompletedRefunds({
        refunds: [refund({
            transactions: [
                { refundStatus: "SUCCEEDED", amount: { amount: "10.00" } },
                { refundStatus: "FAILED", amount: { amount: "4.00" } },
            ],
            summary: { refunded: { amount: "10.00" } },
        })],
    });
    assert.deepEqual(result, [{
        refundId: "refund-11111111",
        refundAmount: 10,
    }]);
});

test("REFUND-TX-04 rejects a mismatch between successful transaction totals and Wix summary", () => {
    assert.throws(
        () => resolveCompletedRefunds({
            refunds: [refund({
                transactions: [
                    { refundStatus: "SUCCEEDED", amount: { amount: "10.00" } },
                    { refundStatus: "FAILED", amount: { amount: "4.00" } },
                ],
                summary: { refunded: { amount: "14.00" } },
            })],
        }),
        /REFUND_SUMMARY_AMOUNT_MISMATCH/
    );
});

test("REFUND-TX-05 rejects missing and duplicate refund identities", () => {
    assert.throws(
        () => resolveCompletedRefunds({ refunds: [refund({ id: "" })] }),
        /REFUND_ID_MISSING/
    );
    assert.throws(
        () => resolveCompletedRefunds({ refunds: [refund(), refund()] }),
        /REFUND_DUPLICATE_ID_IN_ORDER/
    );
});

test("REFUND-TX-06 rejects malformed successful transaction amounts", () => {
    assert.throws(
        () => resolveCompletedRefunds({
            refunds: [refund({
                transactions: [
                    { refundStatus: "SUCCEEDED", amount: { amount: "not-a-number" } },
                ],
            })],
        }),
        /REFUND_AMOUNT_INVALID/
    );
});

test("REFUND-TX-07 rejects a positive summary when every refund transaction failed", () => {
    assert.throws(
        () => resolveCompletedRefunds({
            refunds: [refund({
                transactions: [
                    { refundStatus: "FAILED", amount: { amount: "10.00" } },
                ],
                summary: { refunded: { amount: "10.00" } },
            })],
        }),
        /REFUND_SUMMARY_AMOUNT_MISMATCH/
    );
});
