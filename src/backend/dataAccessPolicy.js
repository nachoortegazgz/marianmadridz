import { DATA_ACCESS_BULK_PATCH_POLICY } from "backend/internalConfig";

function _policyError(code) {
    const error = new Error("DATA_ACCESS_ERROR");
    error.code = code;
    return error;
}

export function assertBulkPatchAllowed(collection, modifications, conditionFilter) {
    const collectionPolicy = DATA_ACCESS_BULK_PATCH_POLICY[collection];
    if (!collectionPolicy) {
        throw _policyError("BULK_PATCH_POLICY_COLLECTION_DENIED");
    }

    if (!conditionFilter || typeof conditionFilter !== "object" || Array.isArray(conditionFilter)) {
        throw _policyError("BULK_PATCH_POLICY_CONDITION_REQUIRED");
    }

    const controlTypeClause = conditionFilter.controlType;
    if (
        !controlTypeClause ||
        typeof controlTypeClause !== "object" ||
        Array.isArray(controlTypeClause) ||
        Object.keys(controlTypeClause).length !== 1 ||
        !Object.prototype.hasOwnProperty.call(controlTypeClause, "$eq")
    ) {
        throw _policyError("BULK_PATCH_POLICY_TYPE_CONDITION_REQUIRED");
    }

    const controlType = String(controlTypeClause.$eq || "");
    const typePolicy = collectionPolicy[controlType];
    if (!typePolicy) {
        throw _policyError("BULK_PATCH_POLICY_TYPE_DENIED");
    }

    const conditionFields = Object.keys(conditionFilter);
    if (
        conditionFields.some((field) => !typePolicy.allowedConditionFields.includes(field)) ||
        typePolicy.requiredConditionFields.some((field) => !conditionFields.includes(field)) ||
        (typePolicy.anyConditionFields.length > 0 &&
            !typePolicy.anyConditionFields.some((field) => conditionFields.includes(field)))
    ) {
        throw _policyError("BULK_PATCH_POLICY_CAS_CONDITION_INVALID");
    }

    if (!Array.isArray(modifications) || modifications.length === 0) {
        throw _policyError("BULK_PATCH_POLICY_MODIFICATIONS_REQUIRED");
    }

    for (const modification of modifications) {
        const field = String(modification?.fieldPath || "").trim();
        const action = String(modification?.action || "");
        const allowedActions = typePolicy.fields[field];
        if (!allowedActions || !allowedActions.includes(action)) {
            throw _policyError("BULK_PATCH_POLICY_FIELD_OR_ACTION_DENIED");
        }
    }
}
