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

**Cambio mínimo:** sustituir el upsert por `dalInsert`. La unicidad del `_id` hace que solo una solicitud pueda crear esa versión. Una colisión de ID existente (`WDE0074` / `WD_ITEM_ALREADY_EXISTS`, según el catálogo oficial de Wix Data) se devuelve como `PACKAGE_VERSION_CONFLICT`, indicando actualizar historial y reintentar. No se modifica ni elimina ninguna versión previa.

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

## 5. Cierre del generador duplicado de secuencia fiscal

**Causa raíz verificada en Wix CMS:** `CajaActual` tiene el plugin `SINGLE_ITEM` y `singleItemId = SINGLE_ITEM_ID`. Solo admite un registro. La lectura live devolvió un único elemento con `_id = SINGLE_ITEM_ID`, `singletonKey = CAJA_PRINCIPAL`; no existe un segundo registro de secuencia. `MovimientosCaja` devolvió cero elementos en esta inspección. El diseño anterior intentaba insertar `CAJA_SEQ` en esa misma colección, lo que contradice el contrato físico de Wix.

**Cambio mínimo en rama `fix/remove-caja-seq-singleton`:**
1. Un único asignador `allocateFiscalSequence` y un único rollback `rollbackFiscalSequence` en `fiscalLedgerLock.js`.
2. Los contadores global y anual se guardan en `sequenceCounters` del único `CAJA_PRINCIPAL`; se preserva `appliedMovementIds`.
3. `cajas.web.js` y `eventLog.js` usan el mismo asignador bajo `acquireFiscalLedgerLock`; se eliminan los generadores y rollbacks duplicados.
4. `CajaActual_beforeInsert` solo admite el singleton principal; la actualización de contadores se permite en ese mismo registro.
5. Si una escritura devuelve resultado incierto, se hace lectura fuerte de comprobación. Si no puede determinarse el resultado, se conserva el bloqueo fiscal para reparación; no se asigna otra secuencia a ciegas.

**Evidencia:** esquema live de `CajaActual` con plugin `SINGLE_ITEM`; registro principal `_id=SINGLE_ITEM_ID`; cero filas en `MovimientosCaja` durante la consulta. Documentación Wix: colección de elemento único y su propósito de contenido no repetible.

**Riesgo residual:** el bloqueo global tiene TTL de 10 minutos y verifica propietario antes del append, pero no implementa renovación/fencing distribuido. Las operaciones que superen el TTL deben seguir siendo rechazadas por la comprobación de propietario; la prueba de concurrencia real en Wix continúa pendiente.

**Validación CI:** run #142 detectó sintaxis inválida en `eventLog.js` y fixtures sin el singleton principal; corregidos. Run #144 ejecutó 46 suites: 437 pruebas pasaron y una falló (`EVENT-PAYMENT-09`) porque el fixture de webhook no sembraba `CajaActual.CAJA_PRINCIPAL`; SDK Cart V2, Bookings Reader V2 y ESLint pasaron. Se añadió el singleton al fixture de ese webhook en el commit siguiente; la repetición completa de CI sobre ese commit queda pendiente. No se declara validado hasta obtener resultado verde.

**Estado:** cambio de código preparado en rama; sin escrituras CMS, sin movimientos fiscales y sin publicación.

## 6. Módulos P1 ausentes — inventario y proyección contable

### Inventario Wix Stores

**Evidencia de repositorio:** el árbol real de `src/backend` no contiene `inventario.web.js` ni `storesCatalog.js`. Las búsquedas de `InventarioStockVenta`, `MovimientosInventario`, `movementToken`, `stockOnHand` y `getInventoryDashboard` no encuentran referencias de código; solo aparecen en necesidades, dossier y matrices. `package.json` tampoco declara `@wix/stores`.

