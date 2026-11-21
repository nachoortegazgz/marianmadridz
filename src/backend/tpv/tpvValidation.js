const PAYMENT_METHODS = Object.freeze(["EFECTIVO", "TARJETA", "BIZUM", "OTROS"]);

function toMinorUnits(value, field) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
        throw new Error("TPV_INVALID_" + field);
    }
    const minor = Math.round((amount + Number.EPSILON) * 100);
    if (Math.abs((amount * 100) - minor) > 1e-7) {
        throw new Error("TPV_INVALID_PRECISION_" + field);
    }
    return minor;
}

function normalizeQuantity(value) {
    const quantity = Number(value);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) {
        throw new Error("TPV_INVALID_QUANTITY");
    }
    return quantity;
}

function normalizeLine(line, index) {
    if (!line || typeof line !== "object" || Array.isArray(line)) {
        throw new Error("TPV_INVALID_LINE");
    }

    const quantity = normalizeQuantity(line.cantidad);
    const unitMinor = toMinorUnits(line.precioUnitario, "UNIT_PRICE");
    const discountMinor = toMinorUnits(line.descuentoImporte || 0, "DISCOUNT");
    const grossMinor = quantity * unitMinor;

    if (!Number.isInteger(grossMinor) || grossMinor <= 0 || discountMinor > grossMinor) {
        throw new Error("TPV_INVALID_LINE_AMOUNT");
    }

    const subtotalMinor = grossMinor - discountMinor;
    const taxMinor = toMinorUnits(line.impuestosImporte || 0, "TAX");
    const totalMinor = subtotalMinor + taxMinor;

    if (line.subtotalNeto !== undefined &&
        toMinorUnits(line.subtotalNeto, "SUBTOTAL") !== subtotalMinor) {
        throw new Error("TPV_LINE_SUBTOTAL_MISMATCH");
    }
    if (line.totalLinea !== undefined &&
        toMinorUnits(line.totalLinea, "LINE_TOTAL") !== totalMinor) {
        throw new Error("TPV_LINE_TOTAL_MISMATCH");
    }

    const tipoLinea = String(line.tipoLinea || "").trim().toUpperCase();
    if (!["SERVICIO", "PRODUCTO", "PERSONALIZADA"].includes(tipoLinea)) {
        throw new Error("TPV_INVALID_LINE_TYPE");
    }

    const varianteId = line.varianteId ? String(line.varianteId).trim() : null;
    if (varianteId && tipoLinea !== "PRODUCTO") throw new Error("TPV_VARIANT_ONLY_FOR_PRODUCTS");
    if (varianteId && !/^[A-Za-z0-9-]{1,64}$/.test(varianteId)) throw new Error("TPV_INVALID_VARIANT_ID");

    const concepto = String(line.concepto || "").trim();
    if (!concepto || concepto.length > 400) {
        throw new Error("TPV_INVALID_CONCEPT");
    }

    return Object.freeze({
        lineaNumero: index + 1,
        tipoLinea,
        itemId: line.itemId ? String(line.itemId) : null,
        varianteId,
        concepto,
        cantidad: quantity,
        precioUnitario: unitMinor / 100,
        descuentoImporte: discountMinor / 100,
        subtotalNeto: subtotalMinor / 100,
        impuestosImporte: taxMinor / 100,
        totalLinea: totalMinor / 100,
        profesionalId: line.profesionalId ? String(line.profesionalId) : null,
        stockAfectado: tipoLinea === "PRODUCTO" && line.stockAfectado === true,
        totalMinor,
    });
}

