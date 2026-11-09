/*
=============================================================================
MODULE: pages/zonastaff.js
VERSION: v5002.5-staff-pos-cashier
=============================================================================
*/

import { location } from "@wix/site-location";
import {
  MESSAGE_TYPES,
  URLS,
  UI,
  makeTraceId,
  _safeTrim,
  withTimeout,
} from "public/mmUtils";
import { createWidgetBridge } from "public/widgetBridge";
import { checkStaffCollaboratorAccess } from "backend/security.web.js";

let bridge = null;
let isAuthorized = false;

$w.onReady(async () => {
  const traceId = makeTraceId("only-staff");

  const accessRes = await withTimeout(
    () => checkStaffCollaboratorAccess({ traceId }),
    UI.FRONTEND_API_TIMEOUT_MS,
    "checkStaffCollaboratorAccess"
  ).catch(() => null);

  if (
    !accessRes ||
    accessRes.status !== "SUCCESS" ||
    !accessRes.data?.isStaffCollaborator
  ) {
    console.warn("[only-staff] Access denied", { traceId });

    const accessDeniedEl = $w("#textAccessDenied");

    if (accessDeniedEl && "text" in accessDeniedEl) {
      accessDeniedEl.text =
        "Acceso restringido. Solo personal autorizado.";

      if (typeof accessDeniedEl.show === "function") {
        accessDeniedEl.show();
      }
    }

    const widgetEl = $w("#htmlOnlyStaffPanel");

    if (widgetEl && typeof widgetEl.hide === "function") {
      widgetEl.hide();
    }

    return;
  }

  isAuthorized = true;

  const widget = $w("#htmlOnlyStaffPanel");

  if (!widget || typeof widget.postMessage !== "function") {
    console.error(
      "[only-staff] HTML widget not found or incompatible",
      { traceId }
    );
    return;
  }

  bridge = createWidgetBridge(widget, {
    slug: "only-staff",
    traceId,
    handshakeTimeoutMs: UI.HANDSHAKE_TIMEOUT_MS,
    contextTimeoutMs: UI.CONTEXT_TIMEOUT_MS,

    onContextReady: async () => ({
      isAuthorized,
      panelType: "TPV",
      enableClocking: true,
      enableBreaks: true,
      enableCashier: true,
      enableInventory: false,
      enableScheduleQuery: false,
      cashierMode: "SIMULADA",
      currencyCode: "EUR",
      timeZone: "Europe/Madrid",
    }),

    onWidgetMessage: async (message) => {
      const type = String(message?.type || "").toUpperCase();
      const payload = message?.payload || {};
      const target = _safeTrim(payload.target || "");

      if (type !== MESSAGE_TYPES.NAV) {
        return;
      }

      switch (target) {
        case "ADMIN_PANEL":
          location.to("/administracion");
          break;

        case "SERVICIOS":
        case "HOME":
          location.to(URLS.SERVICIOS);
          break;

        case "POS":
        case "TPV":
        case "POS_CHECKOUT":
          location.to("/pos-checkout");
          break;

        case "CAJA":
        case "CAJA_ACTUAL":
          location.to("/caja-actual");
          break;

        default:
          console.warn("[only-staff] Unknown navigation target", {
            traceId,
            target,
          });
      }
    },

    onError: (error) => {
      console.error("[only-staff] Widget bridge error", {
        traceId,
        error: error?.message || String(error),
      });
    },
  });
});
