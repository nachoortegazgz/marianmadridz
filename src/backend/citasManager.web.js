/**
 * MODULE: backend/citasManager.web.js
 * VERSION: v10.8-CLEAN
 * APIS: wix-web-module, @wix/ecom (orders), @wix/bookings (reschedule, getBooking, staff),
 *       @wix/members, @wix/essentials (auth).
 * DOC: https://dev.wix.com/docs/rest/business-solutions/bookings/bookings-writer-v2/reschedule-booking
 *      https://dev.wix.com/docs/rest/business-solutions/e-commerce/orders/introduction
 *
 * LEGACY: eliminado addOnId (solo addonId canónico).
 */
import { webMethod, Permissions } from "wix-web-module";
import { orders } from "@wix/ecom";
import { bookings } from "@wix/bookings";
import { auth } from "@wix/essentials";
import { currentMember } from "@wix/members";
import { queryFirstItem, queryItems, wql, CONSISTENCY, insertItem as dalInsert } from "backend/dataAccess";
import {
    BUSINESS_COLLECTIONS, OPERATIONAL_COLLECTIONS, CONTROL_TYPE, SDK_CONFIG,
    WIX_CATALOG_APP_IDS, BOOKING_STATUS, CITAS_BOOKING_STATUS, PAYMENT_STATUS, PAYMENT_METHOD, CHANNEL_TYPE,
    MOVEMENT_TYPE, BOOKING_TYPE, BOOKING_FIELDS, ROL_WEBSITE
} from "backend/internalConfig";
import {
    makeTraceId, _safeTrim, _looksLikeGuid, _normalizeLocalIsoStr,
    _readPositiveAmount, _toDateSafe, getUtcDateFromMadridLocal,
    getMadridLocalStringNoZ, withTimeout
} from "public/mmUtils";
import { toUtcRange, computeGapMinutes } from "backend/booking/bookingUtils";
import { executeBookingSaga } from "backend/booking/bookingSaga";
import { normalizeError, _handleError, ERROR_CODES, createBookingError, _updateCitaSafe, _forceStaffInPristineSlot } from "backend/booking/bookingCore";
import { registerBookingPayment } from "backend/cajas.web.js";
import { rateLimiter } from "backend/security";
import { logger } from "backend/logger";
import { logAuditEvent } from "backend/audit";
import { revalidateExactAvailabilitySlot, _getServiceBySlugOrIdInternal } from "backend/reservas.web.js";
import { findStaffByResourceId } from "backend/staff";

const log = logger;

// Estados permitidos del dominio CitasF2 (SSOT: internalConfig.js).
// Los estados terminales nunca pueden recibir un nuevo pago ni reprogramarse.
const BLOCKED_PAYMENT_STATES = new Set([
    CITAS_BOOKING_STATUS.CANCELLED,
    CITAS_BOOKING_STATUS.COMPLETED,
    CITAS_BOOKING_STATUS.REFUNDED,
    CITAS_BOOKING_STATUS.NO_SHOW,
]);
const ALLOWED_PAYMENT_CONFIRMATION_STATES = new Set([
    CITAS_BOOKING_STATUS.PENDING,
    CITAS_BOOKING_STATUS.CONFIRMED,
]);
const ALLOWED_RESCHEDULE_STATES = new Set([
    CITAS_BOOKING_STATUS.PENDING,
    CITAS_BOOKING_STATUS.CONFIRMED,
]);
const CITAS_COL = BUSINESS_COLLECTIONS.CITAS_F2;
const CONTROL_COL = OPERATIONAL_COLLECTIONS.CONTROL_OPERATIVO;
const API_TIMEOUT_MS = Number(SDK_CONFIG?.TIMEOUTS?.API_MS) || 15000;
const AUDIT_SOURCE = "backend/citasManager.web.js";
const FIELD_BOOKING_ID = BOOKING_FIELDS?.BOOKING_ID || "bookingId";
const FIELD_STATUS = BOOKING_FIELDS?.STATUS || "bookingStatus";
const FIELD_PAYMENT_STATUS = BOOKING_FIELDS?.PAYMENT_STATUS || "paymentStatus";
const FIELD_CASH_MOVEMENT_ID = BOOKING_FIELDS?.CASH_MOVEMENT_ID || "cashMovementId";
const FIELD_ORDER_ID = BOOKING_FIELDS?.ORDER_ID || "orderId";
const FIELD_TRACE_ID = BOOKING_FIELDS?.TRACE_ID || "traceId";
const FIELD_SERVICE_ID = BOOKING_FIELDS?.SERVICE_ID || "serviceId";
const FIELD_RESOURCE_ID = BOOKING_FIELDS?.RESOURCE_ID || "resourceId";
const FIELD_SLOT_START = BOOKING_FIELDS?.SLOT_START || "slotStart";
const FIELD_SLOT_END = BOOKING_FIELDS?.SLOT_END || "slotEnd";
const FIELD_PAIR_TOKEN = BOOKING_FIELDS?.PAIR_TOKEN || "pairToken";
const FIELD_CONTACT_DETAILS = BOOKING_FIELDS?.CONTACT_DETAILS || "contactDetails";
const CHANNEL_ONLINE = _safeTrim(CHANNEL_TYPE.ONLINE).toUpperCase();
const CHANNEL_PRESENCIAL = _safeTrim(CHANNEL_TYPE.PRESENCIAL).toUpperCase();
const getOrderElevated = auth.elevate(orders.getOrder);
const rescheduleBookingElevated = auth.elevate(bookings.rescheduleBooking);
const getBookingElevated = auth.elevate(bookings.getBooking);

/** Enforce the shared rate limiter before public booking/payment operations. */
function _rateLimitOrThrow(surface, key, traceId) {
    const result = rateLimiter({ surface, key });
    if (result?.allowed) return;

    const error = new Error(`RATE_LIMITED: retryAfter=${result?.retryAfter ?? 1}`);
    error.code = "RATE_LIMITED";
    error.meta = {
        retryAfter: result?.retryAfter ?? 1,
        surface,
        traceId: traceId || null,
    };
    throw error;
}

function _getCitaMeta(cita) {
if (!cita) return {};
const meta = cita.meta;
if (typeof meta === "string") {
try {
const parsed = JSON.parse(meta);
return parsed && typeof parsed === "object" && !Array.isArray(parsed)
? parsed
: {};
} catch (_) {
return {};
}
}
if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
return {};
}
return meta;
}

function _getAddOnIdsForRevalidation(cita) {
const meta = _getCitaMeta(cita);
const source = Array.isArray(meta.addOnIds)
? meta.addOnIds
: Array.isArray(meta.nativeAddonIds)
? meta.nativeAddonIds
: [];
return Array.from(
new Set(
source
.map((id) => _safeTrim(id))
.filter((id) => _looksLikeGuid(id))
)
).sort();
}

function _normalizeBookingAddOnIds(value) {
if (!Array.isArray(value)) return [];
return Array.from(
new Set(
value
.map((id) => _safeTrim(id))
.filter((id) => _looksLikeGuid(id))
)
).sort();
}

