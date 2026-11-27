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
import { assertTransaccionesTPVRecord } from "backend/validation";
import {
    BUSINESS_COLLECTIONS as C,
    OPERATIONAL_COLLECTIONS as O,
    CONTROL_TYPE as T,
    RECORD_TYPE,
    DATA_ACCESS_WRITE_POLICY,
    TPV_LEGACY_EVENT_MOVEMENT_TYPES,
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
        }), { code: "LEDGER_APPEND_ONLY" });
    }
    assert.throws(() => assertUpdateAllowed(O.CONTROL_OPERATIVO, {
        controlType: T.SYSTEM_FLAG,
    }), { code: "CMS_UPDATE_ID_REQUIRED" });
});
test("removed CMS collections are absent from the canonical registry", () => {
    assert.equal(C.TPV_IDENTITIES, undefined);
    assert.equal(C.PAQUETES_GESTORIA, undefined);
});
test("MovimientosCaja permits current physical TPV events but remains append-only", () => {
    const item = {
        _id: "TPV_TEST_ROW",
        recordSource: "TPV_LEDGER",
        movementType: "TPV_PAYMENT",
        traceId: "TPV:site:session",
        sequenceNumber: 1,
        hash: "a".repeat(64),
    };
    assert.doesNotThrow(() => assertInsertAllowed(C.MOVIMIENTOS_CAJA, item));
    assert.throws(() => assertUpdateAllowed(C.MOVIMIENTOS_CAJA, item), {
        code: "LEDGER_APPEND_ONLY",
    });
    assert.throws(() => assertRemoveAllowed(C.MOVIMIENTOS_CAJA, item._id, undefined, item), {
        code: "LEDGER_APPEND_ONLY",
    });
});

test("TransaccionesTPV validates backend-priced records and permits validated edits", () => {
    const record = {
        _id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
        sessionId: "TPV-SESSION-20261125",
        orderId: null,
        lineas: [{
            tipoLinea: "PRODUCTO",
            itemId: "e556070a-6d6a-402e-8422-11133033ea76",
            cantidad: 1,
            precioUnitario: 10,
            subtotalNeto: 10,
            impuestosImporte: 2.1,
            totalLinea: 12.1,
        }],
        subtotalNeto: 10,
        subtotalNetoMinor: 1000,
        impuestosTotal: 2.1,
        impuestosTotalMinor: 210,
        totalVenta: 12.1,
        totalVentaMinor: 1210,
        medioPago: null,
        paymentSelection: [],
        operatorResourceId: "e556070a-6d6a-402e-8422-11133033ea76",
        operatorId: "0114748d-2806-3928-9b97-ff0d09853759",
        createdAt: new Date("2026-11-25T10:00:00.000Z"),
        status: "PENDING_PAYMENT",
        sourceType: "TPV",
        recordTimestamp: new Date("2026-11-25T10:00:00.000Z"),
        requiresReconciliation: true,
        draftOrderReason: "DRAFT_ORDER_API_UNAVAILABLE",
        requestFingerprint: "a".repeat(64),
        currency: "EUR",
        traceId: "tpv-sale-test",
    };
    assert.equal(assertTransaccionesTPVRecord(record), true);
    assert.doesNotThrow(() => assertInsertAllowed(C.TRANSACCIONES_TPV, record));
    assert.doesNotThrow(() => assertUpdateAllowed(C.TRANSACCIONES_TPV, record));
    assert.throws(() => assertRemoveAllowed(C.TRANSACCIONES_TPV, record._id, undefined, record), { code: "CMS_DELETE_PROHIBITED" });
    assert.doesNotThrow(() => assertUpdateAllowed(C.TRANSACCIONES_TPV, { ...record, status: "PAID" }));
    assert.throws(() => assertRemoveAllowed(C.TRANSACCIONES_TPV, record._id, undefined, { ...record, sourceType: "TPV" }), { code: "CMS_DELETE_PROHIBITED" });
    assert.doesNotThrow(() => assertTransaccionesTPVRecord({ ...record, status: "PAID" }));
});

test("MovimientosCaja accepts legacy movement aliases without environment classification", () => {
    for (const movementType of new Set(Object.values(TPV_LEGACY_EVENT_MOVEMENT_TYPES))) {
        assert.doesNotThrow(() => assertInsertAllowed(C.MOVIMIENTOS_CAJA, {
            recordSource: "TPV_LEDGER",
            movementType,
        }), movementType);
    }
    for (const recordSource of ["TPV_SYNTHETIC", "TPV_SANDBOX_SYNTHETIC", "SANDBOX_LOGICAL_PAGOS"]) {
        assert.doesNotThrow(() => assertInsertAllowed(C.MOVIMIENTOS_CAJA, {
            recordSource,
            movementType: "COBRO",
        }), recordSource);
    }
});

test("WEBHOOK_EVENT is neither mutable nor removable", () => {
    assert.throws(() => assertUpdateAllowed(O.CONTROL_OPERATIVO, {
        _id: "event-1",
        controlType: T.WEBHOOK_EVENT,
    }), { code: "CMS_UPDATE_CONTROL_TYPE_DENIED" });
    assert.throws(() => assertRemoveAllowed(O.CONTROL_OPERATIVO, "event-1", T.WEBHOOK_EVENT), {
        code: "CMS_DELETE_PROHIBITED",
    });
    assert.doesNotThrow(() => assertRemoveAllowed(O.CONTROL_OPERATIVO, "cache-1", T.DUAL_CACHE));
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

test("physical deletion is prohibited for every collection", () => {
    for (const collection of Object.values(C).filter((value) => value !== C.CONTROL_OPERATIVO).concat(Object.values(O).filter((value) => value !== O.CONTROL_OPERATIVO))) {
        assert.throws(() => assertRemoveAllowed(collection, "existing-row", T.DUAL_CACHE), (error) =>
            ["CMS_DELETE_PROHIBITED", "LEDGER_APPEND_ONLY"].includes(error?.code)
        );
    }
    assert.throws(() => assertRemoveAllowed(O.CONTROL_OPERATIVO, "event-1", T.WEBHOOK_EVENT), {
        code: "CMS_DELETE_PROHIBITED",
    });

    for (const collection of [
        C.MOVIMIENTOS_CAJA,
        C.LIBRO_ASIENTOS_CONTABLES_DETALLE,
        C.REGISTROS_HORARIOS_STAFF,
        C.HISTORICO_CIERRES_Z,
    ]) {
        assert.throws(() => assertRemoveAllowed(collection, "synthetic-ledger-row"), {
            code: "LEDGER_APPEND_ONLY",
        });
    }
});
test("bulk update and bulk deletion are prohibited", () => {
    const cutoff = new Date("2026-11-14T00:00:00.000Z");
    for (const collection of Object.values(C)) {
        assert.throws(() => assertBulkUpdateAllowed(collection, [{ _id: "synthetic-row-1" }]), {
            code: "CMS_BULK_UPDATE_SCOPE_DENIED",
        });
    }

    for (const collection of Object.values(C).concat(Object.values(O))) {
        assert.throws(() => assertBulkRemoveAllowed(collection, ["existing-row"]), {
            code: "CMS_BULK_DELETE_PROHIBITED",
        });
    }
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
        { code: "CMS_BULK_DELETE_PROHIBITED" }
    );
});

test("bulk insert remains disabled during isolated-site mutation window", () => {
    assert.throws(() => assertBulkMutationDisabled("BULK_INSERT"), {
        code: "CMS_BULK_INSERT_DISABLED_NO_APPROVED_CONSUMERS",
    });
});
