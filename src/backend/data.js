/*
P4 OFFICIAL REFERENCE: dev.wix.com — Velo Wix Data beforeInsert API.
The hook is a CMS and Data API write boundary: validate append-only physical TPV
movements separately from fiscal invoice records.
*/
/*
=============================================================================
MODULE: backend/data.js
VERSION: v5021-TPV-PHYSICAL-LEDGER-SEPARATED
REPO: https://github.com/nachoortegazgz/marianmadridz.git
RESPONSIBILITY: Validación de esquemas CMS con rutas físicas TPV separadas
                de las validaciones fiscales de documentos.
STANDARDS: G10 ASCII Strict. Cero suppressAuth. Historical fields are read-only; persisted fields are canonical.
=============================================================================
*/

import {
    BUSINESS_COLLECTIONS,
    CATALOG_ENTRY_TYPE,
    CONTROL_TYPE,
    FISCAL_ROLE,
    MOVEMENT_HISTORICAL_READ_ALIASES,
    normalizeMovementKeys,
    OPERATIONAL_COLLECTIONS,
    TPV_LEDGER_SOURCE,
    TPV_EVENT_MOVEMENT_TYPES,
    TPV_LEGACY_EVENT_MOVEMENT_TYPES,
    TPV_HISTORICAL_POLICY,
} from "backend/internalConfig";
import { assertCitasF2, assertCitasF2Insert, assertControlOperativo, assertCanonicalControlFields, assertRegistrosHorariosStaff, assertMapaStaffRecord, assertCajaActualRecord, assertHistoricoCierresZ, assertMovimientosCajaRequiredFields, assertTransaccionesTPVRecord, assertAccountingLedgerRecord, isValidNifOrEuVat as _isValidNifOrEuVat } from "backend/validation";
import { CONSISTENCY, getItem } from "backend/dataAccess";

import { logger } from "backend/logger";
import { createActionableError } from "backend/errors/actionableError";

const log = logger;

// =============================================================================
// HELPERS SSOT-KEYFIELD-02 (2026-10-20) — LECTURA CANONICA DE CAMPOS HISTORICOS
// =============================================================================

export function _readCanonical(item, canonicalKey, historicalKeys = []) {
    if (!item || typeof item !== "object") return undefined;
    const isPresent = (v) => v !== undefined && v !== null && v !== "";
    const direct = item[canonicalKey];
    if (isPresent(direct)) return direct;
    for (const historicalKey of historicalKeys) {
        const v = item[historicalKey];
        if (isPresent(v)) {
            log.warn("historical-field-read", {
                collection: "MovimientosCaja",
                canonicalKey,
                historicalKey,
                docId: item._id ?? null,
            });
            return v;
        }
    }
    return undefined;
}

const MOVIMIENTOS_CAJA_PHYSICAL_FIELDS = Object.freeze({
    nifEmisor: "NIFEmisor",
    nifDestinatario: "NIFDestinatario",
    irpfWithholdingRate: "IRPFWithholdingRate",
    irpfWithholdingAmount: "IRPFWithholdingAmount",
});

export function readMovementField(item, canonicalKey) {
    const aliases = MOVEMENT_HISTORICAL_READ_ALIASES[canonicalKey] || [];
    const value = _readCanonical(item, canonicalKey, aliases);
    if (value !== undefined && value !== null && value !== "") return value;
    const physicalField = MOVIMIENTOS_CAJA_PHYSICAL_FIELDS[canonicalKey];
    return physicalField && item && typeof item === "object"
        ? item[physicalField] ?? null
        : null;
}

function _normalizeMovimientosCajaPhysicalFields(item, toPhysical) {
    for (const [canonical, physical] of Object.entries(MOVIMIENTOS_CAJA_PHYSICAL_FIELDS)) {
        if (toPhysical) {
            if (item[canonical] !== undefined && item[canonical] !== null) {
                item[physical] = item[canonical];
            }
            delete item[canonical];
        } else {
            if ((item[canonical] === undefined || item[canonical] === null) &&
                item[physical] !== undefined && item[physical] !== null) {
                item[canonical] = item[physical];
            }
            delete item[physical];
        }
    }
    return item;
}

function _normalizeMovimientosCajaObjectFields(item) {
    if (Array.isArray(item.lineItems)) {
        item.lineItems = { items: item.lineItems };
    }

    const nestedFields = {};
    if ("aeatPayload" in item) {
        nestedFields.aeatPayload = item.aeatPayload;
        delete item.aeatPayload;
    }
    if ("customerEmail" in item) {
        nestedFields.customerEmail = item.customerEmail;
        delete item.customerEmail;
    }
    if (Object.keys(nestedFields).length > 0) {
        if (item.payloadFiscal == null) item.payloadFiscal = {};
        if (typeof item.payloadFiscal !== "object" || Array.isArray(item.payloadFiscal)) {
            _schemaError("payloadFiscal debe ser OBJECT en MovimientosCaja");
        }
        item.payloadFiscal = { ...item.payloadFiscal, ...nestedFields };
    }
    return item;
}

export function readInvoiceNumber(item) {
    return readMovementField(item, "numSerieFactura");
}

export function readInvoiceIssueDate(item) {
    return readMovementField(item, "fechaExpedicionFactura");
}

export function readTotalAmount(item) {
    // MATRIZ v15: totalAmount es clave canonica propia (total cobrado con
    // impuestos); "importeTotal" se tolera solo como alias historico via el
    // contrato unico MOVEMENT_HISTORICAL_READ_ALIASES.
    return Number(readMovementField(item, "totalAmount")) || 0;
}

export function readBaseAmount(item) {
    // MATRIZ v15: amount es clave canonica propia (importe base) hasta cerrar
    // el ADR de la formula fiscal; aliases historicos via contrato unico.
    return Number(readMovementField(item, "amount")) || 0;
}

