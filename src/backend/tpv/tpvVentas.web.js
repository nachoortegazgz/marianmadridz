import { Permissions, webMethod } from "wix-web-module";
import { requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { validateSaleDraft } from "backend/tpv/tpvValidation";
import { error as tpvError, ok as tpvOk } from "backend/tpv/tpvEnvelope";
import { prepareTpvSaleCatalog } from "backend/tpv/tpvSalePreparation";
import { assertTpvPaymentMethodsSupported } from "backend/tpv/tpvSalePreparationCore";
import { FISCAL_RUNTIME_POLICY } from "backend/internalConfig";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PREPARATION_MESSAGES = Object.freeze({
    TPV_LINES_REQUIRED_OR_LIMIT_EXCEEDED: "La venta debe contener entre 1 y 100 líneas.",
    TPV_LINE_TAX_CLASSIFICATION_UNSUPPORTED: "La línea no tiene una clasificación fiscal configurada para el TPV.",
    TPV_CATALOG_ITEM_ID_INVALID: "El identificador del producto o servicio no es válido.",
    TPV_INVALID_QUANTITY: "La cantidad debe ser un número entero positivo.",
    TPV_DISCOUNT_NOT_CONFIGURED: "Los descuentos no están habilitados para el TPV hasta disponer de una regla de autorización y cálculo en backend.",
    TPV_PRODUCT_NOT_AVAILABLE_IN_POS: "El producto no está disponible en el catálogo del TPV.",
    TPV_PRODUCT_VARIANTS_UNAVAILABLE: "El producto no tiene variantes vendibles disponibles.",
    TPV_PRODUCT_VARIANT_REQUIRED: "Selecciona una variante del producto antes de continuar.",
    TPV_PRODUCT_VARIANT_NOT_FOUND: "La variante seleccionada ya no está disponible en el catálogo.",
    TPV_SERVICE_NOT_AVAILABLE: "El servicio no está disponible en el catálogo actual.",
    TPV_SERVICE_TYPE_NOT_SUPPORTED: "El tipo de servicio no está habilitado para venta directa en el TPV.",
    TPV_SERVICE_PRICE_NOT_FIXED: "El servicio no tiene un precio fijo verificable en Bookings.",
    TPV_SERVICE_CATALOG_PAGE_INCOMPLETE: "No se ha podido consultar el catálogo completo de servicios.",
    TPV_STAFF_NOT_ALLOWED: "El profesional seleccionado no está vinculado a un miembro autorizado de Bookings.",
    TPV_PAYMENT_METHOD_NOT_VERIFIED: "Los bonos y tarjetas regalo requieren consultar y validar su saldo antes de aceptarse como pago.",
    TPV_CATALOG_PRICE_UNAVAILABLE: "Wix no ha devuelto un precio actual verificable para esta línea.",
    TPV_CATALOG_CURRENCY_MISMATCH: "El producto o servicio no está configurado en euros.",
    TPV_TAX_CALCULATION_FAILED: "Wix no ha podido calcular los impuestos de la venta.",
    TPV_TAX_RESULT_INCOMPLETE: "La respuesta fiscal de Wix está incompleta; no se puede validar la venta.",
    TPV_TAX_SETTINGS_UNAVAILABLE: "No se ha podido leer la configuración fiscal global de Wix.",
    TPV_TAX_PRICE_MODE_MISMATCH: "El modo de precio con o sin impuestos devuelto por Wix no coincide con la configuración global.",
    TPV_TAX_CURRENCY_MISMATCH: "El cálculo fiscal no ha devuelto la moneda EUR esperada.",
    TPV_TAX_RESULT_LINE_MISSING: "Wix no ha devuelto el cálculo fiscal de una de las líneas.",
    TPV_TAX_RESULT_LINE_INCONSISTENT: "El desglose fiscal devuelto por Wix no coincide con la línea de venta.",
    TPV_TAX_ROUNDING_MISMATCH: "Los totales fiscales de Wix no cuadran con el desglose por líneas.",
});

function preparationFailure(error, traceId) {
    const code = String(error?.code || error?.message || "TPV_SALE_PREPARATION_FAILED");
    const message = PREPARATION_MESSAGES[code] ||
        "No se ha podido preparar la venta con los datos actuales del catálogo y la configuración fiscal de Wix.";
    return tpvError(
        code,
        message,
        [
            "No se ha registrado ninguna venta ni se ha iniciado ningún cobro.",
            "Actualiza el catálogo y vuelve a validar la venta.",
            "Si el error es fiscal, no modifiques manualmente el impuesto ni el precio en el navegador.",
        ],
        {
            persisted: false,
            retryable: false,
            traceId,
            technicalDetail: code,
        }
    );
}

/**
 * Validates a sale using current Wix Catalog V3 / Bookings prices and Wix tax
 * calculation. Client-supplied prices, taxes and totals are deliberately ignored.
 */
export const validarVentaBorrador = webMethod(
    Permissions.SiteMember,
    async (venta = {}) => {
        const traceId = makeTraceId("tpv-sale-prepare");
        await requireCajero(traceId);
        try {
            assertTpvPaymentMethodsSupported(venta?.pagos);
            const prepared = await prepareTpvSaleCatalog(venta?.lineas);
            const validated = validateSaleDraft({
                lineas: prepared.lineas,
                pagos: venta?.pagos,
                subtotalNeto: prepared.subtotalNeto,
                impuestosTotal: prepared.impuestosTotal,
                totalVenta: prepared.totalVenta,
            });

            const lineas = validated.lineas.map((line, index) => ({
                ...line,
                taxGroupId: prepared.lineas[index].taxGroupId,
                desgloseImpuestos: prepared.lineas[index].desgloseImpuestos,
            }));

            const saleReadinessBlockers = [
                "FISCAL_CONFIG_UNVERIFIED",
                "TPV_LEDGER_WRITER_NOT_CONFIGURED",
                "PAYMENT_NOT_VERIFIED",
                "CONSUMER_PRICE_PRESENTATION_UNVERIFIED",
                "INVENTORY_POLICY_NOT_CONFIGURED",
            ];
            if (FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED !== true) {
                saleReadinessBlockers.push("FISCAL_WRITER_DISABLED");
            }
            if (prepared.taxIncludedInPrice !== true) {
                saleReadinessBlockers.push("WIX_TAX_REGION_EXCLUDES_TAX");
            }

            return tpvOk({
                ...validated,
                lineas,
                catalogVerified: true,
                taxVerified: true,
                paymentVerified: false,
                inventoryVerified: false,
                consumerPricePresentationVerified: false,
                saleReady: saleReadinessBlockers.length === 0,
                saleReadinessBlockers,
                taxCalculation: {
                    currency: prepared.taxCurrency,
                    calculatorIds: prepared.taxCalculatorIds,
                    totalTax: prepared.taxSummary.totalTax,
                    totalTaxableAmount: prepared.taxSummary.totalTaxableAmount,
                    totalTaxIncludedInPrice: prepared.taxSummary.totalTaxIncludedInPrice,
                    taxIncludedInPrice: prepared.taxIncludedInPrice,
                },
                salePreparationVersion: "TPV_SALE_PREPARATION_V1",
                persisted: false,
            }, { traceId });
        } catch (error) {
            return preparationFailure(error, traceId);
        }
    }
);

export const registrarVenta = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-sale-write-block");
        await requireCajero(traceId);

        const sessionId = String(input?.sessionId || "").trim();
        const idempotencyKey = String(input?.idempotencyKey || "").trim();
        const lineas = Array.isArray(input?.lineas) ? input.lineas : [];
        const pagos = Array.isArray(input?.pagos) ? input.pagos : [];

        if (!input || typeof input !== "object" || Array.isArray(input) ||
            !sessionId || !UUID_V4.test(idempotencyKey) ||
            lineas.length === 0 || lineas.length > 100 || pagos.length > 100 ||
            lineas.some((line) =>
                !line || typeof line !== "object" ||
                !["PRODUCTO", "SERVICIO"].includes(String(line.tipoLinea || "").trim().toUpperCase()) ||
                !GUID.test(String(line.itemId || "").trim()) ||
                !Number.isSafeInteger(Number(line.cantidad)) ||
                Number(line.cantidad) <= 0
            )) {
            return tpvError(
                "TPV_INVALID_INPUT",
                "La solicitud de venta no contiene una sesión, clave idempotente o líneas de catálogo válidas.",
                ["Envía sessionId, una clave UUID v4 y líneas de producto o servicio con identificadores Wix y cantidades enteras positivas."],
                { persisted: false, retryable: false, traceId }
            );
        }

        // The writer remains deliberately closed: the fiscal singleton is absent,
        // fiscal writes are disabled, and the MovimientosCaja hook rejects TPV_*.
        // Recompute catalog/tax values inside the eventual writer before any commit.
        return tpvError(
            "TPV_OPERATIONAL_LEDGER_NOT_CONFIGURED",
            "La venta no se ha registrado: el writer fiscal y el ledger operativo TPV continúan deshabilitados.",
            [
                "No se ha creado ningún pedido, asiento ni movimiento de caja; tampoco se ha confirmado ningún pago.",
                "La validación de catálogo e impuestos está disponible en SALE_VALIDATE, pero no equivale a registrar una venta.",
                "Habilitar la escritura solo después de completar el singleton fiscal, el contrato append-only y la idempotencia durable en MovimientosCaja.",
            ],
            {
                persisted: false,
                retryable: false,
                requiresReconciliation: false,
                traceId,
            }
        );
    }
);
