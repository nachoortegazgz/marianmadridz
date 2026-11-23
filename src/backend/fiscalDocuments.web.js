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
import { requireMarianManager, rateLimiter } from "backend/security";
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
import { areAllowedEmailRecipients } from "backend/emailRecipientPolicy";
import { logger } from "backend/logger";

// SSOT-KEYFIELD-02: lectura canonica con fallback alias (contrato unico).
import { readMovementField, readControlPayload } from "backend/data";

const log = logger;
const CMS_TIMEOUT_MS = SDK_CONFIG.TIMEOUTS.CMS_MS;
// The former PaquetesGestoria collection was removed from Wix CMS.
// Keep the storage handle null so legacy private helpers fail closed if accidentally reused.
const DOCS_COL = null;

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

async function _rateLimitManagerPackageRead(surface, traceId) {
  const result = await rateLimiter({ surface, key: "manager" });
  if (!result?.allowed) {
    throw Object.assign(new Error("RATE_LIMITED"), {
      code: "RATE_LIMITED",
      meta: { retryAfter: result?.retryAfter || null, surface, traceId },
    });
  }
}

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
const GESTORIA_RECORD_TYPE_MARKERS = Object.freeze(["GESTORIA"]);

// =============================================================================
// BLOQUE 1 - HELPERS GENERALES
// =============================================================================

function _formatDocumentId(year, quarter, version = 1) {
  const vStr = String(version).padStart(4, "0");
  return `DOC_GESTORIA_${year}_T${quarter}_PAQUETE_GESTORIA_V${vStr}`;
}

function _formatPackageDisplayId(doc) {
  const year = Number(doc?.fiscalYear);
  const version = String(doc?.packageVersion ?? 1).padStart(4, "0");
  if (_safeTrim(doc?.periodType).toUpperCase() === "MONTHLY") {
    const sourceId = String(doc?.inventoryClosingId || doc?._id || "");
    const match = /_M(0[1-9]|1[0-2])_/.exec(sourceId);
    const month = Number(doc?.fiscalMonth ?? (match ? match[1] : NaN));
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
    return `DOC_GESTORIA_${year}_M${String(month).padStart(2, "0")}_PAQUETE_GESTORIA_V${version}`;
  }
  if (!Number.isInteger(year) || !Number.isInteger(Number(doc?.fiscalQuarter)) || Number(doc.fiscalQuarter) < 1 || Number(doc.fiscalQuarter) > 4) return null;
  return _formatDocumentId(year, Number(doc.fiscalQuarter), doc.packageVersion);
}

