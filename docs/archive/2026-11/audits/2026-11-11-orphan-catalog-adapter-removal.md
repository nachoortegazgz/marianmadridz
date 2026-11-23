# Auditoría — retirada del adaptador Catalog V3 huérfano

- **Fecha:** 2026-11-11
- **Base:** `main` · `0e51b082fd75515949f3b9b23e647b4777796b3b`
- **Cambio:** eliminar `src/backend/catalogV3Adapter.js`.

## Evidencia

1. Búsqueda completa de referencias de código a `catalogV3Adapter`, `queryCatalogInventory`, `getCatalogVariant`, `incrementCatalogInventory` y `decrementCatalogInventory`: no hay consumidores de código; las coincidencias restantes son documentación histórica.
2. PR #238 ya retiró el módulo de inventario personalizado, sus WebMethods y su interfaz; PR #239 se cerró como duplicado/superado.
3. ADR `docs/adr/2026-11-10-deposit-and-native-inventory.md`: Wix Stores Catalog V3 es la única autoridad de stock; no se debe añadir lógica personalizada para administrar, reservar, descontar, reponer o sincronizar cantidades.
4. El adaptador residual aún exponía funciones de ajuste manual `incrementCatalogInventory` y `decrementCatalogInventory`, sin una referencia operativa idempotente. Al no tener consumidores no se justifica ampliarlo ni añadirle idempotencia: se retira.

## Alcance y seguridad

- Solo se elimina el módulo sin consumidores.
- No se modifica stock, catálogo, CMS, pedidos, reservas, pagos ni reembolsos.
- No se modifican WebMethods, eventos, cron ni frontend.
- Se conserva Wix Stores como autoridad nativa y se mantienen intactos los ledgers financieros/fiscales.

## Validación

- Búsqueda estática de referencias: cero consumidores de código.
- La eliminación no cambia contratos importados porque no existe ningún importador.
- CI del PR pendiente de ejecución tras abrirlo.
- Wix Preview/E2E no aplica a una eliminación de módulo no referenciado; no se declara validación runtime.

## Reversión

Revertir el commit de eliminación si la CI detecta una referencia indirecta no localizada. No requiere restaurar ni modificar datos de Wix.
