import { Permissions, webMethod } from "wix-web-module";
import { getMyStaffContext, requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { TPV_RUNTIME_POLICY } from "backend/internalConfig";

export const obtenerPermisosTPV = webMethod(
    Permissions.SiteMember,
    async () => {

        const traceId = makeTraceId("tpv-permissions");
        await requireCajero(traceId);
        const staff = await getMyStaffContext(traceId);
        const testRuntimeAvailable = staff?.rolWebsite === "ADMIN";
        return {
            status: "SUCCESS",
            data: {
                role: staff?.rolWebsite || "UNKNOWN",
                capabilities: {
                    read: true,
                    createSale: testRuntimeAvailable,
                    openSession: testRuntimeAvailable,
                    registerCashMovement: testRuntimeAvailable,
                    registerPartialCount: testRuntimeAvailable,
                    requestRefund: testRuntimeAvailable,
                    closeSession: testRuntimeAvailable,
                    issueTicketX: testRuntimeAvailable,
                    issueTicketZ: testRuntimeAvailable,
                    exportMovements: testRuntimeAvailable,
                    exportAudit: testRuntimeAvailable,
                    customerNotifications: TPV_RUNTIME_POLICY.CUSTOMER_NOTIFICATIONS_ENABLED,
                    physicalHardware: TPV_RUNTIME_POLICY.HARDWARE_ENABLED,
                },
                operationalWritesAvailable: false,
                operationalWritesUnavailableReason: "TPV_OPERATIONAL_LEDGER_NOT_CONFIGURED",
                testRuntimeAvailable,
                testRuntimeMode: testRuntimeAvailable ? "SYNTHETIC_INTERNAL" : "UNAVAILABLE",
            },
            error: null,
            traceId,
        };
    }
);
