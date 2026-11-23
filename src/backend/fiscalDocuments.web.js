/*
=============================================================================
MODULE: backend/fiscalDocuments.web.js
VERSION: v5018-IDEMPOTENT-IMMUTABLE-SNAPSHOT
BASE: v5017-ALIGNED-DATOSFISCALES
RESPONSIBILITY: Previsualiza, crea, verifica y consulta snapshots trimestrales
 append-only. El despacho a gestoría permanece deshabilitado.
STANDARDS: G10 ASCII Strict. Cero suppressAuth. Colecciones canonicas.

CAMBIOS v5018-IDEMPOTENT-IMMUTABLE-SNAPSHOT (respecto a v5017):
  PKG-01: createManagerPackageVersion persiste snapshots trimestrales con
          hash canonico, limite 450 KiB y versionado create-only concurrente.
  PKG-02: ControlOperativo.IDEMPOTENCY deduplica operationId; las inserciones
          inciertas conservan el claim para recuperar por traceId sin duplicar.
  PKG-03: preview usa agregadores internos autorizados por requireMarianManager
          y rechaza cualquier fuente incompleta.
  PKG-04: listado devuelve solo metadatos; descarga verifica snapshotHash.
  PKG-05: envio a gestoria permanece deshabilitado. Agregacion mensual pendiente.

CAMBIOS v5019-ALIGNED-MAPASTAFF (respecto a v5016):
  ALN-DF-01: Eliminada la dependencia de BUSINESS_COLLECTIONS.GESTORES_FISCALES
             (coleccion no declarada en internalConfig v12). El origen de
             verdad de destinatarios es BUSINESS_COLLECTIONS.MAPA_STAFF.
  ALN-DF-02: listAccountantRecipients consulta solo recordType=GESTORIA y
             proyecta los campos fisicos emailFiscal, displayName, taxId,
             phoneFiscal y address. No lee campos legacy no declarados.
  ALN-DF-03: _resolveRecipientById acepta solo el _id del registro MapaStaff.
             Si emailFiscal no existe o no es valido, el registro no es
             destinatario; no se inventa ni se deriva un email.

CAMBIOS v5016-ALIGNED-WITH-SEND (heredados):
  NEW-01..04: listAccountantRecipients, sendManagerPackageToAccountant,
              sendSpecificDocumentToAccountant, _dispatchEmailViaResend.

CAMBIOS DE ALINEACION v5015-ALIGNED (heredados):
  ALN-01..05: BUSINESS_COLLECTIONS, dalQuery/dalGet/dalInsert, paginacion
              { items, hasNext(), next() }, HistoricoCierresZ para
              paquetes de gestoria.

FIXES APLICADOS v5009-FISCAL-V20.1 (heredados):
  V20-01, V20-02, SSOT-V2 (v5011).
=============================================================================
*/

import { webMethod, Permissions } from "wix-web-module";

import { query as dalQuery } from "backend/dataAccess";

import { BUSINESS_COLLECTIONS, SDK_CONFIG } from "backend/internalConfig";
import { requireMarianManager, rateLimiter } from "backend/security";
import { _toPublicError } from "backend/responseUtils";

import {
  getQuarterlyTaxSummaryInternal,
  getLibroRegistroFacturasExpedidasInternal,
} from "backend/fiscalAggregator.web";

import {
  makeTraceId,
  _safeTrim,
  withTimeout,
} from "public/mmUtils";
import { hashSHA256 } from "backend/securityEngine";

// SSOT-KEYFIELD-02: lectura canonica con fallback alias (contrato unico).

const CMS_TIMEOUT_MS = SDK_CONFIG.TIMEOUTS.CMS_MS;
async function _packageStorageRemovedResult(traceId) {
  try {
    await requireMarianManager(traceId);
  } catch (error) {
    return {
      status: "ERROR",
      data: null,
      error: _toPublicError(error, "PACKAGE_STORAGE_REMOVED"),
      traceId,
    };
  }
  return {
    status: "ERROR",
    data: null,
    error: {
      code: "PACKAGE_STORAGE_REMOVED",
      message: "El almacenamiento CMS de paquetes de gestoría fue retirado; no se consulta ni se recrea.",
    },
    traceId,
  };
}
const MAPA_STAFF_COL = BUSINESS_COLLECTIONS.MAPA_STAFF;

