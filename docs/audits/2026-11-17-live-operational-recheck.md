# Revisión operativa live — 2026-11-17

## Entorno y publicación

- Site ID: `188bed94-177c-4bc9-a9f0-35080d874f3e`.
- Wix Editor Classic; Velo habilitado.
- `GetSiteContext` devuelve **Draft**.
- No se ha ejecutado Preview ni Publish.
- No se han realizado reservas, pagos, reembolsos, escrituras fiscales, notificaciones de prueba ni cambios en datos transaccionales.

## Permisos CMS

Hito aplicado en Wix y documentado en `2026-11-17-cms-permissions-hardening.md`:

- 19 colecciones operativas/TPV QA: cuatro acciones `PRIVILEGED`.
- `ServiciosCatalogo` y `ComplementosCatalogo`: lectura `CMS_EDITOR`; inserción/actualización/eliminación `CMS_EDITOR`.
- Las 21 colecciones tienen read-back confirmado.
- Los dos catálogos se restringieron porque `ServiciosCatalogo` contiene `margin`, `internalNotes`, `precioCosteBase`, y `ComplementosCatalogo` contiene clasificación fiscal/contable. Las páginas de servicio/calendario consumen el WebMethod `getServiceBySlugOrId`, que devuelve `_toPublicService` con allowlist. La prueba offline `RES-DTO-01` cubre la exclusión de campos internos.
- Colecciones Wix App sin cambios; los permisos del sistema Wix no se han alterado.

## Reconciliación fiscal: bloqueo P0

Lecturas live de Wix Data:

- `DatosFiscales`: no existe; la API devuelve `WDE0025`.
- `InventarioStockVenta`: no existe; la API devuelve `WDE0025`.
- `MovimientosInventario`: no existe; la API devuelve `WDE0025`.
- `MapaStaff`: 43 campos y 5 registros. El esquema físico incluye `recordType`, `taxId`, `legalName`, `thirdPartyType`, `taxRegime`, `verifactuEnabled`, `fiscalIdType` y campos de identidad Wix.
- Los cinco registros devuelven tipos `GESTORIA` (1), `TERCERO` (1) y `STAFF` (3). No se exportaron valores identificativos. Los cinco tienen `taxId` y `legalName` informados.
- No existe un registro `CONFIG_SISTEMA` en los cinco registros consultados.

Contradicción con main:

- `src/backend/internalConfig.js` declara `BUSINESS_COLLECTIONS.DATOS_FISCALES = "DatosFiscales"`.
- `src/backend/eventLog.js`, `fiscalAggregator.web.js`, `fiscalDocuments.web.js`, `dataAccessPolicy.js`, `data.js` y pruebas siguen consumiendo esa colección.
- La colección no existe físicamente. Por tanto, esos flujos no pueden considerarse operativos contra el CMS live.
- Existe una rama histórica de consolidación MapaStaff, pero está 909 commits detrás de main y no se puede integrar como solución directa. No se ha reutilizado.
- La documentación histórica contiene contratos contradictorios sobre si MapaStaff es exclusivamente identidad staff o maestro consolidado fiscal.

**Decisión:** no crear `DatosFiscales`, no copiar ni mover registros, no inventar identidad fiscal ni configurar emisor. Se requiere reconciliar el contrato canónico con la evidencia física actual. El maestro fiscal y la configuración SIF deben quedar resueltos y probados antes de activar writers. La configuración `CONFIG_SISTEMA` está ausente.

## Compensaciones y caja

Consulta live de `ControlOperativo`, filtrada por `controlType=COMPENSATION`:

- 3 registros.
- Los 3 están `PENDING_RECOVERY`, `kind=FISCAL_LEDGER`, `attempts=0`.
- Un registro indica `ORIGINAL_ORDER_LEDGER_MISSING`.
- Dos indican que la escritura fiscal permanece deshabilitada hasta completar certificación de runtime.
- No se reintentaron, actualizaron ni marcaron como resueltos. No hay base para descartar una operación económica ni fabricar el ledger ausente.

