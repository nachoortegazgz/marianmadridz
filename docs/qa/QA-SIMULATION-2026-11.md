# QA simulation phase — evidence pack

- Date: 2026-11-05
- Repository: `nachoortegazgz/marianmadridz`
- Base: `main`
- Environment: offline mocks only; no Wix CMS writes, live bookings, payments, emails, SMS, inventory mutations or deployments.
- Timezone/currency: `Europe/Madrid` / `EUR`.

## Purpose

This pack makes the QA fixtures repeatable and traceable. The machine-readable source is [qa-simulation-scenarios.json](./qa-simulation-scenarios.json). Each scenario has a stable `scenarioId`, `traceId`, fixture data, expected assertions, test references and an explicit coverage status.

## Status meanings

| Status | Meaning |
|---|---|
| `MOCK_COVERED` | A named automated test exercises the stated contract with offline mocks. It is not proof of Wix runtime behavior. |
| `PARTIAL_MOCK_COVERAGE` | Only part of the end-to-end flow is exercised. |
| `CONTRACT_ONLY` | A source/contract assertion exists; the business flow is not fully simulated. |
| `MANUAL_QA_REQUIRED` | No automated scenario is currently evidenced; run only in an isolated QA setup with external sends/payments disabled. |

## Automated evidence map

| Process | Test suite | Current conclusion |
|---|---|---|
| Simple booking Writer V2 + CitasF2 + idempotent replay | `qa.simple-booking.writer.e2e.test.mjs` | Mock covered |
| Dual availability, exact exposure interval, same resource | `reservas.web.test.mjs` | Mock covered |
| Dual saga compensation | `booking.availability.saga.test.mjs` | Orchestrator primitive only; integrated F2 failure remains open |
| Cart V2 calculation and checkout URL guards | `booking.cart-v2.checkout.test.mjs` | Mock covered; no payment execution |
| Booking cancellation webhook and replay reconciliation | `events.booking-canceled.integrity.test.mjs` | Mock covered |
| Staff identity, authorization and signed timeclock | `site.flows.e2e.test.mjs` | Mock covered |
| Cash transaction, close Z and hash chain | `site.flows.e2e.test.mjs` | Mock covered with mock signer only |\n| Refund / service refund / reimbursement, negative accounting sign, cash projection replay and chain integrity | `site.flows.e2e.test.mjs` (`FLOW-CAJA-07`) | Mock covered for `REEMBOLSO`, `DEVOLUCION`, `DEVOLUCION_SERVICIO`; signer remains mock-only |
| Order total resolution | `orderLedgerAmount.test.mjs` | Mock/unit covered |
| Inventory sale/refund/idempotency/lock release | `inventory.movement.flow.test.mjs`, `inventory.lock.release.test.mjs` | Offline flow covered; Wix Stores reconciliation still needs integration validation |
| Wix Automations delivery, public forms/CRM, rescheduling, Gift Cards | No evidenced E2E suite | Manual/integration work remains |

The manifest test `qa.simulation-manifest.test.mjs` checks stable IDs, unique traces, existence of referenced tests, synthetic fixtures and explicit limitation labels. It is included in Layer 1 and the canonical `npm test` discovery.

## Run locally

```bash
npm run test
npm run test:layer1
npm run test:layer2
```

All suites use `src/backend/tests/loader.mjs`; they do not call Wix services. A green result proves only the behavior exercised by the mocks and assertions.

## Required remaining QA work

1. Add an integrated `processDualBooking` failure test: F1 created, F2 Writer V2 fails, native F1 cancellation attempted, both CitasF2 projections reconciled, locks released, idempotency state finalized; assert original error and compensation errors separately.
2. Add end-to-end reschedule semantics, including dual pair consistency and old-slot release.
3. Extend the inventory flow tests to Wix Stores order/refund event payloads and reconciliation queue replay; stock movement, idempotency, refund restock, negative-stock guard and lock release are now covered offline.
4. Add paid-order webhook and payment/refund state tests using mocked event payloads; never invoke a payment provider.
5. Inventory Wix Automations and test recipient/trigger/template configuration in isolated QA without sending to real customers.
6. Test form-to-CRM routing and marketing opt-in/withdrawal separately; use only reserved `.example.test` addresses.
7. Verify Gift Card issue/redeem/refund only if the feature is configured and the Wix test surface supports it.
8. Browser E2E: use an isolated QA site, sandbox/test payment method, test inbox and cleanup plan. This requires the user-operated Wix Preview; this workflow must not launch Preview or Publish.

## Safety and release gates

- Never create real bookings, charges, refunds, cash entries or inventory movements from these fixtures.
- Never send customer communications from automated tests.
- Do not use production credentials or a live checkout.
- Do not mark a manual/integration scenario as passed based on an offline mock.
- No Preview, Publish or deployment is performed by this branch.
