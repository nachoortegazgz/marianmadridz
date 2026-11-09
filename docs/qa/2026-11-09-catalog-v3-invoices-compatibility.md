# Migración Wix Stores Catalog V3 — 2026-11-09

## Estado y evidencia live

- El sitio 188bed94-177c-4bc9-a9f0-35080d874f3e devuelve V3_CATALOG mediante Catalog Versioning API.
- Catalog V3 Query Inventory Items devuelve 30 inventory items en una única ubicación (23c2eb92-6b87-471c-8397-6c54092d6f09) en la lectura de esta fecha.
- Catalog V3 Get Product devuelve variantes con id, sku y price.actualPrice.amount; Query Inventory Items devuelve id, productId, variantId, locationId, quantity, trackQuantity y datos del producto/variante.
- InventarioStockVenta contiene una única fila QA sintética (QA Producto ficticio — NO VENDER) sin productId/variantId; MovimientosInventario contiene una única fila QA sintética. No son una correspondencia válida para los 30 productos V3 y no se migran ni sobrescriben.
- No se ha ejecutado ninguna escritura de stock ni CMS en esta auditoría.

## Cambio implementado en rama

- Nuevo backend/catalogV3Adapter.js: resuelve la versión, variante y inventory item mediante APIs V3; usa Get Product para precio/SKU y Query Inventory Items para stock.
- La resolución de una variante exige exactamente un inventory item. Si hay varias ubicaciones, falla con INVENTORY_V3_LOCATION_AMBIGUOUS; no selecciona una arbitrariamente.
- Los ajustes manuales utilizan Bulk Increment Inventory Items / Bulk Decrement Inventory Items por inventoryItemId, con reason=MANUAL, y exigen confirmación por elemento.
- Las ventas y devoluciones siguen siendo lecturas del stock nativo después del efecto de Wix eCommerce; no se vuelve a descontar/reponer stock en esos flujos.
- La clave de proyección CMS cambia a V3:<productId>:<variantId>. Los movimientos históricos append-only no se reescriben.
- El alta del maestro CMS sigue exigiendo tipo impositivo, política de impuestos incluidos y reservas verificadas; no se autogeneran maestros sin esos datos.
- No se añade ningún campo nuevo a las colecciones CMS como parte de este cambio.

## Dependencias de validación antes de merge/deploy

1. **CI ejecutada y verde:** 47 suites, 442 tests, 0 fallos; verificación Cart V2, Bookings Reader V2 y ESLint completados correctamente.
2. Verificar los contratos SDK V3 en el entorno Wix del sitio.
3. Probar lectura de variantes, reservas, ventas, devoluciones y ajustes manuales en entorno de prueba.
4. Probar idempotencia, duplicados, fallos tras mutación nativa y recuperación de journals.
5. Validar con Wix Local Editor y después con el sitio publicado, usando solo producto/variante de QA dedicados. No ajustar stock de productos comerciales como prueba.

## Facturación Wix — resultado de compatibilidad separado

- GetSiteContext identifica la aplicación Wix Invoices instalada como versión V1. No se ha confirmado una Invoices API V2 habilitada para este sitio.
- La nueva API Get Paid Invoices se documenta bajo el SDK @wix/get-paid y rutas REST v4; la versión de ruta REST no debe confundirse con la versión de la aplicación Wix.
- La documentación oficial indica que Get Paid Invoices se despliega gradualmente y que los sitios aún no migrados reciben HTTP 428. En el sitio, GET /invoices/v4/invoices-settings responde 200, pero POST /invoices/v4/invoices/query devuelve 428 INVOICES_API_UNAVAILABLE; el CRUD nuevo no está habilitado.
- No se implementa un wrapper especulativo ni se activa un segundo motor de facturación. Se conserva el emisor V1 hasta que Wix habilite la API nueva en este sitio y se apruebe el contrato de numeración/series frente al ledger fiscal propio.
- La lectura de invoices-settings no se ha modificado. No se han creado, publicado, enviado ni cobrado facturas.

## Test harness

The offline ESM loader now exposes the Catalog V3 namespaces (`productsV3`, `inventoryItemsV3`) as test doubles. This is test-only plumbing; production imports continue to resolve from the Wix SDK package.