export function readTaxBase(item) {
    return Number(readMovementField(item, "taxBase")) || 0;
}

export function readTaxAmount(item) {
    return Number(readMovementField(item, "taxAmount")) || 0;
}

export function readInvoiceType(item) {
    return _safeTrim(readMovementField(item, "tipoFactura")).toUpperCase();
}

export function readIssuerTaxId(item) {
    return _safeTrim(readMovementField(item, "nifEmisor"));
}

export function readRecipientTaxId(item) {
    return _safeTrim(readMovementField(item, "nifDestinatario"));
}

// MATRIZ v15 (MovimientosCaja): la huella canonica del dominio caja/fiscal es
// "hash"; "recordHash" es alias historico tolerado SOLO via contrato unico
// (MOVEMENT_HISTORICAL_READ_ALIASES). Nadie debe volver a acceder a item.recordHash
// ni item.hash directamente en el ledger.
export function readMovementHash(item) {
    return _safeTrim(readMovementField(item, "hash") ?? "");
}

/**
 * Normalize a CMS DATETIME field at the data-hook boundary.
 * Wix Data stores date-time values as Date objects; accepting ISO strings
 * from older callers without conversion can persist the wrong CMS type.
 * Missing optional fields remain untouched; invalid supplied values fail fast.
 */
function _normalizeCmsDateTime(item, fieldName) {
    if (!item || typeof item !== "object") return item;
    const value = item[fieldName];
    if (value === undefined || value === null || value === "") return item;

    let dateValue = value;
    if (value && typeof value === "object" && !(value instanceof Date) && value.$date) {
        dateValue = value.$date;
    }
    const normalized = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (!(normalized instanceof Date) || Number.isNaN(normalized.getTime())) {
        _schemaError(`${fieldName} debe ser una fecha/hora válida (DATETIME)`);
    }
    item[fieldName] = normalized;
    return item;
}

function _normalizeCmsDateTimes(item, fieldNames) {
    for (const fieldName of fieldNames) _normalizeCmsDateTime(item, fieldName);
    return item;
}

export function readRecipientLegalName(item) {
    return _safeTrim(readMovementField(item, "recipientLegalName"));
}

export function readOperationDate(item) {
    return readMovementField(item, "fechaOperacion");
}

export function readRecordTimestamp(item) {
    return readMovementField(item, "recordTimestamp");
}

export function readSurchargeAmount(item) {
    return Number(readMovementField(item, "surchargeAmount")) || 0;
}

export function readFiscalPayload(item) {
    return readMovementField(item, "payloadFiscal");
}

export function readBreakdown(item) {
    return readMovementField(item, "desgloseDetallado");
}

// =============================================================================
// CONSTANTES
// =============================================================================

const GUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LEDGER_SCHEMA_VERSION_AEAT = "LEDGER_V5_FISCAL";

const VALID_ITEM_NATURES = new Set([
    "SERVICIO_PROPIO", "PRODUCTO_VENTA", "PRODUCTO_USO", "GASTO_FIJO",
    "SERVICIO", "PRODUCTO",
]);

const VALID_TAX_CODES = new Set([
    "IVA_21", "IVA_10", "IVA_4", "IVA_0",
    "IRPF_15", "IRPF_19", "EXENTO",
    "IVA",
]);

const VALID_EVENT_TYPES = new Set([
    "VENTA_LINEA", "COMPRA_LINEA", "CIERRE_Z",
    "AJUSTE", "RECTIFICATIVA",
]);

const VALID_FISCAL_ROLES = new Set(["EMISOR", "RECEPTOR"]);

// =============================================================================
// HELPERS
// =============================================================================

function _safeTrim(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
}

function _isGuid(value) {
    return GUID_PATTERN.test(_safeTrim(value));
}

function _isFiniteNonNegative(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0;
}

function _schemaError(message) {
    throw new Error(`SCHEMA_VIOLATION: ${message}`);
}

function _fiscalError(message) {
    throw new Error(`FISCAL_VIOLATION: ${message}`);
}

function _roundItem(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : 0;
}

function _isV5Fiscal(item) {
    return _safeTrim(item?.schemaVersion) === LEDGER_SCHEMA_VERSION_AEAT;
}

function _readBreakdownBaseAndTax(item) {
    let base = 0;
    let tax = 0;
    const breakdown = readBreakdown(item);
    if (breakdown) {
        try {
            const arr = typeof breakdown === "string" ? JSON.parse(breakdown) : breakdown;
            if (Array.isArray(arr) && arr.length > 0) {
                base = arr.reduce(
                    (sum, d) => sum + Number(d.taxableBaseOrNonSubjectAmount ?? d.baseImponibleOImporteNoSujeto ?? d.base ?? 0),
                    0
                );
                tax = arr.reduce(
                    (sum, d) => sum + Number(d.chargedTaxAmount ?? d.cuotaRepercutida ?? d.cuota ?? 0),
                    0
                );
            }
        } catch (e) {
            _schemaError("detailedBreakdown/desgloseDetallado no es JSON valido");
        }
    }
    return { base, tax };
}

function _validateF1Requirements(item) {
    if (readInvoiceType(item) !== "F1") return;
    const pf = item.fiscalPayload || item.payloadFiscal || {};
    const taxId = readRecipientTaxId(item) || _safeTrim(pf.nifDestinatario);
    const legalName = readRecipientLegalName(item) || _safeTrim(pf.nombreRazonDestinatario);
    const address = item.recipientAddress || pf.domicilioDestinatario || {};

    if (!taxId) _schemaError("Factura F1 exige recipientTaxId");
    if (!legalName) _schemaError("Factura F1 exige recipientLegalName");
    if (!address || !_safeTrim(address.cp)) _schemaError("Factura F1 exige recipientAddress con CP");
}

