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


## Scopes SDK V3 requeridos

- Catalog Versioning: SCOPE.STORES.CATALOG_READ_LIMITED.
- Query Inventory Items V3: SCOPE.STORES.INVENTORY_ITEM_READ.
- Products V3 Get Product: SCOPE.STORES.PRODUCT_READ.
- Bulk Increment/Decrement Inventory Items V3: SCOPE.STORES.INVENTORY_ITEM_WRITE.

La concesión efectiva de estos scopes en el entorno Velo del sitio sigue pendiente de comprobación en Wix Local Editor; auth.elevate no sustituye la concesión de scopes.


---

## Actualización de estado post-merge — 2026-11-09

Esta sección supersede las referencias históricas de este informe que describían el PR #216 como abierto/en borrador.

- PR #216 se fusionó en `main` mediante el merge commit `7b1d48d5255ffa5eb5d2f20080798be163d9dd57`.
- `src/backend/catalogV3Adapter.js` y la migración del writer V3 están presentes en el código actual de `main`.
- El merge y CI offline no demuestran que el código esté publicado ni que el import SDK `@wix/stores` resuelva en runtime Velo.
- La smoke read-only del sitio confirma Catalog V3 REST, 24 productos visibles, 30 inventory items y Bookings availability; el detalle está en `docs/qa/2026-11-09-runtime-smoke-production.md`.
- El despliegue sigue bloqueado por divergencia de UI entre Wix Editor y el snapshot Git (`UI version: 15941`). La regla de protección no debe eludirse.


---

## Revalidación de disponibilidad y decisión de migración — 2026-11-10

### 1. Versiones: nomenclatura que no debe confundirse

- **Aplicación instalada en Marian Madrid:** Wix Invoices **V1**, confirmado por GetSiteContext para el siteId `188bed94-177c-4bc9-a9f0-35080d874f3e`.
- **API objetivo de nueva generación:** Wix documenta este producto como **Get Paid Invoices / Invoices V2** y confirma un despliegue gradual por sitio.
- **Versión de rutas REST:** la API descubierta usa rutas `/invoices/v4/...`. Este `v4` es la versión del contrato REST y **no** significa que la aplicación Wix instalada sea Invoices V4.
- **SDK JavaScript:** la documentación oficial presenta el acceso a la nueva API principalmente mediante REST API v4 y el SDK universal de Wix. No se ha verificado un paquete npm independiente, estable y publicable denominado `@wix/get-paid`; no debe tratarse como dependencia confirmada ni añadirse al `package.json` por inferencia.
- La integración futura deberá seguir el patrón oficial de SDK universal/REST documentado para el entorno concreto (Velo), una vez habilitada la API en este sitio y validada su disponibilidad/contrato en runtime.

### 2. Comprobación live repetida (solo lectura)

Site: `Marian Madrid` — `188bed94-177c-4bc9-a9f0-35080d874f3e`.

| Probe | Resultado | Interpretación |
|---|---|---|
| GetSiteContext | Wix Invoices V1 | La aplicación instalada continúa en V1 |
| `POST /invoices/v4/invoices/query`, cursor limit 1 | HTTP **428** · `INVOICES_API_UNAVAILABLE` | La API nueva no está habilitada en este sitio |
| `GET /invoices/v4/invoices-settings` | HTTP **200** · revision 1 · nextNumber 1 | El recurso de configuración de numeración es legible, pero no acredita disponibilidad del CRUD de facturas |
| `package.json` | No contiene una dependencia específica de Invoices V2 | No existe una integración SDK V2 declarada; esto no implica que deba añadirse un paquete independiente |

El error 428 devuelve literalmente que el sitio todavía utiliza el servicio de facturas heredado, accesible únicamente mediante Velo, y que Wix está desplegando New Invoices junto con su API y SDK de forma gradual; no requiere acción manual del propietario.

**Corrección de precisión:** la ruta de settings verificada es `/invoices/v4/invoices-settings`, confirmada por `publicUrl` del esquema oficial. Una comprobación previa con la ruta alternativa `/invoices-settings/v4/invoices-settings` devolvió 404 y no debe citarse como endpoint operativo.

### 3. Decisión

**Objetivo recomendado: adoptar Get Paid Invoices / Invoices V2 cuando Wix habilite el sitio. Migración ejecutable ahora: NO.**

No hay una operación pública documentada para que el propietario fuerce la migración del sitio. Wix afirma que la migración de sitios existentes se realiza gradualmente y automáticamente. El 428 es una condición de disponibilidad de plataforma, no un error que se resuelva instalando un paquete, cambiando scopes o alterando la configuración del sitio.

Por tanto:

1. Mantener la aplicación/servicio V1 existente sin cambios mientras el sitio permanezca en ese estado.
2. No instalar un supuesto paquete independiente `@wix/get-paid`, crear un adapter especulativo ni implementar fallback V1/V2 por detección de errores. Usar SDK universal/REST conforme al patrón oficial que Wix soporte en Velo.
3. No crear facturas de prueba, publicar, enviar, cobrar, borrar ni cambiar numeración.
4. Repetir la comprobación read-only cuando Wix comunique o muestre la migración; el criterio mínimo es que Query Invoices deje de devolver 428 y responda con el contrato V2 documentado.
5. Después, desarrollar una rama separada con el SDK oficial y pruebas de contrato/runtime, sin retirar V1 hasta validar todos los flujos y disponer de rollback.

### 4. Evaluación funcional y fiscal antes de adoptar V2

La API nueva aporta capacidades útiles: facturas standalone y order, pagos parciales/depósitos, cálculos, publicación, numeración, PDF y seguimiento de pagos. Sin embargo, no debe tratarse como sustituto del SIF propio ni como prueba de cumplimiento Veri*Factu.

Puntos de integración que requieren diseño y pruebas antes de producción:

- **Numeración:** el número se asigna al publicar; las series/prefijo/sufijo se configuran por settings. Hay que reconciliar esa secuencia con la serie fiscal canónica de `MovimientosCaja`; no permitir dos autoridades ni saltos/reutilizaciones.
- **Pagos y órdenes:** una factura `STANDALONE` crea automáticamente un pedido Wix eCommerce al iniciarse el primer pago. El evento y el pedido resultantes deben correlacionarse con el ledger para evitar duplicar ingresos, cobros, IVA o recuperación de pagos.
- **Anticipos:** la API soporta depósitos y pagos parciales, pero no demuestra por sí sola el registro fiscal de anticipo, su fecha de devengo, factura, aplicación al saldo ni factura rectificativa.
- **Identificación fiscal española:** el esquema expone `customerInfo.contactId` como obligatorio; el campo `vatId` del ejemplo/contrato consultado está descrito actualmente como utilizable solo en Brasil. No asumir que cubre NIF-IVA español sin confirmar el mecanismo admitido para ES.
- **Datos regionales e impuestos:** comprobar país ES, EUR, zona horaria, reglas fiscales y redondeos con casos de IVA reales aprobados por asesoría; no copiar el ejemplo estadounidense de la documentación.
- **Comunicaciones:** `Send Invoice` envía la factura a contactos. Está fuera del alcance de esta fase y permanecerá deshabilitado; no se enviará nada a clientes.
- **Inmutabilidad:** conservar los ledgers append-only; eventos de publicación, pagos, void y rectificaciones deben enlazarse por IDs externos y nunca sobrescribir movimientos históricos.

### 5. Condiciones de entrada para una futura migración técnica

Abrir la migración solo cuando se cumplan todas:

- Wix habilita la API nueva en el site y Query Invoices responde correctamente.
- Se inspeccionan schemas completos de Create/Update/Publish/Get/Query/Record Payment/Void/Generate PDF y webhooks aplicables.
- Wix confirma el tratamiento y representación de NIF/NIF-IVA español y los datos fiscales de emisor/receptor.
- Asesoría fiscal valida el modelo de factura, numeración, anticipos, IVA y rectificaciones.
- Se define una única autoridad de numeración y una correlación idempotente Wix Invoice ↔ Wix Order/Payment ↔ `MovimientosCaja`.
- Se prueban en QA: borrador, publicación, pago parcial, pago completo, anulación, devolución/rectificación, PDF, duplicados, replay, timeout y concurrencia.
- Se confirma que ninguna prueba envía comunicaciones, inicia cobros ni altera datos reales.
- CI, revisión de diff, runtime Velo y rollback están aprobados antes de retirar cualquier ruta V1.

### 6. Resultado

- **Verificado:** app V1 instalada; API nueva devuelve 428; settings v4 responde 200; `@wix/get-paid` ausente del manifiesto.
- **Declarado por Wix:** migración progresiva automática, sin acción manual necesaria.
- **Decisión:** preparar adopción futura de Invoices V2, pero no ejecutar migración ni modificar código/runtime ahora.
- **Bloqueos conservados:** Veri*Factu P0 y emisión fiscal de anticipos permanecen bloqueados. Ninguna factura ni configuración se ha modificado.


### Aclaración de nomenclatura SDK — 2026-11-10

Se ajusta la formulación anterior para evitar presentar `@wix/get-paid` como paquete npm independiente confirmado. La recomendación es **Invoices V2 / REST API v4** y, para JavaScript, el patrón oficial de **SDK universal de Wix** (o REST donde corresponda), no un paquete «SDK v2» separado. El acceso concreto desde Velo debe validarse con la documentación y runtime vigentes cuando el sitio reciba el rollout. Esta precisión no altera la decisión: el sitio continúa en V1 y la query de Invoices V2 devuelve 428, por lo que no hay migración ejecutable ahora.
