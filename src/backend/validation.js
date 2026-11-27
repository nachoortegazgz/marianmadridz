/*
=============================================================================
MODULE: backend/validation.js
RESPONSIBILITY: Pure validation for CMS write boundaries and fiscal identity.
CONTRACT: Validators return true or throw SCHEMA_VIOLATION; no logging or I/O.
DEPENDENCIES: backend/internalConfig only.
DOMAINS: CitasF2, MapaStaff, MapaStaff, ControlOperativo, RegistrosHorariosStaff,
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
    CASH_REGISTER_STATUS,
    isValidGuid,
    normalizeBookingType,
    isDualBookingType,
    CONTROL_OPERATIVO_NON_CANONICAL_FIELDS,
    CHANNEL_TYPE,
    MOVEMENT_TYPE,
    PAYMENT_METHOD,
    TIPO_FACTURA,
    TPV_LEDGER_SOURCE,
    TPV_EVENT_MOVEMENT_TYPES,
    TPV_RUNTIME_POLICY,
} from "backend/internalConfig";

// =============================================================================
// ASSERT VALID ENUM (unica funcion de validacion generica)
// =============================================================================

/**
 * Valida que value es miembro del enum object.
 * Lanza Error con codigo SCHEMA_VIOLATION si no lo es.
 * Rechaza undefined/null; la opcionalidad debe resolverse explicitamente en el llamador.
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

export function assertCitasF2Insert(item) {
    assertCitasF2(item);
    for (const field of ["serviceId", "resourceId"]) {
        if (!isValidGuid(item[field])) {
            throw new Error(`SCHEMA_VIOLATION: CitasF2 requires valid GUID ${field}`);
        }
    }
    for (const field of ["slotStart", "slotEnd"]) {
        const date = item[field] instanceof Date ? item[field] : new Date(item[field]);
        if (!item[field] || Number.isNaN(date.getTime())) {
            throw new Error(`SCHEMA_VIOLATION: CitasF2 requires valid DATETIME ${field}`);
        }
    }
    const start = item.slotStart instanceof Date ? item.slotStart : new Date(item.slotStart);
    const finish = item.slotEnd instanceof Date ? item.slotEnd : new Date(item.slotEnd);
    if (finish.getTime() <= start.getTime()) {
        throw new Error("SCHEMA_VIOLATION: CitasF2 slotEnd must be after slotStart");
    }
    if (typeof item.totalAmount !== "number" || !Number.isFinite(item.totalAmount) || item.totalAmount < 0) {
        throw new Error("SCHEMA_VIOLATION: CitasF2 requires finite totalAmount >= 0");
    }
    if (!_isValidDateOnly(item.dateYmd)) {
        throw new Error("SCHEMA_VIOLATION: CitasF2 requires DATE dateYmd");
    }
    return true;
}

// =============================================================================
// COLECCIONES FISCALES: CONTRATOS DE INSERCION FISICOS
// =============================================================================

function _isValidDateOnly(value) {
    if (value instanceof Date) return !Number.isNaN(value.getTime());
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function assertHistoricoCierresZ(item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new Error("SCHEMA_VIOLATION: HistoricoCierresZ item must be an object");
    }
    for (const field of ["traceId", "fiscalPeriod", "closedBy", "recordDomain"]) {
        if (!String(item[field] ?? "").trim()) {
            throw new Error(`SCHEMA_VIOLATION: HistoricoCierresZ requires ${field}`);
        }
    }
    for (const field of ["closeDate", "operationDate"]) {
        if (!_isValidDateOnly(item[field])) {
            throw new Error(`SCHEMA_VIOLATION: HistoricoCierresZ requires valid DATE ${field}`);
        }
    }
    for (const field of [
        "totalTaxAmount", "totalTaxBase", "totalOnline",
        "totalBizum", "totalCard", "totalCash",
    ]) {
        if (typeof item[field] !== "number" || !Number.isFinite(item[field])) {
            throw new Error(`SCHEMA_VIOLATION: HistoricoCierresZ requires finite NUMBER ${field}`);
        }
    }
    return true;
}

export function assertAccountingLedgerRecord(item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new Error("SCHEMA_VIOLATION: LibroAsientosContablesDetalle item must be an object");
    }
    for (const field of [
        "_id", "journalEntryId", "operationDescription", "movementType",
        "recordSource", "documentId", "fiscalPeriod", "traceId",
    ]) {
        if (typeof item[field] !== "string" || !item[field].trim()) {
            throw new Error(`SCHEMA_VIOLATION: LibroAsientosContablesDetalle requires TEXT ${field}`);
        }
    }
    if (String(item.journalEntryId).length > 128 ||
        String(item.operationDescription).length > 250 ||
        String(item.movementType).length > 50 ||
        String(item.recordSource).length > 100 ||
        String(item.documentId).length > 128) {
        throw new Error("SCHEMA_VIOLATION: LibroAsientosContablesDetalle text field exceeds its contract");
    }
    if (!(item.recordTimestamp instanceof Date) || Number.isNaN(item.recordTimestamp.getTime())) {
        throw new Error("SCHEMA_VIOLATION: LibroAsientosContablesDetalle requires DATETIME recordTimestamp");
    }
    if (!_isValidDateOnly(item.fechaOperacion) ||
        !/^\d{4}-\d{2}$/.test(String(item.fiscalPeriod)) ||
        String(item.fechaOperacion instanceof Date ? item.fechaOperacion.toISOString().slice(0, 10) : item.fechaOperacion).slice(0, 7) !== String(item.fiscalPeriod)) {
        throw new Error("SCHEMA_VIOLATION: LibroAsientosContablesDetalle requires matching fechaOperacion/fiscalPeriod");
    }
    if (!Number.isSafeInteger(item.sequenceNumber) || item.sequenceNumber < 1) {
        throw new Error("SCHEMA_VIOLATION: LibroAsientosContablesDetalle requires positive sequenceNumber");
    }
    for (const field of ["amount", "accountingAmount", "accountingSign"]) {
        if (typeof item[field] !== "number" || !Number.isFinite(item[field])) {
            throw new Error(`SCHEMA_VIOLATION: LibroAsientosContablesDetalle requires finite NUMBER ${field}`);
        }
    }
    if (item.amount <= 0 || ![1, -1].includes(item.accountingSign)) {
        throw new Error("SCHEMA_VIOLATION: LibroAsientosContablesDetalle amount/accountingSign invalid");
    }
    const detail = item.desgloseDetallado;
    if (!detail || typeof detail !== "object" || Array.isArray(detail) ||
        typeof detail.accountCode !== "string" || !/^\d{6}$/.test(detail.accountCode)) {
        throw new Error("SCHEMA_VIOLATION: LibroAsientosContablesDetalle requires desgloseDetallado.accountCode");
    }
    const debit = detail.debitAmount;
    const credit = detail.creditAmount;
    if (typeof debit !== "number" || !Number.isFinite(debit) || debit < 0 ||
        typeof credit !== "number" || !Number.isFinite(credit) || credit < 0 ||
        (debit > 0 && credit > 0) || (debit === 0 && credit === 0) ||
        Math.abs(item.amount - Math.max(debit, credit)) > 0.009 ||
        Math.abs(item.accountingAmount - (debit - credit)) > 0.009 ||
        item.accountingSign !== (debit > 0 ? 1 : -1)) {
        throw new Error("SCHEMA_VIOLATION: LibroAsientosContablesDetalle debit/credit projection invalid");
    }
    if (!/^[a-f0-9]{64}$/i.test(String(item.hash || "")) ||
        !/^[a-f0-9]{64}$/i.test(String(item.previousRecordHash || ""))) {
        throw new Error("SCHEMA_VIOLATION: LibroAsientosContablesDetalle requires SHA-256 chain hashes");
    }
    if (detail.cashMovementId != null && typeof detail.cashMovementId !== "string") {
        throw new Error("SCHEMA_VIOLATION: LibroAsientosContablesDetalle.cashMovementId must be TEXT");
    }
    return true;
}

export function assertFiscalMovementInputEnums(item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new Error("SCHEMA_VIOLATION: fiscal movement input must be an object");
    }
    assertValidEnum(item.movementType, MOVEMENT_TYPE, "movementType");
    assertValidEnum(item.paymentMethod, PAYMENT_METHOD, "paymentMethod");
    assertValidEnum(item.channelType, CHANNEL_TYPE, "channelType");
    assertValidEnum(item.tipoFactura || TIPO_FACTURA.F1, TIPO_FACTURA, "tipoFactura");
    return true;
}

export function assertMovimientosCajaRequiredFields(item) {
    if (item?.recordSource === TPV_LEDGER_SOURCE) {
        if (!Object.values(TPV_EVENT_MOVEMENT_TYPES).includes(String(item.movementType || ""))) {
            throw new Error("SCHEMA_VIOLATION: TPV physical movementType invalid");
        }
        for (const field of ["transactionId", "previousRecordHash", "schemaVersion", "traceId", "paymentMethod", "channelType", "operationDescription", "staffResourceId"]) {
            if (!String(item[field] ?? "").trim()) throw new Error("SCHEMA_VIOLATION: TPV physical MovimientosCaja requires " + field);
        }
        for (const field of ["amount", "sequenceNumber", "totalAmount"]) {
            if (typeof item[field] !== "number" || !Number.isFinite(item[field])) {
                throw new Error("SCHEMA_VIOLATION: TPV physical MovimientosCaja requires finite NUMBER " + field);
            }
        }
        if (!Number.isSafeInteger(item.sequenceNumber) || item.sequenceNumber <= 0) {
            throw new Error("SCHEMA_VIOLATION: TPV physical sequenceNumber must be positive");
        }
        if (!(item.recordTimestamp instanceof Date) || Number.isNaN(item.recordTimestamp.getTime())) {
            throw new Error("SCHEMA_VIOLATION: TPV physical recordTimestamp must be DATETIME");
        }
        if (!/^[a-f0-9]{64}$/i.test(String(item.hash || "")) ||
            !/^[a-f0-9]{64}$/i.test(String(item.previousRecordHash || ""))) {
            throw new Error("SCHEMA_VIOLATION: TPV physical SHA-256 chain invalid");
        }
        const envelope = item.payloadFiscal;
        if (!envelope || typeof envelope !== "object" || Array.isArray(envelope) ||
            envelope.sourceType !== TPV_RUNTIME_POLICY.SOURCE_TYPE ||
            envelope.siteId !== TPV_RUNTIME_POLICY.SITE_ID ||
            envelope.ledgerVersion !== TPV_RUNTIME_POLICY.LEDGER_VERSION ||
            !String(envelope.sessionId || "").trim() ||
            !String(envelope.logicalCollection || "").trim() ||
            !String(envelope.idempotencyKey || "").trim() ||
            !/^[a-f0-9]{64}$/i.test(String(envelope.requestFingerprint || ""))) {
            throw new Error("SCHEMA_VIOLATION: TPV physical envelope invalid");
        }
        return true;
    }
    if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new Error("SCHEMA_VIOLATION: MovimientosCaja item must be an object");
    }
    const textFields = [
        "numSerieFactura", "transactionId", "previousRecordHash", "schemaVersion",
        "traceId", "movementType", "paymentMethod", "channelType",
        "operationDescription", "staffResourceId", "tipoFactura", "fiscalPeriod",
    ];
    for (const field of textFields) {
        if (!String(item[field] ?? "").trim()) {
            throw new Error(`SCHEMA_VIOLATION: MovimientosCaja requires ${field}`);
        }
    }
    for (const field of ["amount", "sequenceNumber", "totalAmount", "tipoImpositivo"]) {
        if (typeof item[field] !== "number" || !Number.isFinite(item[field])) {
            throw new Error(`SCHEMA_VIOLATION: MovimientosCaja requires finite NUMBER ${field}`);
        }
    }
    if (!(item.recordTimestamp instanceof Date) || Number.isNaN(item.recordTimestamp.getTime())) {
        throw new Error("SCHEMA_VIOLATION: MovimientosCaja requires DATETIME recordTimestamp");
    }
    if (!_isValidDateOnly(item.fechaExpedicionFactura)) {
        throw new Error("SCHEMA_VIOLATION: MovimientosCaja requires DATE fechaExpedicionFactura");
    }
    if (!/^[a-f0-9]{64}$/i.test(String(item.hash || "")) ||
        !/^[a-f0-9]{64}$/i.test(String(item.previousRecordHash || ""))) {
        throw new Error("SCHEMA_VIOLATION: MovimientosCaja requires SHA-256 hash chain fields");
    }
    if (!Number.isSafeInteger(item.sequenceNumber) || item.sequenceNumber <= 0) {
        throw new Error("SCHEMA_VIOLATION: MovimientosCaja.sequenceNumber must be a positive integer");
    }
    assertValidEnum(item.movementType, MOVEMENT_TYPE, "movementType");
    assertValidEnum(item.paymentMethod, PAYMENT_METHOD, "paymentMethod");
    assertValidEnum(item.channelType, CHANNEL_TYPE, "channelType");
    assertValidEnum(item.tipoFactura, TIPO_FACTURA, "tipoFactura");
    return true;
}

// =============================================================================
// DATOS FISCALES (Ley 11/2021, Veri*Factu)
// =============================================================================

/**
 * Valida el contrato operativo vigente de MapaStaff.
 * Los identificadores Wix conservan sus dominios: staffMemberId, resourceId,
 * scheduleId y memberId no son intercambiables. thirdPartyId es un campo TEXT
 * legado opaco y no se interpreta como GUID ni como FK fiscal.
 */
