import { Permissions, webMethod } from "wix-web-module";
import { getTpvOperatorContext } from "backend/tpv/tpvOperatorContext";
import { requireAdmin } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { TPV_COLLECTIONS, TPV_RUNTIME_POLICY } from "backend/internalConfig";
import { appendSandboxAudit, insertSandboxEvent, latestOpenSandboxSession, querySandboxRecords, withSandboxSaleLock } from "backend/tpv/tpvSandboxRepository";
import { makeSandboxId, normalizeClientIdempotencyKey, toMinorUnits } from "backend/tpv/tpvUtils";
import { wql } from "backend/dataAccess";

export const registrarDevolucion = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        let persisted = false;
        const traceId = makeTraceId("tpv-sandbox-refund");
        await requireAdmin(traceId);
        const operator = await getTpvOperatorContext(traceId);

        try {
            const key = normalizeClientIdempotencyKey(input.idempotencyKey);
            const saleId = String(input.saleId || "").trim();
            const reason = String(input.reason || "").trim();
            if (!saleId || reason.length < 3 || reason.length > 500) throw new Error("TPV_REFUND_REFERENCE_AND_REASON_REQUIRED");
            const session = await latestOpenSandboxSession();
            if (!session) throw new Error("TPV_SESSION_NOT_OPEN");

            return await withSandboxSaleLock(saleId, traceId, async () => {
            const activeSession = await latestOpenSandboxSession();
            if (!activeSession || activeSession.sessionId !== session.sessionId) {
                throw new Error("TPV_SESSION_CLOSED");
            }
            const sales = await querySandboxRecords(TPV_COLLECTIONS.VENTAS, wql.eq("saleId", saleId));
            const original = sales.find((sale) => sale.status === "CONFIRMADA_SINTETICA");
            if (!original) throw new Error("TPV_ORIGINAL_SALE_NOT_FOUND");
            if (original.payload?.sessionId !== session.sessionId) throw new Error("TPV_REFUND_SESSION_MISMATCH");

            const refundId = makeSandboxId("REFUND", key);
            const originalPayments = await querySandboxRecords(TPV_COLLECTIONS.PAGOS, wql.eq("saleId", saleId));
            const remainingByMethod = { EFECTIVO: 0, TARJETA: 0, BIZUM: 0, OTROS: 0 };
            for (const payment of originalPayments) {
                if (payment.status !== "CONFIRMADO_SINTETICO") continue;
                if (Object.prototype.hasOwnProperty.call(remainingByMethod, payment.paymentMethod)) {
                    remainingByMethod[payment.paymentMethod] += Number(payment.amountMinor || 0);
                }
            }
            const priorRefunds = await querySandboxRecords(TPV_COLLECTIONS.REEMBOLSOS, wql.eq("saleId", saleId));
            for (const refund of priorRefunds) {
                if (refund.refundId === refundId || refund.status !== "CONFIRMADO_SINTETICO" || refund.payload?.sessionId !== session.sessionId) continue;
                const allocations = refund.payload?.allocations || [];
                for (const allocation of allocations) {
                    if (Object.prototype.hasOwnProperty.call(remainingByMethod, allocation.paymentMethod)) {
                        remainingByMethod[allocation.paymentMethod] -= Number(allocation.amountMinor || 0);
                    }
                }
            }

            if (!Array.isArray(input.payments) || input.payments.length === 0) throw new Error("TPV_REFUND_PAYMENTS_REQUIRED");
            const allocations = input.payments.map((payment) => {
                const method = String(payment.paymentMethod || "").trim().toUpperCase();
                if (!Object.prototype.hasOwnProperty.call(remainingByMethod, method)) throw new Error("TPV_REFUND_METHOD_INVALID");
                const amountMinor = toMinorUnits(payment.amount, "REFUND_AMOUNT");
                if (amountMinor <= 0 || amountMinor > remainingByMethod[method]) throw new Error("TPV_REFUND_EXCEEDS_REMAINING");
                remainingByMethod[method] -= amountMinor;
                return { paymentMethod: method, amountMinor };
            });
            const amountMinor = allocations.reduce((sum, item) => sum + item.amountMinor, 0);
            if (amountMinor <= 0) throw new Error("TPV_REFUND_AMOUNT_INVALID");

            const method = allocations.every((item) => item.paymentMethod === allocations[0].paymentMethod)
                ? allocations[0].paymentMethod : "MIXTO";

            await insertSandboxEvent(TPV_COLLECTIONS.REEMBOLSOS, key + ":REFUND", {
                saleId,
                refundId,
                amountMinor,
                paymentMethod: method,
                reason,
                status: "CONFIRMADO_SINTETICO",
                createdAt: new Date(),
                payload: { sessionId: session.sessionId, allocations, actorId: operator.actorId, operatorId: operator.operatorId, traceId },
            });
            persisted = true;

            for (let index = 0; index < allocations.length; index += 1) {
                const allocation = allocations[index];
                await insertSandboxEvent(TPV_COLLECTIONS.PAGOS, key + ":PAYMENT:" + String(index + 1).padStart(3, "0"), {
                    saleId,
                    paymentMethod: allocation.paymentMethod,
                    amountMinor: -allocation.amountMinor,
                    receivedMinor: 0,
                    changeMinor: 0,
                    status: "REEMBOLSO_SINTETICO",
                    provider: "SIMULATED",
                    gatewayReference: "NO-GATEWAY",
                    createdAt: new Date(),
                    payload: { sessionId: session.sessionId, refundId, traceId },
                });
                if (allocation.paymentMethod === "EFECTIVO") {
                    await insertSandboxEvent(TPV_COLLECTIONS.MOVIMIENTOS_CAJA, key + ":CASH:" + String(index + 1).padStart(3, "0"), {
                        sessionId: session.sessionId,
                        movementType: "DEVOLUCION_EFECTIVO",
                        amountMinor: allocation.amountMinor,
                        paymentMethod: "EFECTIVO",
                        reason,
                        status: "CONFIRMADO_SINTETICO",
                        createdAt: new Date(),
                        payload: { saleId, refundId, traceId, affectsPhysicalCash: true },
                    });
                }
            }

            await appendSandboxAudit({
                idempotencyKey: key + ":AUDIT",
                action: "DEVOLUCION_SANDBOX_CONFIRMADA",
                actorId: operator.operatorId,
                entityType: "DEVOLUCION",
                entityId: refundId,
                traceId,
                payload: { saleId, amountMinor, allocations, reason },
            });

            return {
                status: "SUCCESS",
                data: { refundId, saleId, amount: amountMinor / 100, paymentMethod: method, allocations, isSynthetic: true, realPayment: false, gatewayCalled: false, persisted: true },
                error: null,
                traceId,
            };
            }, session.sessionId);
        } catch (error) {
            return { status: "ERROR", data: null, error: { code: String(error?.message || "TPV_REFUND_FAILED") }, persisted, recoverable: persisted, isSynthetic: true, realPayment: false, traceId };
        }
    }
);
