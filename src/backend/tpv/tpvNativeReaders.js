import { auth } from "@wix/essentials";
import { contactsV5 } from "@wix/crm";
import { extendedBookings } from "@wix/bookings";

const searchContactsElevated = auth.elevate(contactsV5.searchContacts);
const getContactElevated = auth.elevate(contactsV5.getContact);
const queryExtendedBookingsElevated = auth.elevate(extendedBookings.queryExtendedBookings);
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeContact(contact) {
    const first = String(contact?.name?.first || "").trim();
    const last = String(contact?.name?.last || "").trim();
    return {
        contactId: String(contact?._id || ""),
        displayName: [first, last].filter(Boolean).join(" ") ||
            String(contact?.company?.name || contact?.email?.email || contact?.phone?.phone || "Contacto Wix"),
        email: String(contact?.email?.email || ""),
        phone: String(contact?.phone?.phone || ""),
    };
}

export async function buscarContactosTPV(expression) {
    const search = String(expression || "").trim().slice(0, 100);
    if (search.length < 2) throw new Error("TPV_CUSTOMER_SEARCH_TOO_SHORT");
    const result = await searchContactsElevated({
        search: { expression: search, mode: "OR", fuzzy: true },
        sort: [{ fieldName: "_createdDate", order: "DESC" }],
        cursorPaging: { limit: 10 },
    }, { nameFormat: "BY_FIRST_NAME" });
    return {
        items: (result?.contacts || []).map(normalizeContact).filter((item) => GUID.test(item.contactId)),
        pagingMetadata: result?.pagingMetadata || null,
    };
}

export async function consultarReservasTPV({ contactId, cursor = null } = {}) {
    if (!GUID.test(String(contactId || ""))) throw new Error("TPV_INVALID_CONTACT_ID");
    const limit = 50;
    const query = cursor
        ? { cursorPaging: { limit, cursor: String(cursor).slice(0, 16000) } }
        : {
            filter: {
                "contactDetails.contactId": contactId,
                startDate: {
                    $gte: new Date(Date.now() - 365 * 86400000).toISOString(),
                    $lte: new Date(Date.now() + 365 * 86400000).toISOString(),
                },
            },
            sort: [{ fieldName: "startDate", order: "ASC" }],
            cursorPaging: { limit },
        };
    const result = await queryExtendedBookingsElevated(query, {});
    const items = (result?.extendedBookings || []).map((entry) => {
        const booking = entry?.booking || {};
        const slot = booking.bookedEntity?.slot || {};
        const schedule = booking.bookedEntity?.schedule || {};
        return {
            bookingId: String(booking._id || booking.id || entry?._id || ""),
            status: String(booking.status || "UNKNOWN"),
            paymentStatus: String(booking.paymentStatus || "UNKNOWN"),
            startDate: booking.startDate || slot.startDate || schedule.firstSessionStart || null,
            endDate: booking.endDate || slot.endDate || schedule.lastSessionEnd || null,
            title: String(booking.bookedEntity?.title || "Reserva Wix"),
            serviceId: String(slot.serviceId || schedule.serviceId || ""),
            professionalId: String(slot.resource?._id || ""),
            professionalName: String(slot.resource?.name || ""),
        };
    }).filter((item) => GUID.test(item.bookingId));
    return {
        items,
        pagingMetadata: result?.pagingMetadata || null,
        interval: cursor ? null : {
            from: new Date(Date.now() - 365 * 86400000).toISOString(),
            to: new Date(Date.now() + 365 * 86400000).toISOString(),
        },
    };
}

export async function leerContactoTPV(contactId) {
    const id = String(contactId || "").trim();
    if (!GUID.test(id)) throw new Error("TPV_INVALID_CONTACT_ID");
    const contact = await getContactElevated(id);
    if (!contact || String(contact._id || "") !== id) throw new Error("TPV_CUSTOMER_NOT_FOUND");
    return normalizeContact(contact);
}

export async function leerReservaTPV({ bookingId, contactId } = {}) {
    const id = String(bookingId || "").trim();
    const customerId = String(contactId || "").trim();
    if (!GUID.test(id) || !GUID.test(customerId)) throw new Error("TPV_INVALID_BOOKING_LINK");
    const result = await queryExtendedBookingsElevated({
        filter: { id, "contactDetails.contactId": customerId },
        cursorPaging: { limit: 1 },
    }, {});
    const entry = (result?.extendedBookings || [])[0];
    const booking = entry?.booking || {};
    const resolvedId = String(booking._id || booking.id || entry?._id || "");
    if (!entry || resolvedId !== id) throw new Error("TPV_BOOKING_NOT_FOUND_FOR_CUSTOMER");
    const slot = booking.bookedEntity?.slot || {};
    const schedule = booking.bookedEntity?.schedule || {};
    return {
        bookingId: resolvedId,
        contactId: customerId,
        status: String(booking.status || "UNKNOWN"),
        paymentStatus: String(booking.paymentStatus || "UNKNOWN"),
        startDate: booking.startDate || slot.startDate || schedule.firstSessionStart || null,
        endDate: booking.endDate || slot.endDate || schedule.lastSessionEnd || null,
        title: String(booking.bookedEntity?.title || "Reserva Wix"),
        serviceId: String(slot.serviceId || schedule.serviceId || ""),
        professionalId: String(slot.resource?._id || ""),
    };
}
