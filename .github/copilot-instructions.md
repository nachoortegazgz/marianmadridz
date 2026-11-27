# Copilot instructions

## Repository context

This is a Wix Editor Classic / Velo JavaScript repository for Marian Madrid, a salon in Zaragoza. It uses Wix CMS as the transactional source of truth and Wix SDK modules for Stores, Bookings, Payments, Members, CRM, and Data.

Before making operational or TPV changes, read:

- `docs/INDEX.md` for the canonical-document map.
- `docs/STATE-NOW.md` and `docs/RELEASE-READINESS.md` for the current release gates.
- `docs/PROJECT-CANON.md` for architecture and binding decisions.
- `docs/TPV-UNIFIED-FLOW.md` for the single TPV flow.
- `src/backend/tpv/README.md` and `src/backend/README.md` for backend contracts.

The last recorded Wix state is Draft and TPV release state is **NO-GO**. Do not enable or imply real payments, fiscal remittance, real inventory writes, accounting writes, or production TPV persistence. Offline CI does not prove Wix Preview or Runtime behavior.

## Build, lint, and test

Node 24.22.1 is the CI/runtime version. Install dependencies with `npm ci`; use `npm run dev` for the Wix development environment.

Common commands:

```bash
npm run dev
npm run lint
npm test
npm run test:layer1
npm run test:layer2
```

Run one backend suite with the repository loader:

```bash
node --no-warnings --loader ./src/backend/tests/loader.mjs ./src/backend/tests/<suite>.test.mjs
```

Example:

```bash
node --no-warnings --loader ./src/backend/tests/loader.mjs ./src/backend/tests/tpv.sale-preparation.core.test.mjs
```

SDK and site verification commands:

```bash
npm run verify:wix-ecom-cart-v2
npm run verify:wix-ecom-order-transactions
npm run verify:wix-tpv-native-sdk
```

The complete test runner discovers `src/backend/tests/*.test.mjs` and `*.runner.mjs`, while Layer 1 and Layer 2 are fixed gate lists. Keep new suites in `src/backend/tests/` and add them to the relevant runner or Layer gate when it is intentional. Add no script or test that bypasses `src/backend/tests/loader.mjs`.

CI also runs package/lock synchronization, a dependency audit, the SDK verifiers, and ESLint. It is not a substitute for Wix Preview/Runtime evidence.

## Architecture

- `src/backend/*.js` contains shared backend modules, CMS hooks, event handlers, and scheduled-job implementations.
- `src/backend/*.web.js` is the public Velo backend API surface. Use `webMethod(Permissions...)` for every exported web method and re-check authorization and resource ownership in backend code.
- `src/backend/booking/` contains booking primitives, sagas, and dual-reschedule reconciliation.
- `src/backend/tpv/` contains the TPV domain, sale preparation, repositories, and operational Web Modules. The TPV uses one backend flow and one canonical contract; a separate runtime or data-driven branch must not be introduced.
- `src/backend/tests/` contains offline TAP suites and Wix SDK mocks.
- `src/pages/` contains Wix page code. Filenames are Wix identifiers and must not be renamed.
- `src/public/` contains browser-side shared code and HTML Component bridges. Import public modules with `public/<name>` and backend modules with `backend/<name>`; relative imports do not provide these Velo alias behaviors.
- `src/backend/jobs.config` declares scheduled jobs whose implementations are in `src/backend/crons.js`.
- `tests/runtime/` contains the Preview/runtime harness. It does not call Wix APIs or perform cleanup itself.

Business rules belong in backend modules or CMS hooks, not in page/public code. The frontend must not authorize prices, taxes, totals, permissions, or writes; it presents backend results and handles protocol/orchestration.

## Key conventions

- Use Wix SDK APIs first. Do not replace native Wix Catalog, Bookings, Payments, or CMS behavior with parallel ledgers or duplicate implementations.
- `MovimientosCaja` is the canonical physical cash ledger. `TransaccionesTPV` stores commercial pending intents and is not a physical or fiscal ledger.
- Synthetic `TransaccionesTPV` intents may be updated or removed only while `sourceType=SYNTHETIC`, `status=PENDING_PAYMENT`, `orderId=null`, `requiresReconciliation=true`, and every payment remains unconfirmed. Real/paid records and physical, fiscal, accounting, labor, and closing ledgers remain protected by their own contracts.
- Wix CMS is the transactional SSOT. SharePoint is evidence storage, not a transactional authority.
- CMS hooks are server-side invariants. `beforeInsert` validates and normalizes records; `beforeUpdate` and `beforeRemove` enforce immutability and state-transition rules. Preserve fail-closed behavior.
- Use deterministic idempotency keys and fingerprint/payload conflict checks. A replay with identical payload should return the existing result; a conflicting payload must fail.
- Preserve compare-and-swap/concurrency locks, leases, recovery windows, and webhook claims. Event delivery is at-least-once, so all domain effects must remain retry-safe.
- Reconcile `resourceId` from domain/DTO/CMS against Bookings SDK `resource._id` and REST `resource.id`; do not silently swap these shapes.
- Monetary TPV calculations use integer cents or the repository's explicit decimal-string helpers. Do not let the browser supply authoritative prices, taxes, totals, or discounts.
- TPV line quantities are positive integers. Supported V1 payment methods are exactly `EFECTIVO` and `TARJETA`; Bizum, split tender, vouchers, and gift cards remain blocked until a separately tested contract exists.
- The TPV backend derives `recordNature` from `recordTimestamp UTC` versus `productionActivationAt UTC`: older than the cutoff is `SYNTHETIC`; equal or later is `REAL`. This is metadata, not a selector for a separate runtime or writer.
- Synthetic QA records may be managed only before the production cutoff. Cleanup must preserve append-only fiscal, accounting, cash, and audit ledgers.
- No new tests or implementation should assume catalog, tax, inventory, CMS, or payment state. Use the offline loader/mocks and fixtures unless a bounded Wix Preview/Runtime check is explicitly authorized.
- Preserve actionable error codes and A/B remediation behavior; do not convert a human or legal gate into a test bypass or feature flag.
- Do not update Wix prices, tax settings, inventory, automations, CMS fiscal configuration, real secrets, or external payment providers as part of code validation.
- When documentation changes, update `docs/STATE-NOW.md` and `docs/RELEASE-READINESS.md` for operational state, and `docs/PROJECT-CANON.md` or the specific TPV documents for architecture/contract decisions. Keep historical evidence in `docs/archive/`; do not silently replace it.
