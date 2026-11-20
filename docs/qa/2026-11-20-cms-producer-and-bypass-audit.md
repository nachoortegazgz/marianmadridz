# Auditoría de productores y bypasses de escritura CMS — 2026-11-20

## 1. Objetivo y alcance

Auditoría estática de los productores de escritura, la capa de acceso elevado y las barreras de inserción/actualización de las colecciones críticas:

- `MovimientosCaja`
- `HistoricoCierresZ`
- `PaquetesGestoria`
- `RegistrosHorariosStaff`
- `CitasF2`
- `CajaActual`
- `ControlOperativo`
- `LibroAsientosContablesDetalle`

Repositorio: `nachoortegazgz/marianmadridz`  
Base inspeccionada: `main` — `9aa92a9ef7408ab9b431694463ca1ffe2dedacfa`.

Seguimiento de correcciones: PR #455 integrada en `main` mediante `7672bac4b4207ba87c9688fa34f38752a253ae86`.

La auditoría inicial se limitó al código fuente disponible en GitHub y a búsquedas estáticas. No se accedió a Wix Runtime ni se realizaron escrituras CMS. La corrección posterior de PaquetesGestoria se validó mediante CI de PR #455.

## 2. Resultado ejecutivo

1. **No se ha localizado un bypass activo de la capa DAL mediante importación directa de `@wix/data` o `wix-data` en los módulos backend de negocio.** La importación de `@wix/data` localizada en código de aplicación está en `src/backend/dataAccess.js`; el loader de tests contiene adaptadores/mocks. Las operaciones elevadas se concentran en esa DAL.
2. **Las escrituras de los ledgers fiscal, contable y laboral permanecen fail-closed por sus WebMethods/políticas actuales.** `LEDGER_WRITES_ENABLED=false`, `ACCOUNTING_LEDGER_WRITES_ENABLED=false` y `STAFF_CLOCKING_CONFIG.WRITES_ENABLED/ADJUSTMENTS_ENABLED=false`.
3. **Los hooks de Wix son una segunda barrera efectiva en el diseño actual:** la DAL llama a `auth.elevate(items.insert)` sin opciones de supresión y no expone `suppressHooks`. Wix documenta que los hooks se ejecutan con las operaciones Data API salvo que se supriman expresamente.
4. Se identificó una brecha de arquitectura aún abierta: la política DAL de `CajaActual` permite `update` y `save` con la mera comprobación de `_id`; el hook comprueba estructura, pero no gobierna una máquina de estados, actor/origen o transiciones autorizadas.
5. La brecha de `PaquetesGestoria` quedó corregida mediante PR #455: el contrato puro está centralizado en `validation.js`, se invoca desde `dataAccess.insertItem` y se reutiliza desde el hook físico.
6. La ruta pública de cierre Z asigna `recordDomain=""`; la ruta interna exige que el caller aporte un valor explícito. No existe un valor canónico aprobado, por lo que el contrato debe continuar bloqueando el cierre.
7. La auditoría no modificó registros CMS ni habilitó writers. La corrección de PaquetesGestoria se integró separadamente y superó CI offline.

## 3. Inventario de productores y controles

| Colección | Productores identificados | Controles observados | Estado |
|---|---|---|---|
| `MovimientosCaja` | `cajas.web.js::registerManualTransaction`; `eventLog.js::registrarEventoEconomico`; `tpv/tpvQaRepository.js::insertQaEvent` | Los writers fiscales comprueban `LEDGER_WRITES_ENABLED`; el writer TPV genera un registro sintético con testRunId, fingerprint, hash, secuencia cero y origen QA; DAL aplica política de inserción y el hook valida/normaliza. | Writers fiscales bloqueados. Writer QA limitado por marcadores. |
| `HistoricoCierresZ` | `cajas.web.js::_registerZClosing` | Comprueba autorización cuando es público, política fiscal fail-closed, lock/fencing, lectura de duplicado, validación DAL y hook append-only. | Bloqueado por política y por `recordDomain` sin contrato aprobado. |
| `PaquetesGestoria` | `fiscalDocuments.web.js::createManagerPackageVersion` | Inserción create-only con ID/versionado, hash, límite de tamaño, claim idempotente; validador central `assertPaquetesGestoriaRecord` en DAL y hook; update/remove bloqueados. | Validación central integrada en PR #455; despacho sigue deshabilitado; Wix Runtime pendiente. |
| `RegistrosHorariosStaff` | `horario.web.js::registrarFichaje`; `registrarAjusteHorario` | Ambos WebMethods comprueban flags deshabilitados antes de insertar; la DAL y el hook validan campos, fechas y firma; update/remove bloqueados. | Writers deshabilitados. |
| `CitasF2` | `booking/bookingCore.js::_persistBooking`; reconciliación de eventos en `events.js` | `bookingCore` usa alias de `dalInsert`/`dalUpdate`, no un insert SDK directo; validación de dominio en DAL y hook; remove bloqueado. Es una proyección mutable, no un ledger append-only. | Productor controlado por backend; E2E Wix pendiente. |
| `CajaActual` | `cajas.web.js::_updateCajaActual` y cierre Z; `tpv/tpvQaRepository.js` para proyección QA | Hook valida estructura y singleton. El repositorio QA comprueba origen, testRunId y estado sintético antes de mutar. La política DAL de update/save no valida una transición de dominio completa. | Brecha P1 de defensa en profundidad. |
| `ControlOperativo` | `events.js`, `cajas.web.js`, `bookingCore.js`, `fiscalDocuments.web.js`, `accountingLedger.js`, `crons.js` y otros servicios internos | `assertControlOperativo`, allowlist de campos físicos y discriminador `controlType`; WEBHOOK_EVENT append-only en política y hooks; mutaciones/purgas acotadas por tipo y condición. | Contrato central reforzado; concurrencia runtime de claims sigue pendiente. |
| `LibroAsientosContablesDetalle` | `accountingLedger.js::appendAccountingEntry` | Flag contable fail-closed; validación previa en DAL y hook; update/remove bloqueados; locks, deduplicación y recuperación por lectura. | Writer deshabilitado; Sandbox runtime y continuidad criptográfica pendientes. |

