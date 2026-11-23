import assert from "node:assert/strict";
import { services, staffMembers } from "@wix/bookings";
import { contactsV5 } from "@wix/crm";
import { catalogVersioning, productsV3 } from "@wix/stores";

assert.equal(typeof services?.queryServices, "function", "@wix/bookings services.queryServices must be exported");
assert.equal(typeof catalogVersioning?.getCatalogVersion, "function", "@wix/stores catalogVersioning.getCatalogVersion must be exported");
assert.equal(typeof productsV3?.queryProducts, "function", "@wix/stores productsV3.queryProducts must be exported");
assert.equal(typeof productsV3?.getProduct, "function", "@wix/stores productsV3.getProduct must be exported");

process.stdout.write("Wix TPV catalog SDK contracts OK: Bookings services query, Stores Catalog V3 version/query/get\n");

assert.equal(typeof staffMembers?.queryStaffMembers, "function", "@wix/bookings staffMembers.queryStaffMembers must be exported");
assert.equal(typeof contactsV5?.searchContacts, "function", "@wix/crm contactsV5.searchContacts must be exported");
assert.equal(typeof contactsV5?.getContact, "function", "@wix/crm contactsV5.getContact must be exported");
