# Reconciliación read-only Wix CMS y dependencias — 2026-11-20

**Repositorio:** `nachoortegazgz/marianmadridz`  
**Main auditado:** `520e99b87caedfc6323e1f27f5638a0053774eb9`  
**Sitio:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Método:** consultas REST Wix CMS de solo lectura; no se ejecutaron escrituras, seed, bootstrap ni publicación.

## 1. Resultado ejecutivo

La lectura actual del dataset accesible por Wix CMS Management API contradice parte del snapshot anterior: existe un singleton `CajaActual` con marcadores sintéticos, pero **no corresponde al test-run configurado por el código actual**. El estado real observado es `ABIERTA`, `traceId=TPV-SANDBOX-OPEN-mwopb42y-u1bz4asy`, `openedBy=TPV_SANDBOX_SYSTEM` y `snapshotSource=TPV_QA_SYNTHETIC`. No debe reutilizarse, cerrarse, corregirse ni sobrescribirse desde esta intervención.

El backend actual exige un test-run exacto y un estado de caja distinto. Por tanto, la apertura QA debe fallar de forma cerrada con este singleton. No se ha demostrado que el dataset REST de Management API represente Wix Sandbox; las consultas REST no aportan un selector de Preview/Sandbox. Se utiliza como referencia de datos accesibles por Management API, no como prueba de qué almacén utiliza una ejecución Preview.

**Release: NO-GO.** Faltan identidades sintéticas en CMS, un bootstrap de caja inequívocamente Sandbox y una ejecución Wix Preview/E2E real.

## 2. Evidencia CMS consultada

Endpoints oficiales consultados:
- [Query Data Items](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/query-data-items)
- [Count Data Items](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/count-data-items)

Resultados de conteo con lectura consistente:

| Colección | Elementos |
|---|---:|
| `CajaActual` | 1 |
| `MovimientosCaja` | 0 |
| `TpvSandboxIdentities` | 0 |
| `ControlOperativo` | 58 |
| `HistoricoCierresZ` | 0 |

### CajaActual

La consulta devuelve un único elemento:
- `_id`: `SINGLE_ITEM_ID`
- `singletonKey`: `CAJA_PRINCIPAL`
- `cashRegisterStatus`: `ABIERTA`
- `snapshotSource`: `TPV_QA_SYNTHETIC`
- `traceId`: `TPV-SANDBOX-OPEN-mwopb42y-u1bz4asy`
- `openedBy`: `TPV_SANDBOX_SYSTEM`
- `openedAt`: `2026-11-20T08:12:21.994Z`
- `_updatedDate`: `2026-11-20T08:12:22.122Z`
- `closedAt`: `null`
- `sequenceCounters`: objeto vacío `{}` en esta lectura (no texto JSON).

Este snapshot actualiza la evidencia anterior: la discrepancia histórica de tipo de `sequenceCounters` no aparece en la lectura actual. La sesión, sin embargo, permanece ABIERTA y no tiene el `testRunId` esperado por el backend actual.

### ControlOperativo

Se contaron 58 elementos. La consulta de la página disponible muestra registros de webhook, locks, cachés y rate limits. Se observan **3 registros `COMPENSATION/PENDING_RECOVERY`** en la muestra completa consultada. No se han modificado ni reintentado; permanecen fuera del alcance de QA TPV.

## 3. Contrato actual de protección TPV

Archivos revisados:
- `src/backend/internalConfig.js`
- `src/backend/tpv/tpvUtils.js`
- `src/backend/tpv/tpvQaRepository.js`
- `src/backend/tpv/tpvCaja.web.js`
- `src/backend/tpv/tpvSandboxIdentities.js`
- `src/public/tpvPageController.js`

