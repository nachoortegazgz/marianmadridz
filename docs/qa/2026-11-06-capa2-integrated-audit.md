# Capa 2 — Auditoría integrada y plan de endurecimiento

**Fecha:** 2026-11-06  
**Repositorio:** `nachoortegazgz/marianmadridz`  
**Base:** `main` / merge de PR #153 `419292960c45541a867ab01a2515876aca979cba`  
**Rama de trabajo:** `feat/capa2-integrated-hardening`

## 1. Objetivo y criterio de alcance

Incorporar al desarrollo conjunto los módulos de dominio intermedio que consumen los contratos transaccionales de Capa 1 y producen proyecciones operativas, fiscales y laborales. No se amplía la arquitectura con módulos nuevos sin consumidor probado.

En el repositorio, `src/backend/tests/run-layer2.mjs` es el gate denominado Capa 2. Contiene once suites tras incorporar las nuevas regresiones y cubre caja/ledger, fiscalidad, DTOs, hooks CMS, crons y flujos integrados. Este gate no debe confundirse con una declaración de que todos los procesos funcionales del negocio estén certificados.

## 2. Mapa de módulos incorporados al ciclo

| Dominio | Módulos existentes | Contrato/garantía a proteger |
| --- | --- | --- |
| Acceso CMS y esquemas | `dataAccess.js`, `data.js`, `validation.js`, `internalConfig.js` | Lectura/escritura centralizada, enums canónicos, hooks de integridad y append-only |
| Caja y ledger fiscal | `cajas.web.js`, `eventLog.js`, `securityEngine.js` | Idempotencia, secuencia, hash-chain, rectificativas, proyección de caja |
| Fiscalidad y gestoría | `fiscalAggregator.web.js`, `fiscalDocuments.web.js` | Agregación paginada, DTO mínimo, versiones de paquete no sobrescribibles |
| Jornada laboral | `horario.web.js`, `staff.js`, `security.js` | Identidad staff verificada, firma HMAC, registros append-only |
| Eventos y procesos asíncronos | `events.js`, `crons.js`, `audit.js` | Webhooks idempotentes, orden tolerante, reconciliación y alertas deduplicadas |

Los nombres anteriores corresponden a archivos verificados en `main`. No se han añadido módulos greenfield.

## 3. Cambio implementado en esta rama

### FDOC-VERSION — evitar sobrescritura de versiones de paquetes fiscales

**Diagnóstico verificado:** `createManagerPackageVersion` calculaba `nextVersion = history.length + 1`, construía un `documentId` determinista y persistía con `dalSave`. Dos solicitudes concurrentes podían leer el mismo historial y guardar el mismo `_id`; la semántica upsert de `save` permitía sobrescribir el snapshot que había creado la primera solicitud.

**Cambio mínimo:** sustituir el upsert por `dalInsert`. La unicidad del `_id` hace que solo una solicitud pueda crear esa versión. Una colisión `WDE0023` se devuelve como `PACKAGE_VERSION_CONFLICT`, indicando actualizar historial y reintentar. No se modifica ni elimina ninguna versión previa.

**Pruebas añadidas:** `fiscalDocuments.package-version.concurrency.test.mjs`, incorporada al runner `run-layer2.mjs`. Son pruebas estáticas de contrato sobre el writer; no simulan concurrencia real contra Wix CMS.

**Archivos:** 
- `src/backend/fiscalDocuments.web.js`
- `src/backend/tests/fiscalDocuments.package-version.concurrency.test.mjs`
- `src/backend/tests/run-layer2.mjs`

## 4. Cambio adicional — informes fiscales truncados rechazados

**Diagnóstico verificado:** `_fetchQuarterMovements` ya devolvía `reachedMaxPages=true` cuando quedaban registros fuera del límite de paginación. Sin embargo, `getQuarterlyTaxSummaryInternal` y `getLibroRegistroFacturasExpedidasInternal` seguían agregando las páginas parciales y devolvían `SUCCESS`, incluyendo el indicador de truncamiento como dato informativo. Un consumidor podía interpretar como completo un informe incompleto.

**Cambio mínimo:** ambos métodos consultan el indicador antes de calcular/devolver datos. Si se alcanzó el máximo, devuelven `FISCAL_DATASET_LIMIT_EXCEEDED` con `data:null`; no publican totales ni libro parcial como informe válido.

