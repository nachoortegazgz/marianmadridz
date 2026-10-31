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

## 5. Fuentes oficiales Wix consultadas

- Services V2 — Query Services: https://dev.wix.com/docs/api-reference/business-solutions/bookings/services/services-v2/query-services
- Staff Members V2 — Query Staff Members: https://dev.wix.com/docs/api-reference/business-solutions/bookings/staff-members/staff-members/query-staff-members-v-2
- CMS — Get Data Collection: https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-collections/get-data-collection
- CMS — Query Data Items: https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/query-data-items