export function assertMapaStaffRecord(item, { partial = false } = {}) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new Error("SCHEMA_VIOLATION: MapaStaff item must be an object");
    }
    const recordType = String(item.recordType || "").trim();
    assertValidEnum(recordType, RECORD_TYPE, "recordType");

    if (recordType === RECORD_TYPE.STAFF) {
        for (const field of ["staffMemberId", "resourceId", "scheduleId"]) {
            if (!isValidGuid(item[field])) {
                throw new Error(`SCHEMA_VIOLATION: MapaStaff STAFF requires ${field} GUID`);
            }
        }
        if (item.memberId != null && item.memberId !== "" && !isValidGuid(item.memberId)) {
            throw new Error("SCHEMA_VIOLATION: MapaStaff.memberId must be a valid Wix GUID when supplied");
        }
        if (item.thirdPartyId != null && typeof item.thirdPartyId !== "string") {
            throw new Error("SCHEMA_VIOLATION: MapaStaff.thirdPartyId must be TEXT when supplied");
        }
        if (item.schemaVersion !== undefined &&
            (!Number.isSafeInteger(Number(item.schemaVersion)) || Number(item.schemaVersion) < 1)) {
            throw new Error("SCHEMA_VIOLATION: MapaStaff.schemaVersion must be a positive integer");
        }
        return true;
    }

    if (!partial) {
        if (Number(item.schemaVersion) !== 1) {
            throw new Error("SCHEMA_VIOLATION: MapaStaff fiscal records require schemaVersion=1");
        }
        if (!String(item.traceId || "").trim()) {
            throw new Error("SCHEMA_VIOLATION: MapaStaff fiscal records require traceId");
        }
    }
    return assertMapaStaffFiscalRecord(item, { partial });
}

