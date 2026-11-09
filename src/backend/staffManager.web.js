/*
=============================================================================
MODULE: backend/staffManager.web.js
VERSION: v1.1.0-fail-closed
RESPONSIBILITY: Contratos de gestion de equipo pendientes de integracion.
SECURITY: No consulta colecciones inventadas ni simula horas o notificaciones.
=============================================================================
*/
import { Permissions, webMethod } from "wix-web-module";

function notImplemented(operation, traceId) {
    return {
        status: "ERROR",
        data: null,
        error: {
            code: "STAFF_OPERATION_NOT_IMPLEMENTED",
            message: `${operation} no esta conectado a los WebMethods canonicos de personal.`,
            traceId: traceId || null,
        },
    };
}

export const getStaffList = webMethod(
    Permissions.Admin,
    async ({ traceId = null } = {}) => notImplemented("STAFF_LIST", traceId)
);

export const getStaffHoursSummary = webMethod(
    Permissions.Admin,
    async ({ traceId = null } = {}) => notImplemented("STAFF_HOURS_SUMMARY", traceId)
);

export const sendStaffNotification = webMethod(
    Permissions.Admin,
    async ({ traceId = null } = {}) => notImplemented("STAFF_NOTIFY", traceId)
);
