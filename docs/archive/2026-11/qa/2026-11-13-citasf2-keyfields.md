# Auditoría y migración del contrato CitasF2

**Fecha:** 2026-11-13  
**Sitio:** Marian Madrid — `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Colección:** `CitasF2`  
**Revisión CMS:** 33 → 41 (migración aplicada); lectura live posterior: 42  
**PR de código:** [#330](https://github.com/nachoortegazgz/marianmadridz/pull/330)  
**Estado de código:** integrado en main mediante PR #330; no publicado en Wix. PR #331 cerrada sin merge.

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
| `sourceEventId` | TEXT | Ausente | Eliminado: huérfano sin valores |
| `canceledAt` | DATETIME | Ausente | Eliminado: sin consumidores activos ni valores |

Revisiones Wix durante la migración: 34 tras crear `orderId`; 41 tras la poda adicional de `canceledAt`. Una lectura live posterior del 2026-11-13 20:51 CET devuelve revisión 42, 31 campos y confirma `orderId: TEXT` y ausencia de los cuatro campos eliminados. No se infiere la causa del incremento 41 → 42.

## 3. Campos preservados deliberadamente

Se mantiene `cancellationReason` porque figura en el contrato de flujo WEB-09. Se mantienen `privacyNoticePurpose`, `privacyNoticeAcceptedAt` y `privacyNoticeVersion` porque tienen escritores activos; `cancellationReason` porque figura en el contrato WEB-09; `thirdPartyId`, `fiscalData` e `invoicingDate` por el vínculo fiscal/tercero/caja documentado. No se ha podado ningún campo de una colección Wix App.

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

**Verificado en Wix en la lectura live del 2026-11-13 20:51 CET:**
- Colección CitasF2, displayName CITAS_F2, tipo NATIVE, revisión 42.
- 31 campos físicos y un item (1/1; sin páginas adicionales).
- orderId TEXT existe en raíz; cashMovementId y timeZone también están definidos en raíz.
- Los campos noShowReason, noShowAt, sourceEventId y canceledAt no existen.
- No hay duplicados meta.bookingStatus, meta.paymentStatus, meta.orderId ni meta.cashMovementId en el item.
- El item conserva bookingStatus=CONFIRMED y paymentStatus=NOT_PAID; la reserva nativa correspondiente permanece CANCELED / NOT_PAID.
- La fila histórica no contiene timeZone, orderId ni cashMovementId en raíz. No se rellenan por inferencia.
- El sitio Wix está Published. No se ha acreditado que el código integrado esté publicado.

**Verificado en GitHub:**
- PR #330 está fusionada en main; HEAD consultado: 3df4b4cf174d80dfd22406bbd758b2eddd7aaa44.
- PR #331 está cerrada sin merge.
- El informe de QA registra 23 suites/294 PASS en Layer 1, 18 suites/243 PASS en Layer 2 y 68 suites/621 PASS en la regresión completa; también registra contratos SDK, ESLint y Gitleaks PASS. La asociación exacta de los workflows con el SHA de código integrado debe confirmarse antes de declarar CI del HEAD actual validado.

**Pendiente:**
- Diagnosticar la reconciliación de cancelación en Wix Runtime; no parchear manualmente la proyección.
- Confirmar SHA publicado, delivery y ejecución del handler de cancelación y del cron.
- Confirmar el contrato slot.scheduleId frente a eventsScheduleId.
- Probar permisos efectivos con identidad colaboradora CMS_EDITOR.
- E2E en sitio aislado y revisión final del diff/CI del HEAD actual.
- No ejecutar backfill, publicación ni nuevas mutaciones CMS sin plan aprobado y autorización.

## 8. Fuentes oficiales Wix

- [Get Data Collection](https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-collections/get-data-collection)
- [Create Data Collection Field](https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-collections/create-data-collection-field)
- [Delete Data Collection Field](https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-collections/delete-data-collection-field)
- [Count Data Items](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/count-data-items)
- [Query Data Items](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/query-data-items)
- [Patch Data Item](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/patch-data-item)
