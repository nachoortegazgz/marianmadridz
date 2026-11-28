/*
=============================================================================
MODULE: backend/eventLog.js
VERSION: v5016-REFUND-ORDER-LOCK
BASE: v5009-FISCAL-V20.1 + alineacion con internalConfig v12.0-SSOT-FINAL
      y dataAccess v2.1-UNIFIED
RESPONSIBILITY: Motor atomico de registro fiscal (append-only) + proyector
                secundario + API fiscal.
STANDARDS: G10 ASCII Strict. Cero suppressAuth. Cero COLLECTIONS alias.

REFUND-LOCK-01 (P1): la unicidad refundId y el limite acumulado del pedido se
  revalidan dentro del bloqueo fiscal global, antes de leer el head/hash y de
  reservar secuencia. Dos reembolsos distintos del mismo pedido quedan serializados.

CAMBIOS DE ALINEACION v5015-ALIGNED (respecto a v5009-FISCAL-V20.1):
  ALN-01: COLLECTIONS/SINGLETONS alias eliminados. Uso de
          BUSINESS_COLLECTIONS / OPERATIONAL_COLLECTIONS; sequence state
          is stored in the single CajaActual principal item.
  ALN-02: AEAT_INVOICE_TYPE -> TIPO_FACTURA (v12.0).
  ALN-03: VAT_ACCRUAL_STATUS no existe en v12.0. Constantes locales
          VAT_ACCRUAL_DEVENGADO / _ANTICIPADO / _APLICACION_ANTICIPO.
  ALN-04: LIBRO_ORIGEN_TIPO / LIBRO_ORIGEN_REGISTRO no existen en v12.0.
          Eliminados (import muerto; el modulo no los usaba).
  ALN-05: MOVEMENT_TYPE.DEVOLUCION_SERVICIO y .DEVOLUCION_PRODUCTO no
          existen en v12.0. Sustituidos por MOVEMENT_TYPE.DEVOLUCION /
          MOVEMENT_TYPE.REEMBOLSO.
  ALN-07: La identidad del SIF y los indicadores AEAT se resuelven
          exclusivamente desde MapaStaff CONFIG_SISTEMA. La ausencia,
          duplicidad o incompletitud bloquea el escritor fiscal; no hay
          fallback local ni valores derivados de la marca comercial.
  ALN-08: wixData.query/get/insert/save -> dalQuery/dalGet/dalInsert/
          dalSave (dataAccess v2.1).
  ALN-09: _buildFiscalPayloadSnapshot usa únicamente la configuración
          SIF explícita y validada por _getFiscalSystemConfig.

FIXES APLICADOS v5009-FISCAL-V20.1 (heredados):
  - V20-01..V20-04.
FIXES APLICADOS v5009-FISCAL (heredados):
  - FIX-EV-01..08.
=============================================================================
*/

import { webMethod, Permissions } from "wix-web-module";
import { updateCajaActualFromMovement } from "backend/cajas.web";

import {
    query as dalQuery,
    getItem as dalGet,
    insertItem as dalInsert,
} from "backend/dataAccess";

import {
    BUSINESS_COLLECTIONS,
    OPERATIONAL_COLLECTIONS,
    SDK_CONFIG,
    MOVEMENT_TYPE,
    TIPO_FACTURA,
    FISCAL_ROLE,
    EVENT_TYPE,
    THIRD_PARTY_TYPE,
    PROJECTION_STATUS,
    RECORD_TYPE,
    MOVEMENT_HISTORICAL_READ_ALIASES,
    normalizeMovementKeys,
} from "backend/internalConfig";

import { readFiscalPayload, readMovementField, readMovementHash } from "backend/data";
import { assertFiscalMovementInputEnums, isValidNifOrEuVat, isExplicitSimulationLedgerRecord } from "backend/validation";

import { hashChain } from "backend/securityEngine";
import { buildEventLogFiscalChainPayload } from "backend/fiscalHashPayload";

import {
    makeTraceId,
    _safeTrim,
    _cleanText,
    _looksLikeGuid,
    withTimeout,
} from "public/mmUtils";

import { logger } from "backend/logger";
import { createActionableError, toPublicShape } from "backend/errors/actionableError";
import {
    acquireFiscalLedgerLock,
    allocateFiscalSequence,
    assertFiscalLedgerLock,
    releaseFiscalLedgerLock,
    rollbackFiscalSequence,
} from "backend/fiscalLedgerLock";

const log = logger;

const REFUND_MOVEMENT_TYPES = new Set([
    MOVEMENT_TYPE.REEMBOLSO,
    MOVEMENT_TYPE.DEVOLUCION,
    MOVEMENT_TYPE.DEVOLUCION_SERVICIO,
]);

function _readRequiredFiscalNumber(value, field, { min = null, max = null } = {}) {
    const validType = typeof value === "number" ||
        (typeof value === "string" && value.trim() !== "");
    const amount = validType ? Number(value) : Number.NaN;
    if (!Number.isFinite(amount) ||
        (min !== null && amount < min) ||
        (max !== null && amount > max)) {
        const error = new Error("FISCAL_NUMERIC_FIELD_INVALID:" + field);
        error.code = "FISCAL_NUMERIC_FIELD_INVALID";
        error.meta = { field };
        throw error;
    }
    return amount;
}

function normalizeAccountingAmount(input = {}) {
    const movementType = _safeTrim(input.movementType).toUpperCase();
    const raw = input.accountingAmount ?? input.totalAmount;
    const validType = typeof raw === "number" ||
        (typeof raw === "string" && raw.trim() !== "");
    const rawAmount = validType ? Number(raw) : Number.NaN;
    if (!Number.isFinite(rawAmount)) {
        const error = new Error("ACCOUNTING_AMOUNT_INVALID");
        error.code = "ACCOUNTING_AMOUNT_INVALID";
        throw error;
    }
    return REFUND_MOVEMENT_TYPES.has(movementType)
        ? -Math.abs(rawAmount)
        : rawAmount;
}

function normalizeLinkedBookingIds(value) {
    const values = Array.isArray(value) ? value : _safeTrim(value).split(",");
    return [...new Set(values.map((item) => _safeTrim(item)).filter(Boolean))];
}

function isCancellationRectification(input = {}) {
    return _safeTrim(input.movementType).toUpperCase() === MOVEMENT_TYPE.REEMBOLSO &&
        _safeTrim(input.eventType).toUpperCase() === EVENT_TYPE.RECTIFICATIVA &&
        _safeTrim(input.transactionId).startsWith("RECT-") &&
        Boolean(_safeTrim(input.previousInvoiceId));
}

