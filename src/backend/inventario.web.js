/*
=============================================================================
MODULE: backend/inventario.web.js
RESPONSIBILITY:
- Read-only inventory views for the staff browser workspace.
- Idempotent CMS projection of native Wix Stores Catalog V1 order movements.
- Wix Stores remains authoritative for native stock; this module NEVER
  decrements or increments Wix inventory.
ARCHITECTURE:
- Wix native checkout/refund side effects own native stock quantity.
- MovimientosInventario is append-only; movementToken is the unique key.
- InventarioStockVenta is a projection refreshed from native Wix quantity.
- A per-stockKey ControlOperativo lease serializes CMS projection updates.
=============================================================================
*/

import { Permissions, webMethod } from "wix-web-module";
import { auth } from "@wix/essentials";
import { catalogVersioning, products } from "@wix/stores";

import {
    getItem as dalGet,
    insertItem as dalInsert,
    updateItem as dalUpdate,
    removeById as dalRemove,
    query as dalQuery,
} from "backend/dataAccess";

import {
    BUSINESS_COLLECTIONS,
    OPERATIONAL_COLLECTIONS,
    CONTROL_TYPE,
    INVENTORY_CONFIG,
    WIX_CATALOG_APP_IDS,
    SDK_CONFIG,
    isValidGuid,
} from "backend/internalConfig";

import { requireCajero, rateLimiter } from "backend/security";
import { hashSHA256 } from "backend/securityEngine";
import { validateInventoryOrderLine } from "backend/validation";
import { makeTraceId, _safeTrim, withTimeout } from "public/mmUtils";
import { logger } from "backend/logger";

const log = logger;
const STOCK_COL = BUSINESS_COLLECTIONS.INVENTARIO_STOCK_VENTA;
const MOVEMENTS_COL = BUSINESS_COLLECTIONS.MOVIMIENTOS_INVENTARIO;
const CONTROL_COL = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
const STRONG_READ = Object.freeze({ consistencyMode: "strong" });
const API_TIMEOUT_MS = Number(SDK_CONFIG?.TIMEOUTS?.WEBHOOK_MS) || 30000;

const getCatalogVersionElevated = auth.elevate(catalogVersioning.getCatalogVersion);
const getStoreVariantElevated = auth.elevate(products.getStoreVariant);

function _error(code, message, details = {}) {
    return { status: "ERROR", data: null, error: { code, message, ...details } };
}

async function _rateLimitOrThrow(surface, key) {
    const result = await rateLimiter({ surface, key });
    if (result?.allowed) return;
    const error = new Error(`RATE_LIMITED: retryAfter=${result?.retryAfter ?? 1}`);
    error.code = "RATE_LIMITED";
    throw error;
}

async function _getCatalogVersion() {
    const response = await withTimeout(
        getCatalogVersionElevated(),
        API_TIMEOUT_MS,
        "inventory.catalogVersion"
    );
    return String(response?.catalogVersion || "");
}

function _toTaxRate(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return null;
    const normalized = number > 1 ? number / 100 : number;
    return normalized <= 1 ? normalized : null;
}

function _isDuplicate(error) {
    const code = String(error?.code || "");
    const message = String(error?.message || "");
    return ["WDE0123", "WDE0074", "WD_ITEM_ALREADY_EXISTS", "WDE0023"].includes(code) ||
        /duplicated values|already exists|already been used/i.test(message);
}

function _isNotFound(error) {
    return String(error?.code || "") === "WDE0073" ||
        /WDE0073|item not found/i.test(String(error?.message || ""));
}

function _stockKey(productId, variantId) {
    return `${INVENTORY_CONFIG.STOCK_KEY_PREFIX}:${productId}:${variantId}`;
}

