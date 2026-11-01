/*
=============================================================================
MODULE: backend/validation.js
AERSION: v12.0-MINIMAL
BASE: v11.0-SSOT-CLEAN + alineacion con internalConfig v12 y CMS KEY FIELDS.
RESPONSIBILITY: Aalidacion centralizada de enums, NIFs y schemas CMS.
  Funciones puras: lanzan Error, no loguean. El logging lo hace el caller.
STANDARDS: G10 ASCII Strict. Minimo codigo. Cero duplicacion.
CORRECCIONES v12.0-MINIMAL:
  VAL-01 (P0): assertCitasF2 valida contra CITAS_BOOKING_STATUS y
    CITAS_PAYMENT_STATUS (enums CMS persistidos). Antes validaba contra
    BOOKING_STATUS/PAYMENT_STATUS (Wix nativos) -> rechazaba CANCELLED
    (doble L) que es el valor correcto en CitasF2.
  VAL-02 (P1): isValidGuid duplicado eliminado. Usar isValidGuid de
    internalConfig o _looksLikeGuid de mmUtils.
  VAL-03 (P1): Imports muertos eliminados (COMPENSATION_KIND, ITEM_NATURE,
    CODIGO_IMPUESTO, CHANNEL_TYPE, MOVEMENT_TYPE, PAYMENT_METHOD,
    CATALOG_STATES, CASH_REGISTER_STATUS).
  VAL-04 (P2): Logger import eliminado. Validation es pura.
  VAL-05 (P0): assertMapaStaff ELIMINADO en R2 (DUP-03: MapaStaff no existe
    en CMS KEY FIELDS; staff.js v9 resuelve identidad via Bookings Staff API
    y ya no consume este hook).
MANTENIDO (consumidores activos verificados):
  - assertValidEnum: usado por todos los asserts y callers externos
  - assertCitasF2: consumido por data.js CitasF2_beforeInsert/beforeUpdate
  - assertDatosFiscales: consumido por data.js/handlers fiscales
  - assertControlOperativo: consumido por data.js ControlOperativo hooks
  - assertRegistrosHorariosStaff: consumido por data.js + horario.web.js
  - assertMovimientosInventario: consumido por data.js hook
  - expectedInventoryMagnitude: consumido por data.js hook
  - isValidNifOrEuVat: validacion fiscal obligatoria (Ley 11/2021)
  - THIRD_PARTY_TYPE: enum fiscal normativo activo
DEPENDENCIAS: backend/internalConfig (enums). Cero dependencias de
  logger, mmUtils, dataAccess ni wix-data. Hoja pura.
=============================================================================
*/

import {
    CITAS_BOOKING_STATUS,
    CITAS_PAYMENT_STATUS,
    BOOKING_TYPE,
    CONTROL_TYPE,
    CLOCK_EVENT_TYPE,
    RECORD_TYPE_HORARIOS,
    RECORD_TYPE,
    THIRD_PARTY_TYPE,
    INVENTORY_MOVEMENT_TYPE,
    MAGNITUDE,
    isValidGuid,
    normalizeBookingType,
    isDualBookingType,
} from "backend/internalConfig";

// =============================================================================
// ASSERT VALID ENUM (unica funcion de validacion generica)
// =============================================================================

/**
 * Valida que value es miembro del enum object.
 * Lanza Error con codigo SCHEMA_VIOLATION si no lo es.
 * Acepta undefined/null como valido solo si allowEmpty === true.
 */
