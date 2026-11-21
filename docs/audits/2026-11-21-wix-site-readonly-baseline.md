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
- Scan nuevo: `aae3b411-81ff-4309-a767-6301164cb483`, iniciado el 21/11 para full-site. Último estado consultado: RUNNING, 121 páginas descubiertas, 0 procesadas, 51 fallidas, 70 pendientes; siguiente intervalo recomendado 5 segundos.

No declarar el sitio accesible ni limpio. Seguir consultando el mismo scan ID; no iniciar un segundo scan. Cuando termine, recuperar resumen, todas las páginas (incluidas las fallidas) y findings. Una página fallida es estado desconocido, no página sin problemas.

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