async function _acquireStockLock(stockKey, productId, traceId) {
    const digest = await hashSHA256(stockKey);
    const lockId = `INV_STOCK_${digest.slice(0, 48)}`;
    const ownerId = makeTraceId("inventory-lock");
    const deadline = Date.now() + INVENTORY_CONFIG.LOCK_WAIT_MS;

    while (true) {
        const existing = await dalGet(CONTROL_COL, lockId, "strong");
        if (existing) {
            const expiresAt = existing.expiresAt instanceof Date
                ? existing.expiresAt
                : new Date(existing.expiresAt);
            if (Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() <= Date.now()) {
                try {
                    await dalRemove(CONTROL_COL, lockId);
                    continue;
                } catch (error) {
                    if (_isNotFound(error)) continue;
                }
            }
            if (Date.now() >= deadline) {
                const error = new Error("INVENTORY_STOCK_LOCK_BUSY");
                error.code = "INVENTORY_STOCK_LOCK_BUSY";
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, INVENTORY_CONFIG.LOCK_POLL_MS));
            continue;
        }

        const now = new Date();
        const lock = {
            _id: lockId,
            controlType: CONTROL_TYPE.SLOT_LOCK,
            dedupeKey: `INVENTORY_STOCK:${stockKey}`,
            serviceId: productId,
            resourceId: productId,
            expiresAt: new Date(now.getTime() + INVENTORY_CONFIG.LOCK_TTL_MS),
            heartbeatAt: now,
            payload: {
                lockOwnerId: ownerId,
                lockStatus: "ACTIVE",
                stockKey,
                acquiredAt: now.toISOString(),
                purpose: "WIX_STORES_V1_CMS_STOCK_PROJECTION",
            },
            traceId,
            _createdDate: now,
            _updatedDate: now,
        };
        try {
            await dalInsert(CONTROL_COL, lock);
            return { id: lockId, ownerId, expiresAt: lock.expiresAt };
        } catch (error) {
            if (!_isDuplicate(error)) throw error;
            if (Date.now() >= deadline) {
                const busy = new Error("INVENTORY_STOCK_LOCK_BUSY");
                busy.code = "INVENTORY_STOCK_LOCK_BUSY";
                throw busy;
            }
        }
    }
}

async function _assertStockLock(lock) {
    const current = await dalGet(CONTROL_COL, lock.id, "strong");
    const payload = current?.payload && typeof current.payload === "object"
        ? current.payload
        : {};
    const expiresAt = current?.expiresAt instanceof Date
        ? current.expiresAt
        : new Date(current?.expiresAt);
    if (
        !current ||
        payload.lockOwnerId !== lock.ownerId ||
        !Number.isFinite(expiresAt.getTime()) ||
        expiresAt.getTime() <= Date.now()
    ) {
        throw new Error("INVENTORY_STOCK_LOCK_LOST");
    }
}

async function _releaseStockLock(lock) {
    if (!lock?.id || !lock?.ownerId) return;
    const current = await dalGet(CONTROL_COL, lock.id, "strong");
    const payload = current?.payload && typeof current.payload === "object"
        ? current.payload
        : {};
    if (!current || payload.lockOwnerId !== lock.ownerId) return;
    try {
        await dalRemove(CONTROL_COL, lock.id);
    } catch (error) {
        if (!_isNotFound(error)) {
            log.error("INVENTORY_STOCK_LOCK_RELEASE_FAILED", {
                lockId: lock.id,
                error: error?.message,
            });
        }
    }
}

async function _findStockByKey(stockKey) {
    const result = await dalQuery(STOCK_COL)
        .eq("stockKey", stockKey)
        .limit(2)
        .find(STRONG_READ);
    if (result?.items?.length > 1) {
        throw new Error("INVENTORY_STOCK_KEY_AMBIGUOUS");
    }
    return result?.items?.[0] || null;
}

