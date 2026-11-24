import { getMyStaffContext } from "backend/security";
import { createActionableError } from "backend/errors/actionableError";

/**
 * Resolve the authenticated TPV operator from the Wix member session.
 * Never accepts actor/operator identifiers supplied by the widget.
 */
export async function getTpvOperatorContext(traceId = null) {
    const staff = await getMyStaffContext(traceId);
    const memberId = String(staff?.memberId || "").trim();
    if (!memberId) throw createActionableError({ code: "IDENTITY_MISMATCH", userMessage: "La sesión no corresponde al operador. Verifica el login.", technicalDetail: "getMyStaffContext no resolvió un memberId de Bookings asociado a la sesión autenticada.", remediation: ["Comprobar que el usuario autenticado es el staff esperado.", "Si es correcto, revisar el vínculo associatedWixIdentity del staff member en Bookings.", "Cerrar sesión, volver a entrar y reintentar.", "Si persiste, adjuntar el contexto técnico al administrador."], contextSnapshot: { traceId, identityResolution: "NO_MATCH" }, retryable: false });
    return Object.freeze({
        actorId: memberId,
        operatorId: memberId,
        operatorDisplayName: String(staff?.displayName || "").trim() || null,
        operatorResourceId: String(staff?.resourceId || "").trim() || null,
        contactId: String(staff?.contactId || "").trim() || null,
    });
}