function _validateReverseCharge(item) {
    if (item.reverseCharge !== true) return;
    if (readTaxAmount(item) > 0) _schemaError("reverseCharge implica taxAmount = 0");
}

function _validateAjuste(item) {
    if (_safeTrim(item.eventType).toUpperCase() !== "AJUSTE") return;
    if (!_safeTrim(item.previousInvoiceId)) _schemaError("eventType=AJUSTE exige previousInvoiceId");
}

function _validateFiscalRole(item) {
    const role = _safeTrim(item.fiscalRole).toUpperCase();
    if (!role) return;
    if (!VALID_FISCAL_ROLES.has(role)) _schemaError("fiscalRole invalido (EMISOR|RECEPTOR)");
}

function _validateFiscalPayload(item) {
    if (!_isV5Fiscal(item)) return;
    const eventType = _safeTrim(item.eventType).toUpperCase();
    if (!eventType || !VALID_EVENT_TYPES.has(eventType)) _schemaError("eventType obligatorio y valido");

    if (eventType !== "CIERRE_Z") {
        if (item.thirdPartyId != null && item.thirdPartyId !== "" && !_isGuid(item.thirdPartyId)) {
            _schemaError("thirdPartyId debe ser TEXT opaco; no se interpreta como FK");
        }
        // Contraparte/logistica: VENTA_LINEA/COMPRA_LINEA exigen al menos una
        // de las dos referencias operativas canonicas (producto del catalogo
        // o tercero de la compra), SALVO asientos sellados con hash de
        // integridad valido (cadena verificada): un asiento ya firmado y
        // cuadrado no puede reescribirse, asi que su referencia operativa se
        // audita via verificador contra el ledger, no duplicando FKs.
        // AJUSTE es un movimiento interno sin contraparte externa.
        const sealedLedgerEntry = /^[0-9a-f]{64}$/i.test(readMovementHash(item));
        if (["VENTA_LINEA", "COMPRA_LINEA"].includes(eventType)) {
            if (!sealedLedgerEntry && !_isGuid(item.catalogId) && !_isGuid(item.thirdPartyId)) {
                _schemaError("catalogId obligatorio (FK ServiciosCatalogo)");
            }
        } else if (eventType === "RECTIFICATIVA") {
            if (!_safeTrim(item.previousInvoiceId) && !_isGuid(item.catalogId) && !_isGuid(item.thirdPartyId)) {
                _schemaError("RECTIFICATIVA exige previousInvoiceId o contraparte fiscal");
            }
        }
        const hasAeatBreakdown =
            (Array.isArray(item.desgloseDetallado) && item.desgloseDetallado.length > 0) ||
            (Array.isArray(item.detailedBreakdown) && item.detailedBreakdown.length > 0);
        const hasSnapshot =
            (item.fiscalPayload && typeof item.fiscalPayload === "object") ||
            (item.payloadFiscal && typeof item.payloadFiscal === "object");
        const hasFiscalCounterparty = _isGuid(item.thirdPartyId) || _isGuid(item.catalogId);
        const hasIntegrityHash = /^[0-9a-f]{64}$/i.test(readMovementHash(item));
        if (!hasAeatBreakdown && !hasSnapshot && !hasFiscalCounterparty && !hasIntegrityHash) {
            _schemaError("fiscalPayload obligatorio (snapshot AEAT)");
        }
    }

    if (item.sequenceNumber !== undefined && item.sequenceNumber !== null && item.sequenceNumber !== "") {
        const sequenceNumber = Number(item.sequenceNumber);
        if (!Number.isSafeInteger(sequenceNumber) || sequenceNumber <= 0) {
            _schemaError("sequenceNumber invalido (debe ser un entero > 0)");
        }
    }

    const isInternalAdjustment = eventType === "AJUSTE";
    if (!isInternalAdjustment && !readMovementHash(item)) {
        _schemaError("hash obligatorio (cadena SHA-256)");
    }
}

// =============================================================================
// BLOQUE 1 - MOVIMIENTOS DE CAJA
// =============================================================================

