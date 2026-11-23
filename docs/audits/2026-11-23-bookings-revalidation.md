# Revalidación Bookings V2, catálogo dual y cancelaciones — 2026-11-23

**Repositorio:** `nachoortegazgz/marianmadridz`  
**Base Git:** `75b6fc2b6172ae8e8ea38536c28eace208d10d69`  
**Sitio:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Estado Wix:** Draft; Editor clásico; Velo habilitado.  
**Modo:** solo lectura. No se crearon ni modificaron reservas, servicios, CMS, pagos, pedidos, automatizaciones ni ledgers.

## 1. Reconciliación de CitasF2 con Bookings Reader V2

Se consultó `CitasF2` con lectura consistente, se extrajeron los seis `bookingId` y se ejecutó Query Extended Bookings V2 con filtro `booking.id $in [ids]`. Se deshabilitaron los campos opcionales de acciones, asistencia, conferencias, políticas, fees, eCommerce orders y transactions.

Resultado: 6 proyecciones, 6 bookings nativos encontrados, 0 IDs CMS sin correspondencia. Los seis bookings nativos están `CANCELED`, con `updatedDate` y `canceledDate` el 20-11-2026.

| Booking ID | CitasF2 status | CitasF2 paymentStatus | Native status | Native paymentStatus |
|---|---|---|---|---|
| `b18337da-2326-46fc-89c0-1843b6be0730` | CONFIRMED | PENDING_LEDGER | CANCELED | PAID |
| `f137c63a-f704-461e-91bc-3295e853c67d` | CONFIRMED | PENDING_LEDGER | CANCELED | PAID |
| `130c2b6c-ff18-4ada-aea5-53e47abdb6a1` | PENDING | NOT_PAID | CANCELED | UNDEFINED |
| `6793e96e-7e24-4128-831d-a70d82506d5b` | CONFIRMED | NOT_PAID | CANCELED | NOT_PAID |
| `13c74dc7-b6fd-4c04-b6cf-a516c9e019e8` | CONFIRMED | NOT_PAID | CANCELED | NOT_PAID |
| `d813afa4-6769-469a-8106-a7d19b1c954f` | CONFIRMED | NOT_PAID | CANCELED | NOT_PAID |

La lectura CMS muestra tres filas sin `pairToken`, dos con un token compartido y una con otro token. No se reconstruyen parejas por proximidad temporal ni por coincidencia de horarios.

### Riesgo y tratamiento

- La divergencia de estado sigue confirmada y puede mostrar reservas canceladas como activas en las proyecciones.
- Dos bookings nativos tienen `paymentStatus=PAID` y su proyección conserva `PENDING_LEDGER`. Deben correlacionarse con issue #416 y con los pedidos/pagos/refunds fuente.
- Cancelación nativa no implica por sí sola reembolso ni autoriza rectificación fiscal.
- `src/backend/events.js` contiene y exporta `wixBookingsV2_onBookingCanceled`. El handler actualiza CitasF2 y después persiste el marker; sus pruebas offline cubren cancelación, ausencia de proyección, fallo de lectura, replay y cancelación dual.
- La evidencia previa de ControlOperativo registró 0 markers `BOOKING_CANCELED` en 58 filas. No se volvió a consultar ControlOperativo en esta pasada.
- No existe evidencia de que el SHA de Git esté sincronizado en Wix Editor ni de que el handler esté registrado/ejecutándose en Runtime.

**Decisión:** mantener #523 abierta. No modificar CitasF2, reinyectar eventos, recrear bookings, cambiar estados nativos ni tocar pagos/ledgers. Primero acreditar registro/delivery Runtime y completar la correlación fiscal #416.

## 2. Catálogo nativo y canales de pago

Se consultaron los 94 servicios de Bookings Services V2 y las 95 filas de `ServiciosCatalogo` (94 SERVICE y 1 PRICING_PLAN).

