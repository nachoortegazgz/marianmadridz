/*
MODULE: backend/booking/bookingSaga.js
VERSION: v5020-CONTROL-SERVICE-ID
BASE: v5018-SDK-BOOKED-SLOT-SHAPE
RESPONSIBILITY: Orquestador transaccional de reservas (simple y dual con gap).

CORRECCIONES v5019 (alineadas con bookingCore v5021 y doc oficial Wix Bookings V2):
  SAGA-V2-ID-01 (P0): _resolveBookingLocation devuelve
    `{ id: resolvedId, locationType }` (antes `{ _id, locationType }`).
    Contrato oficial de BookedSlot.Location: `{ id, name, formattedAddress,
    locationType }` (id, NO _id).
    Ref: https://dev.wix.com/docs/api-reference/business-solutions/bookings/
         bookings/bookings-writer-v2/create-booking
  SAGA-V2-ID-02 (P1): _resolveBookingLocation lee
    `location._id || location.id` en validatedSlotF1/F2. Los slots F1/F2
    provienen de TimeSlotLocation (usa `_id`), pero el fallback a `id`
    protege ante futuros cambios de shape o bundles mixtos.
  SAGA-V2-ID-03 (P0): _assertPristineSlotContract valida `resource.id`
    (antes `resource._id`). Contrato oficial de BookedSlot.Resource:
    `{ id, name, email, scheduleId }`.
  SAGA-V2-ID-04 (P0): _assertPristineSlotContract valida `location.id`
    (antes `location._id`).
  SAGA-V2-ID-05 (P1): _assertPristineSlotContract acepta `id` o `_id` como
    fallback (con mensaje diferenciado en el log) para evitar que un
    bundle antiguo de bookingCore rompa la reserva. Se loguea un warn
    específico cuando se usa el alias legacy.

CORRECCIONES v5017-STRONG-QUERY:
  SAGA-51 (P0): elevatedQueryFind forzaba strong en _validateLinkedPhaseService
    y _cancelCitasByPairToken.

FIXES HEREDADOS v5016: SAGA-48/49/50 (CANCELLED, COMPLETION_RETRY).
FIXES HEREDADOS v5015: SAGA-46/47.
FIXES HEREDADOS v5014: SAGA-36..SAGA-45.
=============================================================================
*/

import { bookings } from "@wix/bookings";
import { auth } from "@wix/essentials";
import { query as dalQuery, insertItem as dalInsert } from "backend/dataAccess";
import {
    BUSINESS_COLLECTIONS,
    OPERATIONAL_COLLECTIONS,
    CONTROL_TYPE,
    CONCURRENCY,
    SDK_CONFIG,
    BOOKING_STATUS,
    BOOKING_TYPE,
    PAYMENT_STATUS,
    CHANNEL_TYPE,
    COMPENSATION_KIND,
    COMPENSATION_STATUS,
    BOOKING_FIELDS,
} from "backend/internalConfig";
import {
    makeTraceId,
    _safeTrim,
    _looksLikeGuid,
    _stableSerialize,
    _hashKey,
    _generateUUID,
    getUtcDateFromMadridLocal,
    getMadridLocalStringNoZ,
    _normalizeLocalIsoStr,
    _executeWithRetry,
    withTimeout,
} from "public/mmUtils";
import { calculateBookingAmount } from "backend/booking/bookingUtils";
import { markTransactionResultUnknown } from "backend/events";
import { logger } from "backend/logger";
import {
    cancelBookingElevated,
    confirmOrDeclineBookingElevated,
    createBookingCartCheckout,
    _lockSlotKeyOrFail,
    _unlockSlotKey,
    _renewLock,
    _initTransaction,
    _inspectTransactionReplay,
    _findExistingCitasForSlot,
    _completeTransaction,
    _failTransaction,
    _persistBooking,
    _updateCitaSafe,
    _forceStaffInPristineSlot,
    _resolveScheduleIdForResource,
    _buildLockKeys,
    generateSlotKey,
    _buildBookedAddOns,
    createBookingError,
    normalizeError,
    ERROR_CODES,
    _buildPairTokenDeterministic,
} from "backend/booking/bookingCore";
import {
    _resolveServiceIdInternal,
    _invalidateCachesInternal,
    _getServiceBySlugOrIdInternal,
    _resolveStaffForSlotInternal,
} from "backend/reservas.web.js";

const log = logger;

const LOCK_TTL_MS =
    Number(CONCURRENCY && CONCURRENCY.MS_TTL_MUTEX) || 300000;
const HEARTBEAT_MS = Number(CONCURRENCY && CONCURRENCY.MS_LATIDO) || 15000;

const CITAS_COL = BUSINESS_COLLECTIONS.CITAS_F2;
const SERVICIOS_COL = BUSINESS_COLLECTIONS.SERVICIOS_CATALOGO;
const COMPENSACIONES_COL = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;

const BOOKING_CREATION_TIMEOUT_MS =
    Number(
        SDK_CONFIG &&
            SDK_CONFIG.TIMEOUTS &&
            SDK_CONFIG.TIMEOUTS.BOOKING_CREATION_MS
    ) || 25000;
const API_TIMEOUT_MS =
    Number(SDK_CONFIG && SDK_CONFIG.TIMEOUTS && SDK_CONFIG.TIMEOUTS.API_MS) ||
    15000;

const SAGA_STEP_CREATE_CART_V2_CHECKOUT = "CreateCartV2Checkout";

const MAX_ADDONS_PER_BOOKING = 5;
const SKIP_AVAILABILITY_VALIDATION = false;

const PAYMENT_STATUS_NOT_PAID = _safeTrim(PAYMENT_STATUS.NOT_PAID);
const PAYMENT_STATUS_PENDING = _safeTrim(PAYMENT_STATUS.PENDING_PAYMENT);
const BOOKING_STATUS_CONFIRMED = _safeTrim(BOOKING_STATUS.CONFIRMED);
const BOOKING_STATUS_PENDING_PAYMENT = _safeTrim(
    BOOKING_STATUS.PENDING || BOOKING_STATUS.PENDING_PAYMENT
);

const CHANNEL_ONLINE = _safeTrim(CHANNEL_TYPE.ONLINE).toUpperCase();
const CHANNEL_PRESENCIAL = _safeTrim(CHANNEL_TYPE.PRESENCIAL).toUpperCase();
const BOOKING_PAYMENT_OPTION_ONLINE = "ONLINE";
const BOOKING_PAYMENT_OPTION_OFFLINE = "OFFLINE";

const NON_CANCELABLE_STATUSES = new Set(
    [
        BOOKING_STATUS.CANCELED,
        BOOKING_STATUS.CANCELLED,
        "CANCELED",
        "CANCELLED",
        BOOKING_STATUS.REFUNDED,
        BOOKING_STATUS.DECLINED,
        "REFUNDED",
        "DECLINED",
        "DONE",
        "COMPLETE",
    ]
        .map(function (v) {
            return _safeTrim(v).toUpperCase();
        })
        .filter(Boolean)
);

const elevatedInsert = dalInsert;

/**
 * SAGA-51: lectura fuerte obligatoria.
 */
function elevatedQueryFind(collection, queryFn) {
    return Promise.resolve(queryFn(dalQuery(collection))).then(function (q) {
        return q.find({ consistencyMode: "strong" });
    });
}

// =============================================================================
// SAGA-37: HEARTBEAT
// =============================================================================
function _startLockHeartbeat(
    lockKeys,
    lockOwnerId,
    lockTokens,
    ttlMs,
    intervalMs,
    traceId
) {
    let stopped = false;
    let failure = null;
    const revisions = {};

    const completion = (async function () {
        while (!stopped) {
            await new Promise(function (resolve) {
                setTimeout(resolve, intervalMs);
            });
            if (stopped) break;

            for (let i = 0; i < lockKeys.length; i += 1) {
                const key = lockKeys[i];
                const lockToken = lockTokens[key] || null;
                const expectedRevision = revisions[key];

                try {
                    const result = await _renewLock(
                        key,
                        lockOwnerId,
                        ttlMs,
                        expectedRevision,
                        lockToken
                    );

                    if (!result || !result.ok) {
                        failure = createBookingError(
                            ERROR_CODES.TOKEN_BUSY,
                            "Lock ownership lost during heartbeat",
                            {
                                traceId: traceId,
                                lockKey: key,
                                reason: result && result.reason,
                            }
                        );
                        stopped = true;
                        break;
                    }

                    if (result.newRevision !== undefined) {
                        revisions[key] = result.newRevision;
                    }
                } catch (error) {
                    failure = error;
                    stopped = true;
                    break;
                }
            }
        }
    })();

    return {
        stop: function () {
            stopped = true;
        },
        assertHealthy: function () {
            if (failure) {
                throw failure;
            }
        },
        getFailure: function () {
            return failure;
        },
        setRevision: function (key, revision) {
            revisions[key] = revision;
        },
        wait: completion,
    };
}

// =============================================================================
// BLOCK 1 - PAIR TOKEN
// =============================================================================
function _resolveStablePairToken(params) {
    const emailHash = _hashKey(_safeTrim(params.email).toLowerCase());
    const payload = _stableSerialize({
        serviceId: _safeTrim(params.serviceId),
        f1Start: _safeTrim(params.f1Start),
        f2Start: _safeTrim(params.f2Start || ""),
    });
    const hash = _hashKey(payload + "|" + emailHash);
    return "pt" + hash.slice(0, 32);
}

