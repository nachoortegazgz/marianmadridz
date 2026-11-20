# Estado consolidado — TPV, Wix Sandbox y preparación de despliegue

- **Fecha de corte:** 2026-11-20
- **Repositorio:** `nachoortegazgz/marianmadridz`
- **Baseline verificado:** `main` = `790bdcdc646a4b19844a7c915479c805cd349027`
- **Rama documental:** `docs/tpv-qa-adapter-release-gates-20261120`
- **Sitio Wix:** `188bed94-177c-4bc9-a9f0-35080d874f3e`
- **Estado de esta actualización:** consolidación documental. No se modificó código de ejecución ni se realizaron escrituras CMS.

## 1. Resumen ejecutivo

El propietario confirma que Wix CMS Sandbox está habilitado. La consulta de Wix Site Data Usage ejecutada el 2026-11-20 con `consistentRead=true` devolvió HTTP 200 y acredita uso independiente de LIVE y SANDBOX:

| Entorno | Elementos | Bytes | Última actualización de datos |
|---|---:|---:|---|
| LIVE | 201 | 264.970 | 2026-11-20 06:51:59 UTC |
| SANDBOX | 101 | 196.692 | 2026-11-20 06:15:33 UTC |

La respuesta identifica 12 colecciones nativas: `PaquetesGestoria`, `RegistroIntegracion`, `RegistrosHorariosStaff`, `LibroAsientosContablesDetalle`, `ComplementosCatalogo`, `MovimientosCaja`, `HistoricoCierresZ`, `CitasF2`, `ControlOperativo`, `ServiciosCatalogo`, `MapaStaff` y `CajaActual`.

Esto confirma que hay datos en ambos entornos y que Wix reporta su consumo por separado. No demuestra por sí solo que una ejecución TPV concreta haya escrito en SANDBOX; esa comprobación exige una operación controlada desde Wix Preview y lectura posterior en el mismo entorno.

**Decisión:** avanzar con la adaptación de persistencia TPV para pruebas sintéticas en Sandbox. No retirar todavía los controles que impiden mezclar datos QA con operaciones fiscales, contables o externas. No declarar el TPV validado ni el sitio listo para despliegue.

## 2. Estado verificado del repositorio

### 2.1 Git y CI

- `main` está en `790bdcdc646a4b19844a7c915479c805cd349027`.
- La rama de trabajo documental se creó desde el mismo SHA; comparación `main...docs/tpv-qa-adapter-release-gates-20261120` = `identical`, sin divergencia inicial.
- No había PR abierto para esta intervención al iniciar la actualización.
- El historial de proyecto registra checks CI y Gitleaks satisfactorios sobre el SHA `790bdc...`. Esta actualización documental no vuelve a ejecutar la suite; los checks de este nuevo commit/PR quedan pendientes.
- No se ha hecho merge a `main` ni despliegue Wix en esta intervención.

### 2.2 Correcciones integradas conocidas

- PR #474: sustitución de uso no soportado de `.contains()` sobre `ARRAY_STRING`; conserva `hasSome()`/`eq()`.
- PR #475: protección de `HistoricoCierresZ_beforeUpdate` con strong read, comparación estable y validación fail-closed.
- PR #476: corrección documental del estado de validación.
- El SHA `790bdc...` tiene registrados como satisfactorios los checks offline/regresión/contratos SDK/ESLint y Gitleaks.

Estas correcciones no equivalen a validación Wix Runtime/E2E.

## 3. TPV: arquitectura y diagnóstico actual

### 3.1 Componentes

- Página: `src/pages/TPV.yl5th.js`, HTML component `#htmlTPV`.
- Controlador: `src/public/tpvPageController.js`.
- WebMethods: `src/backend/tpv/*.web.js`.
- Repositorio QA: `src/backend/tpv/tpvQaRepository.js`.
- Política de datos: `src/backend/dataAccessPolicy.js`.
- Configuración canónica: `src/backend/internalConfig.js`.
- Motor puro de simulación offline: `qaTpvSimulation.mock.mjs` y suites relacionadas.

### 3.2 Persistencia actual

El código declara entidades lógicas `TPV_QA_*` y traduce eventos sintéticos a `MovimientosCaja`, con proyección de sesión/saldo en `CajaActual` y locks/idempotencia tipados en `ControlOperativo`. Las colecciones `TPV_QA_*` son identificadores lógicos, no deben crearse como colecciones CMS físicas.

La ruta `_ensureCajaActualForQa()` en `tpvQaRepository.js` consulta el singleton `CajaActual` con consistencia fuerte y falla con `TPV_QA_SANDBOX_CASH_REGISTER_NOT_SEEDED` cuando no existe. No inicializa ni crea el singleton. Esta es una dependencia funcional pendiente para que una primera ejecución aislada en Sandbox pueda arrancar sin reutilizar datos de LIVE.

