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
      enableClocking: true,        // cuadro de fichaje
      enableBreaks: true,          // botones Inicio/Fin Pausa
      enableCashier: true,         // cuadro de CAJA/TPV
      enableInventory: false,      // panel de inventario oculto
      enableScheduleQuery: false,  // panel de cálculo de horas oculto

      // ── Caja ────────────────────────────────────────────────────────
      cashierMode: "SIMULADA",     // "SIMULADA" | "REAL"
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
      calendarUrl: "/mi-calendario", // ruta real del calendario del staff
    }),

    /* ─────────────────────────────────────────────────────────────────
       MENSAJES del widget
       ─────────────────────────────────────────────────────────────────
       Contrato backend esperado (el bridge debe enrutar a backend y
       devolver el _RES correspondiente):

         CLOCK           → CLOCK_RES           (fichajes)
         GET_STATE       → GET_STATE_RES       (estado jornada)
         GET_HISTORY     → GET_HISTORY_RES
         HOURS_CALC      → HOURS_CALC_RES
         ADJUSTMENT      → ADJUSTMENT_RES

         CASHIER_STATE   → CASHIER_STATE_RES   { saldoTotal, totalOperaciones,
                                                 diaKey, movimientos[] }
         TPV_TX          → TPV_TX_RES          { ticket: { ticketNumber,
                                                 createdAt, supplierName,
                                                 supplierNif, concept, amount,
                                                 paymentMethod, traceId,
                                                 fiscalFingerprint,
                                                 issuerName, issuerCif } }
         X_COUNT         → X_COUNT_RES         { ticket: { … } }
         Z_CLOSING       → Z_CLOSING_RES       { ticket: { … } }

         INVENTORY_*     → INVENTORY_*_RES

       Estos mensajes de caja deben:
         · Escribir en la colección nativa `MovimientosCaja`
         · Actualizar `CajaActual` (saldoTotal, totalOperaciones, diaKey)
         · Generar número de ticket secuencial
         · Estampar traza (traceId) + huella fiscal (fiscalFingerprint)

       Si el bridge no auto-enruta, añadir aquí las llamadas
       explícitas a backend y devolver el `_RES` correspondiente.
       ───────────────────────────────────────────────────────────────── */
    onWidgetMessage: async (message) => {
      const type = String(message?.type || "").toUpperCase();
      const payload = message?.payload || {};
      const target = _safeTrim(payload.target || "");

      /* ── Navegación (sólo el widget la pide con MM_NAV) ───────────── */
      if (type === MESSAGE_TYPES.NAV) {
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

          /* Nuevo: calendario del miembro de staff loggeado.
             El widget lo pide con { target: "STAFF_CALENDAR" }. */
          case "STAFF_CALENDAR":
          case "CALENDAR":
          case "MI_CALENDARIO":
            location.to("/mi-calendario"); // ajustar ruta real
            break;

          default:
            console.warn("[only-staff] Unknown navigation target", {
              traceId,
              target,
            });
        }
        return;
      }

      /* ── Caja / TPV ────────────────────────────────────────────────
         Los tipos TPV_TX, X_COUNT, Z_CLOSING y CASHIER_STATE deben
         ser enrutados por el bridge o por el backend. Aquí sólo
         dejamos logging defensivo si el tipo no es conocido por el
         bridge (para detectar desalineaciones de contrato).
         ──────────────────────────────────────────────────────────── */
      const CASHIER_TYPES = new Set([
        "TPV_TX",
        "X_COUNT",
        "Z_CLOSING",
        "CASHIER_STATE",
      ]);

      if (CASHIER_TYPES.has(type)) {
        // Si tu `widgetBridge` no auto-enruta estos tipos, sustituye
        // este bloque por:
        //
        //   import {
        //     cashierState,
        //     tpvTx,
        //     xCount,
        //     zClosing,
        //   } from "backend/cashier.web.js";
        //
        //   const handlerMap = {
        //     CASHIER_STATE: cashierState,
        //     TPV_TX: tpvTx,
        //     X_COUNT: xCount,
        //     Z_CLOSING: zClosing,
        //   };
        //   const fn = handlerMap[type];
        //   const res = await fn(payload);
        //   return { type: `${type}_RES`, payload: res };
        //
        // El retorno debe ser `{ type: 'XXX_RES', payload }` para que
        // el bridge lo reenvíe al widget.
        console.debug("[only-staff] cashier message", {
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
