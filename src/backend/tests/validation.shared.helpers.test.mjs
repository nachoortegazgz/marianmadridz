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

test("VALIDATION-FISCAL-01 validates Spanish NIF/NIE/CIF and EU VAT using shared helper", () => {
    assert.equal(V.isValidNifOrEuVat("12345678Z"), true);
    assert.equal(V.isValidNifOrEuVat("X1234567L"), true);
    assert.equal(V.isValidNifOrEuVat("B12345674"), true);
    assert.equal(V.isValidNifOrEuVat("DE123456789"), true);
    assert.equal(V.isValidNifOrEuVat("12345678A"), false);
    assert.equal(V.isValidNifOrEuVat(""), false);
});

test("VALIDATION-FISCAL-02 DatosFiscales third-party validation uses the shared fiscal helper", () => {
    assert.equal(V.assertDatosFiscalesRecord({
        recordType: "TERCERO",
        taxId: "12345678Z",
        legalName: "Entidad de prueba",
        thirdPartyType: "CLIENTE",
    }), true);

    assert.throws(() => V.assertDatosFiscalesRecord({
        recordType: "TERCERO",
        taxId: "12345678A",
        legalName: "Entidad de prueba",
        thirdPartyType: "CLIENTE",
    }), /taxId/);
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

test("VALIDATION-FISCAL-03 supports partial DatosFiscales updates while validating supplied fields", () => {
    assert.equal(V.assertDatosFiscalesRecord({
        recordType: "TERCERO",
        taxId: "12345678Z",
    }, { partial: true }), true);
    assert.throws(
        () => V.assertDatosFiscalesRecord({
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
        active: true,
        schemaVersion: 1,
    };
    assert.equal(V.assertMapaStaffRecord(staff), true);
    assert.throws(() => V.assertMapaStaffRecord({ ...staff, scheduleId: undefined }), /scheduleId/);
    assert.throws(() => V.assertMapaStaffRecord({ ...staff, active: "true" }), /active must be BOOLEAN/);
    assert.throws(() => V.assertMapaStaffRecord({ ...staff, thirdPartyId: 123 }), /thirdPartyId must be TEXT/);
});