El repositorio también fija `QA_TEST_RUN_ID` desde `TPV_QA_RUNTIME_POLICY.TEST_RUN_ID` en `internalConfig.js` (actualmente `TPVQA-DEV-20261120-01`). No debe reutilizarse indefinidamente entre ejecuciones: el diseño debe introducir identidad de test-run generada y validada en backend, con aislamiento de datos y limpieza selectiva. El frontend no puede elegir entorno ni concederse permisos mediante parámetros.

### 3.3 Límites e invariantes

- `CajaActual` es un singleton/proyección, no un almacén genérico de tickets, ventas o pagos.
- `MovimientosCaja` conserva el contrato canónico de movimientos; las filas sintéticas deben quedar inequívocamente marcadas y excluidas de secuencias, firmas, agregaciones y procesos fiscales reales.
- `ControlOperativo` solo debe alojar locks/claims/idempotencia tipados, nunca entidades de venta.
- La proyección de caja solo se actualiza desde backend y después de persistir el evento correspondiente.
- No habilitar `LEDGER_WRITES_ENABLED`, `ACCOUNTING_LEDGER_WRITES_ENABLED`, `ACCOUNTANT_SEND_ENABLED` ni writers fiscales/contables reales para probar el TPV.
- No usar APIs de Wix Apps para simular pagos, Orders, Bookings, reembolsos, stock o notificaciones.
- El motor offline sigue siendo oráculo para reglas puras; no sustituye pruebas de persistencia Wix.

## 4. Entorno y datos Wix

### Verificado

- La llamada Site Data Usage respondió HTTP 200 con lectura consistente y totales separados LIVE/SANDBOX indicados arriba.
- La respuesta enumera las 12 colecciones nativas indicadas en el resumen.
- La documentación Wix establece que Preview utiliza el entorno Sandbox de CMS nativo cuando Sandbox está habilitado; las colecciones de Wix Apps no disponen de una copia Sandbox equivalente y pueden afectar datos LIVE.

### Declarado por el propietario

- El sitio completo se encuentra en fase de desarrollo y pruebas.
- Los registros contables/fiscales existentes son sintéticos y editables.
- Se autoriza crear, modificar y retirar datos sintéticos identificados por test-run.
- Antes del despliegue real se realizará un reset integral controlado.

### Pendiente de comprobar en runtime

- Que una ejecución desde la instancia correcta de Wix Preview lee y escribe exclusivamente en Sandbox.
- Que la creación/seed del singleton QA no puede dirigirse a LIVE.
- Que hooks CMS, permisos efectivos y WebMethods aceptan el flujo sintético completo.
- Que la UI TPV y el HTML component están correctamente conectados y operativos en Preview.
- Que los datos LIVE permanecen idénticos antes/después de la prueba.

La Site Data Usage API es una métrica de consumo, no una API para seleccionar el entorno de escritura. No realizar escrituras de prueba con Wix REST/management API esperando que se dirijan automáticamente a Sandbox.

## 5. Hallazgos y riesgos abiertos

### P0 — Integridad de CajaActual LIVE

La auditoría read-only del 2026-11-20 registró un singleton LIVE `CajaActual` con estado/fechas inconsistentes y `sequenceCounters` almacenado como string `"{}"` aunque el esquema declara OBJECT. La auditoría también registró tres elementos `FISCAL_LEDGER/PENDING_RECOVERY` en `ControlOperativo`.

No modificar, cerrar, normalizar ni sobrescribir el singleton LIVE como parte de las pruebas TPV. Requiere reconciliación independiente y trazable antes del despliegue.

### P1 — Inicialización de caja QA en Sandbox

`_ensureCajaActualForQa()` solo lee y falla si no encuentra el singleton. Falta un bootstrap explícito, idempotente, con autorización backend y prueba de entorno efectiva. Debe impedir colisiones con singleton/datos LIVE y validar el esquema real antes de insertar.

### P1 — Identidad y ciclo de vida del test-run

El `TEST_RUN_ID` estático no proporciona aislamiento entre ejecuciones concurrentes o sucesivas. Diseñar un test-run ID generado en backend, persistido con metadatos de ejecución y validado en cada operación. Definir retención/limpieza por IDs exactos, no por borrado global.

### P1 — Seguridad de mutaciones sintéticas

Revisar el contrato completo de `assertInsertAllowed`, `assertUpdateAllowed`, `assertRemoveAllowed`, hooks `MovimientosCaja_beforeInsert/beforeUpdate` y permisos CMS. Las operaciones de edición/borrado autorizadas por el propietario se limitarán a filas QA identificadas por marcador y test-run. Los datos sin marcador quedan fuera del alcance de limpieza.

