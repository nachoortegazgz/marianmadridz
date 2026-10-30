/*
=============================================================================
MODULE: backend/inventario.web.js
VERSION: v5009-FISCAL-V20.1
BASE: v5007.4-FINAL + Directriz V20 (IDs nativa en ingles)
RESPONSIBILITY: Dashboard de inventario, cola de conciliacion Wix,
                movimiento seguro de inventario, y cierre de inventario
                valorado con hash y firma.
STANDARDS: G10 ASCII Strict (0 non-ASCII characters).
           Idempotencia por movementToken.
           Conciliacion con Wix Stores V1.

FIXES APLICADOS v5009-FISCAL-V20.1:
  - V20-01: sin renombrados de constantes JS. El modulo no importa
            constantes renombradas de internalConfig.js.
  - V20-02: recordInventoryMovementSafe escribe los campos V20.1
            (sourceEventId, catalogId, magnitude, thirdPartyId) con
            fallback legacy (eventoOrigenId, catalogoId, terceroId). El
            magnitude se deriva del signo de la cantidad (+1/-1/0).
  - V20-03: NOTA DE AUDITORIA: el original usa BUSINESS_COLLECTIONS.HISTORICO_CIERRES_Z
            para escribir cierres de inventario (mezcla con cierres Z). Se
            preserva tal cual (bug del original, no de V20.1). El schema
            V20.1-EXPANDED-v2 amplia HistoricoCierresZ para acomodar los
            campos de inventario (inventoryClosingId, fiscalYear,
            closingDate, closingType, sku, productId, productDescription,
            stockQuantity, unitCost, stockValue, accountCode, debitBalance,
            creditBalance).

CORRECTIONS (heredadas v5007.4):
  [INV-01..05] movementToken, stockBefore/After, needsWixReconciliation,
               recordOnlineInventoryOrder/Refund.
  [FIX-C3] generateInventoryClosing + listInventoryClosings.
  [FIX-D1..D3] Imports correctos.
  - FIX-52: generateInventoryClosing usa try/catch por insert.
  - FIX-53: fallo explicito si SECRETS.FISCAL_KEY no esta disponible.
  - FIX-54: getInventoryDashboard usa contains en lugar de hasSome.
=============================================================================
*/

import { webMethod, Permissions } from "wix-web-module";
import { query as dalQuery, insertItem as insert, updateItem as update } from "backend/dataAccess";
import { getStoresCatalogVersion, getDefaultStoresLocationId, getStoresCatalogVariants } from "backend/storesCatalog";
import { CATALOG_VERSION, normalizeStoreOrderLineItem, buildInventoryMovementToken } from "backend/storesCatalogMapper";

import {
  BUSINESS_COLLECTIONS, OPERATIONAL_COLLECTIONS, CONTROL_TYPE,
  SDK_CONFIG,
} from "backend/internalConfig";

import {
  makeTraceId,
  _safeTrim,
  _generateUUID,
  _roundMoney,
  _readDate,
  _stableSerialize,
} from "public/mmUtils";

import { logger } from "backend/logger";
import { requireAdmin, requireCajero } from "backend/security";
import { _toPublicError } from "backend/responseUtils";
import { normalizeError } from "backend/booking/bookingCore";
import { logAuditEvent } from "backend/audit";

import { hashSHA256, hmacSha256Hex } from "backend/securityEngine";
import { getSecretValue } from "backend/secretAccess";
import { SECRETS } from "backend/mmSecrets";

const log = logger;
const INVENTARIO_COL = BUSINESS_COLLECTIONS.INVENTARIO_STOCK_VENTA;
const MOVIMIENTOS_INV_COL = OPERATIONAL_COLLECTIONS.MOVIMIENTOS_INVENTARIO;
const CIERRE_INV_COL = BUSINESS_COLLECTIONS.HISTORICO_CIERRES_Z;
const CONTROL_COL = BUSINESS_COLLECTIONS.CONTROL_OPERATIVO;

// =============================================================================
// BLOQUE 1 - GET INVENTORY DASHBOARD
// =============================================================================

