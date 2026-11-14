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

test("broad isolated-site mutation window is fail-closed until runtime site binding is verified", () => {
    assert.equal(ISOLATED_SITE_RECORD_MUTATIONS_ENABLED, false);
    assert.equal(APPEND_ONLY_MUTATION_WINDOW.ENABLED, false);
    assert.equal(APPEND_ONLY_MUTATION_WINDOW.TEMPORARY, false);
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
    // DatosFiscales is a canonical project-owned collection in the current site.
    assert.equal(ISOLATED_SITE_MUTABLE_COLLECTIONS.includes(C.DATOS_FISCALES), true);
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
        staffMemberId: "0114748d-2806-3928-9b97-ff0d09853759",
        resourceId: "e556070a-6d6a-402e-8422-11133033ea76",
        scheduleId: "06af20d4-1ec3-49fa-9075-f0691dfa7fd4",
        active: true,
    }));
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
        C.PAQUETES_GESTORIA,
    ]) {
        assert.throws(() => assertUpdateAllowed(collection, {
            _id: "synthetic-ledger-row",
        }), { code: "CMS_UPDATE_COLLECTION_DENIED" });
    }
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

test("single-item removal keeps ControlOperativo scoped and denies append-only ledgers", () => {
    assert.doesNotThrow(() => assertRemoveAllowed(O.CONTROL_OPERATIVO, "cache-1", T.DUAL_CACHE));
    assert.doesNotThrow(() => assertRemoveAllowed(O.CONTROL_OPERATIVO, "token-1", T.DISPLAY_TOKEN));
    assert.doesNotThrow(() => assertRemoveAllowed(O.CONTROL_OPERATIVO, "lock-1", T.SLOT_LOCK));
    assert.doesNotThrow(() => assertRemoveAllowed(O.CONTROL_OPERATIVO, "claim-1", T.IDEMPOTENCY));
    assert.doesNotThrow(() => assertRemoveAllowed(O.CONTROL_OPERATIVO, "event-1", T.WEBHOOK_EVENT));
    assert.throws(() => assertRemoveAllowed(O.CONTROL_OPERATIVO, "cache-1"), {
        code: "CMS_REMOVE_SCOPE_DENIED",
    });
    for (const collection of [
        C.MOVIMIENTOS_CAJA,
        C.LIBRO_ASIENTOS_CONTABLES_DETALLE,
        C.REGISTROS_HORARIOS_STAFF,
        C.HISTORICO_CIERRES_Z,
        C.PAQUETES_GESTORIA,
    ]) {
        assert.throws(() => assertRemoveAllowed(collection, "synthetic-ledger-row"), {
            code: "CMS_REMOVE_SCOPE_DENIED",
        });
    }
});
test("bulk update/remove remain disabled while the broad mutation window is closed", () => {
    for (const collection of ISOLATED_SITE_MUTABLE_COLLECTIONS) {
        assert.throws(() => assertBulkUpdateAllowed(collection, [{ _id: "synthetic-row-1" }]), {
            code: "CMS_BULK_UPDATE_SCOPE_DENIED",
        });
        assert.throws(() => assertBulkRemoveAllowed(collection, ["synthetic-row-1"]), {
            code: "CMS_BULK_REMOVE_SCOPE_DENIED",
        });
    }
    assert.throws(() => assertBulkUpdateAllowed(C.CAJA_ACTUAL, [{ value: true }]), {
        code: "CMS_BULK_UPDATE_SCOPE_DENIED",
    });
    assert.throws(() => assertBulkRemoveAllowed(C.CAJA_ACTUAL, []), {
        code: "CMS_BULK_REMOVE_SCOPE_DENIED",
    });
});
test("bulk insert remains disabled during isolated-site mutation window", () => {
    assert.throws(() => assertBulkMutationDisabled("BULK_INSERT"), {
        code: "CMS_BULK_INSERT_DISABLED_NO_APPROVED_CONSUMERS",
    });
});
