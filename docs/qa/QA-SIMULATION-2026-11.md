> **Nota de vigencia — 2026-11-11:** este pack conserva evidencia histórica y escenarios offline. Para estado live, aislamiento de comunicaciones, datos sintéticos y gates de ejecución, prevalece [la referencia maestra QA](2026-11-11-qa-master-reference.md). Wix informa actualmente que el sitio está **Published**; no ejecutar E2E de negocio en él. Los resultados mock no demuestran runtime ni proveedor real.

---

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
| Wix Stores ORDER_CREATED + order reconciliation (Bookings/Stores/mixed) | `events.native-booking-sync.test.mjs`, `crons.jobsConfigParity.test.mjs` | Mock covered for idempotency markers and no custom stock writes; no product checkout or native stock decrement/refund |\n| Product checkout, PSP payment, stock decrement and refund/restock | No current automated suite | `MANUAL_QA_REQUIRED`; isolated Wix QA site and PSP sandbox required |
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
3. Implement and execute a dedicated isolated Wix Stores checkout/inventory/refund suite. Current `npm test` does not include the previously referenced `inventory.movement.flow.test.mjs` or `inventory.lock.release.test.mjs`; therefore sale/refund stock deltas, negative-stock guard and inventory lock release are NOT evidenced by the current CI run. The existing tests cover only ORDER_CREATED idempotency markers and the rule that Wix owns native stock.
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
## QA realista Wix Payments — cierre de simulación 2026-11-09

### Evidencia automatizada

