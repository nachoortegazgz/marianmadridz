/*
=============================================================================
MODULE: backend/fiscalHashPayload.js
PURPOSE: Canonical internal fiscal hash payload for eventLog.js movements.
The writer and read-only integrity verifier must share this exact builder.
=============================================================================
*/

import { SDK_CONFIG, TIPO_FACTURA } from "backend/internalConfig";
import {
    readInvoiceNumber,
    readInvoiceIssueDate,
    readMovementField,
    readTaxAmount,
    readInvoiceType,
    readIssuerTaxId,
    readRecipientTaxId,
} from "backend/data";
import { _safeTrim } from "public/mmUtils";

const VAT_ACCRUAL_APLICACION_ANTICIPO = "APLICACION_ANTICIPO";

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
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).formatToParts(dt).reduce((acc, part) => {
        acc[part.type] = part.value;
        return acc;
    }, {});

    const madridStr = dt.toLocaleString("en-US", {
        timeZone: "Europe/Madrid",
        timeZoneName: "longOffset",
    });
    const match = /GMT([+-])(\d{2}):?(\d{2})/.exec(madridStr);
    const madridOffset = match
        ? `${match[1]}${match[2]}:${match[3]}`
        : "+00:00";

    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${madridOffset}`;
}

export function buildEventLogFiscalChainPayload(movement, generatedAt) {
    const nifDestinatario = _safeTrim(readRecipientTaxId(movement));
    const recipientLegalName = _safeTrim(movement.recipientLegalName);
    const numSerieFactura = _safeTrim(readInvoiceNumber(movement));
    const fechaExpedicionFactura = _safeTrim(readInvoiceIssueDate(movement));
    const tipoFactura = readInvoiceType(movement) || TIPO_FACTURA.F1;
    const taxAmount = readTaxAmount(movement);
    const totalAmount = Number(movement.totalAmount ?? 0);
    const previousRecordHash = _safeTrim(movement.previousRecordHash);
    const nifEmisor = _safeTrim(readIssuerTaxId(movement));
    const tipoRectificativa = _safeTrim(readMovementField(movement, "tipoRectificativa"));
    const previousInvoiceId = _safeTrim(movement.previousInvoiceId);
    const correctionReason = _safeTrim(movement.correctionReason);
    const vatAccrualStatus = _safeTrim(movement.vatAccrualStatus);
    const linkedAdvanceId = _safeTrim(movement.linkedAdvanceId);
    const irpfWithholdingAmount = Number(movement.irpfWithholdingAmount || 0);
    const withholdingBase = Number(movement.withholdingBase || 0);
    const fiscalRole = _safeTrim(movement.fiscalRole);
    const surchargeAmount = Number(movement.surchargeAmount ?? 0);
    const bankReconciliationReference = _safeTrim(movement.bankReconciliationReference);

    const fields = [
        ["IDEmisorFactura", nifEmisor || ""],
        ["NumSerieFactura", numSerieFactura || ""],
        ["FechaExpedicionFactura", _formatAEATDate(fechaExpedicionFactura)],
        ["TipoFactura", tipoFactura],
        ["CuotaTotal", String(taxAmount.toFixed(2))],
        ["ImporteTotal", String(totalAmount.toFixed(2))],
        ["Huella", previousRecordHash || ""],
        ["FechaHoraHusoGenRegistro", _formatAEATDateTimeMadrid(generatedAt)],
    ];

    if (nifDestinatario) fields.push(["NIFDestinatario", nifDestinatario.slice(0, 20)]);
    if (recipientLegalName) fields.push(["NombreRazonDestinatario", recipientLegalName.slice(0, 200)]);
    if (bankReconciliationReference) fields.push(["ReferenciaBancaria", bankReconciliationReference.slice(0, 60)]);

    if (vatAccrualStatus === VAT_ACCRUAL_APLICACION_ANTICIPO) {
        fields.push(["TipoRectificativa", "I"]);
        if (linkedAdvanceId) fields.push(["IdAnticipoVinculado", linkedAdvanceId.slice(0, 120)]);
    }

    if (tipoRectificativa) fields.push(["TipoRectificativa", tipoRectificativa.slice(0, 4)]);
    if (irpfWithholdingAmount > 0) {
        fields.push(["ImporteRetencionIRPF", String(irpfWithholdingAmount.toFixed(2))]);
        if (withholdingBase > 0) fields.push(["BaseImponibleRetencion", String(withholdingBase.toFixed(2))]);
        if (fiscalRole) fields.push(["RolFiscal", fiscalRole.slice(0, 10)]);
    }

    if (surchargeAmount > 0) fields.push(["ImporteRecargoEquivalencia", String(surchargeAmount.toFixed(2))]);
    if (correctionReason) fields.push(["MotivoRectificacion", correctionReason.slice(0, 4)]);
    if (previousInvoiceId) fields.push(["IdFacturaRectificada", previousInvoiceId.slice(0, 120)]);

    return fields.map(([key, value]) => `${key}=${value}`).join("&");
}
