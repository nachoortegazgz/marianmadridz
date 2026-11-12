function _safeText(value) {
    return String(value ?? "").trim();
}

function _instant(value) {
    if (value === null || value === undefined || value === "") return null;
    if (value instanceof Date) {
        return Number.isFinite(value.getTime()) ? value.getTime() : null;
    }
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.getTime() : null;
}

function _sameInstant(left, right) {
    const a = _instant(left);
    const b = _instant(right);
    return a !== null && b !== null && a === b;
}

/**
 * Compares a read-only Wix Bookings Reader snapshot with the persisted
 * dual-reschedule target and its CMS projection. It never mutates either side.
 */
export function assessDualRescheduleReadState({
    f1Booking,
    f2Booking,
    f1Cita,
    f2Cita,
    targetF1,
    targetF2,
    resourceId,
} = {}) {
    const mismatches = [];
    const expectedResourceId = _safeText(resourceId);
    if (!expectedResourceId) mismatches.push("EXPECTED_RESOURCE_MISSING");

    const phases = [
        { name: "F1", native: f1Booking, projection: f1Cita, target: targetF1 },
        { name: "F2", native: f2Booking, projection: f2Cita, target: targetF2 },
    ];

    for (const phase of phases) {
        const prefix = phase.name;
        const booking = phase.native?.booking || null;
        const slot = booking?.bookedEntity?.slot || null;
        const cita = phase.projection || null;
        const target = phase.target || {};
        if (!booking || !slot) {
            mismatches.push(`${prefix}_NATIVE_BOOKING_UNREADABLE`);
            continue;
        }
        if (!cita) {
            mismatches.push(`${prefix}_CMS_PROJECTION_MISSING`);
            continue;
        }

        const expectedStart = target.startUtc;
        const expectedEnd = target.endUtc;
        const nativeStart = booking.startDate || slot.startDate;
        const nativeEnd = booking.endDate || slot.endDate;
        const nativeResourceId = _safeText(slot.resource?._id || slot.resource?.id);
        const nativeServiceId = _safeText(slot.serviceId);
        const nativeStatus = _safeText(booking.status).toUpperCase();

        if (!_sameInstant(nativeStart, expectedStart) || !_sameInstant(nativeEnd, expectedEnd)) {
            mismatches.push(`${prefix}_NATIVE_INTERVAL_MISMATCH`);
        }
        if (nativeServiceId !== _safeText(target.serviceId)) {
            mismatches.push(`${prefix}_NATIVE_SERVICE_MISMATCH`);
        }
        if (!nativeResourceId || nativeResourceId !== expectedResourceId) {
            mismatches.push(`${prefix}_NATIVE_RESOURCE_MISMATCH`);
        }

        if (!_sameInstant(cita.slotStart, expectedStart) || !_sameInstant(cita.slotEnd, expectedEnd)) {
            mismatches.push(`${prefix}_CMS_INTERVAL_MISMATCH`);
        }
        if (_safeText(cita.serviceId) !== _safeText(target.serviceId)) {
            mismatches.push(`${prefix}_CMS_SERVICE_MISMATCH`);
        }
        if (_safeText(cita.resourceId) !== expectedResourceId) {
            mismatches.push(`${prefix}_CMS_RESOURCE_MISMATCH`);
        }
        const projectedStatus = _safeText(cita.status).toUpperCase();
        if (!nativeStatus || !projectedStatus || nativeStatus !== projectedStatus) {
            mismatches.push(`${prefix}_STATUS_MISMATCH_OR_UNKNOWN`);
        }
    }

    return mismatches.length
        ? { status: "REPAIR_REQUIRED", mismatches: Array.from(new Set(mismatches)) }
        : { status: "TARGET_STATE_CONFIRMED_READ_ONLY", mismatches: [] };
}
