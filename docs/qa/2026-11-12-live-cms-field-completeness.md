# Live CMS field-completeness audit — 2026-11-12

## Scope and method

Read-only audit of the site's custom operational CMS collections using Wix Data Collections and Query Data Items APIs. Only aggregate counts and field-presence results were returned; no customer, member, fiscal-identity or booking values were exported.

Site: marianmadrid.es. Site ID: 188bed94-177c-4bc9-a9f0-35080d874f3e.

13 custom collections were checked for Wix-required and selected process-critical fields. No Wix-required field was empty on an existing row in the inspected sets. Optional and polymorphic fields were classified by process type rather than treated as universally required.

## Confirmed findings

### ServiciosCatalogo

- 95 rows.
- 93 rows have no catalogEntryType; all 93 have a valid serviceId and no pricingPlanId.
- 1 row is explicitly SERVICE.
- 1 row is explicitly PRICING_PLAN, with pricingPlanId and no serviceId.
- 24 rows have allowCombine=true and populated linkedPhases.
- 71 rows have allowCombine=false and no linkedPhases; this is expected.
- All 94 service rows satisfy totalDuration = phase1Duration + exposureDuration + phase2Duration.
- The single pricing-plan row has no service durations; this is expected.

Code change: CATALOG_ENTRY_TYPE is now canonical in internalConfig.js. The ServiciosCatalogo insert/update hook infers SERVICE only from a valid serviceId without pricingPlanId, infers PRICING_PLAN only from a valid pricingPlanId without serviceId, and rejects ambiguous/incomplete identities.

The 93 existing metadata cells were patched in production using Wix Bulk Patch Data Items, conditional on catalogEntryType being absent, serviceId being present and pricingPlanId being absent. The Wix automation inventory returned 149 automations, 27 active, and no active CMS Data Item Updated trigger; the repository has no ServiciosCatalogo afterUpdate hook. Patch result: 93 successes, 0 failures. Strong read-after-write confirmed 95 rows total: 94 SERVICE, 1 PRICING_PLAN, 0 missing. A subsequent count check confirmed unchanged totals in CitasF2 (0), ControlOperativo (11), MovimientosCaja (10), LibroAsientosContablesDetalle (1), RegistrosHorariosStaff (2) and CajaActual (1).

### MovimientosCaja and fiscal read paths

- 10 rows currently exist.
- 4 are explicitly marked recordSource=SMOKE_TEST.
- 1 is marked recordSource=INTERNAL and movementType=VENTA_ONLINE.
- 5 have empty recordSource, movementType=SIMULATED_PAYMENT, non-simulation eventType values, and positive sequenceNumber values 1 through 5.
- Those 5 rows are not recognized by the previous simulation classifier. They also have no fechaOperacion.
- CajaActual has one singleton with cashRegisterStatus=SIMULACION, isOpen=true, and sequenceCounters.seqGlobal=0.

Risk: the five unmarked simulated rows pass the old recordSource != SMOKE_TEST and sequenceNumber > 0 query filters. Because the classifier did not inspect movementType, fiscal aggregation and other readers could count them or use them as the ledger head.

Code change: isExplicitSimulationLedgerRecord() now recognizes movementType values beginning SIMULATED_ and explicit Spanish simulated suffixes _SIMULADO / _SIMULADA. The booking receipt lookup also excludes such rows. Existing head readers and fiscal aggregation already use this classifier.

Historical rows remain unchanged. MovimientosCaja is append-only; no record was updated, deleted, re-sequenced, re-hashed or backfilled. A read-only classification pass identifies 9/10 rows as simulated and 1 as non-simulated; all 9 simulated rows have fiscalPeriod=2026-11, and 5 have positive sequenceNumber values. The current main-branch fiscal query filters sequenceNumber>0 and recordSource!=SMOKE_TEST; those 5 unmarked rows pass that query and the old classifier does not exclude them. Therefore the November 2026 fiscal aggregation is at risk of including synthetic amounts until the PR306 classifier is deployed. The single non-simulated row has sequence 1, a 64-hex hash and a 64-hex genesis predecessor. No duplicate non-simulated sequence was found. The fiscal runtime write policy remains fail-closed.

