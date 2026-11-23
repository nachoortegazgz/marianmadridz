# Aceptación Runtime — reserva dual F1 + gap + F2

**Sitio:** Marian Madrid · Europe/Madrid · Wix Bookings V2.  
**Estado:** especificación de pruebas; no ejecutadas.  
**Regla arquitectónica:** no se utiliza Wix Bookings multiservicio. El backend compone dos bookings individuales e independientes.

## Modelo temporal

- F1 ocupa `[F1.start, F1.end)`.
- Gap de exposición: `[F1.end, F2.start)`, con duración `exposureDuration`; no constituye un booking.
- F2 ocupa `[F2.start, F2.end)`.
- Invariante: `F2.start === F1.end + exposureDuration` en la zona horaria y granularidad temporal definidas por el contrato.
- F1 y F2 usan el mismo `resourceId`.

## Matriz de pruebas

| ID | Escenario | Resultado exigido | Riesgo |
|---|---|---|---|
| DUAL-RT-01 | Reserva dual válida | Dos booking IDs independientes, pairToken común y F2 exacto | P0 |
| DUAL-RT-02 | Slot F2 anterior al objetivo | Rechazo; no aproximar al primer slot posterior | P1 |
| DUAL-RT-03 | Slot F2 posterior al objetivo | Rechazo; gap exacto obligatorio | P1 |
| DUAL-RT-04 | Recurso F2 distinto | Rechazo de pareja | P0 |
| DUAL-RT-05 | Política de ocupación del gap | Verificar si un tercer servicio puede ocupar el intervalo de exposición; el resultado debe coincidir con la política aprobada | P1 |
| DUAL-RT-06 | Concurrencia sobre F1/F2/gap | Como máximo una pareja válida; sin booking parcial huérfano | P0 |
| DUAL-RT-07 | F2 con onlineBooking deshabilitado | Writer crea F2 interno OFFLINE si el contrato nativo lo permite; sin segundo checkout | P1 |
| DUAL-RT-08 | Reintento mismo payload | Reutiliza la transacción/pareja existente; no duplica bookings | P0 |
| DUAL-RT-09 | Timeout incierto tras crear F1 o F2 | Estado UNCERTAIN y reconciliación; no reintento ciego | P0 |
| DUAL-RT-10 | Cancelación de una fase | Política de cancelación de pareja aplicada una sola vez y trazada | P0 |
| DUAL-RT-11 | Reprogramación | Recalcula F1/gap/F2, mismo resourceId y sin liberar parcialmente la pareja | P0 |
| DUAL-RT-12 | F2 pago | `OFFLINE`, importe cero, `noFee=true`, sin checkout/cobro | P0 |

## Evidencia que debe conservarse

- testRunId sintético y aislamiento explícito del sitio/datos.
- Payload sanitizado, traceId y pairToken.
- F1/F2 booking IDs, resourceId, start/end y exposureDuration.
- Estado de locks/claims antes y después.
- Resultado de lectura posterior de Bookings V2 y CMS de proyección.
- Comprobación negativa de ausencia de checkout, transacción, notificación externa y asiento fiscal real.
- Limpieza solo de datos sintéticos no inmutables, con autorización y evidencia; nunca borrar ledgers append-only.

## Condiciones previas

1. Acreditar SHA Git instalado en Wix Editor/Runtime.
2. Identificar mecanismo de aislamiento de datos sintéticos en Wix; no basta con etiquetar el payload.
3. Confirmar que los handlers y WebMethods de prueba no generan emails, cobros, invoices ni notificaciones externas.
4. Usar una franja/recurso de prueba aislado y no datos de clientes ni reservas operativas.
5. No ejecutar hasta que la prueba negativa de efectos externos esté verificada.

## No-go

Cualquier booking parcial sin compensación trazable, ocupación del gap, resourceId distinto, segundo cobro, evento duplicado, efecto externo o escritura no aislada detiene la suite y mantiene el release NO-GO.