export function MovimientosCaja_beforeInsert(item) {
    if (!item || typeof item !== "object") return item;
    _normalizeCmsDateTimes(item, ["generationTimestamp", "recordTimestamp", "fechaEnvioAEAT"]);

    // Normalize the CMS's uppercase physical identifiers into the internal
    // domain names before validation. The final persisted item is converted
    // back to the exact CMS field IDs at the end of this hook.
    _normalizeMovimientosCajaPhysicalFields(item, false);

    // BLOQUE DE INTEGRIDAD (v13.0, HOOK-CAJA-01/02/05): las guardas duras de
    // trazabilidad y cadena de hash se evaluan PRIMERO, antes que cualquier
    // validacion AEAT especifica de dominio. Un registro sin traceId,
    // schemaVersion o hash es inadmitible con independencia del eventType.
    if (!_safeTrim(item.traceId)) {
        _schemaError("traceId obligatorio en el ledger fiscal (trazabilidad Ley 11/2021)");
    }
    if (!_safeTrim(item.schemaVersion)) {
        _schemaError("schemaVersion obligatorio (LEDGER_V5_FISCAL)");
    }
    // Normalize the historical recordHash input before checking the
    // canonical hash. This promotion is explicit and destructive: new stored
    // MovimientosCaja records must contain hash, never recordHash.
    normalizeMovementKeys(item);
    const ledgerHash = readMovementHash(item);
    if (!ledgerHash) {
        _schemaError("hash obligatorio (cadena SHA-256 de integridad del asiento)");
    }

    const taxId = readRecipientTaxId(item);
    if (taxId && !_isValidNifOrEuVat(taxId)) {
        _schemaError("nifDestinatario no tiene formato valido (espanol o VAT UE)");
    }

    const { base, tax } = _readBreakdownBaseAndTax(item);
    const finalBase = base > 0 ? base : readTaxBase(item);
    const finalTax = tax > 0 ? tax : readTaxAmount(item);

    const withholding = Number(item.irpfWithholdingAmount) || 0;
    const surcharge = readSurchargeAmount(item);
    const total = readTotalAmount(item);

    if (finalBase > 0 || finalTax > 0 || withholding > 0 || surcharge > 0) {
        const role = _safeTrim(item.fiscalRole).toUpperCase() || FISCAL_ROLE.EMISOR;
        const withholdingFactor = role === FISCAL_ROLE.RECEPTOR ? 1 : -1;
        const expected = _roundItem(finalBase + finalTax + surcharge + withholdingFactor * withholding);
        const diff = Math.abs(expected - total);
        if (diff > 0.02) {
            _schemaError(
                `Cuadre fiscal invalido (rol ${role}): base ${finalBase} + cuota ${finalTax} + recargo ${surcharge} ${withholdingFactor > 0 ? "+" : "-"} retencion ${withholding} = ${expected.toFixed(2)}, total ${total.toFixed(2)}`
            );
        }
    }

    _validateF1Requirements(item);
    _validateReverseCharge(item);
    _validateAjuste(item);
    _validateFiscalRole(item);
    _validateFiscalPayload(item);

    const breakdownArr = readBreakdown(item);
    if (Array.isArray(breakdownArr) && breakdownArr.length > 0) {
        let sumBase = 0;
        let sumTax = 0;
        for (const d of breakdownArr) {
            sumBase += Number(d.taxableBaseOrNonSubjectAmount ?? d.base ?? 0);
            sumTax += Number(d.chargedTaxAmount ?? d.cuota ?? 0);
        }
        if (Math.abs(_roundItem(sumBase) - finalBase) > 0.02) {
            _schemaError(`desgloseDetallado.base (${sumBase}) no cuadra con cabecera (${finalBase})`);
        }
        if (Math.abs(_roundItem(sumTax) - finalTax) > 0.02) {
            _schemaError(`desgloseDetallado.cuota (${sumTax}) no cuadra con cabecera (${finalTax})`);
        }
    }

    if (item.catalogId) {
        const payloadRegimeKey = _safeTrim(readFiscalPayload(item)?.claveRegimen);
        const itemRegimeKey = _safeTrim(item.claveRegimen);
        if (payloadRegimeKey && itemRegimeKey && payloadRegimeKey !== itemRegimeKey) {
            _schemaError("claveRegimen no coincide con payloadFiscal.claveRegimen");
        }
    }

    _normalizeMovimientosCajaObjectFields(item);
    assertMovimientosCajaRequiredFields(item);
    _normalizeMovimientosCajaPhysicalFields(item, true);
    return item;
}

export async function MovimientosCaja_beforeUpdate(item) {
    return MovimientosCaja_beforeInsert(item);
}

export function MovimientosCaja_beforeRemove() {
    throw createActionableError({
        code: "MOVIMIENTOS_CAJA_APPEND_ONLY",
        userMessage: "No se puede borrar un movimiento de caja.",
        technicalDetail: "MovimientosCaja es un ledger append-only.",
        remediation: [
            "Registrar una devolución o ajuste compensatorio.",
            "Usar el flujo TPV correspondiente.",
            "Conservar el registro histórico original.",
        ],
        contextSnapshot: {
            collection: BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA,
            operation: "REMOVE",
        },
        retryable: false,
    });
}

export function LibroAsientosContablesDetalle_beforeInsert(item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
        _schemaError("LibroAsientosContablesDetalle item invalido");
    }
    _normalizeCmsDateTime(item, "recordTimestamp");
    assertAccountingLedgerRecord(item);
    return item;
}

export function LibroAsientosContablesDetalle_beforeUpdate(item) {
    return LibroAsientosContablesDetalle_beforeInsert(item);
}

export function LibroAsientosContablesDetalle_beforeRemove() {
    throw createActionableError({
        code: "ACCOUNTING_LEDGER_APPEND_ONLY",
        userMessage: "No se puede borrar un asiento contable.",
        technicalDetail: "El libro contable es append-only.",
        remediation: [
            "Registrar una rectificación formal.",
            "No modificar el asiento original.",
            "Consultar el traceId en los registros técnicos.",
        ],
        contextSnapshot: {
            operation: "REMOVE",
        },
        retryable: false,
    });
}

// =============================================================================
// BLOQUE 2 - CIERRES Z
// =============================================================================

export function HistoricoCierresZ_beforeInsert(item) {
    if (!item || typeof item !== "object") return item;
    _normalizeCmsDateTimes(item, ["closedAt", "verifiedAt", "sentAt"]);
    assertHistoricoCierresZ(item);
    return item;
}

// Wix Data beforeUpdate hook: https://dev.wix.com/docs/velo/apis/wix-data/hooks/before-update
export function HistoricoCierresZ_beforeUpdate(item) {
    _normalizeCmsDateTimes(item, ["closedAt", "verifiedAt", "sentAt"]);
    assertHistoricoCierresZ(item);
    return item;
}

export function HistoricoCierresZ_beforeRemove() {
    _fiscalError("Borrado de HistoricoCierresZ prohibido: registro fiscal append-only");
}

// =============================================================================
// BLOQUE 3 - REGISTROS HORARIOS
// =============================================================================

export function RegistrosHorariosStaff_beforeInsert(item) {
    if (!item || typeof item !== "object") return item;
    _normalizeCmsDateTimes(item, ["recordedAt", "recordedTime"]);
    assertRegistrosHorariosStaff(item);
    return item;
}

