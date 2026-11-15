> **Estado de este informe:** auditoría histórica. La sección de mutabilidad temporal que aparece más abajo quedó supersedida por TEC-038 y por la revisión de seguridad del 2026-11-15. El código actual no habilita mutabilidad global; los ledgers permanecen protegidos. La decisión QA-2026-11-15 autoriza correcciones sintéticas, pero su implementación ADMIN-only y vinculada al sitio QA sigue pendiente.\n\n> **Procedencia de evidencia:** este informe conserva observaciones y snapshots de una revisión anterior. La designación vigente identifica `188bed94-177c-4bc9-a9f0-35080d874f3e` como el único sitio QA, pero no convierte automáticamente los datos CMS, settings o recuentos históricos en evidencia del estado actual de ese sitio. Repetir lecturas de solo lectura en el Site ID vigente antes de cualquier mutación. No existe otro sitio QA ni un QA externo designado.

---

> **Addendum de vigencia — 2026-11-14:** la excepción de mutabilidad mencionada en este informe pertenece a un corte histórico. TEC-038 retiró los bypasses globales y mantiene los ledgers append-only también en QA. La designación de entorno de este corte es histórica y queda supersedida por el único sitio QA vigente `188bed94-177c-4bc9-a9f0-35080d874f3e`. No usar el flag histórico como autorización de mutaciones.

# Retirada de contratos de inventario personalizado — 2026-11-14

**Actualización:** 2026-11-14  
**Sitio al que se refiere este corte histórico:** referencia anterior de entorno, supersedida; no es el Site ID QA vigente.

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
