import { Permissions, webMethod } from "wix-web-module";
import { requireAdmin } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { error as tpvError } from "backend/tpv/tpvEnvelope";

export const registrarDevolucion = webMethod(
    Permissions.SiteMember,
    async () => {
        const traceId = makeTraceId("tpv-refund-write-block");
        await requireAdmin(traceId);
        return tpvError(
            "TPV_REFUND_PROVIDER_NOT_CONFIGURED",
            "No se ha configurado el proveedor de pagos; no se ha registrado ninguna devolución.",
            [
                "Resolver Contract A y validar el proveedor de pagos autorizado.",
                "Mantener bloqueadas las devoluciones hasta completar la conciliación exigida.",
            ],
            {
                persisted: false,
                recoverable: false,
                retryable: false,
                requiresReconciliation: false,
                traceId,
            }
        );
    }
);
