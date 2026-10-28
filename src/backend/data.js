/*
=============================================================================
MODULE: backend/data.js
VERSION: v5016-ZERO-LEGACY
REPO: https://github.com/nachoortegazgz/marianmadridz.git
RESPONSIBILITY: Hooks de inmutabilidad, protecciones append-only y
                validacion estricta de esquemas CMS.
STANDARDS: G10 ASCII Strict. Cero suppressAuth. Cero alias. Cero legacy.
=============================================================================
*/

import {
    BUSINESS_COLLECTIONS,
    FISCAL_ROLE,
    MOVEMENT_LEGACY_READ_ALIASES,
    normalizeMovementKeys,
} from "backend/internalConfig";

import { logger } from "backend/logger";

const log = logger;

// =============================================================================
// HELPERS SSOT-KEYFIELD-02 (2026-10-20) — LECTURA CANONICA CON FALLBACK LEGACY
// =============================================================================

export function _readCanonical(item, canonicalKey, legacyKeys = []) {
    if (!item || typeof item !== "object") return undefined;
    const isPresent = (v) => v !== undefined && v !== null && v !== "";
    const direct = item[canonicalKey];
    if (isPresent(direct)) return direct;
    for (const legacy of legacyKeys) {
        const v = item[legacy];
        if (isPresent(v)) {
            log.warn("legacy-read", {
                collection: "MovimientosCaja",
                canonicalKey,
                legacyKey: legacy,
                docId: item._id ?? null,
            });
            return v;
        }
    }
    return undefined;
}

export function readMovementField(item, canonicalKey) {
    const aliases = MOVEMENT_LEGACY_READ_ALIASES[canonicalKey] || [];
    return _readCanonical(item, canonicalKey, aliases) ?? null;
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
    // contrato unico MOVEMENT_LEGACY_READ_ALIASES.
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
// (MOVEMENT_LEGACY_READ_ALIASES). Nadie debe volver a acceder a item.recordHash
// ni item.hash directamente en el ledger.
export function readMovementHash(item) {
    return _safeTrim(readMovementField(item, "hash") ?? "");
}

/** @deprecated Alias de dominio contable; para MovimientosCaja usa readMovementHash. */
export const readRecordHash = readMovementHash;

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

const ALLOWED_Z_UPDATE_FIELDS = new Set([
    "closingSignature",
    "closingSignatureStatus",
    "csvAEAT",
    "verifiedAt",
    "approverUser",
    "_updatedDate",
]);

const NIF_LETRAS_DNI = "TRWAGMYFPDXBNJZSQVHLCKE";
const LEDGER_SCHEMA_VERSION_AEAT = "LEDGER_V5_FISCAL";

const EU_VAT_PREFIXES_LOCAL = Object.freeze([
    "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "EL", "ES",
    "FI", "FR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT",
    "NL", "PL", "PT", "RO", "SE", "SI", "SK", "XI",
]);

const VALID_THIRD_PARTY_TYPES = new Set([
    "CLIENTE", "PROVEEDOR", "STAFF", "AAPP", "MIXTO", "EMISOR",
]);

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
    "AJUSTE", "RECTIFICATIVA", "MOV_STOCK",
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

function _isValidNifEspanol(nif) {
    const clean = _safeTrim(nif).toUpperCase().replace(/[-\s]/g, "");
    if (!clean || clean.length < 8) return false;

    if (/^\d{8}[A-Z]$/.test(clean)) {
        const numero = Number(clean.slice(0, 8));
        return clean.charAt(8) === NIF_LETRAS_DNI[numero % 23];
    }
    if (/^[XYZ]\d{7}[A-Z]$/.test(clean)) {
        const prefijo = { X: "0", Y: "1", Z: "2" }[clean.charAt(0)];
        const numero = Number(prefijo + clean.slice(1, 8));
        return clean.charAt(8) === NIF_LETRAS_DNI[numero % 23];
    }
    if (/^[ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-J]$/.test(clean)) {
        return true;
    }
    return false;
}

function _isValidNifOrEuVat(nif) {
    const clean = _safeTrim(nif).toUpperCase().replace(/[-\s]/g, "");
    if (!clean) return false;
    if (_isValidNifEspanol(clean)) return true;
    if (clean.length >= 8 && clean.length <= 14) {
        const prefix = clean.slice(0, 2);
        if (EU_VAT_PREFIXES_LOCAL.includes(prefix)) {
            const body = clean.slice(2);
            if (/^[A-Z0-9]{5,12}$/.test(body)) return true;
        }
    }
    return false;
}

const _readTaxableBase = readTaxBase;
const _readTaxAmount = readTaxAmount;
const _readTotalAmount = readTotalAmount;
const _readSurchargeAmount = readSurchargeAmount;
const _readRecipientTaxId = readRecipientTaxId;
const _readRecipientLegalName = readRecipientLegalName;
const _readInvoiceType = readInvoiceType;

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
    if (_readInvoiceType(item) !== "F1") return;
    const pf = item.fiscalPayload || item.payloadFiscal || {};
    const taxId = _readRecipientTaxId(item) || _safeTrim(pf.nifDestinatario);
    const legalName = _readRecipientLegalName(item) || _safeTrim(pf.nombreRazonDestinatario);
    const address = item.recipientAddress || pf.domicilioDestinatario || {};

    if (!taxId) _schemaError("Factura F1 exige recipientTaxId");
    if (!legalName) _schemaError("Factura F1 exige recipientLegalName");
    if (!address || !_safeTrim(address.cp)) _schemaError("Factura F1 exige recipientAddress con CP");
}