// ============================================================================
// CONSTANTES (ALN-01, ALN-03)
// ============================================================================

const VAT_ACCRUAL_DEVENGADO = "DEVENGADO";
const VAT_ACCRUAL_APLICACION_ANTICIPO = "APLICACION_ANTICIPO";

const MOVIMIENTOS_CAJA_COL = BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA;
const MAPA_STAFF_COL = BUSINESS_COLLECTIONS.MAPA_STAFF;
const SERVICIOS_CATALOGO_COL = BUSINESS_COLLECTIONS.SERVICIOS_CATALOGO;

const LEDGER_SCHEMA_VERSION = "LEDGER_V5_FISCAL";
const GENESIS_HASH = "0".repeat(64);

const PROYECCION_BATCH_LIMIT = 25;
const PROYECCION_TIMEOUT_MS = SDK_CONFIG.TIMEOUTS.API_MS;

// ============================================================================
// ALN-07: CONFIGURACION FISCAL CANONICA — FAIL CLOSED
// ============================================================================

let _fiscalSystemCache = null;
let _fiscalSystemCacheAt = 0;
const FISCAL_SYSTEM_CACHE_TTL_MS = SDK_CONFIG.SECURITY.SECRET_CACHE_TTL_MS;

function _toAeatFlag(value) {
    if (typeof value === "boolean") return value ? "S" : "N";
    const normalized = _safeTrim(value).toUpperCase();
    if (["S", "SI", "TRUE", "1"].includes(normalized)) return "S";
    if (["N", "NO", "FALSE", "0"].includes(normalized)) return "N";
    return null;
}

function _toFiscalStartDateText(value) {
    const date = _safeTrim(value);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!match) return null;
    const [year, month, day] = match.slice(1).map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year &&
        parsed.getUTCMonth() + 1 === month &&
        parsed.getUTCDate() === day ? date : null;
}

function _buildFiscalSystemConfig(config) {
    if (!config || _safeTrim(config.recordType).toUpperCase() !== RECORD_TYPE.CONFIG_SISTEMA ||
        _safeTrim(config._id) !== "CONFIG_SISTEMA_FISCAL") {
        throw createActionableError({ code: "FISCAL_CONFIG_MISSING", userMessage: "Configuración fiscal no disponible. Contacta al responsable legal para completarla.", technicalDetail: "Falta el singleton MapaStaff CONFIG_SISTEMA_FISCAL o su recordType no es CONFIG_SISTEMA.", remediation: ["Acceder a Wix CMS → MapaStaff.", "Crear el singleton CONFIG_SISTEMA_FISCAL con los campos del contrato fiscal aprobado.", "Validar los datos identificativos con AEAT antes de guardar.", "Completar y verificar la configuración fiscal antes de emitir registros fiscales.", "Reintentar tras el alta y su verificación."], contextSnapshot: { collection: MAPA_STAFF_COL, expectedId: "CONFIG_SISTEMA_FISCAL" }, retryable: false });
    }

    const resolved = {
        sistemaInformaticoNombre: _safeTrim(config.sistemaInformaticoNombre),
        idSistemaInformatico: _safeTrim(config.idSistemaInformatico),
        version: _safeTrim(config.verifactuVersion),
        numeroInstalacion: _safeTrim(config.numeroInstalacion),
        tipoUsoPosibleSoloVerifactu: _toAeatFlag(config.tipoUsoPosibleSoloVerifactu),
        tipoUsoPosibleMultiOT: _toAeatFlag(config.tipoUsoPosibleMultiOT),
        indicadorMultiplesOT: _toAeatFlag(config.indicadorMultiplesOT),
        nifProductor: _safeTrim(config.taxId).toUpperCase(),
        nombreRazonProductor: _safeTrim(config.legalName),
        fechaInicioVerifactu: _toFiscalStartDateText(config.fechaInicioVerifactu),
    };
    if (!isValidNifOrEuVat(resolved.nifProductor)) {
        throw createActionableError({ code: "FISCAL_CONFIG_INVALID_TAX_ID", userMessage: "El identificador fiscal no es válido. Contacta al responsable legal.", technicalDetail: "taxId no supera isValidNifOrEuVat.", remediation: ["Revisar taxId en CONFIG_SISTEMA_FISCAL.", "Verificar el identificador con documentación oficial y AEAT.", "Corregir el identificador fiscal y verificarlo antes de repetir la operación."], contextSnapshot: { collection: MAPA_STAFF_COL, configId: config?._id || null }, retryable: false });
    }

    const missing = Object.entries(resolved)
        .filter(([, value]) => value === "" || value === null)
        .map(([key]) => key);
    if (missing.length) {
        throw createActionableError({ code: "FISCAL_CONFIG_INCOMPLETE", userMessage: "La configuración fiscal está incompleta. Contacta al responsable legal.", technicalDetail: "Faltan campos fiscales obligatorios: " + missing.join(", "), remediation: ["Revisar el contrato fiscal aprobado y los campos obligatorios de CONFIG_SISTEMA_FISCAL.", "Completar únicamente datos respaldados por documentación legal.", "Validar el NIF con AEAT y completar los campos obligatorios antes de repetir la operación."], contextSnapshot: { collection: MAPA_STAFF_COL, configId: config?._id || null, missingFields: missing }, retryable: false });
    }
    if (!isValidNifOrEuVat(resolved.nifProductor)) {
        throw new Error("FISCAL_CONFIG_INVALID_TAX_ID: MapaStaff CONFIG_SISTEMA taxId debe ser un NIF/NIE/CIF/VAT-UE valido");
    }
    return Object.freeze(resolved);
}

