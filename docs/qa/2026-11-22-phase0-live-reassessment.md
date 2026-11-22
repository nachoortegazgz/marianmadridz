# Reassessment Fase 0 — baseline live 2026-11-22

**Proyecto:** Marian Madrid  
**Sitio Wix:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Repositorio:** `nachoortegazgz/marianmadridz`  
**Fecha de corte:** 2026-11-22 (consultas GitHub y Wix de solo lectura)  
**Resultado:** Fase 0 parcialmente completada; quedan gates externos no verificables desde las integraciones disponibles.

## 1. Baseline GitHub

- `main` HEAD: `a914ca1fa885c72d469743c089f10879c4c5e5ad` (commit firmado, 2026-11-22 12:22:28 UTC).
- Backend offline quality gates: SUCCESS, [run 45021944649](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45021944649).
- Secret scanning: SUCCESS, [run 45021944657](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45021944657).
- La rama `main` devuelve `protected=false`, `protection.enabled=false`, required checks desactivados y lista de rulesets vacía. Issue [#210](https://github.com/nachoortegazgz/marianmadridz/issues/210) sigue abierto.
- La integración GitHub permite leer la configuración, pero no dispone de capacidad administrativa para crear la protección/ruleset. No se ha intentado eludir el permiso.

## 2. Rama TPV en curso

- Rama: `fix/tpv-neutral-source-policy`.
- PR [#531](https://github.com/nachoortegazgz/marianmadridz/pull/531), abierta en estado Draft, base `main`, HEAD `c9f991df63d5b685b1923fa4dd4850360a4be153`.
- 25 archivos modificados; incluye política/configuración, acceso CMS, módulos TPV y pruebas.
- Secret scanning: SUCCESS, [run 45068193113](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45068193113).
- Backend offline quality gates: FAILURE, [run 45068193124](https://github.com/nachoortegazgz/marianmadridz/actions/runs/45068193124).
- Diagnóstico de Layer 1: 339 tests passed y 4 failed en 28 suites. Fallos observados:
  1. `tpv.web-modules.contract.test.mjs`: el contrato espera `TPV_COLLECTIONS`, pero el módulo inspeccionado no satisface esa aserción.
  2. `tpv.qa.persistence.policy.test.mjs`: falta la excepción `DATA_ACCESS_ERROR` esperada.
  3. `tpv.qa.persistence.policy.test.mjs`: el error conserva `TPV_SANDBOX_IDENTITIES_NOT_PRESEEDED`, mientras el contrato espera `TPV_IDENTITIES_NOT_PRESEEDED`.
  4. `controlOperativo.hooks.test.mjs`: el conjunto canónico de tipos de control contiene duplicados tras el cambio de alias.
- Los contratos SDK TPV/Bookings/Stores, ESLint y secret scanning terminaron correctamente en ese run. Layer 2 y la suite completa se omitieron tras el fallo de Layer 1.
- **Decisión:** no fusionar ni desplegar PR #531 hasta corregir las cuatro regresiones, ejecutar la suite completa y revisar el diff. Esta auditoría no ha modificado la rama.

## 3. Estado actual de Wix

GetSiteContext devuelve:
- Estado: **Draft**.
- Editor: **Editor (Classic)**.
- Velo: habilitado.
- Codegen: no elegible.
- Región: ES; moneda EUR; zona horaria Europe/Madrid.
- Actualización del sitio: 2026-11-22 19:23 (hora local indicada por Wix).

Aplicaciones instaladas: Promote SEO, Wix Blog, Wix Bookings, Wix Forms & Payments, Wix Gift Cards, Wix Invoices V1, Wix Members Area, Wix Payments y Wix Stores Catalog V3.

El estado Draft es el estado devuelto por Wix en esta consulta; no equivale a una prueba de sincronización del código ni de funcionamiento runtime.

## 4. Wix Bookings — contención confirmada

Consulta oficial Bookings Services V2:
- 94 servicios devueltos; total 94.
- 70 visibles y 24 ocultos.
- `onlineBooking.enabled=true`: 0.
- `onlineBooking.enabled=false`: 94.
- No hay flags `onlineBooking.enabled` ausentes.
- Los flags de pago `online` e `inPerson` siguen presentes en el catálogo, pero la reserva online está deshabilitada en todos los servicios.

Esto confirma el estado de contención de la reserva online en el catálogo nativo. No acredita una prueba negativa de los formularios/rutas personalizadas ni la imposibilidad absoluta de crear una reserva desde cualquier canal. Issue [#526](https://github.com/nachoortegazgz/marianmadridz/issues/526) permanece abierto hasta esa prueba.

No se han modificado reservas existentes, horarios, precios, visibilidad ni opciones de pago durante esta auditoría.

## 5. Wix Automations — read-back actual

Query Automations V2:
- 159 automatizaciones.
- 7 ACTIVE, todas PREINSTALLED.
- 152 INACTIVE.
- La automatización APPLICATION `Configuración de control laboral` (ID `6e80b403-4903-4c5a-bfb7-d3b40ed014be`) está **INACTIVE**, revisión 5. Conserva trigger programado y acción Agent Maker; no se ha ejecutado ni alterado en esta sesión.
- Las siete PREINSTALLED activas tienen `settings.disableStatusChange=true`; dos tienen además `readonly=true`. No se ha intentado sortear las restricciones.
- Las acciones activas observadas incluyen seis flujos de correo y una notificación interna. Sus triggers incluyen guardado de tarjeta, notificación de tarea Agent Maker, Aria, confirmación de miembros, confirmación de suscripción, límite CMS y restablecimiento de contraseña.
- No se ha obtenido historial de ejecución ni prueba de cancelación de procesos ya iniciados.

Issue [#520](https://github.com/nachoortegazgz/marianmadridz/issues/520) permanece abierto hasta clasificar los efectos y acreditar una contención completa de todos los triggers.

## 6. Crons, webhooks y efectos de backend (inventario estático)

En `src/backend/jobs.config` hay 15 jobs declarados con zona horaria Europe/Madrid y política de concurrencia Forbid. Entre ellos:

| Job | Programación | Riesgo/efecto declarado |
|---|---:|---|
| cleanExpiredLocks | 15 * * * * | Limpieza de locks |
| cleanExpiredRateLimits | */5 * * * * | Limpieza de rate limits |
| cleanExpiredDisplayTokens | */15 * * * * | Limpieza de tokens |
| cleanupExpiredDualCache | 20 * * * * | Limpieza de cache dual |
| runPendingCompensationsJob | 30 * * * * | Procesa compensaciones y recuperación de pagos |
| cleanExpiredDaysCache | 0 1 * * * | Limpieza de cache de disponibilidad |
| verifyNightlyZClosing | 20 1 * * * | Puede iniciar cierre Z |
| systemHealthCheck | 0 7 * * * | Diagnóstico de salud |
| cleanAuditLogs | 0 2 * * 0 | Retención de auditoría |
| reconcileUnknownTransactions | 45 * * * * | Recuperación de resultados inciertos |
| reconcileInconsistentDualPairs | 50 * * * * | Reconciliación de pares de reservas |
| retryCompletionRequired | 55 * * * * | Reintento de finalización de reservas |
| cleanExpiredBookingControl | */15 * * * * | Limpieza de control/idempotencia |
| reconcileUnmarkedOrderCreatedEvents | */30 * * * * | Reconciliación de pedidos |
| reconcileMissingConfirmedBookingProjections | 15,45 * * * * | Reconciliación de proyecciones Bookings |

El código de `runPendingCompensationsJob` consulta estados `PENDING`, `RETRYING` y `PENDING_RECOVERY`. La política fiscal actual omite compensaciones `FISCAL_LEDGER` cuando `LEDGER_WRITES_ENABLED !== true`, pero el job contempla otros tipos de compensación. No se ha ejecutado manualmente ningún cron. La presencia en `jobs.config` acredita configuración en repositorio, no activación runtime.

En `src/backend/events.js` hay ocho handlers exportados para eventos Bookings V2 (confirmación, creación, reprogramación, cancelación) y eCommerce (pedido creado, cambio de estado de pago, actualización y cancelación). Su registro/activación en Wix Runtime y la entrega efectiva de eventos no se han probado en esta sesión.

No aparece `http-functions.js` en el árbol de archivos de `main`, pese a que algunos secretos conservan descripciones históricas que lo mencionan. Confirmar si la integración Power Automate sigue vigente o es legado antes de eliminar secretos o documentar un endpoint operativo.

## 7. Secretos — inventario de metadatos, sin valores

Wix Secrets Manager devuelve 14 entradas. Solo se han leído ID, nombre, descripción y fechas; no se han solicitado ni expuesto valores.

Nombres devueltos:
`ADMIN_EMAILS`, `CLI_API_KEY`, `SENDGRID_API_KEY`, `BOOKINGS_API_TOKEN`, `FISCAL_NIF_EMISOR`, `TOKEN_CLASICO_EDITAR_GITHUB`, `M365_POWER_AUTOMATE_ENDPOINT`, `BOOKING_AUTH_SECRET`, `SECRET_AUTH_JWT_KEY`, `TOTAL_TOKEN`, `POWER_AUTOMATE_TOKEN`, `CAJERO_EMAILS`, `M365_GRAPH_SITE_ID`, `SECRET_FISCALKEY`.

Hallazgos:
- `SECRET_FISCALKEY` y `FISCAL_NIF_EMISOR` están presentes y son consumidos por código fiscal.
- `src/backend/mmSecrets.js` declara además `FISCAL_SIGNER_ENDPOINT` y `FISCAL_SIGNER_BEARER`, y `cajas.web.js` los consulta. No aparecen en el inventario de 14 secretos. El código contempla `FISCAL_SIGNER_NOT_CONFIGURED`; la firma externa debe considerarse no configurada hasta verificar esos secretos desde Dashboard.
- Varios secretos de M365/Power Automate, SendGrid, Bookings y tokens no tienen consumidor localizado en el código de `main` mediante búsquedas exactas. Son candidatos a revisión, no a eliminación automática.
- La existencia de `CLI_API_KEY` en Wix Secrets Manager no acredita que exista el secreto homónimo en GitHub Actions. La integración GitHub no permite leer valores ni confirmar presencia de secrets del repositorio.
- No se han leído, modificado, copiado ni rotado valores de secretos.

## 8. Sincronización GitHub ↔ Wix Editor

El repositorio contiene `wix.config.json` con el Site ID anterior y `package.json` con Wix CLI. Esto acredita configuración de proyecto, no que el Editor esté conectado a este repositorio ni qué commit esté cargado.

La documentación oficial de Wix indica que, cuando Git Integration está conectado, el código del Editor se sincroniza con la rama por defecto y el panel GitHub Integration muestra repositorio y commits:
https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/changes-to-the-editor-when-your-site-is-integrated

No hay endpoint de lectura usado en esta auditoría que devuelva el SHA del código Velo instalado en Editor Classic. Por tanto, la sincronización y el SHA runtime siguen **NO VERIFICADOS**. Requieren abrir el Code sidebar → GitHub Integration en el Editor y comparar el repositorio/commit con `main` HEAD; revisar además Site History y el commit de la versión guardada/publicada. No publicar para obtener esta evidencia.

## 9. Payments y aplicaciones

Wix Payments está instalado, pero la búsqueda de documentación y APIs disponibles no ha identificado un método read-only para confirmar la cuenta conectada/onboarding en este sitio. No se ha ejecutado un intento de conexión ni un pago. La declaración previa de pasarela desconectada no se eleva a hecho verificado.

Para continuar se necesita comprobar en Dashboard → Accept Payments el proveedor conectado y el estado de onboarding, sin iniciar cobros ni conectar una cuenta.

## 10. Resultado de Fase 0

### Verificado
- HEAD de `main` y CI actual en verde.
- Estado de protección de `main`: desactivada y sin rulesets.
- PR #531 abierta en Draft y CI backend fallido con cuatro regresiones.
- Estado Wix Draft, Editor Classic y aplicaciones instaladas.
- 94/94 servicios con reserva online deshabilitada.
- 7 automatizaciones preinstaladas activas; automatización laboral de aplicación inactiva.
- 15 crons configurados en repo, ocho handlers de eventos exportados.
- 14 metadatos de secretos inventariados sin leer valores.

### Pendiente de comprobación externa
1. Configurar branch protection/ruleset y required checks en GitHub (la integración actual no tiene permiso administrativo).
2. Verificar desde Wix Editor GitHub Integration y Site History qué commit está sincronizado/cargado.
3. Verificar estado de conexión y onboarding de Wix Payments en Dashboard.
4. Acreditar estado runtime de crons y entrega de webhooks.
5. Obtener evidencia de ejecución/historial de las automatizaciones y de los efectos de los seis flujos de correo.
6. Ejecutar prueba negativa de rutas personalizadas de reserva en un entorno controlado.
7. Confirmar si los secretos M365/Power Automate/SendGrid/Bookings sin consumidores localizados son legado o integraciones externas vigentes.

### Decisión de release
**NO-GO**. No publicar, no ejecutar pagos, no reintentar compensaciones y no lanzar E2E que pueda enviar correos o realizar efectos externos hasta cerrar los gates anteriores.

No se han realizado cambios en CMS, reservas, automatizaciones, secretos, crons ni código funcional durante esta auditoría.
