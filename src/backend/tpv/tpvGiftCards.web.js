import { Permissions, webMethod } from "wix-web-module";
import { requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";

/**
 * Real Wix Gift Cards lookup remains disabled in synthetic QA.
 * No gift card code is sent to Wix, stored, or logged by this module.
 * Enable only after the official @wix/gift-vouchers SDK and role scopes
 * have been installed and reviewed for the deployment environment.
 */
export const consultarTarjetaRegalo = webMethod(
    Permissions.SiteMember,
    async () => {
        await requireCajero(makeTraceId("tpv-gift-card-read"));
        return {
            status: "DISABLED",
            data: null,
            error: { code: "TPV_GIFT_CARD_LOOKUP_DISABLED_IN_QA" },
            isSynthetic: true,
            realPayment: false,
        };
    }
);
