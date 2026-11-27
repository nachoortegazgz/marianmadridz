import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BOOKING_TYPE,
  isDualBookingType,
  normalizeBookingType,
} from "../internalConfig.js";
import { assertValidEnum } from "../validation.js";

test("booking type normalization never invents SIMPLE for missing values", () => {
  for (const value of [undefined, null, "", "   "]) {
    assert.equal(normalizeBookingType(value), "");
    assert.equal(isDualBookingType(value), false);
    assert.throws(
      () => assertValidEnum(normalizeBookingType(value), BOOKING_TYPE, "bookingType"),
      /SCHEMA_VIOLATION/
    );
  }
});

test("booking type normalization preserves canonical and historical explicit values", () => {
  assert.equal(normalizeBookingType("SIMPLE"), BOOKING_TYPE.SIMPLE);
  assert.equal(normalizeBookingType("DUALF1"), BOOKING_TYPE.DUAL_F1);
  assert.equal(normalizeBookingType("DUAL-F2"), BOOKING_TYPE.DUAL_F2);
  assert.equal(normalizeBookingType("dual_f1"), BOOKING_TYPE.DUAL_F1);
  assert.throws(
    () => assertValidEnum(normalizeBookingType("UNSUPPORTED"), BOOKING_TYPE, "bookingType"),
    /SCHEMA_VIOLATION/
  );
});
