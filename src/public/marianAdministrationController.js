/*
=============================================================================
MODULE: public/marianAdministrationController.js
VERSION: v5010.2-PUBLIC-EXEC
BASE: v5010.1-PUBLIC-ALIGN + FASE2 (MAC-B01..B07) + frontend alignment pass
RESPONSIBILITY: Controlador del widget de administracion (HTML component).
  Traduce acciones MM_ADMIN_* a webMethods backend via el bridge canonico.
STANDARDS: G10 ASCII Strict, Velo V3 SDK. No importa modulos backend.

FIXES APLICADOS v5010.2-PUBLIC-EXEC:
  - FIX-PUB-08 [CRITICO]: El dispatch ahora invoca los webMethods reales del
    backend. Antes solo devolvia un eco con targetMethod sin ejecutar nada.
  - FIX-PUB-09: ALLOWED_TYPES incluye MM_ADMIN_RESPONSE en la whitelist de
    salida (WB-B01) para que el bridge no descarte las respuestas.
  - FIX-PUB-10: _readPeriodParams valida month con bounds [1,12].
  - FIX-PUB-11: dispatch asincrono con try/catch por accion.
=============================================================================
*/

import { createWidgetBridge } from "public/widgetBridge";

const ADMIN_ACTION_TYPES = Object.freeze({
  REQUEST: "MM_ADMIN",
  RESPONSE_INNER: "MM_ADMIN_RESPONSE",
});

// WB-B01 (SSOT whitelist): MM_ADMIN_REQUEST entra / MM_ADMIN_RESPONSE sale.
const ADMIN_ALLOWED_TYPES = new Set(["MM_ADMIN_REQUEST", "MM_ADMIN_RESPONSE"]);

function _sendResponse(bridge, messageId, body) {
  try {
    bridge.send("MM_ADMIN_RESPONSE", body, messageId);
  } catch (_) {
    // Bridge destruido: nada que reintentar en el front.
  }
}

function _postError(bridge, messageId, message, code) {
  _sendResponse(bridge, messageId, {
    type: ADMIN_ACTION_TYPES.RESPONSE_INNER,
    messageId,
    status: "ERROR",
    error: { code: code || "UNKNOWN", message: message || "Unknown error" },
  });
}

