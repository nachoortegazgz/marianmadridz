import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const backend = resolve(here, "..");

async function read(name) {
  return readFile(resolve(backend, name), "utf8");
}

test("P0-FISCAL-01 writers use domain validation instead of a global disable switch", async () => {
  const [config, cajas, eventLog, accounting, crons] = await Promise.all([
    read("internalConfig.js"),
    read("cajas.web.js"),
    read("eventLog.js"),
    read("accountingLedger.js"),
    read("crons.js"),
  ]);

  for (const [name, source] of Object.entries({ config, cajas, eventLog, accounting, crons })) {
    assert.doesNotMatch(source, /FISCAL_RUNTIME_POLICY|FISCAL_LEDGER_WRITES_DISABLED|ACCOUNTING_LEDGER_WRITES_DISABLED|TEST_DATA_NOT_ALLOWED_IN_PRODUCTION/,
      name + " must not depend on global fiscal/synthetic writer switches");
  }

  assert.match(cajas, /await requireCajero\(traceId\)/);
  assert.match(cajas, /await validateFiscalConfig\(traceId\)/);
  assert.match(cajas, /acquireFiscalLedgerLock\(traceId\)/);
  assert.match(cajas, /dalInsert\(MOVIMIENTOS_CAJA_COL/);
  assert.match(cajas, /dalInsert\(HISTORICO_CIERRES_Z_COL/);

  assert.match(eventLog, /assertFiscalMovementInputEnums\(input\)/);
  assert.match(eventLog, /_getFiscalSystemConfig\(traceId\)/);
  assert.match(eventLog, /acquireFiscalLedgerLock\(traceId\)/);
  assert.match(eventLog, /dalInsert\(MOVIMIENTOS_CAJA_COL/);

  assert.match(accounting, /_normalizeEntry\(input, traceId\)/);
  assert.match(accounting, /ACCOUNTING_LEDGER_LOCK_CONFIG/);
  assert.match(accounting, /totalDebit/);
  assert.match(accounting, /totalCredit/);

  const recoveryStart = crons.indexOf("export async function runPendingCompensationsJob");
  const recovery = crons.slice(recoveryStart);
  assert.match(recovery, /_runOneCompensation\(comp, traceId\)/);
  assert.doesNotMatch(recovery, /writerDisabled|skippedByPolicy\+\+/);
});

test("P1-CLOCK-01 timeclock writes and adjustments remain disabled before signing or persistence", async () => {
  const [config, horario] = await Promise.all([
    read("internalConfig.js"),
    read("horario.web.js"),
  ]);
  assert.match(config, /STAFF_CLOCKING_CONFIG\s*=\s*Object\.freeze\(\{\s*WRITES_ENABLED:\s*false,\s*ADJUSTMENTS_ENABLED:\s*false/s);

  const clockStart = horario.indexOf("export const registrarFichaje");
  const clockEnd = horario.indexOf("export const getEstadoJornada", clockStart);
  const clock = horario.slice(clockStart, clockEnd);
  const clockGuard = clock.indexOf("STAFF_CLOCKING_CONFIG.WRITES_ENABLED !== true");
  assert.ok(clockGuard >= 0);
  assert.ok(clock.indexOf("_sealTimeclockRecord(") > clockGuard);
  assert.ok(clock.indexOf("insert(REGISTROS_COL") > clockGuard);

  const adjustmentStart = horario.indexOf("export const registrarAjusteHorario");
  const adjustmentEnd = horario.indexOf("export const getResumenHoras", adjustmentStart);
  const adjustment = horario.slice(adjustmentStart, adjustmentEnd);
  const adjustmentGuard = adjustment.indexOf("STAFF_CLOCKING_CONFIG.ADJUSTMENTS_ENABLED !== true");
  assert.ok(adjustmentGuard >= 0);
  assert.ok(adjustment.indexOf("_sealTimeclockRecord(") > adjustmentGuard);
  assert.ok(adjustment.indexOf("insert(REGISTROS_COL") > adjustmentGuard);
});
test("P0-CMS-02 fiscal identity consumers follow the live MapaStaff schema", async () => {
  const [config, hooks, events, eventLog, fiscalDocuments] = await Promise.all([
    read("internalConfig.js"),
    read("data.js"),
    read("events.js"),
    read("eventLog.js"),
    read("fiscalDocuments.web.js"),
  ]);

  assert.match(config, /MAPA_STAFF:\s*"MapaStaff"/);
  assert.doesNotMatch(config, /DATOS_FISCALES|DatosFiscales/);
  assert.match(hooks, /export function MapaStaff_beforeInsert/);
  assert.match(hooks, /recordType === "CONFIG_SISTEMA"/);
  assert.doesNotMatch(hooks, /DatosFiscales_before(Insert|Update|Remove)/);

  assert.match(events, /\.eq\("recordType", RECORD_TYPE\.STAFF\)/);
  assert.doesNotMatch(events, /\.eq\("active",\s*true\)/);
  assert.match(eventLog, /dalQuery\(MAPA_STAFF_COL\)/);
  assert.match(eventLog, /schemaVersion:\s*1/);
  assert.match(eventLog, /traceId:\s*_safeTrim\(traceId\)/);
  assert.match(fiscalDocuments, /\.eq\("recordType", "GESTORIA"\)/);
  assert.match(fiscalDocuments, /record\.emailFiscal/);
  assert.match(fiscalDocuments, /record\.phoneFiscal/);
  assert.doesNotMatch(fiscalDocuments, /gestorEmail|#gestor/);
});


test("P0-FISCAL-TX-04 transaction and recovery writers enforce the canonical identity contract", () => {
  const transactionGuard = cajas.indexOf('const transactionId = _safeTrim(payload?.transactionId);');
  const fiscalConfigGuard = cajas.indexOf('await validateFiscalConfig(traceId);', transactionGuard);
  assert.ok(transactionGuard >= 0);
  assert.ok(fiscalConfigGuard > transactionGuard);
  assert.match(cajas, /transactionId\.length > 128/);
  assert.doesNotMatch(cajas, /transactionId: transactionId \|\| `TX_\${seq\.sequenceNumber\}`/);

  const recoveryStart = cajas.indexOf('export async function queueFiscalRecovery');
  const recoveryEnd = cajas.indexOf('// GET CASHIER STATE', recoveryStart);
  const recovery = cajas.slice(recoveryStart, recoveryEnd);
  assert.match(recovery, /const transactionId = _safeTrim\(recoveryData\.transactionId\)/);
  assert.match(recovery, /error: "TRANSACTION_ID_REQUIRED"/);
  assert.match(recovery, /transactionId,\s*bookingIds:/);

  const validatorStart = cajas.indexOf('function validateFiscalMovementContract');
  assert.ok(validatorStart >= 0);
  for (const field of ["transactionId", "hash", "previousRecordHash", "sequenceNumber", "tipoFactura", "fiscalPeriod", "staffResourceId"]) {
    assert.ok(cajas.includes('"' + field + '"'), "required fiscal field: " + field);
  }
  const validationCall = cajas.indexOf('validateFiscalMovementContract({');
  const insertCall = cajas.indexOf('saved = await dalInsert(MOVIMIENTOS_CAJA_COL, movement)');
  assert.ok(validationCall > validatorStart);
  assert.ok(insertCall > validationCall, "contract validation must precede CMS insert");
  assert.match(cajas, /FISCAL_MOVEMENT_INCOMPLETE/);
});