### P1 — Aislamiento de efectos externos

La SSOT QA registra automatizaciones Wix preinstaladas activas con restricciones de modificación y acciones potenciales de email/notificación. La neutralización técnica completa de todos los efectos externos no está acreditada. Antes de un flujo que pueda disparar esos triggers, inspeccionar el recorrido exacto y demostrar que no produce comunicaciones ni efectos externos.

### P1 — E2E y recuperación

No está acreditado E2E Wix Preview completo, concurrencia real, idempotencia persistente, reconciliación de caja, recuperación tras fallo parcial ni limpieza selectiva. La prueba offline no cubre estos riesgos.

## 6. Plan de corrección priorizado

### Fase A — Preparación segura del Sandbox

1. Verificar desde Wix Preview el entorno efectivo usando una lectura/escritura de canario controlada sobre una colección nativa inocua y autorizada; verificar lectura posterior en Sandbox y ausencia de cambio LIVE. No utilizar Wix Apps.
2. Inspeccionar schema y hooks reales de `CajaActual`, `MovimientosCaja` y `ControlOperativo`.
3. Diseñar bootstrap de caja QA idempotente, solo backend ADMIN, con marcador, testRunId, singletonKey y guardas que fallen cerradas si el contexto Sandbox no puede demostrarse.
4. Diseñar identidad única de test-run y trazabilidad de ejecución; no confiar en un valor seleccionable desde frontend.

### Fase B — Completar TPV persistente

5. Compartir reglas de dominio (cálculo de importes, pagos simulados, arqueo, cierre y conciliación) entre motor offline y persistencia Wix; evitar duplicar reglas de negocio.
6. Implementar el adaptador lógico sin crear colecciones CMS nuevas: sesión/proyección en `CajaActual`, eventos sintéticos permitidos en `MovimientosCaja`, locks en `ControlOperativo`.
7. Asegurar idempotencia, strong reads, control de concurrencia, CAS/locks, recuperación de escritura parcial y detección de replay/conflictos.
8. Adaptar apertura, venta/líneas, pagos simulados, devoluciones sintéticas, movimientos de efectivo, arqueo, ticket X/Z, auditoría y resumen de sesión.
9. Verificar que las filas sintéticas no entran en secuencias fiscales, firma/hash fiscal, libros contables, informes reales ni cierres fiscales.

### Fase C — QA y limpieza

10. Ejecutar unitarias, integración offline, regresión, seguridad, permisos, concurrencia e idempotencia.
11. Ejecutar E2E desde Wix Preview con Sandbox habilitado, verificando datos persistidos y aislamiento LIVE.
12. Probar reintentos y fallos parciales, incluyendo recuperación y conciliación.
13. Exportar evidencia y limpiar únicamente los IDs del test-run comprobados; nunca truncate ni borrar filas no identificadas.
14. Revisar diff, ejecutar CI completo y obtener aprobación para merge.

### Fase D — Readiness preproducción

15. Reconciliar singleton LIVE y los pendientes fiscales/operativos; no mezclar esta tarea con la prueba TPV.
16. Resolver el aislamiento de automatizaciones y efectos externos.
17. Preparar reset sintético integral con inventario previo, backup/export, lista exacta de IDs, verificación posterior y rollback.
18. Restaurar append-only, inmutabilidad, permisos mínimos, idempotencia, hashes, auditoría y controles de autorización para el modo real.
19. Ejecutar pruebas en el entorno publicado de prueba cuando Preview no cubra APIs/eventos; tratarlo como datos LIVE y no asumir aislamiento.
20. Solo entonces evaluar GO de despliegue.

## 7. Matriz de estado

| Área | Estado | Evidencia / límite |
|---|---|---|
| Git main | VERIFICADO | SHA `790bdc...` |
| CI del baseline | VERIFICADO EN HISTORIAL | Checks registrados como SUCCESS; no reejecutados por este documento |
| Sandbox habilitado | CONFIRMADO | Declaración del propietario y uso Sandbox reportado por Wix |
| Datos LIVE/SANDBOX separados | VERIFICADO | Site Data Usage API, consistentRead=true |
| TPV offline | PARCIALMENTE VALIDADO | Tests offline previos; no equivalen a Wix Runtime |
| Persistencia TPV | IMPLEMENTACIÓN PARCIAL | Adaptador y WebMethods existen; bootstrap inicial de caja pendiente |
| Test-run aislado | PENDIENTE | ID actual estático |
| Wix Preview E2E | PENDIENTE | No ejecutado en esta intervención |
| Permisos/hooks de flujo completo | PENDIENTE | Requiere verificación de runtime |
| Automatizaciones externas | RIESGO ABIERTO | Aislamiento completo no demostrado |
| Integridad CajaActual LIVE | P0 ABIERTO | Inconsistencia documentada; no tocar |
| Recuperación fiscal pendiente | P0 ABIERTO | Tres estados PENDING_RECOVERY documentados |
| Reset preproducción | PENDIENTE | Debe ser selectivo, respaldado y verificable |
| Despliegue | **NO-GO** | Gates críticos abiertos |

