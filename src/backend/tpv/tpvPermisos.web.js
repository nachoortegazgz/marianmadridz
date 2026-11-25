import { Permissions, webMethod } from "wix-web-module";
import { getMyCajeroContext } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { TPV_RUNTIME_POLICY } from "backend/internalConfig";

export const obtenerPermisosTPV = webMethod(
    Permissions.SiteMember,
    async () => {
        const traceId = makeTraceId("tpv-permissions");
        const staff = await getMyCajeroContext(traceId);

        // A staff role is not proof that the operational ledger and payment
        // contracts are ready. Until all release gates pass, expose read-only.
        return {
            status: "SUCCESS",
            data: {
                role: staff.rolWebsite || "UNKNOWN",
                capabilities: {
                    read: true,
                    createSale: true,
                    openSession: staff.rolWebsite === "ADMIN",
                    registerCashMovement: false,
                    registerPartialCount: false,
                    requestRefund: false,
                    closeSession: false,
                    issueTicketX: false,
                    issueTicketZ: false,
                    exportMovements: false,
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
