import { Permissions, webMethod } from "wix-web-module";
import { getMyStaffContext, requireAdmin, requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { assertTpvQaEnabled } from "backend/tpv/tpvUtils";

export const obtenerPermisosTPVQA = webMethod(
    Permissions.SiteMember,
    async () => {
        assertTpvQaEnabled();
        const traceId = makeTraceId("tpv-qa-permissions");
        await requireCajero(traceId);
        const staff = await getMyStaffContext(traceId);
        const isAdmin = staff?.rolWebsite === "ADMIN";
        return {
            status: "SUCCESS",
            data: {
                environment: "TEST",
                role: staff?.rolWebsite || "UNKNOWN",
                capabilities: {
                    read: true,
                    createSyntheticSale: true,
                    openQaSession: true,
                    registerCashMovement: true,
                    requestRefund: isAdmin,
                    closeQaSession: isAdmin,
                    issueTicketX: true,
                    issueTicketZ: isAdmin,
                    realPayments: false,
                    fiscalWrites: false,
                    customerNotifications: false,
                    physicalHardware: false,
                },
            },
            error: null,
            traceId,
        };
    }
);