export function RegistrosHorariosStaff_beforeUpdate(item) {
    return RegistrosHorariosStaff_beforeInsert(item);
}

export function RegistrosHorariosStaff_beforeRemove() {
    _fiscalError("Borrado de RegistrosHorariosStaff prohibido: registro horario append-only (RD 8/2019)");
}

// =============================================================================
// BLOQUE 4 - CAJA ACTUAL
// =============================================================================

function _normalizeCajaSequenceCounters(item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
        return item;
    }

    const value = item.sequenceCounters;
    if (value === undefined || value === null) {
        return item;
    }

    let parsed = value;
    if (typeof value === "string") {
        try {
            parsed = JSON.parse(value);
        } catch {
            _schemaError("CajaActual.sequenceCounters debe ser un objeto JSON valido");
        }
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        _schemaError("CajaActual.sequenceCounters debe ser un objeto JSON valido");
    }

    item.sequenceCounters = parsed;
    return item;
}

function _clearStaleCajaClosedAt(item) {
    if (_safeTrim(item?.cashRegisterStatus).toUpperCase() !== "ABIERTA" ||
        !item?.openedAt || !item?.closedAt) return item;
    const openedAt = item.openedAt instanceof Date ? item.openedAt : new Date(item.openedAt);
    const closedAt = item.closedAt instanceof Date ? item.closedAt : new Date(item.closedAt);
    if (!Number.isNaN(openedAt.getTime()) &&
        !Number.isNaN(closedAt.getTime()) &&
        closedAt.getTime() < openedAt.getTime()) {
        item.closedAt = null;
    }
    return item;
}

function _normalizeCajaTpvRuntime(item) {
    const runtime = item?.conceptOperations?.tpvRuntime;
    const snapshotSource = _safeTrim(item?.snapshotSource).toUpperCase();
    const isTpvRuntime = runtime !== undefined || snapshotSource.startsWith("TPV");
    if (isTpvRuntime) {
        _schemaError("TPV_OPERATIONAL_LEDGER_NOT_CONFIGURED: CajaActual no admite nuevas proyecciones TPV hasta disponer del contrato canónico.");
    }
    return item;
}

export function CajaActual_beforeInsert(item) {
    if (!item || typeof item !== "object") return item;
    _normalizeCmsDateTimes(item, ["openedAt", "closedAt", "lastMovementAt"]);
    _normalizeCajaSequenceCounters(item);
    _clearStaleCajaClosedAt(item);
    _normalizeCajaTpvRuntime(item);
    assertCajaActualRecord(item);
    const key = _safeTrim(item.singletonKey || item._id);
    if (key !== "CAJA_PRINCIPAL") {
        _schemaError("CajaActual es SINGLE_ITEM: solo admite el singleton 'CAJA_PRINCIPAL'");
    }
    return item;
}

export async function CajaActual_beforeUpdate(item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
        _schemaError("CajaActual beforeUpdate requiere un item valido");
    }
    const itemId = _safeTrim(item._id);
    if (!itemId) _schemaError("CajaActual beforeUpdate requiere _id para recuperar el estado previo");

    // Wix UpdateHookContext documents collectionName, userId and userRole;
    // it does not provide context.original. Read the persisted item directly.
    const persisted = await getItem(
        BUSINESS_COLLECTIONS.CAJA_ACTUAL,
        itemId,
        CONSISTENCY.STRONG
    );
    if (!persisted || String(persisted._id || "") !== itemId) {
        _schemaError("CajaActual beforeUpdate no pudo recuperar el estado previo");
    }

    _normalizeCmsDateTimes(item, ["openedAt", "closedAt", "lastMovementAt"]);
    const previous = { ...persisted };
    _normalizeCajaSequenceCounters(previous);
    _normalizeCajaSequenceCounters(item);
    if (item.sequenceCounters === undefined && typeof persisted.sequenceCounters === "string") {
        item.sequenceCounters = previous.sequenceCounters;
    }
    const merged = { ...previous, ...item };
    _clearStaleCajaClosedAt(merged);
    if (merged.closedAt === null && _safeTrim(merged.cashRegisterStatus).toUpperCase() === "ABIERTA") {
        item.closedAt = null;
    }
    assertCajaActualRecord(merged);
    const prevSeq = { ...(previous?.sequenceCounters || {}) };
    const nextSeq = { ...((item?.sequenceCounters ?? previous?.sequenceCounters) || {}) };

    // The single CajaActual principal stores both fiscal counters and
    // projection idempotency metadata; keep appliedMovementIds independent.
    delete prevSeq.appliedMovementIds;
    delete nextSeq.appliedMovementIds;

    if (
        JSON.stringify(prevSeq) !== JSON.stringify(nextSeq) &&
        _safeTrim(item?.singletonKey) !== "CAJA_PRINCIPAL"
    ) {
        log.warn("CajaActual_beforeUpdate: sequenceCounters modified outside CAJA_PRINCIPAL", { _id: item?._id });
    }
    return item;
}

export function CajaActual_beforeRemove() {
    throw new Error("SINGLETON_PROTECTED: No se puede eliminar el estado de caja");
}

// =============================================================================
// BLOQUE 5 - SERVICIOS CATALOGO
// =============================================================================

export function ServiciosCatalogo_beforeInsert(item) {
    return _validateServiciosCatalogoSchema(item);
}

export function ServiciosCatalogo_beforeUpdate(item) {
    return _validateServiciosCatalogoSchema(item);
}

