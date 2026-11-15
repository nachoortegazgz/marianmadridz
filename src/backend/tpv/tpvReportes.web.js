import { Permissions, webMethod } from "wix-web-module";
import { getCashierState } from "backend/cajas.web.js";
import { requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";

function disabledResult(code) {
    return {
        status: "ERROR",
        data: null,
        error: {
            code,
            message: "La generacion y el cierre de informes TPV no estan habilitados.",
        },
        persisted: false,
    };
}

export const obtenerResumenCaja = webMethod(
    Permissions.SiteMember,
    async () => getCashierState({ traceId: makeTraceId("tpv-report-read") })
);

export const previsualizarTicketX = webMethod(
    Permissions.SiteMember,
    async () => {
        const source = await getCashierState({ traceId: makeTraceId("tpv-ticket-x-preview") });
        if (source?.status !== "SUCCESS") return source;
        return {
            status: "PARTIAL",
            data: {
                sourceSnapshot: source.data,
                ticketXGenerated: false,
                readOnly: true,
            },
            error: {
                code: "TPV_X_AGGREGATION_CONTRACT_PENDING",
                message: "Falta cerrar el contrato de agregacion completo del informe X.",
            },
        };
    }
);

export const cerrarTicketZ = webMethod(
    Permissions.SiteMember,
    async () => {
        await requireCajero(makeTraceId("tpv-ticket-z-block"));
        return disabledResult("TPV_Z_CLOSING_DISABLED");
    }
);
