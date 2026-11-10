/*
=============================================================================
MODULE: backend/fiscalDocuments.web.js
VERSION: v5017-ALIGNED-DATOSFISCALES
BASE: v5016-ALIGNED-WITH-SEND
RESPONSIBILITY: Previsualiza y consulta snapshots de gestoría; creación y
 despacho permanecen fail-closed hasta verificar sus garantías append-only.
STANDARDS: G10 ASCII Strict. Cero suppressAuth. Colecciones canonicas.

CAMBIOS v5017-ALIGNED-DATOSFISCALES (respecto a v5016):
  ALN-DF-01: Eliminada la dependencia de BUSINESS_COLLECTIONS.GESTORES_FISCALES
             (coleccion no declarada en internalConfig v12). El origen de
             verdad de destinatarios es BUSINESS_COLLECTIONS.DATOS_FISCALES.
  ALN-DF-02: listAccountantRecipients consulta DatosFiscales y extrae
             gestores por DOS patrones tolerados en paralelo:
               A) item dedicado con recordType "GESTOR" | "GESTORIA" |
                  "GESTOR_FISCAL" | "ACCOUNTANT" + campo email.
               B) campos embebidos gestorEmail/gestorName en cualquier
                  item (p.ej. el registro fiscal del negocio).
  ALN-DF-03: _resolveRecipientById maneja los dos patrones. Los ids del
             patron B viajan como `<recordId>#gestor`; los del A viajan
             como `<recordId>` puro.

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
import { fetch as wixFetch } from "wix-fetch";
import { getSecret } from "wix-secrets-backend";

import {
  query as dalQuery,
  getItem as dalGet,
  insertItem as dalInsert,
  updateItem as dalUpdate,
  removeById as dalRemove,
} from "backend/dataAccess";

import {
  BUSINESS_COLLECTIONS,
  OPERATIONAL_COLLECTIONS,
  CONTROL_TYPE,
  SDK_CONFIG,
} from "backend/internalConfig";
import { requireMarianManager } from "backend/security";
import { _toPublicError } from "backend/responseUtils";

import {
  getQuarterlyTaxSummaryInternal,
  getLibroRegistroFacturasExpedidasInternal,
} from "backend/fiscalAggregator.web";

import {
  makeTraceId,
  _safeTrim,
  _looksLikeGuid,
  _stableSerialize,
  withTimeout,
  _roundMoney,
} from "public/mmUtils";
import { hashSHA256 } from "backend/securityEngine";

// SSOT-KEYFIELD-02: lectura canonica con fallback alias (contrato unico).
import { readMovementField, readControlPayload } from "backend/data";

const CMS_TIMEOUT_MS = SDK_CONFIG.TIMEOUTS.CMS_MS;
// Manager package snapshots have their own collection; Z closings remain isolated.
const DOCS_COL = BUSINESS_COLLECTIONS.PAQUETES_GESTORIA;
const DATOS_FISCALES_COL = BUSINESS_COLLECTIONS.DATOS_FISCALES;
const CONTROL_COL = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
const PACKAGE_MAX_ITEM_BYTES = 450 * 1024; // Wix CMS hard limit: 500 KB per item.
const PACKAGE_OPERATION_TTL_MS = 10 * 60 * 1000;
const PACKAGE_VERSION_ALLOCATION_ATTEMPTS = 3;
const PACKAGE_SCHEMA_VERSION = "1.0";

const STRONG_READ = Object.freeze({ consistencyMode: "strong" });

// Envio a gestoria via Resend.
const RESEND_ENDPOINT = "https://api.resend.com/emails";
const RESEND_KEY_NAME = "RESEND_API_KEY";
const RESEND_FROM_NAME = SDK_CONFIG.EMAIL.FROM_NAME;
const RESEND_FROM_ADDRESS = SDK_CONFIG.EMAIL.FROM_ADDRESS;
const ACCOUNTANT_SEND_ENABLED = SDK_CONFIG.EMAIL.ACCOUNTANT_SEND_ENABLED === true;

function _accountantSendDisabledResult(traceId) {
  return {
    status: "ERROR",
    data: null,
    error: {
      code: "ACCOUNTANT_SEND_DISABLED",
      message: "El envio a gestoria esta bloqueado hasta persistir y verificar el snapshot inmutable del despacho.",
      traceId: traceId || null,
    },
  };
}

// Marcadores canonicos para identificar un item dedicado a gestor.
const GESTOR_RECORD_TYPE_MARKERS = Object.freeze([
  "GESTOR",
  "GESTORIA",
  "GESTOR_FISCAL",
  "GESTOR-FISCAL",
  "ACCOUNTANT",
]);

// =============================================================================
// BLOQUE 1 - HELPERS GENERALES
// =============================================================================

function _formatDocumentId(year, quarter, version = 1) {
  const vStr = String(version).padStart(4, "0");
  return `DOC_GESTORIA_${year}_T${quarter}_PAQUETE_GESTORIA_V${vStr}`;
}

function _invoiceValue(invoice, keys, fallbackKey) {
  for (const key of keys) {
    if (invoice && invoice[key] !== undefined && invoice[key] !== null) return invoice[key];
  }
  return fallbackKey ? readMovementField(invoice, fallbackKey) : "";
}

// SSOT-KEYFIELD-02: consume el contrato canon->alias UNICO (data.js) sobre
// claves fisicas canonicas; cero grafias alias aqui.
const _rf = (m, key) => _safeTrim(readMovementField(m, key));

function _buildCsvFromInvoices(invoices) {
  if (!Array.isArray(invoices) || invoices.length === 0) return "";
  const header = "Numero;Fecha;Tipo;Base;Cuota;Total;FormaPago;Hash\\n";
  const rows = invoices.map((inv) => {
    const number = _safeTrim(_invoiceValue(inv, ["invoiceNumber", "numSerieFactura"], "numSerieFactura"));
    const date = _safeTrim(_invoiceValue(inv, ["fechaExpedicion", "fechaOperacion"], "fechaOperacion"));
    const type = _safeTrim(_invoiceValue(inv, ["movementType"], "movementType")).toUpperCase();
    const base = _roundMoney(Number(_invoiceValue(inv, ["taxableAmount", "taxBase"], "taxBase")) || 0);
    const tax = _roundMoney(Number(_invoiceValue(inv, ["taxAmount"], "taxAmount")) || 0);
    const total = _roundMoney(Number(_invoiceValue(inv, ["totalAmount", "accountingAmount"], "totalAmount")) || 0);
    const method = _safeTrim(_invoiceValue(inv, ["paymentMethod"], "paymentMethod"));
    const hash = _safeTrim(_invoiceValue(inv, ["hashCompleto", "recordHash", "hash"], "recordHash"));
    return `"${number}";"${date}";"${type}";${base};${tax};${total};"${method}";"${hash}"`;
  }).join("\\n");
  return header + rows;
}

function _buildSummaryText(summary) {
  if (!summary) return "Sin datos de resumen.";
  const lines = [];
  lines.push(`Ejercicio: ${summary.ejercicio || "N/A"}`);
  lines.push(`Trimestre: ${summary.trimestre || "N/A"}`);
  lines.push(`Total Operaciones: ${summary.totalOperaciones || 0}`);
  lines.push(
    `Total Operaciones Fiscales: ${summary.totalOperacionesFiscales || 0}`
  );
  if (summary.totales) {
    lines.push(
      `Total Ventas Brutas: ${_roundMoney(
        summary.totales.totalVentasBrutas || 0
      )} EUR`
    );
    lines.push(
      `Total Reembolsos: ${_roundMoney(
        summary.totales.totalReembolsos || 0
      )} EUR`
    );
    lines.push(
      `Total Facturado Neto: ${_roundMoney(
        summary.totales.totalFacturadoNeto || 0
      )} EUR`
    );
  }
  if (summary.borradorIva) {
    lines.push(
      `Borrador IVA - Base Imponible: ${_roundMoney(
        summary.borradorIva.baseImponibleRegistrada || 0
      )} EUR`
    );
    lines.push(
      `Borrador IVA - Cuota IVA: ${_roundMoney(
        summary.borradorIva.cuotaIvaRegistrada || 0
      )} EUR`
    );
  }
  return lines.join("\n");
}

// Codificacion base64 de texto para adjuntos Resend.
function _toBase64(text) {
  const str = String(text || "");
  try {
    return Buffer.from(str, "utf8").toString("base64");
  } catch {
    return "";
  }
}

// =============================================================================
// BLOQUE 1b - HELPERS DE GESTOR (DatosFiscales)
// =============================================================================

function _isGestorRecordType(record) {
  if (!record || typeof record !== "object") return false;
  const candidates = [
    record.recordType,
    record.tipo,
    record.type,
    record.categoria,
    record.category,
    record.role,
    record.rol,
  ]
    .filter(Boolean)
    .map((v) => String(v).trim().toUpperCase());
  return candidates.some((v) => GESTOR_RECORD_TYPE_MARKERS.includes(v));
}

// Extrae un destinatario de un item de DatosFiscales. Devuelve null si el
// item no contiene datos de gestor utiles. Tolera los DOS patrones en
// paralelo: registro dedicado (recordType=GESTOR) o campos embebidos
// gestorEmail/gestorName en cualquier item.
function _extractGestorFromRecord(record) {
  if (!record || record.active === false) return null;

  // Patron A: registro dedicado de gestor.
  if (_isGestorRecordType(record)) {
    const email = _safeTrim(record.email || record.gestorEmail);
    if (!email) return null;
    return {
      id: String(record._id),
      email,
      name: _safeTrim(record.name || record.nombre || record.gestorName || ""),
      label:
        _safeTrim(record.label || record.name || record.nombre || record.gestorName) ||
        email,
      nif: _safeTrim(record.nif || record.gestorNif || "") || null,
      source: "DEDICATED",
    };
  }

  // Patron B: campos embebidos en el registro fiscal del negocio.
  const embeddedEmail = _safeTrim(record.gestorEmail);
  if (embeddedEmail) {
    return {
      id: `${record._id}#gestor`,
      email: embeddedEmail,
      name: _safeTrim(record.gestorName || record.gestorNombre || ""),
      label:
        _safeTrim(record.gestorName || record.gestorNombre) || embeddedEmail,
      nif: _safeTrim(record.gestorNif) || null,
      source: "EMBEDDED",
    };
  }

  return null;
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

function _isDuplicatePackageInsertError(error) {
  const code = String(error?.code || error?.errorCode || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return [
    "WDE0074",
    "WD_ITEM_ALREADY_EXISTS",
    "WDE0023",
    "WDE0123",
  ].includes(code) || /already exists|duplicate|duplicated values/.test(message);
}

function _packagePeriodMatches(payload, period) {
  return payload?.periodType === period.periodType &&
    Number(payload?.fiscalYear) === period.year &&
    Number(payload?.fiscalQuarter) === period.quarter;
}

function _packageSnapshotResult(doc, idempotent = false) {
  return {
    status: "SUCCESS",
    data: {
      documentId: doc._id,
      periodType: doc.periodType,
      fiscalYear: doc.fiscalYear,
      fiscalQuarter: doc.fiscalQuarter,
      packageVersion: doc.packageVersion,
      packageStatus: doc.packageStatus,
      snapshotHash: doc.snapshotHash,
      invoiceCount: Array.isArray(doc.invoiceData) ? doc.invoiceData.length : 0,
      idempotent,
    },
    error: null,
  };
}

async function _findPackageByTraceId(traceId) {
  if (!traceId) return null;
  const result = await withTimeout(
    dalQuery(DOCS_COL).eq("traceId", traceId).limit(2).find(STRONG_READ),
    CMS_TIMEOUT_MS,
    "findPackageByTraceId"
  );
  const items = Array.isArray(result?.items) ? result.items : [];
  if (items.length > 1) {
    throw Object.assign(new Error("PACKAGE_TRACE_ID_NOT_UNIQUE"), {
      code: "PACKAGE_TRACE_ID_NOT_UNIQUE",
    });
  }
  return items[0] || null;
}

async function _completePackageOperationClaim(claim, doc) {
  const payload = readControlPayload(claim);
  return withTimeout(
    dalUpdate(CONTROL_COL, {
      ...claim,
      status: "COMPLETED",
      expiresAt: null,
      payload: {
        ...payload,
        documentId: doc._id,
        snapshotHash: doc.snapshotHash,
        completedAt: new Date().toISOString(),
      },
      _updatedDate: new Date(),
    }),
    CMS_TIMEOUT_MS,
    "completePackageOperationClaim"
  );
}

async function _claimPackageOperation(operationId, period, traceId) {
  const operationHash = await hashSHA256(operationId);
  const claimId = `MGR_PKG_OP_${operationHash.slice(0, 48)}`;

  let existing = await withTimeout(
    dalGet(CONTROL_COL, claimId, "strong"),
    CMS_TIMEOUT_MS,
    "getPackageOperationClaim"
  );

  if (existing) {
    const payload = readControlPayload(existing);
    if (payload.operationId !== operationId || !_packagePeriodMatches(payload, period)) {
      return { error: { code: "PACKAGE_OPERATION_ID_REUSED" } };
    }

    if (existing.status === "COMPLETED" && payload.documentId) {
      const completedDoc = await withTimeout(
        dalGet(DOCS_COL, payload.documentId, "strong"),
        CMS_TIMEOUT_MS,
        "getCompletedPackageSnapshot"
      );
      if (!completedDoc) return { error: { code: "PACKAGE_SNAPSHOT_CLAIM_INCONSISTENT" } };
      return { completedDoc };
    }

    const recovered = await _findPackageByTraceId(payload.traceId);
    if (recovered) {
      await _completePackageOperationClaim(existing, recovered);
      return { completedDoc: recovered };
    }

    const expiresAt = existing.expiresAt ? new Date(existing.expiresAt) : null;
    if (!expiresAt || !Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() > Date.now()) {
      return { inProgress: true };
    }

    // A timed-out claim can be reclaimed only after proving no snapshot was inserted.
    await withTimeout(
      dalRemove(CONTROL_COL, claimId),
      CMS_TIMEOUT_MS,
      "removeExpiredPackageOperationClaim"
    );
  }

  const claim = {
    _id: claimId,
    controlType: CONTROL_TYPE.IDEMPOTENCY,
    dedupeKey: `MANAGER_PACKAGE_CREATE:${operationId}`,
    status: "ACTIVE",
    expiresAt: new Date(Date.now() + PACKAGE_OPERATION_TTL_MS),
    payload: {
      operationId,
      periodType: period.periodType,
      fiscalYear: period.year,
      fiscalQuarter: period.quarter,
      traceId,
    },
    traceId,
    _createdDate: new Date(),
    _updatedDate: new Date(),
  };

  try {
    const saved = await withTimeout(
      dalInsert(CONTROL_COL, claim),
      CMS_TIMEOUT_MS,
      "insertPackageOperationClaim"
    );
    return { claim: saved || claim };
  } catch (error) {
    if (!_isDuplicatePackageInsertError(error)) throw error;
    existing = await withTimeout(
      dalGet(CONTROL_COL, claimId, "strong"),
      CMS_TIMEOUT_MS,
      "readRacingPackageOperationClaim"
    );
    if (!existing) throw error;
    const payload = readControlPayload(existing);
    if (payload.operationId !== operationId || !_packagePeriodMatches(payload, period)) {
      return { error: { code: "PACKAGE_OPERATION_ID_REUSED" } };
    }
    if (existing.status === "COMPLETED" && payload.documentId) {
      const completedDoc = await withTimeout(
        dalGet(DOCS_COL, payload.documentId, "strong"),
        CMS_TIMEOUT_MS,
        "readRacingCompletedPackage"
      );
      return completedDoc
        ? { completedDoc }
        : { error: { code: "PACKAGE_SNAPSHOT_CLAIM_INCONSISTENT" } };
    }
    return { inProgress: true };
  }
}

async function _readNextQuarterPackageVersion(year, quarter) {
  const result = await withTimeout(
    dalQuery(DOCS_COL)
      .eq("periodType", "QUARTERLY")
      .eq("fiscalYear", year)
      .eq("fiscalQuarter", quarter)
      .limit(1000)
      .find(STRONG_READ),
    CMS_TIMEOUT_MS,
    "readPackageVersions"
  );
  if (typeof result?.hasNext === "function" && result.hasNext()) {
    throw Object.assign(new Error("PACKAGE_VERSION_HISTORY_LIMIT_EXCEEDED"), {
      code: "PACKAGE_VERSION_HISTORY_LIMIT_EXCEEDED",
    });
  }
  const versions = (result?.items || [])
    .map((item) => Number(item.packageVersion))
    .filter((value) => Number.isSafeInteger(value) && value > 0);
  return Math.max(0, ...versions) + 1;
}

function _buildPackageSnapshotBase({ year, quarter, version, summaryData, invoiceData, traceId }) {
  return {
    _id: _formatDocumentId(year, quarter, version),
    periodType: "QUARTERLY",
    fiscalYear: year,
    fiscalQuarter: quarter,
    packageVersion: version,
    summaryData,
    invoiceData,
    packageStatus: "PREPARED",
    schemaVersion: PACKAGE_SCHEMA_VERSION,
    source: "FISCAL_AGGREGATOR",
    traceId,
    createdAt: new Date(),
  };
}

export const createManagerPackageVersion = webMethod(
  Permissions.SiteMember,
  async (period = {}) => {
    const traceId = makeTraceId("doc-create");
    let claim = null;
    let snapshotInserted = false;
    try {
      await requireMarianManager(traceId);

      const periodType = _safeTrim(period.periodType || "QUARTERLY").toUpperCase();
      const year = Number(period.year);
      const quarter = Number(period.quarter);
      const operationId = _safeTrim(period.operationId);

      if (periodType !== "QUARTERLY") {
        return {
          status: "ERROR",
          data: null,
          error: {
            code: "PACKAGE_PERIOD_NOT_SUPPORTED",
            message: "La generación de snapshots está habilitada únicamente para periodos trimestrales; el agregador mensual aún no existe.",
            traceId,
          },
        };
      }
      if (!Number.isInteger(year) || year < 2000 || year > 9999 ||
          !Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
        return {
          status: "ERROR",
          data: null,
          error: { code: "INVALID_PERIOD", message: "Se requiere ejercicio válido y trimestre entre 1 y 4.", traceId },
        };
      }
      if (!_looksLikeGuid(operationId)) {
        return {
          status: "ERROR",
          data: null,
          error: { code: "PACKAGE_OPERATION_ID_REQUIRED", message: "operationId debe ser un UUID estable para deduplicar la operación.", traceId },
        };
      }

      const normalizedPeriod = { periodType, year, quarter };
      const claimResult = await _claimPackageOperation(operationId, normalizedPeriod, traceId);
      if (claimResult.error) {
        return { status: "ERROR", data: null, error: { ...claimResult.error, traceId } };
      }
      if (claimResult.completedDoc) return _packageSnapshotResult(claimResult.completedDoc, true);
      if (claimResult.inProgress) {
        return {
          status: "ERROR",
          data: null,
          error: {
            code: "PACKAGE_SNAPSHOT_IN_PROGRESS",
            message: "La misma operación ya está en curso. Reintenta con el mismo operationId; no generes otra operación.",
            traceId,
          },
        };
      }
      claim = claimResult.claim;

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
        const sourceCode = summaryRes?.error?.code || bookRes?.error?.code || "PACKAGE_SOURCE_DATA_INCOMPLETE";
        throw Object.assign(new Error("Los datos fiscales de origen no están completos; no se ha creado snapshot."), {
          code: sourceCode,
        });
      }

      const summaryData = summaryRes.data;
      const invoiceData = bookRes.data.filas;
      let saved = null;

      for (let attempt = 0; attempt < PACKAGE_VERSION_ALLOCATION_ATTEMPTS; attempt += 1) {
        const version = await _readNextQuarterPackageVersion(year, quarter);
        const base = _buildPackageSnapshotBase({
          year,
          quarter,
          version,
          summaryData,
          invoiceData,
          traceId,
        });
        const snapshotHash = await hashSHA256(_stableSerialize(base));
        const snapshot = { ...base, snapshotHash };
        const itemBytes = Buffer.byteLength(_stableSerialize(snapshot), "utf8");

        if (itemBytes > PACKAGE_MAX_ITEM_BYTES) {
          throw Object.assign(new Error("El snapshot supera el límite interno de 450 KiB para un item CMS."), {
            code: "PACKAGE_SNAPSHOT_SIZE_LIMIT_EXCEEDED",
          });
        }

        try {
          saved = await withTimeout(
            dalInsert(DOCS_COL, snapshot),
            CMS_TIMEOUT_MS,
            "insertManagerPackageSnapshot"
          );
          snapshotInserted = true;
          break;
        } catch (error) {
          if (!_isDuplicatePackageInsertError(error)) throw error;
          // Create-only insert + unique _id. A competing version is reread;
          // never use save/upsert and never overwrite a prior snapshot.
        }
      }

      if (!saved) {
        throw Object.assign(new Error("No se pudo reservar una versión única del paquete tras varios conflictos concurrentes."), {
          code: "PACKAGE_VERSION_CONFLICT",
        });
      }

      try {
        await _completePackageOperationClaim(claim, saved);
      } catch (claimError) {
        log.error("PACKAGE_SNAPSHOT_CLAIM_COMPLETION_FAILED", {
          traceId,
          documentId: saved._id,
          message: claimError?.message || String(claimError),
        });
        return {
          status: "ERROR",
          data: null,
          error: {
            code: "PACKAGE_SNAPSHOT_RECOVERY_REQUIRED",
            message: "El snapshot está persistido, pero falta confirmar su idempotencia. Reintenta con el mismo operationId; no se ha creado otra versión.",
            traceId,
          },
        };
      }

      return _packageSnapshotResult(saved, false);
    } catch (err) {
      if (claim && !snapshotInserted) {
        await dalRemove(CONTROL_COL, claim._id).catch((cleanupError) => {
          log.error("PACKAGE_OPERATION_CLAIM_CLEANUP_FAILED", {
            traceId,
            message: cleanupError?.message || String(cleanupError),
          });
        });
      }
      return {
        status: "ERROR",
        data: null,
        error: _toPublicError(err, "DOC_CREATE_FAIL"),
      };
    }
  }
);

// =============================================================================
// BLOQUE 4 - HISTORIAL DE PAQUETES
// =============================================================================

export const getManagerPackageHistory = webMethod(
  Permissions.SiteMember,
  async (period = {}) => {
    const traceId = makeTraceId("doc-hist");
    try {
      await requireMarianManager(traceId);
      const year = period.year != null ? Number(period.year) : null;
      const periodType = _safeTrim(period.periodType || "QUARTERLY").toUpperCase();
      const month = period.month != null ? Number(period.month) : null;
      const quarter = period.quarter != null ? Number(period.quarter) : null;

      if (!["MONTHLY", "QUARTERLY"].includes(periodType)) {
        return {
          status: "ERROR",
          data: null,
          error: { code: "INVALID_PERIOD_TYPE", message: "periodType must be MONTHLY or QUARTERLY." },
        };
      }
      if (year != null && (!Number.isInteger(year) || year < 2000 || year > 9999)) {
        return {
          status: "ERROR",
          data: null,
          error: { code: "INVALID_FISCAL_YEAR", message: "year must be an integer between 2000 and 9999." },
        };
      }
      if (periodType === "MONTHLY" && (quarter != null || (month != null && (!Number.isInteger(month) || month < 1 || month > 12)))) {
        return {
          status: "ERROR",
          data: null,
          error: { code: "INVALID_MONTH_PERIOD", message: "Monthly history requires month 1-12 and cannot include quarter." },
        };
      }
      if (periodType === "QUARTERLY" && (month != null || (quarter != null && (!Number.isInteger(quarter) || quarter < 1 || quarter > 4)))) {
        return {
          status: "ERROR",
          data: null,
          error: { code: "INVALID_QUARTER_PERIOD", message: "Quarterly history requires quarter 1-4 and cannot include month." },
        };
      }

      let q = dalQuery(DOCS_COL).eq("periodType", periodType);
      if (year != null) q = q.eq("fiscalYear", year);
      if (periodType === "MONTHLY" && month != null) q = q.eq("fiscalMonth", month);
      if (periodType === "QUARTERLY" && quarter != null) q = q.eq("fiscalQuarter", quarter);
      const res = await withTimeout(q.descending("_createdDate").limit(50).find(), CMS_TIMEOUT_MS, "docHistory");
      return { status: "SUCCESS", data: res?.items || [], error: null };
    } catch (err) {
      return { status: "ERROR", data: null, error: _toPublicError(err, "DOC_HIST_FAIL") };
    }
  }
);

export const getPreparedManagerPackages = webMethod(
  Permissions.SiteMember,
  async () => {
    const traceId = makeTraceId("doc-prep");
    try {
      await requireMarianManager(traceId);
      const res = await withTimeout(
        dalQuery(DOCS_COL)
          .eq("packageStatus", "PREPARED")
          .descending("_createdDate")
          .limit(20)
          .find(),
        CMS_TIMEOUT_MS,
        "preparedPackages"
      );
      return {
        status: "SUCCESS",
        data: { items: res?.items || [] },
        error: null,
      };
    } catch (err) {
      return {
        status: "ERROR",
        data: null,
        error: _toPublicError(err, "DOC_PREP_FAIL"),
      };
    }
  }
);

// =============================================================================
// BLOQUE 5 - DESCARGAR VERSION
// =============================================================================

export const downloadManagerPackageVersion = webMethod(
  Permissions.SiteMember,
  async (params = {}) => {
    const traceId = makeTraceId("doc-download");
    try {
      await requireMarianManager(traceId);
      const documentId = _safeTrim(params.documentId);
      if (!documentId) {
        return {
          status: "ERROR",
          data: null,
          error: {
            code: "DOC_ID_REQUIRED",
            message: "documentId required",
          },
        };
      }

      const doc = await withTimeout(
        dalGet(DOCS_COL, documentId, "strong"),
        CMS_TIMEOUT_MS,
        "getDocPackage"
      );

      if (!doc) {
        return {
          status: "ERROR",
          data: null,
          error: {
            code: "DOC_NOT_FOUND",
            message: "Document version not found",
          },
        };
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
      return {
        status: "ERROR",
        data: null,
        error: _toPublicError(err, "DOC_DOWNLOAD_FAIL"),
      };
    }
  }
);

// =============================================================================
// BLOQUE 6 - DESTINATARIOS DE GESTORIA (via DatosFiscales)
// =============================================================================

export const listAccountantRecipients = webMethod(
  Permissions.SiteMember,
  async () => {
    const traceId = makeTraceId("doc-recipients");
    try {
      await requireMarianManager(traceId);

      const res = await withTimeout(
        dalQuery(DATOS_FISCALES_COL)
          .descending("_updatedDate")
          .limit(100)
          .find(),
        CMS_TIMEOUT_MS,
        "listAccountantRecipients"
      );

      const items = [];
      const seenEmails = new Set();

      for (const record of res?.items || []) {
        const gestor = _extractGestorFromRecord(record);
        if (!gestor) continue;
        const emailKey = gestor.email.toLowerCase();
        if (seenEmails.has(emailKey)) continue;
        seenEmails.add(emailKey);
        items.push({
          id: gestor.id,
          label: gestor.label,
          name: gestor.name,
          email: gestor.email,
          nif: gestor.nif,
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

// Resuelve un destinatario por id en DatosFiscales. Los ids del patron B
// viajan como `<recordId>#gestor`; los del patron A como `<recordId>`.
async function _resolveRecipientById(recipientId) {
  if (!recipientId) return null;
  const raw = String(recipientId);
  const isEmbedded = raw.endsWith("#gestor");
  const docId = isEmbedded ? raw.slice(0, -7) : raw;

  try {
    const record = await withTimeout(
      dalGet(DATOS_FISCALES_COL, docId, "strong"),
      CMS_TIMEOUT_MS,
      "getRecipient"
    );
    if (!record || record.active === false) return null;

    if (isEmbedded) {
      const email = _safeTrim(record.gestorEmail);
      if (!email) return null;
      return {
        id: raw,
        email,
        name: _safeTrim(record.gestorName || record.gestorNombre || ""),
        label:
          _safeTrim(record.gestorName || record.gestorNombre) || email,
        nif: _safeTrim(record.gestorNif) || null,
      };
    }

    return _extractGestorFromRecord(record);
  } catch {
    return null;
  }
}

// =============================================================================
// BLOQUE 7 - HELPER DE ENVIO VIA RESEND
// =============================================================================

async function _getResendApiKey() {
  try {
    const key = await getSecret(RESEND_KEY_NAME);
    return _safeTrim(key) || null;
  } catch {
    return null;
  }
}

async function _dispatchEmailViaResend({
  to,
  subject,
  text,
  attachments,
  traceId,
}) {
  const apiKey = await _getResendApiKey();
  if (!apiKey) {
    throw Object.assign(
      new Error(
        `La API key de Resend no esta configurada. Anade '${RESEND_KEY_NAME}' en Wix Secrets Manager.`
      ),
      { code: "RESEND_NOT_CONFIGURED" }
    );
  }

  const body = {
    from: `${RESEND_FROM_NAME} <${RESEND_FROM_ADDRESS}>`,
    to: Array.isArray(to) ? to : [to],
    subject,
    text,
    attachments: Array.isArray(attachments) ? attachments : [],
  };

  const res = await withTimeout(
    wixFetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(traceId ? { "X-Entity-Trace-Id": traceId } : {}),
      },
      body: JSON.stringify(body),
    }),
    CMS_TIMEOUT_MS,
    "resendSend"
  );

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    throw Object.assign(
      new Error(
        `Resend respondio ${res.status}: ${String(raw).slice(0, 500)}`
      ),
      { code: "RESEND_SEND_FAILED", httpStatus: res.status }
    );
  }

  const json = await res.json().catch(() => ({}));
  return { messageId: json?.id || null, provider: "resend" };
}

// =============================================================================
// BLOQUE 8 - ENVIO DE PAQUETE A GESTOR (mensual / trimestral)
// =============================================================================



export const sendManagerPackageToAccountant = webMethod(
  Permissions.SiteMember,
  async (params = {}) => {
    const traceId = makeTraceId("doc-send-pkg");
    try {
      await requireMarianManager(traceId);
      if (!ACCOUNTANT_SEND_ENABLED) return _accountantSendDisabledResult(traceId);

      const documentId = _safeTrim(params.documentId);
      const recipientId = _safeTrim(params.recipientId);
      const notes = _safeTrim(params.notes) || null;
      if (!documentId) return { status: "ERROR", data: null, error: { code: "PACKAGE_SNAPSHOT_REQUIRED", message: "Create and select a persisted package snapshot before dispatch." } };
      if (!recipientId) return { status: "ERROR", data: null, error: { code: "RECIPIENT_REQUIRED", message: "recipientId required." } };

      const [doc, recipient] = await Promise.all([
        withTimeout(dalGet(DOCS_COL, documentId, "strong"), CMS_TIMEOUT_MS, "getPackageSnapshot"),
        _resolveRecipientById(recipientId),
      ]);
      if (!doc || doc.closingType !== "PAQUETE_GESTORIA" || !Array.isArray(doc.invoiceData) || !doc.summaryData) {
        return { status: "ERROR", data: null, error: { code: "PACKAGE_SNAPSHOT_NOT_FOUND", message: "A complete persisted package snapshot is required." } };
      }
      if (!recipient?.email) return { status: "ERROR", data: null, error: { code: "RECIPIENT_NOT_FOUND", message: "The accountant recipient is not configured in DatosFiscales." } };

      const periodType = _safeTrim(doc.periodType || "QUARTERLY").toUpperCase();
      const year = Number(doc.fiscalYear);
      const idQuarter = /_T([1-4])_/.exec(String(doc.inventoryClosingId || documentId));
      const idMonth = /_M(0[1-9]|1[0-2])_/.exec(String(doc.inventoryClosingId || documentId));
      const month = doc.fiscalMonth == null ? (idMonth ? Number(idMonth[1]) : null) : Number(doc.fiscalMonth);
      const quarter = doc.fiscalQuarter == null ? (idQuarter ? Number(idQuarter[1]) : null) : Number(doc.fiscalQuarter);
      const periodLabel = periodType === "MONTHLY" ? `${String(month).padStart(2, "0")}/${year}` : `T${quarter}/${year}`;
      if (!Number.isInteger(year) || (periodType === "MONTHLY" && (!Number.isInteger(month) || month < 1 || month > 12)) ||
          (periodType === "QUARTERLY" && (!Number.isInteger(quarter) || quarter < 1 || quarter > 4))) {
        return { status: "ERROR", data: null, error: { code: "PACKAGE_PERIOD_INVALID", message: "The stored package period is invalid." } };
      }

      const csvContent = _buildCsvFromInvoices(doc.invoiceData);
      const lines = [
        "Paquete fiscal de gestoria - Marian Madrid",
        "",
        `Ejercicio: ${year}`,
        `Periodo: ${periodLabel}`,
        `Documento referencia: ${documentId}`,
        `Version: ${doc.packageVersion}`,
        `Facturas incluidas: ${doc.invoiceData.length}`,
        ...(notes ? ["", "Notas:", notes] : []),
        "",
        "Resumen:",
        _buildSummaryText(doc.summaryData),
        "",
        "--",
        "Enviado desde el panel de administracion de Marian Madrid.",
      ];
      const attachments = csvContent ? [{ filename: `${documentId}.csv`, content: _toBase64(csvContent) }] : [];
      const dispatch = await _dispatchEmailViaResend({
        to: recipient.email,
        subject: `Marian Madrid - Paquete ${periodLabel}`,
        text: lines.join("\\n"),
        attachments,
        traceId,
      });
      return {
        status: "SUCCESS",
        data: { sent: true, documentId, periodType, year, month, quarter, recipientId, recipientEmail: recipient.email, invoiceCount: doc.invoiceData.length, provider: dispatch.provider, messageId: dispatch.messageId, traceId },
        error: null,
      };
    } catch (err) {
      if (err?.code === "RESEND_NOT_CONFIGURED") return { status: "ERROR", data: null, error: { code: "RESEND_NOT_CONFIGURED", message: err.message } };
      return { status: "ERROR", data: null, error: _toPublicError(err, "SEND_PACKAGE_FAIL") };
    }
  }
);

// =============================================================================
// BLOQUE 9 - ENVIO DE DOCUMENTO CONCRETO
// =============================================================================

export const sendSpecificDocumentToAccountant = webMethod(
  Permissions.SiteMember,
  async (params = {}) => {
    const traceId = makeTraceId("doc-send-doc");
    try {
      await requireMarianManager(traceId);

      if (!ACCOUNTANT_SEND_ENABLED) {
        return _accountantSendDisabledResult(traceId);
      }

      const documentId = _safeTrim(params.documentId);
      const documentType = _safeTrim(params.documentType) || null;
      const recipientId = _safeTrim(params.recipientId);
      const notes = _safeTrim(params.notes) || null;

      if (!documentId) {
        return {
          status: "ERROR",
          data: null,
          error: {
            code: "DOC_ID_REQUIRED",
            message: "documentId required",
          },
        };
      }
      if (!recipientId) {
        return {
          status: "ERROR",
          data: null,
          error: {
            code: "RECIPIENT_REQUIRED",
            message: "recipientId required",
          },
        };
      }

      const recipient = await _resolveRecipientById(recipientId);
      if (!recipient || !recipient.email) {
        return {
          status: "ERROR",
          data: null,
          error: {
            code: "RECIPIENT_NOT_FOUND",
            message:
              "El destinatario no existe o no tiene email configurado en DatosFiscales",
          },
        };
      }

      const doc = await withTimeout(
        dalGet(DOCS_COL, documentId, "strong"),
        CMS_TIMEOUT_MS,
        "getSpecificDoc"
      );

      if (!doc) {
        return {
          status: "ERROR",
          data: null,
          error: {
            code: "DOC_NOT_FOUND",
            message: "Documento no encontrado",
          },
        };
      }

      const invoices = Array.isArray(doc.invoiceData) ? doc.invoiceData : [];
      const csvContent = _buildCsvFromInvoices(invoices);
      const summaryText = _buildSummaryText(doc.summaryData);

      const subject = `Marian Madrid - Documento ${documentId}`;
      const lines = [];
      lines.push(`Documento: ${documentId}`);
      if (documentType) lines.push(`Tipo: ${documentType}`);
      if (doc.fiscalYear != null) lines.push(`Ejercicio: ${doc.fiscalYear}`);
      if (doc.packageVersion != null)
        lines.push(`Version: ${doc.packageVersion}`);
      if (notes) {
        lines.push("");
        lines.push("Notas:");
        lines.push(notes);
      }
      lines.push("");
      lines.push("Resumen:");
      lines.push(summaryText);
      lines.push("");
      lines.push("--");
      lines.push(
        "Enviado desde el panel de administracion de Marian Madrid."
      );

      const attachments = csvContent
        ? [
            {
              filename: `${documentId}.csv`,
              content: _toBase64(csvContent),
            },
          ]
        : [];

      const dispatch = await _dispatchEmailViaResend({
        to: recipient.email,
        subject,
        text: lines.join("\n"),
        attachments,
        traceId,
      });

      return {
        status: "SUCCESS",
        data: {
          sent: true,
          documentId,
          documentType,
          recipientId,
          recipientEmail: recipient.email,
          invoiceCount: invoices.length,
          provider: dispatch.provider,
          messageId: dispatch.messageId,
          traceId,
        },
        error: null,
      };
    } catch (err) {
      if (err?.code === "RESEND_NOT_CONFIGURED") {
        return {
          status: "ERROR",
          data: null,
          error: {
            code: "RESEND_NOT_CONFIGURED",
            message: err.message,
          },
        };
      }
      return {
        status: "ERROR",
        data: null,
        error: _toPublicError(err, "SEND_DOCUMENT_FAIL"),
      };
    }
  }
);