async function _persistStockSnapshot(existing, stockKey, variant, lineItem, order, traceId) {
    const nativeStock = variant?.stock || {};
    const stockOnHand = Number(nativeStock.quantity);
    if (!nativeStock.trackQuantity || !Number.isSafeInteger(stockOnHand) || stockOnHand < 0) {
        return { status: "SKIPPED", reason: "WIX_VARIANT_STOCK_NOT_TRACKED" };
    }

    const taxRate = Number.isFinite(Number(existing?.tipoImpositivo))
        ? Number(existing.tipoImpositivo)
        : _toTaxRate(lineItem?.taxDetails?.taxRate);
    const taxIncluded = typeof order?.taxIncludedInPrices === "boolean"
        ? order.taxIncludedInPrices
        : existing?.taxIncluded;
    const rawPrice = variant?.price?.amount ?? variant?.price;
    const price = Number.isFinite(Number(existing?.price))
        ? Number(existing.price)
        : Number(rawPrice);
    const name = _safeTrim(existing?.name) ||
        _safeTrim(variant?.productName) ||
        _safeTrim(lineItem?.productName?.original || lineItem?.productName);
    const sku = _safeTrim(variant?.sku) || _safeTrim(existing?.sku);

    if (!name || taxRate === null || typeof taxIncluded !== "boolean" ||
        !Number.isFinite(price) || price < 0 || !sku) {
        return {
            status: "ERROR",
            reason: "INVENTORY_MASTER_REQUIRED_FIELDS_MISSING",
            missing: {
                name: !name,
                tipoImpositivo: taxRate === null,
                taxIncluded: typeof taxIncluded !== "boolean",
                price: !Number.isFinite(price) || price < 0,
                sku: !sku,
            },
        };
    }

    const stockReserved = Number.isSafeInteger(Number(existing?.stockReserved))
        ? Number(existing.stockReserved)
        : 0;
    const now = new Date();
    const snapshot = {
        ...(existing || {}),
        name,
        tipoImpositivo: taxRate,
        taxIncluded,
        price,
        sku,
        stockOnHand,
        stockReserved,
        stockAvailable: stockOnHand - stockReserved,
        catalogVersion: INVENTORY_CONFIG.CATALOG_VERSION,
        stockKey,
        productId: lineItem.catalogReference.catalogItemId,
        variantId: lineItem.catalogReference.options.variantId,
        wixProductId: lineItem.catalogReference.catalogItemId,
        wixVariantId: lineItem.catalogReference.options.variantId,
        needsWixReconciliation: false,
        lastSyncAt: now,
        traceId,
        _updatedDate: now,
    };

    if (existing) {
        await dalUpdate(STOCK_COL, snapshot);
        return { status: "SUCCESS", data: { ...snapshot, _id: existing._id } };
    }

    try {
        const saved = await dalInsert(STOCK_COL, {
            ...snapshot,
            stockReserved: 0,
            stockAvailable: stockOnHand,
            _createdDate: now,
        });
        return { status: "SUCCESS", data: saved };
    } catch (error) {
        if (!_isDuplicate(error)) throw error;
        const raced = await _findStockByKey(stockKey);
        if (!raced) throw error;
        const updated = { ...raced, ...snapshot, _id: raced._id };
        await dalUpdate(STOCK_COL, updated);
        return { status: "SUCCESS", data: updated };
    }
}

