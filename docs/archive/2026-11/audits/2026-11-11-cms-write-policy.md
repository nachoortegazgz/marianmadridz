# CMS write-surface audit and allowlist — 2026-11-11

## Objective

Constrain elevated mutation primitives in `dataAccess.js` to observed, reviewed domain consumers. Prevent generic update/delete/bulk mutation from reaching append-only fiscal and accounting ledgers.

## Source audit (main at 0e51b082fd75515949f3b9b23e647b4777796b3b)

Repository-wide code search and direct consumer inspection found:

- `insertItem`: consumers include `security.js` (`ControlOperativo/RATE_LIMIT`), `horario.web.js` (`RegistrosHorariosStaff`), `bookingCore.js` (`ControlOperativo` and `CitasF2`), `bookingSaga.js` (`ControlOperativo`), and audit, cash, fiscal ledger, accounting, events, booking-control, and fiscal-document snapshot modules.
- `updateItem`: called through `dalUpdate` in `crons.js`, `fiscalLedgerLock.js`, `accountingLedger.js`, `cajas.web.js`, `events.js`, and `fiscalDocuments.web.js`; `bookingCore.js` captures the same wrapper for `ControlOperativo` transaction state and `CitasF2` booking projections. Observed target collections are `ControlOperativo`, `CajaActual`, and `CitasF2`.
- `saveItem`: one consumer in `reservas.web.js`, writing the volatile `DAYS_CACHE` control record.
- `removeById`: nine call sites across `reservas.web.js`, `fiscalLedgerLock.js`, `accountingLedger.js`, and `fiscalDocuments.web.js`. Each now supplies an expected type: `DUAL_CACHE`, `DAYS_CACHE`, `DISPLAY_TOKEN`, `SLOT_LOCK`, or `IDEMPOTENCY` for pre-snapshot claim cleanup.
- `bulkRemove`: consumers only in `crons.js`; all target `ControlOperativo` and use a `controlType` equality condition plus an expiry/terminal timestamp and optional status.
- `bulkInsert` and `bulkUpdate`: no production code consumers found. They are now fail-closed until a reviewed consumer contract exists.
- `bulkPatchItems`: existing policy remains in place for the three approved CAS consumers (`RATE_LIMIT`, `SLOT_LOCK`, `SYSTEM_FLAG`).

## Policy implemented

- Insert: allowlisted collections only. Control records require a canonical `controlType`; `CitasF2` projections require `bookingId`; fiscal records require a canonical `recordType`. Attendance records and fiscal/accounting ledgers remain insert-only.
- Update: only `ControlOperativo` mutable control types, `CajaActual`, and `CitasF2` projection rows with both `_id` and `bookingId`. Append-only ledgers are not updateable through this primitive. `WEBHOOK_EVENT` is explicitly not updateable.
- Save/upsert: only `ControlOperativo/DAYS_CACHE` and `CajaActual` with an explicit `_id`.
- Single remove: only ephemeral `ControlOperativo` types and scoped lease/claim cleanup (`SLOT_LOCK`, `IDEMPOTENCY`), with the expected type supplied by the caller.
- Bulk remove: only `ControlOperativo`, with a purgeable `controlType` and a constrained filter vocabulary.
- Bulk insert/update: disabled because no approved consumer exists.
- Append-only collections remain insert-only through these generic wrappers.

## Scope and limitations

This is an application-layer guard over the centralized elevated data access module. It does not replace Wix CMS collection permissions, collection hooks, backend RBAC, or schema validation. Direct CMS access outside this module must remain prohibited and separately audited.

No CMS data, ledgers, bookings, cash balances, or Wix runtime configuration were changed. No deployment or merge was performed. A temporary draft PR #293 was used only to trigger CI on the exact commit; its purpose is complete and it will be closed without merging.

## Validation — current PR head 6b49254c7b8134c906aefc15b1460ce4fcddb314

- GitHub Actions runs **#730** (temporary validation PR) and **#731** (PR #289): completed successfully on the current PR head.
- Offline regression: **61 suites, 573 tests passed, 0 failed**.
- Wix SDK contract checks: passed.
- Wix eCommerce Order Transactions contract: passed.
- Wix Bookings Reader V2 contract: passed.
- ESLint: passed.
- Secret scanning run **#151**: passed.
- The preceding run on head `446fe0a` exposed test expectations that still assumed the old marker layout; those tests now distinguish `WEBHOOK_CLAIM` from append-only `WEBHOOK_EVENT` and use the event-type-scoped marker identity. The same green result is reproduced on the final documentation-inclusive PR head.
- Wix Runtime validation is still required for the conditional CMS delete, conditional claim transitions, collection hooks, and actual event payload delivery. No writer E2E has been executed in Wix.

## P1 — persisted-type-safe single deletion

`removeById()` now performs a strong read of the target and compares its persisted `controlType` with the caller's `expectedControlType`. It then delegates to a single-item `bulkRemove` with a server-side condition requiring the same `controlType`. The strong read is an explicit fail-closed validation; the conditional delete is the race barrier. If the SDK result does not confirm removal of the exact ID, the function throws rather than reporting success.

Offline tests cover matching type, mismatched type, missing target, and a type change injected between the strong read and conditional delete. Wix documents the optional condition on Bulk Remove Data Items; runtime behavior remains to be confirmed in the site's Wix environment.

## P0 — fenced Wix event claims

The eight Bookings/eCommerce Velo handlers now enter a common claim boundary before executing domain logic. The claim ID is deterministic SHA-256 over the exact `metadata.id` and event type. A unique insert acquires the claim; a duplicate delivery sees `BUSY` or `COMPLETED`. Claims use a 10-minute lease and owner-token/version compare-and-swap transitions. Failed handlers release to `FAILED_RETRYABLE`; an interrupted handler can be recovered after lease expiry. A stale owner cannot complete or release a claim after a newer owner has advanced its version.

`WEBHOOK_EVENT` remains append-only and is written only after the existing domain handler succeeds. Its new marker identity is event-type-scoped and hashed; reads retain a legacy-key fallback. The claim prevents concurrent execution of the same event, while domain writers still need their own idempotency keys for safe recovery after a process crash between a side effect and claim completion. This is not a claim that arbitrary external side effects become exactly-once.

## E2E booking environment status — refreshed 2026-11-11

The Wix site `Marian Madrid Peluquería y Estética` (`188bed94-177c-4bc9-a9f0-35080d874f3e`) is verified as **Draft**, with **Velo enabled** and **Wix Bookings installed**. Draft mode does not suppress Wix Automations.

Read-only inspection found 149 automations, 27 ACTIVE, including two directly triggered by Bookings:
- `0c84478b-1061-4117-a91c-2f83cbfe184c` — “Notify me when someone books one of my services”.
- `bbd81479-88d1-490b-9742-8cc3552bbfba` — “Notify me when I need to review a booking request”.

No booking, CMS, payment, cash, fiscal, accounting, email, WhatsApp or Wix runtime configuration mutation was performed. Writer E2E remains blocked until outbound side effects are explicitly neutralized and the QA execution path is controlled.
