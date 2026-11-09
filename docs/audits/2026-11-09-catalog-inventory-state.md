> **Nota de vigencia (2026-11-10):** este documento conserva evidencia histórica del estado auditado en su fecha. La decisión posterior es que Wix Stores Catalog V3 es la única autoridad de stock y que la capa custom de inventario se retira. Ver `docs/DECISION-LOG.md` y `docs/adr/2026-11-10-deposit-and-native-inventory.md`; no usar este snapshot como autorización para reactivar writers o proyecciones CMS.

# Estado actual de Stores Catalog V3 e inventario — 2026-11-09

**Baseline auditado:** `main` · `cad48c04bfe9206a23a2eb0a582e360e36a21864`  
**Sitio:** `www.marianmadrid.es` · Site ID `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Resultado:** Catalog V3 activo y consultable; el stock nativo está seguido, pero la proyección CMS carece de maestros canónicos para las variantes nativas.

## 1. Estado nativo verificado

Consultas REST de solo lectura, con contratos oficiales de Stores Catalog V3:

| Control | Resultado |
|---|---:|
| Catalog Versioning | `V3_CATALOG` · HTTP 200 |
| Productos visibles | 24 |
| Inventory items | 30 |
| Inventory items con `trackQuantity=true` | 30/30 |
| Ubicaciones de inventario | 1 |

La API nativa devuelve los 30 inventory items y sus identidades `productId`, `variantId`, `locationId`, `quantity` y `trackQuantity`.

## 2. Estado de la proyección CMS

Consultas CMS de solo lectura:

- `InventarioStockVenta`: 1 registro.
- El registro no contiene `productId`, `variantId` ni `stockKey`; no puede relacionarse de forma verificable con un inventory item V3.
- Su campo `needsWixReconciliation=false` no sustituye la identidad canónica ni demuestra una conciliación válida.
- `MovimientosInventario`: 1 registro con token `QA_LIVECMS_20261023_2000_STOCK_MOVE` y motivo `Prueba predespliegue; no corresponde a stock comercial`. No contiene `stockKey` y no acredita un movimiento comercial.

**Resultado:** 0/30 inventory items tienen maestro CMS canónico verificable. No se han insertado, actualizado ni eliminado registros.

## 3. Contrato backend actual

- `src/backend/catalogV3Adapter.js` importa `catalogVersioning`, `inventoryItemsV3` y `productsV3` desde `@wix/stores`.
- `getCatalogVariant(productId-variantId)` exige una única ubicación; rechaza cero resultados, múltiples ubicaciones e identidad incompleta.
- `queryCatalogInventory` pagina el catálogo nativo para los candidatos del panel.
- `getInventoryCatalogCandidates` requiere rol cajero y expone variantes con stock seguido.
- `registerInventoryMaster` requiere rol admin, valida SKU/precio/stock/IVA y crea `stockKey = V3:productId:variantId`.
- `syncPaidOrderInventoryInternal` consulta el stock nativo, pero devuelve `INVENTORY_MASTER_MAPPING_REQUIRED` si no existe el maestro CMS.
- Los efectos nativos de checkout/refund siguen siendo responsabilidad de Wix Stores; el backend personalizado proyecta el resultado y no debe volver a descontar el stock comercial.

La página `ZONA MARIAN` conecta acciones para candidatos, alta de maestro, historial, movimientos y reparaciones. La inspección del HTML real del panel está pendiente porque `#htmlAdministracion`/`#htmlAdmin` no están sincronizados en el repositorio.

## 4. Riesgos e impacto

1. **P1 — Proyección/ledger:** sin maestro CMS, la sincronización de pedidos pagados no puede actualizar `InventarioStockVenta` ni registrar el movimiento comercial con `stockKey`.
2. **P1 — Identidad de ubicación:** el adaptador rechaza variantes con varias ubicaciones. Si el negocio añade otra ubicación, se requiere diseño explícito de asignación antes de ampliar el flujo.
3. **P1 — Integridad:** la fila legacy sin claves no debe migrarse automáticamente. El propio `registerInventoryMaster` devuelve `INVENTORY_LEGACY_MAPPING_REQUIRES_REVIEW` si encuentra una fila previa por `productId`/`variantId` sin clave canónica.
4. **P2 — Runtime:** los mocks de CI no prueban el import real del SDK V3, scopes ni ejecución del WebMethod en Wix Local Editor.

## 5. Siguiente procedimiento

1. Sincronizar el HTML del panel administrativo desde Wix Local Editor.
2. En un sitio QA, ejecutar `getInventoryCatalogCandidates` y validar el contrato de respuesta.
3. Ejecutar `registerInventoryMaster` para una variante QA, bajo autorización admin; verificar stock nativo, SKU, precio, IVA, `stockKey`, índice único e idempotencia.
4. Probar webhook de pedido pagado y reembolso en QA; confirmar que Wix aplica el efecto nativo y el backend solo proyecta.
5. Solo tras pruebas y autorización explícita, preparar un lote de maestros para producción. No usar inserts CMS REST directos ni crear movimientos de prueba en el ledger comercial.

## 6. Límites

- No se modificó stock, catálogo, CMS ni movimientos.
- No se ejecutaron WebMethods Velo en Local Editor.
- No se crearon pedidos, pagos, productos ni variantes.
- No se ha validado el runtime real de `@wix/stores` ni sus scopes.
- El estado de publicación del código del repositorio requiere comprobación separada; la lectura REST nativa no demuestra despliegue del HEAD.

Detalle transversal: [auditoría de conciliación frontend/backend/Wix Apps](2026-11-09-frontend-native-reconciliation.md).
