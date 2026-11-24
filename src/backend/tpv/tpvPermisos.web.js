import { Permissions, webMethod } from "wix-web-module";
import { getMyStaffContext, requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";

export const obtenerPermisosTPV = webMethod(
    Permissions.SiteMember,
    async () => {

        const traceId = makeTraceId("tpv-sandbox-permissions");
        await requireCajero(traceId);
        const staff = await getMyStaffContext(traceId);
        const isAdmin = staff?.rolWebsite === "ADMIN";
        return {
            status: "SUCCESS",
            data: {
                role: staff?.rolWebsite || "UNKNOWN",
                capabilities: {
                    read: true,
                    createSale: false,
                    openSession: isAdmin,
                    registerCashMovement: isAdmin,
                    requestRefund: false,
                    closeSession: isAdmin,
                    issueTicketX: isAdmin,
                    issueTicketZ: isAdmin,
                    customerNotifications: TPV_RUNTIME_POLICY.CUSTOMER_NOTIFICATIONS_ENABLED,
                    physicalHardware: TPV_RUNTIME_POLICY.HARDWARE_ENABLED,
                },
            },
            error: null,
            traceId,
        };
    }
);
