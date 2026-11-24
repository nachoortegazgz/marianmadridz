import { Permissions, webMethod } from "wix-web-module";
import { requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";

/**
 * Real Wix Gift Cards are intentionally inaccessible in the synthetic SANDBOX
 * environment. No card code or balance is sent to Wix or persisted.
 */
export const consultarTarjetaRegalo = webMethod(
    Permissions.SiteMember,
    async () => {
        const traceId = makeTraceId("tpv-gift-card-block");
        await requireCajero(traceId);

        return {
            status: "ERROR",
            data: null,
            error: {
                code: "TPV_GIFT_CARDS_DISABLED_IN_SANDBOX",
                message: "La consulta de tarjetas regalo reales está deshabilitada en SANDBOX.",
            },
            readOnly: true,
            syntheticOnly: true,

            traceId,
        };
    }
);