async function _findCitaByBookingId(bookingId) {
const normalizedId = _safeTrim(bookingId);
if (!normalizedId) return null;
return queryFirstItem({
dataCollectionId: CITAS_COL,
filter: wql.eq(FIELD_BOOKING_ID, normalizedId),
consistency: CONSISTENCY.STRONG,
});
}

async function _findCitasByPairToken(pairToken) {
const normalizedToken = _safeTrim(pairToken);
if (!normalizedToken) return [];
const result = await queryItems({
dataCollectionId: CITAS_COL,
filter: wql.eq(FIELD_PAIR_TOKEN, normalizedToken),
limit: 10,
offset: 0,
consistency: CONSISTENCY.STRONG,
});
return Array.isArray(result?.items) ? result.items : [];
}

/* CM5-04: orderId se lee de meta (campo fisico no existe en CitasF2).
* Fallback legacy a campo fisico preservado para datos historicos. */
async function _findCitaByOrderAndBookingId(orderId, bookingId) {
const cita = await _findCitaByBookingId(bookingId);
if (!cita) return null;
const meta = _getCitaMeta(cita);
const storedOrderId = _safeTrim(
cita?.[FIELD_ORDER_ID] || meta.orderId || ""
);
if (storedOrderId && storedOrderId !== _safeTrim(orderId)) {
return null;
}
return cita;
}

function _isPaidOrderStatus(value) {
const status = String(value || "").trim().toUpperCase();
return ["PAID", "FULLY_PAID", "PAID_FULL"].includes(status);
}

function _getOrderBookingLineItems(order) {
const lineItems = Array.isArray(order?.lineItems) ? order.lineItems : [];
const bookingsAppId = WIX_CATALOG_APP_IDS.BOOKINGS;
return lineItems.filter(
(item) => item?.catalogReference?.appId === bookingsAppId
);
}

function _getBookingLineItemsTotal(lineItems) {
return (lineItems || []).reduce((sum, item) => {
const amount = Number(item?.price?.amount ?? item?.price ?? 0) || 0;
const quantity = Number(item?.quantity) || 1;
return sum + amount * quantity;
}, 0);
}

/* CM5-03: canal online determinado por meta.channelType o meta.checkoutUrl.
* Ya no depende de PAYMENT_METHOD.ONLINE (no existe en enum). */
function _isOnlinePaymentAllowed(cita) {
const meta = _getCitaMeta(cita);
const channel = _safeTrim(meta.channelType || "").toUpperCase();
if (channel === CHANNEL_ONLINE) return true;
if (_safeTrim(meta.checkoutUrl || "")) return true;
/* Fallback transitorio: paymentMethod en meta (legacy pre-v10.4). */
const legacyPm = _safeTrim(meta.paymentMethod || "").toUpperCase();
return (
legacyPm === CHANNEL_ONLINE ||
legacyPm === _safeTrim(PAYMENT_METHOD.WIX_PAYMENTS).toUpperCase()
);
}

/* CM5-06: @wix/members con shape defensivo (SDK v2 envuelve en {member}). */
async function _getCurrentMemberInfo() {
try {
const response = await currentMember.getMember();
const member = response?.member || response;
if (!member || member.status === "ERROR") return null;
return member;
} catch (_) {
return null;
}
}

/* CM5-15: _getMemberId extrae memberId directamente. No usa email. */
function _getMemberId(member) {
if (!member) return "";
return _safeTrim(
member._id || member.id || member.memberId || ""
);
}

/* Staff permission roles come from the canonical resource-ID map.
 * Wix Bookings Staff Members does not return an authorization role. */
async function _getStaffAccess(resourceId, traceId = null) {
    const id = _safeTrim(resourceId);
    if (!id || !_looksLikeGuid(id)) return null;

    try {
        const staff = await findStaffByResourceId(id, traceId);
        if (!staff?.contactId || !staff.roleWebsite) return null;

        return {
            contactId: staff.contactId,
            roleWebsite: staff.roleWebsite,
        };
    } catch (error) {
        log.warn("_getStaffAccess: Bookings Staff Members lookup failed", {
            resourceId: id,
            traceId,
            error: error?.message,
        });
        return null;
    }
}

/**
* CM5-12: _validateProcessBookingPayload devuelve DTO completo normalizado.
* No devuelve solo {channelType}. El controlador NO debe volver a leer
* unsafePayload. Campos desconocidos se descartan silenciosamente.
* P0-MEMBERID: el memberId NUNCA proviene del payload publico (seria
* suplantable). Se inyecta desde la sesion server-side via sessionMemberId.
*/

function _validateProcessBookingPayload(payload, traceId, sessionMemberId = "") {

if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"Booking payload is invalid.",
{ traceId }
);
}

const requiredText = ["serviceId", "email", "firstName", "phone"];
for (const field of requiredText) {
if (!_safeTrim(payload[field])) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
`${field} is required.`,
{ traceId, field }
);
}
}

if (!payload.slotF1 || typeof payload.slotF1 !== "object") {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"slotF1 is required.",
{ traceId }
);
}

if (payload.rgpdConsent !== true) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"RGPD consent is required.",
{ traceId }
);
}

/* CM5-03/CM5-09: discriminador de canal. */
const channelRaw = _safeTrim(
payload.channelType || payload.paymentMethod || ""
).toUpperCase();
if (channelRaw !== CHANNEL_ONLINE && channelRaw !== CHANNEL_PRESENCIAL) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"Invalid channelType: expected ONLINE or PRESENCIAL.",
{ traceId, channelType: channelRaw || null }
);
}

/* paymentMethod opcional: si presente y no es valor de canal, debe ser
* miembro real del enum PAYMENT_METHOD. */
const pmRaw = _safeTrim(payload.paymentMethod || "").toUpperCase();
if (pmRaw && pmRaw !== CHANNEL_ONLINE && pmRaw !== CHANNEL_PRESENCIAL) {
const validMembers = Object.values(PAYMENT_METHOD || {}).map((v) =>
_safeTrim(v).toUpperCase()
);
if (!validMembers.includes(pmRaw)) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"Invalid payment method.",
{ traceId, paymentMethod: pmRaw }
);
}
}

if (payload.addOnIds !== undefined && !Array.isArray(payload.addOnIds)) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"addOnIds must be an array.",
{ traceId }
);
}

/* CM5-12: construir DTO allowlist cerrado. Solo campos validados. */
return {
serviceId: _safeTrim(payload.serviceId),
slug: _safeTrim(payload.slug || ""),
resourceId: _safeTrim(payload.resourceId || ""),
slotF1: payload.slotF1,
slotF2: payload.slotF2 || null,
email: _safeTrim(payload.email),
firstName: _safeTrim(payload.firstName),
lastName: _safeTrim(payload.lastName || ""),
phone: _safeTrim(payload.phone),
appointmentNote: _safeTrim(payload.appointmentNote || "").slice(0, 200),
channelType: channelRaw,
paymentMethod: pmRaw || null,
rgpdConsent: true,
addOnIds: _normalizeBookingAddOnIds(payload.addOnIds),
traceId: _safeTrim(payload.traceId || ""),
/* P0-MEMBERID: identidad server-side (currentMember). Nunca del payload. */
memberId: _safeTrim(sessionMemberId),
};
}

