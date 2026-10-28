/*
=============================================================================
MODULE: backend/logger.js
VERSION: v5009.0-FISCAL
CORRECTIONS: LOG-01 sin global, LOG-03 PII recursiva con enmascarado real,
             LOG-04 spread context ya no puede sobrescribir level/message,
             LOG-05 contactDetails/contact se sanitizan recursivamente,
             LOG-06 errorWithStack sanea stack + code en child,
             LOG-07 SECRET_FIELD_NAMES/PII_FIELD_NAMES limpiados,
             LOG-08 context no-objeto se normaliza a {}.
FIXES APLICADOS v5007.4 (heredados):
  - FIX-44: import de mmUtils via alias "public/mmUtils".
  - FIX-45: sanitizeValue limpia el WeakSet tras procesar cada nodo.
=============================================================================
*/
import { makeTraceId, _maskEmail, _maskPhone, _maskName } from "public/mmUtils";

export const LOG_LEVELS = Object.freeze({ DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 });
const CURRENT_LOG_LEVEL = LOG_LEVELS.INFO;

const SECRET_FIELD_NAMES = new Set([
    "password", "secret", "token", "apikey", "authorization",
    "auth", "bearer", "cookie", "sessionid", "fiscalkey", "hmac",
    "signature", "creditcard", "cardnumber", "cvv", "pin",
]);

const PII_FIELD_NAMES = new Set([
    "email", "phone", "firstname", "lastname", "name",
    "contactdetails", "contact", "address", "ip", "ipaddress",
    "telefono", "correo", "apellidos",
]);

function _asObject(value) {
    if (value === null || value === undefined) return {};
    if (typeof value !== "object" || Array.isArray(value)) return {};
    return value;
}

function _sanitizeStack(stack) {
    if (typeof stack !== "string") return stack;
    return stack
        .replace(/\/Users\/[^/\s]+/g, "/Users/[REDACTED]")
        .replace(/\/home\/[^/\s]+/g, "/home/[REDACTED]")
        .replace(/[A-Z]:\\Users\\[^\\\s]+/g, "C:\\Users\\[REDACTED]");
}

function _maskByKey(lowerKey, val) {
    if (lowerKey.includes("email") || lowerKey.includes("correo")) {
        return _maskEmail(String(val));
    }
    if (lowerKey.includes("phone") || lowerKey.includes("telefono")) {
        return _maskPhone(String(val));
    }
    if (lowerKey.includes("name") || lowerKey.includes("apellidos")) {
        return _maskName(String(val));
    }
    return "[REDACTED_PII]";
}

function sanitizeValue(value, seen) {
    if (value === null || value === undefined) return value;
    if (typeof value !== "object") return value;
    if (seen.has(value)) return "[Circular]";
    seen.add(value);

    if (Array.isArray(value)) {
        const result = value.map((item) => sanitizeValue(item, seen));
        seen.delete(value);
        return result;
    }

    const sanitized = {};
    for (const [key, val] of Object.entries(value)) {
        const lowerKey = key.toLowerCase().replace(/[-_\s]/g, "");

        if (SECRET_FIELD_NAMES.has(lowerKey)) {
            sanitized[key] = "[REDACTED_SECRET]";
            continue;
        }

        if (PII_FIELD_NAMES.has(lowerKey)) {
            if (val !== null && typeof val === "object") {
                sanitized[key] = sanitizeValue(val, seen);
            } else if (typeof val === "string") {
                sanitized[key] = _maskByKey(lowerKey, val);
            } else {
                sanitized[key] = "[REDACTED_PII]";
            }
            continue;
        }

        sanitized[key] = val !== null && typeof val === "object"
            ? sanitizeValue(val, seen)
            : val;
    }

    seen.delete(value);
    return sanitized;
}

function formatAndLog(level, message, context = {}, traceId) {
    if (LOG_LEVELS[level] < CURRENT_LOG_LEVEL) return;

    const finalTraceId = traceId || makeTraceId("log");
    const safeContext = _asObject(context);
    const logEntry = {
        ...sanitizeValue(safeContext, new WeakSet()),
        timestamp: new Date().toISOString(),
        level,
        traceId: finalTraceId,
        message: String(message),
    };

    const logLine = JSON.stringify(logEntry);
    switch (level) {
    case "ERROR": console.error(logLine); break;
    case "WARN": console.warn(logLine); break;
    case "DEBUG": console.log(logLine); break;
    default: console.info(logLine);
    }
}

function _buildErrorContext(error, baseContext) {
    return {
        ..._asObject(baseContext),
        name: error?.name || "Error",
        message: error?.message,
        stack: _sanitizeStack(error?.stack),
        code: error?.code,
    };
}

export const logger = {
    debug(message, context = {}, traceId) { formatAndLog("DEBUG", message, context, traceId); },
    info(message, context = {}, traceId) { formatAndLog("INFO", message, context, traceId); },
    warn(message, context = {}, traceId) { formatAndLog("WARN", message, context, traceId); },
    error(message, context = {}, traceId) { formatAndLog("ERROR", message, context, traceId); },
    errorWithStack(error, context = {}, traceId) {
        formatAndLog("ERROR", error?.message || "Unknown error", _buildErrorContext(error, context), traceId);
    },
    child(defaultContext = {}) {
        const safeDefaults = _asObject(defaultContext);
        const merge = (context) => ({ ...safeDefaults, ..._asObject(context) });
        return {
            debug: (m, c = {}, t) => formatAndLog("DEBUG", m, merge(c), t),
            info: (m, c = {}, t) => formatAndLog("INFO", m, merge(c), t),
            warn: (m, c = {}, t) => formatAndLog("WARN", m, merge(c), t),
            error: (m, c = {}, t) => formatAndLog("ERROR", m, merge(c), t),
            errorWithStack: (e, c = {}, t) => formatAndLog(
                "ERROR", e?.message || "Unknown error", _buildErrorContext(e, merge(c)), t
            ),
        };
    },
};

// CERO-DEUDA ZC-07: eliminado withLogging (0 consumidores; el patron
// real es logger.info/error directo con traceId en cada web method).


export default logger;