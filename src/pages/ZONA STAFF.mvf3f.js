/*
=============================================================================
MODULE: pages/zonastaff.js
VERSION: v5005.0-staff-readonly-ui
=============================================================================
*/

import {
  MESSAGE_TYPES,
  UI,
  makeTraceId,
  _safeTrim,
  withTimeout,
} from "public/mmUtils";
import { createWidgetBridge } from "public/widgetBridge";
import { checkStaffCollaboratorAccess } from "backend/security.web.js";
import {
  getMyStaffContext,
  getEstadoJornada,
  getHistorialFichajes,
  calcularHorasTrabajadas,
} from "backend/horario.web.js";

let isAuthorized = false;

function _parseYmd(value) {
  const raw = _safeTrim(value || "");
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === raw ? date : null;
}

function _getYmdRange(startValue, endValue, maxDays) {
  const start = _parseYmd(startValue);
  const end = _parseYmd(endValue);
  if (!start || !end || end.getTime() < start.getTime()) {
    return { error: { code: "INVALID_DATE_RANGE", message: "Selecciona un rango de fechas válido." } };
  }
  const days = [];
  for (let time = start.getTime(); time <= end.getTime(); time += 86400000) {
    days.push(new Date(time).toISOString().slice(0, 10));
    if (days.length > maxDays) {
      return { error: { code: "DATE_RANGE_TOO_LARGE", message: `El rango máximo permitido es de ${maxDays} días.` } };
    }
  }
  return { days };
}

function _mapClockState(data) {
  const stateMap = {
    SIN_INICIAR: "INACTIVO",
    EN_JORNADA: "TRABAJANDO",
    EN_PAUSA: "EN_PAUSA",
    JORNADA_FINALIZADA: "INACTIVO",
  };
  return {
    estadoActual: stateMap[data?.estado] || "REVISIÓN",
    ultimoFichaje: data?.ultimoEvento
      ? { tipo: data.ultimoEvento.tipo, fechaHora: data.ultimoEvento.registradoEn }
      : null,
  };
}

