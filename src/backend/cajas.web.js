/*
=============================================================================
MODULE: backend/cajas.web.js
VERSION: v5016-CANONICAL-READ
REPO: https://github.com/nachoortegazgz/marianmadridz.git
RESPONSIBILITY: cashier fiscal ledger, daily Z closures, Veri*factu SHA-256
                chain integrity and fiscal persistence.
STANDARDS: G10 ASCII Strict. Cero suppressAuth. WIX_PAYMENTS es el metodo online canonico.
=============================================================================
*/

import { webMethod, Permissions } from "wix-web-module";
import { getSecretValue } from "backend/secretAccess";

import {
    query as dalQuery,
    getItem as dalGet,
    insertItem as dalInsert,
    updateItem as dalUpdate,
    saveItem as dalSave,
} from "backend/dataAccess";

import {
    BUSINESS_COLLECTIONS,
    OPERATIONAL_COLLECTIONS,
    SINGLETONS,
    SDK_CONFIG,
    FISCAL_RUNTIME_POLICY,
    MOVEMENT_TYPE,
    PAYMENT_METHOD,
    CHANNEL_TYPE,
    IVA_RATES,
    CASH_REGISTER_STATUS,
    TIPO_FACTURA,
    FISCAL_ROLE,
    CONTROL_TYPE,
    EVENT_TYPE,
    MOVEMENT_HISTORICAL_READ_ALIASES,
    normalizeMovementKeys,
} from "backend/internalConfig";

import {
    readInvoiceNumber,
    readInvoiceIssueDate,
    readMovementField,
    readMovementHash,
    readTotalAmount,
    readInvoiceType,
    readOperationDate,
    readTaxBase,
    readTaxAmount,
} from "backend/data";
import { isExplicitSimulationLedgerRecord } from "backend/validation";
import { buildEventLogFiscalChainPayload } from "backend/fiscalHashPayload";


export { readInvoiceNumber, readInvoiceIssueDate };

import { SECRETS } from "backend/mmSecrets";
import { requireCajero, rateLimiter } from "backend/security";
import { hashSHA256, hashChain } from "backend/securityEngine";

import {
    makeTraceId,
    _roundMoney,
    _safeTrim,
    _cleanText,
    _stableSerialize,
    _readDate,
    _readPositiveAmount,
    withTimeout,
} from "public/mmUtils";

import { logger } from "backend/logger";
import { normalizeError } from "backend/booking/bookingCore";
import { _toPublicError } from "backend/responseUtils";
import { logAuditEvent } from "backend/audit";
import {
    acquireFiscalLedgerLock,
    allocateFiscalSequence,
    assertFiscalLedgerLock,
    getCashRegisterSingleton,
    releaseFiscalLedgerLock,
    rollbackFiscalSequence,
} from "backend/fiscalLedgerLock";

const log = logger;

// ============================================================================
// CONSTANTS (ALN-01..ALN-07)
// ============================================================================

const CASH_REGISTER_ID = SINGLETONS.CAJA_PRINCIPAL;

function _isSimulationCashRegister(cashRegister) {
    return _safeTrim(cashRegister?.cashRegisterStatus).toUpperCase() === "SIMULACION";
}


const VAT_ACCRUAL_DEVENGADO = "DEVENGADO";
const VAT_ACCRUAL_ANTICIPADO = "ANTICIPADO";
const VAT_ACCRUAL_APLICACION_ANTICIPO = "APLICACION_ANTICIPO";

const MOVIMIENTOS_CAJA_COL = BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA;
const CAJA_ACTUAL_COL = BUSINESS_COLLECTIONS.CAJA_ACTUAL;
const HISTORICO_CIERRES_Z_COL = BUSINESS_COLLECTIONS.HISTORICO_CIERRES_Z;
const CONTROL_OPERATIVO_COL = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;

const LEDGER_SCHEMA_VERSION = "LEDGER_V5_FISCAL";
const GENESIS_HASH = "0".repeat(64);
const MAX_LEDGER_BATCH_PAGES = 50;
const LEDGER_PAGE_SIZE = 200;

const FISCAL_SIGNER_TIMEOUT_MS = 10000;
const SECRET_CACHE_TTL_MS = 300000;
const _secretCache = new Map();

const SIGNER_FAILURE_THRESHOLD = 3;
const SIGNER_OPEN_MS = 60000;
let _signerState = { failures: 0, openUntil: 0 };

const MONTO_OBLIGA_NIF_TERCERO = 300;
const MONTO_OBLIGA_APROBADOR_Z = 500;
const MONEY_EPSILON_FISCAL = 0.02;

// REVIEW-BY: 2027-01-31. Retirar la lectura de ONLINE cuando no existan
// consumidores historicos; WIX_PAYMENTS es el unico valor persistido.
const HISTORICAL_ONLINE_PAYMENT_METHOD = "ONLINE";
const ONLINE_PAYMENT_METHODS = Object.freeze([PAYMENT_METHOD.WIX_PAYMENTS]);

function readHistoricalPaymentMethod(movement) {
    const value = _safeTrim(movement?.paymentMethod).toUpperCase();
    if (value === HISTORICAL_ONLINE_PAYMENT_METHOD) {
        log.warn("historical-payment-method-read", {
            collection: MOVIMIENTOS_CAJA_COL,
            docId: movement?._id ?? null,
            canonical: PAYMENT_METHOD.WIX_PAYMENTS,
        });
        return PAYMENT_METHOD.WIX_PAYMENTS;
    }
    return value;
}

function _signedFiscalValue(movement, reader) {
    const accountingAmount = Number(movement?.accountingAmount);
    const sign = Number(movement?.accountingSign) < 0 || accountingAmount < 0 ? -1 : 1;
    return Math.abs(Number(reader(movement)) || 0) * sign;
}

const STRONG_READ = Object.freeze({ consistencyMode: "strong" });

// CajaActual keys are canonical and shared by sequence and register projections.
const CAJA_KEYS = Object.freeze({
    SINGLETON_KEY: "singletonKey",
    OPERATION_DATE: "operationDate",
    STATUS: "cashRegisterStatus",
    TOTAL: "netAmount",
    CASH: "cashAmount",
    CARD: "cardAmount",
    BIZUM: "voucherAmount",
    ONLINE: "otherAmount",
    OPERATIONS: "salesCount",
    OPENED_AT: "openedAt",
    CLOSED_AT: "closedAt",
    LAST_MOVEMENT_AT: "lastMovementAt",
});

// ============================================================================
// HELPERS
// ============================================================================

function _normalizeLinkedBookingIds(value) {
    const values = Array.isArray(value) ? value : String(value || "").split(",");
    return Array.from(new Set(values.map((id) => String(id || "").trim()).filter(Boolean)));
}

function _linkedBookingValue(value) {
    const ids = _normalizeLinkedBookingIds(value);
    return ids.length ? ids : null;
}

async function _rateLimitOrThrow(surface, key, traceId) {
    const rl = await rateLimiter({ surface, key });
    if (!rl.allowed) {
        const e = new Error(`RATE_LIMITED: retryAfter=${rl.retryAfter}`);
        e.code = "RATE_LIMITED";
        e.meta = { retryAfter: rl.retryAfter, surface, traceId };
        throw e;
    }
}

async function _getCachedSecret(name) {
    const now = Date.now();
    const entry = _secretCache.get(name);
    if (entry && (now - entry.at) < SECRET_CACHE_TTL_MS) {
        return entry.value;
    }
    const value = await getSecretValue(name);
    _secretCache.set(name, { value, at: now });
    return value;
}

export function _invalidateSecretCache() {
    _secretCache.clear();
}

async function _queueCompensation(params) {
    const p = params || {};
    const kind = p.kind || "FISCAL_LEDGER";
    const traceId = _safeTrim(p.traceId) || makeTraceId("comp");
    const origin = p.origin || "FISCAL_RECOVERY";
    const phase = p.phase || null;
    const rawBookingIds = Array.isArray(p.bookingIds)
        ? p.bookingIds
        : typeof p.bookingIds === "string"
            ? p.bookingIds.split(",")
            : [];
    const bookingIds = [...new Set(rawBookingIds.map((id) => _safeTrim(id)).filter(Boolean))].sort();
    const hasStableEntity = Boolean(p.transactionId || p.orderId || p.refundId || bookingIds.length > 0);
    const identity = {
        kind,
        transactionId: p.transactionId || null,
        orderId: p.orderId || null,
        refundId: p.refundId || null,
        bookingIds,
        phase,
        origin,
        totalAmount: Number(p.totalAmount) || 0,
        paymentMethod: p.paymentMethod || null,
        movementType: p.movementType || null,
        recoveryProcessor: p.recoveryProcessor || null,
        recoveryScope: p.recoveryScope || null,
        fallbackTraceId: hasStableEntity ? null : traceId,
    };
    const identityHash = await hashSHA256(_stableSerialize(identity));
    const record = {
        _id: `REC_${identityHash}`,
        controlType: CONTROL_TYPE.COMPENSATION,
        dedupeKey: `COMP_${identityHash}`,
        kind,
        transactionId: p.transactionId || null,
        orderId: p.orderId || null,
        refundId: p.refundId || null,
        totalAmount: Number(p.totalAmount) || 0,
        operationDescription: p.operationDescription || null,
        status: "PENDING_RECOVERY",
        attempts: Number(p.attempts) || 0,
        lastError: p.lastError || null,
        traceId,
        payload: {
            bookingIds: p.bookingIds || null,
            paymentMethod: p.paymentMethod || null,
            movementType: p.movementType || null,
            phase,
            origin,
            alertRequired: Boolean(p.alertRequired),
            recoveryProcessor: p.recoveryProcessor || null,
            recoveryScope: p.recoveryScope || null,
            fiscalPayload: p.fiscalPayload && typeof p.fiscalPayload === "object" &&
                !Array.isArray(p.fiscalPayload) ? p.fiscalPayload : null,
        },
        _createdDate: new Date(),
        _updatedDate: new Date(),
    };
    try {
        const saved = await dalInsert(CONTROL_OPERATIVO_COL, record);
        return { created: true, duplicate: false, id: saved?._id || record._id };
    } catch (insertError) {
        const existing = await dalGet(CONTROL_OPERATIVO_COL, record._id, "strong").catch(() => null);
        if (existing?.dedupeKey === record.dedupeKey) {
            return { created: false, duplicate: true, id: record._id };
        }
        throw insertError;
    }
}

