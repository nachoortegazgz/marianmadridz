/**
 * TPV page controller — native Wix POS catalogue + Marian Madrid extensions.
 * HTML Component contract: MM_READY/MM_CONTEXT and request/response pairs.
 * All business rules and persistence remain in authenticated backend WebMethods.
 */
import { createWidgetBridge, MESSAGE_TYPES, PROTOCOL_VERSION } from "public/widgetBridge";
import { obtenerEstadoCaja, abrirSesionCaja, registrarArqueoParcial } from "backend/tpv/tpvCaja.web";
import { obtenerServicios, obtenerProductos, obtenerStaff, obtenerVariantesProducto, buscarClientesTPV } from "backend/tpv/tpvCatalogo.web";
import { registrarVenta } from "backend/tpv/tpvVentas.web";
import { registrarMovimientoCaja, exportarMovimientosCaja, exportarAuditoriaTPV } from "backend/tpv/tpvMovimientos.web";
import { obtenerAuditoriaTPV } from "backend/tpv/tpvAuditoria.web";
import { registrarDevolucion } from "backend/tpv/tpvDevoluciones.web";
import { generarControlX, generarCierreZ, obtenerResumenCaja } from "backend/tpv/tpvCierres.web";
import { obtenerConfiguracionTPV } from "backend/tpv/tpvUtils.web";

const REQUEST_TYPES = Object.freeze([
    "CASHIER_STATE",
    "SESSION_OPEN",
    "CATALOG_SERVICES",
    "CATALOG_PRODUCTS",
    "CATALOG_VARIANTS",
    "CATALOG_STAFF",
    "CUSTOMERS_SEARCH",
    "SALE_REGISTER",
    "CASH_MOVEMENT",
    "PARTIAL_CASH_COUNT",
    "REFUND",
    "TICKET_X",
    "TICKET_Z",
    "SESSION_SUMMARY",
    "AUDIT_LIST",
    "CASH_MOVEMENTS_EXPORT",
    "AUDIT_EXPORT",
]);
const activeBridges = new WeakMap();
const MAX_KEY_LEN = 120;

function optionalString(value, maxLength = MAX_KEY_LEN) {
    if (value === null || value === undefined || value === "") return null;
    const result = String(value).trim();
    if (!result) return null;
    if (result.length > maxLength) throw new Error("TPV_VALUE_TOO_LONG");
    return result;
}

function boundedInteger(value, field, min, max) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < min || number > max) {
        throw new Error("TPV_INVALID_" + field);
    }
    return number;
}

function envelope(result) {
    if (result && (result.status === "SUCCESS" || result.status === "ERROR")) return result;
    return { status: "SUCCESS", data: result ?? null, error: null };
}

function errorEnvelope(error) {
    return {
        status: "ERROR",
        data: null,
        error: {
            code: String(error?.code || error?.message || "TPV_ERROR"),
            message: "No se pudo completar la operación.",
        },
    };
}

function numeric(value, field, { allowZero = true } = {}) {
    if (value === "" || value === null || value === undefined) {
        if (allowZero) return 0;
        throw new Error("TPV_INVALID_" + field);
    }
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || (!allowZero && number === 0)) {
        throw new Error("TPV_INVALID_" + field);
    }
    return number;
}

function idempotencyKey(message, payload = {}) {
    const supplied = String(payload.idempotencyKey || "").trim();
    if (supplied) {
        if (!/^[A-Za-z0-9:_-]{8,100}$/.test(supplied)) {
            throw new Error("TPV_INVALID_IDEMPOTENCY_KEY");
        }
        return supplied;
    }
    const messageId = String(message?.messageId || "").replace(/[^A-Za-z0-9:_-]/g, "").slice(0, 70);
    if (messageId.length < 8) throw new Error("TPV_MESSAGE_ID_REQUIRED_FOR_IDEMPOTENCY");
    return ("TPV_UI_" + String(message.type || "OP") + "_" + messageId).slice(0, 100);
}

