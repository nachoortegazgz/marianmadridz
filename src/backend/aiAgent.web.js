/*
=============================================================================
MODULE: backend/aiAgent.web.js
VERSION: v1.0.0-stub
RESPONSIBILITY: Asistente IA para la propietaria (Marian Madrid).
NOTES: Stub funcional. Sustituir el cuerpo por la llamada real al
       proveedor LLM cuando esté conectado (OpenAI, Anthropic, Wix AI...).
=============================================================================
*/

import { Permissions, webMethod } from "wix-web-module";

export const askMarianAI = webMethod(
  Permissions.Admin,
  async ({ query, conversationId = null, contextHints = null, traceId = null } = {}) => {
    if (!query || typeof query !== "string" || !query.trim()) {
      return {
        status: "ERROR",
        error: { code: "EMPTY_QUERY", message: "La consulta esta vacia." },
      };
    }

    // TODO: sustituir por llamada real al proveedor LLM.
    // Ejemplo esperado:
    //
    //   const reply = await callLLM({
    //     system: "Eres asistente de Marian Madrid, peluqueria...",
    //     user: query,
    //     conversationId,
    //     context: { fiscal, caja, staff, ... }
    //   });
    //
    //   return {
    //     status: "SUCCESS",
    //     data: { text: reply.text, conversationId: reply.id }
    //   };

    return {
      status: "SUCCESS",
      data: {
        text:
          "Asistente IA pendiente de conectar. Recibi tu consulta: \"" +
          query.trim() +
          "\". Configura el proveedor LLM en backend/aiAgent.web.js.",
        conversationId: conversationId || "conv_" + Date.now().toString(36),
        traceId: traceId || null,
      },
    };
  }
);
