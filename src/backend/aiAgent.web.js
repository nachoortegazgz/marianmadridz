import { Permissions, webMethod } from "wix-web-module";

/**
 * Deliberately disabled AI endpoint.
 * No provider, secret lookup, network transport or generated advice is active.
 * Keep this fail-closed contract until the AI feature has an approved design,
 * privacy review, consent flow and verified user-facing legal disclosures.
 */
export const askMarianAI = webMethod(
  Permissions.SiteMember,
  async (input = {}) => {
    const traceId = typeof input?.traceId === "string" &&
      input.traceId.trim().length > 0 &&
      input.traceId.trim().length <= 128
      ? input.traceId.trim()
      : null;

    return {
      status: "ERROR",
      data: null,
      error: {
        code: "AI_PROVIDER_NOT_CONFIGURED",
        message: "El proveedor de IA no esta configurado; la consulta no se ha procesado.",
        ...(traceId ? { traceId } : {}),
      },
    };
  }
);