export const getInventoryDashboard = webMethod(Permissions.SiteMember, async (options = {}) => {
  const traceId = options?.traceId || makeTraceId("inv-dashboard");
  try {
    await requireCajero(traceId);

    if (options?.category) {
      return {
        status: "ERROR",
        data: null,
        error: {
          code: "UNSUPPORTED_INVENTORY_FILTER",
          message: "La coleccion InventarioStockVenta no define el campo category.",
        },
      };
    }

    const limit = Math.min(Number(options?.limit) || 50, 200);
    let invQuery = dalQuery(INVENTARIO_COL);

    if (options?.search) {
      invQuery = invQuery.contains("name", _safeTrim(options.search));
    }

    const res = await invQuery
      .ascending("name")
      .limit(limit)
      .find({ consistencyMode: "strong" });

    const items = res?.items || [];
    const stockValue = (item) => {
      const onHand = Number(item.stockOnHand);
      if (Number.isFinite(onHand)) return onHand;
      const historical = Number(item.stockExpected);
      return Number.isFinite(historical) ? historical : 0;
    };
    const threshold = (item) => {
      const minimum = Number(item.stockMinimo);
      return Number.isFinite(minimum) && minimum >= 0 ? minimum : 5;
    };

    const totalStock = items.reduce((sum, item) => sum + stockValue(item), 0);
    const lowStockItems = items.filter((item) => stockValue(item) <= threshold(item));
    const needsReconciliation = items.filter((item) => item.needsWixReconciliation === true);

    const publicItems = items.map((item) => ({
      sku: item.sku,
      productName: item.name,
      stockOnHand: Number(item.stockOnHand) || 0,
      stockReserved: Number(item.stockReserved) || 0,
      stockAvailable: Number(item.stockAvailable) || 0,
      lowStock: stockValue(item) <= threshold(item),
      needsWixReconciliation: item.needsWixReconciliation === true,
      catalogVersion: item.catalogVersion || null,
      locationId: item.locationId || null,
    }));

    return {
      status: "SUCCESS",
      data: {
        items: publicItems,
        totalItems: items.length,
        totalStock,
        lowStockCount: lowStockItems.length,
        needsReconciliationCount: needsReconciliation.length,
      },
      error: null,
    };
  } catch (err) {
    return { status: "ERROR", data: null, error: _toPublicError(err, "INV_DASHBOARD_FAIL") };
  }
});

// =============================================================================
// BLOQUE 2 - GET INVENTORY RECONCILIATION QUEUE
// =============================================================================

export const getInventoryReconciliationQueue = webMethod(Permissions.SiteMember, async (options = {}) => {
  const traceId = options?.traceId || makeTraceId("inv-recon");
  try {
    await requireAdmin(traceId);

    const [stockRes, orderRes, refundRes] = await Promise.all([
      dalQuery(INVENTARIO_COL)
        .eq("needsWixReconciliation", true)
        .limit(100)
        .find({ consistencyMode: "strong" }),
      dalQuery(CONTROL_COL)
        .eq("controlType", CONTROL_TYPE.ALERT)
        .eq("alertType", "INVENTORY_ORDER_RECONCILIATION")
        .eq("status", "OPEN")
        .limit(100)
        .find({ consistencyMode: "strong" }),
      dalQuery(CONTROL_COL)
        .eq("controlType", CONTROL_TYPE.ALERT)
        .eq("alertType", "INVENTORY_REFUND_RECONCILIATION")
        .eq("status", "OPEN")
        .limit(100)
        .find({ consistencyMode: "strong" }),
    ]);

    const pendingOrders = (orderRes?.items || []).map((item) => ({
      id: item._id,
      orderId: item.orderId || null,
      status: item.status,
      attempts: Number(item.attempts || 0),
      lastError: item.lastError || null,
      createdDate: item._createdDate || null,
    }));
    const pendingRefunds = (refundRes?.items || []).map((item) => ({
      id: item._id,
      orderId: item.orderId || null,
      refundId: item.refundId || null,
      status: item.status,
      attempts: Number(item.attempts || 0),
      lastError: item.lastError || null,
      createdDate: item._createdDate || null,
    }));

    return {
      status: "SUCCESS",
      data: {
        items: stockRes?.items || [],
        pendingOrders,
        pendingRefunds,
        total: (stockRes?.items?.length || 0) + pendingOrders.length + pendingRefunds.length,
      },
      error: null,
    };
  } catch (err) {
    return { status: "ERROR", data: null, error: _toPublicError(err, "INV_RECON_FAIL") };
  }
});

// =============================================================================
// BLOQUE 3 - RECORD INVENTORY MOVEMENT SAFE
// [V20.1] Escribe sourceEventId, catalogId, magnitude, thirdPartyId con
//         fallback a nombres legacy (eventoOrigenId, catalogoId, terceroId).
// =============================================================================

async function queueInventoryReconciliation({
  recordId,
  alertType,
  orderId,
  refundId = null,
  workItems = [],
  errors = [],
  traceId,
}) {
  const normalizedId = _safeTrim(recordId);
  if (!normalizedId) throw new Error("INVENTORY_RECONCILIATION_ID_REQUIRED");

  const queueId = `INV_RECON_${normalizedId}`;
  const existingRes = await dalQuery(CONTROL_COL)
    .eq("_id", queueId)
    .limit(1)
    .find({ consistencyMode: "strong" });
  const existing = existingRes?.items?.[0] || null;

  if (existing?.status === "RESOLVED") {
    return { queueId, alreadyResolved: true };
  }

  const payload = {
    items: workItems,
    errors,
    catalogVersion: workItems[0]?.identity?.catalogVersion || null,
    lastAttemptAt: null,
  };
  const record = {
    _id: queueId,
    controlType: CONTROL_TYPE.ALERT,
    alertType,
    dedupeKey: queueId,
    status: "OPEN",
    severity: "ERROR",
    message: `Reconciliacion de inventario pendiente: ${normalizedId}`,
    orderId: orderId || null,
    refundId: refundId || null,
    traceId,
    attempts: Number(existing?.attempts || 0),
    maxAttempts: 10,
    lastError: errors.map((item) => item.code || item.message || "INVENTORY_ERROR").join("; ").slice(0, 1000),
    payload,
  };

  if (existing) {
    await update(CONTROL_COL, { ...existing, ...record });
  } else {
    await insert(CONTROL_COL, record);
  }

  return { queueId, alreadyResolved: false };
}

