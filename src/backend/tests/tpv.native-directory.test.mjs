import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mocks } from "./loader.mjs";
import {
    listAuthorizedProfessionals,
    resolveAuthorizedProfessional,
    searchTpvContacts,
    resolveTpvContact,
} from "../tpv/tpvNativeDirectory.js";

const STAFF_MEMBER_ID = "0114748d-2806-3928-9b97-ff0d09853759";
const STALE_MAPPED_STAFF_MEMBER_ID = "11111111-1111-4111-8111-111111111111";
const RESOURCE_ID = "e556070a-6d6a-402e-8422-11133033ea76";
const SCHEDULE_ID = "06af20d4-1ec3-49fa-9075-f0691dfa7fd4";
const CONTACT_ID = "085ccffa-6686-427f-a310-9b5e3058ebbc";

beforeEach(() => {
    mocks.wixData._reset();
    mocks.sdk["bookings::staffMembers"] = {
        queryStaffMembers: async () => ({
            staffMembers: [{
                _id: STAFF_MEMBER_ID,
                resourceId: RESOURCE_ID,
                name: "Marian Madrid",
                serviceProvider: true,
            }],
            pagingMetadata: { cursors: {} },
        }),
    };
    mocks.sdk["crm::contactsV5"] = {
        searchContacts: async () => ({
            contacts: [{
                _id: CONTACT_ID,
                name: { first: "Ana", last: "García" },
                email: { email: "ana@example.es" },
                phone: { phone: "+34600000000" },
            }],
            pagingMetadata: { cursors: {}, hasNext: false },
        }),
        getContact: async (contactId) => contactId === CONTACT_ID
            ? {
                _id: CONTACT_ID,
                name: { first: "Ana", last: "García" },
                email: { email: "ana@example.es" },
            }
            : null,
    };
    mocks.wixData._seed("MapaStaff", [{
        _id: "mapa-staff-1",
        recordType: "STAFF",
        staffMemberId: STAFF_MEMBER_ID,
        resourceId: RESOURCE_ID,
        scheduleId: SCHEDULE_ID,
        displayName: "Marian",
    }]);
});

test("TPV-NATIVE-DIRECTORY-01 intersects MapaStaff with current native Bookings service providers", async () => {
    const professionals = await listAuthorizedProfessionals();
    assert.deepEqual(professionals, [{
        profesionalId: RESOURCE_ID,
        resourceId: RESOURCE_ID,
        staffMemberId: STAFF_MEMBER_ID,
        nombre: "Marian Madrid",
        esProveedorServicio: true,
    }]);
    assert.equal((await resolveAuthorizedProfessional(RESOURCE_ID)).staffMemberId, STAFF_MEMBER_ID);
});

test("TPV-NATIVE-DIRECTORY-02 rejects a professional without an active native mapping", async () => {
    await assert.rejects(
        () => resolveAuthorizedProfessional("99999999-9999-4999-8999-999999999999"),
        { message: "TPV_STAFF_NOT_ALLOWED" }
    );
});

test("TPV-NATIVE-DIRECTORY-03 rejects ambiguous MapaStaff resource mappings", async () => {
    mocks.wixData._seed("MapaStaff", [
        {
            _id: "mapa-staff-1",
            recordType: "STAFF",
            staffMemberId: STAFF_MEMBER_ID,
            resourceId: RESOURCE_ID,
            scheduleId: SCHEDULE_ID,
        },
        {
            _id: "mapa-staff-2",
            recordType: "STAFF",
            staffMemberId: STALE_MAPPED_STAFF_MEMBER_ID,
            resourceId: RESOURCE_ID,
            scheduleId: SCHEDULE_ID,
        },
    ]);
    await assert.rejects(
        () => listAuthorizedProfessionals(),
        { message: "TPV_STAFF_MAPPING_AMBIGUOUS" }
    );
});

test("TPV-NATIVE-DIRECTORY-04 rejects a stale MapaStaff staffMemberId cross-link", async () => {
    mocks.wixData._seed("MapaStaff", [{
        _id: "mapa-staff-1",
        recordType: "STAFF",
        staffMemberId: STALE_MAPPED_STAFF_MEMBER_ID,
        resourceId: RESOURCE_ID,
        scheduleId: SCHEDULE_ID,
        displayName: "Marian",
    }]);
    await assert.rejects(
        () => listAuthorizedProfessionals(),
        { message: "TPV_STAFF_MAPPING_NATIVE_ID_MISMATCH" }
    );
});

test("TPV-NATIVE-DIRECTORY-05 searches native Wix Contacts and retains the widget transport key", async () => {
    const result = await searchTpvContacts("Ana");
    assert.deepEqual(result.items, [{
        identityId: CONTACT_ID,
        displayName: "Ana García",
        email: "ana@example.es",
        phone: "+34600000000",
    }]);
});

test("TPV-NATIVE-DIRECTORY-06 re-resolves a selected native Contact before a sale", async () => {
    const contact = await resolveTpvContact(CONTACT_ID);
    assert.deepEqual(contact, {
        contactId: CONTACT_ID,
        displayName: "Ana García",
    });
    assert.equal(await resolveTpvContact("99999999-9999-4999-8999-999999999999"), null);
});