function _resolveUnifiedPairToken(params) {
    if (params.isDual) {
        let pairToken;
        try {
            pairToken = _buildPairTokenDeterministic({
                serviceId: params.serviceId,
                linkedPhases: params.linkedPhases,
                dateYmd: _safeTrim(params.f1Start).slice(0, 10),
                f1Start: params.f1Start,
                f1End: params.f1End,
                f2Start: params.f2Start,
                f2End: params.f2End,
                customerKey: _hashKey(_safeTrim(params.email).toLowerCase()),
            });
        } catch (error) {
            log.error("SAGA-19: pair fingerprint rejected the dual payload", {
                traceId: params.traceId,
                error: error && error.message,
                serviceId: params.serviceId,
                linkedPhases: params.linkedPhases,
            });
            throw createBookingError(
                ERROR_CODES.INVALID_PAYLOAD,
                "Dual booking has invalid slot dates for pairToken fingerprint",
                { traceId: params.traceId }
            );
        }
        return { pairToken: pairToken, source: "FINGERPRINT" };
    }

    return {
        pairToken: _resolveStablePairToken({
            serviceId: params.serviceId,
            f1Start: params.f1Start,
            f2Start: params.f2Start,
            email: params.email,
        }),
        source: "STABLE",
    };
}

// =============================================================================
// BLOCK 2 - META
// =============================================================================
export function _normalizePersistedMeta(meta) {
    if (!meta) return {};
    try {
        if (typeof meta === "string") {
            const parsed = JSON.parse(meta);
            return parsed && typeof parsed === "object" && !Array.isArray(parsed)
                ? parsed
                : {};
        }
        return typeof meta === "object" && !Array.isArray(meta) ? meta : {};
    } catch (_) {
        return {};
    }
}
export { _normalizePersistedMeta as normalizePersistedMeta };

// =============================================================================
// BLOCK 3 - UTILIDADES
// =============================================================================
function _isGuidOrNull(value) {
    const v = _safeTrim(value);
    if (!v) return null;
    return _looksLikeGuid(v) ? v : null;
}

async function _bestEffortUnlockAll(lockKeys, lockOwnerId, lockRevisions) {
    const keys = Array.isArray(lockKeys) ? lockKeys : [];
    const revisions =
        lockRevisions && typeof lockRevisions === "object" ? lockRevisions : {};

    for (let i = 0; i < keys.length; i++) {
        try {
            await _unlockSlotKey(keys[i], lockOwnerId, revisions[keys[i]]);
        } catch (e) {
            log.warn("_bestEffortUnlockAll: failed", {
                key: keys[i],
                error: e && e.message,
            });
        }
    }
}

// =============================================================================
// BLOCK 4 - COMPENSACION
// =============================================================================
async function _compensateCreatedBookings(createdBookings, traceId) {
    const list = Array.isArray(createdBookings) ? createdBookings : [];
    for (let i = 0; i < list.length; i++) {
        const booking = list[i];
        const bookingId = (booking && booking.bookingId) || (booking && booking.id);
        if (!bookingId) continue;

        const status = _safeTrim(
            (booking && booking[BOOKING_FIELDS.STATUS]) || (booking && booking.status)
        ).toUpperCase();
        if (status && NON_CANCELABLE_STATUSES.has(status)) {
            log.warn("Skipping compensation for terminal-state booking", {
                bookingId: bookingId,
                status: status,
                phase: (booking && booking.phase) || null,
                traceId: traceId,
            });
            continue;
        }

        const revisionRaw =
            booking && booking.revision !== undefined
                ? booking.revision
                : booking && booking.revisionNumber !== undefined
                    ? booking.revisionNumber
                    : NaN;
        const revision = Number(revisionRaw);
        const hasValidRevision = Number.isInteger(revision) && revision > 0;

        if (!hasValidRevision) {
            log.error("Compensation will require manual intervention: revision missing", {
                bookingId: String(bookingId),
                phase: (booking && booking.phase) || null,
                traceId: traceId,
                rawRevision:
                    booking && booking.revision !== undefined
                        ? booking.revision
                        : booking && booking.revisionNumber !== undefined
                            ? booking.revisionNumber
                            : "MISSING",
            });
        }

        const cancelBody = hasValidRevision ? { revision: String(revision) } : {};

        try {
            if (!hasValidRevision) {
                throw new Error("REVISION_MISSING: manual compensation required");
            }
            await _executeWithRetry(
                function () {
                    return withTimeout(
                        function () {
                            return cancelBookingElevated(bookingId, cancelBody);
                        },
                        API_TIMEOUT_MS,
                        "cancelBookingCompensation"
                    );
                },
                2,
                300
            );
            log.info("Compensated booking cancelled", {
                bookingId: bookingId,
                revision: revision,
                traceId: traceId,
            });
        } catch (cancelErr) {
            log.error("Compensation cancel failed; queuing in ControlOperativo", {
                bookingId: bookingId,
                revision: hasValidRevision ? revision : null,
                traceId: traceId,
                error: cancelErr && cancelErr.message,
            });
            const compDedupeKey =
                "COMP_" + COMPENSATION_KIND.CANCEL_BOOKING + "_" + bookingId;
            try {
                await elevatedInsert(COMPENSACIONES_COL, {
                    controlType: CONTROL_TYPE.COMPENSATION,
                    dedupeKey: compDedupeKey,
                    bookingId: String(bookingId),
                    serviceId: _safeTrim(booking && booking.serviceId),
                    compensationKind: COMPENSATION_KIND.CANCEL_BOOKING,
                    status: "PENDING",
                    attempts: 0,
                    revision: hasValidRevision ? revision : null,
                    payload: {
                        compensationKind: COMPENSATION_KIND.CANCEL_BOOKING,
                        serviceId: _safeTrim(booking && booking.serviceId),
                        phase: (booking && booking.phase) || "UNKNOWN",
                        status: "PENDING",
                        compensationStatus: COMPENSATION_STATUS.PENDING,
                        revision: hasValidRevision ? revision : null,
                        attempts: 0,
                        lastError: (cancelErr && cancelErr.message) || "UNKNOWN",
                    },
                    traceId: _safeTrim(traceId) || makeTraceId("comp"),
                });
            } catch (queueErr) {
                log.error("Failed to queue compensation in ControlOperativo", {
                    bookingId: bookingId,
                    traceId: traceId,
                    error: queueErr && queueErr.message,
                });
            }
        }
    }
}

// =============================================================================
// BLOCK 5 - SELECTIVE ELEVATION
// =============================================================================
async function _createBookingWithSelectiveElevation(booking, options, traceId) {
    const safeBooking = JSON.parse(JSON.stringify(booking));
    const safeOptions = options
        ? JSON.parse(JSON.stringify(options))
        : options;

    try {
        return await withTimeout(
            function () {
                return bookings.createBooking(safeBooking, safeOptions);
            },
            BOOKING_CREATION_TIMEOUT_MS,
            "createBooking"
        );
    } catch (err) {
        const code = _safeTrim(
            (err && err.code) ||
                (err &&
                    err.details &&
                    err.details.applicationError &&
                    err.details.applicationError.code)
        ).toUpperCase();
        const isAccessDenied =
            code === "ACCESS_DENIED" ||
            String((err && err.message) || "").toUpperCase().indexOf("ACCESS_DENIED") >= 0;

        if (!isAccessDenied) throw err;

        log.info("Elevating createBooking due to ACCESS_DENIED", {
            traceId: traceId,
        });
        return await withTimeout(
            function () {
                return auth.elevate(bookings.createBooking)(safeBooking, safeOptions);
            },
            BOOKING_CREATION_TIMEOUT_MS,
            "createBooking:elevated"
        );
    }
}

// =============================================================================
// BLOCK 6 - VALIDACION RESPUESTA
// =============================================================================
function _validateCreateBookingResponse(booking, phase, traceId) {
    const id = _safeTrim((booking && booking.id) || (booking && booking._id));
    if (!id || !_looksLikeGuid(id)) {
        log.error("CreateBooking returned invalid booking", {
            phase: phase,
            traceId: traceId,
            hasId: Boolean(booking && booking.id),
            hasUnderscoreId: Boolean(booking && booking._id),
        });
        throw createBookingError(
            ERROR_CODES.BOOKING_CREATION_FAILED,
            "Booking " + phase + " created but no valid ID returned",
            { traceId: traceId, phase: phase }
        );
    }

    const revisionRaw =
        booking && booking.revision !== undefined
            ? booking.revision
            : booking && booking.revisionNumber !== undefined
                ? booking.revisionNumber
                : null;
    const revisionNum = Number(revisionRaw);

    if (!Number.isFinite(revisionNum) || revisionNum < 1) {
        log.error("CreateBooking returned no valid revision", {
            phase: phase,
            traceId: traceId,
            bookingId: id,
            revisionRaw: revisionRaw,
        });
        throw createBookingError(
            ERROR_CODES.BOOKING_CREATION_FAILED,
            "Booking " + phase + " created but no valid revision returned. Manual reconciliation required.",
            { traceId: traceId, phase: phase, bookingId: id }
        );
    }

    return {
        bookingId: id,
        revision: revisionNum,
        status:
            _safeTrim(booking && booking.bookingStatus) ||
            _safeTrim(booking && booking.status) ||
            null,
    };
}

function _assertBookingResourceMatches(booking, phase, expectedResourceId, traceId) {
    const expected = _safeTrim(expectedResourceId);
    const actual = _safeTrim(
        booking?.bookedEntity?.slot?.resource?.id ||
        booking?.bookedEntity?.slot?.resource?._id ||
        ""
    );
    if (!expected || !actual || actual !== expected) {
        log.error("BOOKING_STAFF_ASSIGNMENT_MISMATCH", {
            traceId: traceId,
            phase: phase,
            expectedResourceId: expected || null,
            actualResourceId: actual || null,
            bookingId: _safeTrim(booking?.id || booking?._id) || null,
        });
        throw createBookingError(
            "STAFF_ASSIGNMENT_MISMATCH",
            "Wix booking resource does not match the validated staff member.",
            { traceId: traceId, phase: phase, expectedResourceId: expected, actualResourceId: actual }
        );
    }
}

