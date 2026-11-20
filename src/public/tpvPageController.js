/**
 * public/tpvPageController.js
 * Versioned HTML bridge for the isolated, synthetic TPV QA workflow.
 * No operational ledger, Wix payment gateway, fiscal API or customer notification is called.
 */
import {
    obtenerSesionCaja,
    abrirCaja,
    registrarArqueoParcial,
} from "backend/tpv/tpvCaja.web.js";
import { registrarMovimientoCaja } from "backend/tpv/tpvMovimientos.web.js";
import { registrarVenta, validarVentaBorrador } from "backend/tpv/tpvVentas.web.js";
import { validarDesglosePagos } from "backend/tpv/tpvPagos.web.js";
import { solicitarDevolucion } from "backend/tpv/tpvDevoluciones.web.js";
import {
    obtenerResumenSesion,
    generarTicketX,
    cerrarTicketZ,
} from "backend/tpv/tpvCierres.web.js";
import { consultarAuditoriaTPV } from "backend/tpv/tpvAuditoria.web.js";
import { obtenerPermisosTPV } from "backend/tpv/tpvPermisos.web.js";
import { obtenerConfiguracionTPV } from "backend/tpv/tpvUtils.web.js";
import {
    obtenerServicios,
    obtenerProfesionales,
    obtenerProductos,
    obtenerVariantesProducto,
} from "backend/tpv/tpvCatalogo.web.js";
import { consultarTarjetaRegalo } from "backend/tpv/tpvGiftCards.web.js";
import { createWidgetBridge, MESSAGE_TYPES } from "public/widgetBridge";
import { makeTraceId } from "public/mmUtils";

const TPV_ALLOWED_MESSAGES = Object.freeze([
    MESSAGE_TYPES.READY,
    MESSAGE_TYPES.CONTEXT,
    "CASHIER_STATE",
    "CATALOG_SERVICES",
    "CATALOG_STAFF",
    "CATALOG_PRODUCTS",
    "PRODUCT_VARIANTS",
    "VALIDATE_SALE_DRAFT",
    "GIFT_CARD_BALANCE",
    "CONFIG",
    "PERMISSIONS",
    "SESSION_OPEN",
    "PARTIAL_COUNT",
    "CASH_MOVEMENT",
    "PAYMENT_VALIDATE",
    "SALE_REGISTER",
    "REFUND",
    "SESSION_SUMMARY",
    "TICKET_X",
    "TICKET_Z",
    "AUDIT_LIST",
]);

function errorResult(code, message, traceId) {
    return { status: "ERROR", data: null, error: { code, message }, traceId, persisted: false, isSynthetic: true, realPayment: false };
}

async function safeCall(operation, code, message, traceId) {
    try {
        return await operation();
    } catch (_) {
        return errorResult(code, message, traceId);
    }
}

