# QA — Alineación ZONA STAFF / ZONA MARIAN / Wix Bookings

**Fecha:** 2026-11-11  
**Base:** `main` al iniciar la rama `fix/staff-zone-bookings-alignment-2026-11-11`  
**Ámbito:** controladores Velo, widgets HTML, resolución de identidad Bookings y separación de responsabilidades.  
**Fuera de alcance:** auditoría de seguridad CMS (pausada), escritura de datos Wix, creación/cancelación de reservas, fichajes reales, pagos y publicación del sitio.

## 1. Resultado ejecutivo

Se corrige una ambigüedad real en la resolución de horarios de personal y se alinea el nombre de una capacidad del widget de ZONA STAFF. ZONA MARIAN no requiere cambio funcional: ya concentra caja/fiscalidad y aplica autorización de manager; se preserva ese límite en pruebas de contrato. No se añade una agenda paralela: Wix Bookings continúa siendo autoridad de reservas y disponibilidad.

## 2. Diagnóstico y evidencia

### ZONA STAFF

- Controlador: `src/pages/ZONA STAFF.mvf3f.js`.
- Widget: `#htmlOnlyStaffPanel`, fuente `#htmlOnlyStaff.txt`.
- Capacidades existentes: estado de jornada, historial de fichajes y cálculo de horas.
- El flag `enableScheduleQuery` únicamente controlaba la visibilidad del panel de cálculo de horas; no consultaba ninguna agenda.
- No se exponen escrituras de fichaje, ajustes laborales, caja ni inventario desde el bridge.

### ZONA MARIAN

- Controlador: `src/pages/ZONA MARIAN.gn7mx.js`.
- Widget: `#htmlAdmin` / `#htmlAdministracion`.
- Capacidades existentes: estado de caja, cierre Z, resumen fiscal, libro de facturas y preparación/descarga documental.
- La página exige `access.isMarianManager === true`; las operaciones continúan delegadas en WebMethods backend.
- No importa funciones de jornada ni muestra el panel de fichajes. No se duplica la agenda de Bookings.

### Wix Bookings — distinción de IDs

La normalización anterior elegía `workingHoursSchedules[0]._id` antes que `resource.eventsSchedule._id` y publicaba ambos conceptos bajo `scheduleId`. Esto podía entregar un identificador de horario laboral como fallback para el calendario de eventos del profesional.

La receta oficial de Wix distingue:
- `staffMemberId`: identidad del perfil de personal.
- `resourceId`: recurso Bookings asociado.
- `resource.eventsSchedule.id`: identificador del calendario de eventos del personal; Wix lo utiliza como `scheduleId` al asignar horarios laborales y crear eventos `WORKING_HOURS`.
- Horarios laborales y calendario de eventos no deben tratarse como el mismo identificador.

Fuentes oficiales:
- [Bookings Staff Setup](https://dev.wix.com/docs/api-reference/business-solutions/bookings/skills/bookings-staff-setup)
- [Bookings Architecture and Data Flow](https://dev.wix.com/docs/api-reference/business-solutions/bookings/architecture)
- [Create Booking](https://dev.wix.com/docs/api-reference/business-solutions/bookings/bookings/bookings-writer-v2/create-booking)

El método `bookingCore._resolveScheduleIdForResource()` conserva primero el `scheduleId` explícito recibido en el slot y solo utiliza la resolución del staff como fallback. Por eso el fallback ahora obtiene explícitamente `eventsScheduleId`; no se altera el slot recibido desde disponibilidad.

## 3. Cambios implementados

1. `backend/staff.js`
   - Expone `workingHoursScheduleIds`, `workingHoursScheduleId` y `eventsScheduleId` por separado.
   - El campo de compatibilidad `scheduleId` queda alineado con `eventsScheduleId`.
   - Sustituye `getStaffScheduleId()` por `getStaffEventsScheduleId()`.

2. `backend/booking/bookingCore.js`
   - Usa `getStaffEventsScheduleId()` en la resolución fallback.
   - No cambia la prioridad del `scheduleId` explícito del slot nativo.

3. `pages/ZONA STAFF` y `#htmlOnlyStaff.txt`
   - Renombra `enableScheduleQuery` a `enableHoursCalculation`.
   - No cambia mensajes, WebMethods, límites de fechas ni operaciones habilitadas.

4. Pruebas
   - Identificadores de horarios laborales y calendario de eventos con valores deliberadamente distintos.
   - Verificación de que la resolución usa el calendario de eventos.
   - Verificación fail-closed cuando falta `eventsSchedule`.
   - Contrato del nuevo flag del widget.
   - Separación de responsabilidades entre ZONA STAFF y ZONA MARIAN.

## 4. Decisión de arquitectura

| Capacidad | Autoridad |
|---|---|
| Identidad de miembro | Wix Members |
| Perfil profesional y recurso | Wix Bookings Staff |
| Horarios y disponibilidad | Wix Bookings |
| Reservas y agenda de citas | Wix Bookings |
| Fichajes e historial laboral | Backend Velo + ledger CMS propio |
| Cálculo de horas | Backend Velo |
| Caja y cierre Z | Backend Velo |
| Libros y consolidación fiscal | Backend Velo |
| Supervisión administrativa | ZONA MARIAN |
| Autoservicio laboral | ZONA STAFF |

No se añade agenda de citas en ZONA STAFF ni supervisión de fichajes en ZONA MARIAN: no existe criterio de aceptación aprobado que justifique duplicar esas vistas en esta intervención.

## 5. Validación y límites

- [x] Inspección de consumidores internos de `getStaffScheduleId`: se localizó el uso en `bookingCore.js`; se actualizó explícitamente.
- [x] Revisión de la semántica oficial de Wix para `eventsSchedule`.
- [x] Pruebas de contrato actualizadas.
- [x] Separación de responsabilidades de ambas zonas congelada por test.
- [x] Suite CI: 53 suites / 526 tests / 526 pass / 0 fail (run 42955207213, job 130308627671).
- [x] Contratos SDK: eCommerce Cart V2, Wix Data y Bookings Reader V2.
- [x] ESLint: correcto.
- [ ] Wix Local Editor / E2E visual: no disponible en este entorno.
- [ ] Validación runtime en sitio publicado: no ejecutada.
- [ ] Prueba real de reserva o fichaje: no ejecutada ni necesaria para este cambio.
- [x] No se modificaron datos CMS, perfiles de staff, horarios, reservas, pagos, caja ni ledgers.
- [x] No se enviaron comunicaciones ni se publicó Velo en Wix.

## 6. Riesgos y reversión

El cambio afecta únicamente al fallback interno de resolución de calendario cuando un slot no aporta `scheduleId`. Los slots que ya aportan el identificador nativo mantienen prioridad y no se reescriben. La reversión consiste en revertir el commit de la rama si CI detecta incompatibilidad; no requiere ni autoriza modificar datos históricos o configuración de Wix.

**Estado:** CI offline y lint aprobados; revisión funcional de código completada. PR abierta para revisión. La validación visual/runtime en Wix sigue pendiente; no se declara desplegado ni certificado el comportamiento publicado.
