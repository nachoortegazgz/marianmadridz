import { createActionableError } from "backend/errors/actionableError";
import {
    DATA_ACCESS_BULK_PATCH_POLICY,
    DATA_ACCESS_WRITE_POLICY,
    BUSINESS_COLLECTIONS,
    CONTROL_TYPE,
    CONTROL_OPERATIVO_NON_CANONICAL_FIELDS,
    RECORD_TYPE,
} from "backend/internalConfig";

const APPEND_ONLY_COLLECTIONS = Object.freeze([
    BUSINESS_COLLECTIONS.MOVIMIENTOS_CAJA,
    BUSINESS_COLLECTIONS.LIBRO_ASIENTOS_CONTABLES_DETALLE,
    BUSINESS_COLLECTIONS.REGISTROS_HORARIOS_STAFF,
    BUSINESS_COLLECTIONS.HISTORICO_CIERRES_Z,
]);

function _appendOnlyError(collection, operation) {
    return createActionableError({
        code: "LEDGER_APPEND_ONLY",
        userMessage: "Los registros append-only no se modifican. Registra un nuevo evento rectificativo y trazable.",
        technicalDetail: "CMS " + operation + " denied for append-only collection: " + collection,
        remediation: [
            "No intentar update/remove sobre ledgers append-only como MovimientosCaja, LibroAsientosContablesDetalle, RegistrosHorariosStaff ni HistoricoCierresZ.",
            "Registrar la corrección como un nuevo evento rectificativo trazable, referenciando el _id original y conforme al contrato aplicable.",
            "Si el asiento rectificativo falla, adjuntar el código y contexto técnico al administrador.",
        ],
        contextSnapshot: { collection, operation },
        retryable: false,
    });
}

function _policyError(code) {
    const error = new Error("DATA_ACCESS_ERROR");
    error.code = code;
    return error;
}

function _isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
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

export function assertInsertAllowed(collection, item) {
    if (!DATA_ACCESS_WRITE_POLICY.insertCollections.includes(collection) || !_isRecord(item)) {
        throw _policyError("CMS_INSERT_COLLECTION_DENIED");
    }

    if (collection === BUSINESS_COLLECTIONS.CONTROL_OPERATIVO) {
        if (
            [CONTROL_TYPE.TPV_TEST_RUN, CONTROL_TYPE.TPV_TEST_SESSION_LOCK]
                .includes(item.controlType)
        ) {
            throw _policyError("CMS_TPV_HISTORICAL_RUNTIME_WRITE_DENIED");
        }

        _assertControlRecord(
            item,
            Object.values(CONTROL_TYPE),
            "CMS_INSERT_CONTROL_TYPE_INVALID",
            false
        );
    }

    if (collection === BUSINESS_COLLECTIONS.CITAS_F2 && !item.bookingId) {
        throw _policyError("CMS_INSERT_BOOKING_ID_REQUIRED");
    }

    if (
        collection === BUSINESS_COLLECTIONS.MAPA_STAFF &&
        !Object.values(RECORD_TYPE).includes(item.recordType)
    ) {
        throw _policyError("CMS_INSERT_MAPA_STAFF_RECORD_TYPE_INVALID");
    }
}

