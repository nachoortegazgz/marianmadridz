import { Permissions, webMethod } from "wix-web-module";
import { requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { normalizePaymentMethod, toMinorUnits } from "backend/tpv/tpvUtils";

import { normalizeTpvError } from "backend/tpv/tpvError";
export const validarDesglosePagos = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-payment-validation");

        try {
            await requireCajero(traceId);
            if (!Array.isArray(input.payments) || input.payments.length === 0) {
                throw new Error("TPV_PAYMENTS_REQUIRED");
            }
            const totalMinor = toMinorUnits(input.total, "SALE_TOTAL");
            const breakdown = { EFECTIVO: 0, TARJETA: 0, BIZUM: 0, OTROS: 0 };
            const payments = input.payments.map((payment) => {
                const method = normalizePaymentMethod(payment?.medioPago);
                const receivedMinor = toMinorUnits(payment?.importe, "PAYMENT_AMOUNT");
                const changeMinor = toMinorUnits(payment?.importeCambio ?? 0, "CHANGE_AMOUNT");
                if (receivedMinor <= 0 || changeMinor > receivedMinor) throw new Error("TPV_PAYMENT_AMOUNT_INVALID");
                if (changeMinor > 0 && method !== "EFECTIVO") throw new Error("TPV_CHANGE_REQUIRES_CASH");
                const appliedMinor = receivedMinor - changeMinor;
                breakdown[method] += appliedMinor;
                return { medioPago: method, importe: receivedMinor / 100, importeCambio: changeMinor / 100, importeAplicado: appliedMinor / 100 };
            });
            const appliedMinor = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
            if (appliedMinor !== totalMinor) throw new Error("TPV_PAYMENT_TOTAL_MISMATCH");
            return {
                status: "SUCCESS",
                data: {
                    payments,
                    breakdown: Object.fromEntries(Object.entries(breakdown).map(([key, value]) => [key, value / 100])),
                    totalApplied: appliedMinor / 100,
                    physicalCash: breakdown.EFECTIVO / 100,
                },
                error: null,
                traceId,
            };
        } catch (error) {
            return { status: "ERROR", data: null, error: normalizeTpvError(error, "TPV_PAYMENT_VALIDATION_FAILED"), traceId };
        }
    }
);