// =============================================================================
// BLOQUE 3 - PUBLIC WEB METHODS
// =============================================================================
/**
* CM5-12: processDualBooking construye DTO allowlist cerrado.
* Elimina {...unsafePayload}. Solo campos validados atraviesan la frontera.
*/
export const processDualBooking = webMethod(
Permissions.Anyone,
async (unsafePayload) => {
const traceId = unsafePayload?.traceId || makeTraceId("dual-bkg");
try {
/* P0-MEMBERID: identidad desde sesion server-side (@wix/members
* currentMember), nunca desde el payload del cliente (suplantable).
* Doc: https://dev.wix.com/docs/run-tutorials/extensions/members/ */
const sessionMember = await _getCurrentMemberInfo();
const sessionMemberId = _getMemberId(sessionMember);

/* CM5-12: validación devuelve DTO completo, no solo channelType. */
const validatedDto = _validateProcessBookingPayload(
unsafePayload,
traceId,
sessionMemberId
);

_rateLimitOrThrow(
"citasManager.processDualBooking",
sessionMemberId || _safeTrim(unsafePayload?.email) || "anon",
traceId
);

/* CM5-12: inyectar traceId si falta. No propagar unsafePayload. */
const normalizedPayload = {
...validatedDto,
traceId: validatedDto.traceId || traceId,
};

return await executeBookingSaga(normalizedPayload);
} catch (error) {
return _handleError(error, "processDualBooking", traceId);
}
}
);

/**
* confirmPayment v10.6:
*   - Ownership via Bookings Staff API + memberId match (CM5-15).
*   - Canal discriminado por CHANNEL_TYPE (CM5-03).
*   - Ledger con WIX_PAYMENTS + channelType ONLINE (CM5-05).
*   - orderId solo en meta (CM5-04).
*   - Idempotencia coherente (F-01).
*   - Auditoria si ledger OK pero CMS falla (F-10).
* NOTA: con checkout eCom, la confirmacion automatica vive en events.js.
* Este metodo es la via de staff/reconciliacion.
* PEND-CM5-02: Biblia 10 declara Admin; se mantiene SiteMember + ownership.
*/
export const confirmPayment = webMethod(
Permissions.SiteMember,
async (payload) => {
const traceId = payload?.traceId || makeTraceId("confirm-pay");
try {
_rateLimitOrThrow(
"citasManager.confirmPayment",
_safeTrim(payload?.orderId) || "anon",
traceId
);

const orderId = _safeTrim(payload?.orderId);
const bookingIds = Array.isArray(payload?.bookingIds)
? Array.from(
new Set(
payload.bookingIds
.map((id) => _safeTrim(id))
.filter((id) => _looksLikeGuid(id))
)
)
: [];
const requestedAmount = _readPositiveAmount(payload?.amount);

if (!orderId || bookingIds.length === 0) {
return {
status: "ERROR",
data: null,
error: {
code: "INVALID_PAYLOAD",
message: "orderId and valid bookingIds are required.",
},
};
}

/* F-02: lookup + ownership ANTES de consultar la orden. */
const citas = [];
for (const bookingId of bookingIds) {
const cita = await _findCitaByOrderAndBookingId(
orderId,
bookingId
);
if (!cita) {
return {
status: "ERROR",
data: null,
error: {
code: "CITA_NOT_FOUND",
message: "Booking record was not found.",
},
};
}
await _assertBookingOwner(cita, traceId);
citas.push(cita);
}

// A single paid F1 line item represents the complete dual appointment.
// Include its paired F2 row for payment validation and persistence, while
// keeping order-membership validation scoped to the actual purchased F1 IDs.
const expandedCitas = new Map(
citas.map(cita => [
_safeTrim(cita?.[FIELD_BOOKING_ID] || cita?.bookingId || ""),
cita,
])
);
for (const cita of citas) {
const meta = _getCitaMeta(cita);
const pairToken = _safeTrim(
cita?.[FIELD_PAIR_TOKEN] || meta.pairToken || ""
);
if (!pairToken) continue;

const pairedCitas = await _findCitasByPairToken(pairToken);
for (const pairedCita of pairedCitas) {
const pairedBookingId = _safeTrim(
pairedCita?.[FIELD_BOOKING_ID] || pairedCita?.bookingId || ""
);
if (!pairedBookingId || expandedCitas.has(pairedBookingId)) continue;
await _assertBookingOwner(pairedCita, traceId);
expandedCitas.set(pairedBookingId, pairedCita);
}
}
citas.splice(0, citas.length, ...expandedCitas.values());

await _validatePaymentCitaSet(citas, orderId, traceId);
await _validatePaymentIdempotency(citas, orderId, traceId);

for (const cita of citas) {
if (!_isOnlinePaymentAllowed(cita)) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"This booking is not configured for online payment.",
{ traceId }
);
}
}

/* F-01: idempotencia. */
const alreadyPaid = citas.every((cita) => {
const meta = _getCitaMeta(cita);
return (
String(
cita?.[FIELD_PAYMENT_STATUS] ||
meta.paymentStatus ||
""
).toUpperCase() === PAYMENT_STATUS.PAID &&
_safeTrim(meta.orderId || "") === orderId
);
});

if (alreadyPaid) {
return {
status: "SUCCESS",
data: {
paymentStatus: PAYMENT_STATUS.PAID,
confirmed: true,
amount: requestedAmount || 0,
idempotent: true,
},
error: null,
};
}

const { finalAmount } = await _getValidatedPaidOrder(
orderId,
bookingIds,
requestedAmount,
traceId
);

const linkedBookingIds = citas.map(cita => _safeTrim(cita?.[FIELD_BOOKING_ID] || cita?.bookingId || "")).filter(Boolean).join(",");

/* CM5-05: WIX_PAYMENTS + channelType ONLINE. Cero literales. */
const ledgerResult = await registerBookingPayment(
linkedBookingIds,
finalAmount,
PAYMENT_METHOD.WIX_PAYMENTS,
{
concept: "Online booking payment",
resourceId: "online",
traceId,
transactionId: `ORDER-${orderId}`,
orderId,
origen: "WIX_ECOM_PAYMENT_CONFIRM",
movementType: MOVEMENT_TYPE.VENTA_ONLINE,
channelType: CHANNEL_TYPE.ONLINE,
}
);

if (ledgerResult?.status !== "SUCCESS") {
await logAuditEvent(
"PAYMENT_LEDGER_FAILED",
"ERROR",
"Payment ledger registration failed.",
{
orderId,
traceId,
error: ledgerResult?.error?.message || null,
},
traceId,
orderId,
AUDIT_SOURCE
);
return {
status: "ERROR",
data: null,
error: {
code: "LEDGER_FAIL",
message:
ledgerResult?.error?.message ||
"Payment registration failed.",
},
};
}

const cashMovementId =
ledgerResult?.data?.cabeceraId ||
ledgerResult?.data?._id ||
null;

if (!cashMovementId) {
await logAuditEvent(
"PAYMENT_LEDGER_FAILED",
"ERROR",
"Ledger registered without cash movement reference.",
{ orderId, traceId, error: "LEDGER_REFERENCE_MISSING" },
traceId,
orderId,
AUDIT_SOURCE
);
return {
status: "ERROR",
data: null,
error: {
code: "LEDGER_REFERENCE_MISSING",
message:
"Payment could not be confirmed: ledger reference missing.",
},
};
}

/* F-10: auditoria si ledger OK pero update CMS falla. */
try {
await _setCitasPaymentState(
citas,
PAYMENT_STATUS.PAID,
orderId,
cashMovementId,
traceId
);
} catch (stateError) {
await logAuditEvent(
"PAYMENT_STATE_UPDATE_FAILED",
"ERROR",
"Ledger payment exists but booking state update failed.",
{
orderId,
cashMovementId,
traceId,
error: stateError?.message || String(stateError),
},
traceId,
orderId,
AUDIT_SOURCE
);
return {
status: "ERROR",
data: null,
error: {
code: "PAYMENT_STATE_UPDATE_FAILED",
message:
"Payment was registered but booking could not be updated. Reconciliation required.",
},
};
}

await logAuditEvent(
"PAYMENT_CONFIRMED",
"INFO",
"Booking payment confirmed.",
{ orderId, bookingIds, amount: finalAmount, traceId },
traceId,
orderId,
AUDIT_SOURCE
);

return {
status: "SUCCESS",
data: {
paymentStatus: PAYMENT_STATUS.PAID,
confirmed: true,
amount: finalAmount,
},
error: null,
};
} catch (error) {
const normalized = normalizeError(error);
log.error("confirmPayment failed", {
code: normalized.code,
error: normalized.message,
traceId,
});
return {
status: "ERROR",
data: null,
error: {
code: normalized.code || "CONFIRM_PAY_FAIL",
message: normalized.message,
},
};
}
}
);