// =============================================================================
// BLOCK 7 - DOUBLEBOOKED FLAG
// =============================================================================
function _checkDoubleBookingFlag(booking, phase, traceId) {
    if (booking && booking.doubleBooked === true) {
        const bookingId = (booking && booking.id) || (booking && booking._id) || null;
        log.error("DOUBLE_BOOKING_DETECTED", {
            phase: phase,
            traceId: traceId,
            bookingId: bookingId,
        });
        throw createBookingError(
            ERROR_CODES.BOOKING_CREATION_FAILED,
            "Wix reported a double-booked slot; aborting booking saga for compensation",
            { traceId: traceId, phase: phase, bookingId: bookingId, doubleBooked: true }
        );
    }
}

// =============================================================================
// BLOCK 8 - GAP VALIDACION
// =============================================================================
function _validateDualGap(f1LocalEnd, f2LocalStart, traceId, minimumGapMinutes) {
    const f1EndLocal = _normalizeLocalIsoStr(f1LocalEnd);
    const f2StartLocal = _normalizeLocalIsoStr(f2LocalStart);
    if (!f1EndLocal || !f2StartLocal) {
        throw createBookingError(
            ERROR_CODES.INVALID_DATES,
            "Dual gap validation: invalid dates",
            {
                traceId: traceId,
                f1LocalEnd: f1LocalEnd,
                f2LocalStart: f2LocalStart,
            }
        );
    }
    const f1EndUtc = getUtcDateFromMadridLocal(f1EndLocal);
    const f2StartUtc = getUtcDateFromMadridLocal(f2StartLocal);
    if (!f1EndUtc || !f2StartUtc) {
        throw createBookingError(
            ERROR_CODES.INVALID_DATES,
            "Dual gap validation: could not convert to UTC",
            {
                traceId: traceId,
                f1LocalEnd: f1LocalEnd,
                f2LocalStart: f2LocalStart,
            }
        );
    }
    const rawDiffMinutes = (f2StartUtc.getTime() - f1EndUtc.getTime()) / 60000;
    if (rawDiffMinutes < 0) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "Dual gap validation: F2 starts before F1 ends (" +
                rawDiffMinutes.toFixed(2) +
                " min)",
            { traceId: traceId, gapMinutes: rawDiffMinutes }
        );
    }
    const gapMinutes = (f2StartUtc.getTime() - f1EndUtc.getTime()) / 60000;
    const expectedGapMinutes = Number(minimumGapMinutes);
    if (!Number.isFinite(expectedGapMinutes) || expectedGapMinutes < 0) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "Dual gap validation: ServiciosCatalogo.exposureDuration is invalid",
            {
                traceId: traceId,
                exposureDuration: minimumGapMinutes,
            }
        );
    }
    if (gapMinutes !== expectedGapMinutes) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "Dual gap validation: actual gap must exactly match ServiciosCatalogo.exposureDuration",
            {
                traceId: traceId,
                gapMinutes: gapMinutes,
                expectedGapMinutes: expectedGapMinutes,
            }
        );
    }
    return {
        gapMinutes: gapMinutes,
        expectedGapMinutes: expectedGapMinutes,
    };
}

// =============================================================================
// BLOCK 9 - VALIDACION SERVICIO F2
// =============================================================================
async function _validateLinkedPhaseService(linkedPhases, parentServiceConfig, parentLocationId, traceId) {
    const linkedServiceId = _safeTrim(linkedPhases);
    if (!linkedServiceId || !_looksLikeGuid(linkedServiceId)) {
        throw createBookingError(
            ERROR_CODES.SERVICE_NOT_FOUND,
            "Linked phase service: invalid GUID",
            { traceId: traceId, linkedPhases: linkedServiceId }
        );
    }

    const res = await elevatedQueryFind(SERVICIOS_COL, function (q) {
        return q.eq("serviceId", linkedServiceId).limit(1);
    }).catch(function () {
        return { items: [] };
    });

    const service = (res && res.items && res.items[0]) || null;
    if (!service) {
        throw createBookingError(
            ERROR_CODES.SERVICE_NOT_FOUND,
            "Linked phase service " + linkedServiceId + " not found in catalog",
            { traceId: traceId }
        );
    }

    if (service.clientHidden !== true) {
        log.info("Linked phase service is not hidden (verify configuration)", {
            linkedServiceId: linkedServiceId,
            traceId: traceId,
        });
    }

    const serviceType = _safeTrim(service.serviceType).toUpperCase();
    if (serviceType && serviceType !== "APPOINTMENT" && serviceType !== "CITA") {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "Linked phase service " +
                linkedServiceId +
                " is not APPOINTMENT (type=" +
                serviceType +
                ")",
            { traceId: traceId }
        );
    }

    // La duración de F2 pertenece al registro visible/configurable de F1.
    // linkedPhases identifica el servicio Wix que se reserva en la segunda fase;
    // NO es la fuente de configuración de phase2Duration.
    const phase2Duration = Number(parentServiceConfig && parentServiceConfig.phase2Duration);
    if (!Number.isFinite(phase2Duration) || phase2Duration <= 0) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "Parent service " +
                _safeTrim(parentServiceConfig && parentServiceConfig.serviceId) +
                " has invalid phase2Duration (" +
                phase2Duration +
                ")",
            {
                traceId: traceId,
                serviceId: _safeTrim(parentServiceConfig && parentServiceConfig.serviceId),
                linkedServiceId: linkedServiceId,
            }
        );
    }

    const parentLoc = _safeTrim(parentLocationId);
    const f2Loc = _safeTrim(service.locationId || service.location);
    if (
        parentLoc &&
        f2Loc &&
        _looksLikeGuid(parentLoc) &&
        _looksLikeGuid(f2Loc) &&
        parentLoc !== f2Loc
    ) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "Linked phase service " + linkedServiceId + " has incompatible locationId",
            { traceId: traceId }
        );
    }

    return { service: service, phase2Duration: phase2Duration };
}

// =============================================================================
// BLOCK 10 - COMPENSACION CMS
// =============================================================================
async function _cancelCitasByPairToken(pairToken, traceId) {
    const token = _safeTrim(pairToken);
    if (!token) return;
    try {
        const res = await elevatedQueryFind(CITAS_COL, function (q) {
            return q.eq(BOOKING_FIELDS.PAIR_TOKEN, token).limit(10);
        });
        const items = (res && res.items) || [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const bookingId = _safeTrim(item.bookingId);
            if (!bookingId) continue;

            const updateResult = await _updateCitaSafe(
                bookingId,
                function (cita) {
                    let meta = cita && cita.meta;
                    if (typeof meta === "string") {
                        try {
                            meta = JSON.parse(meta);
                        } catch (_) {
                            meta = {};
                        }
                    }
                    if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
                        meta = {};
                    }
                    return Object.assign({}, cita, {
                        bookingStatus: "CANCELLED",
                        meta: Object.assign({}, meta, {
                            compensated: true,
                            compensatedAt: new Date().toISOString(),
                            compensationTraceId: _safeTrim(traceId),
                        }),
                    });
                },
                traceId,
                "saga_compensate_cita"
            );

            if (updateResult && updateResult.updated) {
                log.info("Compensated CitaF2 marked CANCELLED", {
                    citaId: item._id,
                    bookingId: bookingId,
                    traceId: traceId,
                });
            } else {
                log.error("Failed to compensate CitaF2", {
                    citaId: item._id,
                    bookingId: bookingId,
                    traceId: traceId,
                    reason: (updateResult && updateResult.reason) || "UNKNOWN",
                });
            }
        }
    } catch (err) {
        log.error("_cancelCitasByPairToken failed", {
            pairToken: token,
            traceId: traceId,
            error: err && err.message,
        });
    }
}

// =============================================================================
// BLOCK 11 - ADDONS
// =============================================================================
function _detectAddons(unsafePayload, metaCita, serviceConfig, traceId) {
    const rawAddons =
        (unsafePayload && unsafePayload.addOnIds) ||
        (metaCita && metaCita.addOnIds) ||
        [];
    const requested = Array.isArray(rawAddons)
        ? rawAddons
            .map(function (id) {
                return _safeTrim(id);
            })
            .filter(function (id) {
                return _looksLikeGuid(id);
            })
        : [];
    const unique = Array.from(new Set(requested));

    if (unique.length > MAX_ADDONS_PER_BOOKING) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "Too many addOnIds requested (" +
                unique.length +
                "). Max: " +
                MAX_ADDONS_PER_BOOKING,
            {
                traceId: traceId,
                addonCount: unique.length,
                max: MAX_ADDONS_PER_BOOKING,
            }
        );
    }

    const catalogAddons = Array.isArray(serviceConfig && serviceConfig.addOnOptions)
        ? serviceConfig.addOnOptions
        : [];

    if (catalogAddons.length === 0) {
        if (unique.length > 0) {
            log.info("SAGA-18: addons detected without catalog (passthrough)", {
                traceId: traceId,
                addonCount: unique.length,
                addOnIds: unique,
            });
        }
        return unique;
    }

    const allowedSet = new Set();
    for (let c = 0; c < catalogAddons.length; c++) {
        const addon = catalogAddons[c];
        const addonId = _safeTrim(
            (addon && (addon.addonId || addon.addOnId)) ||
                (addon && typeof addon === "object" && (addon._id || addon.id)) ||
                ""
        );
        if (addonId && _looksLikeGuid(addonId)) allowedSet.add(addonId);
    }

    if (unique.length === 0) return [];

    const unmapped = [];
    const validated = [];
    for (let u = 0; u < unique.length; u++) {
        if (allowedSet.has(unique[u])) validated.push(unique[u]);
        else unmapped.push(unique[u]);
    }

    if (unmapped.length > 0) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "Requested addOnIds not in catalog: " + unmapped.join(", "),
            {
                traceId: traceId,
                unmapped: unmapped,
                catalogSize: allowedSet.size,
            }
        );
    }
    return validated;
}

