/*
=============================================================================
MODULE: backend/fiscalDocuments.web.js
VERSION: v5015-ALIGNED
BASE: v5009-FISCAL-V20.1 + alineacion con internalConfig v12.0-SSOT-FINAL
      y dataAccess v2.1-UNIFIED
RESPONSIBILITY: Genera paquetes fiscales trimestrales, documentos CSV/PDF,
 mantiene historial de versiones y despacha via Resend API.
STANDARDS: G10 ASCII Strict. Cero suppressAuth. Colecciones canonicas.

CAMBIOS DE ALINEACION v5015-ALIGNED (respecto a v5009-FISCAL-V20.1):
  ALN-01: COLLECTIONS alias eliminado. Uso de BUSINESS_COLLECTIONS.
  ALN-02: wixData.query/get/insert -> dalQuery/dalGet/dalInsert (dataAccess v2.4).
  ALN-04: Paginacion query(...).find() usa la interfaz { items, hasNext(),
          next() } de dataAccess. next() es async y se awaita.
  ALN-05: Se mantiene el uso de HistoricoCierresZ como almacen de paquetes
          de gestoria (patron historico del sistema). NOTA: la BIBLIA
          registra deuda tecnica por mezclar dominios (cierre Z + paquetes)
          en esta coleccion (seccion 20.1). Se preserva tal cual para no
          romper compatibilidad con los datos existentes.

FIXES APLICADOS v5009-FISCAL-V20.1 (heredados):
  - V20-01, V20-02 (nota auditoria), SSOT-V2 (v5011).
=============================================================================
*/

import { webMethod, Permissions } from "wix-web-module";

import {
  query as dalQuery,
  getItem as dalGet,
  insertItem as dalInsert,
} from "backend/dataAccess";

import { BUSINESS_COLLECTIONS, SDK_CONFIG } from "backend/internalConfig";
import { requireMarianManager } from "backend/security";
import { _toPublicError } from "backend/responseUtils";

import {
  getQuarterlyTaxSummary,
  getLibroRegistroFacturasExpedidasInternal,
} from "backend/fiscalAggregator.web";

import { makeTraceId, _safeTrim, withTimeout, _roundMoney } from "public/mmUtils";

// SSOT-KEYFIELD-02: lectura canonica con fallback alias (contrato unico).
import { readMovementField } from "backend/data";

const CMS_TIMEOUT_MS = Number(SDK_CONFIG?.TIMEOUTS?.CMS_MS) || 15000;
const DOCS_COL = BUSINESS_COLLECTIONS.HISTORICO_CIERRES_Z;

const STRONG_READ = Object.freeze({ consistencyMode: "strong" });

// =============================================================================
// BLOQUE 1 - HELPERS
// =============================================================================

function _formatDocumentId(year, quarter, version = 1) {
  const vStr = String(version).padStart(4, "0");
  return `DOC_GESTORIA_${year}_T${quarter}_PAQUETE_GESTORIA_V${vStr}`;
}

// SSOT-KEYFIELD-02: consume el contrato canon->alias UNICO (data.js) sobre
// claves fisicas canonicas; cero grafias alias aqui.
const _rf = (m, key) => _safeTrim(readMovementField(m, key));

function _buildCsvFromInvoices(invoices) {
  if (!Array.isArray(invoices) || invoices.length === 0) return "";
  const header = "Numero;Fecha;Tipo;Base;Cuota;Total;FormaPago;Hash\n";
  const rows = invoices.map((inv) =>
    `"${_rf(inv, "numSerieFactura")}";` +
    `"${_rf(inv, "fechaOperacion")}";` +
    `"${_rf(inv, "movementType").toUpperCase()}";` +
    `${_roundMoney(Number(_rf(inv, "taxBase")) || 0)};` +
    `${_roundMoney(Number(_rf(inv, "taxAmount")) || 0)};` +
    `${_roundMoney(Number(_rf(inv, "totalAmount")) || 0)};` +
    `"${_rf(inv, "paymentMethod")}";` +
    `"${_rf(inv, "recordHash")}"`
  ).join("\n");
  return header + rows;
}

