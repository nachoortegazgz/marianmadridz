import { webMethod, Permissions } from "wix-web-module";

import { requireMarianManager, rateLimiter } from "backend/security";
import {
    getQuarterlyTaxSummaryInternal,
    getLibroRegistroFacturasExpedidasInternal,
} from "backend/fiscalAggregator.web";
import { buildQuarterlyRegistryPackage } from "backend/exports/exportContract";
import { makeTraceId } from "public/mmUtils";
import { _toPublicError } from "backend/responseUtils";
import { appendC3PreparedEvent, listC3IntegrationEvents } from "backend/exports/integrationOutbox";

function errorResult(code, traceId, message) {
    return {
        status: "ERROR",
        data: null,
        error: { code, message, traceId },
    };
}

/**
 * Admin-only Capa 3 preparation. The artifact manifest is appended to the
 * integration outbox; this does not upload to SharePoint or send email.
 */
export const prepareExternalRegistryPackage = webMethod(
    Permissions.SiteMember,
    async (period = {}) => {
        const traceId = makeTraceId("c3-export");
        try {
            await requireMarianManager(traceId);
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
            const outbox = await appendC3PreparedEvent({ manifest: artifact.manifest, traceId });

            return {
                status: "SUCCESS",
                data: {
                    manifest: artifact.manifest,
                    outbox: {
                        created: outbox.created === true,
                        duplicate: outbox.duplicate === true,
                        event: outbox.event,
                    },
                    delivery: {
                        status: "PENDING_CONFIGURATION",
                        message: "Evento persistido en RegistroIntegracion. SharePoint aún no está conectado; no se ha enviado ningún archivo.",
                    },
                },
                error: null,
            };
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


/** Admin-only read of the C3 append-only outbox. */
export const getExternalIntegrationEvents = webMethod(
    Permissions.SiteMember,
    async (options = {}) => {
        const traceId = makeTraceId("c3-outbox-list");
        try {
            await requireMarianManager(traceId);
            const rate = await rateLimiter({ surface: "capa3.getExternalIntegrationEvents", key: "admin" });
            if (!rate?.allowed) {
                return errorResult("C3_OUTBOX_RATE_LIMITED", traceId, "No se pudo consultar la cola en este momento.");
            }
            const limit = Number(options?.limit ?? 25);
            const result = await listC3IntegrationEvents(limit);
            return { status: "SUCCESS", data: result, error: null, traceId };
        } catch (error) {
            return { status: "ERROR", data: null, error: _toPublicError(error, "C3_OUTBOX_READ_FAILED"), traceId };
        }
    }
);
