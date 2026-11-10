import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");
const read = (name) => readFileSync(join(root, name), "utf8");

function extractInlineScripts(html, label) {
  const scripts = Array.from(
    html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi),
    (match) => match[1],
  );
  assert.ok(scripts.length > 0, label + " must contain an inline script");
  return scripts;
}

const serviceHtml = read("#htmlWidgetCustomService.txt");
const confirmationHtml = read("#html2.txt");
const calendarHtml = read("#html1.txt");
const adminHtml = read("#htmlAdmin.txt");
const onlyStaffHtml = read("#htmlOnlyStaff.txt");
const bridge = read("src/public/widgetBridge.js");
const adminPage = read("src/pages/ZONA MARIAN.gn7mx.js");
const staffPage = read("src/pages/ZONA STAFF.mvf3f.js");
const calendarPage = read("src/pages/Calendario de reservas 2.q39h6.js");
const cashierBackend = read("src/backend/cajas.web.js");

test("HTML component snapshots contain syntactically valid JavaScript", () => {
  for (const [label, html] of [
    ["service widget", serviceHtml],
    ["booking calendar", calendarHtml],
    ["admin widget", adminHtml],
    ["staff widget", onlyStaffHtml],
  ]) {
    for (const [index, source] of extractInlineScripts(html, label).entries()) {
      assert.doesNotThrow(
        () => new vm.Script(source, { filename: label + "-" + index + ".js" }),
        label + " inline script " + (index + 1) + " must parse",
      );
    }
  }
});

test("service and calendar HTML widgets use the Velo bridge protocol version", () => {
  assert.match(bridge, /export const PROTOCOL_VERSION = 1;/);
  for (const [label, html, types] of [
    ["service widget", serviceHtml, ["READY", "CONTEXT", "BOOK", "NAV"]],
    ["booking calendar", calendarHtml, ["READY", "CONTEXT", "AVAIL", "BOOK", "NAV"]],
  ]) {
    assert.match(html, /PROTOCOL_VERSION:\s*1|version:\s*1/,
      label + " must use protocol version 1");
    for (const type of types) {
      const mapping = type + ':"MM_' + type + '"';
      const spacedMapping = type + ': "MM_' + type + '"';
      assert.ok(
        html.includes(mapping) || html.includes(spacedMapping),
        label + " must implement MM_" + type,
      );
      assert.ok(
        bridge.includes(mapping) || bridge.includes(spacedMapping),
        "Velo bridge must implement MM_" + type,
      );
    }
  }
});

test("calendar boot renders the current month before waiting for service context", () => {
  const renderStart = calendarHtml.indexOf("function renderCalendar()");
  const initStart = calendarHtml.indexOf("function init()");
  assert.notEqual(renderStart, -1, "calendar renderer must exist");
  assert.notEqual(initStart, -1, "calendar initializer must exist");

  const renderer = calendarHtml.slice(renderStart, calendarHtml.indexOf("\nfunction ", renderStart + 10));
  const initializer = calendarHtml.slice(initStart, calendarHtml.indexOf("\ndocument.readyState", initStart));

  assert.match(renderer, /monthTitle/);
  assert.match(initializer, /renderCalendar\(\)/);
  assert.match(initializer, /startHandshake\(\)/);
  assert.ok(
    initializer.indexOf("renderCalendar()") < initializer.indexOf("startHandshake()"),
    "calendar shell must render before the MM_READY handshake",
  );
});

test("confirmation ticket shows one estimated total without tax breakdown", () => {
  const scripts = extractInlineScripts(confirmationHtml, "confirmation widget");
  for (const [index, source] of scripts.entries()) {
    assert.doesNotThrow(
      () => new vm.Script(source, { filename: "confirmation-widget-" + index + ".js" }),
      "confirmation inline script " + (index + 1) + " must parse",
    );
  }
  assert.match(confirmationHtml, /Importe total estimado:/);
  assert.match(confirmationHtml, /Importe aproximado/);
  assert.match(confirmationHtml, /precio definitivo dependerá del servicio y tratamiento finalmente realizado/i);
  assert.doesNotMatch(confirmationHtml, /Base Imponible|I\.V\.A\.|21%/);
});