function _validateServiciosCatalogoSchema(item = {}) {
    // Normalize historical caller aliases into the physical CMS keys and remove
    // the aliases before the document reaches Wix Data.
    if (!item.itemNature && item.naturalezaItem) item.itemNature = item.naturalezaItem;
    if (!item.codigoImpuesto && item.taxCode) item.codigoImpuesto = item.taxCode;
    delete item.naturalezaItem;
    delete item.taxCode;

    const serviceReference = _safeTrim(item.serviceId);
    const pricingPlanReference = _safeTrim(item.pricingPlanId);
    let catalogEntryType = _safeTrim(item.catalogEntryType).toUpperCase();
    if (!catalogEntryType) {
        if (serviceReference && _isGuid(serviceReference) && !pricingPlanReference) {
            catalogEntryType = CATALOG_ENTRY_TYPE.SERVICE;
        } else if (!serviceReference && pricingPlanReference && _isGuid(pricingPlanReference)) {
            catalogEntryType = CATALOG_ENTRY_TYPE.PRICING_PLAN;
        } else {
            _schemaError("catalogEntryType no se puede inferir sin una identidad unica de servicio o plan");
        }
        item.catalogEntryType = catalogEntryType;
    } else {
        item.catalogEntryType = catalogEntryType;
    }
    if (!Object.values(CATALOG_ENTRY_TYPE).includes(catalogEntryType)) {
        _schemaError("catalogEntryType invalido");
    }
    if (catalogEntryType === CATALOG_ENTRY_TYPE.SERVICE &&
        (!_isGuid(serviceReference) || pricingPlanReference)) {
        _schemaError("SERVICE requiere serviceId GUID y no admite pricingPlanId");
    }
    if (catalogEntryType === CATALOG_ENTRY_TYPE.PRICING_PLAN &&
        (!_isGuid(pricingPlanReference) || serviceReference)) {
        _schemaError("PRICING_PLAN requiere pricingPlanId GUID y no admite serviceId");
    }

    const serviceId = _safeTrim(item.serviceId || item._id);
    const linkedPhases = _safeTrim(item.linkedPhases);
    const allowCombine = item.allowCombine === true;

    if (item.serviceId && !_isGuid(item.serviceId)) _schemaError("serviceId debe ser un GUID valido");
    if (allowCombine && !linkedPhases) _schemaError("Servicio dual requiere linkedPhases");
    if (linkedPhases && !_isGuid(linkedPhases)) _schemaError("linkedPhases debe ser un GUID valido");
    if (linkedPhases && linkedPhases === serviceId) _schemaError("linkedPhases no puede referenciar al propio servicio");

    const itemNature = _safeTrim(item.itemNature).toUpperCase();
    if (itemNature && !VALID_ITEM_NATURES.has(itemNature)) _schemaError("itemNature invalido");

    const taxCode = _safeTrim(item.codigoImpuesto).toUpperCase();
    if (taxCode && !VALID_TAX_CODES.has(taxCode)) _schemaError("codigoImpuesto invalido");

    if (allowCombine && (typeof item.exposureDuration !== "number" || !_isFiniteNonNegative(item.exposureDuration))) {
        _schemaError("Servicio dual requiere exposureDuration explicito como numero no negativo");
    }

    const readDuration = (field) => {
        const value = item[field];
        if (value === undefined || value === null || value === "") return 0;
        if (typeof value !== "number") {
            _schemaError(`${field} debe ser numerico`);
        }
        return value;
    };
    const hasTotalDuration =
        item.totalDuration !== undefined &&
        item.totalDuration !== null &&
        item.totalDuration !== "";
    const phase1Duration = readDuration("phase1Duration");
    const exposureDuration = readDuration("exposureDuration");
    const phase2Duration = readDuration("phase2Duration");
    const totalDuration = readDuration("totalDuration");

    if (!_isFiniteNonNegative(phase1Duration) ||
        !_isFiniteNonNegative(exposureDuration) ||
        !_isFiniteNonNegative(phase2Duration) ||
        !_isFiniteNonNegative(totalDuration)) {
        _schemaError("Las duraciones deben ser numeros finitos no negativos");
    }

    if (allowCombine) {
        const expectedDuration =
            phase1Duration + exposureDuration + phase2Duration;

        if (!hasTotalDuration) {
            item.totalDuration = expectedDuration;
        } else if (totalDuration !== expectedDuration) {
            _schemaError(
                `totalDuration (${totalDuration}) debe coincidir exactamente con la suma de fases (${expectedDuration})`
            );
        }
    }

    return item;
}

// =============================================================================
// MapaStaff is the live discriminated master for STAFF, TERCERO, GESTORIA and CONFIG_SISTEMA.
export function MapaStaff_beforeInsert(item) {
    if (!item || typeof item !== "object") return item;
    const recordType = _safeTrim(item.recordType).toUpperCase();
    if (recordType === "CONFIG_SISTEMA") return _applyConfigSistemaRules(item);
    assertMapaStaffRecord(item);
    return item;
}

export function MapaStaff_beforeUpdate(item) {
    if (!item || typeof item !== "object") return item;
    const recordType = _safeTrim(item.recordType).toUpperCase();
    if (recordType === "CONFIG_SISTEMA") return _applyConfigSistemaRules(item);
    assertMapaStaffRecord(item, { partial: true });
    return item;
}

export function MapaStaff_beforeRemove(item) {
    if (_safeTrim(item?._id) === "CONFIG_SISTEMA_FISCAL" ||
        _safeTrim(item?.recordType).toUpperCase() === "CONFIG_SISTEMA") {
        _fiscalError("SINGLETON_PROTECTED: No se puede eliminar CONFIG_SISTEMA_FISCAL");
    }
    return item;
}

const MAPA_STAFF_CONFIG_FORBIDDEN_FIELDS = [
    "producerTaxId", "producerLegalName", "computerSystemId",
    "installationNumber", "possibleUseMultiOT", "possibleUseOnlyVerifactu",
    "multipleOTIndicator", "verifactuStartDate", "nifProductor",
    "nombreRazonProductor", "idSistemaInformatico", "sistemaInformaticoNombre",
    "numeroInstalacion", "tipoUsoPosibleSoloVerifactu", "bookingsResourceId",
    "resourceIdBookings", "memberId", "registrationTraceId",
];

