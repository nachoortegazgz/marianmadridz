import { auth } from "@wix/essentials";
import { orders, orderTransactions } from "@wix/ecom";
import { buildTpvNativeOrderPayload } from "backend/tpv/tpvNativeOrderPayload";
import { fromMinorUnits, toMinorUnits } from "backend/tpv/tpvUtils";

const createOrderElevated = auth.elevate(orders.createOrder);
const getOrderElevated = auth.elevate(orders.getOrder);
const searchOrdersElevated = auth.elevate(orders.searchOrders);
const cancelOrderElevated = auth.elevate(orders.cancelOrder);
const addPaymentsElevated = auth.elevate(orderTransactions.addPayments);
const listTransactionsElevated = auth.elevate(orderTransactions.listTransactionsForSingleOrder);

function fail(code, cause) {
    const error = new Error(code);
    error.code = code;
    if (cause) error.cause = cause;
    throw error;
}

function unwrapOrder(response) {
    return response?.order || response?.data?.order || response?.data || response;
}

function orderIdOf(order) {
    return String(order?._id || order?.id || "");
}

function extractPayments(response) {
    const value = response?.orderTransactions || response?.data?.orderTransactions ||
        response?.data || response;
    return Array.isArray(value?.payments) ? value.payments : [];
}

function paymentMethod(payment) {
    return payment?.regularPaymentDetails?.paymentMethodName?.userDefinedName?.predefined ||
        payment?.regularPaymentDetails?.paymentMethodName?.predefined ||
        null;
}

function paymentAmountMinor(payment) {
    const amount = payment?.amount?.amount ?? payment?.amount;
    return toMinorUnits(amount, "WIX_ORDER_PAYMENT_AMOUNT");
}

function isCashPayment(payment, amountMinor) {
    return payment?.regularPaymentDetails?.offlinePayment === true &&
        paymentMethod(payment) === "CASH" &&
        paymentAmountMinor(payment) === amountMinor;
}

function normalizeOrder(order) {
    const orderId = orderIdOf(order);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
        fail("TPV_WIX_ORDER_ID_INVALID");
    }
    return {
        orderId,
        orderNumber: order.number ?? order.orderNumber ?? null,
        externalOrderId: order.channelInfo?.externalOrderId || null,
        status: order.status || null,
        paymentStatus: order.paymentStatus || null,
        currency: order.currency || null,
        totalMinor: toMinorUnits(order.priceSummary?.total?.amount, "WIX_ORDER_TOTAL"),
        createdDate: order._createdDate || order.createdDate || null,
        raw: order,
    };
}

async function searchOrdersByExternalId({ externalOrderId, startedAt, buyer }) {
    const start = new Date(startedAt).getTime();
    if (!Number.isFinite(start)) fail("TPV_ORDER_RECOVERY_START_DATE_INVALID");

    const filterParts = [
        { purchasedDate: { $gte: new Date(start - 15 * 60 * 1000).toISOString() } },
        { purchasedDate: { $lte: new Date(Date.now() + 60 * 1000).toISOString() } },
    ];
    if (buyer?.contactId) {
        filterParts.push({ "buyerInfo.contactId": String(buyer.contactId) });
    }

    const matches = [];
    let cursor = null;
    let pageCount = 0;
    do {
        const response = await searchOrdersElevated({
            filter: { $and: filterParts },
            sort: [{ fieldName: "purchasedDate", order: "DESC" }],
            cursorPaging: {
                limit: 100,
                ...(cursor ? { cursor } : {}),
            },
        });
        const page = response?.orders || response?.data?.orders || [];
        for (const order of page) {
            if (order?.channelInfo?.externalOrderId === externalOrderId) matches.push(order);
        }
        cursor = response?.metadata?.cursors?.next ||
            response?.pagingMetadata?.cursors?.next ||
            null;
        pageCount += 1;
        if (pageCount > 100) fail("TPV_ORDER_RECOVERY_PAGE_LIMIT");
    } while (cursor);

    if (matches.length > 1) fail("TPV_WIX_ORDER_EXTERNAL_ID_DUPLICATED");
    return matches[0] || null;
}

export async function findTpvNativeOrderByExternalId(input = {}) {
    const externalOrderId = String(input.externalOrderId || "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(externalOrderId)) {
        fail("TPV_ORDER_EXTERNAL_ID_INVALID");
    }
    const order = await searchOrdersByExternalId({
        externalOrderId,
        startedAt: input.startedAt,
        buyer: input.buyer || {},
    });
    return order ? normalizeOrder(order) : null;
}

