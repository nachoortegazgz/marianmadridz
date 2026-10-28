/*
=============================================================================
MODULE: backend/secretAccess.js
RESPONSIBILITY: Centralized, elevated access to Wix Secrets using the official SDK.
CONTRACT: Returns the secret value as a string; missing/unavailable secrets return an empty string.
SECURITY: Backend only. Never return secret values through public web methods.
=============================================================================
*/

import { secrets } from "@wix/secrets";
import { auth } from "@wix/essentials";

const elevatedGetSecretValue = auth.elevate(secrets.getSecretValue);

export async function getSecretValue(name) {
    const secretName = String(name ?? "").trim();
    if (!secretName) return "";

    try {
        const response = await elevatedGetSecretValue(secretName);
        return typeof response?.value === "string" ? response.value : "";
    } catch (_) {
        return "";
    }
}
