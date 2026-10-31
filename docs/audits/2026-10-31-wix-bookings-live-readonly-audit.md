# Auditoría de solo lectura Wix Bookings — 2026-10-31

- Sitio: Marian Madrid Peluquería y Estética
- Site ID: `188bed94-177c-4bc9-a9f0-35080d874f3e`
- Dominio: `https://www.marianmadrid.es/`
- Editor: Wix Editor clásico con Velo
- Zona horaria: `Europe/Madrid`
- Alcance: lectura de servicios Bookings, profesionales y colección CMS `MapaStaff`.
- Seguridad: no se ejecutaron escrituras, reservas, pagos, cambios de permisos ni publicaciones.

## 1. Servicios Bookings

Consulta de solo lectura de los servicios mediante Services V2, con paginación de 100 elementos.

| Indicador | Resultado |
|---|---:|
| Servicios totales | 94 |
| Tipo APPOINTMENT | 94 |
| Servicios visibles | 70 |
| Servicios ocultos | 24 |
| Servicios con online booking habilitado | 94 |
| Servicios con pago online habilitado | 70 |
| Servicios con pago presencial habilitado | 94 |
| Servicios con prefijo `F2-` | 24 |
| F2 visibles | 0 |
| F2 con pago online habilitado | 0 |
| Servicios ocultos sin prefijo F2 | 0 |
| Servicios visibles sin pago online | 0 |
| Servicios sin profesionales asignados | 0 |

**Conclusión:** la configuración observada es coherente con el patrón de dos fases del proyecto: los 24 servicios cuyo nombre empieza por `F2-` están ocultos y no permiten pago online; los 70 servicios restantes son visibles y permiten pago online. Todos mantienen el pago presencial habilitado. Esta observación no demuestra todavía el flujo de reserva ni la lógica de asociación F1/F2 del backend.

## 1.1 Catálogo CMS y relaciones duales

La colección `ServiciosCatalogo` (revisión 193) contiene 95 filas: 94 registros de servicios con `serviceId` y un registro `PRICING_PLAN` sin `serviceId`, que no es un servicio Bookings. Los 94 `serviceId` de servicio coinciden con los 94 servicios de Bookings; no hay IDs de servicio huérfanos ni duplicados.

- 24 registros de catálogo tienen `allowCombine = true`.
- Los 24 `linkedPhases` apuntan a un servicio Bookings existente.
- Los 24 servicios F2 enlazados están ocultos y tienen el pago online nativo desactivado.
- No se detectaron relaciones F1/F2 rotas ni F2 visibles.
- La invariante de duración `totalDuration = phase1Duration + exposureDuration + phase2Duration` se cumple en los 24 registros duales.
- El único registro sin `serviceId` es `Rayos V — Plan 5 sesiones`, con `catalogEntryType = PRICING_PLAN` y `sessionCount = 5`; debe tratarse como plan, no como servicio Bookings.

**Inconsistencia de metadatos F2:** 16 de los 24 registros F2 tienen `onlinePayment = true` en `ServiciosCatalogo`, mientras que el servicio nativo de Bookings tiene `payment.options.online = false`. Los otros 8 registros F2 coinciden. Los 24 F2 están ocultos. La revisión del flujo de `bookingSaga.js` muestra que la autorización del canal de pago se evalúa sobre la configuración del servicio principal F1; F2 se valida como fase enlazada y se crea con la validación de opción de pago omitida. Por tanto, no se ha demostrado que esta discrepancia altere el checkout F1 actual, pero sí es una inconsistencia de datos que debe corregirse de forma controlada en QA y mantenerse como bloqueo de higiene antes de cerrar el contrato de catálogo. No se ha cambiado ningún registro de producción.

## 1.2 Coherencia de precios y duraciones nativas

Se cruzaron los 94 servicios nativos con sus 94 registros de servicio en `ServiciosCatalogo`:

- Los 70 servicios visibles tienen precio fijo en Bookings; los 70 precios coinciden exactamente con el precio del CMS.
- Las 70 monedas comparables coinciden: EUR.
- Los 24 servicios F2 no tienen precio fijo nativo; son las fases sin cobro online separado.
- No hay discrepancias de moneda.
- Las duraciones nativas de Bookings coinciden con `phase1Duration` en F1 y `phase2Duration` en los F2 correspondientes; no se detectaron discrepancias en los 94 servicios.

**Conclusión:** no se detectan divergencias de precio o duración que alteren el importe nativo del checkout para los 70 servicios visibles. El checkout Cart V2 sigue pendiente de validación real de extremo a extremo.

## 1.3 Disponibilidad futura y gap dual

Consulta de solo lectura de Time Slots V2 para el intervalo local 2026-11-01 a 2026-11-08, zona Europe/Madrid, ubicación de negocio canónica y slots reservables.

Se encontraron combinaciones F1/F2 con el mismo resourceId y con inicio F2 exactamente igual a fin F1 más el tiempo de exposición configurado:

| Servicio | F1 | Exposición | F2 |
|---|---|---:|---|
| Coloración Raíces Perfectas | 09:00–09:30 | 30 min | 10:00–10:40 |
| Babylights: Mechas Naturales | 09:00–09:50 | 40 min | 10:30–11:30 |
| Terapia de Alisado Espejo Premium | 09:00–09:45 | 20 min | 10:05–11:00 |

Se encontraron 505, 455 y 485 combinaciones compatibles respectivamente en la ventana consultada. Los ejemplos corresponden al 3 de noviembre de 2026.

Esto confirma disponibilidad nativa compatible con el gap para estos tres pares. No demuestra creación de reservas, bloqueo concurrente, checkout, confirmación ni compensación; esas pruebas siguen pendientes en QA.

También se comprobó que schedule.lastSessionEnd en la respuesta de servicios no debe interpretarse como fecha límite de disponibilidad: servicios cuyo valor estaba en el pasado devolvieron slots reservables posteriores.

## 2. Profesionales y recursos de Bookings

La consulta de Staff Members V2 devolvió tres profesionales activos de servicio. Los identificadores se contrastaron con los registros CMS de `MapaStaff`.

| Profesional | Staff member ID | Resource ID | Events schedule ID |
|---|---|---|---|
| Marian | `0114748d-2806-3928-9b97-ff0d09853759` | `e556070a-6d6a-402e-8422-11133033ea76` | `06af20d4-1ec3-49fa-9075-f0691dfa7fd4` |
| Andrea | `bf177b1a-483a-4c03-9960-8da0aa0b8b41` | `07f7344f-e7e4-4c53-854b-47fd82ac8d40` | `a494b829-8161-4b84-b78d-6ffed45b4abe` |
| Alba | `c5563137-1124-4366-abe0-1afe56418968` | `9b905bfd-1a09-485d-9273-a24a20dfe648` | `94b8980d-63f4-43b1-ba86-41075e0eb63c` |

Los tres registros CMS de `MapaStaff` están activos y coinciden exactamente en `staffMemberId`, `resourceId` y `scheduleId` con la respuesta de Wix Bookings. La colección `MapaStaff` tiene revisión 13.

Los 94 servicios consultados tienen asignados exactamente los tres `staffMemberIds`. No se detectaron servicios sin personal asignado.

## 3. Implicaciones para el código

- El código debe seguir usando el `resourceId` de Bookings para disponibilidad y selección del recurso, no sustituirlo por `staffMemberId` ni por `scheduleId`.
- `staffMemberId` identifica al profesional de Bookings; `resourceId` identifica el recurso utilizado por slots y reservas; `scheduleId` identifica el calendario de eventos de ese recurso.
- El mapeo CMS actual no requiere corrección por discrepancia de identificadores.
- La separación de pagos F1/F2 es coherente con la configuración nativa observada: F2 no admite pago online. El backend debe mantener el cobro únicamente sobre F1 según la arquitectura aprobada.
- No se ha comprobado en esta auditoría la existencia de disponibilidad futura, los horarios de trabajo efectivos, el comportamiento de checkout, los webhooks ni las compensaciones de reserva dual.

## 4. Pruebas aún necesarias

1. Consultar disponibilidad de un servicio visible con cada profesional y comprobar que los slots devuelven el `resourceId` esperado.
2. Reservar en QA un servicio simple y comprobar el `staffMemberId`, `resourceId` y `scheduleId` persistidos.
3. Reservar en QA una combinación F1/F2 y comprobar `pairToken`, hueco entre fases, asignación del mismo profesional cuando proceda y cancelación compensatoria.
4. Confirmar checkout Cart V2, importe en EUR, pago de F1 y ausencia de cobro separado de F2.
5. Verificar que el evento nativo de Bookings confirma la reserva y que el evento de pago no la confirma por sí solo.

## 4. Persistencia real de reservas duales: CitasF2

La colección `CitasF2` existe en producción, revisión 19, con permisos de lectura/escritura restringidos a `ADMIN`.

Campos requeridos confirmados: `slotStart`, `slotEnd`, `totalAmount`, `bookingId`, `traceId`, `bookingType`, `bookingStatus`, `paymentStatus`, `serviceId`, `resourceId` y `dateYmd`. También existen `pairToken`, `scheduleId`, `meta`, `contactDetails` y campos de trazabilidad/fiscalidad.

Índices activos:
- `bookingId_unique`: índice único sobre `bookingId`.
- `idx_citasf2_resourceId`: índice regular sobre `resourceId`.
- `Índice regular de CitasF2 1`: índice regular sobre `pairToken`.

La unicidad de `bookingId` evita duplicar la proyección de una reserva nativa. `pairToken` no es único, como corresponde a una pareja F1/F2 que comparte el mismo token. El esquema y los índices observados son compatibles con el modelo de persistencia dual del proyecto.

## 5. Fuentes oficiales Wix consultadas

- Services V2 — Query Services: https://dev.wix.com/docs/api-reference/business-solutions/bookings/services/services-v2/query-services
- Staff Members V2 — Query Staff Members: https://dev.wix.com/docs/api-reference/business-solutions/bookings/staff-members/staff-members/query-staff-members-v-2
- CMS — Get Data Collection: https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-collections/get-data-collection
- CMS — Query Data Items: https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/query-data-items
