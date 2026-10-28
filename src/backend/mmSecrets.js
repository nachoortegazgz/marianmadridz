/*
=============================================================================
MODULE: backend/mmSecrets.js
VERSION: v5015-ALIGNED
BASE: v5009-FISCAL-V20.1 + verificacion contra internalConfig v12.0 y
      consumidores de v5015 (cajas.web, eventLog, securityEngine,
      fiscalDocuments, events, audit).
RESPONSIBILITY: Nombres canonicos de secretos Wix.
STANDARDS: G10 ASCII Strict.

CAMBIOS DE ALINEACION v5015-ALIGNED:
  ALN-01: Sin cambios funcionales respecto a v5009. Todos los nombres
          referenciados por los consumidores v5015 existen:
            - SECRETS.FISCAL_KEY (cajas.web, securityEngine)
            - SECRETS.FISCAL_NIF_EMISOR (cajas.web, events, fiscalAggregator)
            - SECRETS.FISCAL_SIGNER_ENDPOINT / _BEARER (cajas.web)
            - SECRETS.RESEND_API_KEY / _FROM_EMAIL (fiscalDocuments)
          CERO-DEUDA ZC-07: AUTH_JWT_KEY, ADMIN_EMAILS y CAJERO_EMAILS
          eliminados del mapa SECRETS (consumidor null verificado).

CORRECTIONS (heredadas):
  [VF-01].
=============================================================================
*/

export const SECRETS = Object.freeze({
    // Fiscal (obligatorio Veri*factu)
    FISCAL_KEY: "SECRET_FISCALKEY",
    FISCAL_NIF_EMISOR: "FISCAL_NIF_EMISOR",

    // Firma X.509 delegada en microservicio externo
    FISCAL_SIGNER_ENDPOINT: "FISCAL_SIGNER_ENDPOINT",
    FISCAL_SIGNER_BEARER: "FISCAL_SIGNER_BEARER",

    // CERO-DEUDA ZC-07: eliminados AUTH_JWT_KEY (securityEngine ya no
    // emite JWT), ADMIN_EMAILS y CAJERO_EMAILS (roles viven en
    // MapaStaff.rolWebsite desde v5010; consumidor null verificado grep).

    // Automatizacion
    POWER_AUTOMATE: "POWER_AUTOMATE_TOKEN",

    // Email (SendGrid legacy + Resend actual)
    SENDGRID_API_KEY: "SENDGRID_API_KEY",
    SENDGRID_FROM_EMAIL: "SENDGRID_FROM_EMAIL",
    RESEND_API_KEY: "RESEND_API_KEY",
    RESEND_FROM_EMAIL: "RESEND_FROM_EMAIL",

    // Asistente IA
    MARIAN_ASSISTANT_OPENAI_KEY: "MARIAN_ASSISTANT_OPENAI_KEY",

    // Microsoft 365 Graph API
    M365_GRAPH_CLIENT_ID: "M365_CLIENT_ID",
    M365_GRAPH_CLIENT_SECRET: "M365_CLIENT_SECRET",
    M365_GRAPH_TENANT_ID: "M365_TENANT_ID",
    M365_GRAPH_SITE_ID: "M365_GRAPH_SITE_ID",
    M365_GRAPH_LIST_ID: "M365_LIST_ID",
    M365_WEBHOOK_HMAC_KEY: "SECRET_M365_WEBHOOK_HMAC_KEY",
});