function _formatPackagePeriodLabel(doc) {
  const year = Number(doc?.fiscalYear);
  if (_safeTrim(doc?.periodType).toUpperCase() === "MONTHLY") {
    const sourceId = String(doc?.inventoryClosingId || doc?._id || "");
    const match = /_M(0[1-9]|1[0-2])_/.exec(sourceId);
    const month = Number(doc?.fiscalMonth ?? (match ? match[1] : NaN));
    return Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12
      ? `${String(month).padStart(2, "0")}/${year}`
      : `MES NO DEFINIDO/${Number.isInteger(year) ? year : "?"}`;
  }
  const quarter = Number(doc?.fiscalQuarter);
  return Number.isInteger(year) && Number.isInteger(quarter) && quarter >= 1 && quarter <= 4
    ? `T${quarter}/${year}`
    : `TRIMESTRE NO DEFINIDO/${Number.isInteger(year) ? year : "?"}`;
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

function _invoiceValue(invoice, keys, fallbackKey) {
  for (const key of keys) {
    if (invoice && invoice[key] !== undefined && invoice[key] !== null) return invoice[key];
  }
  return fallbackKey ? readMovementField(invoice, fallbackKey) : "";
}

// SSOT-KEYFIELD-02: consume el contrato canon->alias UNICO (data.js) sobre
// claves fisicas canonicas; cero grafias alias aqui.
const _rf = (m, key) => _safeTrim(readMovementField(m, key));

function _csvCell(value) {
  const text = String(value ?? "");
  // Neutralize spreadsheet formulas in untrusted text cells.
  const safe = /^[\s\u0000-\u001F]*[=+\-@]/.test(text) ? "'" + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
}

function _buildCsvFromInvoices(invoices) {
  if (!Array.isArray(invoices) || invoices.length === 0) return "";
  const header = "Numero;Fecha;Tipo;Base;Cuota;Total;FormaPago;Hash\n";
  const rows = invoices.map((inv) => {
    const number = _safeTrim(_invoiceValue(inv, ["invoiceNumber", "numSerieFactura"], "numSerieFactura"));
    const date = _safeTrim(_invoiceValue(inv, ["fechaExpedicion", "fechaOperacion"], "fechaOperacion"));
    const type = _safeTrim(_invoiceValue(inv, ["movementType"], "movementType")).toUpperCase();
    const base = _roundMoney(Number(_invoiceValue(inv, ["taxableAmount", "taxBase"], "taxBase")) || 0);
    const tax = _roundMoney(Number(_invoiceValue(inv, ["taxAmount"], "taxAmount")) || 0);
    const total = _roundMoney(Number(_invoiceValue(inv, ["totalAmount", "accountingAmount"], "totalAmount")) || 0);
    const method = _safeTrim(_invoiceValue(inv, ["paymentMethod"], "paymentMethod"));
    const hash = _safeTrim(_invoiceValue(inv, ["hashCompleto", "recordHash", "hash"], "recordHash"));
    return [
      _csvCell(number),
      _csvCell(date),
      _csvCell(type),
      String(base),
      String(tax),
      String(total),
      _csvCell(method),
      _csvCell(hash),
    ].join(";");
  }).join("\n");
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

function _isDuplicatePackageInsertError(error) {
  const code = String(error?.code || error?.errorCode || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return [
    "WDE0074",
    "WD_ITEM_ALREADY_EXISTS",
  ].includes(code) || /already exists|wd_item_already_exists/.test(message);
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
      displayId: _formatDocumentId(doc.fiscalYear, doc.fiscalQuarter, doc.packageVersion),
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
  const operationHash = await hashSHA256(`MANAGER_PACKAGE_OPERATION|${operationId}`);
  const claimId = _uuidV8FromHash(operationHash);

  let existing = await withTimeout(
    dalGet(CONTROL_COL, claimId, "strong"),
    CMS_TIMEOUT_MS,
    "getPackageOperationClaim"
  );

  if (existing) {
    const payload = readControlPayload(existing);
    if (payload.operationId !== operationId || !_packagePeriodMatches(payload, period)) {
      return {
        error: {
          code: "PACKAGE_OPERATION_ID_REUSED",
          message: "Este operationId ya está asociado a otro periodo. Genera un UUID nuevo para una operación distinta.",
        },
      };
    }

    if (existing.status === "COMPLETED" && payload.documentId) {
      const completedDoc = await withTimeout(
        dalGet(DOCS_COL, payload.documentId, "strong"),
        CMS_TIMEOUT_MS,
        "getCompletedPackageSnapshot"
      );
      if (!completedDoc) {
        return {
          error: {
            code: "PACKAGE_SNAPSHOT_CLAIM_INCONSISTENT",
            message: "El claim figura completado, pero su snapshot no existe. Requiere reconciliación manual; no se crea otra versión automáticamente.",
          },
        };
      }
      if (!(await _verifyPackageSnapshot(completedDoc))) {
        return {
          error: {
            code: "PACKAGE_SNAPSHOT_HASH_INVALID",
            message: "El snapshot recuperado no supera la verificación de integridad; requiere revisión manual.",
          },
        };
      }
      return { completedDoc };
    }

    const recovered = await _findPackageByTraceId(payload.traceId);
    if (recovered) {
      if (!(await _verifyPackageSnapshot(recovered))) {
        return {
          error: {
            code: "PACKAGE_SNAPSHOT_HASH_INVALID",
            message: "El snapshot recuperado no supera la verificación de integridad; requiere revisión manual.",
          },
        };
      }
      await _completePackageOperationClaim(existing, recovered);
      return { completedDoc: recovered };
    }

    const expiresAt = existing.expiresAt ? new Date(existing.expiresAt) : null;
    if (expiresAt && Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() <= Date.now()) {
      return {
        error: {
          code: "PACKAGE_SNAPSHOT_REPAIR_REQUIRED",
          message: "La operación expiró sin snapshot verificable. Revisa el historial antes de iniciar otra operación; el claim no se elimina automáticamente.",
        },
      };
    }
    // Never delete/reclaim an in-flight claim automatically: a stale worker
    // could resume after lease expiry and create a second immutable snapshot.
    return { inProgress: true };
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
      if (!completedDoc) {
        return {
          error: {
            code: "PACKAGE_SNAPSHOT_CLAIM_INCONSISTENT",
            message: "El claim completado no tiene snapshot recuperable. Requiere reconciliación manual.",
          },
        };
      }
      if (!(await _verifyPackageSnapshot(completedDoc))) {
        return {
          error: {
            code: "PACKAGE_SNAPSHOT_HASH_INVALID",
            message: "El snapshot recuperado no supera la verificación de integridad; requiere revisión manual.",
          },
        };
      }
      return { completedDoc };
    }
    const recovered = await _findPackageByTraceId(payload.traceId);
    if (recovered) {
      if (!(await _verifyPackageSnapshot(recovered))) {
        return {
          error: {
            code: "PACKAGE_SNAPSHOT_HASH_INVALID",
            message: "El snapshot recuperado no supera la verificación de integridad; requiere revisión manual.",
          },
        };
      }
      await _completePackageOperationClaim(existing, recovered);
      return { completedDoc: recovered };
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

function _normalizeSnapshotJson(value) {
  const serialized = JSON.stringify(value);
  if (typeof serialized !== "string") {
    throw Object.assign(new Error("PACKAGE_SNAPSHOT_SERIALIZATION_FAILED"), {
      code: "PACKAGE_SNAPSHOT_SERIALIZATION_FAILED",
    });
  }
  return JSON.parse(serialized);
}

function _buildPackageSnapshotBase({ itemId, year, quarter, version, summaryData, invoiceData, traceId }) {
  return {
    _id: itemId,
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

function _packageSnapshotHashPayload(doc) {
  return {
    _id: doc?._id,
    periodType: doc?.periodType,
    fiscalYear: Number(doc?.fiscalYear),
    fiscalQuarter: Number(doc?.fiscalQuarter),
    packageVersion: Number(doc?.packageVersion),
    summaryData: doc?.summaryData,
    invoiceData: doc?.invoiceData,
    packageStatus: doc?.packageStatus,
    schemaVersion: doc?.schemaVersion,
    source: doc?.source,
    traceId: doc?.traceId,
    createdAt: doc?.createdAt,
  };
}

async function _verifyPackageSnapshot(doc) {
  if (
    !doc?._id ||
    doc.packageStatus !== "PREPARED" ||
    !doc.summaryData ||
    !Array.isArray(doc.invoiceData) ||
    !/^[a-f0-9]{64}$/i.test(_safeTrim(doc.snapshotHash))
  ) return false;

  const expected = await hashSHA256(_stableSerialize(_packageSnapshotHashPayload(doc)));
  return expected.toLowerCase() === _safeTrim(doc.snapshotHash).toLowerCase();
}

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

// Resuelve exclusivamente registros GESTORIA del maestro MapaStaff.
async function _resolveRecipientById(recipientId) {
  if (!recipientId) return null;
  try {
    const record = await withTimeout(
      dalGet(MAPA_STAFF_COL, String(recipientId), "strong"),
      CMS_TIMEOUT_MS,
      "getRecipient"
    );
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
  if (!areAllowedEmailRecipients(to)) {
    throw Object.assign(
      new Error("Email recipient is outside the configured recipient allowlist."),
      { code: "EMAIL_RECIPIENT_NOT_ALLOWED" }
    );
  }

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
  async () => _packageStorageRemovedResult(makeTraceId("doc-send-pkg"))
);
// =============================================================================
// BLOQUE 9 - ENVIO DE DOCUMENTO CONCRETO
// =============================================================================

export const sendSpecificDocumentToAccountant = webMethod(
  Permissions.SiteMember,
  async () => _packageStorageRemovedResult(makeTraceId("doc-send-doc"))
);