import { Permissions, webMethod } from "wix-web-module";
import { requireAdmin } from "backend/security";
import { makeTraceId } from "public/mmUtils";

function disabledResult(code, traceId) {
    return {
        status: "ERROR",
        data: null,
        error: {
            code,
            message: "No se ha configurado un proveedor nativo de pagos. No se ha registrado ni confirmado ninguna devolución.",
        },
        persisted: false,
        recoverable: false,
        traceId,
    };
}

export const registrarDevolucion = webMethod(
    Permissions.SiteMember,
    async () => {
        const traceId = makeTraceId("tpv-refund-write-block");
        await requireAdmin(traceId);
        return disabledResult("TPV_REFUND_PROVIDER_NOT_CONFIGURED", traceId);
    }
);