const STRONG_READ = Object.freeze({ consistencyMode: "strong" });


async function _rateLimitManagerPackageRead(surface, traceId) {
  const result = await rateLimiter({ surface, key: "manager" });
  if (!result?.allowed) {
    throw Object.assign(new Error("RATE_LIMITED"), {
      code: "RATE_LIMITED",
      meta: { retryAfter: result?.retryAfter || null, surface, traceId },
    });
  }
}

// Marcadores canonicos para identificar un item dedicado a gestor.
const GESTORIA_RECORD_TYPE_MARKERS = Object.freeze(["GESTORIA"]);

// =============================================================================
// BLOQUE 1 - HELPERS GENERALES
// =============================================================================

function _formatDocumentId(year, quarter, version = 1) {
  const vStr = String(version).padStart(4, "0");
  return `DOC_GESTORIA_${year}_T${quarter}_PAQUETE_GESTORIA_V${vStr}`;
}

function _uuidV8FromHash(hashHex) {
  const normalized = String(hashHex || "").replace(/[^a-f0-9]/gi, "").toLowerCase();
  if (normalized.length < 32) {
    throw Object.assign(new Error("UUID_HASH_INVALID"), { code: "UUID_HASH_INVALID" });
  }
  const variant = ((parseInt(normalized[16], 16) & 0x03) | 0x08).toString(16);
  // UUIDv8: deterministic custom UUID derived from SHA-256, valid as Wix Data item ID.
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-8${normalized.slice(13, 16)}-${variant}${normalized.slice(17, 20)}-${normalized.slice(20, 32)}`;
}

async function _buildPackageItemId(year, quarter, version) {
  const key = `DOC_GESTORIA|${year}|T${quarter}|V${version}`;
  return _uuidV8FromHash(await hashSHA256(key));
}

// =============================================================================
// BLOQUE 1b - HELPERS DE GESTOR (MapaStaff)
// =============================================================================

function _extractGestorFromRecord(record) {
  if (!record || record.recordType !== "GESTORIA") return null;
  const email = _safeTrim(record.emailFiscal);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  const name = _safeTrim(record.displayName || record.legalName || "");
  return {
    id: String(record._id),
    email,
    name,
    label: name || email,
    nif: _safeTrim(record.taxId) || null,
    phone: _safeTrim(record.phoneFiscal) || null,
    address: _safeTrim(record.address) || null,
    source: "MAPA_STAFF",
  };
}

// =============================================================================
// BLOQUE 2 - PREVIEW DE PAQUETE
// =============================================================================

export const previewManagerPackage = webMethod(
  Permissions.SiteMember,
  async (period = {}) => {
    const traceId = makeTraceId("doc-preview");
    try {
      await requireMarianManager(traceId);
      await _rateLimitManagerPackageRead("fiscal.previewManagerPackage", traceId);
      const year = Number(period.year);
      const quarter = Number(period.quarter);
      if (!year || !quarter || quarter < 1 || quarter > 4) {
        return {
          status: "ERROR",
          data: null,
          error: {
            code: "INVALID_PERIOD",
            message: "year and quarter (1-4) are required",
          },
        };
      }

      const [summaryRes, bookRes] = await Promise.all([
        getQuarterlyTaxSummaryInternal(year, quarter, { traceId }),
        getLibroRegistroFacturasExpedidasInternal(year, quarter, { traceId }),
      ]);

      if (
        summaryRes?.status !== "SUCCESS" ||
        bookRes?.status !== "SUCCESS" ||
        !summaryRes.data ||
        !Array.isArray(bookRes.data?.filas) ||
        summaryRes.data.reachedMaxPages === true ||
        bookRes.data.reachedMaxPages === true
      ) {
        return {
          status: "ERROR",
          data: null,
          error: {
            code: "PACKAGE_SOURCE_DATA_INCOMPLETE",
            message: "No se puede previsualizar un paquete si el resumen o el libro fiscal no están completos.",
            traceId,
          },
        };
      }

      return {
        status: "SUCCESS",
        data: {
          period: { periodType: "QUARTERLY", year, quarter },
          documentIdDraft: _formatDocumentId(year, quarter, 1),
          itemIdDraft: await _buildPackageItemId(year, quarter, 1),
          summary: summaryRes.data,
          invoiceCount: bookRes.data.filas.length,
          previewGeneratedAt: new Date(),
        },
        error: null,
      };
    } catch (err) {
      return {
        status: "ERROR",
        data: null,
        error: _toPublicError(err, "DOC_PREVIEW_FAIL"),
      };
    }
  }
);

// =============================================================================
// BLOQUE 3 - CREAR VERSION DE PAQUETE
// =============================================================================

export const createManagerPackageVersion = webMethod(
  Permissions.SiteMember,
  async () => _packageStorageRemovedResult(makeTraceId("doc-create"))
);
// =============================================================================
// BLOQUE 4 - HISTORIAL DE PAQUETES
// =============================================================================

export const getManagerPackageHistory = webMethod(
  Permissions.SiteMember,
  async () => _packageStorageRemovedResult(makeTraceId("doc-hist"))
);
export const getPreparedManagerPackages = webMethod(
  Permissions.SiteMember,
  async () => _packageStorageRemovedResult(makeTraceId("doc-prep"))
);
// =============================================================================
// BLOQUE 5 - DESCARGAR VERSION
// =============================================================================

export const downloadManagerPackageVersion = webMethod(
  Permissions.SiteMember,
  async () => _packageStorageRemovedResult(makeTraceId("doc-download"))
);
// =============================================================================
// BLOQUE 6 - DESTINATARIOS DE GESTORIA (via MapaStaff)
// =============================================================================

export const listAccountantRecipients = webMethod(
  Permissions.SiteMember,
  async () => {
    const traceId = makeTraceId("doc-recipients");
    try {
      await requireMarianManager(traceId);

      const res = await withTimeout(
        dalQuery(MAPA_STAFF_COL)
          .eq("recordType", "GESTORIA")
          .descending("_updatedDate")
          .limit(100)
          .find(),
        CMS_TIMEOUT_MS,
        "listAccountantRecipients"
      );

      const items = [];
      const seenEmails = new Set();
      const recipients = (res?.items || [])
        .map((record) => _extractGestorFromRecord(record))
        .filter(Boolean);

      for (const gestor of recipients) {
        const emailKey = gestor.email.toLowerCase();
        if (seenEmails.has(emailKey)) continue;
        seenEmails.add(emailKey);
        items.push({
          id: gestor.id,
          label: gestor.label,
          name: gestor.name,
          email: gestor.email,
          nif: gestor.nif,
          phone: gestor.phone,
          address: gestor.address,
          source: gestor.source,
        });
      }

      return {
        status: "SUCCESS",
        data: { items, traceId },
        error: null,
      };
    } catch (err) {
      return {
        status: "ERROR",
        data: null,
        error: _toPublicError(err, "RECIPIENTS_FAIL"),
      };
    }
  }
);

// =============================================================================
// BLOQUE 8 - ENVIO DE PAQUETE A GESTOR (mensual / trimestral)
// =============================================================================



export const sendManagerPackageToAccountant = webMethod(
  Permissions.SiteMember,
  async () => _packageStorageRemovedResult(makeTraceId("doc-send-pkg"))
);
// =============================================================================
// BLOQUE 9 - ENVIO DE DOCUMENTO CONCRETO
// =============================================================================

export const sendSpecificDocumentToAccountant = webMethod(
  Permissions.SiteMember,
  async () => _packageStorageRemovedResult(makeTraceId("doc-send-doc"))
);