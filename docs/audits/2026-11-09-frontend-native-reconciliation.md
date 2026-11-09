# Auditoría de conciliación frontend, backend y Wix Apps — 2026-11-09

**Baseline auditado:** `main` · `cad48c04bfe9206a23a2eb0a582e360e36a21864`  
**Sitio:** [www.marianmadrid.es](https://www.marianmadrid.es/)  
**Site ID:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Entorno:** Wix Editor, publicado, Velo habilitado, `Europe/Madrid`, EUR.  
**Método:** inspección de código en GitHub, inventario de páginas Wix y consultas REST/CMS de solo lectura. No se han ejecutado WebMethods Velo ni se han escrito datos.

## 1. Resultado ejecutivo

La integración de reservas está razonablemente conciliada entre el CMS `ServiciosCatalogo` y Wix Bookings: los 94 servicios nativos tienen correspondencia por ID, nombre, precio y visibilidad; los 24 servicios de dos fases enlazan con su F2 y duración nativa correctas. No se detecta una discrepancia de catálogo que justifique una migración.

Los principales bloqueos detectados están en otras capas:

1. **P1 — Inventario:** Wix Stores V3 tiene 30 variantes con stock seguido, pero `InventarioStockVenta` contiene una sola fila y no dispone de identidad canónica `productId`/`variantId`/`stockKey`. No hay maestros válidos para las 30 variantes. El backend devuelve `INVENTORY_MASTER_MAPPING_REQUIRED` si intenta proyectar una línea de pedido sin maestro.
2. **P1 — Rutas frontend:** el panel de staff enviaba a `/administracion`, pero la página publicada de administración es `/zona-marian`. El enlace de privacidad del calendario enviaba a `/politica-de-privacidad`, pero la página publicada es `/politica-privacidad-texto`. Ambos cambios se han corregido en la rama de auditoría; aún no están fusionados ni publicados.
3. **P1 — Widgets no auditables:** el repositorio no contiene los HTML fuente de `#htmlAdministracion`/`#htmlAdmin` ni `#htmlOnlyStaffPanel`. Se puede auditar el controlador Velo, pero no el contrato real de mensajes, botones, estados ni renderizado de esos widgets.
4. **P2 — Zona Staff:** el controlador publicado está en modo placeholder. Todos los flags funcionales están desactivados y los mensajes de caja solo se registran en consola; no llaman a WebMethods. No debe considerarse un TPV operativo.
5. **P2 — Capacidades declaradas:** el proveedor IA no está configurado; la personalización Gift Cards no existe en `src/`; el banner de cookies no está implementado en `masterPage.js`. Las apps nativas instaladas deben verificarse por separado.

## 2. Inventario de páginas publicado y rutas

Consulta Wix Site Context API `ListStaticPages` y `ListDynamicPages`:

| Página | ID Wix | Ruta publicada |
|---|---|---|
| Blog | `b3z7b` | `/blog` |
| Catálogo | `d4fc7` | `/reserva-online` |
| Inicio | `cjg9` | `/inicio` |
| MUY PRONTO | `ly4ej` | `/muy-pronto` |
| PROMOCIONES | `s7ap5` | `/promociones` |
| Privacidad y Cookies | `vd6cx` | `/politica-privacidad-texto` |
| Página del carrito | `twv9b` | `/cart-page` |
| ZONA MARIAN | `gn7mx` | `/zona-marian` |
| ZONA STAFF | `mvf3f` | `/onlystaff` |
| Calendario de reservas 2 | `q39h6` | `/booking-calendar` (dinámica) |
| Pagina de servicio 2 | `xnfr4` | `/service-page` (dinámica) |

Wix devuelve 9 páginas estáticas y 2 dinámicas. La consulta de URL mappings devuelve 0 redirecciones. El inventario de páginas estáticas no enumera todas las páginas administradas internamente por Wix Apps; por eso no se interpreta la ausencia de una ruta de app como 404 sin comprobarla por el mecanismo correspondiente.

### Rutas corregidas en la rama de auditoría

- `ZONA STAFF` → `ADMIN_PANEL`: antes `/administracion`; ahora constante canónica `URLS.ADMIN_PANEL = /zona-marian`.
- Calendario → privacidad: antes `/politica-de-privacidad`; ahora `URLS.PRIVACY_POLICY = /politica-privacidad-texto` y fallback alineado.

Se ha añadido una prueba de contrato estática para ambas rutas.

### Rutas todavía pendientes

`/pos-checkout`, `/caja-actual` y `/mi-calendario` aparecen en el controlador de ZONA STAFF, pero no figuran en el inventario estático/dinámico consultado y no hay URL mappings. Debe confirmarse si son rutas internas de alguna app nativa o páginas aún no creadas. No se han sustituido por rutas inventadas.

## 3. Reservas: conciliación CMS ↔ Wix Bookings ↔ frontend

### 3.1 Catálogo

Consultas de solo lectura a `ServiciosCatalogo` y Bookings V2:

| Control | CMS | Wix Bookings | Resultado |
|---|---:|---:|---|
| Registros totales CMS | 95 | — | 94 servicios + 1 plan |
| Servicios | 94 | 94 | Coinciden |
| Visibles | 70 | 70 | Coinciden |
| Ocultos | 24 | 24 | Coinciden |
| ID de servicio | 94/94 | 94/94 | Sin huérfanos |
| Nombre | 94/94 | 94/94 | Sin diferencias |
| Precio | 94/94 | 94/94 | Sin diferencias |
| Fase 1 | 94/94 | 94/94 | Sin diferencias |
| Vínculo F2 de servicios duales | 24/24 | 24/24 | Todos resuelven |
| Duración F2 enlazada | 24/24 | 24/24 | Sin diferencias |
| Fórmula duración total | 94/94 | — | Sin diferencias |

Los 28 slugs nativos que no coinciden literalmente con el campo `slug` del CMS sí coinciden con el título CMS normalizado. El backend `_getServiceBySlugOrIdInternal` contempla esa resolución por título normalizado. Resultado de la comprobación: 66 resuelven por slug CMS, 28 por título normalizado y 0 quedan sin resolver. No se recomienda normalizar ni sobrescribir los slugs masivamente.

Hay discrepancias de flags de pago en 16 registros online y 8 presenciales, pero todas pertenecen a los 24 servicios F2 ocultos. No se observan diferencias de flags en los 70 servicios visibles. No modificar estos valores sin analizar el contrato de fases duales.

### 3.2 Flujo de reserva

- `Calendario de reservas 2.q39h6.js` usa `getCertifiedDualSlots` y `processDualBooking`.
- `bookingSaga.js` usa `@wix/bookings` V2 `createBooking`, valida consentimiento RGPD, canales de pago y slots F1/F2, y compensa reservas creadas si falla la saga.
- El checkout online se entrega mediante Cart V2.
- `#html1.txt` contiene el formulario propio de nombre, email, teléfono, canal de pago y aceptación de privacidad. El controlador envía el consentimiento y versión del aviso.
- Los servicios nativos devuelven `form.id` vacío/cero en la muestra consultada; el flujo personalizado no debe depender de un formulario nativo asignado.

**Pendiente:** reserva real en entorno QA, checkout no cobrable, webhooks, compensación dual, reprogramación/cancelación y concurrencia. La coherencia de catálogo y las respuestas REST no demuestran ejecución del WebMethod.

## 4. Stores Catalog V3 e inventario

### 4.1 Estado nativo

- Catalog Versioning: `V3_CATALOG`, HTTP 200.
- Productos visibles: 24.
- Inventory items: 30.
- `trackQuantity=true`: 30/30.
- Ubicaciones de inventario: una.

### 4.2 Estado CMS

Consultas directas de solo lectura:

- `InventarioStockVenta`: 1 fila.
- Esa fila no contiene `productId`, `variantId` ni `stockKey`; tampoco permite relacionarla con un inventory item nativo. Su `needsWixReconciliation=false` no acredita que exista una correspondencia válida.
- `MovimientosInventario`: 1 fila con token `QA_LIVECMS_20261023_2000_STOCK_MOVE` y motivo explícito de prueba predespliegue no comercial. No contiene una clave canónica `stockKey`; no acredita un movimiento comercial.

**Resultado:** 0/30 inventory items tienen maestro CMS canónico verificable.

### 4.3 Contrato backend

- `catalogV3Adapter.js` consulta inventory items V3 por `productId` y `variantId`, rechaza ubicaciones ambiguas y devuelve la identidad nativa.
- `getInventoryCatalogCandidates` expone candidatos para el panel administrativo.
- `registerInventoryMaster` crea el maestro con `stockKey = V3:productId:variantId`, bajo autorización admin.
- `syncPaidOrderInventoryInternal` requiere encontrar ese maestro; si falta, devuelve `INVENTORY_MASTER_MAPPING_REQUIRED`.
- La página `ZONA MARIAN` tiene acciones para consultar candidatos, registrar maestros, ver movimientos y procesar reparaciones. `enableInventory=true`.

**Impacto:** Wix Stores conserva la autoridad del stock y el checkout nativo puede seguir aplicando sus efectos. La proyección CMS y el ledger de movimientos personalizados no están preparados para todas las variantes hasta registrar y verificar sus maestros. No se han creado maestros ni alterado cantidades en esta auditoría.

**Acción requerida:** ejecutar primero el flujo de alta de maestros mediante el WebMethod autorizado en un entorno QA; validar SKU, precio, IVA, ubicación y stock reservado. La carga masiva en producción requiere procedimiento, pruebas y autorización explícita. No insertar filas directamente por REST.

## 5. ZONA MARIAN y ZONA STAFF

### ZONA MARIAN

- Control de acceso mediante `checkStaffCollaboratorAccess` y exigencia de `isMarianManager=true`.
- Acciones backend conectadas para caja: `getCashierState`, `registerManualTransaction`, `registerZClosing`.
- Acciones conectadas para inventario: candidatos, alta de maestro, historial, movimientos y reparaciones.
- Fiscalidad y documentos tienen acciones mapeadas.
- Flags: caja e inventario habilitados; fichaje, gestión de staff, IA y envío a gestor deshabilitados.
- `enableAccountantSend=false` y `SDK_CONFIG.EMAIL.ACCOUNTANT_SEND_ENABLED=false`: coherentes y fail-closed.

No se puede validar el HTML real del panel porque no existe snapshot sincronizado de `#htmlAdministracion`/`#htmlAdmin` en el repositorio.

### ZONA STAFF

- La página publicada es `/onlystaff`.
- El control de acceso de colaborador está presente.
- `enableClocking`, `enableBreaks`, `enableCashier`, `enableInventory` y `enableScheduleQuery` están en `false`.
- `onWidgetMessage` procesa navegación; los mensajes de caja solo generan `console.debug`, no invocan backend.
- `cajas.web.js` no exporta un WebMethod `registerXCount`; la acción `X_COUNT` tampoco está en el mapa de acciones de ZONA MARIAN.

**Conclusión:** ZONA STAFF es una shell de acceso/placeholder, no un TPV ni un gestor de jornada operativo. El comentario anterior que sugería importar `backend/cashier.web.js` era obsoleto; el módulo real es `cajas.web.js`. Se ha retirado esa indicación engañosa en la rama de auditoría.

No se debe activar ningún flag hasta disponer del HTML fuente, contrato de mensajes, handlers backend, pruebas de permisos y E2E.

## 6. Wix Apps nativas

El contexto Wix confirma instaladas: Wix Bookings, Wix Stores Catalog V3, Wix Gift Cards, Wix Members Area, Wix Forms & Payments, Wix Blog, Wix Invoices V1, Wix Hotels y Promote SEO.

| App | Evidencia actual | Estado de conciliación |
|---|---|---|
| Wix Bookings | 94 servicios nativos conciliados con CMS | Catálogo coherente; runtime E2E pendiente |
| Wix Stores | 24 productos y 30 inventory items V3 | Stock nativo activo; proyección CMS sin maestros |
| Wix Gift Cards | 1 producto de tarjeta regalo; 0 tarjetas emitidas | App configurada; no existe personalización Gift Cards propia en `src/` |
| Wix Members Area | App instalada; páginas de miembros gestionadas por app | Rutas, permisos y recorrido cliente pendientes de E2E |
| Wix Forms & Payments | App instalada | Formularios nativos y recepción no auditados en esta pasada |
| Wix Invoices | Versión V1 | No equivale a un SIF Veri*Factu ni demuestra remisión AEAT |
| Wix Blog | App instalada; página Blog publicada | No se ha auditado publicación/feeds |
| Wix Hotels | App instalada | No se ha encontrado flujo de negocio que la consuma; confirmar si es necesaria |

### Wix Forms & Payments

Consulta de solo lectura a Wix Forms v4: hay 4 esquemas activos (`enabled=true`):

| Formulario | Campos | Automatización posterior observada | Evaluación |
|---|---:|---|---|
| `FORM MOVIMIENTO CAJA MANUAL` | 7 | `postSubmissionTriggers=[]`; mensaje de gracias | No llama a `registerManualTransaction` ni acredita asiento en `MovimientosCaja` |
| `FORM CONTROL X` | 7 | `upsertContact` con mapping vacío | No acredita cierre X ni escritura en ledger |
| `FORM REGISTRO HORARIO` | 6 | `upsertContact` con mapping vacío | No acredita escritura en `RegistrosHorariosStaff` |
| `FORMULARIO DE CONTACTO BÁSICO` | 7 | Upsert CRM de nombre, email y teléfono | Integración CRM coherente con su finalidad |

Las tres primeras formas son compatibles por nombre/campos con flujos internos de caja y jornada, pero su esquema no contiene un trigger backend de negocio. La página ZONA STAFF mantiene los flags deshabilitados y no enruta estos eventos. No se puede confirmar desde la API de formularios en qué páginas están embebidas; hay que inspeccionarlo en Wix Editor.

El endpoint oficial de conteo de envíos devolvió HTTP 200 y `formsSubmissionsCount=[]` para los IDs consultados. Ese resultado no se interpreta como cero envíos sin aclarar la semántica de la respuesta; no se leyeron contenidos de formularios ni datos personales.

**Conclusión:** Wix Forms está instalado y tiene cuatro formularios configurados, pero los formularios de caja/X/fichaje no están conectados de forma demostrable con los WebMethods ni con los ledgers append-only. No deben tratarse como sustituto del backend.

### Gift Cards

La app nativa tiene un producto configurado (`TARJETA REGALO Marian Madrid Peluquería&Belleza`) y el contador nativo devuelve 0 tarjetas emitidas. No existe `giftCards.web.js`, writer propio, escáner `/admin-scanner` ni implementación HMAC/QR personalizada demostrable en `src/`. No confundir la app instalada con la personalización descrita en RF-16…RF-21.

### IA y consentimiento

- `aiAgent.web.js` falla cerrado con `AI_PROVIDER_NOT_CONFIGURED`; ZONA MARIAN también mantiene `enableAIAssistant=false`.
- `masterPage.js` no contiene implementación de banner de cookies. No se ha comprobado la configuración nativa del Consent Manager ni el bloqueo efectivo de scripts; RL-14 queda pendiente, no verificado.
- El texto público de asesoramiento IA observado en una extracción web antigua no es evidencia actual de contenido publicado. Requiere comprobación visual en Editor antes de corregir copy.

## 7. Rama de corrección y pruebas

**Rama:** `qa/frontend-native-reconciliation-2026-11-09`

Cambios propuestos:
- Constante `URLS.ADMIN_PANEL` alineada con `/zona-marian`.
- Constante `URLS.PRIVACY_POLICY` alineada con `/politica-privacidad-texto`.
- Controlador de ZONA STAFF ya no sugiere un módulo inexistente ni describe como implementado un enrutamiento de caja que solo registra mensajes.
- Pruebas de contrato estáticas para ambas rutas.

**Estado:** cambios en rama; no fusionados, no desplegados. CI del commit de código `3fc7482` completada con SUCCESS (run #42671109488): 50 suites, 479 tests, 0 fallos; contratos SDK y ESLint también SUCCESS. Los commits posteriores de esta rama solo actualizan documentación. No se ha modificado Wix CMS, stock, reservas, pagos, tarjetas ni ledgers.

## 8. Siguiente secuencia de trabajo

1. **P1 — Inventario:** validar en QA el alta de maestros mediante WebMethod; luego preparar un plan de alta de los 30 maestros con autorización. No escribir en producción todavía.
2. **P1 — HTML Components:** sincronizar desde Wix Local Editor los tres HTML reales de administración y staff al repositorio; comprobar IDs, protocolo, mensajes y contratos con los mapas de acciones.
3. **P1 — Rutas:** revisar en Wix Editor los destinos `/pos-checkout`, `/caja-actual` y `/mi-calendario`; decidir si se crean, se enlazan a una app nativa o se retiran.
4. **P2 — Caja:** decidir si X-count forma parte del alcance; si sí, diseñar WebMethod y contrato append-only antes de habilitarlo.
5. **P2 — IA:** configurar proveedor y tests de seguridad o retirar/ocultar la promesa pública hasta entonces.
6. **P2 — Gift Cards:** validar compra, email, canje y saldo con la app nativa; solo desarrollar personalización si existe necesidad de negocio aprobada.
7. **P1 legal:** verificar Consent Manager nativo, bloqueo de analytics/pixels, formularios y consentimiento desde el sitio publicado.
8. Ejecutar E2E en Wix Local Editor/QA, revisar diff, CI y reversión antes de fusionar o publicar.

## 9. Límites de esta auditoría

- Las consultas REST y CMS fueron de solo lectura.
- No se ejecutaron WebMethods personalizados dentro de Wix Local Editor.
- No se inspeccionó visualmente el contenido de los HTML Components que no están sincronizados al repositorio.
- La ausencia de una ruta en ListStaticPages no prueba por sí sola un 404 para páginas gestionadas por apps.
- La auditoría no certifica pagos, reservas, stock, seguridad runtime, RGPD ni cumplimiento fiscal.