## 4. Hallazgos detallados

### H-01 — Política de mutación de CajaActual insuficientemente específica

**Severidad:** P1 — defensa en profundidad / integridad de proyección.

**Evidencia:**
- `src/backend/dataAccessPolicy.js::assertUpdateAllowed`: para `CajaActual` exige `_id`, sin comprobar origen, actor, estado previo o transición.
- `assertSaveAllowed`: permite `CajaActual` con `_id`; no valida el contrato completo de transición.
- `src/backend/data.js::CajaActual_beforeUpdate`: normaliza fechas/contadores y ejecuta `assertCajaActualRecord`, pero no valida una máquina de estados ni quién puede realizar cada transición.
- Productores observados: proyección de caja desde `cajas.web.js`, cierre mediante `dalSave` y proyecciones de QA en `tpvQaRepository.js`.

**Impacto:** un nuevo consumidor backend podría actualizar o guardar el singleton sin pasar por las reglas de operación específicas de caja. Los consumidores actuales tienen controles de punto de uso, pero la DAL no constituye una barrera de dominio suficiente.

**Recomendación:** no añadir una regla genérica que bloquee las proyecciones actuales. Primero definir operaciones permitidas por transición (proyección desde movimiento, cierre, inicialización QA, proyección QA) y campos mutables por operación. Después sustituir el acceso genérico por operaciones DAL específicas o un validador de transición central invocado desde la DAL. Mantener la inicialización y los datos QA estrictamente separados.

### H-02 — Validación de PaquetesGestoria no centralizada

**Estado: RESUELTO — PR #455.**

**Severidad original:** P2 — mantenibilidad y consistencia contractual.

**Evidencia:**
- `src/backend/data.js::PaquetesGestoria_beforeInsert` contiene validación de fecha, periodo, versión, estructura, hash, trazabilidad y estado PREPARED.
- `PaquetesGestoria_beforeUpdate` y `beforeRemove` bloquean mutaciones.
- `src/backend/dataAccess.js::insertItem` no tiene una rama específica que invoque un validador central para `PAQUETES_GESTORIA`.
- `src/backend/dataAccessPolicy.js` incluye la colección en las colecciones append-only.
- `fiscalDocuments.web.js` utiliza `dalInsert(DOCS_COL, snapshot)` y no `save/update`.

**Impacto:** la integridad de dominio depende del hook como única validación de servidor para el alta. El patrón no es homogéneo con CitasF2, caja, cierres y ledger contable, que también invocan validadores desde la DAL.

**Resolución integrada:** `assertPaquetesGestoriaRecord` se trasladó a `validation.js`, `dataAccess.insertItem` lo ejecuta antes de la inserción elevada y `PaquetesGestoria_beforeInsert` reutiliza el mismo contrato tras normalizar `createdAt`.

**Evidencia:** PR #455 (`7672bac4b4207ba87c9688fa34f38752a253ae86`). CI PR #455: Layer 1 333/333, Layer 2 266/266, suite offline 688/688; SDK contracts, npm audit (0 advisories), ESLint y Secret scanning SUCCESS. No se ejecutó Wix Runtime.

### H-03 — Cierre Z sin identidad de dominio aprobada

**Severidad:** P0 para habilitación del cierre fiscal; bloqueo conocido.

