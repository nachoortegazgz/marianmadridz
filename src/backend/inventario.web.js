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
import { catalogVersioning, inventory, products } from "@wix/stores";

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

import { requireCajero, requireAdmin, rateLimiter } from "backend/security";
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
const queryProductVariantsElevated = auth.elevate(products.queryProductVariants);
const queryStoreVariantsElevated = auth.elevate(products.queryStoreVariants);
const incrementInventoryElevated = auth.elevate(inventory.incrementInventory);
const decrementInventoryElevated = auth.elevate(inventory.decrementInventory);

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
    const percentage = number > 1 ? number : number * 100;
    return percentage <= 100 ? percentage : null;
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

async function _inventoryClaimId(prefix, orderId, lineItemId) {
    const digest = await hashSHA256(`${prefix}|${orderId}|${lineItemId}`);
    return `INV_${prefix}_${digest.slice(0, 48)}`;
}

async function _updateInventoryClaim(claim, status, payloadPatch = {}) {
    const payload = {
        ...(claim?.payload && typeof claim.payload === "object" ? claim.payload : {}),
        ...payloadPatch,
        updatedAt: new Date().toISOString(),
    };
    return dalUpdate(CONTROL_COL, {
        ...claim,
        status,
        payload,
        _updatedDate: new Date(),
    });
}

async function _queueInventoryRepair(order, lineItem, traceId, eventId, operation, reason) {
    const orderId = _safeTrim(order?._id || order?.id);
    const lineItemId = _safeTrim(lineItem?._id || lineItem?.id);
    const digest = await hashSHA256(`REPAIR|${operation}|${orderId}|${lineItemId}`);
    const repairId = `INV_REPAIR_${digest.slice(0, 48)}`;
    const existing = await dalGet(CONTROL_COL, repairId, "strong");
    if (existing) return { queued: true, repairId, duplicate: true };

    const now = new Date();
    const safeLineItem = {
        _id: lineItemId,
        quantity: Number(lineItem?.quantity),
        catalogReference: lineItem?.catalogReference || null,
        productName: lineItem?.productName || null,
        taxDetails: lineItem?.taxDetails || null,
    };
    const record = {
        _id: repairId,
        controlType: CONTROL_TYPE.SYSTEM_FLAG,
        dedupeKey: `INVENTORY_REPAIR:${operation}:${orderId}:${lineItemId}`,
        status: "PENDING",
        alertType: "INVENTORY_SYNC_REPAIR_REQUIRED",
        severity: "ERROR",
        message: "Una linea de inventario requiere conciliacion.",
        payload: {
            operation,
            orderId,
            lineItem: safeLineItem,
            taxIncludedInPrices: typeof order?.taxIncludedInPrices === "boolean"
                ? order.taxIncludedInPrices
                : null,
            eventId: _safeTrim(eventId) || null,
            reason: String(reason || "UNKNOWN"),
            attempts: 0,
            queuedAt: now.toISOString(),
        },
        traceId,
        _createdDate: now,
        _updatedDate: now,
    };
    try {
        await dalInsert(CONTROL_COL, record);
        return { queued: true, repairId, duplicate: false };
    } catch (error) {
        if (!_isDuplicate(error)) throw error;
        const confirmed = await dalGet(CONTROL_COL, repairId, "strong");
        return { queued: Boolean(confirmed), repairId, duplicate: true };
    }
}

async function _reserveOrderLine(order, lineItem, traceId, eventId) {
    const validation = validateInventoryOrderLine(order?._id || order?.id, lineItem);
    if (!validation.valid) {
        return { status: "ERROR", code: "INVENTORY_ORDER_LINE_INVALID", errors: validation.errors };
    }
    const { orderId, lineItemId, productId, variantId, quantity } = validation.value;
    const stockKey = _stockKey(productId, variantId);
    const lock = await _acquireStockLock(stockKey, productId, traceId);
    try {
        const stock = await _findStockByKey(stockKey);
        if (!stock) return { status: "ERROR", code: "INVENTORY_MASTER_MAPPING_REQUIRED", stockKey };

        const claimId = await _inventoryClaimId("RESERVE", orderId, lineItemId);
        let claim = await dalGet(CONTROL_COL, claimId, "strong");
        if (claim?.status === "COMPLETED" || claim?.status === "RELEASED") {
            return { status: "SUCCESS", data: { stockKey, idempotent: true, reservationStatus: claim.status } };
        }
        if (claim?.status === "REPAIR_REQUIRED") {
            return { status: "ERROR", code: "INVENTORY_RESERVATION_REPAIR_REQUIRED", stockKey };
        }

        const currentReserved = Number(stock.stockReserved);
        if (!Number.isSafeInteger(currentReserved) || currentReserved < 0) {
            return { status: "ERROR", code: "INVENTORY_RESERVED_STOCK_INVALID", stockKey };
        }
        let before = currentReserved;
        let after = currentReserved + quantity;
        if (claim?.status === "PENDING") {
            before = Number(claim.payload?.stockReservedBefore);
            after = Number(claim.payload?.stockReservedAfter);
            if (currentReserved === after) {
                await _updateInventoryClaim(claim, "COMPLETED", { recoveredAfterSnapshotWrite: true });
                return { status: "SUCCESS", data: { stockKey, idempotent: true, reservationStatus: "COMPLETED" } };
            }
            if (currentReserved !== before) {
                await _updateInventoryClaim(claim, "REPAIR_REQUIRED", { observedStockReserved: currentReserved });
                return { status: "ERROR", code: "INVENTORY_RESERVATION_STATE_AMBIGUOUS", stockKey };
            }
        } else {
            if (after > Number(stock.stockOnHand)) {
                return { status: "ERROR", code: "INVENTORY_RESERVATION_EXCEEDS_ON_HAND", stockKey };
            }
            const now = new Date();
            claim = await dalInsert(CONTROL_COL, {
                _id: claimId,
                controlType: CONTROL_TYPE.DEDUPE_KEY,
                dedupeKey: `INVENTORY_RESERVE:${orderId}:${lineItemId}`,
                status: "PENDING",
                payload: {
                    operation: "RESERVE",
                    orderId,
                    lineItemId,
                    stockKey,
                    quantity,
                    stockReservedBefore: before,
                    stockReservedAfter: after,
                    eventId: _safeTrim(eventId) || null,
                },
                traceId,
                _createdDate: now,
                _updatedDate: now,
            });
        }

        await _assertStockLock(lock);
        await dalUpdate(STOCK_COL, {
            ...stock,
            stockReserved: after,
            stockAvailable: Number(stock.stockOnHand) - after,
            traceId,
            _updatedDate: new Date(),
        });
        await _updateInventoryClaim(claim, "COMPLETED", { completedAt: new Date().toISOString() });
        return { status: "SUCCESS", data: { stockKey, stockReserved: after, idempotent: false } };
    } finally {
        await _releaseStockLock(lock);
    }
}