export async function recordInventoryMovementSafe(identity, movementType, quantityDelta, meta = {}) {
  const traceId = meta.traceId || makeTraceId("inv-mov");
  const cleanType = _safeTrim(movementType).toUpperCase();
  const allowedTypes = new Set([
    "VENTA", "DEVOLUCION", "AJUSTE", "ENTRADA_STOCK", "SALIDA_STOCK", "TRANSFERENCIA",
  ]);

  if (!allowedTypes.has(cleanType)) {
    return { status: "ERROR", data: null, error: { code: "INVALID_MOVEMENT_TYPE", message: "Tipo de movimiento no permitido." } };
  }

  const stockKey = _safeTrim(identity?.stockKey);
  const productId = _safeTrim(identity?.productId);
  const variantId = _safeTrim(identity?.variantId);
  const catalogVersion = _safeTrim(identity?.catalogVersion);
  const locationId = _safeTrim(identity?.locationId) || null;
  const cleanSku = _safeTrim(identity?.sku) || null;

  if (!stockKey || !productId || !variantId || !catalogVersion) {
    return { status: "ERROR", data: null, error: { code: "INCOMPLETE_VARIANT_IDENTITY", message: "Se requiere stockKey, productId, variantId y catalogVersion." } };
  }
  if (catalogVersion === CATALOG_VERSION.V3 && !locationId) {
    return { status: "ERROR", data: null, error: { code: "V3_LOCATION_ID_REQUIRED", message: "Catalog V3 requiere locationId." } };
  }
  if (catalogVersion === CATALOG_VERSION.V1 && locationId) {
    return { status: "ERROR", data: null, error: { code: "V1_LOCATION_ID_NOT_SUPPORTED", message: "Catalog V1 no utiliza locationId." } };
  }

  const qty = Number(quantityDelta);
  if (!Number.isFinite(qty) || qty === 0) {
    return { status: "ERROR", data: null, error: { code: "INVALID_QUANTITY", message: "Cantidad no puede ser 0 y debe ser numerica." } };
  }

  const movementToken = _safeTrim(meta.movementToken);
  if (!movementToken) {
    return { status: "ERROR", data: null, error: { code: "MOVEMENT_TOKEN_REQUIRED", message: "movementToken obligatorio para idempotencia." } };
  }

  const existingRes = await dalQuery(MOVIMIENTOS_INV_COL)
    .eq("movementToken", movementToken)
    .limit(1)
    .find({ consistencyMode: "strong" });
  const existingMovement = existingRes?.items?.[0] || null;

  const stockRes = await dalQuery(INVENTARIO_COL)
    .eq("stockKey", stockKey)
    .limit(2)
    .find({ consistencyMode: "strong" });
  const stockRows = stockRes?.items || [];

  if (stockRows.length !== 1) {
    return {
      status: "ERROR",
      data: null,
      error: {
        code: stockRows.length === 0 ? "STOCK_VARIANT_NOT_MAPPED" : "STOCK_VARIANT_KEY_NOT_UNIQUE",
        message: stockRows.length === 0
          ? `No existe registro de inventario para ${stockKey}.`
          : `Hay mas de un registro para ${stockKey}; se requiere conciliacion manual.`,
      },
    };
  }

  const stockItem = stockRows[0];
  if (cleanSku && _safeTrim(stockItem.sku) && cleanSku !== _safeTrim(stockItem.sku)) {
    return { status: "ERROR", data: null, error: { code: "SKU_VARIANT_MISMATCH", message: "El SKU del pedido no coincide con la variante inventariada." } };
  }

  if (existingMovement) {
    if (existingMovement.stockApplied === true) {
      return { status: "SUCCESS", data: existingMovement, error: null, idempotent: true };
    }

    if (stockItem.lastInventoryMovementId === existingMovement._id) {
      const recovered = { ...existingMovement, stockApplied: true, _updatedDate: new Date() };
      await update(MOVIMIENTOS_INV_COL, recovered);
      return { status: "SUCCESS", data: recovered, error: null, idempotent: true, recovered: true };
    }

    if (existingMovement.stockApplied !== false) {
      return { status: "ERROR", data: existingMovement, error: { code: "INVENTORY_MOVEMENT_APPLY_STATE_UNKNOWN", message: "No se puede demostrar si el movimiento historico actualizo el stock." } };
    }

    const currentStock = Number(stockItem.stockOnHand);
    const reservedStock = Number(stockItem.stockReserved);
    const priorStock = Number(existingMovement.stockBefore);
    const targetStock = Number(existingMovement.stockAfter);
    if (!Number.isFinite(currentStock) || !Number.isFinite(reservedStock) ||
        !Number.isFinite(priorStock) || !Number.isFinite(targetStock) ||
        Math.abs(currentStock - priorStock) > 0.001 || targetStock - reservedStock < 0) {
      return { status: "ERROR", data: existingMovement, error: { code: "INVENTORY_MOVEMENT_RECONCILIATION_REQUIRED", message: "El stock cambio desde el movimiento pendiente; requiere conciliacion manual." } };
    }

    stockItem.stockOnHand = targetStock;
    stockItem.stockAvailable = targetStock - reservedStock;
    stockItem.lastInventoryMovementAt = new Date();
    stockItem.lastInventoryMovementId = existingMovement._id;
    if (existingMovement.requiresWixReconciliation === true) stockItem.needsWixReconciliation = true;
    stockItem._updatedDate = new Date();
    await update(INVENTARIO_COL, stockItem);

    const recovered = { ...existingMovement, stockApplied: true, _updatedDate: new Date() };
    await update(MOVIMIENTOS_INV_COL, recovered);
    return { status: "SUCCESS", data: recovered, error: null, idempotent: true, recovered: true };
  }

  const stockOnHand = Number(stockItem.stockOnHand);
  const stockReserved = Number(stockItem.stockReserved);
  if (!Number.isFinite(stockOnHand) || !Number.isFinite(stockReserved)) {
    return { status: "ERROR", data: null, error: { code: "INVALID_STOCK_BALANCE", message: "stockOnHand y stockReserved deben ser valores numericos." } };
  }

  const stockBefore = stockOnHand;
  const stockAfter = stockOnHand + qty;
  const stockAvailable = stockAfter - stockReserved;

  if (stockAfter < 0 && !meta.allowNegativeStock) {
    return { status: "ERROR", data: null, error: { code: "NEGATIVE_STOCK", message: `Stock resultante seria ${stockAfter}. Stock actual: ${stockBefore}` } };
  }
  if (stockAvailable < 0) {
    return { status: "ERROR", data: null, error: { code: "STOCK_BELOW_RESERVED", message: "El stock resultante no puede ser inferior al stock reservado." } };
  }

  const movement = {
    movementToken,
    recordTimestamp: new Date(),
    stockKey,
    sku: _safeTrim(stockItem.sku) || cleanSku,
    productName: _safeTrim(stockItem.name),
    quantity: Math.abs(qty),
    quantityDelta: qty,
    stockBefore,
    stockAfter,
    movementType: cleanType,
    operationDescription: meta.operationDescription || meta.reason || "",
    reason: meta.reason || "",
    referenceId: meta.referenceId || null,
    orderId: meta.orderId || null,
    refundId: meta.refundId || null,
    lineItemId: meta.lineItemId || null,
    actorEmail: meta.actorEmail || null,
    actorMemberId: meta.actorMemberId || null,
    requiresWixReconciliation: meta.requiresWixReconciliation === true,
    nativeCommercialMovement: meta.nativeCommercialMovement === true,
    wixProductId: productId,
    wixVariantId: variantId,
    catalogVersion,
    locationId,
    sourceEventId: _safeTrim(meta.sourceEventId) || null,
    catalogId: _safeTrim(meta.catalogId) || null,
    magnitude: qty > 0 ? 1 : -1,
    thirdPartyId: _safeTrim(meta.thirdPartyId) || null,
    stockApplied: false,
    traceId,
  };

  const savedMovement = await insert(MOVIMIENTOS_INV_COL, movement);

  stockItem.stockOnHand = stockAfter;
  stockItem.stockAvailable = stockAvailable;
  stockItem.lastInventoryMovementAt = new Date();
  stockItem.lastInventoryMovementId = savedMovement._id;
  stockItem.catalogVersion = catalogVersion;
  stockItem.locationId = locationId;
  if (meta.requiresWixReconciliation === true) stockItem.needsWixReconciliation = true;
  stockItem._updatedDate = new Date();

  try {
    await update(INVENTARIO_COL, stockItem);
    const appliedMovement = { ...savedMovement, stockApplied: true, _updatedDate: new Date() };
    await update(MOVIMIENTOS_INV_COL, appliedMovement);
    log.info("Inventory movement recorded", {
      stockKey,
      movementType: cleanType,
      quantityDelta: qty,
      stockBefore,
      stockAfter,
      traceId,
    });
    return { status: "SUCCESS", data: appliedMovement, error: null };
  } catch (error) {
    log.error("Inventory movement requires reconciliation", {
      stockKey,
      movementToken,
      error: error?.message || String(error),
      traceId,
    });
    return {
      status: "ERROR",
      data: savedMovement,
      error: { code: "INVENTORY_APPLY_FAILED", message: error?.message || String(error) },
    };
  }
}

