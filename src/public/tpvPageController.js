/**
 * public/tpvPageController.js
 * Versioned HTML bridge for the isolated, synthetic TPV SANDBOX workflow.
 * No operational ledger, Wix payment gateway, fiscal API or customer notification is called.
 */
import {
    obtenerSesionCajaSANDBOX,
    abrirCajaSANDBOX,
    registrarArqueoParcialSANDBOX,
} from "backend/tpv/tpvCaja.web.js";
import { registrarMovimientoCajaSANDBOX } from "backend/tpv/tpvMovimientos.web.js";
import { registrarVentaSANDBOX, validarVentaBorrador } from "backend/tpv/tpvVentas.web.js";
import { validarDesglosePagosSANDBOX } from "backend/tpv/tpvPagos.web.js";
import { solicitarDevolucionSANDBOX } from "backend/tpv/tpvDevoluciones.web.js";
import {
    obtenerResumenSesionSANDBOX,
    generarTicketXSANDBOX,
    cerrarTicketZSANDBOX,
} from "backend/tpv/tpvCierres.web.js";
import { consultarAuditoriaTPVSANDBOX } from "backend/tpv/tpvAuditoria.web.js";
import { obtenerPermisosTPVSANDBOX } from "backend/tpv/tpvPermisos.web.js";
import { obtenerConfiguracionTPVSANDBOX } from "backend/tpv/tpvUtils.web.js";
import {
    obtenerServicios,
    obtenerProfesionales,
    obtenerProductos,
    obtenerVariantesProducto,
    buscarClientesTPV,
    obtenerReservasClienteTPV,
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
    "CUSTOMERS_SEARCH",
    "CUSTOMER_BOOKINGS",
    "VALIDATE_SALE_DRAFT",
    "GIFT_CARD_BALANCE",
    "SANDBOX_CONFIG",
    "SANDBOX_PERMISSIONS",
    "SANDBOX_SESSION_OPEN",
    "SANDBOX_PARTIAL_COUNT",
    "SANDBOX_CASH_MOVEMENT",
    "SANDBOX_PAYMENT_VALIDATE",
    "SANDBOX_SALE_REGISTER",
    "SANDBOX_REFUND",
    "SANDBOX_SESSION_SUMMARY",
    "SANDBOX_TICKET_X",
    "SANDBOX_TICKET_Z",
    "SANDBOX_AUDIT_LIST",
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
            protocolVersion: 1,
            // Preview mode alone does not prove backend CMS Sandbox isolation.
            // Never advertise a writable Sandbox until the backend can attest it.
            environment: "DISABLED",
            syntheticOnly: true,
            previewOnly: true,
            mode: "DISABLED_PENDING_SERVER_SANDBOX_ISOLATION",
            currencyCode: "EUR",
            timeZone: "Europe/Madrid",
            capabilities: {
                cashierState: "CAJA_ACTUAL_SIMULACION",
                bookingsServices: "READ_ONLY",
                bookingsStaff: "READ_ONLY",
                storesProducts: "READ_ONLY",
                storesVariants: "READ_ONLY",
                saleDraftValidation: "BACKEND",
                syntheticSales: "MOVIMIENTOS_CAJA_SYNTHETIC",
                cashMovements: "MOVIMIENTOS_CAJA_SYNTHETIC",
                refunds: "MOVIMIENTOS_CAJA_SYNTHETIC",
                ticketX: "SANDBOX_REPORT",
                ticketZ: "SANDBOX_SESSION_CLOSE_ONLY",
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
            // Block all SANDBOX calls until a server-side Sandbox boundary is proven.
            // This protects direct WebMethod calls as well as the HTML widget path.
            if (type === "CASHIER_STATE" || type.startsWith("SANDBOX_")) {
                reply(type + "_RES", errorResult(
                    "TPV_SANDBOX_DISABLED_UNTIL_SANDBOX_ISOLATION",
                    "Las operaciones TPV SANDBOX están temporalmente deshabilitadas hasta verificar el aislamiento Sandbox en backend.",
                    traceId
                ), message);
                return;
            }
            const respond = async (responseType, operation, code, text) => {
                const result = await safeCall(operation, code, text, traceId);
                reply(responseType, result, message);
            };

            switch (type) {
            // MM_READY is the bridge handshake. createWidgetBridge publishes
            // MM_CONTEXT after this handler; no synthetic MM_READY_RES is needed.
            case MESSAGE_TYPES.READY:
                return;
            case "CASHIER_STATE":
                await respond("CASHIER_STATE_RES", () => obtenerSesionCajaSANDBOX(), "TPV_SANDBOX_SESSION_READ_FAILED", "No se pudo consultar la sesion SANDBOX.");
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
            case "CUSTOMERS_SEARCH":
                await respond("CUSTOMERS_SEARCH_RES", () => buscarClientesTPV({ search: payload.search }), "TPV_CUSTOMER_SEARCH_FAILED", "No se pudieron consultar los clientes.");
                return;
            case "CUSTOMER_BOOKINGS":
                await respond("CUSTOMER_BOOKINGS_RES", () => obtenerReservasClienteTPV({ contactId: payload.contactId, cursor: payload.cursor }), "TPV_CUSTOMER_BOOKINGS_FAILED", "No se pudieron consultar las reservas del cliente.");
                return;
            case "VALIDATE_SALE_DRAFT":
                await respond("VALIDATE_SALE_DRAFT_RES", () => validarVentaBorrador(payload.sale || {}), "TPV_DRAFT_VALIDATION_FAILED", "No se pudo validar el borrador.");
                return;
            case "GIFT_CARD_BALANCE":
                await respond("GIFT_CARD_BALANCE_RES", () => consultarTarjetaRegalo({ code: payload.code }), "TPV_GIFT_CARD_LOOKUP_FAILED", "No se pudo consultar la tarjeta regalo.");
                return;
            case "SANDBOX_CONFIG":
                await respond("SANDBOX_CONFIG_RES", () => obtenerConfiguracionTPVSANDBOX(), "TPV_SANDBOX_CONFIG_FAILED", "No se pudo consultar la configuracion SANDBOX.");
                return;
            case "SANDBOX_PERMISSIONS":
                await respond("SANDBOX_PERMISSIONS_RES", () => obtenerPermisosTPVSANDBOX(), "TPV_SANDBOX_PERMISSIONS_FAILED", "No se pudieron consultar los permisos.");
                return;
            case "SANDBOX_SESSION_OPEN":
                await respond("SANDBOX_SESSION_OPEN_RES", () => abrirCajaSANDBOX(payload), "TPV_SANDBOX_SESSION_OPEN_FAILED", "No se pudo abrir la sesion SANDBOX.");
                return;
            case "SANDBOX_PARTIAL_COUNT":
                await respond("SANDBOX_PARTIAL_COUNT_RES", () => registrarArqueoParcialSANDBOX(payload), "TPV_SANDBOX_PARTIAL_COUNT_FAILED", "No se pudo registrar el arqueo SANDBOX.");
                return;
            case "SANDBOX_CASH_MOVEMENT":
                await respond("SANDBOX_CASH_MOVEMENT_RES", () => registrarMovimientoCajaSANDBOX(payload), "TPV_SANDBOX_CASH_MOVEMENT_FAILED", "No se pudo registrar el movimiento SANDBOX.");
                return;
            case "SANDBOX_PAYMENT_VALIDATE":
                await respond("SANDBOX_PAYMENT_VALIDATE_RES", () => validarDesglosePagosSANDBOX(payload), "TPV_SANDBOX_PAYMENT_VALIDATION_FAILED", "No se pudo validar el pago simulado.");
                return;
            case "SANDBOX_SALE_REGISTER":
                await respond("SANDBOX_SALE_REGISTER_RES", () => registrarVentaSANDBOX(payload), "TPV_SANDBOX_SALE_FAILED", "No se pudo registrar la venta sintetica.");
                return;
            case "SANDBOX_REFUND":
                await respond("SANDBOX_REFUND_RES", () => solicitarDevolucionSANDBOX(payload), "TPV_SANDBOX_REFUND_FAILED", "No se pudo registrar la devolucion sintetica.");
                return;
            case "SANDBOX_SESSION_SUMMARY":
                await respond("SANDBOX_SESSION_SUMMARY_RES", () => obtenerResumenSesionSANDBOX(payload), "TPV_SANDBOX_SUMMARY_FAILED", "No se pudo calcular el resumen SANDBOX.");
                return;
            case "SANDBOX_TICKET_X":
                await respond("SANDBOX_TICKET_X_RES", () => generarTicketXSANDBOX(payload), "TPV_SANDBOX_TICKET_X_FAILED", "No se pudo generar Ticket X SANDBOX.");
                return;
            case "SANDBOX_TICKET_Z":
                await respond("SANDBOX_TICKET_Z_RES", () => cerrarTicketZSANDBOX(payload), "TPV_SANDBOX_TICKET_Z_FAILED", "No se pudo cerrar Ticket Z SANDBOX.");
                return;
            case "SANDBOX_AUDIT_LIST":
                await respond("SANDBOX_AUDIT_LIST_RES", () => consultarAuditoriaTPVSANDBOX(payload), "TPV_SANDBOX_AUDIT_READ_FAILED", "No se pudo consultar la auditoria SANDBOX.");
                return;
            default:
                reply((type || "UNKNOWN") + "_RES", errorResult("TPV_ACTION_NOT_ALLOWED", "Accion no habilitada.", traceId), message);
            }
        },
    });
}
