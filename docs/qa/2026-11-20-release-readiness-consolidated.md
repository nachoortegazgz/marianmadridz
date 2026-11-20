# Estado consolidado y preparación de despliegue — 2026-11-20

**Repositorio:** `nachoortegazgz/marianmadridz`  
**Sitio Wix:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Rama de referencia:** `main`  
**Baseline de esta consolidación:** `470ea256d2af88bc62465788cd67e40d84f1a001`  
**Estado:** desarrollo/QA; publicación y despliegue productivo **NO-GO**.

## 1. Resumen ejecutivo

El repositorio tiene controles offline y una protección fail-closed para el TPV QA persistente. El sitio tiene almacenes CMS LIVE y SANDBOX separados según la documentación y la Site Data Usage API. Aún no está demostrada la relación entre el contexto de una invocación concreta de WebMethod y el data plane utilizado. Por ello, el TPV QA persistente permanece deshabilitado.

No se ha publicado el sitio ni se han realizado escrituras CMS durante las intervenciones documentadas aquí.

## 2. Cambios integrados recientes

| PR | Commit de merge | Alcance | Estado |
|---|---|---|---|
| #482 | `520e99b87caedfc6323e1f27f5638a0053774eb9` | Import oficial `fetch` desde `wix-fetch`; mock offline del export nombrado | Integrada; CI PASS |
| #483 | `a801405f77dddfe8fcfe76a825be47e656aa542c` | Reconciliación C1: `@wix/crm@1.0.1636` está en `wix.lock`, no en el lock npm | Integrada; documentación |
| #484 | `03a67652d87298855aec70d43b2ac44fa5024994` | Fail-closed TPV: política deshabilitada en runtime y widget sin falsa etiqueta Sandbox | Integrada; CI PASS |
| #485 | `470ea256d2af88bc62465788cd67e40d84f1a001` | Snapshot de uso Wix CMS LIVE/SANDBOX vía API read-only | Integrada; documentación |

PR #482 informó CI completa en Node 24.22.1: 74 suites / 692 tests, npm audit 0 vulnerabilidades, SDK contracts, ESLint y secret scanning PASS. PR #484 tuvo Backend offline quality gates y Secret scanning SUCCESS (runs `44726194437`, `44726194440`). Esas pruebas son offline/CI; no equivalen a Wix Preview, Published ni E2E.

## 3. Protección TPV vigente

Configuración canónica:
- `TPV_QA_RUNTIME_POLICY.ENABLED=false`.
- `ENVIRONMENT="SANDBOX"` es una etiqueta/configuración declarativa, no una prueba del contexto real.
- `assertTpvQaEnabled()` rechaza con `TPV_QA_DISABLED_UNTIL_SANDBOX_ISOLATION`.
- El HTML bridge informa `environment="DISABLED"` y rechaza mensajes `CASHIER_STATE` y `QA_*`.
- El loader Node modifica una copia en memoria de `internalConfig.js` solo durante pruebas offline para mantener pruebas de comportamiento de writers sintéticos. No cambia el archivo canónico ni Wix Runtime.
- Los pagos reales, writers fiscales/contables/laborales, notificaciones y hardware permanecen deshabilitados.

La PR #484 bloquea los WebMethods TPV que invocan el guard y el controlador UI. Esta PR añade una prueba contractual para enumerar los WebMethods QA publicados y verificar que el guard aparece antes de los accesos al repositorio. La prueba estática no demuestra el runtime Wix.

## 4. Estado CMS observado

Fuente: Wix Site Data Usage API, consulta read-only. Detalle: `docs/audits/2026-11-20-wix-live-sandbox-usage.md`.

| Colección | LIVE | SANDBOX |
|---|---:|---:|
| CajaActual | 1 | 1 |
| MovimientosCaja | 0 | 0 |
| TpvSandboxIdentities | 0 | 0 |
| ControlOperativo | 58 | 0 |
| HistoricoCierresZ | 0 | 0 |
| CitasF2 | 6 | 6 |
| ServiciosCatalogo | 95 | 95 |
| MapaStaff | 5 | 5 |
| ComplementosCatalogo | 36 | 0 |

Totales de uso reportados: LIVE 201 elementos / 264.970 bytes; SANDBOX 107 / 204.766 bytes.

La API de uso no expone los IDs/contenidos de los elementos Sandbox ni acredita qué almacén usa una invocación WebMethod concreta. El snapshot anterior que informaba SANDBOX 0 está supersedido por este snapshot.

## 5. Incidencias que no deben mutarse a ciegas

