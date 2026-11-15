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
            message: "La operacion de caja no esta habilitada en esta entrega.",
        },
        persisted: false,
        realOperation: false,
    };
}

export const obtenerCajaActual = webMethod(
    Permissions.SiteMember,
    async () => getCashierState({ traceId: makeTraceId("tpv-cash-read") })
);

export const registrarMovimientoCaja = webMethod(
    Permissions.SiteMember,
    async () => {
        await requireCajero(makeTraceId("tpv-cash-write-block"));
        return disabledResult("TPV_CASH_MOVEMENT_WRITES_DISABLED");
    }
);

export const abrirCaja = webMethod(
    Permissions.SiteMember,
    async () => {
        await requireCajero(makeTraceId("tpv-cash-open-block"));
        return disabledResult("TPV_CASH_SESSION_OPEN_DISABLED");
    }
);

export const realizarArqueoParcial = webMethod(
    Permissions.SiteMember,
    async () => {
        await requireCajero(makeTraceId("tpv-cash-count-block"));
        return disabledResult("TPV_PARTIAL_COUNT_DISABLED");
    }
);
