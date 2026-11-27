# TPV operational policy and error contract — 2026-11-27

## Decision

PR #651 consolidates TPV errors, write guards and data integrity without a parallel runtime or environment-wide write switch.

## Public error contract

Canonical formatter: `src/backend/tpv/tpvError.js`.

- Envelope: `status`, `data`, `error`, `traceId`.
- Stable `code`, safe user message and actionable remediation.
- Optional metadata: `retryable`, `persisted`, `recoverable`, `auditPersisted`.
- Browser-visible `technicalDetail` is the stable error code only. Raw `Error.message`, provider payloads, tokens, credentials and stack traces are not forwarded.
- Unknown exceptions receive a safe fallback code/message and are non-retryable by default.
- Sales/refund envelopes and affected cashier, catalog, movement, payment, closure, audit and export WebMethods use the same normalizer.

## Write and deletion policy

- `bulkRemove` and `assertBulkRemoveAllowed` throw `CMS_BULK_DELETE_PROHIBITED`.
- `removeById` performs only logical retirement through conditional bulk patch for approved ephemeral controls: DUAL_CACHE, DAYS_CACHE, DISPLAY_TOKEN, SLOT_LOCK and RATE_LIMIT. It verifies the updated item ID; no CMS row is physically deleted.
- Cron cleanup retires caches, tokens, locks and rate limits with bounded concurrency. Idempotency, system flags and audit/compensation evidence are retained rather than purged.
- Physical cash movements, accounting entries, fiscal ledgers, closure evidence, staff-time ledgers and webhook events remain append-only. Corrections require new traceable events.
- Commercial intents/projections can only be updated through validated, authorized backend paths.

## TPV physical writer and reader

- `MovimientosCaja_beforeInsert` routes `recordSource=TPV_LEDGER` through the physical-movement contract, separate from invoice/F1 validation.
- The operational TPV reader checks movement-to-collection mapping, transaction identity, source, trace, sequence, timestamp, hash and fiscal envelope before returning a record.
- Historical movement aliases remain readable only when the record satisfies the ledger envelope; no generic REAL/SYNTHETIC/SIMULATION environment classification is used.
- Explicit smoke/fixture markers are filtered from fiscal and receipt reads where required. Generic `synthetic=true` or `sourceType` alone does not classify a record.
- Accounting-ledger lock acquisition and release use versioned compare-and-set and verify the updated item ID.

## CMS hooks

- Physical cash, accounting ledger, closure evidence and staff-time ledger reject update/remove.
- `ControlOperativo/WEBHOOK_EVENT` rejects update/remove.
- `TransaccionesTPV` rejects remove; validated pending-intent updates remain distinct from append-only ledger updates.
- No hook performs physical deletion or rewrites an existing ledger record.

## Regression evidence

CI on code HEAD `7771f4c6bb7da61ecf60bd58708b26d5331745dd`:

- Layer 1: 29 suites / 376 tests PASS.
- Layer 2: 16 suites / 249 tests PASS.
- Complete offline suite: 81 suites / 763 tests PASS.
- Gitleaks full-history scan, npm audit, Wix eCommerce cart/transactions SDK contracts, TPV SDK contract and ESLint: PASS.

The suite includes tests for raw-error sanitization, append-only hooks, bulk-delete prohibition, logical retirement, cron retention, TPV ledger validation, explicit fixture markers and accounting-lock CAS.

## Validation boundary

No Wix site publication, live CMS write, cash-session mutation, payment, refund, AEAT submission, terminal action or external notification was performed. CI PASS does not prove Wix Preview/Runtime behavior or Git-to-Wix synchronization.

## Remaining work

- Audit `src/backend/eventLog.js` and every consumer before deciding/applying global mandatory `transactionId`. The legacy writer still has a `TX_<sequenceNumber>` fallback; PR #650 covers the manual fiscal writer, not this global scope.
- Verify official AEAT alta/anulación hash mapping before connecting AEAT hash functions. Never recalculate historical records.
- Execute Wix Preview/Runtime E2E with an isolated fixture/session and canonical writer. Do not reuse the open `CajaActual` singleton.
