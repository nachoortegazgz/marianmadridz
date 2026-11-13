# Auditoría y migración del contrato CitasF2

**Fecha:** 2026-11-13  
**Sitio:** Marian Madrid — `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Colección:** `CitasF2`  
**Revisión CMS:** 33 → 37  
**PR de código:** [#330](https://github.com/nachoortegazgz/marianmadridz/pull/330)  
**Estado de código:** pendiente de CI y revisión; no publicado.

## 1. Inventario previo y seguridad de la poda

Lectura consistente de Data Collections API y Data Items API:

- 1 item en CitasF2.
- 1 item leído de 1; sin páginas adicionales.
- ID del item: `4f78a93b-8df6-4edd-a1ae-2026e26ad292`.
- Los campos `noShowReason`, `noShowAt`, `sourceEventId` y `canceledAt` no contenían valores en ningún item.
- Búsqueda de código en el repositorio: sin consumidores activos de `noShowReason`, `sourceEventId` ni `canceledAt`; `noShowAt` solo aparecía en normalización de hook y fixture de prueba, sin writer/reader de negocio. `canceledAt` solo estaba declarado en BOOKING_FIELDS y en normalización de fechas, sin writer/reader; `cancellationReason` se conserva porque WEB-09 de la matriz de trazabilidad lo declara como dato del flujo de cancelación.

La API oficial Delete Data Collection Field elimina también todos los valores del campo en todos los items. La eliminación se ejecutó únicamente después de comprobar el recuento completo y ausencia de valores.

## 2. Cambios de esquema aplicados

| Campo | Antes | Después | Acción |
|---|---|---|---|
| `orderId` | No existía | TEXT | Añadido como keyfield raíz canónico |
| `cashMovementId` | TEXT | TEXT | Conservado; keyfield raíz canónico |
| `timeZone` | TEXT | TEXT | Conservado; el writer ahora lo persiste desde `SDK_CONFIG.TZ` |
| `noShowReason` | TEXT | Ausente | Eliminado: huérfano sin valores |
| `noShowAt` | DATETIME | Ausente | Eliminado: huérfano sin valores |
| `sourceEventId` | TEXT | Ausente | Eliminado: huérfano sin valores |\n| `canceledAt` | DATETIME | Ausente | Eliminado: sin consumidores activos ni valores |

Revisiones Wix: 34 tras crear `orderId`; 35 tras eliminar `noShowReason`; 36 tras eliminar `noShowAt`; 37 tras eliminar `sourceEventId`. Lectura final confirmó `orderId: TEXT` y ausencia de los tres campos eliminados.

## 3. Campos preservados deliberadamente

Se mantiene `cancellationReason` porque figura en el contrato de flujo WEB-09. Se mantienen `privacyNoticePurpose`, `privacyNoticeAcceptedAt`, `privacyNoticeVersion` porque tienen escritores activos; `cancellationReason` y `canceledAt` por su relación con el ciclo de cancelación; `thirdPartyId`, `fiscalData` e `invoicingDate` por el vínculo fiscal/tercero/caja documentado. No se ha podado ningún campo de una colección Wix App.

## 4. Consolidación de campos duplicados

Contrato canónico raíz:

- `bookingId`
- `bookingStatus`
- `paymentStatus`
- `orderId`
- `cashMovementId`
- `serviceId`
- `resourceId`
- `scheduleId`
- `slotStart`
- `slotEnd`
- `timeZone`
- `traceId`

Código:
- `BOOKING_FIELDS` incorpora `ORDER_ID` y `CASH_MOVEMENT_ID`.
- `_persistBooking` escribe las referencias en campos raíz y elimina de `meta` las copias `bookingStatus`, `paymentStatus`, `orderId` y `cashMovementId` al normalizar nuevas escrituras.
- `events.js` y `citasManager.web.js` escriben `paymentStatus`, `orderId` y `cashMovementId` en raíz.
- Los lectores usan raíz primero y mantienen fallback a `meta` para registros históricos hasta cerrar la migración histórica.

Item sintético existente:
- `meta.bookingStatus` y `meta.paymentStatus` eran iguales a sus campos raíz.
- Se eliminaron ambas copias mediante PATCH parcial de Wix.
- Se conservaron `meta.nativeBookingStatus`, `meta.eventId`, `meta.source` y el resto de metadatos de evento.
- No se modificó `bookingStatus=CONFIRMED`, `paymentStatus=NOT_PAID`, `bookingId`, ni los IDs de servicio/recurso/agenda.

## 5. Identificadores y validación

`assertCitasF2` exige GUID válido para `bookingId` y `scheduleId`; valida formato de `serviceId` y `resourceId` cuando están presentes. La frontera de alta `_persistBooking` exige los cuatro GUID para nuevas reservas. Esto evita bloquear actualizaciones de estado de proyecciones históricas incompletas, pero impide crear nuevas filas con IDs malformados.

No se altera la semántica de `scheduleId`: el valor explícito del slot sigue teniendo prioridad; el fallback a `eventsScheduleId` se conserva conforme a la decisión documentada en `docs/qa/2026-11-11-staff-zones-bookings-alignment.md`. En la reserva auditada, `slot.scheduleId` y `resource.eventsScheduleId` son GUID distintos y no deben confundirse.

## 6. Inconsistencia funcional no resuelta

La reserva nativa de Wix sigue en `CANCELED / NOT_PAID`, mientras la proyección CitasF2 sigue en `CONFIRMED / NOT_PAID`. La consolidación de campos no modifica ni oculta esta divergencia. Sigue siendo blocker P1 de reconciliación runtime.

## 7. Validación y límites

**Verificado en Wix:**
- Revisión final de colección 37.
- `orderId` existe y es TEXT.
- Los cuatro campos eliminados no existen.
- Los duplicados `meta.bookingStatus` y `meta.paymentStatus` ya no están en el item.
- Los valores raíz `bookingStatus` y `paymentStatus` se conservaron sin cambios.
- No se ha publicado código.

**Pendiente:**
- CI del PR #330 con las nuevas pruebas.
- Revisión del diff completo.
- Publicación manual autorizada y pruebas de runtime posteriores.
- Migración de posibles `meta.orderId` / `meta.cashMovementId` en otros items si se incorporasen en futuras lecturas; el inventario actual contiene un solo item y no tenía esos valores.

## 8. Fuentes oficiales Wix

- [Get Data Collection](https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-collections/get-data-collection)
- [Create Data Collection Field](https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-collections/create-data-collection-field)
- [Delete Data Collection Field](https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-collections/delete-data-collection-field)
- [Count Data Items](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/count-data-items)
- [Query Data Items](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/query-data-items)
- [Patch Data Item](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/patch-data-item)
