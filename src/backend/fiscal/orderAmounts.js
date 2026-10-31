/**
 * Resolve the authoritative amount of a Wix eCommerce order for the ledger.
 *
 * An explicit order total of zero is valid (for example, a fully discounted
 * order) and must never fall back to undiscounted unit prices.
 */
export function resolveOrderLedgerAmount(order) {
    const rawOrderTotal =
        order?.priceSummary?.total?.amount ??
        order?.totals?.total?.amount;

    if (
        rawOrderTotal !== undefined &&
        rawOrderTotal !== null &&
        String(rawOrderTotal).trim() !== ""
    ) {
        const orderTotal = Number(rawOrderTotal);
        if (Number.isFinite(orderTotal) && orderTotal >= 0) {
            return orderTotal;
        }
    }

    const lineItems = Array.isArray(order?.lineItems) ? order.lineItems : [];
    return lineItems.reduce((sum, item) => {
        const rawLineTotal =
            item?.totalPriceAfterTax?.amount ??
            item?.totalPriceBeforeTax?.amount ??
            item?.totalPrice?.amount;

        if (
            rawLineTotal !== undefined &&
            rawLineTotal !== null &&
            String(rawLineTotal).trim() !== ""
        ) {
            const lineTotal = Number(rawLineTotal);
            if (Number.isFinite(lineTotal) && lineTotal >= 0) {
                return sum + lineTotal;
            }
        }

        const rawUnitPrice = item?.price?.amount ?? item?.price;
        const unitPrice = Number(rawUnitPrice);
        const quantity = Number(item?.quantity) || 1;
        return sum + (
            Number.isFinite(unitPrice) && unitPrice >= 0
                ? unitPrice * quantity
                : 0
        );
    }, 0);
}
