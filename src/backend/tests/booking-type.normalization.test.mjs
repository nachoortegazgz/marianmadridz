import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BOOKING_TYPE,
  CITAS_BOOKING_STATUS,
  CITAS_PAYMENT_STATUS,
  isDualBookingType,
  normalizeBookingType,
} from "../internalConfig.js";
import { assertCitasF2, assertCitasF2Insert } from "../validation.js";

const GUID = "11111111-1111-4111-8111-111111111111";
const baseRecord = {
  bookingId: GUID,
  scheduleId: GUID,
  traceId: "booking-type-contract",
  bookingStatus: Object.values(CITAS_BOOKING_STATUS)[0],
  paymentStatus: Object.values(CITAS_PAYMENT_STATUS)[0],
  serviceId: GUID,
  resourceId: GUID,
  slotStart: new Date("2026-11-27T10:00:00.000Z"),
  slotEnd: new Date("2026-11-27T11:00:00.000Z"),
  totalAmount: 0,
  dateYmd: "2026-11-27",
};

test("booking type normalization does not invent SIMPLE for missing values", () => {
  for (const value of [undefined, null, "", "   "]) {
    assert.equal(normalizeBookingType(value), "");
    assert.equal(isDualBookingType(value), false);
  }
});

test("status-only updates preserve historical records without bookingType", () => {
  assert.equal(assertCitasF2({ ...baseRecord }), true);
});

test("new CitasF2 inserts require an explicit valid bookingType", () => {
  assert.throws(
    () => assertCitasF2Insert({ ...baseRecord }),
    /CitasF2 insert requires bookingType/
  );
  assert.equal(
    assertCitasF2Insert({ ...baseRecord, bookingType: BOOKING_TYPE.SIMPLE }),
    true
  );
});

test("historical aliases remain readable but cannot be persisted by a new insert", () => {
  const historicalAlias = { ...baseRecord, bookingType: "DUALF1", pairToken: "pair-token-1" };
  assert.equal(assertCitasF2(historicalAlias), true);
  assert.throws(
    () => assertCitasF2Insert(historicalAlias),
    { code: "BOOKING_TYPE_NON_CANONICAL" }
  );
  assert.equal(
    assertCitasF2Insert({ ...baseRecord, bookingType: BOOKING_TYPE.DUAL_F1, pairToken: "pair-token-1" }),
    true
  );
});

test("explicit historical aliases normalize to canonical dual types; unknown values remain invalid", () => {
  assert.equal(normalizeBookingType("DUALF1"), BOOKING_TYPE.DUAL_F1);
  assert.equal(normalizeBookingType("DUAL-F2"), BOOKING_TYPE.DUAL_F2);
  assert.equal(normalizeBookingType("dual_f1"), BOOKING_TYPE.DUAL_F1);
  assert.throws(
    () => assertCitasF2({ ...baseRecord, bookingType: "UNSUPPORTED" }),
    /bookingType invalido/
  );
});
