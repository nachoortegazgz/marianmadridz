import {
    DATA_ACCESS_BULK_PATCH_POLICY,
    DATA_ACCESS_WRITE_POLICY,
    BUSINESS_COLLECTIONS,
    ISOLATED_SITE_MUTABLE_COLLECTIONS,
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

const APPEND_ONLY_COLLECTIONS = Object.freeze([
    BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA,
    BUSINESS_COLLECTIONS.LIBRO_ASIENTOS_CONTABLES_DETALLE,
    BUSINESS_COLLECTIONS.REGISTROS_HORARIOS_STAFF,
    BUSINESS_COLLECTIONS.HISTORICO_CIERRES_Z,
    BUSINESS_COLLECTIONS.PAQUETES_GESTORIA,
]);

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
    if (collection === BUSINESS_COLLECTIONS.DATOS_FISCALES &&
        ![RECORD_TYPE.TERCERO, RECORD_TYPE.GESTORIA, RECORD_TYPE.CONFIG_SISTEMA].includes(item.recordType)) {
        throw _policyError("CMS_INSERT_FISCAL_RECORD_TYPE_INVALID");
    }
}

export function assertUpdateAllowed(collection, item) {
    if (!_isRecord(item) || !ISOLATED_SITE_MUTABLE_COLLECTIONS.includes(collection)) {
        throw _policyError("CMS_UPDATE_COLLECTION_DENIED");
    }
    if (!DATA_ACCESS_WRITE_POLICY.updateCollections.includes(collection)) {
        throw _policyError("CMS_UPDATE_COLLECTION_DENIED");
    }
    if (APPEND_ONLY_COLLECTIONS.includes(collection)) {
        throw _policyError("CMS_UPDATE_COLLECTION_DENIED");
    }
    if (collection === BUSINESS_COLLECTIONS.CONTROL_OPERATIVO) {
        if (item.controlType === CONTROL_TYPE.WEBHOOK_EVENT) {
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
    if (!id || !ISOLATED_SITE_MUTABLE_COLLECTIONS.includes(collection)) {
        throw _policyError("CMS_REMOVE_SCOPE_DENIED");
    }
    if (!DATA_ACCESS_WRITE_POLICY.removeCollections.includes(collection)) {
        throw _policyError("CMS_REMOVE_SCOPE_DENIED");
    }
    if (collection === BUSINESS_COLLECTIONS.CONTROL_OPERATIVO) {
        if (!DATA_ACCESS_WRITE_POLICY.removableControlTypes.includes(expectedControlType) ||
            expectedControlType === CONTROL_TYPE.WEBHOOK_EVENT) {
            throw _policyError("CMS_REMOVE_SCOPE_DENIED");
        }
    } else if (APPEND_ONLY_COLLECTIONS.includes(collection)) {
        throw _policyError("CMS_REMOVE_SCOPE_DENIED");
    }
}

export function assertBulkUpdateAllowed() {
    // No bulk update consumer is approved. Keep this API fail-closed.
    throw _policyError("CMS_BULK_UPDATE_SCOPE_DENIED");
}

const EXPIRY_PURGE_TYPES = new Set([
    CONTROL_TYPE.SLOT_LOCK,
    CONTROL_TYPE.RATE_LIMIT,
    CONTROL_TYPE.DISPLAY_TOKEN,
    CONTROL_TYPE.DUAL_CACHE,
    CONTROL_TYPE.DAYS_CACHE,
]);
const UPDATED_AT_PURGE_STATUSES = Object.freeze({
    [CONTROL_TYPE.IDEMPOTENCY]: new Set(["COMPLETED", "FAILED_FINAL"]),
    [CONTROL_TYPE.SYSTEM_FLAG]: new Set(["COMPLETED", "RECONCILED", "RESOLVED"]),
});
const CREATED_AT_PURGE_STATUSES = Object.freeze({
    [CONTROL_TYPE.ALERT]: new Set(["COMPLETED", "CLOSED", "RESOLVED"]),
    [CONTROL_TYPE.COMPENSATION]: new Set(["EXECUTED"]),
});

function _exactClauseValue(clause, operator) {
    if (!_isRecord(clause) || Object.keys(clause).length !== 1 ||
        !Object.prototype.hasOwnProperty.call(clause, operator)) return undefined;
    return clause[operator];
}
function _isLessThanDate(clause) {
    const value = _exactClauseValue(clause, "$lt");
    return value instanceof Date && Number.isFinite(value.getTime());
}
function _hasExactKeys(value, expected) {
    return _isRecord(value) &&
        Object.keys(value).sort().join("|") === [...expected].sort().join("|");
}

export function assertBulkRemoveAllowed(collection, ids, options = {}) {
    if (
        collection !== BUSINESS_COLLECTIONS.CONTROL_OPERATIVO ||
        !ISOLATED_SITE_MUTABLE_COLLECTIONS.includes(collection) ||
        !Array.isArray(ids) ||
        ids.length === 0 ||
        ids.length > 1000 ||
        ids.some((id) => typeof id !== "string" || !id.trim())
    ) {
        throw _policyError("CMS_BULK_REMOVE_SCOPE_DENIED");
    }

    const filter = options?.condition?.filter;
    const type = _exactClauseValue(filter?.controlType, "$eq");
    if (
        typeof type !== "string" ||
        !DATA_ACCESS_WRITE_POLICY.purgeControlTypes.includes(type) ||
        type === CONTROL_TYPE.WEBHOOK_EVENT
    ) {
        throw _policyError("CMS_BULK_REMOVE_SCOPE_DENIED");
    }

    if (EXPIRY_PURGE_TYPES.has(type)) {
        if (!_hasExactKeys(filter, ["controlType", "expiresAt"]) ||
            !_isLessThanDate(filter.expiresAt)) {
            throw _policyError("CMS_BULK_REMOVE_SCOPE_DENIED");
        }
        return;
    }

    const updatedStatuses = UPDATED_AT_PURGE_STATUSES[type];
    if (updatedStatuses) {
        const status = _exactClauseValue(filter.status, "$eq");
        if (
            !_hasExactKeys(filter, ["controlType", "status", "_updatedDate"]) ||
            !updatedStatuses.has(status) ||
            !_isLessThanDate(filter._updatedDate)
        ) {
            throw _policyError("CMS_BULK_REMOVE_SCOPE_DENIED");
        }
        return;
    }

    const createdStatuses = CREATED_AT_PURGE_STATUSES[type];
    if (createdStatuses) {
        const status = _exactClauseValue(filter.status, "$eq");
        if (
            !_hasExactKeys(filter, ["controlType", "status", "_createdDate"]) ||
            !createdStatuses.has(status) ||
            !_isLessThanDate(filter._createdDate)
        ) {
            throw _policyError("CMS_BULK_REMOVE_SCOPE_DENIED");
        }
        return;
    }

    throw _policyError("CMS_BULK_REMOVE_SCOPE_DENIED");
}

export function assertBulkMutationDisabled(operation) {
    throw _policyError(`CMS_${operation}_DISABLED_NO_APPROVED_CONSUMERS`);
}