async function dispatch(message) {
    const payload = message.payload && typeof message.payload === "object" && !Array.isArray(message.payload)
        ? message.payload
        : {};
    const key = idempotencyKey(message, payload);

    switch (message.type) {
        case "CASHIER_STATE":
            return obtenerEstadoCaja();

        case "SESSION_OPEN":
            return abrirSesionCaja({
                openingCash: numeric(payload.openingCash, "OPENING_CASH"),
                terminalId: optionalString(payload.terminalId, 80) || "TPV",
                reason: optionalString(payload.reason, 200) || "Apertura desde TPV",
            });

        case "CATALOG_SERVICES":
            return obtenerServicios({ limit: 100, offset: 0 });

        case "CATALOG_PRODUCTS":
            return obtenerProductos({
                limit: boundedInteger(payload.limit ?? 100, "CATALOG_LIMIT", 1, 100),
                cursor: optionalString(payload.cursor, 16000),
            });

        case "CATALOG_VARIANTS":
            const productId = optionalString(payload.productId);
            if (!productId) throw new Error("TPV_PRODUCT_ID_REQUIRED");
            return obtenerVariantesProducto({ productId });

        case "CATALOG_STAFF":
            return obtenerStaff();

        case "CUSTOMERS_SEARCH":
            return buscarClientesTPV({ search: optionalString(payload.search, 100) || "" });

        case "SALE_REGISTER": {
            const lineItems = Array.isArray(payload.lineItems) ? payload.lineItems : [];
            const payments = Array.isArray(payload.payments) ? payload.payments : [];
            const lineTaxMinor = lineItems.reduce((sum, line) => {
                const amount = numeric(line?.impuestosImporte ?? 0, "LINE_TAX");
                return sum + Math.round(amount * 100);
            }, 0);
            const declaredTaxMinor = Math.round(numeric(payload.tax, "TAX") * 100);
            if (lineTaxMinor !== declaredTaxMinor) {
                throw new Error("TPV_LINE_TAX_TOTAL_MISMATCH");
            }
            return registrarVenta({
                sessionId: optionalString(payload.sessionId) || "",
                idempotencyKey: key,
                lineas: lineItems.map((line) => ({
                    tipoLinea: String(line.tipoLinea || "").toUpperCase(),
                    itemId: line.itemId || null,
                    varianteId: line.varianteId || null,
                    concepto: String(line.concepto || ""),
                    cantidad: numeric(line.cantidad, "QUANTITY", { allowZero: false }),
                    precioUnitario: numeric(line.precioUnitario, "UNIT_PRICE"),
                    descuentoImporte: numeric(line.descuentoImporte ?? 0, "DISCOUNT"),
                    impuestosImporte: numeric(line.impuestosImporte ?? 0, "LINE_TAX"),
                    profesionalId: line.profesionalId || null,
                    stockAfectado: line.stockAfectado === true,
                })),
                pagos: payments.map((payment) => ({
                    medioPago: String(payment.method || payment.medioPago || "").toUpperCase(),
                    importe: numeric(payment.amount ?? payment.importe, "PAYMENT_AMOUNT", { allowZero: false }),
                    importeCambio: numeric(payment.change ?? payment.importeCambio ?? 0, "CHANGE_AMOUNT"),
                })),
                subtotalNeto: numeric(payload.subtotal, "SUBTOTAL"),
                impuestosTotal: numeric(payload.tax, "TAX"),
                totalVenta: numeric(payload.total, "TOTAL"),
                profesionalId: optionalString(payload.profesionalId),
                customerIdentityId: optionalString(payload.customerIdentityId),
                paymentBreakdown: payload.paymentBreakdown,
            });
        }

        case "CASH_MOVEMENT":
            return registrarMovimientoCaja({
                idempotencyKey: key,
                sessionId: optionalString(payload.sessionId) || "",
                movementType: (optionalString(payload.movementType, 40) || "").toUpperCase(),
                paymentMethod: (optionalString(payload.paymentMethod, 40) || "EFECTIVO").toUpperCase(),
                amount: numeric(payload.amount, "CASH_MOVEMENT", { allowZero: false }),
                reason: optionalString(payload.reason, 500) || "",
                profesionalId: optionalString(payload.profesionalId),
            });

        case "PARTIAL_CASH_COUNT":
            return registrarArqueoParcial({
                sessionId: optionalString(payload.sessionId) || "",
                idempotencyKey: key,
                countedCash: numeric(payload.countedCash, "COUNTED_CASH"),
                reason: optionalString(payload.reason, 500) || "",
            });

        case "REFUND": {
            const payments = Array.isArray(payload.payments) ? payload.payments : [];
            return registrarDevolucion({
                idempotencyKey: key,
                sessionId: optionalString(payload.sessionId) || "",
                saleId: optionalString(payload.saleId) || "",
                reason: optionalString(payload.reason, 500) || "",
                payments: payments.map((payment) => ({
                    paymentMethod: String(payment.paymentMethod || "").toUpperCase(),
                    amount: numeric(payment.amount, "REFUND_AMOUNT", { allowZero: false }),
                })),
                profesionalId: optionalString(payload.profesionalId),
            });
        }

        case "TICKET_X":
            return generarControlX({
                sessionId: optionalString(payload.sessionId) || "",
                idempotencyKey: key,
            });

        case "TICKET_Z":
            return generarCierreZ({
                sessionId: optionalString(payload.sessionId) || "",
                idempotencyKey: key,
                countedCash: numeric(payload.countedCash, "COUNTED_CASH"),
                differenceReason: optionalString(payload.differenceReason, 500) || "",
            });

        case "SESSION_SUMMARY":
            return obtenerResumenCaja({ sessionId: optionalString(payload.sessionId) || "" });

        case "AUDIT_LIST":
            return obtenerAuditoriaTPV({
                sessionId: optionalString(payload.sessionId) || undefined,
                limit: boundedInteger(payload.limit ?? 50, "AUDIT_LIMIT", 1, 100),
            });

        case "CASH_MOVEMENTS_EXPORT":
            return exportarMovimientosCaja({
                sessionId: optionalString(payload.sessionId) || "",
                idempotencyKey: key,
            });

        case "AUDIT_EXPORT":
            return exportarAuditoriaTPV({
                sessionId: optionalString(payload.sessionId) || "",
                idempotencyKey: key,
            });

        default:
            throw new Error("UNKNOWN_MESSAGE");
    }
}

