/*
=============================================================================
MODULE: backend/fiscalAggregator.web.js
VERSION: v5015-ALIGNED
BASE: v5009-FISCAL-V20.1 + alineacion con internalConfig v12.0-SSOT-FINAL
      y dataAccess v2.1-UNIFIED
RESPONSIBILITY: Resumenes fiscales trimestrales y extractos del ledger
 para reporting fiscal interno. Usa Stream Accumulator Pattern con
 paginacion acotada.
STANDARDS: G10 ASCII Strict. Cero suppressAuth. Cero COLLECTIONS alias.

CAMBIOS DE ALINEACION v5015-ALIGNED (respecto a v5009-FISCAL-V20.1):
  ALN-01: COLLECTIONS alias eliminado. Uso de BUSINESS_COLLECTIONS.
  ALN-02: wixData.query(...).find({ suppressAuth, consistentRead }) ->
          dalQuery(...).find(). Cero suppressAuth.
  ALN-03: _getBusinessTaxId migrado a dalQuery(BUSINESS_COLLECTIONS.
          DATOS_FISCALES). El singleton CONFIG_SISTEMA se mantiene como
          unica fuente canonica del NIF emisor.
  ALN-04: Paginacion: hasNext()/next() del QueryBuilder de dataAccess son
          funciones compatibles con la firma original. next() es async y
          se awaita como en el original.
  ALN-05: MOVEMENT_TYPE (REEMBOLSO/PROPINA/AJUSTE) y RECORD_TYPE
          (CONFIG_SISTEMA) sin cambios: coinciden con v12.0.
  ALN-06: SDK_CONFIG.JOBS.FISCAL_DAILY_MAX_PAGES y TIMEOUTS.CMS_MS se
          mantienen desde internalConfig v12.0.

FIXES APLICADOS v5009-FISCAL-V20.1 (heredados):
  - V20-01..V20-03 + SSOT-V2 (v5011).
=============================================================================
*/

import { webMethod, Permissions } from "wix-web-module";

import {
  query as dalQuery,
} from "backend/dataAccess";

import { readMovementField, readMovementHash } from "backend/data";

import {
  BUSINESS_COLLECTIONS,
  SDK_CONFIG,
  MOVEMENT_TYPE,
  RECORD_TYPE,
} from "backend/internalConfig";

import { makeTraceId, _safeTrim, _roundMoney, withTimeout } from "public/mmUtils";
import { requireCajero, requireAdmin, rateLimiter } from "backend/security";
import { logger } from "backend/logger";

import { _toPublicError } from "backend/responseUtils";

const log = logger;
const CHUNK_PAGE_SIZE = 100;
const MAX_PAGES = SDK_CONFIG?.JOBS?.FISCAL_DAILY_MAX_PAGES || 50;
const CMS_TIMEOUT_MS = Number(SDK_CONFIG?.TIMEOUTS?.CMS_MS) || 15000;

const MOVIMIENTOS_CAJA_COL = BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA;
const DATOS_FISCALES_COL = BUSINESS_COLLECTIONS.DATOS_FISCALES;

// =============================================================================
// BLOQUE 0 - HELPERS DE LECTURA (SSOT-KEYFIELD-02: delegacion total a data.js)
// El contrato canon->alias vive SOLO en internalConfig.MOVEMENT_LEGACY_READ_ALIASES
// y se consume via readMovementField (data.js). Cero listas paralelas aqui.
// =============================================================================

const _num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

const _readTaxableAmount = (m) => _num(readMovementField(m, "taxBase"));
// Cuota IVA: canon SSOT es taxAmount; cuotaTotal es su alias (contrato unico).
const _readTaxAmount = (m) => _num(readMovementField(m, "taxAmount"));
const _readTaxRate = (m) => _num(readMovementField(m, "tipoImpositivo"));
const _readMovementType = (m) => _safeTrim(readMovementField(m, "movementType"));
const _readOperationNature = (m) => _safeTrim(readMovementField(m, "operationNature")).toUpperCase();
const _readPaymentMethod = (m) => _safeTrim(readMovementField(m, "paymentMethod")).toLowerCase();
// MATRIZ v15: huella canonica del dominio caja/fiscal es "hash"; el helper
// canónico readMovementHash aplica ya el contrato de aliases históricos.
const _readRecordHash = (m) => readMovementHash(m);
const _readLinkedBookingIds = (m) => _safeTrim(readMovementField(m, "linkedBookingIds"));
const _readInvoiceNumber = (m) => _safeTrim(readMovementField(m, "numSerieFactura"));
const _readOperationDate = (m) => _safeTrim(readMovementField(m, "fechaOperacion"));
const _readOperationDescription = (m) => _safeTrim(readMovementField(m, "operationDescription"));
const _readRecordSource = (m) => _safeTrim(readMovementField(m, "recordSource"));
const _readPreviousInvoiceId = (m) => _safeTrim(readMovementField(m, "previousInvoiceId")) || null;

