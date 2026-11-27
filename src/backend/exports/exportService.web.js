import { webMethod, Permissions } from "wix-web-module";

import { requireAdmin, rateLimiter } from "backend/security";
import {
    getQuarterlyTaxSummaryInternal,
    getLibroRegistroFacturasExpedidasInternal,
} from "backend/fiscalAggregator.web";
import { buildQuarterlyRegistryPackage } from "backend/exports/exportContract";
import { makeTraceId } from "public/mmUtils";
import { _toPublicError } from "backend/responseUtils";

function errorResult(code, traceId, message) {
    return {
        status: "ERROR",
        data: null,
        error: { code, message, traceId },
    };
}

/**
 * Admin-only, read-only Capa 3 export preparation.
 * This method creates an in-memory package only. No CMS writes, network
 * delivery, email, SharePoint upload, or callbacks to Capa 1 are performed.
 */
export const prepareExternalRegistryPackage = webMethod(
    Permissions.Admin,
    async (period = {}) => {
        const traceId = makeTraceId("c3-export");
        try {
            await requireAdmin(traceId);
            const rate = await rateLimiter({
                surface: "capa3.prepareExternalRegistryPackage",
                key: "admin",
            });
            if (!rate?.allowed) {
                return errorResult("C3_EXPORT_RATE_LIMITED", traceId, "Export preparation rate limit reached.");
            }

            const year = Number(period.year);
            const quarter = Number(period.quarter);
            if (!Number.isInteger(year) || year < 2000 || year > 2100 ||
                !Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
                return errorResult("C3_EXPORT_PERIOD_INVALID", traceId, "A valid year and quarter (1-4) are required.");
            }

            const [summaryResult, bookResult] = await Promise.all([
                getQuarterlyTaxSummaryInternal(year, quarter, { traceId }),
                getLibroRegistroFacturasExpedidasInternal(year, quarter, { traceId }),
            ]);

            if (summaryResult?.status !== "SUCCESS" || bookResult?.status !== "SUCCESS" ||
                !summaryResult.data || !Array.isArray(bookResult.data?.filas) ||
                summaryResult.data.reachedMaxPages === true ||
                bookResult.data.reachedMaxPages === true) {
                return errorResult(
                    "C3_EXPORT_SOURCE_DATA_INCOMPLETE",
                    traceId,
                    "Fiscal sources are unavailable or incomplete. No export artifact was prepared."
                );
            }

            const artifact = buildQuarterlyRegistryPackage({
                year,
                quarter,
                generatedAt: new Date(),
                traceId,
                summary: summaryResult.data,
                rows: bookResult.data.filas,
            });

            return { status: "SUCCESS", data: artifact, error: null };
        } catch (error) {
            return {
                status: "ERROR",
                data: null,
                error: _toPublicError(error, "C3_EXPORT_PREPARATION_FAILED"),
                traceId,
            };
        }
    }
);