export function initializeTpvPage(widget) {
    const previous = activeBridges.get(widget);
    if (previous) previous.destroy();

    const bridge = createWidgetBridge(widget, {
        allowedTypes: [MESSAGE_TYPES.READY, MESSAGE_TYPES.CONTEXT, ...REQUEST_TYPES],
        allowOpaqueOrigin: true,
        handshakeTimeoutMs: 65000,
        onContextReady: async () => {
            const config = envelope(await obtenerConfiguracionTPV());
            return {
                status: config.status,
                data: {
                    component: "htmlTPV",
                    protocolVersion: PROTOCOL_VERSION,
                    currency: config.status === "SUCCESS" ? config.data?.currency : null,
                    timeZone: config.status === "SUCCESS" ? config.data?.timeZone : null,
                },
                error: config.error || null,
            };
        },
        onWidgetMessage: async (message, reply) => {
            if (message.type === MESSAGE_TYPES.READY) return;
            try {
                const result = envelope(await dispatch(message));
                reply(message.type + "_RES", result, message);
            } catch (error) {
                reply(message.type + "_RES", errorEnvelope(error), message);
            }
        },
        onError: (error) => {
            console.error("[TPV] Widget bridge error", error?.code || error?.message || error, error?.detail || null);
        },
    });

    activeBridges.set(widget, bridge);
    return bridge;
}
