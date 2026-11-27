# AI-ENTRYPOINT — Marian Madrid

**Purpose:** punto único de entrada para asistentes IA, agentes de desarrollo y revisores técnicos.  
**Repository:** `nachoortegazgz/marianmadridz` · **Default branch:** `main`  
**Platform:** Wix Editor clásico + Velo · **Site ID:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Last documentary baseline inspected:** 2026-11-28 · **Last confirmed main HEAD at inspection:** `910ad3faa6e543c23e81b2902726d4d8cd43087f`  
**Site state:** Draft / no publicado (último read-back documentado 2026-11-27). **MVP:** NO-GO.  
**Status of this document:** ACTIVE. It is an index and operating guide, not a substitute for contracts or evidence.

## 1. Start here — mandatory reading order

1. [STATE-NOW](STATE-NOW.md) — current technical state, verified CI, outstanding work and dated Wix observations. Read first on every new task.
2. [PROJECT-CANON](PROJECT-CANON.md) — architecture, authority boundaries and non-negotiable invariants.
3. [TPV-UNIFIED-FLOW](TPV-UNIFIED-FLOW.md) — TPV transaction, payment, cash, accounting/fiscal boundaries and error contract.
4. [RELEASE-READINESS](RELEASE-READINESS.md) — release gates and evidence required for GO.
5. [ESQUEMA_CMS](ESQUEMA_CMS.md) — physical Wix CMS schema snapshot; its cutoff date is explicit and it is not a live query.
6. [docs/INDEX](INDEX.md) — specialist documents, audits, ADRs, QA contracts and archive map.

Read only the specialist material relevant to the task after these six documents. Do not ingest the entire archive by default.

## 2. Authority — resolve conflicts by domain

- **Business objectives, priorities, acceptance criteria and authorization:** the project owner's latest explicit instructions.
- **Wix API/SDK/Velo/Bookings/CMS/Payments contracts:** current official Wix documentation. Never infer an API contract from old code or an old dossier.
- **External integrations:** current official documentation of the provider concerned.
- **Architecture and project invariants:** [PROJECT-CANON](PROJECT-CANON.md), subject to later explicit owner decisions.
- **TPV-specific contracts:** [TPV-UNIFIED-FLOW](TPV-UNIFIED-FLOW.md).
- **Physical CMS schema:** [ESQUEMA_CMS](ESQUEMA_CMS.md), only for its recorded Wix read-back date.
- **Current state and evidence:** [STATE-NOW](STATE-NOW.md) and [RELEASE-READINESS](RELEASE-READINESS.md), each with its own date and scope.
- **Implementation:** current code on the inspected Git commit.
- **Behavior:** tests and runtime evidence actually executed for that commit/environment.
- **Historical dossiers, archived ADRs, handoffs and snapshots:** context only. They do not override current instructions, official contracts or newer evidence.

If two sources conflict, record the exact statements, dates, domains and evidence. Do not silently choose one or change code until the conflict is resolved.

## 3. Architecture — canonical layers

- **Capa 0 — transversal foundation:** configuration, security, validation, normalization, error contracts, data access, logging, shared utilities and persistence primitives.
- **Capa 1 — reservations:** Wix Bookings V2 is authoritative for native bookings, services, staff/resources, availability and booking state. Custom CMS data is correlation/projection/reconciliation only.
- **Capa 2 — operations and money:** TPV, checkout, payments, cash movements, closures, accounting, fiscal records and working-time records. Keep commercial intent, verified payment, physical cash movement and fiscal/accounting evidence distinct.
- **Capa 3 — observability/evidence:** audit, reconciliation visibility, evidence preparation and controlled export. It observes; it does not govern or rewrite Layers 1 or 2.

Wix Apps remain authoritative for their native domains. Wix CMS is the SSOT for custom project entities. Git is the SSOT for versioned code, not proof of what is installed in Wix. SharePoint is evidence/document custody, not a transaction authority.

## 4. Non-negotiable engineering rules

- Preserve and improve the existing system. Prefer the smallest root-cause correction; do not rebuild working modules for stylistic reasons.
- Frontend is presentation and interaction. Business logic, authorization, validation and persistence belong in backend/WebMethods.
- Authorization is enforced server-side. Never expose secrets or trust client-supplied identity, role, prices, taxes, totals or permissions.
- Canonical constants belong in `internalConfig.js`; shared validation/normalization belongs in `validation.js`.
- One domain code path across development, tests and production. Fixtures/adapters replace external effects, not business rules. No environment-specific business runtimes or generic global write blockers.
- `transactionId` is required for economic transaction writers where the contract requires transaction identity; validate it and protect against duplicate/replayed writes. Do not fabricate a substitute from sequence, trace or session IDs.
- Async handlers, webhooks, jobs and retries must be idempotent and recoverable. Treat uncertain persistence as uncertain; do not silently retry non-idempotent effects.
- Fiscal, accounting, labor and finalized cash-close records are append-only. Correct through new, traceable rectification records/events.
- No silent fallback that turns invalid input/provider failure into success, empty data or zero when that masks a fault.
- Do not delete records, purge evidence or remove code solely because it is old or large. Prove non-use by consumers, imports/exports, tests and contracts first.
- All records predating the official production deployment in 2027 are synthetic under the project rule. This does not authorize deletion, destructive reclassification or mutation of historical records.
- During tests: no real payments, refunds, fiscal submissions, notifications or external economic effects. Never reuse the existing open `CajaActual` singleton or historical ledgers as fixtures.

