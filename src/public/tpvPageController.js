/**
 * TPV page controller — HTML Component bridge to canonical operational WebMethods.
 * Business authorization and persistence rules remain in backend.
 * Commercial sale persistence and cash-session state are independent of fiscal-ledger availability.
 * HTML Component contract: MM_READY/MM_CONTEXT and request/response pairs.
 */
import { createWidgetBridge, MESSAGE_TYPES, PROTOCOL_VERSION } from "public/widgetBridge";
import { obtenerEstadoCaja, abrirSesionCaja, registrarArqueoParcial, cerrarSesionCaja } from "backend/tpv/tpvCaja.web";
import { validarVentaBorrador, registrarVenta } from "backend/tpv/tpvVentas.web";
import { registrarMovimientoCaja, exportarMovimientosCaja, exportarAuditoriaTPV } from "backend/tpv/tpvMovimientos.web";
import { exportarMovimientos } from "backend/tpv/tpvExport.web";
import { obtenerResumenCaja, generarTicketX, generarCierreZ } from "backend/tpv/tpvCierres.web";
import { obtenerAuditoriaTPV as obtenerAuditoriaTPVLista } from "backend/tpv/tpvAuditoria.web";
import { obtenerServicios, obtenerProductos, obtenerStaff, obtenerVariantesProducto, buscarClientesTPV } from "backend/tpv/tpvCatalogo.web";
import { obtenerConfiguracionTPV } from "backend/tpv/tpvUtils.web";
import { obtenerPermisosTPV } from "backend/tpv/tpvPermisos.web";

const REQUEST_TYPES = Object.freeze([
    "CASHIER_STATE",
    "SESSION_OPEN",
    "SESSION_CLOSE",
    "MOVEMENTS_EXPORT",
    "CATALOG_SERVICES",
    "CATALOG_PRODUCTS",
    "CATALOG_VARIANTS",
    "CATALOG_STAFF",
    "CUSTOMERS_SEARCH",
    "SALE_VALIDATE",
    "SALE_REGISTER",
    "CASH_MOVEMENT",
    "PARTIAL_CASH_COUNT",
    "REFUND",
    "TICKET_X",
    "TICKET_Z",
    "SESSION_SUMMARY",
    "AUDIT_LIST",
    "CASH_MOVEMENTS_EXPORT",
    "AUDIT_EXPORT",
]);
const activeBridges = new WeakMap();
const CONTROLLER_BUILD = "TPV_BRIDGE_DIAGNOSTICS_2026-11-27";
const MAX_KEY_LEN = 120;

function optionalString(value, maxLength = MAX_KEY_LEN) {
    if (value === null || value === undefined || value === "") return null;
    const result = String(value).trim();
    if (!result) return null;
    if (result.length > maxLength) throw new Error("TPV_VALUE_TOO_LONG");
    return result;
}

function boundedInteger(value, field, min, max) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < min || number > max) {
        throw new Error("TPV_INVALID_" + field);
    }
    return number;
}

function envelope(result) {
    if (
        result &&
        ["SUCCESS", "PENDING", "ERROR"].includes(result.status) &&
        Object.prototype.hasOwnProperty.call(result, "data") &&
        Object.prototype.hasOwnProperty.call(result, "error")
    ) {
        return result;
    }

    return {
        status: "SUCCESS",
        data: result ?? null,
        error: null,
    };
}

