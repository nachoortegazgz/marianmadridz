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
- Save/upsert: only `ControlOperativo/DAYS_CACHE`.
- Single remove: only ephemeral `ControlOperativo` types and scoped lease/claim cleanup (`SLOT_LOCK`, `IDEMPOTENCY`), with the expected type supplied by the caller.
- Bulk remove: only `ControlOperativo`, with a purgeable `controlType` and a constrained filter vocabulary.
- Bulk insert/update: disabled because no approved consumer exists.
- Append-only collections remain insert-only through these generic wrappers.

## Scope and limitations

This is an application-layer guard over the centralized elevated data access module. It does not replace Wix CMS collection permissions, collection hooks, backend RBAC, or schema validation. Direct CMS access outside this module must remain prohibited and separately audited.

No CMS data, ledgers, bookings, cash balances, or Wix runtime configuration were changed. No deployment or merge was performed.

## Validation

- Added offline policy tests for all six mutation families.
- Existing `bulkPatchItems` tests remain intact.
- CI is required before merge.
- Wix Runtime validation is still required for deployed permission/hook behavior.

## E2E booking environment status

The Wix connection resolves one site: `Marian Madrid Peluquería y Estética` (`188bed94-177c-4bc9-a9f0-35080d874f3e`), published at `https://www.marianmadrid.es/`, with Velo and Wix Bookings installed. It does not expose a separate isolated QA site. Therefore no booking create/cancel/reschedule operation was issued against the published site's CMS. This is an explicit environment blocker, not a passed E2E test.
