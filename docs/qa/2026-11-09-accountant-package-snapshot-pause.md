# Pausa de trabajo — snapshot de gestoría y estado de PR #222

**Fecha:** 2026-11-09  
**Rama:** `fix/safe-disable-unimplemented-admin-actions-20261109`  
**HEAD observado:** `7e7549cbd01ecfa00e01f3d84819d9f64c29af20`  
**PR:** [#222](https://github.com/nachoortegazgz/marianmadridz/pull/222) — abierto, Draft, no mergeado.  
**Comparación:** 28 commits ahead / 0 behind respecto a `main`; 12 archivos modificados en la comparación observada.

## 1. Estado real al pausar

Se detiene toda implementación adicional. No se ha desplegado código ni se han enviado correos. No se han realizado pagos, reservas, movimientos de caja, movimientos de stock ni escrituras en ledgers existentes.

**Importante: sí se ha creado una colección CMS nueva** mediante la API de gestión de colecciones Wix:
- ID: `PaquetesGestoria`
- Nombre visible: “Paquetes de Gestoria (append-only)”
- Finalidad: almacenar snapshots versionados de paquetes mensuales/trimestrales para gestoría, separados de `HistoricoCierresZ`.
- Campos declarados: periodType, fiscalYear, fiscalMonth, fiscalQuarter, packageVersion, summaryData, invoiceData, packageStatus, snapshotHash, schemaVersion, source, traceId y createdAt.
- La operación fue una creación de esquema, no una inserción de documentos. La respuesta de creación confirmó el ID y devolvió la definición de campos/permisos. No se ha insertado ningún snapshot.
- No se ha verificado desde una segunda lectura independiente la configuración final de permisos ni la aplicación runtime de hooks.

Esta creación contradice la descripción previa del PR que decía “sin escrituras CMS”. La descripción debe corregirse y esta auditoría deja constancia explícita de la intervención.

## 2. Cambios de código confirmados en la rama

- `internalConfig.js`: constante canónica `BUSINESS_COLLECTIONS.PAQUETES_GESTORIA`.
- `data.js`: hooks `PaquetesGestoria_beforeInsert`, `_beforeUpdate` y `_beforeRemove`; validan periodo, versión, estructura, hash SHA-256, trazabilidad y estado inicial PREPARED; bloquean modificación y borrado.
- `tests/data.hooks.test.mjs`: pruebas de validación mensual/trimestral, hash y bloqueo de update/remove.
- La rama contiene además los cambios previos de PR #222 para desactivar acciones no implementadas de staff/IA y bloquear el despacho fiscal.

**No implementado en el código actual:** la migración de `fiscalDocuments.web.js` al almacén `PaquetesGestoria`. Una inspección del archivo en HEAD confirma que sigue usando `BUSINESS_COLLECTIONS.HISTORICO_CIERRES_Z`. Se intentó preparar una sustitución en una operación que falló antes de actualizar el archivo; por tanto, ese intento no debe considerarse cambio aplicado. El envío a gestoría sigue bloqueado por la protección backend existente.

## 3. CI del HEAD

Workflow run **#252**, ID `42608664074`, sobre el HEAD indicado: **FAILURE**.

- 48 suites.
- 459 pruebas correctas.
- 2 pruebas fallidas, ambas en `fiscalDocuments.package-version.concurrency.test.mjs`.
- La suite `data.hooks.test.mjs` pasó: 28/28.
- Contratos SDK Cart V2 y Bookings Reader V2: PASS.
- ESLint: PASS.

Diagnóstico reproducible de las dos fallas:
1. `FDOC-DISPATCH-02`: el test espera el marcador `// BLOQUE 10 -`, que no existe en el archivo actual.
2. La otra aserción del test de despacho específico no coincide con el bloque real de la función y necesita alinearse con los límites/contrato reales. No se debe relajar la prueba para hacerla pasar: debe comprobar el bloqueo efectivo antes de cualquier acceso de red o destinatario.

Por tanto, **no hay CI verde en el HEAD actual**. El CI #236 anterior no valida estos commits.

## 4. Riesgos y decisiones pendientes

- No conectar todavía la lectura/escritura del nuevo almacén a `fiscalDocuments.web.js` hasta cerrar el contrato del snapshot y ejecutar pruebas.
- El hash debe cubrir exactamente el mismo objeto canónico al crear y al descargar; cualquier diferencia de normalización puede provocar falsos positivos/negativos.
- El versionado actual propuesto mediante “leer máximo + 1” no es una garantía de concurrencia por sí solo. El ID determinista ayuda a detectar colisiones, pero debe probarse la respuesta real de Wix ante inserciones concurrentes y el comportamiento de `dalInsert`.
- Los hooks de Wix CMS no deben presentarse como protección efectiva hasta validar su despliegue y ejecución en Wix Local Editor/entorno de pruebas. Los permisos CMS no sustituyen las autorizaciones backend.
- `summaryData` y `invoiceData` necesitan contrato de esquema y límites de tamaño/paginación; no se debe asumir que el objeto/array completo cabe en un solo item CMS.
- El despacho externo sigue deshabilitado: no existe todavía ledger append-only de intentos/entregas y respuesta del proveedor.
- `HistoricoCierresZ` permanece reservado a cierres Z; no se debe reutilizar ni modificar.

## 5. Próxima secuencia segura

1. Corregir los dos tests fallidos con límites de bloque y contrato reales, sin debilitar las aserciones.
2. Reejecutar CI sobre el nuevo HEAD y exigir 0 fallos.
3. Completar revisión del diff completo del PR #222 (28 commits, 12 archivos).
4. Auditar el esquema creado y sus permisos mediante lectura independiente; confirmar ausencia de items.
5. Diseñar contrato de snapshot acotado y versionado, incluyendo paginación/tamaño, concurrencia, hash canónico e idempotencia.
6. Solo después conectar `fiscalDocuments.web.js` al almacén dedicado; mantener envío bloqueado.
7. Validar hooks en Wix Local Editor/QA antes de habilitar cualquier escritura de snapshot.
8. Mantener PR #222 Draft y no desplegar hasta pasar gates y revisión de riesgos.

## 6. Estado de validación

| Elemento | Estado |
|---|---|
| Colección CMS creada | **Verificado** |
| Snapshot insertado | No |
| Hook append-only en rama | **Verificado en código** |
| Hook ejecutado en Wix runtime | Pendiente |
| FiscalDocuments migrado a PaquetesGestoria | No |
| Envío a gestoría | Bloqueado |
| CI HEAD | **Fallido: 2 tests** |
| Wix Local Editor | Pendiente |
| Deploy / merge | No realizado |