const ERROR_CATALOG = Object.freeze({
    TPV_INVALID_INPUT: Object.freeze({
        message: "La solicitud de venta no contiene datos válidos.",
        solution: "Comprueba la sesión, la clave UUID v4 y las líneas de producto.",
        recoverable: true,
        retryable: false,
        requiresReconciliation: false,
    }),
    TPV_SALE_NOT_READY: Object.freeze({
        message: "La venta todavía no está autorizada para cobrar.",
        solution: "Revisa el desglose fiscal, la configuración de precios, la confirmación del pago y el estado del writer TPV.",
        recoverable: true,
        retryable: false,
        requiresReconciliation: false,
    }),
    TPV_INVALID_IDEMPOTENCY_KEY: Object.freeze({
        message: "La clave idempotente de la venta no es válida.",
        solution: "Genera una nueva clave UUID v4 para la operación.",
        recoverable: true,
        retryable: false,
        requiresReconciliation: false,
    }),
    TPV_CATALOG_LINE_REQUIRED: Object.freeze({
        message: "La línea no identifica un producto o servicio válido.",
        solution: "Selecciona una línea existente del catálogo Wix.",
        recoverable: true,
        retryable: false,
        requiresReconciliation: false,
    }),
    TPV_INVALID_LINE: Object.freeze({
        message: "Una de las líneas de venta no tiene un formato válido.",
        solution: "Elimina la línea incorrecta y vuelve a seleccionarla desde el catálogo.",
        recoverable: true,
        retryable: false,
        requiresReconciliation: false,
    }),
    TPV_INVALID_PAYMENT: Object.freeze({
        message: "El desglose de medios de pago contiene una línea no válida.",
        solution: "Revisa los importes y medios de pago declarados.",
        recoverable: true,
        retryable: false,
        requiresReconciliation: false,
    }),
    TPV_INVALID_QUANTITY: Object.freeze({
        message: "La cantidad de una línea no es válida.",
        solution: "Introduce una cantidad entera positiva.",
        recoverable: true,
        retryable: false,
        requiresReconciliation: false,
    }),
    TPV_INVALID_DISCOUNT: Object.freeze({
        message: "El descuento indicado no es válido.",
        solution: "Retira el descuento; todavía no existe una política de descuentos autorizada en backend.",
        recoverable: true,
        retryable: false,
        requiresReconciliation: false,
    }),
    TPV_PAYMENT_PENDING: Object.freeze({
        message: "El pago está pendiente de confirmación.",
        solution: "Consulta el estado antes de repetir la operación.",
        recoverable: false,
        retryable: true,
        requiresReconciliation: false,
    }),
    TPV_PAYMENT_FAILED: Object.freeze({
        message: "El pago no se ha confirmado.",
        solution: "Comprueba el medio de pago antes de volver a intentarlo.",
        recoverable: true,
        retryable: true,
        requiresReconciliation: false,
    }),
    TPV_RECONCILIATION_REQUIRED: Object.freeze({
        message: "La operación necesita comprobación.",
        solution: "No la repitas; solicita una conciliación.",
        recoverable: false,
        retryable: false,
        requiresReconciliation: true,
    }),
    TPV_IDEMPOTENCY_CONFLICT: Object.freeze({
        message: "La clave de operación ya se utilizó con otros datos.",
        solution: "Consulta la operación original; no la repitas.",
        recoverable: false,
        retryable: false,
        requiresReconciliation: false,
    }),
    TPV_OPERATIONAL_LEDGER_NOT_CONFIGURED: Object.freeze({
        message: "La escritura del ledger fiscal continúa deshabilitada.",
        solution: "El registro comercial y los movimientos físicos de caja son independientes; no se ha realizado ningún cobro fiscal ni emisión de factura.",
        recoverable: false,
        retryable: false,
        requiresReconciliation: false,
    }),
    TPV_SESSION_NOT_OPEN: Object.freeze({
        message: "No hay una sesión de caja abierta.",
        solution: "Consulta el estado de caja y abre una sesión cuando el backend autorice la operación.",
        recoverable: true,
        retryable: false,
        requiresReconciliation: false,
    }),
});

function errorEnvelope(error, field = null) {
    const code = String(error?.code || error?.message || "TPV_OPERATION_FAILED");
    const definition = ERROR_CATALOG[code] || {
        message: "No se pudo completar la operación.",
        solution: "Consulta el estado y solicita conciliación antes de repetirla.",
        recoverable: false,
        retryable: false,
        requiresReconciliation: true,
    };
    return {
        status: "ERROR",
        data: null,
        error: {
            code,
            message: definition.message,
            solution: definition.solution,
            field,
            recoverable: definition.recoverable === true,
            retryable: definition.retryable === true,
            requiresReconciliation: definition.requiresReconciliation === true,
        },
    };
}