function _buildSummaryText(summary) {
  if (!summary) return "Sin datos de resumen.";
  const lines = [];
  lines.push(`Ejercicio: ${summary.ejercicio || "N/A"}`);
  lines.push(`Trimestre: ${summary.trimestre || "N/A"}`);
  lines.push(`Total Operaciones: ${summary.totalOperaciones || 0}`);
  lines.push(`Total Operaciones Fiscales: ${summary.totalOperacionesFiscales || 0}`);
  if (summary.totales) {
    lines.push(`Total Ventas Brutas: ${_roundMoney(summary.totales.totalVentasBrutas || 0)} EUR`);
    lines.push(`Total Reembolsos: ${_roundMoney(summary.totales.totalReembolsos || 0)} EUR`);
    lines.push(`Total Facturado Neto: ${_roundMoney(summary.totales.totalFacturadoNeto || 0)} EUR`);
  }
  if (summary.borradorIva) {
    lines.push(`Borrador IVA - Base Imponible: ${_roundMoney(summary.borradorIva.baseImponibleRegistrada || 0)} EUR`);
    lines.push(`Borrador IVA - Cuota IVA: ${_roundMoney(summary.borradorIva.cuotaIvaRegistrada || 0)} EUR`);
  }
  return lines.join("\n");
}

// =============================================================================
// BLOQUE 2 - PREVIEW DE PAQUETE
// =============================================================================

export const previewManagerPackage = webMethod(Permissions.SiteMember, async (period = {}) => {
  const traceId = makeTraceId("doc-preview");
  try {
    await requireMarianManager(traceId);
    const year = Number(period.year);
    const quarter = Number(period.quarter);
    if (!year || !quarter || quarter < 1 || quarter > 4) {
      return { status: "ERROR", data: null, error: { code: "INVALID_PERIOD", message: "year and quarter (1-4) are required" } };
    }

    const [summaryRes, bookRes] = await Promise.all([
      getQuarterlyTaxSummary(year, quarter, { traceId }),
      getLibroRegistroFacturasExpedidasInternal(year, quarter, { traceId, rateLimitKey: "manager" }),
    ]);

    const summary = summaryRes?.data || null;
    const invoices = bookRes?.data?.filas || [];

    return {
      status: "SUCCESS",
      data: {
        period: { year, quarter },
        documentIdDraft: _formatDocumentId(year, quarter, 1),
        summary,
        invoiceCount: invoices.length,
        previewGeneratedAt: new Date(),
      },
      error: null,
    };
  } catch (err) {
    return { status: "ERROR", data: null, error: _toPublicError(err, "DOC_PREVIEW_FAIL") };
  }
});

// =============================================================================
// BLOQUE 3 - CREAR VERSION DE PAQUETE
// =============================================================================

export const createManagerPackageVersion = webMethod(Permissions.SiteMember, async (period = {}) => {
  const traceId = makeTraceId("doc-create");
  try {
    await requireMarianManager(traceId);
    const year = Number(period.year);
    const quarter = Number(period.quarter);
    if (!year || !quarter || quarter < 1 || quarter > 4) {
      return { status: "ERROR", data: null, error: { code: "INVALID_PERIOD", message: "year and quarter (1-4) are required" } };
    }

    const historyRes = await getManagerPackageHistory({ year, quarter });
    const nextVersion = (historyRes?.data?.length || 0) + 1;
    const documentId = _formatDocumentId(year, quarter, nextVersion);

    const [summaryRes, bookRes] = await Promise.all([
      getQuarterlyTaxSummary(year, quarter, { traceId }),
      getLibroRegistroFacturasExpedidasInternal(year, quarter, { traceId, rateLimitKey: "manager" }),
    ]);

    const record = {
      _id: documentId,
      inventoryClosingId: documentId,
      fiscalYear: year,
      closeDate: new Date(),
      closingType: "PAQUETE_GESTORIA",
      summaryData: summaryRes?.data || {},
      invoiceData: bookRes?.data?.filas || [],
      packageStatus: "PREPARED",
      packageVersion: nextVersion,
      traceId,
      _createdDate: new Date(),
    };

    // Package versions are immutable snapshots. save/upsert could overwrite
    // a version created by a concurrent request after both read the same history.
    // insert enforces uniqueness on the deterministic documentId; the loser
    // fails closed and must refresh history before requesting the next version.
    await withTimeout(
      dalInsert(DOCS_COL, record),
      CMS_TIMEOUT_MS,
      "insertManagerPackage"
    );

    return {
      status: "SUCCESS",
      data: { documentId, version: nextVersion, createdAt: record._createdDate },
      error: null,
    };
  } catch (err) {
    const code = String(err?.code || "");
    const message = String(err?.message || "");
    if (code === "WDE0074" || code === "WD_ITEM_ALREADY_EXISTS" || /WDE0074|WD_ITEM_ALREADY_EXISTS|already exists|duplicated/i.test(message)) {
      return {
        status: "ERROR",
        data: null,
        error: {
          code: "PACKAGE_VERSION_CONFLICT",
          message: "Otra solicitud ha creado esta versión. Actualiza el historial y vuelve a intentarlo.",
        },
      };
    }
    return { status: "ERROR", data: null, error: _toPublicError(err, "DOC_CREATE_FAIL") };
  }
});