async function _getFiscalSystemConfig(traceId) {
    const now = Date.now();
    if (_fiscalSystemCache && now - _fiscalSystemCacheAt < FISCAL_SYSTEM_CACHE_TTL_MS) {
        return _fiscalSystemCache;
    }

    let res;
    try {
        res = await dalQuery(MAPA_STAFF_COL)
            .eq("recordType", RECORD_TYPE.CONFIG_SISTEMA)
            .limit(2)
            .find({ consistencyMode: "strong" });
    } catch (err) {
        log.error("FISCAL_CONFIG_READ_FAILED", {
            traceId, message: err?.message,
        });
        throw createActionableError({ code: "FISCAL_CONFIG_READ_FAILED", userMessage: "No se pudo leer la configuración fiscal. Contacta al administrador técnico.", technicalDetail: err?.message || "Fallo de lectura de MapaStaff CONFIG_SISTEMA.", remediation: ["Comprobar disponibilidad y permisos de lectura de MapaStaff.", "Revisar los logs técnicos usando el traceId.", "No habilitar escrituras fiscales mientras no se verifique la configuración."], contextSnapshot: { collection: MAPA_STAFF_COL, traceId }, retryable: true });
    }

    const items = res?.items || [];
    if (items.length !== 1) {
        throw createActionableError({ code: items.length === 0 ? "FISCAL_CONFIG_MISSING" : "FISCAL_CONFIG_NOT_UNIQUE", userMessage: items.length === 0 ? "Configuración fiscal no disponible. Contacta al responsable legal para completarla." : "Hay varias configuraciones fiscales. Contacta al responsable legal para corregirlo.", technicalDetail: "Se esperaba un singleton CONFIG_SISTEMA_FISCAL; encontrados: " + items.length + ".", remediation: items.length === 0 ? ["Acceder a Wix CMS → MapaStaff.", "Crear CONFIG_SISTEMA_FISCAL según el contrato fiscal aprobado.", "Validar los datos identificativos con AEAT y repetir la operación tras la verificación.", "Reintentar tras la verificación."] : ["No borrar ni sobrescribir registros fiscales desde código.", "Identificar con el responsable legal el registro canónico.", "Resolver la duplicidad mediante procedimiento autorizado.", "Corregir la configuración duplicada mediante el procedimiento autorizado antes de repetir la operación."], contextSnapshot: { collection: MAPA_STAFF_COL, observedCount: items.length }, retryable: false });
    }

    const resolved = _buildFiscalSystemConfig(items[0]);
    _fiscalSystemCache = resolved;
    _fiscalSystemCacheAt = now;
    return resolved;
}

// ============================================================================
// SECCION 1 - HELPERS DE FECHA / AEAT
// ============================================================================

function _formatAEATDate(ymd) {
    const clean = _safeTrim(ymd);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean);
    if (!match) return clean;
    return `${match[3]}-${match[2]}-${match[1]}`;
}