**Evidencia:**
- `cajas.web.js::_registerZClosing` fija `recordDomain=""` en llamadas públicas.
- Las llamadas internas solo pueden suministrar el campo explícitamente mediante `options.recordDomain`.
- `assertHistoricoCierresZ` exige `recordDomain`.
- El writer está además bloqueado por `LEDGER_WRITES_ENABLED=false`.

**Impacto:** no puede emitirse un cierre Z válido sin resolver la identidad del dominio y del responsable del cierre.

**Recomendación:** mantener el cierre bloqueado. Aprobar formalmente enum/valor, identidad de sistema para cron y relación con el origen MANUAL/CRON. No aceptar el valor desde el navegador ni introducir un default provisional.

### H-04 — Sin bypass directo de la DAL localizado

**Severidad:** resultado positivo de auditoría estática, no certificación runtime.

**Evidencia:**
- La única importación de aplicación `@wix/data` localizada en backend está en `src/backend/dataAccess.js`.
- `auth.elevate` se aplica allí a las operaciones Data API.
- Las referencias a inserciones de módulos de negocio usan `dalInsert` o alias del wrapper; por ejemplo `bookingCore.js` asigna `const elevatedInsert = dalInsert`.
- No se ha localizado uso activo de `suppressHooks` en la DAL ni en los productores revisados.
- Wix documenta que los Data Hooks se ejecutan en las operaciones Data API salvo que la llamada suprima los hooks expresamente.

**Límite:** el resultado procede de búsquedas estáticas y no prueba que no exista una ruta no indexada, una automatización externa o una mutación manual desde CMS. Tampoco prueba el comportamiento runtime del sitio.

## 5. Wix Data Hooks — contrato oficial

Wix documenta que los hooks se ejecutan con las operaciones Data API y que las llamadas backend pueden suprimirlos mediante las opciones de la operación. La DAL actual no pasa ni expone una opción de supresión, por lo que el diseño conserva la ejecución de hooks como segunda barrera.

Fuentes oficiales:
- [Wix — Velo Data Hooks Introduction](https://dev.wix.com/docs/velo/events-service-plugins/data/hooks/wix-data-hooks/introduction)
- [Wix — Velo Data API insert()](https://dev.wix.com/docs/velo/apis/wix-data/insert)
- [Wix — About Data Hooks](https://dev.wix.com/docs/develop-websites/articles/databases/wix-data/hooks/about-data-hooks)

## 6. Pruebas y validación

**Inspeccionado estáticamente:**
- `dataAccess.js`, `dataAccessPolicy.js`, `internalConfig.js`, `validation.js`, `data.js`.
- Productores: `cajas.web.js`, `eventLog.js`, `fiscalDocuments.web.js`, `horario.web.js`, `booking/bookingCore.js`, `events.js`, `tpv/tpvQaRepository.js`, `accountingLedger.js`, `crons.js`.
- Suites presentes en el repositorio: `data.hooks.test.mjs`, `dataAccess.removeById.test.mjs`, `operational-writers.fail-closed.contract.test.mjs`, pruebas de caja/TPV, reservas y ledger.

**No ejecutado durante la auditoría estática inicial:**
- Vitest / suite offline.

**Ejecutado posteriormente para la corrección H-02 (PR #455):** Layer 1 333/333, Layer 2 266/266, suite offline 688/688; SDK contracts, npm audit (0 advisories), ESLint y secret scanning SUCCESS.
- Wix Local Editor / Preview / Sandbox.
- Pruebas de identidad CMS_EDITOR.
- Pruebas de concurrencia en Wix Runtime.
- Pruebas de mutación desde Content Manager o automatizaciones externas.

La consulta de estados combinados del commit base no devolvió checks asociados. No se declara CI validado para esta auditoría ni se extrapolan resultados de PRs anteriores.

## 7. Plan de corrección mínimo

1. **P1 — CajaActual:** inventariar y especificar transiciones legítimas y campos mutables por operación. Después endurecer la DAL con tests de aceptación y regresión de proyección de caja/TPV QA.
2. **P2 — PaquetesGestoria:** RESUELTO en PR #455. Mantener regresión offline y completar prueba de hook en Wix Sandbox.
3. **P0 — Cierre Z:** mantener fail-closed hasta aprobar `recordDomain` y la identidad de cron; después probar el contrato en Sandbox sin datos reales.
4. **P1 — permisos:** ejecutar E2E con identidad CMS_EDITOR y comprobar denegación de escrituras directas, conservando los WebMethods backend autorizados.
5. **P0/P1 — Runtime:** repetir pruebas de hooks, idempotencia y concurrencia en un entorno Wix Sandbox inequívocamente aislado.

## 8. Decisión de despliegue

**NO-GO para producción.** No se habilitan writers fiscales, contables ni laborales; no se realizan cierres, pagos, reembolsos, remisiones AEAT ni envíos a gestoría. No se publica el sitio.

Esta auditoría no modifica código de aplicación, colecciones, registros, permisos ni configuración Wix.
