# Wix Members + Cart V2 — published E2E runbook

**Date:** 2026-11-09  
**Site:** \`www.marianmadrid.es\`  
**Baseline:** \`main\` commit \`5fba1b3aaa17d6a758d4004372cd5ece112b98fb\` (PR #204 integrated; site published per owner confirmation).  
**Status:** Runbook prepared. No real reservation, payment, refund, or customer email was created during this session.

## Safety preconditions

1. Use a dedicated Wix test member and a test service/slot.
2. Use Wix Payments test mode or another explicitly non-charging test configuration. If only live payment is available, stop before checkout.
3. Confirm the test slot is isolated from customer availability and can be safely cancelled.
4. Do not use real customer records or contact details.
5. Record trace IDs and test booking IDs; do not paste secrets or payment credentials into the report.

## Test cases

| ID | Scenario | Expected result | Evidence |
|---|---|---|---|
| MM-E2E-01 | Open reservation flow as guest | Guest is redirected/blocked by Members authentication before a booking or cart is created | Browser trace; no new Bookings item |
| MM-E2E-02 | Login with dedicated test member | Wix session yields member ID and contact ID; backend derives identity from session | Browser/network trace; backend trace ID |
| MM-E2E-03 | Create a simple F1 reservation | Wix Bookings creates exactly one booking; no orphan cart if creation fails | Booking ID and CMS CitasF2 row |
| MM-E2E-04 | Create Cart V2 checkout | Cart has one Bookings catalog line for the F1 booking; \`customerInfo.memberId/contactId\` match session; \`openAccess !== true\` | Cart ID and sanitized cart response |
| MM-E2E-05 | Calculate cart | Calculated cart ID matches created cart; exactly one expected Bookings line remains; no violations; EUR total is valid | Calculation summary |
| MM-E2E-06 | Retrieve checkout URL | HTTPS URL returned only after ownership and calculation checks pass | Checkout URL domain only; do not log tokenized URL |
| MM-E2E-07 | Test payment success | Order webhook is idempotent; order line is matched to F1 booking; payment status updates without independently confirming Bookings | Order ID, event ID, CMS state |
| MM-E2E-08 | Native booking confirmation | \`BOOKING_CONFIRMED\` drives booking status; dual booking projects payment state to both rows through pair identity | Wix event ID, pairToken correlation, two CMS rows |
| MM-E2E-09 | Dual booking F1-gap-F2 | Exactly one checkout line/payment for F1; F2 is coordinated by pairToken and is not charged twice | F1/F2 booking IDs, cart line count |
| MM-E2E-10 | Reschedule native booking | Only affected CitasF2 phase/slot changes; sibling is flagged for reconciliation; duplicate event is idempotent | Event ID, revision, both CMS rows |
| MM-E2E-11 | Cancel test booking | Native cancellation event updates both linked rows consistently; no historical ledger row is overwritten | Event ID and resulting states |
| MM-E2E-12 | Payment failure/cancel checkout | Saga compensation is deterministic; no paid state is inferred; orphan cart is cleaned where applicable | Trace ID, ControlOperativo compensation |
| MM-E2E-13 | Order attribution | Final Order buyer/member attribution corresponds to authenticated test member | Sanitized Order buyerInfo member ID |

## Pass criteria

- All 13 cases pass.
- No booking or cart is created for an unauthenticated visitor.
- No checkout URL is returned for an open-access or foreign-owned cart.
- The cart contains exactly one expected F1 Bookings item.
- No double charge occurs for a dual booking.
- Payment webhook and native booking status remain separate authorities.
- Duplicate webhook delivery creates no duplicate CMS or ledger effects.
- No production customer, live payment, or real email is involved.

## Stop conditions

Stop immediately if:
- the environment cannot guarantee test-mode/no-charge behavior;
- the test slot is visible to customers or conflicts with a real appointment;
- cart ownership does not match the Wix session;
- an unexpected second cart line, duplicate booking, duplicate payment, or ledger write appears;
- a webhook result is ambiguous or a compensation remains unresolved.

## Current status

- Offline contract and mock tests: PASS in CI run 116 (431/431 tests; SDK contract checks and ESLint PASS).
- Site state: published, confirmed by Wix site context.
- Real Wix browser E2E: NOT RUN.
- Test member/service/slot and non-charging payment mode: must be provisioned/confirmed in Wix by the site owner before execution.