## 8. Alcance de esta actualización

Esta consolidación registra evidencia de repositorio, declaración del propietario, respuesta actual de Wix Site Data Usage y correcciones pendientes. No modifica código funcional, CMS, permisos, automatizaciones, pagos, ledger, caja, secretos ni configuración del sitio. No ejecuta Preview ni despliega.

**Criterio de cierre:** no retirar protecciones de QA hasta que el flujo sustituto comparta la lógica de dominio, esté aislado por backend y test-run, pase pruebas offline y Wix Preview, y demuestre que LIVE y los efectos externos permanecen intactos.

## 9. Fuentes técnicas

- [Wix — About Testing Your Code in Preview Mode](https://dev.wix.com/docs/develop-websites/articles/workspace-tools/testing-monitoring/testing-troubleshooting/about-testing-your-code-in-preview-mode)
- [Wix — Sandbox and Live Collections](https://support.wix.com/en/article/cms-about-sandbox-and-live-collections-and-syncing)
- [Wix — Site Data Usage API](https://dev.wix.com/docs/api-reference/business-solutions/cms/operations/site-data-usage/introduction)
- [Decisión de persistencia TPV, Issue #435](./2026-11-20-tpv-sandbox-persistence-decision.md)
- [SSOT de entorno QA](../qa/QA-ENVIRONMENT-SSOT.md)


## Addendum de estado posterior a PR #499 — 2026-11-20

El estado de `main` queda actualizado en SHA `cfe1d0c37a9464cb63aea9d31873071eecb10d9f`. PR #496–#499 están integradas. CI post-merge quality y Gitleaks finalizaron SUCCESS (runs `44780145944`, `44780145900`): 75 suites/705 tests, 0 fallos; Layer 1 338/338, Layer 2 268/268, SDK contracts y ESLint PASS.

PR #499 hace read-only el bootstrap: no crea automáticamente el singleton ni las seis identidades. La presemilla requerida está documentada en `src/backend/tpv/README.md`. La lectura read-only más reciente documentada no demuestra las identidades presembradas ni una invocación WebMethod en Sandbox.

La revisión posterior detectó una ruta adicional que debe cerrarse: los locks de `ControlOperativo` deben validar primero el marcador de `CajaActual`. La rama `fix/tpv-sandbox-lock-preflight-and-docs` añade ese preflight y una prueba contractual; pendiente de CI y merge. No considerar el hallazgo resuelto en `main` hasta la integración.

El sitio Wix se observa en Draft. No se ha ejecutado Preview E2E, prueba negativa Published, comparación LIVE antes/después, validación de permisos efectivos, ni reset sintético preproducción. Mantener **NO-GO**.


## Addendum posterior a PR #500 — 2026-11-20

PR #500 está fusionada en `main`: commit `6da7cdf0d815ad2e1833f5bd56b5950aff2afb3e`. La corrección consolida el helper `_ensureCajaActualForSandbox()` para validar existencia y marcador/run ID de `CajaActual` y ejecuta ese preflight antes de cualquier lectura/escritura de locks en `ControlOperativo`. Se añade una prueba contractual específica.

Validación pre-merge del HEAD `306816dff20d62e4ec3fda87e25fb050c155bb96`: Layer 1 28 suites/339 tests PASS; Layer 2 19 suites/268 tests PASS; suite completa 75 suites/706 tests PASS; contratos Wix SDK, eCommerce Order Transactions, TPV Catalog y ESLint PASS; Gitleaks PASS (runs `44781808680` y `44781808524`). CI post-merge para `6da7cdf0...` está en curso en los runs `44781982497` y `44781982392`; no declararlo aprobado hasta que ambos finalicen SUCCESS.

La corrección es una barrera de código por estado de datos; no identifica de forma contractual Preview frente a Published. No equivale a prueba de aislamiento runtime ni a aceptación E2E. Wix Preview, prueba negativa Published, concurrencia H-01, permisos efectivos, efectos externos, comparación LIVE antes/después y reset preproducción siguen pendientes. Sitio Wix observado en Draft. **NO-GO de publicación.**
