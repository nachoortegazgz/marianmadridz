import { Permissions, webMethod } from "wix-web-module";
import { getMyCajeroContext } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { TPV_RUNTIME_POLICY } from "backend/internalConfig";

export const obtenerPermisosTPV = webMethod(
    Permissions.SiteMember,
    async () => {
        const traceId = makeTraceId("tpv-permissions");
        const staff = await getMyCajeroContext(traceId);

        // Capability flags describe the writers available to the authenticated operator.
        return {
            status: "SUCCESS",
            data: {
                role: staff.rolWebsite || "UNKNOWN",
                capabilities: {
                    read: true,
                    readCatalog: true,
                    searchCustomers: true,
                    readCashSummary: true,
                    readAudit: staff.rolWebsite !== "ESTILISTA",
                    createSale: true,
                    acceptPayment: true,
                    printReceipt: false,
                    openSession: true,
                    registerCashMovement: true,
                    registerPartialCount: staff.rolWebsite === "ADMIN",
                    requestRefund: false,
                    issueTicketX: staff.rolWebsite === "ADMIN",
                    issueTicketZ: staff.rolWebsite === "ADMIN",
                    exportMovements: staff.rolWebsite === "ADMIN",
                    exportAudit: staff.rolWebsite === "ADMIN",
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
