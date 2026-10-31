/**
 * controlOperativo.hooks.test.mjs
 * FASE 3 SSOT v7.0 (BIBLIA 12 / ADR-05): validacion condicional de hooks
 * ControlOperativo: WEBHOOK_EVENT append-only, resto purgable.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ControlOperativo_beforeInsert,
  ControlOperativo_beforeUpdate,
  ControlOperativo_beforeRemove,
} from "../data.js";
import { CONTROL_TYPE, CONTROL_STATUS } from "../internalConfig.js";

function _base(controlType) {
  return {
    controlType,
    dedupeKey: `${controlType}:unit-test-key`,
    status: CONTROL_STATUS.ACTIVE,
    traceId: "trace-unit-001",
  };
}

describe("ControlOperativo hooks (ADR-05)", () => {
  it("DATA-05: beforeInsert es passthrough (schema vive en bookingCore/events)", () => {
    /* SSOT v13.0-MINIMAL: las validaciones de controlType/dedupeKey/status se
       eliminaron del hook CMS porque ya se aplican en el punto de uso
       (bookingCore, events.js). El hook solo conserva la guardia append-only
       de WEBHOOK_EVENT. Este test sella la decision de eliminacion. */
    const ok = _base(CONTROL_TYPE.SLOT_LOCK);
    assert.strictEqual(ControlOperativo_beforeInsert(ok), ok);
    const bad = { ..._base("NOT_A_TYPE"), controlType: "NOT_A_TYPE" };
    assert.doesNotThrow(() => ControlOperativo_beforeInsert(bad));
  });

  it("WEBHOOK_EVENT es append-only: update prohibido", () => {
    const rec = _base(CONTROL_TYPE.WEBHOOK_EVENT);
    assert.throws(
      () => ControlOperativo_beforeUpdate(rec, { original: rec }),
      /append-only/,
    );
  });

  it("WEBHOOK_EVENT es append-only: remove prohibido", () => {
    const rec = _base(CONTROL_TYPE.WEBHOOK_EVENT);
    assert.throws(() => ControlOperativo_beforeRemove(rec), /append-only/);
  });

  it("Subtipos purgables (SLOT_LOCK/DUAL_CACHE) permiten update/remove", () => {
    for (const t of [CONTROL_TYPE.SLOT_LOCK, CONTROL_TYPE.DUAL_CACHE, CONTROL_TYPE.DAYS_CACHE, CONTROL_TYPE.DISPLAY_TOKEN]) {
      const rec = { ..._base(t), expiresAt: new Date(Date.now() + 60000) };
      assert.doesNotThrow(() => ControlOperativo_beforeUpdate(rec, { original: rec }));
      assert.doesNotThrow(() => ControlOperativo_beforeRemove(rec));
    }
  });

  it("CONTROL_TYPE cubre los subtipos del esquema objetivo", () => {
    /* SSOT-FIX (2026-10-13): el enum canónico de internalConfig es la fuente
       de verdad. BOOKING_TX quedo retirado (crons.js linea 509 confirma que
       no tiene productores ni consumidores activos). Se verifican ademas los
       tres subtipos con productores reales en codigo activo: IDEMPOTENCY
       (bookingCore v5013), SYSTEM_FLAG (bookingSaga v5013) y DEDUPE_KEY. */
    /* La SSOT v10.0 entregada exige RATE_LIMIT persistido en ControlOperativo.
       DISPLAY_TOKEN se conserva por su productor activo en reservas.web.js. */
    const expected = [
      "SLOT_LOCK", "WEBHOOK_EVENT", "IDEMPOTENCY", "RATE_LIMIT",
      "SYSTEM_FLAG",
      "COMPENSATION", "ALERT", "DAYS_CACHE", "DUAL_CACHE",
      "DISPLAY_TOKEN",
    ];
    const values = Object.values(CONTROL_TYPE).sort();
    assert.deepEqual(values, expected.sort());
  });
});
