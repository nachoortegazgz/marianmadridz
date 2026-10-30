# ADR-002 — Nombres de identificadores en Wix Bookings V2 SDK

- **Estado:** Aceptada
- **Fecha:** 2026-10-30
- **Alcance:** Código JavaScript que importa `@wix/bookings` y consume Bookings V2.
- **No aplica:** Peticiones REST directas ni estructuras de APIs V1.

## Contexto

La SSOT v10.0 contiene dos referencias a `resource.id` en las secciones §17.3 y §20.3. Esa nomenclatura no debe trasladarse literalmente a los objetos del SDK JavaScript: Wix mantiene diferencias entre los nombres REST y los nombres de propiedades del SDK.

La especificación oficial de Wix expone las siguientes formas:

| Contexto | Forma SDK JavaScript | Forma REST |
|---|---|---|
| Recurso en `BookedSlot` | `resource._id` | `resource.id` |
| Ubicación en `BookedSlot` | `location._id` | `location.id` |
| Ubicación en Time Slots V2 | `locations[]._id` | `locations[].id` |
| Recurso disponible en Time Slots V2 | `resources[]._id` | `resources[].id` |
| Filtro de profesionales | `resourceTypes[].resourceIds` | `resourceTypes[].resourceIds` |

Fuentes oficiales consultadas:
- [Create Booking V2 — SDK](https://dev.wix.com/docs/api-reference/business-solutions/bookings/bookings/bookings-writer-v2/create-booking?apiView=SDK)
- [List Availability Time Slots V2 — SDK](https://dev.wix.com/docs/api-reference/business-solutions/bookings/time-slots/time-slots-v2/list-availability-time-slots?apiView=SDK)
- [Query Extended Bookings V2 — SDK](https://dev.wix.com/docs/api-reference/business-solutions/bookings/bookings/bookings-reader-v2/query-extended-bookings?apiView=SDK)

## Decisión

1. En módulos que importan `@wix/bookings`, leer y escribir los identificadores de entidades SDK con `_id`.
2. En Time Slots V2, mantener `resourceTypes[].resourceIds` como filtro por GUID; no renombrar ese campo.
3. No introducir fallback `id || _id` para ocultar una mezcla de modelos REST y SDK. Si se consume REST directamente, su adaptador debe normalizar explícitamente la respuesta en el límite REST/SDK.
4. Los identificadores propios del dominio, por ejemplo `resourceId` en DTOs y CMS, permanecen como `resourceId`; no se renombrarán por esta ADR.
5. Actualizar la SSOT §17.3 y §20.3 para que la regla distinga explícitamente REST de SDK.

## Consecuencias

- `bookingCore.js`, `bookingSaga.js` y `reservas.web.js` deben usar `BookedResource._id` y `Location._id` en los objetos SDK.
- El cálculo de carga de profesionales desde `extendedBookings.queryExtendedBookings()` debe leer `booking.bookedEntity.slot.resource._id`.
- Las fixtures de pruebas deben representar el modelo SDK, no la forma REST.
- No se altera la arquitectura dual F1/F2: siguen siendo dos reservas simples coordinadas por `pairToken`; no se utiliza Multiservice Booking.

## Verificación

La revisión de esquema oficial confirma los campos anteriores. La integración queda sujeta a CI, pruebas offline y QA en Local Editor; esta ADR no declara validado el runtime publicado.