async function validateFiscalConfig(traceId = "init") {
    const key = await _getCachedSecret(SECRETS.FISCAL_KEY);
    const nif = await _getCachedSecret(SECRETS.FISCAL_NIF_EMISOR);
    if (!key || key.length < 32) {
        log.error("CONFIGURACION_FISCAL_INVALIDA: Clave fiscal ausente o demasiado corta", { traceId });
        throw new Error("CONFIGURACION_FISCAL_INVALIDA");
    }
    if (!nif || nif.length < 9) {
        log.error("CONFIGURACION_FISCAL_INVALIDA: NIF emisor ausente o invalido", { traceId });
        throw new Error("CONFIGURACION_FISCAL_INVALIDA");
    }
    return true;
}

async function _getFiscalKeys() {
    const [key, nif] = await Promise.all([
        _getCachedSecret(SECRETS.FISCAL_KEY),
        _getCachedSecret(SECRETS.FISCAL_NIF_EMISOR),
    ]);
    if (!key || !nif) throw new Error("CONFIGURACION_FISCAL_INVALIDA");
    return { fiscalKey: key, nifEmisor: _safeTrim(nif).toUpperCase() };
}

function _formatAEATDate(ymd) {
    const clean = _safeTrim(ymd);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean);
    if (!match) return clean;
    return `${match[3]}-${match[2]}-${match[1]}`;
}

function _formatAEATDateTimeMadrid(date) {
    const dt = date instanceof Date ? date : new Date();
    const parts = new Intl.DateTimeFormat("sv-SE", {
        timeZone: SDK_CONFIG.TZ,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false,
    }).formatToParts(dt).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});

    const madridOffset = (() => {
        const madridStr = dt.toLocaleString("en-US", { timeZone: "Europe/Madrid", timeZoneName: "longOffset" });
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

// This is the project's internal fiscal-ledger chain payload, not the AEAT v0.1.2
// hash input. Preserve its exact output to avoid changing existing chain semantics.
// The official pure AEAT builder remains isolated in backend/aeatHash.js.
function _buildInternalFiscalChainPayload(movement, generatedAt) {
    const fields = [
        ["IDEmisorFactura", movement.nifEmisor || ""],
        ["NumSerieFactura", movement.numSerieFactura || ""],
        ["FechaExpedicionFactura", _formatAEATDate(movement.fechaExpedicionFactura)],
        ["TipoFactura", movement.tipoFactura || TIPO_FACTURA.F1],
        ["BaseImponibleOImporteNoSujeto", String(Number(movement.taxBase || 0).toFixed(2))],
        ["CuotaRepercutida", String(Number(movement.taxAmount || 0).toFixed(2))],
        ["ImporteTotal", String(Number(movement.totalAmount || 0).toFixed(2))],
        ["Huella", movement.previousRecordHash || ""],
        ["FechaHoraHusoGenRegistro", _formatAEATDateTimeMadrid(generatedAt)],
    ];

    if (movement.nifDestinatario) fields.push(["NIFDestinatario", String(movement.nifDestinatario).slice(0, 20)]);
    if (movement.recipientLegalName) fields.push(["NombreRazonDestinatario", String(movement.recipientLegalName).slice(0, 200)]);
    if (movement.bankReconciliationReference) fields.push(["ReferenciaBancaria", String(movement.bankReconciliationReference).slice(0, 60)]);

    if (movement.vatAccrualStatus === VAT_ACCRUAL_APLICACION_ANTICIPO) {
        fields.push(["TipoRectificativa", "I"]);
        if (movement.linkedAdvanceId) {
            fields.push(["IdAnticipoVinculado", String(movement.linkedAdvanceId).slice(0, 120)]);
        }
    }

    if (Number(movement.irpfWithholdingAmount || 0) > 0) {
        fields.push(["ImporteRetencionIRPF", String(Number(movement.irpfWithholdingAmount).toFixed(2))]);
        if (movement.withholdingBase > 0) {
            fields.push(["BaseImponibleRetencion", String(Number(movement.withholdingBase).toFixed(2))]);
        }
        if (movement.fiscalRole) {
            fields.push(["RolFiscal", String(movement.fiscalRole).slice(0, 10)]);
        }
    }

    if (Number(movement.surchargeAmount || 0) > 0) {
        fields.push(["ImporteRecargoEquivalencia", String(Number(movement.surchargeAmount).toFixed(2))]);
    }

    if (movement.correctionReason) fields.push(["MotivoRectificacion", String(movement.correctionReason).slice(0, 4)]);
    if (movement.previousInvoiceId) fields.push(["IdFacturaRectificada", String(movement.previousInvoiceId).slice(0, 120)]);

    return fields.map(([key, value]) => `${key}=${value}`).join("&");
}

async function _computeSignature(currentHash, traceId) {
    if (Date.now() < _signerState.openUntil) {
        log.warn("Fiscal signer circuit OPEN; rejecting fast", { traceId });
        throw new Error("FISCAL_SIGN_FAIL: circuit breaker open");
    }

    try {
        const endpoint = await _getCachedSecret(SECRETS.FISCAL_SIGNER_ENDPOINT);
        const bearer = await _getCachedSecret(SECRETS.FISCAL_SIGNER_BEARER);

        if (!endpoint || !bearer) {
            log.error("FISCAL_SIGNER_NOT_CONFIGURED", { traceId });
            throw new Error("FISCAL_SIGN_FAIL: signer endpoint not configured");
        }

        const response = await withTimeout(
            fetch(endpoint, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${bearer}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    hash: currentHash,
                    hashAlgorithm: "SHA-256",
                    signatureAlgorithm: "RSASSA-PKCS1-v1_5-SHA-256",
                }),
            }),
            FISCAL_SIGNER_TIMEOUT_MS,
            "fiscal_signer"
        );

        if (!response.ok) {
            const errBody = await response.text().catch(() => "");
            throw new Error(`FISCAL_SIGNER_HTTP_${response.status}: ${errBody.slice(0, 200)}`);
        }

        const data = await response.json();
        if (!data?.signature) throw new Error("FISCAL_SIGNER_INVALID_RESPONSE");

        _signerState.failures = 0;
        _signerState.openUntil = 0;
        return data.signature;
    } catch (err) {
        _signerState.failures++;
        if (_signerState.failures >= SIGNER_FAILURE_THRESHOLD) {
            _signerState.openUntil = Date.now() + SIGNER_OPEN_MS;
            log.error("Fiscal signer circuit OPEN", {
                failures: _signerState.failures,
                openUntilMs: SIGNER_OPEN_MS,
                traceId,
            });
        }
        log.error("_computeSignature failed", { error: err?.message, traceId });
        throw new Error(`FISCAL_SIGN_FAIL: ${err?.message}`);
    }
}

function _generateVerificationQR(numSerieFactura, nifEmisor, fechaExpedicionFactura, totalAmount) {
    const baseUrl = "https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR";
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(_safeTrim(fechaExpedicionFactura));
    const amount = Number(totalAmount);
    const calendarDate = dateMatch
        ? new Date(Date.UTC(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3])))
        : null;
    const validCalendarDate = Boolean(
        calendarDate &&
        calendarDate.getUTCFullYear() === Number(dateMatch[1]) &&
        calendarDate.getUTCMonth() === Number(dateMatch[2]) - 1 &&
        calendarDate.getUTCDate() === Number(dateMatch[3])
    );
    if (!validCalendarDate || !Number.isFinite(amount) || amount < 0) {
        throw new Error("FISCAL_QR_INPUT_INVALID");
    }
    const params = [
        `nif=${encodeURIComponent(_safeTrim(nifEmisor).toUpperCase())}`,
        `numserie=${encodeURIComponent(_safeTrim(numSerieFactura))}`,
        `fecha=${encodeURIComponent(_formatAEATDate(fechaExpedicionFactura))}`,
        `importe=${encodeURIComponent(_roundMoney(amount).toFixed(2))}`,
    ];
    return `${baseUrl}?${params.join("&")}`;
}

async function _getLastMovement() {
    const res = await dalQuery(MOVIMIENTOS_CAJA_COL)
        .gt("sequenceNumber", 0)
        .ne("recordSource", "SMOKE_TEST")
        .descending("sequenceNumber")
        .limit(20)
        .find(STRONG_READ);
    return (res?.items || []).find((item) => !isExplicitSimulationLedgerRecord(item)) || null;
}

async function _assertPeriodNotClosed(operationDate, traceId) {
    const existingZ = await dalGet(HISTORICO_CIERRES_Z_COL, `Z_${operationDate}`, "strong").catch(() => null);
    if (existingZ) {
        log.error("PERIOD_CLOSED: Intento de insertar movimiento en periodo cerrado", { operationDate, traceId });
        throw new Error("PERIOD_CLOSED: No se pueden insertar movimientos en un periodo con cierre Z");
    }
}