export async function createTpvNativeOrder(prepared, buyer, externalOrderId, startedAt) {
    const payload = buildTpvNativeOrderPayload(prepared, buyer || {}, externalOrderId);
    let response;
    try {
        response = await createOrderElevated(payload.order, payload.options);
    } catch (error) {
        const recovered = await findTpvNativeOrderByExternalId({
            externalOrderId,
            startedAt,
            buyer,
        });
        if (recovered) {
            if (recovered.status !== "APPROVED" || recovered.paymentStatus !== "NOT_PAID") {
                fail("TPV_WIX_ORDER_RECOVERED_WITH_UNEXPECTED_STATE");
            }
            return recovered;
        }
        fail("TPV_WIX_ORDER_CREATE_UNKNOWN", error);
    }

    let order = unwrapOrder(response);
    let normalized;
    try {
        normalized = normalizeOrder(order);
    } catch {
        normalized = null;
    }
    if (!normalized || normalized.externalOrderId !== externalOrderId) {
        const recovered = await findTpvNativeOrderByExternalId({
            externalOrderId,
            startedAt,
            buyer,
        });
        if (!recovered) fail("TPV_WIX_ORDER_CREATE_UNKNOWN");
        normalized = recovered;
    }

    if (normalized.status !== "APPROVED" || normalized.paymentStatus !== "NOT_PAID") {
        fail("TPV_WIX_ORDER_CREATED_WITH_UNEXPECTED_STATE");
    }
    return normalized;
}

export async function readTpvNativeOrder(orderId) {
    const response = await getOrderElevated(String(orderId));
    return normalizeOrder(unwrapOrder(response));
}

export async function listTpvNativeOrderPayments(orderId) {
    const response = await listTransactionsElevated(String(orderId));
    return extractPayments(response);
}

/**
 * Records cash already physically received by the cashier.
 * Wix Add Payments records the tender; it does not collect the cash.
 */
export async function addTpvNativeCashPayment(orderId, amountMinor) {
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
        fail("TPV_CASH_PAYMENT_AMOUNT_INVALID");
    }

    const order = await readTpvNativeOrder(orderId);
    if (order.status !== "APPROVED" || order.paymentStatus !== "NOT_PAID") {
        fail("TPV_WIX_ORDER_NOT_PAYABLE");
    }
    if (amountMinor !== order.totalMinor) fail("TPV_WRITE_V1_PAYMENT_TOTAL_MISMATCH");

    const existing = await listTpvNativeOrderPayments(orderId);
    const matchingExisting = existing.filter((payment) => isCashPayment(payment, amountMinor));
    if (matchingExisting.length > 1) fail("TPV_WIX_CASH_PAYMENT_DUPLICATED");
    let payment = matchingExisting[0] || null;

    if (!payment && existing.length > 0) {
        fail("TPV_WIX_ORDER_ALREADY_HAS_PAYMENTS");
    }

    if (!payment) {
        const amount = fromMinorUnits(amountMinor).toFixed(2);
        try {
            await addPaymentsElevated(orderId, [{
                amount: { amount },
                refundDisabled: false,
                status: "APPROVED",
                regularPaymentDetails: {
                    offlinePayment: true,
                    paymentMethodName: {
                        userDefinedName: { predefined: "CASH" },
                    },
                },
            }]);
        } catch (error) {
            const afterError = await listTpvNativeOrderPayments(orderId);
            const recovered = afterError.filter((item) => isCashPayment(item, amountMinor));
            if (recovered.length !== 1) fail("TPV_WIX_CASH_PAYMENT_WRITE_UNKNOWN", error);
            payment = recovered[0];
        }
    }

    if (!payment) {
        const afterWrite = await listTpvNativeOrderPayments(orderId);
        const matches = afterWrite.filter((item) => isCashPayment(item, amountMinor));
        if (matches.length !== 1) fail("TPV_WIX_CASH_PAYMENT_READBACK_FAILED");
        payment = matches[0];
    }

    const paymentId = String(payment?._id || payment?.id || "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paymentId) ||
        payment.status !== "APPROVED") {
        fail("TPV_WIX_CASH_PAYMENT_NOT_APPROVED");
    }

    const updatedOrder = await readTpvNativeOrder(orderId);
    if (updatedOrder.paymentStatus !== "PAID") {
        fail("TPV_WIX_ORDER_PAYMENT_STATUS_PENDING");
    }

    return {
        paymentId,
        amountMinor,
        status: payment.status,
        paymentStatus: updatedOrder.paymentStatus,
        orderId: updatedOrder.orderId,
    };
}

export async function cancelTpvNativeOrder(orderId) {
    const order = await readTpvNativeOrder(orderId);
    if (order.paymentStatus !== "NOT_PAID") {
        fail("TPV_WIX_ORDER_HAS_PAYMENTS_REQUIRES_REFUND");
    }
    await cancelOrderElevated(orderId, {
        sendOrderCanceledEmail: false,
        restockAllItems: true,
    });
    const canceled = await readTpvNativeOrder(orderId);
    if (canceled.status !== "CANCELED") fail("TPV_WIX_ORDER_CANCEL_READBACK_FAILED");
    return canceled;
}
