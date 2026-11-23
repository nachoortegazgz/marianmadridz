import { getMyStaffContext } from "backend/security";

/**
 * Resolve the authenticated TPV operator from the Wix member session.
 * Never accepts actor/operator identifiers supplied by the widget.
 */
export async function getTpvOperatorContext(traceId = null) {
    const staff = await getMyStaffContext(traceId);
    const memberId = String(staff?.memberId || "").trim();
    if (!memberId) throw new Error("TPV_OPERATOR_IDENTITY_REQUIRED");
    return Object.freeze({
        actorId: memberId,
        operatorId: memberId,
        operatorDisplayName: String(staff?.displayName || "").trim() || null,
        operatorResourceId: String(staff?.resourceId || "").trim() || null,
        contactId: String(staff?.contactId || "").trim() || null,
    });
}
