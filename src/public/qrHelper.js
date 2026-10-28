/*
=============================================================================
MODULE: public/qrHelper.js
VERSION: v5010.1-PUBLIC-QR-B01
BASE: v5009-FISCAL-V20.1 + SSOT v5010.1 (FASE1-7)
RESPONSIBILITY: Generacion de datos, URL y HTML de recibos Verifactu.
STANDARDS: G10 ASCII Strict.

FIXES APLICADOS v5010.1:
  - QR-B01: endpoint AEAT corregido. La URL oficial de verificacion de
            facturas simplificadas con QR es la sede electronica TIKE-CONT
            (www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR), no
            "sede.agenciatributaria.gob.es/verifactu" (endpoint inexistente).
            Parametros alineados con cajas.web.js _generateVerificationQR():
            nif, numserie, fecha (dd/mm/aaaa), importe.
  - QR-B02: normalizacion de fecha a formato AEAT dd/mm/aaaa mediante
            _formatDateToAeatDdMmYyyy() cuando llega como Date/ISO.
  - QR-B12: single source of truth del endpoint compartido via
            AEAT_VERIFACTU_ENDPOINTS.VERIFICATION_BASE_URL.

FIXES APLICADOS v5009-FISCAL-V20.1:
  - V20-01: lecturas de campos de MovimientosCaja migradas a nomenclatura
            V20.1 (issuerTaxId, invoiceNumber, invoiceIssueDate, totalAmount,
            recordHash, digitalSignature, recordTimestamp).
  - V20-02: fallback legacy preservado para consumidores no migrados.
  - V20-03: businessTaxId deprecated (apunta a issuerTaxId).

FIXES APLICADOS v5007.4 (heredados):
  - Generacion de datos, URL y HTML de recibos Verifactu.
=============================================================================
*/

export const AEAT_VERIFACTU_ENDPOINTS = Object.freeze({
    // QR-B01: endpoint oficial verificacion AEAT (RD 1007/2023,
    // orden HFP/1177/2024 annexo - facturas simplificadas con QR).
    VERIFICATION_BASE_URL:
        "https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR",
    VERIFICATION_BASE_URL_TEST:
        "https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR",
    DEV_ENVIRONMENT: false,
});

const DEFAULT_AMOUNT = "0";

// =============================================================================
// HELPERS
// =============================================================================

function _safeString(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value).trim();
}

function _formatDateToAeatDdMmYyyy(dateValue) {
    const date =
        dateValue instanceof Date ? dateValue : new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return [
        String(date.getDate()).padStart(2, "0"),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getFullYear()),
    ].join("/");
}