- El singleton `CajaActual` LIVE observado por CMS Management está marcado `TPV_QA_SYNTHETIC`, pero figura `ABIERTA` y su `traceId` no coincide con `TPVQA-DEV-20261120-01`. El helper de caja QA lo rechaza. No cerrar, reutilizar ni sobrescribir sin reconciliación.
- `ControlOperativo` contiene tres registros `COMPENSATION/PENDING_RECOVERY`. Requieren análisis de saga y evidencia de orden/pago antes de cualquier reintento o compensación.
- No se ha verificado que el singleton Sandbox sea válido para el bootstrap TPV.
- No hay identidades sintéticas sembradas ni caja QA inicializada.

## 6. Matriz de tareas y release gates

| ID | Trabajo | Estado | Evidencia / siguiente acción |
|---|---|---|---|
| C1 | Alinear `@wix/crm` entre Wix y npm | Pendiente | Regenerar npm lock en entorno con registry y ejecutar `npm ci`; no editar lock a mano |
| C2 | Import `wix-fetch` | Aplicado | PR #482 + CI |
| C3 | Node CI | Cubierto | Workflow fija Node 24.22.1 |
| C4 | ESLint Wix backend import rule | Bloqueado | Resolver plugin/manifiesto oficial sin inventar `velo.dependencies.json` |
| C5 | Writers TPV operativos | Deshabilitados | Requieren aislamiento, contratos y E2E; no habilitar por despliegue |
| C6 | Fichaje | Deshabilitado | Concurrencia, idempotencia, autorización y retención legal pendientes |
| C7 | Ledger contable | Deshabilitado | Falta aprobación PGC/reglas y pruebas de cuadre/rectificación |
| C8 | Ledger fiscal | Deshabilitado | Falta certificación de firma y flujo legal/fiscal |
| C9 | Persistencia QA | Bloqueada | Probar data-plane backend y direct-WebMethod negative test |
| C10 | aiAgent / stubs | Diferido | Inspeccionar bindings y consumidores externos |
| C11 | WebMethods/bindings | Diferido | Inventario en Wix Editor y contratos de plataforma |
| D1 | HTML Components | Pendiente | Sincronizar/read-back de los widgets raíz en Editor Classic |
| D2 | Cron parity/runtime | Pendiente | Verificar scheduler en entorno publicado controlado |
| D3 | Toolchain | Parcial | Node fijado; compatibilidad ESLint/CLI pendiente |
| D4 | Smoke Wix Sandbox | Pendiente | Ejecutar solo tras probar aislamiento y autorización |
| H-01 | CAS/atomicidad CajaActual | Pendiente | Probar Bulk Patch + hooks + lost update + timeout/idempotencia en Sandbox |
| P0 | Compensaciones pendientes | Pendiente | Conciliar tres filas y referencias externas sin reintento ciego |
| Release | Wix E2E + regresión + rollback | Pendiente | No hay evidencia de ejecución |

## 7. Secuencia mínima segura para desbloquear

1. Resolver C1 con npm real y lock reproducible; ejecutar CI.
2. Obtener una prueba backend verificable del data plane. Si Wix no ofrece un contexto de invocación confiable para distinguir Preview/Published, usar un sitio/tenant Sandbox separado con credenciales y CMS independientes. No simular un marcador vía WebMethod sin protección.
3. Probar que Preview lee el marcador de Sandbox y Published/direct-WebMethod falla antes de cualquier escritura. Comparar snapshots LIVE antes/después.
4. Inspeccionar el singleton Sandbox por el Editor y validar esquema, hooks y permisos. No reutilizar el singleton LIVE.
5. Crear identidades sintéticas idempotentes y bootstrap de caja solo en el entorno demostrado aislado.
6. Ejecutar pruebas E2E de ventas, pagos simulados, movimientos, devoluciones, arqueo, tickets X/Z, reintentos, idempotencia y concurrencia.
7. Resolver H-01 con pruebas CAS/Bulk Patch y hooks para todos los escritores de CajaActual; no migrar un writer aislado.
8. Conciliar P0 pendientes; comprobar contratos Wix Editor bindings, widgets y scheduler.
9. Ejecutar regresión completa, revisión de diff, CI, plan de reversión y aprobación explícita de publicación.

## 8. Condiciones de reversión y seguridad

- No borrar ni sobrescribir ledgers append-only; cualquier corrección debe ser rectificativa y trazable.
- No truncar colecciones globalmente; limpiar solo IDs exactos de test-run tras conciliación y autorización.
- No alterar el singleton LIVE `CajaActual` ni registros `PENDING_RECOVERY` como preparación de Sandbox.
- No activar `LEDGER_WRITES_ENABLED`, `ACCOUNTING_LEDGER_WRITES_ENABLED`, `ACCOUNTANT_SEND_ENABLED` ni proveedores externos durante QA.
- No sincronizar Sandbox → Live.
- No publicar si hay pruebas fallidas, riesgo P0 abierto o reversión no demostrada.

## 9. Criterio de salida

