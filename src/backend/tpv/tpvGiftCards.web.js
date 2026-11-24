import { Permissions, webMethod } from "wix-web-module";
import { requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";

/**
 * Gift-card balance lookup remains unavailable until the native Wix contract
 * and its authorization/reconciliation path are integrated and verified.
 */
export const consultarTarjetaRegalo = webMethod(
    Permissions.SiteMember,
    async () => {
        const traceId = makeTraceId("tpv-gift-card-read");
        await requireCajero(traceId);

        return {
            status: "ERROR",
            data: null,
            error: {
                code: "TPV_GIFT_CARDS_NOT_CONFIGURED",
                message: "La consulta de tarjetas regalo no está configurada. No se ha consultado ni consumido ningún saldo.",
            },
            readOnly: true,
            traceId,
        };
    }
);