function numeric(value, field, { allowZero = true } = {}) {
    if (value === "" || value === null || value === undefined) {
        if (allowZero) return 0;
        throw new Error("TPV_INVALID_" + field);
    }
    let amount;
    if (typeof value === "number") {
        amount = value;
    } else if (typeof value === "string") {
        let raw = value.trim().replace(/\s+/g, "").replace(/€$/i, "");
        if (!raw || !/^\d+(?:[.,]\d+)*$/.test(raw)) {
            throw new Error("TPV_INVALID_" + field);
        }
        const comma = raw.lastIndexOf(",");
        const dot = raw.lastIndexOf(".");
        let integerPart = raw;
        let fractionPart = "";
        if (comma >= 0 && dot >= 0) {
            const decimal = comma > dot ? "," : ".";
            const grouping = decimal === "," ? "." : ",";
            const parts = raw.split(decimal);
            const groups = parts[0].split(grouping);
            if (parts.length !== 2 || !/^\d{1,2}$/.test(parts[1]) ||
                !/^\d{1,3}$/.test(groups[0]) ||
                !groups.slice(1).every((part) => /^\d{3}$/.test(part))) {
                throw new Error("TPV_INVALID_" + field);
            }
            integerPart = groups.join("");
            fractionPart = parts[1];
        } else if (comma >= 0 || dot >= 0) {
            const separator = comma >= 0 ? "," : ".";
            const parts = raw.split(separator);
            if (parts.length === 2 && parts[1].length >= 1 && parts[1].length <= 2) {
                integerPart = parts[0];
                fractionPart = parts[1];
            } else if (parts.length > 2 && /^\d{1,3}$/.test(parts[0]) &&
                parts.slice(1).every((part) => /^\d{3}$/.test(part))) {
                integerPart = parts.join("");
            } else {
                throw new Error("TPV_INVALID_" + field);
            }
        }
        amount = Number(integerPart + (fractionPart ? "." + fractionPart : ""));
    } else {
        throw new Error("TPV_INVALID_" + field);
    }
    const minor = Math.round((amount + Number.EPSILON) * 100);
    if (!Number.isFinite(amount) || !Number.isSafeInteger(minor) || amount < 0 ||
        Math.abs(amount * 100 - minor) > 1e-7 ||
        (!allowZero && minor === 0)) {
        throw new Error("TPV_INVALID_" + field);
    }
    return minor / 100;
}

function idempotencyKey(message, payload = {}) {
    const supplied = String(payload.idempotencyKey || "").trim();
    if (supplied) {
        if (!/^[A-Za-z0-9:_-]{8,100}$/.test(supplied)) {
            throw new Error("TPV_INVALID_IDEMPOTENCY_KEY");
        }
        return supplied;
    }
    const messageId = String(message?.messageId || "").replace(/[^A-Za-z0-9:_-]/g, "").slice(0, 70);
    if (messageId.length < 8) throw new Error("TPV_MESSAGE_ID_REQUIRED_FOR_IDEMPOTENCY");
    return ("TPV_UI_" + String(message.type || "OP") + "_" + messageId).slice(0, 100);
}

function saleUuidV4Key(value) {
    const candidate = String(value || "").split("_").pop().replace(/-/g, "");
    if (!/^[0-9a-f]{32}$/i.test(candidate)) throw new Error("TPV_INVALID_IDEMPOTENCY_KEY");
    const uuid = candidate.replace(
        /^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/i,
        "$1-$2-$3-$4-$5"
    );
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)) {
        throw new Error("TPV_INVALID_IDEMPOTENCY_KEY");
    }
    return uuid;
}

