/**
 * public/tpvPageController.js
 * Frontend bridge for the TPV HTML Component.
 *
 * Exposes authenticated read-only cashier and Wix Bookings catalog methods.
 * No payment, booking, order, invoice, ledger, cash-open, or Z-close writer is
 * reachable from this controller.
 */
import { getCashierState } from "backend/cajas.web.js";
import {
    obtenerServicios,
    obtenerProfesionales,
} from "backend/tpv/tpvCatalogo.web.js";
import { createWidgetBridge, MESSAGE_TYPES } from "public/widgetBridge";
import { makeTraceId } from "public/mmUtils";

const TPV_ALLOWED_MESSAGES = Object.freeze([
    MESSAGE_TYPES.READY,
    MESSAGE_TYPES.CONTEXT,
    "CASHIER_STATE",
    "CATALOG_SERVICES",
    "CATALOG_STAFF",
]);

function errorResult(code, message, traceId) {
    return {
        status: "ERROR",
        data: null,
        error: { code, message },
        traceId,
    };
}

/**
 * Call from the TPV page code with $w("#htmlTPV").
 * Configure the HTML Component with the complete contents of #htmlTPV.txt.
 */
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
                localTicketDraft: "BROWSER_ONLY",
                localTenderReconciliation: "BROWSER_ONLY",
                wixStoresCatalog: "NATIVE_APP_READER_PENDING",
                wixBookingsServices: "READ_ONLY",
                wixBookingsStaff: "READ_ONLY",
                wixOrders: "NATIVE_APP_READER_PENDING",
                wixPayments: "DISABLED",
                wixInvoices: "NATIVE_APP_NOT_CONNECTED",
                wixGiftCards: "NATIVE_APP_READER_PENDING",
                bookingMutations: "DISABLED",
                orderMutations: "DISABLED",
                paymentMutations: "DISABLED",
                fiscalLedgerWrites: "DISABLED",
                cashSessionMutations: "DISABLED",
                zClosing: "DISABLED",
            },
        }),

        onWidgetMessage: async (message, reply) => {
            const type = String(message?.type || "").trim().toUpperCase();

            if (type === "CASHIER_STATE") {
                try {
                    // Backend resolves identity and requires the cashier role.
                    const result = await getCashierState({ traceId });
                    reply("CASHIER_STATE_RES", result, message);
                } catch (_) {
                    reply(
                        "CASHIER_STATE_RES",
                        errorResult(
                            "CASHIER_STATE_FAILED",
                            "No se pudo consultar la caja.",
                            traceId
                        ),
                        message
                    );
                }
                return;
            }

            if (type === "CATALOG_SERVICES") {
                try {
                    const result = await obtenerServicios({ limit: 100, offset: 0 });
                    reply("CATALOG_SERVICES_RES", result, message);
                } catch (_) {
                    reply(
                        "CATALOG_SERVICES_RES",
                        errorResult(
                            "TPV_SERVICES_READ_FAILED",
                            "No se pudieron consultar los servicios de Wix Bookings.",
                            traceId
                        ),
                        message
                    );
                }
                return;
            }

            if (type === "CATALOG_STAFF") {
                try {
                    const result = await obtenerProfesionales({ limit: 100 });
                    reply("CATALOG_STAFF_RES", result, message);
                } catch (_) {
                    reply(
                        "CATALOG_STAFF_RES",
                        errorResult(
                            "TPV_STAFF_READ_FAILED",
                            "No se pudieron consultar los profesionales de Wix Bookings.",
                            traceId
                        ),
                        message
                    );
                }
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
