# Dual-reschedule read-only inspector — 2026-11-12

## Purpose

Close the first safe step of issue #162: determine whether both native Wix Bookings phases and both CitasF2 projections are exactly at the persisted target state after an interrupted dual reschedule.

This is a repository implementation and offline validation record. It is not Wix runtime QA.

## Official Wix contract verified

Source: [Query Extended Bookings — Bookings Reader V2](https://dev.wix.com/docs/api-reference/business-solutions/bookings/bookings/bookings-reader-v2/query-extended-bookings)

- REST method: POST https://www.wixapis.com/_api/bookings-reader/v2/extended-bookings/query.
- SDK: extendedBookings.queryExtendedBookings(query, options) from @wix/bookings.
- A specific booking can be queried with filter: { "booking.id": bookingId }.
- The response contains extendedBookings[]; booking data is nested under extendedBookings[].booking.
- The returned booking includes startDate, endDate, status, and bookedEntity.slot; the slot includes serviceId and resource identity.
- Cursor paging supports up to 100 results. The inspector asks for two records and requires exactly one result per booking ID.
- Supported-filter documentation explicitly includes booking.id.

SDK example and contract were also checked against the installed package by scripts/verify-wix-bookings-reader-v2.mjs.

Official references:
- [Query Extended Bookings REST](https://dev.wix.com/docs/api-reference/business-solutions/bookings/bookings/bookings-reader-v2/query-extended-bookings)
- [Query Extended Bookings SDK](https://dev.wix.com/docs/api-reference/business-solutions/bookings/bookings/bookings-reader-v2/query-extended-bookings?apiView=SDK)
- [Bookings Reader V2 supported filters](https://dev.wix.com/docs/api-reference/business-solutions/bookings/bookings/bookings-reader-v2/supported-filters)

## Implementation

Files:
- src/backend/booking/dualRescheduleReconciliation.js
- src/backend/crons.js
- src/backend/tests/dualRescheduleReconciliation.test.mjs
- src/backend/tests/crons.dual-reschedule-readonly.test.mjs

The exported inspectDualRescheduleJournalsReadOnly() function:
1. Reads SYSTEM_FLAG journals whose dedupeKey begins with DUAL_RESCHEDULE_, using strong CMS reads and bounded pagination.
2. Skips already COMPLETED journals.
3. Reads F1 and F2 independently through elevated Bookings Reader V2.
4. Reads the matching CitasF2 pair by pairToken.
5. Converts persisted Madrid-local target intervals with the existing getUtcDateFromMadridLocal helper.
6. Requires exact agreement on both phases' interval, service, resource and booking status in native Bookings and CMS.
7. Returns TARGET_STATE_CONFIRMED_READ_ONLY only for a complete exact match; every missing, ambiguous, mixed, stale or unreadable state remains REPAIR_REQUIRED.

## Safety boundary

- Not registered in src/backend/jobs.config.
- Not a WebMethod and not automatically invoked.
- No Booking writer, rollback, CMS update/insert/delete, operational alert, email, payment, cash or fiscal operation.
- Does not transition a journal to COMPLETED or RECONCILED.
- It is a diagnostic result only. Manual repair remains required until a separate recovery design is approved and tested.

## Validation

GitHub Actions on PR #302 head 7785166fdb63ec4fe764a9ee76a28567700310ab:

- Backend offline quality gates: run 43126443567 — 64 suites, 592 tests, 0 failures.
- Wix SDK Cart V2/Data contract: success.
- Wix eCommerce Order Transactions contract: success.
- Wix Bookings Reader V2 SDK contract: success.
- ESLint: success.
- Secret scanning / Gitleaks: run 43126443532 — success.

## Remaining limitations

- No Wix Preview, Wix Runtime, live CMS query, or isolated QA booking was executed.
- Live CitasF2 field values and effective permissions were not read or changed.
- The inspector must be exercised against synthetic QA bookings in an isolated environment before operational use.
- This does not implement automatic recovery, writer retries, compensation, or alert persistence.

## Change control

PR: [#302 — read-only dual reschedule journal inspector](https://github.com/nachoortegazgz/marianmadridz/pull/302)

State: Draft, open, not merged, not deployed.