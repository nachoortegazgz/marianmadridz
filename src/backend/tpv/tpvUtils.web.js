import { Permissions, webMethod } from "wix-web-module";
import { requireCajero } from "backend/security";
import { TPV_SANDBOX_RUNTIME_POLICY } from "backend/internalConfig";
import { makeTraceId } from "public/mmUtils";
import { assertTpvSandboxEnabled } from "backend/tpv/tpvUtils";

export const obtenerConfiguracionTPV = webMethod(
    Permissions.SiteMember,
    async () => {
        const traceId = makeTraceId("tpv-sandbox-config");
        await requireCajero(traceId);
        assertTpvSandboxEnabled();
        return {
            status: "SUCCESS",
            data: {
                environment: TPV_SANDBOX_RUNTIME_POLICY.ENVIRONMENT,
                currency: TPV_SANDBOX_RUNTIME_POLICY.CURRENCY_CODE,
                timeZone: TPV_SANDBOX_RUNTIME_POLICY.TIME_ZONE,
                syntheticOnly: TPV_SANDBOX_RUNTIME_POLICY.SYNTHETIC_ONLY,
                realPaymentsEnabled: TPV_SANDBOX_RUNTIME_POLICY.REAL_PAYMENTS_ENABLED,
                fiscalWritesEnabled: TPV_SANDBOX_RUNTIME_POLICY.FISCAL_WRITES_ENABLED,
                notificationsEnabled: TPV_SANDBOX_RUNTIME_POLICY.CUSTOMER_NOTIFICATIONS_ENABLED,
                hardwareEnabled: TPV_SANDBOX_RUNTIME_POLICY.HARDWARE_ENABLED,
            },
            error: null,
        };
    }
);