test("confirmation navigation uses canonical URL constants re-exported by mmUtils", () => {
  const utils = read("src/public/mmUtils.js");
  const confirmation = read("src/pages/ConfirmacionReserva.q5vps.js");

  assert.ok(bridge.includes('HOME: "/"'), "widget bridge must declare the home URL");
  assert.ok(bridge.includes('MIS_RESERVAS: "/my-bookings"'), "widget bridge must declare My Bookings URL");
  assert.ok(bridge.includes('SERVICIOS: "/reserva-online"'), "widget bridge must declare services URL");
  assert.ok(utils.includes("PROTOCOL_URLS as URLS"), "mmUtils must re-export protocol URLs");

  assert.ok(confirmation.includes("return URLS.MIS_RESERVAS;"));
  assert.ok(confirmation.includes("return URLS.HOME;"));
  assert.ok(confirmation.includes("return URLS.SERVICIOS;"));
  assert.ok(confirmation.includes("const legacyAllowed = [URLS.HOME, URLS.MIS_RESERVAS, URLS.SERVICIOS];"));
  assert.ok(!confirmation.includes('return URLS.MIS_RESERVAS || "/my-bookings";'));
  assert.ok(!confirmation.includes('return URLS.HOME || "/";'));
});


test("staff admin navigation targets the published ZONA MARIAN route", () => {
  assert.match(bridge, /ADMIN_PANEL: "\/zona-marian"/);
  assert.match(staffPage, /case "ADMIN_PANEL":[\s\S]*?location\.to\(URLS\.ADMIN_PANEL\)/);
  assert.doesNotMatch(staffPage, /location\.to\("\/administracion"\)/);
});


test("booking privacy navigation targets the published Privacidad y Cookies route", () => {
  assert.match(bridge, /PRIVACY_POLICY: "\/politica-privacidad-texto"/);
  assert.match(calendarPage, /URLS\?\.PRIVACY_POLICY[\s\S]*?\/politica-privacidad-texto/);
  assert.doesNotMatch(calendarPage, /\/politica-de-privacidad/);
  assert.match(calendarHtml, /btnPrivacy/);
});


test("admin widget actions are explicitly allowlisted and match implemented page handlers", () => {
  const allowlist = adminPage.match(/allowedTypes:\s*\[([\s\S]*?)\]/);
  assert.ok(allowlist, "admin page must declare an explicit widget allowlist");
  assert.match(allowlist[1], /MESSAGE_TYPES\.READY/);
  assert.match(allowlist[1], /MESSAGE_TYPES\.CONTEXT/);
  assert.match(allowlist[1], /MESSAGE_TYPES\.NAV/);
  for (const type of [
    "CASHIER_STATE",
    "Z_CLOSING",
    "FISCAL_SUMMARY",
    "FISCAL_BOOK",
    "DOCUMENT_PREPARED",
    "DOCUMENT_DOWNLOAD",
  ]) {
    assert.ok(allowlist[1].includes('"'+type+'"'), type+" must be allowed by the admin bridge");
    assert.match(adminPage, new RegExp(type+"\\s*:"), type+" must have a page handler");
    assert.ok(adminHtml.includes(type+":"+ "'"+type+"'") || adminHtml.includes(type+": '"+type+"'"),
      type+" must be emitted by the admin HTML component");
  }
});

test("staff widget remains fail-closed for writes while read-only queries are permitted", () => {
  const allowlist = staffPage.match(/allowedTypes:\s*\[([\s\S]*?)\]/);
  assert.ok(allowlist, "staff page must declare an explicit widget allowlist");
  assert.match(allowlist[1], /MESSAGE_TYPES\.READY/);
  assert.match(allowlist[1], /MESSAGE_TYPES\.CONTEXT/);
  assert.match(allowlist[1], /MESSAGE_TYPES\.NAV/);
  assert.doesNotMatch(allowlist[1], /CLOCK|TPV_TX|X_COUNT|Z_CLOSING|INVENTORY_/);
  assert.match(staffPage, /enableClocking:\s*false/);
  assert.match(staffPage, /enableCashier:\s*false/);
  assert.match(staffPage, /cashierMode:\s*"DISABLED"/);
  assert.match(onlyStaffHtml, /isAuthorized:\s*false/);
  assert.match(onlyStaffHtml, /contextData\.isAuthorized !== true/);
  assert.match(onlyStaffHtml, /contextData\.enableClocking\s*===\s*true/);
  assert.match(onlyStaffHtml, /contextData\.enableCashier\s*===\s*true/);
  assert.match(onlyStaffHtml, /enableClocking:\s*false/);
  assert.match(onlyStaffHtml, /enableCashier:\s*false/);
});

