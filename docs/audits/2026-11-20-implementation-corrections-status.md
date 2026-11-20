# Auditoría de implementación — correcciones C1–C11 y D1–D4

**Fecha:** 2026-11-20  
**Repositorio:** `nachoortegazgz/marianmadridz`  
**Base auditada:** `d7dd23642cbe8dd901fe537d259ae93b3d0dab6e`  
**Rama de trabajo:** `fix/p0-build-runtime-imports-2026-11-20`  
**Alcance de esta intervención:** cambios mínimos de código y decisión de seguridad sobre el resto de la lista.  
**Estado de despliegue:** NO-GO; no se ha publicado ni ejecutado runtime Wix.

## 1. Resultado ejecutivo

Se ha aplicado una corrección de código directamente justificada por el análisis estático: importar explícitamente `fetch` desde `wix-fetch` en `src/backend/cajas.web.js`, que lo utiliza en el firmador fiscal. Wix documenta ese import para Velo. La corrección no activa el firmador ni habilita escrituras fiscales.

No se ha añadido `@wix/crm` a `package.json` porque el lockfile contiene 443 paquetes y no incluye ni el paquete ni los 12 módulos dependientes del SDK CRM. En este entorno no ha sido posible ejecutar `npm install` contra npm ni generar y verificar el lockfile; editar solo el manifiesto dejaría `npm ci` inconsistente. La versión `1.0.1714` aparece publicada en npm, pero eso no sustituye la generación reproducible del lockfile.

## 2. Cambios aplicados

### C2 — Import de Wix Fetch
- Archivo: `src/backend/cajas.web.js`.
- Añadido: `import { fetch } from "wix-fetch";`.
- Se conserva intacta la lógica de timeout, circuit breaker, secretos, validación de respuesta y manejo de errores.
- No se ha invocado el endpoint de firma ni se han realizado operaciones fiscales.

**Estado:** import corregido y harness offline actualizado para exponer el export nombrado `fetch` de `wix-fetch`. La primera ejecución de CI detectó que el mock genérico del loader no exportaba nombres; el fallo era del harness, no del contrato Wix. Se añade un mock específico de `wix-fetch` basado en `globalThis.fetch` de Node exclusivamente para pruebas offline. Prueba de invocación real del firmador pendiente.

## 3. Correcciones no aplicadas y motivo

