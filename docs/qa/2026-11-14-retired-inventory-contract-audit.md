# Retirada de contratos de inventario personalizado — estado vigente

**Actualización:** 2026-11-14  
**Sitio único:** 50b39f33-e753-4331-ab35-b2ed43dc97f7, banco de pruebas aislado sin actividad real.

## Objetivo

Evitar que el backend gobierne el stock comercial mediante colecciones personalizadas cuando Wix Stores Catalog V3 es la autoridad del catálogo e inventario.

## Estado CMS actual

- Inventario total: 23 colecciones (15 NATIVE, 8 WIX_APP).
- InventarioStockVenta y MovimientosInventario permanecen físicamente en CMS.
- Sus contratos de aplicación, constantes operativas, writers y hooks están retirados.
- No se deben recrear, volver a incluir en allowlists ni utilizar para escrituras de stock.
- DatosFiscales sí existe en el CMS actual (28 campos). Las capturas antiguas que lo declaraban ausente están superadas.

## Evidencia de código

- No existe src/backend/inventario.web.js.
- La búsqueda global de consumidores de los contratos retirados no encontró un writer de negocio activo.
- Los eventos de pedidos mantienen los marcadores inventoryAuthority=WIX_CATALOG_OWNER e inventoryAction=NO_CUSTOM_STOCK_WRITE.
- PR #353 retiró los contratos/hook de inventario personalizado.
- PR #354 eliminó la referencia residual BUSINESS_COLLECTIONS.MOVIMIENTOS_INVENTARIO de DATA_ACCESS_WRITE_POLICY.removeCollections.

## Política de mutabilidad actual

ISOLATED_SITE_RECORD_MUTATIONS_ENABLED=true habilita temporalmente update/remove sobre colecciones propias permitidas por ISOLATED_SITE_MUTABLE_COLLECTIONS, con IDs explícitos y límite de 1.000 elementos para operaciones masivas. Las colecciones WIX_APP quedan excluidas. Esta política no reintroduce los contratos de inventario retirados ni autoriza escrituras en Wix Stores.

## Límites

- No se han eliminado las colecciones físicas InventarioStockVenta ni MovimientosInventario.
- No se ha modificado Wix Stores Catalog V3.
- No se han mutado registros CMS ni publicado código Wix en esta intervención.
- PR #370 está abierto pero dirty; rebase y CI sobre HEAD actual pendientes.

## Criterios de aceptación

1. Ningún consumidor de src/ referencia los contratos retirados.
2. Ninguna allowlist autoriza writers de inventario personalizado.
3. Wix Stores Catalog V3 conserva la autoridad de stock.
4. Las pruebas de arquitectura y CI se ejecutan sobre el SHA final de la rama antes de merge o publicación.
