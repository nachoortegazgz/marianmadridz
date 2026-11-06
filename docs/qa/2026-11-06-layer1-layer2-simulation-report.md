# Simulacro de continuidad — Capas 1 y 2 — QA — 2026-11-06

## Resultado ejecutivo

**Alcance:** revisión del código de `main`, contratos CMS de QA, matriz de escenarios offline y gates automáticos configurados para PR/push a `main`.

**Entorno CMS:** Marian Madrid QA, site ID `4c2889a4-0e2f-4012-b376-bd191024c0f7`. Producción no consultada ni modificada.

**Código base:** main incluye los merges #147, #148 y #149:
- #147: hooks DATETIME de CitasF2 enlazados al ID físico QA.
- #148: contrato canónico `expiresAt` y test de concurrencia.
- #149: documentación de la poda CMS.

La auditoría de código y esquema confirma una base coherente para los flujos cubiertos por mocks. No se declara cierre total de todas las integraciones externas: permanecen escenarios parciales/manuales descritos abajo.

## 1. CMS — poda y contrato

Lectura consistente del esquema CMS: 40 colecciones en total, 15 `NATIVE`. La poda se ha limitado a campos propios auditados; no se han modificado colecciones `WIX_APP`.

| Colección | Revisión posterior | Campos eliminados |
|---|---:|---|
| `CitasF2` | 17 (lectura final) | `noShowReason`, `noShowAt`, `changeLog`, `cancellationReason`, `canceledAt`, `invoicingDate`, `fiscalData`, `sourceEventId` |
| `ComplementosCatalogo` | 3 | `traceId` |
| `ControlOperativo` | 9 | `nextRetryAt`, `retryAfter` |

**Total: 11 campos físicos eliminados.** Las operaciones devolvieron HTTP 200 y una lectura posterior con consistencia confirmó la ausencia de cada campo. Wix elimina también los valores de esos campos de todos los ítems.

### Contratos preservados

- `CitasF2.slotStart` y `slotEnd`: tipo físico `DATETIME`; los hooks de inserción/actualización normalizan a `Date` y rechazan fechas inválidas. Hooks registrados para `CitasF2` y el ID físico QA.
- `CitasF2`: se mantienen `privacyNoticePurpose`, `privacyNoticeAcceptedAt`, `privacyNoticeVersion`, `bookingId`, `bookingType`, `bookingStatus`, `paymentStatus`, `serviceId`, `resourceId`, `pairToken`, `scheduleId`, `contactDetails`, `thirdPartyId`, `catalogId`, `cashMovementId`, `revision` y `meta`.
- `ControlOperativo`: `expiresAt` DATETIME y `attempts` NUMBER son canónicos. Se conservan `processedAt` (conciliación de inventario), `heartbeatAt`, campos de locks, idempotencia, rate limiting, compensaciones y alertas.
- `ComplementosCatalogo.ServiciosCatalogo_name` y `ServiciosCatalogo.name`: se conserva la relación nativa `MULTI_REFERENCE`.

## 2. Capa 1 — reservas, identidad y operación web

### Cobertura automatizada localizada

| Proceso | Evidencia | Estado |
|---|---|---|
| Reserva simple presencial | `qa.simple-booking.writer.e2e.test.mjs` | MOCK_COVERED |
| Disponibilidad dual, gap exacto y mismo profesional | `reservas.web.test.mjs` | MOCK_COVERED |
| Locks, renovación, expiración, reclaim y liberación | `booking.core.concurrency.test.mjs` | MOCK_COVERED |
| Idempotencia y replay de transacciones | `booking.core.concurrency.test.mjs` | MOCK_COVERED |
| Checkout Cart V2 y validación del carrito | `booking.cart-v2.checkout.test.mjs` | MOCK_COVERED; sin pago |
| Webhook de cancelación y replay/reconciliación | `events.booking-canceled.integrity.test.mjs` | MOCK_COVERED |
| Identidad miembro/contacto/staff, roles y fichaje firmado | `site.flows.e2e.test.mjs` | MOCK_COVERED |
| Rate limiting y hooks de ControlOperativo | Suites de Layer 1 | MOCK_COVERED |

### Hallazgo de continuidad

El circuito de disponibilidad dual valida la igualdad exacta entre fin de F1 + exposición y comienzo de F2, además del mismo `resourceId`. La saga utiliza locks e idempotencia y contiene compensaciones. Sin embargo, el manifiesto de QA sigue calificando como parcial la prueba integrada de fallo real de F2: falta demostrar en una sola prueba F1 creado, F2 fallido, cancelación nativa de F1, reconciliación de ambas filas CitasF2 y liberación de ambos locks.

La reprogramación completa (simple y dual), con liberación del slot antiguo y notificaciones, tampoco está certificada por una prueba integrada.

