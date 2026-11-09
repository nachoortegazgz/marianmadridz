/*
=============================================================================
MODULE: backend/staffManager.web.js
VERSION: v1.0.1
RESPONSIBILITY: Gestion de equipo (listar, horas, avisos) para Marian.
STANDARDS: G10 ASCII Strict.

CAMBIOS v1.0.1:
  FIX-01: import wixData anadido (no-undef en v1.0.0).
=============================================================================
*/

import { Permissions, webMethod } from "wix-web-module";
import wixData from "wix-data";

const COLLABORATORS_COLLECTION = "StaffCollaborators"; // ajusta al nombre real
const CLOCKINGS_COLLECTION = "Fichajes";              // ajusta al nombre real

export const getStaffList = webMethod(
  Permissions.Admin,
  async ({ traceId = null } = {}) => {
    try {
      const { items } = await wixData
        .query(COLLABORATORS_COLLECTION)
        .limit(200)
        .find({ suppressAuth: false });

      return {
        status: "SUCCESS",
        data: {
          items: items.map((it) => ({
            id: it._id,
            name: it.name || it.displayName || it.email || "—",
            roleLabel: it.roleLabel || it.role || "EQUIPO",
            email: it.email || "—",
            status: it.status || "activo",
          })),
          traceId,
        },
      };
    } catch (error) {
      return {
        status: "ERROR",
        error: {
          code: "STAFF_LIST_FAILED",
          message: error?.message || "No se pudo cargar el equipo.",
        },
      };
    }
  }
);

export const getStaffHoursSummary = webMethod(
  Permissions.Admin,
  async ({
    employeeId = null,
    startDateYMD = null,
    endDateYMD = null,
    traceId = null,
  } = {}) => {
    if (!startDateYMD || !endDateYMD) {
      return {
        status: "ERROR",
        error: {
          code: "INVALID_RANGE",
          message: "Faltan fechas del rango.",
        },
      };
    }

    try {
      // TODO: reemplazar por la consulta real a tu coleccion de fichajes.
      // Aqui se devuelve un resumen vacio valido para que la UI funcione.
      return {
        status: "SUCCESS",
        data: {
          employeeId,
          startDateYMD,
          endDateYMD,
          horasTrabajadasDecimal: 0,
          horasPausaDecimal: 0,
          totalFichajesProcesados: 0,
          traceId,
        },
      };
    } catch (error) {
      return {
        status: "ERROR",
        error: {
          code: "HOURS_SUMMARY_FAILED",
          message: error?.message || "No se pudieron calcular las horas.",
        },
      };
    }
  }
);

export const sendStaffNotification = webMethod(
  Permissions.Admin,
  async ({
    employeeId,
    channel = "EMAIL",
    subject,
    message,
    traceId = null,
  } = {}) => {
    if (!employeeId || !subject || !message) {
      return {
        status: "ERROR",
        error: {
          code: "MISSING_FIELDS",
          message: "Faltan empleado, asunto o mensaje.",
        },
      };
    }

    try {
      // TODO: implementar el envio real (email / SMS / app interna).
      // Ejemplo con Wix Triggered Emails:
      //   await triggeredEmails.emailMember("AvisoStaff", memberId, { variables });
      return {
        status: "SUCCESS",
        data: { sent: true, channel, employeeId, traceId },
      };
    } catch (error) {
      return {
        status: "ERROR",
        error: {
          code: "NOTIFY_FAILED",
          message: error?.message || "No se pudo enviar el aviso.",
        },
      };
    }
  }
);
