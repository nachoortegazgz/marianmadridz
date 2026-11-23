import { Permissions, webMethod } from "wix-web-module";
import { requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { TPV_COLLECTIONS } from "backend/internalConfig";
import { queryTpvRecords } from "backend/tpv/tpvRepository";

export const obtenerAuditoriaTPV = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-audit-read");
        await requireCajero(traceId);

        try {
            const limit = Number(input.limit ?? 50);
            if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
                throw new Error("TPV_INVALID_AUDIT_LIMIT");
            }

            const sessionId = String(input.sessionId || "").trim();
            const entityId = String(input.entityId || "").trim();
            if (sessionId.length > 128 || entityId.length > 120) {
                throw new Error("TPV_AUDIT_FILTER_INVALID");
            }

            const records = await queryTpvRecords(
                TPV_COLLECTIONS.AUDITORIA,
                undefined,
                { limit: 1000, maxRecords: 10000 }
            );

            const items = records
                .filter((record) => {
                    const recordSessionId = String(
                        record.payload?.sessionId || record.sessionId || ""
                    ).trim();
                    const belongsToSession = !sessionId ||
                        recordSessionId === sessionId ||
                        String(record.entityId || "") === sessionId;
                    const matchesEntity = !entityId ||
                        String(record.entityId || "") === entityId;
                    return belongsToSession && matchesEntity;
                })
                .sort((left, right) =>
                    new Date(right.occurredAt || 0).getTime() -
                    new Date(left.occurredAt || 0).getTime()
                )
                .slice(0, limit)
                .map((record) => ({
                    id: record._id,
                    action: record.action || "UNKNOWN",
                    actorId: record.actorId || null,
                    sessionId: String(record.payload?.sessionId || record.sessionId || "") ||
                        (String(record.entityId || "") === sessionId ? sessionId : null),
                    entityType: record.entityType || null,
                    entityId: record.entityId || null,
                    occurredAt: record.occurredAt || record.createdAt || null,
                    source: record.source || null,
                    traceId: record.payload?.traceId || null,
                    isSynthetic: true,
                    realPayment: false,
                }));

            return {
                status: "SUCCESS",
                data: { items, count: items.length, sessionId: sessionId || null },
                error: null,
                traceId,
            };
        } catch (error) {
            return {
                status: "ERROR",
                data: null,
                error: { code: String(error?.message || "TPV_AUDIT_READ_FAILED") },
                traceId,
            };
        }
    }
);
