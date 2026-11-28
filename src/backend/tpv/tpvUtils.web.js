import { Permissions, webMethod } from "wix-web-module";
import { requireTpvOperator } from "backend/security";
import { makeTraceId } from "public/mmUtils";

export const obtenerConfiguracionTPV = webMethod(
    Permissions.SiteMember,
    async () => {
        const traceId = makeTraceId("tpv-config");
        await requireTpvOperator(traceId);
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