| ID | Decisión | Motivo / condición para continuar |
|---|---|---|
| C1 | Pendiente | Requiere regenerar `package-lock.json` con npm y verificar `npm ci`. La sesión no dispone de shell con acceso a registry.npmjs.org. No se edita el lock a mano ni se rompe reproducibilidad. |
| C3 | Sin cambio de código | El workflow ya fija Node `24.22.1`. La propuesta de `engines >=24` es una mejora de política, no una corrección demostrada necesaria para CI; no se añadió sin comprobar impacto en CLI/local tooling. La suite debe volver a pasar en la PR candidata. |
| C4 | Mantener desactivada | Historial documentado: al activarla con ESLint 8.25.0 y `@wix/eslint-plugin-cli@1.0.2`, la regla falló al cargar con `ERR_INVALID_ARG_TYPE` (run `42985830795`). Además falta `src/velo.dependencies.json`; no se crea manualmente. Requiere resolver compatibilidad oficial del plugin y el flujo Wix de manifiesto antes de activarla. |
| C5 | No habilitar writers operativos | Activar venta/devolución real cambia el TPV de QA a sistema transaccional. Faltan entorno aislado probado, pagos y conciliación por método, contratos de ticket/fiscal, reservas asociadas, compensación y E2E. Se mantienen stubs fail-closed y los flujos sintéticos. El catálogo sí lee servicios y productos nativos; las identidades de cliente/profesional y pagos continúan sintéticos. |
| C6 | No activar fichaje | No se habilitan flags de escritura ni se conecta UI hasta probar concurrencia por empleado/día, secuencia, idempotencia, correcciones append-only, firma, autorización y conservación legal. El UI no sustituye controles backend. |
| C7 | Mantener gate y documentar decisión | No hay consumidor runtime y el propio código condiciona el mapeo a aprobación formal del rule set PGC. No se activa el ledger contable sin aprobación y pruebas de cuadre/rectificación. |
| C8 | Mantener gate duro | No convertir la presencia de secretos en autorización fiscal. La existencia de endpoint/certificado no demuestra validez de firma, cumplimiento Veri*Factu, disponibilidad ni consistencia del ledger. Requiere certificación del firmador y pruebas de extremo a extremo. |
| C9 | Conservar política QA | No retirar `syntheticOnly`, actor/test-run ni tipos sintéticos mientras no exista una frontera backend demostrada entre Sandbox y LIVE. Cambiar a capabilities dinámicas ahora podría abrir escrituras reales por una ruta de Preview/Published. |
| C10 | No eliminar módulo | La ausencia de consumidores estáticos no descarta invocación externa por Wix Editor/bindings o integración no representada en el grafo. Se necesita comprobar bindings y contratos de plataforma antes de retirar. |
| C11 | No eliminar webMethods | Los webMethods pueden tener consumidores por bindings del Editor no visibles en imports estáticos. No se eliminan sin inspección de bindings en Wix y búsqueda completa de referencias/tests. |
| P3 | No realizar limpieza masiva | Quitar exports o funciones requiere grafo completo, contratos externos, tests y diff. No se mezcla una limpieza de API pública con correcciones P0 sin ejecutar suite completa. |
| D1 | Pendiente de proceso de sincronización | Los HTML Components de Wix Classic no se consideran desplegados por modificar archivos raíz. Hace falta validar un procedimiento reproducible de sincronización en el Editor y read-back de los cinco widgets. |
| D2 | No alterar scheduler | La paridad declarativa no prueba que el scheduler esté desplegado. Verificar cron activo tras publicación controlada; no programar reconciliación fiscal sin especificación y autorización. |
| D3 | Parcial | Node 24.22.1 ya está fijado en CI. Se mantiene ESLint 8.25.0 por la peer dependency del plugin Wix instalado; no forzar actualización mayor incompatible. |
| D4 | Pendiente | No se ejecutó smoke Wix Sandbox. No se crean reservas, ventas, fichajes ni cierres durante esta intervención. |

## 4. Contraste de la auditoría recibida

- **C2 confirmado:** el archivo utilizaba `fetch()` sin import; la documentación oficial Velo indica `import { fetch } from "wix-fetch";`.
- **C1 confirmado parcialmente:** `staff.js` importa `contactsV5` desde `@wix/crm`; el manifiesto y lock actuales no declaran el paquete. No se modifica sin lock reproducible.
- **C3 matizado:** workflow de CI fija explícitamente Node `24.22.1`; por tanto, el fallo bajo Node 20 no justifica por sí solo alterar el loader. La aceptación final queda condicionada al CI de esta PR.
- **C4 confirmado como riesgo conocido:** el repositorio documenta un fallo al cargar esa regla y la ausencia del manifiesto. No reactivar a ciegas.
- **C5 matizado:** `obtenerServicios` y `obtenerProductos` sí consultan servicios Bookings y Stores Catalog V3; no son un catálogo totalmente sintético. Se conservan identidades y operaciones QA separadas.
- **C5–C9:** los gates no son deuda accidental; contienen controles de seguridad, integridad fiscal/laboral y separación QA/operativa. No se eliminan por conveniencia de despliegue.
- **C10–C11/P3:** requieren inspección de bindings en Wix Editor, no solo búsqueda estática.

## 5. Validación realizada

- Base exacta identificada: `d7dd23642cbe8dd901fe537d259ae93b3d0dab6e`.
- Cambio C2 aplicado mediante actualización de blob completo de `cajas.web.js`; el resto del archivo se conserva.
- Wix Site Context consultado: sitio Marian Madrid, Editor clásico, Velo habilitado, estado Draft, Stores Catalog V3, Bookings y Gift Cards instalados.
- Documentación oficial Wix consultada: Wix Fetch para Velo recomienda el import explícito desde `wix-fetch`.
- CI final del commit `e5eabfbc11da52b6177853284dddc1cf7d4d31de`: **success** en Node 24.22.1. `npm ci`, npm audit (0 vulnerabilidades), Layer 1 (28 suites/334 tests), Layer 2 (19 suites/267 tests), suite completa (74 suites/692 tests), contratos SDK y ESLint pasaron. Secret Scanning también terminó correctamente. La prueba confirma el import y los contratos offline, no el runtime Wix ni la invocación real del firmador.
- No se hicieron escrituras en Wix CMS, no se modificaron datos LIVE y no se publicó.

