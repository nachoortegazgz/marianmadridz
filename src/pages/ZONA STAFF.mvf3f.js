/*
=============================================================================
MODULE: pages/zonastaff.js
VERSION: v5004.0-staff-native-flows
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

const TZ = "Europe/Madrid";
const CASHIER_MODE = "SIMULADA";

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
    accessRes.data?.isStaffCollaborator !== true
  ) {
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

  const staffData = accessRes.data || {};

  const isAdmin = staffData.isAdmin === true;

  const isCajero =
    staffData.isCajero === true ||
    staffData.canOperateCashier === true ||
    staffData.canCashier === true;

  const memberName =
    staffData.memberName ||
    staffData.contactName ||
    staffData.employeeName ||
    null;

  const employeeName =
    staffData.employeeName ||
    staffData.employeeId ||
    null;

  const roleLabel =
    staffData.roleLabel ||
    (isAdmin
      ? "ADMINISTRACION"
      : isCajero
        ? "CAJA"
        : "EQUIPO");

  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
  }).format(new Date());

  const widget = $w("#htmlOnlyStaffPanel");

  if (!widget || typeof widget.postMessage !== "function") {
    console.error("[only-staff] HTML widget no disponible", { traceId });
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

      cashierMode: CASHIER_MODE,
      isAdmin,
      isCajero,

      currencyCode: "EUR",
      timeZone: TZ,
      today,

      memberName,
      employeeName,
      roleLabel,

      calendarUrl: "/mi-calendario",
    }),

    onWidgetMessage: async (message) => {
      const type = String(message?.type || "").toUpperCase();
      const payload = message?.payload || {};
      const target = _safeTrim(payload.target || "");

      /*
      -----------------------------------------------------------------------
      NAVEGACIÓN NATIVA
      -----------------------------------------------------------------------
      */
      if (type === MESSAGE_TYPES.NAV) {
        switch (target) {
          case "ADMIN_PANEL":
            location.to("/administracion");
            return;

          case "SERVICIOS":
          case "HOME":
            location.to(URLS.SERVICIOS);
            return;

          case "POS":
          case "TPV":
          case "POS_CHECKOUT":
            location.to("/pos-checkout");
            return;

          case "CAJA":
          case "CAJA_ACTUAL":
            location.to("/caja-actual");
            return;

          case "STAFF_CALENDAR":
          case "CALENDAR":
          case "MI_CALENDARIO":
            location.to("/mi-calendario");
            return;

          default:
            console.warn("[only-staff] Destino no reconocido", {
              traceId,
              target,
            });
            return;
        }
      }

      /*
      -----------------------------------------------------------------------
      FLUJOS NATIVOS DE CAJA Y TPV
      -----------------------------------------------------------------------
      */
      const cashierTypes = new Set([
        MESSAGE_TYPES.CASHIER_STATE,
        MESSAGE_TYPES.TPV_TX,
        MESSAGE_TYPES.X_COUNT,
        MESSAGE_TYPES.Z_CLOSING,
      ]);

      if (cashierTypes.has(type)) {
        console.debug("[only-staff] Flujo nativo de caja", {
          traceId,
          type,
          cashierMode: CASHIER_MODE,
          txType: payload.txType || null,
        });

        /*
         * Estos mensajes deben ser procesados por widgetBridge/backend:
         *
         * CASHIER_STATE -> CASHIER_STATE_RES
         * TPV_TX        -> TPV_TX_RES
         * X_COUNT       -> X_COUNT_RES
         * Z_CLOSING     -> Z_CLOSING_RES
         *
         * Todos deben trabajar con:
         * - CajaActual
         * - MovimientosCaja
         * - ticketNumber
         * - traceId
         * - fiscalFingerprint
         * - cashRegisterStatus
         * - operationDate
         * - currentSequence
         */

        return;
      }

      /*
      -----------------------------------------------------------------------
      FICHAJES Y JORNADA
      -----------------------------------------------------------------------
      */
      const staffFlowTypes = new Set([
        MESSAGE_TYPES.CLOCK,
        MESSAGE_TYPES.GET_STATE,
        MESSAGE_TYPES.GET_HISTORY,
        MESSAGE_TYPES.HOURS_CALC,
        MESSAGE_TYPES.ADJUSTMENT,
      ]);

      if (staffFlowTypes.has(type)) {
        console.debug("[only-staff] Flujo de personal", {
          traceId,
          type,
        });

        /*
         * El bridge debe devolver:
         *
         * CLOCK       -> CLOCK_RES
         * GET_STATE   -> GET_STATE_RES
         * GET_HISTORY -> GET_HISTORY_RES
         * HOURS_CALC  -> HOURS_CALC_RES
         * ADJUSTMENT  -> ADJUSTMENT_RES
         */

        return;
      }

      console.warn("[only-staff] Tipo no soportado", {
        traceId,
        type,
      });
    },

    onError: (error) => {
      console.error("[only-staff] Error del widget bridge", {
        traceId,
        error: error?.message || String(error),
      });
    },
  });
});
