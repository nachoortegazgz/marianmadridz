/**
 * TPV HTML bridge.
 * Transport only: all validation, authorization, idempotency and persistence
 * remain in the backend WebMethods.
 */
import { createWidgetBridge, MESSAGE_TYPES, PROTOCOL_VERSION } from "public/widgetBridge";
import { obtenerEstadoCaja, abrirSesionCaja } from "backend/tpv/tpvCaja.web";
import { obtenerServicios, obtenerProductos, obtenerStaff } from "backend/tpv/tpvCatalogo.web";
import { registrarVenta } from "backend/tpv/tpvVentas.web";
import { registrarMovimientoCaja } from "backend/tpv/tpvMovimientos.web";
import { registrarDevolucion } from "backend/tpv/tpvDevoluciones.web";
import { generarControlX, generarCierreZ, obtenerResumenCaja } from "backend/tpv/tpvCierres.web";
import { obtenerMovimientosCaja } from "backend/tpv/tpvAuditoria.web";

const REQUEST_TYPES = Object.freeze([
    "CASHIER_STATE",
    "SESSION_OPEN",
    "CATALOG_SERVICES",
    "CATALOG_PRODUCTS",
    "CATALOG_STAFF",
    "SALE_REGISTER",
    "CASH_MOVEMENT",
    "REFUND",
    "TICKET_X",
    "TICKET_Z",
    "SESSION_SUMMARY",
    "AUDIT_LIST",
]);

const RESPONSE_TYPES = Object.freeze({
    CASHIER_STATE: "CASHIER_STATE_RES",
    SESSION_OPEN: "SESSION_OPEN_RES",
    CATALOG_SERVICES: "CATALOG_SERVICES_RES",
    CATALOG_PRODUCTS: "CATALOG_PRODUCTS_RES",
    CATALOG_STAFF: "CATALOG_STAFF_RES",
    SALE_REGISTER: "SALE_REGISTER_RES",
    CASH_MOVEMENT: "CASH_MOVEMENT_RES",
    REFUND: "REFUND_RES",
    TICKET_X: "TICKET_X_RES",
    TICKET_Z: "TICKET_Z_RES",
    SESSION_SUMMARY: "SESSION_SUMMARY_RES",
    AUDIT_LIST: "AUDIT_LIST_RES",
});

function resultError(code, message) {
    return {
        status: "ERROR",
        data: null,
        error: { code: String(code || "TPV_ERROR"), message: String(message || "No se pudo completar la operación.") },
        isSynthetic: true,
        realPayment: false,
    };
}

function normalizeSalePayload(payload, idempotencyKey) {
    const lineas = Array.isArray(payload.lineItems) ? payload.lineItems.map((line) => ({
        tipoLinea: String(line.tipoLinea || "").toUpperCase(),
        itemId: line.itemId || null,
        concepto: line.concepto,
        cantidad: line.cantidad,
        precioUnitario: line.precioUnitario,
        descuentoImporte: line.descuentoImporte || 0,
        impuestosImporte: line.impuestosImporte || 0,
        profesionalId: line.profesionalId || null,
        stockAfectado: line.stockAfectado === true,
    })) : [];
    const pagos = Array.isArray(payload.payments) ? payload.payments.map((payment) => ({
        medioPago: payment.method,
        importe: payment.amount,
        importeCambio: payment.change || 0,
    })) : [];

    return {
        idempotencyKey,
        sessionId: payload.sessionId,
        lineas,
        pagos,
        subtotalNeto: payload.subtotal,
        impuestosTotal: payload.tax,
        totalVenta: payload.total,
        customerContactId: payload.customerContactId || "",
        profesionalId: payload.profesionalId || "",
    };
}

async function dispatch(message) {
    const { type, payload = {}, messageId } = message;
    const idempotencyKey = String(payload.idempotencyKey || messageId || "");
    switch (type) {
        case "CASHIER_STATE":
            return obtenerEstadoCaja();
        case "SESSION_OPEN":
            return abrirSesionCaja({
                openingCash: payload.openingCash,
                terminalId: payload.terminalId || "TPV",
                reason: payload.reason || "Apertura desde TPV",
            });
        case "CATALOG_SERVICES":
            return obtenerServicios({ limit: 100, offset: 0 });
        case "CATALOG_PRODUCTS":
            return obtenerProductos({ limit: payload.limit || 100, cursor: payload.cursor || null });
        case "CATALOG_STAFF":
            return obtenerStaff();
        case "SALE_REGISTER":
            return registrarVenta(normalizeSalePayload(payload, idempotencyKey));
        case "CASH_MOVEMENT":
            return registrarMovimientoCaja({ ...payload, idempotencyKey });
        case "REFUND":
            return registrarDevolucion({
                saleId: payload.saleId,
                reason: payload.reason,
                payments: Array.isArray(payload.payments) ? payload.payments : [],
                idempotencyKey,
            });
        case "TICKET_X":
            return generarControlX({ ...payload, idempotencyKey });
        case "TICKET_Z":
            return generarCierreZ({
                sessionId: payload.sessionId,
                countedCash: payload.countedCash,
                differenceReason: payload.differenceReason || "",
            });
        case "SESSION_SUMMARY":
            return obtenerResumenCaja({ sessionId: payload.sessionId });
        case "AUDIT_LIST":
            return obtenerMovimientosCaja({ limit: payload.limit || 50, entityId: payload.entityId || "" });
        default:
            return resultError("UNKNOWN_MESSAGE", "Operación no soportada: " + String(type || ""));
    }
}

/**
 * Attach the bridge to the existing #htmlTPV component from TPV.yl5th.js.
 */
export function initializeTpvPage(widget) {
    return createWidgetBridge(widget, {
        allowedTypes: [MESSAGE_TYPES.READY, ...REQUEST_TYPES],
        allowOpaqueOrigin: true,
        onContextReady: async () => ({
            component: "htmlTPV",
            protocolVersion: PROTOCOL_VERSION,
            environment: "SANDBOX",
            syntheticOnly: true,
            realPaymentsEnabled: false,
            fiscalWritesEnabled: false,
        }),
        onWidgetMessage: async (message, reply) => {
            if (message.type === MESSAGE_TYPES.READY) return;
            const responseType = RESPONSE_TYPES[message.type];
            if (!responseType) return;
            try {
                const result = await dispatch(message);
                reply(responseType, result, message);
            } catch (error) {
                reply(responseType, resultError(error?.code || error?.message, error?.message), message);
            }
        },
        onError: (error) => {
            // Deliberately avoid logging payloads, customer data or payment details.
            console.error("[TPV bridge]", error?.code || "WIDGET_BRIDGE_ERROR");
        },
    });
}
