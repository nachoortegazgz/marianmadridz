# Fiscal ledger and Z-closing hardening — QA record

**Date:** 2026-11-09  
**Base:** `main` at `5fba1b3aaa17d6a758d4004372cd5ece112b98fb`  
**Change branch:** `fix/fiscal-ledger-z-closing-hardening-20261109`  
**Status:** Implementation under CI validation; not deployed.

## Scope

This change addresses verified risks in `src/backend/cajas.web.js`:

1. Serialize Z closing with the same global fiscal-ledger lock used by append writers.
2. Re-check the operation date against `HistoricoCierresZ` after the manual writer acquires the lock.
3. Start daily hash verification from the preceding global ledger record, not from the genesis hash.
4. Fail closed when a Z-close date query reaches its configured page cap before all movements are read.
5. Apply accounting sign to VAT base and tax values for refunds and normalize legacy `ONLINE` payment methods at read time.
6. Paginate full-chain audits; report `PARTIAL` rather than `SUCCESS` when the page cap is reached.
7. Use deterministic compensation IDs and confirm an insert conflict by reading the exact record back.
8. Report signer outages as `PARTIAL`, not as a completed fiscal transaction/closing.
9. Format QR date and amount consistently and derive annual sequence year in `Europe/Madrid`.
10. Keep public error messages generic while retaining technical detail in protected logs.

## Regression coverage added

- Shared lock ownership and release on Z closing.
- Period revalidation after the manual writer lock.
- Global predecessor hash at the start of a daily close.
- Audit pagination status.
- Cross-day hash continuity and refund VAT netting.
- Legacy online payment normalization during close.
- Compensation queue idempotency.
- Full hash audit across more than 200 movements.

## Data safety

- No existing `MovimientosCaja` records are updated or deleted.
- No existing sequence counters are rewritten by this change.
- Existing `HistoricoCierresZ` records are not modified.
- New recovery queue entries use deterministic identifiers; duplicate requests are acknowledged only after the matching record is read back.
- No production CMS data has been changed by this PR.

## Required gates before merge

- Complete offline regression suite passes.
- Wix eCommerce Cart V2 and Bookings Reader V2 SDK contract checks pass.
- ESLint passes.
- Diff reviewed, including the new tests.
- No unresolved P0/P1 findings introduced by the patch.

## Required checks after merge

- Run the regression suite against the merged commit.
- Validate a test Z close with signer available and unavailable in Wix test environment.
- Validate a cross-day ledger chain and a refund in the non-production CMS.
- Confirm a manual transaction waiting behind Z close is rejected after the period closes.
- Confirm the public booking/checkout flows remain functional.

**Deployment is not part of this PR.**
