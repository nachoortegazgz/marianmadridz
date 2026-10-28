/*
=============================================================================
MODULE: backend/cajas.web.js
VERSION: v5016-ZERO-LEGACY
REPO: https://github.com/nachoortegazgz/marianmadridXXXXX.git
RESPONSIBILITY: TPV cashier ledger, daily closures, Veri*factu SHA-256
                chain integrity, fiscal persistence and PGC projection.
STANDARDS: G10 ASCII Strict. Cero suppressAuth. Cero alias. Cero legacy.
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
    MOVEMENT_TYPE,
    PAYMENT_METHOD,
    IVA_RATES,
    CASH_REGISTER_STATUS,
    TIPO_FACTURA,
    FISCAL_ROLE,
    CONTROL_TYPE,
    BOOKING_FIELDS,
    EVENT_TYPE,
    MOVEMENT_LEGACY_READ_ALIASES,
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

import { normalizeMovementKeys } from "backend/internalConfig";

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

const log = logger;

// ============================================================================
// CONSTANTS (ALN-01..ALN-07)
// ============================================================================

const CASH_REGISTER_ID = SINGLETONS.CAJA_PRINCIPAL;
const CASH_SEQ_ID = SINGLETONS.CAJA_SEQ;

const VAT_ACCRUAL_DEVENGADO = "DEVENGADO";
const VAT_ACCRUAL_ANTICIPADO = "ANTICIPADO";
const VAT_ACCRUAL_APLICACION_ANTICIPO = "APLICACION_ANTICIPO";

const MOVIMIENTOS_CAJA_COL = BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA;
const CAJA_ACTUAL_COL = BUSINESS_COLLECTIONS.CAJA_ACTUAL;
const HISTORICO_CIERRES_Z_COL = BUSINESS_COLLECTIONS.HISTORICO_CIERRES_Z;
const SERVICIOS_CATALOGO_COL = BUSINESS_COLLECTIONS.SERVICIOS_CATALOGO;
const CONTROL_OPERATIVO_COL = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
const LIBRO_ASIENTOS_CONTABLES_DETALLE_COL = BUSINESS_COLLECTIONS.LIBRO_ASIENTOS_CONTABLES_DETALLE;

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

const LEGACY_ONLINE_ALIAS = "ONLINE";
const ONLINE_PAYMENT_METHODS = Object.freeze([
    PAYMENT_METHOD.WIX_PAYMENTS,
    LEGACY_ONLINE_ALIAS,
]);

export function normalizeLegacyPaymentMethod(raw) {
    const v = _safeTrim(raw).toUpperCase();
    if (v === LEGACY_ONLINE_ALIAS) return PAYMENT_METHOD.WIX_PAYMENTS;
    return v;
}

const STRONG_READ = Object.freeze({ consistencyMode: "strong" });

// ============================================================================
// HELPERS
// ============================================================================

function _normalizeLinkedBookingIds(value) {
    const values = Array.isArray(value) ? value : String(value || "").split(",");
    return Array.from(new Set(values.map((id) => String(id || "").trim()).filter(Boolean)));
}

function _linkedBookingValue(value) {
    return _normalizeLinkedBookingIds(value).join(",") || null;
}

function _rateLimitOrThrow(surface, key, traceId) {
    const rl = rateLimiter({ surface, key });
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
    const value = await getSecretValue(name).catch(() => "");
    _secretCache.set(name, { value, at: now });
    return value;
}

export function _invalidateSecretCache() {
    _secretCache.clear();
}

async function _queueCompensation(params) {
    const p = params || {};
    const dedupeKey = `COMP_${p.kind || "FISCAL"}_${p.transactionId || Date.now()}_${Date.now()}`;
    const record = {
        _id: `REC_${p.kind || "FISCAL"}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        controlType: CONTROL_TYPE.COMPENSATION,
        dedupeKey,
        kind: p.kind || "FISCAL_LEDGER",
        transactionId: p.transactionId || null,
        bookingIds: p.bookingIds || null,
        orderId: p.orderId || null,
        refundId: p.refundId || null,
        totalAmount: Number(p.totalAmount) || 0,
        paymentMethod: p.paymentMethod || null,
        operationDescription: p.operationDescription || null,
        movementType: p.movementType || null,
        status: "PENDING_RECOVERY",
        phase: p.phase || null,
        origin: p.origin || "FISCAL_RECOVERY",
        alertRequired: Boolean(p.alertRequired),
        attempts: Number(p.attempts) || 0,
        lastError: p.lastError || null,
        traceId: _safeTrim(p.traceId) || makeTraceId("comp"),
        _createdDate: new Date(),
        _updatedDate: new Date(),
    };
    await dalInsert(CONTROL_OPERATIVO_COL, record);
}

export async function validateFiscalConfig(traceId = "init") {
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
        timeZone: SDK_CONFIG?.TZ || "Europe/Madrid",
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

function _buildAEATPayload(movement, generatedAt) {
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
    const params = [
        `nif=${encodeURIComponent(nifEmisor)}`,
        `numserie=${encodeURIComponent(numSerieFactura)}`,
        `fecha=${encodeURIComponent(fechaExpedicionFactura)}`,
        `importe=${encodeURIComponent(String(totalAmount))}`,
    ];
    return `${baseUrl}?${params.join("&")}`;
}

async function _computeCurrentHash(previousHash, payloadStr) {
    return await hashChain(previousHash, payloadStr);
}

async function _getNextSequence(traceId) {
    const MAX_RETRIES = 5;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            let seqDoc = await dalGet(CAJA_ACTUAL_COL, CASH_SEQ_ID, "strong").catch(() => null);

            if (!seqDoc) {
                try {
                    seqDoc = {
                        _id: CASH_SEQ_ID,
                        [CAJA_KEYS.SINGLETON_KEY]: SINGLETONS.CAJA_SEQ,
                        sequenceCounters: { seqGlobal: 0 },
                        _createdDate: new Date(),
                        _updatedDate: new Date(),
                    };
                    await dalInsert(CAJA_ACTUAL_COL, seqDoc);
                } catch (createErr) {
                    await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));
                    continue;
                }
            }

            const counters = { ...(seqDoc.sequenceCounters || {}) };
            const nextGlobal = Number(counters.seqGlobal || 0) + 1;
            const yearKey = String(new Date().getFullYear());
            const nextYear = Number(counters[yearKey] || 0) + 1;
            counters.seqGlobal = nextGlobal;
            counters[yearKey] = nextYear;

            const updated = {
                ...seqDoc,
                sequenceCounters: counters,
                _updatedDate: new Date(),
            };

            await dalUpdate(CAJA_ACTUAL_COL, updated);

            return {
                sequenceNumber: nextGlobal,
                yearSequence: nextYear,
                numSerieFactura: `FAC-${yearKey}-${String(nextYear).padStart(5, "0")}`,
            };
        } catch (err) {
            if (attempt === MAX_RETRIES - 1) {
                log.error("_getNextSequence failed after retries", { traceId, error: err?.message });
                throw new Error(`SEQUENCE_ERROR: ${err?.message || "unknown"}`);
            }
            await new Promise((r) => setTimeout(r, 100 * Math.pow(2, attempt) + Math.random() * 100));
        }
    }
}

async function _getLastMovement() {
    const res = await dalQuery(MOVIMIENTOS_CAJA_COL)
        .descending("sequenceNumber")
        .limit(1)
        .find(STRONG_READ);
    return res?.items?.[0] || null;
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
// PROYECCION CONTABLE PGC (LibroAsientosContablesDetalle)
// ============================================================================

async function _projectToAccountingLedger(movement, traceId) {
    if (!LIBRO_ASIENTOS_CONTABLES_DETALLE_COL) return;
    try {
        const totalAmount = Math.abs(Number(movement.accountingAmount || movement.totalAmount) || 0);
        if (totalAmount <= 0) return;

        const method = _safeTrim(movement.paymentMethod).toUpperCase();
        const accountCode = (method === PAYMENT_METHOD.EFECTIVO) ? "570000" : "572000";

        const entry = {
            entryId: `ASIENTO_${movement.sequenceNumber || movement.transactionId || Date.now()}`,
            lineNumber: 1,
            entryDate: movement.fechaOperacion || new Date().toISOString().slice(0, 10),
            fiscalPeriod: movement.fiscalPeriod || new Date().toISOString().slice(0, 7),
            accountCode,
            concept: movement.operationDescription || "Cobro TPV",
            debit: totalAmount,
            credit: totalAmount,
            debitAmount: totalAmount,
            creditAmount: totalAmount,
            accountingAmount: totalAmount,
            cashMovementId: movement.transactionId || null,
            bookingId: (movement.linkedBookingIds && !movement.linkedBookingIds.includes(",")) ? movement.linkedBookingIds : null,
            orderId: movement.orderId || null,
            resourceId: movement.staffResourceId || movement.resourceId || null,
            origenTipo: "MOVIMIENTOCAJA",
            origenRegistro: MOVIMIENTOS_CAJA_COL,
            recordHash: movement.recordHash || GENESIS_HASH,
            recordTimestamp: movement.recordTimestamp || new Date(),
            traceId: movement.traceId || traceId,
            _createdDate: new Date(),
        };

        await dalInsert(LIBRO_ASIENTOS_CONTABLES_DETALLE_COL, entry);
    } catch (err) {
        log.warn("Accounting projection to LibroAsientosContablesDetalle failed (non-blocking)", {
            traceId,
            transactionId: movement?.transactionId,
            error: err?.message,
        });
    }
}

// ============================================================================
// REGISTER MANUAL TRANSACTION
// ============================================================================

export const registerManualTransaction = webMethod(Permissions.SiteMember, async (payload) => {
    const traceId = payload?.traceId || makeTraceId("manual-tx");
    try {
        _rateLimitOrThrow(
            "cajas.registerManualTransaction",
            _safeTrim(payload?.resourceId) || "CAJA_LOCAL",
            traceId
        );

        await requireCajero(traceId);
        await validateFiscalConfig(traceId);
        const { nifEmisor } = await _getFiscalKeys();

        const amount = _readPositiveAmount(payload?.totalAmount);
        if (!amount) {
            return { status: "ERROR", data: null, error: { code: "INVALID_AMOUNT", message: "Importe positivo requerido" } };
        }

        const paymentMethod = normalizeLegacyPaymentMethod(payload?.paymentMethod);
        if (!Object.values(PAYMENT_METHOD).includes(paymentMethod)) {
            return { status: "ERROR", data: null, error: { code: "INVALID_PAYMENT_METHOD", message: "Forma de pago invalida" } };
        }

        const movementType = _safeTrim(payload?.movementType || payload?.tipoMovimiento || "VENTA").toUpperCase();
        const operationDescription = _cleanText(payload?.operationDescription || payload?.description || "Venta mostrador", 500);
        const resourceId = _safeTrim(payload?.resourceId || "CAJA_LOCAL");
        const transactionId = _safeTrim(payload?.transactionId) || null;

        const inDto = normalizeMovementKeys({ ...(payload || {}) });
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
                return { status: "SUCCESS", data: existingRes.items[0], error: null, idempotent: true };
            }
        }

        const operationDate = new Date().toLocaleDateString("sv-SE", { timeZone: SDK_CONFIG?.TZ || "Europe/Madrid" });
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

        const seq = await _getNextSequence(traceId);
        const lastMovement = await _getLastMovement();
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
            amount: taxableBaseOrNonSubjectAmount,
            totalAmount: amount,
            taxBase: taxableBaseOrNonSubjectAmount,
            taxAmount,
            tipoImpositivo: taxRate,
            accountingSign: movementType === MOVEMENT_TYPE.REEMBOLSO ? -1 : 1,
            accountingAmount: movementType === MOVEMENT_TYPE.REEMBOLSO ? -amount : amount,
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

        const aeatPayload = _buildAEATPayload({ ...baseMovement, previousRecordHash }, generatedAt);
        const movementHash = await _computeCurrentHash(previousRecordHash, aeatPayload);

        let digitalSignature;
        try {
            digitalSignature = await _computeSignature(movementHash, traceId);
        } catch (signErr) {
            log.warn("Fiscal signer unavailable; queuing movement", {
                transactionId: baseMovement.transactionId,
                error: signErr?.message,
                traceId,
            });
            await queueFiscalRecovery({
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
                status: "SUCCESS",
                data: {
                    ...baseMovement,
                    previousRecordHash,
                    hash: movementHash,
                    pendingSignature: true,
                    queued: true,
                },
                error: null,
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
            aeatPayload,
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
                    controlType: "LEDGER_IDEMPOTENCY",
                    transactionId,
                    status: "RESERVED",
                    traceId,
                    createdAt: new Date(),
                    _createdDate: new Date(),
                });
            } catch (claimError) {
                const existingMovement = await dalQuery(MOVIMIENTOS_CAJA_COL)
                    .eq("transactionId", transactionId)
                    .limit(1)
                    .find(STRONG_READ)
                    .catch(() => ({ items: [] }));
                if (existingMovement?.items?.length) {
                    log.info("Ledger duplicate recovered after atomic claim", { transactionId, traceId });
                    return { status: "SUCCESS", data: existingMovement.items[0], error: null, idempotent: true };
                }
                const existingClaim = await dalGet(CONTROL_OPERATIVO_COL, claimId, "strong").catch(() => null);
                if (existingClaim) {
                    return {
                        status: "ERROR",
                        data: null,
                        error: {
                            code: "IDEMPOTENCY_IN_PROGRESS",
                            message: "La transaccion ya esta reservada y requiere reconciliacion antes de reintentar.",
                        },
                    };
                }
                throw claimError;
            }
        }

        const saved = await dalInsert(MOVIMIENTOS_CAJA_COL, movement);
        await _updateCajaActual(movement, traceId);
        await _projectToAccountingLedger(movement, traceId);

        return { status: "SUCCESS", data: saved, error: null };
    } catch (err) {
        const norm = normalizeError(err);
        log.error("registerManualTransaction failed", { code: norm.code, error: norm.message, traceId });
        return { status: "ERROR", data: null, error: { code: norm.code || "LEDGER_FAIL", message: norm.message } };
    }
});

// ============================================================================
// UPDATE CAJA ACTUAL
// ============================================================================

// SSOT Apartado 4 (CajaActual): claves canonicas cashAmount/cardAmount/...;
// los campos de saldo usan la semantica "acumulado del periodo abierto", no
// "saldo contable". Claves legacy (cashBalance, cardBalance...) eliminadas:
// CajaActual no tiene hook de normalizacion y cualquier lector debe usar
// estas constantes como unica fuente.
// MATRIZ v15 (CajaActual): singletonKey es el campo representativo del doc;
// id es clave eliminada. CASH_REGISTER_ID ("CAJA_PRINCIPAL") / CASH_SEQ_ID
// ("CAJA_SEQ") se persisten en singletonKey ademas de gobernar el _id.
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

async function _updateCajaActual(movement, traceId) {
    try {
        // Do not collapse a read failure into 'register missing': that could reset the
        // accumulated balance to zero and overwrite it. A genuine missing item must
        // be represented by dalGet as null; thrown errors go to the recovery path.
        let cashRegister = await dalGet(CAJA_ACTUAL_COL, CASH_REGISTER_ID, "strong");
        if (!cashRegister) {
            cashRegister = {
                _id: CASH_REGISTER_ID,
                [CAJA_KEYS.SINGLETON_KEY]: SINGLETONS.CAJA_PRINCIPAL,
                [CAJA_KEYS.OPERATION_DATE]: readOperationDate(movement) || new Date().toLocaleDateString("sv-SE", { timeZone: SDK_CONFIG?.TZ || "Europe/Madrid" }),
                [CAJA_KEYS.STATUS]: CASH_REGISTER_STATUS.ABIERTA,
                [CAJA_KEYS.TOTAL]: 0, [CAJA_KEYS.CASH]: 0, [CAJA_KEYS.CARD]: 0,
                [CAJA_KEYS.BIZUM]: 0, [CAJA_KEYS.ONLINE]: 0,
                [CAJA_KEYS.OPERATIONS]: 0,
                [CAJA_KEYS.OPENED_AT]: new Date(), [CAJA_KEYS.CLOSED_AT]: null,
                [CAJA_KEYS.LAST_MOVEMENT_AT]: new Date(),
                _createdDate: new Date(), _updatedDate: new Date(),
            };
        }
        const amount = Number(movement.accountingAmount) || 0;
        const method = _safeTrim(movement.paymentMethod).toUpperCase();
        if (method === PAYMENT_METHOD.EFECTIVO) cashRegister[CAJA_KEYS.CASH] = _roundMoney((cashRegister[CAJA_KEYS.CASH] || 0) + amount);
        else if (method === PAYMENT_METHOD.TARJETA) cashRegister[CAJA_KEYS.CARD] = _roundMoney((cashRegister[CAJA_KEYS.CARD] || 0) + amount);
        else if (method === PAYMENT_METHOD.BIZUM) cashRegister[CAJA_KEYS.BIZUM] = _roundMoney((cashRegister[CAJA_KEYS.BIZUM] || 0) + amount);
        else if (ONLINE_PAYMENT_METHODS.includes(method)) cashRegister[CAJA_KEYS.ONLINE] = _roundMoney((cashRegister[CAJA_KEYS.ONLINE] || 0) + amount);

        cashRegister[CAJA_KEYS.TOTAL] = _roundMoney(
            (cashRegister[CAJA_KEYS.CASH] || 0) + (cashRegister[CAJA_KEYS.CARD] || 0) +
            (cashRegister[CAJA_KEYS.BIZUM] || 0) + (cashRegister[CAJA_KEYS.ONLINE] || 0));
        cashRegister[CAJA_KEYS.OPERATIONS] = Number(cashRegister[CAJA_KEYS.OPERATIONS] || 0) + 1;
        cashRegister[CAJA_KEYS.LAST_MOVEMENT_AT] = new Date();
        cashRegister._updatedDate = new Date();
        await dalSave(CAJA_ACTUAL_COL, cashRegister);
    } catch (err) {
        log.error("_updateCajaActual failed; queuing resync", { traceId, error: err?.message });
        try {
            await _queueCompensation({
                kind: "RESYNC_CAJA_BALANCE",
                transactionId: movement.transactionId || null,
                totalAmount: Number(movement.accountingAmount) || 0,
                paymentMethod: movement.paymentMethod || null,
                operationDescription: "Sincronizacion de saldo tras fallo en _updateCajaActual",
                phase: "WAIT_FOR_CAJA_RESYNC",
                origin: "UPDATE_CAJA_FAILED",
                traceId,
                lastError: err?.message || "UNKNOWN",
            });
        } catch (queueErr) {
            log.error("_updateCajaActual: failed to queue resync", { traceId, error: queueErr?.message });
        }
    }
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
        await _queueCompensation({
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
        });
    } catch (err) {
        log.error("queueFiscalRecovery failed", { traceId, error: err?.message });
    }
}

// ============================================================================
// GET CASHIER STATE
// ============================================================================

export const getCashierState = webMethod(Permissions.SiteMember, async (options = {}) => {
    const { traceId, diaKey } = options;
    try {
        await requireCajero(traceId);
        const cashRegister = await dalGet(CAJA_ACTUAL_COL, CASH_REGISTER_ID, "strong").catch(() => null);
        const day = diaKey || new Date().toLocaleDateString("sv-SE", { timeZone: SDK_CONFIG?.TZ || "Europe/Madrid" });
        const res = await dalQuery(MOVIMIENTOS_CAJA_COL)
            .eq("fechaExpedicionFactura", day)
            .limit(1)
            .find(STRONG_READ)
            .catch(() => ({ items: [] }));
        const totalOperations = (res.items || []).length > 0
            ? await _countMovementsOfDay(day).catch(() => Number(cashRegister?.[CAJA_KEYS.OPERATIONS]) || 0)
            : 0;
        return {
            status: "SUCCESS",
            data: {
                _id: CASH_REGISTER_ID,
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
    const { traceId } = options;
    try {
        if (authorizeCashier) await requireCajero(traceId);
        await validateFiscalConfig(traceId);
        const cleanDiaKey = _readDate(diaKey);
        if (!cleanDiaKey) {
            return { status: "ERROR", data: null, error: { code: "INVALID_DATE", message: "Fecha invalida" } };
        }

        const existingZ = await dalGet(HISTORICO_CIERRES_Z_COL, `Z_${cleanDiaKey}`, "strong").catch(() => null);
        if (existingZ) {
            log.warn("Z_CLOSING_ALREADY_EXISTS", { cleanDiaKey, traceId });
            return { status: "ERROR", data: null, error: { code: "Z_ALREADY_CLOSED", message: "Ya existe un cierre Z para esta fecha" } };
        }

        let allMovements = [];
        const seenIds = new Set();
        for (const dateField of ["fechaExpedicionFactura", ...MOVEMENT_LEGACY_READ_ALIASES.fechaExpedicionFactura]) {
            const query = dalQuery(MOVIMIENTOS_CAJA_COL)
                .eq(dateField, cleanDiaKey)
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
        }
        allMovements.sort((a, b) => (Number(a.sequenceNumber) || 0) - (Number(b.sequenceNumber) || 0));

        if (allMovements.length === 0) {
            return { status: "ERROR", data: null, error: { code: "NO_MOVEMENTS", message: "No hay movimientos para cerrar" } };
        }

        const totalCash = allMovements.filter(m => m.paymentMethod === PAYMENT_METHOD.EFECTIVO).reduce((s, m) => s + Number(m.accountingAmount || 0), 0);
        const totalCard = allMovements.filter(m => m.paymentMethod === PAYMENT_METHOD.TARJETA).reduce((s, m) => s + Number(m.accountingAmount || 0), 0);
        const totalBizum = allMovements.filter(m => m.paymentMethod === PAYMENT_METHOD.BIZUM).reduce((s, m) => s + Number(m.accountingAmount || 0), 0);
        const totalOnline = allMovements.filter(m => ONLINE_PAYMENT_METHODS.includes(m.paymentMethod)).reduce((s, m) => s + Number(m.accountingAmount || 0), 0);
        const totalRefunds = allMovements.filter(m => m.movementType === MOVEMENT_TYPE.REEMBOLSO).reduce((s, m) => s + Number(m.accountingAmount || 0), 0);
        const totalTips = allMovements.filter(m => m.movementType === MOVEMENT_TYPE.PROPINA).reduce((s, m) => s + Number(m.accountingAmount || 0), 0);
        const totalAdjustments = allMovements.filter(m => m.movementType === MOVEMENT_TYPE.AJUSTE).reduce((s, m) => s + Number(m.accountingAmount || 0), 0);
        const grossSalesTotal = allMovements.filter(m => m.movementType && !["REEMBOLSO", "PROPINA", "AJUSTE"].includes(m.movementType)).reduce((s, m) => s + Number(m.accountingAmount || 0), 0);
        const netTaxableAmount = allMovements.reduce((s, m) => s + readTaxBase(m), 0);
        const netTaxAmount = allMovements.reduce((s, m) => s + readTaxAmount(m), 0);
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
            taxTypeBreakdown[rate].taxableBaseOrNonSubjectAmount = _roundMoney(taxTypeBreakdown[rate].taxableBaseOrNonSubjectAmount + readTaxBase(m));
            taxTypeBreakdown[rate].taxAmount = _roundMoney(taxTypeBreakdown[rate].taxAmount + readTaxAmount(m));
            taxTypeBreakdown[rate].total = _roundMoney(taxTypeBreakdown[rate].total + Number(m.accountingAmount || 0));
            taxTypeBreakdown[rate].operations++;
        }

        let expectedPreviousHash = GENESIS_HASH;
        let integrityVerified = true;
        for (const mov of allMovements) {
            if (mov.previousRecordHash && mov.previousRecordHash !== expectedPreviousHash) {
                integrityVerified = false;
                log.error("Hash chain integrity violation detected", {
                    traceId, movementId: mov._id,
                    expected: expectedPreviousHash, actual: mov.previousRecordHash,
                });
                break;
            }
            expectedPreviousHash = mov.hash || expectedPreviousHash;
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
            isIntegrityVerified: closingSignatureStatus === "SIGNED",
            auditedRecordsCount: allMovements.length,
            closingHash,
            closingSignature,
            closingSignatureStatus,
            closingSource: "CRON",
            closingSchemaVersion: LEDGER_SCHEMA_VERSION,
            timeZone: SDK_CONFIG?.TZ || "Europe/Madrid",
            closedAt: new Date(),
            verifiedAt: closingSignatureStatus === "SIGNED" ? new Date() : null,
            approverUser,
            traceId,
            _createdDate: new Date(),
        };

        const saved = await dalInsert(HISTORICO_CIERRES_Z_COL, zRecord);

        const cashRegister = await dalGet(CAJA_ACTUAL_COL, CASH_REGISTER_ID, "strong").catch(() => null);
        if (cashRegister) {
            cashRegister.cashRegisterStatus = CASH_REGISTER_STATUS.CERRADA;
            cashRegister.closedAt = new Date();
            cashRegister._updatedDate = new Date();
            await dalSave(CAJA_ACTUAL_COL, cashRegister);
        }

        return { status: "SUCCESS", data: saved, error: null };
    } catch (err) {
        return { status: "ERROR", data: null, error: _toPublicError(err, "Z_CLOSING_FAIL") };
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
    try {
        const movements = await dalQuery(MOVIMIENTOS_CAJA_COL)
            .ascending("sequenceNumber")
            .limit(batchSize)
            .find();

        let expectedPreviousHash = GENESIS_HASH;
        for (const mov of movements.items || []) {
            if (mov.previousRecordHash && mov.previousRecordHash !== expectedPreviousHash) {
                breaks.push({
                    movementId: mov._id,
                    numSerieFactura: readInvoiceNumber(mov),
                    expected: expectedPreviousHash,
                    actual: mov.previousRecordHash,
                });
            }
            expectedPreviousHash = mov.hash;
        }

        if (breaks.length > 0) {
            await logAuditEvent("FISCAL_CHAIN_CORRUPTED", "CRITICAL", `Detectadas ${breaks.length} rupturas en la cadena de facturas`, { breaksCount: breaks.length, details: breaks.slice(0, 5) }, traceId, "system", "backend/cajas.web.js");
        }

        return {
            status: breaks.length === 0 ? "SUCCESS" : "INTEGRITY_COMPROMISED",
            data: { checked: movements.items.length, breaksCount: breaks.length, breaks },
            error: null,
        };
    } catch (err) {
        return { status: "ERROR", data: null, error: { code: "AUDIT_FAIL", message: err.message } };
    }
}

// ============================================================================
// FLUJO TARJETAS REGALO
// ============================================================================

export const registerGiftCardSale = webMethod(Permissions.SiteMember, async (payload) => {
    const traceId = payload?.traceId || makeTraceId("gc-sale");
    try {
        await requireCajero(traceId);
        await validateFiscalConfig(traceId);
        const { nifEmisor } = await _getFiscalKeys();

        const giftCardId = _safeTrim(payload?.giftCardId);
        if (!giftCardId) {
            return { status: "ERROR", data: null, error: { code: "INVALID_GIFT_CARD", message: "giftCardId requerido" } };
        }

        const totalAmount = _readPositiveAmount(payload?.totalAmount);
        if (!totalAmount) {
            return { status: "ERROR", data: null, error: { code: "INVALID_AMOUNT", message: "Importe positivo requerido" } };
        }

        const paymentMethod = normalizeLegacyPaymentMethod(payload?.paymentMethod);
        if (!Object.values(PAYMENT_METHOD).includes(paymentMethod)) {
            return { status: "ERROR", data: null, error: { code: "INVALID_PAYMENT_METHOD", message: "Forma de pago invalida" } };
        }

        const existingRes = await dalQuery(MOVIMIENTOS_CAJA_COL)
            .eq("transactionId", `GC_SALE-${giftCardId}`)
            .limit(1)
            .find(STRONG_READ);

        if (existingRes?.items?.length > 0) {
            return { status: "SUCCESS", data: existingRes.items[0], error: null, idempotent: true };
        }

        const operationDate = new Date().toLocaleDateString("sv-SE", { timeZone: SDK_CONFIG?.TZ || "Europe/Madrid" });
        await _assertPeriodNotClosed(operationDate, traceId);

        const seq = await _getNextSequence(traceId);
        const lastMovement = await _getLastMovement();
        const previousRecordHash = lastMovement?.hash || GENESIS_HASH;
        const generatedAt = new Date();

        const baseMovement = {
            sequenceNumber: seq.sequenceNumber,
            numSerieFactura: seq.numSerieFactura,
            fechaExpedicionFactura: operationDate,
            // MATRIZ v15 (decision de usuario): amount y totalAmount COEXISTEN
            // como claves canonicas propias hasta cerrar el ADR de la formula
            // fiscal. amount = importe base; totalAmount = total cobrado con
            // impuestos (venta GC sin desglose: taxBase == totalAmount).
            fechaOperacion: operationDate,
            fiscalPeriod: operationDate.slice(0, 7),
            movementType: MOVEMENT_TYPE.VENTA_TARJETA_REGALO,
            paymentMethod,
            amount: totalAmount,
            totalAmount: totalAmount,
            taxBase: totalAmount,
            taxAmount: 0,
            tipoImpositivo: 0,
            accountingSign: 1,
            accountingAmount: totalAmount,
            operationDescription: `Venta tarjeta regalo ${giftCardId}`,
            lineItems: [],
            nifEmisor,
            schemaVersion: LEDGER_SCHEMA_VERSION,
            projectionStatus: "PROYECTADO",
            recordSource: "POS",
            staffResourceId: _safeTrim(payload?.staffResourceId) || _safeTrim(payload?.resourceId) || "CAJA_LOCAL",
            linkedBookingIds: null,
            transactionId: `GC_SALE-${giftCardId}`,
            orderId: null, refundId: null,
            giftCardId, giftCardOperation: "SALE",
            customerEmail: payload?.customerEmail || null,

            nifDestinatario: _safeTrim(payload?.nifDestinatario) || null,
            recipientLegalName: _cleanText(payload?.recipientLegalName || "", 200) || null,
            isB2B: false,
            withholdingBase: 0,
            irpfWithholdingRate: 0,
            irpfWithholdingAmount: 0,
            fiscalRole: FISCAL_ROLE.EMISOR,
            surchargeRate: 0,
            surchargeAmount: 0,
            linkedAdvanceId: null,
            vatAccrualStatus: VAT_ACCRUAL_ANTICIPADO,
            bankReconciliationReference: _safeTrim(payload?.bankReconciliationReference) || null,
            tipoFactura: TIPO_FACTURA.F2,
            correctionReason: null,
            previousInvoiceId: null,
            issuerInvoiceNumber: null,
        };

        const aeatPayload = _buildAEATPayload({ ...baseMovement, previousRecordHash }, generatedAt);
        const movementHash = await _computeCurrentHash(previousRecordHash, aeatPayload);

        let digitalSignature;
        try {
            digitalSignature = await _computeSignature(movementHash, traceId);
        } catch (signErr) {
            await queueFiscalRecovery({
                transactionId: baseMovement.transactionId, totalAmount: totalAmount, paymentMethod,
                operationDescription: baseMovement.operationDescription, movementType: baseMovement.movementType,
                phase: "WAIT_FOR_SIGNER", origin: "FISCAL_SIGNER_DOWN", traceId,
                lastError: signErr?.message || "FISCAL_SIGN_FAIL",
            });
            return {
                status: "SUCCESS",
                data: { ...baseMovement, previousRecordHash, hash: movementHash, pendingSignature: true, queued: true },
                error: null,
            };
        }

        const verificationQR = _generateVerificationQR(baseMovement.numSerieFactura, nifEmisor, operationDate, totalAmount);

        const movement = {
            ...baseMovement,
            previousRecordHash, hash: movementHash, digitalSignature, aeatPayload, verificationQR,
            hashAlgorithm: "SHA-256",
            signatureAlgorithm: "RSASSA-PKCS1-v1_5-SHA-256",
            recordTimestamp: generatedAt,
            traceId,
            _createdDate: new Date(),
        };

        const saved = await dalInsert(MOVIMIENTOS_CAJA_COL, movement);
        await _updateCajaActual(movement, traceId);
        await _projectToAccountingLedger(movement, traceId);

        await logAuditEvent("GIFT_CARD_SOLD", "INFO", `Tarjeta regalo vendida: ${giftCardId}`, { giftCardId, totalAmount, traceId }, traceId, giftCardId, "backend/cajas.web.js");

        return { status: "SUCCESS", data: saved, error: null };
    } catch (err) {
        const norm = normalizeError(err);
        log.error("registerGiftCardSale failed", { code: norm.code, error: norm.message, traceId });
        return { status: "ERROR", data: null, error: { code: norm.code || "GC_SALE_FAIL", message: norm.message } };
    }
});

export const registerGiftCardRedemption = webMethod(Permissions.SiteMember, async (payload) => {
    const traceId = payload?.traceId || makeTraceId("gc-redeem");
    try {
        await requireCajero(traceId);
        await validateFiscalConfig(traceId);
        const { nifEmisor } = await _getFiscalKeys();

        const giftCardId = _safeTrim(payload?.giftCardId);
        if (!giftCardId) {
            return { status: "ERROR", data: null, error: { code: "INVALID_GIFT_CARD", message: "giftCardId requerido" } };
        }

        const totalAmount = _readPositiveAmount(payload?.totalAmount);
        if (!totalAmount) {
            return { status: "ERROR", data: null, error: { code: "INVALID_AMOUNT", message: "Importe positivo requerido" } };
        }

        const serviceId = _safeTrim(payload?.serviceId);
        const bookingId = _safeTrim(payload?.bookingId);

        const clientRedemptionId = _safeTrim(payload?.redemptionId);
        const clientTransactionId = _safeTrim(payload?.transactionId);
        const redemptionId = clientRedemptionId || clientTransactionId ||
            `GC_REDEEM-${giftCardId}-${bookingId || "NA"}-${totalAmount}-${Date.now()}`;

        const existingRedemption = await dalQuery(MOVIMIENTOS_CAJA_COL)
            .eq("transactionId", redemptionId)
            .limit(1)
            .find(STRONG_READ);

        if (existingRedemption?.items?.length > 0) {
            log.info("Gift card redemption idempotent duplicate detected", { redemptionId, giftCardId, traceId });
            return { status: "SUCCESS", data: existingRedemption.items[0], error: null, idempotent: true };
        }

        let taxRate = IVA_RATES.GENERAL;
        if (serviceId) {
            const serviceRes = await dalQuery(SERVICIOS_CATALOGO_COL)
                .eq("serviceId", serviceId)
                .limit(1)
                .find()
                .catch(() => ({ items: [] }));

            if (serviceRes?.items?.length > 0) {
                taxRate = Number(serviceRes.items[0].taxRate) || IVA_RATES.GENERAL;
            }
        }

        const taxableBaseOrNonSubjectAmount = _roundMoney(totalAmount / (1 + taxRate));
        const taxAmount = _roundMoney(totalAmount - taxableBaseOrNonSubjectAmount);

        const operationDate = new Date().toLocaleDateString("sv-SE", { timeZone: SDK_CONFIG?.TZ || "Europe/Madrid" });
        await _assertPeriodNotClosed(operationDate, traceId);

        const seq = await _getNextSequence(traceId);
        const lastMovement = await _getLastMovement();
        const previousRecordHash = lastMovement?.hash || GENESIS_HASH;
        const generatedAt = new Date();

        const baseMovement = {
            sequenceNumber: seq.sequenceNumber,
            numSerieFactura: seq.numSerieFactura,
            fechaExpedicionFactura: operationDate,
            // MATRIZ v15: amount (base) y totalAmount (con IVA) coexisten.
            fechaOperacion: operationDate,
            fiscalPeriod: operationDate.slice(0, 7),
            movementType: MOVEMENT_TYPE.CANJE_TARJETA_REGALO,
            paymentMethod: PAYMENT_METHOD.TARJETA_REGALO,
            amount: taxableBaseOrNonSubjectAmount,
            totalAmount: totalAmount,
            taxBase: taxableBaseOrNonSubjectAmount, taxAmount, tipoImpositivo: taxRate,
            accountingSign: 1,
            accountingAmount: totalAmount,
            operationDescription: `Canje tarjeta regalo ${giftCardId}${serviceId ? ` - servicio ${serviceId}` : ""}`,
            lineItems: [],
            nifEmisor,
            schemaVersion: LEDGER_SCHEMA_VERSION,
            projectionStatus: "PROYECTADO",
            recordSource: "POS",
            staffResourceId: _safeTrim(payload?.staffResourceId) || _safeTrim(payload?.resourceId) || "CAJA_LOCAL",
            linkedBookingIds: bookingId ? _linkedBookingValue([bookingId]) : null,
            transactionId: redemptionId,
            orderId: null, refundId: null,
            giftCardId, giftCardOperation: "REDEMPTION",
            serviceIdRedeemed: serviceId || null,

            nifDestinatario: _safeTrim(payload?.nifDestinatario) || null,
            recipientLegalName: _cleanText(payload?.recipientLegalName || "", 200) || null,
            isB2B: false,
            withholdingBase: 0,
            irpfWithholdingRate: 0,
            irpfWithholdingAmount: 0,
            fiscalRole: FISCAL_ROLE.EMISOR,
            surchargeRate: 0,
            surchargeAmount: 0,
            linkedAdvanceId: null,
            vatAccrualStatus: VAT_ACCRUAL_APLICACION_ANTICIPO,
            bankReconciliationReference: null,
            tipoFactura: TIPO_FACTURA.F2,
            correctionReason: null,
            previousInvoiceId: null,
            issuerInvoiceNumber: null,
        };

        const aeatPayload = _buildAEATPayload({ ...baseMovement, previousRecordHash }, generatedAt);
        const movementHash = await _computeCurrentHash(previousRecordHash, aeatPayload);

        let digitalSignature;
        try {
            digitalSignature = await _computeSignature(movementHash, traceId);
        } catch (signErr) {
            await queueFiscalRecovery({
                transactionId: baseMovement.transactionId, totalAmount: totalAmount,
                paymentMethod: baseMovement.paymentMethod,
                operationDescription: baseMovement.operationDescription, movementType: baseMovement.movementType,
                phase: "WAIT_FOR_SIGNER", origin: "FISCAL_SIGNER_DOWN", traceId,
                lastError: signErr?.message || "FISCAL_SIGN_FAIL",
            });
            return {
                status: "SUCCESS",
                data: { ...baseMovement, previousRecordHash, hash: movementHash, pendingSignature: true, queued: true },
                error: null,
            };
        }

        const verificationQR = _generateVerificationQR(baseMovement.numSerieFactura, nifEmisor, operationDate, totalAmount);

        const movement = {
            ...baseMovement,
            previousRecordHash, hash: movementHash, digitalSignature, aeatPayload, verificationQR,
            hashAlgorithm: "SHA-256",
            signatureAlgorithm: "RSASSA-PKCS1-v1_5-SHA-256",
            recordTimestamp: generatedAt,
            traceId,
            _createdDate: new Date(),
        };

        const saved = await dalInsert(MOVIMIENTOS_CAJA_COL, movement);
        await _updateCajaActual(movement, traceId);
        await _projectToAccountingLedger(movement, traceId);

        await logAuditEvent("GIFT_CARD_REDEEMED", "INFO", `Tarjeta regalo canjeada: ${giftCardId}`, { giftCardId, totalAmount, serviceId, traceId }, traceId, giftCardId, "backend/cajas.web.js");

        return { status: "SUCCESS", data: saved, error: null };
    } catch (err) {
        const norm = normalizeError(err);
        log.error("registerGiftCardRedemption failed", { code: norm.code, error: norm.message, traceId });
        return { status: "ERROR", data: null, error: { code: norm.code || "GC_REDEEM_FAIL", message: norm.message } };
    }
});

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
            const candidates = await dalQuery(MOVIMIENTOS_CAJA_COL)
                .eq("linkedBookingIds", cleanId)
                .limit(5)
                .find();

            let items = candidates.items || [];

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