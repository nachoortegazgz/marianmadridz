import assert from "node:assert/strict";
import { test } from "node:test";
import { makeRequestFingerprint, stableSerialize } from "backend/tpv/tpvUtils";

test("stableSerialize is deterministic for JSON-compatible objects", () => {
    const first = { z: 2, nested: { b: true, a: null }, a: "value" };
    const second = { a: "value", nested: { a: null, b: true }, z: 2 };

    assert.equal(stableSerialize(first), stableSerialize(second));
    assert.equal(stableSerialize(first), '{"a":"value","nested":{"a":null,"b":true},"z":2}');
});

test("stableSerialize preserves canonical date representation", () => {
    assert.equal(
        stableSerialize({ recordedAt: new Date("2026-11-27T12:00:00.000Z") }),
        '{"recordedAt":"2026-11-27T12:00:00.000Z"}'
    );
});

test("stableSerialize rejects undefined instead of colliding with an empty array", () => {
    assert.throws(() => stableSerialize([undefined]), /TPV_FINGERPRINT_UNSUPPORTED_VALUE/);
    assert.throws(() => stableSerialize({ value: undefined }), /TPV_FINGERPRINT_UNSUPPORTED_VALUE/);
    assert.notEqual(stableSerialize([]), stableSerialize([null]));
});

test("stableSerialize rejects sparse arrays and non-finite numbers", () => {
    const sparse = [];
    sparse.length = 1;

    assert.throws(() => stableSerialize(sparse), /TPV_FINGERPRINT_SPARSE_ARRAY/);
    assert.throws(() => stableSerialize(Number.NaN), /TPV_FINGERPRINT_NON_FINITE_NUMBER/);
    assert.throws(() => stableSerialize(Number.POSITIVE_INFINITY), /TPV_FINGERPRINT_NON_FINITE_NUMBER/);
});

test("stableSerialize rejects unsupported values and object types", () => {
    assert.throws(() => stableSerialize(1n), /TPV_FINGERPRINT_UNSUPPORTED_VALUE/);
    assert.throws(() => stableSerialize(() => null), /TPV_FINGERPRINT_UNSUPPORTED_VALUE/);
    assert.throws(() => stableSerialize(Symbol("value")), /TPV_FINGERPRINT_UNSUPPORTED_VALUE/);
    assert.throws(() => stableSerialize(new Map()), /TPV_FINGERPRINT_UNSUPPORTED_OBJECT/);
    assert.throws(() => stableSerialize(new Date("invalid")), /TPV_FINGERPRINT_INVALID_DATE/);
});

test("stableSerialize rejects cycles, symbol keys and accessor properties", () => {
    const cyclic = {};
    cyclic.self = cyclic;
    const symbolKeyed = { [Symbol("hidden")]: "value" };
    const accessor = Object.defineProperty({}, "value", {
        enumerable: true,
        get() { return "unstable"; }
    });

    assert.throws(() => stableSerialize(cyclic), /TPV_FINGERPRINT_CIRCULAR_REFERENCE/);
    assert.throws(() => stableSerialize(symbolKeyed), /TPV_FINGERPRINT_SYMBOL_KEY/);
    assert.throws(() => stableSerialize(accessor), /TPV_FINGERPRINT_ACCESSOR_PROPERTY/);
});

test("makeRequestFingerprint hashes only valid canonical payloads", () => {
    const fingerprint = makeRequestFingerprint({ b: 2, a: 1 });

    assert.match(fingerprint, /^[a-f0-9]{64}$/);
    assert.equal(fingerprint, makeRequestFingerprint({ a: 1, b: 2 }));
    assert.throws(() => makeRequestFingerprint([undefined]), /TPV_FINGERPRINT_UNSUPPORTED_VALUE/);
});