## 3. Capa 2 — caja, fiscalidad e inventario

### Cobertura automatizada localizada

| Proceso | Evidencia | Estado |
|---|---|---|
| Alta de movimiento y proyección de caja | `site.flows.e2e.test.mjs` | MOCK_COVERED |
| Cierre Z y verificación de cadena SHA-256 | `site.flows.e2e.test.mjs` | MOCK_COVERED; signer mock |
| Devolución/reembolso y signo contable negativo | `site.flows.e2e.test.mjs` FLOW-CAJA-07 | MOCK_COVERED; signer mock |
| FACSIMIL, secuencia, digest y detección de manipulación | `fiscalFacsimile.test.mjs` | MOCK_COVERED; no X.509/AEAT |
| Resolución del total de pedido | `orderLedgerAmount.test.mjs` | MOCK_COVERED |
| Venta inventario, token idempotente, devolución y stock insuficiente | `inventory.movement.flow.test.mjs` | MOCK_COVERED |
| Lock de inventario y liberación tras fallo | `inventory.lock.release.test.mjs` | MOCK_COVERED |
| Hooks CMS, DTO whitelist, crons y eventos | Suites de Layer 2 | MOCK_COVERED |

### Límites fiscales y de inventario

- El firmante usado en tests es un mock; no equivale a certificado X.509 real.
- FACSIMIL no genera QR verificable ni permite envío AEAT.
- La venta/devolución del ledger de inventario se prueba offline. La reconciliación real con Wix Stores no queda certificada por los mocks.
- No se simula una transacción de pago real ni se conecta un proveedor de pagos.

## 4. Procesos sin evidencia E2E completa

| Proceso | Estado actual | Qué falta |
|---|---|---|
| F2 Writer V2 falla tras crear F1 | PARTIAL_MOCK_COVERAGE | Saga integrada y reconciliación completa |
| Pedido pagado y webhook de pago | PARTIAL / no certificado | Fixtures de evento y transición ledger completa |
| Reprogramación simple/dual | MANUAL_QA_REQUIRED | Prueba integrada, slots anterior/nuevo y consistencia de pareja |
| Wix Automations y entrega de mensajes | MANUAL_QA_REQUIRED | Validar configuración/entrega con buzón QA |
| Formularios, CRM, opt-in y baja | MANUAL_QA_REQUIRED | Integración CRM y supresión de comunicaciones |
| Gift Cards/bonos | MANUAL_QA_REQUIRED | Solo si la funcionalidad está activada |
| Wix Stores reconciliation | Integración pendiente | Eventos de pedido/devolución en entorno de prueba |
| Firma X.509 y AEAT | Fuera de mocks | Servicio/certificado de pruebas y homologación fiscal |
| Browser E2E/checkout | Manual | Preview QA, medio de pago de prueba e inbox aislado |

## 5. Ejecución automática y evidencia

El workflow `.github/workflows/booking-regression.yml` está configurado para PR/push a `main` y ejecuta, en este orden:
1. `npm ci`
2. `npm test`
3. `npm run test:layer1`
4. `npm run test:layer2`
5. `npm run lint`

Run #172, ID `42149432291`, asociado al commit `c5189cb9abfb992458daccd18a497e9667e038af`: **success**. `npm ci` correcto; suite completa **366/366**, 39 suites, 0 fallos; Layer 1 **207/207**, 12 suites, 0 fallos; Layer 2 **116/116**, 12 suites, 0 fallos; ESLint correcto. Evidencia: [workflow run #172](https://github.com/nachoortegazgz/marianmadridz/actions/runs/42149432291). El workflow no ejecuta Preview, Publish ni despliegue.

## 6. Restricciones del simulacro

- Fixtures sintéticos y mocks offline.
- Sin crear reservas, pedidos, pagos, devoluciones, movimientos de caja, cierres Z ni movimientos de inventario reales.
- Sin envío de correos, SMS ni comunicaciones a clientes.
- Sin mutaciones en producción.
- Sin Preview, Publish ni despliegue.
- No se declara prueba E2E de navegador ni checkout real.

## 7. Conclusión

Capas 1 y 2 disponen de una cobertura offline significativa de sus caminos principales y de fallos controlados. La continuidad de los procesos internos que cubren esas suites está protegida por contratos de CMS, idempotencia, locks, validación, compensaciones y pruebas de regresión.

**No es correcto declarar todas las rutas posibles cerradas todavía.** Los puntos de mayor riesgo pendientes son la compensación integrada de reserva dual, el ciclo de pago confirmado/webhook, la reprogramación, la integración real Wix Stores y los servicios externos (firma fiscal, AEAT, Automations, CRM y Gift Cards). Se mantienen explícitamente como pendientes de integración/manuales, no como pruebas superadas.
