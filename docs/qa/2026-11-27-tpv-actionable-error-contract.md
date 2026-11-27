# TPV actionable error contract — 2026-11-27

## Decision and scope

The TPV backend uses one public error envelope for caught WebMethod failures. The canonical formatter is `src/backend/tpv/tpvError.js`:

- Actionable errors preserve their stable `code`, user-facing message, remediation steps, technical detail and retryability.
- Legacy string error codes remain stable; they are not replaced by a generic fallback code.
- Unknown exceptions receive a safe public message, bounded technical detail and non-retryable default.
- `errorResult` returns the common `{ status, data, error, traceId }` shape and allows operation metadata such as `persisted` and `recoverable`.

The formatter is used by cashier/session, cash movement, movement/audit export, closure/ticket, catalog, payment-validation and audit-read WebMethods. The existing `tpvEnvelope` contract in the sales/refund path remains the domain-specific response builder; it already returns user guidance and technical metadata and is not duplicated.

## Append-only CMS hooks

- `MovimientosCaja_beforeUpdate` and `MovimientosCaja_beforeRemove` throw `MOVIMIENTOS_CAJA_APPEND_ONLY`.
- `LibroAsientosContablesDetalle_beforeUpdate` and `LibroAsientosContablesDetalle_beforeRemove` throw `ACCOUNTING_LEDGER_APPEND_ONLY`.
- `HistoricoCierresZ` update/remove throw `HISTORICO_CIERRES_Z_APPEND_ONLY`.
- `RegistrosHorariosStaff` update/remove throw `STAFF_TIME_LEDGER_APPEND_ONLY`.
- `ControlOperativo/WEBHOOK_EVENT` rejects both update and remove with an actionable append-only error.
- `TransaccionesTPV_beforeRemove` resolves the requested identifier, verifies that the target exists using the strong DAL read, then throws `TPV_TRANSACTIONS_APPEND_ONLY`. Both string and `{ _id }` hook arguments are accepted.
- The errors include remediation and a sanitized context snapshot. No hook performs a delete or changes an existing ledger record.

The existing controlled update policy for pending commercial intents is unchanged; this change specifically prohibits deletion. Fiscal, accounting and physical cash ledgers remain immutable.

## Operational guard boundary

The `assertTpvOperationalLedgerConfigured("physical"|"audit")` checks and the corresponding operator-context resolution now execute inside each affected WebMethod's `try/catch`. Configuration, authorization and context-resolution failures therefore use the same normalized error contract. Authorization checks remain mandatory and are not bypassed.

## Fiscal read-model safety

The fiscal aggregator excludes explicit smoke/simulation markers (source, event type, movement type, projection status and sentinel hashes) from both quarterly totals and the issued-sales ledger. It does not infer that every record marked SYNTHETIC is disposable; the explicit marker contract remains the filter.

## Regression coverage

Offline coverage now verifies:

- Actionable-error metadata preservation and legacy error-code stability.
- Generic exception fallback and trace/persistence metadata.
- Append-only errors for physical cash, accounting ledger and commercial TPV intent deletion.
- String and object-form `TransaccionesTPV` identifiers and missing-record behavior.
- Placement of physical/audit configuration checks and operator resolution inside the relevant WebMethod `try` blocks.

## Validation boundary

The change is code- and test-suite scoped. It does not publish the Wix site, mutate live CMS data, close or reuse an open cash session, initiate payment operations, or submit records to AEAT. CI is the authoritative executable test result for this branch. Wix Runtime E2E remains a separate gate and must not be inferred from offline tests.


## Pendientes fuera del alcance de este cambio

- Auditar `src/backend/eventLog.js` y todos sus consumidores para decidir y aplicar, si corresponde, el contrato global de `transactionId`. El writer legacy no queda cubierto por el cambio P0 de `cajas.web.js`.
- Completar el mapping AEAT oficial (alta/anulación, tipo de factura, serie/número, fecha, importes y hash previo) antes de conectar `computeAeatAltaHash` o `computeAeatAnulacionHash`. No recalcular históricos.
- Ejecutar Wix Runtime E2E con fixture/sesión sintética aislada y writer canónico. No reutilizar la caja ABIERTA ni inferir Runtime PASS de CI.
