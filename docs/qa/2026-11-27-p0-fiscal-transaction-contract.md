# P0 fiscal transaction contract — 2026-11-27

## Implemented in this change

- `registerManualTransaction` now requires a trimmed, non-empty `transactionId` with a maximum length of 128 characters immediately after backend authorization and before fiscal configuration work.
- The writer no longer invents `TX_<sequence>` identifiers.
- Replays compare a deterministic request fingerprint. Identical retries return the existing movement; reuse of the same transactionId with a different payload returns `TRANSACTION_ID_PAYLOAD_CONFLICT`. The fingerprint is stored in the existing `ControlOperativo` idempotency claim payload, not in the fiscal movement.
- The same fingerprint comparison is repeated under the fiscal ledger lock to close the concurrent-replay path.
- `queueFiscalRecovery` validates and uses only the normalized transactionId; missing or oversized IDs return `TRANSACTION_ID_REQUIRED`.
- A writer-boundary validator checks transactionId, hash, previousRecordHash, sequenceNumber, tipoFactura, fiscalPeriod and staffResourceId after hash construction and before signing/persistence. A failed contract returns the missing fields; sequence rollback is required before returning. If rollback cannot be confirmed, the lock is retained and `LEDGER_REPAIR_REQUIRED` is returned.
- Offline tests cover missing ID, the 128-character boundary, oversized ID, identical retry, changed-payload replay and recovery queue validation.

## AEAT hash integration — deliberately not changed

`aeatHash.js` exposes the AEAT v0.1.2 input contract. The cash writer currently builds a separate internal chain payload and persists it through the legacy `aeatPayload` field mapping. That field name does not prove that the payload is the official AEAT hash input.

The following mapping is not yet established by a single canonical writer contract and must not be guessed:

- Whether each writer event maps to RegistroAlta or RegistroAnulacion.
- The canonical mapping of `tipoFactura`, invoice series/number and issue date for rectifications/refunds.
- Whether the AEAT amount input is `taxAmount` or another legally defined total under the applicable invoice type.
- The exact first-record/genesis and previous-AEAT-hash semantics for each fiscal chain.
- The CMS field/schema and hook contract for persisting an AEAT hash separately from the internal `hashChain`.

Therefore this patch does not connect `computeAeatAltaHash` or `computeAeatAnulacionHash` to the writer, does not relabel the internal hash as AEAT, and does not recalculate historical records. The integration remains P0 pending reconciliation against the applicable official AEAT technical specification and the site's canonical invoice/rectification data contract.

## Scope and validation boundary

The fiscal movement validator runs only at the new writer boundary. It does not repair or rewrite historical movements and does not add a blanket downstream process gate. Missing required input produces a specific response before insertion; unrelated processes remain unaffected.

This change does not authorize real payments, AEAT submissions, site publication or live CMS mutation. CI results and Wix Runtime E2E status must be reported separately.
