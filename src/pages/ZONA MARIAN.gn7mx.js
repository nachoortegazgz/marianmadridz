/*
=============================================================================
MODULE: pages/zonamarian.js
VERSION: v5005.0-canonical-admin-page-ai-accountant
RESPONSIBILITY: Controlador canónico de la página de Administración (Marian).
STANDARDS: G10 ASCII Strict, Velo V3 SDK.
=============================================================================
*/

import wixMembersFrontend from "wix-members-frontend";
import { location } from "@wix/site-location";

import { checkStaffCollaboratorAccess } from "backend/security.web.js";
import {
    getCashierState,
    registerManualTransaction,
    registerZClosing,
} from "backend/cajas.web.js";
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
    // NUEVO — envio a gestor
    listAccountantRecipients,
    sendManagerPackageToAccountant,
    sendSpecificDocumentToAccountant,
} from "backend/fiscalDocuments.web.js";

import { makeTraceId, URLS, MESSAGE_TYPES } from "public/mmUtils";
import { createWidgetBridge } from "public/widgetBridge";

/* ────────────────────────────────────────────────────────────────────
   MAPA DE ACCIONES
   ──────────────────────────────────────────────────────────────────── */
const ACTIONS = {
    // ── Caja ─────────────────────────────────────────────────────────
    CASHIER_STATE: ({ payload, traceId }) =>
        getCashierState({ traceId, diaKey: payload?.diaKey || null }),

    TPV_TX: ({ payload, traceId }) =>
        registerManualTransaction({ ...(payload || {}), traceId }),

    Z_CLOSING: ({ payload, traceId }) =>
        registerZClosing(payload?.diaKey || null, { traceId }),

    // ── Fiscal ───────────────────────────────────────────────────────
    FISCAL_SUMMARY: ({ payload, traceId }) =>
        getQuarterlyTaxSummary(payload?.year, payload?.quarter, { traceId }),

    FISCAL_BOOK: ({ payload, traceId }) =>
        getLibroRegistroFacturasExpedidas(payload?.year, payload?.quarter, { traceId }),

    // ── Documentos (existentes) ─────────────────────────────────────
    DOCUMENT_PREVIEW: ({ payload }) => previewManagerPackage(payload || {}),
    DOCUMENT_CREATE: ({ payload }) => createManagerPackageVersion(payload || {}),
    DOCUMENT_HISTORY: ({ payload }) => getManagerPackageHistory(payload || {}),
    DOCUMENT_PREPARED: () => getPreparedManagerPackages(),
    DOCUMENT_DOWNLOAD: ({ payload }) => downloadManagerPackageVersion(payload || {}),

    // ── Envío a gestor (NUEVO) ──────────────────────────────────────
    ACCOUNTANT_RECIPIENTS: ({ traceId }) =>
        listAccountantRecipients({ traceId }),

    SEND_MONTHLY_PACKAGE: ({ payload, traceId }) =>
        sendManagerPackageToAccountant({
            documentId: payload?.documentId,
            recipientId: payload?.recipientId,
            notes: payload?.notes || null,
            traceId,
        }),

    SEND_QUARTERLY_PACKAGE: ({ payload, traceId }) =>
        sendManagerPackageToAccountant({
            documentId: payload?.documentId,
            recipientId: payload?.recipientId,
            notes: payload?.notes || null,
            traceId,
        }),

    SEND_SPECIFIC_DOCUMENT: ({ payload, traceId }) =>
        sendSpecificDocumentToAccountant({
            documentId: payload?.documentId,
            documentType: payload?.documentType || null,
            recipientId: payload?.recipientId,
            notes: payload?.notes || null,
            traceId,
        }),

};

/* ────────────────────────────────────────────────────────────────────
   ONREADY
   ──────────────────────────────────────────────────────────────────── */
$w.onReady(async () => {
    const traceId = makeTraceId("admin-page");
    const widget = $w("#htmlAdministracion") || $w("#htmlAdmin");

    if (!widget || typeof widget.postMessage !== "function") return;

    const member = await wixMembersFrontend.currentMember
        .getMember()
        .catch(() => null);

    if (!member) {
        // No await: según docs oficiales puede bloquear la carga.
        wixMembersFrontend.authentication.promptLogin().catch(() => {});
        return;
    }

    const accessRes = await checkStaffCollaboratorAccess({ traceId })
        .catch(() => null);
    const access = accessRes?.status === "SUCCESS" ? accessRes.data : null;

    if (!access || access.isMarianManager !== true) {
        location.to(URLS?.SERVICIOS || "/reserva-online");
        return;
    }

    createWidgetBridge(widget, {
        allowedTypes: [
            MESSAGE_TYPES.READY,
            MESSAGE_TYPES.CONTEXT,
            MESSAGE_TYPES.NAV,
            "CASHIER_STATE",
            "Z_CLOSING",
            "FISCAL_SUMMARY",
            "FISCAL_BOOK",
            "DOCUMENT_PREPARED",
            "DOCUMENT_DOWNLOAD",
        ],
        slug: "administracion",
        traceId,

        onContextReady: async () => {
            const cashierRes = await getCashierState({ traceId }).catch(() => null);

            return {
                isMarianManager: true,
                isAdmin: access.isAdmin === true,
                isCajero: access.isCajero === true,
                memberName:
                    member.profile?.nickname ||
                    member.contactDetails?.firstName ||
                    "Marian",
                roleLabel: "PROPIETARIA",
                timeZone: "Europe/Madrid",
                currencyCode: "EUR",
                today: new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }),

                // ── Feature flags ─────────────────────────────────────
                enableClocking: false,        // ❌ fichaje eliminado
                enableBreaks: false,
                // La caja solo se muestra si el backend confirma un estado operativo.
                // CajaActual SIMULACION/CERRADA/ausente no se presenta como TPV activo.
                enableCashier:
                    cashierRes?.status === "SUCCESS" &&
                    cashierRes.data?.cashRegisterStatus === "ABIERTA",
                enableInventory: false, // Inventory managed only in Wix Stores
                enableScheduleQuery: false,   // backend de resumen aun no implementado
                enableAIAssistant: false,      // proveedor IA no conectado
                enableAccountantSend: false,  // despacho bloqueado hasta cerrar snapshot inmutable
                enableFiscal: true,
                enableDocuments: true,

                cashierState:
                    cashierRes?.status === "SUCCESS" ? cashierRes.data : null,
            };
        },

        onWidgetMessage: async (message, reply) => {
            const type = String(message?.type || "").trim().toUpperCase();
            const payload = message?.payload || {};
            const handler = ACTIONS[type];

            if (!handler) {
                reply(`${type || "UNKNOWN"}_RES`, {
                    status: "ERROR",
                    error: {
                        code: "UNKNOWN_ACTION",
                        message: "Accion no reconocida",
                    },
                }, payload);
                return;
            }

            try {
                const result = await handler({ payload, traceId });
                reply(`${type}_RES`, result, payload);
            } catch (error) {
                reply(`${type}_RES`, {
                    status: "ERROR",
                    error: {
                        code: "ACTION_FAILED",
                        message: error?.message || "No se pudo completar la accion.",
                    },
                }, payload);
            }
        },
    });
});