**NO-GO** mientras falte aislamiento backend demostrado, H-01, resolución de incidencias P0, E2E Wix, sincronización de widgets/bindings y plan de reversión probado.

No se proporciona porcentaje global de preparación: mezclar CI offline, documentación y pruebas de runtime en un único porcentaje sería engañoso. La métrica válida actual es por gate, según la tabla anterior.

## 10. Fuentes de autoridad

- Wix Site Data Usage API: https://dev.wix.com/docs/api-reference/business-solutions/cms/operations/site-data-usage/introduction
- Wix CLI preview: https://dev.wix.com/docs/wix-cli/cli-for-headless/command-reference/project-commands/preview
- Dossiers y evidencias del repositorio: `docs/qa/QA-ENVIRONMENT-SSOT.md`, `docs/audits/2026-11-20-wix-live-sandbox-usage.md`, `docs/audits/2026-11-20-live-cms-and-wix-lock-reconciliation.md`.


## Addendum de cierre PR #486 — 2026-11-20

- PR #486 integrada en `main`: `5ef81ff132f4cbff594387a60e4446bc5dada171`.
- Se añadió el test contractual `every exposed TPV QA WebMethod fails closed before repository access`, que enumera los WebMethods QA y comprueba que `assertTpvQaEnabled()` se ejecuta antes de las llamadas de repositorio contempladas.
- CI del head de PR `46aac82fa264387b5571ef3f6fc9d513072a2eb0`: Backend offline quality gates SUCCESS (run `44727128060`) y Secret scanning SUCCESS (run `44727128076`).
- `npm ci` correcto; `npm audit`: 0 vulnerabilidades; Layer 1: 28 suites / 335 tests; Layer 2: 19 suites / 267 tests; regresión offline completa: 74 suites / 693 tests; SDK contracts y ESLint PASS.
- Los logs siguen mostrando avisos de dependencias obsoletas y ESLint 8.25.0 fuera de soporte. No se actualizó la toolchain por riesgo de incompatibilidad con el plugin Wix; requiere una intervención separada con matriz de compatibilidad.
- La prueba es estática/offline y no sustituye una invocación real de Wix Preview/Published. No se habilitó TPV QA persistente, no hubo escrituras CMS, ni seed/bootstrap ni publicación.

**Estado de release sin cambios:** NO-GO. El commit de merge actualiza el repositorio y la documentación; no certifica Wix Runtime ni habilita producción.


## Addendum PR #488 — cobertura de políticas de WebMethods TPV

- PR #488 integrada en main: `75c4428fea45795d4337011c389ac909f0aa6e03`.
- La prueba `every exported TPV WebMethod has an explicit runtime policy classification` clasifica todos los WebMethods exportados de los módulos TPV revisados como backend-gated, read-only/pure validation o writer operativo fail-closed. Un método nuevo sin clasificación hace fallar el contrato.
- Incluye los endpoints de catálogo (`buscarClientesTPV`, `obtenerReservasClienteTPV`, `obtenerServicios`, `obtenerProfesionales`, `obtenerProductos`, `obtenerVariantesProducto`), la validación de borrador y los writers operativos legacy bloqueados.
- CI de PR #488: Backend offline quality gates SUCCESS (run `44727911850`); Secret scanning SUCCESS (run `44727911591`). Layer 1, Layer 2, regresión offline completa, contratos SDK, contratos eCommerce/TPV y ESLint finalizaron correctamente.
- La cobertura es estática/offline. No prueba permisos Wix efectivos, Wix Preview/Published, llamadas a Wix Apps ni el aislamiento del data plane.
- No se modificaron módulos runtime, flags, CMS, permisos, secretos ni publicación. `TPV_QA_RUNTIME_POLICY.ENABLED=false` se mantiene.

**Release gate permanece NO-GO.**

## Addendum PR #490 — presentación de paquetes mensuales

- PR #490 integrada en `main`: `a7cf9fc24e760bdf87b0a1df839dd3888ce462b6`.
- Corregido el listado y la descarga de paquetes: un paquete `MONTHLY` muestra `MM/YYYY` e identificador `DOC_GESTORIA_{year}_M{month}_PAQUETE_GESTORIA_V{version}`; no se reutiliza el formato `T{quarter}`. Se mantiene el formato trimestral existente y se representan los periodos incompletos sin inventar valores.
- CI de PR #490: Backend offline quality gates SUCCESS (run `44730611443`); Secret scanning SUCCESS (run `44730611433`). Layer 1: 28 suites / 336 tests; Layer 2: 19 suites / 268 tests; regresión completa: 74 suites / 695 tests; SDK contracts y ESLint PASS.
- Sin mutaciones Wix/CMS ni efectos externos. Sin prueba runtime de gestoría o envío Resend; `ACCOUNTANT_SEND_ENABLED=false` se conserva.

**Release gate sin cambios: NO-GO.**


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