// =============================================================================
// BLOQUE 4 - ORDER VALIDATION
// =============================================================================
async function _getValidatedPaidOrder(
orderId,
bookingIds,
requestedTotalAmount,
traceId
) {
const normalizedOrderId = _safeTrim(orderId);
if (!normalizedOrderId) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"orderId is required",
{ traceId }
);
}

let order;
try {
order = await withTimeout(
getOrderElevated(normalizedOrderId),
API_TIMEOUT_MS,
"getOrder"
);
} catch (error) {
throw createBookingError(
ERROR_CODES.DATABASE_ERROR,
"Failed to fetch order.",
{ traceId, cause: error?.message }
);
}

if (!order) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"Order not found",
{ traceId }
);
}

const paymentStatus = String(order?.paymentStatus || "").toUpperCase();
if (!_isPaidOrderStatus(paymentStatus)) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"Order is not paid.",
{ traceId, paymentStatus }
);
}

const bookingLineItems = _getOrderBookingLineItems(order);

const orderBookingIds = Array.from(
new Set(
bookingLineItems
.map((item) =>
_safeTrim(item?.catalogReference?.catalogItemId || "")
)
.filter(Boolean)
)
);

const requestedIds = new Set(bookingIds.map(String));
for (const id of requestedIds) {
if (!orderBookingIds.includes(id)) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"Booking is not included in the order.",
{ traceId, bookingId: id }
);
}
}

const orderTotal =
Number(order?.priceSummary?.total?.amount ?? 0) || 0;
const lineItemsTotal = _getBookingLineItemsTotal(bookingLineItems);
const finalAmount = orderTotal > 0 ? orderTotal : lineItemsTotal;

if (
requestedTotalAmount &&
Math.abs(finalAmount - requestedTotalAmount) > 0.01
) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"Amount does not match the order.",
{ traceId }
);
}

return { order, finalAmount, bookingLineItems };
}

async function _validatePaymentCitaSet(citas, orderId, traceId) {
for (const cita of citas) {
const meta = _getCitaMeta(cita);
const currentPaymentStatus = String(
cita?.[FIELD_PAYMENT_STATUS] || meta.paymentStatus || ""
).toUpperCase();
const existingOrderId = _safeTrim(meta.orderId || "");
const bookingId = _safeTrim(
cita?.[FIELD_BOOKING_ID] || cita?.bookingId || ""
);

if (currentPaymentStatus === PAYMENT_STATUS.REFUNDED) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"Booking has already been refunded.",
{ traceId, bookingId, orderId }
);
}

if (
currentPaymentStatus === PAYMENT_STATUS.PAID &&
existingOrderId !== orderId
) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"Booking has already been paid with another order.",
{ traceId, bookingId, orderId, existingOrderId }
);
}

const bookingStatus = String(
cita?.[FIELD_STATUS] || cita?.bookingStatus || ""
).toUpperCase();
if (
BLOCKED_PAYMENT_STATES.has(bookingStatus) ||
(bookingStatus && !ALLOWED_PAYMENT_CONFIRMATION_STATES.has(bookingStatus))
) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"Booking cannot be paid in its current state.",
{ traceId, bookingId, bookingStatus }
);
}
}
}

async function _validatePaymentIdempotency(citas, orderId, traceId) {
let paidCount = 0;
for (const cita of citas) {
const meta = _getCitaMeta(cita);
const existingOrderId = _safeTrim(meta.orderId || "");
const paymentStatus = String(
cita?.[FIELD_PAYMENT_STATUS] || meta.paymentStatus || ""
).toUpperCase();

if (paymentStatus !== PAYMENT_STATUS.PAID) continue;

if (!existingOrderId || existingOrderId !== orderId) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"Booking has already been paid.",
{ traceId, orderId, existingOrderId }
);
}

paidCount += 1;
}

if (paidCount > 0 && paidCount !== citas.length) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"Payment state is inconsistent across bookings.",
{ traceId, orderId, paidCount, total: citas.length }
);
}
}

/* CM5-04: orderId solo en meta. cashMovementId es campo fisico real. */
async function _setCitasPaymentState(
citas,
paymentState,
orderId,
cashMovementId,
traceId
) {
for (const cita of citas) {
const bookingId = _safeTrim(
cita?.[FIELD_BOOKING_ID] || cita?.bookingId || ""
);
if (!bookingId) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"Booking identifier is missing.",
{ traceId }
);
}