async function dispatch(message) {
    const payload = message.payload && typeof message.payload === "object" && !Array.isArray(message.payload)
        ? message.payload
        : {};
    const key = idempotencyKey(message, payload);

    switch (message.type) {
        case "CASHIER_STATE":
            return obtenerEstadoCaja();
        case "SESSION_OPEN": {
            const expectedSessionId = optionalString(payload.expectedSessionId, 160);
            if (!expectedSessionId) throw new Error("TPV_SESSION_PREVIEW_REQUIRED");
            return abrirSesionCaja({
                idempotencyKey: key,
                expectedSessionId,
                openingCash: numeric(payload.openingCash, "OPENING_CASH"),
                terminalId: optionalString(payload.terminalId, 80) || "TPV",
                reason: optionalString(payload.reason, 200) || "Apertura desde TPV",
            });
        }
        case "SESSION_CLOSE":
            return cerrarSesionCaja({
                sessionId: optionalString(payload.sessionId, 160) || "",
                arqueo: {
                    contadoEfectivo: numeric(payload.contadoEfectivo, "COUNTED_CASH"),
                    ...(payload.contadoTarjeta === undefined ? {} : { contadoTarjeta: numeric(payload.contadoTarjeta, "COUNTED_CARD") }),
                },
                observaciones: optionalString(payload.observaciones, 500) || "",
                idempotencyKey: key,
            });
        case "MOVEMENTS_EXPORT":
            return exportarMovimientos({
                desde: optionalString(payload.desde, 80),
                hasta: optionalString(payload.hasta, 80),
                sessionId: optionalString(payload.sessionId, 160),
                formato: optionalString(payload.formato, 8) || "json",
                cursor: optionalString(payload.cursor, 32),
            });
        case "CATALOG_SERVICES":
            return obtenerServicios({ limit: 100, offset: 0 });
        case "CATALOG_PRODUCTS":
            return obtenerProductos({
                limit: boundedInteger(payload.limit ?? 100, "CATALOG_LIMIT", 1, 100),
                cursor: optionalString(payload.cursor, 16000),
            });
        case "CATALOG_VARIANTS": {
            const productId = optionalString(payload.productId);
            if (!productId) throw new Error("TPV_PRODUCT_ID_REQUIRED");
            return obtenerVariantesProducto({ productId });
        }
        case "CATALOG_STAFF":
            return obtenerStaff();
        case "CUSTOMERS_SEARCH":
            return buscarClientesTPV({ search: optionalString(payload.search, 100) || "" });
        case "SALE_VALIDATE": {
            if (!Array.isArray(payload.lineItems) || payload.lineItems.length === 0) throw new Error("TPV_LINES_REQUIRED");
            if (payload.lineItems.length > 100 || (Array.isArray(payload.payments) && payload.payments.length > 100)) {
                throw new Error("TPV_ARRAY_TOO_LARGE");
            }
            const lineas = payload.lineItems.map((line) => {
                if (!line || typeof line !== "object" || Array.isArray(line)) throw new Error("TPV_INVALID_LINE");
                const tipoLinea = String(line.tipoLinea || "").trim().toUpperCase();
                const itemId = optionalString(line.itemId, 160);
                if (!["PRODUCTO", "SERVICIO"].includes(tipoLinea) || !itemId) throw new Error("TPV_CATALOG_LINE_REQUIRED");
                return {
                    tipoLinea,
                    itemId,
                    ...(optionalString(line.varianteId, 160) ? { varianteId: optionalString(line.varianteId, 160) } : {}),
                    cantidad: numeric(line.cantidad, "QUANTITY", { allowZero: false }),
                    profesionalId: optionalString(line.profesionalId, 160),
                };
            });
            const pagos = (Array.isArray(payload.payments) ? payload.payments : []).map((payment) => {
                if (!payment || typeof payment !== "object" || Array.isArray(payment)) throw new Error("TPV_INVALID_PAYMENT");
                return {
                    medioPago: String(payment.method || payment.medioPago || "").trim().toUpperCase(),
                    importe: numeric(payment.amount ?? payment.importe, "PAYMENT_AMOUNT", { allowZero: false }),
                    importeCambio: numeric(payment.change ?? payment.importeCambio ?? 0, "CHANGE_AMOUNT"),
                };
            });
            return validarVentaBorrador({ lineas, pagos });
        }
        case "SALE_REGISTER": {
            if (!Array.isArray(payload.lineItems) || payload.lineItems.length === 0) throw new Error("TPV_LINES_REQUIRED");
            if (payload.lineItems.length > 100 || (Array.isArray(payload.payments) && payload.payments.length > 100)) {
                throw new Error("TPV_ARRAY_TOO_LARGE");
            }
            const sessionId = optionalString(payload.sessionId, 160);
            if (!sessionId) throw new Error("TPV_SESSION_REQUIRED");
            const lineas = payload.lineItems.map((line) => {
                if (!line || typeof line !== "object" || Array.isArray(line)) throw new Error("TPV_INVALID_LINE");
                const tipoLinea = String(line.tipoLinea || "").trim().toUpperCase();
                const itemId = optionalString(line.itemId, 160);
                if (!["PRODUCTO", "SERVICIO"].includes(tipoLinea) || !itemId) throw new Error("TPV_CATALOG_LINE_REQUIRED");
                return {
                    tipoLinea,
                    itemId,
                    ...(optionalString(line.varianteId, 160) ? { varianteId: optionalString(line.varianteId, 160) } : {}),
                    cantidad: numeric(line.cantidad, "QUANTITY", { allowZero: false }),
                    profesionalId: optionalString(line.profesionalId, 160),
                };
            });
            const pagos = (Array.isArray(payload.payments) ? payload.payments : []).map((payment) => {
                if (!payment || typeof payment !== "object" || Array.isArray(payment)) throw new Error("TPV_INVALID_PAYMENT");
                return {
                    medioPago: String(payment.method || payment.medioPago || "").trim().toUpperCase(),
                    importe: numeric(payment.amount ?? payment.importe, "PAYMENT_AMOUNT", { allowZero: false }),
                    importeCambio: numeric(payment.change ?? payment.importeCambio ?? 0, "CHANGE_AMOUNT"),
                };
            });
            return registrarVenta({
                sessionId,
                idempotencyKey: saleUuidV4Key(payload.idempotencyKey),
                lineas,
                pagos,
                medioPago: optionalString(payload.medioPago, 40) || null,
            });
        }
        case "CASH_MOVEMENT":
            return registrarMovimientoCaja({
                idempotencyKey: key,
                sessionId: optionalString(payload.sessionId, 160) || "",
                movementType: (optionalString(payload.movementType, 40) || "").toUpperCase(),
                paymentMethod: (optionalString(payload.paymentMethod, 40) || "EFECTIVO").toUpperCase(),
                amount: numeric(payload.amount, "CASH_MOVEMENT", { allowZero: false }),
                reason: optionalString(payload.reason, 500) || "",
                profesionalId: optionalString(payload.profesionalId, 160),
            });
        case "PARTIAL_CASH_COUNT":
            return registrarArqueoParcial({
                idempotencyKey: key,
                sessionId: optionalString(payload.sessionId, 160) || "",
                countedCash: numeric(payload.countedCash, "COUNTED_CASH"),
                reason: optionalString(payload.reason, 500) || "",
            });
        case "REFUND":
            // El HTML SSOT mantiene las devoluciones deshabilitadas.
            throw new Error("TPV_REFUND_DISABLED");
        case "TICKET_X":
            return generarTicketX({ sessionId: optionalString(payload.sessionId, 160) || "" });
        case "TICKET_Z":
            return generarCierreZ({
                sessionId: optionalString(payload.sessionId, 160) || "",
                idempotencyKey: key,
                countedCash: numeric(payload.countedCash, "COUNTED_CASH"),
                differenceReason: optionalString(payload.differenceReason, 500) || "",
            });
        case "SESSION_SUMMARY":
            return obtenerResumenCaja({ sessionId: optionalString(payload.sessionId, 160) || "" });
        case "AUDIT_LIST":
            return obtenerAuditoriaTPVLista({
                sessionId: optionalString(payload.sessionId, 160) || "",
                limit: boundedInteger(payload.limit ?? 50, "AUDIT_LIMIT", 1, 100),
            });
        case "CASH_MOVEMENTS_EXPORT":
            return exportarMovimientosCaja({
                sessionId: optionalString(payload.sessionId, 160) || "",
                idempotencyKey: key,
            });
        case "AUDIT_EXPORT":
            return exportarAuditoriaTPV({
                sessionId: optionalString(payload.sessionId, 160) || "",
                idempotencyKey: key,
            });
        default:
            throw new Error("UNKNOWN_MESSAGE");
    }
}