**Evidencia CMS verificada en lectura live:** `InventarioStockVenta` y `MovimientosInventario` existen como colecciones `NATIVE`; sus esquemas se consultaron en Wix CMS sin mutaciones. `InventarioStockVenta` tiene campos requeridos `name`, `tipoImpositivo`, `taxIncluded`, `price`, `sku`, `stockOnHand`, `stockReserved`, `stockAvailable`, `traceId`; `productId`, `variantId`, `catalogVersion`, `locationId` y `stockKey` son opcionales en el esquema actual. `MovimientosInventario` exige `recordTimestamp`, `movementToken`, `movementType`, `sku`, `quantityDelta` y `traceId`; `lineItemId`, `stockBefore`, `stockAfter`, `stockApplied`, `nativeCommercialMovement` y `requiresWixReconciliation` son opcionales. Los índices live están activos: `movementToken_unique` (único) y `sku_sourceEventId` (regular) en `MovimientosInventario`; `stockKey_unique` (único) en `InventarioStockVenta`. Hay una discrepancia que debe cerrarse: `stockKey` tiene índice único pero el campo no está marcado como required en el esquema. Esto acredita los esquemas físicos, no que exista un writer operativo.

**Contrato Wix verificado:** el proyecto declara Wix Stores Catalog V1. La documentación oficial V1 usa `@wix/stores`:
- `inventory.getInventoryVariants(inventoryId)` para leer variantes.
- `inventory.updateInventoryVariants(productId, inventoryItem)` para actualizar stock.
- El payload de escritura debe incluir explícitamente `trackQuantity`; omitirlo se trata como `false` y puede desactivar el seguimiento de cantidades para todo el producto.
- Documentación: [Get Inventory Variants](https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v1/inventory/get-inventory-variants), [Update Inventory Variants](https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v1/inventory/update-inventory-variants), [SDK @wix/stores](https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v1/inventory/introduction?apiView=SDK).

**Restricción de arquitectura:** no migrar a Catalog V3 en esta intervención. Wix V3 usa otro modelo de inventory items y revisiones; el dossier vigente exige ADR propio para migrar desde V1.

**Webhook pendiente de reconciliar:** el código actual expone `wixEcom_onOrderRefunded` y verifica `ORDER_REFUNDED`; no hay writer de inventario asociado. La documentación oficial de Wix describe además [Order Transactions Refund Completed](https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/order-transactions/order-transactions-refund-completed), que se dispara cuando todos los refund transactions llegan a estado final (`SUCCEEDED` o `FAILED`) e incluye side effects como restocking. No asumir que el payload de este evento coincide con el evento legado que hoy procesa `events.js`; hay que verificar la suscripción y el payload real del sitio antes de adaptar el handler.

**Diseño pendiente:** `MovimientosInventario` debe ser append-only e idempotente por movimiento de línea/refund; `InventarioStockVenta` será proyección espejo. El checkout nativo ya puede descontar stock: el writer no debe aplicar un segundo decremento al inventario nativo. Debe determinarse si el webhook registra el delta y actualiza solo la proyección CMS, y cómo se reconcilia con Wix Inventory sin doble efecto.

### Proyección contable

**Evidencia de repositorio:** la búsqueda de `LibroAsientosContablesDetalle`, `entryId`, `accountCode`, `debitAmount` y `creditAmount` no encuentra escritor en `src/backend`. `eventLog.js` inserta en `MovimientosCaja` y proyecta cierres Z, pero no genera asientos en el libro contable.

**Evidencia CMS verificada en lectura live:** `LibroAsientosContablesDetalle` existe como colección `NATIVE`. El esquema exige `entryId`, `recordTimestamp`, `concept`, `lineNumber`, `origenTipo`, `origenRegistro`, `sourceMovementId`, `entryDate`, `fiscalPeriod`, `accountCode`, `debitAmount`, `creditAmount`, `recordHash`, `previousRecordHash` y `traceId`. No existe campo `sourceEventId`; el vínculo requerido es `sourceMovementId` y `cashMovementId` es opcional. Esto resuelve la discrepancia con la matriz `WEB-16`: el contrato físico prevalece y la matriz debe actualizarse antes de crear el writer. La consulta de índices live devuelve solo los dos índices de sistema para `LibroAsientosContablesDetalle`; no hay índice único de idempotencia. Como `entryId` y `sourceMovementId` no están definidos como identificadores únicos de línea, el diseño de idempotencia del writer requiere decisión previa.

