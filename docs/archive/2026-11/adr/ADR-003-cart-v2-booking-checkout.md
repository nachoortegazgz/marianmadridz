# ADR-003 — Checkout de reservas con Wix eCommerce Cart V2

- **Estado:** Cart V2 aislado y guard de propiedad de miembro/login nativo integrados en `main` mediante PR #204 (commit `5fba1b3`), con sitio publicado. QA offline vigente: 431 pruebas / 0 fallos en run 116 de PR #205. E2E real de checkout/pedido en Wix publicado sigue pendiente.
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

## Identidad y propiedad del carrito

El checkout de reserva utiliza un carrito independiente de Cart V2. No se debe sustituir automáticamente por `currentCartV2`: el carrito de reserva contiene exactamente una línea de Bookings F1 y la conciliación fiscal actual espera esa separación. Añadir productos de Stores al mismo carrito alteraría el contrato de cálculo y de conciliación.

La documentación oficial de Cart V2 especifica:
- Cart gestiona carritos independientes por ID.
- Current Cart gestiona el carrito de la sesión actual (visitor/member).
- Si no se identifica al cliente al crear un Cart, `customerInfo.openAccess` puede ser `true`; el primer visitante/miembro que acceda pasa a ser propietario.
- `customerInfo.memberId` y `customerInfo.contactId` son campos de solo lectura que identifican al propietario.

**Invariante añadida en PR #204:** `createBookingCartCheckout` recibe los identificadores obtenidos de la sesión Wix Members. Antes de calcular o devolver la URL, exige que `createdCart.customerInfo.memberId` y `contactId` coincidan con esa sesión y que `openAccess !== true`. Si falla, elimina el carrito recién creado y aborta para que la saga compense la reserva. La atribución del Order final a `buyerInfo.memberId` debe comprobarse en E2E publicado.

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
- [Cart V2 — Delete Cart](https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/purchase-flow/cart-v2/delete-cart?apiView=SDK)
- [Cart V2 — Introduction](https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/purchase-flow/cart-v2/introduction)
- [Bookings V2 — Create Service / manual approval](https://dev.wix.com/docs/api-reference/business-solutions/bookings/services/services-v2/create-service)
- [eCommerce — Payment Status Updated webhook](https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/orders/payment-status-updated)

## Verificación

Verificación offline vigente:
- Contrato SDK: `cartV2.createCart`, `calculateCart`, `getCheckoutUrl`, `items.patch` y `items.bulkPatch`.
- Suite Cart V2: creación de carrito aislado, propiedad `memberId/contactId`, rechazo de `openAccess`, limpieza del carrito huérfano, cálculo con violaciones, respuesta sin `violations`, IDs discordantes, total/moneda inválidos, URL no HTTPS y línea Bookings no disponible.
- La saga propaga la identidad Wix Members autenticada a `createBookingCartCheckout`.
- CI run 116 (2026-11-09): 46 suites, 431 pruebas correctas, 0 fallidas; Cart V2 SDK contract PASS; Bookings Reader V2 SDK contract PASS; ESLint PASS.

Estas pruebas son offline con mocks. No acreditan el checkout en el sitio Wix. La regla `@wix/cli/no-invalid-backend-import` continúa desactivada temporalmente por ausencia del manifiesto generado `src/velo.dependencies.json`; esa validación sigue pendiente.

El sitio publicado no se ha usado para crear reservas ni ejecutar cobros durante esta sesión. La prueba E2E real queda limitada a un entorno de prueba y pasarela sin cargo real.