export function assertValidEnum(value, enumObj, fieldName, allowEmpty = false) {
    if (value === undefined || value === null || value === "") {
        if (allowEmpty) return true;
        throw new Error(`SCHEMA_VIOLATION: ${fieldName} is required`);
    }
    const v = String(value).trim().toUpperCase();
    const validValues = Object.values(enumObj).map(String);
    if (!validValues.includes(v)) {
        throw new Error(
            `SCHEMA_VIOLATION: ${fieldName}="${v}" not in [${validValues.join(",")}]`
        );
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

    // VAL-R3-05: regex SSOT internalConfig.isValidGuid (sin duplicados).
    if (!isValidGuid(item.bookingId)) {
        throw new Error("SCHEMA_VIOLATION: CitasF2.bookingId must be a valid GUID");
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
 * THIRD_PARTY_TYPE es enum fiscal normativo activo (no legacy).
 */
export function assertDatosFiscales(item) {
    if (!item || typeof item !== "object") {
        throw new Error("SCHEMA_VIOLATION: DatosFiscales item must be an object");
    }

    assertValidEnum(item.recordType, RECORD_TYPE, "recordType");

    if (!item.taxId || !String(item.taxId).trim()) {
        throw new Error("SCHEMA_VIOLATION: DatosFiscales requires taxId");
    }
    if (!isValidNifOrEuVat(item.taxId)) {
        throw new Error("SCHEMA_VIOLATION: DatosFiscales.taxId must be valid NIF/NIE/CIF/VAT-UE");
    }
    if (!item.legalName || !String(item.legalName).trim()) {
        throw new Error("SCHEMA_VIOLATION: DatosFiscales requires legalName");
    }

    assertValidEnum(item.thirdPartyType, THIRD_PARTY_TYPE, "thirdPartyType");

    if (item.thirdPartyType === THIRD_PARTY_TYPE.STAFF) {
        if (!isValidGuid(item.bookingsResourceId)) {
            throw new Error("SCHEMA_VIOLATION: STAFF requires bookingsResourceId GUID");
        }
        if (!item.memberId || !String(item.memberId).trim()) {
            throw new Error("SCHEMA_VIOLATION: STAFF requires memberId");
        }
    }

    // Campo 'active' prohibido en DatosFiscales
    if ("active" in item) {
        throw new Error("SCHEMA_VIOLATION: DatosFiscales.active is forbidden");
    }

    return true;
}

// =============================================================================
// CONTROL OPERATIVO
// =============================================================================

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

    // WEBHOOK_EVENT requiere eventId
    if (item.controlType === CONTROL_TYPE.WEBHOOK_EVENT) {
        if (!item.eventId || !String(item.eventId).trim()) {
            throw new Error("SCHEMA_VIOLATION: WEBHOOK_EVENT requires eventId");
        }
    }

    // SLOT_LOCK requiere resourceId + expiresAt
    if (item.controlType === CONTROL_TYPE.SLOT_LOCK) {
        if (!item.resourceId || !String(item.resourceId).trim()) {
            throw new Error("SCHEMA_VIOLATION: SLOT_LOCK requires resourceId");
        }
        if (!item.expiresAt) {
            throw new Error("SCHEMA_VIOLATION: SLOT_LOCK requires expiresAt");
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

    // AJUSTE requiere adjustmentReason (RD 8/2019)
    if (item.recordType === RECORD_TYPE_HORARIOS.AJUSTE) {
        if (!item.adjustmentReason || !String(item.adjustmentReason).trim()) {
            throw new Error("SCHEMA_VIOLATION: AJUSTE requires adjustmentReason (RD 8/2019)");
        }
    }

    return true;
}

// =============================================================================
// MOVIMIENTOS INVENTARIO
// =============================================================================

export function expectedInventoryMagnitude(movementType, quantityDelta) {
    const qty = Number(quantityDelta) || 0;
    if (qty > 0) return MAGNITUDE.POSITIVE;
    if (qty < 0) return MAGNITUDE.NEGATIVE;
    return MAGNITUDE.NEUTRAL;
}

export function assertMovimientosInventario(item) {
    if (!item || typeof item !== "object") {
        throw new Error("SCHEMA_VIOLATION: MovimientosInventario item must be an object");
    }

    if (!item.movementToken || !String(item.movementToken).trim()) {
        throw new Error("SCHEMA_VIOLATION: MovimientosInventario requires movementToken");
    }

    assertValidEnum(item.movementType, INVENTORY_MOVEMENT_TYPE, "movementType");

    if (!item.sku || !String(item.sku).trim()) {
        throw new Error("SCHEMA_VIOLATION: MovimientosInventario requires sku");
    }

    const qty = Number(item.quantityDelta);
    if (!Number.isFinite(qty) || qty === 0) {
        throw new Error("SCHEMA_VIOLATION: MovimientosInventario.quantityDelta must be non-zero number");
    }

    if (!item.recordTimestamp) {
        throw new Error("SCHEMA_VIOLATION: MovimientosInventario requires recordTimestamp");
    }
    if (!item.traceId || !String(item.traceId).trim()) {
        throw new Error("SCHEMA_VIOLATION: MovimientosInventario requires traceId");
    }

    // AJUSTE requiere reason
    if (item.movementType === INVENTORY_MOVEMENT_TYPE.AJUSTE) {
        if (!item.reason || !String(item.reason).trim()) {
            throw new Error("SCHEMA_VIOLATION: AJUSTE requires reason");
        }
    }

    return true;
}

// =============================================================================
// MAPA STAFF (v8.1 schema, C-01/C-02/C-03)
// =============================================================================

/* R2/DUP-01: _GUID_RE local ELIMINADO. Regex GUID canonicas:
 * isValidGuid (internalConfig, backend SSOT) / _looksLikeGuid (mmUtils,
 * frontend). R2: assertMapaStaff ELIMINADO (coleccion MapaStaff no existe
 * en CMS KEY FIELDS; cero consumidores tras reescritura de staff.js v9). */

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