## 6. Métrica de implementación

Métrica directa sobre las 11 correcciones C1–C11:

- Aplicadas en código: **1/11 = 9,1%** (C2; incluye adaptación del harness offline para el import oficial).
- Sin cambio porque el requisito ya está cubierto por configuración existente: **1/11 = 9,1%** (C3, Node 24.22.1 fijado en CI; sujeto a CI candidato).
- Pendientes/bloqueadas o deliberadamente conservadas: **9/11 = 81,8%**.

No se declara un porcentaje global de despliegue: D1–D4 y las tareas P3 requieren validaciones distintas y no deben mezclarse con el denominador C1–C11. El 9,1% es porcentaje de correcciones de código efectivamente aplicadas, no porcentaje de preparación para producción.

## 7. Próximos pasos

1. Regenerar lock de C1 en un entorno con npm registry y ejecutar `npm ci`; confirmar `contactsV5` en el paquete instalado.
2. Ejecutar CI completo de esta PR en Node 24.22.1; revisar npm audit, suites, contratos SDK y lint.
3. Resolver la regla C4 con el flujo Wix aplicable a Velo Editor clásico, sin inventar `velo.dependencies.json`.
4. Auditar aislamiento backend Sandbox/LIVE antes de cualquier seed o bootstrap.
5. Aprobar por separado las decisiones de producto/legales de TPV operativo, fichaje, contabilidad y Veri*Factu.
6. Verificar bindings HTML y scheduler en Wix Editor antes de retirar o cablear consumidores.
7. Ejecutar smoke Sandbox con evidencia y comparar LIVE antes/después.

**Conclusión:** C2 y su harness offline están corregidos y la CI completa ha pasado (74 suites/692 tests, npm audit sin vulnerabilidades). No hay base suficiente para declarar resueltos C1 ni el resto de bloqueos de despliegue. Se mantiene NO-GO para publicación y para activar writers operativos/fiscales/laborales.


## Addendum — reconciliación de dependencias Wix/npm y CMS (2026-11-20)

La inspección posterior de `wix.lock` corrige parcialmente el diagnóstico C1:

- `wix.lock` contiene `@wix/crm@1.0.1636` como dependencia directa del proyecto Wix, con `@wix/auto_sdk_crm_contacts-v-5` y otros módulos CRM transitivos.
- `package.json` y `package-lock.json` siguen sin declarar `@wix/crm`.
- Por tanto, la dependencia no está ausente de todo el proyecto Wix; la discrepancia demostrada está entre el lock de Wix Editor/CLI y el grafo npm usado por CI. No se ha probado aún el resultado de `npm ci` con la sincronización local de Wix. No editar locks manualmente.

La reconciliación CMS de solo lectura está registrada en `docs/audits/2026-11-20-live-cms-and-wix-lock-reconciliation.md`. Se observó un singleton `CajaActual` marcado `TPV_QA_SYNTHETIC`, pero `ABIERTA` y con `traceId` distinto de `TPVQA-DEV-20261120-01`; el backend actual lo rechaza por contrato. `TpvSandboxIdentities` y `MovimientosCaja` devolvieron 0 elementos en la lectura Management API. `ControlOperativo` devolvió 58 elementos, incluidos 3 `COMPENSATION/PENDING_RECOVERY`; no se modificaron.

**Estado actualizado:** C1 deja de clasificarse como “paquete ausente de Wix”; queda como desalineación npm/Wix por resolver. La ejecución de Preview/Sandbox, seed de identidades y bootstrap de caja no se han realizado. NO-GO de publicación se mantiene.


## Addendum de estado posterior a PR #484/#485 — 2026-11-20

**Baseline:** `main=470ea256d2af88bc62465788cd67e40d84f1a001` antes de esta PR.

