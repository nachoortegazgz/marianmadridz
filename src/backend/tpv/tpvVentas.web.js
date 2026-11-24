import { Permissions, webMethod } from "wix-web-module";
import { requireAdmin, requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { validateSaleDraft } from "backend/tpv/tpvValidation";

function disabledResult(code) {
    return {
        status: "ERROR",
        data: null,
        error: { code, message: "La escritura en el circuito operativo/fiscal permanece bloqueada." },
        persisted: false,
    };
}

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
    async () => {
        const traceId = makeTraceId("tpv-sale-write-block");
        await requireAdmin(traceId);
        return {
            ...disabledResult("TPV_PAYMENT_PROVIDER_NOT_CONFIGURED"),
            traceId,
        };
    }
);

export const procesarDevolucion = webMethod(
    Permissions.SiteMember,
    async () => {
        await requireCajero(makeTraceId("tpv-refund-write-block"));
        return disabledResult("TPV_OPERATIONAL_REFUNDS_DISABLED");
    }
);
