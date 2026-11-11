import test from "node:test";
import assert from "node:assert/strict";
import {
    assertInsertAllowed,
    assertUpdateAllowed,
    assertSaveAllowed,
    assertRemoveAllowed,
    assertBulkRemoveAllowed,
    assertBulkMutationDisabled,
} from "backend/dataAccessPolicy";
import {
    BUSINESS_COLLECTIONS as C,
    OPERATIONAL_COLLECTIONS as O,
    CONTROL_TYPE as T,
    RECORD_TYPE,
} from "backend/internalConfig";

test("insert policy allows only declared collections and canonical ControlOperativo types", () => {
    assert.doesNotThrow(() => assertInsertAllowed(O.CONTROL_OPERATIVO, {
        controlType: T.WEBHOOK_EVENT,
        eventId: "synthetic-event",
    }));
    assert.doesNotThrow(() => assertInsertAllowed(C.MOVIMIENTOS_CAJA, {
        _id: "synthetic-ledger-row",
        movementType: "COBRO",
    }));
    assert.doesNotThrow(() => assertInsertAllowed(C.CITAS_F2, {
        bookingId: "synthetic-booking",
        bookingStatus: "PENDING",
    }));
    assert.doesNotThrow(() => assertInsertAllowed(C.REGISTROS_HORARIOS_STAFF, {
        clockEventType: "ENTRADA",
        staffId: "synthetic-staff",
    }));
    assert.throws(() => assertInsertAllowed(C.CITAS_F2, {
        bookingStatus: "PENDING",
    }), { code: "CMS_INSERT_BOOKING_ID_REQUIRED" });
    assert.doesNotThrow(() => assertInsertAllowed(C.DATOS_FISCALES, {
        recordType: RECORD_TYPE.TERCERO,
        taxId: "X0000000X",
    }));
    assert.throws(() => assertInsertAllowed("UnknownCollection", {}), {
        code: "CMS_INSERT_COLLECTION_DENIED",
    });
    assert.throws(() => assertInsertAllowed(O.CONTROL_OPERATIVO, {
        controlType: "UNDECLARED",
    }), { code: "CMS_INSERT_CONTROL_TYPE_INVALID" });
    assert.throws(() => assertInsertAllowed(O.CONTROL_OPERATIVO, {
        controlType: T.ALERT,
        updatedAt: new Date(),
    }), { code: "CMS_WRITE_NON_CANONICAL_CONTROL_FIELD" });
});

test("insert policy rejects unknown fiscal record types", () => {
    assert.throws(() => assertInsertAllowed(C.DATOS_FISCALES, {
        recordType: "INVOICE_LEDGER",
    }), { code: "CMS_INSERT_FISCAL_RECORD_TYPE_INVALID" });
});

test("update policy allows mutable operational state and CajaActual only", () => {
    assert.doesNotThrow(() => assertUpdateAllowed(O.CONTROL_OPERATIVO, {
        _id: "control-1",
        controlType: T.COMPENSATION,
        status: "EXECUTED",
        payload: {},
    }));
    assert.doesNotThrow(() => assertUpdateAllowed(C.CAJA_ACTUAL, {
        _id: "cash-current",
        sequenceCounters: {},
    }));
    assert.doesNotThrow(() => assertUpdateAllowed(C.CITAS_F2, {
        _id: "projection-1",
        bookingId: "synthetic-booking",
        bookingStatus: "CONFIRMED",
    }));
    assert.throws(() => assertUpdateAllowed(C.CITAS_F2, {
        _id: "projection-1",
        bookingStatus: "CONFIRMED",
    }), { code: "CMS_UPDATE_BOOKING_ID_REQUIRED" });
    assert.throws(() => assertUpdateAllowed(C.MOVIMIENTOS_CAJA, {
        _id: "immutable-ledger-row",
    }), { code: "CMS_UPDATE_COLLECTION_DENIED" });
    assert.throws(() => assertUpdateAllowed(O.CONTROL_OPERATIVO, {
        _id: "webhook-1",
        controlType: T.WEBHOOK_EVENT,
    }), { code: "CMS_UPDATE_CONTROL_TYPE_DENIED" });
    assert.throws(() => assertUpdateAllowed(O.CONTROL_OPERATIVO, {
        controlType: T.SYSTEM_FLAG,
    }), { code: "CMS_UPDATE_CONTROL_TYPE_DENIED" });
});