function _validateReverseCharge(item) {
    if (item.reverseCharge !== true) return;
    if (_readTaxAmount(item) > 0) _schemaError("reverseCharge implica taxAmount = 0");
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
            _schemaError("thirdPartyId debe ser un GUID valido (FK DatosFiscales)");
        }
        // Contraparte/logistica: VENTA_LINEA/COMPRA_LINEA exigen al menos una
        // de las dos referencias operativas canonicas (producto del catalogo
        // o tercero de la compra), SALVO asientos sellados con hash de
        // integridad valido (cadena verificada): un asiento ya firmado y
        // cuadrado no puede reescribirse, asi que su referencia operativa se
        // audita via verificador contra el ledger, no duplicando FKs.
        // AJUSTE/MOV_STOCK son movimientos internos sin contraparte externa.
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
        if (!Number.isFinite(Number(item.sequenceNumber)) || Number(item.sequenceNumber) <= 0) {
            _schemaError("sequenceNumber invalido (debe ser > 0)");
        }
    }

    const isInternalAdjustment = eventType === "AJUSTE" || eventType === "MOV_STOCK";
    if (!isInternalAdjustment && !readMovementHash(item)) {
        _schemaError("hash obligatorio (cadena SHA-256)");
    }
}

// =============================================================================
// BLOQUE 1 - MOVIMIENTOS DE CAJA
// =============================================================================

export function MovimientosCaja_beforeInsert(item) {
    if (!item || typeof item !== "object") return item;

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

    const taxId = _readRecipientTaxId(item);
    if (taxId && !_isValidNifOrEuVat(taxId)) {
        _schemaError("nifDestinatario no tiene formato valido (espanol o VAT UE)");
    }

    const { base, tax } = _readBreakdownBaseAndTax(item);
    const finalBase = base > 0 ? base : _readTaxableBase(item);
    const finalTax = tax > 0 ? tax : _readTaxAmount(item);

    const withholding = Number(item.irpfWithholdingAmount) || 0;
    const surcharge = _readSurchargeAmount(item);
    const total = _readTotalAmount(item);

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

    return item;
}

export function MovimientosCaja_beforeUpdate() {
    _fiscalError("Modificacion de MovimientosCaja prohibida por normativa fiscal (append-only). Use eventType=AJUSTE.");
}

export function MovimientosCaja_beforeRemove() {
    _fiscalError("Borrado de MovimientosCaja prohibido por normativa fiscal");
}

// =============================================================================
// BLOQUE 2 - CIERRES Z
// =============================================================================