export function initializeTpvPage(widgetElement) {
    if (!widgetElement ||
        typeof widgetElement.onMessage !== "function" ||
        typeof widgetElement.postMessage !== "function") {
        throw new TypeError("TPV_HTML_COMPONENT_REQUIRED");
    }

    const traceId = makeTraceId("tpv-ui");

    return createWidgetBridge(widgetElement, {
        slug: "tpv",
        traceId,
        allowedTypes: TPV_ALLOWED_MESSAGES,
        allowOpaqueOrigin: true,

        onContextReady: async () => ({
            component: "htmlTPV",
            mode: "PERSISTENT_SYNTHETIC_QA",
            currencyCode: "EUR",
            timeZone: "Europe/Madrid",
            capabilities: {
                cashierState: "QA_COLLECTIONS_ONLY",
                bookingsServices: "READ_ONLY",
                bookingsStaff: "READ_ONLY",
                storesProducts: "READ_ONLY",
                storesVariants: "READ_ONLY",
                saleDraftValidation: "BACKEND",
                syntheticSales: "TPV_QA_COLLECTIONS_ONLY",
                cashMovements: "TPV_QA_COLLECTIONS_ONLY",
                refunds: "TPV_QA_COLLECTIONS_ONLY",
                ticketX: "QA_REPORT",
                ticketZ: "QA_SESSION_CLOSE_ONLY",
                giftCards: "READ_ONLY",
                payments: "SIMULATED_NO_GATEWAY",
                orderMutations: "DISABLED",
                bookingMutations: "DISABLED",
                operationalCashWrites: "DISABLED",
                fiscalLedgerWrites: "DISABLED",
                customerNotifications: "DISABLED",
                physicalHardware: "DISABLED",
            },
        }),

        onWidgetMessage: async (message, reply) => {
            const type = String(message?.type || "").trim().toUpperCase();
            const payload = message?.payload || {};
            const respond = async (responseType, operation, code, text) => {
                const result = await safeCall(operation, code, text, traceId);
                reply(responseType, result, message);
            };

            switch (type) {
            case "CASHIER_STATE":
                await respond("CASHIER_STATE_RES", () => obtenerSesionCaja(), "TPV_QA_SESSION_READ_FAILED", "No se pudo consultar la sesión Sandbox.");
                return;
            case "CATALOG_SERVICES":
                await respond("CATALOG_SERVICES_RES", () => obtenerServicios({ limit: 100, offset: 0 }), "TPV_SERVICES_READ_FAILED", "No se pudieron consultar los servicios.");
                return;
            case "CATALOG_STAFF":
                await respond("CATALOG_STAFF_RES", () => obtenerProfesionales({ limit: 100 }), "TPV_STAFF_READ_FAILED", "No se pudieron consultar los profesionales.");
                return;
            case "CATALOG_PRODUCTS":
                await respond("CATALOG_PRODUCTS_RES", () => obtenerProductos({ limit: 100, cursor: payload.cursor || null }), "TPV_STORES_PRODUCTS_READ_FAILED", "No se pudieron consultar los productos.");
                return;
            case "PRODUCT_VARIANTS":
                await respond("PRODUCT_VARIANTS_RES", () => obtenerVariantesProducto({ productId: payload.productId }), "TPV_PRODUCT_VARIANTS_READ_FAILED", "No se pudieron consultar las variantes.");
                return;
            case "VALIDATE_SALE_DRAFT":
                await respond("VALIDATE_SALE_DRAFT_RES", () => validarVentaBorrador(payload.sale || {}), "TPV_DRAFT_VALIDATION_FAILED", "No se pudo validar el borrador.");
                return;
            case "GIFT_CARD_BALANCE":
                await respond("GIFT_CARD_BALANCE_RES", () => consultarTarjetaRegalo({ code: payload.code }), "TPV_GIFT_CARD_LOOKUP_FAILED", "No se pudo consultar la tarjeta regalo.");
                return;
            case "CONFIG":
                await respond("CONFIG_RES", () => obtenerConfiguracionTPV(), "TPV_CONFIG_FAILED", "No se pudo consultar la configuración Sandbox.");
                return;
            case "PERMISSIONS":
                await respond("PERMISSIONS_RES", () => obtenerPermisosTPV(), "TPV_PERMISSIONS_FAILED", "No se pudieron consultar los permisos.");
                return;
            case "SESSION_OPEN":
                await respond("SESSION_OPEN_RES", () => abrirCaja(payload), "TPV_SESSION_OPEN_FAILED", "No se pudo abrir la sesión Sandbox.");
                return;
            case "PARTIAL_COUNT":
                await respond("PARTIAL_COUNT_RES", () => registrarArqueoParcial(payload), "TPV_PARTIAL_COUNT_FAILED", "No se pudo registrar el arqueo Sandbox.");
                return;
            case "CASH_MOVEMENT":
                await respond("CASH_MOVEMENT_RES", () => registrarMovimientoCaja(payload), "TPV_CASH_MOVEMENT_FAILED", "No se pudo registrar el movimiento Sandbox.");
                return;
            case "PAYMENT_VALIDATE":
                await respond("PAYMENT_VALIDATE_RES", () => validarDesglosePagos(payload), "TPV_QA_PAYMENT_VALIDATION_FAILED", "No se pudo validar el pago simulado.");
                return;
            case "SALE_REGISTER":
                await respond("SALE_REGISTER_RES", () => registrarVenta(payload), "TPV_QA_SALE_FAILED", "No se pudo registrar la venta sintetica.");
                return;
            case "REFUND":
                await respond("REFUND_RES", () => solicitarDevolucion(payload), "TPV_REFUND_FAILED", "No se pudo registrar la devolucion sintetica.");
                return;
            case "SESSION_SUMMARY":
                await respond("SESSION_SUMMARY_RES", () => obtenerResumenSesion(payload), "TPV_QA_SUMMARY_FAILED", "No se pudo calcular el resumen Sandbox.");
                return;
            case "TICKET_X":
                await respond("TICKET_X_RES", () => generarTicketX(payload), "TPV_TICKET_X_FAILED", "No se pudo generar Ticket X Sandbox.");
                return;
            case "TICKET_Z":
                await respond("TICKET_Z_RES", () => cerrarTicketZ(payload), "TPV_TICKET_Z_FAILED", "No se pudo cerrar Ticket Z Sandbox.");
                return;
            case "AUDIT_LIST":
                await respond("AUDIT_LIST_RES", () => consultarAuditoriaTPV(payload), "TPV_QA_AUDIT_READ_FAILED", "No se pudo consultar la auditoría Sandbox.");
                return;
            default:
                reply((type || "UNKNOWN") + "_RES", errorResult("TPV_ACTION_NOT_ALLOWED", "Accion no habilitada.", traceId), message);
            }
        },
    });
}