test("save policy is limited to the volatile DAYS_CACHE projection", () => {
    assert.doesNotThrow(() => assertSaveAllowed(O.CONTROL_OPERATIVO, {
        _id: "days-cache-1",
        controlType: T.DAYS_CACHE,
        payload: {},
    }));
    assert.doesNotThrow(() => assertSaveAllowed(C.CAJA_ACTUAL, {
        _id: "cash-current",
        cashRegisterStatus: "CERRADA",
    }));
    assert.throws(() => assertSaveAllowed(C.CAJA_ACTUAL, {
        cashRegisterStatus: "CERRADA",
    }), { code: "CMS_SAVE_ID_REQUIRED" });
    assert.throws(() => assertSaveAllowed(C.CAJA_ACTUAL, {
        _id: "cash-current",
    }), { code: "CMS_SAVE_COLLECTION_DENIED" });
    assert.throws(() => assertSaveAllowed(O.CONTROL_OPERATIVO, {
        _id: "event-1",
        controlType: T.WEBHOOK_EVENT,
    }), { code: "CMS_SAVE_CONTROL_TYPE_DENIED" });
});

test("single-item removal requires an explicitly ephemeral ControlOperativo type", () => {
    assert.doesNotThrow(() => assertRemoveAllowed(O.CONTROL_OPERATIVO, "cache-1", T.DUAL_CACHE));
    assert.doesNotThrow(() => assertRemoveAllowed(O.CONTROL_OPERATIVO, "token-1", T.DISPLAY_TOKEN));
    assert.doesNotThrow(() => assertRemoveAllowed(O.CONTROL_OPERATIVO, "lock-1", T.SLOT_LOCK));
    assert.doesNotThrow(() => assertRemoveAllowed(O.CONTROL_OPERATIVO, "claim-1", T.IDEMPOTENCY));
    assert.throws(() => assertRemoveAllowed(O.CONTROL_OPERATIVO, "event-1", T.WEBHOOK_EVENT), {
        code: "CMS_REMOVE_SCOPE_DENIED",
    });
    assert.throws(() => assertRemoveAllowed(O.CONTROL_OPERATIVO, "cache-1"), {
        code: "CMS_REMOVE_SCOPE_DENIED",
    });
    assert.throws(() => assertRemoveAllowed(C.MOVIMIENTOS_CAJA, "ledger-1", T.DUAL_CACHE), {
        code: "CMS_REMOVE_SCOPE_DENIED",
    });
});

test("bulk removal permits only bounded purgeable ControlOperativo types", () => {
    assert.doesNotThrow(() => assertBulkRemoveAllowed(O.CONTROL_OPERATIVO, ["a", "b"], {
        condition: { filter: {
            controlType: { $eq: T.COMPENSATION },
            status: { $eq: "EXECUTED" },
            _updatedDate: { $lt: new Date() },
        } },
    }));
    assert.doesNotThrow(() => assertBulkRemoveAllowed(O.CONTROL_OPERATIVO, ["a"], {
        condition: { filter: {
            controlType: { $eq: T.DUAL_CACHE },
            expiresAt: { $lt: new Date() },
        } },
    }));
    assert.throws(() => assertBulkRemoveAllowed(O.CONTROL_OPERATIVO, ["a"], {
        condition: { filter: { controlType: { $eq: T.WEBHOOK_EVENT } } },
    }), { code: "CMS_BULK_REMOVE_CONTROL_TYPE_DENIED" });
    assert.throws(() => assertBulkRemoveAllowed(C.MOVIMIENTOS_CAJA, ["a"], {
        condition: { filter: { controlType: { $eq: T.ALERT } } },
    }), { code: "CMS_BULK_REMOVE_SCOPE_DENIED" });
    assert.throws(() => assertBulkRemoveAllowed(O.CONTROL_OPERATIVO, ["a"], {
        condition: { filter: {
            controlType: { $eq: T.ALERT },
            payload: { $eq: "not-an-approved-filter" },
        } },
    }), { code: "CMS_BULK_REMOVE_FILTER_DENIED" });
    assert.throws(() => assertBulkRemoveAllowed(O.CONTROL_OPERATIVO, [], {
        condition: { filter: { controlType: { $eq: T.ALERT } } },
    }), { code: "CMS_BULK_REMOVE_SCOPE_DENIED" });
});

test("bulk insert and bulk update stay disabled until reviewed consumers exist", () => {
    assert.throws(() => assertBulkMutationDisabled("BULK_INSERT"), {
        code: "CMS_BULK_INSERT_DISABLED_NO_APPROVED_CONSUMERS",
    });
    assert.throws(() => assertBulkMutationDisabled("BULK_UPDATE"), {
        code: "CMS_BULK_UPDATE_DISABLED_NO_APPROVED_CONSUMERS",
    });
});
