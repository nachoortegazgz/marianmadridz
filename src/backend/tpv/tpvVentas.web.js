import { Permissions, webMethod } from "wix-web-module";
import { getMyStaffContext, requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { TPV_QA_COLLECTIONS, TPV_QA_RUNTIME_POLICY } from "backend/internalConfig";
import { validateSaleDraft } from "backend/tpv/tpvValidation";
import { appendQaAudit, insertQaEvent, latestOpenQaSession } from "backend/tpv/tpvQaRepository";
import { assertTpvQaEnabled, makeQaId, normalizeClientIdempotencyKey } from "backend/tpv/tpvUtils";

function disabledResult(code) {
    return {
        status: "ERROR",
        data: null,
        error: { code, message: "La escritura en el circuito operativo/fiscal permanece bloqueada." },
        persisted: false,
        realPayment: false,
    };
}

export const validarVentaBorrador = webMethod(
    Permissions.SiteMember,
    async (venta) => {
        await requireCajero(makeTraceId("tpv-sale-validate"));
        try {
            return { status: "SUCCESS", data: validateSaleDraft(venta), error: null };
        } catch (error) {
            return {
                status: "ERROR",
                data: null,
                error: { code: String(error?.message || "TPV_SALE_VALIDATION_FAILED"), message: "El borrador no supera las validaciones." },
            };
        }
    }
);

// The legacy writer is intentionally blocked. Only registrarVenta writes,
// and it can write exclusively to TPV_QA_* collections.
export const registrarVentaOperativaDeshabilitada = webMethod(
    Permissions.SiteMember,
    async () => {
        await requireCajero(makeTraceId("tpv-sale-write-block"));
        return disabledResult("TPV_OPERATIONAL_SALE_WRITES_DISABLED");
    }
);

export const registrarVenta = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-qa-sale");
        await requireCajero(traceId);
        assertTpvQaEnabled();
        try {
            const key = normalizeClientIdempotencyKey(input.idempotencyKey);
            const session = await latestOpenQaSession();
            if (!session) throw new Error("TPV_QA_SESSION_NOT_OPEN");
            if (input.sessionId && input.sessionId !== session.sessionId) throw new Error("TPV_QA_SESSION_MISMATCH");

            const sale = validateSaleDraft({
                lineas: input.lineas,
                pagos: input.pagos,
                subtotalNeto: input.subtotalNeto,
                impuestosTotal: input.impuestosTotal,
                totalVenta: input.totalVenta,
            });
            if (sale.importePendiente !== 0 || sale.totalVenta <= 0) throw new Error("TPV_QA_SALE_MUST_BE_FULLY_PAID");

            const staff = await getMyStaffContext(traceId);
            const saleId = makeQaId("SALE", key);
            const createdAt = new Date();
            const commonPayload = {
                sessionId: session.sessionId,
                saleId,
                ticketId: saleId,
                professionalId: String(input.profesionalId || "").slice(0, 100) || null,
                customerLabel: "CLIENTE ANONIMO QA",
                source: "TPV_QA",
                traceId,
            };

            await insertQaEvent(TPV_QA_COLLECTIONS.VENTAS, key + ":PREPARED", {
                saleId,
                status: "PREPARADA_SINTETICA",
                currency: "EUR",
                subtotalMinor: Math.round(sale.subtotalNeto * 100),
                discountMinor: sale.lineas.reduce((sum, line) => sum + Math.round(line.descuentoImporte * 100), 0),
                taxMinor: Math.round(sale.impuestosTotal * 100),
                totalMinor: Math.round(sale.totalVenta * 100),
                paidMinor: Math.round(sale.importePagado * 100),
                pendingMinor: 0,
                cashierMemberId: staff?.memberId || "UNKNOWN",
                createdAt,
                traceId,
                environment: TPV_QA_RUNTIME_POLICY.ENVIRONMENT,
                payload: { ...commonPayload, phase: "PREPARED" },
            });

            for (const line of sale.lineas) {
                const lineKey = key + ":LINE:" + String(line.lineaNumero).padStart(3, "0");
                await insertQaEvent(TPV_QA_COLLECTIONS.VENTA_LINEAS, lineKey, {
                    saleId,
                    lineNumber: line.lineaNumero,
                    lineType: line.tipoLinea,
                    catalogItemId: line.itemId || "",
                    description: line.concepto,
                    quantity: line.cantidad,
                    unitMinor: Math.round(line.precioUnitario * 100),
                    discountMinor: Math.round(line.descuentoImporte * 100),
                    taxMinor: Math.round(line.impuestosImporte * 100),
                    totalMinor: Math.round(line.totalLinea * 100),
                    professionalId: line.profesionalId || commonPayload.professionalId || "",
                    createdAt,
                    payload: { ...commonPayload, stockAffected: line.stockAfectado === true },
                });
            }

            for (let index = 0; index < sale.pagos.length; index += 1) {
                const payment = sale.pagos[index];
                const paymentKey = key + ":PAYMENT:" + String(index + 1).padStart(3, "0");
                await insertQaEvent(TPV_QA_COLLECTIONS.PAGOS, paymentKey, {
                    saleId,
                    paymentMethod: payment.medioPago,
                    amountMinor: Math.round(payment.importeAplicado * 100),
                    receivedMinor: Math.round(payment.importe * 100),
                    changeMinor: Math.round(payment.importeCambio * 100),
                    status: "CONFIRMADO_SINTETICO",
                    provider: "SIMULATED",
                    gatewayReference: "QA-NO-GATEWAY",
                    createdAt,
                    payload: { ...commonPayload, paymentIndex: index + 1, traceId },
                });
            }

            const { item: committed, replayed } = await insertQaEvent(TPV_QA_COLLECTIONS.VENTAS, key + ":COMMITTED", {
                saleId,
                status: "CONFIRMADA_SINTETICA",
                currency: "EUR",
                subtotalMinor: Math.round(sale.subtotalNeto * 100),
                discountMinor: sale.lineas.reduce((sum, line) => sum + Math.round(line.descuentoImporte * 100), 0),
                taxMinor: Math.round(sale.impuestosTotal * 100),
                totalMinor: Math.round(sale.totalVenta * 100),
                paidMinor: Math.round(sale.importePagado * 100),
                pendingMinor: 0,
                cashierMemberId: staff?.memberId || "UNKNOWN",
                createdAt,
                traceId,
                environment: TPV_QA_RUNTIME_POLICY.ENVIRONMENT,
                payload: {
                    ...commonPayload,
                    phase: "COMMITTED",
                    paymentBreakdownMinor: Object.fromEntries(
                        Object.entries(sale.desgloseMedios).map(([method, amount]) => [method, Math.round(amount * 100)])
                    ),
                },
            });

            await appendQaAudit({
                idempotencyKey: key + ":AUDIT",
                action: "VENTA_QA_CONFIRMADA",
                actorId: staff?.memberId || "UNKNOWN",
                entityType: "VENTA",
                entityId: saleId,
                traceId,
                payload: { totalMinor: Math.round(sale.totalVenta * 100), sessionId: session.sessionId },
            });

            return {
                status: "SUCCESS",
                data: {
                    saleId,
                    ticketId: saleId,
                    status: committed.status,
                    total: sale.totalVenta,
                    breakdown: sale.desgloseMedios,
                    replayed,
                    persisted: true,
                    isSynthetic: true,
                    realPayment: false,
                    gatewayCalled: false,
                    fiscalLedgerWritten: false,
                },
                error: null,
                traceId,
            };
        } catch (error) {
            return {
                status: "ERROR",
                data: null,
                error: { code: String(error?.message || "TPV_QA_SALE_FAILED") },
                persisted: false,
                isSynthetic: true,
                realPayment: false,
                traceId,
            };
        }
    }
);

export const procesarDevolucion = webMethod(
    Permissions.SiteMember,
    async () => {
        await requireCajero(makeTraceId("tpv-refund-write-block"));
        return disabledResult("TPV_OPERATIONAL_REFUNDS_DISABLED");
    }
);
