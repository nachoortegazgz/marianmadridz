import { createHash } from 'node:crypto';

const EMAIL_PATTERN = /^[^\\s@]+@example\\.test$/i;

function hashId(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 24);
}

function isHash(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

/**
 * In-memory manager-email sink for offline QA only.
 * It accepts only reserved .example.test addresses and never performs I/O.
 * It is not imported by production backend modules.
 */
export function createQaManagerEmailSink(config = {}) {
  if (
    config.environment !== 'QA' ||
    config.enabled !== true ||
    typeof config.siteId !== 'string' ||
    !config.siteId ||
    config.siteId !== config.qaSiteId ||
    typeof config.sinkRecipient !== 'string' ||
    !EMAIL_PATTERN.test(config.sinkRecipient)
  ) {
    throw new Error('QA_MANAGER_EMAIL_SINK_DISABLED');
  }

  const messages = new Map();

  async function send(input = {}) {
    const to = String(input.to || '').trim().toLowerCase();
    const subject = String(input.subject || '').trim();
    const text = String(input.text || '');
    const traceId = String(input.traceId || '').trim();
    const packageId = String(input.packageId || '').trim();
    const snapshotHash = input.snapshotHash;
    const client = input.client || {};
    const clientEmail = String(client.email || '').trim().toLowerCase();
    const clientName = [client.firstName, client.lastName].map((v) => String(v || '').trim()).filter(Boolean).join(' ');

    if (to !== config.sinkRecipient.toLowerCase() || !EMAIL_PATTERN.test(to)) {
      throw new Error('QA_MANAGER_EMAIL_RECIPIENT_NOT_SINK');
    }
    if (!EMAIL_PATTERN.test(clientEmail) || !clientName) {
      throw new Error('QA_MANAGER_EMAIL_CLIENT_NOT_SYNTHETIC');
    }
    if (!subject || !text.includes(clientName) || !text.includes(clientEmail)) {
      throw new Error('QA_MANAGER_EMAIL_CLIENT_DATA_MISSING');
    }
    if (!traceId || !packageId || !isHash(snapshotHash)) {
      throw new Error('QA_MANAGER_EMAIL_PACKAGE_EVIDENCE_INVALID');
    }

    const operationKey = packageId + ':' + snapshotHash + ':' + to;
    const fingerprint = JSON.stringify({ to, subject, text, traceId, packageId, snapshotHash, client });
    const previous = messages.get(operationKey);
    if (previous) {
      if (previous.fingerprint !== fingerprint) {
        throw new Error('QA_MANAGER_EMAIL_IDEMPOTENCY_CONFLICT');
      }
      return { ...previous.result };
    }

    const result = {
      provider: 'QA_MEMORY_SINK',
      simulated: true,
      deliveredToSink: true,
      messageId: 'qa_mail_' + hashId(operationKey),
      recipient: to,
      packageId,
      snapshotHash,
      traceId,
      status: 'SENT_TO_QA_SINK',
    };
    messages.set(operationKey, { fingerprint, result: { ...result }, message: { to, subject, text, client: { ...client } } });
    return { ...result };
  }

  function listMessages() {
    return Array.from(messages.values()).map((entry) => ({
      ...entry.result,
      subject: entry.message.subject,
      text: entry.message.text,
      client: { ...entry.message.client },
    }));
  }

  return Object.freeze({ send, listMessages });
}