Consulta live de `CajaActual`:

- Un singleton con `cashRegisterStatus=ABIERTA`.
- `openedAt=2026-11-14T06:00:00Z`.
- `lastMovementAt=2026-11-12T23:00:00Z`.
- `expectedCash=300`.
- La última actividad registrada precede a la apertura declarada. Se requiere reconciliación antes de cualquier cierre o writer; no se modificó la proyección ni se insertaron movimientos.


Recuentos mínimos consultados en la misma sesión (Wix Data Query API, `returnTotalCount=true`): `MovimientosCaja=0`, `LibroAsientosContablesDetalle=0`, `HistoricoCierresZ=0`, `PaquetesGestoria=0`, `CitasF2=6`, `TPV_QA_Ventas=0`. No se devolvieron valores de registros en esta consulta.

Seguimiento: issue P0 #416 documenta la reconciliación de las compensaciones y el singleton de caja: https://github.com/nachoortegazgz/marianmadridz/issues/416

## Automatizaciones Wix

Query Automation API filtrada por `configuration.status=ACTIVE` devolvió exactamente 7 resultados, sin cursor siguiente. Se ejecutó Get Automation para cada uno y se confirmó el estado.

Las 7 son `PREINSTALLED` y tienen `disableStatusChange=true`:

1. Notify customer when you save their card details.
2. Send an email to proceed with a task.
3. Aria Assistant send wix notification.
4. Send email confirmation to site members.
5. Send subscription confirmation email.
6. cms items limit warning email.
7. Send site members a reset password email.

Dos además tienen `settings.readonly=true`. Todas contienen acciones de email o notificación. No se cambiaron ni se ejecutaron: los eventos de prueba podrían producir comunicaciones reales y las automatizaciones están bloqueadas por sus aplicaciones propietarias. Las automatizaciones inactivas no se han recorrido exhaustivamente en este hito.

## Jobs backend y configuración fiscal

- `src/backend/jobs.config` declara 15 jobs.
- Los 15 nombres tienen exportación correspondiente en `src/backend/crons.js` (comparación estática).
- No se ha acreditado su instalación ni ejecución en Wix runtime.
- `FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED=false`.
- `ACCOUNTING_LEDGER_WRITES_ENABLED=false`.
- `ALLOW_SIMULATION_RECORDS=false`.
- Las escrituras de jornada y ajustes siguen deshabilitadas.

## GitHub y CI

- Main auditada: `f94e1e0f4a3e6f99fbfaab604474996b3ac0df4e`.
- PR #414 contiene documentación de permisos, no código runtime.
- PR #414 es mergeable, pero no se devolvieron workflow runs ni combined status para su SHA. No se declara CI verde.
- El combined status consultado para main también devolvió una lista vacía; no se interpreta como aprobación.
- Issue #210 confirma que main carece de branch protection/required checks. La integración GitHub disponible no expone una operación para cambiar branch protection/rulesets.
- No se ha demostrado read-back de SHA GitHub → Wix Editor.

## Estado de aceptación

**NO-GO.** Las correcciones de permisos reducen la exposición CMS, pero los siguientes bloqueos siguen abiertos:

1. Código fiscal consulta una colección ausente (`DatosFiscales`) y no existe configuración `CONFIG_SISTEMA`.
2. Tres compensaciones fiscales continúan pendientes.
3. La caja tiene una inconsistencia temporal que requiere reconciliación.
4. No se ha ejecutado runtime Wix tras los cambios de permisos.
5. No se han validado Bookings, TPV, Stores, área de cliente, automatizaciones ni jobs en E2E.
6. No se ha acreditado SIF/VERI*FACTU ni integración AEAT.
7. Main sigue sin protección de rama y required checks.
8. No se ha demostrado sincronización del código con Wix Editor.

No publicar ni activar writers/efectos externos hasta cerrar estos puntos con pruebas reproducibles. La discrepancia fiscal está registrada en #415 y la reconciliación operativa en #416.
