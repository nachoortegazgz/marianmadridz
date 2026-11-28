# TPV — corrección de resultados pendientes y capacidad de cierre Z

**Fecha:** 2026-11-28  
**Rama:** `fix/tpv-offline-pending-and-z-capability-2026-11-28`

## Criterio

El TPV mantiene un único flujo y no clasifica operaciones como prueba, sandbox o producción. La falta de un proveedor externo no debe convertir una operación persistida en un error de transporte ni bloquear capacidades internas que ya existen.

## Cambios

- El contrato V1 permite registrar una intención comercial sin pagos. No la confunde con una venta cobrada ni con un movimiento de caja.
- Los controles de cobro permanecen desactivados mientras `acceptPayment=false`; la interfaz no deja introducir efectivo/tarjeta como si estuvieran confirmados.
- El widget trata `status: PENDING` como resultado de negocio recibido, no como rechazo de Promise. Conserva el estado pendiente mostrado al operador y permite liberar la clave idempotente local después de que el backend confirme que la intención comercial quedó persistida.
- El mensaje de venta indica expresamente que el pago sigue pendiente; no afirma que el importe declarado se haya cobrado.
- Se retiraron textos de interfaz que calificaban importes como “de prueba” o “simulados”.
- La apertura de sesión queda disponible para cualquier miembro validado por `requireTpvOperator` (ADMIN, GESTION y ESTILISTA); la creación inicial del singleton sigue siendo ADMIN-only.
- `generarCierreZ` ahora completa el cierre físico: asegura un único movimiento `CIERRE` idempotente y actualiza la proyección `CajaActual` mediante `closeTpvCajaSessionProjection`. En reintentos, recupera el movimiento/proyección si el Ticket Z ya se persistió pero la operación quedó interrumpida.
- El resumen de sesión/Ticket Z informa `pendingSalesCount` y `pendingSalesGrossMinor`. Las intenciones no cobradas quedan separadas de ventas confirmadas y no impiden el cierre físico; los reembolsos pendientes siguen bloqueándolo.
- `issueTicketZ` se expone como capacidad ADMIN después de integrar ese cierre completo. La WebMethod mantiene autorización y validaciones propias.

## Capacidades que siguen sin activarse

- `acceptPayment`: no hay pasarela ni writer de pago confirmado; no se declara un cobro confirmado. Se permite persistir la intención comercial sin tender.
- `requestRefund`: no hay proveedor de reembolsos verificado.
- `physicalHardware` y `printReceipt`: la conexión de impresora/cajón no está acreditada. La indisponibilidad de hardware no debe bloquear operaciones de caja internas.
- `customerNotifications`: se mantienen desactivadas para evitar contacto exterior.
- Ticket Z mantiene sus validaciones de conciliación y bloquea reembolsos pendientes. Las ventas pendientes se reflejan como saldo comercial no cobrado y no se suman a los importes cobrados.

## Validación

- CI PASS, run `46170554978`: Layer 1 29 suites / 398 tests; Layer 2 16 suites / 263 tests; suite completa 95 suites / 854 tests; SDK eCommerce Cart, Transactions y TPV PASS; npm audit y ESLint PASS.
- Secret scanning PASS, run `46170554976`.
- PR #712 fusionada en `main`, commit `2113da1e8b8928ca7e3eb0259ba37bc29a3c922f`.
- No se hicieron escrituras CMS, cobros, reembolsos, notificaciones, impresiones ni llamadas a AEAT.
- Wix Runtime y E2E siguen pendientes; la fusión no acredita sincronización con el Editor Wix.