## 5. Evidence vocabulary — never overstate

Use these labels explicitly:

- **DOCUMENTED:** a document states it; not independently verified.
- **VERIFIED — STATIC:** inspected source/contracts on a named commit.
- **VERIFIED — CI:** named workflow/run and SHA passed.
- **VERIFIED — PREVIEW/RUNTIME:** the actual Wix Preview/Runtime flow ran and produced evidence.
- **VERIFIED — PRODUCTION:** behavior was checked on the published production site.
- **INFERRED:** reasoned from evidence but not directly tested.
- **PENDING / BLOCKED EXTERNALLY:** not yet demonstrated.

CI PASS is not Wix Runtime PASS. Runtime PASS is not production verification. A Wix Site Context read-back is not proof of Git-to-Wix code synchronization. Always report commit, environment, scope, test and result.

## 6. Current known baseline (read STATE-NOW before acting)

- Main HEAD observed on 2026-11-28: `25b55d406b365ab8b82c70f1eb0803a5bf1f5628` (PR #671 documentation merge).
- PR #670 hardening is integrated. Its offline CI reported 88 suites / 794 tests with zero failures. PR #675 is also integrated and supersedes that baseline with 89 suites / 804 tests PASS, SDK checks, ESLint, npm audit and Gitleaks PASS on its validated HEAD. See STATE-NOW for exact runs and SHAs.
- Capa 0 remains **EN EJECUCIÓN**. PR #675 resolved provider-error masking across Bookings Staff, CRM/Members, identity and DAL; `queryReferencedItems()` was removed after a zero-consumer audit. Remaining items: secret-provider error propagation (including fiscal-emitter consumer), confirming all staff resource IDs are service providers, money conversion contracts, currency-key duplication, global writer/idempotency matrix, dead-code audit and Runtime validation.
- Wix Local Editor/Preview E2E, Wix Runtime acceptance and production are not accredited by the cited offline CI.
- Last documented Wix read-back (2026-11-27): Draft, page TPV ID `yl5th` and route then observed as `/tpv` in STATE-NOW; CMS counts are historical, not live. Do not mutate CMS based on this snapshot.
- Never publish or activate real payments/external effects without the owner's explicit authorization.

## 7. How to work a task

1. Read STATE-NOW and the relevant specialist contract; check the current `main` SHA.
2. Inspect code, tests, imports/exports, consumers, workflows and open PRs/issues before proposing a change.
3. Check current official Wix/provider docs for every API/SDK behavior that matters.
4. Classify each finding as confirmed bug, contract mismatch, risk, duplication, historical note or unproven suspicion.
5. Make the smallest safe change on a feature branch. Avoid unrelated refactors.
6. Add/update tests that reproduce the defect and protect affected consumers.
7. Run the relevant tests and CI; report exactly what ran and on which SHA.
8. Update STATE-NOW only when state/evidence changed; update PROJECT-CANON only when a decision/invariant changed; update specialist contracts only when their contract changed.
9. Review the complete diff, links and references. Open a PR; do not merge if required CI is pending/failing.
10. Do not publish, make irreversible data changes or cause real economic/external effects without authorization.

## 8. Documentation maintenance rules

- [AI-INDEX](AI-INDEX.md) is the map of documentation and retrieval routes.
- [INDEX](INDEX.md) is the human-facing specialist index.
- [ARCHIVE-MANIFEST](ARCHIVE-MANIFEST.md) defines historical-document policy.
- Keep one canonical home for each fact: state in STATE-NOW, architecture in PROJECT-CANON, TPV contract in TPV-UNIFIED-FLOW, schema in ESQUEMA_CMS, release gates in RELEASE-READINESS.
- Do not copy entire CI reports, CMS snapshots or technical contracts into multiple summaries. Link to the evidence source.
- Archive superseded material with a clear historical warning and a link to the replacement. Do not physically delete audit evidence.
- Fix broken internal links and stale references when moving files. Do not mark an archive document as current merely because it remains indexed by code search.
- Keep dates, commit SHAs, workflow IDs and test counts attached to the exact evidence they describe.

## 9. External technical references

- [Wix API Reference](https://dev.wix.com/docs/api-reference)
- [Velo documentation](https://dev.wix.com/docs/velo)
- [Wix Git Integration / Local Editor](https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/about-the-local-editor)

Always open the current method-specific documentation before relying on a particular signature, permission, error code, paging limit or runtime behavior.
