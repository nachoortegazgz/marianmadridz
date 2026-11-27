/*
=============================================================================
MODULE: backend/secretAccess.js
RESPONSIBILITY: Centralized, elevated access to Wix Secrets using the official SDK.
CONTRACT: Returns a non-empty secret string or throws a stable, actionable error.
SECURITY: Backend only. Never return secret values through public web methods.
=============================================================================
*/

import { secrets } from "@wix/secrets";
import { auth } from "@wix/essentials";

const elevatedGetSecretValue = auth.elevate(secrets.getSecretValue);

function _secretError(code, cause = null) {
    const error = new Error(code);
    error.code = code;
    if (cause) {
        error.cause = cause;
        error.providerCode = typeof cause?.code === "string" ? cause.code : null;
    }
    return error;
}

export async function getSecretValue(name) {
    if (typeof name !== "string" || !name.trim()) {
        throw _secretError("SECRET_NAME_REQUIRED");
    }

    let response;
    try {
        response = await elevatedGetSecretValue(name.trim());
    } catch (cause) {
        throw _secretError("SECRET_PROVIDER_ERROR", cause);
    }

    if (!response || typeof response !== "object" || typeof response.value !== "string") {
        throw _secretError("SECRET_RESPONSE_INVALID");
    }
    if (!response.value.trim()) {
        throw _secretError("SECRET_VALUE_EMPTY");
    }

    // Preserve the exact secret bytes represented by the SDK string.
    return response.value;
}
