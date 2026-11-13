# Hito QA — conciliacion fiscal y diagnostico de CitasF2

**Fecha:** 2026-11-13  
**Repositorio:** `nachoortegazgz/marianmadridz`  
**Baseline revisada:** `fc9cb29c5a3fd74a6dae8eff3e2f5e4da2fbb499`  
**Sitio Wix:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Tipo de acceso:** lectura real de Wix CMS y Bookings Reader V2; sin escritura ni ejecucion de Velo.

## 1. Estado verificado en Wix

Consulta paginada de Bookings Reader V2 y CMS:

- 346 reservas nativas leidas: 73 CONFIRMED, 255 CANCELED y 18 CREATED.
- CitasF2: 0 registros.
- ControlOperativo: 11 registros; no se encontraron marcadores WEBHOOK_EVENT de confirmacion de reserva.
- La ultima reserva CONFIRMED observada fue creada el 2026-11-11T06:22:07.223Z; no habia una reserva posterior a la publicacion reportada para validar un nuevo evento de extremo a extremo.
- Entre las 73 CONFIRMED, 55 son candidatas a proyeccion por disponer de recurso y no presentar estado financiero bloqueante; 17 carecen de recurso/staff resoluble en el snapshot nativo y 1 tiene estado PAID y debe esperar conciliacion contra el ledger. Esta clasificacion no equivale a una ejecucion del reconciliador.

### Clasificacion de reservas

| Grupo | Registros | Tratamiento |
|---|---:|---|
| Confirmadas no pagadas/exentas con recurso | 55 | Candidatas al writer canonico de CitasF2 |
| Confirmadas sin recurso/staff resoluble | 17 | Revision operativa; no inferir profesional ni recurso |
| Confirmada PAID | 1 | Bloqueo hasta conciliar contra MovimientosCaja |
| Total confirmadas | 73 | |

El cron `reconcileMissingConfirmedBookingProjections` ya existe en `src/backend/crons.js` y esta declarado en `src/backend/jobs.config` cada hora en los minutos 15 y 45. Su writer interno es idempotente, proyecta solo reservas confirmadas no pagadas con los datos requeridos y genera alertas deduplicadas para casos que requieren revision. No crea reservas ni contabiliza pagos.

**Pendiente de runtime:** las herramientas conectadas permiten consultar las APIs REST de Wix, pero no invocar una funcion interna de Velo ni ejecutar manualmente un cron. No se puede atribuir la ausencia de CitasF2 a una causa concreta sin logs del backend publicado. No se han creado proyecciones ni alertas desde esta auditoria.

## 2. Estado fiscal verificado

- MovimientosCaja: 10 registros.
- 9 filas sinteticas quedan excluidas por el clasificador canonico de simulacion.
- 1 movimiento genuino VENTA_ONLINE, secuencia 1, con hash y previousRecordHash presentes; el predecesor apunta al hash genesis.
- Recomputacion independiente read-only: 0 rupturas reproducibles en la cadena actual.
- Sigue existiendo una alerta FISCAL_CHAIN_CORRUPTED OPEN/CRITICAL, creada el 2026-11-11. Su payload historico recoge seis rupturas, pero no se ha podido reproducir ninguna con el estado actual.

La antiguedad de la alerta y la ausencia actual de rupturas son compatibles con una alerta obsoleta generada antes de las correcciones del clasificador, pero no prueban por si solas el origen historico. No se cambia su estado desde una llamada REST directa.

## 3. Correccion incorporada al repositorio

En `src/backend/crons.js`, `systemHealthCheck` ahora:

1. Ejecuta la auditoria fiscal ya existente.
2. Solo intenta resolver alertas FISCAL_CHAIN_CORRUPTED cuando el resultado es SUCCESS, complete=true, hasMore=false y breaksCount=0.
3. Actualiza exclusivamente registros ALERT que sigan OPEN y sean del tipo FISCAL_CHAIN_CORRUPTED.
4. Conserva el payload historico completo y agrega `resolvedAt` y un objeto `resolution` con traceId, cantidad revisada y evidencia de auditoria completa.
5. Si la auditoria es parcial, falla o reproduce rupturas, no resuelve ninguna alerta.
6. Si falla la actualizacion de una alerta, deja constancia en el resultado/log y mantiene la incidencia abierta.

No se modifica MovimientosCaja, LibroAsientosContablesDetalle, HistoricoCierresZ ni ningun otro ledger append-only.

## 4. Pruebas incorporadas

Se amplian las pruebas de `crons.jobsConfigParity.test.mjs` para cubrir:

- Resolucion de alerta historica solo tras auditoria completa y limpia.
- Conservacion del payload original y trazabilidad de la resolucion.
- Fail-closed: una ruptura reproducida mantiene la alerta OPEN.

La validacion definitiva depende del workflow CI asociado al PR. No se declara la prueba superada hasta disponer del resultado de ese workflow.

## 5. Despliegue y cierre del hito

- La rama/PR contiene solo la correccion de ciclo de vida de la alerta fiscal, sus pruebas y esta evidencia.
- El merge sincroniza el codigo con Wix Editor conforme al procedimiento operativo declarado por el propietario.
- La publicacion Wix sigue siendo manual. No se ha publicado ni ejecutado codigo en produccion.
- Tras publicar, `systemHealthCheck` ejecutara la resolucion en su siguiente ejecucion programada (07:00 Europe/Madrid), siempre que la auditoria completa siga limpia.
- El cron de proyeccion de reservas continuara ejecutandose a los minutos 15 y 45. Su resultado debe verificarse mediante logs Velo y una nueva lectura de CitasF2/ControlOperativo.
- Los 17 casos sin recurso resoluble y el caso PAID permanecen sujetos a revision; no se completan mediante inferencias.

## 6. Criterio de aceptacion pendiente

El hito de repositorio queda completado cuando el PR este integrado y CI verde. El hito operativo Wix permanecera **PENDIENTE DE PUBLICACION Y RUNTIME** hasta verificar:

1. SHA exacto publicado.
2. Ejecucion de `systemHealthCheck` con resultado SUCCESS y alerta fiscal en RESOLVED, con payload de resolucion.
3. Ejecucion de `reconcileMissingConfirmedBookingProjections` con contadores y traceId.
4. Lectura posterior de CitasF2 que confirme las proyecciones y marcadores creados.
5. Revision controlada de los 17 casos sin recurso y del caso PAID.

## Fuentes tecnicas

- [Wix Bookings Reader V2 — Query Extended Bookings](https://dev.wix.com/docs/api-reference/business-solutions/bookings/bookings/bookings-reader-v2/query-extended-bookings)
- [Wix Bookings Reader V2 — Supported Filters](https://dev.wix.com/docs/api-reference/business-solutions/bookings/bookings/bookings-reader-v2/supported-filters)
- [Cron y reconciliador en el repositorio](https://github.com/nachoortegazgz/marianmadridz/blob/fc9cb29c5a3fd74a6dae8eff3e2f5e4da2fbb499/src/backend/crons.js)
- [Configuracion de jobs](https://github.com/nachoortegazgz/marianmadridz/blob/fc9cb29c5a3fd74a6dae8eff3e2f5e4da2fbb499/src/backend/jobs.config)
