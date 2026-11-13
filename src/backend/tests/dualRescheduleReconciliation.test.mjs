import test from "node:test";
import assert from "node:assert/strict";

import { assessDualRescheduleReadState } from "../booking/dualRescheduleReconciliation.js";

const targetF1 = {
    serviceId: "service-f1",
    startUtc: "2026-11-12T09:00:00.000Z",
    endUtc: "2026-11-12T10:00:00.000Z",
};
const targetF2 = {
    serviceId: "service-f2",
    startUtc: "2026-11-12T10:10:00.000Z",
    endUtc: "2026-11-12T10:40:00.000Z",
};

function nativeBooking(id, target) {
    return {
        booking: {
            id,
            status: "CONFIRMED",
            startDate: target.startUtc,
            endDate: target.endUtc,
            bookedEntity: {
                slot: {
                    serviceId: target.serviceId,
                    resource: { _id: "resource-1" },
                },
            },
        },
    };
}

function cita(target) {
    return {
        slotStart: new Date(target.startUtc),
        slotEnd: new Date(target.endUtc),
        serviceId: target.serviceId,
        resourceId: "resource-1",
        status: "CONFIRMED",
    };
}

const validSnapshot = () => ({
    f1Booking: nativeBooking("booking-f1", targetF1),
    f2Booking: nativeBooking("booking-f2", targetF2),
    f1Cita: cita(targetF1),
    f2Cita: cita(targetF2),
    targetF1,
    targetF2,
    resourceId: "resource-1",
});

test("DRR-01 confirms both native bookings and CMS projections at exact target state", () => {
    assert.deepEqual(assessDualRescheduleReadState(validSnapshot()), {
        status: "TARGET_STATE_CONFIRMED_READ_ONLY",
        mismatches: [],
    });
});

test("DRR-02 mixed native state remains REPAIR_REQUIRED", () => {
    const snapshot = validSnapshot();
    snapshot.f2Booking.booking.startDate = "2026-11-12T11:00:00.000Z";
    const result = assessDualRescheduleReadState(snapshot);
    assert.equal(result.status, "REPAIR_REQUIRED");
    assert.ok(result.mismatches.includes("F2_NATIVE_INTERVAL_MISMATCH"));
});

test("DRR-03 missing or stale CMS projection remains REPAIR_REQUIRED", () => {
    const snapshot = validSnapshot();
    snapshot.f1Cita = null;
    snapshot.f2Cita.slotEnd = new Date("2026-11-12T11:00:00.000Z");
    const result = assessDualRescheduleReadState(snapshot);
    assert.equal(result.status, "REPAIR_REQUIRED");
    assert.ok(result.mismatches.includes("F1_CMS_PROJECTION_MISSING"));
    assert.ok(result.mismatches.includes("F2_CMS_INTERVAL_MISMATCH"));
});

test("DRR-04 resource, service and status uncertainty fail closed", () => {
    const snapshot = validSnapshot();
    snapshot.f1Booking.booking.bookedEntity.slot.resource._id = "other-resource";
    snapshot.f2Cita.serviceId = "other-service";
    snapshot.f2Cita.status = "";
    const result = assessDualRescheduleReadState(snapshot);
    assert.equal(result.status, "REPAIR_REQUIRED");
    assert.ok(result.mismatches.includes("F1_NATIVE_RESOURCE_MISMATCH"));
    assert.ok(result.mismatches.includes("F2_CMS_SERVICE_MISMATCH"));
    assert.ok(result.mismatches.includes("F2_STATUS_MISMATCH_OR_UNKNOWN"));
});

test("DRR-05 invalid target timestamps and missing expected resource never confirm", () => {
    const snapshot = validSnapshot();
    snapshot.targetF1.startUtc = "not-a-date";
    snapshot.resourceId = "";
    const result = assessDualRescheduleReadState(snapshot);
    assert.equal(result.status, "REPAIR_REQUIRED");
    assert.ok(result.mismatches.includes("EXPECTED_RESOURCE_MISSING"));
    assert.ok(result.mismatches.includes("F1_NATIVE_INTERVAL_MISMATCH"));
});
