/**
 * TPV page controller — native Wix POS catalogue + Marian Madrid extensions.
 * HTML Component contract: MM_READY/MM_CONTEXT and request/response pairs.
 * All business rules and persistence remain in authenticated backend WebMethods.
 */
import { createWidgetBridge, MESSAGE_TYPES, PROTOCOL_VERSION } from "public/widgetBridge";
import { obtenerEstadoCaja, abrirSesionCaja } from "backend/tpv/tpvCaja.web";
import { obtenerServicios, obtenerProductos, obtenerStaff, obtenerVariantesProducto, buscarClientesTPV } from "backend/tpv/tpvCatalogo.web";
import { registrarVenta } from "backend/tpv/tpvVentas.web";
import { registrarMovimientoCaja, obtenerMovimientosCaja } from "backend/tpv/tpvMovimientos.web";
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
    "REFUND",
    "TICKET_X",
    "TICKET_Z",
    "SESSION_SUMMARY",
    "AUDIT_LIST",
]);
const activeBridges = new WeakMap();

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
                terminalId: String(payload.terminalId || "TPV").slice(0, 80),
                reason: String(payload.reason || "Apertura desde TPV").slice(0, 200),
            });

        case "CATALOG_SERVICES":
            return obtenerServicios({ limit: 100, offset: 0 });

        case "CATALOG_PRODUCTS":
            return obtenerProductos({
                limit: numeric(payload.limit ?? 100, "CATALOG_LIMIT", { allowZero: false }),
                cursor: payload.cursor ? String(payload.cursor).slice(0, 16000) : null,
            });

        case "CATALOG_VARIANTS":
            return obtenerVariantesProducto({ productId: String(payload.productId || "") });

        case "CATALOG_STAFF":
            return obtenerStaff();

        case "CUSTOMERS_SEARCH":
            return buscarClientesTPV({ search: String(payload.search || "").trim() });

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
                sessionId: String(payload.sessionId || ""),
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
                profesionalId: optionalString(payload.profesionalId, MAX_KEY_LEN),
                customerIdentityId: payload.customerIdentityId || null,
            });
        }

        case "CASH_MOVEMENT":
            return registrarMovimientoCaja({
                idempotencyKey: key,
                movementType: String(payload.movementType || "").toUpperCase(),
                amount: numeric(payload.amount, "CASH_MOVEMENT", { allowZero: false }),
                reason: String(payload.reason || "").trim(),
                profesionalId: optionalString(payload.profesionalId, MAX_KEY_LEN),
            });

        case "REFUND": {
            const payments = Array.isArray(payload.payments) ? payload.payments : [];
            return registrarDevolucion({
                idempotencyKey: key,
                saleId: String(payload.saleId || "").trim(),
                reason: String(payload.reason || "").trim(),
                payments: payments.map((payment) => ({
                    paymentMethod: String(payment.paymentMethod || "").toUpperCase(),
                    amount: numeric(payment.amount, "REFUND_AMOUNT", { allowZero: false }),
                })),
                profesionalId: optionalString(payload.profesionalId, MAX_KEY_LEN),
            });
        }

        case "TICKET_X":
            return generarControlX({
                sessionId: String(payload.sessionId || ""),
                idempotencyKey: key,
            });

        case "TICKET_Z":
            return generarCierreZ({
                sessionId: String(payload.sessionId || ""),
                idempotencyKey: key,
                countedCash: numeric(payload.countedCash, "COUNTED_CASH"),
                differenceReason: String(payload.differenceReason || "").trim(),
            });

        case "SESSION_SUMMARY":
            return obtenerResumenCaja({ sessionId: String(payload.sessionId || "") });

        case "AUDIT_LIST":
            return obtenerMovimientosCaja({
                sessionId: payload.sessionId ? String(payload.sessionId) : undefined,
                limit: numeric(payload.limit ?? 50, "MOVEMENTS_LIMIT", { allowZero: false }),
            });

        default:
            throw new Error("UNKNOWN_MESSAGE");
    }
}

export function initializeTpvPage(widget) {
    const previous = activeBridges.get(widget);
    if (previous) previous.destroy();

    const bridge = createWidgetBridge(widget, {
        allowedTypes: [MESSAGE_TYPES.READY, ...REQUEST_TYPES],
        allowOpaqueOrigin: true,
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
            console.error("[TPV] Widget bridge error", error?.code || error?.message || error);
        },
    });

    activeBridges.set(widget, bridge);
    return bridge;
}
