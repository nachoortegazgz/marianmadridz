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
| Cart V2 calculation and checkout URL guards | `booking.cart-v2.checkout.test.mjs` | Mock covered; no payment execution |\n| Wix Payments paid-order event → WIX_PAYMENTS ledger → dual CitasF2 reconciliation → idempotent replay | `events.native-booking-sync.test.mjs` + `orderLedgerAmount.test.mjs` | Mock covered with official Velo event envelope; no provider transaction or live Wix webhook |
| Booking cancellation webhook and replay reconciliation | `events.booking-canceled.integrity.test.mjs` | Mock covered |
| Staff identity, authorization and signed timeclock | `site.flows.e2e.test.mjs` | Mock covered |
| Cash transaction, close Z and hash chain | `site.flows.e2e.test.mjs` | Mock covered with mock signer only |\n| Refund / service refund / reimbursement, negative accounting sign, cash projection replay and chain integrity | `site.flows.e2e.test.mjs` (`FLOW-CAJA-07`) | Mock covered for `REEMBOLSO`, `DEVOLUCION`, `DEVOLUCION_SERVICIO`; signer remains mock-only |\n| FACSIMIL series, chained digest, signature-shaped invalid placeholder and tamper detection | `fiscalFacsimile.test.mjs` | Isolated helper mock covered; no CMS writes, real signer, QR or AEAT path |
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
4. Payment webhook is now covered offline with an official Velo event-shaped fixture. Refund-state behavior and a real Wix Payments sandbox transaction remain pending; never invoke a live payment provider from automated CI.
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


## Update 2026-11-06 — auditoría de Capas 1 y 2

### Estado de CMS QA tras poda
Lectura consistente de Wix Data Collections API (40 colecciones totales; 15 `NATIVE`). Solo se han podado colecciones propias en QA; ninguna colección `WIX_APP` ni producción.

| Colección | Revisión | Campos retirados en la sesión |
|---|---:|---|
| `CitasF2` | 17 (lectura final) | `noShowReason`, `noShowAt`, `changeLog`, `cancellationReason`, `canceledAt`, `invoicingDate`, `fiscalData`, `sourceEventId` |
| `ComplementosCatalogo` | 3 | `traceId` |
| `ControlOperativo` | 9 | `nextRetryAt`, `retryAfter` |

Total: 11 campos eliminados físicamente y verificados ausentes en lecturas posteriores. Los borrados de campos eliminan también sus valores históricos.

### Contratos preservados
- `CitasF2.slotStart` y `slotEnd` permanecen `DATETIME`; hooks de colección enlazados al ID lógico y al ID físico QA.
- Se conservan privacidad/consentimiento, contacto, estado de reserva/pago, identidad de servicio y staff, `pairToken`, `revision`, `meta`, `catalogId`, `thirdPartyId` y `cashMovementId`.
- `ControlOperativo.expiresAt` y `attempts` son canónicos. Se mantienen `processedAt` (usado por la cola de conciliación de inventario), `heartbeatAt`, locks, rate limits, alertas y compensaciones.
- Se mantiene la relación nativa `ComplementosCatalogo.ServiciosCatalogo_name` ↔ `ServiciosCatalogo.name` (`MULTI_REFERENCE`).

### Suites incluidas en los gates
- Layer 1: 12 entradas de suites, con reservas simples/duales, disponibilidad, concurrencia, idempotencia, rate limiting, identidad/staff, Cart V2 y contratos frontend/backend.
- Layer 2: 12 entradas de suites, con caja, ledger fiscal, Cierre Z, devoluciones, conciliación de inventario, locks, hooks CMS, DTOs, cron parity y eventos.
- Runner canónico: `npm test` descubre suites `*.test.mjs` y `*.runner.mjs`; workflow `.github/workflows/booking-regression.yml` ejecuta `npm ci`, `npm test`, `test:layer1`, `test:layer2` y ESLint en push/PR a `main`.

### Límites que siguen abiertos
- Saga dual integrada: falta probar F1 creado + F2 Writer V2 fallido + cancelación nativa de F1 + reconciliación de ambas proyecciones + liberación de locks/idempotencia.
- Pago confirmado: cubierto offline con evento Wix Velo `metadata.id` + `data.order`, ledger WIX_PAYMENTS, actualización dual CitasF2 e idempotencia. No se ejecuta proveedor ni transacción real; falta validación integrada en sitio QA aislado.
- Reprogramación completa simple/dual y liberación del slot anterior: sin escenario integrado certificado.
- Wix Stores: la venta/devolución/idempotencia offline está cubierta; reconciliación real con Stores requiere integración QA.
- Wix Automations, formularios/CRM, marketing opt-in/baja y Gift Cards: no hay evidencia E2E automatizada.
- Firma X.509 real, QR y envío AEAT: fuera de los mocks FACSIMIL; no se certifica validez fiscal.
- Browser E2E/checkout: requiere ejecución manual del usuario en Preview QA con pagos de prueba e inbox aislado.

### Seguridad de la simulación
Todas las suites offline usan fixtures sintéticos y mocks. No se crean reservas, pagos, reembolsos, movimientos de caja/inventario, envíos externos ni despliegues. La evidencia de CI se consignará solo tras completar el workflow de la PR de esta auditoría.


### Evidencia CI — run #172 (2026-11-06)
- Run ID: `42149432291`; conclusión: `success`.
- `npm test`: 366/366 pruebas, 39 suites, 0 fallos.
- Layer 1: 207/207 pruebas, 12 suites, 0 fallos.
- Layer 2: 116/116 pruebas, 12 suites, 0 fallos.
- ESLint: success.
- [Workflow run #172](https://github.com/nachoortegazgz/marianmadridz/actions/runs/42149432291).
- Esto acredita suites offline con mocks, no navegador, checkout, proveedor de pagos, firma X.509 real ni envío AEAT.
\n\n### Update 2026-11-09 — simulación offline Wix Payments + reserva\n\n- Se añadió el escenario `QA-WIX-PAYMENTS-BOOKING-001` al manifiesto de QA.\n- El fixture reproduce la forma oficial de `OrderPaymentStatusUpdated` de Velo: `metadata.id`, `data.order` y `data.previousPaymentStatus`.\n- Se cubre pago `PAID` de 45,50 EUR, con total autoritativo en `priceSummary.totalPrice.amount` y un total alternativo de línea de 120,00 EUR para comprobar precedencia.\n- El escenario exige un único asiento append-only en `MovimientosCaja` con `paymentMethod=WIX_PAYMENTS`, `movementType=VENTA_ONLINE`, asociación de reserva, hash de integridad y marcador de webhook en `ControlOperativo`.\n- Para reserva dual, ambas filas de `CitasF2` pasan a pago `PAID`, sin alterar `bookingStatus=PENDING`. Se comprueba replay del mismo evento y un segundo evento para el mismo pedido sin duplicar el asiento.\n- **Límite:** toda la persistencia usa `wixDataMock`; no se cobra, no se llama a Wix Payments y no se escribe en el CMS del sitio. La prueba tampoco acredita el runtime del webhook ni la activación de la cuenta.\n