### Cambios integrados desde el informe original
- PR #482: import nombrado `fetch` desde `wix-fetch` y adaptación del loader offline. Merge `520e99b87caedfc6323e1f27f5638a0053774eb9`. CI completo comunicado para el head final de PR: 74 suites / 692 tests, npm audit 0 vulnerabilidades, ESLint, SDK contracts y secret scanning PASS.
- PR #483: corrige el diagnóstico C1: `@wix/crm@1.0.1636` sí aparece en `wix.lock`, pero no en `package.json` / `package-lock.json`. Merge `a801405f77dddfe8fcfe76a825be47e656aa542c`. Es una desalineación Wix/npm; la regeneración npm sigue pendiente.
- PR #484: runtime TPV fail-closed; `TPV_QA_RUNTIME_POLICY.ENABLED=false`, el helper backend rechaza con `TPV_QA_DISABLED_UNTIL_SANDBOX_ISOLATION` y el widget no anuncia Sandbox. Merge `03a67652d87298855aec70d43b2ac44fa5024994`. Backend offline quality gates y secret scanning SUCCESS (runs `44726194437`, `44726194440`).
- PR #485: documenta el snapshot de Site Data Usage API LIVE/SANDBOX. Merge `470ea256d2af88bc62465788cd67e40d84f1a001`. La evidencia API confirma uso por entorno, no el contexto de una invocación WebMethod.

### Estado de C1–C11 corregido
- C2 aplicado y CI validada en PR #482.
- C1 no se clasifica como paquete ausente de Wix: queda pendiente alinear el grafo npm reproducible y verificar `npm ci` con las dependencias sincronizadas por Wix.
- C3 Node 24.22.1 ya cubierto por CI; no requiere cambio probado.
- C4 sigue desactivada por incompatibilidad observada del plugin y falta de manifiesto oficial verificado.
- C5–C9 permanecen cerradas por seguridad/integridad o sin evidencia de entorno: writers operativos, fichaje, ledger contable, ledger fiscal y activación QA persistente.
- C10–C11 y P3 requieren inspección de bindings Wix Editor y referencias externas antes de retirar símbolos.
- D1–D4 siguen pendientes: sincronización HTML components, scheduler real, compatibilidad tooling y smoke Wix Sandbox.

### Estado actual de entorno y despliegue
La tabla vigente de uso CMS está en `docs/audits/2026-11-20-wix-live-sandbox-usage.md`. Totales observados: LIVE 201 elementos / 264.970 bytes; SANDBOX 107 / 204.766 bytes. SANDBOX tiene una fila CajaActual y cero filas en MovimientosCaja, TpvSandboxIdentities, ControlOperativo e HistoricoCierresZ. El singleton no ha sido leído por esta API y no se ha probado la invocación runtime.

El TPV QA permanece deshabilitado en configuración canónica. No se hicieron seeds, bootstrap, mutaciones CMS, pagos, escrituras de ledger ni publicación. La existencia de Sandbox no acredita el aislamiento de cada WebMethod.

**Decisión:** NO-GO para publicación/despliegue. La métrica de CI offline no equivale a preparación global para producción. Esta auditoría separa las correcciones aplicadas de las tareas bloqueadas y evita asignar un porcentaje de preparación sin denominador verificable.


## Addendum PR #486 — contrato fail-closed y CI

PR #486 integrada en `main` con commit `5ef81ff132f4cbff594387a60e4446bc5dada171`. Añade una prueba contractual que enumera los WebMethods TPV QA protegidos y verifica que el guard backend antecede a los accesos al repositorio identificados.

CI del head `46aac82fa264387b5571ef3f6fc9d513072a2eb0`: Backend offline quality gates SUCCESS (run `44727128060`); Secret scanning SUCCESS (run `44727128076`). `npm ci` PASS; `npm audit` 0 vulnerabilidades; Layer 1 28 suites / 335 tests; Layer 2 19 suites / 267 tests; suite completa 74 suites / 693 tests; SDK contracts y ESLint PASS.

Los logs muestran warnings de dependencias deprecadas y ESLint 8.25.0 fuera de soporte. Se mantienen sin cambios hasta validar compatibilidad con el plugin Wix. La nueva prueba es offline y no prueba Wix Preview/Published ni el aislamiento real del data plane. La configuración TPV sigue fail-closed; no se hicieron escrituras CMS ni publicación.