export function assertCajaActualRecord(item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new Error("SCHEMA_VIOLATION: CajaActual item must be an object");
    }
    if (item.recordTimestamp !== undefined &&
        (!(item.recordTimestamp instanceof Date) || Number.isNaN(item.recordTimestamp.getTime()))) {
        throw new Error("SCHEMA_VIOLATION: CajaActual.recordTimestamp must be DATETIME");
    }
    if (item.sequenceCounters !== undefined && item.sequenceCounters !== null &&
        (typeof item.sequenceCounters !== "object" || Array.isArray(item.sequenceCounters))) {
        throw new Error("SCHEMA_VIOLATION: CajaActual.sequenceCounters must be an OBJECT");
    }
    if (item.sequenceCounters && Object.prototype.hasOwnProperty.call(item.sequenceCounters, "appliedMovementIds") &&
        !Array.isArray(item.sequenceCounters.appliedMovementIds)) {
        throw new Error("SCHEMA_VIOLATION: CajaActual.sequenceCounters.appliedMovementIds must be an ARRAY");
    }
    return true;
}

/**
 * Validates fiscal identity records in the live, discriminated MapaStaff master.
 */
function assertMapaStaffFiscalRecord(item, { partial = false } = {}) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new Error("SCHEMA_VIOLATION: MapaStaff item must be an object");
    }
    assertValidEnum(item.recordType, {
        TERCERO: RECORD_TYPE.TERCERO,
        GESTORIA: RECORD_TYPE.GESTORIA,
        CONFIG_SISTEMA: RECORD_TYPE.CONFIG_SISTEMA,
    }, "recordType");

    if (item.recordType === RECORD_TYPE.CONFIG_SISTEMA) {
        const activationAt = item.productionActivationAt;
        if (activationAt != null && activationAt !== "") {
            const activationDate = activationAt instanceof Date
                ? activationAt
                : (typeof activationAt === "string" && /Z$/.test(activationAt) ? new Date(activationAt) : null);
            if (!activationDate || Number.isNaN(activationDate.getTime())) {
                throw new Error("SCHEMA_VIOLATION: MapaStaff.productionActivationAt must be a valid UTC DATETIME");
            }
        }
        const hasTaxId = item.taxId != null && String(item.taxId).trim() !== "";
        const hasLegalName = item.legalName != null && String(item.legalName).trim() !== "";
        if (!partial && (!hasTaxId || !hasLegalName)) {
            throw new Error("SCHEMA_VIOLATION: MapaStaff CONFIG_SISTEMA requires taxId and legalName");
        }
        if (item.taxId && !isValidNifOrEuVat(item.taxId)) {
            throw new Error("SCHEMA_VIOLATION: MapaStaff.taxId must be valid NIF/NIE/CIF/VAT-UE");
        }
        if (item.legalName != null && item.legalName !== "" && !String(item.legalName).trim()) {
            throw new Error("SCHEMA_VIOLATION: MapaStaff.legalName must be non-empty when supplied");
        }
        if (item.thirdPartyType != null && item.thirdPartyType !== "") {
            throw new Error("SCHEMA_VIOLATION: CONFIG_SISTEMA.thirdPartyType must be null");
        }
    }

    if (item.recordType === RECORD_TYPE.TERCERO) {
        const hasTaxId = item.taxId != null && String(item.taxId).trim() !== "";
        const hasLegalName = item.legalName != null && String(item.legalName).trim() !== "";
        const hasThirdPartyType = item.thirdPartyType != null && String(item.thirdPartyType).trim() !== "";

        if (!partial && (!hasTaxId || !hasLegalName || !hasThirdPartyType)) {
            throw new Error("SCHEMA_VIOLATION: MapaStaff TERCERO requires taxId, legalName and thirdPartyType");
        }
        if (hasTaxId && !isValidNifOrEuVat(item.taxId)) {
            throw new Error("SCHEMA_VIOLATION: MapaStaff TERCERO requires a valid taxId");
        }
        if (item.legalName !== undefined && !hasLegalName) {
            throw new Error("SCHEMA_VIOLATION: MapaStaff TERCERO legalName must be non-empty when supplied");
        }
        if (hasThirdPartyType) {
            assertValidEnum(String(item.thirdPartyType).trim(), THIRD_PARTY_TYPE, "thirdPartyType");
        }
    } else if (item.recordType === RECORD_TYPE.GESTORIA) {
        const email = String(item.emailFiscal || "").trim();
        const name = String(item.legalName || item.displayName || "").trim();
        const hasTaxId = item.taxId != null && String(item.taxId).trim() !== "";
        if (!partial && (!hasTaxId || !name || item.thirdPartyType !== "GESTORIA")) {
            throw new Error("SCHEMA_VIOLATION: MapaStaff GESTORIA requires taxId, legalName/displayName and thirdPartyType=GESTORIA");
        }
        if (hasTaxId && !isValidNifOrEuVat(item.taxId)) {
            throw new Error("SCHEMA_VIOLATION: MapaStaff GESTORIA requires a valid taxId when supplied");
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error("SCHEMA_VIOLATION: MapaStaff GESTORIA emailFiscal must be valid when supplied");
        }
    }

    for (const field of ["verifactuEnabled", "tipoUsoPosibleMultiOT", "indicadorMultiplesOT"]) {
        if (item[field] !== undefined && item[field] !== null && typeof item[field] !== "boolean") {
            throw new Error(`SCHEMA_VIOLATION: MapaStaff.${field} must be BOOLEAN`);
        }
    }
    if (item.fechaInicioVerifactu != null && item.fechaInicioVerifactu !== "") {
        const value = item.fechaInicioVerifactu instanceof Date
            ? item.fechaInicioVerifactu.toISOString().slice(0, 10)
            : String(item.fechaInicioVerifactu);
        const parsed = new Date(value + "T00:00:00.000Z");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
            Number.isNaN(parsed.getTime()) ||
            parsed.toISOString().slice(0, 10) !== value) {
            throw new Error("SCHEMA_VIOLATION: MapaStaff.fechaInicioVerifactu must be a real YYYY-MM-DD date");
        }
    }
    return true;
}
// =============================================================================
// CONTROL OPERATIVO
// =============================================================================

