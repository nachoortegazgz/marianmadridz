# TPV — corrección de resultados pendientes y capacidad de cierre Z

**Fecha:** 2026-11-28  
**Rama:** `fix/tpv-offline-pending-and-z-capability-2026-11-28`

## Criterio

El TPV mantiene un único flujo y no clasifica operaciones como prueba, sandbox o producción. La falta de un proveedor externo no debe convertir una operación persistida en un error de transporte ni bloquear capacidades internas que ya existen.

## Cambios

- El widget ahora trata `status: PENDING` como resultado de negocio recibido, no como rechazo de Promise. Conserva el estado pendiente mostrado al operador y permite liberar la clave idempotente local después de que el backend confirme que la intención comercial quedó persistida.
- El mensaje de venta indica expresamente que el pago sigue pendiente; no afirma que el importe declarado se haya cobrado.
- Se retiraron textos de interfaz que calificaban importes como “de prueba” o “simulados”.
- `issueTicketZ` se expone como capacidad ADMIN porque `generarCierreZ` ya existe en backend. La WebMethod mantiene autorización y validaciones propias.

## Capacidades que siguen sin activarse

- `acceptPayment`: no hay pasarela configurada; no se declara un cobro confirmado.
- `requestRefund`: no hay proveedor de reembolsos verificado.
- `physicalHardware` y `printReceipt`: la conexión de impresora/cajón no está acreditada. La indisponibilidad de hardware no debe bloquear operaciones de caja internas.
- `customerNotifications`: se mantienen desactivadas para evitar contacto exterior.
- Ticket Z sigue sujeto a que no existan ventas o devoluciones pendientes y a sus validaciones de conciliación. No se elimina ese control.

## Validación

- Se añadieron aserciones de contrato para la resolución de respuestas PENDING, los mensajes neutrales y la capacidad ADMIN de Ticket Z.
- CI de esta rama pendiente de ejecución.
- No se hicieron escrituras CMS, cobros, reembolsos, notificaciones, impresiones ni llamadas a AEAT.
- Wix Runtime y E2E siguen pendientes; la fusión no acredita sincronización con el Editor Wix.
