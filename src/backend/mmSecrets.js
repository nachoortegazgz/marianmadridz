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

});