El backend configura `TEST_RUN_ID=TPVQA-DEV-20261120-01`. `assertQaCajaWritable()` solo admite:
1. una caja sintética con `cashRegisterStatus=SIMULACION`, `snapshotSource=TPV_QA_SYNTHETIC`, `traceId` igual al test-run y `conceptOperations.tpvQa.testRunId` igual al test-run; o
2. un bootstrap marcado `TPV_QA_SANDBOX_INITIALIZED`, cerrado y con el mismo `traceId` y `testRunId`.

El singleton observado no satisface ninguno de esos contratos: está `ABIERTA`, su `traceId` es distinto y no contiene el estado `conceptOperations.tpvQa` requerido. `withQaSessionLock()` ejecuta el preflight de caja antes de crear locks; `insertQaEvent()` también exige caja elegible antes de persistir eventos. La apertura QA no puede iniciarse sobre este singleton.

La colección `TpvSandboxIdentities` está vacía en la lectura de Management API. No hay clientes ni profesionales sintéticos disponibles en ese dataset.

## 4. Dependencia CRM: corrección de diagnóstico C1

`src/backend/staff.js` importa `contactsV5` desde `@wix/crm`.

- `package.json` declara dependencias Wix excepto `@wix/crm`.
- `package-lock.json` tampoco contiene `@wix/crm`.
- **`wix.lock` sí declara `@wix/crm` como dependencia directa del proyecto Wix en versión `1.0.1636`**, y contiene su ubicación y dependencias transitivas (incluido `@wix/auto_sdk_crm_contacts-v-5`).

Corrección: no es exacto afirmar que el paquete está ausente de todo el entorno Wix. Está registrado en `wix.lock`; la discrepancia pendiente afecta al manifiesto/lock de npm usado por CI. No se cambia el paquete ni se fabrica un lockfile. Hay que decidir y verificar la sincronización soportada entre dependencias del Editor/Wix CLI y el entorno npm local.

## 5. Acciones realizadas y no realizadas

**Realizado**
- Lectura de Site Context y del HEAD de `main`.
- Lectura de archivos backend y de los contratos TPV.
- Conteos CMS y consulta de `CajaActual`/ `ControlOperativo` mediante endpoints oficiales.
- Reconciliación de la presencia de `@wix/crm` en `wix.lock`.

**No realizado**
- Ningún insert/update/delete en Wix CMS.
- Ningún seed de identidades ni bootstrap de caja.
- Ninguna escritura en `MovimientosCaja`, `ControlOperativo`, `HistoricoCierresZ` o ledgers.
- Ninguna invocación de pagos, reservas, Bookings/Stores/Gift Cards writers, notificaciones, hardware, firma fiscal o AEAT.
- Ninguna ejecución de Wix Preview/E2E, sincronización del Editor o publicación.

## 6. Próximos pasos seguros

1. Obtener evidencia del dataset Sandbox desde Wix Editor/Local Editor Preview; Management REST no demuestra el contexto Preview.
2. Crear/activar una caja QA independiente solo desde un contexto confirmado Sandbox, con el test-run vigente y preflight idempotente; nunca reutilizar el singleton observado.
3. Sembrar las tres identidades sintéticas en `TpvSandboxIdentities` desde ese mismo contexto y verificar hooks/permisos.
4. Ejecutar pruebas negativas en Published y pruebas positivas en Preview, verificando que el singleton y las colecciones LIVE no cambian.
5. Completar E2E de widget, ventas sintéticas, pagos simulados, devoluciones, arqueos, tickets X/Z, idempotencia y concurrencia.
6. Resolver el grafo npm/Wix de `@wix/crm` sin edición manual de locks.
7. Mantener apagados los writers fiscales/contables/laborales y las integraciones externas; no publicar hasta cerrar los gates P0/P1.

**Conclusión:** la arquitectura TPV contiene guardas que rechazan el singleton actual, pero todavía no puede completar un test-run persistente porque no existe una caja inicializada para el test-run y no hay identidades en el dataset consultado. La intervención no ha cambiado datos ni el estado del sitio.
