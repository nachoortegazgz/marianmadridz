/**
 * public/tpvPageController.js
 * TPV sobre las colecciones reales del sitio.
 *
 * Las colecciones utilizadas las determina el backend:
 * CajaActual
 * MovimientosCaja
 * HistoricoCierresZ
 * ControlOperativo
 */

import {
    obtenerSesionCaja,
    inicializarCaja,
    abrirCaja,
    registrarArqueoParcial,
} from "backend/tpv/tpvCaja.web.js";

import { registrarMovimientoCaja } from "backend/tpv/tpvMovimientos.web.js";

import {
    registrarVenta,
    validarVentaBorrador,
} from "backend/tpv/tpvVentas.web.js";

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
    buscarClientesTPV,
    obtenerReservasClienteTPV,
} from "backend/tpv/tpvCatalogo.web.js";

import { consultarTarjetaRegalo } from "backend/tpv/tpvGiftCards.web.js";
import { createWidgetBridge, MESSAGE_TYPES } from "public/widgetBridge";
import { makeTraceId } from "public/mmUtils";

const ALLOWED_MESSAGES = Object.freeze([
    MESSAGE_TYPES.READY,
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

function success(data, traceId) {
    return {
        status: "SUCCESS",
        data,
        traceId,
        persisted: true,
    };
}

function failure(code, message, traceId) {
    return {
        status: "ERROR",
        data: null,
        error: { code, message },
        traceId,
        persisted: false,
    };
}

async function run(operation, code, message, traceId) {
    try {
        const result = await operation();

        if (
            result &&
            typeof result === "object" &&
            typeof result.status === "string"
        ) {
            return result;
        }

        return success(result, traceId);
    } catch (error) {
        return failure(
            code,
            error?.message || message,
            traceId
        );
    }
}

export function initializeTpvPage(widgetElement) {
    if (
        !widgetElement ||
        typeof widgetElement.onMessage !== "function" ||
        typeof widgetElement.postMessage !== "function"
    ) {
        throw new TypeError("TPV_HTML_COMPONENT_REQUIRED");
    }

    const traceId = makeTraceId("tpv-ui");

    return createWidgetBridge(widgetElement, {
        slug: "tpv",
        traceId,
        allowedTypes: ALLOWED_MESSAGES,
        allowOpaqueOrigin: true,

        onContextReady: async () => {
            const result = await run(
                () => inicializarCaja(),
                "TPV_INITIALIZATION_FAILED",
                "No se pudo inicializar la caja.",
                traceId
            );

            const sandboxReady = result.status === "SUCCESS";
            return {
                component: "htmlTPV",
                protocolVersion: 1,
                ready: sandboxReady,
                environment: sandboxReady ? "SANDBOX" : "UNAVAILABLE",
                previewOnly: true,
                syntheticOnly: true,
                realPaymentsEnabled: false,
                fiscalWritesEnabled: false,
                customerNotificationsEnabled: false,
                hardwareEnabled: false,
                currencyCode: "EUR",
                timeZone: "Europe/Madrid",
                capabilities: {
                    cashierState: "AVAILABLE",
                    catalog: "READ_ONLY",
                    customers: "READ_ONLY",
                    sales: "ENABLED",
                    payments: "VALIDATED",
                    refunds: "ENABLED",
                    cashMovements: "ENABLED",
                    ticketX: "ENABLED",
                    ticketZ: "ENABLED",
                    audit: "READ_ONLY",
                    fiscalWrites: "DISABLED",
                    externalPaymentGateway: "DISABLED",
                },
            };
        },

        onWidgetMessage: async (message, reply) => {
            const type = String(message?.type || "")
                .trim()
                .toUpperCase();

            const payload = message?.payload || {};

            const respond = async (
                responseType,
                operation,
                code,
                text
            ) => {
                const result = await run(
                    operation,
                    code,
                    text,
                    traceId
                );

                reply(responseType, result, message);
            };

            switch (type) {
            case MESSAGE_TYPES.READY:
                return;

            case "CASHIER_STATE":
                await respond(
                    "CASHIER_STATE_RES",
                    () => obtenerSesionCaja(),
                    "TPV_SESSION_READ_FAILED",
                    "No se pudo consultar la caja."
                );
                return;

            case "CATALOG_SERVICES":
                await respond(
                    "CATALOG_SERVICES_RES",
                    () => obtenerServicios({ limit: 100, offset: 0 }),
                    "TPV_SERVICES_READ_FAILED",
                    "No se pudieron consultar los servicios."
                );
                return;

            case "CATALOG_STAFF":
                await respond(
                    "CATALOG_STAFF_RES",
                    () => obtenerProfesionales({ limit: 100 }),
                    "TPV_STAFF_READ_FAILED",
                    "No se pudieron consultar los profesionales."
                );
                return;

            case "CATALOG_PRODUCTS":
                await respond(
                    "CATALOG_PRODUCTS_RES",
                    () => obtenerProductos({
                        limit: 100,
                        cursor: payload.cursor || null,
                    }),
                    "TPV_PRODUCTS_READ_FAILED",
                    "No se pudieron consultar los productos."
                );
                return;

            case "PRODUCT_VARIANTS":
                await respond(
                    "PRODUCT_VARIANTS_RES",
                    () => obtenerVariantesProducto({
                        productId: payload.productId,
                    }),
                    "TPV_VARIANTS_READ_FAILED",
                    "No se pudieron consultar las variantes."
                );
                return;

            case "CUSTOMERS_SEARCH":
                await respond(
                    "CUSTOMERS_SEARCH_RES",
                    () => buscarClientesTPV({
                        search: payload.search,
                    }),
                    "TPV_CUSTOMERS_READ_FAILED",
                    "No se pudieron consultar los clientes."
                );
                return;

            case "CUSTOMER_BOOKINGS":
                await respond(
                    "CUSTOMER_BOOKINGS_RES",
                    () => obtenerReservasClienteTPV({
                        contactId: payload.contactId,
                        cursor: payload.cursor || null,
                    }),
                    "TPV_BOOKINGS_READ_FAILED",
                    "No se pudieron consultar las reservas."
                );
                return;

            case "VALIDATE_SALE_DRAFT":
                await respond(
                    "VALIDATE_SALE_DRAFT_RES",
                    () => validarVentaBorrador(payload.sale || {}),
                    "TPV_SALE_VALIDATION_FAILED",
                    "No se pudo validar la venta."
                );
                return;

            case "GIFT_CARD_BALANCE":
                await respond(
                    "GIFT_CARD_BALANCE_RES",
                    () => consultarTarjetaRegalo({
                        code: payload.code,
                    }),
                    "TPV_GIFT_CARD_READ_FAILED",
                    "No se pudo consultar la tarjeta regalo."
                );
                return;

            case "SANDBOX_CONFIG":
            case "CONFIG":
                await respond(
                    type === "SANDBOX_CONFIG" ? "SANDBOX_CONFIG_RES" : "CONFIG_RES",
                    () => obtenerConfiguracionTPV(),
                    "TPV_CONFIG_READ_FAILED",
                    "No se pudo consultar la configuración."
                );
                return;

            case "SANDBOX_PERMISSIONS":
            case "PERMISSIONS":
                await respond(
                    type === "SANDBOX_PERMISSIONS" ? "SANDBOX_PERMISSIONS_RES" : "PERMISSIONS_RES",
                    () => obtenerPermisosTPV(),
                    "TPV_PERMISSIONS_READ_FAILED",
                    "No se pudieron consultar los permisos."
                );
                return;

            case "SANDBOX_SESSION_OPEN":
            case "SESSION_OPEN":
                await respond(
                    type === "SANDBOX_SESSION_OPEN" ? "SANDBOX_SESSION_OPEN_RES" : "SESSION_OPEN_RES",
                    () => abrirCaja(payload),
                    "TPV_SESSION_OPEN_FAILED",
                    "No se pudo abrir la caja."
                );
                return;

            case "SANDBOX_PARTIAL_COUNT":
            case "PARTIAL_COUNT":
                await respond(
                    type === "SANDBOX_PARTIAL_COUNT" ? "SANDBOX_PARTIAL_COUNT_RES" : "PARTIAL_COUNT_RES",
                    () => registrarArqueoParcial(payload),
                    "TPV_PARTIAL_COUNT_FAILED",
                    "No se pudo registrar el control parcial."
                );
                return;

            case "SANDBOX_CASH_MOVEMENT":
            case "CASH_MOVEMENT":
                await respond(
                    type === "SANDBOX_CASH_MOVEMENT" ? "SANDBOX_CASH_MOVEMENT_RES" : "CASH_MOVEMENT_RES",
                    () => registrarMovimientoCaja(payload),
                    "TPV_CASH_MOVEMENT_FAILED",
                    "No se pudo registrar el movimiento."
                );
                return;

            case "SANDBOX_PAYMENT_VALIDATE":
            case "PAYMENT_VALIDATE":
                await respond(
                    type === "SANDBOX_PAYMENT_VALIDATE" ? "SANDBOX_PAYMENT_VALIDATE_RES" : "PAYMENT_VALIDATE_RES",
                    () => validarDesglosePagos(payload),
                    "TPV_PAYMENT_VALIDATE_FAILED",
                    "No se pudo validar el pago."
                );
                return;

            case "SANDBOX_SALE_REGISTER":
            case "SALE_REGISTER":
                await respond(
                    type === "SANDBOX_SALE_REGISTER" ? "SANDBOX_SALE_REGISTER_RES" : "SALE_REGISTER_RES",
                    () => registrarVenta(payload),
                    "TPV_SALE_REGISTER_FAILED",
                    "No se pudo registrar la venta."
                );
                return;

            case "SANDBOX_REFUND":
            case "REFUND":
                await respond(
                    type === "SANDBOX_REFUND" ? "SANDBOX_REFUND_RES" : "REFUND_RES",
                    () => solicitarDevolucion(payload),
                    "TPV_REFUND_FAILED",
                    "No se pudo registrar la devolución."
                );
                return;

            case "SANDBOX_SESSION_SUMMARY":
            case "SESSION_SUMMARY":
                await respond(
                    type === "SANDBOX_SESSION_SUMMARY" ? "SANDBOX_SESSION_SUMMARY_RES" : "SESSION_SUMMARY_RES",
                    () => obtenerResumenSesion(payload),
                    "TPV_SUMMARY_FAILED",
                    "No se pudo obtener el resumen."
                );
                return;

            case "SANDBOX_TICKET_X":
            case "TICKET_X":
                await respond(
                    type === "SANDBOX_TICKET_X" ? "SANDBOX_TICKET_X_RES" : "TICKET_X_RES",
                    () => generarTicketX(payload),
                    "TPV_TICKET_X_FAILED",
                    "No se pudo generar el control X."
                );
                return;

            case "SANDBOX_TICKET_Z":
            case "TICKET_Z":
                await respond(
                    type === "SANDBOX_TICKET_Z" ? "SANDBOX_TICKET_Z_RES" : "TICKET_Z_RES",
                    () => cerrarTicketZ(payload),
                    "TPV_TICKET_Z_FAILED",
                    "No se pudo cerrar la caja."
                );
                return;

            case "SANDBOX_AUDIT_LIST":
            case "AUDIT_LIST":
                await respond(
                    type === "SANDBOX_AUDIT_LIST" ? "SANDBOX_AUDIT_LIST_RES" : "AUDIT_LIST_RES",
                    () => consultarAuditoriaTPV(payload),
                    "TPV_AUDIT_READ_FAILED",
                    "No se pudo consultar la auditoría."
                );
                return;

            default:
                reply(
                    `${type || "UNKNOWN"}_RES`,
                    failure(
                        "TPV_ACTION_NOT_ALLOWED",
                        "Acción no habilitada.",
                        traceId
                    ),
                    message
                );
            }
        },
    });
}
