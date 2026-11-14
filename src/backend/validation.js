/*
=============================================================================
MODULE: backend/validation.js
RESPONSIBILITY: Pure validation for CMS write boundaries and fiscal identity.
CONTRACT: Validators return true or throw SCHEMA_VIOLATION; no logging or I/O.
DEPENDENCIES: backend/internalConfig only.
DOMAINS: CitasF2, MapaStaff, ControlOperativo, RegistrosHorariosStaff,
         canonical enums and Spanish/EU tax identifiers.
=============================================================================
*/

import {
    CITAS_BOOKING_STATUS,
    CITAS_PAYMENT_STATUS,
    BOOKING_TYPE,
    CONTROL_TYPE,
    WEBHOOK_CLAIM_STATUS,
    CLOCK_EVENT_TYPE,
    RECORD_TYPE_HORARIOS,
    RECORD_TYPE,
    THIRD_PARTY_TYPE,
    isValidGuid,
    normalizeBookingType,
    isDualBookingType,
    CONTROL_OPERATIVO_NON_CANONICAL_FIELDS,
} from "backend/internalConfig";

// =============================================================================
// ASSERT VALID ENUM (unica funcion de validacion generica)
// =============================================================================

/**
 * Valida que value es miembro del enum object.
 * Lanza Error con codigo SCHEMA_VIOLATION si no lo es.
 * Acepta undefined/null como valido solo si allowEmpty === true.
 */
export function assertValidEnum(value, enumObject, fieldName) {
    const allowedValues = enumObject && typeof enumObject === "object"
        ? Object.values(enumObject)
        : [];

    if (allowedValues.length === 0 || !allowedValues.includes(value)) {
        const allowed = allowedValues.length > 0 ? allowedValues.join("|") : "enum no configurado";
        throw new Error(`SCHEMA_VIOLATION: ${fieldName} invalido (${allowed})`);
    }
    return true;
}

// =============================================================================
// CITAS F2 (BIBLIA 12.2)
// =============================================================================

/**
 * VAL-01: valida contra enums CMS (CITAS_BOOKING_STATUS/CITAS_PAYMENT_STATUS),
 * no contra enums Wix nativos. bookingCore traduce antes de persistir.
 */
export function assertCitasF2(item) {
    if (!item || typeof item !== "object") {
        throw new Error("SCHEMA_VIOLATION: CitasF2 item must be an object");
    }

    assertValidEnum(item.bookingStatus, CITAS_BOOKING_STATUS, "bookingStatus");
    assertValidEnum(item.paymentStatus, CITAS_PAYMENT_STATUS, "paymentStatus");

    const canonicalBookingType = normalizeBookingType(item.bookingType);
    assertValidEnum(canonicalBookingType, BOOKING_TYPE, "bookingType");

    if (!item.traceId || !String(item.traceId).trim()) {
        throw new Error("SCHEMA_VIOLATION: CitasF2 requires traceId");
    }
    if (!item.bookingId || !String(item.bookingId).trim()) {
        throw new Error("SCHEMA_VIOLATION: CitasF2 requires bookingId");
    }

    if (!isValidGuid(item.scheduleId)) {
        throw new Error("SCHEMA_VIOLATION: CitasF2.scheduleId is required and must be a valid GUID");
    }

    // VAL-R3-05: regex SSOT internalConfig.isValidGuid (sin duplicados).
    if (!isValidGuid(item.bookingId)) {
        throw new Error("SCHEMA_VIOLATION: CitasF2.bookingId must be a valid GUID");
    }
    if (item.serviceId && !isValidGuid(item.serviceId)) {
        throw new Error("SCHEMA_VIOLATION: CitasF2.serviceId must be a valid GUID when present");
    }
    if (item.resourceId && !isValidGuid(item.resourceId)) {
        throw new Error("SCHEMA_VIOLATION: CitasF2.resourceId must be a valid GUID when present");
    }

    if (isDualBookingType(canonicalBookingType)) {
        if (!item.pairToken || !String(item.pairToken).trim()) {
            throw new Error("SCHEMA_VIOLATION: DUAL booking requires pairToken");
        }
    }

    return true;
}

// =============================================================================
// DATOS FISCALES (Ley 11/2021, Veri*Factu)
// =============================================================================

