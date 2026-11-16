/**
 * public/tpvPageController.js
 * Authenticated read bridge for the TPV HTML Component.
 *
 * Commercial drafts stay in the iframe. Backend calls are limited to
 * authorized catalog reads, cashier state and server-side draft validation.
 * No payment, order, booking, ledger, cash-session or fiscal writer is exposed.
 */
import { obtenerCajaActual } from "backend/tpv/tpvCaja.web.js";
import {
    obtenerServicios,
    obtenerProfesionales,
    obtenerProductos,
    obtenerVariantesProducto,
} from "backend/tpv/tpvCatalogo.web.js";
import { validarVentaBorrador } from "backend/tpv/tpvVentas.web.js";
import { previsualizarTicketX } from "backend/tpv/tpvReportes.web.js";
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
    "TICKET_X_PREVIEW",
    "GIFT_CARD_BALANCE",
]);

function errorResult(code, message, traceId) {
    return {
        status: "ERROR",
        data: null,
        error: { code, message },
        traceId,
    };
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
            mode: "READ_ONLY_QA",
            currencyCode: "EUR",
            timeZone: "Europe/Madrid",
            capabilities: {
                cashierState: "READ_ONLY",
                bookingsServices: "READ_ONLY",
                bookingsStaff: "READ_ONLY",
                storesProducts: "READ_ONLY",
                storesVariants: "READ_ONLY",
                saleDraftValidation: "BACKEND_VALIDATION_NO_PERSISTENCE",
                suspendedTickets: "BROWSER_SESSION_ONLY",
                paymentReconciliation: "BROWSER_ONLY",
                refunds: "DRAFT_ONLY",
                giftCards: "READ_ONLY",
                payments: "DISABLED",
                orderMutations: "DISABLED",
                bookingMutations: "DISABLED",
                cashSessionMutations: "DISABLED",
                fiscalLedgerWrites: "DISABLED",
                ticketZClosing: "DISABLED",
            },
        }),

        onWidgetMessage: async (message, reply) => {
            const type = String(message?.type || "").trim().toUpperCase();
            const payload = message?.payload || {};

            if (type === "CASHIER_STATE") {
                const result = await safeCall(
                    () => obtenerCajaActual(),
                    "CASHIER_STATE_FAILED",
                    "No se pudo consultar la caja.",
                    traceId
                );
                reply("CASHIER_STATE_RES", result, message);
                return;
            }

            if (type === "CATALOG_SERVICES") {
                const result = await safeCall(
                    () => obtenerServicios({ limit: 100, offset: 0 }),
                    "TPV_SERVICES_READ_FAILED",
                    "No se pudieron consultar los servicios.",
                    traceId
                );
                reply("CATALOG_SERVICES_RES", result, message);
                return;
            }

            if (type === "CATALOG_STAFF") {
                const result = await safeCall(
                    () => obtenerProfesionales({ limit: 100 }),
                    "TPV_STAFF_READ_FAILED",
                    "No se pudieron consultar los profesionales.",
                    traceId
                );
                reply("CATALOG_STAFF_RES", result, message);
                return;
            }

            if (type === "CATALOG_PRODUCTS") {
                const result = await safeCall(
                    () => obtenerProductos({
                        limit: 100,
                        cursor: payload.cursor || null,
                    }),
                    "TPV_STORES_PRODUCTS_READ_FAILED",
                    "No se pudieron consultar los productos.",
                    traceId
                );
                reply("CATALOG_PRODUCTS_RES", result, message);
                return;
            }

            if (type === "PRODUCT_VARIANTS") {
                const result = await safeCall(
                    () => obtenerVariantesProducto({
                        productId: payload.productId,
                    }),
                    "TPV_PRODUCT_VARIANTS_READ_FAILED",
                    "No se pudieron consultar las variantes.",
                    traceId
                );
                reply("PRODUCT_VARIANTS_RES", result, message);
                return;
            }

            if (type === "VALIDATE_SALE_DRAFT") {
                const result = await safeCall(
                    () => validarVentaBorrador(payload.sale || {}),
                    "TPV_DRAFT_VALIDATION_FAILED",
                    "No se pudo validar el borrador.",
                    traceId
                );
                reply("VALIDATE_SALE_DRAFT_RES", result, message);
                return;
            }

            if (type === "TICKET_X_PREVIEW") {
                const result = await safeCall(
                    () => previsualizarTicketX(),
                    "TPV_TICKET_X_PREVIEW_FAILED",
                    "No se pudo consultar la vista previa X.",
                    traceId
                );
                reply("TICKET_X_PREVIEW_RES", result, message);
                return;
            }

            if (type === "GIFT_CARD_BALANCE") {
                const result = await safeCall(
                    () => consultarTarjetaRegalo({ code: payload.code }),
                    "TPV_GIFT_CARD_LOOKUP_FAILED",
                    "No se pudo consultar la tarjeta regalo.",
                    traceId
                );
                reply("GIFT_CARD_BALANCE_RES", result, message);
                return;
            }

            reply(
                (type || "UNKNOWN") + "_RES",
                errorResult(
                    "TPV_ACTION_NOT_ALLOWED",
                    "Acción no habilitada en esta entrega.",
                    traceId
                ),
                message
            );
        },
    });
}