// =============================================================================
// BLOCK 12 - UBICACION
// =============================================================================
/**
 * SAGA-V2-ID-01 + SAGA-V2-ID-02:
 * - Lee location._id || location.id en validatedSlotF1/F2 (TimeSlotLocation
 *   usa `_id`; BookedSlot.Location usa `id`). Fallback defensivo.
 * - Devuelve `{ id, locationType }` según el contrato oficial de
 *   BookedSlot.Location (id, NO _id).
 */
function _resolveBookingLocation(params) {
    const validatedSlotF1 = params.validatedSlotF1;
    const validatedSlotF2 = params.validatedSlotF2;
    const serviceConfig = params.serviceConfig;

    const f1LocId =
        validatedSlotF1 && validatedSlotF1.location
            ? _isGuidOrNull(
                  validatedSlotF1.location._id || validatedSlotF1.location.id
              )
            : null;
    const f2LocId =
        validatedSlotF2 && validatedSlotF2.location
            ? _isGuidOrNull(
                  validatedSlotF2.location._id || validatedSlotF2.location.id
              )
            : null;

    const resolvedId =
        f1LocId ||
        f2LocId ||
        _isGuidOrNull(serviceConfig && serviceConfig.locationId) ||
        _isGuidOrNull(params.parentLocationId);

    if (!resolvedId) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "Booking location is missing.",
            { traceId: params.traceId }
        );
    }

    const sourceLocationType = _safeTrim(
        validatedSlotF1 &&
            validatedSlotF1.location &&
            validatedSlotF1.location.locationType
    ).toUpperCase();

    if (sourceLocationType && sourceLocationType !== "OWNER_BUSINESS") {
        log.info("SAGA-03: overriding locationType", {
            traceId: params.traceId,
            from: sourceLocationType,
            to: "OWNER_BUSINESS",
            locationId: resolvedId,
        });
    }

    /* SAGA-V2-ID-01: id (no _id). */
    return { id: resolvedId, locationType: "OWNER_BUSINESS" };
}

/**
 * SAGA-V2-ID-03 + SAGA-V2-ID-04 + SAGA-V2-ID-05:
 * - Valida resource.id y location.id (contrato BookedSlot V2).
 * - Acepta `_id` como fallback con log.warn específico (bundles mixtos).
 */
function _assertPristineSlotContract(pristineSlot, phase, traceId) {
    const startIso = _safeTrim(pristineSlot && pristineSlot.startDate);
    const endIso = _safeTrim(pristineSlot && pristineSlot.endDate);
    const locationType = _safeTrim(
        pristineSlot &&
            pristineSlot.location &&
            pristineSlot.location.locationType
    ).toUpperCase();

    const missing = [];
    if (!_isGuidOrNull(pristineSlot && pristineSlot.serviceId))
        missing.push("serviceId");
    if (!_isGuidOrNull(pristineSlot && pristineSlot.scheduleId))
        missing.push("scheduleId");
    if (!startIso) missing.push("startDate");
    else if (!/Z$/.test(startIso)) missing.push("startDate must be ISO UTC with Z");
    if (!endIso) missing.push("endDate");
    else if (!/Z$/.test(endIso)) missing.push("endDate must be ISO UTC with Z");

    /* SAGA-V2-ID-03: BookedSlot.Resource usa `id` (con fallback a `_id`). */
    const resourceIdValue = _isGuidOrNull(
        (pristineSlot && pristineSlot.resource && pristineSlot.resource.id) ||
            (pristineSlot && pristineSlot.resource && pristineSlot.resource._id)
    );
    if (!resourceIdValue) {
        missing.push("resource.id");
    } else if (
        pristineSlot &&
        pristineSlot.resource &&
        !pristineSlot.resource.id &&
        pristineSlot.resource._id
    ) {
        log.warn("SAGA-V2-ID-05: resource._id detected (legacy alias)", {
            traceId: traceId,
            phase: phase,
            resourceId: resourceIdValue,
        });
    }

    /* SAGA-V2-ID-04: BookedSlot.Location usa `id` (con fallback a `_id`). */
    const locationIdValue = _isGuidOrNull(
        (pristineSlot && pristineSlot.location && pristineSlot.location.id) ||
            (pristineSlot && pristineSlot.location && pristineSlot.location._id)
    );
    if (!locationIdValue) {
        missing.push("location.id");
    } else if (
        pristineSlot &&
        pristineSlot.location &&
        !pristineSlot.location.id &&
        pristineSlot.location._id
    ) {
        log.warn("SAGA-V2-ID-05: location._id detected (legacy alias)", {
            traceId: traceId,
            phase: phase,
            locationId: locationIdValue,
        });
    }

    if (locationType !== "OWNER_BUSINESS")
        missing.push("location.locationType must be OWNER_BUSINESS");

    if (missing.length > 0) {
        throw createBookingError(
            ERROR_CODES.INVALID_PAYLOAD,
            "Pristine slot " + phase + " violates contract: " + missing.join("; "),
            { traceId: traceId, phase: phase, missing: missing }
        );
    }
    return true;
}

// =============================================================================
// BLOCK 13 - ORCHESTRATOR
// =============================================================================
export class BookingSagaOrchestrator {
    constructor(traceId) {
        this.traceId = traceId;
        this.steps = [];
        this.completedSteps = [];
    }

    addStep(name, executeFn, compensateFn) {
        this.steps.push({
            name: name,
            executeFn: executeFn,
            compensateFn: compensateFn,
        });
    }

    async execute() {
        for (let i = 0; i < this.steps.length; i++) {
            const step = this.steps[i];
            try {
                log.info("Saga step: " + step.name, {
                    traceId: this.traceId,
                });
                const result = await step.executeFn();
                this.completedSteps.push(Object.assign({}, step, { result: result }));
            } catch (error) {
                log.error("Saga step failed: " + step.name, {
                    traceId: this.traceId,
                    error: error && error.message,
                });
                await this._compensate();
                throw error;
            }
        }
        return this.completedSteps.map(function (s) {
            return s.result;
        });
    }

    async _compensate() {
        const reversed = [].concat(this.completedSteps).reverse();
        for (let i = 0; i < reversed.length; i++) {
            const step = reversed[i];
            if (step.compensateFn) {
                try {
                    log.info("Saga compensating: " + step.name, {
                        traceId: this.traceId,
                    });
                    await step.compensateFn(step.result);
                } catch (compErr) {
                    log.error("Saga compensation failed: " + step.name, {
                        traceId: this.traceId,
                        error: compErr && compErr.message,
                    });
                }
            }
        }
    }
}

