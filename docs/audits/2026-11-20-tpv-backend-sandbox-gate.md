# TPV QA fail-closed remediation — 2026-11-20

**Base:** `a801405f77dddfe8fcfe76a825be47e656aa542c`  
**Scope:** runtime safety gate only; no CMS writes, no deployment.

## Objective

Prevent TPV synthetic persistence from being invoked against the site's Live CMS dataset until a backend-verifiable Sandbox boundary exists.

## Verified findings

1. `TPV_QA_RUNTIME_POLICY.ENABLED` was `true` in canonical `src/backend/internalConfig.js`.
2. `assertTpvQaEnabled()` checked the static `ENVIRONMENT: "SANDBOX"` flag, but did not verify the runtime data plane or request environment.
3. `src/public/tpvPageController.js` checked `wixWindowFrontend.viewMode` before dispatching QA requests. That is a frontend gate, not a backend authorization boundary; the exported WebMethods independently enforce role permissions and call `assertTpvQaEnabled()`.
4. Wix Site Context reports the target site as an Editor site with Velo enabled and Draft status. The previous Management API CMS read observed one `CajaActual` record and no synthetic identities in the dataset accessible through that API. It did not establish Preview data-plane behavior.
5. The installed Wix documentation describes `wix preview` as creating a preview of build output and explicitly says it does not publish the project. That does not, by itself, prove that a WebMethod invocation has a backend-enforced Sandbox data-plane guarantee. See [Wix CLI preview](https://dev.wix.com/docs/wix-cli/cli-for-headless/command-reference/project-commands/preview).

## Implemented

- `TPV_QA_RUNTIME_POLICY.ENABLED=false` in canonical runtime configuration.
- `assertTpvQaEnabled()` now rejects before any QA repository operation with `TPV_QA_DISABLED_UNTIL_SANDBOX_ISOLATION`.
- The HTML bridge no longer advertises `environment=SANDBOX`; it reports `DISABLED` and rejects `CASHIER_STATE` and all `QA_*` messages.
- Offline test loader explicitly overrides the canonical disabled flag only in its in-memory test module source. This is test-only and does not modify production configuration.
- Contract tests assert the canonical production setting remains disabled and the widget controller remains fail-closed.
- Updated `docs/qa/QA-ENVIRONMENT-SSOT.md` to supersede the prior frontend-only assumption.

## Impact

All TPV QA WebMethods that call `assertTpvQaEnabled()` fail closed, including session open/read, synthetic sales, cash movements, payment simulation, refunds, X/Z close and audit/config/permissions. The catalog UI is not allowed to bootstrap because the widget receives a disabled environment context.

No changes to:
- `CajaActual`, `MovimientosCaja`, `ControlOperativo`, `HistoricoCierresZ`, identities or any other CMS collection.
- Wix roles or collection permissions.
- Real payments, Orders, Bookings, Gift Cards, fiscal/accounting/labor ledgers, email, hardware or external providers.
- Site publication or deployment state.

## Validation status

The source-level and offline tests are included in the PR and must pass CI. They do not prove Wix Runtime isolation. A successful CI run validates only the code and offline harness.

## Release decision

**NO-GO for TPV persistent QA and NO-GO for production release.**

Reactivation requires:
1. A Wix-supported, backend-verifiable environment/data-plane signal or a physically separate Sandbox site/tenant whose credentials and CMS collections cannot target Live.
2. Positive Preview test and negative Published/direct-WebMethod test.
3. Before/after LIVE collection snapshots proving no mutation.
4. Idempotent seed/bootstrap for synthetic identities and QA cash register in the proven isolated environment.
5. Complete TPV E2E and regression, plus rollback evidence.

No synthetic seed or cash bootstrap should be attempted against the current site until the first condition is satisfied.
