// src/public/tpvPageController.js
// TPV Marian Madrid — Controlador público de la interfaz.
//
// Directrices aplicadas:
// - Codificación neutra: sin sufijos ni prefijos sandbox/qa/live/production
//   en identificadores, mensajes, claves ni claves de idempotencia.
// - El frontend NUNCA envía siteId; el backend resuelve actorId y siteId
//   desde el contexto autenticado de Wix.
// - Contratos backend respetados:
//     * Devoluciones: { paymentMethod, amount }
//     * Cierre Z: incluye idempotencyKey del frontend
//     * Ventas y movimientos: operatorId obligatorio, profesionalId opcional
// - Errores genéricos al frontend; el detalle técnico queda en logs internos.

import { registrarVenta } from "backend/tpv/tpvVentas.web";
import { registrarMovimientoCaja } from "backend/tpv/tpvMovimientos.web";
import { registrarDevolucion } from "backend/tpv/tpvDevoluciones.web";
import { generarControlX, generarCierreZ } from "backend/tpv/tpvCierres.web";
import { listarCatalogo } from "backend/tpv/tpvCatalogo.web";
import {
    abrirCaja,
    obtenerSesion,
    obtenerResumenSesion,
    listarPersonal,
    listarMovimientos,
} from "backend/tpv/tpvCaja.web";

const HTML_ID = "#htmlTPV";
const MAX_KEY_LEN = 128;
const MAX_STR_LEN = 500;

// Mapa de tipo de mensaje → tipo de respuesta.
// Necesario porque algunas respuestas no siguen el patrón <TYPE>_RES.
const RESPONSE_TYPE = {
    CATALOG_LIST: "CATALOG_LOADED",
    STAFF_LIST: "STAFF_LOADED",
    SESSION_GET: "SESSION_STATE",
    SESSION_STATE: "SESSION_STATE",
    OPEN_CASH: "OPEN_CASH_RES",
    SALE_REGISTER: "SALE_REGISTER_RES",
    CASH_MOVEMENT: "CASH_MOVEMENT_RES",
    REFUND: "REFUND_RES",
    SESSION_SUMMARY: "SESSION_SUMMARY_RES",
    AUDIT_LIST: "AUDIT_LIST_RES",
    TICKET_X: "TICKET_X_RES",
    TICKET_Z: "TICKET_Z_RES",
};

// Validación numérica en céntimos (hasta 2 decimales, redondeo bancario no requerido aquí).
function cents(value, code, { allowZero = false } = {}) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || (!allowZero && n === 0)) {
        throw new Error(code);
    }
    return Math.round(n * 100) / 100;
}

// Cantidad entera positiva.
function positiveInt(value, code) {
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0) throw new Error(code);
    return n;
}

function requiredString(value, code, maxLen = MAX_STR_LEN) {
    const s = String(value ?? "").trim();
    if (!s || s.length > maxLen) throw new Error(code);
    return s;
}

function optionalString(value, maxLen = MAX_KEY_LEN) {
    const s = String(value ?? "").trim();
    return s && s.length <= maxLen ? s : null;
}

// Respuesta pública: nunca incluye códigos internos ni detalle técnico.
function publicError() {
    return { error: "Operación no completada. Contacta con soporte." };
}

function respond(html, requestId, type, payload) {
    html.postMessage({ type, requestId, payload });
}

function respondError(html, requestId, type) {
    html.postMessage({ type: RESPONSE_TYPE[type] || type + "_RES", requestId, ...publicError() });
}

