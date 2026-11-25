import { Permissions, webMethod } from "wix-web-module";
import { requireAdmin } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { error as tpvError } from "backend/tpv/tpvEnvelope";

const SUPPORTED_REFUND_METHODS = new Set(["EFECTIVO", "TARJETA"]);

function validateRefundRequest(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new Error("TPV_REFUND_INPUT_INVALID");
    }
    const saleId = String(input.saleId || "").trim();
    const sessionId = String(input.sessionId || "").trim();
    const reason = String(input.reason || "").trim();
    const payments = Array.isArray(input.payments) ? input.payments : [];
    if (!saleId || saleId.length > 160 || !sessionId || sessionId.length > 160 ||
        reason.length < 3 || reason.length > 500 || payments.length !== 1) {
        throw new Error("TPV_REFUND_INPUT_INVALID");
    }
    const payment = payments[0];
    const paymentMethod = String(payment?.paymentMethod || "").trim().toUpperCase();
    const amount = Number(payment?.amount);
    const amountMinor = Math.round((amount + Number.EPSILON) * 100);
    if (!SUPPORTED_REFUND_METHODS.has(paymentMethod) ||
        !Number.isFinite(amount) ||
        !Number.isSafeInteger(amountMinor) ||
        amountMinor <= 0 ||
        Math.abs(amount * 100 - amountMinor) > 1e-7) {
        throw new Error("TPV_REFUND_INPUT_INVALID");
    }
    return {
        saleId,
        sessionId,
        reason,
        paymentMethod,
        amount: amountMinor / 100,
        idempotencyKey: String(input.idempotencyKey || "").trim().slice(0, 120),
    };
}

export const registrarDevolucion = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-refund-write-block");
        await requireAdmin(traceId);
        let request;
        try {
            request = validateRefundRequest(input);
        } catch (error) {
            return tpvError(
                "TPV_REFUND_INPUT_INVALID",
                "La solicitud de devolución no contiene una venta, sesión, motivo o importe válidos.",
                ["Envía la venta original, la sesión actual, un motivo y un único medio de devolución EFECTIVO o TARJETA con importe positivo."],
                {
                    persisted: false,
                    recoverable: true,
                    retryable: false,
                    requiresReconciliation: false,
                    traceId,
                }
            );
        }
        return tpvError(
            "TPV_REFUND_PROVIDER_NOT_CONFIGURED",
            "La solicitud de devolución se ha validado, pero no se ha registrado ni ejecutado.",
            [
                "El proveedor de pagos y la conciliación de devoluciones no están configurados.",
                "No se ha modificado el ledger, no se ha emitido una factura rectificativa y no se ha ejecutado un reembolso real.",
            ],
            {
                persisted: false,
                recoverable: false,
                retryable: false,
                requiresReconciliation: false,
                originalSaleId: request.saleId,
                sessionId: request.sessionId,
                paymentMethod: request.paymentMethod,
                amount: request.amount,
                traceId,
            }
        );
    }
);