// =============================================================================
// BLOQUE 1 - HELPERS
// =============================================================================

async function _rateLimitOrThrow(surface, key, traceId) {
  const rl = await rateLimiter({ surface, key });
  if (!rl.allowed) {
    const e = new Error(`RATE_LIMITED: retryAfter=${rl.retryAfter}`);
    e.code = "RATE_LIMITED";
    e.meta = { retryAfter: rl.retryAfter, surface, traceId };
    throw e;
  }
}

function _getQuarterMonths(year, quarter) {
  const y = Number(year);
  const q = Number(quarter);
  if (!Number.isFinite(y) || !Number.isFinite(q) || q < 1 || q > 4) return [];
  const monthMap = {
    1: ["01", "02", "03"],
    2: ["04", "05", "06"],
    3: ["07", "08", "09"],
    4: ["10", "11", "12"],
  };
  return monthMap[q].map((m) => `${y}-${m}`);
}

function _initTaxAccumulator(months) {
  const breakdownByMonth = {};
  months.forEach((m) => {
    breakdownByMonth[m] = { taxableAmount: 0, taxAmount: 0, total: 0, count: 0 };
  });
  return {
    totalTaxableAmount: 0,
    totalTaxAmount: 0,
    totalInvoiced: 0,
    totalGrossSales: 0,
    totalRefunds: 0,
    totalTips: 0,
    totalAdjustments: 0,
    countSales: 0,
    countRefunds: 0,
    countTips: 0,
    countAdjustments: 0,
    countFiscal: 0,
    totalOperations: 0,
    breakdownByPaymentMethod: { efectivo: 0, tarjeta: 0, bizum: 0, online: 0 },
    breakdownByMonth,
    breakdownByVatRate: {},
  };
}

function _accumulatePage(items, state) {
  for (const m of items) {
    state.totalOperations++;
    const accountingAmount = Number(m.accountingAmount || 0);
    const taxableAmount = _readTaxableAmount(m);
    const taxAmount = _readTaxAmount(m);
    const mes = _safeTrim(m.fiscalPeriod || m.mesKey);
    const paymentMethod = _readPaymentMethod(m);
    const taxRate = _readTaxRate(m);
    const taxRateKey = String(taxRate);
    const movementType = _readMovementType(m).toUpperCase();
    const operationNature = _readOperationNature(m) || (
      movementType === MOVEMENT_TYPE.PROPINA ? "PROPINA" :
      movementType === MOVEMENT_TYPE.REEMBOLSO || accountingAmount < 0 ? "DEVOLUCION" :
      movementType === MOVEMENT_TYPE.AJUSTE ? "AJUSTE" : "VENTA"
    );

    if (state.breakdownByPaymentMethod[paymentMethod] !== undefined) {
      state.breakdownByPaymentMethod[paymentMethod] += accountingAmount;
    }

    if (operationNature === "PROPINA") {
      state.totalTips += accountingAmount;
      state.countTips++;
      continue;
    }

    if (operationNature === "AJUSTE") {
      state.totalAdjustments += accountingAmount;
      state.countAdjustments++;
      continue;
    }

    state.countFiscal++;
    state.totalTaxableAmount += taxableAmount;
    state.totalTaxAmount += taxAmount;
    state.totalInvoiced += accountingAmount;

    if (operationNature === "VENTA") {
      state.totalGrossSales += accountingAmount;
      state.countSales++;
    } else {
      state.totalRefunds += accountingAmount;
      state.countRefunds++;
    }

    if (state.breakdownByMonth[mes]) {
      state.breakdownByMonth[mes].taxableAmount += taxableAmount;
      state.breakdownByMonth[mes].taxAmount += taxAmount;
      state.breakdownByMonth[mes].total += accountingAmount;
      state.breakdownByMonth[mes].count++;
    }

    if (!state.breakdownByVatRate[taxRateKey]) {
      state.breakdownByVatRate[taxRateKey] = { taxRate, taxableAmount: 0, taxAmount: 0, total: 0, operations: 0 };
    }
    state.breakdownByVatRate[taxRateKey].taxableAmount += taxableAmount;
    state.breakdownByVatRate[taxRateKey].taxAmount += taxAmount;
    state.breakdownByVatRate[taxRateKey].total += accountingAmount;
    state.breakdownByVatRate[taxRateKey].operations++;
  }
}

