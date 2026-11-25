import { Permissions, webMethod } from "wix-web-module";
import { requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { validateSaleDraft } from "backend/tpv/tpvValidation";
import { error as tpvError } from "backend/tpv/tpvEnvelope";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const validarVentaBorrador = webMethod(
    Permissions.SiteMember,
    async (venta) => {
        await requireCajero(makeTraceId("tpv-sale-validate"));
        try {
            return {
                status: "SUCCESS",
                data: {
                    ...validateSaleDraft(venta),
                    validationScope: "STRUCTURAL_ONLY",
                    catalogVerified: false,
                    fiscalVerified: false,
                    paymentVerified: false,
                },
                error: null,
            };
        } catch (error) {
            return {
                status: "ERROR",
                data: null,
                error: { code: "TPV_SALE_VALIDATION_FAILED", reasonCode: String(error?.message || "TPV_SALE_VALIDATION_FAILED"), message: "El borrador no supera las validaciones." },
            };
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

        if (!input || typeof input !== "object" || Array.isArray(input) ||
            !sessionId || !UUID_V4.test(idempotencyKey) || lineas.length === 0 ||
            lineas.length > 100 ||
            lineas.some((line) =>
                !line || typeof line !== "object" ||
                !String(line.productId || "").trim() ||
                !Number.isFinite(Number(line.cantidad)) ||
                Number(line.cantidad) <= 0
            )) {
            return tpvError(
                "TPV_INVALID_INPUT",
                "La solicitud de venta no contiene una sesión, clave o líneas de producto válidas.",
                ["Envía sessionId, una clave UUID v4 y al menos una línea con productId y cantidad positiva."],
                { persisted: false, retryable: false, traceId }
            );
        }

        // MovimientosCaja is the physical append-only ledger; TPV_LOGICAL_VENTAS maps to TPV_SALE/transactionId there.
        // TODO(#416): implement Catalog V3 pricing, regional tax resolution, Draft Orders and durable replay only after the existing ledger writer is explicitly enabled and audited.
        return tpvError(
            "TPV_OPERATIONAL_LEDGER_NOT_CONFIGURED",
            "La venta no se ha registrado: la escritura operativa del ledger TPV continúa deshabilitada.",
            [
                "No se ha creado ningún pedido DRAFT ni se ha confirmado ningún pago.",
                "El destino canónico es MovimientosCaja mediante el adaptador TPV existente; no crear TransaccionesTPV duplicada.",
                "Completar el contrato del writer append-only, la idempotencia durable y la resolución fiscal regional antes de habilitar pedidos.",
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
