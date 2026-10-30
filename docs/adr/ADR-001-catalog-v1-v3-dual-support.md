# ADR-001 — Compatibilidad Catalog V1/V3 y migración de inventario

- Estado: Aceptado para implementar compatibilidad dual; migración irreversible del catálogo del sitio aplazada a QA.
- Fecha: 2026-10-30
- Alcance: Wix Stores, catálogo e inventario propio Marian Madrid.
- Sitio: `188bed94-177c-4bc9-a9f0-35080d874f3e`.
- Repositorio: `nachoortegazgz/marianmadridz`.

## Contexto verificado

1. El contexto vivo de Wix indica que Marian Madrid utiliza actualmente Catalog V1 e Invoices V1.
2. El anexo aclaratorio de la Biblia SSOT revoca la permanencia indefinida en Catalog V1 y establece Catalog V3 como migración prioritaria. Exige detección de versión, adaptación del inventario al modelo variante-ubicación y soporte de webhooks de ambas versiones.
3. `src/backend/inventario.web.js` declara conciliación con Stores V1 y procesa líneas de pedido usando `sku || productId`. El movimiento propio se vincula a `wixProductId` y `wixVariantId`.
4. El esquema documentado de `InventarioStockVenta` contiene `sku`, `wixProductId`, `wixVariantId`, `productId`, `variantId` y `location`; no se ha confirmado un campo canónico `locationId` ni un índice único compuesto variante-ubicación.
5. Wix documenta que Catalog V1 y V3 no son compatibles entre sí en el mismo sitio. V3 mueve precio y SKU al nivel de variante y gestiona inventario por combinación `variantId + locationId`.

## Decisión

Implementar una capa de compatibilidad dual, seleccionada por la Catalog Versioning API:

- Consultar `catalogVersioning.getCatalogVersion()` al inicio de cada flujo de catálogo/inventario.
- `V1_CATALOG`: conservar el adaptador V1 para el sitio actual.
- `V3_CATALOG`: usar Products V3, Read-Only Variants V3 e Inventory Items V3 según la operación.
- `STORES_NOT_INSTALLED`: devolver un resultado explícito de catálogo no disponible; no asumir V1.
- No mezclar payloads V1 y V3 ni inferir un variantId a partir de productId o SKU.
- Diseñar el inventario propio para identificar inequívocamente la variante y la ubicación. La incorporación de `locationId`, su índice compuesto y la migración de registros requieren validar el esquema vivo y preparar una migración de datos controlada antes de desplegar.
- Mantener suscripciones/procesamiento de webhooks V1 y V3 durante la transición.
- No decrementar dos veces el inventario nativo: Wix documenta que el checkout de tienda descuenta automáticamente el inventario de la ubicación predeterminada. El ledger propio registra el movimiento y la conciliación; cualquier decremento adicional en Wix requiere un caso probado distinto.
- No cambiar todavía la versión de catálogo del sitio publicado. La conversión de V1 a V3 no es automática y no es reversible desde el código.

## Consecuencias

- El sitio seguirá operando en V1 hasta que el plan de migración de productos, variantes, stock, webhooks y storefront esté validado.
- El backend deberá soportar V1 y V3 simultáneamente antes de que el sitio cambie a V3.
- Los tests offline deben cubrir ambos formatos de evento, idempotencia, SKU por variante, ubicaciones y ausencia de doble decremento.
- La activación de V3 en el sitio requiere snapshot/exportación, ensayo en entorno de prueba, conciliación de productos/variantes/stock y aceptación funcional antes del cambio.

## Secuencia de implementación

1. Instalar `@wix/stores` mediante Wix CLI for Sites y regenerar `wix.lock`; fijar la versión exacta resuelta por el gestor Wix.
2. Implementar el resolver de versión con `auth.elevate(catalogVersioning.getCatalogVersion)` en backend.
3. Definir DTO canónico de inventario que incluya `productId`, `variantId`, `locationId`, `sku` y `catalogVersion`, sin aliases ambiguos.
4. Añadir/validar `locationId` y el índice compuesto de inventario en CMS mediante migración aprobada.
5. Implementar adaptadores V1/V3 y adaptar pedidos/reembolsos/webhooks con fixtures reales anonimizados.
6. Suscribir/procesar eventos V1 y V3, con deduplicación común por eventId.
7. Ejecutar regresión offline y QA real en Preview/entorno de prueba.
8. Cambiar el catálogo del sitio solo en una ventana de migración aprobada, tras conciliación completa.

## Fuentes oficiales

- Catalog Versioning: https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-versioning/introduction
- Get Catalog Version (SDK): https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-versioning/get-catalog-version?apiView=SDK
- Catalog V3: https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/introduction
- V1 to V3 Migration Guide: https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/catalog-v1-to-v3-migration-guide
- Inventory Items V3: https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/inventory-items-v3/introduction
- Inventory Management: https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/about-inventory-management
