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

test("P0-FISCAL-01 fiscal ledger writers are disabled by canonical fail-closed policy", async () => {
  const [config, cajas, eventLog, accounting] = await Promise.all([
    read("internalConfig.js"),
    read("cajas.web.js"),
    read("eventLog.js"),
    read("accountingLedger.js"),
  ]);

  assert.match(config, /FISCAL_RUNTIME_POLICY\s*=\s*Object\.freeze\(\{[\s\S]*?LEDGER_WRITES_ENABLED:\s*false,[\s\S]*?ACCOUNTING_LEDGER_WRITES_ENABLED:\s*false,[\s\S]*?ALLOW_SIMULATION_RECORDS:\s*false/s);
  assert.match(cajas, /FISCAL_RUNTIME_POLICY/);

  const manualStart = cajas.indexOf("export const registerManualTransaction");
  const manualEnd = cajas.indexOf("export const getCashierState", manualStart);
  const manual = cajas.slice(manualStart, manualEnd);
  const manualGuard = manual.indexOf('FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED !== true');
  assert.ok(manualGuard >= 0, "manual fiscal writer must fail closed");
  for (const operation of ["validateFiscalConfig(", "acquireFiscalLedgerLock(", "dalInsert(MOVIMIENTOS_CAJA_COL"]) {
    const index = manual.indexOf(operation);
    assert.ok(index > manualGuard, "fiscal guard must precede " + operation);
  }
  assert.match(manual.slice(manualGuard), /FISCAL_LEDGER_WRITES_DISABLED/);
  const manualSimulationGuard = manual.indexOf("FISCAL_RUNTIME_POLICY.ALLOW_SIMULATION_RECORDS !== true");
  assert.ok(manualSimulationGuard >= 0, "manual writer must reject explicit simulation records");
  assert.ok(manual.indexOf("isExplicitSimulationLedgerRecord(inDto)") > manualSimulationGuard);
  assert.ok(manual.indexOf("dalInsert(MOVIMIENTOS_CAJA_COL") > manualSimulationGuard);

  const zStart = cajas.indexOf("async function _registerZClosing");
  const zEnd = cajas.indexOf("export const registerZClosing", zStart);
  const zWriter = cajas.slice(zStart, zEnd);
  const zGuard = zWriter.indexOf('FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED !== true');
  assert.ok(zGuard >= 0, "shared Z writer must fail closed for public and internal callers");
  assert.ok(zWriter.indexOf("if (authorizeCashier) await requireCajero(traceId);") < zGuard, "public Z writer must authorize before revealing the disabled policy");
  for (const operation of ["getCashRegisterSingleton(", "validateFiscalConfig(", "acquireFiscalLedgerLock(", "dalInsert(HISTORICO_CIERRES_Z_COL"]) {
    const index = zWriter.indexOf(operation);
    assert.ok(index > zGuard, "Z fiscal guard must precede " + operation);
  }
  assert.match(zWriter.slice(zGuard), /FISCAL_LEDGER_WRITES_DISABLED/);

  const eventStart = eventLog.indexOf("export async function registrarEventoEconomico");
  const thirdPartyStart = eventLog.indexOf("async function _upsertDatosFiscales(");
  const thirdPartyEnd = eventLog.indexOf("async function _getServicioCatalogo(", thirdPartyStart);
  const thirdPartyUpsert = eventLog.slice(thirdPartyStart, thirdPartyEnd);
  assert.match(thirdPartyUpsert, /schemaVersion:\s*1/);
  assert.match(thirdPartyUpsert, /traceId:\s*_safeTrim\(traceId\)/);
  assert.doesNotMatch(eventLog, /nombreRazonProductor:\s*["']Marian Madrid["']/,
    "legalName must not be inferred from the commercial brand");

  const eventWriter = eventLog.slice(eventStart);
  const eventGuard = eventWriter.indexOf("FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED !== true");
  assert.ok(eventGuard >= 0, "native event/refund fiscal writer must fail closed");
  for (const operation of ["_upsertDatosFiscales(", "acquireFiscalLedgerLock(", "dalInsert(MOVIMIENTOS_CAJA_COL"]) {
    const index = eventWriter.indexOf(operation);
    assert.ok(index > eventGuard, "event fiscal guard must precede " + operation);
  }
  assert.match(eventWriter.slice(eventGuard), /FISCAL_LEDGER_WRITES_DISABLED/);

  const accountingStart = accounting.indexOf("export async function appendAccountingEntry");
  const accountingWriter = accounting.slice(accountingStart);
  const accountingGuard = accountingWriter.indexOf("FISCAL_RUNTIME_POLICY.ACCOUNTING_LEDGER_WRITES_ENABLED !== true");
  assert.ok(accountingGuard >= 0, "accounting ledger writer must fail closed");
  assert.ok(accountingWriter.indexOf("ACCOUNTING_LEDGER_WRITES_DISABLED") > accountingGuard);
  const accountingSimulationGuard = accountingWriter.indexOf("FISCAL_RUNTIME_POLICY.ALLOW_SIMULATION_RECORDS !== true");
  assert.ok(accountingSimulationGuard > accountingGuard, "accounting writer must reject simulation data after write policy check");
  assert.ok(accountingWriter.indexOf("isExplicitSimulationLedgerRecord(input)") > accountingSimulationGuard);
  assert.ok(accountingWriter.indexOf("_normalizeEntry(input, traceId)") > accountingSimulationGuard);
  assert.ok(accountingWriter.indexOf("dalInsert(ACCOUNTING_COL") > accountingSimulationGuard);
  const eventSimulationGuard = eventWriter.indexOf("FISCAL_RUNTIME_POLICY.ALLOW_SIMULATION_RECORDS !== true");
  assert.ok(eventSimulationGuard >= 0, "event writer must reject explicit simulation records");
  assert.ok(eventWriter.indexOf("isExplicitSimulationLedgerRecord(input)") > eventSimulationGuard);
  assert.ok(eventWriter.indexOf("_upsertDatosFiscales(") > eventSimulationGuard);
});

test("P0-FISCAL-02 recovery cron preserves fiscal queues while their writers are disabled", async () => {
  const crons = await read("crons.js");
  assert.match(crons, /FISCAL_RUNTIME_POLICY/);
  const jobStart = crons.indexOf("export async function runPendingCompensationsJob");
  const job = crons.slice(jobStart);
  const policyGuard = job.indexOf("if (writerDisabled)");
  assert.ok(policyGuard >= 0);
  assert.ok(job.indexOf("result.skippedByPolicy++") > policyGuard);
  assert.ok(job.indexOf("continue;") > policyGuard);
  assert.ok(job.indexOf("_runOneCompensation(comp, traceId)") > policyGuard,
    "disabled fiscal/accounting recovery must be skipped before invoking writers");
  assert.match(job, /skippedByPolicy:\s*result\.skippedByPolicy/);
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
  assert.ok(clock.indexOf("signTimeclockRecord(") > clockGuard);
  assert.ok(clock.indexOf("insert(REGISTROS_COL") > clockGuard);

  const adjustmentStart = horario.indexOf("export const registrarAjusteHorario");
  const adjustmentEnd = horario.indexOf("export const getResumenHoras", adjustmentStart);
  const adjustment = horario.slice(adjustmentStart, adjustmentEnd);
  const adjustmentGuard = adjustment.indexOf("STAFF_CLOCKING_CONFIG.ADJUSTMENTS_ENABLED !== true");
  assert.ok(adjustmentGuard >= 0);
  assert.ok(adjustment.indexOf("signTimeclockRecord(") > adjustmentGuard);
  assert.ok(adjustment.indexOf("insert(REGISTROS_COL") > adjustmentGuard);
});
