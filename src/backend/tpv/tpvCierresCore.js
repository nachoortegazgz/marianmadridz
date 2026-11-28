import { SDK_CONFIG, TPV_PAYMENT_METHOD } from "backend/internalConfig";
import {
    getCommittedTpvSales,
    getPendingTpvSales,
    getTpvCashMovements,
    getTpvPayments,
    getTpvRefunds,
} from "backend/tpv/tpvRepository";

export async function buildTpvSessionSummary(session) {
    if (!session?.sessionId) throw new Error("TPV_SESSION_REQUIRED");
    const [sales, pendingSales, payments, refunds, movements] = await Promise.all([
        getCommittedTpvSales(session.sessionId),
        getPendingTpvSales(session.sessionId),
        getTpvPayments(session.sessionId),
        getTpvRefunds(session.sessionId),
        getTpvCashMovements(session.sessionId),
    ]);

    const totals = {
        sessionId: session.sessionId,
        currency: SDK_CONFIG.CURRENCY_CODE,
        ticketCount: sales.length,
        pendingSalesCount: pendingSales.length,
        pendingSalesGrossMinor: pendingSales.reduce((sum, sale) => {
            const amountMinor = Number(sale.totalVentaMinor);
            if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
                throw new Error("TPV_PENDING_SALE_AMOUNT_INVALID");
            }
            return sum + amountMinor;
        }, 0),
        refundCount: refunds.length,
        grossSalesMinor: sales.reduce((sum, sale) => sum + Number(sale.totalMinor || 0), 0),
        discountsMinor: sales.reduce((sum, sale) => sum + Number(sale.discountMinor || 0), 0),
        taxMinor: sales.reduce((sum, sale) => sum + Number(sale.taxMinor || 0), 0),
        totalRefundsMinor: refunds.reduce((sum, refund) => sum + Number(refund.amountMinor || 0), 0),
        cashMinor: 0,
        cardMinor: 0,
        bizumMinor: 0,
        bonoMinor: 0,
        giftCardMinor: 0,
        otherMinor: 0,
        cashInMinor: 0,
        cashOutMinor: 0,
        serviceSalesMinor: 0,
        productSalesMinor: 0,
        openingCashMinor: Number(session.openingCashMinor || 0),
        expectedCashMinor: 0,
    };

    for (const payment of payments) {
        const amount = Number(payment.amountMinor || 0);
        switch (payment.paymentMethod) {
        case "EFECTIVO": totals.cashMinor += amount; break;
        case "TARJETA": totals.cardMinor += amount; break;
        case "BIZUM": totals.bizumMinor += amount; break;
        case TPV_PAYMENT_METHOD.BONO: totals.bonoMinor += amount; break;
        case TPV_PAYMENT_METHOD.TARJETA_REGALO: totals.giftCardMinor += amount; break;
        case TPV_PAYMENT_METHOD.OTROS: totals.otherMinor += amount; break;
        default: throw new Error("TPV_PAYMENT_METHOD_CORRUPTED");
        }
    }

    for (const sale of sales) {
        for (const line of Array.isArray(sale.lineas) ? sale.lineas : []) {
            const amountMinor = Number(line.totalMinor);
            if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
                throw new Error("TPV_SALE_LINE_AMOUNT_INVALID");
            }
            if (line.tipoLinea === "SERVICIO") totals.serviceSalesMinor += amountMinor;
            else if (line.tipoLinea === "PRODUCTO") totals.productSalesMinor += amountMinor;
            else throw new Error("TPV_SALE_LINE_TYPE_INVALID");
        }
    }

    for (const movement of movements) {
        if (movement.status !== "CONFIRMADO") continue;
        const amount = Number(movement.amountMinor || 0);
        if (movement.movementType === "ENTRADA") totals.cashInMinor += amount;
        if (movement.movementType === "SALIDA" || movement.movementType === "RETIRADA") totals.cashOutMinor += amount;
    }

    totals.netSalesMinor = totals.grossSalesMinor - totals.totalRefundsMinor;
    totals.totalCollectedMinor = totals.cashMinor + totals.cardMinor + totals.bizumMinor + totals.bonoMinor + totals.giftCardMinor + totals.otherMinor;
    totals.expectedCashMinor = totals.openingCashMinor + totals.cashMinor + totals.cashInMinor - totals.cashOutMinor;
    totals.reconciliationOk = totals.totalCollectedMinor === totals.netSalesMinor;

    return totals;
}