await _updateCitaSafe(
bookingId,
(currentCita) => {
const meta = _getCitaMeta(currentCita);
return {
...currentCita,
// Payment confirmation never changes the native booking approval state.
[FIELD_PAYMENT_STATUS]: paymentState,
[FIELD_CASH_MOVEMENT_ID]: cashMovementId || null,
[FIELD_TRACE_ID]: traceId,
meta: {
...meta,
paymentStatus: paymentState,
cashMovementId: cashMovementId || null,
orderId: orderId || null,
traceId,
fechaConfirmacionPago: new Date(),
},
};
},
traceId,
"citasManager_setPaymentState"
);
}
}

// =============================================================================
// BLOQUE 5 - OWNERSHIP (CM5-15: memberId exacto, no email)
// =============================================================================
/**
* CM5-15: ownership real por memberId exacto.
* Rutas (en orden):
*   1. Staff elevado: Bookings Staff API confirma rol OWNER/ADMIN para el
*      resourceId de la cita.
*   2. Propietario por memberId: memberId del miembro autenticado coincide
*      con contactDetails.memberId de la cita.
*   Fuera de esas rutas: AUTH_REQUIRED. No se autoriza por email.
*/
async function _assertBookingOwner(cita, traceId) {
if (!cita) {
throw createBookingError(
ERROR_CODES.AUTH_REQUIRED,
"Booking was not found.",
{ traceId }
);
}

const member = await _getCurrentMemberInfo();
if (!member) {
throw createBookingError(
ERROR_CODES.AUTH_REQUIRED,
"Authenticated member is required for this operation.",
{ traceId }
);
}

const currentMemberId = _getMemberId(member);
if (!currentMemberId) {
throw createBookingError(
ERROR_CODES.AUTH_REQUIRED,
"Member ID could not be determined.",
{ traceId }
);
}

/* Ruta 1: staff elevado via Bookings Staff API. */
const resourceId = _safeTrim(
cita?.[FIELD_RESOURCE_ID] || cita?.resourceId || ""
);
if (resourceId) {
const staffAccess = await _getStaffAccess(resourceId, traceId);
if (
staffAccess &&
_safeTrim(member.contactId) &&
staffAccess.contactId === _safeTrim(member.contactId) &&
staffAccess.roleWebsite === ROL_WEBSITE.ADMIN
) {
return {
memberId: currentMemberId,
via: "STAFF_ROLE",
role: staffAccess.roleWebsite,
};
}
}

/* Ruta 2: propietario por memberId exacto (CM5-15). */
const meta = _getCitaMeta(cita);
const contactDetails =
cita?.[FIELD_CONTACT_DETAILS] || meta.contactDetails || {};
const citaMemberId = _safeTrim(contactDetails?.memberId || "");

if (citaMemberId && citaMemberId === currentMemberId) {
return { memberId: currentMemberId, via: "MEMBER_ID_MATCH" };
}


throw createBookingError(
ERROR_CODES.AUTH_REQUIRED,
"You are not authorized for this booking.",
{ traceId }
);
}

// =============================================================================
// BLOQUE 6 - BOOKING LOOKUP Y SLOTS
// =============================================================================
/* CM5-07: slotStart/slotEnd son Date en wix-data. _toDateSafe maneja
* Date objects correctamente; _normalizeLocalIsoStr(Date) devolvia "". */
function _getBookingSlotFromCita(cita) {
return {
serviceId: _safeTrim(
cita?.[FIELD_SERVICE_ID] || cita?.serviceId || ""
),
resourceId: _safeTrim(
cita?.[FIELD_RESOURCE_ID] || cita?.resourceId || ""
),
slotStart: _toDateSafe(cita?.[FIELD_SLOT_START]) || null,
slotEnd: _toDateSafe(cita?.[FIELD_SLOT_END]) || null,
};
}

function _getDualSlotInput(payload, key) {
const slot = payload?.[key];
if (!slot || typeof slot !== "object" || Array.isArray(slot)) return null;

const localStartDate = _normalizeLocalIsoStr(slot.localStartDate);
const localEndDate = _normalizeLocalIsoStr(slot.localEndDate);
const slotRef =
slot.slotRef &&
typeof slot.slotRef === "object" &&
!Array.isArray(slot.slotRef)
? slot.slotRef
: null;

if (!localStartDate || !localEndDate || !slotRef) return null;
if (!_hasSlotReference(slotRef)) return null;

return {
localStartDate,
localEndDate,
slotRef,
serviceId: _safeTrim(slot.serviceId || ""),
};
}

function _hasSlotReference(slotRef) {
if (!slotRef || typeof slotRef !== "object") return false;
return Boolean(
_safeTrim(slotRef.id || "") ||
_safeTrim(slotRef.slotId || "") ||
_safeTrim(slotRef.scheduleId || "") ||
_safeTrim(slotRef.serviceId || "")
);
}

function _slotReferenceMatches(inputSlot, result) {
const returnedSlot = result?.data?.slot;
if (!returnedSlot) return false;

const inputStart = _normalizeLocalIsoStr(inputSlot.localStartDate);
const inputEnd = _normalizeLocalIsoStr(inputSlot.localEndDate);
const resultStart = _normalizeLocalIsoStr(
returnedSlot.localStartDate || returnedSlot.startDate || ""
);
const resultEnd = _normalizeLocalIsoStr(
returnedSlot.localEndDate || returnedSlot.endDate || ""
);

return inputStart === resultStart && inputEnd === resultEnd;
}

/* CM5-11: valor canonico DUAL_F2. */
function _matchesCitaPairIdentifier(cita, token) {
const meta = _getCitaMeta(cita);
const pairToken = _safeTrim(
cita?.[FIELD_PAIR_TOKEN] || meta.pairToken
);
return pairToken === _safeTrim(token);
}

function _buildDualRescheduleSlot(serviceConfig, inputSlot, expectedServiceId) {
if (
!serviceConfig ||
!inputSlot?.localStartDate ||
!inputSlot?.localEndDate
) {
return null;
}

const linkedServiceId = _safeTrim(serviceConfig.linkedPhases || "");
const expectedId = _safeTrim(expectedServiceId);

if (!linkedServiceId || !expectedId || linkedServiceId !== expectedId) {
return null;
}

return {
serviceId: linkedServiceId,
localStartDate: inputSlot.localStartDate,
localEndDate: inputSlot.localEndDate,
};
}

async function _loadServiceConfigForCita(cita, traceId) {
const meta = _getCitaMeta(cita);
const serviceId = _safeTrim(
cita?.[FIELD_SERVICE_ID] || cita?.serviceId || meta.serviceId
);

if (!serviceId) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"Booking service is missing.",
{ traceId }
);
}

const result = await _getServiceBySlugOrIdInternal(serviceId, traceId);
if (result?.status !== "SUCCESS" || !result?.data) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"Booking service configuration was not found.",
{ traceId }
);
}

return result.data;
}

// =============================================================================
// BLOQUE 7 - DUAL SLOT REVALIDATION
// =============================================================================
async function _revalidateDualInputSlots(
citas,
slotF1Input,
slotF2Input,
traceId
) {
if (!slotF1Input?.localStartDate || !slotF1Input?.localEndDate) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"F1 slot dates are required.",
{ traceId }
);
}

