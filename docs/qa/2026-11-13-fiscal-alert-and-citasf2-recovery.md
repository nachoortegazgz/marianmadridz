# Hito QA — conciliacion fiscal y diagnostico de CitasF2

**Fecha:** 2026-11-13  
**Repositorio:** `nachoortegazgz/marianmadridz`  
**Baseline revisada:** `fc9cb29c5a3fd74a6dae8eff3e2f5e4da2fbb499`  
**Main actualizado:** `9d96655943af045406632435b299a84da39e23b0`  
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

## 3. Revalidacion criptografica de contenido

La inspeccion posterior de la fila genuina live confirmo que `aeatPayload` no esta disponible como campo independiente. La fila conserva los campos fiscales canonicos/legacy y `recordTimestamp`, por lo que el verificador se ha endurecido para reconstruir el mismo payload interno con el builder canonico, normalizar los nombres fisicos CMS y recalcular SHA-256 mediante `hashChain`.

El verificador ahora distingue:
- Ruptura real de continuidad o discrepancia del digest: `INTEGRITY_COMPROMISED` y alerta critica.
- Registro cuyo contenido no puede reconstruirse: `PARTIAL`; no permite resolver alertas.
- Auditoria completa con al menos un registro genuino y todos los hashes recalculados correctamente: `SUCCESS`.

La resolucion de alertas exige `hashContentComplete=true` y `hashesVerified=checked`, ademas de cero rupturas. No basta con que `previousRecordHash` coincida con el hash anterior.

Esta recomputacion aun requiere validacion en Wix Runtime publicado. Si la representacion CMS historica no reproduce el hash original, la auditoria quedara PARTIAL o INTEGRITY_COMPROMISED y la alerta seguira OPEN; no se corregira el ledger mediante sobrescritura.

## 4. Correccion incorporada al repositorio

En `src/backend/crons.js`, `systemHealthCheck` ahora:

1. Ejecuta la auditoria fiscal ya existente.
2. Solo intenta resolver alertas FISCAL_CHAIN_CORRUPTED cuando el resultado es SUCCESS, complete=true, hasMore=false, breaksCount=0, hashContentComplete=true, hashesVerified=checked y checked>0.
3. Actualiza exclusivamente registros ALERT que sigan OPEN y sean del tipo FISCAL_CHAIN_CORRUPTED.
4. Conserva el payload historico completo y agrega `resolvedAt` y un objeto `resolution` con traceId, cantidad revisada y evidencia de auditoria completa.
5. Si la auditoria es parcial, falla o reproduce rupturas, no resuelve ninguna alerta.
6. Si falla la actualizacion de una alerta, deja constancia en el resultado/log y mantiene la incidencia abierta.

No se modifica MovimientosCaja, LibroAsientosContablesDetalle, HistoricoCierresZ ni ningun otro ledger append-only.

## 5. Pruebas incorporadas

Se amplian las pruebas de `crons.jobsConfigParity.test.mjs` para cubrir:

- Resolucion de alerta historica solo tras auditoria completa y limpia.
- Conservacion del payload original y trazabilidad de la resolucion.
- Fail-closed: una ruptura reproducida, un digest incorrecto, un contenido no reconstruible o un ledger vacio mantienen la alerta OPEN.

**CI verificado sobre el HEAD exacto del PR #313:** 66 suites, 606 pruebas correctas, 0 fallos. Contratos Wix SDK (Cart V2, Order Transactions y Bookings Reader V2), ESLint y Gitleaks completados correctamente. Workflow: https://github.com/nachoortegazgz/marianmadridz/actions/runs/43450798929. El PR #313 se integro mediante squash en `9d96655943af045406632435b299a84da39e23b0`.

## 6. Despliegue y cierre del hito

- PR #311 integra el ciclo de vida trazable de la alerta; PR #313 añade la verificacion del contenido SHA-256, las guardas fail-closed y sus pruebas.
- El merge sincroniza el codigo con Wix Editor conforme al procedimiento operativo declarado por el propietario.
- La publicacion Wix sigue siendo manual. No se ha publicado ni ejecutado codigo en produccion.
- Tras publicar, `systemHealthCheck` ejecutara la resolucion en su siguiente ejecucion programada (07:00 Europe/Madrid), siempre que la auditoria completa siga limpia.
- El cron de proyeccion de reservas continuara ejecutandose a los minutos 15 y 45. Su resultado debe verificarse mediante logs Velo y una nueva lectura de CitasF2/ControlOperativo.
- Los 17 casos sin recurso resoluble y el caso PAID permanecen sujetos a revision; no se completan mediante inferencias.

## 7. Criterio de aceptacion pendiente

El hito de repositorio queda completado cuando el PR este integrado y CI verde. El hito operativo Wix permanecera **PENDIENTE DE PUBLICACION Y RUNTIME** hasta verificar:

1. SHA exacto publicado.
2. Ejecucion de `systemHealthCheck` con resultado SUCCESS y alerta fiscal en RESOLVED, con payload de resolucion.
3. Ejecucion de `reconcileMissingConfirmedBookingProjections` con contadores y traceId.
4. Lectura posterior de CitasF2 que confirme las proyecciones y marcadores creados.
5. Revision controlada de los 17 casos sin recurso y del caso PAID.

## Fuentes tecnicas

- [Wix Bookings Reader V2 — Query Extended Bookings](https://dev.wix.com/docs/api-reference/business-solutions/bookings/bookings/bookings-reader-v2/query-extended-bookings)
- [Wix Bookings Reader V2 — Supported Filters](https://dev.wix.com/docs/api-reference/business-solutions/bookings/bookings/bookings-reader-v2/supported-filters)
- [Cron y reconciliador en el repositorio](https://github.com/nachoortegazgz/marianmadridz/blob/9d96655943af045406632435b299a84da39e23b0/src/backend/crons.js)
- [Configuracion de jobs](https://github.com/nachoortegazgz/marianmadridz/blob/9d96655943af045406632435b299a84da39e23b0/src/backend/jobs.config)