/**
 * Validacion fiscal obligatoria. NIF checksum por Ley 11/2021.
 * THIRD_PARTY_TYPE es el enum fiscal normativo vigente.
 */
export function assertMapaStaffRecord(item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new Error("SCHEMA_VIOLATION: MapaStaff item must be an object");
    }
    for (const field of ["staffMemberId", "resourceId", "scheduleId"]) {
        if (!isValidGuid(item[field])) {
            throw new Error(`SCHEMA_VIOLATION: MapaStaff.${field} must be a valid Wix GUID`);
        }
    }
    for (const field of ["memberId", "thirdPartyId"]) {
        if (item[field] != null && item[field] !== "" && !isValidGuid(item[field])) {
            throw new Error(`SCHEMA_VIOLATION: MapaStaff.${field} must be a valid Wix GUID when supplied`);
        }
    }
    if (item.active !== undefined && typeof item.active !== "boolean") {
        throw new Error("SCHEMA_VIOLATION: MapaStaff.active must be BOOLEAN");
    }
    if (item.schemaVersion !== undefined &&
        (!Number.isSafeInteger(Number(item.schemaVersion)) || Number(item.schemaVersion) < 1)) {
        throw new Error("SCHEMA_VIOLATION: MapaStaff.schemaVersion must be a positive integer");
    }
    return true;
}

/**
 * Validates fiscal master records against the physical DatosFiscales collection.
 * This collection owns fiscal identity; MapaStaff only maps Wix staff identities.
 */
export function assertDatosFiscalesRecord(item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new Error("SCHEMA_VIOLATION: DatosFiscales item must be an object");
    }
    assertValidEnum(item.recordType, {
        TERCERO: RECORD_TYPE.TERCERO,
        GESTORIA: RECORD_TYPE.GESTORIA,
        CONFIG_SISTEMA: RECORD_TYPE.CONFIG_SISTEMA,
    }, "recordType");

    if (item.recordType === RECORD_TYPE.CONFIG_SISTEMA) {
        if (item.taxId && !isValidNifOrEuVat(item.taxId)) {
            throw new Error("SCHEMA_VIOLATION: DatosFiscales.taxId must be valid NIF/NIE/CIF/VAT-UE");
        }
        if (item.legalName != null && item.legalName !== "" && !String(item.legalName).trim()) {
            throw new Error("SCHEMA_VIOLATION: DatosFiscales.legalName must be non-empty when supplied");
        }
        if (item.thirdPartyType != null && item.thirdPartyType !== "") {
            throw new Error("SCHEMA_VIOLATION: CONFIG_SISTEMA.thirdPartyType must be null");
        }
    } else if (item.recordType === RECORD_TYPE.TERCERO) {
        if (!item.taxId || !isValidNifOrEuVat(item.taxId)) {
            throw new Error("SCHEMA_VIOLATION: DatosFiscales TERCERO requires a valid taxId");
        }
        if (!String(item.legalName || "").trim()) {
            throw new Error("SCHEMA_VIOLATION: DatosFiscales TERCERO requires legalName");
        }
        assertValidEnum(item.thirdPartyType, THIRD_PARTY_TYPE, "thirdPartyType");
    } else if (item.recordType === RECORD_TYPE.GESTORIA) {
        const email = String(item.email || item.gestorEmail || "").trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error("SCHEMA_VIOLATION: DatosFiscales GESTORIA requires a valid email");
        }
        if (!String(item.name || item.legalName || item.gestorName || "").trim()) {
            throw new Error("SCHEMA_VIOLATION: DatosFiscales GESTORIA requires a name");
        }
    }
    for (const field of ["verifactuEnabled", "tipoUsoPosibleMultiOT", "indicadorMultiplesOT", "active"]) {
        if (item[field] !== undefined && item[field] !== null && typeof item[field] !== "boolean") {
            throw new Error(`SCHEMA_VIOLATION: DatosFiscales.${field} must be BOOLEAN`);
        }
    }
    if (item.fechaInicioVerifactu != null && item.fechaInicioVerifactu !== "" &&
        !/^\d{4}-\d{2}-\d{2}$/.test(String(item.fechaInicioVerifactu))) {
        throw new Error("SCHEMA_VIOLATION: DatosFiscales.fechaInicioVerifactu must be YYYY-MM-DD TEXT");
    }
    return true;
}
// =============================================================================
// CONTROL OPERATIVO
// =============================================================================