- **PR de corrección de contrato y simulación:** [#198](https://github.com/nachoortegazgz/marianmadridz/pull/198), integrado en el commit `a85f35e4d2357ed400b8dcdacc695feb5c5c4e3c`.
- **CI offline:** [run #42541079403](https://github.com/nachoortegazgz/marianmadridz/actions/runs/42541079403), correcto.
  - Layer 1: 18 suites, 234 tests, 0 fallos.
  - Layer 2: 15 suites, 139 tests, 0 fallos.
  - Regresión completa: 45 suites, 402 tests, 0 fallos.
  - Contratos Wix eCommerce y Bookings Reader V2: correctos.
  - ESLint y self-tests de controladores Wix Preview/Publish: correctos.
- **Escenario de pago:** payload oficial Velo `OrderPaymentStatusUpdated`; pedido sintético de 45,50 EUR; una sola alta en `MovimientosCaja` con `paymentMethod=WIX_PAYMENTS`; dos filas de reserva dual actualizadas a `PAID`; `bookingStatus` sigue `PENDING`; marcador de evento en `ControlOperativo`; reintentos no duplican el asiento.

### Límite del entorno

- La conexión Wix devuelve un único sitio Marian Madrid, el sitio publicado asociado a `www.marianmadrid.es`. La búsqueda de sitios con nombre QA no devuelve ninguno. No hay evidencia de un sitio QA aislado con Wix Bookings y Wix Payments.
- Por protección de datos e integridad, el simulacro usa `wixDataMock`; no ha creado citas reales, órdenes, pagos, asientos ni documentos en el CMS productivo.
- Wix documenta que los backend events no funcionan en Preview. Por tanto, el Preview no sirve para validar este webhook ni el recorrido real de pago. Fuente: [Wix Velo — onOrderPaymentStatusUpdated](https://dev.wix.com/docs/velo/events-service-plugins/e-commerce/events/on-order-payment-status-updated).
- El workflow de publicación posterior a la integración [run #42541096013](https://github.com/nachoortegazgz/marianmadridz/actions/runs/42541096013) **falló de forma segura antes de publicar**: el CLI creó el Preview `https://wix.to/JwIx2SH`, mostró que el Editor contiene cambios de diseño más recientes y abortó la publicación. `wix.config.json` mantiene `uiVersion=15941`. El dominio productivo no se considera actualizado por este run.

### Estado final

- **Verificado:** el flujo backend de pago y persistencia simulado en memoria; idempotencia; actualización dual de CitasF2; ledger append-only; CI offline.
- **No verificado:** transacción real de Wix Payments, recepción del webhook por el runtime Wix publicado, escritura real en CMS/agenda de un entorno QA, conciliación de payouts/reembolsos y desglose fiscal de IVA del pedido.
- **Siguiente condición para E2E remoto:** disponer de un sitio Wix QA separado con Bookings y Wix Payments configurado en modo de prueba, y alinear/sincronizar primero la UI del Editor con el repositorio. No usar el sitio productivo para reservas o pagos sintéticos.

## Update 2026-11-11 — conciliación de reembolsos con eventos Velo estables

### Contrato implementado en rama
- Se conserva `wixEcom_onOrderPaymentStatusUpdated`, evento Velo estable que informa del pedido y del estado de pago anterior.
- Se añade `wixEcom_onOrderUpdated` como segundo disparador para pedidos cuyo estado de pago ya sea `PARTIALLY_REFUNDED` o `FULLY_REFUNDED`.
- Ambos flujos consultan `@wix/ecom.orderTransactions.listTransactionsForSingleOrder` con elevación y validan que la respuesta corresponda al mismo pedido.
- El procesador fiscal solo acepta refunds con todas sus transacciones en estado terminal (`SUCCEEDED` o `FAILED`). Si existe alguna transacción pendiente, iniciada, programada, desconocida o sin transacciones, la ejecución falla de forma cerrada y no marca el evento como procesado.
- Para un refund terminal, `summary.refunded.amount` debe coincidir exactamente con la suma de los importes de transacciones `SUCCEEDED`. Las transacciones `FAILED` no aportan importe. La discrepancia bloquea el writer.
- Se conserva la identidad `REFUND-{orderId}-{refundId}`, el límite acumulado bajo lock fiscal, el prorrateo de IVA y el residual en el último reembolso. Wix conserva la autoridad sobre el restock nativo.
- No se usa `wixEcom_onOrderTransactionsUpdated`: aunque está documentado en Velo, aparece como Developer Preview y su descripción no garantiza una notificación cuando cambia el estado de una transacción de refund ya creada.

### Cobertura añadida
- `refundTransactions.test.mjs`: seis pruebas unitarias de estados pendientes, fallidos, mixtos, discrepancia de resumen, identidad y cantidades inválidas.
- `events.native-booking-sync.test.mjs`: escenario integrado offline de venta original, refund pendiente, rechazo de moneda no canónica, refund terminal mixto (éxito + fallo), prorrateo de IVA, actualización de CitasF2, replay y concurrencia sin duplicidad.
- `events.backend-events.contract.test.mjs` y `events.order-id-validation.contract.test.mjs`: contratos de los dos eventos Velo estables y ausencia de writers de inventario custom.
- `npm run verify:wix-ecom-order-transactions`: gate CI para comprobar que el SDK instalado exporta el método utilizado.

### Límites abiertos
- **CI offline del HEAD de código 48b509f39d4e6f6b32c8bb4a23b59fcebc3886a0:** run 43034820298 SUCCESS, 56 suites / 543 tests / 0 fallos; SDK @wix/ecom orderTransactions, Bookings Reader V2 y ESLint correctos. Gitleaks full-history run 43034820526 SUCCESS. Las actualizaciones posteriores de esta auditoría son exclusivamente documentales; no cambian código ni pruebas.
- **Runtime Wix:** pendiente. Los backend events no funcionan en Preview; requiere prueba en un sitio publicado de QA aislado.
- **Entrega de eventos:** Wix documenta entrega asíncrona al menos una vez y posibles duplicados/desorden; se conserva idempotencia por eventId y por refundId. La documentación no detalla la política de reintentos ante errores del handler, por lo que el comportamiento de refund con varias transacciones debe verificarse en QA.
- **Sitio QA aislado:** no disponible; no probar el webhook sobre el sitio productivo.
- **Moneda:** el sitio Wix está configurado en EUR (propiedades del sitio verificadas) y `SDK_CONFIG.CURRENCY_CODE` centraliza ese valor. El procesador rechaza refunds si `order.currency` no coincide con EUR. El ledger histórico no conserva un código de moneda por movimiento; cualquier futura habilitación multi-moneda requiere ampliar el contrato del ledger y definir compatibilidad histórica.
- **Efectos externos:** no se han ejecutado pagos, devoluciones, restock, escrituras CMS, envíos ni despliegues.

### Fuentes oficiales consultadas
- [Velo — onOrderPaymentStatusUpdated](https://dev.wix.com/docs/velo/events-service-plugins/e-commerce/events/on-order-payment-status-updated).
- [Velo — onOrderUpdated](https://dev.wix.com/docs/velo/events-service-plugins/e-commerce/events/on-order-updated).
- [Wix eCommerce — List Transactions For Single Order](https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/order-transactions/list-transactions-for-single-order).
- [Wix eCommerce — Order payment status enum](https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/orders/get-order).
- [Wix — Backend events and event delivery](https://dev.wix.com/docs/overview/backend-services/events).

### Inventario de sitios y bloqueo de QA (verificación 2026-11-11)
- Wix devuelve dos sitios en la cuenta: Marian Madrid (producción) y ortega nacho cv web (personal).
- El sitio personal tiene Velo habilitado y plan Free, pero su conjunto de apps (Forms & Payments, Hotels, Invoices V1, Portfolio y Video) no replica el stack requerido de Marian Madrid (Bookings, Stores y Members). No es un entorno QA equivalente y no se modifica.
- Se ha localizado la API oficial Duplicate Site. Wix indica que no copia pedidos, contactos, facturas ni configuración de apps de terceros; la documentación no garantiza que todas las colecciones CMS personalizadas estén vacías. No se duplica producción para evitar copiar datos personales o ledgers a un entorno de pruebas.
- No se ha creado un nuevo sitio, asignado dominio, activado plan ni instalado apps. La validación runtime permanece bloqueada hasta disponer de un sitio QA vacío con las apps necesarias y sin datos productivos.
- Referencia: [Wix Duplicate Site API](https://dev.wix.com/docs/api-reference/account-level/sites/site-actions/duplicate-site).


## Update 2026-11-11 — aislamiento de notificaciones nativas Wix

La auditoría live de Wix Automations ya no es solo lectura. Tras autorización del propietario se confirmaron 67 cambios de estado (66 automatizaciones email y una WhatsApp) de activas a `INACTIVE`. Las cuatro automatizaciones WhatsApp están ahora inactivas. Nueve automatizaciones email siguen activas porque Wix devuelve restricciones `readonly` y/o `disableStatusChange`; por tanto, no se considera aislada toda la mensajería nativa.

No se ha enviado ningún email, WhatsApp ni SMS. El número sintético `666724634` permanece sin configurar. La acción nativa `whatsapp-send-message` carece de receta pública soportada para reconfigurar destinatario por API, por lo que se mantiene pausada y no se sustituye por otro canal.

El guard de allowlist `emailRecipientPolicy.js` solo protege el despacho Resend del backend; no controla Wix Automations nativas. No ejecutar pruebas de envío hasta resolver los nueve flujos activos y verificar sus destinatarios. Evidencia detallada: [auditoría de aislamiento de notificaciones](../audits/2026-11-11-wix-automation-recipient-isolation.md).


## Update 2026-11-11 — PR #286 integrada

La PR #286 se fusionó en `main` por squash el 2026-11-11 15:00:16 UTC, commit `0d8f6efc581bc6a3d892702ba1c32af73e829888`. La CI offline del HEAD previo al merge pasó 57 suites / 548 tests / 0 fallos y Gitleaks SUCCESS. El merge no ejecuta Wix Runtime ni publica el código.

Siguen pendientes las pruebas E2E aisladas de pagos/reembolsos. No se han creado órdenes, cobros, reembolsos, registros CMS ni comunicaciones reales. Los writers fiscales/contables siguen fail-closed. La mensajería nativa se mantiene parcialmente aislada: 67 automatizaciones pausadas, nueve flujos email aún activos por restricciones Wix; las cuatro WhatsApp están inactivas.


## Reauditoría live read-only y cobertura offline — 2026-11-13

**Baseline de repositorio:** `main` = `7bca12931ce8a5c22e15427ba13edfdf2ee9b664`.
**Entorno:** sitio Published `188bed94-177c-4bc9-a9f0-35080d874f3e`, no aislado para QA. Todas las consultas siguientes fueron de solo lectura. No se crearon reservas, pedidos, pagos, reembolsos, movimientos, notificaciones ni contactos.

### A. Reservas nativas y proyección

- Bookings Reader V2: 346 reservas leídas en 4 páginas; 73 CONFIRMED, 255 CANCELED, 18 CREATED; 0 IDs duplicados.
- De las 73 CONFIRMED: 22 paymentStatus UNDEFINED, 49 NOT_PAID, 1 EXEMPT y 1 PAID.
- Contraste con el writer actual `reconcileConfirmedNativeBookingProjectionInternal`: 55 reservas tienen serviceId, resourceId, scheduleId, startDate y endDate completos y estado financiero que permite proyección; 17 no tienen resourceId; 1 PAID queda excluida y exige conciliación de ledger.
- CMS `CitasF2`: 0 filas. No se ejecutó el cron ni se insertaron las 55 proyecciones.
- `MapaStaff`: 3 mapeos activos; los 56 resourceId presentes en reservas confirmadas coinciden con mapeos activos. Los 17 casos sin resource no se completan por inferencia.

### B. Pedidos eCommerce y ventas

- Wix eCommerce Search Orders: 31 pedidos, 0 IDs duplicados; 29 APPROVED y 2 CANCELED; 4 PAID y 27 NOT_PAID.
- Los 4 pedidos PAID suman 264,36 EUR según el total autoritativo del pedido. No se ha creado ningún movimiento fiscal a partir de esta lectura.
- 32 líneas referencian el catálogo Wix Bookings, 2 el catálogo Wix Stores y 1 línea (`EXTRA`, pedido 10018) carece de `catalogReference.appId` y `catalogItemId`. No se inventa una referencia de catálogo.
- El pedido 10018 mezcla una línea Stores, una Bookings y una línea EXTRA sin referencia. Debe quedar en revisión; no se fuerza su clasificación como venta exclusiva de producto o servicio.
- `MovimientosCaja`: 0 filas en dos lecturas independientes (con y sin `consistentRead`). Esto no concuerda con el checkpoint documental anterior, que registraba 10 filas; la discrepancia de origen/entorno queda ABIERTA. No se declara ausencia fiscal definitiva ni se crean movimientos.
- `ControlOperativo`: 0 filas en la lectura repetida actual; también difiere del checkpoint anterior de 11 filas. No hay evidencia CMS de marcadores `WEBHOOK_EVENT` ni de ejecución del reconciliador.
- El writer fiscal y de simulación sigue protegido por `FISCAL_RUNTIME_POLICY` (`LEDGER_WRITES_ENABLED=false`, `ACCOUNTING_LEDGER_WRITES_ENABLED=false`, `ALLOW_SIMULATION_RECORDS=false`). No se puede usar el sitio Published para generar ventas de prueba.

### C. Tienda online e inventario nativo

- Wix Stores Catalog V3: 24 productos visibles.
- Inventario V3: 30 registros; todos los valores `quantity` devueltos son numéricos; no se detectan productos sin registro de inventario ni referencias huérfanas a producto.
- La colección propia `InventarioStockVenta` contiene 1 fila QA sintética con todos los campos operativos presentes; `stockAvailable=8` coincide con `stockOnHand=10 - stockReserved=2`. El SKU QA no corresponde a un producto vendible Wix y no se añade un `productId` inventado.
- `MovimientosInventario` contiene 1 movimiento QA append-only: quantity=2, quantityDelta=-2, stockBefore=12, stockAfter=10, token y traceId presentes. Se conserva sin modificación.

### D. Catálogo y datos horarios

- `ServiciosCatalogo`: 95 filas: 94 SERVICE y 1 PRICING_PLAN. Una fila SERVICE (Rayos V) no tiene SKU; el validador vigente no exige SKU para SERVICE, por lo que no se clasifica como error de contrato ni se genera un SKU arbitrario.
- `ComplementosCatalogo`: 36 filas; todos tienen addonId y SKU.
- `RegistrosHorariosStaff`: 2 filas de QA (ENTRADA/SALIDA) con resourceId, memberId, clockEventType, recordType, recordedAt, dayKey, monthKey y traceId presentes. Ambas carecen de `signature`; el validador `assertRegistrosHorariosStaff` exige HMAC de 64 caracteres hexadecimales. Son registros horarios append-only: no se actualizan ni eliminan ni se fabrica una firma retrospectiva. Requieren rectificación trazable mediante el flujo autorizado de fichaje/firma, no edición directa.
- `CajaActual`: singleton único en estado `SIMULACION`, traceId QA y contadores cero. Se conserva en estado fail-closed; no se convierte a ABIERTA/CERRADA ni se modifica para habilitar operaciones.

### E. Pruebas sintéticas ejecutables y límites

El repositorio ya contiene suites offline con mocks para:
- Reserva simple Writer V2 + CitasF2 + replay idempotente (`qa.simple-booking.writer.offline.test.mjs`).
- Eventos nativos de Bookings, creación/confirmación, duplicados, carreras insertOnly, pagos y reembolsos (`events.native-booking-sync.test.mjs`).
- Cálculo de importes y datos fiscales de pedidos (`orderLedgerAmount.test.mjs`).
- Inventario, venta, devolución, idempotencia y locks (suites inventory registradas en el manifiesto QA).
- Manifiesto de escenarios sintéticos y referencias a tests (`qa.simulation-manifest.test.mjs`).

**No se ejecuta E2E de negocio en el sitio Published.** La referencia maestra QA del 2026-11-11 confirma que no existe un sitio QA independiente equivalente y que siguen activas automatizaciones email con destinatarios dinámicos. Wix Preview tampoco valida backend events. Los mocks no demuestran runtime, proveedor de pagos, webhook ni notificaciones.

**Validación CI de esta actualización:** completada en el PR #319, commit `cc667ecda57a52594fb79a8747e304041800952e`. `npm test`: 66 suites, 607 tests aprobados, 0 fallos; contratos Wix eCommerce Cart V2, Order Transactions y Bookings Reader V2: SUCCESS; ESLint: SUCCESS; Gitleaks full-history: SUCCESS, sin secretos detectados. Workflow run #822 y secret scan #246.

### F. Acciones bloqueadas por integridad

1. No rellenar automáticamente los 17 resourceId ausentes; falta dato fuente de staff.
2. No registrar los 4 pedidos PAID en ledger desde una simulación; se requiere reconciliación fiscal real y payload autoritativo.
3. No inventar catalogReference para la línea EXTRA del pedido 10018.
4. No reparar firma horaria ausente editando el registro append-only; solo rectificación firmada autorizada.
5. No borrar ni reescribir filas QA de MovimientosInventario o RegistrosHorariosStaff.
6. No sincronizar CMS Sandbox con Live ni disparar Automations en el sitio Published.

**Estado final:** auditoría de lectura ejecutada; pruebas offline existentes identificadas; ejecución CI de esta revisión pendiente; pruebas runtime de reservas/pagos/tienda bloqueadas hasta disponer de un sitio QA aislado y sandbox de pago acreditado.


### G. Corrección de tipo CMS ejecutada — 2026-11-13 16:15 UTC

Se corrigió únicamente `CajaActual.openedAt` mediante Wix Data Patch API con condición CAS sobre `singletonKey=CAJA_PRINCIPAL`, `cashRegisterStatus=SIMULACION` y el valor ISO original exacto. Se persistió como `{"$date":"2026-11-11T05:10:31.144Z"}`, acorde al campo CMS `DATETIME`.

Verificación posterior con `consistentRead=true`:
- `openedAt` es objeto `$date`.
- `cashRegisterStatus=SIMULACION`, `isOpen=true`, `openingAmount=300`, `cashAmount=0`, `salesAmount=0`, `salesCount=0`, `currentSequence=0` y contadores siguen intactos.
- No se tocaron movimientos ni ledgers.

**No corregidos por inmutabilidad:** los dos `RegistrosHorariosStaff.recordedAt` y el `MovimientosInventario.recordTimestamp` siguen serializados como cadenas ISO pese a que el esquema declara DATETIME. Los fichajes además carecen de HMAC de 64 hex; la validación backend los rechaza y la colección es append-only. No se sobrescriben ni se fabrican firmas retrospectivas. Requieren rectificación firmada autorizada.


## 2026-11-13 — cobertura específica de tienda online y reservas PSP

La revisión de los archivos realmente incluidos en `src/backend/tests/run-all.mjs` detectó que las referencias históricas a `inventory.movement.flow.test.mjs` y `inventory.lock.release.test.mjs` no corresponden a archivos presentes en la rama `main` ni a suites ejecutadas por CI. Se corrige la matriz para no atribuir cobertura inexistente.

- **Mock cubierto:** evento `ORDER_CREATED` idempotente y reconciliación de pedidos con catálogos Bookings, Stores y mixtos; referencias incompletas van a revisión; Wix conserva la autoridad de inventario; no se escriben movimientos de stock propios.
- **Pendiente manual:** compra real de producto físico, decremento nativo de inventario, cancelación/refund y reposición.
- **Pendiente manual:** reserva online con checkout Cart V2 y resultados PSP de sandbox en runtime Wix.
- Los dos escenarios manuales quedan explícitamente en `qa-simulation-scenarios.json`, sin fingir que los mocks ejecutan checkout o PSP.


## 2026-11-13 — conciliación del balanceo de profesionales y rutas dinámicas

### Balanceo diario y reservas sin recurso

La revisión del contrato de Bookings Reader V2 se amplió para comprobar tanto el recurso nativo del slot como la identidad explícita `staffMemberId` que consume el reconciliador de eventos.

Resultado de lectura live, solo lectura, de las 17 reservas CONFIRMED inicialmente observadas sin recurso:

- 17/17 tienen `resourceId` ausente.
- 17/17 tienen `staffMemberId` ausente.
- 17/17 presentan `resourceSelections.selectionMethod=NO_SELECTION`.
- 0/17 pueden resolverse mediante los tres mapeos activos de `MapaStaff`.
- No se asigna ningún profesional por nombre, horario, servicio, recurso predeterminado ni por el balanceo actual.

**Interpretación corregida:** `NO_SELECTION` describe el método de selección de recurso; no demuestra que el cliente haya solicitado una reserva sin profesional. La ausencia simultánea de `slot.resource` y `staffMemberId` sí impide reconstruir una asignación individual fiable. Estos 17 casos deben permanecer en revisión, sin backfill inferido.

El backend ya aplica ese principio:
- `src/backend/reservas.web.js`: el ranking se calcula únicamente sobre recursos disponibles para el slot; carga diaria = minutos reservados.
- `src/backend/events.js`: `_syncNativeBookingToCitas` prioriza el recurso del slot y solo utiliza `MapaStaff` cuando existe un `staffMemberId` explícito.
- `reconcileConfirmedNativeBookingProjectionInternal` exige reserva CONFIRMED y excluye estados financieros que requieren conciliación de ledger.
- `src/backend/tests/crons.booking-projection-reconciliation.test.mjs` ya verifica que una reserva sin recurso no se proyecta.
- Se añade `RES-BAL-06`: una reserva nativa sin recurso ni identidad explícita no se atribuye retrospectivamente a ninguno de los profesionales ni sesga el ranking.

### Rutas dinámicas de servicios

Se implementa un fallback controlado para las rutas de página dinámica Wix que añaden sufijo numérico de colisión (`slug-1`, `slug-2`, etc.) cuando el CMS conserva el slug canónico sin sufijo.

Reglas:
1. La búsqueda exacta de slug/título mantiene prioridad.
2. El fallback elimina únicamente un sufijo numérico terminal y busca exclusivamente por el slug canónico.
3. Solo se acepta una coincidencia única.
4. Si hay más de una coincidencia, devuelve `SERVICE_LOOKUP_AMBIGUOUS`.
5. No modifica el CMS ni reescribe URLs.

Pruebas añadidas: `RES-LOOK-01G` (resolución única) y `RES-LOOK-01H` (ambigüedad fail-closed).

**Límite:** la corrección del resolver y sus pruebas offline no sustituyen una comprobación visual de la ruta en Wix Runtime. No se ha publicado código ni cambiado el Editor.


## 2026-11-13 — puerta de cierre de capas 1 y 2 (segundo corte live)

### Alcance y evidencia live de solo lectura

Consulta paginada completa de Bookings Reader V2:

- 346 reservas: 73 `CONFIRMED`, 255 `CANCELED`, 18 `CREATED`.
- 73/73 reservas confirmadas mantienen correspondencia exacta por `slot.eventId` con Calendar V3 (auditoría previa del mismo corte).
- 17/73 confirmadas no exponen `slot.resource` ni `staffMemberId`; todas muestran `resourceSelections.selectionMethod=NO_SELECTION`.
- Las 17 reservas sin identidad de profesional fueron creadas entre agosto y octubre de 2026. No se puede deducir una asignación individual ni convertir el algoritmo actual de balanceo en una fuente histórica.
- `CitasF2`: 0 filas. `ControlOperativo`: 0 filas en la lectura fuerte actual.

Consulta eCommerce:

- 31 pedidos, 4 con `paymentStatus=PAID`; las cuatro transacciones asociadas figuran `APPROVED`.
- Los métodos que devuelve Wix son `Cash` en tres transacciones y `Other Payment Method` en una. No se deben reinterpretar como pagos online con tarjeta sin documentación adicional.
- Tres líneas de pedido referencian reservas: una reserva está `CONFIRMED/PAID` y dos `CANCELED/PAID`.
- Un pedido mixto contiene además una línea `EXTRA` sin `catalogReference.appId` ni `catalogItemId`. Se mantiene en revisión.
- `MovimientosCaja`: 0 filas. `LibroAsientosContablesDetalle`: 0 filas en la última consulta live documentada; repetir la lectura antes de cualquier reconciliación.
- No se ha inferido que las dos reservas canceladas requieran devolución. Se necesita revisar transacción, motivo, política y eventual reembolso antes de cualquier asiento rectificativo.

Estado de caja y políticas:

- `CajaActual` conserva el sentinel `SIMULACION`; no convertirlo en caja operativa.
- `FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED=false`.
- `FISCAL_RUNTIME_POLICY.ACCOUNTING_LEDGER_WRITES_ENABLED=false`.
- `STAFF_CLOCKING_CONFIG.WRITES_ENABLED=false`.
- Estas políticas son fail-closed y deben permanecer así hasta la certificación fiscal/contable y la validación runtime.

### Aislamiento del sitio QA

Consulta actual de Automations V2 en el sitio QA:

- 119 automatizaciones: 106 INACTIVE y 13 ACTIVE.
- Las 13 activas son preinstaladas y tienen `settings.readonly=true` o `settings.disableStatusChange=true`.
- Algunas pertenecen a notificaciones de Bookings, tarjetas guardadas/cargadas, formularios, gift cards y servicios de plataforma.
- No se sortea el bloqueo ni se ejecuta `Test Automation`, porque puede disparar acciones reales.
- El sitio QA sigue parcialmente aislado y no es apto para pruebas E2E que puedan generar comunicaciones o efectos externos.

### Cambios de calidad de CI

Se añaden gates explícitos `npm run test:layer1` y `npm run test:layer2` antes del runner completo `npm test`.

Cobertura focal añadida a los runners:
- Capa 1: reconciliación de proyecciones de reservas nativas.
- Capa 2: sincronización de pago/reserva eCommerce, validación de identidad de pedido y política fail-closed de writers operativos.

La suite completa sigue siendo el gate canónico. La CI de esta rama debe confirmar los nuevos gates antes de integrar.

### Decisión de cierre

**Capa 1: NO CERRADA.** El contrato offline y el algoritmo de balanceo están cubiertos, pero `CitasF2` y `ControlOperativo` están vacíos en la lectura live, no hay evidencia de ejecución de reconciliación y no se ha validado el flujo de reserva publicado en Wix Runtime. Las 17 reservas históricas sin identidad permanecen en revisión.

**Capa 2: NO CERRADA.** Los writers fiscales, contables y de fichaje están deshabilitados por política; la caja continúa en SIMULACION; existen cuatro pedidos PAID con transacciones APPROVED sin proyección de ledger visible; la asignación contable automática carece de aprobación PGC; y no se han probado runtime ni conciliaciones con datos reales.

No se han escrito datos en producción, creado transacciones, alterado ledgers, ejecutado crons, activado automatizaciones ni publicado cambios.


### Corrección del runner de capa 2 detectada por CI

La primera ejecución de PR #322 detectó una referencia obsoleta en `run-layer2.mjs`: `inventario.writer.offline.test.mjs` no existe en el árbol del repositorio. Se elimina esa referencia; no se crea un test ficticio ni se rebautiza otro archivo. La cobertura de flujos de inventario existente permanece en `site.flows.offline.test.mjs`, `inventario.web.js` y las suites generales del runner canónico.

Resultado de esa primera ejecución:
- Layer 1: 22 suites, 287 PASS, 0 FAIL.
- Layer 2: 17 suites válidas, 239 PASS, 0 FAIL; el gate falló por el archivo inexistente (0 tests en esa entrada).
- SDK Cart V2, Order Transactions, Bookings Reader V2 y ESLint: PASS.
- La regresión completa `npm test` quedó omitida por el fallo previo del gate Layer 2.

La corrección queda pendiente de una nueva ejecución de CI antes de integrar.


### Resultado definitivo de CI tras corregir el runner (PR #322)

PR #322 quedó integrada en `main` con commit `24f3ce7ce5cce2c48f19e36f241cbc502869afd1`.

Ejecución final en el head de integración:
- Layer 1: 22 suites, 287 PASS, 0 FAIL.
- Layer 2: 17 suites, 239 PASS, 0 FAIL.
- Regresión completa: 66 suites, 610 PASS, 0 FAIL.
- Wix eCommerce Cart V2 SDK contract: PASS.
- Wix eCommerce Order Transactions SDK contract: PASS.
- Wix Bookings Reader V2 SDK contract: PASS.
- ESLint: PASS.
- Gitleaks full-history: PASS.

Este resultado valida los contratos y regresiones offline. No acredita ejecución de Wix Runtime, entrega de webhooks, ejecución de crons, checkout/PSP sandbox, fichajes reales ni certificación fiscal/contable. La decisión de cierre de capas 1 y 2 permanece **NO CERRADA** por los bloqueos live descritos arriba.


## 2026-11-13 — RES-BAL-07: conservar carga de proyección con recurso nativo omitido

La revisión estática de `_getBookedMinutesByResourceForDay` detectó que la deduplicación restaba siempre la proyección `CitasF2` al encontrar el mismo `bookingId` en Bookings Reader, incluso cuando el snapshot nativo no contenía `slot.resource._id`. En ese caso no se añadía carga nativa y se perdían minutos de un recurso conocido en la proyección de la saga.

Corrección mínima:
- Bookings sigue prevaleciendo cuando devuelve un recurso nativo, reemplazando recurso y duración de la proyección.
- Si el estado nativo es contable pero omite el recurso, se conserva la proyección existente y no se atribuye carga a ningún otro profesional.
- Reservas canceladas/no contables y reembolsadas siguen retirando su proyección del cálculo.

Regresión añadida: `RES-BAL-07` en `src/backend/tests/reservas.web.test.mjs`. Fixture sintética: proyección de 60 minutos para A, snapshot nativo sin recurso y reserva nativa independiente de 30 minutos para B; el resultado esperado asigna el siguiente slot a B. La prueba no modifica datos Wix ni altera asignaciones históricas.

Validación CI ejecutada sobre el código corregido (commit `50b27e3d5cb8ed91bdbe1bde1d9ed0ad91447a17`): Layer 1 22 suites / 288 PASS / 0 FAIL; Layer 2 17 suites / 239 PASS / 0 FAIL; regresión completa 66 suites / 611 PASS / 0 FAIL; contratos SDK Wix Bookings Reader V2, eCommerce Cart V2 y Order Transactions PASS; ESLint PASS; Gitleaks full-history PASS. Runs: [Backend offline quality gates](https://github.com/nachoortegazgz/marianmadridz/actions/runs/43473842712) · [Secret scanning](https://github.com/nachoortegazgz/marianmadridz/actions/runs/43473842768).

Esta validación es offline/mock y no acredita por sí sola el comportamiento en Wix Runtime.


## 2026-11-13 — conciliación ampliada de Layer 2 (producción, solo lectura)

### Alcance y fuentes consultadas

Corte de producción del sitio `188bed94-177c-4bc9-a9f0-35080d874f3e`. Lecturas paginadas de:
- eCommerce Search Orders (31 pedidos).
- Order Transactions List for Multiple Orders (pagos y reembolsos).
- Bookings Reader V2 con `withEcomOrder`, `withEcomTransactions`, `withBookingFeeDetails` y `withBookingPolicySettings`.
- Order Invoices List for Multiple Orders.
- Wix Data CMS con `consistentRead: true` para las colecciones nativas de Layer 2 y sus controles.

No se realizaron escrituras CMS, cobros, devoluciones, cambios de reservas, cambios de stock ni ejecuciones de cron.

### 1. Pedidos y transacciones

31 pedidos:
- 4 `APPROVED/PAID`.
- 25 `APPROVED/NOT_PAID`.
- 2 `CANCELED/NOT_PAID`.

Los cuatro pedidos pagados cuadran exactamente con cuatro transacciones `APPROVED`:

| Pedido | Total EUR | Método devuelto por Wix | Booking | Estado booking |
| --- | ---: | --- | --- | --- |
| #10031 | 27,71 | Cash | No | — |
| #10030 | 18,15 | Cash | Sí | CONFIRMED/PAID |
| #10018 | 204,50 | Cash | Sí | CANCELED/PAID |
| #10017 | 14,00 | Other Payment Method | Sí | CANCELED/PAID |
| **Total** | **264,36** | | | |

Suma de transacciones aprobadas: **264,36 EUR**, igual al total de los cuatro pedidos. No se devolvió ninguna transacción en la respuesta de Order Transactions (`refunds=[]` para los cuatro pedidos).

Precaución de clasificación: los métodos se devuelven como `Cash` (250,36 EUR) y `Other Payment Method` (14,00 EUR), pero las cuatro transacciones indican `offlinePayment=false`. No se clasifican automáticamente como efectivo físico ni como ingreso bancario conciliado. Se necesita el justificante/medio real de cobro externo.

Anomalía adicional no incluida en los cuatro pedidos pagados: el pedido #10001 está `NOT_PAID` y tiene una transacción de tarjeta `APPROVED` por **0,00 EUR**, con tarjeta guardada. No se cuenta como venta ni como cobro de importe positivo.

### 2. Reservas pagadas y canceladas

Bookings Reader V2 devuelve **16 reservas PAID**:
- 15 `CANCELED/PAID`.
- 1 `CONFIRMED/PAID`.

Cruce inequívoco por `extendedBooking.order.id`:
- #10030 → booking `359e606d-bdd7-453d-bd5c-b62ba8eb94a2`: CONFIRMED/PAID.
- #10017 → booking `aa57457e-84d1-44fd-8893-7a60eb40833e`: CANCELED/PAID.
- #10018 → booking `d8a28bac-5976-4a0c-87ba-9287b788b0d7`: CANCELED/PAID.

Las otras **13 reservas CANCELED/PAID no tienen `order.id` eCommerce asociado** en Bookings Reader V2. No se puede atribuir su cobro a un pedido o transacción concreta con la evidencia disponible.

Las 13 comparten `appId` de Wix Bookings, `createdByAppId=151e476a-715e-ec33-db9a-a7ff4d51f70a`, `selectedPaymentOption=UNDEFINED` y no devuelven objeto de pedido ni transacciones eCommerce. Fueron creadas entre el 31 de mayo y el 1 de junio de 2026. Ese `createdByAppId` no aparece entre las nueve aplicaciones actualmente instaladas en el contexto del sitio. El origen técnico y el medio de pago siguen sin identificar; este patrón no demuestra que sean datos sintéticos ni que se cobraran en efectivo.

Para las dos reservas canceladas vinculadas a #10017 y #10018:
- `cancellationFeeEnabled=false` en el snapshot de política.
- Sin `bookingFeeDetails` aplicado ni `additionalFees`.
- Sin reembolso en las transacciones de los pedidos.

No se deduce automáticamente el derecho ni la obligación de devolución a partir de estos campos; queda pendiente validar términos aceptados, momento de cancelación y evidencia de prestación/no prestación. Para las otras 13 reservas no se devolvió snapshot de política ni asociación eCommerce.

### 3. Referencias de factura

Order Invoices devuelve asociación para #10017 y #10018, con `appId=1380b703-ce81-ff05-f115-39571d94dfcd`. No devuelve asociación para #10030 ni #10031.

El `appId` asociado no coincide con el ID canónico de Wix Invoices V1 documentado en el dossier (`13ee94c1-b635-8505-3391-97919052c16f`). No se identifica ni se etiqueta esa referencia como factura fiscal válida sin verificar la aplicación emisora y el documento real. La API consultada solo acredita el vínculo de referencia orden-factura.

### 4. Incidencias fiscales de catálogo

**Pedido #10017 — tipo de IVA del 10 % en “CORTE MINI (HASTA 12 AÑOS)”.**
Wix devuelve base 12,73 EUR, cuota 1,27 EUR y total 14,00 EUR (10 %). La AEAT publica para 2026 un tipo del **21 % para servicios de peluquería**. El concepto es un servicio de corte; se clasifica como incidencia fiscal prioritaria para revisión del gestor. No se recalcula ni rectifica automáticamente el pedido histórico. Fuente: [AEAT — Tipos impositivos IVA 2026](https://sede.agenciatributaria.gob.es/static_files/Sede/Tema/IVA/IVA_reper/Tipos_IVA_2026_26_02_2026.pdf).

El servicio de #10017 no aparece en las 95 filas actuales de `ServiciosCatalogo` ni en la consulta de `Bookings/Services`; no existe configuración maestra vigente que explique el 10 %.

**Pedido #10018 — línea “EXTRA” de 5,00 EUR.**
La línea es `CUSTOM_AMOUNT_ITEM`, sin `catalogReference.appId` ni `catalogItemId`. Además, `taxDetails.taxRate=0` mientras `taxInfo.taxRate=0.2100`; la cuota devuelta es 0,87 EUR. El total de pedido cuadra, pero la identidad del concepto y los metadatos de impuesto no son coherentes. Mantener en revisión manual, sin fabricar identidad de catálogo.

El servicio/pack de #10018 tampoco aparece en los catálogos actuales consultados. El servicio de #10030 sí existe en `ServiciosCatalogo` y `Bookings/Services`, con `tipoImpositivo=0.21`.

### 5. CMS y controles fiscales/contables

Lecturas consistentes del corte:
- `MovimientosCaja`: **0**.
- `LibroAsientosContablesDetalle`: **0**.
- `HistoricoCierresZ`: **0**.
- `ControlOperativo`: **0**.
- `RegistroIntegracion`: **0**.
- `PaquetesGestoria`: **0**.
- `CitasF2`: **0**.
- `DatosFiscales`: 1 registro, pero es `recordType=TERCERO` / `thirdPartyType=PROVEEDOR`, con razón social placeholder QA. No existe el singleton `recordType=CONFIG_SISTEMA` requerido por el dossier para la configuración fiscal del sistema.
- `CajaActual`: un singleton `SIMULACION`, abierto, con apertura/esperado 300 EUR, ventas 0, saldo efectivo 0 y secuencia 0. No es caja operativa y no debe compararse con los pedidos reales.
- `InventarioStockVenta` y `MovimientosInventario`: una fila sintética QA cada una; no hay movimiento comercial real acreditado.
- `RegistrosHorariosStaff`: dos filas sintéticas QA; no acreditan jornada real y carecen de firma HMAC.

La política del código sigue fail-closed:
- `FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED=false`.
- `FISCAL_RUNTIME_POLICY.ACCOUNTING_LEDGER_WRITES_ENABLED=false`.
- `FISCAL_RUNTIME_POLICY.ALLOW_SIMULATION_RECORDS=false`.

`registrarEventoEconomico` devuelve `FISCAL_LEDGER_WRITES_DISABLED` mientras esa política permanezca desactivada. El webhook de pago encola recuperación cuando falla el registro fiscal, pero en este corte no existen marcadores en `ControlOperativo` ni `RegistroIntegracion` que permitan acreditar que los eventos de estos cuatro pedidos se procesaron. Sin acceso a logs no se puede concluir si el webhook no llegó, falló o fue procesado en otro estado.

### 6. Resultado de conciliación y decisión

- **Pedido ↔ transacción Wix:** conciliado para los cuatro pedidos PAID por 264,36 EUR.
- **Transacción ↔ banco/efectivo real:** no conciliado; falta justificante bancario/TPV/caja y `offlinePayment=false` impide asumir efectivo físico.
- **Pedido ↔ reserva:** conciliado para tres reservas vinculadas; las otras 13 reservas PAID/CANCELED carecen de pedido eCommerce identificable.
- **Cancelaciones pagadas:** dos vinculadas sin reembolso registrado y con `cancellationFeeEnabled=false`; 13 adicionales sin vínculo eCommerce. No emitir devoluciones sin verificar obligación y medio original.
- **Pedido ↔ factura:** vínculo devuelto para dos pedidos por appId no identificado; dos pedidos sin vínculo.
- **Pedido ↔ ledger fiscal/PGC:** no conciliado; 264,36 EUR sin movimiento fiscal visible y sin asiento contable.
- **IVA:** incidencia prioritaria en #10017 (10 % en servicio de peluquería) y metadatos contradictorios en línea EXTRA de #10018.
- **Configuración fiscal:** falta `DatosFiscales.CONFIG_SISTEMA`; no activar Veri*Factu ni escritores.

**Decisión: Layer 2 permanece NO CERRADA.** La lectura de fuentes comerciales y transacciones está conciliada; el cierre fiscal, bancario, contable y de cancelaciones no. No se deben crear movimientos retroactivos, asientos, rectificaciones, reembolsos ni cambios de configuración hasta recibir validación del gestor y evidencia del medio de cobro. Las correcciones de registros append-only deberán ser nuevos registros rectificativos trazables, nunca edición/borrado.

