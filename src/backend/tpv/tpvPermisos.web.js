import { Permissions, webMethod } from "wix-web-module";
import { getMyCajeroContext } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { TPV_RUNTIME_POLICY } from "backend/internalConfig";

export const obtenerPermisosTPV = webMethod(
    Permissions.SiteMember,
    async () => {
        const traceId = makeTraceId("tpv-permissions");
        const staff = await getMyCajeroContext(traceId);

        // Capability flags describe implemented non-fiscal writers only;
        // refund and fiscal-close capabilities remain disabled independently.
        return {
            status: "SUCCESS",
            data: {
                role: staff.rolWebsite || "UNKNOWN",
                capabilities: {
                    read: true,
                    createSale: true,
                    openSession: staff.rolWebsite === "ADMIN",
                    registerCashMovement: staff.rolWebsite === "ADMIN",
                    registerPartialCount: staff.rolWebsite === "ADMIN",
                    requestRefund: false,
                    closeSession: staff.rolWebsite === "ADMIN",
                    issueTicketX: staff.rolWebsite === "ADMIN",
                    issueTicketZ: false,
                    exportMovements: staff.rolWebsite === "ADMIN",
                    exportAudit: false,
                    customerNotifications: TPV_RUNTIME_POLICY.CUSTOMER_NOTIFICATIONS_ENABLED,
                    physicalHardware: TPV_RUNTIME_POLICY.HARDWARE_ENABLED,
                },
                operationalWritesAvailable: true,
                operationalWritesUnavailableReason: null,
            },
            error: null,
            traceId,
        };
    }
);
