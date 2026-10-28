/*
=============================================================================
MODULE: backend/securityEngine.js
VERSION: v5015-ALIGNED
BASE: v5009-FISCAL-V20.1 + alineacion con internalConfig v12.0-SSOT-FINAL
RESPONSIBILITY: Hashes criptograficos (SHA-256, HMAC-SHA256), firma
                HMAC de fichajes (RD 8/2019) y comparacion timing-safe.
STANDARDS: G10 ASCII Strict.

HISTORIAL CERO-DEUDA:
  ZC-07: generateJWT/verifyJWT eliminados (0 consumidores). El modulo ya no
          exporta ni importa configuracion JWT; la autenticacion vive en
          security.js (sesiones Wix + MapaStaff.rolWebsite).
=============================================================================
*/

import { getSecretValue } from "backend/secretAccess";
import { SECRETS } from "backend/mmSecrets";

import { logger } from "backend/logger";

const log = logger;

const HEX_64_PATTERN = /^[0-9a-f]{64}$/i;
const ZERO_HASH = "0".repeat(64);

// =============================================================================
// BLOQUE 1 - UTILIDADES INTERNAS
// =============================================================================

function _toString(value) {
    if (value === null || value === undefined) {
        return "";
    }
    return String(value);
}


function _bytesToHex(bytes) {
    return Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}





// =============================================================================
// BLOQUE 2 - HASH SHA-256
// =============================================================================

export async function hashSHA256(input) {
    const value = _toString(input);

    if (!value) {
        return ZERO_HASH;
    }

    if (
        typeof crypto !== "undefined" &&
        crypto?.subtle &&
        typeof TextEncoder === "function"
    ) {
        try {
            const digest = await crypto.subtle.digest(
                "SHA-256",
                new TextEncoder().encode(value)
            );

            return _bytesToHex(new Uint8Array(digest));
        } catch (error) {
            log.error("hashSHA256 failed", {
                message: error?.message || String(error),
            });

            throw new Error("HASH_UNAVAILABLE");
        }
    }

    throw new Error("WEB_CRYPTO_UNAVAILABLE");
}

// =============================================================================
// BLOQUE 3 - HMAC-SHA256
// =============================================================================

export async function hmacSha256Hex(key, payload) {
    const keyValue = _toString(key);
    const payloadValue = _toString(payload);

    if (!keyValue || !payloadValue) {
        return ZERO_HASH;
    }

    if (
        typeof crypto !== "undefined" &&
        crypto?.subtle &&
        typeof TextEncoder === "function"
    ) {
        try {
            const encoder = new TextEncoder();

            const cryptoKey = await crypto.subtle.importKey(
                "raw",
                encoder.encode(keyValue),
                {
                    name: "HMAC",
                    hash: "SHA-256",
                },
                false,
                ["sign"]
            );

            const signature = await crypto.subtle.sign(
                "HMAC",
                cryptoKey,
                encoder.encode(payloadValue)
            );

            return _bytesToHex(new Uint8Array(signature));
        } catch (error) {
            log.error("hmacSha256Hex failed", {
                message: error?.message || String(error),
            });

            throw new Error("HMAC_UNAVAILABLE");
        }
    }

    throw new Error("WEB_CRYPTO_UNAVAILABLE");
}

// =============================================================================
// BLOQUE 4 - CADENA DE HASH
// =============================================================================

export async function hashChain(previousHash, payload) {
    const previous = _toString(previousHash) || ZERO_HASH;
    const content = _toString(payload);

    return hashSHA256(`${previous}|${content}`);
}

// =============================================================================
// BLOQUE 5 - COMPARACION TIMING-SAFE
// =============================================================================

export function timingSafeEqual(first, second) {
    const valueA = _toString(first);
    const valueB = _toString(second);

    const maxLength = Math.max(valueA.length, valueB.length);
    let result = valueA.length ^ valueB.length;

    for (let index = 0; index < maxLength; index += 1) {
        const charA = index < valueA.length ? valueA.charCodeAt(index) : 0;
        const charB = index < valueB.length ? valueB.charCodeAt(index) : 0;

        result |= charA ^ charB;
    }

    return result === 0;
}

// =============================================================================
// CERO-DEUDA ZC-07: eliminados generateJWT/verifyJWT (0 consumidores
// en src/ y tests; la autenticacion real vive en security.js via sesiones
// Wix + MapaStaff.rolWebsite, no via JWT propio).
// =============================================================================

// =============================================================================
// BLOQUE 6 - FIRMA HMAC DE FICHAJES HORARIOS (RD 8/2019)
// =============================================================================
// reglamento RD 8/2019 exige integridad verificable de los registros de
// jornada. Cada fichaje se firma con HMAC-SHA256 sobre un payload canonico
// (campos ordenados alfabeticamente, excluyendo la propia firma y campos
// mutables post-firma). La verificacion recomputa la firma y compara en
// tiempo constante. Clave: SECRET_FISCALKEY (dominio fiscal/laboral).

const TIMECLOCK_SIGNED_FIELDS = Object.freeze([
    "clockEventType",
    "dayKey",
    "memberId",
    "monthKey",
    "recordType",
    "recordedBy",
    "recordedAt",
    "registeredByMemberId",
    "staffName",
    "traceId",
]);

function _timeclockCanonicalPayload(record) {
    const parts = [];
    for (const field of TIMECLOCK_SIGNED_FIELDS) {
        const value = record?.[field];
        parts.push(`${field}=${value === undefined || value === null ? "" : String(value)}`);
    }
    return parts.join("|");
}

export async function signTimeclockRecord(record, key = null) {
    try {
        const keyValue = key || (await getSecretValue(SECRETS.FISCAL_KEY));
        if (!keyValue) {
            throw new Error("CONFIGURACION_FISCAL_INVALIDA");
        }
        return await hmacSha256Hex(keyValue, _timeclockCanonicalPayload(record));
    } catch (error) {
        log.error("signTimeclockRecord failed", {
            message: error?.message || String(error),
        });
        throw error;
    }
}

export async function verifyTimeclockSignature(record, key = null) {
    try {
        const provided = _toString(record?.signature);
        if (!HEX_64_PATTERN.test(provided)) {
            return false;
        }
        const expected = await signTimeclockRecord(record, key);
        return timingSafeEqual(provided, expected);
    } catch (error) {
        log.error("verifyTimeclockSignature failed", {
            message: error?.message || String(error),
        });
        return false;
    }
}