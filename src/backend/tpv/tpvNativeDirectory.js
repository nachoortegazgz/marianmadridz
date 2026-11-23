import { auth } from "@wix/essentials";
import { contactsV5 } from "@wix/crm";
import { staffMembers } from "@wix/bookings";
import { BUSINESS_COLLECTIONS, RECORD_TYPE } from "backend/internalConfig";
import { CONSISTENCY, queryItems, wql } from "backend/dataAccess";

const queryStaffMembersElevated = auth.elevate(staffMembers.queryStaffMembers);
const searchContactsElevated = auth.elevate(contactsV5.searchContacts);
const getContactElevated = auth.elevate(contactsV5.getContact);

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function _cleanText(value, maxLength = 100) {
    return String(value ?? "").trim().slice(0, maxLength);
}

function _contactDisplayName(contact) {
    const name = [contact?.name?.first, contact?.name?.last]
        .map((part) => _cleanText(part, 80))
        .filter(Boolean)
        .join(" ");
    return name ||
        _cleanText(contact?.company?.name, 120) ||
        _cleanText(contact?.email?.email, 120) ||
        _cleanText(contact?.phone?.phone, 40) ||
        "Cliente sin nombre";
}

/**
 * Search the native Wix Contacts directory.
 * identityId is retained only as a transport-compatibility key for #htmlTPV;
 * its value is the native Wix Contact _id, never a synthetic identity.
 */
export async function searchTpvContacts(search) {
    const expression = _cleanText(search, 100);
    if (expression.length < 2) throw new Error("TPV_CUSTOMER_SEARCH_TOO_SHORT");

    const response = await searchContactsElevated(
        {
            search: {
                expression,
                mode: "OR",
                fuzzy: true,
            },
            sort: [{ fieldName: "_createdDate", order: "ASC" }],
            cursorPaging: { limit: 20 },
        },
        { nameFormat: "BY_FIRST_NAME" }
    );

    return {
        items: (response?.contacts || [])
            .filter((contact) => typeof contact?._id === "string" && GUID_RE.test(contact._id))
            .map((contact) => ({
                identityId: contact._id,
                displayName: _contactDisplayName(contact),
                email: _cleanText(contact?.email?.email, 254),
                phone: _cleanText(contact?.phone?.phone, 40),
            })),
        pagingMetadata: response?.pagingMetadata || null,
    };
}

/**
 * Re-resolve the selected Contact on the server before persisting a sale.
 * Client-provided labels, email addresses and phone numbers are never trusted.
 */
export async function resolveTpvContact(contactId) {
    const id = _cleanText(contactId, 64);
    if (!id) return null;
    if (!GUID_RE.test(id)) throw new Error("TPV_CUSTOMER_NOT_ALLOWED");

    let contact;
    try {
        contact = await getContactElevated(id);
    } catch (error) {
        const status = Number(error?.status || error?.httpStatus || error?.details?.httpStatus);
        const code = String(error?.code || error?.errorCode || "").toUpperCase();
        if (status === 404 || code === "CONTACT_NOT_FOUND" || code === "NOT_FOUND") return null;
        throw new Error("TPV_CUSTOMER_LOOKUP_FAILED");
    }

    if (!contact?._id || !GUID_RE.test(String(contact._id))) return null;
    return {
        contactId: contact._id,
        displayName: _contactDisplayName(contact),
    };
}

/**
 * Return only professionals that have both:
 * 1) a unique STAFF mapping in MapaStaff; and
 * 2) a current native Wix Bookings service-provider record.
 *
 * MapaStaff.resourceId is the TPV professional key; staffMemberId is the
 * distinct Wix Bookings Staff Member ID. Names are display-only.
 */
export async function listAuthorizedProfessionals() {
    const mappingResult = await queryItems({
        dataCollectionId: BUSINESS_COLLECTIONS.MAPA_STAFF,
        filter: wql.eq("recordType", RECORD_TYPE.STAFF),
        limit: 100,
        consistency: CONSISTENCY.STRONG,
    });
    if (mappingResult.hasNext) throw new Error("TPV_STAFF_MAPPING_QUERY_LIMIT_EXCEEDED");

    // Query Staff Members v1 returns service providers only by default.
    const nativeResult = await queryStaffMembersElevated({
        cursorPaging: { limit: 100 },
    });
    if (nativeResult?.pagingMetadata?.cursors?.next) {
        throw new Error("TPV_NATIVE_STAFF_QUERY_LIMIT_EXCEEDED");
    }

    const nativeStaff = Array.isArray(nativeResult?.staffMembers)
        ? nativeResult.staffMembers
        : [];
    const nativeById = new Map();
    for (const person of nativeStaff) {
        const staffMemberId = _cleanText(person?._id, 64);
        if (!GUID_RE.test(staffMemberId) || nativeById.has(staffMemberId)) {
            throw new Error("TPV_NATIVE_STAFF_ID_INVALID_OR_DUPLICATE");
        }
        nativeById.set(staffMemberId, person);
    }

    const mappingsByStaffId = new Map();
    const resourceIds = new Set();
    for (const mapping of mappingResult.items || []) {
        const staffMemberId = _cleanText(mapping?.staffMemberId, 64);
        if (!nativeById.has(staffMemberId)) continue;

        const resourceId = _cleanText(mapping?.resourceId, 64);
        if (!GUID_RE.test(staffMemberId) || !GUID_RE.test(resourceId)) {
            throw new Error("TPV_STAFF_MAPPING_INVALID");
        }
        if (mappingsByStaffId.has(staffMemberId) || resourceIds.has(resourceId)) {
            throw new Error("TPV_STAFF_MAPPING_AMBIGUOUS");
        }
        mappingsByStaffId.set(staffMemberId, mapping);
        resourceIds.add(resourceId);
    }

    const professionals = [];
    for (const [staffMemberId, mapping] of mappingsByStaffId) {
        const native = nativeById.get(staffMemberId);
        const resourceId = _cleanText(mapping.resourceId, 64);
        if (_cleanText(native?.resourceId, 64) !== resourceId) {
            throw new Error("TPV_STAFF_MAPPING_MISMATCH");
        }
        professionals.push({
            profesionalId: resourceId,
            resourceId,
            staffMemberId,
            nombre: _cleanText(native?.name || mapping?.displayName, 120) || "Profesional",
            esProveedorServicio: true,
        });
    }

    return professionals.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export async function resolveAuthorizedProfessional(resourceId) {
    const id = _cleanText(resourceId, 64);
    if (!id || !GUID_RE.test(id)) throw new Error("TPV_STAFF_NOT_ALLOWED");
    const professionals = await listAuthorizedProfessionals();
    return professionals.find((person) => person.resourceId === id) || (() => {
        throw new Error("TPV_STAFF_NOT_ALLOWED");
    })();
}
