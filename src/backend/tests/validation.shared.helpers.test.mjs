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
