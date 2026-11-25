/*
 * MODULE: src/config/mvpConfig.js
 * VERSION: v1.0-MVP
 * RESPONSIBILITY: Single source of truth for MVP runtime configuration.
 * INVARIANTES: authority by entity, operational states, QA gates, double-write control.
 */

export const AUTHORITY = Object.freeze({
  // Wix native apps govern their own entities; CMS never confirms them.
  BOOKINGS: "wixBookings",
  STORES: "wixStores",
  ECOMMERCE: "wixEcom",
  PAYMENTS: "wixPayments",
  INVOICES: "wixInvoices",
  // CMS governs only custom business entities.
  CMS_CUSTOM: "wixCms",
});

export const OPERATIONAL_STATE = Object.freeze({
  RECEIVED: "RECEIVED",
  VALIDATED: "VALIDATED",
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  FAILED: "FAILED",
  RECONCILIATION_REQUIRED: "RECONCILIATION_REQUIRED",
  RECTIFIED: "RECTIFIED",
});

export const QA_GATE = Object.freeze({
  CONTRACTS: "contracts",
  PERMISSIONS: "permissions",
  IDEMPOTENCY: "idempotency",
  PERSISTENCE: "persistence",
  RECONCILIATION: "reconciliation",
  FISCALITY: "fiscality",
  E2E: "e2e",
  PUBLICATION: "publication",
});

export const SITE = Object.freeze({
  TIMEZONE: "Europe/Madrid",
  CURRENCY: "EUR",
  LOCALE: "es-ES",
  SITE_ID: "188bed94-177c-4bc9-a9f0-35080d874f3e",
  DOMAIN: "marianmadrid.es",
});

export const PROTOCOL = Object.freeze({
  VERSION: 1,
  MESSAGE_TYPES: Object.freeze({
    READY: "MM_READY",
    CONTEXT: "MM_CONTEXT",
    AVAIL: "MM_AVAIL",
    BOOK: "MM_BOOK",
    NAV: "MM_NAV",
    PROFILE: "MM_PROFILE",
  }),
});

export const RATE_LIMITS = Object.freeze({
  PUBLIC_BOOKING: { MAX_REQUESTS: 5, WINDOW_MS: 10000 },
  DEFAULT: { MAX_REQUESTS: 20, WINDOW_MS: 5000 },
});

export const TIMEOUTS = Object.freeze({
  HANDSHAKE_MS: 30000,
  CONTEXT_MS: 120000,
  BOOKING_MS: 150000,
  API_MS: 15000,
});

export const COLLECTIONS = Object.freeze({
  // CMS custom collections (authority for custom business entities only)
  CAJA_ACTUAL: "CajaActual",
  MOVIMIENTOS_CAJA: "MovimientosCaja",
  CONTROL_OPERATIVO: "ControlOperativo",
  SERVICIOS_CATALOGO: "ServiciosCatalogo",
  COMPLEMENTOS_CATALOGO: "ComplementosCatalogo",
  MAPA_STAFF: "MapaStaff",
});