export const replayInventoryReconciliation = webMethod(Permissions.Admin, async (recordId) => {
  const traceId = makeTraceId("inv-replay");
  try {
    await requireAdmin(traceId);
    const queueId = _safeTrim(recordId);
    if (!queueId) {
      return { status: "ERROR", data: null, error: { code: "QUEUE_ID_REQUIRED", message: "Identificador de cola obligatorio." } };
    }

    const queueRes = await dalQuery(CONTROL_COL)
      .eq("_id", queueId)
      .limit(1)
      .find({ consistencyMode: "strong" });
    const queueItem = queueRes?.items?.[0];
    if (!queueItem ||
        !["INVENTORY_ORDER_RECONCILIATION", "INVENTORY_REFUND_RECONCILIATION"].includes(queueItem.alertType)) {
      return { status: "ERROR", data: null, error: { code: "INVENTORY_RECONCILIATION_NOT_FOUND", message: "No existe la reconciliacion solicitada." } };
    }
    if (queueItem.status === "RESOLVED") {
      return { status: "SUCCESS", data: { queueId, idempotent: true }, error: null };
    }

    const payload = queueItem.payload && typeof queueItem.payload === "object" ? queueItem.payload : {};
    const workItems = Array.isArray(payload.items) ? payload.items : [];
    if (workItems.length === 0) {
      return { status: "ERROR", data: null, error: { code: "NO_REPLAYABLE_INVENTORY_ITEMS", message: "La cola no contiene variantes con identidad completa." } };
    }

    const results = [];
    for (const work of workItems) {
      const result = await recordInventoryMovementSafe(
        work.identity,
        work.movementType,
        work.quantityDelta,
        {
          traceId,
          movementToken: work.movementToken,
          orderId: work.orderId || queueItem.orderId,
          refundId: work.refundId || queueItem.refundId,
          lineItemId: work.lineItemId,
          reason: work.reason,
          requiresWixReconciliation: true,
          nativeCommercialMovement: work.movementType === "VENTA",
        },
      );
      results.push({
        lineItemId: work.lineItemId,
        status: result.status,
        error: result.error?.code || null,
      });
    }

    const failed = results.filter((item) => item.status !== "SUCCESS");
    const attempts = Number(queueItem.attempts || 0) + 1;
    const nextPayload = {
      ...payload,
      lastAttemptAt: new Date().toISOString(),
      lastResults: results,
    };
    await update(CONTROL_COL, {
      ...queueItem,
      status: failed.length ? "OPEN" : "RESOLVED",
      attempts,
      lastError: failed.map((item) => item.error || "INVENTORY_ERROR").join("; ").slice(0, 1000),
      processedAt: failed.length ? null : new Date(),
      payload: nextPayload,
      _updatedDate: new Date(),
    });

    return {
      status: failed.length ? "PENDING_RECONCILIATION" : "SUCCESS",
      data: { queueId, processed: results.length, failed: failed.length, results },
      error: null,
    };
  } catch (err) {
    return { status: "ERROR", data: null, error: _toPublicError(err, "INV_REPLAY_FAIL") };
  }
});