const CONTROL_OPERATIVO_PHYSICAL_FIELDS = new Set([
    "_id", "_createdDate", "_updatedDate", "_owner", "_revision",
    "eventType", "controlType", "dedupeKey", "traceId", "status",
    "eventId", "expiresAt", "bookingId", "resourceId", "serviceId",
    "dateYmd", "attempts", "surface", "requesterKey", "requestCount",
    "windowStart", "payload", "version", "heartbeatAt", "ownerToken",
    "transactionId", "orderId", "refundId", "kind", "processedAt",
    "operationDescription", "lastError", "totalAmount",
]);

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
    const unknown = Object.keys(item).filter((field) =>
        !CONTROL_OPERATIVO_PHYSICAL_FIELDS.has(field)
    );
    if (unknown.length) {
        throw new Error(
            `SCHEMA_VIOLATION: ControlOperativo fields absent from live CMS schema: ${unknown.join(", ")}`
        );
    }
    return true;
}

export function assertTransaccionesTPVRecord(item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new Error("SCHEMA_VIOLATION: TransaccionesTPV item must be an object");
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(item._id || ""))) {
        throw new Error("SCHEMA_VIOLATION: TransaccionesTPV._id must be the idempotency UUID");
    }
    for (const field of ["sessionId", "operatorResourceId", "traceId", "requestFingerprint"]) {
        if (!String(item[field] || "").trim()) throw new Error("SCHEMA_VIOLATION: TransaccionesTPV requires " + field);
    }
    if (!/^[a-f0-9]{64}$/i.test(String(item.requestFingerprint))) {
        throw new Error("SCHEMA_VIOLATION: TransaccionesTPV requestFingerprint must be SHA-256");
    }
    if (!Array.isArray(item.lineas) || item.lineas.length === 0 || item.lineas.length > 100) {
        throw new Error("SCHEMA_VIOLATION: TransaccionesTPV requires 1-100 backend-priced lines");
    }
    for (const line of item.lineas) {
        if (!line || !["PRODUCTO", "SERVICIO"].includes(String(line.tipoLinea || "")) ||
            !String(line.itemId || "").trim() ||
            !Number.isSafeInteger(Number(line.cantidad)) || Number(line.cantidad) <= 0) {
            throw new Error("SCHEMA_VIOLATION: TransaccionesTPV line identity or quantity invalid");
        }
        for (const field of ["precioUnitario", "subtotalNeto", "impuestosImporte", "totalLinea"]) {
            if (!Number.isFinite(Number(line[field])) || Number(line[field]) < 0) {
                throw new Error("SCHEMA_VIOLATION: TransaccionesTPV line amount invalid: " + field);
            }
        }
    }
    for (const field of ["subtotalNeto", "impuestosTotal", "totalVenta"]) {
        if (!Number.isFinite(Number(item[field])) || Number(item[field]) < 0) {
            throw new Error("SCHEMA_VIOLATION: TransaccionesTPV amount invalid: " + field);
        }
    }
    for (const field of ["subtotalNetoMinor", "impuestosTotalMinor", "totalVentaMinor"]) {
        if (!Number.isSafeInteger(Number(item[field])) || Number(item[field]) < 0) {
            throw new Error("SCHEMA_VIOLATION: TransaccionesTPV minor amount invalid: " + field);
        }
    }
    if (typeof item.status !== "string" || !item.status.trim() || item.status.length > 40 ||
        item.sourceType !== TPV_RUNTIME_POLICY.SOURCE_TYPE ||
        !(item.recordTimestamp instanceof Date) || Number.isNaN(item.recordTimestamp.getTime()) ||
        item.requiresReconciliation !== (item.orderId == null) ||
        !(item.createdAt instanceof Date) || Number.isNaN(item.createdAt.getTime()) ||
        typeof item.paymentSelection !== "object" || !Array.isArray(item.paymentSelection) ||
        typeof item.currency !== "string" || item.currency !== "EUR") {
        throw new Error("SCHEMA_VIOLATION: TransaccionesTPV state or metadata invalid");
    }
    if (item.orderId !== null && typeof item.orderId !== "string") {
        throw new Error("SCHEMA_VIOLATION: TransaccionesTPV.orderId must be string or null");
    }
    if (item.medioPago !== null && typeof item.medioPago !== "string") {
        throw new Error("SCHEMA_VIOLATION: TransaccionesTPV.medioPago must be string or null");
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
    // The live Wix schema marks payload as required OBJECT. Enforce that
    // physical contract in backend hooks, not only in the CMS editor.
    if (!item.payload || typeof item.payload !== "object" || Array.isArray(item.payload)) {
        throw new Error("SCHEMA_VIOLATION: ControlOperativo requires payload OBJECT");
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
        // traceId is the canonical fencing token for WEBHOOK_CLAIM. The physical ControlOperativo ownerToken column is retired/non-canonical; SLOT_LOCK uses payload.lockOwnerId with version/expiry CAS.
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


    // DISPLAY_TOKEN stores its policy metadata inside the required OBJECT payload.
    if (item.controlType === CONTROL_TYPE.DISPLAY_TOKEN) {
        if (!item.bookingId || !String(item.bookingId).trim()) {
            throw new Error("SCHEMA_VIOLATION: DISPLAY_TOKEN requires bookingId");
        }
        if (!Number.isSafeInteger(Number(item.attempts)) || Number(item.attempts) < 0) {
            throw new Error("SCHEMA_VIOLATION: DISPLAY_TOKEN requires attempts >= 0");
        }
        const expiresAt = new Date(item.expiresAt);
        if (!item.expiresAt || Number.isNaN(expiresAt.getTime())) {
            throw new Error("SCHEMA_VIOLATION: DISPLAY_TOKEN requires a valid expiresAt date");
        }
        if (!Number.isSafeInteger(Number(item.payload.maxAttempts)) || Number(item.payload.maxAttempts) < 1) {
            throw new Error("SCHEMA_VIOLATION: DISPLAY_TOKEN payload requires maxAttempts >= 1");
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
        // Reservation slot locks encode their exact interval in dedupeKey.
        // Fiscal/accounting locks use their own fixed keys and have no slot range.
        if (String(item.dedupeKey || "").startsWith("slot_")) {
            const slotStart = new Date(item.payload?.slotStart);
            const slotEnd = new Date(item.payload?.slotEnd);
            if (
                !item.payload?.slotStart ||
                !item.payload?.slotEnd ||
                Number.isNaN(slotStart.getTime()) ||
                Number.isNaN(slotEnd.getTime()) ||
                slotEnd.getTime() <= slotStart.getTime()
            ) {
                throw new Error(
                    "SCHEMA_VIOLATION: reservation SLOT_LOCK requires valid payload.slotStart and payload.slotEnd DATETIME values"
                );
            }
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

    for (const field of ["recordId", "source", "timeZone", "schemaVersion", "traceId"]) {
        if (!item[field] || !String(item[field]).trim()) {
            throw new Error(`SCHEMA_VIOLATION: RegistrosHorariosStaff requires ${field}`);
        }
    }
    if (!_isValidDateOnly(item.workDate)) {
        throw new Error("SCHEMA_VIOLATION: RegistrosHorariosStaff requires DATE workDate");
    }
    const workDateKey = item.workDate instanceof Date ? item.workDate.toISOString().slice(0, 10) : String(item.workDate);
    if (String(item.dayKey || "") !== workDateKey) {
        throw new Error("SCHEMA_VIOLATION: RegistrosHorariosStaff dayKey must match workDate");
    }
    if (!/^\d{4}-\d{2}$/.test(String(item.monthKey || "")) || String(item.monthKey) !== workDateKey.slice(0, 7)) {
        throw new Error("SCHEMA_VIOLATION: RegistrosHorariosStaff monthKey must match workDate");
    }
    if (!/^[a-f0-9]{64}$/i.test(String(item.recordHash ?? "").trim())) {
        throw new Error("SCHEMA_VIOLATION: RegistrosHorariosStaff requires a 64-character recordHash");
    }

    assertValidEnum(item.clockEventType, CLOCK_EVENT_TYPE, "clockEventType");
    assertValidEnum(item.recordType, RECORD_TYPE_HORARIOS, "recordType");

    const recordedAt = item.recordedAt instanceof Date ? item.recordedAt : new Date(item.recordedAt);
    if (!item.recordedAt || Number.isNaN(recordedAt.getTime())) {
        throw new Error("SCHEMA_VIOLATION: RegistrosHorariosStaff requires valid DATETIME recordedAt");
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
 * Identifica exclusivamente marcadores explícitos de fixtures/smoke.
 * No clasifica por sourceType ni por atributos genéricos del entorno o huellas inválidas.
 */
export function isExplicitSimulationLedgerRecord(item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const upper = (value) => String(value ?? "").trim().toUpperCase();
    const recordSource = upper(item.recordSource);
    const eventType = upper(item.eventType);
    const movementType = upper(item.movementType);
    const projectionStatus = upper(item.projectionStatus);
    const source = upper(item.source);
    const accountCode = upper(item.desgloseDetallado?.accountCode);
    const hash = upper(item.hash);
    const previousRecordHash = upper(item.previousRecordHash);

    const legacyTpvDevelopmentFixture = item.synthetic === true &&
        recordSource === "TPV_QA_DEVELOPMENT" &&
        source === "TPV_FUNCTIONAL_TEST";

    return recordSource === "SMOKE_TEST" ||
        eventType.startsWith("SIMULATED_") ||
        eventType.endsWith("_SIMULATED") ||
        movementType.startsWith("SIMULATED_") ||
        /(?:^|_)SIMULAD[AO]$/.test(movementType) ||
        projectionStatus === "SIMULATED_ONLY" ||
        legacyTpvDevelopmentFixture ||
        accountCode === "SIMULATED" ||
        hash === "SIMULATED_HASH" ||
        previousRecordHash === "SIMULATED_PREVIOUS_HASH";
}

/**
 * Identifica exclusivamente filas de simulacion marcadas de forma explicita.
 * No clasifica como simulacion una fila solo por tener una huella invalida:
 * esos registros deben seguir provocando una alerta de integridad.
 */