// ALN-02/04: paginacion via dataAccess. find() devuelve { items, hasNext(), next() }.
async function _fetchQuarterMovements(months, options = {}) {
  const { traceId = makeTraceId("fiscal-fetch"), limit = MAX_PAGES, pageSize = CHUNK_PAGE_SIZE } = options;
  let allItems = [];

  let res = await withTimeout(
    dalQuery(MOVIMIENTOS_CAJA_COL)
      .hasSome("fiscalPeriod", months)
      .ascending("sequenceNumber")
      .limit(pageSize)
      .find(),
    CMS_TIMEOUT_MS,
    "fetchQuarterMovements:p1"
  );

  if (res?.items) allItems = allItems.concat(res.items);

  let page = 2;
  let reachedMaxPages = false;
  while (res && typeof res.hasNext === "function" && res.hasNext() && page <= limit) {
    res = await withTimeout(
      res.next(),
      CMS_TIMEOUT_MS,
      `fetchQuarterMovements:p${page}`
    );
    if (res?.items) allItems = allItems.concat(res.items);
    page++;
  }

  if (page > limit && res && typeof res.hasNext === "function" && res.hasNext()) {
    reachedMaxPages = true;
    log.warn("_fetchQuarterMovements: reached maxPages limit", { months, limit, traceId });
  }

  return { items: allItems, reachedMaxPages, totalPages: page - 1 };
}

// =============================================================================
// BLOQUE 2 - RESUMEN FISCAL TRIMESTRAL
// =============================================================================

export async function getQuarterlyTaxSummaryInternal(year, quarter, options = {}) {
  const traceId = options.traceId || makeTraceId("tax-summary");
  const y = Number(year);
  const q = Number(quarter);
  if (!Number.isFinite(y) || !Number.isFinite(q) || q < 1 || q > 4) {
    return { status: "ERROR", data: null, error: { code: "INVALID_PARAMS", message: "year and quarter (1-4) are required." } };
  }

  const months = _getQuarterMonths(y, q);
  if (!months.length) {
    return { status: "ERROR", data: null, error: { code: "INVALID_PARAMS", message: "Could not resolve quarter months." } };
  }

  const fetchResult = await _fetchQuarterMovements(months, { traceId });
  const state = _initTaxAccumulator(months);
  _accumulatePage(fetchResult.items, state);

  // Sin fallback BXXXXXXXX (prohibido inventar NIF). Si falta el singleton
  // fiscal, el error se propaga al wrapper webMethod (TAX_SUMMARY_FAIL).
  const nifEmisor = await _getBusinessTaxId(traceId);

  return {
    status: "SUCCESS",
    data: {
      ejercicio: y,
      trimestre: q,
      periodoMeses: months,
      nifEmisor,
      totalOperaciones: state.totalOperations,
      totalOperacionesFiscales: state.countFiscal,
      conteo: {
        ventas: state.countSales,
        reembolsos: state.countRefunds,
        propinas: state.countTips,
        ajustes: state.countAdjustments,
      },
      borradorIva: {
        estado: "REVISION_PROFESIONAL_REQUERIDA",
        baseImponibleRegistrada: _roundMoney(state.totalTaxableAmount),
        cuotaIvaRegistrada: _roundMoney(state.totalTaxAmount),
        nota: "No es un Modelo 303 oficial. Requiere validacion previa por gestoria.",
      },
      borradorIngresos: {
        estado: "REVISION_PROFESIONAL_REQUERIDA",
        ingresosRegistrados: _roundMoney(state.totalTaxableAmount),
        nota: "No es un Modelo 130 oficial. Requiere validacion previa por gestoria.",
      },
      totales: {
        totalVentasBrutas: _roundMoney(state.totalGrossSales),
        totalReembolsos: _roundMoney(state.totalRefunds),
        totalFacturadoNeto: _roundMoney(state.totalInvoiced),
        totalPropinasSeparadas: _roundMoney(state.totalTips),
        totalAjustesSeparados: _roundMoney(state.totalAdjustments),
      },
      desgloseFormaPago: {
        efectivo: _roundMoney(state.breakdownByPaymentMethod.efectivo),
        tarjeta: _roundMoney(state.breakdownByPaymentMethod.tarjeta),
        bizum: _roundMoney(state.breakdownByPaymentMethod.bizum),
        online: _roundMoney(state.breakdownByPaymentMethod.online),
      },
      desgloseMensual: Object.keys(state.breakdownByMonth).map((mesKey) => ({
        mesKey,
        baseImponible: _roundMoney(state.breakdownByMonth[mesKey].taxableAmount),
        cuotaIva: _roundMoney(state.breakdownByMonth[mesKey].taxAmount),
        total: _roundMoney(state.breakdownByMonth[mesKey].total),
        operaciones: state.breakdownByMonth[mesKey].count,
      })),
      desgloseTipoIva: Object.values(state.breakdownByVatRate).map((item) => ({
        tasaIva: item.taxRate,
        baseImponible: _roundMoney(item.taxableAmount),
        cuotaIva: _roundMoney(item.taxAmount),
        total: _roundMoney(item.total),
        operaciones: item.operations,
      })),
      reachedMaxPages: fetchResult.reachedMaxPages,
      totalPagesFetched: fetchResult.totalPages,
    },
    error: null,
  };
}

