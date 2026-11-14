import test from 'node:test';
import assert from 'node:assert/strict';

import { createQaManagerEmailSink } from './fixtures/qaManagerEmailSink.mock.mjs';
import { QA_CUSTOMERS, QA_GESTORIA, QA_TEST_RUN_ID, QA_TEST_SITE_ID } from './fixtures/qaSyntheticParties.mjs';

const QA_CONFIG = Object.freeze({
  environment: 'TEST',
  enabled: true,
  siteId: QA_TEST_SITE_ID,
  testSiteId: QA_TEST_SITE_ID,
  testRunId: QA_TEST_RUN_ID,
  sinkRecipient: QA_GESTORIA.email,
});

function validMessage(overrides = {}) {
  return {
    to: QA_CONFIG.sinkRecipient,
    subject: 'Paquete QA - prueba de gestoría',
    text: 'Cliente: Cliente Prueba Uno; email: cliente.prueba.001@example.test; paquete sintético de prueba.',
    traceId: 'trace-qa-manager-1',
    packageId: 'qa-package-1',
    snapshotHash: 'a'.repeat(64),
    client: QA_CUSTOMERS[0],
    ...overrides,
  };
}

test('QA-MAIL-01 manager email sink is fail-closed outside the explicit TEST context', () => {
  for (const config of [
    {},
    { ...QA_CONFIG, enabled: false },
    { ...QA_CONFIG, environment: 'QA' },
    { ...QA_CONFIG, siteId: 'different-site' },
    { ...QA_CONFIG, testSiteId: '' },
    { ...QA_CONFIG, sinkRecipient: 'external@example.invalid' },
  ]) {
    assert.throws(() => createQaManagerEmailSink(config), /QA_MANAGER_EMAIL_SINK_DISABLED/);
  }
});

test('QA-MAIL-02 synthetic client data is delivered only to the in-memory manager sink', async () => {
  const sink = createQaManagerEmailSink(QA_CONFIG);
  const result = await sink.send(validMessage());

  assert.equal(result.provider, 'QA_MEMORY_SINK');
  assert.equal(result.simulated, true);
  assert.equal(result.isSynthetic, true);
  assert.equal(result.testRunId, QA_TEST_RUN_ID);
  assert.equal(result.sourceEnvironment, 'TEST');
  assert.equal(result.realPayment, false);
  assert.equal(result.deliveredToSink, true);
  assert.equal(result.recipient, QA_CONFIG.sinkRecipient);
  assert.equal(result.status, 'SENT_TO_QA_SINK');
  assert.match(result.messageId, /^qa_mail_[a-f0-9]{24}$/);

  const [message] = sink.listMessages();
  assert.equal(message.client.firstName, 'Cliente');
  assert.equal(message.client.lastName, 'Prueba Uno');
  assert.equal(message.client.email, 'cliente.prueba.001@example.test');
  assert.equal(message.client.isSynthetic, true);
  assert.equal(message.client.sourceEnvironment, 'TEST');
  assert.equal(message.client.testRunId, QA_TEST_RUN_ID);
  assert.match(message.text, /Cliente Prueba Uno/);
  assert.match(message.text, /cliente\.prueba\.001@example\.test/);
});

test('QA-MAIL-03 dispatch is idempotent and rejects conflicting reuse of package evidence', async () => {
  const sink = createQaManagerEmailSink(QA_CONFIG);
  const message = validMessage();
  const first = await sink.send(message);
  const replay = await sink.send(message);
  assert.deepEqual(replay, first);
  assert.equal(sink.listMessages().length, 1);

  await assert.rejects(
    sink.send({ ...message, text: message.text + ' contenido diferente' }),
    /QA_MANAGER_EMAIL_IDEMPOTENCY_CONFLICT/
  );
  assert.equal(sink.listMessages().length, 1);
});

test('QA-MAIL-04 real recipients, real customer addresses and incomplete evidence are rejected', async () => {
  const sink = createQaManagerEmailSink(QA_CONFIG);
  const message = validMessage();

  await assert.rejects(
    sink.send({ ...message, to: 'external@example.invalid' }),
    /QA_MANAGER_EMAIL_RECIPIENT_NOT_SINK/
  );
  await assert.rejects(
    sink.send({ ...message, client: { ...message.client, email: 'cliente@example.invalid' } }),
    /QA_MANAGER_EMAIL_CLIENT_NOT_SYNTHETIC/
  );
  await assert.rejects(
    sink.send({ ...message, snapshotHash: 'not-a-sha256' }),
    /QA_MANAGER_EMAIL_PACKAGE_EVIDENCE_INVALID/
  );
  await assert.rejects(
    sink.send({ ...message, text: 'Paquete sin datos del cliente' }),
    /QA_MANAGER_EMAIL_CLIENT_DATA_MISSING/
  );
  assert.equal(sink.listMessages().length, 0);
});