// =============================================================================
// BLOQUE 4 - HISTORIAL DE PAQUETES
// =============================================================================

export const getManagerPackageHistory = webMethod(Permissions.SiteMember, async (period = {}) => {
  const traceId = makeTraceId("doc-hist");
  try {
    await requireMarianManager(traceId);
    const year = Number(period.year);
    const quarter = Number(period.quarter);
    let q = dalQuery(DOCS_COL).eq("closingType", "PAQUETE_GESTORIA");
    if (year && Number.isFinite(year)) q = q.eq("fiscalYear", year);
    if (quarter && Number.isFinite(quarter) && quarter >= 1 && quarter <= 4) {
      q = q.startsWith("inventoryClosingId", `DOC_GESTORIA_${year}_T${quarter}`);
    }
    const res = await withTimeout(
      q.descending("_createdDate").limit(50).find(),
      CMS_TIMEOUT_MS,
      "docHistory"
    );
    return { status: "SUCCESS", data: res?.items || [], error: null };
  } catch (err) {
    return { status: "ERROR", data: null, error: _toPublicError(err, "DOC_HIST_FAIL") };
  }
});

export const getPreparedManagerPackages = webMethod(Permissions.SiteMember, async () => {
  const traceId = makeTraceId("doc-prep");
  try {
    await requireMarianManager(traceId);
    const res = await withTimeout(
      dalQuery(DOCS_COL)
        .eq("closingType", "PAQUETE_GESTORIA")
        .descending("_createdDate")
        .limit(20)
        .find(),
      CMS_TIMEOUT_MS,
      "preparedPackages"
    );
    return { status: "SUCCESS", data: { items: res?.items || [] }, error: null };
  } catch (err) {
    return { status: "ERROR", data: null, error: _toPublicError(err, "DOC_PREP_FAIL") };
  }
});

// =============================================================================
// BLOQUE 5 - DESCARGAR VERSION
// =============================================================================

export const downloadManagerPackageVersion = webMethod(Permissions.SiteMember, async (params = {}) => {
  const traceId = makeTraceId("doc-download");
  try {
    await requireMarianManager(traceId);
    const documentId = _safeTrim(params.documentId);
    if (!documentId) {
      return { status: "ERROR", data: null, error: { code: "DOC_ID_REQUIRED", message: "documentId required" } };
    }

    const doc = await withTimeout(
      dalGet(DOCS_COL, documentId, "strong"),
      CMS_TIMEOUT_MS,
      "getDocPackage"
    );

    if (!doc) {
      return { status: "ERROR", data: null, error: { code: "DOC_NOT_FOUND", message: "Document version not found" } };
    }

    const invoices = Array.isArray(doc.invoiceData) ? doc.invoiceData : [];
    const csvContent = _buildCsvFromInvoices(invoices);
    const summaryText = _buildSummaryText(doc.summaryData);

    return {
      status: "SUCCESS",
      data: {
        documentId,
        csvContent,
        summaryText,
        summary: doc.summaryData || {},
        invoiceCount: invoices.length,
        createdAt: doc._createdDate || doc.closeDate,
      },
      error: null,
    };
  } catch (err) {
    return { status: "ERROR", data: null, error: _toPublicError(err, "DOC_DOWNLOAD_FAIL") };
  }
});
