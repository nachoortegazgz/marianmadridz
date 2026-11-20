# Estado técnico consolidado — Marian Madrid

**Fecha de corte:** 2026-11-20  
**Repositorio:** `nachoortegazgz/marianmadridz`  
**Rama estable de referencia:** `main`  
**HEAD de main verificado antes de esta intervención:** `6192095a8bb288337dc6d96f81ab1ca313822fb8`  
**Sitio Wix:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Estado:** desarrollo y QA. Publicación y despliegue productivo: **NO-GO**.

## 1. Resumen ejecutivo

El repositorio contiene una base de controles offline y una política fail-closed para TPV QA persistente. El sitio Wix está en estado **Draft**, Velo habilitado, moneda EUR y zona horaria Europe/Madrid. La presencia de almacenes CMS LIVE/SANDBOX separados no acredita por sí sola qué data plane utiliza cada invocación de un WebMethod.

El TPV QA persistente sigue deshabilitado en configuración canónica. La jornada sintética añadida en PR #492 ejecuta validación de ventas y conciliación aritmética en memoria; no es una prueba E2E de Wix ni escribe CMS.

## 2. Últimos cambios integrados

| PR | Commit integrado | Alcance | Validación documentada |
|---|---|---|---|
| #482 | `520e99b87caedfc6323e1f27f5638a0053774eb9` | Import `wix-fetch` y mock offline | CI PASS |
| #483 | `a801405f77dddfe8fcfe76a825be47e656aa542c` | Documenta discrepancia de `@wix/crm` entre `wix.lock` y npm | Documentación |
| #484 | `03a67652d87298855aec70d43b2ac44fa5024994` | TPV fail-closed y bloqueo UI | CI PASS |
| #485 | `470ea256d2af88bc62465788cd67e40d84f1a001` | Snapshot de uso CMS LIVE/SANDBOX read-only | Documentación |
| #486 | `5ef81ff132f4cbff594387a60e4446bc5dada171` | Contratos de QA backend y documentación | CI PASS |
| #488 | `75c4428fea45795d4337011c389ac909f0aa6e03` | Cobertura contractual de WebMethods TPV exportados | CI PASS |
| #490 | `a7cf9fc24e760bdf87b0a1df839dd3888ce462b6` | Identificadores/periodos de paquetes documentales mensuales | CI PASS |
| #491 | `6192095a8bb288337dc6d96f81ab1ca313822fb8` | Handoff y release-readiness actualizados | CI PASS |

El último baseline integrado comunicado por CI: 74 suites / 695 tests, junto con SDK contracts y ESLint PASS. Este resultado corresponde al código de main anterior a PR #492; no se debe atribuir al nuevo simulacro.

## 3. PR #492 — simulacro de jornada de negocio

Rama: `qa/tpv-synthetic-business-day-simulation-2026-11-20`  
PR: https://github.com/nachoortegazgz/marianmadridz/pull/492  
HEAD actual al preparar este documento: `fb1f89a43acb921f4dba4f36ce7cf91a359d46c9`.

Añade:
- `src/backend/tests/tpv.business-day.simulation.test.mjs`
- `docs/qa/2026-11-20-tpv-synthetic-business-day-simulation.md`

Escenario: tres ventas (76,23 EUR; 39,33 EUR; 30,13 EUR), devolución sintética 30,13 EUR, entrada de caja 20,00 EUR, salida 12,00 EUR y fondo inicial 150,00 EUR. Venta bruta 145,69 EUR; neta de devolución 115,56 EUR; efectivo esperado en cajón 204,10 EUR.

La prueba reutiliza `validateSaleDraft()` y helpers sintéticos del backend, con eventos en memoria. El replay idempotente se modela con un Map de prueba, no con el repositorio CMS. Por tanto no certifica locks, atomicidad, concurrencia ni persistencia.