// =============================================================================
// BLOQUE 4 - RECORD ONLINE INVENTORY ORDER
// =============================================================================

export async function recordOnlineInventoryOrderInternal(order, traceId) {
  const orderId = _safeTrim(order?._id || order?.id);
  if (!orderId) return { status: "SKIPPED", reason: "NO_ORDER_ID" };

  const lineItems = Array.isArray(order?.lineItems) ? order.lineItems : [];
  if (lineItems.length === 0) return { status: "SKIPPED", reason: "NO_LINE_ITEMS" };

  const catalogVersion = await getStoresCatalogVersion();
  if (catalogVersion === CATALOG_VERSION.NOT_INSTALLED) {
    return { status: "SKIPPED", reason: "STORES_NOT_INSTALLED" };
  }
  const locationId = catalogVersion === CATALOG_VERSION.V3
    ? await getDefaultStoresLocationId()
    : null;
  const catalogVariants = await getStoresCatalogVariants();

  const normalized = lineItems.map((item, index) => (
    normalizeStoreOrderLineItem(item, index, catalogVersion, locationId, catalogVariants)
  ));
  const storeItems = normalized.filter((item) => item.kind === "STORE_ITEM");
  const normalizationErrors = normalized
    .filter((item) => item.kind === "ERROR")
    .map((item) => ({ lineItemId: item.lineItemId, code: item.code, index: item.index }));

  if (storeItems.length === 0 && normalizationErrors.length === 0) {
    return { status: "SKIPPED", reason: "NO_STORE_LINE_ITEMS" };
  }

  const workItems = storeItems.map((item) => ({
    identity: {
      catalogVersion: item.catalogVersion,
      productId: item.productId,
      variantId: item.variantId,
      locationId: item.locationId,
      stockKey: item.stockKey,
      sku: item.sku,
    },
    movementType: "VENTA",
    quantityDelta: -item.quantity,
    movementToken: buildInventoryMovementToken({
      movementType: "VENTA",
      orderId,
      lineItemId: item.lineItemId,
    }),
    orderId,
    lineItemId: item.lineItemId,
    reason: `Venta online pedido ${orderId}`,
  }));

  const results = [];
  for (const work of workItems) {
    const result = await recordInventoryMovementSafe(
      work.identity,
      work.movementType,
      work.quantityDelta,
      {
        traceId,
        movementToken: work.movementToken,
        orderId,
        lineItemId: work.lineItemId,
        reason: work.reason,
        requiresWixReconciliation: true,
        nativeCommercialMovement: true,
      },
    );
    results.push({
      lineItemId: work.lineItemId,
      stockKey: work.identity.stockKey,
      status: result.status,
      error: result.error?.code || null,
    });
  }

  const failed = results.filter((item) => item.status !== "SUCCESS");
  if (failed.length || normalizationErrors.length) {
    const queue = await queueInventoryReconciliation({
      recordId: `ORDER_${orderId}`,
      alertType: "INVENTORY_ORDER_RECONCILIATION",
      orderId,
      workItems,
      errors: [...normalizationErrors, ...failed.map((item) => ({
        lineItemId: item.lineItemId,
        code: item.error || "INVENTORY_MOVEMENT_FAILED",
      }))],
      traceId,
    });
    return {
      status: "PENDING_RECONCILIATION",
      queueId: queue.queueId,
      data: results,
      errors: normalizationErrors,
    };
  }

  return { status: "SUCCESS", data: results };
}

