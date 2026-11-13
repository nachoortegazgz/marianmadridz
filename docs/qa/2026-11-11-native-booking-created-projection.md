# Booking nativo — proyección del evento de creación

Fecha: 2026-11-11

## Objetivo

Evitar que una reserva creada por Wix Bookings quede fuera de la proyección operativa `CitasF2` hasta que llegue una confirmación, y garantizar que una entrega tardía del evento de creación no degrade una proyección ya confirmada o una reserva dual creada por la saga.

## Evidencia verificada en producción (solo lectura)

- En la ventana auditada de 30 días se leyeron 44 reservas nativas: 6 `CONFIRMED` y 38 `CANCELED`.
- `CitasF2` devolvió 0 registros.
- `ControlOperativo` no contenía marcadores `WEBHOOK_EVENT` en la consulta de auditoría.
- El repositorio `main` exportaba handlers para `wixBookingsV2_onBookingConfirmed`, `wixBookings_onBookingRescheduled` y `wixBookingsV2_onBookingCanceled`, pero no para `wixBookings_onBookingCreated`.
- Wix documenta el evento Bookings V2 `onBookingCreated` como evento que se dispara al crear una reserva. El contrato del evento confirmado existente se mantiene.

**Límite causal:** la ausencia de proyecciones y marcadores no demuestra por sí sola que el webhook confirmado no se ejecutara. También puede depender del código realmente publicado, de la configuración/registro de eventos o de diferencias entre `main` y el código desplegado. Este cambio cubre la fase de creación; no declara resuelta la causa de los registros históricos.

## Cambio implementado

1. Se añade `wixBookings_onBookingCreated` en `src/backend/events.js`.
2. El handler valida `metadata.id`, GUID de reserva y estado nativo permitido (`CREATED`, `PENDING` o `CONFIRMED`).
3. Persiste la proyección inicial como `PENDING` (o `CONFIRMED` si Wix ya entrega ese estado).
4. La marca `WEBHOOK_EVENT` se escribe solo después de persistir correctamente la proyección. Si ya existe la marca pero falta la fila, el handler intenta reparar la proyección.
5. `_syncNativeBookingToCitas` recibe un estado objetivo controlado. Una entrega tardía de `BOOKING_CREATED` no degrada una fila `CONFIRMED`; tampoco convierte a `CONFIRMED` una fila `PENDING` de la saga dual que gane una carrera entre la lectura inicial y el insert (`insertOnly`). Las filas duales conservan su tipo, `pairToken` y metadata.
6. El evento `BOOKING_CONFIRMED` mantiene la transición a `CONFIRMED` y su comportamiento previo.
7. Se añaden pruebas de creación, orden creación→confirmación, entrega tardía sobre una fila dual, carrera de inserción `insertOnly` y repetición idempotente; además se protege el export del handler mediante test contractual.

## Archivos modificados

- `src/backend/events.js`
- `src/backend/tests/events.native-booking-sync.test.mjs`
- `src/backend/tests/events.backend-events.contract.test.mjs`

## Validación

- Revisión estática del diff y contratos: realizada; no sustituye la ejecución de CI.
- Suite offline, contratos SDK y ESLint: pendiente de CI del PR de corrección de carrera.
- Wix Local Editor, prueba visual y ejecución real de webMethods: no ejecutadas; requieren entorno Wix.
- Publicación Velo en Wix: no realizada.

## Seguridad e integridad

- No se han creado, cancelado ni modificado reservas.
- No se han modificado ledgers, pagos, cierres ni inventario.
- No se han enviado comunicaciones.
- No se ha publicado código en Wix.
- La prueba de producción autorizada permanece bloqueada hasta que el usuario publique el cambio y se confirme el despliegue.