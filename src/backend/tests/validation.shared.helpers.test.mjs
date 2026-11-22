import test from "node:test";
import assert from "node:assert";

const V = await import("backend/validation");
const IC = await import("backend/internalConfig");

test("VALIDATION-ENUM-01 accepts canonical enum values and rejects unknown values", () => {
    assert.equal(V.assertValidEnum(IC.RECORD_TYPE.TERCERO, IC.RECORD_TYPE, "recordType"), true);
    assert.throws(
        () => V.assertValidEnum("NOT_A_RECORD_TYPE", IC.RECORD_TYPE, "recordType"),
        /recordType invalido/
    );
});

test("VALIDATION-MAPA-01 rejects incomplete MapaStaff insert records", () => {
    assert.throws(() => V.assertMapaStaffRecord({}), /recordType invalido/);
});

test("VALIDATION-MOVEMENT-01 validates required movement enums before any side effect", () => {
    assert.equal(V.assertFiscalMovementInputEnums({
        movementType: IC.MOVEMENT_TYPE.VENTA,
        paymentMethod: IC.PAYMENT_METHOD.EFECTIVO,
        channelType: IC.CHANNEL_TYPE.PRESENCIAL,
        tipoFactura: IC.TIPO_FACTURA.F2,
    }), true);
    assert.throws(() => V.assertFiscalMovementInputEnums({
        movementType: IC.MOVEMENT_TYPE.VENTA,
        paymentMethod: IC.PAYMENT_METHOD.EFECTIVO,
        channelType: "POS",
        tipoFactura: IC.TIPO_FACTURA.F2,
    }), /channelType invalido/);
});

test("VALIDATION-FISCAL-01 validates Spanish NIF/NIE/CIF and EU VAT using shared helper", () => {
    assert.equal(V.isValidNifOrEuVat("12345678Z"), true);
    assert.equal(V.isValidNifOrEuVat("X1234567L"), true);
    assert.equal(V.isValidNifOrEuVat("B12345674"), true);
    assert.equal(V.isValidNifOrEuVat("DE123456789"), true);
    assert.equal(V.isValidNifOrEuVat("12345678A"), false);
    assert.equal(V.isValidNifOrEuVat(""), false);
});

test("VALIDATION-FISCAL-02 MapaStaff fiscal record types use the shared fiscal validator", () => {
    assert.equal(V.assertMapaStaffRecord({
        recordType: "TERCERO",
        taxId: "12345678Z",
        legalName: "Entidad de prueba",
        thirdPartyType: "CLIENTE",
        schemaVersion: 1,
        traceId: "validation-third-party",
    }), true);

    assert.throws(() => V.assertMapaStaffRecord({
        recordType: "TERCERO",
        taxId: "12345678A",
        legalName: "Entidad de prueba",
        thirdPartyType: "CLIENTE",
        schemaVersion: 1,
        traceId: "validation-third-party-invalid",
    }), /taxId/);
});


test("VALIDATION-PACKAGE-01 validates accountant package snapshots centrally", () => {
    const valid = {
        periodType: "QUARTERLY",
        fiscalYear: 2026,
        fiscalQuarter: 1,
        packageVersion: 1,
        summaryData: { totalOperaciones: 1 },
        invoiceData: [{ invoiceNumber: "F-1" }],
        packageStatus: "PREPARED",
        createdAt: "2026-11-11T20:05:00.000Z",
        snapshotHash: "a".repeat(64),
        schemaVersion: "1.0",
        source: "FISCAL_AGGREGATOR",
        traceId: "trace-package-validation-1",
    };
    assert.equal(V.assertPaquetesGestoriaRecord(valid), true);
    assert.throws(() => V.assertPaquetesGestoriaRecord({ ...valid, createdAt: "invalid" }), /createdAt/);
    assert.throws(() => V.assertPaquetesGestoriaRecord({ ...valid, fiscalMonth: 2 }), /no admite fiscalMonth/);
    assert.throws(() => V.assertPaquetesGestoriaRecord({ ...valid, packageStatus: "SENT" }), /PREPARED/);
});

