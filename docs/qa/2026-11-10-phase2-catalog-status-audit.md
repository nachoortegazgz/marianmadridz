# Auditoría de retirada de `status` en catálogos y personal — 2026-11-10

**Baseline:** `main` · `8297da04e56ef1a02b20abb16b9a643d853a13cb`  
**Sitio:** Marian Madrid · Wix CMS consultado en modo estrictamente de solo lectura.  
**Objetivo:** comprobar si existe un flujo de negocio basado en `status` para servicios, complementos o personal y retirar código obsoleto sin alterar datos ni contratos nativos.

## Resultado de la consulta CMS

| Colección | Registros | Campo `status` en esquema | Valores `status` en registros | Observación |
|---|---:|---|---|---|
| `ServiciosCatalogo` | 95 | No | 0 | Catálogo nativo de servicios; no requiere estado comercial paralelo |
| `ComplementosCatalogo` | 36 | No | 0 | Catálogo nativo de complementos; no requiere estado comercial paralelo |
| `MapaStaff` | 3 | No | 0 | Incluye `active: BOOLEAN`; los tres registros consultados tienen `active=true` |

La respuesta de Wix devolvió las revisiones de colección 194, 138 y 23, respectivamente. No se ha ejecutado ninguna escritura, migración, borrado de registros ni modificación de esquemas.

## Distinciones de contrato

- `MapaStaff.active` se conserva: el dossier lo declara como selector de la única correlación staffMemberId → resourceId/scheduleId que puede utilizar el lector de eventos. No es un estado comercial alternativo ni gobierna RBAC.
- `associatedWixIdentity.connection.status` se conserva en el adaptador de Bookings Staff API: describe el estado de conexión de la identidad nativa de Wix. Solo permite obtener contactId cuando la identidad está conectada.
- Los `status` de respuesta de WebMethods (`SUCCESS`, `ERROR`, `OK`) y los estados de reservas/pagos/controles/ledgers pertenecen a contratos distintos y no se eliminan por esta decisión.
- `_toPublicService` mantiene un DTO de allowlist que excluye cualquier `status` no canónico. La prueba `RES-DTO-01` verifica que tampoco se exponga si un dato histórico o inesperado llega al mapper.
- `normalizeCatalogAddOn` devuelve únicamente `addOnId`, `name` y `price`; no propaga campos arbitrarios como `status`.

## Deuda retirada

Se elimina `src/backend/staffManager.web.js`. El archivo solo exportaba tres stubs fail-closed (`getStaffList`, `getStaffHoursSummary`, `sendStaffNotification`) que devolvían `STAFF_OPERATION_NOT_IMPLEMENTED`. La búsqueda completa del repositorio no encontró imports ni consumidores en `src/`, páginas, widgets HTML o tests. Los WebMethods canónicos de identidad, roles y fichajes están en `staff.js`, `security.js` y `horario.web.js`.

No se elimina la gestión de personal nativa de Wix Bookings ni la colección `MapaStaff`.

## Estado de las páginas

- ZONA STAFF continúa fail-closed con fichajes y caja deshabilitados. La tarea de conectar sus mensajes a `horario.web.js` y `cajas.web.js` sigue abierta en [#224](https://github.com/nachoortegazgz/marianmadridz/issues/224).
- ZONA MARIAN conserva la lectura de caja/fiscal y las acciones ya conectadas. Los envíos al gestor continúan deshabilitados hasta que exista snapshot persistido e idempotencia.
- No se activan acciones de escritura ni se ejecutan fichajes, movimientos de caja, cierres Z o envíos de documentos durante esta auditoría.

## Validación requerida

- CI del PR: pruebas offline, contratos SDK y ESLint.
- Revisión del diff y confirmación de ausencia de imports/consumidores.
- Wix Preview/entorno publicado: pendiente. La consulta CMS confirma esquemas y registros actuales, pero no acredita el runtime de páginas ni WebMethods.

**Conclusión:** no existe un campo ni flujo CMS `status` para servicios, complementos o personal que deba migrarse o borrarse. Se retira únicamente el módulo de stubs demostrado como no consumido. Se preservan `active` y los estados técnicos/nativos legítimos.