function _applyConfigSistemaRules(item) {
    for (const field of MAPA_STAFF_CONFIG_FORBIDDEN_FIELDS) {
        if (item[field] !== undefined && item[field] !== null) {
            _schemaError(`Campo "${field}" no permitido en MapaStaff CONFIG_SISTEMA`);
        }
    }
    if (!item._id) item._id = "CONFIG_SISTEMA_FISCAL";
    if (_safeTrim(item._id) !== "CONFIG_SISTEMA_FISCAL") {
        _schemaError("CONFIG_SISTEMA debe usar el ID singleton CONFIG_SISTEMA_FISCAL");
    }
    if (item.taxId != null) item.taxId = _safeTrim(item.taxId);
    if (item.thirdPartyType != null) item.thirdPartyType = _safeTrim(item.thirdPartyType);
    if (item.fechaInicioVerifactu != null && item.fechaInicioVerifactu !== "") {
        const value = item.fechaInicioVerifactu instanceof Date
            ? item.fechaInicioVerifactu.toISOString().slice(0, 10)
            : _safeTrim(item.fechaInicioVerifactu);
        if (!value) _schemaError("fechaInicioVerifactu no puede contener solo espacios");
        item.fechaInicioVerifactu = value;
    }
    assertMapaStaffRecord(item);
    return item;
}

// BLOQUE 7 - CONTROL OPERATIVO (ADR-05, SSOT v13.0)
// =============================================================================

// WEBHOOK_EVENT is an immutable audit record. DISPLAY_TOKEN is an ephemeral
// bearer credential and must be atomically removable for one-use consumption.

/**
 * Reads only the canonical structured payload. Retired fields are rejected
 * at the CMS write boundary and are not interpreted here.
 */
export function readControlPayload(doc) {
    if (!doc || typeof doc !== "object") return {};
    return doc.payload && typeof doc.payload === "object" && !Array.isArray(doc.payload)
        ? doc.payload
        : {};
}

export function TransaccionesTPV_beforeInsert(item) {
    try {
        assertTransaccionesTPVRecord(item);
        return item;
    } catch (error) {
        _schemaError(error?.message || "TPV_COMMERCIAL_RECORD_INVALID");
    }
}

export async function TransaccionesTPV_beforeUpdate(item) {
    const id = _safeTrim(item?._id);
    if (!id) _schemaError("TransaccionesTPV update requires _id");

    const original = await getItem(
        BUSINESS_COLLECTIONS.TRANSACCIONES_TPV,
        id,
        CONSISTENCY.STRONG
    );

    try {
        assertTransaccionesTPVRecord(item);
        return item;
    } catch (error) {
        _schemaError(error?.message || "TPV_COMMERCIAL_RECORD_INVALID");
    }
}

export async function TransaccionesTPV_beforeRemove(itemId) {
    const id = typeof itemId === "string"
        ? itemId.trim()
        : _safeTrim(itemId?._id);

    if (!id) {
        _schemaError("TransaccionesTPV remove requires _id");
    }

    const existing = await getItem(
        BUSINESS_COLLECTIONS.TRANSACCIONES_TPV,
        id,
        CONSISTENCY.STRONG
    );

    if (!existing) {
        _schemaError("TransaccionesTPV remove target not found");
    }

    throw createActionableError({
        code: "TPV_TRANSACTIONS_APPEND_ONLY",
        userMessage: "No se puede borrar una transacción TPV.",
        technicalDetail: "TransaccionesTPV conserva la intención comercial y su trazabilidad.",
        remediation: [
            "Registrar una devolución formal cuando corresponda.",
            "No eliminar la transacción original.",
            "Usar el flujo TPV de devoluciones.",
        ],
        contextSnapshot: {
            collection: BUSINESS_COLLECTIONS.TRANSACCIONES_TPV,
            operation: "REMOVE",
            recordId: id,
        },
        retryable: false,
    });
}

export function ControlOperativo_beforeInsert(item) {
    _normalizeCmsDateTimes(item, [
        "expiresAt", "windowStart", "processedAt", "heartbeatAt",
    ]);
    assertCanonicalControlFields(item);
    if ([CONTROL_TYPE.TPV_TEST_RUN, CONTROL_TYPE.TPV_TEST_SESSION_LOCK].includes(item.controlType)) _schemaError("TPV_HISTORICAL_RUNTIME_WRITE_DISABLED");
    // Insert recibe el registro completo: proteger el discriminador y los
    // invariantes minimos del control antes de persistirlo.
    assertControlOperativo(item);
    return item;
}

export async function ControlOperativo_beforeUpdate(item) {
    const id = _safeTrim(item?._id);
    if (!id) _schemaError("ControlOperativo update requires _id");

    const original = await getItem(
        OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO,
        id,
        CONSISTENCY.STRONG
    );
    if (!original) _schemaError("ControlOperativo update target not found");

    const normalized = { ...original, ...item };
    _normalizeCmsDateTimes(normalized, [
        "expiresAt", "windowStart", "processedAt", "heartbeatAt",
    ]);
    if ([CONTROL_TYPE.TPV_TEST_RUN, CONTROL_TYPE.TPV_TEST_SESSION_LOCK].includes(original.controlType)) _schemaError("TPV_HISTORICAL_RUNTIME_WRITE_DISABLED");
    assertCanonicalControlFields(normalized);
    if (normalized.controlType !== original.controlType) {
        _fiscalError("ControlOperativo.controlType es inmutable");
    }
    assertControlOperativo(normalized);
    return normalized;
}