// =============================================================================
// BLOCK 14 - EXECUTE SAGA
// =============================================================================
export async function executeBookingSaga(unsafePayload) {
    const traceId = (unsafePayload && unsafePayload.traceId) || makeTraceId("saga");
    const metaCita = _normalizePersistedMeta(
        (unsafePayload && unsafePayload.metaCita) ||
            (unsafePayload && unsafePayload.meta) ||
            {}
    );
    const appointmentNote = _safeTrim(
        (unsafePayload && unsafePayload.appointmentNote) || metaCita.appointmentNote || ""
    ).slice(0, 200);

    let heartbeatMonitor = null;
    let lockKeys = [];
    let lockOwnerId = "";
    let lockTokens = {};
    let lockRevisions = {};
    const createdBookings = [];
    let pairToken = "";
    let transactionStarted = false;

    try {
        // ---------------- PHASE 0 ----------------
        const email = _safeTrim(
            (unsafePayload && unsafePayload.email) ||
                metaCita.email ||
                (unsafePayload && unsafePayload.contactDetails && unsafePayload.contactDetails.email)
        );
        if (!email) {
            throw createBookingError(
                ERROR_CODES.INVALID_PAYLOAD,
                "Email is required",
                { traceId: traceId }
            );
        }

        const sessionMemberId = _safeTrim(
            (unsafePayload && unsafePayload.memberId) || ""
        ).slice(0, 100);
        const sessionContactId = _safeTrim(
            (unsafePayload && unsafePayload.contactId) || ""
        );

        const rgpdConsent =
            (unsafePayload && unsafePayload.rgpdConsent === true) ||
            metaCita.rgpdConsent === true;
        if (!rgpdConsent) {
            throw createBookingError(
                ERROR_CODES.INVALID_PAYLOAD,
                "RGPD consent is required",
                { traceId: traceId }
            );
        }

        const rawServiceId = _safeTrim(
            (unsafePayload && unsafePayload.serviceId) || metaCita.serviceId || ""
        );
        const serviceId = await _resolveServiceIdInternal(rawServiceId);
        if (!serviceId || !_looksLikeGuid(serviceId)) {
            throw createBookingError(
                ERROR_CODES.SERVICE_NOT_FOUND,
                "Service not found",
                { traceId: traceId, rawServiceId: rawServiceId }
            );
        }

        const serviceRes = await _getServiceBySlugOrIdInternal(serviceId, traceId);
        const serviceConfig = (serviceRes && serviceRes.data) || {};

        const requestedChannel = _safeTrim(
            (unsafePayload && unsafePayload.channelType) ||
                metaCita.channelType ||
                CHANNEL_PRESENCIAL
        ).toUpperCase();
        if (requestedChannel !== CHANNEL_ONLINE && requestedChannel !== CHANNEL_PRESENCIAL) {
            throw createBookingError(
                ERROR_CODES.INVALID_PAYLOAD,
                "Invalid payment channel.",
                { traceId: traceId, channelType: requestedChannel }
            );
        }

        const onlinePaymentAllowed = serviceConfig.onlinePayment !== false;
        const inPersonPaymentAllowed = serviceConfig.inPersonPayment !== false;
        if (requestedChannel === CHANNEL_ONLINE && !onlinePaymentAllowed) {
            throw createBookingError(
                ERROR_CODES.INVALID_PAYLOAD,
                "Online payment is disabled for this service.",
                { traceId: traceId, channelType: requestedChannel }
            );
        }
        if (requestedChannel === CHANNEL_PRESENCIAL && !inPersonPaymentAllowed) {
            throw createBookingError(
                ERROR_CODES.INVALID_PAYLOAD,
                "In-person payment is disabled for this service.",
                { traceId: traceId, channelType: requestedChannel }
            );
        }
        const isOnline = requestedChannel === CHANNEL_ONLINE;

        const isDual =
            serviceConfig.allowCombine === true &&
            !!serviceConfig.linkedPhases &&
            _looksLikeGuid(serviceConfig.linkedPhases);
        const linkedPhases = isDual ? serviceConfig.linkedPhases : null;
        const parentLocationId = _safeTrim(
            serviceConfig.locationId || serviceConfig.location
        );

        const slotF1Input = (unsafePayload && unsafePayload.slotF1) || {};
        const slotF2Input = (unsafePayload && unsafePayload.slotF2) || {};

        const f1LocalStart = _normalizeLocalIsoStr(
            slotF1Input.localStartDate || metaCita.f1Start
        );
        const f1LocalEnd = _normalizeLocalIsoStr(
            slotF1Input.localEndDate || metaCita.f1End
        );
        if (!f1LocalStart || !f1LocalEnd) {
            throw createBookingError(
                ERROR_CODES.INVALID_PAYLOAD,
                "F1 slot localStartDate and localEndDate are required",
                { traceId: traceId }
            );
        }

        const f1StartMs = Date.parse(f1LocalStart);
        const f1EndMs = Date.parse(f1LocalEnd);
        if (Number.isNaN(f1StartMs) || Number.isNaN(f1EndMs) || !(f1EndMs > f1StartMs)) {
            throw createBookingError(
                ERROR_CODES.INVALID_DATES,
                "F1 slot has invalid or non-positive duration",
                { traceId: traceId }
            );
        }

        let f2LocalStart = "";
        let f2LocalEnd = "";
        if (isDual) {
            f2LocalStart = _normalizeLocalIsoStr(
                slotF2Input.localStartDate || metaCita.f2Start
            );
            f2LocalEnd = _normalizeLocalIsoStr(
                slotF2Input.localEndDate || metaCita.f2End
            );
            if (!f2LocalStart && !f2LocalEnd) {
                throw createBookingError(
                    ERROR_CODES.INVALID_PAYLOAD,
                    "Dual booking requires F2 slot dates",
                    { traceId: traceId }
                );
            }

            const linkedValidation = await _validateLinkedPhaseService(
                linkedPhases,
                serviceConfig,
                parentLocationId,
                traceId
            );

            if (!f2LocalStart) {
                const f1EndUtc = getUtcDateFromMadridLocal(f1LocalEnd);
                if (!f1EndUtc) {
                    throw createBookingError(
                        ERROR_CODES.INVALID_DATES,
                        "Could not compute F1 end UTC for F2",
                        { traceId: traceId }
                    );
                }
                const exposureMs =
                    Math.max(0, Number(serviceConfig.exposureDuration || 0)) * 60 * 1000;
                const linkedPhase2Ms =
                    Number(linkedValidation.phase2Duration) * 60 * 1000;
                const f2StartUtc = new Date(f1EndUtc.getTime() + exposureMs);
                const f2EndUtc = new Date(f2StartUtc.getTime() + linkedPhase2Ms);
                f2LocalStart = getMadridLocalStringNoZ(f2StartUtc);
                f2LocalEnd = getMadridLocalStringNoZ(f2EndUtc);
            }

            _validateDualGap(
                f1LocalEnd,
                f2LocalStart,
                traceId,
                serviceConfig.exposureDuration
            );
        }

        const detectedAddonIds = _detectAddons(
            unsafePayload,
            metaCita,
            serviceConfig,
            traceId
        );
        const amountSnapshot = calculateBookingAmount(serviceConfig, detectedAddonIds);

        // Resolve idempotency before querying current availability. A completed
        // booking has already consumed its slots; replay must return the stored
        // result even when every staff member is now unavailable for that time.
        const tokenResolution = _resolveUnifiedPairToken({
            isDual: isDual,
            serviceId: serviceId,
            linkedPhases: linkedPhases,
            f1Start: f1LocalStart,
            f1End: f1LocalEnd,
            f2Start: f2LocalStart,
            f2End: f2LocalEnd,
            email: email,
            traceId: traceId,
        });
        const candidatePairToken = tokenResolution.pairToken;
        const payloadHash = _hashKey(
            _stableSerialize({
                serviceId: serviceId,
                f1LocalStart: f1LocalStart,
                f1LocalEnd: f1LocalEnd,
                f2LocalStart: f2LocalStart,
                f2LocalEnd: f2LocalEnd,
                email: email,
                addOnIds: detectedAddonIds,
            })
        );
        const replay = await _inspectTransactionReplay(candidatePairToken, payloadHash);
        if (replay.state === "COMPLETED") {
            return {
                status: "SUCCESS",
                data: replay.result,
                error: null,
                idempotent: true,
            };
        }
        if (replay.state === "PAYLOAD_MISMATCH") {
            throw createBookingError(
                ERROR_CODES.INVALID_PAYLOAD,
                "Payload mismatch for existing pairToken",
                { traceId: traceId }
            );
        }
        if (replay.state === "FAILED") {
            throw createBookingError(
                ERROR_CODES.BOOKING_CREATION_FAILED,
                "Previous transaction failed",
                { traceId: traceId }
            );
        }
        if (replay.state === "IN_PROGRESS") {
            throw createBookingError(
                ERROR_CODES.TOKEN_BUSY,
                "A booking request for these same slots is already in progress.",
                { traceId: traceId }
            );
        }

        const legacyMatches = await _findExistingCitasForSlot({
            serviceId: serviceId,
            dateYmd: f1LocalStart.slice(0, 10),
            startDate: getUtcDateFromMadridLocal(f1LocalStart),
            endDate: getUtcDateFromMadridLocal(f1LocalEnd),
            email: email,
            memberId: sessionMemberId,
            contactId: sessionContactId,
        });
        if (legacyMatches.length > 0) {
            log.warn("SAGA-LEGACY-BOOKING-FOUND: blocking duplicate slot before staff resolution", {
                traceId: traceId,
                serviceId: serviceId,
                dateYmd: f1LocalStart.slice(0, 10),
                bookingIds: legacyMatches.map((item) => item.bookingId).filter(Boolean),
                pairTokens: legacyMatches.map((item) => item.pairToken).filter(Boolean),
                resourceIds: legacyMatches.map((item) => item.resourceId).filter(Boolean),
            });
            throw createBookingError(
                "EXISTING_BOOKING_REQUIRES_RECONCILIATION",
                "Ya existe una reserva para este cliente y horario. No se ha creado otra; contacta con el salón antes de volver a intentarlo.",
                {
                    traceId: traceId,
                    existingBookingIds: legacyMatches.map((item) => item.bookingId).filter(Boolean),
                }
            );
        }

        // ---------------- PHASE 1 ----------------
        let resourceValidation = null;
        let staffResolutionError = null;
        try {
            resourceValidation = await _resolveStaffForSlotInternal({
                serviceId: serviceId,
                f1Start: f1LocalStart,
                f1End: f1LocalEnd,
                f2Start: isDual ? f2LocalStart : null,
                f2End: isDual ? f2LocalEnd : null,
                addOnIds: detectedAddonIds,
                traceId: traceId,
            });
        } catch (error) {
            staffResolutionError = error;
        }

        if (staffResolutionError || !resourceValidation || resourceValidation.status !== "SUCCESS") {
            // Close the race where another identical request completed after the
            // first replay check but consumed the last available staff/slot.
            const lateReplay = await _inspectTransactionReplay(candidatePairToken, payloadHash);
            if (lateReplay.state === "COMPLETED") {
                return {
                    status: "SUCCESS",
                    data: lateReplay.result,
                    error: null,
                    idempotent: true,
                };
            }
            if (lateReplay.state === "PAYLOAD_MISMATCH") {
                throw createBookingError(
                    ERROR_CODES.INVALID_PAYLOAD,
                    "Payload mismatch for existing pairToken",
                    { traceId: traceId }
                );
            }
            if (lateReplay.state === "FAILED") {
                throw createBookingError(
                    ERROR_CODES.BOOKING_CREATION_FAILED,
                    "Previous transaction failed",
                    { traceId: traceId }
                );
            }
            if (lateReplay.state === "IN_PROGRESS") {
                throw createBookingError(
                    ERROR_CODES.TOKEN_BUSY,
                    "A booking request for these same slots is already in progress.",
                    { traceId: traceId }
                );
            }
            if (staffResolutionError) throw staffResolutionError;
            throw createBookingError(
                (resourceValidation && resourceValidation.error && resourceValidation.error.code) ||
                    ERROR_CODES.SLOT_UNAVAILABLE,
                (resourceValidation && resourceValidation.error && resourceValidation.error.message) ||
                    "Slot no longer available",
                { traceId: traceId }
            );
        }

        const finalResourceId = resourceValidation.data.resourceId;
        const validatedSlotF1 = resourceValidation.data.slotF1;
        const validatedSlotF2 = resourceValidation.data.slotF2;
        if (isDual && (!f2LocalStart || !validatedSlotF2)) {
            throw createBookingError(
                ERROR_CODES.SLOT_UNAVAILABLE,
                "Dual booking requires both F1 and F2 slots before any booking is created.",
                { traceId: traceId, phase: "F2" }
            );
        }

        if (isDual && validatedSlotF1 && validatedSlotF2) {
            _validateDualGap(
                _normalizeLocalIsoStr(validatedSlotF1.localEndDate || f1LocalEnd),
                _normalizeLocalIsoStr(validatedSlotF2.localStartDate || f2LocalStart),
                traceId,
                serviceConfig.exposureDuration
            );
        }

        // ---------------- PHASE 2 ----------------
        pairToken = candidatePairToken;
        lockOwnerId = [pairToken, traceId, _generateUUID()].join(":");

        log.info("SAGA-02: pairToken resolved", {
            traceId: traceId,
            source: tokenResolution.source,
            isDual: isDual,
            pairToken: pairToken,
        });
        log.info("SAGA-36: lockOwnerId unique per execution", {
            traceId: traceId,
            lockOwnerId: lockOwnerId,
        });

        const bookingLocation = _resolveBookingLocation({
            validatedSlotF1: validatedSlotF1,
            validatedSlotF2: validatedSlotF2,
            serviceConfig: serviceConfig,
            parentLocationId: parentLocationId,
            traceId: traceId,
        });

        const txResult = await _initTransaction(
            pairToken,
            payloadHash,
            traceId,
            serviceId,
            lockOwnerId
        );

        if (txResult && txResult.success && txResult.isNew === true) {
            transactionStarted = true;
        }

        if (txResult && txResult.success && txResult.isNew === false) {
            if (txResult.existing && txResult.existing.status === "COMPLETED") {
                return {
                    status: "SUCCESS",
                    data: txResult.existing.result || null,
                    error: null,
                    idempotent: true,
                };
            }
            throw createBookingError(
                ERROR_CODES.TOKEN_BUSY,
                "Transaction already exists and is not available for a new execution",
                { traceId: traceId }
            );
        }

        if (!txResult || !txResult.success) {
            const txError = txResult && txResult.error;
            if (txError === ERROR_CODES.PAIR_TOKEN_PAYLOAD_MISMATCH) {
                throw createBookingError(
                    ERROR_CODES.INVALID_PAYLOAD,
                    "Payload mismatch for existing pairToken",
                    { traceId: traceId }
                );
            }
            if (txError === ERROR_CODES.TRANSACTION_PREVIOUSLY_FAILED) {
                throw createBookingError(
                    ERROR_CODES.BOOKING_CREATION_FAILED,
                    "Previous transaction failed",
                    { traceId: traceId }
                );
            }
            if (txResult && txResult.existing && txResult.existing.status === "COMPLETED") {
                return {
                    status: "SUCCESS",
                    data: txResult.existing.result,
                    error: null,
                    idempotent: true,
                };
            }
            throw createBookingError(
                ERROR_CODES.TOKEN_BUSY,
                "Transaction in progress or timeout",
                { traceId: traceId }
            );
        }

        // ---------------- LOCKS ----------------
        const phases = [
            {
                rawSlot: Object.assign({}, validatedSlotF1, {
                    serviceId: serviceId,
                }),
                localStart: f1LocalStart,
                localEnd: f1LocalEnd,
            },
        ];
        if (isDual && f2LocalStart) {
            phases.push({
                rawSlot: Object.assign({}, validatedSlotF2, {
                    serviceId: linkedPhases,
                }),
                localStart: f2LocalStart,
                localEnd: f2LocalEnd,
            });
        }
        const lockServiceIds = new Map();
        for (const phase of phases) {
            const phaseServiceId = _safeTrim(phase.rawSlot && phase.rawSlot.serviceId);
            const phaseKey = generateSlotKey(
                phaseServiceId,
                finalResourceId,
                phase.localStart,
                phase.localEnd
            );
            lockServiceIds.set(phaseKey, phaseServiceId);
        }
        lockKeys = _buildLockKeys(phases, finalResourceId);

        const saga = new BookingSagaOrchestrator(traceId);

        // STEP 1
        saga.addStep(
            "LockSlots",
            async function () {
                for (let li = 0; li < lockKeys.length; li++) {
                    const lockResult = await _lockSlotKeyOrFail(
                        lockKeys[li],
                        lockOwnerId,
                        LOCK_TTL_MS,
                        lockServiceIds.get(lockKeys[li])
                    );
                    if (!lockResult || !lockResult.ok) {
                        throw createBookingError(
                            ERROR_CODES.TOKEN_BUSY,
                            "Lock failed: " + ((lockResult && lockResult.message) || "unknown"),
                            { traceId: traceId, lockKey: lockKeys[li] }
                        );
                    }
                    if (lockResult.revision !== undefined) {
                        lockRevisions[lockKeys[li]] = lockResult.revision;
                    }
                    if (lockResult.lockToken) {
                        lockTokens[lockKeys[li]] = lockResult.lockToken;
                    }
                }

                heartbeatMonitor = _startLockHeartbeat(
                    lockKeys,
                    lockOwnerId,
                    lockTokens,
                    LOCK_TTL_MS,
                    HEARTBEAT_MS,
                    traceId
                );

                for (let ri = 0; ri < lockKeys.length; ri++) {
                    if (lockRevisions[lockKeys[ri]] !== undefined) {
                        heartbeatMonitor.setRevision(
                            lockKeys[ri],
                            lockRevisions[lockKeys[ri]]
                        );
                    }
                }

                if (
                    heartbeatMonitor &&
                    heartbeatMonitor.wait &&
                    typeof heartbeatMonitor.wait.unref === "function"
                ) {
                    heartbeatMonitor.wait.unref();
                }

                return { lockKeys: lockKeys };
            },
            async function () {
                if (heartbeatMonitor) {
                    heartbeatMonitor.stop();
                    heartbeatMonitor = null;
                }
                await _bestEffortUnlockAll(lockKeys, lockOwnerId, lockRevisions);
            }
        );

        // STEP 2
        saga.addStep(
            "CreateBookings",
            async function () {
                if (heartbeatMonitor) heartbeatMonitor.assertHealthy();

                const contactDetails = {
                    firstName: _safeTrim(
                        (unsafePayload && unsafePayload.firstName) ||
                            metaCita.firstName ||
                            ""
                    ),
                    lastName: _safeTrim(
                        (unsafePayload && unsafePayload.lastName) ||
                            metaCita.lastName ||
                            ""
                    ),
                    email: email,
                    phone: _safeTrim(
                        (unsafePayload && unsafePayload.phone) ||
                            metaCita.phone ||
                            ""
                    ),
                };
                if (sessionContactId && _looksLikeGuid(sessionContactId)) {
                    contactDetails.contactId = sessionContactId;
                }

                const bookedAddOns = _buildBookedAddOns(detectedAddonIds);

                const pristineF1 = await _forceStaffInPristineSlot(
                    Object.assign({}, validatedSlotF1, {
                        location: bookingLocation,
                    }),
                    finalResourceId,
                    serviceId,
                    serviceConfig.phase1Duration,
                    serviceConfig
                );
                if (!pristineF1) {
                    throw createBookingError(
                        ERROR_CODES.INVALID_PAYLOAD,
                        "Failed to build pristine slot F1",
                        { traceId: traceId }
                    );
                }
                pristineF1.location = bookingLocation;
                _assertPristineSlotContract(pristineF1, "F1", traceId);

                const bookingBodyF1 = {
                    bookedEntity: { slot: pristineF1 },
                    contactDetails: contactDetails,
                    totalParticipants: 1,
                };
                if (appointmentNote) bookingBodyF1.internalBusinessNote = appointmentNote;
                if (bookedAddOns.length > 0) bookingBodyF1.bookedAddOns = bookedAddOns;
                bookingBodyF1.selectedPaymentOption = isOnline
                    ? BOOKING_PAYMENT_OPTION_ONLINE
                    : BOOKING_PAYMENT_OPTION_OFFLINE;

                let resF1;
                try {
                    resF1 = await _createBookingWithSelectiveElevation(
                        bookingBodyF1,
                        undefined,
                        traceId
                    );
                } catch (timeoutErr) {
                    if (timeoutErr && timeoutErr.code === "TIMEOUT") {
                        log.error("SAGA-39: createBooking F1 timeout", {
                            traceId: traceId,
                            phase: "F1",
                        });
                        throw createBookingError(
                            ERROR_CODES.BOOKING_CREATION_FAILED,
                            "Booking F1 creation timeout. Result unknown, reconciliation required.",
                            { traceId: traceId, phase: "F1", uncertainStep: "CREATE_F1" }
                        );
                    }
                    throw timeoutErr;
                }

                const bookingF1 = (resF1 && resF1.booking) || resF1;
                const f1Meta = _validateCreateBookingResponse(bookingF1, "F1", traceId);

                createdBookings.push({
                    bookingId: f1Meta.bookingId,
                    serviceId: serviceId,
                    revision: f1Meta.revision,
                    status: f1Meta.status,
                    phase: "F1",
                });
                _checkDoubleBookingFlag(bookingF1, "F1", traceId);
                _assertBookingResourceMatches(bookingF1, "F1", finalResourceId, traceId);

                let bookingF2 = null;
                let f2Meta = null;
                let pristineF2 = null;

                if (isDual) {
                    if (heartbeatMonitor) heartbeatMonitor.assertHealthy();

                    pristineF2 = await _forceStaffInPristineSlot(
                        Object.assign({}, validatedSlotF2, {
                            location: bookingLocation,
                        }),
                        finalResourceId,
                        linkedPhases,
                        serviceConfig.phase2Duration,
                        serviceConfig
                    );
                    if (!pristineF2) {
                        throw createBookingError(
                            ERROR_CODES.INVALID_PAYLOAD,
                            "Failed to build pristine slot F2",
                            { traceId: traceId }
                        );
                    }
                    pristineF2.location = bookingLocation;
                    _assertPristineSlotContract(pristineF2, "F2", traceId);

                    const bookingBodyF2 = {
                        bookedEntity: { slot: pristineF2 },
                        contactDetails: contactDetails,
                        totalParticipants: 1,
                        selectedPaymentOption: BOOKING_PAYMENT_OPTION_OFFLINE,
                    };
                    if (appointmentNote) bookingBodyF2.internalBusinessNote = appointmentNote;
                    let resF2;
                    try {
                        resF2 = await _createBookingWithSelectiveElevation(
                            bookingBodyF2,
                            undefined,
                            traceId
                        );
                    } catch (timeoutErr) {
                        if (timeoutErr && timeoutErr.code === "TIMEOUT") {
                            log.error("SAGA-39: createBooking F2 timeout", {
                                traceId: traceId,
                                phase: "F2",
                            });
                            throw createBookingError(
                                ERROR_CODES.BOOKING_CREATION_FAILED,
                                "Booking F2 creation timeout. Result unknown, reconciliation required.",
                                { traceId: traceId, phase: "F2", uncertainStep: "CREATE_F2" }
                            );
                        }
                        throw timeoutErr;
                    }

                    bookingF2 = (resF2 && resF2.booking) || resF2;
                    f2Meta = _validateCreateBookingResponse(bookingF2, "F2", traceId);

                    createdBookings.push({
                        bookingId: f2Meta.bookingId,
                        serviceId: linkedPhases,
                        revision: f2Meta.revision,
                        status: f2Meta.status,
                        phase: "F2",
                    });
                    _checkDoubleBookingFlag(bookingF2, "F2", traceId);
                    _assertBookingResourceMatches(bookingF2, "F2", finalResourceId, traceId);
                }

                return {
                    bookingF1: bookingF1,
                    bookingF2: bookingF2,
                    createdBookings: createdBookings,
                    scheduleIdF1: _safeTrim(pristineF1 && pristineF1.scheduleId) || null,
                    scheduleIdF2: _safeTrim(pristineF2 && pristineF2.scheduleId) || null,
                    revisionF1: f1Meta.revision,
                    revisionF2: (f2Meta && f2Meta.revision) || null,
                };
            },
            async function () {
                await _compensateCreatedBookings(createdBookings, traceId);
            }
        );

        // STEP 3
        saga.addStep(
            isOnline ? SAGA_STEP_CREATE_CART_V2_CHECKOUT : "ConfirmPresencial",
            async function () {
                if (heartbeatMonitor) heartbeatMonitor.assertHealthy();

                if (isOnline) {
                    let bookingF1Id = null;
                    for (let bi = 0; bi < createdBookings.length; bi++) {
                        if (createdBookings[bi].phase === "F1") {
                            bookingF1Id = createdBookings[bi].bookingId;
                            break;
                        }
                    }
                    if (!bookingF1Id) {
                        throw createBookingError(
                            ERROR_CODES.CHECKOUT_FAILED,
                            "F1 booking is required to create the checkout",
                            { traceId: traceId }
                        );
                    }

                    const checkout = await createBookingCartCheckout(
                        bookingF1Id,
                        traceId
                    );

                    return {
                        requiresPayment: true,
                        checkoutUrl: checkout.checkoutUrl,
                        cartId: checkout.cartId,
                        checkoutTotalAmount: checkout.totalAmount,
                        checkoutCurrencyCode: checkout.currencyCode,
                        bookingIds: [bookingF1Id],
                    };
                }

                for (let ci = 0; ci < createdBookings.length; ci++) {
                    const booking = createdBookings[ci];
                    const confirmResult = await _executeWithRetry(
                        function () {
                            return withTimeout(
                                function () {
                                    return confirmOrDeclineBookingElevated(booking.bookingId, {
                                        paymentStatus: PAYMENT_STATUS_NOT_PAID,
                                    });
                                },
                                API_TIMEOUT_MS,
                                "confirmOrDecline"
                            );
                        },
                        2,
                        300
                    );

                    const confirmedBooking = (confirmResult && confirmResult.booking) || confirmResult;
                    _checkDoubleBookingFlag(confirmedBooking, "CONFIRM_" + booking.phase, traceId);
                    _assertBookingResourceMatches(confirmedBooking, "CONFIRM_" + booking.phase, finalResourceId, traceId);
                    const confirmedStatus = _safeTrim(
                        confirmedBooking && (confirmedBooking.status || confirmedBooking.bookingStatus)
                    ).toUpperCase();
                    if (confirmedStatus !== BOOKING_STATUS_CONFIRMED.toUpperCase()) {
                        throw createBookingError(
                            "BOOKING_NOT_CONFIRMED",
                            "Wix did not confirm booking " + booking.phase + ".",
                            { traceId: traceId, phase: booking.phase, bookingId: booking.bookingId, status: confirmedStatus || null }
                        );
                    }
                    booking.status = confirmedStatus;
                }

                return {
                    requiresPayment: false,
                    bookingIds: createdBookings.map(function (b) {
                        return b.bookingId;
                    }),
                };
            },
            async function () {}
        );

        const paymentStatus = isOnline ? PAYMENT_STATUS_PENDING : PAYMENT_STATUS_NOT_PAID;
        const citaStatus = isOnline ? BOOKING_STATUS_PENDING_PAYMENT : BOOKING_STATUS_CONFIRMED;

        // STEP 4
        saga.addStep(
            "PersistCitas",
            async function () {
                if (heartbeatMonitor) heartbeatMonitor.assertHealthy();

                const checkoutStepName = isOnline
                    ? SAGA_STEP_CREATE_CART_V2_CHECKOUT
                    : "ConfirmPresencial";
                let checkoutStepResult = null;
                let createBookingsResult = {};

                for (let si = 0; si < saga.completedSteps.length; si++) {
                    const cs = saga.completedSteps[si];
                    if (cs.name === checkoutStepName) checkoutStepResult = cs.result;
                    if (cs.name === "CreateBookings") createBookingsResult = cs.result || {};
                }

                const resolvedCheckoutUrl =
                    (checkoutStepResult && checkoutStepResult.checkoutUrl) || null;
                const resolvedCartId =
                    (checkoutStepResult && checkoutStepResult.cartId) || null;

                let bookingF1Id = null;
                let bookingF2Id = null;
                for (let bi = 0; bi < createdBookings.length; bi++) {
                    if (createdBookings[bi].phase === "F1") bookingF1Id = createdBookings[bi].bookingId;
                    if (createdBookings[bi].phase === "F2") bookingF2Id = createdBookings[bi].bookingId;
                }

                const revisionF1 = Number(createBookingsResult.revisionF1);
                const revisionF2 = Number(createBookingsResult.revisionF2);

                if (!Number.isSafeInteger(revisionF1) || revisionF1 < 1) {
                    throw createBookingError(
                        ERROR_CODES.BOOKING_CREATION_FAILED,
                        "Invalid revision for F1 booking",
                        { traceId: traceId, bookingId: bookingF1Id }
                    );
                }
                if (isDual && (!Number.isSafeInteger(revisionF2) || revisionF2 < 1)) {
                    throw createBookingError(
                        ERROR_CODES.BOOKING_CREATION_FAILED,
                        "Invalid revision for F2 booking",
                        { traceId: traceId, bookingId: bookingF2Id }
                    );
                }

                let scheduleIdF1 = _isGuidOrNull(createBookingsResult.scheduleIdF1);
                if (!scheduleIdF1) {
                    scheduleIdF1 = await _resolveScheduleIdForResource(
                        finalResourceId,
                        validatedSlotF1
                    );
                }
                if (!scheduleIdF1) {
                    throw createBookingError(
                        ERROR_CODES.INVALID_PAYLOAD,
                        "Unable to resolve scheduleId for F1",
                        { traceId: traceId, bookingId: bookingF1Id }
                    );
                }

                const persistedContactDetails = {
                    firstName: _safeTrim(
                        (unsafePayload && unsafePayload.firstName) ||
                            metaCita.firstName ||
                            ""
                    ),
                    lastName: _safeTrim(
                        (unsafePayload && unsafePayload.lastName) ||
                            metaCita.lastName ||
                            ""
                    ),
                    email: email,
                    phone: _safeTrim(
                        (unsafePayload && unsafePayload.phone) ||
                            metaCita.phone ||
                            ""
                    ),
                };
                if (sessionMemberId) persistedContactDetails.memberId = sessionMemberId;
                if (sessionContactId && _looksLikeGuid(sessionContactId)) {
                    persistedContactDetails.contactId = sessionContactId;
                }

                const persistedF1 = await _persistBooking(
                    {
                        bookingId: bookingF1Id,
                        revision: revisionF1,
                        serviceId: serviceId,
                        scheduleId: scheduleIdF1,
                        resourceId: finalResourceId,
                        startDate: getUtcDateFromMadridLocal(f1LocalStart),
                        endDate: getUtcDateFromMadridLocal(f1LocalEnd),
                        bookingType: isDual ? BOOKING_TYPE.DUAL_F1 : BOOKING_TYPE.SIMPLE,
                        bookingStatus: citaStatus,
                        paymentStatus: paymentStatus,
                        totalAmount: amountSnapshot.totalAmount,
                        pairToken: pairToken,
                        contactDetails: persistedContactDetails,
                        meta: {
                            totalAmount: amountSnapshot.totalAmount,
                            amountSource: amountSnapshot.amountSource,
                            amountReconciliationRequired: amountSnapshot.amountReconciliationRequired,
                            appointmentNote: appointmentNote || null,
                            missingAddonIds: amountSnapshot.missingAddonIds,
                            pairToken: pairToken,
                            pairTokenSource: tokenResolution.source,
                            f1Start: f1LocalStart,
                            f1End: f1LocalEnd,
                            f2Start: f2LocalStart || null,
                            f2End: f2LocalEnd || null,
                            checkoutUrl: resolvedCheckoutUrl,
                            addOnIds: detectedAddonIds,
                            channelType: isOnline ? CHANNEL_ONLINE : CHANNEL_PRESENCIAL,
                            locationType: "OWNER_BUSINESS",
                            writerRevision: revisionF1,
                        },
                        traceId: traceId,
                    },
                    traceId
                );
                if (
                    !persistedF1?.item ||
                    _safeTrim(persistedF1.item.bookingId) !== bookingF1Id ||
                    _safeTrim(persistedF1.item.pairToken) !== pairToken ||
                    _safeTrim(persistedF1.item.resourceId) !== finalResourceId
                ) {
                    throw createBookingError(
                        "CITA_PERSIST_FAILED",
                        "F1 booking record was not persisted with the expected booking, pair and staff identifiers.",
                        { traceId: traceId, bookingId: bookingF1Id }
                    );
                }

                if (isDual && bookingF2Id) {
                    let scheduleIdF2 = _isGuidOrNull(createBookingsResult.scheduleIdF2);
                    if (!scheduleIdF2) {
                        scheduleIdF2 = await _resolveScheduleIdForResource(
                            finalResourceId,
                            validatedSlotF2
                        );
                    }
                    if (!scheduleIdF2) {
                        throw createBookingError(
                            ERROR_CODES.INVALID_PAYLOAD,
                            "Unable to resolve scheduleId for F2",
                            { traceId: traceId, bookingId: bookingF2Id }
                        );
                    }

                    const persistedF2 = await _persistBooking(
                        {
                            bookingId: bookingF2Id,
                            revision: revisionF2,
                            serviceId: linkedPhases,
                            scheduleId: scheduleIdF2,
                            resourceId: finalResourceId,
                            startDate: getUtcDateFromMadridLocal(f2LocalStart),
                            endDate: getUtcDateFromMadridLocal(f2LocalEnd),
                            bookingType: BOOKING_TYPE.DUAL_F2,
                            bookingStatus: citaStatus,
                            paymentStatus: paymentStatus,
                            totalAmount: 0,
                            pairToken: pairToken,
                            contactDetails: persistedContactDetails,
                            meta: {
                                totalAmount: 0,
                                amountSource: "INTERNAL_F2_NO_FEE",
                                amountReconciliationRequired: false,
                                appointmentNote: appointmentNote || null,
                                pairToken: pairToken,
                                pairTokenSource: tokenResolution.source,
                                linkedF1BookingId: bookingF1Id,
                                addOnIds: detectedAddonIds,
                                channelType: isOnline ? CHANNEL_ONLINE : CHANNEL_PRESENCIAL,
                                noFee: true,
                                locationType: "OWNER_BUSINESS",
                                writerRevision: revisionF2,
                            },
                            traceId: traceId,
                        },
                        traceId
                    );
                    if (
                        !persistedF2?.item ||
                        _safeTrim(persistedF2.item.bookingId) !== bookingF2Id ||
                        _safeTrim(persistedF2.item.pairToken) !== pairToken ||
                        _safeTrim(persistedF2.item.resourceId) !== finalResourceId
                    ) {
                        throw createBookingError(
                            "CITA_PERSIST_FAILED",
                            "F2 booking record was not persisted with the expected booking, pair and staff identifiers.",
                            { traceId: traceId, bookingId: bookingF2Id }
                        );
                    }
                }

                return {
                    bookingF1Id: bookingF1Id,
                    bookingF2Id: bookingF2Id || null,
                    resolvedCheckoutUrl: resolvedCheckoutUrl,
                    resolvedCartId: resolvedCartId,
                    citaStatus: citaStatus,
                    isOnline: isOnline,
                    revisionF1: revisionF1,
                    revisionF2: revisionF2,
                };
            },
            async function () {
                await _cancelCitasByPairToken(pairToken, traceId);
            }
        );

        // EXECUTE
        const sagaStartTime = Date.now();
        try {
            await saga.execute();

            let persistStepResult = null;
            for (let pi = 0; pi < saga.completedSteps.length; pi++) {
                if (saga.completedSteps[pi].name === "PersistCitas") {
                    persistStepResult = saga.completedSteps[pi].result;
                }
            }

            const finalResult = {
                bookingIds: createdBookings.map(function (b) {
                    return b.bookingId;
                }),
                bookingId: null,
                pairToken: pairToken,
                pairTokenSource: tokenResolution.source,
                isDual: isDual,
                resourceId: finalResourceId,
                location: bookingLocation,
                requiresPayment: isOnline,
                checkoutUrl:
                    (persistStepResult && persistStepResult.resolvedCheckoutUrl) || null,
                cartId:
                    (persistStepResult && persistStepResult.resolvedCartId) || null,
                status: (persistStepResult && persistStepResult.citaStatus) || citaStatus,
                paymentStatus: paymentStatus,
                channelType: isOnline ? CHANNEL_ONLINE : CHANNEL_PRESENCIAL,
                addOnIds: detectedAddonIds,
            };

            for (let fi = 0; fi < createdBookings.length; fi++) {
                if (createdBookings[fi].phase === "F1") {
                    finalResult.bookingId = createdBookings[fi].bookingId;
                    break;
                }
            }

            const completeResult = await _completeTransaction(
                pairToken,
                finalResult,
                traceId
            );
            if (!completeResult || !completeResult.ok) {
                const completeErrMsg =
                    (completeResult && completeResult.error) || "UNKNOWN";
                log.error(
                    "SAGA-41: _completeTransaction failed; marking COMPLETION_RETRY_REQUIRED",
                    {
                        pairToken: pairToken,
                        traceId: traceId,
                        error: completeErrMsg,
                    }
                );

                try {
                    await elevatedInsert(COMPENSACIONES_COL, {
                        controlType: CONTROL_TYPE.SYSTEM_FLAG,
                        dedupeKey: "COMPLETION_RETRY_" + pairToken,
                        bookingId: finalResult.bookingId || "",
                        serviceId: serviceId,
                        payload: {
                            compensationKind: "COMPLETION_RETRY",
                            pairToken: pairToken,
                            status: "COMPLETION_RETRY_REQUIRED",
                            result: finalResult,
                            error: completeErrMsg,
                            attempts: 0,
                        },
                        traceId: traceId,
                    });
                } catch (queueErr) {
                    log.error("SAGA-41: failed to queue completion retry", {
                        pairToken: pairToken,
                        traceId: traceId,
                        error: queueErr && queueErr.message,
                    });
                }

                return {
                    status: "ERROR",
                    data: null,
                    error: {
                        code: "BOOKING_RECONCILIATION_PENDING",
                        message: "La reserva se ha creado, pero su cierre interno está pendiente de verificación. No repitas la operación.",
                    },
                };
            }

            const madridDateYMD = f1LocalStart.slice(0, 10);
            setTimeout(function () {
                _invalidateCachesInternal(
                    serviceId,
                    madridDateYMD,
                    finalResourceId,
                    traceId
                ).catch(function (e) {
                    log.warn("Post-commit cache invalidation failed", {
                        traceId: traceId,
                        error: e && e.message,
                    });
                });
            }, 0);

            log.info("executeBookingSaga completed", {
                traceId: traceId,
                pairToken: pairToken,
                pairTokenSource: tokenResolution.source,
                isDual: isDual,
                bookingIds: finalResult.bookingIds,
                locationType: bookingLocation.locationType,
                addonCount: detectedAddonIds.length,
                requiresPayment: isOnline,
                elapsedMs: Date.now() - sagaStartTime,
            });

            return { status: "SUCCESS", data: finalResult, error: null };
        } catch (sagaErr) {
            if (transactionStarted && pairToken) {
                try {
                    const normSaga = normalizeError(sagaErr);
                    const uncertainStep =
                        (normSaga.details && normSaga.details.uncertainStep) || null;
                    if (uncertainStep) {
                        await markTransactionResultUnknown(pairToken, uncertainStep, traceId);
                    } else {
                        await _failTransaction(
                            pairToken,
                            (normSaga && normSaga.code) || "SAGA_FAILED"
                        );
                    }
                } catch (failErr) {
                    log.warn("_failTransaction could not be recorded", {
                        pairToken: pairToken,
                        traceId: traceId,
                        error: failErr && failErr.message,
                    });
                }
            }
            throw sagaErr;
        }
    } catch (error) {
        const norm = normalizeError(error);
        log.error("executeBookingSaga failed", {
            code: norm.code,
            error: norm.message,
            traceId: traceId,
        });
        return {
            status: "ERROR",
            data: null,
            error: {
                code: norm.code || ERROR_CODES.UNKNOWN_ERROR,
                message: norm.message,
            },
        };
    } finally {
        if (heartbeatMonitor) {
            heartbeatMonitor.stop();
            heartbeatMonitor = null;
        }
        await _bestEffortUnlockAll(lockKeys, lockOwnerId, lockRevisions);
    }
}
