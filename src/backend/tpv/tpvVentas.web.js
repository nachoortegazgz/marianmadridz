import { Permissions, webMethod } from "wix-web-module";
import { requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { validateSaleDraft } from "backend/tpv/tpvValidation";
import { error as tpvError } from "backend/tpv/tpvEnvelope";

export const validarVentaBorrador = webMethod(
    Permissions.SiteMember,
    async (venta) => {
        await requireCajero(makeTraceId("tpv-sale-validate"));
        try {
            return { status: "SUCCESS", data: validateSaleDraft(venta), error: null };
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
        if (!input || typeof input !== "object" || Array.isArray(input)) {
            return tpvError(
                "TPV_INVALID_INPUT",
                "La solicitud de venta no tiene un formato válido.",
                ["Envía un objeto con la sesión, la clave idempotente y las líneas de producto."],
                { persisted: false, retryable: false, traceId }
            );
        }

        // TODO(#416): complete idempotency, Catalog V3 pricing, tax calculation and Draft Orders after CMS persistence/audit contracts exist.
        return tpvError(
            "TPV_TRANSACTION_COLLECTION_UNAVAILABLE",
            "No se puede registrar la venta porque falta su colección CMS transaccional.",
            [
                "Crear y aprobar el esquema de TransaccionesTPV con _id idempotente y permisos backend-only.",
                "Definir un writer/auditoría append-only compatible con la política TPV vigente.",
                "Resolver la tasa fiscal regional desde la configuración Wix antes de crear pedidos DRAFT.",
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
