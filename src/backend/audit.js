/*
=============================================================================
MODULE: backend/audit.js
VERSION: v5015-ALIGNED
BASE: v5009-FISCAL-V20.1 + alineacion con internalConfig v12.0-SSOT-FINAL
RESPONSIBILITY: Registro centralizado de auditoria operativa.
STANDARDS: G10 ASCII Strict. Cero suppressAuth. Cero COLLECTIONS alias.

CAMBIOS DE ALINEACION v5015-ALIGNED (respecto a v5009-FISCAL-V20.1):
  ALN-01: COLLECTIONS alias eliminado. Se usa OPERATIONAL_COLLECTIONS.
  ALN-02: ALERTAS_OPERATIVAS (coleccion inexistente en v12.0) se consolida
          en ControlOperativo con controlType = ALERT. Los campos propios
          de auditoria (eventType, level, message, data, source, loggedAt)
          viajan dentro de payload (objeto canonico).
  ALN-03: wixData.insert(..., { suppressAuth: true }) -> dalInsert.
  ALN-04: El registro se mapea a ControlOperativo. Auditoria general conserva
          eventType/level/message/data/source en payload; avisos operativos
          usan campos indexables alertType/severity/message y status OPEN.
  ALN-05: Unico notifyOperationalAlert con deduplicacion por clave estable.
  ALN-06: logAuditEvent y logAuditEventWithTimeout comparten persistencia.
=============================================================================
*/

import {
    getItem as dalGet,
    insertItem as dalInsert,
} from "backend/dataAccess";



import {
    OPERATIONAL_COLLECTIONS,
    CONTROL_TYPE,
    CONTROL_STATUS,
    SDK_CONFIG,
} from "backend/internalConfig";

import {
    makeTraceId,
    _cloneDeep,
    _cleanText,
    _normalizeIdPart,
    _safeTrim,
    withTimeout,
} from "public/mmUtils";

import { logger } from "backend/logger";

const log = logger;

const CONTROL_OPERATIVO_COL = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
const API_TIMEOUT_MS = Number(SDK_CONFIG?.TIMEOUTS?.WEBHOOK_MS) || 30000;

const DEFAULT_ENTITY_ID = "system";
const DEFAULT_SOURCE = "backend/audit.js";

const VALID_LEVELS = new Set([
    "INFO",
    "WARNING",
    "ERROR",
    "CRITICAL",
]);

// =============================================================================
// HELPERS
// =============================================================================

function _normalizeLevel(level) {
    const normalized = _safeTrim(level).toUpperCase();
    return VALID_LEVELS.has(normalized) ? normalized : "INFO";
}

function _normalizeEventType(eventType) {
    return _normalizeIdPart(eventType, 60).toUpperCase() || "UNKNOWN_EVENT";
}

function _normalizeTraceId(traceId) {
    return _normalizeIdPart(traceId, 80) || "no-trace";
}

function _normalizeEntityId(entityId) {
    return (
        _normalizeIdPart(entityId || DEFAULT_ENTITY_ID, 80) ||
        DEFAULT_ENTITY_ID
    );
}

function _normalizeSource(source) {
    return (
        _normalizeIdPart(source || DEFAULT_SOURCE, 120) ||
        DEFAULT_SOURCE
    );
}

function _normalizeMessage(message) {
    return _cleanText(message, 1000) || "Audit event";
}

function _normalizeData(data) {
    if (!data || typeof data !== "object") {
        return {};
    }
    try {
        return _cloneDeep(data);
    } catch {
        return {
            details: "Audit data could not be cloned safely.",
        };
    }
}

function _summarizeAlertData(data) {
    const source = _normalizeData(data);
    const summary = {};
    const sensitiveKey = /error|cause|detail|stack|message|record|item|break|payload|contact|email|phone|name|token|secret|hash|signature|response|trace/i;

    for (const [key, value] of Object.entries(source)) {
        if (sensitiveKey.test(key)) continue;
        if (typeof value === "number" || typeof value === "boolean") {
            summary[key] = value;
        } else if (typeof value === "string" && value.length <= 60) {
            summary[key] = _cleanText(value, 60);
        }
    }
    return summary;
}

function _buildAuditId(eventType, entityId, traceId) {
    const safeEventType = _normalizeIdPart(eventType, 60);
    const safeEntityId = _normalizeIdPart(entityId, 80);
    const safeTraceId = _normalizeIdPart(traceId, 80);
    const baseId = `AUDIT_${safeEventType}_${safeEntityId}_${safeTraceId}`;
    return baseId.slice(0, 190);
}

/**
 * ALN-02/04: mapea el registro de auditoria al contrato de ControlOperativo.
 * Los campos propios de auditoria viajan en payload (objeto canonico).
 */
function _buildControlOperativoRecord({
    eventType,
    level,
    message,
    data,
    traceId,
    entityId,
    source,
}) {
    const safeEventType = _normalizeEventType(eventType);
    const safeLevel = _normalizeLevel(level);
    const safeMessage = _normalizeMessage(message);
    const safeTraceId = _normalizeTraceId(traceId);
    const safeEntityId = _normalizeEntityId(entityId);
    const safeSource = _normalizeSource(source);
    const now = new Date();

    const auditId = _buildAuditId(safeEventType, safeEntityId, safeTraceId);
    const status =
        safeLevel === "CRITICAL" || safeLevel === "ERROR"
            ? CONTROL_STATUS.OPEN
            : CONTROL_STATUS.COMPLETED;

    return {
        _id: auditId,
        controlType: CONTROL_TYPE.ALERT,
        dedupeKey: auditId,
        resourceId: safeEntityId,
        status,
        payload: {
            eventType: safeEventType,
            level: safeLevel,
            message: safeMessage,
            data: _normalizeData(data),
            source: safeSource,
            loggedAt: now.toISOString(),
        },
        traceId: safeTraceId,
        _createdDate: now,
    };
}

