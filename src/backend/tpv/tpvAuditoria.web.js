import { Permissions, webMethod } from "wix-web-module";
import { requireCajero } from "backend/security";
import { makeTraceId } from "public/mmUtils";
import { TPV_QA_COLLECTIONS } from "backend/internalConfig";
import { queryQaRecords } from "backend/tpv/tpvQaRepository";
import { assertTpvQaEnabled } from "backend/tpv/tpvUtils";
import { wql } from "backend/dataAccess";

export const consultarAuditoriaTPV = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const traceId = makeTraceId("tpv-qa-audit-read");
        await requireCajero(traceId);
        assertTpvQaEnabled();
        try {
            const limit = Math.min(100, Math.max(1, Math.floor(Number(input.limit || 50))));
            const records = await queryQaRecords(
                TPV_QA_COLLECTIONS.AUDITORIA,
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
            return { status: "ERROR", data: null, error: { code: String(error?.message || "TPV_QA_AUDIT_READ_FAILED") }, traceId };
        }
    }
);