export async function ControlOperativo_beforeRemove(itemId) {
    const id = typeof itemId === "string"
        ? itemId.trim()
        : _safeTrim(itemId?._id);
    if (!id) _schemaError("ControlOperativo remove requires itemId");

    const original = await getItem(
        OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO,
        id,
        CONSISTENCY.STRONG
    );
    if (!original) _schemaError("ControlOperativo remove target not found");
    if ([CONTROL_TYPE.TPV_TEST_RUN, CONTROL_TYPE.TPV_TEST_SESSION_LOCK].includes(original.controlType)) _schemaError("TPV_HISTORICAL_RUNTIME_WRITE_DISABLED");
    if (original.controlType === "WEBHOOK_EVENT") {
        throw createActionableError({ code: "RECORD_DELETE_FORBIDDEN", userMessage: "No se pueden borrar eventos webhook.", technicalDetail: "ControlOperativo/WEBHOOK_EVENT removal denied.", contextSnapshot: { collection: OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO, controlType: original.controlType, operation: "REMOVE" }, retryable: false });
    }
    return id;
}

// =============================================================================
// BLOQUE 17 - CITAS F2 (INTEGRIDAD DE RESERVAS)
// =============================================================================

// CitasF2 is a mutable booking projection, not an append-only ledger.
// Keep the SSOT structural guard at the CMS boundary as a second barrier to
// the booking saga's point-of-use validation. Wix binds hooks to the physical
// collection ID (not its display name); the current site uses the canonical CitasF2 ID.
function _validateCitasF2Write(item, { insert = false } = {}) {
    _normalizeCmsDateTimes(item, [
        "slotStart", "slotEnd",
        "privacyNoticeAcceptedAt", "invoicingDate",
    ]);
    if (insert) assertCitasF2Insert(item);
    else assertCitasF2(item);
    return item;
}

function _blockCitasF2Remove() {
    _fiscalError("Borrado directo de CitasF2 bloqueado: use cancelacion formal de reserva");
}

// Production/historical collection ID.
export function CitasF2_beforeInsert(item) {
    return _validateCitasF2Write(item, { insert: true });
}

export function CitasF2_beforeUpdate(item) {
    return _validateCitasF2Write(item);
}

export function CitasF2_beforeRemove() {
    return _blockCitasF2Remove();
}

// =============================================================================
// BLOQUE 18 - COMPLEMENTOS CATALOGO
// =============================================================================

export function ComplementosCatalogo_beforeInsert(item) { return _validateComplementosCatalogo(item); }
export function ComplementosCatalogo_beforeUpdate(item) { return _validateComplementosCatalogo(item); }

function _validateComplementosCatalogo(item) {
    if (!item || typeof item !== "object") return item;

    if (item._id != null && typeof item._id !== "string") {
        _schemaError("_id debe ser TEXT en ComplementosCatalogo");
    }
    if (item.addonId != null && typeof item.addonId !== "string") {
        _schemaError("addonId debe ser TEXT en ComplementosCatalogo");
    }
    if (item.sku != null && typeof item.sku !== "string") {
        _schemaError("sku debe ser TEXT en ComplementosCatalogo");
    }
    for (const field of ["itemNature", "codigoImpuesto", "claveRegimen", "cuentaContableIngreso"]) {
        if (item[field] != null && typeof item[field] !== "string") {
            _schemaError(`${field} debe ser TEXT en ComplementosCatalogo`);
        }
    }

    const cmsId = _safeTrim(item._id);
    const mirrorId = _safeTrim(item.addonId);
    const canonicalId = cmsId || mirrorId;
    if (!canonicalId) _schemaError("_id canonico (o addonId legado para adopcion) obligatorio en ComplementosCatalogo");
    if (cmsId && mirrorId && cmsId !== mirrorId) {
        _schemaError("addonId espejo debe coincidir con _id canonico en ComplementosCatalogo");
    }

    // addonId remains a required physical mirror until its CMS field is retired.
    if (!cmsId) item._id = canonicalId;
    if (!mirrorId) item.addonId = canonicalId;

    if (!_safeTrim(item.sku)) _schemaError("sku obligatorio en ComplementosCatalogo");
    if (item.price !== undefined &&
        (typeof item.price !== "number" || !Number.isFinite(item.price) || item.price < 0)) {
        _schemaError("price debe ser NUMBER finito no negativo en ComplementosCatalogo");
    }
    if (item.durationMinutes !== undefined &&
        (typeof item.durationMinutes !== "number" || !Number.isFinite(item.durationMinutes) || item.durationMinutes < 0)) {
        _schemaError("durationMinutes debe ser NUMBER finito no negativo en ComplementosCatalogo");
    }
    if (typeof item.taxIncluded !== "boolean") {
        _schemaError("taxIncluded obligatorio y BOOLEAN en ComplementosCatalogo");
    }
    if (item.tipoImpositivo !== undefined &&
        (typeof item.tipoImpositivo !== "number" || !Number.isFinite(item.tipoImpositivo) ||
            item.tipoImpositivo < 0 || item.tipoImpositivo > 1)) {
        _schemaError("tipoImpositivo debe ser una tasa NUMBER entre 0 y 1 en ComplementosCatalogo");
    }
    if (item.traceId != null && item.traceId !== "") {
        _schemaError("traceId no tiene contrato activo en ComplementosCatalogo");
    }
    if (item.name != null && typeof item.name !== "string") {
        _schemaError("name debe ser TEXT en ComplementosCatalogo");
    }
    if (item.ServiciosCatalogo_name != null &&
        (!Array.isArray(item.ServiciosCatalogo_name) ||
            item.ServiciosCatalogo_name.some((id) => typeof id !== "string"))) {
        _schemaError("ServiciosCatalogo_name debe ser MULTI_REFERENCE en ComplementosCatalogo");
    }
    return item;
}

// =============================================================================
