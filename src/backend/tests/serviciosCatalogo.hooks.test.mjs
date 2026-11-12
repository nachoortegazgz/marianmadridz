import test from "node:test";
import assert from "node:assert/strict";

import { ServiciosCatalogo_beforeInsert, ServiciosCatalogo_beforeUpdate } from "../data.js";

const SERVICE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001";
const F2_SERVICE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0002";

function dualService(overrides = {}) {
  return {
    _id: SERVICE_ID,
    serviceId: SERVICE_ID,
    linkedPhases: F2_SERVICE_ID,
    allowCombine: true,
    phase1Duration: 30,
    exposureDuration: 20,
    phase2Duration: 40,
    totalDuration: 90,
    ...overrides,
  };
}

test("CATALOG-TYPE-01 infers SERVICE only from a unique serviceId", () => {
  const item = dualService();
  assert.equal(ServiciosCatalogo_beforeInsert(item), item);
  assert.equal(item.catalogEntryType, "SERVICE");
});

test("CATALOG-TYPE-02 preserves an explicit pricing plan identity", () => {
  const item = {
    _id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0003",
    catalogEntryType: "PRICING_PLAN",
    pricingPlanId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0004",
    sessionCount: 5,
  };
  assert.equal(ServiciosCatalogo_beforeInsert(item), item);
  assert.equal(item.catalogEntryType, "PRICING_PLAN");
});

test("CATALOG-TYPE-03 infers PRICING_PLAN only when serviceId is absent", () => {
  const item = {
    _id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0005",
    pricingPlanId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0006",
    sessionCount: 5,
  };
  assert.equal(ServiciosCatalogo_beforeInsert(item), item);
  assert.equal(item.catalogEntryType, "PRICING_PLAN");
});

test("CATALOG-TYPE-04 rejects ambiguous or incomplete catalog identity", () => {
  assert.throws(() => ServiciosCatalogo_beforeInsert({ _id: SERVICE_ID }), /catalogEntryType no se puede inferir/);
  assert.throws(() => ServiciosCatalogo_beforeInsert(dualService({ catalogEntryType: "SERVICE", pricingPlanId: F2_SERVICE_ID })), /SERVICE requiere/);
  assert.throws(() => ServiciosCatalogo_beforeInsert({
    _id: SERVICE_ID, catalogEntryType: "PRICING_PLAN", serviceId: SERVICE_ID,
    pricingPlanId: F2_SERVICE_ID,
  }), /PRICING_PLAN requiere/);
  assert.throws(() => ServiciosCatalogo_beforeInsert(dualService({ catalogEntryType: "UNKNOWN" })), /catalogEntryType invalido/);
});

test("CATALOG-TYPE-05 beforeUpdate normalizes legacy service rows", () => {
  const item = dualService({ catalogEntryType: "" });
  assert.equal(ServiciosCatalogo_beforeUpdate(item), item);
  assert.equal(item.catalogEntryType, "SERVICE");
});

test("CATALOG-DURATION-01 accepts an exact sum of dual service phases", () => {
  const item = dualService();
  assert.equal(ServiciosCatalogo_beforeInsert(item), item);
  assert.equal(item.totalDuration, 90);
});

test("CATALOG-DURATION-02 infers totalDuration only when omitted", () => {
  const item = dualService({ totalDuration: undefined });
  assert.equal(ServiciosCatalogo_beforeInsert(item), item);
  assert.equal(item.totalDuration, 90);
});

test("CATALOG-DURATION-03 rejects a one-minute mismatch", () => {
  assert.throws(
    () => ServiciosCatalogo_beforeInsert(dualService({ totalDuration: 91 })),
    /coincidir exactamente/
  );
});

test("CATALOG-DURATION-04 rejects malformed numeric values", () => {
  assert.throws(
    () => ServiciosCatalogo_beforeInsert(dualService({ phase1Duration: "thirty" })),
    /phase1Duration debe ser numerico/
  );
  assert.throws(
    () => ServiciosCatalogo_beforeInsert(dualService({ phase1Duration: "30" })),
    /phase1Duration debe ser numerico/
  );
});

test("CATALOG-DURATION-05 rejects an explicit zero total when phases are positive", () => {
  assert.throws(
    () => ServiciosCatalogo_beforeInsert(dualService({ totalDuration: 0 })),
    /coincidir exactamente/
  );
});