export function initializeTpvPage(widget) {
    const previous = activeBridges.get(widget);
    if (previous) previous.destroy();

    const bridge = createWidgetBridge(widget, {
        allowedTypes: [MESSAGE_TYPES.READY, MESSAGE_TYPES.CONTEXT, ...REQUEST_TYPES],
        transport: "wix-html-component", // Wix onMessage is the trust boundary; its documented event contract exposes event.data, not event.origin.
        handshakeTimeoutMs: 65000,
        onContextReady: async () => {
            const [configResult, permissionsResult] = await Promise.all([
                obtenerConfiguracionTPV(),
                // UI-only capability display; backend WebMethods independently authorize each operation.
                obtenerPermisosTPV().catch((error) => ({
                    status: "ERROR",
                    data: null,
                    error: {
                        code: "TPV_PERMISSIONS_UNAVAILABLE",
                        message: "No se pudieron resolver los permisos de TPV.",
                        reasonCode: String(error?.code || error?.message || "UNKNOWN"),
                    },
                })),
            ]);
            const config = envelope(configResult);
            const permissions = envelope(permissionsResult);
            const permissionsReady = permissions.status === "SUCCESS";
            const capabilities = permissionsReady &&
                permissions.data?.capabilities &&
                typeof permissions.data.capabilities === "object"
                ? permissions.data.capabilities
                : {};
            const contextStatus = config.status === "SUCCESS" && permissionsReady
                ? "SUCCESS"
                : "ERROR";
            return {
                status: contextStatus,
                data: {
                    component: "htmlTPV",
                    protocolVersion: PROTOCOL_VERSION,
                    currency: config.status === "SUCCESS" ? config.data?.currency : null,
                    timeZone: config.status === "SUCCESS" ? config.data?.timeZone : null,
                    capabilities,
                    permissionsStatus: permissions.status,
                    operationalWritesAvailable: permissionsReady && permissions.data?.operationalWritesAvailable === true,
                    operationalWritesUnavailableReason: permissionsReady
                        ? (permissions.data?.operationalWritesUnavailableReason || null)
                        : (permissions.error?.code || "TPV_PERMISSIONS_UNAVAILABLE")
                },
                error: config.error || permissions.error || null,
            };
        },
        onWidgetMessage: async (message, reply) => {
            if (message.type === MESSAGE_TYPES.READY) return;
            try {
                const result = envelope(await dispatch(message));
                reply(message.type + "_RES", result, message);
            } catch (error) {
                reply(message.type + "_RES", errorEnvelope(error), message);
            }
        },
        onError: (error, reportedDetail) => {
            const detail = error?.detail && typeof error.detail === "object"
                ? error.detail
                : (reportedDetail && typeof reportedDetail === "object" ? reportedDetail : {});
            const allowedTypes = Array.isArray(detail.allowedTypes)
                ? detail.allowedTypes.slice(0, 40).map((type) => String(type).slice(0, 40))
                : [];
            console.error("[TPV] Widget bridge error", {
                code: String(error?.code || "WIDGET_BRIDGE_ERROR").slice(0, 80),
                controllerBuild: CONTROLLER_BUILD,
                bridgeId: String(error?.bridgeId || "").slice(0, 80),
                receivedType: typeof detail.receivedType === "string" ? detail.receivedType.slice(0, 40) : null,
                receivedVersion: detail.receivedVersion ?? null,
                attemptedType: typeof detail.attemptedType === "string" ? detail.attemptedType.slice(0, 40) : null,
                allowedTypes,
                causeCode: typeof detail.causeCode === "string" ? detail.causeCode.slice(0, 80) : null,
                causeDetailCode: typeof detail.causeDetail?.code === "string" ? detail.causeDetail.code.slice(0, 80) : null,
            });
        },
    });

    activeBridges.set(widget, bridge);
    console.info("[TPV] Widget bridge initialized", {
        controllerBuild: CONTROLLER_BUILD,
        protocolVersion: PROTOCOL_VERSION,
        allowedTypes: bridge.allowedTypes,
    });
    return bridge;
}
