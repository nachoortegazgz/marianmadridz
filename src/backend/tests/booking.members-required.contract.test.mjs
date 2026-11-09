import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const backendUrl = new URL("../citasManager.web.js", import.meta.url);
const pageUrl = new URL("../../pages/Calendario%20de%20reservas%202.q39h6.js", import.meta.url);
const widgetUrl = new URL("../../../%23html1.txt", import.meta.url);

const backendSource = await readFile(backendUrl, "utf8");
const pageSource = await readFile(pageUrl, "utf8");
const widgetSource = await readFile(widgetUrl, "utf8");

test("BOOK-MEMBER-01 booking creation WebMethod is restricted to Wix site members", () => {
  const start = backendSource.indexOf("export const processDualBooking = webMethod(");
  const end = backendSource.indexOf("\n\nexport const confirmPayment", start);
  assert.ok(start >= 0 && end > start, "processDualBooking WebMethod must exist");
  const block = backendSource.slice(start, end);
  assert.match(block, /webMethod\(\s*Permissions\.SiteMember\s*,/);
  assert.doesNotMatch(block, /Permissions\.Anyone/);
});

test("BOOK-MEMBER-02 backend fails closed without Wix memberId and contactId before invoking the booking saga", () => {
  const start = backendSource.indexOf("export const processDualBooking = webMethod(");
  const end = backendSource.indexOf("\n\nexport const confirmPayment", start);
  const block = backendSource.slice(start, end);
  const identityGuard = block.indexOf("if (!sessionMemberId || !sessionContactId)");
  const payloadValidation = block.indexOf("_validateProcessBookingPayload(");
  const sagaInvocation = block.indexOf("executeBookingSaga(normalizedPayload)");
  assert.ok(identityGuard >= 0);
  assert.ok(payloadValidation > identityGuard, "identity guard must run before payload normalization");
  assert.ok(sagaInvocation > identityGuard, "identity guard must run before the saga");
  assert.match(block, /ERROR_CODES\.AUTH_REQUIRED/);
  assert.match(block, /sessionContactId/);
});

test("BOOK-MEMBER-03 frontend maps member permission failures to AUTH_REQUIRED without retrying a booking", () => {
  assert.match(pageSource, /memberAccessDenied/);
  assert.match(pageSource, /AUTH_REQUIRED/);
  assert.match(pageSource, /processDualBooking\(requestPayload\)/);
  assert.match(pageSource, /Para reservar necesitas iniciar sesión o crear una cuenta en Área Personal/);
  assert.match(widgetSource, /p\.error\?\.message\s*\|\|/);
});
test("BOOK-MEMBER-04 frontend opens native Wix Members login before booking and resumes the same request", () => {
  assert.match(pageSource, /import wixMembersFrontend from ["']wix-members-frontend["']/);
  assert.match(pageSource, /async function ensureBookingMemberSession\(\)/);
  assert.match(pageSource, /wixMembersFrontend\.currentMember\s*\.\s*getMember\(\)/);
  assert.match(pageSource, /wixMembersFrontend\.authentication\s*\.\s*promptLogin\(\)/);
  const authGate = pageSource.indexOf("const memberSessionReady = await ensureBookingMemberSession()");
  const bookingCall = pageSource.indexOf("processDualBooking(requestPayload)");
  assert.ok(authGate >= 0 && bookingCall > authGate, "native login must complete before processDualBooking");
  assert.match(pageSource, /resultError\("AUTH_REQUIRED"\)/);
});
