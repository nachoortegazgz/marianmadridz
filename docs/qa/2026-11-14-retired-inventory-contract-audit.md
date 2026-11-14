# Retirada de contratos de inventario personalizado — 2026-11-14

## Objetivo

Eliminar referencias ejecutables a las colecciones personalizadas de inventario retiradas, sin modificar Wix Stores ni datos CMS. La autoridad operativa del catálogo y stock comercial es Wix Stores Catalog V3.

## Evidencia

- El inventario CMS live del 2026-11-14 contiene 41 colecciones (12 NATIVE / 29 WIX_APP).
- `InventarioStockVenta` y `MovimientosInventario` no aparecen en el inventario live; las consultas individuales devolvieron 404 / `WDE0025`.
- No existe `src/backend/inventario.web.js`.
- La búsqueda global de consumidores encontró únicamente:
  - constantes en `internalConfig.js`;
  - guardas append-only y allowlists en `dataAccessPolicy.js`;
  - hooks `MovimientosInventario_beforeUpdate/Remove` en `data.js`;
  - fixtures y aserciones en pruebas.
- No se encontró writer activo ni consumidor de negocio que dependa de esas colecciones. Las pruebas de eventos ya verifican el marcador `inventoryAuthority=WIX_CATALOG_OWNER` y `inventoryAction=NO_CUSTOM_STOCK_WRITE`.

## Cambios integrados en PR #353 (`c16ed0b605a8d548f79158aa0dbd702666eea829`)

- Eliminar `INVENTARIO_STOCK_VENTA` y `MOVIMIENTOS_INVENTARIO` de `BUSINESS_COLLECTIONS`.
- Retirarlas de `BUSINESS_COLLECTIONS`, `updateCollections` y de la lista privada de ledgers append-only. La lista `removeCollections` conservó una referencia residual que se corrige en PR #354.
- Renombrar la lista privada `APPEND_ONLY_MUTABLE_COLLECTIONS` a `APPEND_ONLY_COLLECTIONS`, que describe correctamente su función.
- Eliminar los hooks append-only de `MovimientosInventario`, ya que la colección no existe live.
- Eliminar pruebas que simulaban mutaciones de un ledger inexistente y aserciones vacías contra colecciones no registradas.
- Añadir prueba de regresión que impide reintroducir las colecciones retiradas en la allowlist canónica.

## Excepción preservada

`DatosFiscales` permanece únicamente en `QA_MUTABLE_COLLECTIONS` por la autorización explícita del propietario para el ámbito de QA. El CMS live devolvió 404 / `WDE0025`; no hay writer actual. Se conserva como excepción temporal separada y con revisión prevista para 2026-11-21. No debe recrearse por esta allowlist.

## Corrección residual en PR #354

La integración #353 eliminó el identificador de `BUSINESS_COLLECTIONS`, pero dejó una referencia a `BUSINESS_COLLECTIONS.MOVIMIENTOS_INVENTARIO` dentro de `DATA_ACCESS_WRITE_POLICY.removeCollections`. Al no existir ya la constante, el array contenía un elemento `undefined`. PR #354 elimina esa referencia y deja alineadas las listas de update/remove.

## Límites

- No se modifica Wix CMS ni se recrean/eliminan colecciones.
- No se modifica Wix Stores Catalog V3 ni sus inventarios.
- No se alteran ledgers fiscales, contables o laborales existentes.
- No se cambia `QA_RECORD_MUTATIONS_ENABLED=true`.
- No se publica ni despliega en Wix.
- PR #354 integrada en `main` como `fde9466552b6819980475a682dc06395b57487f0`; CI PASS en `28a11a690f0a99926921332618b6af670d45814c` (run #1068) y Gitleaks PASS (run #492). La limpieza principal de hooks/constantes de PR #353 también está integrada.

## Criterios de aceptación

1. Ningún consumidor de producción referencia las constantes o hooks de inventario personalizado.
2. La política de escritura ya no autoriza colecciones retiradas.
3. La prueba de arquitectura confirma que las colecciones no pertenecen a la allowlist.
4. Capa 1, Capa 2, regresión offline, SDK contracts, ESLint y Gitleaks pasan sobre el SHA final.