Estado de CI completado sobre el HEAD `f69caa865040dde8e23d4997d83703ebe3f30b68`:
- Backend offline quality gates: SUCCESS, run `44734144555`.
- Secret scanning: SUCCESS, run `44734144522`.
- Layer 1: 28 suites / 336 tests, 0 fallos.
- Layer 2: 19 suites / 268 tests, 0 fallos.
- Regresión completa: 75 suites / 702 tests, 0 fallos.
- `npm audit`: 0 vulnerabilidades reportadas.
- Contratos SDK Wix, contratos eCommerce/TPV Catalog V3 y ESLint: PASS.
- No hay ejecución Wix Runtime ni E2E asociada a esta PR.

## 4. Configuración y límites de seguridad TPV

Configuración canónica:
- `TPV_QA_RUNTIME_POLICY.ENABLED=false`.
- `ENVIRONMENT="SANDBOX"` es configuración declarativa; no demuestra el contexto de ejecución.
- `SYNTHETIC_ONLY=true`.
- Pagos reales, writers fiscales, notificaciones y hardware permanecen deshabilitados.
- El loader offline puede activar la política solo dentro de su proceso de pruebas; no cambia el código de Wix Runtime.

No se habilitaron writers fiscales/contables, pagos, notificaciones ni hardware durante este trabajo.

## 5. Estado CMS y datos sensibles a reconciliación

Última observación documentada por Site Data Usage API read-only:
- LIVE: 201 elementos / 264.970 bytes.
- SANDBOX: 107 elementos / 204.766 bytes.
- `CajaActual`: 1 elemento en cada entorno según contadores de uso.
- `TpvSandboxIdentities`: 0 elementos en ambos entornos.
- `MovimientosCaja`: 0 elementos en ambos entornos.

La API de uso no proporciona los IDs/contenidos de los elementos Sandbox ni acredita el data plane de cada WebMethod.

Incidencias que no deben mutarse sin reconciliación:
1. Singleton `CajaActual` LIVE anómalo: abierto y marcado con metadatos sintéticos TPV; traceId distinto del test-run vigente. No cerrar, reutilizar ni sobrescribir.
2. Tres filas `ControlOperativo` con `COMPENSATION/PENDING_RECOVERY`; no reintentar a ciegas.
3. Órdenes #10033 y #10032 permanecen sin reconciliación documentada en el handoff anterior.
4. No se ha probado bootstrap seguro de caja Sandbox ni sembrado de identidades Sandbox.

No se han realizado escrituras CMS en esta intervención.

## 6. Bloqueos y prioridades vigentes

### P0 — no desplegable
- #434: release gate global.
- #416: reconciliación de compensaciones pendientes y singleton LIVE.
- #209 / #415: SIF/VERI*FACTU, maestro fiscal y configuración incompletos; writers fiscales deshabilitados.
- #290: claims atómicos de webhooks pendientes de E2E.
- #441: recuperación histórica y E2E pendientes.

### P1 — TPV y runtime
- H-01: concurrencia/atomicidad de `CajaActual`; los escritores identificados no se han migrado a un contrato CAS único.
- #435: TPV QA Sandbox E2E.
- #210: branch protection y required checks requieren acción owner/admin.
- #211: Bookings + Payments E2E.
- #159 / #162 / #164: idempotencia, recuperación y seguridad de MessageEvent requieren runtime.
- #237: autoridad de inventario Wix Stores V3.
- #261 / #291: permisos y operaciones CMS condicionales pendientes de runtime.
- C1: `@wix/crm` está en `wix.lock`, pero no en `package.json` / `package-lock.json`; requiere reconciliación mediante toolchain Wix/npm oficial, no edición manual del lock.
- C10/C11 y D1-D4: bindings, widgets, cron parity y smoke runtime pendientes.

### P2
- #173: pipeline SharePoint/Power Automate E2E no demostrado.

El estado de los issues es el último estado documental disponible; no implica que se haya consultado y reconciliado todo el backlog en esta intervención.

## 7. Matriz de evidencia

