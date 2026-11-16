import { Permissions, webMethod } from "wix-web-module";
import { auth } from "@wix/essentials";
import { giftVouchers } from "@wix/ecom";
import { requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";

const getGiftCardElevated = auth.elevate(giftVouchers.getGiftCard);

/**
 * Read-only lookup against Wix eCommerce Gift Cards.
 * The raw code is sent only to the native Wix method and is never persisted,
 * returned, or logged. Redemption and balance mutations remain disabled.
 */
export const consultarTarjetaRegalo = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-gift-card-read");
        await requireCajero(traceId);
        const code = String(input.code || "").trim();
        if (!/^[A-Za-z0-9-]{8,20}$/.test(code)) {
            return { status: "ERROR", data: null, error: { code: "TPV_GIFT_CARD_CODE_INVALID" }, readOnly: true, realPayment: false, traceId };
        }
        try {
            const response = await getGiftCardElevated(code, {});
            const card = response?.giftCard;
            if (!card) throw new Error("TPV_GIFT_CARD_NOT_FOUND");
            const balance = Number(card.balance?.value);
            if (!Number.isFinite(balance) || balance < 0) throw new Error("TPV_GIFT_CARD_BALANCE_INVALID");
            return {
                status: "SUCCESS",
                data: {
                    obfuscatedCode: String(card.obfuscatedCode || "••••"),
                    balance,
                    currency: String(card.balance?.currency || "EUR"),
                    status: String(card.status || "UNKNOWN"),
                },
                error: null,
                readOnly: true,
                realPayment: false,
                traceId,
            };
        } catch (error) {
            const resultCode = String(error?.message || "").includes("NOT_FOUND")
                ? "TPV_GIFT_CARD_NOT_FOUND"
                : "TPV_GIFT_CARD_LOOKUP_FAILED";
            return { status: "ERROR", data: null, error: { code: resultCode }, readOnly: true, realPayment: false, traceId };
        }
    }
);
