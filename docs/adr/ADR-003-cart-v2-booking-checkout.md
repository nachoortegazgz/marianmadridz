# ADR-003 — Checkout de reservas con Wix eCommerce Cart V2

- **Estado:** Propuesta implementada en PR #19; pendiente de QA Wix y merge a `main`.
- **Fecha:** 2026-10-30.
- **Alcance:** Checkout online de reservas simples y duales F1/F2 desde backend Velo.
- **No aplica:** Wix Stores Catalog V1, Invoices V1 ni Multiservice Bookings.

## Contexto

El proyecto migra la creación del checkout de reservas a `@wix/ecom` Cart V2. La reserva Bookings se crea primero; el checkout se construye con el identificador de esa reserva como elemento de catálogo. En servicios duales, el carrito contiene únicamente F1: F2 permanece como segunda reserva nativa coordinada por `pairToken`, sin un segundo cobro.

La forma de respuesta del SDK no es uniforme entre los tres métodos utilizados. Confundirlas impide recuperar el ID del carrito o su URL de checkout.

## Contrato SDK verificado

| Método | Respuesta SDK | Lectura canónica |
|---|---|---|
| `cartV2.createCart(options)` | `Cart` directamente | `response._id` |
| `cartV2.calculateCart(cartId, options)` | `{ cart, summary }` | `response.cart._id`, `response.summary` |
| `cartV2.getCheckoutUrl(cartId)` | `{ checkoutUrl }` | `response.checkoutUrl` |

La referencia del elemento de catálogo utiliza:
- `catalogReference.appId`: GUID de Wix Bookings `13d21c63-b5ec-5912-8397-c3a5ddb27a97`.
- `catalogReference.catalogItemId`: GUID de la reserva F1 creada por Bookings.

`summary.violations` es opcional. Si no aparece, no debe rechazarse por ese único motivo. Si aparece, debe ser un array vacío; cualquier violación o forma no válida bloquea la entrega de la URL de checkout.

## Decisión de estados

1. El webhook de pago de eCommerce actualiza el estado de pago (`paymentStatus`) y la trazabilidad del pedido.
2. La aprobación de la reserva no se infiere del pago. El estado de Bookings se sincroniza desde el evento nativo `BOOKING_CONFIRMED`.
3. Para servicios sin aprobación manual, Wix puede confirmar la reserva al completar el pago y emitir el evento nativo correspondiente.
4. Si un servicio requiere aprobación manual, la reserva permanece pendiente hasta la acción de negocio y su evento nativo.
5. En una reserva dual, el pago de F1 se proyecta a ambas filas CMS vinculadas por `pairToken`; la pertenencia al pedido se valida únicamente contra el bookingId F1 realmente comprado.
6. No se activa ni modifica `requireManualApproval` como parte de esta migración. La configuración de servicios se trata como configuración de negocio independiente.

## Fuentes oficiales Wix

- [Cart V2 — Create Cart](https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/purchase-flow/cart-v2/create-cart?apiView=SDK)
- [Cart V2 — Calculate Cart](https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/purchase-flow/cart-v2/calculate-cart?apiView=SDK)
- [Cart V2 — Get Checkout URL](https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/purchase-flow/cart-v2/get-checkout-url?apiView=SDK)
- [Bookings V2 — Create Service / manual approval](https://dev.wix.com/docs/api-reference/business-solutions/bookings/services/services-v2/create-service)
- [eCommerce — Payment Status Updated webhook](https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/orders/payment-status-updated)

## Verificación

En PR #19:
- Prueba de contrato para la respuesta directa de `createCart`.
- Prueba de rechazo cuando `calculateCart` devuelve violaciones.
- Prueba de aceptación cuando `summary.violations` está omitido.
- Prueba de rechazo para respuestas incompletas o IDs discordantes.
- Suite offline: 259 pruebas, 0 fallos.
- GitHub Actions: Node.js 24.22.1 y 26.12.1, suites layer 1 y layer 2, verificación de exports SDK y ESLint, todo correcto.

Estas pruebas son offline con mocks. No acreditan el checkout en el sitio Wix. El lint actual mantiene desactivada temporalmente `@wix/cli/no-invalid-backend-import` por ausencia del manifiesto generado `src/velo.dependencies.json`; esa validación sigue pendiente.

No se ha publicado código ni se ha ejecutado un cobro online o una emisión de factura.