// =============================================================================
// BLOQUE 3 - LIBRO DE REGISTRO DE FACTURAS EXPEDIDAS
// =============================================================================

export async function getLibroRegistroFacturasExpedidasInternal(year, quarter, options = {}) {
  const traceId = options.traceId || makeTraceId("libro-registro");
  const y = Number(year);
  const q = Number(quarter);
  if (!Number.isFinite(y) || !Number.isFinite(q) || q < 1 || q > 4) {
    return { status: "ERROR", data: null, error: { code: "INVALID_PARAMS", message: "year and quarter (1-4) are required." } };
  }

  const months = _getQuarterMonths(y, q);
  if (!months.length) {
    return { status: "ERROR", data: null, error: { code: "INVALID_PARAMS", message: "Could not resolve quarter months." } };
  }

  const fetchResult = await _fetchQuarterMovements(months, { traceId });
  let libroFilas = [];
  let orderIndex = 1;

  for (const m of fetchResult.items) {
    const accountingAmount = Number(m.accountingAmount || 0);
    const movementType = _readMovementType(m).toUpperCase();
    const operationNature = _readOperationNature(m);
    const isTip = operationNature === "PROPINA" || movementType === MOVEMENT_TYPE.PROPINA;
    const isAdjustment = operationNature === "AJUSTE" || movementType === MOVEMENT_TYPE.AJUSTE;
    const isRefund = operationNature === "DEVOLUCION" || movementType === MOVEMENT_TYPE.REEMBOLSO || accountingAmount < 0;

    libroFilas.push({
      orden: orderIndex++,
      invoiceNumber: _readInvoiceNumber(m),
      fechaExpedicion: _readOperationDate(m),
      tipoFactura: isRefund ? "R1" : "BORRADOR_INTERNO",
      movementType: _readMovementType(m),
      operationNature: operationNature || "VENTA",
      taxTreatment: (isTip || isAdjustment) ? "PENDIENTE_VALIDACION" : "DEVENGADO",
      incluidoEnBorradorIva: !isTip && !isAdjustment,
      referenciaRectificativa: _readPreviousInvoiceId(m),
      paymentMethod: _readPaymentMethod(m),
      taxableAmount: _roundMoney(_readTaxableAmount(m)),
      taxRate: `${Math.round(_readTaxRate(m) * 100)}%`,
      taxAmount: _roundMoney(_readTaxAmount(m)),
      totalAmount: _roundMoney(accountingAmount),
      concepto: _readOperationDescription(m),
      origen: _readRecordSource(m),
      orderId: _safeTrim(m.orderId) || null,
      refundId: _safeTrim(m.refundId) || null,
      fechaHoraRegistro: m.recordTimestamp || null,
      huellaSha256: _readRecordHash(m).slice(0, 8).toUpperCase(),
      hashCompleto: _readRecordHash(m),
      reservaVinculada: _readLinkedBookingIds(m) || null,
      transactionId: _safeTrim(m.transactionId),
    });
  }

  return {
    status: "SUCCESS",
    data: {
      ejercicio: y,
      trimestre: q,
      totalRegistros: libroFilas.length,
      filas: libroFilas,
      reachedMaxPages: fetchResult.reachedMaxPages,
      totalPagesFetched: fetchResult.totalPages,
    },
    error: null,
  };
}