test("admin and staff cash widgets consume the canonical getCashierState DTO", () => {
  assert.match(cashierBackend, /netAmount:/);
  assert.match(cashierBackend, /totalOperations,/);
  assert.match(cashierBackend, /operationDate:/);
  assert.match(adminHtml, /money\(state\.netAmount\)/);
  assert.match(adminHtml, /state\.totalOperations/);
  assert.match(adminHtml, /state\.operationDate/);
  assert.match(onlyStaffHtml, /_formatMoney\(state\.netAmount\)/);
  assert.match(onlyStaffHtml, /state\.totalOperations/);
  assert.match(onlyStaffHtml, /state\.operationDate/);
});

test("admin widget no longer exposes discarded staff management or business status flow", () => {
  assert.ok(!adminHtml.includes("s.status"));
});

test("admin widget excludes inactive AI, accountant dispatch and staff management flows", () => {
  assert.doesNotMatch(adminHtml, /aiPanel|sendPanel|AI_QUERY|ACCOUNTANT_RECIPIENTS|SEND_MONTHLY_PACKAGE|SEND_QUARTERLY_PACKAGE|SEND_SPECIFIC_DOCUMENT/);
  assert.ok(adminHtml.includes("d.packageStatus"));
});

test("admin fallback hides unsupported capabilities and ticket output uses text nodes", () => {
  assert.match(adminHtml, /roleLabel: 'CONTEXTO NO DISPONIBLE'/);
  assert.match(adminHtml, /enableCashier:\s*false/);
  assert.match(adminHtml, /enableFiscal:\s*false/);
  assert.match(adminHtml, /enableDocuments:\s*false/);
  assert.doesNotMatch(adminHtml, /cashTicket\.innerHTML\s*=/);
  assert.doesNotMatch(onlyStaffHtml, /ticketBox\.innerHTML\s*=/);
  assert.doesNotMatch(onlyStaffHtml, /hoursResult\.innerHTML\s*=/);
});


test("admin cashier panel is available only when backend reports an open operational register", () => {
  assert.match(adminPage, /enableCashier:\s*cashierRes\?\.status === "SUCCESS" &&\s*cashierRes\.data\?\.cashRegisterStatus === "ABIERTA"/);
  assert.doesNotMatch(adminPage, /enableCashier:\s*true/);
  assert.match(adminPage, /cashierRes\?\.status === "SUCCESS" \? cashierRes\.data : null/);
});


test("staff page routes only read-only timeclock queries and keeps write actions disabled", () => {
  const allowlist = staffPage.match(/allowedTypes:\s*\[([\s\S]*?)\]/);
  assert.ok(allowlist, "staff page must declare an explicit message allowlist");
  for (const type of ["GET_STATE", "GET_HISTORY", "HOURS_CALC"]) {
    assert.ok(allowlist[1].includes('"'+type+'"'), type + " must be allowed");
    assert.match(staffPage, new RegExp('type === "' + type + '"'));
  }
  assert.match(staffPage, /enableScheduleQuery:\s*hasStaffContext/);
  assert.match(staffPage, /enableClocking:\s*false/);
  assert.match(staffPage, /getMyStaffContext/);
  assert.match(staffPage, /getHistorialFichajes/);
  assert.match(staffPage, /calcularHorasTrabajadas/);
  assert.doesNotMatch(allowlist[1], /CLOCK|ADJUSTMENT|TPV_TX|X_COUNT|Z_CLOSING/);
  assert.match(onlyStaffHtml, /integrityStatus === 'UNVERIFIED'[\s\S]*NO VERIFICADO/);
  assert.match(onlyStaffHtml, /sequenceStatus === 'INVALID'[\s\S]*SECUENCIA INVÁLIDA/);
  assert.match(onlyStaffHtml, /Jornadas abiertas:[\s\S]*el tiempo en curso no se incluye/);
});

test("admin snapshot action is allowlisted and uses a stable operation UUID without enabling dispatch", () => {
  const allowlist = adminPage.match(/allowedTypes:\s*\[([\s\S]*?)\]/);
  assert.ok(allowlist);
  assert.ok(allowlist[1].includes('"CREATE_SNAPSHOT"'));
  assert.match(adminPage, /createManagerPackageVersion/);
  assert.match(adminPage, /CREATE_SNAPSHOT:\s*\(\{ payload \}\) => createManagerPackageVersion/);
  assert.match(adminHtml, /btnCreateSnapshot/);
  assert.match(adminHtml, /crypto\.getRandomValues/);
  assert.match(adminHtml, /CREATE_SNAPSHOT_RES/);
  assert.match(adminHtml, /No se envía a gestoría/);
  assert.match(adminHtml, /downloadTextFile/);
  assert.doesNotMatch(adminHtml, /window\.open\(data\.url/);
});