| Área | Estado | Evidencia / limitación |
|---|---|---|
| Unit/offline CI de main | PASS histórico | 74 suites / 695 tests en baseline previo a PR #492 |
| Simulacro de jornada PR #492 | CI pendiente al corte | Fixture offline que importa validador real; no runtime |
| Secret scanning PR #492 | PASS | Run 44733984841 sobre HEAD fb1f89a |
| Backend offline PR #492 | EN CURSO | Run 44733984865 sobre HEAD fb1f89a |
| Wix Sandbox data-plane attestation | NO VERIFICADO | Contadores de uso no acreditan contexto por WebMethod |
| Persistencia TPV QA | BLOQUEADA | Política canónica ENABLED=false |
| H-01 CajaActual | ABIERTO | Sin CAS end-to-end de todos los productores |
| Wix Editor / Preview E2E | PENDIENTE | No ejecutado en esta intervención |
| Publicación Wix | NO REALIZADA | Sitio continúa Draft en última lectura |
| Release productivo | NO-GO | P0/P1 y runtime pendientes |

## 8. Reglas para la siguiente fase

1. No habilitar TPV QA persistente hasta probar el data plane Sandbox por invocación y sus permisos.
2. No usar ni modificar el singleton LIVE para pruebas.
3. No escribir en CMS con identidades sintéticas hasta demostrar aislamiento de entorno.
4. Resolver H-01 coordinando todos los escritores y probando concurrencia, idempotencia, timeout incierto y hooks.
5. Mantener append-only los ledgers; corregir mediante registros rectificativos trazables.
6. Ejecutar Wix Sandbox E2E y regresión completa antes de cualquier publicación.
7. No publicar mientras existan P0 abiertos, pruebas fallidas o reversión no demostrada.

## 9. Criterio de salida

El código puede considerarse candidato offline cuando la CI completa pasa en el HEAD revisado y el diff es aprobado. No se considera funcional integralmente en Wix hasta superar runtime E2E, aislamiento, permisos, concurrencia y reconciliación. La publicación permanece bloqueada.


## Addendum vigente — 2026-11-20, HEAD main cfe1d0c

Este bloque prevalece sobre los snapshots y addenda TPV anteriores cuando exista contradicción.