if (!slotF2Input?.localStartDate || !slotF2Input?.localEndDate) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"F2 slot dates are required.",
{ traceId }
);
}

/* CM5-11: valor canonico DUAL_F2. */
const f1Cita =
citas.find((cita) => {
const meta = _getCitaMeta(cita);
return !(
cita?.bookingType === BOOKING_TYPE.DUAL_F2 ||
meta.linkedF1BookingId
);
}) || citas[0];

const f2Cita =
citas.find((cita) => {
const meta = _getCitaMeta(cita);
return (
cita?.bookingType === BOOKING_TYPE.DUAL_F2 ||
Boolean(meta.linkedF1BookingId)
);
}) || citas[1];

if (!f1Cita || !f2Cita) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"Both dual booking phases are required.",
{ traceId }
);
}

const f1ServiceId = _safeTrim(
f1Cita?.[FIELD_SERVICE_ID] ||
f1Cita?.serviceId ||
_getCitaMeta(f1Cita).serviceId
);
const f2ServiceId = _safeTrim(
f2Cita?.[FIELD_SERVICE_ID] ||
f2Cita?.serviceId ||
_getCitaMeta(f2Cita).serviceId
);

if (slotF1Input.serviceId && slotF1Input.serviceId !== f1ServiceId) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"F1 service does not match the booking.",
{ traceId, expected: f1ServiceId, received: slotF1Input.serviceId }
);
}

if (slotF2Input.serviceId && slotF2Input.serviceId !== f2ServiceId) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"F2 service does not match the booking.",
{ traceId, expected: f2ServiceId, received: slotF2Input.serviceId }
);
}

const f1ResourceId = _safeTrim(
f1Cita?.[FIELD_RESOURCE_ID] || f1Cita?.resourceId || ""
);
const f2ResourceId = _safeTrim(
f2Cita?.[FIELD_RESOURCE_ID] || f2Cita?.resourceId || ""
);

if (f1ResourceId && f2ResourceId && f1ResourceId !== f2ResourceId) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"Dual phases must use the same staff member.",
{ traceId }
);
}

const selectedResourceId = f1ResourceId || f2ResourceId || null;
const f1Addons = _getAddOnIdsForRevalidation(f1Cita);
const f2Addons = _getAddOnIdsForRevalidation(f2Cita);

const f1Result = await revalidateExactAvailabilitySlot({
serviceId: f1ServiceId,
localStartDate: slotF1Input.localStartDate,
localEndDate: slotF1Input.localEndDate,
resourceId: selectedResourceId,
nativeAddonIds: f1Addons,
traceId,
});

if (
f1Result?.status !== "SUCCESS" ||
!_slotReferenceMatches(slotF1Input, f1Result)
) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"F1 slot could not be verified.",
{ traceId }
);
}

const f2Result = await revalidateExactAvailabilitySlot({
serviceId: f2ServiceId,
localStartDate: slotF2Input.localStartDate,
localEndDate: slotF2Input.localEndDate,
resourceId: selectedResourceId,
nativeAddonIds: f2Addons,
traceId,
});

if (
f2Result?.status !== "SUCCESS" ||
!_slotReferenceMatches(slotF2Input, f2Result)
) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"F2 slot could not be verified.",
{ traceId }
);
}

const range = toUtcRange(
slotF1Input.localStartDate,
slotF1Input.localEndDate
);
const f2StartUtc = getUtcDateFromMadridLocal(slotF2Input.localStartDate);

if (!range || !f2StartUtc) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"Dual slot dates are invalid.",
{ traceId }
);
}

const { endUtc: f1EndUtc } = range;

if (f2StartUtc.getTime() < f1EndUtc.getTime()) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"F2 must start after F1.",
{ traceId }
);
}

const serviceConfig = await _loadServiceConfigForCita(f1Cita, traceId);

const rawExposureMinutes = Number(serviceConfig?.exposureDuration);
if (!Number.isFinite(rawExposureMinutes) || rawExposureMinutes < 0) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"ServiciosCatalogo.exposureDuration must be a non-negative number of minutes.",
{ traceId, exposureDuration: serviceConfig?.exposureDuration }
);
}
const exposureMinutes = rawExposureMinutes;

const gapMinutes = (f2StartUtc.getTime() - f1EndUtc.getTime()) / 60000;

if (gapMinutes === null) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"Gap between F1 and F2 could not be computed.",
{ traceId }
);
}

if (gapMinutes !== exposureMinutes) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"Gap between F1 and F2 must exactly match ServiciosCatalogo.exposureDuration.",
{ traceId, gapMinutes, exposureMinutes }
);
}

return {
f1Cita,
f2Cita,
f1Result,
f2Result,
selectedResourceId,
serviceConfig,
gapMinutes,
exposureMinutes,
};
}

// =============================================================================
// BLOQUE 8 - RESCHEDULE (CM5-08 / CM5-13 / CM5-14 / BIBLIA 10 y 20.8)
// =============================================================================
/**
* CM5-16: _fetchLiveRevision lee revisión viva de Bookings.
* Elimina código muerto que llamaba a getStaffElevated en vez de getBooking.
* Fallback a cita.revision solo si getBooking falla.
*/
async function _fetchLiveRevision(bookingId, cita) {
const id = _safeTrim(bookingId);
if (!id || !_looksLikeGuid(id)) {
log.warn("_fetchLiveRevision: invalid bookingId", { bookingId: id });
return _safeTrim(cita?.revision || _getCitaMeta(cita).writerRevision || "") || "";
}

try {
const live = await withTimeout(
getBookingElevated(id),
API_TIMEOUT_MS,
"getBookingForRevision"
);
const liveBooking = live?.booking || live;
const revision = _safeTrim(liveBooking?.revision);
if (revision) return revision;
} catch (error) {
log.warn("_fetchLiveRevision: getBooking failed; fallback to cita.revision", {
bookingId: id,
error: error?.message,
});
}

/* Fallback: usar revisión persistida en CMS. */
const meta = _getCitaMeta(cita);
return _safeTrim(cita?.revision || meta.writerRevision || "") || "";
}

function _assertReschedulableCita(cita, traceId) {
const bookingStatus = _safeTrim(
cita?.[FIELD_STATUS] || cita?.bookingStatus || ""
).toUpperCase();

if (!ALLOWED_RESCHEDULE_STATES.has(bookingStatus)) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"Booking cannot be rescheduled in its current state.",
{ traceId, bookingStatus }
);
}

const currentSlot = _getBookingSlotFromCita(cita);
if (currentSlot.slotEnd && currentSlot.slotEnd.getTime() <= Date.now()) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"Booking slot has already started or finished.",
{ traceId }
);
}

return currentSlot;
}

async function _rescheduleBookingNative(cita, slotInput, traceId) {
const bookingId = _safeTrim(
cita?.[FIELD_BOOKING_ID] || cita?.bookingId || ""
);

if (!bookingId || !_looksLikeGuid(bookingId)) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"Booking identifier is missing.",
{ traceId }
);
}

