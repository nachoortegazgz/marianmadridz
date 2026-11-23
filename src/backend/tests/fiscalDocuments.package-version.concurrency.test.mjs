import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "..", "fiscalDocuments.web.js"), "utf8");

function extractWebMethod(methodName) {
  const startMarker = "export const " + methodName + " = webMethod(";
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, "Missing WebMethod " + methodName);
  const end = source.indexOf("\n);", start);
  assert.notEqual(end, -1, "WebMethod is not closed: " + methodName);
  return source.slice(start, end + 3);
}

test("FDOC-REMOVED-01 removed accountant package storage cannot be queried or recreated", () => {
  const runtimeSource = source
    .replace(/\\/\\*[\\s\\S]*?\\*\\//g, "")
    .replace(/(^|[^:])\\/\\/.*$/gm, "$1");
  assert.doesNotMatch(runtimeSource, /DOCS_COL|BUSINESS_COLLECTIONS\\.PAQUETES_GESTORIA|PaquetesGestoria/);
  for (const methodName of [
    "createManagerPackageVersion",
    "getManagerPackageHistory",
    "getPreparedManagerPackages",
    "downloadManagerPackageVersion",
    "sendManagerPackageToAccountant",
    "sendSpecificDocumentToAccountant",
  ]) {
    const handler = extractWebMethod(methodName);
    assert.match(handler, /_packageStorageRemovedResult/);
    assert.doesNotMatch(handler, /dalQuery|dalGet|dalInsert|dalUpdate|dalRemove|_dispatchEmailViaResend/);
  }
});

test("FDOC-PREVIEW-01 preview remains a non-persistent fiscal read model", () => {
  const preview = extractWebMethod("previewManagerPackage");
  assert.match(preview, /requireMarianManager/);
  assert.match(preview, /getQuarterlyTaxSummaryInternal/);
  assert.match(preview, /getLibroRegistroFacturasExpedidasInternal/);
  assert.doesNotMatch(preview, /DOCS_COL|dalInsert|dalUpdate|dalRemove/);
});

test("FDOC-RECIPIENTS-01 accountant recipient directory remains sourced from MapaStaff", () => {
  const recipients = extractWebMethod("listAccountantRecipients");
  assert.match(recipients, /MAPA_STAFF_COL/);
  assert.match(recipients, /recordType/);
  assert.match(recipients, /GESTORIA/);
});
