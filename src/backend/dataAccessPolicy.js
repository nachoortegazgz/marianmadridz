import {
    DATA_ACCESS_BULK_PATCH_POLICY,
    DATA_ACCESS_WRITE_POLICY,
    BUSINESS_COLLECTIONS,
    CONTROL_TYPE,
    CONTROL_OPERATIVO_NON_CANONICAL_FIELDS,
    RECORD_TYPE,
    APPEND_ONLY_MUTATION_WINDOW,
    QA_RECORD_MUTATIONS_ENABLED,
} from "backend/internalConfig";

function _policyError(code) {
    const error = new Error("DATA_ACCESS_ERROR");
    error.code = code;
    return error;
}

export function assertBulkPatchAllowed(collection, modifications, conditionFilter) {
    const collectionPolicy = DATA_ACCESS_BULK_PATCH_POLICY[collection];
    if (QA_RECORD_MUTATIONS_ENABLED) {
        if (
            !Object.values(BUSINESS_COLLECTIONS).includes(collection) ||
            !_isRecord(conditionFilter) ||
            !Array.isArray(modifications) ||
            modifications.length === 0
        ) {
            throw _policyError("BULK_PATCH_POLICY_INPUT_INVALID");
        }
        return;
    }
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

const APPEND_ONLY_MUTABLE_COLLECTIONS = Object.freeze([
    BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA,
    BUSINESS_COLLECTIONS.MOVIMIENTOS_INVENTARIO,
    BUSINESS_COLLECTIONS.LIBRO_ASIENTOS_CONTABLES_DETALLE,
    BUSINESS_COLLECTIONS.REGISTROS_HORARIOS_STAFF,
    BUSINESS_COLLECTIONS.HISTORICO_CIERRES_Z,
    BUSINESS_COLLECTIONS.PAQUETES_GESTORIA,
]);

function _temporaryMutationWindowOpen() {
    return APPEND_ONLY_MUTATION_WINDOW.ENABLED === true &&
        APPEND_ONLY_MUTATION_WINDOW.TEMPORARY === true;
}

function _assertControlRecord(item, allowedTypes, errorCode, requireId = true) {
    if (
        !_isRecord(item) ||
        (requireId && !item._id) ||
        !allowedTypes.includes(item.controlType)
    ) {
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
        _assertControlRecord(item, Object.values(CONTROL_TYPE), "CMS_INSERT_CONTROL_TYPE_INVALID", false);
    }
    if (collection === BUSINESS_COLLECTIONS.CITAS_F2 && !item.bookingId) {
        throw _policyError("CMS_INSERT_BOOKING_ID_REQUIRED");
    }
    if (collection === BUSINESS_COLLECTIONS.MAPA_STAFF &&
        !Object.values(RECORD_TYPE).includes(item.recordType)) {
        throw _policyError("CMS_INSERT_FISCAL_RECORD_TYPE_INVALID");
    }
}

export function assertUpdateAllowed(collection, item) {
    if (!_isRecord(item) || !Object.values(BUSINESS_COLLECTIONS).includes(collection)) {
        throw _policyError("CMS_UPDATE_COLLECTION_DENIED");
    }
    if (QA_RECORD_MUTATIONS_ENABLED) {
        if (!item._id) throw _policyError("CMS_UPDATE_ID_REQUIRED");
        return;
    }
    if (!DATA_ACCESS_WRITE_POLICY.updateCollections.includes(collection)) {
        throw _policyError("CMS_UPDATE_COLLECTION_DENIED");
    }
    if (APPEND_ONLY_MUTABLE_COLLECTIONS.includes(collection)) {
        if (!_temporaryMutationWindowOpen()) {
            throw _policyError("CMS_UPDATE_COLLECTION_DENIED");
        }
        if (!item._id) throw _policyError("CMS_UPDATE_ID_REQUIRED");
    }
    if (collection === BUSINESS_COLLECTIONS.CONTROL_OPERATIVO) {
        if (item.controlType === CONTROL_TYPE.WEBHOOK_EVENT && !_temporaryMutationWindowOpen()) {
            throw _policyError("CMS_UPDATE_CONTROL_TYPE_DENIED");
        }
        _assertControlRecord(
            item,
            DATA_ACCESS_WRITE_POLICY.mutableControlTypes,
            "CMS_UPDATE_CONTROL_TYPE_DENIED"
        );
    } else if (collection === BUSINESS_COLLECTIONS.CAJA_ACTUAL) {
        if (!item._id) throw _policyError("CMS_UPDATE_ID_REQUIRED");
    } else if (collection === BUSINESS_COLLECTIONS.CITAS_F2) {
        if (!item._id || !item.bookingId) {
            throw _policyError("CMS_UPDATE_BOOKING_ID_REQUIRED");
        }
    }
}

export function assertSaveAllowed(collection, item) {
    if (!DATA_ACCESS_WRITE_POLICY.saveCollections.includes(collection) || !_isRecord(item)) {
        throw _policyError("CMS_SAVE_COLLECTION_DENIED");
    }
    if (collection === BUSINESS_COLLECTIONS.CONTROL_OPERATIVO) {
        _assertControlRecord(item, [CONTROL_TYPE.DAYS_CACHE], "CMS_SAVE_CONTROL_TYPE_DENIED");
    } else if (collection === BUSINESS_COLLECTIONS.CAJA_ACTUAL && !item._id) {
        throw _policyError("CMS_SAVE_ID_REQUIRED");
    }
}

export function assertRemoveAllowed(collection, id, expectedControlType) {
    if (!id || !Object.values(BUSINESS_COLLECTIONS).includes(collection)) {
        throw _policyError("CMS_REMOVE_SCOPE_DENIED");
    }
    if (QA_RECORD_MUTATIONS_ENABLED) return;
    if (!DATA_ACCESS_WRITE_POLICY.removeCollections.includes(collection)) {
        throw _policyError("CMS_REMOVE_SCOPE_DENIED");
    }
    if (collection === BUSINESS_COLLECTIONS.CONTROL_OPERATIVO) {
        if (!DATA_ACCESS_WRITE_POLICY.removableControlTypes.includes(expectedControlType) ||
            (expectedControlType === CONTROL_TYPE.WEBHOOK_EVENT && !_temporaryMutationWindowOpen())) {
            throw _policyError("CMS_REMOVE_SCOPE_DENIED");
        }
    } else if (APPEND_ONLY_MUTABLE_COLLECTIONS.includes(collection) && !_temporaryMutationWindowOpen()) {
        throw _policyError("CMS_REMOVE_SCOPE_DENIED");
    }
}

export function assertBulkUpdateAllowed(collection, records) {
    if (
        !QA_RECORD_MUTATIONS_ENABLED ||
        !Object.values(BUSINESS_COLLECTIONS).includes(collection) ||
        !Array.isArray(records) ||
        records.length === 0 ||
        records.length > 1000 ||
        records.some((record) => !_isRecord(record) || typeof record._id !== "string" || !record._id.trim())
    ) {
        throw _policyError("CMS_BULK_UPDATE_SCOPE_DENIED");
    }
}

export function assertBulkRemoveAllowed(collection, ids) {
    if (
        !QA_RECORD_MUTATIONS_ENABLED ||
        !Object.values(BUSINESS_COLLECTIONS).includes(collection) ||
        !Array.isArray(ids) ||
        ids.length === 0 ||
        ids.length > 1000 ||
        ids.some((id) => typeof id !== "string" || !id.trim())
    ) {
        throw _policyError("CMS_BULK_REMOVE_SCOPE_DENIED");
    }
}

export function assertBulkMutationDisabled(operation) {
    throw _policyError(`CMS_${operation}_DISABLED_NO_APPROVED_CONSUMERS`);
}
