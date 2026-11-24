import test from "node:test";
import assert from "node:assert/strict";
import {
    assertInsertAllowed,
    assertUpdateAllowed,
    assertSaveAllowed,
    assertRemoveAllowed,
    assertBulkRemoveAllowed,
    assertBulkUpdateAllowed,
    assertBulkMutationDisabled,
} from "backend/dataAccessPolicy";
import { insertItem, bulkUpdate, bulkRemove } from "backend/dataAccess";
import {
    BUSINESS_COLLECTIONS as C,
    OPERATIONAL_COLLECTIONS as O,
    CONTROL_TYPE as T,
    RECORD_TYPE,
    DATA_ACCESS_WRITE_POLICY,
    BOOKING_TYPE,
    CITAS_BOOKING_STATUS,
    CITAS_PAYMENT_STATUS,
} from "backend/internalConfig";

test("all CMS write-policy collection lists contain unique canonical strings", () => {
    for (const [policyName, collections] of Object.entries(DATA_ACCESS_WRITE_POLICY)) {
        if (!policyName.endsWith("Collections")) continue;
        assert.ok(Array.isArray(collections), `${policyName} must be an array`);
        assert.ok(
            collections.every((collection) => typeof collection === "string" && collection.trim().length > 0),
            `${policyName} must not contain undefined or empty collection IDs`
        );
        assert.equal(
            new Set(collections).size,
            collections.length,
            `${policyName} must not contain duplicate collection IDs`
        );
    }
});

test("dataAccess validates physical required fields before elevated CMS inserts", () => {
    assert.throws(() => insertItem(C.MOVIMIENTOS_CAJA, {}), /MovimientosCaja requires/);
    assert.throws(() => insertItem(C.HISTORICO_CIERRES_Z, {}), /HistoricoCierresZ requires/);
    assert.throws(() => insertItem(C.CITAS_F2, {
        bookingId: "e556070a-6d6a-402e-8422-11133033ea76",
        scheduleId: "e556070a-6d6a-402e-8422-11133033ea76",
        serviceId: "e556070a-6d6a-402e-8422-11133033ea76",
        resourceId: "e556070a-6d6a-402e-8422-11133033ea76",
        bookingType: Object.values(BOOKING_TYPE)[0],
        bookingStatus: Object.values(CITAS_BOOKING_STATUS)[0],
        paymentStatus: Object.values(CITAS_PAYMENT_STATUS)[0],
        slotEnd: new Date("2026-11-20T11:00:00.000Z"),
        totalAmount: 100,
        dateYmd: "2026-11-20",
        traceId: "trace-insert-contract",
    }), /slotStart/);
    assert.throws(() => insertItem(C.REGISTROS_HORARIOS_STAFF, {}), /RegistrosHorariosStaff requires/);
    assert.throws(() => insertItem(C.CONTROL_OPERATIVO, {
        controlType: T.ALERT,
        dedupeKey: "ALERT:missing-payload",
        traceId: "trace-missing-payload",
        payload: [],
    }), /payload OBJECT/);
});

