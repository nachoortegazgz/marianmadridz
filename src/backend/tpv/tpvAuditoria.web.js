import { Permissions, webMethod } from "wix-web-module";
import { requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { TPV_SANDBOX_COLLECTIONS } from "backend/internalConfig";
import { querySandboxRecords } from "backend/tpv/tpvSandboxRepository";
import { wql } from "backend/dataAccess";

export const obtenerMovimientosCaja = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-sandbox-audit-read");
        await requireCajero(traceId);

        try {
            const limit = Math.min(100, Math.max(1, Math.floor(Number(input.limit || 50))));
            const records = await querySandboxRecords(
                TPV_SANDBOX_COLLECTIONS.AUDITORIA,
                input.entityId ? wql.eq("entityId", String(input.entityId).slice(0, 120)) : undefined,
                { sort: ["occurredAt DESC"], limit, allowTruncated: true }
            );
            return {
                status: "SUCCESS",
                data: records.map((record) => ({
                    id: record._id,
                    action: record.action,
                    actorId: record.actorId,
                    entityType: record.entityType,
                    entityId: record.entityId,
                    occurredAt: record.occurredAt,
                    source: record.source,
                    isSynthetic: record.payload?.isSynthetic === true,
                })),
                error: null,
                traceId,
            };
        } catch (error) {
            return { status: "ERROR", data: null, error: { code: String(error?.message || "TPV_SANDBOX_AUDIT_READ_FAILED") }, traceId };
        }
    }
);
