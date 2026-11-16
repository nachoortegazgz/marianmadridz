import assert from "node:assert/strict";
import { contactsV5 } from "@wix/crm";
import { giftVouchers } from "@wix/ecom";
import { extendedBookings } from "@wix/bookings";

assert.equal(typeof contactsV5?.searchContacts, "function", "@wix/crm contactsV5.searchContacts must be exported");
assert.equal(typeof contactsV5?.getContact, "function", "@wix/crm contactsV5.getContact must be exported");
assert.equal(typeof giftVouchers?.getGiftCard, "function", "@wix/ecom giftVouchers.getGiftCard must be exported");
assert.equal(typeof extendedBookings?.queryExtendedBookings, "function", "@wix/bookings extendedBookings.queryExtendedBookings must be exported");

process.stdout.write("Wix TPV native SDK contracts OK: Contacts V5 search/get, Bookings Reader V2 query, eCommerce Gift Cards read\n");