async function _syncPaidOrderLine(order, lineItem, traceId, eventId) {
    const validation = validateInventoryOrderLine(order?._id || order?.id, lineItem);
    if (!validation.valid) {
        return { status: "ERROR", code: "INVENTORY_ORDER_LINE_INVALID", errors: validation.errors };
    }
    const { orderId, lineItemId, productId, variantId, quantity } = validation.value;
    const stockKey = _stockKey(productId, variantId);
    const lock = await _acquireStockLock(stockKey, productId, traceId);

    try {
        const catalogVersion = await _getCatalogVersion();
        if (catalogVersion !== INVENTORY_CONFIG.CATALOG_VERSION) {
            return {
                status: "ERROR",
                code: "INVENTORY_CATALOG_VERSION_MISMATCH",
                expected: INVENTORY_CONFIG.CATALOG_VERSION,
                actual: catalogVersion,
            };
        }

        const storeVariantId = `${productId}-${variantId}`;
        const response = await withTimeout(
            getStoreVariantElevated(storeVariantId),
            API_TIMEOUT_MS,
            "inventory.getStoreVariant"
        );
        const variant = response?.variant || null;
        if (!variant || variant.productId !== productId || variant.variantId !== variantId) {
            return { status: "ERROR", code: "WIX_STORE_VARIANT_NOT_FOUND" };
        }

        const existing = await _findStockByKey(stockKey);
        const snapshotResult = await _persistStockSnapshot(
            existing,
            stockKey,
            variant,
            lineItem,
            order,
            traceId
        );
        if (snapshotResult.status !== "SUCCESS") return snapshotResult;

        const movementDigest = await hashSHA256(`SALE|${orderId}|${lineItemId}`);
        const movementToken = `SALE_${movementDigest}`;
        const priorMovement = await dalQuery(MOVEMENTS_COL)
            .eq("movementToken", movementToken)
            .limit(1)
            .find(STRONG_READ);

        if (!priorMovement?.items?.length) {
            await _assertStockLock(lock);
            const now = new Date();
            const stockRow = snapshotResult.data;
            const movement = {
                recordTimestamp: now,
                movementToken,
                movementType: INVENTORY_CONFIG.MOVEMENT_TYPE_SALE,
                sku: stockRow.sku,
                quantityDelta: -quantity,
                traceId,
                orderId,
                lineItemId,
                productId,
                variantId,
                stockKey,
                catalogVersion: INVENTORY_CONFIG.CATALOG_VERSION,
                catalogId: stockRow._id,
                productName: stockRow.name,
                magnitude: -1,
                direction: "SALIDA",
                quantity,
                nativeCommercialMovement: true,
                stockApplied: true,
                requiresWixReconciliation: false,
                sourceEventId: _safeTrim(eventId) || null,
                referenceId: orderId,
                reason: "WIX_ORDER_PAID",
                stockAfter: stockRow.stockOnHand,
                _createdDate: now,
            };
            try {
                await dalInsert(MOVEMENTS_COL, movement);
            } catch (error) {
                if (!_isDuplicate(error)) throw error;
                const confirmed = await dalQuery(MOVEMENTS_COL)
                    .eq("movementToken", movementToken)
                    .limit(1)
                    .find(STRONG_READ);
                if (!confirmed?.items?.length) throw error;
            }
        }

        return {
            status: "SUCCESS",
            data: {
                stockKey,
                movementToken,
                stockOnHand: snapshotResult.data.stockOnHand,
                idempotent: Boolean(priorMovement?.items?.length),
            },
        };
    } finally {
        await _releaseStockLock(lock);
    }
}

/**
 * Internal event entry point. Called only after Wix reports the order as paid.
 * Native Wix checkout has already applied the stock movement; this function
 * only reads the current native quantity and mirrors it into CMS.
 */
export async function syncPaidOrderInventoryInternal(order, traceId, eventId) {
    if (!order || typeof order !== "object") {
        return _error("INVENTORY_ORDER_INVALID", "Pedido nativo no valido.");
    }
    const orderId = _safeTrim(order._id || order.id);
    if (!isValidGuid(orderId)) {
        return _error("INVENTORY_ORDER_ID_INVALID", "El pedido no contiene un ID GUID valido.");
    }
    const lineItems = Array.isArray(order.lineItems) ? order.lineItems : [];
    if (lineItems.length > INVENTORY_CONFIG.MAX_ORDER_LINES) {
        return _error("INVENTORY_ORDER_LINES_LIMIT", "El pedido supera el maximo de lineas admitido.");
    }
    const storeLines = lineItems.filter((line) =>
        line?.catalogReference?.appId === WIX_CATALOG_APP_IDS.STORES
    );
    if (!storeLines.length) {
        return { status: "SUCCESS", data: { processed: 0, skipped: 0, results: [] }, error: null };
    }

    const results = [];
    for (const lineItem of storeLines) {
        const result = await _syncPaidOrderLine(order, lineItem, traceId, eventId);
        results.push({
            lineItemId: lineItem?._id || lineItem?.id || null,
            ...result,
        });
    }
    const failed = results.filter((result) => result.status === "ERROR");
    const skipped = results.filter((result) => result.status === "SKIPPED");
    if (failed.length) {
        return {
            status: "PARTIAL",
            data: { processed: results.length - failed.length - skipped.length, skipped: skipped.length, results },
            error: {
                code: "INVENTORY_ORDER_SYNC_PARTIAL",
                message: "Una o mas lineas de tienda requieren reintento o conciliacion.",
                failed,
            },
        };
    }
    return {
        status: "SUCCESS",
        data: { processed: results.length - skipped.length, skipped: skipped.length, results },
        error: null,
    };
}