function _escapeHtml(value) {
    return _safeString(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function _escapeAttribute(value) {
    return _escapeHtml(value);
}

function _resolveInvoiceDate(movimiento) {
    // SSOT-KEYFIELD: unica clave de expedicion del ledger MovimientosCaja.
    const explicitDate = _safeString(movimiento?.fechaExpedicionFactura);

    if (explicitDate) {
        return _normalizeAeatDate(explicitDate);
    }

    // v5010.7 SSOT: unico campo canonico de sellado temporal del ledger.
    const timestamp = movimiento?.recordTimestamp;
    return _formatDateToAeatDdMmYyyy(timestamp);
}

/**
 * QR-B02: normaliza cualquier representacion de fecha (Date, ISO,
 * dd/mm/aaaa ya formateada) al formato AEAT obligatorio dd/mm/aaaa.
 */
function _normalizeAeatDate(value) {
    const str = _safeString(value);

    if (!str) {
        return "";
    }

    // Ya en formato AEAT dd/mm/aaaa -> se preserva
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
        return str;
    }

    // Date u otra representacion parseable -> formatear
    const date = value instanceof Date ? value : new Date(str);

    if (!Number.isNaN(date.getTime())) {
        return _formatDateToAeatDdMmYyyy(date);
    }

    // No parseable: devolver el string tal cual (comportamiento legacy)
    return str;
}

// LECTORES DE MOVIMIENTO (SSOT-KEYFIELD): leen exclusivamente claves canonicas
// del ledger MovimientosCaja. Los documentos historicos pre-migracion se
// normalizan con normalizeMovementKeys (backend/internalConfig) ANTES de ser
// procesados aqui; qrHelper no mantiene listas de aliases propias (cero
// duplicacion con MOVEMENT_LEGACY_READ_ALIASES).

function _readIssuerTaxId(movimiento, options) {
    return _safeString(
        movimiento?.nifEmisor ||
        options?.nifEmisor
    );
}

function _readInvoiceNumber(movimiento) {
    return _safeString(movimiento?.numSerieFactura);
}

function _readTotalAmount(movimiento) {
    return _safeString(
        movimiento?.totalAmount ||
        DEFAULT_AMOUNT
    ) || DEFAULT_AMOUNT;
}

function _readRecordHash(movimiento) {
    return _safeString(movimiento?.recordHash);
}

function _readDigitalSignature(movimiento) {
    return _safeString(movimiento?.digitalSignature);
}

// =============================================================================
// URL DE VERIFICACION
// =============================================================================

/**
 * QR-B01/QR-B02: genera la URL oficial de verificacion AEAT para el QR
 * de factura simplificada (endpoint TIKE-CONT/ValidarQR, identico al
 * contrato de cajas.web.js _generateVerificationQR).
 *
 * Formato AEAT obligatorio:
 *   nif      = NIF emisor
 *   numserie = numero de serie+factura (PFF / numSerieFactura)
 *   fecha    = dd/mm/aaaa (se normaliza desde Date/ISO si procede)
 *   importe  = total con IVA (decimal con punto)
 *
 * @alias buildVerifactuQrUrl - nombre esperado por consumidores externos
 *   (p. ej. ConfirmacionReserva.q5vps.js tras reemision v5010.1).
 */
export function generateVerifactuQrUrl(params = {}) {
    // SSOT-KEYFIELD: contrato de entrada con claves canonicas del ledger
    // (nifEmisor, numSerieFactura, fechaExpedicionFactura, totalAmount,
    // recordHash). Alias legacy de entrada eliminados.
    const issuerTaxId = _safeString(params.nifEmisor);

    const invoiceNumber = _safeString(params.numSerieFactura);

    // QR-B02: normalizacion de fecha a dd/mm/aaaa (acepta Date, ISO o texto ya formateado)
    const rawInvoiceDate = params.fechaExpedicionFactura;

    const invoiceIssueDate = _normalizeAeatDate(rawInvoiceDate);

    const totalAmount =
        _safeString(params.totalAmount || DEFAULT_AMOUNT) || DEFAULT_AMOUNT;

    // recordHash es la clave canonica del ledger.
    const recordHash = _safeString(params.recordHash);

    if (!issuerTaxId || !invoiceNumber || !invoiceIssueDate) {
        return null;
    }

    // Contratos de query AEAT TIKE-CONT: nif, numserie, fecha, importe.
    // Se preserva el orden canonico y se excluye hash vacio.
    const parts = [
        `nif=${encodeURIComponent(issuerTaxId)}`,
        `numserie=${encodeURIComponent(invoiceNumber)}`,
        `fecha=${encodeURIComponent(invoiceIssueDate)}`,
        `importe=${encodeURIComponent(String(totalAmount))}`,
    ];

    if (recordHash) {
        parts.push(`hash=${encodeURIComponent(recordHash)}`);
    }

    const baseUrl = params.testMode === true ||
        AEAT_VERIFACTU_ENDPOINTS.DEV_ENVIRONMENT === true ?
        AEAT_VERIFACTU_ENDPOINTS.VERIFICATION_BASE_URL_TEST :
        AEAT_VERIFACTU_ENDPOINTS.VERIFICATION_BASE_URL;

    return `${baseUrl}?${parts.join("&")}`;
}

/**
 * Alias canonico v5010.1: buildVerifactuQrUrl(params) -> URL QR AEAT.
 * Exportado porque los modulos de pagina (ConfirmacionReserva.q5vps.js)
 * lo referencian bajo este nombre tras la reemision FASE7.
 */
export const buildVerifactuQrUrl = generateVerifactuQrUrl;

// =============================================================================
// EXTRACCION DE DATOS
// =============================================================================

export function extractVerifactuData(
    movimiento = {},
    options = {}
) {
    const issuerTaxId = _readIssuerTaxId(movimiento, options);
    const invoiceNumber = _readInvoiceNumber(movimiento);
    const invoiceIssueDate = _resolveInvoiceDate(movimiento);
    const totalAmount = _readTotalAmount(movimiento);
    const recordHash = _readRecordHash(movimiento);
    const digitalSignature = _readDigitalSignature(movimiento);

    // Salida con claves canonicas del ledger (contract AEAT/CMS).
    const qrUrl = generateVerifactuQrUrl({
        nifEmisor: issuerTaxId,
        numSerieFactura: invoiceNumber,
        fechaExpedicionFactura: invoiceIssueDate,
        totalAmount,
        recordHash,
    });

    return {
        issuerTaxId,
        invoiceNumber,
        invoiceIssueDate,
        totalAmount,
        recordHash,
        digitalSignature,
        qrUrl,
    };
}

// =============================================================================
// RECIBO HTML
// =============================================================================

export function buildVerifactuReceiptHtml(
    movimiento = {},
    options = {}
) {
    const data = extractVerifactuData(movimiento, options);

    if (!data.qrUrl) {
        return "";
    }

    const shortHash = data.recordHash ?
        `${data.recordHash.slice(0, 16)}...` :
        "";

    return `
<div style="font-family:Arial,sans-serif;padding:16px;border:1px solid #ccc;border-radius:8px;">
  <h3 style="margin:0 0 12px;">Factura Simplificada</h3>
  <p><strong>NIF Emisor:</strong> ${_escapeHtml(data.issuerTaxId)}</p>
  <p><strong>Numero:</strong> ${_escapeHtml(data.invoiceNumber)}</p>
  <p><strong>Fecha:</strong> ${_escapeHtml(data.invoiceIssueDate)}</p>
  <p><strong>Importe:</strong> ${_escapeHtml(data.totalAmount)} EUR</p>
  <p>
    <strong>Verificacion:</strong>
    <a
      href="${_escapeAttribute(data.qrUrl)}"
      target="_blank"
      rel="noopener noreferrer"
    >
      Verificar factura
    </a>
  </p>
  ${
    shortHash
      ? `<p style="font-size:10px;color:#666;">Hash: ${_escapeHtml(
          shortHash
        )}</p>`
      : ""
  }
</div>`.trim();
}