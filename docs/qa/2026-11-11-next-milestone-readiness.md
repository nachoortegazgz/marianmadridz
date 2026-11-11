# Next milestone readiness audit — 2026-11-11

## Scope and evidence

Read-only repository inspection against `main` at `86775384922b2a0d1472a268ec18f5ce09a9617d`. This report records repository evidence only. It does not certify Wix runtime, live CMS permissions, external M365 configuration, or deployed Editor state.

## Capa 3 / export pipeline (#173)

### Verified in repository

- `src/backend/` contains the canonical backend modules, including `crons.js`, `jobs.config`, `dataAccess.js`, `internalConfig.js`, and fiscal/booking modules.
- `src/backend/jobs.config` declares 15 scheduled jobs. Their current purposes are lock/rate-limit/token/cache cleanup, compensation processing, Z-close verification, health checks, audit retention, unknown-payment reconciliation, legacy dual-pair reconciliation, completion retry, booking-control cleanup, order-event reconciliation, and missing booking-projection reconciliation.
- No scheduled job in `jobs.config` is an export/archival job.
- No `src/backend/exports/exportService.js` file exists in the inspected backend tree.
- The jobs use `Europe/Madrid`, scheduler concurrency policy `Forbid`, a 300-second global timeout, and configured retry/backoff. Individual job timeouts and alert thresholds are declared per job.

### Conclusion

The dossier-described export pipeline and PA-01…PA-07 / SharePoint delivery cannot be treated as implemented based on repository evidence. The repository currently demonstrates operational cron jobs, not a Capa 3 export pipeline.

### Safe next steps

1. Inventory Microsoft 365 / SharePoint / Power Automate using authorized connector access, without exposing secrets or copying production personal/fiscal data.
2. Define a synthetic-data export contract and destination isolation.
3. Design export manifests with source period, immutable source identifiers, schema version, content hash, idempotency key, delivery status, and provider receipt.
4. Keep Wix CMS as the transactional source of truth; SharePoint remains evidence storage only.
5. Implement only after the destination, permissions, retention, and data minimization are approved.
6. Test retries, duplicate delivery, timeout after upload, partial batches, and reconciliation using synthetic data.

No M365 calls, secret reads, exports, uploads, or configuration changes were performed in this audit.

## Dual rescheduling recovery (#162)

### Verified in repository

- `src/backend/booking/dualRescheduleJournal.js` builds a deterministic SHA-256 identity from the pair, booking/service/resource identifiers, and both target intervals. `traceId` is intentionally excluded.
- The journal states include in-progress phases, CMS projection, completion, and `REPAIR_REQUIRED`.
- Tests cover deterministic identity, distinct identity for changed target/operation ID, required identity dimensions, journal transition ordering, fail-closed nonterminal replay, lock heartbeat/release ordering, canonical lock ordering, and exclusion of the exposure gap.
- `reconcileInconsistentDualPairs()` is wired as a scheduled job, but explicitly skips payloads with `operationType === "DUAL_RESCHEDULE"`. It is a legacy dual-pair/ledger consistency reconciler, not the specific journal reconciler required by #162.
- The legacy reconciler checks pair rows, order/payment consistency, a unique matching cash movement, and native booking existence before marking its own flag reconciled. It does not compare both native bookings to the journal's target slots or verify the journal's CMS projection.

### Conclusion

The dedicated `DUAL_RESCHEDULE` reconciler remains unimplemented. The existing cron must not be repurposed by weakening its guard or by treating booking existence as proof of target-state completion.

### Safe next steps

1. Build a read-only journal reader/reconciler first.
2. Load the journal and both native bookings using the supported Wix Bookings reader contract.
3. Require exact equality of both native target intervals, service/resource identity, expected booking status, and the persisted CMS projection before any terminal transition.
4. Keep mixed, missing, stale, ambiguous, or partially readable states in `REPAIR_REQUIRED`; create a deduplicated operational alert for manual repair.
5. Do not invoke booking writers, rollback, or rewrite financial data from the reconciliation job.
6. Add unit/contract tests for every state combination, then runtime tests with isolated QA bookings before enabling a scheduled writer.

## Next-milestone gates

| Gate | State | Evidence required to exit |
|---|---|---|
| GitHub main protection (#210) | Blocked | Admin-capable credential; required CI checks configured and verified |
| CMS editor isolation (#261) | Blocked | Effective permissions resolved; isolated CMS_EDITOR denial tests; elevated writer continuity |
| Manager package dispatch (#223) | Partial | Monthly aggregation; durable idempotent dispatch ledger; provider receipt recovery tests; sending remains disabled |
| Dual reschedule (#162) | Partial | Dedicated read-only reconciler, exact target-state verification, runtime concurrency tests |
| Veri*Factu (#209) | Blocked P0 | Approved fiscal matrix/SIF identity, official AEAT schemas and vectors, transport/certificate/representation, acceptance tests |
| Staff writers (#224) | Disabled | Durable idempotency/serialization, role tests, runtime QA; no real labor/cash entries |
| E2E campaign (#211) | Blocked | Isolated payments and notification sink, synthetic QA identities, cleanup evidence |
| Capa 3 (#173) | Not implemented | Authorized M365 inventory, approved synthetic destination, idempotent export evidence |

## Safety and deployment

- No Wix site publication or Velo deployment was performed.
- No Wix CMS permissions or records were changed.
- No reservations, orders, payments, refunds, stock, cash movements, attendance records, or fiscal ledgers were created or modified.
- No emails, WhatsApp messages, Power Automate flows, or SharePoint uploads were sent.
- No secrets or production data were read for this report.
- This is a repository audit and design gate, not runtime QA or legal/fiscal certification.
