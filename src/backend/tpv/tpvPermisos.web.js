import { Permissions, webMethod } from "wix-web-module";
import { getMyStaffContext, requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { TPV_QA_RUNTIME_POLICY } from "backend/internalConfig";
import { assertTpvQaEnabled } from "backend/tpv/tpvUtils";

export const obtenerPermisosTPV = webMethod(
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
                environment: TPV_QA_RUNTIME_POLICY.ENVIRONMENT,
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
                    realPayments: TPV_QA_RUNTIME_POLICY.REAL_PAYMENTS_ENABLED,
                    fiscalWrites: TPV_QA_RUNTIME_POLICY.FISCAL_WRITES_ENABLED,
                    customerNotifications: TPV_QA_RUNTIME_POLICY.CUSTOMER_NOTIFICATIONS_ENABLED,
                    physicalHardware: TPV_QA_RUNTIME_POLICY.HARDWARE_ENABLED,
                },
            },
            error: null,
            traceId,
        };
    }
);