function _resolveFiscalBase({ amount, taxRate, withholdingBase, irpfWithholdingAmount, surchargeAmount }) {
    if (withholdingBase > 0) {
        const base = _roundMoney(withholdingBase);
        const taxAmount = _roundMoney(base * taxRate);
        const expectedTotal = _roundMoney(
            base + taxAmount + (surchargeAmount || 0) - (irpfWithholdingAmount || 0)
        );
        const diff = Math.abs(expectedTotal - amount);
        if (diff > MONEY_EPSILON_FISCAL) {
            return {
                ok: false,
                code: "CUADRE_FISCAL_INVALIDO",
                message: `Base ${base} + IVA ${taxAmount} + RE ${surchargeAmount || 0} - Ret ${irpfWithholdingAmount || 0} = ${expectedTotal}, amount ${amount}`,
                base,
                taxAmount,
            };
        }
        return { ok: true, base, taxAmount };
    }
    const base = _roundMoney(amount / (1 + taxRate));
    const taxAmount = _roundMoney(amount - base);
    return { ok: true, base, taxAmount };
}

// ============================================================================
// REGISTER MANUAL TRANSACTION
// ============================================================================

export const registerManualTransaction = webMethod(Permissions.SiteMember, async (payload) => {
    const traceId = payload?.traceId || makeTraceId("manual-tx");
    try {
        await _rateLimitOrThrow(
            "cajas.registerManualTransaction",
            _safeTrim(payload?.resourceId) || "CAJA_LOCAL",
            traceId
        );

        await requireCajero(traceId);
        if (FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED !== true) {
            return { status: "ERROR", data: null, error: { code: "FISCAL_LEDGER_WRITES_DISABLED", message: "La escritura fiscal permanece deshabilitada hasta completar la certificacion de runtime." }, traceId };
        }
        await validateFiscalConfig(traceId);
        const { nifEmisor } = await _getFiscalKeys();

        const amount = _readPositiveAmount(payload?.totalAmount);
        if (!amount) {
            return { status: "ERROR", data: null, error: { code: "INVALID_AMOUNT", message: "Importe positivo requerido" } };
        }

        const paymentMethod = _safeTrim(payload?.paymentMethod).toUpperCase();
        if (!Object.values(PAYMENT_METHOD).includes(paymentMethod)) {
            return { status: "ERROR", data: null, error: { code: "INVALID_PAYMENT_METHOD", message: "Forma de pago invalida" } };
        }

        const channelType = _safeTrim(payload?.channelType).toUpperCase();
        if (channelType && !Object.values(CHANNEL_TYPE).includes(channelType)) {
            return { status: "ERROR", data: null, error: { code: "INVALID_CHANNEL_TYPE", message: "Canal de operacion invalido" } };
        }

        const movementType = _safeTrim(payload?.movementType || payload?.tipoMovimiento || "VENTA").toUpperCase();
        const isRefundMovement = [
            MOVEMENT_TYPE.REEMBOLSO,
            MOVEMENT_TYPE.DEVOLUCION,
            MOVEMENT_TYPE.DEVOLUCION_SERVICIO,
        ].includes(movementType);
        const operationDescription = _cleanText(payload?.operationDescription || payload?.description || "Venta mostrador", 500);
        const resourceId = _safeTrim(payload?.resourceId || "CAJA_LOCAL");
        const transactionId = _safeTrim(payload?.transactionId) || null;

        const inDto = normalizeMovementKeys({ ...(payload || {}) });
        if (FISCAL_RUNTIME_POLICY.ALLOW_SIMULATION_RECORDS !== true && isExplicitSimulationLedgerRecord(inDto)) {
            return { status: "ERROR", data: null, error: { code: "TEST_DATA_NOT_ALLOWED_IN_PRODUCTION", message: "Los registros de simulacion no pueden persistirse en el ledger operativo." }, traceId };
        }
        const eventType = _safeTrim(inDto.eventType).toUpperCase() || (
            [MOVEMENT_TYPE.REEMBOLSO, MOVEMENT_TYPE.DEVOLUCION, MOVEMENT_TYPE.DEVOLUCION_SERVICIO].includes(movementType)
                ? EVENT_TYPE.RECTIFICATIVA
                : movementType === MOVEMENT_TYPE.AJUSTE
                    ? EVENT_TYPE.AJUSTE
                    : EVENT_TYPE.VENTA_LINEA
        );

        const nifDestinatario = _safeTrim(inDto.nifDestinatario) || null;
        const recipientLegalName = _cleanText(inDto.recipientLegalName || "", 200) || null;
        const isB2B = inDto.isB2B === true;
        const requiresTaxId = isB2B || amount >= MONTO_OBLIGA_NIF_TERCERO;

        if (requiresTaxId && !nifDestinatario) {
            return {
                status: "ERROR", data: null,
                error: {
                    code: "RECIPIENT_TAX_ID_REQUIRED",
                    message: `Ventas B2B o > ${MONTO_OBLIGA_NIF_TERCERO} EUR requieren NIF del tercero`,
                },
            };
        }

        if (requiresTaxId && !recipientLegalName) {
            return {
                status: "ERROR", data: null,
                error: {
                    code: "RECIPIENT_LEGAL_NAME_REQUIRED",
                    message: `Ventas B2B o > ${MONTO_OBLIGA_NIF_TERCERO} EUR requieren razon social del tercero`,
                },
            };
        }

        const irpfWithholdingRate = Number(inDto.irpfWithholdingRate) || 0;
        const withholdingBase = Number(inDto.withholdingBase) || 0;
        let irpfWithholdingAmount = Number(inDto.irpfWithholdingAmount) || 0;

        if (irpfWithholdingRate > 0 && withholdingBase > 0 && irpfWithholdingAmount === 0) {
            irpfWithholdingAmount = _roundMoney(withholdingBase * irpfWithholdingRate);
        }

        const surchargeRate = Number(inDto.surchargeRate) || 0;
        let surchargeAmount = Number(inDto.surchargeAmount) || 0;

        if (surchargeRate > 0 && surchargeAmount === 0) {
            const baseForSurcharge = withholdingBase > 0
                ? withholdingBase
                : _roundMoney(amount / (1 + (Number(inDto.tipoImpositivo) || IVA_RATES.GENERAL)));
            surchargeAmount = _roundMoney(baseForSurcharge * surchargeRate);
        }

        const rawFiscalRole = _safeTrim(inDto.fiscalRole).toUpperCase();
        const fiscalRole = (rawFiscalRole === FISCAL_ROLE.EMISOR || rawFiscalRole === FISCAL_ROLE.RECEPTOR)
            ? rawFiscalRole
            : FISCAL_ROLE.EMISOR;

        const linkedAdvanceId = _safeTrim(inDto.linkedAdvanceId) || null;
        const vatAccrualStatus = _safeTrim(inDto.vatAccrualStatus)
            || (movementType === MOVEMENT_TYPE.ANTICIPO
                ? VAT_ACCRUAL_ANTICIPADO
                : linkedAdvanceId
                    ? VAT_ACCRUAL_APLICACION_ANTICIPO
                    : VAT_ACCRUAL_DEVENGADO);

        const bankReconciliationReference = _safeTrim(inDto.bankReconciliationReference) || null;
        const tipoFacturaIn = _safeTrim(inDto.tipoFactura) || null;
        const correctionReason = _safeTrim(inDto.correctionReason) || null;
        const previousInvoiceId = _safeTrim(inDto.previousInvoiceId) || null;
        const issuerInvoiceNumber = _safeTrim(inDto.issuerInvoiceNumber) || null;

        if (transactionId) {
            const existingRes = await dalQuery(MOVIMIENTOS_CAJA_COL)
                .eq("transactionId", transactionId)
                .limit(1)
                .find(STRONG_READ);

            if (existingRes?.items?.length > 0) {
                log.info("Ledger idempotent duplicate detected", { transactionId, traceId });
                const cashProjection = await _updateCajaActual(existingRes.items[0], traceId);
                // Retry projection if the fiscal movement survived a prior partial attempt.
                if (cashProjection?.status !== "SUCCESS") {
                    return {
                        status: "PARTIAL",
                        data: existingRes.items[0],
                        error: { code: "CASH_PROJECTION_PENDING", message: "Movimiento fiscal persistido; CajaActual requiere reconciliacion." },
                        idempotent: true,
                        cashProjectionStatus: cashProjection?.status || "UNKNOWN",
                    };
                }
                return { status: "SUCCESS", data: existingRes.items[0], error: null, idempotent: true, cashProjectionStatus: "SUCCESS" };
            }
        }

        const currentCashRegister = await getCashRegisterSingleton();
        if (_isSimulationCashRegister(currentCashRegister)) {
            return { status: "ERROR", data: null, error: { code: "CASH_REGISTER_SIMULATION_STATE", message: "La caja actual contiene estado de simulacion; no se permiten movimientos reales." } };
        }
        const operationDate = new Date().toLocaleDateString("sv-SE", { timeZone: SDK_CONFIG.TZ });
        await _assertPeriodNotClosed(operationDate, traceId);

        const taxRate = Number(inDto.tipoImpositivo) || IVA_RATES.GENERAL;
        const fiscalCalc = _resolveFiscalBase({
            amount, taxRate, withholdingBase, irpfWithholdingAmount, surchargeAmount,
        });

        if (!fiscalCalc.ok) {
            log.warn("Fiscal cuadre failed", { traceId, code: fiscalCalc.code });
            return {
                status: "ERROR", data: null,
                error: { code: fiscalCalc.code, message: fiscalCalc.message },
            };
        }

        const taxableBaseOrNonSubjectAmount = fiscalCalc.base;
        const taxAmount = fiscalCalc.taxAmount;

        const ledgerLock = await acquireFiscalLedgerLock(traceId);
        let retainLedgerLock = false;
        try {
            // Recheck idempotency inside the global lock. The earlier preflight
            // is only an optimization and cannot prevent a concurrent duplicate.
            if (transactionId) {
                const lockedExisting = await dalQuery(MOVIMIENTOS_CAJA_COL)
                    .eq("transactionId", transactionId)
                    .limit(1)
                    .find(STRONG_READ);
                if (lockedExisting?.items?.length === 1) {
                    const cashProjection = await _updateCajaActual(lockedExisting.items[0], traceId);
                    return {
                        status: cashProjection?.status === "SUCCESS" ? "SUCCESS" : "PARTIAL",
                        data: lockedExisting.items[0],
                        error: cashProjection?.status === "SUCCESS" ? null : {
                            code: "CASH_PROJECTION_PENDING",
                            message: "Movimiento fiscal persistido; CajaActual requiere reconciliacion.",
                        },
                        idempotent: true,
                        cashProjectionStatus: cashProjection?.status || "UNKNOWN",
                    };
                }
                if (lockedExisting?.items?.length > 1) {
                    retainLedgerLock = true;
                    throw new Error("FISCAL_TRANSACTION_ID_AMBIGUOUS");
                }
            }

        // Revalidate after acquiring the shared lock: a Z close may have
        // completed while this writer was waiting.
        await _assertPeriodNotClosed(operationDate, traceId);

        const lastMovement = await _getLastMovement();
        let seq;
        try {
            seq = await allocateFiscalSequence(ledgerLock, lastMovement);
        } catch (sequenceError) {
            if (sequenceError?.code === "SEQUENCE_RESULT_UNKNOWN") retainLedgerLock = true;
            throw sequenceError;
        }
        const previousRecordHash = lastMovement?.hash || GENESIS_HASH;

        const generatedAt = new Date();

        const baseMovement = {
            sequenceNumber: seq.sequenceNumber,
            numSerieFactura: seq.numSerieFactura,
            fechaExpedicionFactura: operationDate,
            // MATRIZ v15 (MovimientosCaja, decision de usuario): amount y
            // totalAmount COEXISTEN como claves canonicas propias hasta cerrar
            // el ADR de la formula fiscal. amount = importe base cobrado;
            // totalAmount = total con impuestos. Cuadre: taxBase + taxAmount
            // == totalAmount.
            fechaOperacion: operationDate,
            fiscalPeriod: operationDate.slice(0, 7),
            movementType,
            eventType,
            paymentMethod,
            channelType: channelType || null,
            amount: taxableBaseOrNonSubjectAmount,
            totalAmount: amount,
            taxBase: taxableBaseOrNonSubjectAmount,
            taxAmount,
            tipoImpositivo: taxRate,
            accountingSign: isRefundMovement ? -1 : 1,
            accountingAmount: isRefundMovement ? -amount : amount,
            operationDescription,
            lineItems: inDto.lineItems || [],
            nifEmisor,
            schemaVersion: LEDGER_SCHEMA_VERSION,
            projectionStatus: "PROYECTADO",
            recordSource: _safeTrim(inDto.recordSource) || "INTERNAL",
            staffResourceId: resourceId,
            resourceId,
            linkedBookingIds: _linkedBookingValue(inDto.linkedBookingIds),
            transactionId: transactionId || `TX_${seq.sequenceNumber}`,
            orderId: inDto.orderId || null,
            refundId: inDto.refundId || null,

            nifDestinatario,
            recipientLegalName,
            isB2B,

            withholdingBase,
            irpfWithholdingRate,
            irpfWithholdingAmount,
            fiscalRole,

            surchargeRate,
            surchargeAmount,

            linkedAdvanceId,
            vatAccrualStatus,

            bankReconciliationReference,

            tipoFactura: tipoFacturaIn || TIPO_FACTURA.F1,
            correctionReason,
            previousInvoiceId,
            issuerInvoiceNumber,
        };

        const fiscalChainPayload = _buildInternalFiscalChainPayload({ ...baseMovement, previousRecordHash }, generatedAt);
        const movementHash = await hashChain(previousRecordHash, fiscalChainPayload);

        let digitalSignature;
        try {
            digitalSignature = await _computeSignature(movementHash, traceId);
        } catch (signErr) {
            const rolledBack = await rollbackFiscalSequence(ledgerLock, seq);
            if (!rolledBack) {
                retainLedgerLock = true;
                log.error("FISCAL_SEQUENCE_ROLLBACK_FAILED", {
                    traceId,
                    transactionId: baseMovement.transactionId,
                    sequenceNumber: seq.sequenceNumber,
                });
                return {
                    status: "ERROR",
                    data: null,
                    error: {
                        code: "LEDGER_REPAIR_REQUIRED",
                        message: "No se pudo revertir la secuencia reservada; el bloqueo fiscal se conserva para revision.",
                    },
                };
            }
            log.warn("Fiscal signer unavailable; queuing movement without consuming a sequence", {
                transactionId: baseMovement.transactionId,
                error: signErr?.message,
                traceId,
            });
            const recovery = await queueFiscalRecovery({
                transactionId: baseMovement.transactionId,
                bookingIds: baseMovement.linkedBookingIds,
                totalAmount: amount,
                paymentMethod,
                operationDescription,
                resourceId,
                movementType,
                phase: "WAIT_FOR_SIGNER",
                origin: "FISCAL_SIGNER_DOWN",
                traceId,
                lastError: signErr?.message || "FISCAL_SIGN_FAIL",
            });
            return {
                status: "PARTIAL",
                data: {
                    ...baseMovement,
                    previousRecordHash,
                    hash: movementHash,
                    pendingSignature: true,
                    queued: recovery.queued,
                },
                error: {
                    code: recovery.queued ? "FISCAL_SIGNATURE_PENDING" : "FISCAL_SIGNATURE_RECOVERY_QUEUE_FAILED",
                    message: recovery.queued
                        ? "La firma fiscal esta pendiente de recuperacion."
                        : "La firma fiscal esta pendiente y no se pudo registrar su recuperacion.",
                },
            };
        }

        const verificationQR = _generateVerificationQR(
            baseMovement.numSerieFactura,
            nifEmisor,
            operationDate,
            amount
        );

        const movement = {
            ...baseMovement,
            previousRecordHash,
            hash: movementHash,
            digitalSignature,
            aeatPayload: fiscalChainPayload,
            verificationQR,
            hashAlgorithm: "SHA-256",
            signatureAlgorithm: "RSASSA-PKCS1-v1_5-SHA-256",
            recordTimestamp: generatedAt,
            traceId,
            _createdDate: new Date(),
        };

        // Atomic idempotency claim: the CMS item ID is deterministic for the
        // caller-supplied transactionId. Wix rejects a second insert with the
        // same _id, unlike save/upsert. Keep the claim as an audit/recovery
        // marker; never delete it automatically after an ambiguous failure.
        if (transactionId) {
            const claimId = `LEDGER_TX_${await hashSHA256(transactionId)}`;
            try {
                await dalInsert(CONTROL_OPERATIVO_COL, {
                    _id: claimId,
                    controlType: CONTROL_TYPE.LEDGER_IDEMPOTENCY,
                    transactionId,
                    dedupeKey: transactionId,
                    status: "RESERVED",
                    traceId,
                    _createdDate: new Date(),
                });
            } catch (claimError) {
                const existingMovement = await dalQuery(MOVIMIENTOS_CAJA_COL)
                    .eq("transactionId", transactionId)
                    .limit(1)
                    .find(STRONG_READ)
                    .catch(() => ({ items: [] }));
                if (existingMovement?.items?.length === 1) {
                    await rollbackFiscalSequence(ledgerLock, seq);
                    log.info("Ledger duplicate recovered after atomic claim", { transactionId, traceId });
                    return { status: "SUCCESS", data: existingMovement.items[0], error: null, idempotent: true };
                }
                const existingClaim = await dalGet(CONTROL_OPERATIVO_COL, claimId, "strong").catch(() => null);
                if (existingClaim) {
                    const rolledBack = await rollbackFiscalSequence(ledgerLock, seq);
                    if (!rolledBack) retainLedgerLock = true;
                    return {
                        status: "ERROR",
                        data: null,
                        error: {
                            code: rolledBack ? "IDEMPOTENCY_IN_PROGRESS" : "LEDGER_REPAIR_REQUIRED",
                            message: "La transaccion ya esta reservada; requiere reconciliacion antes de reintentar.",
                        },
                    };
                }
                throw claimError;
            }
        }

        let saved;
        try {
            await assertFiscalLedgerLock(ledgerLock);
            saved = await dalInsert(MOVIMIENTOS_CAJA_COL, movement);
        } catch (insertError) {
            let recovered;
            try {
                recovered = await dalQuery(MOVIMIENTOS_CAJA_COL)
                    .eq(transactionId ? "transactionId" : "traceId",
                        transactionId || baseMovement.transactionId)
                    .limit(2)
                    .find(STRONG_READ);
            } catch (readError) {
                retainLedgerLock = true;
                log.error("MANUAL_LEDGER_RESULT_UNKNOWN", {
                    traceId,
                    transactionId: baseMovement.transactionId,
                    insertError: insertError?.message,
                    readError: readError?.message,
                });
                return {
                    status: "ERROR",
                    data: null,
                    error: {
                        code: "LEDGER_RESULT_UNKNOWN",
                        message: "No se pudo confirmar el resultado del insert. El bloqueo fiscal se conserva para evitar bifurcar la cadena.",
                    },
                };
            }

            if (recovered?.items?.length === 1) {
                saved = recovered.items[0];
            } else {
                const rolledBack = recovered?.items?.length === 0
                    ? await rollbackFiscalSequence(ledgerLock, seq)
                    : false;
                if (!rolledBack) retainLedgerLock = true;
                return {
                    status: "ERROR",
                    data: null,
                    error: {
                        code: rolledBack ? "LEDGER_INSERT_FAIL" : "LEDGER_REPAIR_REQUIRED",
                        message: insertError?.message || "No se pudo confirmar el registro fiscal.",
                    },
                };
            }
        }

        const cashProjection = await _updateCajaActual(saved, traceId);
        if (cashProjection?.status !== "SUCCESS") {
            return {
                status: "PARTIAL",
                data: saved,
                error: { code: "CASH_PROJECTION_PENDING", message: "Movimiento fiscal persistido; CajaActual requiere reconciliacion." },
                cashProjectionStatus: cashProjection?.status || "UNKNOWN",
            };
        }

        return { status: "SUCCESS", data: saved, error: null, cashProjectionStatus: "SUCCESS" };
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
    } catch (err) {
        const norm = normalizeError(err);
        log.error("registerManualTransaction failed", { code: norm.code, error: norm.message, traceId });
        return {
            status: "ERROR",
            data: null,
            error: {
                code: norm.code || "LEDGER_FAIL",
                message: norm.code === "PERIOD_CLOSED"
                    ? "El periodo fiscal esta cerrado."
                    : "No se pudo completar la operacion fiscal.",
            },
        };
    }
});

// ============================================================================
// UPDATE CAJA ACTUAL
// ============================================================================

// SSOT Apartado 4 (CajaActual): claves canonicas cashAmount/cardAmount/...;
// los campos de saldo usan la semantica "acumulado del periodo abierto", no
// "saldo contable". Claves historical (cashBalance, cardBalance...) eliminadas:
// CajaActual no tiene hook de normalizacion y cualquier lector debe usar
// estas constantes como unica fuente.

// CajaActual's singletonKey is the logical identity. Wix may assign a
// different physical _id to the collection's singleton item, so never use
// CAJA_PRINCIPAL as a getItem(_id) argument. Fail closed on duplicates.
async function _updateCajaActual(movement, traceId) {
    try {
        const method = _safeTrim(movement?.paymentMethod).toUpperCase();
        const channelType = _safeTrim(movement?.channelType).toUpperCase();
        if (method !== PAYMENT_METHOD.EFECTIVO || channelType !== CHANNEL_TYPE.PRESENCIAL) {
            return {
                status: "SUCCESS",
                skipped: true,
                reason: "NO_PHYSICAL_CASH_EFFECT",
                movementId: _safeTrim(movement?._id || movement?.transactionId) || null,
            };
        }

        const movementKey = _safeTrim(movement?._id || movement?.transactionId);
        if (!movementKey) throw new Error("CAJA_MOVEMENT_ID_REQUIRED");

        // CajaActual is a mutable projection. Use the CMS revision on updates
        // and retain the movement ID in the same write as the balance change.
        // This makes retries idempotent and concurrent updates recoverable.
        for (let attempt = 0; attempt < 4; attempt += 1) {
            let cashRegister = await getCashRegisterSingleton();
            const isNew = !cashRegister;
            if (_isSimulationCashRegister(cashRegister)) {
                throw new Error("CAJA_ACTUAL_SIMULATION_STATE");
            }
            if (!cashRegister) {
                cashRegister = {
                    _id: CASH_REGISTER_ID,
                    [CAJA_KEYS.SINGLETON_KEY]: SINGLETONS.CAJA_PRINCIPAL,
                    [CAJA_KEYS.OPERATION_DATE]: readOperationDate(movement) || new Date().toLocaleDateString("sv-SE", { timeZone: SDK_CONFIG.TZ }),
                    [CAJA_KEYS.STATUS]: CASH_REGISTER_STATUS.ABIERTA,
                    [CAJA_KEYS.TOTAL]: 0, [CAJA_KEYS.CASH]: 0, [CAJA_KEYS.CARD]: 0,
                    [CAJA_KEYS.BIZUM]: 0, [CAJA_KEYS.ONLINE]: 0,
                    [CAJA_KEYS.OPERATIONS]: 0,
                    sequenceCounters: {},
                    [CAJA_KEYS.OPENED_AT]: new Date(), [CAJA_KEYS.CLOSED_AT]: null,
                    [CAJA_KEYS.LAST_MOVEMENT_AT]: new Date(),
                    _createdDate: new Date(), _updatedDate: new Date(),
                };
            }

            const sequenceCounters = { ...(cashRegister.sequenceCounters || {}) };
            const appliedMovementIds = Array.isArray(sequenceCounters.appliedMovementIds)
                ? sequenceCounters.appliedMovementIds.map(String)
                : [];
            if (appliedMovementIds.includes(movementKey)) {
                return { status: "SUCCESS", idempotent: true, movementId: movementKey };
            }

            const amount = Number(movement.accountingAmount) || 0;
            cashRegister[CAJA_KEYS.CASH] = _roundMoney((cashRegister[CAJA_KEYS.CASH] || 0) + amount);

            sequenceCounters.appliedMovementIds = [...appliedMovementIds, movementKey];
            cashRegister.sequenceCounters = sequenceCounters;
            cashRegister[CAJA_KEYS.TOTAL] = _roundMoney(cashRegister[CAJA_KEYS.CASH] || 0);
            cashRegister[CAJA_KEYS.OPERATIONS] = Number(cashRegister[CAJA_KEYS.OPERATIONS] || 0) + 1;
            cashRegister[CAJA_KEYS.LAST_MOVEMENT_AT] = new Date();
            cashRegister._updatedDate = new Date();

            try {
                if (isNew) {
                    await dalInsert(CAJA_ACTUAL_COL, cashRegister);
                } else {
                    await dalUpdate(CAJA_ACTUAL_COL, cashRegister);
                }
                return { status: "SUCCESS", idempotent: false, movementId: movementKey };
            } catch (writeError) {
                if (attempt === 3) throw writeError;
                await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
            }
        }
        throw new Error("CAJA_ACTUAL_CONCURRENCY_RETRIES_EXHAUSTED");
    } catch (err) {
        log.error("_updateCajaActual failed; queuing resync", { traceId, error: err?.message });
        try {
            await _queueCompensation({
                kind: "RESYNC_CAJA_BALANCE",
                transactionId: movement?.transactionId || null,
                totalAmount: Number(movement?.accountingAmount) || 0,
                paymentMethod: movement?.paymentMethod || null,
                operationDescription: "Sincronizacion de saldo tras fallo en _updateCajaActual",
                phase: "WAIT_FOR_CAJA_RESYNC",
                origin: "UPDATE_CAJA_FAILED",
                traceId,
                lastError: err?.message || "UNKNOWN",
            });
        } catch (queueErr) {
            log.error("_updateCajaActual: failed to queue resync", { traceId, error: queueErr?.message });
        }
        return { status: "PENDING_RECONCILIATION", error: err?.message || "UNKNOWN" };
    }
}

export async function updateCajaActualFromMovement(movement, traceId) {
    return _updateCajaActual(movement, traceId || movement?.traceId || makeTraceId("caja-projection"));
}

// ============================================================================
// REGISTER BOOKING PAYMENT
// ============================================================================

export async function registerBookingPayment(bookingIds, totalAmount, method, meta = {}) {
    const m = normalizeMovementKeys({ ...(meta || {}) });
    const traceId = m.traceId || makeTraceId("bkg-pay");

    const vatAccrualStatus = m.linkedAdvanceId
        ? VAT_ACCRUAL_APLICACION_ANTICIPO
        : m.vatAccrualStatus || VAT_ACCRUAL_DEVENGADO;

    return await registerManualTransaction({
        totalAmount,
        paymentMethod: method,
        movementType: m.movementType || "VENTA_ONLINE",
        operationDescription: m.operationDescription || `Cobro reserva ${bookingIds}`,
        resourceId: m.resourceId || "ONLINE",
        linkedBookingIds: _linkedBookingValue(bookingIds),
        transactionId: m.transactionId || null,
        orderId: m.orderId || null,
        refundId: m.refundId || null,
        channelType: m.channelType || null,
        origen: m.origen || null,
        traceId,

        nifDestinatario: m.nifDestinatario || null,
        recipientLegalName: m.recipientLegalName || null,
        isB2B: m.isB2B === true,

        irpfWithholdingRate: m.irpfWithholdingRate || 0,
        withholdingBase: m.withholdingBase || 0,
        irpfWithholdingAmount: m.irpfWithholdingAmount || 0,
        fiscalRole: m.fiscalRole || FISCAL_ROLE.EMISOR,

        surchargeRate: m.surchargeRate || 0,

        linkedAdvanceId: m.linkedAdvanceId || null,
        vatAccrualStatus,

        bankReconciliationReference: m.bankReconciliationReference || null,

        tipoFactura: m.tipoFactura || null,
        correctionReason: m.correctionReason || null,
        previousInvoiceId: m.previousInvoiceId || null,
    });
}

// ============================================================================
// QUEUE FISCAL RECOVERY
// ============================================================================

export async function queueFiscalRecovery(recoveryData) {
    const traceId = recoveryData.traceId || makeTraceId("fiscal-rec");
    try {
        const queued = await _queueCompensation({
            kind: recoveryData.kind || "FISCAL_LEDGER",
            transactionId: recoveryData.transactionId,
            bookingIds: recoveryData.bookingIds,
            orderId: recoveryData.orderId,
            refundId: recoveryData.refundId,
            totalAmount: Number(recoveryData.totalAmount) || 0,
            paymentMethod: recoveryData.paymentMethod,
            operationDescription: recoveryData.operationDescription || "Fiscal recovery",
            movementType: recoveryData.movementType || recoveryData.tipoMovimiento,
            phase: recoveryData.phase,
            origin: recoveryData.origin || "FISCAL_RECOVERY",
            traceId,
            lastError: recoveryData.lastError,
            alertRequired: false,
            recoveryProcessor: recoveryData.recoveryProcessor || null,
            recoveryScope: recoveryData.recoveryScope || null,
            fiscalPayload: recoveryData.fiscalPayload || null,
        });
        return {
            queued: Boolean(queued?.created || queued?.duplicate),
            created: Boolean(queued?.created),
            duplicate: Boolean(queued?.duplicate),
            traceId,
        };
    } catch (err) {
        log.error("queueFiscalRecovery failed", { traceId, error: err?.message });
        return { queued: false, traceId, error: "QUEUE_FAILED" };
    }
}

// ============================================================================
// GET CASHIER STATE
// ============================================================================

export const getCashierState = webMethod(Permissions.SiteMember, async (options = {}) => {
    const { traceId, diaKey } = options;
    try {
        await requireCajero(traceId);
        const cashRegister = await getCashRegisterSingleton();
        if (_isSimulationCashRegister(cashRegister)) {
            return { status: "ERROR", data: null, error: { code: "CASH_REGISTER_SIMULATION_STATE", message: "El saldo mostrado pertenece a una caja de simulacion y no es un saldo operativo." } };
        }
        const day = diaKey || new Date().toLocaleDateString("sv-SE", { timeZone: SDK_CONFIG.TZ });
        const res = await dalQuery(MOVIMIENTOS_CAJA_COL)
            .eq("fechaExpedicionFactura", day)
            .gt("sequenceNumber", 0)
            .ne("recordSource", "SMOKE_TEST")
            .limit(1)
            .find(STRONG_READ);
        const totalOperations = (res.items || []).length > 0
            ? await _countMovementsOfDay(day)
            : 0;
        return {
            status: "SUCCESS",
            data: {
                _id: cashRegister?._id || CASH_REGISTER_ID,
                singletonKey: cashRegister?.[CAJA_KEYS.SINGLETON_KEY] || SINGLETONS.CAJA_PRINCIPAL,
                operationDate: cashRegister?.[CAJA_KEYS.OPERATION_DATE] || day,
                cashRegisterStatus: cashRegister?.[CAJA_KEYS.STATUS] || CASH_REGISTER_STATUS.CERRADA,
                netAmount: cashRegister?.[CAJA_KEYS.TOTAL] ?? 0,
                cashAmount: cashRegister?.[CAJA_KEYS.CASH] ?? 0,
                cardAmount: cashRegister?.[CAJA_KEYS.CARD] ?? 0,
                voucherAmount: cashRegister?.[CAJA_KEYS.BIZUM] ?? 0,
                otherAmount: cashRegister?.[CAJA_KEYS.ONLINE] ?? 0,
                salesCount: cashRegister?.[CAJA_KEYS.OPERATIONS] ?? 0,
                totalOperations,
                openedAt: cashRegister?.[CAJA_KEYS.OPENED_AT] ?? null,
                closedAt: cashRegister?.[CAJA_KEYS.CLOSED_AT] ?? null,
                lastMovementAt: cashRegister?.[CAJA_KEYS.LAST_MOVEMENT_AT] ?? null,
            },
            error: null,
        };
    } catch (err) {
        return { status: "ERROR", data: null, error: _toPublicError(err, "CASHIER_STATE_FAIL") };
    }
});

async function _countMovementsOfDay(diaKey) {
    let count = 0;
    let res = await dalQuery(MOVIMIENTOS_CAJA_COL)
        .eq("fechaExpedicionFactura", diaKey)
        .gt("sequenceNumber", 0)
        .ne("recordSource", "SMOKE_TEST")
        .limit(LEDGER_PAGE_SIZE)
        .find();
    count += (res.items || []).length;
    let page = 2;
    while (res.hasNext() && page <= MAX_LEDGER_BATCH_PAGES) {
        res = await res.next();
        count += (res.items || []).length;
        page++;
    }
    return count;
}

// ============================================================================
// REGISTER Z CLOSING
// ============================================================================

async function _registerZClosing(diaKey, options = {}, authorizeCashier = true) {
    const traceId = _safeTrim(options?.traceId) || makeTraceId("z-close");
    let ledgerLock = null;
    let retainLedgerLock = false;
    try {
        if (authorizeCashier) await requireCajero(traceId);
        if (FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED !== true) {
            return { status: "ERROR", data: null, error: { code: "FISCAL_LEDGER_WRITES_DISABLED", message: "La escritura fiscal permanece deshabilitada hasta completar la certificacion de runtime." }, traceId };
        }
        const currentCashRegister = await getCashRegisterSingleton();
        if (_isSimulationCashRegister(currentCashRegister)) {
            return { status: "ERROR", data: null, error: { code: "CASH_REGISTER_SIMULATION_STATE", message: "No se puede cerrar una caja que contiene estado de simulacion." } };
        }
        await validateFiscalConfig(traceId);
        const cleanDiaKey = _readDate(diaKey);
        if (!cleanDiaKey) {
            return { status: "ERROR", data: null, error: { code: "INVALID_DATE", message: "Fecha invalida" } };
        }

        ledgerLock = await acquireFiscalLedgerLock(traceId);
        await assertFiscalLedgerLock(ledgerLock);

        const existingZ = await dalGet(HISTORICO_CIERRES_Z_COL, `Z_${cleanDiaKey}`, "strong").catch(() => null);
        if (existingZ) {
            log.warn("Z_CLOSING_ALREADY_EXISTS", { cleanDiaKey, traceId });
            return { status: "ERROR", data: null, error: { code: "Z_ALREADY_CLOSED", message: "Ya existe un cierre Z para esta fecha" } };
        }

        let allMovements = [];
        let hasMoreMovements = false;
        const seenIds = new Set();
        for (const dateField of ["fechaExpedicionFactura", ...MOVEMENT_HISTORICAL_READ_ALIASES.fechaExpedicionFactura]) {
            const query = dalQuery(MOVIMIENTOS_CAJA_COL)
                .eq(dateField, cleanDiaKey)
                .gt("sequenceNumber", 0)
                .ne("recordSource", "SMOKE_TEST")
                .ascending("sequenceNumber")
                .limit(LEDGER_PAGE_SIZE);
            let res = await query.find();
            for (const it of res.items || []) {
                if (!seenIds.has(it._id)) { seenIds.add(it._id); allMovements.push(it); }
            }
            let page = 2;
            while (res.hasNext() && page <= MAX_LEDGER_BATCH_PAGES) {
                res = await res.next();
                for (const it of res.items || []) {
                    if (!seenIds.has(it._id)) { seenIds.add(it._id); allMovements.push(it); }
                }
                page++;
            }
            if (res.hasNext()) hasMoreMovements = true;
        }
        if (hasMoreMovements) {
            return {
                status: "ERROR",
                data: { checked: allMovements.length, complete: false },
                error: { code: "Z_MOVEMENT_PAGE_LIMIT", message: "No se puede cerrar un periodo con movimientos sin auditar." },
            };
        }
        allMovements = allMovements.filter((movement) => !isExplicitSimulationLedgerRecord(movement));
        allMovements.sort((a, b) => (Number(a.sequenceNumber) || 0) - (Number(b.sequenceNumber) || 0));

        if (allMovements.length === 0) {
            return { status: "ERROR", data: null, error: { code: "NO_MOVEMENTS", message: "No hay movimientos para cerrar" } };
        }

        const totalCash = allMovements.filter(m => readHistoricalPaymentMethod(m) === PAYMENT_METHOD.EFECTIVO).reduce((s, m) => s + Number(m.accountingAmount || 0), 0);
        const totalCard = allMovements.filter(m => readHistoricalPaymentMethod(m) === PAYMENT_METHOD.TARJETA).reduce((s, m) => s + Number(m.accountingAmount || 0), 0);
        const totalBizum = allMovements.filter(m => readHistoricalPaymentMethod(m) === PAYMENT_METHOD.BIZUM).reduce((s, m) => s + Number(m.accountingAmount || 0), 0);
        const totalOnline = allMovements.filter(m => ONLINE_PAYMENT_METHODS.includes(readHistoricalPaymentMethod(m))).reduce((s, m) => s + Number(m.accountingAmount || 0), 0);
        const totalRefunds = allMovements.filter(m => m.movementType === MOVEMENT_TYPE.REEMBOLSO).reduce((s, m) => s + Number(m.accountingAmount || 0), 0);
        const totalTips = allMovements.filter(m => m.movementType === MOVEMENT_TYPE.PROPINA).reduce((s, m) => s + Number(m.accountingAmount || 0), 0);
        const totalAdjustments = allMovements.filter(m => m.movementType === MOVEMENT_TYPE.AJUSTE).reduce((s, m) => s + Number(m.accountingAmount || 0), 0);
        const grossSalesTotal = allMovements.filter(m => m.movementType && !["REEMBOLSO", "PROPINA", "AJUSTE"].includes(m.movementType)).reduce((s, m) => s + Number(m.accountingAmount || 0), 0);
        const netTaxableAmount = allMovements.reduce((s, m) => s + _signedFiscalValue(m, readTaxBase), 0);
        const netTaxAmount = allMovements.reduce((s, m) => s + _signedFiscalValue(m, readTaxAmount), 0);
        const consolidatedTotalAmount = _roundMoney(totalCash + totalCard + totalBizum + totalOnline);

        let approverUser = null;
        if (Math.abs(totalAdjustments) > MONTO_OBLIGA_APROBADOR_Z) {
            approverUser = _safeTrim(options?.approverUser || options?.usuarioAprobador) || null;
            if (!approverUser) {
                return {
                    status: "ERROR", data: null,
                    error: {
                        code: "APPROVER_REQUIRED",
                        message: `Cierre Z con ajustes > ${MONTO_OBLIGA_APROBADOR_Z} EUR requiere approverUser explicito`,
                    },
                };
            }
        }

        const movementTypeBreakdown = {};
        for (const m of allMovements) {
            const mt = m.movementType || "UNKNOWN";
            movementTypeBreakdown[mt] = _roundMoney((movementTypeBreakdown[mt] || 0) + Number(m.accountingAmount || 0));
        }

        const taxTypeBreakdown = {};
        for (const m of allMovements) {
            const rate = String(Number(readMovementField(m, "tipoImpositivo")) || 0);
            if (!taxTypeBreakdown[rate]) {
                taxTypeBreakdown[rate] = { taxableBaseOrNonSubjectAmount: 0, taxAmount: 0, total: 0, operations: 0 };
            }
            taxTypeBreakdown[rate].taxableBaseOrNonSubjectAmount = _roundMoney(taxTypeBreakdown[rate].taxableBaseOrNonSubjectAmount + _signedFiscalValue(m, readTaxBase));
            taxTypeBreakdown[rate].taxAmount = _roundMoney(taxTypeBreakdown[rate].taxAmount + _signedFiscalValue(m, readTaxAmount));
            taxTypeBreakdown[rate].total = _roundMoney(taxTypeBreakdown[rate].total + Number(m.accountingAmount || 0));
            taxTypeBreakdown[rate].operations++;
        }

        const firstSequence = Number(allMovements[0]?.sequenceNumber);
        let previousMovement = null;
        if (Number.isFinite(firstSequence) && firstSequence > 1) {
            const predecessorResult = await dalQuery(MOVIMIENTOS_CAJA_COL)
                .gt("sequenceNumber", 0)
                .ne("recordSource", "SMOKE_TEST")
                .lt("sequenceNumber", firstSequence)
                .descending("sequenceNumber")
                .limit(1)
                .find(STRONG_READ);
            previousMovement = predecessorResult?.items?.[0] || null;
            if (!previousMovement?.hash) {
                return {
                    status: "ERROR",
                    data: null,
                    error: {
                        code: previousMovement ? "GLOBAL_PREDECESSOR_HASH_MISSING" : "GLOBAL_PREDECESSOR_MISSING",
                        message: "No se puede verificar la continuidad global de la cadena fiscal.",
                    },
                };
            }
        }
        let expectedPreviousHash = previousMovement?.hash || GENESIS_HASH;
        let integrityVerified = true;
        for (const mov of allMovements) {
            if (!mov.hash || !mov.previousRecordHash) {
                integrityVerified = false;
                log.error("Fiscal hash fields missing", {
                    traceId, movementId: mov._id,
                    hasHash: Boolean(mov.hash),
                    hasPreviousRecordHash: Boolean(mov.previousRecordHash),
                });
                break;
            }
            if (mov.previousRecordHash !== expectedPreviousHash) {
                integrityVerified = false;
                log.error("Hash chain integrity violation detected", {
                    traceId, movementId: mov._id,
                    expected: expectedPreviousHash, actual: mov.previousRecordHash,
                });
                break;
            }
            expectedPreviousHash = mov.hash;
        }

        if (!integrityVerified) {
            return { status: "ERROR", data: null, error: { code: "INTEGRITY_VIOLATION", message: "Hash chain integrity violation detected. Cannot close." } };
        }

        const firstMovement = allMovements[0];
        const lastMovement = allMovements[allMovements.length - 1];
        const closingPayload = _stableSerialize({
            operationDate: cleanDiaKey,
            consolidatedTotalAmount,
            grossSalesTotal: _roundMoney(grossSalesTotal),
            netTaxableAmount: _roundMoney(netTaxableAmount),
            netTaxAmount: _roundMoney(netTaxAmount),
            totalOperations: allMovements.length,
            startSequence: Number(firstMovement?.sequenceNumber) || 0,
            endSequence: Number(lastMovement?.sequenceNumber) || 0,
        });
        const closingHash = await hashSHA256(closingPayload);

        let closingSignature = "";
        let closingSignatureStatus = "SIGNED";
        try {
            closingSignature = await _computeSignature(closingHash, traceId);
        } catch (signErr) {
            closingSignatureStatus = "PENDING_SIGNATURE";
            log.warn("Z closing signature unavailable; proceeding without signature", {
                cleanDiaKey, error: signErr?.message, traceId,
            });
            await queueFiscalRecovery({
                transactionId: `Z_${cleanDiaKey}`,
                totalAmount: consolidatedTotalAmount,
                operationDescription: `Cierre Z pendiente de firma ${cleanDiaKey}`,
                phase: "WAIT_FOR_SIGNER_Z_CLOSING",
                origin: "FISCAL_SIGNER_DOWN",
                traceId,
                lastError: signErr?.message || "FISCAL_SIGN_FAIL",
            });
        }

        const zRecord = {
            _id: `Z_${cleanDiaKey}`,
            operationDate: cleanDiaKey,
            closingStatus: "CERRADO",
            consolidatedTotalAmount,
            grossSalesTotal: _roundMoney(grossSalesTotal),
            netTaxableAmount: _roundMoney(netTaxableAmount),
            netTaxAmount: _roundMoney(netTaxAmount),
            totalCash: _roundMoney(totalCash),
            totalCard: _roundMoney(totalCard),
            totalBizum: _roundMoney(totalBizum),
            totalOnline: _roundMoney(totalOnline),
            totalRefunds: _roundMoney(totalRefunds),
            totalTips: _roundMoney(totalTips),
            totalAdjustments: _roundMoney(totalAdjustments),
            totalOperations: allMovements.length,
            startSequence: Number(firstMovement?.sequenceNumber) || 0,
            endSequence: Number(lastMovement?.sequenceNumber) || 0,
            startTicketNumber: readInvoiceNumber(firstMovement) || "",
            endTicketNumber: readInvoiceNumber(lastMovement) || "",
            startRecordHash: firstMovement?.previousRecordHash || GENESIS_HASH,
            endRecordHash: lastMovement?.hash || GENESIS_HASH,
            movementTypeBreakdown,
            taxTypeBreakdown,
            isIntegrityVerified: integrityVerified,
            auditedRecordsCount: allMovements.length,
            closingHash,
            closingSignature,
            closingSignatureStatus,
            closingSource: "CRON",
            closingSchemaVersion: LEDGER_SCHEMA_VERSION,
            timeZone: SDK_CONFIG.TZ,
            closedAt: new Date(),
            verifiedAt: closingSignatureStatus === "SIGNED" ? new Date() : null,
            approverUser,
            traceId,
            _createdDate: new Date(),
        };

        await assertFiscalLedgerLock(ledgerLock);
        let saved;
        try {
            saved = await dalInsert(HISTORICO_CIERRES_Z_COL, zRecord);
        } catch (insertError) {
            let persisted;
            try {
                persisted = await dalGet(HISTORICO_CIERRES_Z_COL, zRecord._id, "strong");
            } catch (readError) {
                retainLedgerLock = true;
                log.error("Z_CLOSING_RESULT_UNKNOWN", {
                    traceId, operationDate: cleanDiaKey,
                    insertError: insertError?.message, readError: readError?.message,
                });
                throw new Error("Z_CLOSING_RESULT_UNKNOWN");
            }
            if (persisted?.closingHash === closingHash) saved = persisted;
            else throw insertError;
        }

        const cashRegister = await getCashRegisterSingleton();
        if (cashRegister) {
            cashRegister.cashRegisterStatus = CASH_REGISTER_STATUS.CERRADA;
            cashRegister.closedAt = new Date();
            cashRegister._updatedDate = new Date();
            await dalSave(CAJA_ACTUAL_COL, cashRegister);
        }

        return closingSignatureStatus === "SIGNED"
            ? { status: "SUCCESS", data: saved, error: null }
            : {
                status: "PARTIAL",
                data: saved,
                error: {
                    code: "Z_SIGNATURE_PENDING",
                    message: "El cierre Z esta registrado, pero su firma requiere recuperacion.",
                },
            };
    } catch (err) {
        const normalized = normalizeError(err);
        const publicMessages = {
            PERIOD_CLOSED: "El periodo fiscal esta cerrado.",
            Z_CLOSING_RESULT_UNKNOWN: "El resultado del cierre es incierto y requiere reconciliacion.",
        };
        const publicCodes = new Set(Object.keys(publicMessages));
        const publicCode = publicCodes.has(normalized.code) ? normalized.code : "Z_CLOSING_FAIL";
        log.error("_registerZClosing failed", { traceId, code: normalized.code, error: normalized.message });
        return {
            status: "ERROR",
            data: null,
            error: {
                code: publicCode,
                message: publicMessages[publicCode] || "No se pudo completar el cierre Z.",
            },
        };
    } finally {
        if (ledgerLock && !retainLedgerLock) {
            const released = await releaseFiscalLedgerLock(ledgerLock);
            if (!released?.released) {
                log.error("FISCAL_LEDGER_LOCK_RELEASE_FAILED", {
                    traceId, reason: released?.reason || "UNKNOWN", scope: "Z_CLOSING",
                });
            }
        } else if (ledgerLock && retainLedgerLock) {
            log.error("FISCAL_LEDGER_LOCK_RETAINED_FOR_REPAIR", {
                traceId, scope: "Z_CLOSING",
            });
        }
    }
}

export const registerZClosing = webMethod(
    Permissions.SiteMember,
    async (diaKey, options = {}) => _registerZClosing(diaKey, options, true)
);

// Internal backend entry point for the trusted scheduled job only.
// Not a webMethod: it is not exposed as a frontend-callable web module method.
// Keep the same validation, fiscal integrity, signature, and persistence path.
export async function registerZClosingInternal(diaKey, options = {}) {
    return _registerZClosing(diaKey, options, false);
}

// ============================================================================
// VERIFY FISCAL HASH CHAIN INTEGRITY
// ============================================================================

export async function verifyFiscalHashChainIntegrity(options = {}) {
    const traceId = options.traceId || makeTraceId("hash-audit");
    const batchSize = Number(options.limit) || LEDGER_PAGE_SIZE;
    const breaks = [];
    const unverifiable = [];
    try {
        let movements = await dalQuery(MOVIMIENTOS_CAJA_COL)
            .gt("sequenceNumber", 0)
            .ne("recordSource", "SMOKE_TEST")
            .ascending("sequenceNumber")
            .limit(batchSize)
            .find();

        let checked = 0;
        let hashesVerified = 0;
        let expectedPreviousHash = GENESIS_HASH;
        let hasMore = false;
        let page = 1;
        const firstPageItems = (movements.items || []).filter((item) => !isExplicitSimulationLedgerRecord(item));
        const firstSequence = Number(firstPageItems[0]?.sequenceNumber);
        if (Number.isFinite(firstSequence) && firstSequence > 1) {
            breaks.push({
                movementId: firstPageItems[0]?._id || null,
                numSerieFactura: readInvoiceNumber(firstPageItems[0] || {}),
                reason: "GLOBAL_PREDECESSOR_MISSING",
                firstSequence,
            });
        }
        while (true) {
            for (const mov of (movements.items || []).filter((item) => !isExplicitSimulationLedgerRecord(item))) {
                checked += 1;
                const movementId = mov?._id || null;
                const invoiceNumber = readInvoiceNumber(mov);
                const hash = _safeTrim(mov?.hash).toLowerCase();
                const previousRecordHash = _safeTrim(mov?.previousRecordHash).toLowerCase();

                const hashFieldsMissing = !hash || !previousRecordHash;
                const hashFieldsInvalid = !/^[a-f0-9]{64}$/.test(hash) || !/^[a-f0-9]{64}$/.test(previousRecordHash);
                if (hashFieldsMissing || hashFieldsInvalid) {
                    breaks.push({
                        movementId,
                        numSerieFactura: invoiceNumber,
                        reason: hashFieldsMissing ? "HASH_FIELDS_MISSING" : "HASH_FIELDS_INVALID",
                        hasHash: Boolean(hash),
                        hasPreviousRecordHash: Boolean(previousRecordHash),
                    });
                    expectedPreviousHash = hash || expectedPreviousHash;
                    continue;
                }

                if (previousRecordHash !== expectedPreviousHash) {
                    breaks.push({
                        movementId,
                        numSerieFactura: invoiceNumber,
                        reason: "PREDECESSOR_HASH_MISMATCH",
                        expected: expectedPreviousHash,
                        actual: previousRecordHash,
                    });
                }

                const rawTimestamp = readMovementField(mov, "recordTimestamp");
                const generatedAt = rawTimestamp instanceof Date
                    ? rawTimestamp
                    : new Date(rawTimestamp || "");
                if (!rawTimestamp || Number.isNaN(generatedAt.getTime())) {
                    unverifiable.push({
                        movementId,
                        numSerieFactura: invoiceNumber,
                        reason: "HASH_TIMESTAMP_UNAVAILABLE",
                    });
                    expectedPreviousHash = hash;
                    continue;
                }

                // Rebuild the exact internal fiscal payload from canonical fields.
                // The CMS hook may store physical field names (e.g. NIFEmisor);
                // normalizeMovementKeys handles historical aliases and
                // readMovementField resolves the physical SSOT fields.
                const normalizedMovement = normalizeMovementKeys({ ...mov });
                for (const field of ["nifEmisor", "nifDestinatario", "irpfWithholdingAmount"]) {
                    const value = readMovementField(mov, field);
                    if (value !== undefined && value !== null) normalizedMovement[field] = value;
                }
                const isOnlineEventLogMovement =
                    _safeTrim(mov?.channelType).toUpperCase() === CHANNEL_TYPE.ONLINE;
                const hashPayload = isOnlineEventLogMovement
                    ? buildEventLogFiscalChainPayload(normalizedMovement, generatedAt)
                    : _buildInternalFiscalChainPayload(normalizedMovement, generatedAt);
                const computedHash = (await hashChain(previousRecordHash, hashPayload)).toLowerCase();
                if (computedHash !== hash) {
                    breaks.push({
                        movementId,
                        numSerieFactura: invoiceNumber,
                        reason: "HASH_CONTENT_MISMATCH",
                    });
                } else {
                    hashesVerified++;
                }

                expectedPreviousHash = hash;
            }
            if (!movements.hasNext()) break;
            if (page >= MAX_LEDGER_BATCH_PAGES) {
                hasMore = true;
                break;
            }
            movements = await movements.next();
            page += 1;
        }

        if (breaks.length > 0) {
            await logAuditEvent("FISCAL_CHAIN_CORRUPTED", "CRITICAL", `Detectadas ${breaks.length} rupturas en la cadena de facturas`, { breaksCount: breaks.length, details: breaks.slice(0, 5) }, traceId, "system", "backend/cajas.web.js");
        }

        const hashContentComplete = unverifiable.length === 0 && hashesVerified === checked;
        const complete = !hasMore && hashContentComplete;
        return {
            status: breaks.length > 0
                ? "INTEGRITY_COMPROMISED"
                : !complete ? "PARTIAL" : "SUCCESS",
            data: {
                checked,
                hashesVerified,
                hashContentComplete,
                unverifiableCount: unverifiable.length,
                unverifiable: unverifiable.slice(0, 10),
                breaksCount: breaks.length,
                breaks,
                complete,
                hasMore,
            },
            error: hasMore
                ? { code: "AUDIT_PAGE_LIMIT", message: "Auditoria parcial: quedan movimientos por comprobar." }
                : unverifiable.length > 0
                    ? { code: "AUDIT_HASH_CONTENT_UNVERIFIABLE", message: "No se pudo reconstruir el contenido firmado de todos los movimientos." }
                    : null,
        };
    } catch (err) {
        log.error("verifyFiscalHashChainIntegrity failed", { traceId, error: err?.message });
        return { status: "ERROR", data: null, error: { code: "AUDIT_FAIL", message: "No se pudo completar la auditoria fiscal." } };
    }
}

// ============================================================================
// getMovimientoByBooking
// ============================================================================

export const getMovimientoByBooking = webMethod(
    Permissions.SiteMember,
    async ({ bookingId } = {}) => {
        const traceId = makeTraceId("mov-by-bkg");
        const cleanId = _safeTrim(bookingId);

        if (!cleanId) {
            return {
                status: "ERROR",
                meta: { traceId },
                data: null,
                error: { code: "INVALID_PAYLOAD", message: "bookingId is required" },
            };
        }

        try {
            // SiteMember only proves authentication. Fiscal ledger details are
            // restricted to authorized cashier/admin staff, not every member.
            await requireCajero(traceId);

            const canonical = await dalQuery(MOVIMIENTOS_CAJA_COL)
                .hasSome("linkedBookingIds", [cleanId])
                .limit(5)
                .find();

            let items = canonical.items || [];

            if (items.length === 0) {
                // Read-only compatibility for historical CSV/single-string rows.
                const exact = await dalQuery(MOVIMIENTOS_CAJA_COL)
                    .eq("linkedBookingIds", cleanId)
                    .limit(5)
                    .find();
                items = exact.items || [];
            }

            if (items.length === 0) {
                const all = await dalQuery(MOVIMIENTOS_CAJA_COL)
                    .contains("linkedBookingIds", cleanId)
                    .limit(20)
                    .find();
                items = (all.items || []).filter((m) => {
                    const raw = m.linkedBookingIds;
                    if (typeof raw === "string") {
                        return raw.split(",").map((s) => s.trim()).includes(cleanId);
                    }
                    if (Array.isArray(raw)) {
                        return raw.map(String).includes(cleanId);
                    }
                    return false;
                });
            }

            // Simulation-marked rows are historical QA evidence, never a fiscal receipt.
            items = items.filter((movement) => !isExplicitSimulationLedgerRecord(movement));

            if (items.length === 0) {
                return {
                    status: "ERROR",
                    meta: { traceId },
                    data: null,
                    error: { code: "MOVEMENT_NOT_FOUND", message: "No fiscal movement linked to booking" },
                };
            }

            const mov = items.sort(
                (a, b) => new Date(b.recordTimestamp || b._createdDate || 0) -
                          new Date(a.recordTimestamp || a._createdDate || 0)
            )[0];

            return {
                status: "SUCCESS",
                meta: { traceId },
                data: {
                    _id: mov._id,
                    numSerieFactura: readInvoiceNumber(mov),
                    fechaExpedicionFactura: readInvoiceIssueDate(mov),
                    totalAmount: readTotalAmount(mov),
                    nifEmisor: readMovementField(mov, "nifEmisor") || null,
                    // Internal ledger uses canonical "hash". The public receipt
                    // DTO names the proof "recordHash" for its QR contract only.
                    // previousRecordHash and digitalSignature stay private.
                    recordHash: readMovementHash(mov) || null,
                    verificationQR: mov.verificationQR || null,
                    recordTimestamp: readMovementField(mov, "recordTimestamp") || null,
                    operationDescription: readMovementField(mov, "operationDescription") || null,
                    tipoFactura: readInvoiceType(mov) || null,
                },
                error: null,
            };
        } catch (err) {
            log.error("getMovimientoByBooking failed", {
                traceId,
                bookingId: cleanId,
                error: err?.message,
            });
            return {
                status: "ERROR",
                meta: { traceId },
                data: null,
                error: { code: "LEDGER_LOOKUP_FAILED", message: "Ledger lookup failed", traceId },
            };
        }
    }
);