**Protección añadida en esta rama:** `data.js` incorpora hooks `beforeUpdate` y `beforeRemove` para ambos ledgers (`MovimientosInventario` y `LibroAsientosContablesDetalle`), con pruebas en `data.hooks.test.mjs`. Esto protege operaciones que atraviesen los hooks Velo; queda pendiente verificar el comportamiento de edición desde CMS UI, ya que la metadata live muestra `dataPermissions.itemUpdate/itemRemove = CMS_EDITOR` aunque las operaciones Data API indiquen `ADMIN`.

**Diseño pendiente:** definir plan de cuentas, reglas de partida doble, origen único por `sourceEventId`, idempotencia, rectificativas append-only, validación `debit = credit` por asiento y conciliación con `MovimientosCaja`. La proyección contable nunca debe modificar el ledger fiscal de origen.

## 7. Gaps adicionales que permanecen abiertos

1. Ejecutar suite completa `npm run test:layer2` y `npm run test` en CI para el head de esta rama; el cambio aún no tiene resultado de ejecución.
2. Probar concurrencia de eventos fiscales distintos, colisión de secuencia, timeout después del insert y reconciliación del hash head.
3. Probar concurrencia real de creación de paquetes fiscales; el test nuevo es de contrato estático y la protección de producción se basa en unicidad de `insert`.
4. Revisar el uso compartido de `HistoricoCierresZ` por cierres Z y paquetes de gestoría. Se conserva la compatibilidad existente; no se migra colección sin análisis de datos/contratos.
5. Validar que `fiscalAggregator.web.js` pagina todos los resultados y aplica límites de forma consistente con el volumen real.
6. Validar exportaciones y DTOs contra el consumidor real de gestoría, sin exponer PII ni campos fiscales internos en métodos públicos.
7. Validar fichajes y firmas HMAC en Wix QA, incluyendo duplicidad, ajustes rectificativos y secuencias de eventos.
8. Completar pruebas E2E integradas Capa 1 → Capa 2 → Capa 3 en entorno aislado. SharePoint sigue siendo evidencia documental, nunca autoridad transaccional.

## 8. Seguridad y límites de ejecución

- Cambios únicamente en rama GitHub; sin despliegue ni publicación Wix.
- Sin escrituras en CMS de producción.
- Sin emitir facturas, rectificativas ni cierres reales.
- Sin crear/cancelar reservas reales.
- Sin mutar ledgers existentes.
- No se considera validado ningún test que no haya sido ejecutado y observado en CI o entorno controlado.

## 9. Estado

- **Verificado:** PR #153 integrada en `main`; mapa de módulos y gate Capa 2 inspeccionados; defecto potencial de upsert concurrente en paquetes identificado y corregido en esta rama mediante insert-only. Wix Data documenta que `insert` falla si el ID ya existe (WDE0074 / WD_ITEM_ALREADY_EXISTS), mientras `save` realiza upsert.
- **CI verificado en run #245:** suite offline 349/349 PASS; Layer 1 217/217 PASS; Layer 2 112/112 PASS; ESLint PASS. Una corrección posterior del mapeo de error Wix Data (WDE0074) está pendiente de nueva ejecución CI.
- **Pendiente de diseño/cierre:** serialización concurrente del ledger fiscal `eventLog`, pruebas Wix QA y flujos E2E.
- **No autorizado/realizado:** merge de esta rama y despliegue.
