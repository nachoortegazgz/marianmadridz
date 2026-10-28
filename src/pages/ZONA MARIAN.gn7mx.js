/*
=============================================================================
MODULE: pages/zonamarian.js
VERSION: v5002.5-canonical-admin-page
RESPONSIBILITY: Canonical Velo page controller for Marian Administration.
STANDARDS: G10 ASCII Strict, Velo V3 SDK.
=============================================================================
*/

import wixMembersFrontend from "wix-members-frontend";
import wixLocation from "wix-location-frontend";

import { checkStaffCollaboratorAccess } from "backend/security.web.js";
import {
    getCashierState,
    registerManualTransaction,
    registerZClosing,
} from "backend/cajas.web.js";
import {
    getInventoryDashboard,
    getInventoryReconciliationQueue,
} from "backend/inventario.web.js";
import {
    getQuarterlyTaxSummary,
    getLibroRegistroFacturasExpedidas,
} from "backend/fiscalAggregator.web.js";
import {
    previewManagerPackage,
    createManagerPackageVersion,
    getManagerPackageHistory,
    getPreparedManagerPackages,
    downloadManagerPackageVersion,
    emailManagerPackageVersion,
} from "backend/fiscalDocuments.web.js";
import { askMarianAssistant } from "backend/marianAssistant.web.js";

import { makeTraceId, URLS } from "public/mmUtils";
import { createWidgetBridge } from "public/widgetBridge";

const ACTIONS = {
    CASHIER_STATE: ({ payload, traceId }) =>
        getCashierState({
            traceId,
            diaKey: payload?.diaKey || null,
        }),

    INVENTORY_DASH: () =>
        getInventoryDashboard(),

    INVENTORY_QUEUE: () =>
        getInventoryReconciliationQueue(),

    TPV_TX: ({ payload, traceId }) =>
        registerManualTransaction({
            ...(payload || {}),
            traceId,
        }),

    Z_CLOSING: ({ payload, traceId }) =>
        registerZClosing(
            payload?.diaKey || null, { traceId }
        ),

    FISCAL_SUMMARY: ({ payload, traceId }) =>
        getQuarterlyTaxSummary(
            payload?.year,
            payload?.quarter, { traceId }
        ),

    FISCAL_BOOK: ({ payload, traceId }) =>
        getLibroRegistroFacturasExpedidas(
            payload?.year,
            payload?.quarter, { traceId }
        ),

    DOCUMENT_PREVIEW: ({ payload }) =>
        previewManagerPackage(payload || {}),

    DOCUMENT_CREATE: ({ payload }) =>
        createManagerPackageVersion(payload || {}),

    DOCUMENT_HISTORY: ({ payload }) =>
        getManagerPackageHistory(payload || {}),

    DOCUMENT_PREPARED: () =>
        getPreparedManagerPackages(),

    DOCUMENT_DOWNLOAD: ({ payload }) =>
        downloadManagerPackageVersion(payload || {}),

    DOCUMENT_EMAIL: ({ payload }) =>
        emailManagerPackageVersion(payload || {}),

    AI_CHAT: ({ payload, traceId }) =>
        askMarianAssistant({
            ...(payload || {}),
            traceId,
        }),
};

$w.onReady(async () => {
    const traceId = makeTraceId("admin-page");
    const widget = $w("#htmlAdmin") || $w("#htmlAdministracion");

    if (!widget || typeof widget.postMessage !== "function") {
        return;
    }

    const member = await wixMembersFrontend.currentMember
        .getMember()
        .catch(() => null);

    if (!member) {
        // promptLogin() no debe awaitarse dentro de onReady(): segun la
        // documentacion oficial, esperar/retornar su promesa puede bloquear
        // la carga de la pagina. Se maneja con .catch() y se continua.
        wixMembersFrontend.authentication
            .promptLogin()
            .catch(() => {});
        return;
    }

    const accessRes = await checkStaffCollaboratorAccess({ traceId })
        .catch(() => null);

    const access =
        accessRes?.status === "SUCCESS" ?
        accessRes.data :
        null;

    if (!access || access.isMarianManager !== true) {
        wixLocation.to(
            URLS?.SERVICIOS || "/reserva-online"
        );
        return;
    }

    createWidgetBridge(widget, {
        slug: "administracion",
        traceId,

        onContextReady: async () => {
            const [
                cashierRes,
                inventoryRes,
                queueRes,
            ] = await Promise.all([
                getCashierState({ traceId }).catch(() => null),
                getInventoryDashboard().catch(() => null),
                getInventoryReconciliationQueue().catch(() => null),
            ]);

            return {
                isMarianManager: true,
                isAdmin: access.isAdmin === true,
                isCajero: access.isCajero === true,
                memberName: member.profile?.nickname ||
                    member.contactDetails?.firstName ||
                    "Marian",
                timeZone: "Europe/Madrid",
                currencyCode: "EUR",
                today: new Date().toLocaleDateString(
                    "sv-SE", { timeZone: "Europe/Madrid" }
                ),
                cashierState: cashierRes?.status === "SUCCESS" ?
                    cashierRes.data :
                    null,
                inventory: inventoryRes?.status === "SUCCESS" ?
                    inventoryRes.data :
                    null,
                inventoryQueue: queueRes?.status === "SUCCESS" ?
                    queueRes.data?.items || [] :
                    [],
            };
        },

        onWidgetMessage: async (message, reply) => {
            const type = String(message?.type || "")
                .trim()
                .toUpperCase();

            const payload = message?.payload || {};
            const handler = ACTIONS[type];

            if (!handler) {
                reply(
                    `${type || "UNKNOWN"}_RES`, {
                        status: "ERROR",
                        error: {
                            code: "UNKNOWN_ACTION",
                            message: "Accion no reconocida",
                        },
                    },
                    payload
                );
                return;
            }

            try {
                const result = await handler({
                    payload,
                    traceId,
                });

                reply(`${type}_RES`, result, payload);
            } catch (error) {
                reply(
                    `${type}_RES`, {
                        status: "ERROR",
                        error: {
                            code: "ACTION_FAILED",
                            message: error?.message ||
                                "No se pudo completar la accion.",
                        },
                    },
                    payload
                );
            }
        },
    });
});