function _widgetError(code, message) {
  return { status: "ERROR", data: null, error: { code, message } };
}

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

  const memberName =
    staffData.memberName ||
    staffData.contactName ||
    staffData.employeeName ||
    null;

  const employeeName =
    staffData.employeeName || staffData.employeeId || null;

  const roleLabel = staffData.roleLabel || "EQUIPO";

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
  createWidgetBridge(widget, {
    allowedTypes: [MESSAGE_TYPES.READY, MESSAGE_TYPES.CONTEXT, "GET_STATE", "GET_HISTORY", "HOURS_CALC"],
    slug: "only-staff",
    traceId,
    handshakeTimeoutMs: UI.HANDSHAKE_TIMEOUT_MS,
    contextTimeoutMs: UI.CONTEXT_TIMEOUT_MS,

    /* ─────────────────────────────────────────────────────────────────
       CONTEXT: lo que recibe el widget al hacer handshake.
       El widget se guía por estos flags para mostrar/ocultar paneles.
       ───────────────────────────────────────────────────────────────── */
    onContextReady: async () => {
      const staffContext = await withTimeout(
        () => getMyStaffContext({ traceId }),
        UI.FRONTEND_API_TIMEOUT_MS,
        "getMyStaffContext"
      ).catch(() => null);
      const hasStaffContext = staffContext?.status === "OK" && !!staffContext.data?.resourceId;

      const stateResult = hasStaffContext
        ? await withTimeout(
            () => getEstadoJornada({ dayKey: today, traceId }),
            UI.FRONTEND_API_TIMEOUT_MS,
            "getEstadoJornada"
          ).catch(() => null)
        : null;

      const resolvedName = staffContext?.data?.displayName || memberName || employeeName;
      const initialState = stateResult?.status === "OK"
        ? _mapClockState(stateResult.data)
        : { estadoActual: "REVISIÓN", ultimoFichaje: null, integrityStatus: "UNVERIFIED" };

      return {
        isAuthorized: isAuthorized && hasStaffContext,
        enableStateQuery: hasStaffContext,
        enableHistory: hasStaffContext,
        enableScheduleQuery: hasStaffContext,
        timeZone: TZ,
        today,
        memberName: resolvedName,
        roleLabel: staffContext?.data?.rolWebsite || roleLabel,
        estadoInicial: initialState,
      };
    },

    onWidgetMessage: async (message, reply) => {
      const type = String(message?.type || "").toUpperCase();
      const payload = message?.payload || {};

      if (type === "GET_STATE") {
        const result = await getEstadoJornada({ dayKey: payload.dayKey || today, traceId });
        if (result?.status !== "OK") {
          reply("GET_STATE_RES", _widgetError(result?.error?.code || "TIMECLOCK_STATE_UNAVAILABLE", result?.error?.message || "No se pudo verificar el estado de jornada."), payload);
          return;
        }
        reply("GET_STATE_RES", { status: "SUCCESS", data: _mapClockState(result.data) }, payload);
        return;
      }

      if (type === "GET_HISTORY") {
        const range = _getYmdRange(payload.startDateYMD, payload.endDateYMD, 92);
        if (range.error) {
          reply("GET_HISTORY_RES", range.error && _widgetError(range.error.code, range.error.message), payload);
          return;
        }
        const result = await getHistorialFichajes({
          startDateYMD: range.days[0],
          endDateYMD: range.days[range.days.length - 1],
          limit: 500,
          traceId,
        });
        if (result?.status !== "OK") {
          reply("GET_HISTORY_RES", _widgetError(result?.error?.code || "TIMECLOCK_HISTORY_UNAVAILABLE", result?.error?.message || "No se pudo consultar el historial."), payload);
          return;
        }
        const items = (result.data?.items || [])
          .sort((a, b) => new Date(a.registradoEn) - new Date(b.registradoEn))
          .map((item) => ({
            fechaHora: item.registradoEn,
            hora: item.horaRegistrada,
            diaKey: item.diaClave,
            tipo: item.fichajeEventoTipo,
            integrityStatus: item.integrityStatus,
            sequenceStatus: item.sequenceStatus,
          }));
        reply("GET_HISTORY_RES", { status: "SUCCESS", data: items }, payload);
        return;
      }

      if (type === "HOURS_CALC") {
        const range = _getYmdRange(payload.startDateYMD, payload.endDateYMD, 31);
        if (range.error) {
          reply("HOURS_CALC_RES", _widgetError(range.error.code, range.error.message), payload);
          return;
        }
        const result = await calcularHorasTrabajadas({
          startDateYMD: range.days[0],
          endDateYMD: range.days[range.days.length - 1],
          traceId,
        });
        if (result?.status !== "OK") {
          reply("HOURS_CALC_RES", _widgetError(result?.error?.code || "TIMECLOCK_HOURS_UNAVAILABLE", result?.error?.message || "No se pudieron calcular las horas."), payload);
          return;
        }
        const workedMinutes = Number(result.data?.minutosTrabajados) || 0;
        const pauseMinutes = Number(result.data?.minutosPausa) || 0;
        const eventCount = Number(result.data?.totalFichajesProcesados) || 0;
        const workedHours = Number((workedMinutes / 60).toFixed(2));
        const pauseHours = Number((pauseMinutes / 60).toFixed(2));
        const timeFormatted = `${Math.floor(workedMinutes / 60)}h ${workedMinutes % 60}m`;
        reply("HOURS_CALC_RES", {
          status: "SUCCESS",
          data: {
            horasTrabajadasDecimal: workedHours,
            tiempoFormateado: timeFormatted,
            horasPausaDecimal: pauseHours,
            totalFichajesProcesados: eventCount,
            jornadasAbiertas: Number(result.data?.jornadasAbiertas) || 0,
            integrityStatus: result.data?.integrityStatus || "UNVERIFIED",
          },
        }, payload);
        return;
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
