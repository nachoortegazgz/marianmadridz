import { Permissions, webMethod } from "wix-web-module";
import { requireCajero } from "backend/security";
import { TPV_QA_RUNTIME_POLICY } from "backend/internalConfig";
import { makeTraceId } from "public/mmUtils";
import {
    assertTpvQaEnabled,
    normalizePaymentMethod,
    toMinorUnits,
} from "backend/tpv/tpvUtils";

export const obtenerConfiguracionTPV = webMethod(
    Permissions.SiteMember,
    async () => {
        const traceId = makeTraceId("tpv-qa-config");
        await requireCajero(traceId);
        assertTpvQaEnabled();
        return {
            status: "SUCCESS",
            data: {
                environment: TPV_QA_RUNTIME_POLICY.ENVIRONMENT,
                currency: TPV_QA_RUNTIME_POLICY.CURRENCY_CODE,
                timeZone: TPV_QA_RUNTIME_POLICY.TIME_ZONE,
                syntheticOnly: TPV_QA_RUNTIME_POLICY.SYNTHETIC_ONLY,
                realPaymentsEnabled: TPV_QA_RUNTIME_POLICY.REAL_PAYMENTS_ENABLED,
                fiscalWritesEnabled: TPV_QA_RUNTIME_POLICY.FISCAL_WRITES_ENABLED,
                notificationsEnabled: TPV_QA_RUNTIME_POLICY.CUSTOMER_NOTIFICATIONS_ENABLED,
                hardwareEnabled: TPV_QA_RUNTIME_POLICY.HARDWARE_ENABLED,
            },
            error: null,
        };
    }
);

export const validarImportesTPV = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-qa-amounts");
        await requireCajero(traceId);
        assertTpvQaEnabled();
        try {
            return {
                status: "SUCCESS",
                data: {
                    amountMinor: toMinorUnits(input.amount, "AMOUNT"),
                    paymentMethod: normalizePaymentMethod(input.paymentMethod),
                },
                error: null,
                traceId,
            };
        } catch (error) {
            return {
                status: "ERROR",
                data: null,
                error: { code: String(error?.message || "TPV_QA_VALIDATION_FAILED") },
                traceId,
            };
        }
    }
);