export function HistoricoCierresZ_beforeInsert(item) {
    if (!item || typeof item !== "object") return item;
    if (!_safeTrim(item.traceId)) _schemaError("traceId obligatorio en HistoricoCierresZ (trazabilidad del cierre)");
    return item;
}

export function HistoricoCierresZ_beforeUpdate(item, context) {
    const previous = context?.previous || context?.original || {};
    const hasSnapshot = Boolean(context && (context.previous || context.original));
    const changes = Object.keys(item || {})
        .filter((key) => key !== "_id")
        .filter((key) => !hasSnapshot || String(previous[key]) !== String(item[key]));

    const onlySignatureFields = changes.every((key) => ALLOWED_Z_UPDATE_FIELDS.has(key));
    if (!onlySignatureFields) {
        _fiscalError("HistoricoCierresZ es append-only: solo se permite signature/verification desde recovery.");
    }
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
    if (!_safeTrim(item.traceId)) _schemaError("traceId obligatorio en RegistrosHorariosStaff (RD 8/2019 trazabilidad)");
    return item;
}

export function RegistrosHorariosStaff_beforeUpdate() {
    _fiscalError("Modificacion de RegistrosHorariosStaff prohibida: registro horario append-only (RD 8/2019).");
}

export function RegistrosHorariosStaff_beforeRemove() {
    _fiscalError("Borrado de RegistrosHorariosStaff prohibido: registro horario append-only (RD 8/2019)");
}

// =============================================================================
// BLOQUE 4 - CAJA ACTUAL
// =============================================================================

export function CajaActual_beforeInsert(item) {
    if (!item || typeof item !== "object") return item;
    const key = _safeTrim(item.singletonKey || item._id);
    if (key !== "CAJA_PRINCIPAL" && key !== "CAJA_SEQ") {
        _schemaError("singletonKey en CajaActual debe ser 'CAJA_PRINCIPAL' o 'CAJA_SEQ'");
    }
    return item;
}