export function assertUpdateAllowed(collection, item) {
    if (!_isRecord(item)) {
        throw _policyError("CMS_UPDATE_COLLECTION_DENIED");
    }

    if (!DATA_ACCESS_WRITE_POLICY.updateCollections.includes(collection)) {
        if (APPEND_ONLY_COLLECTIONS.includes(collection)) {
            throw _appendOnlyError(collection, "UPDATE");
        }
        throw _policyError("CMS_UPDATE_COLLECTION_DENIED");
    }

    if (APPEND_ONLY_COLLECTIONS.includes(collection)) {
        throw _appendOnlyError(collection, "UPDATE");
    }

    if (collection === BUSINESS_COLLECTIONS.TRANSACCIONES_TPV) {
        if (!item._id) {
            throw _policyError("CMS_UPDATE_ID_REQUIRED");
        }
    } else if (collection === BUSINESS_COLLECTIONS.CONTROL_OPERATIVO) {
        if (
            [CONTROL_TYPE.TPV_TEST_RUN, CONTROL_TYPE.TPV_TEST_SESSION_LOCK]
                .includes(item.controlType)
        ) {
            throw _policyError("CMS_TPV_HISTORICAL_RUNTIME_WRITE_DENIED");
        }

        if (!item._id) {
            throw _policyError("CMS_UPDATE_ID_REQUIRED");
        }

        if (item.controlType === CONTROL_TYPE.WEBHOOK_EVENT) {
            throw _policyError("CMS_UPDATE_CONTROL_TYPE_DENIED");
        }

        // Las actualizaciones directas no permiten los locks TPV.
        // TPV_REFUND_LOCK y TPV_SESSION_LOCK solo pueden cambiar mediante
        // assertBulkPatchAllowed con su condición compare-and-swap.
        _assertControlRecord(
            item,
            DATA_ACCESS_WRITE_POLICY.mutableControlTypes,
            "CMS_UPDATE_CONTROL_TYPE_DENIED",
            false
        );
    } else if (collection === BUSINESS_COLLECTIONS.CAJA_ACTUAL) {
        if (!item._id) {
            throw _policyError("CMS_UPDATE_ID_REQUIRED");
        }
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
        _assertControlRecord(
            item,
            [CONTROL_TYPE.DAYS_CACHE],
            "CMS_SAVE_CONTROL_TYPE_DENIED"
        );
    } else if (collection === BUSINESS_COLLECTIONS.CAJA_ACTUAL && !item._id) {
        throw _policyError("CMS_SAVE_ID_REQUIRED");
    }
}

export function assertRemoveAllowed(collection, id, expectedControlType, existingItem) {
    if (!id) {
        throw _policyError("CMS_REMOVE_SCOPE_DENIED");
    }

    if (collection === BUSINESS_COLLECTIONS.TRANSACCIONES_TPV) {
        throw _policyError("CMS_DELETE_PROHIBITED");
    }

    if (!DATA_ACCESS_WRITE_POLICY.removeCollections.includes(collection)) {
        if (APPEND_ONLY_COLLECTIONS.includes(collection)) {
            throw _appendOnlyError(collection, "REMOVE");
        }
        throw _policyError("CMS_DELETE_PROHIBITED");
    }

    if (collection === BUSINESS_COLLECTIONS.CONTROL_OPERATIVO) {
        if (
            [CONTROL_TYPE.TPV_TEST_RUN, CONTROL_TYPE.TPV_TEST_SESSION_LOCK]
                .includes(expectedControlType)
        ) {
            throw _policyError("CMS_TPV_HISTORICAL_RUNTIME_WRITE_DENIED");
        }

        if (
            !DATA_ACCESS_WRITE_POLICY.removableControlTypes.includes(expectedControlType) ||
            expectedControlType === CONTROL_TYPE.WEBHOOK_EVENT
        ) {
            throw _policyError("CMS_DELETE_PROHIBITED");
        }

        if (
            existingItem &&
            existingItem.controlType !== expectedControlType
        ) {
            throw _policyError("CMS_REMOVE_CONTROL_TYPE_MISMATCH");
        }

        return;
    }

    if (APPEND_ONLY_COLLECTIONS.includes(collection)) {
        throw _appendOnlyError(collection, "REMOVE");
    }
}

export function assertBulkUpdateAllowed() {
    // No bulk update consumer is approved. Keep this API fail-closed.
    throw _policyError("CMS_BULK_UPDATE_SCOPE_DENIED");
}

export function assertBulkRemoveAllowed() {
    throw _policyError("CMS_BULK_DELETE_PROHIBITED");
}

export function assertBulkMutationDisabled(operation) {
    throw _policyError(`CMS_${operation}_DISABLED_NO_APPROVED_CONSUMERS`);
}
