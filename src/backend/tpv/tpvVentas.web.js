import { Permissions, webMethod } from "wix-web-module";
import { requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { validateSaleDraft } from "backend/tpv/tpvValidation";

function disabledResult(code) {
    return {
        status: "ERROR",
        data: null,
        error: {
            code,
            message: "La persistencia de ventas y los efectos de pago siguen bloqueados.",
        },
        persisted: false,
        realPayment: false,
    };
}

export const validarVentaBorrador = webMethod(
    Permissions.SiteMember,
    async (venta) => {
        await requireCajero(makeTraceId("tpv-sale-validate"));
        try {
            return {
                status: "SUCCESS",
                data: validateSaleDraft(venta),
                error: null,
            };
        } catch (error) {
            return {
                status: "ERROR",
                data: null,
                error: {
                    code: String(error?.message || "TPV_SALE_VALIDATION_FAILED"),
                    message: "El borrador de venta no supera las validaciones.",
                },
            };
        }
    }
);

export const registrarVenta = webMethod(
    Permissions.SiteMember,
    async () => {
        await requireCajero(makeTraceId("tpv-sale-write-block"));
        return disabledResult("TPV_SALE_WRITES_DISABLED");
    }
);

export const procesarDevolucion = webMethod(
    Permissions.SiteMember,
    async () => {
        await requireCajero(makeTraceId("tpv-refund-write-block"));
        return disabledResult("TPV_REFUNDS_DISABLED");
    }
);
