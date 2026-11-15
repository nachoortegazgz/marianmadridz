/**
 * public/tpvPageController.js
 * Frontend bridge for the TPV HTML Component.
 *
 * Exposes only the existing authenticated, read-only cashier-state WebMethod.
 * No payment, booking, order, invoice, ledger, cash-open, or Z-close writer is
 * reachable from this controller.
 */
import { getCashierState } from "backend/cajas.web.js";
import { createWidgetBridge, MESSAGE_TYPES } from "public/widgetBridge";
import { makeTraceId } from "public/mmUtils";

const TPV_ALLOWED_MESSAGES = Object.freeze([
    MESSAGE_TYPES.READY,
    "CASHIER_STATE",
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
                wixBookingsServices: "NATIVE_APP_READER_PENDING",
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

            if (type !== "CASHIER_STATE") {
                reply(
                    (type || "UNKNOWN") + "_RES",
                    errorResult(
                        "TPV_ACTION_NOT_ALLOWED",
                        "Acción no habilitada en esta entrega.",
                        traceId
                    ),
                    message
                );
                return;
            }

            try {
                // Authorization is performed by getCashierState in backend
                // through requireCajero(); browser-supplied identity is ignored.
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
        },
    });
}
