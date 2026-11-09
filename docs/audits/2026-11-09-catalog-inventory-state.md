# Estado actual de Stores e inventario — auditoría 2026-11-09

**Base:** \`main\` commit \`5fba1b3aaa17d6a758d4004372cd5ece112b98fb\`  
**Sitio:** \`www.marianmadrid.es\`  
**Resultado:** V1 activo; compatibilidad V3 no presente en el código actual; discrepancia de dependencias pendiente de reconciliación Wix CLI.

## 1. Hechos verificados en el repositorio

- PR #13 (\`feat(stores): version-aware Catalog V1/V3 inventory adapter\`) figura como integrada en GitHub.
- La integración no representa el estado actual del código: el commit \`7f8e7a6b24\` (2026-11-06, \`cleanup: remove dead integrations, inventory and accounting projections\`) eliminó \`storesCatalog.js\`, \`storesCatalogMapper.js\` y las suites de adapter V1/V3.
- Posteriormente se reintrodujo un writer de inventario V1 en \`src/backend/inventario.web.js\`. El módulo está consumido por \`src/backend/events.js\` y por la página de administración \`src/pages/ZONA MARIAN.gn7mx.js\`.
- \`inventario.web.js\` importa \`catalogVersioning\`, \`inventory\` y \`products\` desde \`@wix/stores\`; el código actual usa operaciones V1 y no contiene un adaptador V3.
- El árbol de \`main\` no contiene \`src/backend/storesCatalog.js\`, \`storesCatalogMapper.js\` ni tests \`stores-catalog-v3-adapter\`.
- El contexto Wix consultado el 2026-11-09 informa Catalog V1 activo.

## 2. Discrepancia de dependencias

- \`package.json\` no declara \`@wix/stores\`.
- \`wix.lock\` conserva entradas de \`@wix/stores\` para las versiones \`1.0.960\` y \`1.0.970\`.
- Las pruebas offline de inventario usan mocks del namespace \`@wix/stores\`; por tanto, el CI offline no demuestra que el import resuelva correctamente en el runtime Wix real.
- CI run 118 pasa las 46 suites (431/431), SDK contracts y ESLint; no incluye una prueba de resolución del paquete en Wix Local Editor.

**Clasificación:** discrepancia de manifiesto/lockfile verificada. Fallo runtime no demostrado. No editar \`wix.lock\` manualmente ni asumir que el lock resuelve el import.

## 3. Evidencia documental CMS

La auditoría \`docs/qa/2026-11-06-capa2-integrated-audit.md\` documentó:
- Colecciones \`InventarioStockVenta\` y \`MovimientosInventario\` existentes como colecciones NATIVE.
- Índice único \`stockKey_unique\` y \`movementToken_unique\` activos.
- Campos de variante/ubicación opcionales en el esquema observado.
- \`stockKey\` con índice único pero no marcado required.

Esta evidencia es del 2026-11-06 y **no se ha reconsultado en vivo en esta intervención**. Requiere revalidación antes de cualquier migración o escritura masiva.

## 4. Estado funcional

| Capacidad | Estado |
|---|---|
| Catálogo Wix | V1 activo, verificado en contexto Wix |
| Writer de inventario V1 | Código presente; tests offline presentes |
| Eventos de pedido/reembolso | Integración de backend presente; no se ha ejecutado E2E Wix |
| Adapter V1/V3 | No presente en el árbol actual |
| Adapter V3 y ubicación por variante | No presente |
| Webhooks de cambios de catálogo V3 | No presentes |
| Conciliación real contra catálogo publicado | No verificada en esta intervención |
| Migración de catálogo del sitio a V3 | No realizada |

## 5. Acciones pendientes y criterio de cierre

1. **P1 — Resolver dependencia Wix:** ejecutar en clon autenticado y con Node requerido por Wix CLI el procedimiento oficial de instalación/reconciliación de \`@wix/stores\`; revisar el diff de \`package.json\` y \`wix.lock\`. No editar lockfile a mano.
2. **P1 — Validación runtime V1:** Wix Local Editor/Preview debe importar \`inventario.web.js\` y ejecutar lecturas de catálogo sin mutar stock de producción.
3. **P1 — CMS:** volver a consultar campos e índices vivos; confirmar si \`stockKey\` es obligatorio en la colección y si el índice único es consistente con todas las filas.
4. **P2 — Decisión de arquitectura V3:** el Dossier Técnico Consolidado describe V3 como prioridad, pero el adaptador que implementaba compatibilidad dual fue eliminado después. Resolver ADR para restaurar dual V1/V3 o mantener V1 hasta una ventana de migración aprobada.
5. **P2 — QA V3:** si se aprueba, validar scopes, productos, variantes, ubicaciones, inventario, pedidos y reembolsos en un sitio QA V3. No cambiar la versión del catálogo publicado como parte de esta tanda.
6. **P2 — Reintentos:** verificar si la cola de conciliación dispone de un worker automático; no declarar operativo un cron si no existe en \`jobs.config\` y \`crons.js\`.

## 6. Seguridad y datos

- No se han modificado registros CMS ni cantidades de inventario.
- No se ha cambiado Catalog V1 ni se ha habilitado V3.
- No se han activado webhooks V3.
- No se han creado productos, variantes o correspondencias comerciales ficticias.
- No se ha publicado código desde esta auditoría.

**Conclusión:** no debe reintroducirse V3 ni ejecutarse una migración de catálogo hasta reconciliar la dependencia Wix, revalidar el CMS y completar QA en un sitio de prueba.

---

## 7. Corrección de vigencia — 2026-11-09, lectura Wix y PR #216

Esta revisión supersede las afirmaciones de las secciones 1 y 4 que indicaban Catalog V1 activo. La evidencia anterior se basaba en un contexto Wix desactualizado.

- **Verificado ahora en GetSiteContext:** Wix Stores app version Catalog V3.
- **Verificado ahora en Catalog Versioning API:** V3_CATALOG.
- **Verificado ahora en Inventory Items V3:** 30 inventory items en una ubicación.
- La lectura de InventarioStockVenta/MovimientosInventario identificó únicamente filas QA sintéticas sin correspondencia válida con los 30 inventory items; no se realizó migración de datos ni escritura.
- PR #216 introduce un adaptador V3, migra las operaciones del writer y cambia la clave de proyección a V3. ADR-004 y anexo de vigencia del Dossier registran la decisión.
- CI offline run 168 en commit 77d63d2: 47 suites, 442 tests, 0 fallos; ESLint y contratos Cart V2/Bookings Reader V2 correctos.
- **Pendiente:** la suite offline usa mocks de los namespaces V3. No acredita que el import real de @wix/stores resuelva en Wix Local Editor. El manifiesto/lockfile requiere reconciliación con Wix CLI y prueba de importación real.
- **Actualización 2026-11-09:** PR #216 está fusionado en main (merge commit `7b1d48d5255ffa5eb5d2f20080798be163d9dd57`), pero no hay evidencia de publicación del código V3. La ejecución de publicación más reciente falló por divergencia de UI del Editor (`UI version: 15941`).
- El código de pedidos y reembolsos mantiene la regla: Wix eCommerce aplica el efecto nativo y el módulo proyecta el resultado; solo los ajustes manuales explícitos llaman a Bulk Increment/Decrement V3.

**Estado actualizado:** Catalog V3 activo en el sitio; migración de código propuesta y CI offline verde; runtime Wix, mapeo maestro CMS y E2E todavía pendientes. No modificar stock ni crear maestros CMS hasta completar esas verificaciones.

## 8. QA live read-only — 2026-11-09

Se ha confirmado de nuevo Catalog Versioning `V3_CATALOG` (HTTP 200), 24 productos visibles en Stores V3, 30 inventory items seguidos en una ubicación, 70 servicios de Bookings y disponibilidad de una cita para el 10-11-2026. La revalidación del slot 09:00–09:40 respondió `bookable=true`. No se realizaron escrituras CMS/stock ni reservas/pagos.

La evidencia valida las APIs REST nativas; no valida el import real del SDK `@wix/stores` en Velo ni los WebMethods personalizados. El bloqueo de publicación permanece: el Editor tiene cambios UI más recientes que el snapshot del repositorio. Ver `docs/qa/2026-11-09-runtime-smoke-production.md`.
