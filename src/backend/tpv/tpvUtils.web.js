import { Permissions, webMethod } from "wix-web-module";
import { requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import {
    assertTpvQaEnabled,
    normalizePaymentMethod,
    toMinorUnits,
} from "backend/tpv/tpvUtils";

export const obtenerConfiguracionTPVQA = webMethod(
    Permissions.SiteMember,
    async () => {
        const traceId = makeTraceId("tpv-qa-config");
        await requireCajero(traceId);
        assertTpvQaEnabled();
        return {
            status: "SUCCESS",
            data: {
                environment: "TEST",
                currency: "EUR",
                timeZone: "Europe/Madrid",
                syntheticOnly: true,
                realPaymentsEnabled: false,
                fiscalWritesEnabled: false,
                notificationsEnabled: false,
                hardwareEnabled: false,
            },
            error: null,
        };
    }
);

export const validarImportesTPVQA = webMethod(
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
