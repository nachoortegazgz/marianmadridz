/*
=============================================================================
MODULE: backend/fiscalDocuments.web.js
VERSION: v5016-ALIGNED-WITH-SEND
BASE: v5015-ALIGNED + 3 exportaciones nuevas para envio a gestoria
RESPONSIBILITY: Genera paquetes fiscales trimestrales, documentos CSV/PDF,
 mantiene historial de versiones y despacha via Resend API.
STANDARDS: G10 ASCII Strict. Cero suppressAuth. Colecciones canonicas.

CAMBIOS v5016-ALIGNED-WITH-SEND:
  NEW-01: listAccountantRecipients. Lee destinatarios desde
          BUSINESS_COLLECTIONS.GESTORES_FISCALES. Fail-closed a lista
          vacia si la coleccion no esta configurada en internalConfig.
  NEW-02: sendManagerPackageToAccountant. Construye el paquete
          (mensual o trimestral) al vuelo desde los agregadores,
          adjunta CSV y envia via Resend.
  NEW-03: sendSpecificDocumentToAccountant. Recupera un documento
          concreto del historico y lo envia via Resend.
  NEW-04: _dispatchEmailViaResend. Helper unico de envio.
          API key desde secrets (RESEND_API_KEY). Si no esta
          configurada, devuelve RESEND_NOT_CONFIGURED sin romper.

CAMBIOS DE ALINEACION v5015-ALIGNED (heredados):
  ALN-01: COLLECTIONS alias eliminado. Uso de BUSINESS_COLLECTIONS.
  ALN-02: wixData.query/get/insert -> dalQuery/dalGet/dalInsert.
  ALN-04: Paginacion { items, hasNext(), next() } de dataAccess.
  ALN-05: HistoricoCierresZ como almacen de paquetes de gestoria.

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

// Envio a gestoria via Resend.
const RESEND_ENDPOINT = "https://api.resend.com/emails";
const RESEND_KEY_NAME = "RESEND_API_KEY";
const RESEND_FROM_NAME = SDK_CONFIG?.EMAIL?.FROM_NAME || "Marian Madrid";
const RESEND_FROM_ADDRESS =
  SDK_CONFIG?.EMAIL?.FROM_ADDRESS || "noreply@marianmadrid.com";

// Destinatarios de gestoria. Si la coleccion no esta declarada en
// internalConfig, se hace fail-closed a lista vacia. Para habilitar el
// envio real, anadir GESTORES_FISCALES a BUSINESS_COLLECTIONS (v13.0).
const RECIPIENTS_COL = BUSINESS_COLLECTIONS?.GESTORES_FISCALES || null;

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
  const rows = invoices
    .map(
      (inv) =>
        `"${_rf(inv, "numSerieFactura")}";` +
        `"${_rf(inv, "fechaOperacion")}";` +
        `"${_rf(inv, "movementType").toUpperCase()}";` +
        `${_roundMoney(Number(_rf(inv, "taxBase")) || 0)};` +
        `${_roundMoney(Number(_rf(inv, "taxAmount")) || 0)};` +
        `${_roundMoney(Number(_rf(inv, "totalAmount")) || 0)};` +
        `"${_rf(inv, "paymentMethod")}";` +
        `"${_rf(inv, "recordHash")}"`
    )
    .join("\n");
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

// Codificacion base64 de texto para adjuntos Resend. Buffer es nativo en
// el runtime Node.js de los .web.js; el fallback vacio mantiene el flujo
// vivo si el entorno no lo expone (degradacion: envio sin adjunto CSV).
function _toBase64(text) {
  const str = String(text || "");
  try {
    return Buffer.from(str, "utf8").toString("base64");
  } catch {
    return "";
  }
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
        getQuarterlyTaxSummary(year, quarter, { traceId }),
        getLibroRegistroFacturasExpedidasInternal(year, quarter, {
          traceId,
          rateLimitKey: "manager",
        }),
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
  async (period = {}) => {
    const traceId = makeTraceId("doc-create");
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

      const historyRes = await getManagerPackageHistory({ year, quarter });
      const nextVersion = (historyRes?.data?.length || 0) + 1;
      const documentId = _formatDocumentId(year, quarter, nextVersion);

      const [summaryRes, bookRes] = await Promise.all([
        getQuarterlyTaxSummary(year, quarter, { traceId }),
        getLibroRegistroFacturasExpedidasInternal(year, quarter, {
          traceId,
          rateLimitKey: "manager",
        }),
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
      // a version created by a concurrent request after both read the same
      // history. insert enforces uniqueness on the deterministic documentId;
      // the loser fails closed and must refresh history before requesting
      // the next version.
      await withTimeout(
        dalInsert(DOCS_COL, record),
        CMS_TIMEOUT_MS,
        "insertManagerPackage"
      );

      return {
        status: "SUCCESS",
        data: {
          documentId,
          version: nextVersion,
          createdAt: record._createdDate,
        },
        error: null,
      };
    } catch (err) {
      const code = String(err?.code || "");
      const message = String(err?.message || "");
      if (
        code === "WDE0074" ||
        code === "WD_ITEM_ALREADY_EXISTS" ||
        /WDE0074|WD_ITEM_ALREADY_EXISTS|already exists|duplicated/i.test(
          message
        )
      ) {
        return {
          status: "ERROR",
          data: null,
          error: {
            code: "PACKAGE_VERSION_CONFLICT",
            message:
              "Otra solicitud ha creado esta versión. Actualiza el historial y vuelve a intentarlo.",
          },
        };
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
      const year = Number(period.year);
      const quarter = Number(period.quarter);
      let q = dalQuery(DOCS_COL).eq("closingType", "PAQUETE_GESTORIA");
      if (year && Number.isFinite(year)) q = q.eq("fiscalYear", year);
      if (
        quarter &&
        Number.isFinite(quarter) &&
        quarter >= 1 &&
        quarter <= 4
      ) {
        q = q.startsWith(
          "inventoryClosingId",
          `DOC_GESTORIA_${year}_T${quarter}`
        );
      }
      const res = await withTimeout(
        q.descending("_createdDate").limit(50).find(),
        CMS_TIMEOUT_MS,
        "docHistory"
      );
      return { status: "SUCCESS", data: res?.items || [], error: null };
    } catch (err) {
      return {
        status: "ERROR",
        data: null,
        error: _toPublicError(err, "DOC_HIST_FAIL"),
      };
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
          .eq("closingType", "PAQUETE_GESTORIA")
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
// BLOQUE 6 - DESTINATARIOS DE GESTORIA
// =============================================================================

export const listAccountantRecipients = webMethod(
  Permissions.SiteMember,
  async () => {
    const traceId = makeTraceId("doc-recipients");
    try {
      await requireMarianManager(traceId);

      if (!RECIPIENTS_COL) {
        return {
          status: "SUCCESS",
          data: {
            items: [],
            traceId,
            note:
              "Coleccion GESTORES_FISCALES no configurada en internalConfig.",
          },
          error: null,
        };
      }

      const res = await withTimeout(
        dalQuery(RECIPIENTS_COL).eq("active", true).limit(50).find(),
        CMS_TIMEOUT_MS,
        "listAccountantRecipients"
      );

      const items = (res?.items || []).map((r) => ({
        id: r._id,
        label: _safeTrim(r.label) || _safeTrim(r.name) || _safeTrim(r.email) || r._id,
        name: _safeTrim(r.name) || _safeTrim(r.label) || "",
        email: _safeTrim(r.email) || "",
      }));

      return { status: "SUCCESS", data: { items, traceId }, error: null };
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

async function _resolveRecipientById(recipientId) {
  if (!recipientId) return null;
  if (!RECIPIENTS_COL) return null;

  try {
    const record = await withTimeout(
      dalGet(RECIPIENTS_COL, recipientId, "strong"),
      CMS_TIMEOUT_MS,
      "getRecipient"
    );
    if (!record || record.active === false) return null;
    return {
      id: record._id,
      email: _safeTrim(record.email),
      name:
        _safeTrim(record.name) ||
        _safeTrim(record.label) ||
        _safeTrim(record.email) ||
        "",
    };
  } catch {
    return null;
  }
}

function _filterInvoicesByMonth(invoices, month) {
  if (!Array.isArray(invoices)) return [];
  return invoices.filter((inv) => {
    const dateStr = String(_rf(inv, "fechaOperacion") || "");
    const m = Number(dateStr.slice(5, 7));
    return m === month;
  });
}

function _summarizeMonthly(invoices, year, month, quarter) {
  let base = 0;
  let iva = 0;
  let total = 0;
  for (const inv of invoices) {
    base += Number(_rf(inv, "taxBase")) || 0;
    iva += Number(_rf(inv, "taxAmount")) || 0;
    total += Number(_rf(inv, "totalAmount")) || 0;
  }
  return {
    ejercicio: year,
    trimestre: quarter,
    mes: month,
    totalOperaciones: invoices.length,
    totalOperacionesFiscales: invoices.length,
    totales: {
      totalVentasBrutas: _roundMoney(total),
      totalReembolsos: 0,
      totalFacturadoNeto: _roundMoney(total),
    },
    borradorIva: {
      baseImponibleRegistrada: _roundMoney(base),
      cuotaIvaRegistrada: _roundMoney(iva),
    },
  };
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

      const periodType = _safeTrim(params.periodType).toUpperCase();
      const year = Number(params.year);
      const month = params.month != null ? Number(params.month) : null;
      const quarter = params.quarter != null ? Number(params.quarter) : null;
      const recipientId = _safeTrim(params.recipientId);
      const notes = _safeTrim(params.notes) || null;

      if (periodType !== "MONTHLY" && periodType !== "QUARTERLY") {
        return {
          status: "ERROR",
          data: null,
          error: {
            code: "INVALID_PERIOD_TYPE",
            message: "periodType must be MONTHLY or QUARTERLY",
          },
        };
      }
      if (!year || !Number.isFinite(year)) {
        return {
          status: "ERROR",
          data: null,
          error: { code: "INVALID_YEAR", message: "year required" },
        };
      }
      if (
        periodType === "QUARTERLY" &&
        (!quarter || quarter < 1 || quarter > 4)
      ) {
        return {
          status: "ERROR",
          data: null,
          error: {
            code: "INVALID_QUARTER",
            message: "quarter 1-4 required",
          },
        };
      }
      if (periodType === "MONTHLY" && (!month || month < 1 || month > 12)) {
        return {
          status: "ERROR",
          data: null,
          error: { code: "INVALID_MONTH", message: "month 1-12 required" },
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
              "El destinatario no existe o no tiene email configurado",
          },
        };
      }

      // Para MONTHLY se consulta el trimestre que contiene el mes y se
      // filtra por mes en el CSV. Para QUARTERLY, se envia tal cual.
      const effectiveQuarter =
        periodType === "MONTHLY"
          ? Math.floor((month - 1) / 3) + 1
          : quarter;

      const [summaryRes, bookRes] = await Promise.all([
        getQuarterlyTaxSummary(year, effectiveQuarter, { traceId }),
        getLibroRegistroFacturasExpedidasInternal(year, effectiveQuarter, {
          traceId,
          rateLimitKey: "manager",
        }),
      ]);

      const quarterInvoices = bookRes?.data?.filas || [];
      let emailInvoices = quarterInvoices;
      let summaryForEmail = summaryRes?.data || null;

      if (periodType === "MONTHLY") {
        emailInvoices = _filterInvoicesByMonth(quarterInvoices, month);
        summaryForEmail = _summarizeMonthly(
          emailInvoices,
          year,
          month,
          effectiveQuarter
        );
      }

      const csvContent = _buildCsvFromInvoices(emailInvoices);
      const documentId = _formatDocumentId(
        year,
        effectiveQuarter,
        1
      );

      const subject =
        periodType === "MONTHLY"
          ? `Marian Madrid - Paquete ${String(month).padStart(2, "0")}/${year}`
          : `Marian Madrid - Paquete T${effectiveQuarter}/${year}`;

      const lines = [];
      lines.push("Paquete fiscal de gestoria - Marian Madrid");
      lines.push("");
      lines.push(`Ejercicio: ${year}`);
      if (periodType === "MONTHLY") {
        lines.push(`Mes: ${String(month).padStart(2, "0")}`);
        lines.push(`Trimestre contenedor: T${effectiveQuarter}`);
      } else {
        lines.push(`Trimestre: T${effectiveQuarter}`);
      }
      lines.push(`Documento referencia: ${documentId}`);
      lines.push(`Facturas incluidas: ${emailInvoices.length}`);
      if (notes) {
        lines.push("");
        lines.push("Notas:");
        lines.push(notes);
      }
      lines.push("");
      lines.push("Resumen:");
      lines.push(_buildSummaryText(summaryForEmail));
      lines.push("");
      lines.push("--");
      lines.push(
        "Enviado desde el panel de administracion de Marian Madrid."
      );

      const attachments = csvContent
        ? [
            {
              filename:
                periodType === "MONTHLY"
                  ? `paquete_${year}_${String(month).padStart(2, "0")}.csv`
                  : `paquete_${year}_T${effectiveQuarter}.csv`,
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
          periodType,
          year,
          quarter: effectiveQuarter,
          month: periodType === "MONTHLY" ? month : null,
          recipientId,
          recipientEmail: recipient.email,
          documentId,
          invoiceCount: emailInvoices.length,
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
        error: _toPublicError(err, "SEND_PACKAGE_FAIL"),
      };
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
              "El destinatario no existe o no tiene email configurado",
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