// =============================================================================
// SINGLETON FISCAL (ALN-03)
// =============================================================================

async function _getBusinessTaxId(traceId) {
  const config = await withTimeout(
    dalQuery(DATOS_FISCALES_COL)
      .eq("recordType", RECORD_TYPE.CONFIG_SISTEMA)
      .limit(1)
      .find(),
    CMS_TIMEOUT_MS,
    "getBusinessTaxId"
  );
  const item = config?.items?.[0];
  const taxId = _safeTrim(item?.nifProductor);
  if (taxId) return taxId.toUpperCase();
  // Fallback adapter legacy: filas historicas thirdPartyType=EMISOR con
  // campo "taxId". Emiten warn para trazar la migracion a CONFIG_SISTEMA.
  const legacy = await withTimeout(
    dalQuery(DATOS_FISCALES_COL).eq("thirdPartyType", "EMISOR").eq("active", true).limit(1).find(),
    CMS_TIMEOUT_MS,
    "getBusinessTaxIdLegacy"
  );
  const legacyTaxId = _safeTrim(legacy?.items?.[0]?.taxId);
  if (legacyTaxId) {
    log.warn("legacy-read: DatosFiscales EMISOR.taxId en uso; migrar a CONFIG_SISTEMA.nifProductor", { traceId });
    return legacyTaxId.toUpperCase();
  }
  throw new Error(
    "FISCAL_CONFIG_MISSING: no existe singleton DatosFiscales recordType=CONFIG_SISTEMA con nifProductor"
  );
}

// =============================================================================
// BLOQUE 4 - WEB METHODS
// =============================================================================

export const getQuarterlyTaxSummary = webMethod(Permissions.SiteMember, async (year, quarter, options = {}) => {
  const traceId = options.traceId || makeTraceId("tax-303");
  try {
    await _rateLimitOrThrow("fiscal.getQuarterlyTaxSummary", "staff", traceId);
    await requireCajero(traceId);
    return await getQuarterlyTaxSummaryInternal(year, quarter, { ...options, traceId });
  } catch (err) {
    log.error("getQuarterlyTaxSummary failed", { error: err?.message, traceId });
    return { status: "ERROR", data: null, error: _toPublicError(err, "TAX_SUMMARY_FAIL") };
  }
});

export const getLibroRegistroFacturasExpedidas = webMethod(Permissions.Admin, async (year, quarter, options = {}) => {
  const traceId = options.traceId || makeTraceId("libro-registro");
  try {
    await _rateLimitOrThrow("fiscal.getLibroRegistroFacturasExpedidas", "admin", traceId);
    await requireAdmin(traceId);
    return await getLibroRegistroFacturasExpedidasInternal(year, quarter, { ...options, traceId, rateLimitKey: "admin" });
  } catch (err) {
    log.error("getLibroRegistroFacturasExpedidas authorization failed", { error: err?.message, traceId });
    return { status: "ERROR", data: null, error: _toPublicError(err, "LIBRO_REGISTRO_FAIL") };
  }
});

// =============================================================================
// BLOQUE 5 - TEST HOOK (no es superficie publica Velo; solo consumo offline)
// =============================================================================
export const __test__ = {
  readTaxableAmount: _readTaxableAmount,
  readTaxAmount: _readTaxAmount,
  readTaxRate: _readTaxRate,
  readRecordHash: _readRecordHash,
  getBusinessTaxId: _getBusinessTaxId,
};
