import { Permissions, webMethod } from "wix-web-module";
import { giftVouchers } from "@wix/ecom";
import { requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";

/**
 * Read-only balance/status lookup for Wix-managed Gift Cards.
 * The card code is never logged, stored, or returned in clear text.
 */
export const consultarTarjetaRegalo = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        await requireCajero(makeTraceId("tpv-gift-card-read"));
        const code = String(input.code || "").trim();
        if (!/^[A-Za-z0-9-]{8,20}$/.test(code)) {
            return {
                status: "ERROR",
                data: null,
                error: { code: "TPV_GIFT_CARD_CODE_INVALID" },
            };
        }

        try {
            const response = await giftVouchers.getGiftCard(code);
            const card = response?.giftCard;
            if (!card) {
                return {
                    status: "ERROR",
                    data: null,
                    error: { code: "TPV_GIFT_CARD_NOT_FOUND" },
                };
            }

            return {
                status: "SUCCESS",
                data: {
                    obfuscatedCode: String(card.obfuscatedCode || ""),
                    balance: card.balance?.value ?? null,
                    currency: card.balance?.currency || null,
                    status: String(card.status || "UNKNOWN"),
                },
                error: null,
            };
        } catch (_) {
            return {
                status: "ERROR",
                data: null,
                error: { code: "TPV_GIFT_CARD_LOOKUP_FAILED" },
            };
        }
    }
);