export function assertCanonicalControlFields(item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new Error("SCHEMA_VIOLATION: ControlOperativo item must be an object");
    }
    const rejected = CONTROL_OPERATIVO_NON_CANONICAL_FIELDS.filter((field) =>
        Object.prototype.hasOwnProperty.call(item, field)
    );
    if (rejected.length) {
        throw new Error(
            `SCHEMA_VIOLATION: ControlOperativo fields not allowed: ${rejected.join(", ")}`
        );
    }
    return true;
}

export function assertControlOperativo(item) {
    if (!item || typeof item !== "object") {
        throw new Error("SCHEMA_VIOLATION: ControlOperativo item must be an object");
    }

    assertValidEnum(item.controlType, CONTROL_TYPE, "controlType");

    if (!item.dedupeKey || !String(item.dedupeKey).trim()) {
        throw new Error("SCHEMA_VIOLATION: ControlOperativo requires dedupeKey");
    }
    if (!item.traceId || !String(item.traceId).trim()) {
        throw new Error("SCHEMA_VIOLATION: ControlOperativo requires traceId");
    }

    // WEBHOOK_EVENT: eventType y processedAt también se duplican en campos CMS indexables.
    if (item.controlType === CONTROL_TYPE.WEBHOOK_EVENT) {
        if (!item.eventId || !String(item.eventId).trim()) {
            throw new Error("SCHEMA_VIOLATION: WEBHOOK_EVENT requires eventId");
        }
        if (!item.eventType || !String(item.eventType).trim()) {
            throw new Error("SCHEMA_VIOLATION: WEBHOOK_EVENT requires eventType");
        }
        const processedAt = new Date(item.processedAt);
        if (!item.processedAt || Number.isNaN(processedAt.getTime())) {
            throw new Error("SCHEMA_VIOLATION: WEBHOOK_EVENT requires a valid processedAt date");
        }
    }

    // WEBHOOK_CLAIM mantiene el lease y el contador en campos CMS canonicos.
    if (item.controlType === CONTROL_TYPE.WEBHOOK_CLAIM) {
        if (!item.eventId || !String(item.eventId).trim()) {
            throw new Error("SCHEMA_VIOLATION: WEBHOOK_CLAIM requires eventId");
        }
        if (!item.eventType || !String(item.eventType).trim()) {
            throw new Error("SCHEMA_VIOLATION: WEBHOOK_CLAIM requires eventType");
        }
        assertValidEnum(item.status, WEBHOOK_CLAIM_STATUS, "status");
        // traceId is the canonical CMS fencing token; ownerToken was removed from the schema.
        if (!Number.isSafeInteger(Number(item.version)) || Number(item.version) < 1) {
            throw new Error("SCHEMA_VIOLATION: WEBHOOK_CLAIM requires version >= 1");
        }
        if (!Number.isSafeInteger(Number(item.attempts)) || Number(item.attempts) < 1) {
            throw new Error("SCHEMA_VIOLATION: WEBHOOK_CLAIM requires attempts >= 1");
        }
        const expiresAt = new Date(item.expiresAt);
        if (!item.expiresAt || Number.isNaN(expiresAt.getTime())) {
            throw new Error("SCHEMA_VIOLATION: WEBHOOK_CLAIM requires a valid expiresAt date");
        }
    }

    // SLOT_LOCK requiere resourceId + expiresAt
    if (item.controlType === CONTROL_TYPE.SLOT_LOCK) {
        if (!isValidGuid(item.resourceId)) {
            throw new Error("SCHEMA_VIOLATION: SLOT_LOCK requires a valid resourceId GUID");
        }
        const expiresAt = new Date(item.expiresAt);
        if (!item.expiresAt || Number.isNaN(expiresAt.getTime())) {
            throw new Error("SCHEMA_VIOLATION: SLOT_LOCK requires a valid expiresAt date");
        }
    }

    return true;
}

// =============================================================================
// REGISTROS HORARIOS STAFF (RD 8/2019)
// =============================================================================