function _readYear(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 2020 || n > 2100) return null;
  return Math.floor(n);
}
function _readQuarter(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1 || n > 4) return null;
  return Math.floor(n);
}
function _readMonth(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1 || n > 12) return null;
  return Math.floor(n);
}
function _readEmail(value) {
  const s = String(value || "").trim().toLowerCase();
  if (!s || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return null;
  return s;
}
function _readDocumentId(value) {
  const s = String(value || "").trim();
  if (!s || s.length > 200) return null;
  return s;
}
function _readPeriodParams(payload) {
  return {
    year: _readYear(payload?.year),
    quarter: _readQuarter(payload?.quarter),
    month: _readMonth(payload?.month),
  };
}

/**
 * Mapa de accion -> { module, method }.
 * module: ruta del webModule backend (sin extension).
 * method: nombre del webMethod exportado.
 *
 * IMPORTANTE: verificar que cada method existe en el backend antes de
 * desplegar. Los marcados con [VERIFICAR] no aparecen en la lista de
 * webMethods declarados con Permissions.SiteMember/Admin.
 */
const ADMIN_ACTION_DISPATCH = Object.freeze({
  GET_CASHIER_STATE:              { module: "backend/cajas.web",               method: "getCashierState" },
  REGISTER_MANUAL_TX:             { module: "backend/cajas.web",               method: "registerManualTransaction" },
  REGISTER_Z_CLOSING:             { module: "backend/cajas.web",               method: "registerZClosing" },
  VERIFY_HASH_CHAIN:              { module: "backend/cajas.web",               method: "verifyFiscalHashChainIntegrity" },
  GET_INVENTORY_DASHBOARD:        { module: "backend/inventario.web",          method: "getInventoryDashboard" },
  GET_RECONCILIATION_QUEUE:       { module: "backend/inventario.web",          method: "getInventoryReconciliationQueue" },
  GET_FISCAL_REPORT:              { module: "backend/fiscalAggregator.web",    method: "getLibroRegistroFacturasExpedidas" },
  GET_QUARTERLY_TAX_SUMMARY:      { module: "backend/fiscalAggregator.web",    method: "getQuarterlyTaxSummary" },
  GET_Z_CLOSING_REPORT:           { module: "backend/fiscalAggregator.web",    method: "getLibroRegistroFacturasExpedidas" },
  // --- Los siguientes NO aparecen en la lista de webMethods declarados ---
  // Descomentar y ajustar cuando existan en el backend.
  // REGISTER_X_COUNT:            { module: "backend/cajas.web",    method: "registerXCount" },
  // GET_STAFF_CONTEXT:           { module: "backend/staff.web",    method: "getMyStaffContext" },
  // REGISTER_FICHAJE:            { module: "backend/staff.web",    method: "registrarFichaje" },
  // GET_JORNADA_STATE:           { module: "backend/staff.web",    method: "getEstadoJornada" },
  // CHECK_ADMIN_ACCESS:          { module: "backend/security.web", method: "checkAdminAccess" },
  // CHECK_CAJERO_ACCESS:         { module: "backend/security.web", method: "checkCajeroAccess" },
  // GENERATE_CIERRE_Z_REPORT:    { module: "backend/cajas.web",    method: "generateCierreZReport" },
});

/**
 * Cache de modulos importados dinamicamente.
 * En Velo, los webModules se importan desde el frontend con import()
 * dinamico, pero solo si el modulo esta en /backend y exporta webMethods.
 */
const _moduleCache = new Map();

async function _loadModule(modulePath) {
  if (_moduleCache.has(modulePath)) return _moduleCache.get(modulePath);
  try {
    const mod = await import(modulePath);
    _moduleCache.set(modulePath, mod);
    return mod;
  } catch (err) {
    throw new Error(`Module not found: ${modulePath}`);
  }
}

async function _invokeAction(action, params) {
  const entry = ADMIN_ACTION_DISPATCH[action];
  if (!entry) throw new Error(`Unknown action: ${action}`);

  const mod = await _loadModule(entry.module);
  const fn = mod[entry.method];
  if (typeof fn !== "function") {
    throw new Error(`Method not found: ${entry.module}#${entry.method}`);
  }

  // Los webMethods reciben (payload, options). Se pasa params como payload.
  return fn(params || {});
}

/**
 * Inicializa el puente widget <-> pagina ADMINISTRACION.
 * @param {object} widget Elemento HTML Component de Velo.
 * @param {string} slug Slug de la pagina (trazabilidad).
 * @returns {{bridge: object, destroy: function}}
 */
export function initMarianAdministration(widget, slug) {
  if (!widget) throw new Error("initMarianAdministration: widget is required");

  const bridge = createWidgetBridge(widget, {
    allowedTypes: ADMIN_ALLOWED_TYPES,
    onMessage: async (message) => {
      const payload = message?.payload || {};
      const action = payload.action;
      const messageId = message?.messageId || `msg_${Date.now()}`;

      if (message?.type !== "MM_ADMIN_REQUEST" || !action || !ADMIN_ACTION_DISPATCH[action]) {
        _postError(
          bridge,
          messageId,
          `Unknown action: ${String(action).slice(0, 40)}`,
          "UNKNOWN_ACTION"
        );
        return;
      }

      try {
        const result = await _invokeAction(action, payload.params || {});
        _sendResponse(bridge, messageId, {
          type: ADMIN_ACTION_TYPES.RESPONSE_INNER,
          messageId,
          status: "OK",
          action,
          data: result,
          pageSlug: String(slug || ""),
        });
      } catch (err) {
        _postError(
          bridge,
          messageId,
          err?.message || "Dispatch failed",
          "DISPATCH_FAIL"
        );
      }
    },
    onError: (err, data) => {
      console.error("[MarianAdministration] Error:", err?.code || err, data);
    },
  });

  return { bridge, destroy: () => bridge.destroy() };
}

export {
  _readYear,
  _readQuarter,
  _readMonth,
  _readEmail,
  _readDocumentId,
  _readPeriodParams,
  ADMIN_ACTION_DISPATCH,
};