const serviceId = _safeTrim(
slotInput.serviceId ||
cita?.[FIELD_SERVICE_ID] ||
cita?.serviceId ||
""
);
const resourceId = _safeTrim(
cita?.[FIELD_RESOURCE_ID] || cita?.resourceId || ""
);

const pristineSlot = await _forceStaffInPristineSlot(
{
localStartDate: slotInput.localStartDate,
localEndDate: slotInput.localEndDate,
},
resourceId,
serviceId,
null
);

if (!pristineSlot) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"Could not build the reschedule slot.",
{ traceId, bookingId }
);
}

const revision = await _fetchLiveRevision(bookingId, cita);
if (!revision) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"Current booking revision is required to reschedule.",
{ traceId, bookingId }
);
}

/* Contrato oficial: revision como STRING. */
await withTimeout(
rescheduleBookingElevated(bookingId, {
slot: pristineSlot,
revision: String(revision),
}),
API_TIMEOUT_MS,
"rescheduleBooking"
);

const startUtc = getUtcDateFromMadridLocal(slotInput.localStartDate);
const endUtc = getUtcDateFromMadridLocal(slotInput.localEndDate);

return {
bookingId,
startUtc,
endUtc,
dateYmd: _safeTrim(slotInput.localStartDate).slice(0, 10),
};
}

async function _applyRescheduleToCita(cita, rescheduleResult, traceId) {
const bookingId = rescheduleResult.bookingId;
const previousSlot = _getBookingSlotFromCita(cita);

await _updateCitaSafe(
bookingId,
(currentCita) => {
const currentMeta = _getCitaMeta(currentCita);
return {
...currentCita,
[FIELD_SLOT_START]: rescheduleResult.startUtc,
[FIELD_SLOT_END]: rescheduleResult.endUtc,
dateYmd: rescheduleResult.dateYmd,
[FIELD_TRACE_ID]: traceId,
meta: {
...currentMeta,
previousSlotStart: previousSlot.slotStart || null,
previousSlotEnd: previousSlot.slotEnd || null,
rescheduledAt: new Date(),
traceId,
},
};
},
traceId,
"citasManager_reschedule"
);

/* Invalidacion de caches best-effort. */
try {
const serviceId = _safeTrim(
cita?.[FIELD_SERVICE_ID] || cita?.serviceId || ""
);
const resourceId = _safeTrim(
cita?.[FIELD_RESOURCE_ID] || cita?.resourceId || ""
);
const { _invalidateCachesInternal } = await import(
"backend/reservas.web.js"
).catch(() => ({ _invalidateCachesInternal: null }));

if (typeof _invalidateCachesInternal === "function") {
await _invalidateCachesInternal(
serviceId,
rescheduleResult.dateYmd,
resourceId,
traceId
).catch(() => null);
}
} catch (_) {
/* best effort */
}
}

/**
* CM5-14: marca par dual como inconsistente en ControlOperativo.
* Usado cuando rollback de F1 falla tras fallo de F2, o cuando
* CMS F2 falla tras CMS F1 exitoso.
*/
async function _markDualPairInconsistent(pairToken, reason, traceId, error) {
const dedupeKey = `DUAL_INCONSISTENT_${_safeTrim(pairToken)}`;
try {
await dalInsert(CONTROL_COL, {
controlType: CONTROL_TYPE.SYSTEM_FLAG,
dedupeKey,
pairToken: _safeTrim(pairToken),
payload: {
reason,
traceId: _safeTrim(traceId),
error: error?.message || String(error || ""),
markedAt: new Date().toISOString(),
status: "REPAIR_REQUIRED",
},
traceId: _safeTrim(traceId) || makeTraceId("inconsistent"),
});
log.error("CM5-14: dual pair marked inconsistent", {
pairToken,
reason,
traceId,
});
} catch (insertError) {
log.error("CM5-14: failed to mark dual pair inconsistent", {
pairToken,
reason,
traceId,
error: insertError?.message,
});
}
}

/**
* CM5-08: reprogramacion de reserva simple.
* Payload: { bookingId, slotF1: {localStartDate, localEndDate, serviceId?} }
*/
export const rescheduleExistingBooking = webMethod(
Permissions.SiteMember,
async (payload) => {
const traceId = payload?.traceId || makeTraceId("resched");
try {
_rateLimitOrThrow(
"citasManager.rescheduleExistingBooking",
_safeTrim(payload?.bookingId) || "anon",
traceId
);

const bookingId = _safeTrim(payload?.bookingId);
if (!bookingId || !_looksLikeGuid(bookingId)) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"bookingId is required.",
{ traceId }
);
}

const localStartDate = _normalizeLocalIsoStr(
payload?.slotF1?.localStartDate || ""
);
const localEndDate = _normalizeLocalIsoStr(
payload?.slotF1?.localEndDate || ""
);

if (!localStartDate || !localEndDate) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"slotF1.localStartDate and localEndDate are required.",
{ traceId }
);
}

const cita = await _findCitaByBookingId(bookingId);
if (!cita) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"Booking record was not found.",
{ traceId }
);
}

await _assertBookingOwner(cita, traceId);
_assertReschedulableCita(cita, traceId);

const citaServiceId = _safeTrim(
cita?.[FIELD_SERVICE_ID] || cita?.serviceId || ""
);
const requestedServiceId = _safeTrim(
payload?.slotF1?.serviceId || ""
);

if (requestedServiceId && requestedServiceId !== citaServiceId) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"Requested service does not match the booking.",
{ traceId, expected: citaServiceId }
);
}

const resourceId = _safeTrim(
cita?.[FIELD_RESOURCE_ID] || cita?.resourceId || ""
);

const revalidated = await revalidateExactAvailabilitySlot({
serviceId: citaServiceId,
localStartDate,
localEndDate,
resourceId,
nativeAddonIds: _getAddOnIdsForRevalidation(cita),
traceId,
});

if (revalidated?.status !== "SUCCESS") {
throw createBookingError(
ERROR_CODES.SLOT_UNAVAILABLE,
"New slot could not be verified.",
{ traceId }
);
}

const slotInput = {
localStartDate,
localEndDate,
serviceId: citaServiceId,
};

const rescheduleResult = await _rescheduleBookingNative(
cita,
slotInput,
traceId
);

await _applyRescheduleToCita(cita, rescheduleResult, traceId);

await logAuditEvent(
"BOOKING_RESCHEDULED",
"INFO",
"Booking rescheduled.",
{
bookingId,
traceId,
newStart: localStartDate,
newEnd: localEndDate,
},
traceId,
bookingId,
AUDIT_SOURCE
);

return {
status: "SUCCESS",
data: {
bookingId,
slotStart: rescheduleResult.startUtc,
slotEnd: rescheduleResult.endUtc,
dateYmd: rescheduleResult.dateYmd,
},
error: null,
};
} catch (error) {
return _handleError(error, "rescheduleExistingBooking", traceId);
}
}
);