## Addendum PR #488 — clasificación de endpoints TPV

PR #488 integrada (`75c4428fea45795d4337011c389ac909f0aa6e03`). Añade un contrato de clasificación de todas las exportaciones WebMethod TPV revisadas, separando operaciones protegidas por guard backend, endpoints read-only/validación y writers operativos fail-closed. CI backend offline y secret scanning SUCCESS (runs `44727911850`, `44727911591`); capas 1/2, regresión completa, SDK contracts, eCommerce/TPV SDK y ESLint PASS. La prueba no equivale a Wix Runtime/E2E. No hay cambios de runtime/CMS ni publicación; TPV QA permanece deshabilitado.


## 8. Revalidación y remediación incremental — 2026-11-20

### Estado comprobado del HEAD anterior

- HEAD de partida: `6370040a54ed489e861137ebcc73f542028bbfb1`.
- Backend offline quality run `44782144468`: SUCCESS; instalación `npm ci`, Layer 1, Layer 2, suite completa, contratos SDK y ESLint completados.
- Gitleaks run `44782144128`: SUCCESS.
- El estado CI valida el repositorio offline, no Wix Runtime, Preview ni publicación.
- Site Context: Editor clásico, Velo habilitado, estado Draft; Bookings, Stores Catalog V3, Gift Cards, Members e Invoices V1 instalados.

### Dependencia CRM — decisión revisada

`src/backend/staff.js` importa `contactsV5` desde `@wix/crm`. La dependencia está declarada en `wix.lock` como `@wix/crm@1.0.1636`, pero no en `package.json` ni `package-lock.json`. El workflow de CI ejecuta `npm ci` correctamente con el grafo npm actual y los tests offline proporcionan un mock específico CRM. Esto demuestra que C1 no es un fallo actual de instalación/CI; queda una discrepancia entre el grafo gestionado por Wix y el grafo npm de CI. No añadir una dependencia ni fabricar un lock npm sin ejecutar el flujo oficial de sincronización Wix/CLI en el workspace del proyecto. La prueba de import en runtime Wix sigue pendiente.

### Limpieza de símbolos internos sin consumidores

Se revisó la búsqueda de referencias en el repositorio completo sobre el HEAD de partida. Se eliminan en esta rama únicamente:

- `src/backend/booking/bookingCore.js`: `_projectCertifiedSlot`; la búsqueda solo encontró su definición/export. No es WebMethod ni contrato de binding.
- `src/backend/tpv/tpvUtils.js`: `validateReason`; la búsqueda solo encontró su definición/export.
- `src/backend/booking/bookingSaga.js`: alias `normalizePersistedMeta`; se conserva `_normalizePersistedMeta`, utilizado internamente por el propio módulo y por pruebas.

Se conservan `_buildLockKeys` y otros aliases con consumidores demostrados. No se modifican contratos WebMethod, CMS, datos, políticas Sandbox, ledgers ni permisos.

### Validación de esta rama

- Los cambios anteriores son refactorizaciones internas sin cambio de comportamiento esperado.
- La suite de regresión y ESLint deben ejecutarse en CI sobre esta rama antes de integrar.
- No se ha ejecutado Wix Preview/E2E ni se han realizado escrituras CMS.
- Despliegue permanece NO-GO hasta cerrar los gates runtime, seguridad, concurrencia y publicación.



## 9. Estado final de PR #501 — 2026-11-20

### Integración y CI
- PR #501: https://github.com/nachoortegazgz/marianmadridz/pull/501
- Merge squash en `main`: `f8872925a126282b76aa9220667356832ca7f113`.
- Head validado antes del merge: `275689cbf0a7485c62094a72fa097a5b478fdaa9`.
- Backend offline quality run `44792419726`: SUCCESS. Incluye `npm ci`, auditoría del grafo npm, Layer 1, Layer 2, regresión offline completa, contratos Wix SDK, contratos eCommerce Order Transactions, contratos TPV Catalog y ESLint.
- Secret scanning run `44792419470`: SUCCESS.
- No se dispone de evidencia de un workflow post-merge separado asociado al SHA de merge; la validación acreditada corresponde al head de PR que fue integrado sin cambios.

