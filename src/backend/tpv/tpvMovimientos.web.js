import { Permissions, webMethod } from "wix-web-module";
import { getMyStaffContext, requireAdmin, requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { TPV_QA_COLLECTIONS } from "backend/internalConfig";
import { insertQaEvent, latestOpenQaSession } from "backend/tpv/tpvQaRepository";
import { assertTpvQaEnabled, fromMinorUnits, normalizeClientIdempotencyKey, toMinorUnits } from "backend/tpv/tpvUtils";

export const registrarMovimientoCaja = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-qa-cash-movement");
        await requireCajero(traceId);
        assertTpvQaEnabled();
        try {
            const movementType = String(input.movementType || "").trim().toUpperCase();
            if (!["ENTRADA", "SALIDA", "RETIRADA"].includes(movementType)) throw new Error("TPV_CASH_MOVEMENT_TYPE_INVALID");
            if (movementType !== "ENTRADA") await requireAdmin(traceId);
            const session = await latestOpenQaSession();
            if (!session) throw new Error("TPV_QA_SESSION_NOT_OPEN");
            const amountMinor = toMinorUnits(input.amount, "CASH_MOVEMENT");
            if (amountMinor <= 0) throw new Error("TPV_CASH_MOVEMENT_AMOUNT_INVALID");
            const reason = String(input.reason || "").trim();
            if (reason.length < 3 || reason.length > 500) throw new Error("TPV_QA_REASON_REQUIRED");
            const key = normalizeClientIdempotencyKey(input.idempotencyKey);
            const staff = await getMyStaffContext(traceId);
            const { item, replayed } = await insertQaEvent(TPV_QA_COLLECTIONS.MOVIMIENTOS_CAJA, key, {
                sessionId: session.sessionId,
                movementType,
                amountMinor,
                paymentMethod: "EFECTIVO",
                reason,
                status: "CONFIRMADO_SINTETICO",
                createdAt: new Date(),
                payload: {
                    actorId: staff?.memberId || "UNKNOWN",
                    authorizedBy: movementType === "ENTRADA" ? null : staff?.memberId || null,
                    affectsPhysicalCash: true,
                    traceId,
                },
            });
            await insertQaEvent(TPV_QA_COLLECTIONS.AUDITORIA, key + ":AUDIT", {
                action: "MOVIMIENTO_CAJA_" + movementType,
                actorId: staff?.memberId || "UNKNOWN",
                entityType: "MOVIMIENTO_CAJA",
                entityId: item._id || key,
                occurredAt: new Date(),
                source: "TPV_QA_WEB_METHOD",
                payload: { amountMinor, reason, traceId },
            });
            return { status: "SUCCESS", data: { movementId: item._id, movementType, amount: fromMinorUnits(amountMinor), replayed, persisted: true, isSynthetic: true, realPayment: false }, error: null, traceId };
        } catch (error) {
            return { status: "ERROR", data: null, error: { code: String(error?.message || "TPV_CASH_MOVEMENT_FAILED") }, traceId };
        }
    }
);
