import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const backend = readFileSync(resolve(process.cwd(), "src/backend/citasManager.web.js"), "utf8");
const page = readFileSync(resolve(process.cwd(), "src/pages/Calendario de reservas 2.q39h6.js"), "utf8");
const widget = readFileSync(resolve(process.cwd(), "#html1.txt"), "utf8");

test("booking profile is derived from the authenticated Wix member, not browser-supplied identity", () => {
  assert.match(backend, /getBookingMemberProfile\s*=\s*webMethod\(\s*Permissions\.SiteMember/);
  assert.match(backend, /members\.getCurrentMember\(\{\s*fieldsets:\s*\["FULL"\]/);
  assert.match(backend, /member\?\.contactId/);
  assert.match(backend, /member\?\.contact\s*\|\|\s*member\?\.contactDetails/);
  assert.match(backend, /member\?\.loginEmail/);
  assert.match(backend, /contact\.phones\[0\]/);
  assert.doesNotMatch(backend.slice(backend.indexOf("export const getBookingMemberProfile"), backend.indexOf("async function _getStaffAccess")), /unsafePayload|memberId\s*\)/);
});

test("booking widget fills only blank contact inputs and leaves customer edits intact", () => {
  assert.match(page, /getBookingMemberProfile\(\)/);
  assert.match(page, /reply\("MM_PROFILE",\s*profileResult\.data\)/);
  assert.match(widget, /if\(fullName&&!text\(el\("inputName"\)\.value\)\)/);
  assert.match(widget, /if\(text\(p\.email\)&&!text\(el\("inputEmail"\)\.value\)\)/);
  assert.match(widget, /if\(text\(p\.phone\)&&!text\(el\("inputPhone"\)\.value\)\)/);
});
