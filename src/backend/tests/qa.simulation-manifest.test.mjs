import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QA_CUSTOMERS, QA_GESTORIA, QA_TEST_RUN_ID, QA_TEST_SITE_ID } from './fixtures/qaSyntheticParties.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(here, '..', '..', '..');
const manifestPath = resolve(root, 'docs/qa/qa-simulation-scenarios.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

test('QA-MANIFEST-01 scenario manifest declares synthetic offline-only data', () => {
  assert.equal(manifest.environment, 'offline-mocks-only');
  assert.equal(manifest.dataClassification, 'synthetic');
  assert.equal(manifest.defaultTimezone, 'Europe/Madrid');
  assert.equal(manifest.currency, 'EUR');
  assert.ok(Array.isArray(manifest.scenarios) && manifest.scenarios.length >= 10);
});

test('QA-MANIFEST-02 scenario IDs and trace IDs are unique and stable', () => {
  const ids = manifest.scenarios.map((item) => item.scenarioId);
  const traces = manifest.scenarios.map((item) => item.traceId);
  assert.equal(new Set(ids).size, ids.length, 'duplicate scenarioId');
  assert.equal(new Set(traces).size, traces.length, 'duplicate traceId');
  for (const item of manifest.scenarios) {
    assert.match(item.scenarioId, /^QA-[A-Z0-9-]+$/);
    assert.match(item.traceId, /^trace-qa-[a-z0-9-]+$/);
    assert.ok(item.name && item.status && Array.isArray(item.testFiles));
    assert.ok(Array.isArray(item.assertions) && item.assertions.length > 0);
  }
});

test('QA-MANIFEST-03 every automated test reference exists in the repository', () => {
  for (const item of manifest.scenarios) {
    for (const path of item.testFiles) {
      assert.ok(readFileSync(resolve(root, path), 'utf8').length > 0, path + ' missing or empty');
    }
  }
});

test('QA-MANIFEST-04 fixtures contain no real customer contact details or live-payment flag', () => {
  const serialized = JSON.stringify(manifest);
  assert.doesNotMatch(serialized, /@(gmail|hotmail|outlook|yahoo)\./i);
  assert.doesNotMatch(serialized, /"paymentExecution"\s*:\s*true/i);
  assert.doesNotMatch(serialized, /"sendExternalMessage"\s*:\s*true/i);
  assert.ok(manifest.scenarios.every((item) => item.fixture && typeof item.fixture === 'object'));
});

test('QA-MANIFEST-05 incomplete scenarios are explicitly marked, never silently passed', () => {
  const allowed = new Set(['MOCK_COVERED', 'PARTIAL_MOCK_COVERAGE', 'CONTRACT_ONLY', 'MANUAL_QA_REQUIRED']);
  for (const item of manifest.scenarios) {
    assert.ok(allowed.has(item.status), item.scenarioId + ' has unknown status');
    if (item.status !== 'MOCK_COVERED') assert.ok(item.limitation, item.scenarioId + ' must explain its limitation');
    if (item.status === 'MANUAL_QA_REQUIRED') assert.equal(item.testFiles.length, 0);
  }
});


test('QA-MANIFEST-06 customer and gestoría fixtures are synthetic and non-operational', () => {
  assert.equal(QA_TEST_SITE_ID, 'site-qa-synthetic');
  assert.equal(QA_CUSTOMERS.length, 3);
  for (const customer of QA_CUSTOMERS) {
    assert.equal(customer.isSynthetic, true);
    assert.equal(customer.sourceEnvironment, 'TEST');
    assert.equal(customer.testRunId, QA_TEST_RUN_ID);
    assert.match(customer.customerId, /^TEST-CUSTOMER-[0-9]{3}$/);
    assert.match(customer.email, /^[^@]+@example\.test$/);
    assert.equal(Object.hasOwn(customer, 'phone'), false);
  }
  assert.equal(QA_GESTORIA.name, 'Gestoría de Pruebas');
  assert.equal(QA_GESTORIA.taxId, 'TEST-NIF-NO-VALIDO');
  assert.equal(QA_GESTORIA.email, 'gestoria.pruebas@example.test');
  assert.equal(QA_GESTORIA.phone, null);
  assert.equal(QA_GESTORIA.destinationEnabled, false);
  assert.equal(QA_GESTORIA.isSynthetic, true);
  assert.equal(QA_GESTORIA.sourceEnvironment, 'TEST');
  assert.equal(QA_GESTORIA.testRunId, QA_TEST_RUN_ID);
});

test('QA-MANIFEST-07 payment and manager sink scenarios carry synthetic TEST metadata', () => {
  const payment = manifest.scenarios.find((item) => item.scenarioId === 'QA-PSP-MOCK-001');
  const manager = manifest.scenarios.find((item) => item.scenarioId === 'QA-MANAGER-EMAIL-SINK-001');
  assert.ok(payment && manager);
  for (const fixture of [payment.fixture, manager.fixture]) {
    assert.equal(fixture.sourceEnvironment, 'TEST');
    assert.equal(fixture.testRunId, QA_TEST_RUN_ID);
    assert.equal(fixture.isSynthetic, true);
    assert.equal(fixture.realPayment, false);
  }
  assert.equal(payment.fixture.environment, 'TEST');
  assert.equal(manager.fixture.gestoriaDestinationEnabled, false);
});