### Correcciones incorporadas
- Retirado `_projectCertifiedSlot` de `src/backend/booking/bookingCore.js`; búsqueda global del repositorio encontró solo su definición/export.
- Retirado `validateReason` de `src/backend/tpv/tpvUtils.js`; búsqueda global encontró solo su definición/export.
- Retirado el alias `normalizePersistedMeta` de `src/backend/booking/bookingSaga.js`; se conserva `_normalizePersistedMeta`, que mantiene consumidores internos y pruebas.
- Conservados aliases y contratos con consumidores demostrados, incluido `_buildLockKeys`.
- Actualizada esta auditoría para registrar el estado y las limitaciones.

### Checklist externo — estado consolidado

| ID / grupo | Estado | Evidencia / condición |
|---|---|---|
| C1 CRM | Pendiente de sincronización reproducible Wix/npm | `@wix/crm@1.0.1636` existe en `wix.lock`; no se añade manualmente al lock npm. Requiere workspace Wix CLI/Editor y CI. |
| C2 Wix Fetch | Aplicado previamente | PR #482; import explícito `fetch` desde `wix-fetch`; CI offline validada. |
| C3 Node | Cubierto por CI | Node `24.22.1`; sin cambio adicional. |
| C4 ESLint Wix | Bloqueado | Regla no reactivada por incompatibilidad histórica del plugin; requiere solución oficial reproducible. |
| C5 TPV operativo | Cerrado deliberadamente | No habilitar ventas/devoluciones/pagos reales sin gates de entorno, pagos, conciliación, fiscalidad y E2E. |
| C6 Fichaje | Cerrado deliberadamente | Writers, UI y flags permanecen protegidos hasta probar permisos, concurrencia, idempotencia, rectificación y conservación. |
| C7 Ledger contable | Pendiente de aprobación | Rule set PGC y pruebas de cuadre/rectificación. |
| C8 Ledger fiscal | Cerrado deliberadamente | Presencia de secretos no autoriza escrituras; requiere SIF, firma y E2E certificados. |
| C9 Frontera Sandbox/LIVE | Pendiente de prueba runtime | Mantener fail-closed; Preview/Sandbox y Published/Online no probados por invocación real. |
| C10 módulos internos | Parcialmente aplicado | Tres símbolos sin consumidores retirados por PR #501; el resto requiere comprobar bindings externos. |
| C11 WebMethods | Pendiente de bindings | No retirar ni alterar contratos sin inspección en Editor y pruebas de consumidores. |
| D1 HTML Components | Pendiente | Sin read-back verificable de widgets sincronizados desde Wix Editor. |
| D2 scheduler | Pendiente | No hay evidencia de cron activo ni de ejecución controlada en entorno correspondiente. |
| D3 tooling | Parcial | Node CI fijado; ESLint/plugin Wix requiere resolución de compatibilidad. |
| D4 smoke Sandbox | Pendiente | No ejecutar hasta demostrar aislamiento del data plane y preparar fixture sintético no destructivo. |
| Seguridad CMS / writers | Pendiente | Auditoría de permisos efectivos y todos los writers, sin escrituras LIVE. |
| Concurrencia / idempotencia | Pendiente | Pruebas runtime Wix, locks y recuperación; CI offline no las sustituye. |
| SharePoint / Entra ID | Pendiente | Verificar scopes y permisos efectivos; SharePoint solo evidencia documental. |
| Preview E2E / publicación | NO-GO | Site Context sigue Draft; no se ha publicado ni validado E2E. |

### Límites de esta validación
- CI SUCCESS valida el código del head de PR en entorno offline; no demuestra Wix Runtime, permisos efectivos, HTML Components, scheduler, Sandbox/Online data plane, integraciones externas ni publicación.
- No se realizaron escrituras CMS, seeds, cambios de datos LIVE, operaciones de TPV, pagos ni cambios fiscales/laborales.
- No se modificó la configuración de entorno ni se abrieron writers.
- Estado de despliegue: NO-GO hasta completar los gates runtime, seguridad, concurrencia, legalidad y autorización de publicación.