export function assertRegistrosHorariosStaff(item) {
    if (!item || typeof item !== "object") {
        throw new Error("SCHEMA_VIOLATION: RegistrosHorariosStaff item must be an object");
    }

    if (!item.resourceId || !String(item.resourceId).trim()) {
        throw new Error("SCHEMA_VIOLATION: RegistrosHorariosStaff requires resourceId");
    }
    if (!item.memberId || !String(item.memberId).trim()) {
        throw new Error("SCHEMA_VIOLATION: RegistrosHorariosStaff requires memberId");
    }

    assertValidEnum(item.clockEventType, CLOCK_EVENT_TYPE, "clockEventType");
    assertValidEnum(item.recordType, RECORD_TYPE_HORARIOS, "recordType");

    if (!item.recordedAt) {
        throw new Error("SCHEMA_VIOLATION: RegistrosHorariosStaff requires recordedAt");
    }
    if (!item.dayKey || !String(item.dayKey).trim()) {
        throw new Error("SCHEMA_VIOLATION: RegistrosHorariosStaff requires dayKey");
    }
    if (!item.monthKey || !String(item.monthKey).trim()) {
        throw new Error("SCHEMA_VIOLATION: RegistrosHorariosStaff requires monthKey");
    }
    if (!item.traceId || !String(item.traceId).trim()) {
        throw new Error("SCHEMA_VIOLATION: RegistrosHorariosStaff requires traceId");
    }
    if (!/^[a-f0-9]{64}$/i.test(String(item.signature ?? "").trim())) {
        throw new Error("SCHEMA_VIOLATION: RegistrosHorariosStaff requires a 64-character HMAC signature");
    }

    // AJUSTE requiere adjustmentReason (RD 8/2019)
    if (item.recordType === RECORD_TYPE_HORARIOS.AJUSTE) {
        if (!item.adjustmentReason || !String(item.adjustmentReason).trim()) {
            throw new Error("SCHEMA_VIOLATION: AJUSTE requires adjustmentReason (RD 8/2019)");
        }
    }

    return true;
}

// =============================================================================
// MAPA STAFF (v8.1 schema, C-01/C-02/C-03)
// =============================================================================

/* R2/DUP-01: _GUID_RE local ELIMINADO. Regex GUID canonicas:
 * isValidGuid (internalConfig, backend SSOT) / _looksLikeGuid (mmUtils,
 * frontend). MapaStaff se valida en el resolver de identidad que necesita
 * la consulta: una unica fila activa por staffMemberId y resourceId GUID. */

// =============================================================================
// NIF / NIE / CIF / VAT-UE CHECKSUM (Ley 11/2021)
// =============================================================================

/**
 * Valida NIF espanol (8 digitos + letra de control).
 */
function _isValidNif(value) {
    const nif = String(value || "").trim().toUpperCase();
    if (!/^\d{8}[A-Z]$/.test(nif)) return false;
    const letters = "TRWAGMYFPDXBNJZSQVHLCKE";
    const num = parseInt(nif.substring(0, 8), 10);
    return letters[num % 23] === nif.charAt(8);
}

/**
 * Valida NIE espanol (X/Y/Z + 7 digitos + letra de control).
 */
function _isValidNie(value) {
    const nie = String(value || "").trim().toUpperCase();
    if (!/^[XYZ]\d{7}[A-Z]$/.test(nie)) return false;
    const prefix = { X: "0", Y: "1", Z: "2" };
    const numStr = prefix[nie.charAt(0)] + nie.substring(1, 8);
    const letters = "TRWAGMYFPDXBNJZSQVHLCKE";
    const num = parseInt(numStr, 10);
    return letters[num % 23] === nie.charAt(8);
}

/**
 * Valida CIF espanol (letra organizacion + 7 digitos + digito/letra control).
 */
