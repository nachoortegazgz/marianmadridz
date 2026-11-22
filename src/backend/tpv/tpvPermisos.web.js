import { Permissions, webMethod } from "wix-web-module";
import { getMyStaffContext, requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { TPV_RUNTIME_POLICY } from "backend/internalConfig";

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
                    createSale: isAdmin,
                    openSession: isAdmin,
                    registerCashMovement: isAdmin,
                    requestRefund: isAdmin,
                    closeSession: isAdmin,
                    issueTicketX: isAdmin,
                    issueTicketZ: isAdmin,
                    realPayments: TPV_RUNTIME_POLICY.ALLOW_REAL_PAYMENTS,
                    fiscalWrites: TPV_RUNTIME_POLICY.ALLOW_NATIVE_WRITES,
                    customerNotifications: TPV_RUNTIME_POLICY.CUSTOMER_NOTIFICATIONS_ENABLED,
                    physicalHardware: TPV_RUNTIME_POLICY.HARDWARE_ENABLED,
                },
            },
            error: null,
            traceId,
        };
    }
);
