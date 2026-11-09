/*
=============================================================================
MODULE: backend/aiAgent.web.js
VERSION: v1.1.0-fail-closed
RESPONSIBILITY: Contrato del asistente de Marian mientras no exista proveedor.
SECURITY: Nunca devuelve una respuesta simulada como si procediera de una IA.
=============================================================================
*/
import { Permissions, webMethod } from "wix-web-module";

export const askMarianAI = webMethod(
    Permissions.Admin,
    async ({ traceId = null } = {}) => ({
        status: "ERROR",
        data: null,
        error: {
            code: "AI_PROVIDER_NOT_CONFIGURED",
            message: "El proveedor de IA no esta configurado; la consulta no se ha procesado.",
            traceId: traceId || null,
        },
    })
);
