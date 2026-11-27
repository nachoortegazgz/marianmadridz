// Public response envelopes and safe error serialization.

import { _cloneDeep, _safeTrim } from "public/mmUtils";

// =============================================================================
// BLOQUE 1 - CONSTANTES
// =============================================================================

const MAX_ERROR_MESSAGE_LENGTH = 500;
const DEFAULT_ERROR_CODE = "INTERNAL_ERROR";
const DEFAULT_ERROR_MESSAGE = "Error interno";
const UNKNOWN_ERROR_CODE = "UNKNOWN_ERROR";

// Internal helpers.

function _cloneMeta(value) {
    if (!value || typeof value !== "object") return {};

    try {
        return _cloneDeep(value);
    } catch {
        return { details: "Metadata could not be cloned safely." };
    }
}

function _normalizeMessageText(value) {
    if (value instanceof Error) {
        return typeof value.message === "string" && value.message.trim()
            ? value.message
            : DEFAULT_ERROR_MESSAGE;
    }
    if (typeof value === "string") return value;
    if (value && typeof value === "object") {
        for (const key of ["message", "error", "reason"]) {
            if (typeof value[key] === "string" && value[key].trim()) {
                return value[key];
            }
        }
        return DEFAULT_ERROR_MESSAGE;
    }
    if (value === null || value === undefined) return DEFAULT_ERROR_MESSAGE;
    return String(value);
}

function _truncateMessage(value) {
    const rawMessage = _normalizeMessageText(value);
    const safeMessage = _safeTrim(rawMessage);

    if (safeMessage.length <= MAX_ERROR_MESSAGE_LENGTH) {
        return safeMessage;
    }

    return `${safeMessage.slice(0, MAX_ERROR_MESSAGE_LENGTH)}...`;
}

function _extractErrorValues(code, message) {
    if (code instanceof Error) {
        return {
            code: code.code || code.name || UNKNOWN_ERROR_CODE,
            message: code.message || DEFAULT_ERROR_MESSAGE,
        };
    }

    if (code && typeof code === "object") {
        return {
            code: code.code || code.name || UNKNOWN_ERROR_CODE,
            message:
                code.message ||
                code.error ||
                code.reason ||
                DEFAULT_ERROR_MESSAGE,
        };
    }

    if (
        typeof code === "string" &&
        (message === undefined || message === null)
    ) {
        return {
            code: UNKNOWN_ERROR_CODE,
            message: code,
        };
    }

    return {
        code: code || DEFAULT_ERROR_CODE,
        message: message || DEFAULT_ERROR_MESSAGE,
    };
}


export function successResponse(data = null, metaExtra = {}) {
    const extra = _cloneMeta(metaExtra);

    return {
        status: "SUCCESS",
        meta: {
            timestamp: new Date().toISOString(),
            ...extra,
        },
        data,
        error: null,
    };
}

export function errorResponse(
    code = DEFAULT_ERROR_CODE,
    message = DEFAULT_ERROR_MESSAGE,
    metaExtra = {}
) {
    const extracted = _extractErrorValues(code, message);
    const safeMessage =
        _truncateMessage(extracted.message) || DEFAULT_ERROR_MESSAGE;

    const extra = _cloneMeta(metaExtra);

    return {
        status: "ERROR",
        meta: {
            timestamp: new Date().toISOString(),
            ...extra,
        },
        data: null,
        error: {
            code: String(extracted.code || DEFAULT_ERROR_CODE),
            message: safeMessage,
        },
    };
}


export function _toPublicError(
    err,
    fallbackCode = DEFAULT_ERROR_CODE,
    fallbackMessage = DEFAULT_ERROR_MESSAGE
) {
    const code = err?.code || fallbackCode;
    const message = err?.message || fallbackMessage;

    return {
        code: String(code),
        message: _truncateMessage(message) || fallbackMessage,
    };
}

