import { Permissions, webMethod } from "wix-web-module";
import { requireCajero, requireAdmin } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { latestOpenQaSession } from "backend/tpv/tpvQaRepository";
import { buildQaSessionSummary } from "backend/tpv/tpvCierresCore";
import { assertTpvQaEnabled } from "backend/tpv/tpvUtils";

function disabledResult(code) {
    return {
        status: "ERROR",
        data: null,
        error: { code, message: "La generacion fiscal/operativa permanece deshabilitada." },
        persisted: false,
    };
}

export const obtenerResumenCaja = webMethod(
    Permissions.SiteMember,
    async () => {
        const traceId = makeTraceId("tpv-report-qa-read");
        await requireCajero(traceId);
        assertTpvQaEnabled();
        const session = await latestOpenQaSession();
        if (!session) return { status: "SUCCESS", data: null, error: null, traceId };
        return { status: "SUCCESS", data: await buildQaSessionSummary(session), error: null, traceId };
    }
);

export const previsualizarTicketX = webMethod(
    Permissions.SiteMember,
    async () => {
        const traceId = makeTraceId("tpv-ticket-x-preview");
        await requireCajero(traceId);
        assertTpvQaEnabled();
        const session = await latestOpenQaSession();
        if (!session) return { status: "ERROR", data: null, error: { code: "TPV_QA_SESSION_NOT_OPEN" }, traceId };
        const totals = await buildQaSessionSummary(session);
        return {
            status: "SUCCESS",
            data: { sessionId: session.sessionId, totals, ticketXGenerated: false, readOnly: true, isSynthetic: true },
            error: null,
            traceId,
        };
    }
);

export const cerrarTicketZ = webMethod(
    Permissions.SiteMember,
    async () => {
        await requireAdmin(makeTraceId("tpv-ticket-z-block"));
        return disabledResult("TPV_OPERATIONAL_Z_CLOSING_DISABLED");
    }
);
