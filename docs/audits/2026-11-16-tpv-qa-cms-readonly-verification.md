# Verificación read-only del TPV QA y estado del sitio

**Fecha:** 2026-11-16 23:09 Europe/Madrid  
**Site ID:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Repositorio:** `nachoortegazgz/marianmadridz`  
**Tipo:** auditoría read-only; cero escrituras en Wix.

## 1. Estado del sitio

- GetSiteContext: sitio Marian Madrid Peluquería y Estética, estado `Draft`, tipo de editor `Editor` (Wix Classic), Velo habilitado.
- El propietario confirma que el sitio está despublicado y que la pasarela de pagos está desconectada.
- La condición Draft está verificada por Wix. La desconexión de la pasarela sigue siendo declaración del propietario; no se inspeccionó la configuración del proveedor en Dashboard.
- No se generó Preview, no se publicó y no se modificaron páginas ni código del sitio.

## 2. Automatizaciones

Consulta Wix Automations V2 filtrada por `configuration.status=ACTIVE`, seguida de Get Automation individual:

- 7 automatizaciones ACTIVE, confirmadas 7/7.
- Las siete son PREINSTALLED, todas con `settings.disableStatusChange=true`; dos también tienen `settings.readonly=true`.
- Triggers/efectos: tarjeta guardada → email; notificación de Agent Maker → email; Aria → notificación de plataforma; confirmación de miembro → email; confirmación de suscripción → email; límite de elementos CMS → email; reset de contraseña → email.
- Automatización custom `Creación de TPV física personalizada`, ID `961f911d-8386-4e20-843e-cdf4595c24e8`: `INACTIVE`, revisión 4, confirmada por Get Automation. No se ha cambiado su estado.
- La tarea vinculada `d56d7590-7eb7-4e4f-94ac-2ca9fa465fcf` sigue sin inspección. List Tools Providers y List App Skills devolvieron listas vacías. No se encontró API pública documentada de Agent Maker que exponga esa definición; no se confundió con CMS Background Tasks ni CRM Tasks.

La automatización custom está inactiva y su trigger programado no es elegible para nuevos disparos. Las siete preinstaladas permanecen activas y bloqueadas; no ejecutar flujos de miembros, suscripciones, tarjetas guardadas, reset de contraseñas, notificaciones de agente/Aria ni cargas masivas CMS. El trigger de límite CMS aconseja comprobar primero el uso total/cuota antes de cualquier inserción de prueba.

## 3. Colecciones CMS TPV

Las nueve colecciones verificadas existen en Wix CMS:

| Colección | Elementos | Índice único `idempotencyKey` |
|---|---:|---|
| `TPV_QA_Ventas` | 0 | ACTIVE |
| `TPV_QA_VentaLineas` | 0 | ACTIVE |
| `TPV_QA_Pagos` | 0 | ACTIVE |
| `TPV_QA_Reembolsos` | 0 | ACTIVE |
| `TPV_QA_MovimientosCaja` | 0 | ACTIVE |
| `TPV_QA_SesionesCaja` | 0 | ACTIVE |
| `TPV_QA_TicketX` | 0 | ACTIVE |
| `TPV_QA_TicketZ` | 0 | ACTIVE |
| `TPV_QA_Auditoria` | 0 | ACTIVE |

Todas las colecciones son NATIVE y tienen permisos CMS `insert=ADMIN`, `update=ADMIN`, `remove=ADMIN`, `read=ADMIN`. Los esquemas contienen los campos consumidos por los módulos TPV (cabeceras, importes minor-unit, payload y clave idempotente). No se modificaron permisos ni índices.

## 4. Locks y política de acceso

- `ControlOperativo`: 58 elementos en total.
- Query por `TPV_QA_SESSION_LOCK` y `TPV_QA_REFUND_LOCK`: cero registros.
- `src/backend/dataAccess.js` usa `auth.elevate` para las operaciones CMS; `insertItem` pasa por `assertInsertAllowed` y `bulkPatchItems` por `assertBulkPatchAllowed`.
- La suite `tpv.qa.persistence.policy.test.mjs` prueba que las colecciones QA son insert-only y que los locks solo admiten cambios CAS tipados.
- Los nueve recuentos cero no prueban la cuota total del CMS ni la ausencia de otros elementos en el sitio; el trigger preinstalado de aviso de límite CMS sigue activo.

## 5. Revisión estática de frontera sintética

Los módulos versionados limitan las escrituras TPV a `TPV_QA_*`, marcan los registros como sintéticos, rechazan reservas reales, usan fixtures para cliente/profesionales, bloquean Gift Cards reales, y mantienen deshabilitados pagos reales, escrituras fiscales, notificaciones y hardware. Los writers operativos legacy de ventas y devoluciones devuelven error bloqueado. La persistencia de una venta QA es una saga multi-colección, no una transacción ACID; el código implementa reintentos idempotentes y locks CAS.

Esto es evidencia de código y tests offline, no una prueba de comportamiento en Wix Runtime.

## 6. Decisión de ejecución

**Permitido como siguiente paso:** generar Preview después de configurar el secreto GitHub `CLI_API_KEY`; ejecutar en Preview solo carga, autorización y métodos de lectura (catálogo Bookings/Stores, configuración y permisos). No disparar eventos de miembros, tarjetas, suscripciones, notificaciones, reset de contraseña ni operaciones de negocio.

**Todavía bloqueado:** escrituras sintéticas CMS, concurrencia/idempotencia runtime, devoluciones, cierres, checkout y E2E. Antes de cualquier escritura se debe revisar uso global/cuota CMS por el trigger de límite de elementos y preparar una ejecución controlada con IDs y claves sintéticas nuevas. No usar datos reales.

## 7. Acciones realizadas / no realizadas

- Realizadas: lecturas Wix de contexto, automatizaciones, colecciones, índices, conteos y locks; inspección estática de módulos/tests; verificación GitHub de PR #402 y checks.
- No realizadas: inserciones o cambios CMS, mutación de automatizaciones, ejecución de tareas IA, Preview, Publish, pagos, reservas, emails, notificaciones o llamadas a terceros.

## 8. Fuentes oficiales

- Wix Automations V2: https://dev.wix.com/docs/api-reference/business-management/automations/automations/automations-v2/query-automations
- Wix Automations Get: https://dev.wix.com/docs/api-reference/business-management/automations/automations/automations-v2/get-automation
- Wix CMS List Data Collections: https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-collections/list-data-collections
- Wix CMS List Indexes: https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/indexes/list-indexes
- Wix CMS Count Data Items: https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/count-data-items
- Wix App Tools List Providers: https://dev.wix.com/docs/api-reference/app-management/app-tools/tools-host/list-tools-providers
- Wix App Skills List: https://dev.wix.com/docs/api-reference/app-management/app-skills/list-app-skills