test("VALIDATION-CAJA-01 validates CajaActual object schema without MapaStaff requirements", () => {
    assert.equal(V.assertCajaActualRecord({
        singletonKey: "CAJA_PRINCIPAL",
        sequenceCounters: { seqGlobal: 3, appliedMovementIds: ["movement-1"] },
    }), true);
    assert.throws(
        () => V.assertCajaActualRecord({ sequenceCounters: '{"seqGlobal":3}' }),
        /sequenceCounters must be an OBJECT/
    );
    assert.throws(
        () => V.assertCajaActualRecord({ sequenceCounters: { appliedMovementIds: "movement-1" } }),
        /appliedMovementIds must be an ARRAY/
    );
});

test("VALIDATION-FISCAL-03 supports partial MapaStaff fiscal updates while validating supplied fields", () => {
    assert.equal(V.assertMapaStaffRecord({
        recordType: "TERCERO",
        taxId: "12345678Z",
    }, { partial: true }), true);
    assert.throws(
        () => V.assertMapaStaffRecord({
            recordType: "TERCERO",
            taxId: "12345678A",
        }, { partial: true }),
        /valid taxId/
    );
});


test("VALIDATION-MAPASTAFF-01 validates native staff identity fields without fiscal discriminators", () => {
    const staff = {
        staffMemberId: "0114748d-2806-3928-9b97-ff0d09853759",
        resourceId: "e556070a-6d6a-402e-8422-11133033ea76",
        scheduleId: "06af20d4-1ec3-49fa-9075-f0691dfa7fd4",
        memberId: "e52404b1-7a72-4b99-b231-66c4dc413421",
        recordType: IC.RECORD_TYPE.STAFF,
        schemaVersion: 1,
    };
    assert.equal(V.assertMapaStaffRecord(staff), true);
    assert.throws(() => V.assertMapaStaffRecord({ ...staff, recordType: "staff" }), /recordType invalido/);
    assert.throws(() => V.assertMapaStaffRecord({ ...staff, scheduleId: undefined }), /scheduleId/);
    assert.throws(() => V.assertMapaStaffRecord({ ...staff, thirdPartyId: 123 }), /thirdPartyId must be TEXT/);
});


test("VALIDATION-TPV-IDENTITY-01 accepts only synthetic Sandbox customer and staff records", () => {
    const base = {
        identityId: "TPV-CUSTOMER-001",
        identityType: "CUSTOMER",
        displayName: "Cliente Sintético 01",
        email: "cliente.sandbox@example.test",
        active: true,
        syntheticOnly: true,
        environment: "SANDBOX",
        testRunId: IC.TPV_RUNTIME_POLICY.SANDBOX_RUN_ID,
        metadata: {},
    };
    assert.equal(V.assertTpvSandboxIdentity(base), true);
    assert.equal(V.assertTpvSandboxIdentity({ ...base, identityId: "SANDBOX-CUSTOMER-001" }), true, "legacy IDs remain readable");
    assert.throws(() => V.assertTpvSandboxIdentity({ ...base, environment: "LIVE" }), /Sandbox/);
    assert.throws(() => V.assertTpvSandboxIdentity({ ...base, syntheticOnly: false }), /synthetic Sandbox/);
    assert.throws(() => V.assertTpvSandboxIdentity({ ...base, email: "cliente@real.es" }), /example.test/);
    assert.throws(() => V.assertTpvSandboxIdentity({ ...base, phone: "+34600000000" }), /unsupported fields/);
    assert.throws(() => V.assertTpvSandboxIdentity({ ...base, metadata: { externalId: "real-id" } }), /empty OBJECT/);
    assert.throws(() => V.assertTpvSandboxIdentity({ ...base, displayName: "Nombre Real" }), /displayName/);
    assert.equal(V.assertTpvSandboxIdentity({
        ...base,
        identityId: "TPV-STAFF-001",
        identityType: "STAFF",
        displayName: "Profesional Sintético 01",
        email: "staff.sandbox@example.test",
    }), true);
});