// =============================================================================
// PERSISTENCIA COMPARTIDA
// =============================================================================

async function _persistAuditRecord(record, timeoutLabel = null) {
    try {
        const write = () => dalInsert(CONTROL_OPERATIVO_COL, record);
        if (timeoutLabel) {
            await withTimeout(write, API_TIMEOUT_MS, timeoutLabel);
        } else {
            await write();
        }
    } catch (error) {
        log.error("audit record persistence failed", {
            operation: timeoutLabel || "insert",
            eventType: record?.payload?.eventType || "UNKNOWN_EVENT",
            traceId: record?.traceId || null,
            errorCode: error?.code || null,
        });
    }
}

function _buildOperationalAlertRecord({
    alertType,
    severity = "ERROR",
    message,
    data = {},
    traceId = null,
    entityId = DEFAULT_ENTITY_ID,
    source = DEFAULT_SOURCE,
    dedupeKey,
    operationDate = null,
}) {
    const safeKey = _normalizeIdPart(dedupeKey, 150);
    if (!safeKey) throw new Error("ALERT_DEDUPE_KEY_REQUIRED");

    const safeSeverity = _normalizeLevel(
        String(severity).toUpperCase() === "WARN" ? "WARNING" : severity
    );
    const safeMessage = _cleanText(message, 180) ||
        `Incidencia operativa: ${_normalizeEventType(alertType)}.`;
    const record = _buildControlOperativoRecord({
        eventType: alertType,
        level: safeSeverity,
        message: safeMessage,
        data: _summarizeAlertData(data),
        traceId,
        entityId,
        source,
    });
    const id = `ALERT_${safeKey}`.slice(0, 190);

    return {
        ...record,
        _id: id,
        dedupeKey: id,
        status: CONTROL_STATUS.OPEN,
        alertType: record.payload.eventType,
        severity: safeSeverity === "WARNING" ? "WARN" : safeSeverity,
        message: record.payload.message,
        ...(operationDate ? { operationDate: String(operationDate) } : {}),
    };
}

/**
 * Único punto de creación de avisos operativos.
 * Deduplica por clave estable; el detalle técnico permanece en logs internos.
 */
export async function notifyOperationalAlert(options = {}) {
    let record;
    try {
        const alertTraceId = options?.traceId || makeTraceId("operational-alert");
        record = _buildOperationalAlertRecord({ ...options, traceId: alertTraceId });
        const existing = await withTimeout(
            () => dalGet(CONTROL_OPERATIVO_COL, record._id, { consistentRead: true }),
            API_TIMEOUT_MS,
            "alert_read"
        );
        if (existing) return { created: false, duplicate: true, id: record._id };

        await withTimeout(
            () => dalInsert(CONTROL_OPERATIVO_COL, record),
            API_TIMEOUT_MS,
            "alert_insert"
        );
        return { created: true, duplicate: false, id: record._id };
    } catch (error) {
        // Si dos ejecuciones compiten, la segunda reconoce el registro creado.
        if (record?._id) {
            try {
                const existing = await withTimeout(
                    () => dalGet(CONTROL_OPERATIVO_COL, record._id, { consistentRead: true }),
                    API_TIMEOUT_MS,
                    "alert_duplicate_check"
                );
                if (existing) {
                    return { created: false, duplicate: true, id: record._id };
                }
            } catch (_) {
                // No ocultar el fallo original si tampoco puede verificarse.
            }
        }
        log.error("notifyOperationalAlert failed", {
            alertType: options?.alertType || "UNKNOWN",
            traceId: record?.traceId || options?.traceId || null,
            errorCode: error?.code || null,
        });
        return { created: false, duplicate: false, failed: true, id: record?._id || null };
    }
}

// =============================================================================
// REGISTRO SINCRONO NO BLOQUEANTE
// =============================================================================

export async function logAuditEvent(
    eventType,
    level,
    message,
    data = {},
    traceId = null,
    entityId = DEFAULT_ENTITY_ID,
    source = DEFAULT_SOURCE
) {
    const normalizedLevel = _normalizeLevel(level);
    if (normalizedLevel === "ERROR" || normalizedLevel === "CRITICAL") {
        const alertTraceId = traceId || makeTraceId("audit-error");
        return notifyOperationalAlert({
            alertType: eventType,
            severity: normalizedLevel,
            message,
            data,
            traceId: alertTraceId,
            entityId,
            source,
            dedupeKey: _buildAuditId(eventType, entityId, alertTraceId),
        });
    }
    const record = _buildControlOperativoRecord({
        eventType, level: normalizedLevel, message, data, traceId, entityId, source,
    });
    await _persistAuditRecord(record);
}

// =============================================================================
// REGISTRO CON TIMEOUT
// =============================================================================

export async function logAuditEventWithTimeout(
    eventType,
    level,
    message,
    data = {},
    traceId = null,
    entityId = DEFAULT_ENTITY_ID,
    source = DEFAULT_SOURCE
) {
    const normalizedLevel = _normalizeLevel(level);
    if (normalizedLevel === "ERROR" || normalizedLevel === "CRITICAL") {
        return notifyOperationalAlert({
            alertType: eventType,
            severity: normalizedLevel,
            message,
            data,
            traceId,
            entityId,
            source,
            dedupeKey: _buildAuditId(eventType, entityId, traceId),
        });
    }
    const record = _buildControlOperativoRecord({
        eventType, level: normalizedLevel, message, data, traceId, entityId, source,
    });
    await _persistAuditRecord(record, "audit_insert");
}