# Auditoría read-only Wix — baseline del sitio 2026-11-21

**Sitio:** Marian Madrid Peluquería y Estética  
**URL:** https://www.marianmadrid.es/  
**Site ID:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Repositorio:** `nachoortegazgz/marianmadridz`  
**HEAD main:** `e75aec5d28dcb8560fe75dbd04d5eae95957c3d8`  
**Baseline funcional TPV:** PR #516, commit `6bf263502c58fa28bd13f7db848553c18b34a323`  
**Fecha de consulta:** 2026-11-21  
**Método:** Wix Site Context, Wix CMS Data Collections, Wix Data Items API, Site Data Usage API, Automations V2, GitHub y escaneo Accessibility Scans API. Todas las consultas de datos fueron read-only. No se hicieron escrituras CMS, cambios de automatizaciones, sincronizaciones ni publicaciones.

## 1. Dictamen

El sitio existe, está publicado y tiene Velo habilitado. El propietario lo clasifica expresamente como entorno único de desarrollo/QA, sin actividad económica real y con datos sintéticos. Esa clasificación funcional prevalece sobre el metadato Published, pero no elimina el riesgo técnico de que el sitio publicado reciba tráfico o ejecute automatizaciones.

**Estado: NO-GO para pruebas E2E que puedan disparar efectos externos y NO-GO para release.**

Bloqueos prioritarios verificados:
1. Ocho automatizaciones aparecen ACTIVE; siete preinstaladas están bloqueadas por settings y una automatización de aplicación delega una tarea a un agente LLM mediante trigger programado. Sus efectos y ejecución no están acreditados.
2. El CMS management read-only muestra una caja LIVE ABIERTA sin marcador TPV Sandbox y dos movimientos sin el contrato sintético completo esperado.
3. Site Data Usage confirma dos movimientos en LIVE y dos en SANDBOX, pero la API de uso no expone su contenido ni IDs; los elementos Sandbox no se han inspeccionado en el Editor.
4. `TpvSandboxIdentities` tiene cero elementos en LIVE y SANDBOX; el código TPV exige seis identidades presembradas.
5. Hay tres operaciones `PENDING_RECOVERY` en `ControlOperativo`, sin intentos de recuperación.
6. El escaneo de accesibilidad full-site sigue en curso y todavía no ha procesado páginas; no puede considerarse un resultado limpio.

## 2. Contexto del sitio Wix

GetSiteContext confirma:
- Wix Editor Classic.
- Velo habilitado.
- Estado Wix: Published.
- Idioma español; moneda EUR; zona horaria Europe/Madrid.
- Wix Bookings instalado.
- Wix Stores Catalog V3.
- Wix Members, Wix Payments, Wix Invoices V1, Wix Forms, Gift Cards, Wix Blog y herramientas SEO instaladas.

La instalación de una app no demuestra que su configuración, credenciales, métodos de pago, notificaciones o flujos estén operativos. El estado Published tampoco identifica el SHA de código Velo que está instalado. La sincronización Git ↔ Editor y el read-back del código instalado siguen sin acreditarse.

La SSOT del propietario mantiene la clasificación funcional del sitio como QA único. No debe reinterpretarse como sitio de producción por el mero hecho de estar Published.

## 3. GitHub y CI