**Pruebas añadidas:** `FISCAL-PAGING-01` y `FISCAL-PAGING-02` siembran 5.001 movimientos sintéticos (más de 50 páginas de 100) y exigen rechazo fail-closed para resumen y libro de facturas.

**Archivos:** `src/backend/fiscalAggregator.web.js`, `src/backend/tests/fiscalAggregator.read.test.mjs`.

## 5. Hallazgo P1 pendiente — serialización de la cadena fiscal en eventLog

**Evidencia estática:** `registrarEventoEconomico` realiza, en este orden:
1. `_getLastCashEvent()` para leer el hash anterior.
2. `_getNextSequenceInternal()` para incrementar la secuencia mediante concurrencia optimista.
3. Calcula `hashChain(previousRecordHash, aeatPayload)`.
4. Inserta el movimiento en `MovimientosCaja`.

La actualización optimista de `CAJA_SEQ` evita que dos writers consuman el mismo contador si el contrato de revisión de Wix se cumple, pero no serializa la lectura del último movimiento con la inserción. Dos eventos distintos concurrentes pueden leer el mismo hash anterior, reservar secuencias distintas y crear una bifurcación de la cadena.

**Impacto:** integridad del ledger y verificabilidad de la cadena fiscal. La idempotencia por `eventId` de webhook no evita esta carrera entre eventos diferentes.

**Estado:** riesgo P1 identificado por inspección del código; todavía no se ha demostrado mediante una prueba de concurrencia contra Wix ni se ha implementado un mutex. No se debe declarar cerrada la integridad concurrente de `eventLog`.

**Resolución técnica necesaria:** diseñar una serialización de append que use una primitiva CMS con compare-and-swap/lease y recuperación tras timeout, o una estrategia de reserva única por secuencia con reconciliación del head. Antes de implementar, verificar esquema físico de `CajaActual`/`ControlOperativo`, semántica de revisión de `@wix/data`, vencimiento/fencing y comportamiento tras caída del proceso. Un lock con TTL sin fencing/renovación no basta.

## 6. Gaps adicionales que permanecen abiertos

1. Ejecutar suite completa `npm run test:layer2` y `npm run test` en CI para el head de esta rama; el cambio aún no tiene resultado de ejecución.
2. Probar concurrencia de eventos fiscales distintos, colisión de secuencia, timeout después del insert y reconciliación del hash head.
3. Probar concurrencia real de creación de paquetes fiscales; el test nuevo es de contrato estático y la protección de producción se basa en unicidad de `insert`.
4. Revisar el uso compartido de `HistoricoCierresZ` por cierres Z y paquetes de gestoría. Se conserva la compatibilidad existente; no se migra colección sin análisis de datos/contratos.
5. Validar que `fiscalAggregator.web.js` pagina todos los resultados y aplica límites de forma consistente con el volumen real.
6. Validar exportaciones y DTOs contra el consumidor real de gestoría, sin exponer PII ni campos fiscales internos en métodos públicos.
7. Validar fichajes y firmas HMAC en Wix QA, incluyendo duplicidad, ajustes rectificativos y secuencias de eventos.
8. Completar pruebas E2E integradas Capa 1 → Capa 2 → Capa 3 en entorno aislado. SharePoint sigue siendo evidencia documental, nunca autoridad transaccional.

## 7. Seguridad y límites de ejecución

- Cambios únicamente en rama GitHub; sin despliegue ni publicación Wix.
- Sin escrituras en CMS de producción.
- Sin emitir facturas, rectificativas ni cierres reales.
- Sin crear/cancelar reservas reales.
- Sin mutar ledgers existentes.
- No se considera validado ningún test que no haya sido ejecutado y observado en CI o entorno controlado.

## 8. Estado

- **Verificado:** PR #153 integrada en `main`; mapa de módulos y gate Capa 2 inspeccionados; defecto potencial de upsert concurrente en paquetes identificado y corregido en esta rama mediante insert-only.
- **Pendiente de ejecución:** nueva suite y gates CI.
- **Pendiente de diseño/cierre:** serialización concurrente del ledger fiscal `eventLog`, pruebas Wix QA y flujos E2E.
- **No autorizado/realizado:** merge de esta rama y despliegue.