test("retired custom inventory collections are excluded from the canonical CMS allowlist", () => {
    assert.equal(Object.hasOwn(C, "INVENTARIO_STOCK_VENTA"), false);
    assert.equal(Object.hasOwn(C, "MOVIMIENTOS_INVENTARIO"), false);
    for (const policyName of ["insertCollections", "updateCollections", "saveCollections", "removeCollections", "bulkRemoveCollections"]) {
        assert.equal(DATA_ACCESS_WRITE_POLICY[policyName].includes("InventarioStockVenta"), false);
        assert.equal(DATA_ACCESS_WRITE_POLICY[policyName].includes("MovimientosInventario"), false);
    }
    assert.equal(DATA_ACCESS_WRITE_POLICY.insertCollections.includes(C.MAPA_STAFF), true);
    assert.equal(DATA_ACCESS_WRITE_POLICY.updateCollections.includes(C.MAPA_STAFF), false);
    assert.equal(DATA_ACCESS_WRITE_POLICY.removeCollections.includes(C.MAPA_STAFF), false);
});

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
    assert.doesNotThrow(() => assertInsertAllowed(C.MAPA_STAFF, {
        recordType: RECORD_TYPE.STAFF,
        staffMemberId: "0114748d-2806-3928-9b97-ff0d09853759",
        resourceId: "e556070a-6d6a-402e-8422-11133033ea76",
        scheduleId: "06af20d4-1ec3-49fa-9075-f0691dfa7fd4",
        active: true,
    }));
    assert.doesNotThrow(() => assertInsertAllowed(C.MAPA_STAFF, {
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
    assert.throws(() => assertInsertAllowed(C.MAPA_STAFF, {
        recordType: "INVOICE_LEDGER",
    }), { code: "CMS_INSERT_MAPA_STAFF_RECORD_TYPE_INVALID" });
});

test("update policy keeps operational projections mutable and append-only ledgers immutable", () => {
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
    for (const collection of [
        C.MOVIMIENTOS_CAJA,
        C.LIBRO_ASIENTOS_CONTABLES_DETALLE,
        C.REGISTROS_HORARIOS_STAFF,
        C.HISTORICO_CIERRES_Z,
    ]) {
        assert.throws(() => assertUpdateAllowed(collection, {
            _id: "synthetic-ledger-row",
        }), { code: "CMS_UPDATE_COLLECTION_DENIED" });
    }
    assert.throws(() => assertUpdateAllowed(O.CONTROL_OPERATIVO, {
        controlType: T.SYSTEM_FLAG,
    }), { code: "CMS_UPDATE_ID_REQUIRED" });
});
test("removed CMS collections are absent from the canonical registry", () => {
    assert.equal(C.TPV_IDENTITIES, undefined);
    assert.equal(C.PAQUETES_GESTORIA, undefined);
});
test("MovimientosCaja rejects all new TPV ledger writes and remains append-only", () => {
    const item = {
        _id: "TPV_TEST_ROW",
        recordSource: "TPV_LEDGER",
        movementType: "TPV_PAYMENT",
        traceId: "TPV:site:session",
        sequenceNumber: 1,
        hash: "a".repeat(64),
    };
    assert.throws(() => assertInsertAllowed(C.MOVIMIENTOS_CAJA, item), {
        code: "CMS_TPV_LEDGER_WRITES_DISABLED",
    });
    assert.throws(() => assertUpdateAllowed(C.MOVIMIENTOS_CAJA, item), {
        code: "CMS_UPDATE_COLLECTION_DENIED",
    });
    assert.throws(() => assertRemoveAllowed(C.MOVIMIENTOS_CAJA, item._id, undefined, item), {
        code: "CMS_REMOVE_SCOPE_DENIED",
    });
});

test("WEBHOOK_EVENT is neither mutable nor removable", () => {
    assert.throws(() => assertUpdateAllowed(O.CONTROL_OPERATIVO, {
        _id: "event-1",
        controlType: T.WEBHOOK_EVENT,
    }), { code: "CMS_UPDATE_CONTROL_TYPE_DENIED" });
    assert.throws(() => assertRemoveAllowed(O.CONTROL_OPERATIVO, "event-1", T.WEBHOOK_EVENT), {
        code: "CMS_REMOVE_SCOPE_DENIED",
    });
});

test("save policy is limited to DAYS_CACHE and identified CajaActual records", () => {
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
    assert.throws(() => assertSaveAllowed(C.CITAS_F2, {
        _id: "projection-1",
        bookingId: "booking-1",
    }), { code: "CMS_SAVE_COLLECTION_DENIED" });
    assert.throws(() => assertSaveAllowed(O.CONTROL_OPERATIVO, {
        _id: "event-1",
        controlType: T.WEBHOOK_EVENT,
    }), { code: "CMS_SAVE_CONTROL_TYPE_DENIED" });
});

test("single-item removal keeps ControlOperativo scoped and denies append-only ledgers", () => {
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
    for (const collection of [
        C.MOVIMIENTOS_CAJA,
        C.LIBRO_ASIENTOS_CONTABLES_DETALLE,
        C.REGISTROS_HORARIOS_STAFF,
        C.HISTORICO_CIERRES_Z,
    ]) {
        assert.throws(() => assertRemoveAllowed(collection, "synthetic-ledger-row"), {
            code: "CMS_REMOVE_SCOPE_DENIED",
        });
    }
});
test("bulk update is disabled and bulk remove requires an allowlisted conditional purge", () => {
    const cutoff = new Date("2026-11-14T00:00:00.000Z");
    for (const collection of Object.values(C)) {
        assert.throws(() => assertBulkUpdateAllowed(collection, [{ _id: "synthetic-row-1" }]), {
            code: "CMS_BULK_UPDATE_SCOPE_DENIED",
        });
    }

    const ttlFilter = (controlType) => ({
        condition: { filter: {
            controlType: { $eq: controlType },
            expiresAt: { $lt: cutoff },
        } },
    });
    for (const controlType of [
        T.SLOT_LOCK, T.RATE_LIMIT, T.DISPLAY_TOKEN, T.DUAL_CACHE, T.DAYS_CACHE,
    ]) {
        assert.doesNotThrow(() => assertBulkRemoveAllowed(
            C.CONTROL_OPERATIVO, ["synthetic-row-1"], ttlFilter(controlType)
        ));
    }

    const statusFilter = (controlType, status, dateField) => ({
        condition: { filter: {
            controlType: { $eq: controlType },
            status: { $eq: status },
            [dateField]: { $lt: cutoff },
        } },
    });
    assert.doesNotThrow(() => assertBulkRemoveAllowed(
        C.CONTROL_OPERATIVO, ["synthetic-row-1"],
        statusFilter(T.IDEMPOTENCY, "COMPLETED", "_updatedDate")
    ));
    assert.doesNotThrow(() => assertBulkRemoveAllowed(
        C.CONTROL_OPERATIVO, ["synthetic-row-1"],
        statusFilter(T.SYSTEM_FLAG, "RECONCILED", "_updatedDate")
    ));
    assert.doesNotThrow(() => assertBulkRemoveAllowed(
        C.CONTROL_OPERATIVO, ["synthetic-row-1"],
        statusFilter(T.ALERT, "CLOSED", "_createdDate")
    ));
    assert.doesNotThrow(() => assertBulkRemoveAllowed(
        C.CONTROL_OPERATIVO, ["synthetic-row-1"],
        statusFilter(T.COMPENSATION, "EXECUTED", "_createdDate")
    ));

    assert.throws(() => assertBulkRemoveAllowed(C.CONTROL_OPERATIVO, ["synthetic-row-1"]), {
        code: "CMS_BULK_REMOVE_SCOPE_DENIED",
    });
    for (const controlType of [T.WEBHOOK_EVENT, T.DEDUPE_KEY, T.LEDGER_IDEMPOTENCY, T.WEBHOOK_CLAIM]) {
        assert.throws(() => assertBulkRemoveAllowed(
            C.CONTROL_OPERATIVO, ["synthetic-row-1"], ttlFilter(controlType)
        ), { code: "CMS_BULK_REMOVE_SCOPE_DENIED" });
    }
    assert.throws(() => assertBulkRemoveAllowed(
        C.CONTROL_OPERATIVO, ["synthetic-row-1"],
        statusFilter(T.IDEMPOTENCY, "IN_PROGRESS", "_updatedDate")
    ), { code: "CMS_BULK_REMOVE_SCOPE_DENIED" });
    assert.throws(() => assertBulkRemoveAllowed(
        C.MOVIMIENTOS_CAJA, ["synthetic-row-1"], ttlFilter(T.DUAL_CACHE)
    ), { code: "CMS_BULK_REMOVE_SCOPE_DENIED" });
    assert.throws(() => assertBulkRemoveAllowed(
        C.CONTROL_OPERATIVO, ["synthetic-row-1"],
        { condition: { filter: {
            controlType: { $eq: T.DUAL_CACHE },
            expiresAt: { $lt: "2026-11-14T00:00:00.000Z" },
        } } }
    ), { code: "CMS_BULK_REMOVE_SCOPE_DENIED" });
});
test("DATAACCESS-MOVIMIENTOS-APPEND-01 public bulk mutation APIs reject MovimientosCaja", () => {
    assert.throws(
        () => bulkUpdate(C.MOVIMIENTOS_CAJA, [{ _id: "synthetic-row", totalAmount: 1 }]),
        { code: "CMS_BULK_UPDATE_SCOPE_DENIED" }
    );
    assert.throws(
        () => bulkRemove(C.MOVIMIENTOS_CAJA, ["synthetic-row"], {
            condition: { filter: {
                controlType: { $eq: T.DUAL_CACHE },
                expiresAt: { $lt: new Date("2026-11-14T00:00:00.000Z") },
            } },
        }),
        { code: "CMS_BULK_REMOVE_SCOPE_DENIED" }
    );
});

test("bulk insert remains disabled during isolated-site mutation window", () => {
    assert.throws(() => assertBulkMutationDisabled("BULK_INSERT"), {
        code: "CMS_BULK_INSERT_DISABLED_NO_APPROVED_CONSUMERS",
    });
});