- `main` HEAD: `e75aec5d28dcb8560fe75dbd04d5eae95957c3d8`.
- La secuencia desde PR #516 contiene únicamente los merges documentales #517 y #518 después del merge funcional #516; el baseline TPV funcional permanece en `6bf263502c58fa28bd13f7db848553c18b34a323`.
- Backend offline quality gates en HEAD: run [44867151597](https://github.com/nachoortegazgz/marianmadridz/actions/runs/44867151597) — SUCCESS.
- Secret scanning en HEAD: run [44867151605](https://github.com/nachoortegazgz/marianmadridz/actions/runs/44867151605) — SUCCESS.
- `main` devuelve `protected=false`; no hay protección de rama ni required checks acreditados.
- PR #495 sigue abierta y su rama no es mergeable contra el main actual. No fusionar ni cherry-pick sin revisar cada cambio contra la arquitectura TPV vigente; la PR #516 ya cambió el contrato de identidad y el bridge.

CI PASS demuestra calidad offline en ese SHA, no runtime Wix ni sincronización del Editor.

## 4. Inventario CMS

El inventario Wix CMS devuelve 42 colecciones: 13 NATIVE y 29 WIX_APP. El Site Data Usage API reporta uso por colección de las 13 colecciones NATIVE; no devuelve el contenido de los elementos.

### 4.1 Uso actual LIVE/SANDBOX

Fuente: Get Site Data Usage con `consistentRead=true`, 2026-11-21.

| Colección NATIVE | LIVE elementos | SANDBOX elementos |
|---|---:|---:|
| CajaActual | 1 | 1 |
| MovimientosCaja | 2 | 2 |
| TpvSandboxIdentities | 0 | 0 |
| ControlOperativo | 58 | 0 |
| HistoricoCierresZ | 0 | 0 |
| CitasF2 | 6 | 6 |
| ServiciosCatalogo | 95 | 95 |
| MapaStaff | 5 | 5 |
| ComplementosCatalogo | 36 | 0 |
| PaquetesGestoria | 0 | 0 |
| RegistroIntegracion | 0 | 0 |
| RegistrosHorariosStaff | 0 | 0 |
| LibroAsientosContablesDetalle | 0 | 0 |
| **Total** | **203** | **109** |

Uso total informado:
- LIVE: 203 elementos / 266.227 bytes; última actualización de contenido 2026-11-21T04:12:31Z.
- SANDBOX: 109 elementos / 206.023 bytes; última actualización de contenido 2026-11-21T04:01:09Z.

Respecto al snapshot del 20/11 (201 LIVE / 107 SANDBOX), ambos entornos aumentaron en dos elementos. El API de uso confirma recuentos y bytes, no que los elementos LIVE y SANDBOX sean los mismos ni qué WebMethod utiliza cada entorno.

**Límite:** la consulta de Wix Data Management API no es prueba del contexto de ejecución de una llamada WebMethod. El contenido de Sandbox debe inspeccionarse desde el Editor/Preview con el entorno explícitamente seleccionado.

### 4.2 CajaActual LIVE

Consulta CMS Management API read-only del singleton `singletonKey=CAJA_PRINCIPAL`:

| Campo | Valor observado |
|---|---|
| cashRegisterStatus | ABIERTA |
| openingCashAmount | 300 EUR |
| cashAmount | 320 EUR |
| expectedCash | 320 EUR |
| countedCash | 0 EUR |
| difference | 0 EUR |
| snapshotSource | MOVIMIENTOS_CAJA_RECONCILIADOS |
| traceId | 0 |
| lastOperationType | RECONCILIATION_CORRECTION |

La caja no lleva `snapshotSource=TPV_SANDBOX_INITIALIZED` ni `TPV_SANDBOX_SYNTHETIC`, y su traza no coincide con el `SANDBOX_RUN_ID` del código. No satisface `assertSandboxCajaWritable`; no debe ser utilizada por el TPV Sandbox ni sobrescrita para hacer pasar la prueba.

La combinación `countedCash=0` y `difference=0` no acredita un arqueo conciliado. Debe aclararse si el arqueo está pendiente o si el valor cero es un dato por defecto. No corregirlo sin un procedimiento trazable y aprobación del propietario.

### 4.3 MovimientosCaja LIVE

La consulta read-only devolvió dos registros:
- 25 EUR, `paymentMethod=CARD`, `traceId=0`.
- 20 EUR, `paymentMethod=CASH`, `traceId=0`.

No se devolvieron valores para los campos que el repositorio TPV utiliza para identificar el ledger sintético: `recordSource`, `movementType`, `sequenceNumber`, `recordTimestamp`, `transactionId`, `payloadFiscal` y marcadores de run. La presencia física de esos campos en el esquema no equivale a que estén poblados en cada fila.

La aritmética de negocio 300 EUR de apertura + 20 EUR en efectivo = 320 EUR de efectivo esperado; más 25 EUR en tarjeta = 45 EUR de tickets, coincide con los importes parciales del smoke comunicado. Esto es una conciliación aritmética, no certificación del ledger: los dos registros no muestran el contrato sintético completo.

Site Data Usage también muestra dos elementos en SANDBOX, pero su contenido no ha sido leído. No asumir que son iguales a los dos elementos LIVE.

### 4.4 ControlOperativo y recuperaciones

La colección LIVE contiene 58 elementos. La lectura de control identificó tres registros `FISCAL_LEDGER/PENDING_RECOVERY`, todos con `attempts=0`. Uno conserva `ORIGINAL_ORDER_LEDGER_MISSING`.

No reintentar, borrar, modificar ni cerrar estos registros. La recuperación exige reconstruir primero la saga y correlacionar el pedido, el pago, la reserva y el ledger original. La corrección debe ser un nuevo registro trazable si el contrato lo exige.

### 4.5 Identidades TPV

`TpvSandboxIdentities` está creada con 14 campos y permisos CMS ADMIN, pero el recuento es cero tanto en LIVE como en SANDBOX. El repositorio TPV actual verifica seis identidades y falla cerrado si faltan. No las crea por sí mismo.

## 5. Automatizaciones y efectos externos

Consulta de Automations V2:
- 159 automatizaciones descubiertas.
- Ocho aparecen ACTIVE en Query y se confirmó su estado individual mediante Get Automation.
- Siete son PREINSTALLED; las siete tienen `settings.disableStatusChange=true`. Incluyen acciones de correo y una notificación de plataforma. No intentar sortear las restricciones ni desinstalar apps para neutralizarlas.
- Una es de origen APPLICATION: **Configuración de control laboral**, ID `6e80b403-4903-4c5a-bfb7-d3b40ed014be`, revisión 4, ACTIVE. Tiene trigger `wix_automations-scheduled_trigger`, `automationConfigMapping.startDate=2026-11-21T05:00:00+01:00` y acción `agent_maker-delegate_to_llm` con `taskId=83527028-12e2-4462-9baf-4e2ec25db63c`. Su `settings.disableStatusChange=false`, pero la acción está marcada permanent/read-only. No se ha inspeccionado la definición completa de la tarea ni su historial de ejecución; no se ha ejecutado ni modificado.

La existencia de una automatización ACTIVE significa que puede recibir nuevos eventos; no prueba que haya ejecutado correctamente ni que vaya a enviar un mensaje. El riesgo de la tarea LLM no está acotado. Las pruebas que puedan disparar automatizaciones, registros de miembros, tarjetas, reservas o notificaciones permanecen bloqueadas hasta inspeccionar sus efectos y acordar una contención soportada.

## 6. Accesibilidad

- Scan anterior: `e579dde7-de12-4bb6-9e27-9a6887fa01ce`, creado el 11/11. Resultado PARTIALLY_COMPLETED: 122 páginas descubiertas, 0 procesadas y 122 fallidas.
- Scan nuevo: `aae3b411-81ff-4309-a767-6301164cb483`, iniciado el 21/11 para full-site. Estado terminal: PARTIALLY_COMPLETED, 121 páginas descubiertas, 0 procesadas, 121 fallidas, 0 pendientes. Los 121 fallos comparten `ACCESSIBILITY_SCAN_FAILURE_CODE_ANALYSIS_FAILED` / `This page could not be checked.`; 0 findings y 0 coverage útil. Las URLs descubiertas usan el host `nachoortegazgz.wixsite.com/marianmadrid`, no el dominio público personalizado. La causa no está identificada; el escaneo no prueba accesibilidad ni ausencia de problemas.

No declarar el sitio accesible ni limpio. Se recuperaron los 121 resúmenes de página y el listado de findings (cero). Una página fallida es estado desconocido, no página sin problemas. El siguiente paso es diagnosticar por qué Wix no puede analizar las URLs wixsite.com enumeradas y repetir el scan solo después de resolver el origen.

## 7. Código y contratos Wix que requieren revisión

- El backend contiene 21 archivos con import `wix-web-module`. La documentación SDK actual de Wix para Web Methods documenta `@wix/web-methods`, `webMethod()`, `Permissions` y archivos `.web.js`. No se declara `wix-web-module` deprecated sin una fuente oficial que lo confirme para Wix Editor Classic. Realizar una prueba de compatibilidad y migración controlada antes de cambiar masivamente imports.
- `tpvSandboxRepository.js` persiste eventos sintéticos como filas marcadas en `MovimientosCaja`, usa locks CAS en `ControlOperativo` y actualiza la proyección `CajaActual`. Las entidades `SANDBOX_LOGICAL_*` son claves internas, no colecciones físicas.
- `cajas.web.js` mantiene el writer de caja normal. Su helper de proyección realiza lectura, cálculo y actualización de elemento completo con reintentos; no incluye CAS en ese helper. Debe demostrarse que todos los escritores concurrentes comparten serialización efectiva y no pierden actualizaciones. No sustituir por una reescritura global sin revisar callers, locks, secuencia fiscal y compensaciones.
- Wix Bookings visitor-facing debe conservar identidad del visitante y contexto/token apropiado; los endpoints de gestión con credenciales del propietario no son intercambiables con el flujo de compra del visitante. Revisar cada consumidor de Bookings y Cart V2 contra el contrato oficial.

## 8. Restricciones y siguientes acciones

1. Inspeccionar la tarea LLM y los siete flujos preinstalados; no ejecutarlos ni sortear sus locks. Decidir contención de la automatización de control laboral antes de pruebas persistentes.
2. En Wix Editor, comprobar explícitamente Sandbox, inspeccionar el singleton Sandbox y los dos movimientos Sandbox, y exportar evidencia read-only. No sincronizar Sandbox → Online.
3. Recuperar el informe smoke TPV íntegro y conciliarlo con los elementos de ambos data planes.
4. Verificar las seis identidades sintéticas en Sandbox. Solo después, presembrar desde el CMS Sandbox si el contrato exacto y la autorización de escritura están acreditados.
5. Resolver H-01: inventariar todos los escritores de `CajaActual`, demostrar lock/CAS compartido y probar lost update, timeout incierto, reintentos e idempotencia.
6. Conciliar los tres `PENDING_RECOVERY` sin reintento ciego.
7. Ejecutar TPV E2E solo tras demostrar el data plane y contener automatizaciones/efectos externos.
8. Validar Bookings, Store Catalog V3, pagos de prueba, miembros, gift cards, formularios, webhooks y Capa 3 en pruebas aisladas.
9. Completar accesibilidad, SEO, responsive, navegación, formularios y revisión legal.
10. Mantener NO-GO hasta regresión integral, reset preproducción, comparación LIVE antes/después, read-back del código instalado, reversión y aprobación del release.

## 9. Fuentes oficiales Wix

- [CMS: Sandbox y colecciones Online](https://support.wix.com/es/article/cms-acerca-de-sandbox-y-las-colecciones-online)
- [Site Data Usage API](https://dev.wix.com/docs/api-reference/business-solutions/cms/operations/site-data-usage/introduction)
- [Get Site Data Usage](https://dev.wix.com/docs/api-reference/business-solutions/cms/operations/site-data-usage/get-site-data-usage)
- [Wix Web Methods — Introduction](https://dev.wix.com/docs/sdk/core-modules/web-methods/introduction)
- [Wix Web Method](https://dev.wix.com/docs/sdk/core-modules/web-methods/web-method)
- [Bookings — End-to-End Booking Flow](https://dev.wix.com/docs/api-reference/business-solutions/bookings/skills/book-an-appointment)
- [Automations V2 — Activation Status](https://dev.wix.com/docs/api-reference/business-management/automations/skills/automations-activation-status)
- [Accessibility Scans API](https://dev.wix.com/docs/api-reference/site/accessibility/introduction)

**Conclusión:** la auditoría no ha modificado el sitio. Se ha actualizado la evidencia del estado real: dos movimientos existen en ambos data planes, pero no hay identidades TPV; la caja LIVE no satisface el marcador sintético; ocho automatizaciones están activas y el escaneo de accesibilidad aún no ha procesado páginas. El siguiente trabajo debe ser contención de efectos, conciliación y prueba del data plane, no más cambios de interfaz ni publicación.


## 10. SEO — Google Search Console readiness

La consulta oficial `Get Site Readiness` devuelve `status=READY` y `blockingReason=UNKNOWN_BLOCKING_REASON`. Esto confirma que la conexión/propiedad de Google Search Console está lista según el endpoint de Wix; no demuestra indexación, rendimiento orgánico ni corrección de metadatos. No se realizaron cambios SEO.


## 11. Scan individual de la URL pública

Se intentó aislar el fallo con un scan de una sola página para `https://www.marianmadrid.es/`. Wix respondió HTTP 428 / `FAILED_PRECONDITION`, código `SCAN_TARGET_NOT_AVAILABLE`, descripción `page URL is not scan-eligible`. No se creó un scan. Esto confirma que la URL del dominio personalizado no es aceptada como target por el servicio en este contexto; no demuestra que la página pública esté caída. Revisar pageId, dominio primario y elegibilidad del sitio Editor Classic con documentación/soporte Wix antes de repetir.

## 12. Nuevos issues de seguimiento

- [#520 — Contener y auditar las 8 automatizaciones Wix ACTIVE antes de QA E2E](https://github.com/nachoortegazgz/marianmadridz/issues/520) (P0).
- [#521 — Investigar fallo del escaneo de accesibilidad Wix en las 121 páginas](https://github.com/nachoortegazgz/marianmadridz/issues/521) (P1).


## 13. Wix Bookings V2 ↔ ServiciosCatalogo — conciliación de solo lectura

Consulta oficial de Query Services V2 y CMS Items:
- Wix Bookings V2: 94 servicios, todos `APPOINTMENT`; 70 visibles, 24 ocultos; los 94 tienen `onlineBooking.enabled=true`.
- `ServiciosCatalogo`: 95 filas; 94 `SERVICE` y 1 `PRICING_PLAN`.
- Los 94 `serviceId` coinciden exactamente con los 94 IDs nativos: 0 faltantes, 0 huérfanos, 0 duplicados.
- Precio y moneda coinciden en los 70 servicios de precio fijo; no hay discrepancias entre `clientHidden` y `Bookings.hidden`.
- 16 servicios: `ServiciosCatalogo.onlinePayment=true`, pero `Bookings.payment.options.online=false`.
- 8 servicios: `ServiciosCatalogo.inPersonPayment=false`, pero `Bookings.payment.options.inPerson=true`.

Código: `reservas.web.js::_mapServiceImport2ToUX` construye ambos flags desde `ServiciosCatalogo`; `bookingSaga.js` decide el canal con esos flags y envía `selectedPaymentOption=ONLINE/OFFLINE`. La resolución del servicio no contrasta esos flags con `Bookings Services V2.payment.options`. Esto puede ofrecer ONLINE para servicios nativos que lo rechazan; la restricción de pago presencial puede ser una política de negocio más estricta, pero debe confirmarse. No modificar los servicios nativos ni CMS hasta resolver la autoridad del campo. Seguimiento: [#522](https://github.com/nachoortegazgz/marianmadridz/issues/522).


## 14. Personal Bookings V2 ↔ MapaStaff

Consulta read-only de Query Staff Members V2 y `MapaStaff`:
- Wix Bookings devuelve 3 staff members, los 3 `serviceProvider=true`.
- Los tres `resourceId` nativos coinciden exactamente con `STAFF.IDS` de `internalConfig.js`.
- Los tres `staffMemberId` y `resourceId` coinciden con los campos correspondientes de los tres registros `recordType=STAFF` en `MapaStaff`.
- Los roles Website están mapeados como ADMIN, ESTILISTA y ESTILISTA; los tres tienen `rolBookings=STAFF`.
- Las otras dos filas de `MapaStaff` son `GESTORIA` y `TERCERO/EMPRESA`, no staff de Bookings.
- Los 94 servicios Bookings tienen schedule, form, category y staffMemberIds; no se encontraron servicios sin asignación de staff.

Resultado: el mapeo de identidades de personal entre Bookings V2, MapaStaff e internalConfig está alineado en los tres proveedores de servicio. Esto no sustituye las pruebas runtime de permisos/horarios ni valida que las reservas puedan completarse.


## 15. CitasF2 ↔ Bookings Reader V2 — estados divergentes

Consulta read-only de CitasF2 y Count Extended Bookings:
- CitasF2 contiene seis filas: cinco con `bookingStatus=CONFIRMED` y una `PENDING`.
- Los seis `bookingId` existen en Bookings Reader V2 (un registro por ID).
- Los seis bookings nativos están `CANCELED`: total filtrado por los seis IDs = 6; CANCELED=6, CONFIRMED=0, PENDING=0.
- No se encontraron marcadores `BOOKING_CANCELED` en los 58 registros actuales de ControlOperativo para esos IDs.
- El handler `events.js::_handleWixBookingsV2_onBookingCanceled` contiene la actualización de CitasF2 a `CANCELED`, pero el estado actual demuestra que esos seis casos no están proyectados de forma coherente. No demuestra por sí solo por qué no se procesó el evento.

Riesgo: CitasF2 puede presentar reservas canceladas como activas. No recrear, reconfirmar ni modificar reservas nativas. Investigar historial de eventos, configuración del handler y reconciliar proyecciones con Bookings Reader V2. Seguimiento [#523](https://github.com/nachoortegazgz/marianmadridz/issues/523).


## 16. Inventario global Bookings Reader V2

Count Extended Bookings read-only devuelve 353 reservas nativas: 352 `CANCELED`, 1 `CONFIRMED`, 0 `PENDING`, 0 `CREATED`, 0 `DECLINED`, 0 `WAITING_LIST`.
La única reserva nativa `CONFIRMED` tiene inicio `2026-09-18T12:00:00Z` y no tiene fila en CitasF2. No se consultó su información de contacto ni asistencia. Determinar si es un dato histórico/sintético de otra vía y si falta su proyección o registro de asistencia. No cancelarla ni reconfirmarla automáticamente. Se incorpora a [#523](https://github.com/nachoortegazgz/marianmadridz/issues/523).


## 17. Scan individual de Inicio mediante pageId

Se siguió el esquema oficial de Run Accessibility Scan: para una página Wix estática se utilizó `targetType=PAGE` y `page.pageId=cjg9` (Inicio), recuperado de los page summaries del scan full-site. El scan individual `a167faa3-4b5c-4f94-81d5-c0f0d496a2ae` terminó `ACCESSIBILITY_SCAN_STATUS_FAILED`: 1 descubierta, 0 procesadas, 1 fallida. La consulta de page summaries devolvió HTTP 428 `SCAN_RESULTS_NOT_AVAILABLE` sin resultados utilizables. El fallo persiste incluso con el identificador Wix correcto; no es solo un problema de dominio personalizado. Seguimiento [#521](https://github.com/nachoortegazgz/marianmadridz/issues/521).


## 18. Wix Stores Catalog V3 — inventario read-only

Query Products V3 devuelve 24 productos: todos `PHYSICAL`, visibles, moneda EUR y `inventory.availabilityStatus=IN_STOCK`. No hay precios ausentes en `actualPriceRange`; el rango global es 9,95–38,50 EUR. Distribución de variantes: 22 productos con una variante, uno con dos y uno con seis. No se consultó ni modificó inventario por SKU, pedidos ni transacciones; este resumen no valida checkout ni cobro.


## 19. Escritores CajaActual — revisión estática de concurrencia

Revisión estática de `cajas.web.js`, `eventLog.js`, `events.js` y `tpvSandboxRepository.js`:
- `_updateCajaActual` hace read-modify-full-update con `dalUpdate` y reintenta hasta cuatro veces; no incorpora CAS/revision en el helper ni adquiere por sí mismo el lock fiscal.
- El writer manual protege la ruta normal con `acquireFiscalLedgerLock`, pero su preflight idempotente llama a la proyección antes de adquirir el lock.
- `events.js` tiene un camino de recuperación de ledger existente que llama `updateCajaActualFromMovement` antes de `registrarEventoEconomico`; no se ha demostrado que comparta el lock fiscal.
- TPV usa lock de sesión propio en `ControlOperativo`, distinto del lock fiscal.

Esto no demuestra un lost update ocurrido, pero sí que la serialización no está garantizada en todos los call paths. Seguimiento P0 [#525](https://github.com/nachoortegazgz/marianmadridz/issues/525). No ejecutar pruebas concurrentes en LIVE ni modificar datos; definir lock/CAS común y pruebas aisladas.


## 20. Webhook booking markers — corrección de la consulta

La consulta de ControlOperativo se repitió siguiendo el contrato de `events.js`: el tipo de evento se almacena en `payload.eventType`, no necesariamente en el campo raíz. Distribución de 58 filas:
- `BOOKING_CREATED`: 12
- `BOOKING_CONFIRMED`: 10
- `BOOKING_RESCHEDULED`: 2
- `BOOKING_CANCELED`: 0
- 14 filas sin tipo de evento clasificado (resto incluye otros controles).

El handler `wixBookingsV2_onBookingCanceled` está exportado en `events.js` y tiene pruebas offline en `events.booking-canceled.integrity.test.mjs`. La ausencia de markers CANCELED junto a la divergencia CitasF2/Bookings indica que el runtime instalado no acredita la entrega/procesamiento de esos eventos históricos. Verificar SHA/registro de `events.js` y delivery en Wix; no reinyectar eventos ni mutar proyecciones sin evidencia. Seguimiento #523.


## 21. Exposición pública de reservas — decisión P0

GetSiteContext confirma estado Wix `Published`. La consulta de Bookings V2 confirma 94 servicios, 70 visibles y 24 ocultos; los 94 tienen `onlineBooking.enabled=true`. Los 70 servicios visibles permiten ONLINE e IN_PERSON tanto en `ServiciosCatalogo` como en `Bookings.payment.options`. Por tanto, el sitio está técnicamente expuesto a que visitantes públicos creen reservas en los 70 servicios visibles; el canal presencial puede permitir reserva sin un cobro online.

Wix Payments está instalado, pero no se ha podido verificar la conexión mediante una API de lectura disponible; la desconexión se mantiene como declaración del propietario, no evidencia independiente. Ocho automatizaciones ACTIVE pueden producir notificaciones. La exposición pública contradice la clasificación QA sin actividad real si no se pretende recibir reservas. No se ha deshabilitado la reserva ni restringido el sitio porque afecta a la disponibilidad comercial. Decisión requerida: mantener reservas públicas o aplicar contención temporal soportada y reversible. Seguimiento [#526](https://github.com/nachoortegazgz/marianmadridz/issues/526).

## 22. Ejecución de contenciones P0 — 2026-11-22

### Bookings: contención aplicada y verificada
- Se consultaron 94 servicios Bookings V2: 70 visibles y 24 ocultos; los 94 tenían onlineBooking.enabled=true.
- Bulk Update Services V2 cambió exclusivamente onlineBooking.enabled a false en los 94 servicios, usando la revisión vigente y field mask onlineBooking.enabled.
- Respuesta Wix: 94 éxitos, 0 fallos. Read-back posterior: 94/94 deshabilitados, 0 habilitados, 0 ausentes.
- No se modificaron precios, pagos, horarios, staff, visibilidad, sesiones ni reservas existentes. El sitio continúa Published; se bloquea la reserva online nativa, no se despublica la web.
- Snapshot reversible: docs/qa/snapshots/2026-11-22-bookings-online-booking-containment.json. Para restaurar, solo actualizar cada servicio si su revisión actual coincide con revisionAtContainment; cualquier revisión distinta requiere conciliación manual.

### Automatización programada
- Configuración de control laboral, ID 6e80b403-4903-4c5a-bfb7-d3b40ed014be, pasó ACTIVE/revision 4 a INACTIVE/revision 5.
- La actualización cambió exclusivamente configuration.status; read-back confirmó status INACTIVE y conservación de origin, settings, trigger, roots y action IDs.
- Las otras siete automatizaciones PREINSTALLED siguen ACTIVE porque Wix devuelve settings.disableStatusChange=true (dos también readonly). No se intentó eludir el bloqueo ni desinstalar apps.
- No hay evidencia de historial de ejecuciones ni de cancelación de una ejecución ya iniciada. El sitio permanece Published, por lo que otros eventos públicos podrían seguir activando automatizaciones preinstaladas.

### CajaActual: corrección de código en PR
- Se implementa el lock fiscal común en el helper de proyección, reutilizando el lock cuando el caller ya lo posee.
- Los caminos idempotentes internos pasan el lock existente; el webhook de recuperación utiliza la envoltura que adquiere el lock.
- Las escrituras de proyección y apertura de sesión TPV usan el mismo lock global que los escritores fiscales.
- Se añaden pruebas offline de concurrencia y contratos de lock. Pendiente CI/merge y prueba Wix Runtime; no declarar resuelto todavía.

### Integridad histórica
No se modificaron CajaActual LIVE, MovimientosCaja, ControlOperativo, compensaciones PENDING_RECOVERY, pedidos ni reservas existentes. #416 continúa abierto: requiere conciliación documental y origen de las operaciones, no una escritura correctiva especulativa.
## 23. Correlación read-only de compensaciones con Wix Orders — 2026-11-22

Se consultaron Get Order, List Transactions For Single Order y ControlOperativo, sin modificar pedidos ni transacciones.

- Pedido #10033 (orderId d3a4ada9-6720-4816-bcef-51b7a0b64403): FULLY_REFUNDED, total 18,15 EUR. Payment 1ea7816c… REFUNDED, método Other Payment Method. Refund c7a5266c… por 18,15 EUR, refundStatus SUCCEEDED, pending=false, externalRefund=false.
- Pedido #10032 (orderId 0749bb38-34b6-4255-988b-34e42138dab7): PAID, total 92,45 EUR. Payment 1dadc834… APPROVED, método Cash, sin refunds. El pedido contiene productos físicos y un servicio, consistente con la clasificación UNSUPPORTED_ORDER_COMPOSITION.
- REC_ecd49c… coincide exactamente con el refundId c7a5266c… del pedido #10033 y transactionId REFUND-d3a4…; permanece WAIT_FOR_ORIGINAL_ORDER_LEDGER / ORIGINAL_ORDER_LEDGER_MISSING.
- REC_4b4d0… es el webhook de pago del pedido #10033, sin refundId. REC_bb1db… es el webhook de pago del pedido #10032, sin refundId. Ambos continúan PENDING_RECOVERY con attempts=0.
- MovimientosCaja LIVE mantiene dos filas sin orderId/refundId: CARD / TPV-SIM-1795231772367 y CASH / TPV-FUNC-1795212435904-1. La lectura actual no devuelve hash ni previousRecordHash; la evidencia previa registra importes 25 EUR y 20 EUR. No correlacionan con los pedidos de 18,15 EUR y 92,45 EUR.

Conclusión: la correlación de registros Wix está probada, pero no el movimiento externo de fondos ni un ledger fiscal fuente que respalde esos pedidos. No cerrar compensaciones, no generar movimientos/rectificaciones y no tocar pedidos o reembolsos. #416 continúa P0 abierto.
## 24. CI post-merge de la corrección P0 — 2026-11-22

PR #528 integrada en main con commit 7461dd5998c87379680128117194b0cb40dc6c79.
- Backend offline quality gates: SUCCESS, run 45021242129. Job Layer 1 and 2 QA, offline regression, SDK contract and lint: SUCCESS; sin pasos fallidos.
- Secret scanning: SUCCESS, run 45021242143.
- La corrección del lock común para writers de CajaActual queda integrada y validada en CI offline.
- Pendiente: sincronizar SHA a Wix Editor y ejecutar concurrencia/idempotencia en Runtime Sandbox acreditado. No afirmar validación Runtime ni desplegar a LIVE.
## 25. HEAD definitivo y CI post-merge — 2026-11-22
El HEAD actual de main es 544f3a5a984b79a6cf7c25208722136c7bd99111, commit documental de PR #529. El último commit funcional de código P0 es 7461dd5998c87379680128117194b0cb40dc6c79 (PR #528). En ambos commits, Backend offline quality gates y Secret scanning finalizaron SUCCESS; para HEAD 544f3a5, runs 45021632161 y 45021632072. No se ha sincronizado el código a Wix Editor ni probado en Runtime.