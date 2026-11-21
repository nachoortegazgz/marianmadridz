import { Permissions, webMethod } from "wix-web-module";
import { requireAdmin, requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { TPV_SANDBOX_COLLECTIONS, TPV_SANDBOX_RUNTIME_POLICY } from "backend/internalConfig";
import { insertSandboxEvent, latestOpenSandboxSession, querySandboxRecords, withSandboxSessionLock } from "backend/tpv/tpvSandboxRepository";
import { assertTpvSandboxEnabled, fromMinorUnits, normalizeClientIdempotencyKey, toMinorUnits } from "backend/tpv/tpvUtils";
import { wql } from "backend/dataAccess";

export const registrarMovimientoCaja = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        let persisted = false;
        const traceId = makeTraceId("tpv-sandbox-cash-movement");
        await requireAdmin(traceId);
        assertTpvSandboxEnabled();
        try {
            const movementType = String(input.movementType || "").trim().toUpperCase();
            if (!["ENTRADA", "SALIDA", "RETIRADA"].includes(movementType)) throw new Error("TPV_SANDBOX_CASH_MOVEMENT_TYPE_INVALID");
            const session = await latestOpenSandboxSession();
            if (!session) throw new Error("TPV_SANDBOX_SESSION_NOT_OPEN");

            return await withSandboxSessionLock(session.sessionId, traceId, async () => {
                const activeSession = await latestOpenSandboxSession();
                if (!activeSession || activeSession.sessionId !== session.sessionId) {
                    throw new Error("TPV_SANDBOX_SESSION_CLOSED");
                }
            const amountMinor = toMinorUnits(input.amount, "CASH_MOVEMENT");
            if (amountMinor <= 0) throw new Error("TPV_SANDBOX_CASH_MOVEMENT_AMOUNT_INVALID");
            const reason = String(input.reason || "").trim();
            if (reason.length < 3 || reason.length > 500) throw new Error("TPV_SANDBOX_REASON_REQUIRED");
            const key = normalizeClientIdempotencyKey(input.idempotencyKey);
            const { item, replayed } = await insertSandboxEvent(TPV_SANDBOX_COLLECTIONS.MOVIMIENTOS_CAJA, key, {
                sessionId: session.sessionId,
                movementType,
                amountMinor,
                paymentMethod: "EFECTIVO",
                reason,
                status: "CONFIRMADO_SINTETICO",
                createdAt: new Date(),
                payload: {
                    actorId: TPV_SANDBOX_RUNTIME_POLICY.ACTOR_ID,
                    authorizedBy: movementType === "ENTRADA" ? null : TPV_SANDBOX_RUNTIME_POLICY.ACTOR_ID,
                    affectsPhysicalCash: true,
                    traceId,
                },
            });
            persisted = true;
            await insertSandboxEvent(TPV_SANDBOX_COLLECTIONS.AUDITORIA, key + ":AUDIT", {
                action: "MOVIMIENTO_CAJA_" + movementType,
                actorId: TPV_SANDBOX_RUNTIME_POLICY.ACTOR_ID,
                entityType: "MOVIMIENTO_CAJA",
                entityId: item._id || key,
                occurredAt: new Date(),
                source: "TPV_SANDBOX_WEB_METHOD",
                payload: { amountMinor, reason, traceId },
            });
            return { status: "SUCCESS", data: { movementId: item._id, movementType, amount: fromMinorUnits(amountMinor), replayed, persisted: true, isSynthetic: true, realPayment: false }, error: null, traceId };
            });
        } catch (error) {
            return { status: "ERROR", data: null, error: { code: String(error?.message || "TPV_SANDBOX_CASH_MOVEMENT_FAILED") }, persisted, recoverable: persisted, isSynthetic: true, realPayment: false, traceId };
        }
    }
);


export const obtenerMovimientosCaja = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-sandbox-cash-movements-read");
        await requireCajero(traceId);
        assertTpvSandboxEnabled();
        try {
            const limit = Math.min(100, Math.max(1, Math.floor(Number(input.limit || 50))));
            const sessionId = String(input.sessionId || "").trim();
            const records = await querySandboxRecords(
                TPV_SANDBOX_COLLECTIONS.MOVIMIENTOS_CAJA,
                sessionId ? wql.eq("sessionId", sessionId) : undefined,
                { sort: ["createdAt DESC"], limit, allowTruncated: true }
            );
            return {
                status: "SUCCESS",
                data: {
                    items: records.map((record) => ({
                        movementId: record._id,
                        sessionId: record.sessionId || null,
                        movementType: record.movementType || null,
                        amount: fromMinorUnits(Number(record.amountMinor || 0)),
                        paymentMethod: record.paymentMethod || null,
                        reason: record.reason || "",
                        status: record.status || null,
                        createdAt: record.createdAt || record.generatedAt || null,
                        isSynthetic: true,
                        persisted: true,
                    })),
                    syntheticOnly: true,
                },
                error: null,
                traceId,
            };
        } catch (error) {
            return {
                status: "ERROR",
                data: null,
                error: { code: String(error?.message || "TPV_SANDBOX_CASH_MOVEMENTS_READ_FAILED") },
                traceId,
            };
        }
    }
);
