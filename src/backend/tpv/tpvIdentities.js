import { BUSINESS_COLLECTIONS, TPV_IDENTITY_TYPES, TPV_RUNTIME_POLICY } from "backend/internalConfig";
import { CONSISTENCY, queryItems, wql } from "backend/dataAccess";
import { assertTpvIdentity } from "backend/validation";

function isEligibleIdentity(item, identityType) {
    assertTpvIdentity(item);
    return item.identityType === identityType;
}

export async function listTpvIdentities(identityType) {
    if (!Object.values(TPV_IDENTITY_TYPES).includes(identityType)) {
        throw new Error("TPV_IDENTITY_TYPE_INVALID");
    }
    const result = await queryItems({
        dataCollectionId: BUSINESS_COLLECTIONS.TPV_IDENTITIES,
        filter: wql.and(
            wql.eq("identityType", identityType),
            wql.eq("environment", "SANDBOX"),
            wql.eq("testRunId", TPV_RUNTIME_POLICY.SANDBOX_RUN_ID),
            wql.eq("syntheticOnly", true),
            wql.eq("active", true)
        ),
        limit: 100,
        consistency: CONSISTENCY.STRONG,
    });
    if (result.hasNext) throw new Error("TPV_IDENTITIES_QUERY_LIMIT_EXCEEDED");
    const items = result.items || [];
    if (items.some((item) => !isEligibleIdentity(item, identityType))) {
        throw new Error("TPV_IDENTITY_CONTRACT_INVALID");
    }
    const ids = items.map((item) => item.identityId);
    if (new Set(ids).size !== ids.length) throw new Error("TPV_IDENTITY_DUPLICATE");
    return items;
}

export async function getTpvIdentity(identityId, identityType) {
    const cleanId = String(identityId || "").trim();
    if (!cleanId) return null;
    const identities = await listTpvIdentities(identityType);
    return identities.find((item) => item.identityId === cleanId) || null;
}
