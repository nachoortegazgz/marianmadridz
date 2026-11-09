/*
=============================================================================
MODULE: pages/zonastaff.js
VERSION: v5003.0-staff-pos-cashier-calendar
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

  /* ────────────────────────────────────────────────────────────────────
     1) Control de acceso (solo staff / colaboradores)
     ──────────────────────────────────────────────────────────────────── */
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

  /* ────────────────────────────────────────────────────────────────────
     2) Datos del colaborador (permisos / identidad)
        - Si el backend aún no devuelve estos campos, quedan en modo
          conservador y el widget muestra sólo lo permitido.
     ──────────────────────────────────────────────────────────────────── */
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
    staffData.employeeName || staffData.employeeId || null;

  const roleLabel =
    staffData.roleLabel ||
    (isAdmin ? "ADMINISTRACION" : isCajero ? "CAJA" : "EQUIPO");

  /* ────────────────────────────────────────────────────────────────────
     3) Localización (fecha ISO ymd "hoy" en Europe/Madrid)
     ──────────────────────────────────────────────────────────────────── */
  const TZ = "Europe/Madrid";
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ })
    .format(new Date());

  /* ────────────────────────────────────────────────────────────────────
     4) Localizar widget
     ──────────────────────────────────────────────────────────────────── */
  const widget = $w("#htmlOnlyStaffPanel");

  if (!widget || typeof widget.postMessage !== "function") {
    console.error(
      "[only-staff] HTML widget not found or incompatible",
      { traceId }
    );
    return;
  }

  /* ────────────────────────────────────────────────────────────────────
     5) Bridge con el widget HTML
     ──────────────────────────────────────────────────────────────────── */
  bridge = createWidgetBridge(widget, {
    allowedTypes: [MESSAGE_TYPES.READY, MESSAGE_TYPES.CONTEXT, MESSAGE_TYPES.NAV],
    slug: "only-staff",
    traceId,
    handshakeTimeoutMs: UI.HANDSHAKE_TIMEOUT_MS,
    contextTimeoutMs: UI.CONTEXT_TIMEOUT_MS,

    /* ─────────────────────────────────────────────────────────────────
       CONTEXT: lo que recibe el widget al hacer handshake.
       El widget se guía por estos flags para mostrar/ocultar paneles.
       ───────────────────────────────────────────────────────────────── */
    onContextReady: async () => ({
      isAuthorized,

      // Tipo de panel (visible en cabecera del widget)
      panelType: "TPV",

      // ── Feature flags ───────────────────────────────────────────────
      enableClocking: false,       // deshabilitado: el bridge no invoca WebMethods de fichaje
      enableBreaks: false,         // deshabilitado hasta integrar fichajes
      enableCashier: false,        // deshabilitado: no hay handler conectado en esta pagina
      enableInventory: false,      // panel de inventario oculto
      enableScheduleQuery: false,  // panel de cálculo de horas oculto

      // ── Caja ────────────────────────────────────────────────────────
      cashierMode: "DISABLED",     // sin handler backend operativo
      isAdmin,
      isCajero,

      // ── Localización ────────────────────────────────────────────────
      currencyCode: "EUR",
      timeZone: TZ,
      today,

      // ── Identidad (para cabecera "Sesion activa: …") ────────────────
      memberName,
      employeeName,
      roleLabel,

      // ── Navegación / calendario ─────────────────────────────────────
      // Ruta pendiente de confirmar en el inventario publicado de Wix.
      calendarUrl: "/mi-calendario",
    }),

    /* El widget de staff permanece en modo placeholder: las funciones de caja,
       inventario y jornada están deshabilitadas y este controlador no invoca
       WebMethods de negocio. No activar flags hasta sincronizar el HTML real y
       definir un contrato de acciones backend probado.
       ───────────────────────────────────────────────────────────────── */
    onWidgetMessage: async (message) => {
      const type = String(message?.type || "").toUpperCase();
      const payload = message?.payload || {};
      const target = _safeTrim(payload.target || "");

      /* ── Navegación (sólo el widget la pide con MM_NAV) ───────────── */
      if (type === MESSAGE_TYPES.NAV) {
        switch (target) {
          case "ADMIN_PANEL":
            location.to(URLS.ADMIN_PANEL);
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

          /* Nuevo: calendario del miembro de staff loggeado.
             El widget lo pide con { target: "STAFF_CALENDAR" }. */
          case "STAFF_CALENDAR":
          case "CALENDAR":
          case "MI_CALENDARIO":
            location.to("/mi-calendario"); // ruta pendiente de confirmar en Wix
            break;

          default:
            console.warn("[only-staff] Unknown navigation target", {
              traceId,
              target,
            });
        }
        return;
      }

      // La zona staff es un placeholder: estos mensajes solo se registran
      // para diagnóstico. No existe en esta página un enrutamiento de caja.
      const CASHIER_TYPES = new Set([
        "TPV_TX",
        "X_COUNT",
        "Z_CLOSING",
        "CASHIER_STATE",
      ]);

      if (CASHIER_TYPES.has(type)) {
        console.debug("[only-staff] cashier message (not routed)", {
          traceId,
          type,
          txType: payload.txType || null,
        });
      }
    },

    /* ─────────────────────────────────────────────────────────────────
       Error handler del bridge
       ───────────────────────────────────────────────────────────────── */
    onError: (error) => {
      console.error("[only-staff] Widget bridge error", {
        traceId,
        error: error?.message || String(error),
      });
    },
  });
});
