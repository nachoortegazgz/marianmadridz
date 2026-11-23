# Auditoría de flujos backend y preparación E2E

- **Fecha:** 2026-11-20
- **Repositorio:** `nachoortegazgz/marianmadridz`
- **Alcance:** inventario estático de entradas backend, pruebas disponibles y candidatos a limpieza.
- **Resultado:** auditoría estática; no se ejecutaron pruebas en esta intervención.

## Conclusión

No se elimina código de producción en esta auditoría. La evidencia disponible permite identificar entradas y suites offline, pero no demostrar que un módulo carezca de consumidores en Wix: los nombres de archivos `.web.js`, handlers de eventos Velo y funciones configuradas en `jobs.config` pueden ser invocados por plataforma/configuración, fuera de las referencias JavaScript encontradas por búsqueda.

La tarea solicitada de E2E por cada proceso requiere Wix Preview/Local Editor y credenciales/datos de prueba del sitio. GitHub Actions y el loader offline no acreditan el comportamiento runtime de Wix, aislamiento Sandbox/Live, permisos efectivos, CMS, Wix Apps ni automatizaciones.

## Clasificación estática de entradas y flujos

| Entrada / grupo | Clasificación | Evidencia y cobertura local identificada | E2E Wix pendiente |
|---|---|---|---|
| `src/backend/reservas.web.js`, `citasManager.web.js`, `booking/` | Entrada de flujo frontend y dominio de reservas | Suites `reservas.web.test.mjs`, `booking.availability.saga.test.mjs`, `booking.core.concurrency.test.mjs`, `booking.cart-v2.checkout.test.mjs`, `booking.members-required.contract.test.mjs`, `booking.flow.retry.contract.test.mjs`, `booking.saga.dual-gap-zero.test.mjs` y contratos de página/widgets | Reserva simple/dual completa; autorización por roles; concurrencia real; timeout y reconciliación con Wix Bookings |
| `src/backend/events.js` | Entry point gestionado por Wix; no considerar muerto por falta de import local | `events.backend-events.contract.test.mjs`, `events.booking-canceled.integrity.test.mjs`, `events.native-booking-sync.test.mjs`, `events.order-id-validation.contract.test.mjs`, `events.unknown-booking-recovery.test.mjs`, `webhookEventClaims.test.mjs`, `orderLedgerAmount.test.mjs` | Entregas reales Wix, reintentos, identidad del evento, claims, Orders/Bookings y recuperación en runtime |
| `src/backend/crons.js` + `src/backend/jobs.config` | Entry points invocados por scheduler Wix | `crons.jobsConfigParity.test.mjs`, `crons.booking-projection-reconciliation.test.mjs`, `crons.dual-reschedule-readonly.test.mjs`, `completion-retry.contract.test.mjs` | Confirmar cada job desplegado, agenda, permisos, límites de tiempo, datos efectivos y alertas |
| `src/backend/data.js`, `dataAccess.js`, `dataAccessPolicy.js` | Infraestructura y hooks/transversal; alcanzados indirectamente por escritores | `data.hooks.test.mjs`, `dataAccess.writePolicy.test.mjs`, `dataAccess.bulkPatch.policy.test.mjs`, `dataAccess.removeById.test.mjs`, `controlOperativo.hooks.test.mjs` | Contrato de hooks, permisos CMS y comportamiento de escrituras/condiciones en Wix Sandbox |
| `src/backend/cajas.web.js`, `eventLog.js`, `fiscalLedgerLock.js`, `accountingLedger.js`, `fiscalDocuments.web.js` | Flujos fiscales/contables y proyecciones sensibles; no retirar por ser gates fail-closed | `fiscalLedgerLock.test.mjs`, `fiscalLedgerWriters.locking.test.mjs`, `accountingLedger.writer.offline.test.mjs`, `fiscalAggregator.read.test.mjs`, `fiscalDocuments.package-version.concurrency.test.mjs`, `fiscal-chain-separation.contract.test.mjs`, `fiscalFacsimile.test.mjs` | Validación fiscal/legal, integridad de ledger, permisos, reconciliación y prueba con datos sintéticos controlados. Writers reales siguen sujetos a gates cerrados |
| `src/backend/security.js`, `securityEngine.js`, `staff.js`, `secretAccess.js` | Infraestructura de autorización, identidad, rate limit, firma y secretos | `security.rateLimiter.test.mjs`, `members.sdk.contract.test.mjs`, `staff.identity.contract.test.mjs`, `secretAccess.sdk.test.mjs` | Miembro/admin/gestión/estilista/visitante reales, configuración de secretos Wix y denegación efectiva |
| `src/backend/horario.web.js` | WebModule de jornada con contrato de integridad; invocación Wix no inferible por imports | contratos de datos/validación y `unit.ssot.v5011.test.mjs`; revisar suite focal antes de aceptar cobertura E2E | Flujos de fichaje/ajuste y firma en runtime con roles, secreto y esquema CMS efectivos |
| `src/backend/tpv/*.web.js`, `tpvQaRepository.js`, `tpvCierresCore.js` | Integración de TPV sintética accesible desde página/controlador; no es código huérfano | `tpv.web-modules.contract.test.mjs`, `tpv-widget.contract.test.mjs`, `tpv-ui.qa-source.test.mjs`, `tpv.qa.persistence.policy.test.mjs`, `qa.tpv-simulation.mock.test.mjs` | Sandbox efectivo; ciclo completo de ejecución; permisos; persistencia, concurrencia, idempotencia, recuperación y no mutación de Live |
| `src/backend/aiAgent.web.js` | WebMethod fail-closed, aunque no hay flujo de producto confirmado en esta auditoría | `externalAgentContracts.test.mjs` verifica que no simula respuestas | Confirmar que no hay integración/configuración de página Wix antes de proponer retirada; actualmente se conserva como contrato explícito de capacidad no configurada |