/**
* CM5-08/CM5-13/CM5-14: reprogramacion atomica de reserva dual (F1 + F2).
* Payload: { pairToken, slotF1: {..., slotRef}, slotF2: {..., slotRef} }
* Orden: revalidar -> journal IN_PROGRESS -> reschedule F1 -> reschedule F2.
* Si F2 falla: rollback best-effort de F1 con revisión VIVA (CM5-13).
* Si rollback falla: marcar par como INCONSISTENT (CM5-14/CM5-17).
*/
export const rescheduleDualBookings = webMethod(
Permissions.SiteMember,
async (payload) => {
const traceId = payload?.traceId || makeTraceId("resched-dual");
try {
_rateLimitOrThrow(
"citasManager.rescheduleDualBookings",
_safeTrim(payload?.pairToken) || "anon",
traceId
);

const pairToken = _safeTrim(payload?.pairToken);
if (!pairToken) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"pairToken is required.",
{ traceId }
);
}

const slotF1Input = _getDualSlotInput(payload, "slotF1");
const slotF2Input = _getDualSlotInput(payload, "slotF2");

if (!slotF1Input || !slotF2Input) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"slotF1 and slotF2 with localStartDate, localEndDate and slotRef are required.",
{ traceId }
);
}

const citas = await _findCitasByPairToken(pairToken);
const matched = citas.filter((cita) =>
_matchesCitaPairIdentifier(cita, pairToken)
);

if (matched.length < 2) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"Dual booking phases were not found for this pairToken.",
{ traceId, found: matched.length }
);
}

for (const cita of matched) {
await _assertBookingOwner(cita, traceId);
_assertReschedulableCita(cita, traceId);
}

const validation = await _revalidateDualInputSlots(
matched,
slotF1Input,
slotF2Input,
traceId
);

const { f1Cita, f2Cita, serviceConfig } = validation;

const f2ExpectedServiceId = _safeTrim(
f2Cita?.[FIELD_SERVICE_ID] || f2Cita?.serviceId || ""
);

const dualF2Slot = _buildDualRescheduleSlot(
serviceConfig,
slotF2Input,
f2ExpectedServiceId
);

if (!dualF2Slot) {
throw createBookingError(
ERROR_CODES.INVALID_PAYLOAD,
"F2 slot does not correspond to the linked phase of the service.",
{ traceId, expected: f2ExpectedServiceId }
);
}

/* CM5-14: journal persistente ANTES de cualquier efecto. */
const journalDedupeKey = `DUAL_RESCHEDULE_${pairToken}_${Date.now()}`;
try {
await dalInsert(CONTROL_COL, {
controlType: CONTROL_TYPE.SYSTEM_FLAG,
dedupeKey: journalDedupeKey,
pairToken,
payload: {
operationType: "DUAL_RESCHEDULE",
status: "IN_PROGRESS",
originalF1: _getBookingSlotFromCita(f1Cita),
originalF2: _getBookingSlotFromCita(f2Cita),
targetF1: slotF1Input,
targetF2: dualF2Slot,
traceId,
startedAt: new Date().toISOString(),
},
traceId,
});
} catch (journalError) {
log.error("CM5-14: failed to persist reschedule journal", {
pairToken,
traceId,
error: journalError?.message,
});
throw createBookingError(
ERROR_CODES.DATABASE_ERROR,
"Dual reschedule journal could not be persisted.",
{ traceId, pairToken, cause: journalError?.message }
);
}

const originalF1Slot = _getBookingSlotFromCita(f1Cita);

const f1Result = await _rescheduleBookingNative(
f1Cita,
slotF1Input,
traceId
);

let f2Result = null;
try {
f2Result = await _rescheduleBookingNative(
f2Cita,
dualF2Slot,
traceId
);
} catch (f2Error) {
log.error("Dual reschedule: F2 failed; rolling back F1 with live revision", {
traceId,
error: f2Error?.message,
});

/* CM5-13: rollback de F1 con revisión VIVA de Bookings.
* No reutilizar f1Cita con revisión obsoleta. */
if (originalF1Slot.slotStart && originalF1Slot.slotEnd) {
try {
/* Leer revisión viva antes de rollback. */
const liveF1Revision = await _fetchLiveRevision(
f1Result.bookingId,
f1Cita
);

if (!liveF1Revision) {
throw new Error("Cannot obtain live revision for F1 rollback");
}

await _rescheduleBookingNative(
{
...f1Cita,
revision: liveF1Revision,
},
{
localStartDate: getMadridLocalStringNoZ(
originalF1Slot.slotStart
),
localEndDate: getMadridLocalStringNoZ(
originalF1Slot.slotEnd
),
serviceId: originalF1Slot.serviceId,
},
traceId
);

log.info("CM5-13: F1 rollback succeeded with live revision", {
pairToken,
traceId,
bookingId: f1Result.bookingId,
});
} catch (rollbackError) {
/* CM5-17: rollback falló, marcar par como INCONSISTENT. */
log.error("CM5-17: F1 rollback failed; marking pair inconsistent", {
pairToken,
traceId,
error: rollbackError?.message,
});

await _markDualPairInconsistent(
pairToken,
"F1_ROLLBACK_FAILED",
traceId,
rollbackError
);

await logAuditEvent(
"RESCHEDULE_ROLLBACK_FAILED",
"ERROR",
"F1 rollback failed after F2 reschedule error. Pair marked inconsistent.",
{
pairToken,
traceId,
error:
rollbackError?.message ||
String(rollbackError),
},
traceId,
pairToken,
AUDIT_SOURCE
);
}
}

throw f2Error;
}

/* CM5-14: aplicar cambios a CMS. Si F2 CMS falla, marcar INCONSISTENT. */
try {
await _applyRescheduleToCita(f1Cita, f1Result, traceId);
await _applyRescheduleToCita(f2Cita, f2Result, traceId);
} catch (cmsError) {
log.error("CM5-14: CMS update failed after native reschedule; marking inconsistent", {
pairToken,
traceId,
error: cmsError?.message,
});

await _markDualPairInconsistent(
pairToken,
"DUAL_CMS_PARTIAL_UPDATE",
traceId,
cmsError
);

throw cmsError;
}

await logAuditEvent(
"DUAL_BOOKING_RESCHEDULED",
"INFO",
"Dual booking rescheduled.",
{ pairToken, traceId, gapMinutes: validation.gapMinutes },
traceId,
pairToken,
AUDIT_SOURCE
);

return {
status: "SUCCESS",
data: {
pairToken,
f1: {
bookingId: f1Result.bookingId,
slotStart: f1Result.startUtc,
slotEnd: f1Result.endUtc,
dateYmd: f1Result.dateYmd,
},
f2: {
bookingId: f2Result.bookingId,
slotStart: f2Result.startUtc,
slotEnd: f2Result.endUtc,
dateYmd: f2Result.dateYmd,
},
gapMinutes: validation.gapMinutes,
},
error: null,
};
} catch (error) {
return _handleError(error, "rescheduleDualBookings", traceId);
}
}
);