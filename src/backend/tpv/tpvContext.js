import { TPV_RUNTIME_POLICY } from "backend/internalConfig";
import { getTpvOperatorContext } from "backend/tpv/tpvOperatorContext";

/**
 * Builds the trusted TPV execution context exclusively from backend-owned
 * identity and site configuration. Client-supplied actor/site identifiers
 * are intentionally not accepted.
 */
export async function resolveTpvContext(traceId = null) {
    const operator = await getTpvOperatorContext(traceId);
    const siteId = String(TPV_RUNTIME_POLICY.SITE_ID || "").trim();
    const sourceType = String(TPV_RUNTIME_POLICY.SOURCE_TYPE || "").trim();
    const ledgerVersion = String(TPV_RUNTIME_POLICY.LEDGER_VERSION || "").trim();

    if (!operator?.actorId || !operator?.operatorId || !siteId || !sourceType || !ledgerVersion) {
        throw new Error("TPV_CONTEXT_REQUIRED");
    }

    return Object.freeze({
        actorId: operator.actorId,
        operatorId: operator.operatorId,
        operatorDisplayName: operator.operatorDisplayName || null,
        operatorResourceId: operator.operatorResourceId || null,
        rolWebsite: operator.rolWebsite || null,
        contactId: operator.contactId || null,
        siteId,
        sourceType,
        ledgerVersion,
    });
}
