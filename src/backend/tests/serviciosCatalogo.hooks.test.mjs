import test from "node:test";
import assert from "node:assert/strict";

import { ServiciosCatalogo_beforeInsert } from "../data.js";

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
    /numeros no negativos/
  );
});