## Código candidato a limpieza

1. `src/backend/aeatHash.js` es un helper de hash de especificación AEAT aislado de los writers actuales por decisión explícita. Tiene pruebas de vectores oficiales (`aeatHash.contract.test.mjs`) y una prueba de separación (`fiscal-chain-separation.contract.test.mjs`). **No está demostrado que sea obsoleto**: mantenerlo aislado evita confundirlo con la cadena interna actualmente persistida; no borrarlo como “código muerto”.
2. `src/backend/securityEngine.js` contiene utilidades criptográficas y firma de registros de jornada. Sus funciones SHA/HMAC se usan en claims/rate limiting y en fichajes según los contratos/documentación; **no es candidato de borrado por el mero hecho de que algunas exports no tengan un consumidor directo obvio**. `timingSafeEqual` y helpers internos requieren búsqueda completa de referencias antes de modificar.
3. `src/backend/aiAgent.web.js` no configura un proveedor y siempre deniega el procesamiento. Tiene un test contractual y puede ser una superficie Wix externa aunque no haya import local. Clasificar como “stub intencional / uso del producto por confirmar”, no como módulo eliminable demostrado.
4. Los módulos TPV denominados QA/simulación son consumidores activos de la página TPV y tienen contratos de integración. No eliminarlos hasta que el modo Sandbox sustituto tenga aceptación runtime y una migración/reset selectivo probado.
5. Los archivos de páginas Wix (`src/pages/*.js`) pueden estar ligados a IDs de página; no renombrarlos ni retirarlos por semejanza de contenido o ausencia de import.

## Alcance real de pruebas y CI

- `npm test` ejecuta las suites `*.test.mjs` y `*.runner.mjs` recogidas por `src/backend/tests/run-all.mjs` mediante el loader de mocks.
- `npm run test:layer1` y `npm run test:layer2` son gates offline adicionales.
- El workflow `.github/workflows/backend-offline-quality.yml` ejecuta las capas, regresión offline, validadores de SDK y ESLint. No es un workflow E2E del sitio Wix.
- `.github/workflows/wix-tpv-preview.yml` solo crea Preview si se solicita explícitamente; exige `CLI_API_KEY` y no publica. La creación del Preview no ejecuta por sí sola el flujo TPV con identidades ni prueba persistencia/aislamiento CMS.
- En esta intervención no se ejecutaron comandos, runners ni Wix Preview. La lectura de logs de Actions no proporcionó un resultado verificable de E2E para esta solicitud.

## Próximos pasos reproducibles

1. En un checkout local de este SHA y con dependencias disponibles, ejecutar `npm ci`, `npm run test:layer1`, `npm run test:layer2`, `npm test`, `npm run lint` y verificadores SDK; conservar resultados y SHA exacto.
2. Ejecutar Wix Preview en sitio/entorno autorizado y documentar por cada WebMethod y job: identidad/rol, fixture sintética exclusiva, resultado esperado, efectos CMS observados, idempotencia/replay, recuperación y ausencia de efectos externos. No usar datos de Wix Apps para escrituras de prueba.
3. Reconciliar catálogo de entradas externas: WebMethods invocados por page code, handlers con nombres Wix exactos, jobs programados y automatizaciones. Añadir referencias a la evidencia de Wix para cada proceso.
4. Generar un grafo de imports/exports sobre checkout local y cruzarlo con `jobs.config`, handlers Wix y WebMethods. Clasificar como **usado**, **sin referencia estática pero entry point externo**, **sin uso demostrado** o **retirada aprobada**.
5. Eliminar únicamente candidatos que sigan sin consumidores tras esa revisión, tengan sustituto o confirmación de retirada, y pasen regresión y lint en el mismo SHA.

## Gates de publicación que permanecen abiertos

E2E Wix, verificación de entorno Sandbox/Live, autorizaciones y hooks reales, conciliación de `CajaActual` LIVE, revisión de automatizaciones/efectos externos, reset preproducción selectivo con evidencia y aprobación explícita. Esta auditoría no cambia el estado de despliegue: **NO-GO**.
