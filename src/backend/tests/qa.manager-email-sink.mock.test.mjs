import test from 'node:test';
import assert from 'node:assert/strict';

import { createQaManagerEmailSink } from './fixtures/qaManagerEmailSink.mock.mjs';

const QA_CONFIG = Object.freeze({
  environment: 'QA',
  enabled: true,
  siteId: 'site-qa-synthetic',
  qaSiteId: 'site-qa-synthetic',
  sinkRecipient: 'qa-gestoria@example.test',
});

function validMessage(overrides = {}) {
  return {
    to: QA_CONFIG.sinkRecipient,
    subject: 'Paquete QA - prueba de gestoría',
    text: 'Cliente: Nacho Pitt; email: qa.simple@example.test; paquete sintético de prueba.',
    traceId: 'trace-qa-manager-1',
    packageId: 'qa-package-1',
    snapshotHash: 'a'.repeat(64),
    client: {
      firstName: 'Nacho',
      lastName: 'Pitt',
      email: 'qa.simple@example.test',
    },
    ...overrides,
  };
}

test('QA-MAIL-01 manager email sink is fail-closed outside the explicit QA context', () => {
  for (const config of [
    {},
    { ...QA_CONFIG, enabled: false },
    { ...QA_CONFIG, environment: 'PRODUCTION' },
    { ...QA_CONFIG, siteId: 'different-site' },
    { ...QA_CONFIG, sinkRecipient: 'nachoortegazgz@gmail.com' },
  ]) {
    assert.throws(() => createQaManagerEmailSink(config), /QA_MANAGER_EMAIL_SINK_DISABLED/);
  }
});

test('QA-MAIL-02 synthetic client data is delivered only to the in-memory manager sink', async () => {
  const sink = createQaManagerEmailSink(QA_CONFIG);
  const result = await sink.send(validMessage());

  assert.equal(result.provider, 'QA_MEMORY_SINK');
  assert.equal(result.simulated, true);
  assert.equal(result.deliveredToSink, true);
  assert.equal(result.recipient, QA_CONFIG.sinkRecipient);
  assert.equal(result.status, 'SENT_TO_QA_SINK');
  assert.match(result.messageId, /^qa_mail_[a-f0-9]{24}$/);

  const [message] = sink.listMessages();
  assert.equal(message.client.firstName, 'Nacho');
  assert.equal(message.client.lastName, 'Pitt');
  assert.equal(message.client.email, 'qa.simple@example.test');
  assert.match(message.text, /Nacho Pitt/);
  assert.match(message.text, /qa\.simple@example\.test/);
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
    sink.send({ ...message, to: 'nachoortegazgz@gmail.com' }),
    /QA_MANAGER_EMAIL_RECIPIENT_NOT_SINK/
  );
  await assert.rejects(
    sink.send({ ...message, client: { ...message.client, email: 'client@gmail.com' } }),
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