function _formatAEATDateTimeMadrid(date) {
    const dt = date instanceof Date ? date : new Date();
    const parts = new Intl.DateTimeFormat("sv-SE", {
        timeZone: SDK_CONFIG?.TZ || "Europe/Madrid",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false,
    }).formatToParts(dt).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});

    const madridOffset = (() => {
        const madridStr = dt.toLocaleString("en-US", {
            timeZone: "Europe/Madrid",
            timeZoneName: "longOffset",
        });
        const m = /GMT([+-])(\d{2}):?(\d{2})/.exec(madridStr);
        if (m) return `${m[1]}${m[2]}:${m[3]}`;
        const localMadrid = new Date(dt.toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
        const diffMinutes = Math.round((localMadrid - dt) / 60000);
        const sign = diffMinutes >= 0 ? "+" : "-";
        const abs = Math.abs(diffMinutes);
        return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
    })();

    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${madridOffset}`;
}

function _buildGenerationTimestamp(date) {
    const dt = date instanceof Date ? date : new Date();
    const parts = new Intl.DateTimeFormat("sv-SE", {
        timeZone: SDK_CONFIG?.TZ || "Europe/Madrid",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false,
    }).formatToParts(dt).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
    return {
        year: Number(parts.year),
        month: Number(parts.month),
        day: Number(parts.day),
        hour: Number(parts.hour),
        minute: Number(parts.minute),
        second: Number(parts.second),
    };
}

// This builder creates the project's internal fiscal-ledger chain payload.
// It is not the official AEAT v0.1.2 hash input: it includes domain fields and
// is consumed by securityEngine.hashChain(). Keep its output stable for
// existing records. The official AEAT builder remains isolated in aeatHash.js.
function _buildInternalFiscalChainPayload(movement, generatedAt) {
    return buildEventLogFiscalChainPayload(movement, generatedAt);
}

// ============================================================================
// SECCION 2 - LECTURA DEL HEAD FISCAL
// ============================================================================

async function _getLastCashEvent() {
    const res = await dalQuery(MOVIMIENTOS_CAJA_COL)
        .gt("sequenceNumber", 0)
        .ne("recordSource", "SMOKE_TEST")
        .descending("sequenceNumber")
        .limit(20)
        .find({ consistencyMode: "strong" });
    return (res?.items || []).find((item) => !isExplicitSimulationLedgerRecord(item)) || null;
}

// ============================================================================
// SECCION 3 - MAESTROS
// ============================================================================

async function _upsertMapaStaff({ taxId, legalName, thirdPartyType, address }, traceId) {
    const normalizedTaxId = _safeTrim(taxId).toUpperCase();
    if (!normalizedTaxId) return null;

    const existing = await dalQuery(MAPA_STAFF_COL)
        .eq("recordType", RECORD_TYPE.TERCERO)
        .eq("taxId", normalizedTaxId)
        .limit(1)
        .find();

    if (existing?.items?.[0]) return existing.items[0];

    // `MapaStaff.address` is the declared TEXT field for the fiscal address.
    return await dalInsert(MAPA_STAFF_COL, {
        recordType: RECORD_TYPE.TERCERO,
        taxId: normalizedTaxId,
        legalName: _safeTrim(legalName).toUpperCase() || "SIN NOMBRE",
        thirdPartyType: thirdPartyType || (taxId ? THIRD_PARTY_TYPE.CLIENTE : THIRD_PARTY_TYPE.EMISOR),
        address: address == null ? null : (
            typeof address === "string" ? address : JSON.stringify(address)
        ),
        schemaVersion: 1,
        traceId: _safeTrim(traceId),
    });
}

async function _getServicioCatalogo(catalogId, traceId) {
    const id = _safeTrim(catalogId);
    if (!_looksLikeGuid(id)) return null;
    try {
        return await dalGet(SERVICIOS_CATALOGO_COL, id, "strong");
    } catch (_) {
        log.warn("Catalogo no encontrado", { traceId, catalogId: id });
        return null;
    }
}

// ============================================================================
// SECCION 4 - PAYLOAD FISCAL (ALN-09: usa sistema resuelto)
// SSOT Veri*factu: este snapshot es un OBJETO INTERNO (vive dentro de la
// key canonica payloadFiscal del doc y se serializa en el hash AEAT). Sus
// claves siguen la nomenclatura literal Veri*factu/AEAT; nunca son claves
// fisicas de coleccion, por lo que no estan sujetas a HOOK-CAJA-06.
// ============================================================================

// MapaStaff.address is TEXT while MovimientosCaja.recipientAddress is
// OBJECT. Parse only previously serialized object addresses; never pass TEXT
// directly into the OBJECT CMS field.
function _normalizeRecipientAddress(storedAddress, suppliedAddress) {
    const candidates = [storedAddress, suppliedAddress];
    for (const candidate of candidates) {
        if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
            return candidate;
        }
        if (typeof candidate === "string" && candidate.trim()) {
            try {
                const parsed = JSON.parse(candidate);
                if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                    return parsed;
                }
            } catch (_) {
                // A plain-text address cannot satisfy the structured CMS contract.
            }
        }
    }
    return null;
}

// SSOT-KEYFIELD-02: registrarEventoEconomico aplica normalizeMovementKeys a
// TODA entrada antes de construir el snapshot; por tanto `input` solo contiene
// claves canonicas. La lectura del snapshot es directa (cero doble lectura).
function _buildFiscalPayloadSnapshot({
    thirdParty, catalog, input, fiscalAmounts, ts, previousRecordHash, movementHash, recordTimestamp, sistemaInformatico,
}) {
    return {
        idEmisorFactura: _safeTrim(input.nifEmisor),
        nombreRazonEmisor: _safeTrim(input.issuerLegalName),
        nifDestinatario: _safeTrim(thirdParty?.taxId || input.nifDestinatario),
        nombreRazonDestinatario: _safeTrim(thirdParty?.legalName || input.recipientLegalName),
        domicilioDestinatario: _normalizeRecipientAddress(thirdParty?.address, input.recipientAddress),
        emitidaPorTerceroODestinatario: _safeTrim(input.issuedByThirdPartyOrRecipient) || "E",
        nombreRazonTercero: _safeTrim(input.thirdPartyLegalName) || null,
        nifTerceroExpedidor: _safeTrim(input.issuerThirdPartyTaxId) || null,
        numSerieFactura: _safeTrim(input.numSerieFactura),
        fechaExpedicionFactura: _safeTrim(input.fechaExpedicionFactura),
        fechaOperacion: _safeTrim(input.fechaOperacion) || null,
        tipoFactura: _safeTrim(input.tipoFactura) || TIPO_FACTURA.F1,
        tipoRectificativa: _safeTrim(input.tipoRectificativa) || null,
        descripcionOperacion: _safeTrim(input.operationDescription),
        importeTotal: fiscalAmounts.totalAmount,
        baseImponibleOImporteNoSujeto: fiscalAmounts.taxBase,
        cuotaTotal: fiscalAmounts.taxAmount,
        tipoImpositivo: fiscalAmounts.tipoImpositivo,
        tipoRecargoEquivalencia: Number(input.surchargeRate ?? 0),
        cuotaRecargoEquivalencia: Number(input.surchargeAmount ?? 0),
        importeRetencionIRPF: Number(input.irpfWithholdingAmount ?? 0),
        tipoRetencionIRPF: Number(input.irpfWithholdingRate ?? 0),
        baseImponibleRetencion: Number(input.withholdingBase ?? 0),
        claveRegimen: _safeTrim(input.claveRegimen || catalog?.aeatRegimeKey) || "01",
        calificacionOperacion: _safeTrim(input.calificacionOperacion || catalog?.aeatOperationClassification) || "S1",
        operacionExenta: _safeTrim(input.operacionExenta || catalog?.aeatExemptOperation) || null,
        inversionSujetoPasivo: input.inversionSujetoPasivo === true || catalog?.reverseCharge === true,
        causaNoSujeta: _safeTrim(input.nonSubjectReason) || null,
        regimenEspecialCriterioCaja: input.cashBasisRegime === true,
        exentaPorArticulo20: input.article20Exempt === true,
        sistemaInformatico: { ...sistemaInformatico },
        idFacturaAnterior: _safeTrim(input.previousInvoiceId) || null,
        numSerieFacturaAnterior: _safeTrim(input.previousInvoiceNumber) || null,
        fechaExpedicionFacturaAnterior: _safeTrim(input.previousInvoiceIssueDate) || null,
        huellaAnterior: previousRecordHash || null,
        huella: movementHash,
        fechaHoraHusoGenRegistro: recordTimestamp,
        generationTimestamp: _buildGenerationTimestamp(ts),
        desgloseDetallado: Array.isArray(input.breakdown) ? input.breakdown : [],
    };
}

// ============================================================================
// SECCION 5 - MOTOR - registrarEventoEconomico
// ============================================================================

export async function registrarEventoEconomico(input) {
    const traceId = _safeTrim(input?.traceId) || makeTraceId("evento");
    if (_safeTrim(input?.eventType).toUpperCase() === EVENT_TYPE.CIERRE_Z) {
        return {
            status: "ERROR",
            data: null,
            error: {
                code: "Z_CLOSING_REQUIRES_CANONICAL_WRITER",
                message: "Los cierres Z solo pueden registrarse mediante el escritor de HistoricoCierresZ.",
                traceId,
            },
        };
    }
    const transactionId = _safeTrim(input?.transactionId);
    if (!transactionId) {
        return {
            status: "ERROR",
            data: null,
            error: {
                code: "TRANSACTION_ID_REQUIRED",
                message: "El writer fiscal requiere un transactionId estable.",
                traceId,
            },
        };
    }
    if (transactionId.length > 128) {
        return {
            status: "ERROR",
            data: null,
            error: {
                code: "TRANSACTION_ID_INVALID",
                message: "transactionId excede la longitud máxima permitida (128).",
                traceId,
            },
        };
    }
    // SSOT-KEYFIELD-02 / HOOK-CAJA-06: normalizacion destructiva de la
    // entrada (unica implementacion en internalConfig.normalizeMovementKeys,
    // compartida con el hook data.MovimientosCaja_beforeInsert). Los writers
    // historical pueden entregar aliases (invoiceNumber, taxRate, issuerTaxId,
    // operationDate...); aqui se promueven a su canon SSOT sobre una copia
    // local — el objeto del caller NO se muta. Despues de esta linea todo el
    // motor trabaja SOLO con claves canonicas; ningun alias alcanza al doc.
    input = normalizeMovementKeys({ ...input, transactionId });
    input.movementType = _safeTrim(input.movementType).toUpperCase();
    input.paymentMethod = _safeTrim(input.paymentMethod).toUpperCase();
    input.channelType = _safeTrim(input.channelType).toUpperCase();
    input.tipoFactura = _safeTrim(input.tipoFactura).toUpperCase() || TIPO_FACTURA.F1;
    try {
        assertFiscalMovementInputEnums(input);
    } catch (error) {
        return {
            status: "ERROR",
            data: null,
            error: {
                code: "FISCAL_MOVEMENT_INPUT_INVALID",
                message: error?.message || "Movimiento fiscal inválido",
                traceId,
            },
        };
    }

    const ts = new Date();

    // 1. Resolver catálogo y validar los importes antes de cualquier escritura.
    const catalog = await _getServicioCatalogo(input.catalogId, traceId);
    let fiscalAmounts;
    try {
        fiscalAmounts = {
            amount: _readRequiredFiscalNumber(input.amount ?? input.taxBase, "amount"),
            totalAmount: _readRequiredFiscalNumber(input.totalAmount, "totalAmount"),
            taxBase: _readRequiredFiscalNumber(input.taxBase, "taxBase"),
            taxAmount: _readRequiredFiscalNumber(input.taxAmount, "taxAmount"),
            tipoImpositivo: _readRequiredFiscalNumber(
                input.tipoImpositivo ?? catalog?.tipoImpositivo,
                "tipoImpositivo",
                { min: 0, max: 1 }
            ),
        };
    } catch (error) {
        return {
            status: "ERROR",
            data: null,
            error: {
                code: error?.code || "FISCAL_NUMERIC_FIELD_INVALID",
                message: "El movimiento fiscal contiene un importe o tipo impositivo ausente o inválido.",
                field: error?.meta?.field || null,
                traceId,
            },
        };
    }

    // 2. Resolver tercero después de validar importes.
    const thirdParty = await _upsertMapaStaff({
        taxId: input.nifDestinatario || input.nifEmisor,
        legalName: input.recipientLegalName || input.issuerLegalName,
        thirdPartyType: input.thirdPartyType || (
            input.nifDestinatario ? THIRD_PARTY_TYPE.CLIENTE : THIRD_PARTY_TYPE.EMISOR
        ),
        // SSOT-KEYFIELD: MapaStaff.address is the physical TEXT field.
        address: input.recipientAddress || null,
    }, traceId);

    // 3. Sistema informatico (ALN-09)
    const sistemaInformatico = await _getFiscalSystemConfig(traceId);

    // 4. Serializacion global del ledger: head hash + secuencia + insert
    // deben ejecutarse dentro de una misma seccion critica compartida con cajas.web.
    const ledgerLock = await acquireFiscalLedgerLock(traceId);
    let retainLedgerLock = false;
    try {
        {
            const existing = await dalQuery(MOVIMIENTOS_CAJA_COL)
                .eq("transactionId", transactionId)
                .limit(1)
                .find({ consistencyMode: "strong" });
            if (existing?.items?.length === 1) {
                const savedMovement = existing.items[0];
                const cashProjection = await updateCajaActualFromMovement(savedMovement, traceId, ledgerLock);
                return {
                    status: cashProjection?.status === "SUCCESS" ? "SUCCESS" : "PARTIAL",
                    data: {
                        cabeceraId: savedMovement._id,
                        hash: readMovementHash(savedMovement),
                        sequenceNumber: savedMovement.sequenceNumber,
                        numSerieFactura: savedMovement.numSerieFactura,
                        projectionStatus: cashProjection?.status === "SUCCESS" ? PROJECTION_STATUS.OK : PROJECTION_STATUS.ERROR,
                        cashProjectionStatus: cashProjection?.status || "UNKNOWN",
                    },
                    error: cashProjection?.status === "SUCCESS" ? null : {
                        code: "CASH_OR_SECONDARY_PROJECTION_PENDING",
                        message: "Evento fiscal ya persistido; la proyeccion requiere reconciliacion.",
                    },
                    idempotent: true,
                };
            }
            if (existing?.items?.length > 1) {
                retainLedgerLock = true;
                throw new Error("FISCAL_TRANSACTION_ID_AMBIGUOUS");
            }
        }

        // Native eCommerce refunds require the Wix refund identity and are
        // revalidated under the global ledger lock. Booking-cancellation
        // rectifications use a separate RECT-* identity and reference the
        // original invoice; they must not be forced through the refundId guard.
        if (_safeTrim(input.movementType).toUpperCase() === MOVEMENT_TYPE.REEMBOLSO) {
            const refundOrderId = _safeTrim(input.orderId);
            const refundId = _safeTrim(input.refundId);
            const refundTransactionId = _safeTrim(input.transactionId);
            const isEcommerceRefund = refundTransactionId.startsWith("REFUND-") || Boolean(refundId);

            if (!isEcommerceRefund) {
                if (!isCancellationRectification(input)) throw new Error("REFUND_IDENTITY_INVALID");
            } else {
                if (!refundOrderId || !refundId || refundTransactionId !== `REFUND-${refundOrderId}-${refundId}`) {
                    throw new Error("REFUND_IDENTITY_INVALID");
                }

                const refundIdRes = await dalQuery(MOVIMIENTOS_CAJA_COL)
                    .eq("refundId", refundId)
                    .limit(2)
                    .find({ consistencyMode: "strong" });
                const refundIdConflict = (refundIdRes?.items || []).some(movement =>
                    _safeTrim(movement?.orderId) !== refundOrderId ||
                    _safeTrim(movement?.transactionId) !== refundTransactionId
                );
                if (refundIdConflict) throw new Error("REFUND_ID_REUSED_ACROSS_ORDERS");

                const originalRes = await dalQuery(MOVIMIENTOS_CAJA_COL)
                    .eq("transactionId", `ORDER-${refundOrderId}`)
                    .limit(2)
                    .find({ consistencyMode: "strong" });
                if (originalRes?.items?.length !== 1) {
                    throw new Error(originalRes?.items?.length > 1
                        ? "REFUND_ORIGINAL_LEDGER_AMBIGUOUS"
                        : "REFUND_ORIGINAL_LEDGER_MISSING");
                }
                const originalAmountCents = Math.round(Math.abs(Number(
                    originalRes.items[0]?.totalAmount ?? originalRes.items[0]?.accountingAmount ?? 0
                )) * 100);
                if (!Number.isSafeInteger(originalAmountCents) || originalAmountCents <= 0) {
                    throw new Error("REFUND_ORIGINAL_AMOUNT_INVALID");
                }

                let refundRowsResult = await dalQuery(MOVIMIENTOS_CAJA_COL)
                    .eq("orderId", refundOrderId)
                    .eq("movementType", MOVEMENT_TYPE.REEMBOLSO)
                    .limit(1000)
                    .find({ consistencyMode: "strong" });
                const refundRows = [...(refundRowsResult?.items || [])];
                let refundPages = 1;
                while (typeof refundRowsResult?.hasNext === "function" && refundRowsResult.hasNext()) {
                    if (refundPages >= 100) throw new Error("REFUND_HISTORY_PAGE_LIMIT_EXCEEDED");
                    refundRowsResult = await refundRowsResult.next();
                    refundRows.push(...(refundRowsResult?.items || []));
                    refundPages++;
                }
                if (typeof refundRowsResult?.hasNext === "function" && refundRowsResult.hasNext()) {
                    throw new Error("REFUND_HISTORY_INCOMPLETE");
                }

                const refundedCents = refundRows.reduce((sum, movement) =>
                    sum + Math.round(Math.abs(Number(
                        movement?.accountingAmount ?? movement?.totalAmount ?? 0
                    )) * 100), 0);
                const requestedRefundCents = Math.round(Math.abs(Number(input.totalAmount)) * 100);
                if (!Number.isSafeInteger(requestedRefundCents) || requestedRefundCents <= 0 ||
                    refundedCents + requestedRefundCents > originalAmountCents) {
                    throw new Error("REFUND_EXCEEDS_ORIGINAL_ORDER_AMOUNT");
                }
            }
        }

        // 4a. El head se lee solo despues de adquirir el lock.
        const previous = await _getLastCashEvent();
        let seq;
        try {
            seq = await allocateFiscalSequence(ledgerLock, previous);
        } catch (sequenceError) {
            if (sequenceError?.code === "SEQUENCE_RESULT_UNKNOWN") retainLedgerLock = true;
            throw sequenceError;
        }

    const previousRecordHash = _safeTrim(readMovementHash(previous)) || GENESIS_HASH;
    const recordTimestamp = _formatAEATDateTimeMadrid(ts);
    const cmsRecordTimestamp = new Date(ts);

    // 5. Construir movimiento base (SSOT-KEYFIELD-02: claves fisicas canonicas
    // literales AEAT; los aliases historical del caller ya fueron promovidos por
    // normalizeMovementKeys y NUNCA se persisten).
    const movementTypeRaw = _safeTrim(input.movementType);
    const accountingAmount = normalizeAccountingAmount(input);
    const canonInvoiceNumber = _safeTrim(input.numSerieFactura) || seq.numSerieFactura;
    const canonIssueDate = _safeTrim(input.fechaExpedicionFactura) ||
        _safeTrim(input.fechaOperacion) ||
        new Date().toLocaleDateString("sv-SE", { timeZone: SDK_CONFIG?.TZ || "Europe/Madrid" });
    // ALN-09 / SSOT Apartado 5: linkedBookingIds es ARRAY de GUIDs (no CSV).
    // El alias reservaIdVinculada del caller ya fue promovido a
    // linkedBookingIds por normalizeMovementKeys; aqui solo se lee el canon.
    const linkedBookingIdsArr = normalizeLinkedBookingIds(input.linkedBookingIds);
    const baseMovement = {
        sequenceNumber: seq.sequenceNumber,
        numSerieFactura: canonInvoiceNumber,
        fechaExpedicionFactura: canonIssueDate,
        // SSOT Apartado 5: operationDate fue promovido a fechaOperacion por
        // normalizeMovementKeys; leer el alias aqui seria codigo muerto.
        fechaOperacion: _safeTrim(input.fechaOperacion) || canonIssueDate || null,
        fiscalPeriod: canonIssueDate.slice(0, 7),

        movementType: _safeTrim(input.movementType),
        eventType: _safeTrim(input.eventType),
        paymentMethod: _safeTrim(input.paymentMethod),
        channelType: _safeTrim(input.channelType).toUpperCase(),

        // MATRIZ v15 (decision de usuario): amount y totalAmount COEXISTEN
        // como claves canonicas propias hasta cerrar el ADR de la formula
        // fiscal. amount = importe base; totalAmount = total cobrado con
        // impuestos. El caller entrega amount canonico (no alias tras
        // normalizeMovementKeys).
        amount: fiscalAmounts.amount,
        totalAmount: fiscalAmounts.totalAmount,
        accountingAmount,
        // SSOT Apartado 5 (claves fisicas canonicas): taxBase/taxAmount son
        // las claves del documento; los aliases del caller
        // (baseImponibleOImporteNoSujeto, taxableBaseOrNonSubjectAmount) ya
        // fueron promovidos por normalizeMovementKeys. cuotaTotal/tipoImpositivo
        // se derivan SIEMPRE de su canon (coherencia Veri*factu garantizada).
        taxBase: fiscalAmounts.taxBase,
        taxAmount: fiscalAmounts.taxAmount,
        // MATRIZ v15 Bloque 2: cuotaTotal ERRADICADA del ledger; la clave
        // fisica canónica de la cuota es taxAmount (arriba). El snapshot AEAT
        // interno (_buildFiscalPayloadSnapshot) usa la literal Veri*factu
        // "cuotaTotal" porque es contrato fiscal serializado, no key CMS.
        tipoImpositivo: fiscalAmounts.tipoImpositivo,
        surchargeRate: Number(input.surchargeRate ?? 0),
        surchargeAmount: Number(input.surchargeAmount ?? 0),
        irpfWithholdingAmount: Number(input.irpfWithholdingAmount ?? 0),
        irpfWithholdingRate: Number(input.irpfWithholdingRate ?? 0),
        withholdingBase: Number(input.withholdingBase ?? 0),
        fiscalRole: _safeTrim(input.fiscalRole) || FISCAL_ROLE.EMISOR,

        operationDescription: _cleanText(input.operationDescription || "", 500),

        // SSOT Apartado 5: las claves fisicas canonicas del doc son
        // tipoFactura/tipoRectificativa/nifEmisor/nifDestinatario/claveRegimen/
        // calificacionOperacion/operacionExenta. Los aliases del caller
        // (invoiceType, correctionType, issuerTaxId, recipientTaxId, regimeKey,
        // operationClassification, exemptOperation) fueron promovidos por
        // normalizeMovementKeys ANTES de construir el doc; aqui solo se leen
        // canones. Las demas claves (correctionReason, previousInvoiceNumber,
        // vatAccrualStatus...) son dominio del motor, no campos de coleccion.
        tipoFactura: _safeTrim(input.tipoFactura) || TIPO_FACTURA.F1,
        tipoRectificativa: _safeTrim(input.tipoRectificativa) || null,
        correctionReason: _safeTrim(input.correctionReason) || null,
        previousInvoiceId: _safeTrim(input.previousInvoiceId) || null,
        previousInvoiceNumber: _safeTrim(input.previousInvoiceNumber) || null,
        previousInvoiceIssueDate: _safeTrim(input.previousInvoiceIssueDate) || null,
        issuerInvoiceNumber: _safeTrim(input.issuerInvoiceNumber) || null,
        correctionAmount: input.correctionAmount || null,

        nifEmisor: _safeTrim(input.nifEmisor),
        issuerLegalName: _safeTrim(input.issuerLegalName),
        nifDestinatario: _safeTrim(thirdParty?.taxId || input.nifDestinatario),
        recipientLegalName: _safeTrim(thirdParty?.legalName || input.recipientLegalName),
        recipientAddress: _normalizeRecipientAddress(thirdParty?.address, input.recipientAddress),
        isB2B: input.isB2B === true,

        issuedByThirdPartyOrRecipient: _safeTrim(input.issuedByThirdPartyOrRecipient) || "E",
        thirdPartyLegalName: _safeTrim(input.thirdPartyLegalName) || null,
        issuerThirdPartyTaxId: _safeTrim(input.issuerThirdPartyTaxId) || null,
        nonSubjectReason: _safeTrim(input.nonSubjectReason) || null,
        // SSOT Apartado 5: reverseCharge fue promovido a inversionSujetoPasivo
        // por normalizeMovementKeys; el canon se fija abajo junto al resto de
        // claves AEAT. Cero duplicados.
        inversionSujetoPasivo: input.inversionSujetoPasivo === true || catalog?.reverseCharge === true,

        claveRegimen: _safeTrim(input.claveRegimen || catalog?.aeatRegimeKey) || "01",
        calificacionOperacion: _safeTrim(input.calificacionOperacion || catalog?.aeatOperationClassification) || "S1",
        operacionExenta: _safeTrim(input.operacionExenta || catalog?.aeatExemptOperation) || null,
        cashBasisRegime: input.cashBasisRegime === true,
        article20Exempt: input.article20Exempt === true,

        linkedAdvanceId: _safeTrim(input.linkedAdvanceId) || null,
        vatAccrualStatus: _safeTrim(input.vatAccrualStatus) || VAT_ACCRUAL_DEVENGADO,
        bankReconciliationReference: _safeTrim(input.bankReconciliationReference) || null,

        resourceId: _safeTrim(input.resourceId) || null,
        // MovimientosCaja.staffResourceId is required by the live CMS schema.
        // Online sales have no salon employee resource; persist their channel
        // resource ("online") instead of a null value.
        staffResourceId: _safeTrim(
            input.staffResourceId || input.resourceId || "CAJA_LOCAL"
        ),
        linkedBookingIds: linkedBookingIdsArr,
        transactionId,
        orderId: _safeTrim(input.orderId) || null,
        refundId: _safeTrim(input.refundId) || null,
        pairToken: _safeTrim(input.pairToken) || null,

        thirdPartyId: thirdParty?._id || null,
        catalogId: catalog?._id || null,

        schemaVersion: LEDGER_SCHEMA_VERSION,
        recordSource: _safeTrim(input.recordSource) || "INTERNAL",
        // CMS declares lineItems as OBJECT; retain its rows under an explicit items key.
        lineItems: Array.isArray(input.lineItems)
            ? { items: input.lineItems }
            : (input.lineItems && typeof input.lineItems === "object" ? input.lineItems : { items: [] }),
    };

    // 6. Internal fiscal-ledger chain payload + digest (not AEAT v0.1.2).
    const fiscalChainPayload = _buildInternalFiscalChainPayload({ ...baseMovement, previousRecordHash }, ts);
    const movementHash = await hashChain(previousRecordHash, fiscalChainPayload);

    // 7. Snapshot inmutable (ALN-09: sistemaInformatico resuelto)
    const fiscalPayload = _buildFiscalPayloadSnapshot({
        thirdParty, catalog, input, fiscalAmounts, ts,
        previousRecordHash, movementHash,
        recordTimestamp,
        sistemaInformatico,
    });

    // 8. Doc cabecera
    const doc = {
        ...baseMovement,
        hash: movementHash,
        previousRecordHash,
        // CMS DATETIME fields require Date objects. The fiscal payload keeps
        // its own Madrid-local serialization in _buildFiscalPayloadSnapshot.
        recordTimestamp: cmsRecordTimestamp,
        generationTimestamp: new Date(ts),
        desgloseDetallado: fiscalPayload.desgloseDetallado,
        // SSOT Apartado 5: payloadFiscal es la clave canonica del snapshot
        // inmutable (incluye el sistema informatico emisor); cero claves
        // duplicadas como computerSystem/fiscalPayload.
        payloadFiscal: fiscalPayload,
        projectionStatus: PROJECTION_STATUS.PENDIENTE,
        traceId,
        _createdDate: new Date(),
    };

    let cabecera;
    try {
        // Fencing check immediately before the append-only write.
        await assertFiscalLedgerLock(ledgerLock);
        cabecera = await dalInsert(MOVIMIENTOS_CAJA_COL, doc);
    } catch (err) {
        // A rejected insert can be an uncertain network outcome. Resolve by
        // the mandatory stable transactionId before deciding whether the
        // sequence may be rolled back.
        let recovery;
        try {
            const query = dalQuery(MOVIMIENTOS_CAJA_COL);
            recovery = await query
                .eq("transactionId", transactionId)
                .limit(2)
                .find({ consistencyMode: "strong" });
        } catch (readError) {
            retainLedgerLock = true;
            log.error("FISCAL_LEDGER_RESULT_UNKNOWN", {
                traceId,
                transactionId: doc.transactionId,
                insertError: err?.message,
                readError: readError?.message,
            });
            return {
                status: "ERROR",
                data: null,
                error: {
                    code: "LEDGER_RESULT_UNKNOWN",
                    message: "No se pudo confirmar el resultado del insert. El bloqueo fiscal se conserva para evitar bifurcar la cadena.",
                    traceId,
                },
            };
        }

        if (recovery?.items?.length === 1) {
            cabecera = recovery.items[0];
            log.warn("FISCAL_LEDGER_INSERT_RECOVERED", {
                traceId,
                transactionId: doc.transactionId,
                movementId: cabecera._id,
            });
        } else {
            if (recovery?.items?.length > 1) {
                retainLedgerLock = true;
                log.error("FISCAL_LEDGER_DUPLICATE_TRANSACTION_ID", {
                    traceId,
                    transactionId: doc.transactionId,
                    matches: recovery.items.length,
                });
            } else {
                const rolledBack = await rollbackFiscalSequence(ledgerLock, seq);
                if (!rolledBack) {
                    retainLedgerLock = true;
                    log.error("FISCAL_LEDGER_SEQUENCE_ROLLBACK_FAILED", {
                        traceId,
                        transactionId: doc.transactionId,
                        sequenceNumber: seq.sequenceNumber,
                    });
                }
            }
            log.error("registrarEventoEconomico: insercion de cabecera fallo", {
                traceId,
                message: err?.message,
                code: err?.code || null,
            });
            return {
                status: "ERROR",
                data: null,
                error: {
                    code: retainLedgerLock ? "LEDGER_REPAIR_REQUIRED" : "LEDGER_INSERT_FAIL",
                    message: err?.message || "No se pudo registrar el evento economico.",
                    traceId,
                },
            };
        }
    }

    // Update the operational cash-register projection as part of the online
    // payment flow. A persisted fiscal movement with a pending cash projection
    // must be reported as PARTIAL, never as a fully completed operation.
    const cashProjection = await updateCajaActualFromMovement(cabecera, traceId);

    // 9. Proyeccion secundaria - NUNCA propaga errores al caller
    let projectionStatus = cashProjection?.status === "SUCCESS"
        ? PROJECTION_STATUS.OK
        : PROJECTION_STATUS.ERROR;
    if (projectionStatus === PROJECTION_STATUS.ERROR) {
        log.error("CajaActual projection pending after fiscal ledger insert", {
            traceId,
            eventoId: cabecera._id,
            cashProjectionStatus: cashProjection?.status || "UNKNOWN",
        });
    }
    try {
        await _proyectarSegunTipoEvento(cabecera, traceId);
    } catch (err) {
        projectionStatus = PROJECTION_STATUS.ERROR;
        log.error("Proyeccion secundaria fallo (no bloqueante)", {
            traceId,
            eventoId: cabecera._id,
            eventType: cabecera.eventType,
            message: err?.message,
        });
    }

    return {
        status: projectionStatus === PROJECTION_STATUS.OK ? "SUCCESS" : "PARTIAL",
        data: {
            cabeceraId: cabecera._id,
            hash: movementHash,
            sequenceNumber: seq.sequenceNumber,
            numSerieFactura: doc.numSerieFactura,
            projectionStatus,
            cashProjectionStatus: cashProjection?.status || "UNKNOWN",
        },
        error: projectionStatus === PROJECTION_STATUS.OK
            ? null
            : { code: "CASH_OR_SECONDARY_PROJECTION_PENDING", message: "Evento fiscal persistido; una o mas proyecciones requieren reconciliacion." },
    };
    } finally {
        if (!retainLedgerLock) {
            const released = await releaseFiscalLedgerLock(ledgerLock);
            if (!released?.released) {
                log.error("FISCAL_LEDGER_LOCK_RELEASE_FAILED", {
                    traceId,
                    reason: released?.reason || "UNKNOWN",
                });
            }
        } else {
            log.error("FISCAL_LEDGER_LOCK_RETAINED_FOR_REPAIR", {
                traceId,
                transactionId,
            });
        }
    }
}

// ============================================================================
// SECCION 6 - PROYECCION SECUNDARIA
// ============================================================================

async function _proyectarSegunTipoEvento(cabecera, traceId) {
    if (cabecera.eventType === EVENT_TYPE.CIERRE_Z) {
        throw new Error("Z_CLOSING_REQUIRES_CANONICAL_WRITER");
    }
}
// ============================================================================
// SECCION 7 - CONSULTAS DE EVENTOS
// ============================================================================

export const getEventoPorId = webMethod(
    Permissions.Admin,
    async (eventoId) => {
        const traceId = makeTraceId("get-evento");
        try {
            if (!_looksLikeGuid(eventoId)) {
                return { status: "ERROR", data: null, error: { code: "INVALID_ID" } };
            }
            const evento = await dalGet(MOVIMIENTOS_CAJA_COL, eventoId, "strong").catch(() => null);
            if (!evento) {
                return { status: "ERROR", data: null, error: { code: "NOT_FOUND" } };
            }
            return {
                status: "SUCCESS",
                data: {
                    cabecera: evento,
                    // SSOT-KEYFIELD (Matriz MovimientosCaja): desgloseDetallado
                    // es el canon del doc; HOOK-CAJA-06 normaliza en escritura,
                    // pero movimientos pre-migracion pueden conservar el alias
                    // detailedBreakdown — lectura dual via helper unico.
                    detalle: (() => {
                        const d = readMovementField(evento, "desgloseDetallado");
                        return Array.isArray(d) ? d : [];
                    })(),
                },
                error: null,
            };
        } catch (error) {
            log.error("getEventoPorId fallo", { traceId, message: error?.message });
            return { status: "ERROR", data: null, error: { code: "LOOKUP_FAILED" } };
        }
    }
);

// ============================================================================
// SECCION 8 - RECONCILIACION (cron)
// ============================================================================

export async function reconciliarProyecciones() {
    const traceId = makeTraceId("recon");
    let processed = 0;
    let failed = 0;
    try {
        const pending = await dalQuery(MOVIMIENTOS_CAJA_COL)
            .ne("projectionStatus", PROJECTION_STATUS.OK)
            .gt("sequenceNumber", 0)
            .ne("recordSource", "SMOKE_TEST")
            .descending("sequenceNumber")
            .limit(PROYECCION_BATCH_LIMIT)
            .find();

        for (const evento of (pending.items || [])) {
            try {
                await withTimeout(
                    () => _proyectarSegunTipoEvento(evento, traceId),
                    PROYECCION_TIMEOUT_MS,
                    "reconciliarProyecciones"
                );
                processed += 1;
            } catch (err) {
                failed += 1;
                log.warn("Reconciliacion fallo", {
                    traceId,
                    eventoId: evento._id,
                    message: err?.message,
                });
            }
        }

        return {
            status: "SUCCESS",
            data: { processed, failed, total: pending.items?.length || 0 },
        };
    } catch (err) {
        log.error("reconciliarProyecciones fallo global", { traceId, message: err?.message });
        return {
            status: "ERROR",
            data: { processed, failed },
            error: { code: "RECON_FAIL", message: err?.message },
        };
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const __test__ = {
    normalizeAccountingAmount,
    normalizeLinkedBookingIds,
    isCancellationRectification,
    buildFiscalSystemConfig: _buildFiscalSystemConfig,
};

export default {
    registrarEventoEconomico,
    getEventoPorId,
    reconciliarProyecciones,
};