### LibroAsientosContablesDetalle

- 1 row exists with origenTipo=SMOKE_TEST, accountCode=SIMULATED, and empty projectionStatus.
- This is synthetic accounting evidence, not a valid accounting entry.
- The collection is append-only. No correction or deletion was performed.

### RegistrosHorariosStaff

- 2 rows exist; both are recordType=REGULAR.
- Both have dayKey, monthKey, recordedAt, resourceId, memberId and traceId.
- Both lack signature; no adjustment-reason defect exists because neither is an AJUSTE record.
- Existing history/read flows treat missing or invalid HMAC as unverified and fail closed for jornada calculations.

Code change: assertRegistrosHorariosStaff() now requires a 64-character hexadecimal HMAC signature, and RegistrosHorariosStaff_beforeInsert invokes that central validator after DateTime normalization. The normal writer already signs before insert. This prevents new unsigned rows through the CMS hook. The two historical rows were not signed retrospectively or modified.

### CitasF2

- 0 rows in the current live CMS query.
- A QA marker QA_BOOKING_CREATED_NO_CITAS_PROJECTION records a native booking with status CONFIRMED, but zero matching CitasF2 rows and zero webhook event markers.
- The marker records the root cause as undetermined: event not observed or handler failed; published Velo commit and backend event logs were unavailable.
- Its payload contains only a partial booking/slot snapshot; it does not establish that all projection fields, including scheduleId, were available.

No CitasF2 row was fabricated or backfilled. No event-handler rewrite was made without proof of whether delivery failed, the deployed code differs, or the handler rejected an incomplete event. Required next evidence: deployed Velo SHA and Wix backend event logs, followed by controlled idempotent projection recovery in isolated QA.

### Other inspected collections

- ComplementosCatalogo (36 rows): selected required and process fields populated.
- MapaStaff (3 rows): selected staff/resource/schedule mapping fields populated.
- ControlOperativo (11 rows): empty fields are polymorphic. Current rows are DAYS_CACHE, RATE_LIMIT, ALERT, SYSTEM_FLAG and DEDUPE_KEY. No WEBHOOK_EVENT or SLOT_LOCK rows were found; their conditional requirements were not applicable.
- HistoricoCierresZ had no rows in the audited result; no close was generated.
- InventarioStockVenta and MovimientosInventario remain legacy/non-writer collections per the dossier; no attempt was made to fill or create legacy inventory records.
- Personal fiscal data fields were excluded from this aggregate scan.

## Files changed

- src/backend/internalConfig.js: canonical catalog entry enum.
- src/backend/data.js: catalog type normalization and full staff timeclock insert validation.
- src/backend/validation.js: simulation movement classification and timeclock HMAC validation.
- src/backend/cajas.web.js: excludes simulation records from fiscal receipt lookup.
- Tests: catalog hook, simulation classifier, fiscal aggregator, receipt filtering and timeclock CMS hook.

## Safety and limitations

- The initial CMS audit was read-only. The only subsequent production mutation was a conditional metadata patch to 93 ServiciosCatalogo rows, changing catalogEntryType to SERVICE. No reservations, payments, orders, refunds, invoices, cash, accounting or labor records were changed.
- No append-only ledger was repaired by overwrite or deletion.
- No published Wix runtime or browser E2E was run.
- The 93 catalog metadata cells were normalized to SERVICE and verified by a strong read-after-write. No other catalog fields were changed.
- The CitasF2 event-delivery issue remains open pending deployed Velo SHA and backend event logs.
- This branch is not deployed.

## Validation and change control

GitHub Actions for code head da38a03e3452a011f381777e5290219810c3cba7:

- Backend offline quality gates: 64 suites, 593 tests, 0 failures.
- Wix SDK Cart V2/Data, eCommerce Order Transactions and Bookings Reader V2 contracts: success.
- ESLint: success.
- Secret scanning / Gitleaks: success.

PR #306 is Draft, open, not merged and not deployed. CI validates the code head; the subsequent documentation-only commit does not change executable files.
