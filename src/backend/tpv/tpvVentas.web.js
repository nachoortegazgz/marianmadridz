import { Permissions, webMethod } from "wix-web-module";
import { resolveTpvContext } from "backend/tpv/tpvContext";
import { requireAdmin, requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { TPV_COLLECTIONS, TPV_IDENTITY_TYPES, TPV_RUNTIME_POLICY } from "backend/internalConfig";
import { listTpvIdentities, getTpvIdentity } from "backend/tpv/tpvSandboxIdentities";
import { validateSaleDraft } from "backend/tpv/tpvValidation";
import { appendTpvAudit, insertTpvEvent, latestOpenTpvSession, withTpvSessionLock } from "backend/tpv/tpvRepository";
import { makeTpvId, normalizeClientIdempotencyKey } from "backend/tpv/tpvUtils";

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
                error: { code: "TPV_SALE_VALIDATION_FAILED", reasonCode: String(error?.message || "TPV_SALE_VALIDATION_FAILED"), message: "El borrador no supera las validaciones." },
            };
        }
    }
);

export const registrarVenta = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        let persisted = false;
        const traceId = makeTraceId("tpv-sandbox-sale");
        await requireAdmin(traceId);
        const operator = await resolveTpvContext(traceId);

        try {
            const key = normalizeClientIdempotencyKey(input.idempotencyKey);
            const session = await latestOpenTpvSession();
            if (!session) throw new Error("TPV_SESSION_NOT_OPEN");
            if (input.sessionId && input.sessionId !== session.sessionId) throw new Error("TPV_SESSION_MISMATCH");

            const sale = validateSaleDraft({
                lineas: input.lineas,
                pagos: input.pagos,
                subtotalNeto: input.subtotalNeto,
                impuestosTotal: input.impuestosTotal,
                totalVenta: input.totalVenta,
            });
            if (sale.importePendiente !== 0 || sale.totalVenta <= 0) throw new Error("TPV_SALE_MUST_BE_FULLY_PAID");

            const customerIdentityId = String(input.customerIdentityId || "").trim();
            const bookingId = String(input.bookingId || "").trim();
            if (bookingId) throw new Error("TPV_BOOKINGS_DISABLED");
            const customer = customerIdentityId
                ? await getTpvIdentity(customerIdentityId, TPV_IDENTITY_TYPES.CUSTOMER)
                : null;
            if (customerIdentityId && !customer) throw new Error("TPV_CUSTOMER_NOT_ALLOWED");
            const staffIdentities = await listTpvIdentities(TPV_IDENTITY_TYPES.STAFF);
            const allowedProfessionalIds = new Set(staffIdentities.map((item) => item.identityId));
            const requestedProfessionalId = String(input.profesionalId || "").trim();
            if (requestedProfessionalId && !allowedProfessionalIds.has(requestedProfessionalId)) {
                throw new Error("TPV_STAFF_NOT_ALLOWED");
            }
            if (sale.lineas.some((line) => line.profesionalId && !allowedProfessionalIds.has(line.profesionalId))) {
                throw new Error("TPV_STAFF_NOT_ALLOWED");
            }

            return await withTpvSessionLock(session.sessionId, traceId, async () => {
                const activeSession = await latestOpenTpvSession();
                if (!activeSession || activeSession.sessionId !== session.sessionId) {
                    throw new Error("TPV_SESSION_CLOSED");
                }

            const saleId = makeTpvId("SALE", key);
            const createdAt = new Date();
            const commonPayload = {
                sessionId: session.sessionId,
                saleId,
                ticketId: saleId,
                professionalId: requestedProfessionalId || null,
                customerIdentityId: customer?.identityId || null,
                customerLabel: customer?.displayName || "CLIENTE ANONIMO",
                bookingId: null,
                bookingStatus: null,
                bookingPaymentStatus: null,
                bookingStartDate: null,
                bookingEndDate: null,
                bookingServiceId: null,
                bookingProfessionalId: null,
                bookingTitle: null,
                source: "TPV",
                traceId,
            };

            await insertTpvEvent(TPV_COLLECTIONS.VENTAS, key + ":PREPARED", {
                saleId,
                status: "PREPARADA_SINTETICA",
                currency: "EUR",
                subtotalMinor: Math.round(sale.subtotalNeto * 100),
                discountMinor: sale.lineas.reduce((sum, line) => sum + Math.round(line.descuentoImporte * 100), 0),
                taxMinor: Math.round(sale.impuestosTotal * 100),
                totalMinor: Math.round(sale.totalVenta * 100),
                paidMinor: Math.round(sale.importePagado * 100),
                pendingMinor: 0,
                cashierMemberId: operator.operatorId,
                actorId: operator.actorId,
                operatorId: operator.operatorId,
                operatorResourceId: operator.operatorResourceId,
                profesionalId: requestedProfessionalId,
                createdAt,
                traceId,
                payload: { ...commonPayload, phase: "PREPARED" },
            });
            persisted = true;

            for (const line of sale.lineas) {
                const lineKey = key + ":LINE:" + String(line.lineaNumero).padStart(3, "0");
                await insertTpvEvent(TPV_COLLECTIONS.VENTA_LINEAS, lineKey, {
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
                await insertTpvEvent(TPV_COLLECTIONS.PAGOS, paymentKey, {
                    saleId,
                    paymentMethod: payment.medioPago,
                    amountMinor: Math.round(payment.importeAplicado * 100),
                    receivedMinor: Math.round(payment.importe * 100),
                    changeMinor: Math.round(payment.importeCambio * 100),
                    status: "CONFIRMADO_SINTETICO",
                    provider: "SIMULATED",
                    gatewayReference: "NO-GATEWAY",
                    createdAt,
                    payload: { ...commonPayload, paymentIndex: index + 1, traceId },
                });
            }

            const { item: committed, replayed } = await insertTpvEvent(TPV_COLLECTIONS.VENTAS, key + ":COMMITTED", {
                saleId,
                status: "CONFIRMADA_SINTETICA",
                currency: "EUR",
                subtotalMinor: Math.round(sale.subtotalNeto * 100),
                discountMinor: sale.lineas.reduce((sum, line) => sum + Math.round(line.descuentoImporte * 100), 0),
                taxMinor: Math.round(sale.impuestosTotal * 100),
                totalMinor: Math.round(sale.totalVenta * 100),
                paidMinor: Math.round(sale.importePagado * 100),
                pendingMinor: 0,
                cashierMemberId: operator.operatorId,
                createdAt,
                traceId,
                payload: {
                    ...commonPayload,
                    phase: "COMMITTED",
                    paymentBreakdownMinor: Object.fromEntries(
                        Object.entries(sale.desgloseMedios).map(([method, amount]) => [method, Math.round(amount * 100)])
                    ),
                },
            });

            await appendTpvAudit({
                idempotencyKey: key + ":AUDIT",
                action: "VENTA_CONFIRMADA",
                actorId: operator.operatorId,
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
                    customerIdentityId: commonPayload.customerIdentityId,
                    customerLabel: commonPayload.customerLabel,
                    bookingId: commonPayload.bookingId,
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
            });
        } catch (error) {
            return {
                status: "ERROR",
                data: null,
                error: { code: String(error?.message || "TPV_SALE_FAILED") },
                persisted,
                recoverable: persisted,
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