function _isValidCif(value) {
    const cif = String(value || "").trim().toUpperCase();
    if (!/^[ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-J]$/.test(cif)) return false;
    const orgLetter = cif.charAt(0);
    const digits = cif.substring(1, 8);
    const control = cif.charAt(8);

    let sumA = 0;
    let sumB = 0;
    for (let i = 0; i < 7; i++) {
        const d = parseInt(digits.charAt(i), 10);
        if (i % 2 === 0) {
            const doubled = d * 2;
            sumB += doubled > 9 ? Math.floor(doubled / 10) + (doubled % 10) : doubled;
        } else {
            sumA += d;
        }
    }
    const total = sumA + sumB;
    const units = total % 10;
    const controlDigit = units === 0 ? 0 : 10 - units;
    const controlLetter = "JABCDEFGHI".charAt(controlDigit);

    // Algunas organizaciones usan digito, otras letra
    const numericOrgs = "ABEH";
    if (numericOrgs.includes(orgLetter)) {
        return control === String(controlDigit);
    }
    const letterOrgs = "KPQRSNW";
    if (letterOrgs.includes(orgLetter)) {
        return control === controlLetter;
    }
    // Resto: acepta ambos
    return control === String(controlDigit) || control === controlLetter;
}

/**
 * Valida VAT-UE intracomunitario (prefijo pais + numero).
 * Solo valida formato, no registro VIES.
 */
function _isValidEuVat(value) {
    const vat = String(value || "").trim().toUpperCase().replace(/[\s-]/g, "");
    if (vat.length < 4) return false;
    const prefix = vat.substring(0, 2);
    const number = vat.substring(2);
    // Prefijos UE validos + longitud minima
    const patterns = {
        AT: /^U\d{8}$/, BE: /^\d{10}$/, BG: /^\d{9,10}$/,
        CY: /^[A-Z0-9]{9}$/, CZ: /^\d{8,10}$/, DE: /^\d{9}$/,
        DK: /^\d{8}$/, EE: /^\d{9}$/, ES: /^[A-Z0-9]\d{7}[A-Z0-9]$/,
        FI: /^\d{8}$/, FR: /^[A-Z0-9]{2}\d{9}$/, GR: /^\d{9}$/,
        HR: /^\d{11}$/, HU: /^\d{8}$/, IE: /^[A-Z0-9]{7}[A-Z]$/,
        IT: /^\d{11}$/, LT: /^(\d{9}|\d{12})$/, LU: /^\d{8}$/,
        LV: /^\d{11}$/, MT: /^\d{8}$/, NL: /^\d{9}B\d{2}$/,
        PL: /^\d{10}$/, PT: /^\d{9}$/, RO: /^\d{2,10}$/,
        SE: /^\d{12}$/, SI: /^\d{8}$/, SK: /^\d{10}$/,
    };
    const pattern = patterns[prefix];
    if (!pattern) return false;
    return pattern.test(number);
}

/**
 * Valida NIF, NIE, CIF o VAT-UE. Retorna true si alguno es valido.
 */
export function isValidNifOrEuVat(value) {
    const v = String(value || "").trim();
    if (!v) return false;
    return _isValidNif(v) || _isValidNie(v) || _isValidCif(v) || _isValidEuVat(v);
}

/**
 * Identifica exclusivamente filas de simulacion marcadas de forma explicita.
 * No clasifica como simulacion una fila solo por tener una huella invalida:
 * esos registros deben seguir provocando una alerta de integridad.
 */
export function isExplicitSimulationLedgerRecord(item) {
    if (!item || typeof item !== "object") return false;
    const upper = (value) => String(value ?? "").trim().toUpperCase();
    const recordSource = upper(item.recordSource);
    const eventType = upper(item.eventType);
    const movementType = upper(item.movementType);
    const origenTipo = upper(item.origenTipo);
    const accountCode = upper(item.accountCode);
    const hash = upper(item.hash);
    const previousRecordHash = upper(item.previousRecordHash);
    const recordHash = upper(item.recordHash);
    const simulatedMovementType = movementType.startsWith("SIMULATED_") ||
        /(?:^|_)SIMULAD[AO]$/.test(movementType);
    return recordSource === "SMOKE_TEST" ||
        eventType.startsWith("SIMULATED_") ||
        simulatedMovementType ||
        origenTipo === "SMOKE_TEST" ||
        accountCode === "SIMULATED" ||
        hash === "SIMULATED_HASH" ||
        previousRecordHash === "SIMULATED_PREVIOUS_HASH" ||
        recordHash === "SIMULATED_DETAIL_HASH";
}