export function CajaActual_beforeUpdate(item, context) {
    const previous = context?.original || {};
    const prevSeq = previous?.sequenceCounters;
    const nextSeq = item?.sequenceCounters;

    if (JSON.stringify(prevSeq || {}) !== JSON.stringify(nextSeq || {}) && item?._id !== "CAJA_SEQ") {
        log.warn("CajaActual_beforeUpdate: sequenceCounters modified on non-CAJA_SEQ document", { _id: item?._id });
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
    const serviceId = _safeTrim(item.serviceId || item._id);
    const linkedPhases = _safeTrim(item.linkedPhases);
    const allowCombine = item.allowCombine === true;

    if (item.serviceId && !_isGuid(item.serviceId)) _schemaError("serviceId debe ser un GUID valido");
    if (allowCombine && !linkedPhases) _schemaError("Servicio dual requiere linkedPhases");
    if (linkedPhases && !_isGuid(linkedPhases)) _schemaError("linkedPhases debe ser un GUID valido");
    if (linkedPhases && linkedPhases === serviceId) _schemaError("linkedPhases no puede referenciar al propio servicio");

    const itemNature = _safeTrim(item.itemNature || item.naturalezaItem).toUpperCase();
    if (itemNature && !VALID_ITEM_NATURES.has(itemNature)) _schemaError("itemNature invalido");

    const taxCode = _safeTrim(item.taxCode || item.codigoImpuesto).toUpperCase();
    if (taxCode && !VALID_TAX_CODES.has(taxCode)) _schemaError("taxCode invalido");

    if (allowCombine && (typeof item.exposureDuration !== "number" || !_isFiniteNonNegative(item.exposureDuration))) {
        _schemaError("Servicio dual requiere exposureDuration explicito como numero no negativo");
    }

    const phase1Duration = Number(item.phase1Duration) || 0;
    const exposureDuration = item.exposureDuration === undefined || item.exposureDuration === null || item.exposureDuration === ""
        ? 0
        : Number(item.exposureDuration);
    const phase2Duration = Number(item.phase2Duration) || 0;
    const totalDuration = Number(item.totalDuration) || 0;

    if (!_isFiniteNonNegative(phase1Duration) || !_isFiniteNonNegative(exposureDuration) || !_isFiniteNonNegative(phase2Duration) || !_isFiniteNonNegative(totalDuration)) {
        _schemaError("Las duraciones deben ser numeros no negativos");
    }

    if (allowCombine && totalDuration === 0) {
        const inferred = phase1Duration + exposureDuration + phase2Duration;
        if (inferred > 0) item.totalDuration = inferred;
    }

    if (allowCombine && totalDuration > 0) {
        const expectedDuration = phase1Duration + exposureDuration + phase2Duration;
        if (expectedDuration > 0 && Math.abs(totalDuration - expectedDuration) > 1) {
            _schemaError(`totalDuration (${totalDuration}) no coincide con la suma de fases (${expectedDuration})`);
        }
    }

    return item;
}

// =============================================================================
// BLOQUE 11 - DATOS FISCALES
// =============================================================================

export function DatosFiscales_beforeInsert(item) {
    if (!item || typeof item !== "object") return item;

    const recordTypeEarly = _safeTrim(item.recordType).toUpperCase();
    if (recordTypeEarly === "CONFIG_SISTEMA") return _applyConfigSistemaRules(item);

    const taxId = _safeTrim(item.taxId || item.nifCif);
    if (!taxId || !_isValidNifOrEuVat(taxId)) _schemaError("taxId obligatorio y valido (espanol o VAT UE)");

    const legalName = _safeTrim(item.legalName || item.razonSocial);
    if (!legalName) _schemaError("legalName obligatoria");

    const type = _safeTrim(item.thirdPartyType || item.tipoTercero).toUpperCase();
    if (!type || !VALID_THIRD_PARTY_TYPES.has(type)) {
        _schemaError("thirdPartyType invalido (CLIENTE, PROVEEDOR, STAFF, AAPP, MIXTO, EMISOR)");
    }

    if (type === "STAFF") {
        const bookingsResourceId = _safeTrim(item.bookingsResourceId || item.resourceIdBookings);
        const memberId = _safeTrim(item.memberId);
        if (!_isGuid(bookingsResourceId)) _schemaError("thirdPartyType=STAFF exige bookingsResourceId GUID");
        if (!memberId) _schemaError("thirdPartyType=STAFF exige memberId");
    }

    return item;
}

export function DatosFiscales_beforeUpdate(item) {
    if (!item || typeof item !== "object") return item;
    const recordType = _safeTrim(item.recordType).toUpperCase();
    if (recordType === "CONFIG_SISTEMA") return _applyConfigSistemaRules(item);

    const taxId = _safeTrim(item.taxId || item.nifCif);
    if (taxId && !_isValidNifOrEuVat(taxId)) _schemaError("taxId invalido en update");
    return item;
}

export function DatosFiscales_beforeRemove(item) {
    const id = _safeTrim(item?._id);
    const recType = _safeTrim(item?.recordType).toUpperCase();
    if (id === "CONFIG_SISTEMA_FISCAL" || recType === "CONFIG_SISTEMA") {
        _fiscalError("SINGLETON_PROTECTED: No se puede eliminar el singleton CONFIG_SISTEMA de DatosFiscales");
    }
    return item;
}

// =============================================================================
// BLOQUE 13 - LIBRO ASIENTOS CONTABLES DETALLE (SSOT V2, v5011)
// =============================================================================

const VALID_LIBRO_ORIGEN_TIPOS = new Set([
    "ASIENTOCONTABLE", "EVENTOSISTEMAFACTURACION",
    "MOVIMIENTOCAJA", "CIERREZ", "RECTIFICATIVA",
]);

const LIBRO_LEGACY_WRITE_FIELDS = [
    "entryHash", "fiscalPayloadSnapshot", "computerSystemId",
    // MATRIZ v15 Bloque 2 (campos eliminados): debit/credit quedan erradicados
    // por duplicidad; la partida doble se expresa con debitAmount/creditAmount.
    "debit", "credit",
];

export function LibroAsientosContablesDetalle_beforeInsert(item) {
    if (!item || typeof item !== "object") return item;

    if (!_safeTrim(item.traceId)) _schemaError("traceId obligatorio en el libro definitivo (trazabilidad)");

    // Legacy debit/credit are forbidden even when the rest of the AEAT
    // extension is absent; otherwise missing canonical amounts mask the
    // actual contract violation.
    for (const legacyField of ["debit", "credit"]) {
        if (item[legacyField] !== undefined && item[legacyField] !== null) {
            _schemaError(`Campo legacy "${legacyField}" prohibido; use debitAmount/creditAmount canonicos`);
        }
    }

    // MATRIZ v15: claves canonicas debitAmount/creditAmount (debit/credit
    // erradicados por duplicidad; ver LIBRO_LEGACY_WRITE_FIELDS).
    const debit = Number(item.debitAmount);
    const credit = Number(item.creditAmount);
    if (!Number.isFinite(debit)) {
        _schemaError("debitAmount obligatorio (partida doble PGC: debe > 0)");
    }
    if (!Number.isFinite(credit)) {
        _schemaError("creditAmount obligatorio (partida doble PGC: debe > 0)");
    }
    if (Number.isFinite(debit) && Number.isFinite(credit) && Math.abs(debit - credit) > 0.005) {
        _schemaError(`Partida descuadrada: debitAmount (${debit}) != creditAmount (${credit}) (PGC cuadre estricto)`);
    }

    const hasAeatExtension = _safeTrim(item.origenTipo) || item.payloadFiscal || item.desgloseDetallado;
    if (hasAeatExtension) {
        for (const legacyField of LIBRO_LEGACY_WRITE_FIELDS) {
            if (item[legacyField] !== undefined && item[legacyField] !== null) {
                _schemaError(`Campo legacy "${legacyField}" prohibido en escrituras nuevas; use su equivalente canonico SSOT V2`);
            }
        }

        const origenTipo = _safeTrim(item.origenTipo);
        if (!origenTipo || !VALID_LIBRO_ORIGEN_TIPOS.has(origenTipo)) {
            _schemaError("origenTipo obligatorio y valido (ASIENTOCONTABLE, EVENTOSISTEMAFACTURACION, MOVIMIENTOCAJA, CIERREZ, RECTIFICATIVA)");
        }
        if (!_safeTrim(item.origenRegistro)) _schemaError("origenRegistro obligatorio");
        if (!_safeTrim(item.recordHash)) _schemaError("recordHash obligatorio (cadena SHA-256)");

        const pf = item.payloadFiscal;
        if (!pf || typeof pf !== "object") {
            _schemaError("payloadFiscal obligatorio (snapshot AEAT)");
        } else {
            if (_safeTrim(pf.numSerieFactura) === "" && _safeTrim(pf.descripcionOperacion) === "") {
                _schemaError("payloadFiscal exige al menos numSerieFactura o descripcionOperacion");
            }
        }

        const breakdown = item.desgloseDetallado ?? pf?.desgloseDetallado;
        if (breakdown !== undefined && breakdown !== null && !Array.isArray(breakdown)) {
            _schemaError("desgloseDetallado debe ser un array (claves AEAT en espanol)");
        }

        if (_safeTrim(item.idSistemaInformatico) === "" && _safeTrim(pf?.sistemaInformatico?.idSistemaInformatico) === "") {
            _schemaError("idSistemaInformatico obligatorio");
        }
    }

    if (item.bookingId !== undefined && item.bookingId !== null && !_isGuid(item.bookingId)) _schemaError("bookingId debe ser un GUID valido");
    if (item.orderId !== undefined && item.orderId !== null && !_isGuid(item.orderId)) _schemaError("orderId debe ser un GUID valido");
    if (item.resourceId !== undefined && item.resourceId !== null && !_isGuid(item.resourceId)) _schemaError("resourceId debe ser un GUID valido");

    return item;
}

export function LibroAsientosContablesDetalle_beforeUpdate() {
    _fiscalError("Modificacion de LibroAsientosContablesDetalle prohibida (append-only). Use una linea RECTIFICATIVA.");
}

export function LibroAsientosContablesDetalle_beforeRemove() {
    _fiscalError("Borrado de LibroAsientosContablesDetalle prohibido: registro contable append-only (PGC / Ley 11/2021)");
}

// =============================================================================
// BLOQUE 14 - DATOS FISCALES: singleton CONFIG_SISTEMA (SSOT V2, v5011)
// =============================================================================

const DATOS_FISCALES_LEGACY_WRITE_FIELDS = [
    "producerTaxId", "producerLegalName", "computerSystemId",
    "installationNumber", "possibleUseMultiOT", "possibleUseOnlyVerifactu",
    "multipleOTIndicator", "verifactuStartDate",
];

function _applyConfigSistemaRules(item) {
    for (const legacyField of DATOS_FISCALES_LEGACY_WRITE_FIELDS) {
        if (item[legacyField] !== undefined && item[legacyField] !== null) {
            _schemaError(`Campo legacy "${legacyField}" prohibido en DatosFiscales CONFIG_SISTEMA`);
        }
    }
    for (const required of ["nifProductor", "nombreRazonProductor", "idSistemaInformatico"]) {
        if (!_isValidNifOrEuVat(item[required]) && _safeTrim(item[required]) === "") {
            _schemaError(`${required} obligatorio en el singleton CONFIG_SISTEMA`);
        }
    }
    return item;
}

// =============================================================================
// BLOQUE 7 - CONTROL OPERATIVO (ADR-05, SSOT v13.0)
// =============================================================================

// WEBHOOK_EVENT is an immutable audit record. DISPLAY_TOKEN is an ephemeral
// bearer credential and must be atomically removable for one-use consumption.
const APPEND_ONLY_CONTROL_TYPES = new Set(["WEBHOOK_EVENT"]);

// MATRIZ v15 Bloque 2 (campos eliminados de ControlOperativo): payloadJson ->
// payload (objeto estructurado canonico), createdAt/updatedAt -> campos
// nativos Wix (_createdDate/_updatedDate). Normalizacion destructiva en la
// frontera de persistencia: los docs historicos con payloadJson se promueven
// a "payload" (parseado si es JSON valido; crudos como objeto si no) y las
// claves duplicadas de fechas se eliminan. Cero alias sobrevive al CMS.
export function normalizeControlKeys(item) {
    if (!item || typeof item !== "object") return item;
    if ("payloadJson" in item) {
        const legacyVal = item.payloadJson;
        delete item.payloadJson;
        if (legacyVal !== undefined && legacyVal !== null && legacyVal !== "") {
            let parsed = null;
            if (typeof legacyVal === "string") {
                try { parsed = JSON.parse(legacyVal); } catch (_e) { parsed = null; }
            } else if (typeof legacyVal === "object") {
                parsed = legacyVal;
            }
            if (item.payload === undefined || item.payload === null) {
                item.payload = parsed !== null ? parsed : { raw: String(legacyVal) };
            }
        }
    }
    // createdAt/updatedAt duplicaban los nativos Wix; se erradican del doc.
    delete item.createdAt;
    delete item.updatedAt;
    return item;
}

/** Lectura dual: canon "payload" (objeto) con tolerancia de lectura para
 *  docs historicos que aun conservan "payloadJson" (string JSON). */
export function readControlPayload(doc) {
    if (!doc || typeof doc !== "object") return {};
    if (doc.payload && typeof doc.payload === "object") return doc.payload;
    if (typeof doc.payloadJson === "string" && doc.payloadJson.trim()) {
        try {
            const parsed = JSON.parse(doc.payloadJson);
            if (parsed && typeof parsed === "object") return parsed;
        } catch (_e) { /* doc historico corrupto */ }
    }
    return {};
}

export function ControlOperativo_beforeInsert(item) {
    return normalizeControlKeys(item);
}

export function ControlOperativo_beforeUpdate(item, context) {
    const original = context?.original || item || {};
    if (APPEND_ONLY_CONTROL_TYPES.has(original.controlType)) {
        _fiscalError(`ControlOperativo/${original.controlType} es append-only: modificacion prohibida`);
    }
    return normalizeControlKeys(item);
}

export function ControlOperativo_beforeRemove(item) {
    if (APPEND_ONLY_CONTROL_TYPES.has(item?.controlType)) {
        _fiscalError(`ControlOperativo/${item.controlType} es append-only: borrado prohibido`);
    }
    return item;
}

// =============================================================================
// BLOQUE 15 - MOVIMIENTOS INVENTARIO (APPEND-ONLY LEDGER)
// =============================================================================

const VALID_MOV_INVENTARIO_TYPES = new Set([
    "VENTA", "DEVOLUCION", "AJUSTE", "ENTRADA_STOCK", "SALIDA_STOCK", "TRANSFERENCIA",
]);

export function MovimientosInventario_beforeInsert(item) {
    if (!item || typeof item !== "object") return item;

    if (!_safeTrim(item.traceId)) _schemaError("traceId obligatorio en MovimientosInventario (trazabilidad)");
    if (!_safeTrim(item.movementToken)) _schemaError("movementToken obligatorio (clave de idempotencia)");
    const movementType = _safeTrim(item.movementType).toUpperCase();
    if (!movementType || !VALID_MOV_INVENTARIO_TYPES.has(movementType)) _schemaError("movementType obligatorio y valido");
    if (movementType === "AJUSTE" && !_safeTrim(item.reason)) _schemaError("reason obligatorio cuando movementType=AJUSTE");
    if (item.quantity === undefined || !Number.isFinite(Number(item.quantity))) _schemaError("quantity obligatorio y numerico");

    return item;
}

// DATA-01 (2026-10-20): update/remove hooks intentionally retired. Inventory
// reconciliation is performed by the canonical inventory workflow and cron;
// keeping these Velo hooks duplicated point-of-use controls and blocked repairs.

// =============================================================================
// BLOQUE 16 - INVENTARIO STOCK VENTA (INVARIANTE DE ALMACEN)
// =============================================================================

export function InventarioStockVenta_beforeInsert(item) { return _validateInventarioStockVenta(item); }
// DATA-01: no beforeUpdate hook; stock projections are reconciled by the inventory workflow.

function _validateInventarioStockVenta(item) {
    if (!item || typeof item !== "object") return item;

    const onHand = Number(item.stockOnHand) || 0;
    const reserved = Number(item.stockReserved) || 0;
    if (onHand < 0 || reserved < 0) _schemaError("stockOnHand y stockReserved no pueden ser negativos");

    if (item.stockAvailable === undefined || item.stockAvailable === null) {
        item.stockAvailable = Math.max(0, onHand - reserved);
    } else {
        const available = Number(item.stockAvailable);
        if (available < 0) _schemaError("stockAvailable no puede ser negativo");
        if (Math.abs(available - (onHand - reserved)) > 0.001) {
            _schemaError("Invariante de stock violada: stockAvailable debe ser igual a stockOnHand - stockReserved");
        }
    }
    return item;
}

// =============================================================================
// BLOQUE 17 - CITAS F2 (INTEGRIDAD DE RESERVAS)
// =============================================================================

// DATA-04 (2026-10-20): CitasF2 insert/update schema hooks retired. The
// booking saga validates status, payment and pair contracts at point of use.
// Keep beforeRemove below: direct deletion must still require formal cancellation.

export function CitasF2_beforeRemove() {
    _fiscalError("Borrado directo de CitasF2 bloqueado: use cancelacion formal de reserva");
}

// =============================================================================
// BLOQUE 18 - COMPLEMENTOS CATALOGO
// =============================================================================

export function ComplementosCatalogo_beforeInsert(item) { return _validateComplementosCatalogo(item); }
export function ComplementosCatalogo_beforeUpdate(item) { return _validateComplementosCatalogo(item); }

function _validateComplementosCatalogo(item) {
    if (!item || typeof item !== "object") return item;
    if (!_safeTrim(item.addonId)) _schemaError("addonId obligatorio en ComplementosCatalogo");
    if (!_safeTrim(item.sku)) _schemaError("sku obligatorio en ComplementosCatalogo");
    if (item.price !== undefined && Number(item.price) < 0) _schemaError("price no puede ser negativo en ComplementosCatalogo");
    return item;
}

// =============================================================================
