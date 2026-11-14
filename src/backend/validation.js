import {
    CITAS_BOOKING_STATUS,
    CITAS_PAYMENT_STATUS,
    BOOKING_TYPE,
    CONTROL_TYPE,
    CLOCK_EVENT_TYPE,
    RECORD_TYPE_HORARIOS,
    RECORD_TYPE,
    THIRD_PARTY_TYPE,
    isValidGuid,
    normalizeBookingType,
    isDualBookingType,
    CONTROL_OPERATIVO_NON_CANONICAL_FIELDS,
} from "backend/internalConfig";


const EU_VAT_PREFIXES = Object.freeze([
    "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "EL", "ES",
    "FI", "FR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT",
    "NL", "PL", "PT", "RO", "SE", "SI", "SK", "XI",
]);

const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

/**
 * Comprueba que un valor pertenece al enum canónico recibido.
 * No normaliza silenciosamente el valor: los escritores deben entregar
 * exactamente el literal definido por internalConfig.
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

function _isValidSpanishTaxId(value) {
    const clean = String(value ?? "").trim().toUpperCase().replace(/[-\\s]/g, "");
    if (!clean || clean.length < 8) return false;

    if (/^\\d{8}[A-Z]$/.test(clean)) {
        const number = Number(clean.slice(0, 8));
        return clean.charAt(8) === DNI_LETTERS[number % 23];
    }
    if (/^[XYZ]\\d{7}[A-Z]$/.test(clean)) {
        const prefix = { X: "0", Y: "1", Z: "2" }[clean.charAt(0)];
        const number = Number(prefix + clean.slice(1, 8));
        return clean.charAt(8) === DNI_LETTERS[number % 23];
    }
    // Se conserva el contrato estructural previo para CIF/NIF de persona jurídica.
    return /^[ABCDEFGHJKLMNPQRSUVW]\\d{7}[0-9A-J]$/.test(clean);
}

/**
 * Validador fiscal compartido. Mantiene el mismo contrato de NIF/NIE/CIF y
 * VAT-UE que utilizaban los hooks de data.js; no depende de una colección CMS.
 */
export function isValidNifOrEuVat(value) {
    const clean = String(value ?? "").trim().toUpperCase().replace(/[-\\s]/g, "");
    if (!clean) return false;
    if (_isValidSpanishTaxId(clean)) return true;

    if (clean.length >= 8 && clean.length <= 14) {
        const prefix = clean.slice(0, 2);
        if (EU_VAT_PREFIXES.includes(prefix)) {
            return /^[A-Z0-9]{5,12}$/.test(clean.slice(2));
        }
    }
    return false;
}

// =============================================================================
// DATOS FISCALES (Ley 11/2021, Veri*Factu)
// =============================================================================

/**
 * Valida el contrato de identidad fiscal de MapaStaff para registros TERCERO.
 * El acceso a esta funcion es obligatorio desde data.js y desde otros hooks
 * que persisten documentos fiscales. El helper es puro: lanza Error cuando el
 * dominio fiscal es invalido.
 */
export function assertDatosFiscales(item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new Error("SCHEMA_VIOLATION: DatosFiscales item must be an object");
    }

    const taxId = String(item.taxId ?? "").trim();
    const legalName = String(item.legalName ?? "").trim();
    const thirdPartyType = String(item.thirdPartyType ?? "").trim();

    if (taxId && !isValidNifOrEuVat(taxId)) {
        throw new Error("SCHEMA_VIOLATION: DatosFiscales.taxId must be valid NIF/NIE/CIF/VAT-UE");
    }
    if (!taxId && item.taxId !== undefined && item.taxId !== null && item.taxId !== "") {
        throw new Error("SCHEMA_VIOLATION: DatosFiscales.taxId cannot be empty");
    }
    if (!legalName) {
        throw new Error("SCHEMA_VIOLATION: DatosFiscales.legalName is required");
    }
    if (thirdPartyType && !Object.values(THIRD_PARTY_TYPE).includes(thirdPartyType.toUpperCase())) {
        throw new Error("SCHEMA_VIOLATION: DatosFiscales.thirdPartyType is invalid");
    }

    return true;
}

/**
 * Valida la identidad fiscal de MapaStaff.
 * Esta version conserva la semantica de validacion del schema fisico CMS y
 * compatibiliza los registros TERCERO/GESTORIA/CONFIG_SISTEMA con los hooks.
 */
export function assertMapaStaffRecord(item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new Error("SCHEMA_VIOLATION: MapaStaff item must be an object");
    }

    assertValidEnum(item.recordType, RECORD_TYPE, "recordType");

    if (item.recordType === RECORD_TYPE.STAFF) {
        if (!isValidGuid(item.staffMemberId) || !isValidGuid(item.resourceId)) {
            throw new Error("SCHEMA_VIOLATION: MapaStaff STAFF requires staffMemberId and resourceId GUIDs");
        }
        return true;
    }

    if (Number(item.schemaVersion) !== 1) {
        throw new Error("SCHEMA_VIOLATION: MapaStaff.schemaVersion must be 1");
    }
    if (!item.traceId || !String(item.traceId).trim()) {
        throw new Error("SCHEMA_VIOLATION: MapaStaff.traceId is required");
    }

    if (item.recordType === RECORD_TYPE.GESTORIA) {
        const email = String(item.email || item.gestorEmail || "").trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error("SCHEMA_VIOLATION: MapaStaff GESTORIA requires a valid contact email");
        }
        if (!String(item.name || item.legalName || "").trim()) {
            throw new Error("SCHEMA_VIOLATION: MapaStaff GESTORIA requires name or legalName");
        }
        if ("memberId" in item || "staffMemberId" in item || "resourceId" in item ||
            "rolWebsite" in item || "rolBookings" in item) {
            throw new Error("SCHEMA_VIOLATION: GESTORIA cannot carry site identity or staff roles");
        }
        return true;
    }

    if (item.recordType === RECORD_TYPE.CONFIG_SISTEMA) {
        if (item.taxId && !isValidNifOrEuVat(item.taxId)) {
            throw new Error("SCHEMA_VIOLATION: MapaStaff.taxId must be valid NIF/NIE/CIF/VAT-UE when supplied");
        }
        if (item.legalName != null && item.legalName !== "" &&
            !String(item.legalName).trim()) {
            throw new Error("SCHEMA_VIOLATION: MapaStaff.legalName must be non-empty when supplied");
        }
        if (item.thirdPartyType != null && item.thirdPartyType !== "") {
            throw new Error("SCHEMA_VIOLATION: CONFIG_SISTEMA.thirdPartyType must be null");
        }
    } else {
        if (!item.taxId || !String(item.taxId).trim()) {
            throw new Error("SCHEMA_VIOLATION: MapaStaff TERCERO requires taxId");
        }
        if (!isValidNifOrEuVat(item.taxId)) {
            throw new Error("SCHEMA_VIOLATION: MapaStaff.taxId must be valid NIF/NIE/CIF/VAT-UE");
        }
        if (!item.legalName || !String(item.legalName).trim()) {
            throw new Error("SCHEMA_VIOLATION: MapaStaff TERCERO requires legalName");
        }
        assertValidEnum(item.thirdPartyType, THIRD_PARTY_TYPE, "thirdPartyType");
    }

    return true;
}
