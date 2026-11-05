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
const bridge = read("src/public/widgetBridge.js");

test("HTML component snapshots contain syntactically valid JavaScript", () => {
  for (const [label, html] of [
    ["service widget", serviceHtml],
    ["booking calendar", calendarHtml],
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