$w.onReady(() => {
    const html = $w(HTML_ID);
    if (!html || typeof html.onMessage !== "function") return;

    html.onMessage(async (event) => {
        const data = event?.data || {};
        const { type, requestId, payload } = data;
        if (!type || !requestId) return;

        try {
            switch (type) {
                case "CATALOG_LIST": {
                    const items = await listarCatalogo();
                    return respond(html, requestId, "CATALOG_LOADED", { items });
                }

                case "STAFF_LIST": {
                    const items = await listarPersonal();
                    return respond(html, requestId, "STAFF_LOADED", { items });
                }

                case "SESSION_GET":
                case "SESSION_STATE": {
                    const session = await obtenerSesion();
                    return respond(html, requestId, "SESSION_STATE", { session });
                }

                case "OPEN_CASH": {
                    const operatorId = requiredString(payload?.operatorId, "TPV_OPERATOR_REQUIRED", MAX_KEY_LEN);
                    const idempotencyKey = requiredString(payload?.idempotencyKey, "TPV_IDEMPOTENCY_REQUIRED", MAX_KEY_LEN);
                    const initialCash = cents(payload?.initialCash, "TPV_INITIAL_CASH", { allowZero: true });
                    const session = await abrirCaja({ operatorId, idempotencyKey, initialCash });
                    return respond(html, requestId, "OPEN_CASH_RES", { session });
                }

                case "SALE_REGISTER": {
                    const operatorId = requiredString(payload?.operatorId, "TPV_OPERATOR_REQUIRED", MAX_KEY_LEN);
                    const profesionalId = optionalString(payload?.profesionalId, MAX_KEY_LEN);
                    const idempotencyKey = requiredString(payload?.idempotencyKey, "TPV_IDEMPOTENCY_REQUIRED", MAX_KEY_LEN);

                    const lines = Array.isArray(payload?.lines) ? payload.lines : [];
                    const payments = Array.isArray(payload?.payments) ? payload.payments : [];
                    if (!lines.length) throw new Error("TPV_LINES_REQUIRED");
                    if (!payments.length) throw new Error("TPV_PAYMENTS_REQUIRED");

                    const result = await registrarVenta({
                        idempotencyKey,
                        operatorId,
                        profesionalId,
                        lines: lines.map((l) => ({
                            itemId: requiredString(l.itemId, "TPV_ITEM_REQUIRED", MAX_KEY_LEN),
                            name: requiredString(l.name, "TPV_NAME_REQUIRED", 200),
                            qty: positiveInt(l.qty, "TPV_QTY_REQUIRED"),
                            price: cents(l.price, "TPV_PRICE_REQUIRED"),
                        })),
                        // Contrato backend actual: { paymentMethod, amount }
                        payments: payments.map((p) => ({
                            paymentMethod: String(p.paymentMethod || "").toUpperCase(),
                            amount: cents(p.amount, "TPV_PAYMENT_AMOUNT_REQUIRED"),
                        })),
                    });
                    return respond(html, requestId, "SALE_REGISTER_RES", result);
                }

                case "CASH_MOVEMENT": {
                    const operatorId = requiredString(payload?.operatorId, "TPV_OPERATOR_REQUIRED", MAX_KEY_LEN);
                    const profesionalId = optionalString(payload?.profesionalId, MAX_KEY_LEN);
                    const movementType = String(payload?.movementType || "").toUpperCase();
                    if (movementType !== "ENTRADA" && movementType !== "SALIDA") {
                        throw new Error("TPV_MOVEMENT_TYPE_INVALID");
                    }

                    const result = await registrarMovimientoCaja({
                        idempotencyKey: requiredString(payload?.idempotencyKey, "TPV_IDEMPOTENCY_REQUIRED", MAX_KEY_LEN),
                        movementType,
                        amount: cents(payload?.amount, "TPV_MOVEMENT_AMOUNT_REQUIRED"),
                        reason: requiredString(payload?.reason, "TPV_MOVEMENT_REASON_REQUIRED"),
                        operatorId,
                        profesionalId,
                    });
                    return respond(html, requestId, "CASH_MOVEMENT_RES", result);
                }

                case "REFUND": {
                    const operatorId = requiredString(payload?.operatorId, "TPV_OPERATOR_REQUIRED", MAX_KEY_LEN);
                    const profesionalId = optionalString(payload?.profesionalId, MAX_KEY_LEN);
                    const payments = Array.isArray(payload?.payments) ? payload.payments : [];
                    if (!payments.length) throw new Error("TPV_REFUND_PAYMENTS_REQUIRED");

                    const result = await registrarDevolucion({
                        idempotencyKey: requiredString(payload?.idempotencyKey, "TPV_IDEMPOTENCY_REQUIRED", MAX_KEY_LEN),
                        saleId: requiredString(payload?.saleId, "TPV_REFUND_SALE_REQUIRED", MAX_KEY_LEN),
                        reason: requiredString(payload?.reason, "TPV_REFUND_REASON_REQUIRED"),
                        operatorId,
                        profesionalId,
                        // Contrato backend: { paymentMethod, amount }
                        payments: payments.map((p) => ({
                            paymentMethod: String(p.paymentMethod || "").toUpperCase(),
                            amount: cents(p.amount, "TPV_REFUND_AMOUNT_REQUIRED"),
                        })),
                    });
                    return respond(html, requestId, "REFUND_RES", result);
                }

                case "SESSION_SUMMARY": {
                    const sessionId = optionalString(payload?.sessionId, MAX_KEY_LEN);
                    const result = await obtenerResumenSesion({ sessionId });
                    return respond(html, requestId, "SESSION_SUMMARY_RES", result);
                }

                case "AUDIT_LIST": {
                    const sessionId = optionalString(payload?.sessionId, MAX_KEY_LEN);
                    const result = await listarMovimientos({ sessionId });
                    return respond(html, requestId, "AUDIT_LIST_RES", result);
                }

                case "TICKET_X": {
                    // Control X es informativo y repetible; operatorId opcional.
                    const sessionId = optionalString(payload?.sessionId, MAX_KEY_LEN);
                    const operatorId = optionalString(payload?.operatorId, MAX_KEY_LEN);
                    const result = await generarControlX({
                        sessionId,
                        operatorId,
                        idempotencyKey: requiredString(payload?.idempotencyKey, "TPV_IDEMPOTENCY_REQUIRED", MAX_KEY_LEN),
                    });
                    return respond(html, requestId, "TICKET_X_RES", result);
                }

                case "TICKET_Z": {
                    const operatorId = requiredString(payload?.operatorId, "TPV_OPERATOR_REQUIRED", MAX_KEY_LEN);
                    const profesionalId = optionalString(payload?.profesionalId, MAX_KEY_LEN);

                    const result = await generarCierreZ({
                        sessionId: requiredString(payload?.sessionId, "TPV_SESSION_REQUIRED", MAX_KEY_LEN),
                        operatorId,
                        profesionalId,
                        idempotencyKey: requiredString(payload?.idempotencyKey, "TPV_IDEMPOTENCY_REQUIRED", MAX_KEY_LEN),
                        countedCash: cents(payload?.countedCash, "TPV_COUNTED_CASH_REQUIRED", { allowZero: true }),
                        differenceReason: optionalString(payload?.differenceReason, 200) || "",
                    });
                    return respond(html, requestId, "TICKET_Z_RES", result);
                }

                case "TPV_READY":
                    // Notificación informativa del HTML; no requiere respuesta.
                    return;

                default:
                    // Mensaje desconocido: no responder con detalle.
                    return;
            }
        } catch (err) {
            // Log interno neutro (sin etiquetas de entorno); respuesta pública genérica.
            try {
                console.warn("[TPV]", type, err?.message || "TPV_UNEXPECTED_ERROR");
            } catch (_e) { /* silencio */ }
            return respondError(html, requestId, type);
        }
    });
});