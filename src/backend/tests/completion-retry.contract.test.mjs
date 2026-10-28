import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const readBackend = (name) => readFileSync(path.join(here, "..", name), "utf8");

test("COMPLETION-RETRY-01 producer and consumer use the same control type", () => {
  const saga = readBackend("booking/bookingSaga.js");
  const crons = readBackend("crons.js");
  const producer = saga.indexOf('compensationKind: "COMPLETION_RETRY"');
  const recordStart = saga.lastIndexOf("await elevatedInsert(COMPENSACIONES_COL", producer);
  const record = saga.slice(recordStart, producer + 100);

  assert.notEqual(producer, -1, "booking saga must expose the completion retry producer");
  assert.match(record, /controlType:\s*CONTROL_TYPE\.SYSTEM_FLAG/,
    "completion retry is persisted as SYSTEM_FLAG by the producer");

  const consumerStart = crons.indexOf("export async function retryCompletionRequired()");
  const consumer = crons.slice(consumerStart);

  assert.match(consumer, /eq\("controlType",\s*CONTROL_TYPE\.SYSTEM_FLAG\)/,
    "cron must query the producer's control type");
  assert.doesNotMatch(consumer, /eq\("controlType",\s*CONTROL_TYPE\.IDEMPOTENCY\)/,
    "cron must not query a different control type");
});


test("COMPLETION-RETRY-02 finalizes the idempotent transaction before resolving the queue item", () => {
  const crons = readBackend("crons.js");
  const consumerStart = crons.indexOf("export async function retryCompletionRequired()");
  const consumer = crons.slice(consumerStart);
  const completionCall = consumer.indexOf("_completeTransaction(pairToken, payload.result, traceId)");
  const queueResolution = consumer.indexOf('status: "COMPLETED"', completionCall);

  assert.notEqual(completionCall, -1,
    "the cron must invoke the canonical transaction finalizer");
  assert.ok(queueResolution > completionCall,
    "the auxiliary queue item must not be marked COMPLETED before transaction finalization");
  assert.match(consumer, /if \(!completion \|\| !completion\.ok\)/,
    "a failed finalization must remain a failed retry");
  assert.match(consumer, /payload\.pairToken/,
    "the retry must use the pair token persisted by the producer");
});