export const getInventoryDashboard = webMethod(Permissions.SiteMember, async (options = {}) => {
    const traceId = _safeTrim(options?.traceId) || makeTraceId("inventory-dashboard");
    try {
        await _rateLimitOrThrow("inventario.getDashboard", "staff");
        await requireCajero(traceId);
        const catalogVersion = await _getCatalogVersion();
        if (catalogVersion !== INVENTORY_CONFIG.CATALOG_VERSION) {
            return _error("INVENTORY_CATALOG_VERSION_MISMATCH", "El modulo esta preparado para Wix Stores Catalog V1.", {
                expected: INVENTORY_CONFIG.CATALOG_VERSION,
                actual: catalogVersion,
            });
        }
        const limit = Math.min(
            INVENTORY_CONFIG.PAGE_LIMIT,
            Math.max(1, Math.floor(Number(options?.limit) || INVENTORY_CONFIG.PAGE_LIMIT))
        );
        const offset = Math.min(10000, Math.max(0, Math.floor(Number(options?.offset) || 0)));
        const result = await dalQuery(STOCK_COL)
            .ascending("sku")
            .limit(limit)
            .skip(offset)
            .find(STRONG_READ);
        return {
            status: "SUCCESS",
            data: {
                items: result.items || [],
                totalCount: result.totalCount || 0,
                hasNext: Boolean(result.hasNext?.()),
                nextOffset: offset + (result.items || []).length,
                catalogVersion,
                observedAt: new Date(),
            },
            error: null,
        };
    } catch (error) {
        log.error("getInventoryDashboard failed", { traceId, error: error?.message });
        return _error(error?.code || "INVENTORY_DASHBOARD_FAILED", error?.message || "No se pudo leer el inventario.");
    }
});

export const getInventoryMovementHistory = webMethod(Permissions.SiteMember, async (stockKey, options = {}) => {
    const traceId = _safeTrim(options?.traceId) || makeTraceId("inventory-history");
    try {
        await _rateLimitOrThrow("inventario.getMovementHistory", "staff");
        await requireCajero(traceId);
        const key = _safeTrim(stockKey);
        if (!key || key.length > 200) {
            return _error("INVENTORY_STOCK_KEY_INVALID", "stockKey no valido.");
        }
        const limit = Math.min(
            INVENTORY_CONFIG.PAGE_LIMIT,
            Math.max(1, Math.floor(Number(options?.limit) || INVENTORY_CONFIG.PAGE_LIMIT))
        );
        const offset = Math.min(10000, Math.max(0, Math.floor(Number(options?.offset) || 0)));
        const result = await dalQuery(MOVEMENTS_COL)
            .eq("stockKey", key)
            .descending("recordTimestamp")
            .limit(limit)
            .skip(offset)
            .find(STRONG_READ);
        return {
            status: "SUCCESS",
            data: {
                items: result.items || [],
                totalCount: result.totalCount || 0,
                hasNext: Boolean(result.hasNext?.()),
                nextOffset: offset + (result.items || []).length,
            },
            error: null,
        };
    } catch (error) {
        log.error("getInventoryMovementHistory failed", { traceId, error: error?.message });
        return _error(error?.code || "INVENTORY_HISTORY_FAILED", error?.message || "No se pudo leer el historial de inventario.");
    }
});
