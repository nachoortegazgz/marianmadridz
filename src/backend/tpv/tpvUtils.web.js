import { Permissions, webMethod } from "wix-web-module";
import { requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";

export const obtenerConfiguracionTPV = webMethod(
    Permissions.SiteMember,
    async () => {
        const traceId = makeTraceId("tpv-config");
        await requireCajero(traceId);
        return {
            status: "SUCCESS",
            data: {
                currency: "EUR",
                timeZone: "Europe/Madrid",
            },
            error: null,
        };
    }
);