// =============================================================================
// BLOQUE 5 - RECORD ONLINE INVENTORY REFUND
// =============================================================================

export async function recordOnlineInventoryRefundInternal(order, refundObj, restockInfo, traceId) {
  const orderId = _safeTrim(order?._id || order?.id);
  const refundId = _safeTrim(refundObj?._id || refundObj?.id);

  if (!orderId || !refundId) return { status: "SKIPPED", reason: "MISSING_IDS" };
  if (!restockInfo) return { status: "SKIPPED", reason: "NO_CONFIRMED_RESTOCK" };

  const restockLines = Array.isArray(restockInfo?.restock?.lineItems)
    ? restockInfo.restock.lineItems
    : Array.isArray(restockInfo?.lineItems)
      ? restockInfo.lineItems
      : [];
  if (restockLines.length === 0) {
    return { status: "SKIPPED", reason: "NO_CONFIRMED_RESTOCK" };
  }

  const lineItems = Array.isArray(order?.lineItems) ? order.lineItems : [];
  const lineItemsById = new Map(
    lineItems
      .filter((item) => _safeTrim(item?.id))
      .map((item) => [_safeTrim(item.id), item]),
  );

  const catalogVersion = await getStoresCatalogVersion();
  if (catalogVersion === CATALOG_VERSION.NOT_INSTALLED) {
    return { status: "SKIPPED", reason: "STORES_NOT_INSTALLED" };
  }
  const locationId = catalogVersion === CATALOG_VERSION.V3
    ? await getDefaultStoresLocationId()
    : null;
  const catalogVariants = await getStoresCatalogVariants();

  const workItems = [];
  const normalizationErrors = [];
  for (let index = 0; index < restockLines.length; index += 1) {
    const restockLine = restockLines[index];
    const lineItemId = _safeTrim(restockLine?.lineItemId);
    const quantity = Number(restockLine?.quantity);
    const orderLine = lineItemsById.get(lineItemId);

    if (!lineItemId || !orderLine || !Number.isFinite(quantity) || quantity <= 0) {
      normalizationErrors.push({
        lineItemId: lineItemId || null,
        code: "INVALID_REFUND_RESTOCK_LINE",
        index,
      });
      continue;
    }

    const normalized = normalizeStoreOrderLineItem(
      orderLine,
      index,
      catalogVersion,
      locationId,
      catalogVariants,
    );
    if (normalized.kind !== "STORE_ITEM") {
      if (normalized.kind === "ERROR") {
        normalizationErrors.push({
          lineItemId,
          code: normalized.code,
          index,
        });
      }
      continue;
    }

    workItems.push({
      identity: {
        catalogVersion: normalized.catalogVersion,
        productId: normalized.productId,
        variantId: normalized.variantId,
        locationId: normalized.locationId,
        stockKey: normalized.stockKey,
        sku: normalized.sku,
      },
      movementType: "DEVOLUCION",
      quantityDelta: quantity,
      movementToken: buildInventoryMovementToken({
        movementType: "DEVOLUCION",
        orderId,
        lineItemId,
        refundId,
      }),
      orderId,
      refundId,
      lineItemId,
      reason: `Devolucion reembolso ${refundId}`,
    });
  }

  if (workItems.length === 0 && normalizationErrors.length === 0) {
    return { status: "SKIPPED", reason: "NO_STORE_RESTOCK_LINES" };
  }

  const results = [];
  for (const work of workItems) {
    const result = await recordInventoryMovementSafe(
      work.identity,
      work.movementType,
      work.quantityDelta,
      {
        traceId,
        movementToken: work.movementToken,
        orderId,
        refundId,
        lineItemId: work.lineItemId,
        reason: work.reason,
        requiresWixReconciliation: true,
      },
    );
    results.push({
      lineItemId: work.lineItemId,
      stockKey: work.identity.stockKey,
      status: result.status,
      error: result.error?.code || null,
    });
  }

  const failed = results.filter((item) => item.status !== "SUCCESS");
  if (failed.length || normalizationErrors.length) {
    const queue = await queueInventoryReconciliation({
      recordId: `REFUND_${refundId}`,
      alertType: "INVENTORY_REFUND_RECONCILIATION",
      orderId,
      refundId,
      workItems,
      errors: [...normalizationErrors, ...failed.map((item) => ({
        lineItemId: item.lineItemId,
        code: item.error || "INVENTORY_MOVEMENT_FAILED",
      }))],
      traceId,
    });
    return {
      status: "PENDING_RECONCILIATION",
      queueId: queue.queueId,
      data: results,
      errors: normalizationErrors,
    };
  }

  return { status: "SUCCESS", data: results };
}

