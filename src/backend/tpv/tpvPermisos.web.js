import { Permissions, webMethod } from "wix-web-module";
import { getMyStaffContext, requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { TPV_SANDBOX_RUNTIME_POLICY } from "backend/internalConfig";

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
                environment: TPV_SANDBOX_RUNTIME_POLICY.ENVIRONMENT,
                role: staff?.rolWebsite || "UNKNOWN",
                capabilities: {
                    read: true,
                    createSyntheticSale: isAdmin,
                    openSandboxSession: isAdmin,
                    registerCashMovement: isAdmin,
                    requestRefund: isAdmin,
                    closeSandboxSession: isAdmin,
                    issueTicketX: isAdmin,
                    issueTicketZ: isAdmin,
                    realPayments: TPV_SANDBOX_RUNTIME_POLICY.REAL_PAYMENTS_ENABLED,
                    fiscalWrites: TPV_SANDBOX_RUNTIME_POLICY.FISCAL_WRITES_ENABLED,
                    customerNotifications: TPV_SANDBOX_RUNTIME_POLICY.CUSTOMER_NOTIFICATIONS_ENABLED,
                    physicalHardware: TPV_SANDBOX_RUNTIME_POLICY.HARDWARE_ENABLED,
                },
            },
            error: null,
            traceId,
        };
    }
);
