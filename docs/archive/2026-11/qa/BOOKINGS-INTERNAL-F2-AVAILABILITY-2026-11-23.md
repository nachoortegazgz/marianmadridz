# Internal F2 availability — 2026-11-23

## Finding

The online booking calendar returned no times for many dual services because the backend applied the public F1 booking policy to the hidden internal F2 phase.

Read-only Wix data inspection found:

- `ServiciosCatalogo`: 95 rows, including 24 dual services.
- All 24 F1/F2 pairs expose the same three native staff resource IDs.
- 20 of the 24 linked F2 services are hidden and have `onlineBooking.enabled=false`.
- Wix still returns their time slots and staff resources, but marks them `bookable=false` with `bookingPolicyViolations.bookOnlineDisabled=true`; `tooEarlyToBook` and `tooLateToBook` are false.
- The previous backend request required `bookable=true` and `bookOnlineDisabled=false` for both F1 and F2. This filtered every internal-only F2 slot.

## Live read-only reproduction

Service: **Coloración Raíces Perfectas**  
Date: **2026-11-24**  
Configured exposure gap: **30 minutes**

- F1 query under public booking policy: 127 slots.
- F2 query without the online-booking gate: 125 slots.
- F2 slots marked online-disabled: 125.
- Exact F1/F2 pairs with the same resource and exactly 30 minutes of exposure: 113.

Example: F1 09:00–09:30, F2 10:00–10:40, same native resource ID.

The resource mapping is not missing. The availability filter was rejecting valid internal F2 slots.

## Correction

- Customer-facing F1 retains `bookable=true` and `bookOnlineDisabled=false`.
- Internal F2 omits `bookable=true` and does not filter by `bookOnlineDisabled`.
- F2 is accepted only when Wix explicitly reports `bookable=false` solely because `bookOnlineDisabled=true`, with `tooEarlyToBook=false` and `tooLateToBook=false`.
- The same `resourceId`, exact exposure gap, same-day rule, and F1/F2 pair validation remain mandatory.
- Exact F2 revalidation and rescheduling use the same internal-phase policy.
- Diagnostics now report the F2 availability mode and counts of bookable versus online-disabled F2 slots.

## Safety and validation boundary

- No Wix CMS, Bookings services, staff assignments, bookings, payments, refunds, or ledgers were modified.
- No real booking was created.
- No Wix Editor or Published site was changed.
- Offline regression tests cover availability generation, staff revalidation, and exact F2 revalidation.
- A real Wix Preview/Runtime booking test is still required to prove the elevated Booking Writer accepts the hidden F2 service. Do not publish until that test and the existing P0 release gates pass.
