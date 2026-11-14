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
import {
    BUSINESS_COLLECTIONS as C,
    ISOLATED_SITE_MUTABLE_COLLECTIONS,
    OPERATIONAL_COLLECTIONS as O,
    CONTROL_TYPE as T,
    RECORD_TYPE,
    APPEND_ONLY_MUTATION_WINDOW,
    ISOLATED_SITE_RECORD_MUTATIONS_ENABLED,
    DATA_ACCESS_WRITE_POLICY,
} from "backend/internalConfig";

test("isolated-site mutation policy enables update/remove without enabling insert", () => {
    assert.equal(ISOLATED_SITE_RECORD_MUTATIONS_ENABLED, true);
    assert.equal(APPEND_ONLY_MUTATION_WINDOW.ENABLED, true);
    assert.equal(APPEND_ONLY_MUTATION_WINDOW.TEMPORARY, true);
    assert.equal(APPEND_ONLY_MUTATION_WINDOW.RESTORE_BEFORE_REAL_OPERATIONS, true);
});

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

test("retired custom inventory collections are excluded from the canonical CMS allowlist", () => {
    assert.equal(Object.hasOwn(C, "INVENTARIO_STOCK_VENTA"), false);
    assert.equal(Object.hasOwn(C, "MOVIMIENTOS_INVENTARIO"), false);
    assert.equal(ISOLATED_SITE_MUTABLE_COLLECTIONS.includes("InventarioStockVenta"), false);
    assert.equal(ISOLATED_SITE_MUTABLE_COLLECTIONS.includes("MovimientosInventario"), false);
    // DatosFiscales remains a separate, owner-authorized isolated-site compatibility scope.
    assert.equal(ISOLATED_SITE_MUTABLE_COLLECTIONS.includes("DatosFiscales"), true);
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
        recordType: RECORD_TYPE.TERCERO,
        taxId: "X0000000X",
    }));
    assert.doesNotThrow(() => assertInsertAllowed(C.MAPA_STAFF, {
        recordType: RECORD_TYPE.GESTORIA,
        name: "NachoGest",
        email: "gestoria@example.test",
    }));
    assert.doesNotThrow(() => assertInsertAllowed(C.MAPA_STAFF, {
        recordType: RECORD_TYPE.STAFF,
        staffMemberId: "synthetic-staff-member",
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
    }), { code: "CMS_INSERT_FISCAL_RECORD_TYPE_INVALID" });
});

test("update policy allows mutable state and all append-only ledgers during temporary window", () => {
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
    assert.doesNotThrow(() => assertUpdateAllowed(C.CITAS_F2, {
        _id: "projection-1",
        bookingStatus: "CONFIRMED",
    }));
    assert.throws(() => assertUpdateAllowed(C.MOVIMIENTOS_CAJA, {
        amount: 1,
    }), { code: "CMS_UPDATE_ID_REQUIRED" });
    for (const collection of [
        C.MOVIMIENTOS_CAJA,
        C.LIBRO_ASIENTOS_CONTABLES_DETALLE,
        C.REGISTROS_HORARIOS_STAFF,
        C.HISTORICO_CIERRES_Z,
        C.PAQUETES_GESTORIA,
    ]) {
        assert.doesNotThrow(() => assertUpdateAllowed(collection, {
            _id: "temporary-ledger-row",
        }));
    }
    assert.doesNotThrow(() => assertUpdateAllowed(O.CONTROL_OPERATIVO, {
        _id: "webhook-1",
        controlType: T.WEBHOOK_EVENT,
    }));
    assert.throws(() => assertUpdateAllowed(O.CONTROL_OPERATIVO, {
        controlType: T.SYSTEM_FLAG,
    }), { code: "CMS_UPDATE_ID_REQUIRED" });
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

test("single-item removal allows ledgers during temporary window and keeps ControlOperativo scoped", () => {
    assert.doesNotThrow(() => assertRemoveAllowed(O.CONTROL_OPERATIVO, "cache-1", T.DUAL_CACHE));
    assert.doesNotThrow(() => assertRemoveAllowed(O.CONTROL_OPERATIVO, "token-1", T.DISPLAY_TOKEN));
    assert.doesNotThrow(() => assertRemoveAllowed(O.CONTROL_OPERATIVO, "lock-1", T.SLOT_LOCK));
    assert.doesNotThrow(() => assertRemoveAllowed(O.CONTROL_OPERATIVO, "claim-1", T.IDEMPOTENCY));
    assert.doesNotThrow(() => assertRemoveAllowed(O.CONTROL_OPERATIVO, "event-1", T.WEBHOOK_EVENT));
    assert.doesNotThrow(() => assertRemoveAllowed(O.CONTROL_OPERATIVO, "cache-1"));
    for (const collection of [
        C.MOVIMIENTOS_CAJA,
        C.LIBRO_ASIENTOS_CONTABLES_DETALLE,
        C.REGISTROS_HORARIOS_STAFF,
        C.HISTORICO_CIERRES_Z,
        C.PAQUETES_GESTORIA,
    ]) {
        assert.doesNotThrow(() => assertRemoveAllowed(collection, "temporary-ledger-row"));
    }
});

test("bulk update/remove allow explicit IDs for all project-owned business collections", () => {
    for (const collection of ISOLATED_SITE_MUTABLE_COLLECTIONS) {
        assert.doesNotThrow(() => assertBulkUpdateAllowed(collection, [{ _id: "isolated-row-1", value: true }]));
        assert.doesNotThrow(() => assertBulkRemoveAllowed(collection, ["isolated-row-1"]));
    }
    assert.throws(() => assertBulkUpdateAllowed(C.CAJA_ACTUAL, [{ value: true }]), {
        code: "CMS_BULK_UPDATE_SCOPE_DENIED",
    });
    assert.throws(() => assertBulkRemoveAllowed(C.CAJA_ACTUAL, []), {
        code: "CMS_BULK_REMOVE_SCOPE_DENIED",
    });
    assert.doesNotThrow(() => assertBulkUpdateAllowed("DatosFiscales", [{ _id: "legacy-synthetic-row" }]));
    assert.doesNotThrow(() => assertBulkRemoveAllowed("DatosFiscales", ["legacy-synthetic-row"]));
    assert.throws(() => assertBulkUpdateAllowed("WixAppCollection", [{ _id: "isolated-row-1" }]), {
        code: "CMS_BULK_UPDATE_SCOPE_DENIED",
    });
    assert.throws(() => assertBulkRemoveAllowed("WixAppCollection", ["isolated-row-1"]), {
        code: "CMS_BULK_REMOVE_SCOPE_DENIED",
    });
});

test("bulk insert remains disabled during isolated-site mutation window", () => {
    assert.throws(() => assertBulkMutationDisabled("BULK_INSERT"), {
        code: "CMS_BULK_INSERT_DISABLED_NO_APPROVED_CONSUMERS",
    });
});
