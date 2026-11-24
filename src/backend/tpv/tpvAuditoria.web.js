import { Permissions, webMethod } from "wix-web-module";
import { requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { TPV_COLLECTIONS, TPV_RUNTIME_POLICY } from "backend/internalConfig";
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
            if (!sessionId || sessionId.length > 128 || entityId.length > 120) {
                throw new Error("TPV_SESSION_REQUIRED");
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
                    const belongsToSession = recordSessionId
                        ? recordSessionId === sessionId
                        : String(record.entityId || "") === sessionId;
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
                }));

            return {
                status: "SUCCESS",
                data: {
                    items,
                    count: items.length,
                    sessionId,
                    integrationStatus: "NO_ENVIADO",
                    paymentStatus: "NOT_APPLICABLE",
                    now: new Date().toISOString(),
                    timeZone: TPV_RUNTIME_POLICY.TIME_ZONE,
                },
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
