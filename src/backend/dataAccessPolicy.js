import {
    DATA_ACCESS_BULK_PATCH_POLICY,
    DATA_ACCESS_WRITE_POLICY,
    BUSINESS_COLLECTIONS,
    CONTROL_TYPE,
    CONTROL_OPERATIVO_NON_CANONICAL_FIELDS,
    RECORD_TYPE,
} from "backend/internalConfig";

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


function _isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function _assertControlRecord(item, allowedTypes, errorCode) {
    if (!_isRecord(item) || !item._id || !allowedTypes.includes(item.controlType)) {
        throw _policyError(errorCode);
    }
    if (CONTROL_OPERATIVO_NON_CANONICAL_FIELDS.some((field) =>
        Object.prototype.hasOwnProperty.call(item, field)
    )) {
        throw _policyError("CMS_WRITE_NON_CANONICAL_CONTROL_FIELD");
    }
}

export function assertInsertAllowed(collection, item) {
    if (!DATA_ACCESS_WRITE_POLICY.insertCollections.includes(collection) || !_isRecord(item)) {
        throw _policyError("CMS_INSERT_COLLECTION_DENIED");
    }
    if (collection === BUSINESS_COLLECTIONS.CONTROL_OPERATIVO) {
        _assertControlRecord(item, Object.values(CONTROL_TYPE), "CMS_INSERT_CONTROL_TYPE_INVALID");
    }
    if (collection === BUSINESS_COLLECTIONS.DATOS_FISCALES &&
        !Object.values(RECORD_TYPE).includes(item.recordType)) {
        throw _policyError("CMS_INSERT_FISCAL_RECORD_TYPE_INVALID");
    }
}

export function assertUpdateAllowed(collection, item) {
    if (!DATA_ACCESS_WRITE_POLICY.updateCollections.includes(collection) || !_isRecord(item)) {
        throw _policyError("CMS_UPDATE_COLLECTION_DENIED");
    }
    if (collection === BUSINESS_COLLECTIONS.CONTROL_OPERATIVO) {
        _assertControlRecord(
            item,
            DATA_ACCESS_WRITE_POLICY.mutableControlTypes,
            "CMS_UPDATE_CONTROL_TYPE_DENIED"
        );
    } else if (collection === BUSINESS_COLLECTIONS.CAJA_ACTUAL) {
        if (!item._id) throw _policyError("CMS_UPDATE_ID_REQUIRED");
    }
}

export function assertSaveAllowed(collection, item) {
    if (!DATA_ACCESS_WRITE_POLICY.saveCollections.includes(collection)) {
        throw _policyError("CMS_SAVE_COLLECTION_DENIED");
    }
    _assertControlRecord(item, [CONTROL_TYPE.DAYS_CACHE], "CMS_SAVE_CONTROL_TYPE_DENIED");
}

export function assertRemoveAllowed(collection, id, expectedControlType) {
    if (
        !DATA_ACCESS_WRITE_POLICY.removeCollections.includes(collection) ||
        !id ||
        !DATA_ACCESS_WRITE_POLICY.removableControlTypes.includes(expectedControlType)
    ) {
        throw _policyError("CMS_REMOVE_SCOPE_DENIED");
    }
}

export function assertBulkRemoveAllowed(collection, ids, options) {
    if (
        !DATA_ACCESS_WRITE_POLICY.bulkRemoveCollections.includes(collection) ||
        !Array.isArray(ids) ||
        ids.length === 0 ||
        ids.some((id) => typeof id !== "string" || !id.trim())
    ) {
        throw _policyError("CMS_BULK_REMOVE_SCOPE_DENIED");
    }

    const filter = options?.condition?.filter;
    if (!_isRecord(filter)) throw _policyError("CMS_BULK_REMOVE_CONDITION_REQUIRED");
    const typeClause = filter.controlType;
    if (
        !_isRecord(typeClause) ||
        Object.keys(typeClause).length !== 1 ||
        !Object.prototype.hasOwnProperty.call(typeClause, "$eq") ||
        !DATA_ACCESS_WRITE_POLICY.purgeControlTypes.includes(typeClause.$eq)
    ) {
        throw _policyError("CMS_BULK_REMOVE_CONTROL_TYPE_DENIED");
    }

    const allowed = {
        controlType: ["$eq"],
        status: ["$eq"],
        expiresAt: ["$lt"],
        _createdDate: ["$lt"],
        _updatedDate: ["$lt"],
    };
    for (const [field, clause] of Object.entries(filter)) {
        if (
            !allowed[field] ||
            !_isRecord(clause) ||
            Object.keys(clause).length !== 1 ||
            !allowed[field].includes(Object.keys(clause)[0])
        ) {
            throw _policyError("CMS_BULK_REMOVE_FILTER_DENIED");
        }
    }
}

export function assertBulkMutationDisabled(operation) {
    throw _policyError(`CMS_${operation}_DISABLED_NO_APPROVED_CONSUMERS`);
}