### Repositorio y CI
- HEAD de `main`: `cfe1d0c37a9464cb63aea9d31873071eecb10d9f` (PR #499 fusionada).
- PR #496, #497, #498 y #499 integradas.
- CI post-merge para este SHA: Backend offline quality SUCCESS (run `44780145944`) y Gitleaks SUCCESS (run `44780145900`).
- Evidencia: Layer 1 28 suites/338 tests; Layer 2 19 suites/268 tests; total 75 suites/705 tests, 0 fallos; contratos Wix SDK, eCommerce Order Transactions y TPV Catalog, ESLint y Gitleaks PASS.
- Esta evidencia es offline/estática. No acredita Wix Runtime, Preview E2E, permisos efectivos ni despliegue.

### Contrato TPV Sandbox vigente
- Configuración canónica actual: `TPV_SANDBOX_RUNTIME_POLICY.ENABLED=true`, `ENVIRONMENT=SANDBOX`, `SYNTHETIC_ONLY=true`, pagos reales, escrituras fiscales, notificaciones y hardware deshabilitados; run ID `TPVSANDBOX-DEV-20261120-01`.
- No confundir esta implementación con la ruta histórica `TPV_QA_RUNTIME_POLICY` / WebMethods con sufijo QA. La documentación antigua de esa ruta se conserva como historial, no como contrato actual del TPV Sandbox.
- Los WebMethods actuales usan nombres neutros y exigen autorización backend y `assertTpvSandboxEnabled()`. Las etiquetas `environment` / `previewOnly` no prueban por sí solas qué data plane atiende la llamada.
- Las colecciones `SANDBOX_LOGICAL_*` son aliases lógicos, no colecciones físicas nuevas: el repositorio proyecta eventos en `MovimientosCaja`, estado de sesión/proyección en `CajaActual` y locks en `ControlOperativo`. Wix Apps no quedan aisladas por CMS Sandbox.
- PR #499 convirtió el bootstrap de caja y la comprobación de las seis identidades en read-only. La aplicación exige presemilla manual en CMS Sandbox; no crea singleton ni identidades automáticamente.

### Precondiciones sintéticas
- Caja: `_id=SINGLE_ITEM_ID`, `singletonKey=CAJA_PRINCIPAL`, `cashRegisterStatus=CERRADA`, `snapshotSource=TPV_SANDBOX_INITIALIZED`, `traceId=TPVSANDBOX-DEV-20261120-01`, `sequenceCounters` objeto y `conceptOperations.tpvSandbox.sandboxRunId` coincidente.
- Identidades: tres clientes y tres profesionales, IDs `SANDBOX-CUSTOMER-01..03` y `SANDBOX-STAFF-01..03`, `environment=SANDBOX`, `syntheticOnly=true`, `active=true`, `testRunId` igual al run ID y correos `@example.test`. No añadir PII ni referencias de CRM/Bookings/Members.
- Última lectura read-only documentada: `TpvSandboxIdentities=0` en ambos data planes. No se ha demostrado que la presemilla exista ni se ha ejecutado.

### Corrección adicional en revisión
La revisión del repositorio identificó que los locks de `ControlOperativo` deben validar el marcador de `CajaActual` antes de cualquier acceso. La rama `fix/tpv-sandbox-lock-preflight-and-docs` incorpora un helper read-only común, el preflight previo a los locks y una prueba contractual. Está pendiente de CI/merge; no atribuir esta corrección a `main` hasta su integración.

### Riesgos y límites no resueltos
- `SANDBOX_RUN_ID` es estático; no existe ciclo de vida/rotación de test-run validado.
- No se ha ejecutado Wix Preview E2E ni prueba negativa desde Published/direct WebMethod.
- No hay prueba de concurrencia/atomicidad en Wix Runtime para todos los escritores de `CajaActual` (H-01).
- No se ha ejecutado comparación de datos LIVE antes/después de una jornada TPV.
- Permisos efectivos por rol, efectos de automatizaciones y Wix Apps, reset sintético preproducción y rollback permanecen pendientes.
- Site Context observado: Draft. No se ha publicado ni acreditado la sincronización del código con Wix Editor.

### Decisión
CI offline de `main` en el SHA indicado: PASS. Integridad runtime, E2E y readiness global: NO VERIFICADOS. Publicación/despliegue: **NO-GO**. No tocar singleton LIVE, tres compensaciones `PENDING_RECOVERY`, pedidos #10032/#10033 ni ledgers. No sincronizar Sandbox→Online.


## Addendum posterior a PR #500 — 2026-11-20

PR #500 está fusionada en `main`: commit `6da7cdf0d815ad2e1833f5bd56b5950aff2afb3e`. La corrección consolida el helper `_ensureCajaActualForSandbox()` para validar existencia y marcador/run ID de `CajaActual` y ejecuta ese preflight antes de cualquier lectura/escritura de locks en `ControlOperativo`. Se añade una prueba contractual específica.

Validación pre-merge del HEAD `306816dff20d62e4ec3fda87e25fb050c155bb96`: Layer 1 28 suites/339 tests PASS; Layer 2 19 suites/268 tests PASS; suite completa 75 suites/706 tests PASS; contratos Wix SDK, eCommerce Order Transactions, TPV Catalog y ESLint PASS; Gitleaks PASS (runs `44781808680` y `44781808524`). CI post-merge para `6da7cdf0...` está en curso en los runs `44781982497` y `44781982392`; no declararlo aprobado hasta que ambos finalicen SUCCESS.

La corrección es una barrera de código por estado de datos; no identifica de forma contractual Preview frente a Published. No equivale a prueba de aislamiento runtime ni a aceptación E2E. Wix Preview, prueba negativa Published, concurrencia H-01, permisos efectivos, efectos externos, comparación LIVE antes/después y reset preproducción siguen pendientes. Sitio Wix observado en Draft. **NO-GO de publicación.**