function normalizePayments(pagos, totalMinor) {
    if (pagos === undefined || pagos === null) {
        return { pagos: Object.freeze([]), importePagadoMinor: 0 };
    }
    if (!Array.isArray(pagos)) {
        throw new Error("TPV_INVALID_PAYMENTS");
    }

    let importePagadoMinor = 0;
    let efectivoRecibidoMinor = 0;
    let cambioEntregadoMinor = 0;
    const paymentBreakdownMinor = Object.fromEntries(
        PAYMENT_METHODS.map((method) => [method, 0])
    );
    const normalized = pagos.map((pago) => {
        const medioPago = String(pago?.medioPago || "").trim().toUpperCase();
        if (!PAYMENT_METHODS.includes(medioPago)) {
            throw new Error("TPV_INVALID_PAYMENT_METHOD");
        }
        const importeMinor = toMinorUnits(pago?.importe, "PAYMENT_AMOUNT");
        if (importeMinor <= 0) {
            throw new Error("TPV_INVALID_PAYMENT_AMOUNT");
        }
        const importeCambioMinor = toMinorUnits(pago?.importeCambio || 0, "CHANGE_AMOUNT");
        if (importeCambioMinor > 0 && medioPago !== "EFECTIVO") {
            throw new Error("TPV_CHANGE_REQUIRES_CASH");
        }
        if (importeCambioMinor > importeMinor) {
            throw new Error("TPV_CHANGE_EXCEEDS_CASH_RECEIVED");
        }
        const importeAplicadoMinor = importeMinor - importeCambioMinor;
        if (importeAplicadoMinor <= 0) {
            throw new Error("TPV_INVALID_APPLIED_PAYMENT_AMOUNT");
        }
        importePagadoMinor += importeAplicadoMinor;
        paymentBreakdownMinor[medioPago] += importeAplicadoMinor;
        if (medioPago === "EFECTIVO") {
            efectivoRecibidoMinor += importeMinor;
            cambioEntregadoMinor += importeCambioMinor;
        }
        return Object.freeze({
            medioPago,
            importe: importeMinor / 100,
            importeCambio: importeCambioMinor / 100,
            importeAplicado: importeAplicadoMinor / 100,
        });
    });

    if (importePagadoMinor > totalMinor) {
        throw new Error("TPV_OVERPAYMENT");
    }

    return {
        pagos: Object.freeze(normalized),
        importePagadoMinor,
        efectivoRecibidoMinor,
        cambioEntregadoMinor,
        paymentBreakdownMinor: Object.freeze(paymentBreakdownMinor),
    };
}

/**
 * Validates the report's sale DTO without persisting it or initiating a payment.
 * All arithmetic is checked in minor currency units; tax is never inferred.
 */
export function validateSaleDraft(input = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new Error("TPV_INVALID_SALE");
    }
    if (!Array.isArray(input.lineas) || input.lineas.length === 0) {
        throw new Error("TPV_LINES_REQUIRED");
    }

    const lineas = input.lineas.map(normalizeLine);
    const subtotalMinor = lineas.reduce((sum, line) => sum + toMinorUnits(line.subtotalNeto, "SUBTOTAL"), 0);
    const taxMinor = lineas.reduce((sum, line) => sum + toMinorUnits(line.impuestosImporte, "TAX"), 0);
    const totalMinor = lineas.reduce((sum, line) => sum + line.totalMinor, 0);

    if (input.subtotalNeto !== undefined &&
        toMinorUnits(input.subtotalNeto, "SUBTOTAL") !== subtotalMinor) {
        throw new Error("TPV_SALE_SUBTOTAL_MISMATCH");
    }
    if (input.impuestosTotal !== undefined &&
        toMinorUnits(input.impuestosTotal, "TAX_TOTAL") !== taxMinor) {
        throw new Error("TPV_SALE_TAX_MISMATCH");
    }
    if (input.totalVenta !== undefined &&
        toMinorUnits(input.totalVenta, "SALE_TOTAL") !== totalMinor) {
        throw new Error("TPV_SALE_TOTAL_MISMATCH");
    }

    const paymentResult = normalizePayments(input.pagos, totalMinor);
    const importePendienteMinor = totalMinor - paymentResult.importePagadoMinor;
    const paymentBreakdown = Object.freeze({
        EFECTIVO: paymentResult.paymentBreakdownMinor.EFECTIVO / 100,
        TARJETA: paymentResult.paymentBreakdownMinor.TARJETA / 100,
        BIZUM: paymentResult.paymentBreakdownMinor.BIZUM / 100,
        OTROS: paymentResult.paymentBreakdownMinor.OTROS / 100,
    });

    return Object.freeze({
        currency: "EUR",
        lineas,
        pagos: paymentResult.pagos,
        desgloseMedios: paymentBreakdown,
        efectivoRecibido: paymentResult.efectivoRecibidoMinor / 100,
        cambioEntregado: paymentResult.cambioEntregadoMinor / 100,
        efectivoAplicado: paymentResult.paymentBreakdownMinor.EFECTIVO / 100,
        totalCobrado: paymentResult.importePagadoMinor / 100,
        subtotalNeto: subtotalMinor / 100,
        impuestosTotal: taxMinor / 100,
        totalVenta: totalMinor / 100,
        importePagado: paymentResult.importePagadoMinor / 100,
        importePendiente: importePendienteMinor / 100,
        estadoVenta: importePendienteMinor === 0 ? "COBRADA_SINTETICA" :
            paymentResult.importePagadoMinor > 0 ? "PARCIAL_SINTETICA" : "BORRADOR",
        isSynthetic: true,
        persisted: false,
        realPayment: false,
    });
}
