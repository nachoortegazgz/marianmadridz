# ADR-004 — Migración del módulo de inventario a Wix Stores Catalog V3

- **Estado:** Aceptada para el sitio Marian Madrid por solicitud explícita del responsable del proyecto; implementación pendiente de validación.
- **Fecha:** 2026-11-09
- **Ámbito:** www.marianmadrid.es — sitio Wix ID 188bed94-177c-4bc9-a9f0-35080d874f3e

## Contexto

El dossier anterior declaraba Catalog V1 activo y prohibía V3. La lectura read-only del sitio publicado devuelve V3_CATALOG. Wix indica que un sitio utiliza V1 o V3, no ambos simultáneamente. Por tanto, el código de inventario V1 no coincide con la versión real del catálogo.

## Decisión

1. Catalog V3 será la única versión canónica del módulo de inventario para este sitio.
2. La versión se consulta y cachea mediante Catalog Versioning antes de cualquier operación Stores.
3. Lecturas de stock: Inventory Items V3; precio/SKU/variantes: Products V3 Get Product.
4. Ajustes manuales explícitos: Bulk Increment/Decrement Inventory Items V3 por inventoryItemId, con motivo MANUAL y confirmación por elemento.
5. Ventas y reembolsos online no vuelven a mutar stock: Wix eCommerce aplica el efecto nativo y Marian Madrid solo lo proyecta en CMS.
6. Cada inventory item representa una variante y una ubicación. Si una variante resuelve varias ubicaciones, el flujo falla de forma cerrada hasta que exista asignación explícita.
7. No se reescriben movimientos históricos append-only ni se añaden campos CMS sin inspección y aprobación de esquema.
8. No se autogeneran maestros CMS para los 30 inventory items actuales: los datos fiscales y de reservas deben verificarse por producto.
9. Esta decisión es específica del sitio. Si el repositorio se distribuye como Wix App multi-site, deberá implementarse soporte dual V1/V3.

## Consecuencias

- Se cambia la versión canónica del módulo a V3 y la clave de proyección a V3.
- Se introduce un adaptador aislado de SDK V3.
- Se actualiza el test loader para representar los namespaces V3.
- El módulo no se considera operativo hasta superar CI, pruebas en Wix Local Editor, E2E con variante de QA dedicada y verificación posterior.

## Alternativas descartadas

- Mantener V1: incompatible con el Catalog V3 publicado.
- Llamar a REST V3 directamente desde el dominio: descartado como primera opción porque Wix ofrece SDK V3 oficial para Velo.
- Migrar automáticamente todas las filas CMS: descartado por falta de correspondencia de producto/variante y datos fiscales verificados.

## Referencias oficiales

- https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/introduction
- https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-versioning/get-catalog-version
- https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/inventory-items-v3/introduction
- https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/products-v3/get-product
- https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/inventory-items-v3/bulk-increment-inventory-items
- https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/inventory-items-v3/bulk-decrement-inventory-items

## Validación y despliegue

PR #216 contiene la implementación. CI offline run 168 verde en commit 77d63d2: 47 suites, 442 tests, 0 fallos; lint y contratos Cart V2/Bookings Reader V2 correctos. No se fusiona ni despliega hasta ejecutar pruebas de integración/E2E en Wix Local Editor con producto/variante QA dedicados y verificar la importación real de los namespaces SDK V3. No se modifica stock real del catálogo como parte de la migración.

## Scopes SDK V3 requeridos

- Catalog Versioning: SCOPE.STORES.CATALOG_READ_LIMITED.
- Query Inventory Items V3: SCOPE.STORES.INVENTORY_ITEM_READ.
- Products V3 Get Product: SCOPE.STORES.PRODUCT_READ.
- Bulk Increment/Decrement Inventory Items V3: SCOPE.STORES.INVENTORY_ITEM_WRITE.

La concesión efectiva de estos scopes en el entorno Velo del sitio sigue pendiente de comprobación en Wix Local Editor; auth.elevate no sustituye la concesión de scopes.