| Comprobación | Resultado |
|---|---:|
| Servicios nativos | 94 |
| Servicios visibles | 70 |
| Servicios ocultos | 24 |
| Servicios con `onlineBooking.enabled=true` | 74 |
| Servicios con `onlineBooking.enabled=false` | 20 |
| Servicios visibles con reserva online habilitada | 70 |
| Correspondencias CMS/native ausentes | 0 |
| Servicios CMS huérfanos | 0 |
| Discrepancias de pago en servicios visibles | 0 |

Los 24 servicios ocultos son los 24 servicios secundarios referenciados por los 24 servicios duales como `linkedPhases`; ninguno es un dual parent. Se comprobó:

- Los 24 padres duales tienen sus flags CMS/native coherentes y ambas opciones nativas habilitadas (`online=true`, `inPerson=true`).
- Los 24 hijos ocultos admiten nativamente `inPerson=true`.
- 16 hijos tienen `ServiciosCatalogo.onlinePayment=true` y Bookings native `payment.options.online=false`.
- 8 hijos tienen `ServiciosCatalogo.inPersonPayment=false` y Bookings native `payment.options.inPerson=true`.
- 20 hijos tienen `onlineBooking.enabled=false`; los cuatro restantes lo tienen habilitado.

### Contrato dual contrastado con el código

`src/backend/booking/bookingSaga.js` crea F1 con el canal elegido para el servicio principal. F2 se crea con:

- `selectedPaymentOption=OFFLINE`
- `totalAmount=0`
- `noFee=true`
- sin segundo checkout/cobro.

La prueba existente `src/backend/tests/qa.dual-booking.writer.offline.test.mjs`, escenario `QA-DUAL-BOOKING-01`, comprueba F2 OFFLINE, validación nativa de disponibilidad y dos filas CitasF2 enlazadas. El contrato documental de Wix indica que `onlineBooking.enabled` habilita la reserva online por clientes; no se ha demostrado aquí si el Writer acepta todas las fases ocultas cuando está deshabilitado.

**Decisión:** no se justifica una modificación masiva de servicios ni una nueva llamada a API en cada lookup. No se ha confirmado un defecto de canal en los 70 servicios públicos ni en los 24 hijos internos bajo el contrato OFFLINE. Mantener #522 abierta exclusivamente hasta probar en Wix Runtime que el Writer crea las fases ocultas (incluidos los 20 con `onlineBooking.enabled=false`) con `OFFLINE`, sin segundo cobro ni efectos externos.

## 3. Alcance y gates

Verificado en esta pasada:
- Lectura consistente de CitasF2 y consulta nativa Bookings Reader V2 para los seis IDs.
- Consulta completa de los 94 servicios nativos y 95 registros de catálogo.
- Relación de los 24 hijos con los 24 padres duales.
- Código y prueba offline existentes para F2 OFFLINE.

No verificado:
- Reservas nativas adicionales fuera de los seis IDs proyectados; la reserva histórica sin proyección ya descrita en #523 requiere una consulta completa independiente.
- Delivery real de eventos de cancelación y SHA instalado en Wix Editor.
- CreateBooking de F2 oculto con onlineBooking deshabilitado en Wix Runtime.
- Checkout, pago, reembolso, concurrencia y efectos de notificaciones en Runtime.

**Resultado:** catálogo público coherente a nivel de configuración; reserva dual interna pendiente de Runtime; seis proyecciones de cancelación divergentes; release continúa NO-GO.

## 4. Fuentes

- [Wix Bookings Reader V2 — Query Extended Bookings](https://dev.wix.com/docs/api-reference/business-solutions/bookings/bookings/bookings-reader-v2/query-extended-bookings)
- [Wix Bookings Services V2 — Query Services](https://dev.wix.com/docs/api-reference/business-solutions/bookings/services/services-v2/query-services)
- [Wix CMS — Query Data Items](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/query-data-items)
- [Issue #523 — CitasF2 y cancelaciones](https://github.com/nachoortegazgz/marianmadridz/issues/523)
- [Issue #522 — canales de pago de servicios](https://github.com/nachoortegazgz/marianmadridz/issues/522)
- [Issue #416 — compensaciones fiscales](https://github.com/nachoortegazgz/marianmadridz/issues/416)
