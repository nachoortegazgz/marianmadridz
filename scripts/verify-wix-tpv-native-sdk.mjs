import assert from "node:assert/strict";
import { services, staffMembers } from "@wix/bookings";
import { contactsV5 } from "@wix/crm";
import { catalogVersioning, productsV3 } from "@wix/stores";
import { taxCalculation } from "@wix/ecom";

assert.equal(typeof services?.queryServices, "function", "@wix/bookings services.queryServices must be exported");
assert.equal(typeof catalogVersioning?.getCatalogVersion, "function", "@wix/stores catalogVersioning.getCatalogVersion must be exported");
assert.equal(typeof productsV3?.queryProducts, "function", "@wix/stores productsV3.queryProducts must be exported");
assert.equal(typeof productsV3?.getProduct, "function", "@wix/stores productsV3.getProduct must be exported");
assert.equal(typeof taxCalculation?.calculateTax, "function", "@wix/ecom taxCalculation.calculateTax must be exported");

process.stdout.write("Wix TPV SDK contracts OK: Bookings services, Stores Catalog V3 and eCommerce tax calculation\n");

assert.equal(typeof staffMembers?.queryStaffMembers, "function", "@wix/bookings staffMembers.queryStaffMembers must be exported");
assert.equal(typeof contactsV5?.searchContacts, "function", "@wix/crm contactsV5.searchContacts must be exported");
assert.equal(typeof contactsV5?.getContact, "function", "@wix/crm contactsV5.getContact must be exported");
