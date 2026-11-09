# QA runtime y smoke de producción — 2026-11-09

**Sitio:** https://www.marianmadrid.es/  
**Site ID:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Repositorio:** `nachoortegazgz/marianmadridz`  
**Base de código examinada:** `main` en `740bff3481d1af3e8278fa31bcb9c20d5424866c`  
**Tipo de prueba:** smoke de páginas públicas + lecturas REST Wix en producción.  
**Restricción:** todas las llamadas a Wix fueron de solo lectura. No se crearon reservas, pedidos, pagos, productos ni movimientos; no se escribieron colecciones CMS ni stock.

## 1. Resumen ejecutivo

- El sitio está publicado y el dominio propio responde con contenido público recuperable.
- Wix Stores Catalog V3 y Wix Bookings responden a consultas de lectura.
- La disponibilidad de una cita se pudo listar y revalidar en el backend nativo de Wix.
- Esto **no certifica el runtime de los WebMethods Velo personalizados** ni la integración SDK V3 del código fusionado.
- La publicación del código actual sigue bloqueada por una divergencia entre la versión UI del Editor y la versión guardada en GitHub.

## 2. Smoke de páginas públicas

| Superficie | Resultado | Alcance |
|---|---|---|
| Inicio | Contenido público recuperable | Navegación, contenido y secciones principales visibles en extracción web |
| Servicios | Contenido público recuperable | Catálogo de servicios visible |
| Rutas de tienda, promociones, gift cards, blog y privacidad | No concluyente | El recuperador web devolvió `Cache miss`; no equivale a HTTP 404 ni demuestra fallo del sitio |
| Interacciones visuales, formularios y navegación móvil | No ejecutadas | No hay navegador interactivo/Computer Use ni Local Editor disponible en esta sesión |

Se observó en la extracción de texto de inicio la cadena «Confirmación al instant e». No se clasifica como defecto visual confirmado: puede ser un artefacto de extracción y requiere inspección en navegador.

## 3. Pruebas live de Wix — solo lectura

| ID | Operación | Resultado observado |
|---|---|---|
| WIX-SM-01 | `GET /stores/v3/provision/version` | HTTP 200 · `V3_CATALOG` |
| WIX-SM-02 | `POST /stores/v3/products/query` | HTTP 200 · 24 productos visibles · sin página siguiente |
| WIX-SM-03 | `POST /stores/v3/inventory-items/query` | HTTP 200 · 30 inventory items · 30 con seguimiento de cantidad · 1 ubicación |
| WIX-SM-04 | `POST /bookings/v2/services/query` | HTTP 200 · 70 servicios visibles · todos tipo `APPOINTMENT` |
| WIX-SM-05 | `POST /_api/service-availability/v2/time-slots` | HTTP 200 · servicio Balayage Signature · 10 slots en primera página · zona `Europe/Madrid` · hay página siguiente |
| WIX-SM-06 | `POST /_api/service-availability/v2/time-slots/get` | HTTP 200 · 10-11-2026 09:00–09:40 · `bookable=true` · capacidad restante 1 · un recurso disponible |

La disponibilidad fue consultada para el 10-11-2026. La revalidación de un slot confirma que Wix lo consideraba disponible en el instante de la consulta; no es una reserva ni garantiza disponibilidad futura.

## 4. CI y estado de publicación

- GitHub Actions run `42656358136`: `success`, 50 suites, 477 pruebas, 0 fallos. Es CI offline; los mocks no ejecutan los WebMethods en el runtime Wix.
- GitHub Actions run `42545413297` (`Wix production publish`): autenticación CLI correcta y preview creado; publicación detenida por protección de versión UI.
- Mensaje reproducible: el Editor contiene cambios de diseño más recientes que la versión UI del repositorio (`UI version: 15941`). El script detiene la publicación para evitar publicar un snapshot visual obsoleto.
- Última publicación exitosa visible en las ejecuciones recientes: run `42501667041`, 08-11-2026 16:47Z, commit `795a38b9edadcb2d0d0592d96a73015c2f725221`. Las ejecuciones de publicación del 09-11-2026 fallaron por el bloqueo UI.
- No hay evidencia en Actions de que el código de los merges de 09-11-2026 se haya publicado. No se ha intentado forzar la publicación.

## 5. Bloqueos pendientes — no ocultar ni eludir

### P1 — Sincronización de UI Wix/Git
El Editor tiene cambios visuales posteriores al snapshot del repositorio. Requiere abrir el Local Editor conectado al sitio, sincronizar/guardar los cambios de UI y repetir la comprobación de versión antes de publicar. No desactivar el guard del script ni publicar el snapshot antiguo.

### P1 — Importación real de Catalog V3 SDK
El sitio devuelve `V3_CATALOG` y las APIs REST V3 responden. El código de `src/backend/catalogV3Adapter.js` importa `catalogVersioning`, `inventoryItemsV3` y `productsV3` desde `@wix/stores`. Las pruebas offline usan mocks; no demuestran que esos imports y scopes resuelvan en el runtime Velo real. Falta ejecutar Wix Local Editor con permisos/scopes efectivos y variante QA dedicada.

### P2 — Manifiesto Velo / regla ESLint
`src/velo.dependencies.json` no está presente en el árbol revisado. `@wix/cli/no-invalid-backend-import` sigue desactivada por esta ausencia. No crear el manifiesto manualmente ni editar `wix.lock`; generar/sincronizar mediante el flujo oficial Wix y verificar después la regla.

### P2 — Toolchain ESLint
`package.json` mantiene `eslint@8.25.0` y `@wix/eslint-plugin-cli@1.0.2`; el plugin declara peer dependency ESLint 8. ESLint 8 está EOL. No forzar ESLint 10 ni usar `--legacy-peer-deps`: primero hay que reemplazar o migrar el plugin conservando las reglas efectivas y demostrar paridad de lint.

## 6. Pruebas no ejecutadas

- Invocación real de WebMethods `*.web.js` del proyecto.
- Wix Local Editor / Preview actual de la rama main.
- Formularios de contacto, alta Members, checkout, cobro, devolución y cancelación.
- Creación de reservas simples/duales, concurrencia, compensaciones e idempotencia en runtime.
- Escrituras CMS, cambios de stock o ledger. Se excluyeron deliberadamente para no alterar datos de producción.
- Verificación visual responsive y accesibilidad con navegador interactivo.

## 7. Criterio de cierre

La smoke read-only de las APIs nativas de Stores y Bookings es **PASS**. La smoke de páginas es **parcial**. La certificación runtime de Velo y el despliegue de la revisión actual permanecen **BLOCKED** hasta sincronizar UI y ejecutar las pruebas en Local Editor con scopes reales. No declarar producción certificada con estos resultados.

## 8. Documentación oficial Wix

- Catalog Versioning: https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-versioning/get-catalog-version
- Query Products V3: https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/products-v3/query-products
- Query Inventory Items V3: https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/inventory-items-v3/query-inventory-items
- Query Bookings Services V2: https://dev.wix.com/docs/api-reference/business-solutions/bookings/services/services-v2/query-services
- List Availability Time Slots: https://dev.wix.com/docs/api-reference/business-solutions/bookings/time-slots/time-slots-v2/list-availability-time-slots
- Get Availability Time Slot: https://dev.wix.com/docs/api-reference/business-solutions/bookings/time-slots/time-slots-v2/get-availability-time-slot
- Wix CLI for Sites Commands: https://dev.wix.com/docs/develop-websites/articles/workspace-tools/developer-tools/git-integration-wix-cli-for-sites/wix-cli-for-sites-commands