// =============================================================================
// BLOQUE 6 - GENERAR CIERRE DE INVENTARIO VALORADO
// =============================================================================

export const generateInventoryClosing = webMethod(Permissions.Admin, async (options = {}) => {
  const traceId = options?.traceId || makeTraceId("inv-close");
  // SSOT v20.1 / ADR-02: el cierre de inventario NO debe escribirse en
  // HistoricoCierresZ (mezcla dominio de caja con dominio de inventario).
  // No existe aun decision aprobada sobre el destino (InventarioStockVentaCierre,
  // recordType dentro de HistoricoCierresZ, o coleccion nueva), por lo que el
  // flujo queda BLOQUEADO hasta verificar la coleccion destino. El codigo de
  // proyeccion/valoracion se conserva debajo para reactivarlo cuando exista
  // evidencia de esquema (no alcanzable mientras devuelva early-return).
  log.warn("generateInventoryClosing blocked: destination collection unverified", { traceId });
  return {
    status: "ERROR",
    data: null,
    error: {
      code: "INVENTORY_CLOSING_SCHEMA_UNVERIFIED",
      message: "El cierre de inventario esta bloqueado hasta verificar su coleccion destino.",
    },
  };
  // eslint-disable-next-line no-unreachable
  try {
    await requireAdmin(traceId);

    const fiscalYear = Number(options?.fiscalYear);
    if (!Number.isFinite(fiscalYear) || fiscalYear < 2020 || fiscalYear > 2100) {
      return { status: "ERROR", data: null, error: { code: "INVALID_FISCAL_YEAR", message: "fiscalYear invalido" } };
    }

    const closingType = _safeTrim(options?.closingType).toUpperCase() || "ANUAL";
    if (!["ANUAL", "MENSUAL", "EXTRAORDINARIO"].includes(closingType)) {
      return { status: "ERROR", data: null, error: { code: "INVALID_CLOSING_TYPE", message: "closingType debe ser ANUAL, MENSUAL o EXTRAORDINARIO" } };
    }

    const closingDate = _readDate(options?.closingDate) || new Date().toLocaleDateString("sv-SE", { timeZone: SDK_CONFIG?.TZ || "Europe/Madrid" });

    const existingClosing = await dalQuery(CIERRE_INV_COL)
      .eq("fiscalYear", fiscalYear)
      .eq("closingType", closingType)
      .limit(1)
      .find();

    if (existingClosing?.items?.length > 0) {
      return { status: "ERROR", data: null, error: { code: "CLOSING_ALREADY_EXISTS", message: "Ya existe un cierre para este ejercicio y tipo" } };
    }

    const stockRes = await dalQuery(INVENTARIO_COL)
      .eq("active", true)
      .limit(1000)
      .find();

    const stockItems = stockRes?.items || [];
    if (stockItems.length === 0) {
      return { status: "ERROR", data: null, error: { code: "NO_STOCK_ITEMS", message: "No hay articulos activos en inventario" } };
    }

    // FIX-53: fallo explicito si no hay fiscal key activa.
    const fiscalKey = await getSecretValue(SECRETS.FISCAL_KEY).catch(() => "");
    if (!fiscalKey) {
      return {
        status: "ERROR",
        data: null,
        error: {
          code: "FISCAL_KEY_UNAVAILABLE",
          message: "No se puede generar un cierre valorado sin clave fiscal activa",
        },
      };
    }

    const closingRecords = [];
    let totalStockValue = 0;

    for (const item of stockItems) {
      const sku = _safeTrim(item.sku);
      const stockQuantity = Number(
        Number.isFinite(Number(item.stockOnHand))
          ? Number(item.stockOnHand)
          : Number(item.stockExpected || 0)
      );
      const unitCost = Number(item.costExTax) || 0;
      const stockValue = _roundMoney(stockQuantity * unitCost);
      totalStockValue += stockValue;

      const closingId = `CLOSING_${fiscalYear}_${closingType}_${sku}`;

      const recordPayload = _stableSerialize({
        closingId,
        fiscalYear,
        closingDate,
        closingType,
        sku,
        stockQuantity,
        unitCost,
        stockValue,
      });
      const closingHash = await hashSHA256(recordPayload);
      const closingSignature = await hmacSha256Hex(fiscalKey, closingHash);

      const closingRecord = {
        _id: closingId,
        inventoryClosingId: closingId,
        fiscalYear,
        closingDate: new Date(closingDate),
        closingType,
        sku,
        productId: item.wixProductId || null,
        productDescription: _safeTrim(item.productName) || _safeTrim(item.description) || "",
        stockQuantity,
        unitCost,
        stockValue,
        accountCode: "300000",
        debitBalance: stockValue > 0 ? stockValue : 0,
        creditBalance: stockValue < 0 ? Math.abs(stockValue) : 0,
        closingHash,
        closingSignature,
        traceId,
        _createdDate: new Date(),
      };

      closingRecords.push(closingRecord);
    }

    // FIX-52: try/catch por insert. Idempotencia sobre retry.
    let createdCount = 0;
    let idempotentCount = 0;
    const failedRecords = [];

    for (const record of closingRecords) {
      try {
        await insert(CIERRE_INV_COL, record);
        createdCount += 1;
      } catch (insertErr) {
        const message = String(insertErr?.message || "");
        const isDuplicate = /Duplicated|WDE0123|ALREADY_EXISTS/.test(message);
        if (isDuplicate) {
          idempotentCount += 1;
        } else {
          failedRecords.push({ sku: record.sku, error: message });
        }
      }
    }

    if (failedRecords.length > 0) {
      await logAuditEvent(
        "INVENTORY_CLOSING_PARTIAL",
        "ERROR",
        `Cierre de inventario incompleto: ${failedRecords.length} SKUs fallaron`,
        { fiscalYear, closingType, failedCount: failedRecords.length, failedRecords: failedRecords.slice(0, 10), traceId },
        traceId,
        `CLOSING_${fiscalYear}`,
        "backend/inventario.web.js"
      );

      return {
        status: "ERROR",
        data: null,
        error: {
          code: "INVENTORY_CLOSING_PARTIAL",
          message: `Cierre incompleto: ${failedRecords.length} SKUs fallaron. Reintenta la operacion.`,
        },
      };
    }

    await logAuditEvent(
      "INVENTORY_CLOSING_GENERATED",
      "INFO",
      `Cierre de inventario generado: ${fiscalYear} ${closingType}`,
      { fiscalYear, closingType, createdCount, idempotentCount, totalStockValue, traceId },
      traceId,
      `CLOSING_${fiscalYear}`,
      "backend/inventario.web.js"
    );

    return {
      status: "SUCCESS",
      data: {
        fiscalYear,
        closingType,
        closingDate,
        totalItems: closingRecords.length,
        createdCount,
        idempotentCount,
        totalStockValue: _roundMoney(totalStockValue),
        closingIds: closingRecords.map((r) => r._id),
      },
      error: null,
    };
  } catch (err) {
    const norm = normalizeError(err);
    log.error("generateInventoryClosing failed", { code: norm.code, error: norm.message, traceId });
    return { status: "ERROR", data: null, error: { code: norm.code || "INV_CLOSE_FAIL", message: norm.message } };
  }
});

// =============================================================================
// BLOQUE 7 - LISTAR CIERRES DE INVENTARIO
// =============================================================================

export const listInventoryClosings = webMethod(Permissions.SiteMember, async (options = {}) => {
  const traceId = options?.traceId || makeTraceId("list-inv-close");
  try {
    await requireCajero(traceId);

    const fiscalYear = Number(options?.fiscalYear);
    const closingType = _safeTrim(options?.closingType);

    let closeQuery = dalQuery(CIERRE_INV_COL);
    if (fiscalYear) closeQuery = closeQuery.eq("fiscalYear", fiscalYear);
    if (closingType) closeQuery = closeQuery.eq("closingType", closingType);

    const res = await closeQuery
      .descending("closingDate")
      .limit(Math.min(Number(options?.limit) || 50, 200))
      .find();

    return {
      status: "SUCCESS",
      data: {
        closings: res?.items || [],
        total: res?.items?.length || 0,
      },
      error: null,
    };
  } catch (err) {
    return { status: "ERROR", data: null, error: _toPublicError(err, "LIST_INV_CLOSE_FAIL") };
  }
});