async function _releaseOrderReservationUnderLock(stock, orderId, lineItemId, quantity, traceId) {
    const reserveClaimId = await _inventoryClaimId("RESERVE", orderId, lineItemId);
    let reserveClaim = await dalGet(CONTROL_COL, reserveClaimId, "strong");
    if (!reserveClaim) return { status: "SUCCESS", data: { released: false, reason: "NO_RESERVATION" } };
    if (reserveClaim.status === "RELEASED") return { status: "SUCCESS", data: { released: false, idempotent: true } };
    if (reserveClaim.status === "REPAIR_REQUIRED") return { status: "ERROR", code: "INVENTORY_RESERVATION_REPAIR_REQUIRED" };

    let currentReserved = Number(stock.stockReserved);
    const reservedBefore = Number(reserveClaim.payload?.stockReservedBefore);
    const reservedAfter = Number(reserveClaim.payload?.stockReservedAfter);
    if (reserveClaim.status === "PENDING") {
        if (currentReserved === reservedBefore) {
            await _updateInventoryClaim(reserveClaim, "RELEASED", { releasedWithoutAppliedReservation: true });
            return { status: "SUCCESS", data: { released: false, idempotent: true } };
        }
        if (currentReserved !== reservedAfter) {
            await _updateInventoryClaim(reserveClaim, "REPAIR_REQUIRED", { observedStockReserved: currentReserved });
            return { status: "ERROR", code: "INVENTORY_RESERVATION_STATE_AMBIGUOUS" };
        }
        reserveClaim = await _updateInventoryClaim(reserveClaim, "COMPLETED", { recoveredAfterSnapshotWrite: true });
    }
    if (reserveClaim.status !== "COMPLETED") {
        return { status: "ERROR", code: "INVENTORY_RESERVATION_STATE_INVALID" };
    }

    const releaseClaimId = await _inventoryClaimId("RELEASE", orderId, lineItemId);
    let releaseClaim = await dalGet(CONTROL_COL, releaseClaimId, "strong");
    if (releaseClaim?.status === "COMPLETED") {
        await _updateInventoryClaim(reserveClaim, "RELEASED", { releasedAt: new Date().toISOString() });
        return { status: "SUCCESS", data: { released: true, idempotent: true } };
    }
    if (releaseClaim?.status === "REPAIR_REQUIRED") {
        return { status: "ERROR", code: "INVENTORY_RESERVATION_RELEASE_REPAIR_REQUIRED" };
    }

    const after = Math.max(0, currentReserved - quantity);
    if (currentReserved < quantity) {
        await _updateInventoryClaim(reserveClaim, "REPAIR_REQUIRED", { observedStockReserved: currentReserved });
        return { status: "ERROR", code: "INVENTORY_RESERVATION_UNDERFLOW" };
    }
    if (!releaseClaim) {
        const now = new Date();
        releaseClaim = await dalInsert(CONTROL_COL, {
            _id: releaseClaimId,
            controlType: CONTROL_TYPE.DEDUPE_KEY,
            dedupeKey: `INVENTORY_RELEASE:${orderId}:${lineItemId}`,
            status: "PENDING",
            payload: {
                operation: "RELEASE",
                orderId,
                lineItemId,
                stockKey: stock.stockKey,
                quantity,
                stockReservedBefore: currentReserved,
                stockReservedAfter: after,
            },
            traceId,
            _createdDate: now,
            _updatedDate: now,
        });
    } else if (releaseClaim.status === "PENDING") {
        const before = Number(releaseClaim.payload?.stockReservedBefore);
        const expected = Number(releaseClaim.payload?.stockReservedAfter);
        if (currentReserved === expected) {
            await _updateInventoryClaim(releaseClaim, "COMPLETED", { recoveredAfterSnapshotWrite: true });
            await _updateInventoryClaim(reserveClaim, "RELEASED", { releasedAt: new Date().toISOString() });
            return { status: "SUCCESS", data: { released: true, idempotent: true } };
        }
        if (currentReserved !== before) {
            await _updateInventoryClaim(releaseClaim, "REPAIR_REQUIRED", { observedStockReserved: currentReserved });
            return { status: "ERROR", code: "INVENTORY_RESERVATION_RELEASE_AMBIGUOUS" };
        }
    }

    await dalUpdate(STOCK_COL, {
        ...stock,
        stockReserved: after,
        stockAvailable: Number(stock.stockOnHand) - after,
        traceId,
        _updatedDate: new Date(),
    });
    await _updateInventoryClaim(releaseClaim, "COMPLETED", { completedAt: new Date().toISOString() });
    await _updateInventoryClaim(reserveClaim, "RELEASED", { releasedAt: new Date().toISOString() });
    return { status: "SUCCESS", data: { released: true, stockReserved: after } };
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

        let existing = await _findStockByKey(stockKey);
        if (!existing) {
            return { status: "ERROR", code: "INVENTORY_MASTER_MAPPING_REQUIRED", stockKey };
        }
        const reservationRelease = await _releaseOrderReservationUnderLock(
            existing,
            orderId,
            lineItemId,
            quantity,
            traceId
        );
        if (reservationRelease.status !== "SUCCESS") return reservationRelease;
        existing = await _findStockByKey(stockKey);
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
    const orderId = _safeTrim(order._id || order.id);
    if (!isValidGuid(orderId)) {
        return _error("INVENTORY_ORDER_ID_INVALID", "El pedido de tienda no contiene un ID GUID valido.");
    }
    const catalogVersion = await _getCatalogVersion();
    if (catalogVersion !== INVENTORY_CONFIG.CATALOG_VERSION) {
        return _error("INVENTORY_CATALOG_VERSION_MISMATCH", "El catalogo nativo no es V1.");
    }

    const results = [];
    for (const lineItem of storeLines) {
        let result = await _syncPaidOrderLine(order, lineItem, traceId, eventId);
        if (result.status === "ERROR") {
            const repair = await _queueInventoryRepair(
                order, lineItem, traceId, eventId, "SALE", result.code || result.reason
            ).catch((error) => ({ queued: false, error: error?.message }));
            result = { ...result, repairQueued: repair.queued === true, repairId: repair.repairId || null };
        }
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
                message: "Una o mas lineas de tienda requieren conciliacion.",
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

export async function reserveOrderInventoryInternal(order, traceId, eventId) {
    const lineItems = Array.isArray(order?.lineItems) ? order.lineItems : [];
    const storeLines = lineItems.filter((line) =>
        line?.catalogReference?.appId === WIX_CATALOG_APP_IDS.STORES
    );
    if (!storeLines.length) {
        return { status: "SUCCESS", data: { reserved: 0, results: [] }, error: null };
    }
    const orderId = _safeTrim(order?._id || order?.id);
    if (!isValidGuid(orderId)) return _error("INVENTORY_ORDER_ID_INVALID", "Pedido no valido.");
    const results = [];
    for (const lineItem of storeLines) {
        let result = await _reserveOrderLine(order, lineItem, traceId, eventId);
        if (result.status === "ERROR") {
            const repair = await _queueInventoryRepair(
                order, lineItem, traceId, eventId, "RESERVE", result.code || result.reason
            ).catch((error) => ({ queued: false, error: error?.message }));
            result = { ...result, repairQueued: repair.queued === true, repairId: repair.repairId || null };
        }
        results.push({ lineItemId: lineItem?._id || lineItem?.id || null, ...result });
    }
    const failed = results.filter((result) => result.status === "ERROR");
    return {
        status: failed.length ? "PARTIAL" : "SUCCESS",
        data: { reserved: results.filter((result) => result.status === "SUCCESS").length, results },
        error: failed.length ? { code: "INVENTORY_RESERVATION_PARTIAL", failed } : null,
    };
}

export async function releaseOrderInventoryInternal(order, traceId, eventId) {
    const lineItems = Array.isArray(order?.lineItems) ? order.lineItems : [];
    const storeLines = lineItems.filter((line) =>
        line?.catalogReference?.appId === WIX_CATALOG_APP_IDS.STORES
    );
    if (!storeLines.length) {
        return { status: "SUCCESS", data: { released: 0, results: [] }, error: null };
    }
    const orderId = _safeTrim(order?._id || order?.id);
    if (!isValidGuid(orderId)) return _error("INVENTORY_ORDER_ID_INVALID", "Pedido no valido.");
    const results = [];
    for (const lineItem of storeLines) {
        const validation = validateInventoryOrderLine(orderId, lineItem);
        if (!validation.valid) {
            results.push({ status: "ERROR", code: "INVENTORY_ORDER_LINE_INVALID", errors: validation.errors });
            continue;
        }
        const { lineItemId, productId, variantId, quantity } = validation.value;
        const stockKey = _stockKey(productId, variantId);
        const lock = await _acquireStockLock(stockKey, productId, traceId);
        try {
            const stock = await _findStockByKey(stockKey);
            if (!stock) {
                results.push({ status: "ERROR", code: "INVENTORY_MASTER_MAPPING_REQUIRED", stockKey });
                continue;
            }
            let result = await _releaseOrderReservationUnderLock(
                stock, orderId, lineItemId, quantity, traceId
            );
            if (result.status === "ERROR") {
                const repair = await _queueInventoryRepair(
                    order, lineItem, traceId, eventId, "RELEASE", result.code || result.reason
                ).catch((error) => ({ queued: false, error: error?.message }));
                result = { ...result, repairQueued: repair.queued === true, repairId: repair.repairId || null };
            }
            results.push(result);
        } finally {
            await _releaseStockLock(lock);
        }
    }
    const failed = results.filter((result) => result.status === "ERROR");
    return {
        status: failed.length ? "PARTIAL" : "SUCCESS",
        data: { released: results.filter((result) => result.status === "SUCCESS").length, results },
        error: failed.length ? { code: "INVENTORY_RESERVATION_RELEASE_PARTIAL", failed } : null,
    };
}


async function _queueRefundInventoryRepair(orderId, refundId, lineItemId, quantity, traceId, eventId, reason) {
    const digest = await hashSHA256(`REFUND_REPAIR|${orderId}|${refundId}|${lineItemId}`);
    const repairId = `INV_REFUND_REPAIR_${digest.slice(0, 40)}`;
    const existing = await dalGet(CONTROL_COL, repairId, "strong");
    if (existing) return { queued: true, repairId, duplicate: true };
    const now = new Date();
    try {
        await dalInsert(CONTROL_COL, {
            _id: repairId,
            controlType: CONTROL_TYPE.SYSTEM_FLAG,
            dedupeKey: `INVENTORY_REFUND_REPAIR:${orderId}:${refundId}:${lineItemId}`,
            status: "PENDING",
            alertType: "INVENTORY_REFUND_REPAIR_REQUIRED",
            severity: "ERROR",
            message: "Una devolucion con restock nativo requiere conciliacion de inventario.",
            payload: {
                orderId,
                refundId,
                lineItemId,
                quantity,
                eventId: _safeTrim(eventId) || null,
                reason: String(reason || "UNKNOWN"),
                queuedAt: now.toISOString(),
                attempts: 0,
            },
            traceId,
            _createdDate: now,
            _updatedDate: now,
        });
        return { queued: true, repairId, duplicate: false };
    } catch (error) {
        if (!_isDuplicate(error)) throw error;
        return { queued: Boolean(await dalGet(CONTROL_COL, repairId, "strong")), repairId, duplicate: true };
    }
}

async function _syncRestockedOrderLine(orderId, refundId, restockLine, reason, traceId, eventId) {
    const lineItemId = _safeTrim(restockLine?.lineItemId || restockLine?._id || restockLine?.id);
    const quantity = Number(restockLine?.quantity ?? restockLine?.restockQuantity);
    if (!isValidGuid(orderId) || !lineItemId || !Number.isSafeInteger(quantity) || quantity <= 0) {
        return { status: "ERROR", code: "INVENTORY_RESTOCK_LINE_INVALID" };
    }

    const saleRes = await dalQuery(MOVEMENTS_COL)
        .eq("orderId", orderId)
        .eq("lineItemId", lineItemId)
        .eq("movementType", INVENTORY_CONFIG.MOVEMENT_TYPE_SALE)
        .limit(2)
        .find(STRONG_READ);
    if (saleRes?.items?.length !== 1) {
        return { status: "ERROR", code: saleRes?.items?.length > 1
            ? "INVENTORY_SALE_MOVEMENT_AMBIGUOUS"
            : "INVENTORY_SALE_MOVEMENT_MISSING" };
    }

    const sale = saleRes.items[0];
    const productId = _safeTrim(sale.productId);
    const variantId = _safeTrim(sale.variantId);
    const stockKey = _safeTrim(sale.stockKey);
    if (!isValidGuid(productId) || !isValidGuid(variantId) || !stockKey) {
        return { status: "ERROR", code: "INVENTORY_SALE_IDENTITY_INCOMPLETE" };
    }

    const lock = await _acquireStockLock(stockKey, productId, traceId);
    try {
        const movementDigest = await hashSHA256(`REFUND|${refundId}|${lineItemId}`);
        const movementToken = `REFUND_${movementDigest}`;
        const existingMovement = await dalQuery(MOVEMENTS_COL)
            .eq("movementToken", movementToken)
            .limit(1)
            .find(STRONG_READ);
        const response = await withTimeout(
            getStoreVariantElevated(`${productId}-${variantId}`),
            API_TIMEOUT_MS,
            "inventory.getStoreVariant.refund"
        );
        const variant = response?.variant;
        const nativeQuantity = Number(variant?.stock?.quantity);
        if (
            !variant ||
            variant.productId !== productId ||
            variant.variantId !== variantId ||
            !variant.stock?.trackQuantity ||
            !Number.isSafeInteger(nativeQuantity) ||
            nativeQuantity < 0
        ) {
            return { status: "ERROR", code: "INVENTORY_REFUND_NATIVE_STOCK_UNAVAILABLE" };
        }

        const stock = await _findStockByKey(stockKey);
        if (!stock) return { status: "ERROR", code: "INVENTORY_MASTER_MAPPING_REQUIRED", stockKey };
        await _assertStockLock(lock);
        const now = new Date();
        const updatedStock = {
            ...stock,
            stockOnHand: nativeQuantity,
            stockAvailable: nativeQuantity - Number(stock.stockReserved || 0),
            lastSyncAt: now,
            traceId,
            needsWixReconciliation: false,
            _updatedDate: now,
        };
        await dalUpdate(STOCK_COL, updatedStock);

        if (!existingMovement?.items?.length) {
            await _assertStockLock(lock);
            const movement = {
                recordTimestamp: now,
                movementToken,
                movementType: INVENTORY_CONFIG.MOVEMENT_TYPE_RETURN,
                sku: stock.sku,
                quantityDelta: quantity,
                traceId,
                orderId,
                refundId,
                lineItemId,
                productId,
                variantId,
                stockKey,
                catalogVersion: INVENTORY_CONFIG.CATALOG_VERSION,
                catalogId: stock._id,
                productName: stock.name,
                magnitude: 1,
                direction: "ENTRADA",
                quantity,
                nativeCommercialMovement: true,
                stockApplied: true,
                requiresWixReconciliation: false,
                sourceEventId: _safeTrim(eventId) || null,
                referenceId: refundId,
                reason: _safeTrim(reason) || "WIX_REFUND_RESTOCK",
                stockBefore: Number(stock.stockOnHand),
                stockAfter: nativeQuantity,
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
                stockOnHand: nativeQuantity,
                idempotent: Boolean(existingMovement?.items?.length),
            },
        };
    } finally {
        await _releaseStockLock(lock);
    }
}

export async function syncRestockedOrderInventoryInternal(orderId, refundId, restockLines, reason, traceId, eventId) {
    if (!Array.isArray(restockLines) || !restockLines.length) {
        return { status: "SUCCESS", data: { processed: 0, results: [] }, error: null };
    }
    const results = [];
    for (const line of restockLines) {
        let result = await _syncRestockedOrderLine(orderId, refundId, line, reason, traceId, eventId);
        if (result.status === "ERROR") {
            const repair = await _queueRefundInventoryRepair(
                orderId, refundId, line?.lineItemId || line?._id || line?.id,
                Number(line?.quantity ?? line?.restockQuantity),
                traceId, eventId, result.code
            ).catch((error) => ({ queued: false, error: error?.message }));
            result = { ...result, repairQueued: repair.queued === true, repairId: repair.repairId || null };
        }
        results.push({ lineItemId: line?.lineItemId || line?._id || line?.id || null, ...result });
    }
    const failed = results.filter((result) => result.status === "ERROR");
    return {
        status: failed.length ? "PARTIAL" : "SUCCESS",
        data: { processed: results.length - failed.length, results },
        error: failed.length ? { code: "INVENTORY_RESTOCK_PARTIAL", failed } : null,
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


async function _completeManualInventoryMovement(journal, traceId) {
    const payload = journal?.payload && typeof journal.payload === "object" ? journal.payload : {};
    const {
        movementToken,
        stockKey,
        productId,
        variantId,
        movementType,
        quantityDelta,
        stockBefore,
        reason,
        referenceId,
    } = payload;
    const existingMovement = await dalQuery(MOVEMENTS_COL)
        .eq("movementToken", movementToken)
        .limit(1)
        .find(STRONG_READ);
    const response = await withTimeout(
        getStoreVariantElevated(`${productId}-${variantId}`),
        API_TIMEOUT_MS,
        "inventory.getStoreVariant.manual-reconcile"
    );
    const variant = response?.variant;
    const stockOnHand = Number(variant?.stock?.quantity);
    if (
        !variant ||
        variant.productId !== productId ||
        variant.variantId !== variantId ||
        !variant.stock?.trackQuantity ||
        !Number.isSafeInteger(stockOnHand) ||
        stockOnHand < 0
    ) {
        await _updateInventoryClaim(journal, "REPAIR_REQUIRED", { completionError: "NATIVE_STOCK_UNAVAILABLE" });
        return { status: "ERROR", code: "INVENTORY_NATIVE_STOCK_UNAVAILABLE" };
    }

    const stock = await _findStockByKey(stockKey);
    if (!stock) {
        await _updateInventoryClaim(journal, "REPAIR_REQUIRED", { completionError: "MASTER_MAPPING_MISSING" });
        return { status: "ERROR", code: "INVENTORY_MASTER_MAPPING_REQUIRED" };
    }
    const stockReserved = Number(stock.stockReserved || 0);
    if (stockOnHand < stockReserved) {
        await _updateInventoryClaim(journal, "REPAIR_REQUIRED", {
            completionError: "NATIVE_STOCK_BELOW_RESERVATIONS",
            observedStockOnHand: stockOnHand,
            observedStockReserved: stockReserved,
        });
        return { status: "ERROR", code: "INVENTORY_STOCK_BELOW_RESERVATIONS" };
    }

    const now = new Date();
    const updatedStock = {
        ...stock,
        stockOnHand,
        stockAvailable: stockOnHand - stockReserved,
        lastSyncAt: now,
        traceId,
        needsWixReconciliation: false,
        _updatedDate: now,
    };
    await dalUpdate(STOCK_COL, updatedStock);

    if (!existingMovement?.items?.length) {
        const movement = {
            recordTimestamp: now,
            movementToken,
            movementType,
            sku: stock.sku,
            quantityDelta,
            traceId,
            stockBefore,
            stockAfter: stockOnHand,
            reason,
            referenceId: referenceId || null,
            productId,
            variantId,
            stockKey,
            catalogVersion: INVENTORY_CONFIG.CATALOG_VERSION,
            catalogId: stock._id,
            productName: stock.name,
            magnitude: quantityDelta > 0 ? 1 : -1,
            direction: quantityDelta > 0 ? "ENTRADA" : "SALIDA",
            quantity: Math.abs(quantityDelta),
            nativeCommercialMovement: false,
            stockApplied: true,
            requiresWixReconciliation: false,
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

    await _updateInventoryClaim(journal, "COMPLETED", {
        completedAt: new Date().toISOString(),
        nativeStockAfter: stockOnHand,
        ledgerMovementToken: movementToken,
    });
    return {
        status: "SUCCESS",
        data: { movementToken, stockKey, stockOnHand, idempotent: Boolean(existingMovement?.items?.length) },
    };
}

export const registerInventoryMovement = webMethod(Permissions.SiteMember, async (input = {}) => {
    const traceId = _safeTrim(input?.traceId) || makeTraceId("inventory-movement");
    let lock = null;
    try {
        const movementType = _safeTrim(input?.movementType).toUpperCase();
        const movementToken = _safeTrim(input?.movementToken);
        const stockKey = _safeTrim(input?.stockKey);
        const quantityDelta = Number(input?.quantityDelta);
        const reason = _safeTrim(input?.reason);
        const referenceId = _safeTrim(input?.referenceId);
        if (![INVENTORY_CONFIG.MOVEMENT_TYPE_RECEIPT, INVENTORY_CONFIG.MOVEMENT_TYPE_ISSUE, INVENTORY_CONFIG.MOVEMENT_TYPE_ADJUSTMENT].includes(movementType)) {
            return _error("INVENTORY_MOVEMENT_TYPE_INVALID", "Tipo de movimiento manual no permitido.");
        }
        if (
            movementToken.length < INVENTORY_CONFIG.MOVEMENT_TOKEN_MIN_LENGTH ||
            movementToken.length > INVENTORY_CONFIG.MOVEMENT_TOKEN_MAX_LENGTH
        ) {
            return _error("INVENTORY_MOVEMENT_TOKEN_INVALID", "movementToken estable obligatorio (8-128 caracteres).");
        }
        if (!stockKey || stockKey.length > 200 || !Number.isSafeInteger(quantityDelta) || quantityDelta === 0) {
            return _error("INVENTORY_MOVEMENT_INPUT_INVALID", "stockKey y quantityDelta entero distinto de cero son obligatorios.");
        }
        if (!reason || reason.length < 3 || reason.length > 500) {
            return _error("INVENTORY_MOVEMENT_REASON_REQUIRED", "reason es obligatorio y debe tener entre 3 y 500 caracteres.");
        }
        if (movementType === INVENTORY_CONFIG.MOVEMENT_TYPE_RECEIPT && (quantityDelta <= 0 || !referenceId)) {
            return _error("INVENTORY_RECEIPT_REFERENCE_REQUIRED", "ENTRADA_STOCK exige cantidad positiva y referencia de factura de proveedor.");
        }
        if (movementType === INVENTORY_CONFIG.MOVEMENT_TYPE_ISSUE && quantityDelta >= 0) {
            return _error("INVENTORY_ISSUE_QUANTITY_INVALID", "SALIDA_STOCK exige cantidad negativa.");
        }

        await _rateLimitOrThrow("inventario.registerMovement", "staff");
        if (movementType === INVENTORY_CONFIG.MOVEMENT_TYPE_ADJUSTMENT ||
            movementType === INVENTORY_CONFIG.MOVEMENT_TYPE_ISSUE) {
            await requireAdmin(traceId);
        } else {
            await requireCajero(traceId);
        }

        const digest = await hashSHA256(movementToken);
        const journalId = `INV_TX_${digest.slice(0, 48)}`;
        const priorMovement = await dalQuery(MOVEMENTS_COL)
            .eq("movementToken", movementToken)
            .limit(1)
            .find(STRONG_READ);
        if (priorMovement?.items?.length) {
            return { status: "SUCCESS", data: priorMovement.items[0], error: null, idempotent: true };
        }

        const journalExisting = await dalGet(CONTROL_COL, journalId, "strong");
        if (journalExisting?.status === "COMPLETED") {
            return { status: "SUCCESS", data: journalExisting.payload, error: null, idempotent: true };
        }
        if (journalExisting?.status === "INTENT") {
            await _updateInventoryClaim(journalExisting, "REPAIR_REQUIRED", {
                completionError: "NATIVE_WRITER_OUTCOME_UNKNOWN",
                requiresManualNativeStockReview: true,
            });
            return _error("INVENTORY_NATIVE_WRITER_RESULT_UNKNOWN", "La operacion nativa pudo haberse aplicado; no se repetira automaticamente.");
        }
        if (journalExisting?.status === "REPAIR_REQUIRED") {
            return _error("INVENTORY_MOVEMENT_REPAIR_REQUIRED", "El movimiento requiere conciliacion manual; no se repetira la mutacion nativa.");
        }

        const stock = await _findStockByKey(stockKey);
        if (!stock) return _error("INVENTORY_MASTER_MAPPING_REQUIRED", "No existe un maestro CMS para stockKey.");
        const productId = _safeTrim(stock.productId || stock.wixProductId);
        const variantId = _safeTrim(stock.variantId || stock.wixVariantId);
        if (!isValidGuid(productId) || !isValidGuid(variantId)) {
            return _error("INVENTORY_CATALOG_MAPPING_REQUIRED", "El maestro no esta vinculado a una variante nativa Wix.");
        }
        lock = await _acquireStockLock(stockKey, productId, traceId);
        const catalogVersion = await _getCatalogVersion();
        if (catalogVersion !== INVENTORY_CONFIG.CATALOG_VERSION) {
            await _releaseStockLock(lock);
            return _error("INVENTORY_CATALOG_VERSION_MISMATCH", "La operacion solo admite Catalog V1.");
        }

        const nativeResponse = await withTimeout(
            getStoreVariantElevated(`${productId}-${variantId}`),
            API_TIMEOUT_MS,
            "inventory.getStoreVariant.before-manual-movement"
        );
        const nativeVariant = nativeResponse?.variant;
        const stockBefore = Number(nativeVariant?.stock?.quantity);
        if (
            !nativeVariant ||
            nativeVariant.productId !== productId ||
            nativeVariant.variantId !== variantId ||
            !nativeVariant.stock?.trackQuantity ||
            !Number.isSafeInteger(stockBefore) ||
            stockBefore < 0
        ) {
            await _releaseStockLock(lock);
            return _error("INVENTORY_NATIVE_STOCK_UNAVAILABLE", "No se puede verificar el stock nativo antes de modificarlo.");
        }
        const expectedAfter = stockBefore + quantityDelta;
        if (expectedAfter < Number(stock.stockReserved || 0) || expectedAfter < 0) {
            await _releaseStockLock(lock);
            return _error("INVENTORY_ADJUSTMENT_BELOW_RESERVED", "El movimiento dejaría el stock por debajo de las reservas activas.");
        }

        const now = new Date();
        const journalPayload = {
            operation: "MANUAL_NATIVE_STOCK",
            movementToken,
            movementType,
            stockKey,
            productId,
            variantId,
            quantityDelta,
            stockBefore,
            expectedAfter,
            reason,
            referenceId: referenceId || null,
            traceId,
        };
        const journal = await dalInsert(CONTROL_COL, {
            _id: journalId,
            controlType: CONTROL_TYPE.DEDUPE_KEY,
            dedupeKey: "INVENTORY_MANUAL_MOVEMENT",
            status: "INTENT",
            payload: journalPayload,
            traceId,
            _createdDate: now,
            _updatedDate: now,
        });

        try {
            await _assertStockLock(lock);
            if (quantityDelta > 0) {
                await withTimeout(
                    incrementInventoryElevated({
                        incrementData: [{ productId, variantId, incrementBy: quantityDelta }],
                    }),
                    API_TIMEOUT_MS,
                    "inventory.incrementInventory"
                );
            } else {
                await withTimeout(
                    decrementInventoryElevated({
                        decrementData: [{ productId, variantId, decrementBy: Math.abs(quantityDelta) }],
                    }),
                    API_TIMEOUT_MS,
                    "inventory.decrementInventory"
                );
            }
        } catch (nativeError) {
            await _updateInventoryClaim(journal, "REPAIR_REQUIRED", {
                nativeOutcome: "UNKNOWN",
                nativeError: nativeError?.message || "NATIVE_WRITER_FAILED",
                requiresManualNativeStockReview: true,
            });
            return _error("INVENTORY_NATIVE_WRITER_RESULT_UNKNOWN", "Wix no confirmó el resultado; no se repetirá la mutacion para evitar duplicar stock.");
        }

        const appliedJournal = await _updateInventoryClaim(journal, "NATIVE_APPLIED", {
            nativeOutcome: "APPLIED",
            nativeAppliedAt: new Date().toISOString(),
        });
        const completed = await _completeManualInventoryMovement(appliedJournal, traceId);
        if (completed.status !== "SUCCESS") {
            return {
                status: "PARTIAL",
                data: null,
                error: {
                    code: "INVENTORY_MANUAL_MOVEMENT_COMPLETION_PENDING",
                    message: "El stock nativo se actualizo; la proyeccion CMS/ledger requiere reconciliacion.",
                    details: completed,
                },
            };
        }
        return { status: "SUCCESS", data: completed.data, error: null };
    } catch (error) {
        log.error("registerInventoryMovement failed", { traceId, error: error?.message, code: error?.code });
        return _error(error?.code || "INVENTORY_MOVEMENT_FAILED", error?.message || "No se pudo registrar el movimiento.");
    } finally {
        if (lock) await _releaseStockLock(lock);
    }
});

export const reconcilePendingInventoryMovements = webMethod(Permissions.SiteMember, async (options = {}) => {
    const traceId = _safeTrim(options?.traceId) || makeTraceId("inventory-reconcile");
    try {
        await _rateLimitOrThrow("inventario.reconcileMovements", "admin");
        await requireAdmin(traceId);
        const limit = Math.min(
            INVENTORY_CONFIG.REPAIR_PAGE_LIMIT,
            Math.max(1, Math.floor(Number(options?.limit) || INVENTORY_CONFIG.REPAIR_PAGE_LIMIT))
        );
        const pending = await dalQuery(CONTROL_COL)
            .eq("controlType", CONTROL_TYPE.DEDUPE_KEY)
            .eq("dedupeKey", "INVENTORY_MANUAL_MOVEMENT")
            .eq("status", "NATIVE_APPLIED")
            .limit(limit)
            .find(STRONG_READ);
        const results = [];
        for (const journal of pending?.items || []) {
            const result = await _completeManualInventoryMovement(journal, traceId);
            results.push({ journalId: journal._id, ...result });
        }
        return { status: "SUCCESS", data: { processed: results.length, results }, error: null };
    } catch (error) {
        log.error("reconcilePendingInventoryMovements failed", { traceId, error: error?.message });
        return _error(error?.code || "INVENTORY_RECONCILIATION_FAILED", error?.message || "No se pudo reconciliar el inventario.");
    }
});

export const processPendingInventoryRepairs = webMethod(Permissions.SiteMember, async (options = {}) => {
    const traceId = _safeTrim(options?.traceId) || makeTraceId("inventory-repair-queue");
    try {
        await _rateLimitOrThrow("inventario.processRepairs", "admin");
        await requireAdmin(traceId);
        const limit = Math.min(
            INVENTORY_CONFIG.REPAIR_PAGE_LIMIT,
            Math.max(1, Math.floor(Number(options?.limit) || INVENTORY_CONFIG.REPAIR_PAGE_LIMIT))
        );
        const pending = await dalQuery(CONTROL_COL)
            .eq("controlType", CONTROL_TYPE.SYSTEM_FLAG)
            .eq("alertType", "INVENTORY_SYNC_REPAIR_REQUIRED")
            .eq("status", "PENDING")
            .limit(limit)
            .find(STRONG_READ);
        const results = [];
        for (const repair of pending?.items || []) {
            const payload = repair?.payload && typeof repair.payload === "object" ? repair.payload : {};
            const order = {
                _id: payload.orderId,
                taxIncludedInPrices: payload.taxIncludedInPrices,
                lineItems: payload.lineItem ? [payload.lineItem] : [],
            };
            let result;
            if (payload.operation === "RESERVE") {
                result = await _reserveOrderLine(order, payload.lineItem, traceId, payload.eventId);
            } else if (payload.operation === "SALE") {
                result = await _syncPaidOrderLine(order, payload.lineItem, traceId, payload.eventId);
            } else if (payload.operation === "RELEASE") {
                result = await releaseOrderInventoryInternal(order, traceId, payload.eventId);
            } else {
                result = { status: "ERROR", code: "INVENTORY_REPAIR_OPERATION_UNKNOWN" };
            }

            const attempts = Number(payload.attempts || 0) + 1;
            if (result?.status === "SUCCESS") {
                await dalUpdate(CONTROL_COL, {
                    ...repair,
                    status: "RESOLVED",
                    payload: {
                        ...payload,
                        attempts,
                        resolvedAt: new Date().toISOString(),
                        lastResult: result.data || null,
                    },
                    processedAt: new Date(),
                    _updatedDate: new Date(),
                });
            } else {
                await dalUpdate(CONTROL_COL, {
                    ...repair,
                    status: attempts >= INVENTORY_CONFIG.MAX_REPAIR_ATTEMPTS ? "REPAIR_REQUIRED" : "PENDING",
                    payload: {
                        ...payload,
                        attempts,
                        lastError: result?.code || result?.error?.code || "INVENTORY_REPAIR_FAILED",
                        lastAttemptAt: new Date().toISOString(),
                    },
                    _updatedDate: new Date(),
                });
            }
            results.push({ repairId: repair._id, status: result?.status || "ERROR", code: result?.code || null });
        }
        return { status: "SUCCESS", data: { processed: results.length, results }, error: null };
    } catch (error) {
        log.error("processPendingInventoryRepairs failed", { traceId, error: error?.message });
        return _error(error?.code || "INVENTORY_REPAIR_QUEUE_FAILED", error?.message || "No se pudo procesar la cola de inventario.");
    }
});

export const processPendingRefundInventoryRepairs = webMethod(Permissions.SiteMember, async (options = {}) => {
    const traceId = _safeTrim(options?.traceId) || makeTraceId("inventory-refund-repair");
    try {
        await _rateLimitOrThrow("inventario.processRefundRepairs", "admin");
        await requireAdmin(traceId);
        const limit = Math.min(
            INVENTORY_CONFIG.REPAIR_PAGE_LIMIT,
            Math.max(1, Math.floor(Number(options?.limit) || INVENTORY_CONFIG.REPAIR_PAGE_LIMIT))
        );
        const pending = await dalQuery(CONTROL_COL)
            .eq("controlType", CONTROL_TYPE.SYSTEM_FLAG)
            .eq("alertType", "INVENTORY_REFUND_REPAIR_REQUIRED")
            .eq("status", "PENDING")
            .limit(limit)
            .find(STRONG_READ);
        const results = [];
        for (const repair of pending?.items || []) {
            const payload = repair?.payload && typeof repair.payload === "object" ? repair.payload : {};
            const result = await _syncRestockedOrderLine(
                payload.orderId,
                payload.refundId,
                { lineItemId: payload.lineItemId, quantity: payload.quantity },
                payload.reason,
                traceId,
                payload.eventId
            );
            const attempts = Number(payload.attempts || 0) + 1;
            await dalUpdate(CONTROL_COL, {
                ...repair,
                status: result.status === "SUCCESS"
                    ? "RESOLVED"
                    : attempts >= INVENTORY_CONFIG.MAX_REPAIR_ATTEMPTS ? "REPAIR_REQUIRED" : "PENDING",
                payload: {
                    ...payload,
                    attempts,
                    lastError: result.code || null,
                    lastAttemptAt: new Date().toISOString(),
                    resolvedAt: result.status === "SUCCESS" ? new Date().toISOString() : null,
                },
                processedAt: result.status === "SUCCESS" ? new Date() : null,
                _updatedDate: new Date(),
            });
            results.push({ repairId: repair._id, status: result.status, code: result.code || null });
        }
        return { status: "SUCCESS", data: { processed: results.length, results }, error: null };
    } catch (error) {
        log.error("processPendingRefundInventoryRepairs failed", { traceId, error: error?.message });
        return _error(error?.code || "INVENTORY_REFUND_REPAIR_FAILED", error?.message || "No se pudo conciliar la cola de devoluciones.");
    }
});

export const getInventoryCatalogCandidates = webMethod(Permissions.SiteMember, async (options = {}) => {
    const traceId = _safeTrim(options?.traceId) || makeTraceId("inventory-candidates");
    try {
        await _rateLimitOrThrow("inventario.getCatalogCandidates", "staff");
        await requireCajero(traceId);
        const catalogVersion = await _getCatalogVersion();
        if (catalogVersion !== INVENTORY_CONFIG.CATALOG_VERSION) {
            return _error("INVENTORY_CATALOG_VERSION_MISMATCH", "El modulo esta preparado para Wix Stores Catalog V1.");
        }
        const limit = Math.min(100, Math.max(1, Math.floor(Number(options?.limit) || 100)));
        const offset = Math.min(10000, Math.max(0, Math.floor(Number(options?.offset) || 0)));
        const response = await withTimeout(
            queryStoreVariantsElevated({ paging: { limit, offset } }),
            API_TIMEOUT_MS,
            "inventory.queryStoreVariants"
        );
        const variants = Array.isArray(response?.variants) ? response.variants : [];
        return {
            status: "SUCCESS",
            data: {
                items: variants
                    .filter((item) => item?.managedVariant === true && item?.stock?.trackQuantity === true)
                    .map((item) => ({
                        productId: item.productId,
                        variantId: item.variantId,
                        productName: item.productName,
                        variantName: item.variantName,
                        sku: item.sku || null,
                        stockOnHand: Number(item.stock?.quantity),
                        choices: item.choices || {},
                        stockKey: _stockKey(item.productId, item.variantId),
                    })),
                totalCount: response?.totalCount || 0,
                catalogVersion,
                observedAt: new Date(),
            },
            error: null,
        };
    } catch (error) {
        log.error("getInventoryCatalogCandidates failed", { traceId, error: error?.message });
        return _error(error?.code || "INVENTORY_CATALOG_CANDIDATES_FAILED", error?.message || "No se pudo consultar el catalogo.");
    }
});

export const registerInventoryMaster = webMethod(Permissions.SiteMember, async (input = {}) => {
    const traceId = _safeTrim(input?.traceId) || makeTraceId("inventory-master");
    try {
        await _rateLimitOrThrow("inventario.registerMaster", "admin");
        await requireAdmin(traceId);
        const productId = _safeTrim(input?.productId);
        const variantId = _safeTrim(input?.variantId);
        const taxRatePercent = Number(input?.taxRatePercent);
        const taxIncluded = input?.taxIncluded;
        const stockReserved = Number(input?.stockReserved);
        if (!isValidGuid(productId) || !isValidGuid(variantId)) {
            return _error("INVENTORY_CATALOG_ID_INVALID", "productId y variantId deben ser GUID validos.");
        }
        if (!Number.isFinite(taxRatePercent) || taxRatePercent < 0 || taxRatePercent > 100) {
            return _error("INVENTORY_TAX_RATE_INVALID", "tipoImpositivo debe expresarse como porcentaje entre 0 y 100.");
        }
        if (typeof taxIncluded !== "boolean") {
            return _error("INVENTORY_TAX_INCLUDED_REQUIRED", "Debe indicarse expresamente si el precio incluye impuestos.");
        }
        if (!Number.isSafeInteger(stockReserved) || stockReserved < 0) {
            return _error("INVENTORY_RESERVED_STOCK_INVALID", "stockReserved debe ser un entero no negativo verificado por el administrador.");
        }

        const catalogVersion = await _getCatalogVersion();
        if (catalogVersion !== INVENTORY_CONFIG.CATALOG_VERSION) {
            return _error("INVENTORY_CATALOG_VERSION_MISMATCH", "El modulo esta preparado para Wix Stores Catalog V1.");
        }
        const [storeResponse, variantsResponse] = await Promise.all([
            withTimeout(getStoreVariantElevated(`${productId}-${variantId}`), API_TIMEOUT_MS, "inventory.getStoreVariant"),
            withTimeout(queryProductVariantsElevated(productId, { variantIds: [variantId] }), API_TIMEOUT_MS, "inventory.queryProductVariants"),
        ]);
        const storeVariant = storeResponse?.variant;
        const catalogVariant = (variantsResponse?.variants || []).find((item) => item?._id === variantId);
        const nativeStock = storeVariant?.stock || {};
        const stockOnHand = Number(nativeStock.quantity);
        const price = Number(catalogVariant?.variant?.priceData?.price);
        const sku = _safeTrim(catalogVariant?.variant?.sku || storeVariant?.sku);
        const name = _safeTrim(storeVariant?.productName);
        if (
            !storeVariant ||
            storeVariant.productId !== productId ||
            storeVariant.variantId !== variantId ||
            !nativeStock.trackQuantity ||
            !Number.isSafeInteger(stockOnHand) ||
            stockOnHand < 0 ||
            !Number.isFinite(price) ||
            price < 0 ||
            !sku ||
            !name
        ) {
            return _error("INVENTORY_VARIANT_NOT_READY", "La variante no dispone de identidad, seguimiento de stock, SKU o precio verificables.");
        }
        if (stockReserved > stockOnHand) {
            return _error("INVENTORY_RESERVED_EXCEEDS_ON_HAND", "Las reservas verificadas no pueden superar el stock nativo observado.");
        }

        const stockKey = _stockKey(productId, variantId);
        const existing = await _findStockByKey(stockKey);
        if (existing) {
            return {
                status: "SUCCESS",
                data: { ...existing, alreadyMapped: true },
                error: null,
            };
        }
        const legacyMapping = await dalQuery(STOCK_COL)
            .eq("productId", productId)
            .eq("variantId", variantId)
            .limit(1)
            .find(STRONG_READ);
        if (legacyMapping?.items?.length) {
            return _error("INVENTORY_LEGACY_MAPPING_REQUIRES_REVIEW", "Existe una fila previa sin stockKey canonico; requiere reconciliacion manual antes de migrarla.");
        }

        const now = new Date();
        const saved = await dalInsert(STOCK_COL, {
            name,
            tipoImpositivo: taxRatePercent,
            taxIncluded,
            price,
            sku,
            stockOnHand,
            stockReserved,
            stockAvailable: stockOnHand - stockReserved,
            productId,
            variantId,
            wixProductId: productId,
            wixVariantId: variantId,
            catalogVersion: INVENTORY_CONFIG.CATALOG_VERSION,
            stockKey,
            needsWixReconciliation: false,
            lastSyncAt: now,
            traceId,
            _createdDate: now,
            _updatedDate: now,
        });
        return { status: "SUCCESS", data: { ...saved, alreadyMapped: false }, error: null };
    } catch (error) {
        log.error("registerInventoryMaster failed", { traceId, error: error?.message, code: error?.code });
        return _error(error?.code || "INVENTORY_MASTER_REGISTER_FAILED", error?.message || "No se pudo registrar el maestro de inventario.");
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
