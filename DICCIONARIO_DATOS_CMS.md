# Diccionario de datos CMS — Marian Madrid

## Addendum vigente — sitio actual, corte 2026-11-14

- Sitio objeto de auditoría: `50b39f33-e753-4331-ab35-b2ed43dc97f7`.
- Naturaleza declarada por el propietario: banco de pruebas aislado, sin actividad real.
- Inventario live: 23 colecciones (15 NATIVE, 8 WIX_APP); 524 campos físicos NATIVE.
- El manifiesto de campos, tipos, revisiones y recuentos vigente es `docs/audits/2026-11-14-current-site-cms-normalization.md`.
- Los inventarios y addenda antiguos se conservan como trazabilidad histórica; no describen el esquema vigente ni implican la existencia de otro sitio objeto de trabajo.
- Los registros del sitio se consideran sintéticos/de prueba; no acreditan operaciones comerciales, fiscales ni laborales reales.
- No se ha modificado el CMS durante esta auditoría.



> **Bloque histórico:** la captura que originó los apartados siguientes corresponde a un estado/sitio anterior. No describe el CMS actual ni debe utilizarse como inventario vigente. El manifiesto live aplicable es `docs/audits/2026-11-14-current-site-cms-normalization.md`.
>
 > Las secciones §§2–3 también corresponden a esa captura histórica y no deben usarse como inventario actual. El inventario y esquema vigentes están en el addendum actual al final del documento y en docs/audits/2026-11-14-current-site-cms-normalization.md. Las secciones §§6–16 aportan glosario y contratos; sus menciones a campos ausentes deben contrastarse con el manifiesto vigente.



## 1. Alcance y criterio de lectura

Se documentan:
- Las 12 colecciones `NATIVE` de la captura histórica, con revisión, nombre visible CMS, campo de presentación y campos físicos observados.
- Las 29 colecciones `WIX_APP` de la captura histórica, con nombre visible, propietario de aplicación, campo de presentación y número de campos. Sus esquemas son administrados por Wix Apps y no se redefinen aquí.
- Los keyfields de negocio y sus significados cuando están respaldados por el esquema, `internalConfig.js`, `validation.js` o documentación técnica del repositorio.
- Las reglas de nomenclatura que el dossier define como estándar y las diferencias reales que aparecen en CMS.

**Distinciones importantes**
1. `key` es el nombre técnico usado por CMS y backend.
2. `displayName` es la etiqueta visible del campo en el CMS. La Data Collections API no demuestra por sí sola el texto de etiquetas que se muestran a las clientas en formularios, páginas o widgets del frontend. Esas etiquetas pertenecen a la UI y deben auditarse en sus componentes.
3. `displayName` de colección es el nombre mostrado en CMS; `id` es el identificador estable usado en API/código.
4. Los campos `_id`, `_createdDate`, `_updatedDate` y `_owner` son campos de sistema de Wix cuando aparecen marcados como tales.
5. El esquema CMS describe tipos, pero Wix advierte que no constituye por sí mismo una validación estricta de cada valor escrito. Las validaciones del backend siguen siendo obligatorias.

## 2. Inventario histórico — corte anterior, no aplicable al sitio actual

| ID canónico de colección | Nombre visible | Tipo | Revisión | Campos | App de origen | ownerAppId |
|---|---|---:|---:|---:|---|---|
| `Blog/Categories` | Categories | WIX_APP | 4 | 11 | Wix Blog | `14bcded7-0066-7c35-14d7-466cb3f09103` |
| `Blog/Posts` | Posts | WIX_APP | 0 | 27 | Wix Blog | `14bcded7-0066-7c35-14d7-466cb3f09103` |
| `Blog/Tags` | Tags | WIX_APP | 0 | 7 | Wix Blog | `14bcded7-0066-7c35-14d7-466cb3f09103` |
| `Bookings/Schedule` | Schedule | WIX_APP | 0 | 5 | Wix Bookings | `13d21c63-b5ec-5912-8397-c3a5ddb27a97` |
| `Bookings/Services` | Services | WIX_APP | 5 | 20 | Wix Bookings | `13d21c63-b5ec-5912-8397-c3a5ddb27a97` |
| `Bookings/Staff` | Staff | WIX_APP | 0 | 3 | Wix Bookings | `13d21c63-b5ec-5912-8397-c3a5ddb27a97` |
| `CajaActual` | CAJA_ACTUAL | NATIVE | 13 | 80 | CMS propio del proyecto | `No informado` |
| `CampaignManager/campaigns` | Campaign Manager | WIX_APP | 0 | 32 | Wix Campaign Manager | `7fdf5576-9d52-4c0a-9840-6e226f2ec415` |
| `CampaignManager/userConfig` | User Config | WIX_APP | 0 | 5 | Wix Campaign Manager | `7fdf5576-9d52-4c0a-9840-6e226f2ec415` |
| `CitasF2` | CITAS_F2 | NATIVE | 44 | 31 | CMS propio del proyecto | `No informado` |
| `ComplementosCatalogo` | COMPLEMENTOS_CATALOGO | NATIVE | 141 | 18 | CMS propio del proyecto | `No informado` |
| `ControlOperativo` | CONTROL_OPERATIVO | NATIVE | 39 | 42 | CMS propio del proyecto | `No informado` |
| `eCommerce/Orders` | Orders | WIX_APP | 0 | 45 | Wix Stores / eCommerce | `1380b703-ce81-ff05-f115-39571d94dfcd` |
| `Forms/subscribers03` | Subscriptions | WIX_APP | 0 | 6 | Wix Forms | `14ce1214-b278-a7e4-1373-00cebd1bef7c` |
| `HistoricoCierresZ` | HISTORICO_CIERRES_Z | NATIVE | 39 | 62 | CMS propio del proyecto | `No informado` |
| `LibroAsientosContablesDetalle` | LIBRO_ASIENTOS_CONTABLES_DETALLE | NATIVE | 29 | 27 | CMS propio del proyecto | `No informado` |
| `Locations/Locations` | Locations | WIX_APP | 6 | 17 | Wix Locations | `No informado` |
| `MapaStaff` | MAPA_STAFF | NATIVE | 105 | 56 | CMS propio del proyecto | `No informado` |
| `Marketing/Coupons` | Coupons | WIX_APP | 0 | 23 | Wix Marketing / Coupons | `14d7032a-0a65-5270-cca7-30f599708fed` |
| `Members/Badges` | Badges | WIX_APP | 0 | 11 | Wix Members | `SiteMembers` |
| `Members/FullData` | FullData | WIX_APP | 0 | 28 | Wix Members | `SiteMembers` |
| `Members/PrivateMembersData` | PrivateMembersData | WIX_APP | 4 | 15 | Wix Members | `SiteMembers` |
| `Members/PublicData` | PublicData | WIX_APP | 0 | 12 | Wix Members | `SiteMembers` |
| `MovimientosCaja` | MOVIMIENTOS_CAJA | NATIVE | 80 | 88 | CMS propio del proyecto | `No informado` |
| `PaquetesGestoria` | Paquetes de Gestoria (append-only) | NATIVE | 5 | 17 | CMS propio del proyecto | `No informado` |
| `RegistroIntegracion` | REGISTRO_INTEGRACION | NATIVE | 4 | 21 | CMS propio del proyecto | `No informado` |
| `RegistrosHorariosStaff` | REGISTROS_HORARIOS_STAFF | NATIVE | 14 | 21 | CMS propio del proyecto | `No informado` |
| `ServiciosCatalogo` | SERVICIOS_CATALOGO | NATIVE | 199 | 44 | CMS propio del proyecto | `No informado` |
| `StoreCatalog/Brands` | Brands | WIX_APP | 0 | 6 | Wix Stores Catalog V3 | `215238eb-22a5-4c36-9e7b-e7c08025e04e` |
| `StoreCatalog/Categories` | Categories | WIX_APP | 0 | 17 | Wix Stores Catalog V3 | `215238eb-22a5-4c36-9e7b-e7c08025e04e` |
| `StoreCatalog/Info sections` | Info Sections | WIX_APP | 0 | 9 | Wix Stores Catalog V3 | `215238eb-22a5-4c36-9e7b-e7c08025e04e` |
| `StoreCatalog/Inventory` | Inventory | WIX_APP | 0 | 17 | Wix Stores Catalog V3 | `215238eb-22a5-4c36-9e7b-e7c08025e04e` |
| `StoreCatalog/Product options & modifiers` | Product Options Modifiers | WIX_APP | 0 | 12 | Wix Stores Catalog V3 | `215238eb-22a5-4c36-9e7b-e7c08025e04e` |
| `StoreCatalog/Products` | Products | WIX_APP | 0 | 42 | Wix Stores Catalog V3 | `215238eb-22a5-4c36-9e7b-e7c08025e04e` |
| `StoreCatalog/Ribbons` | Ribbons | WIX_APP | 0 | 6 | Wix Stores Catalog V3 | `215238eb-22a5-4c36-9e7b-e7c08025e04e` |
| `StoreCatalog/Variants` | Variants | WIX_APP | 0 | 16 | Wix Stores Catalog V3 | `215238eb-22a5-4c36-9e7b-e7c08025e04e` |
| `Stores/Collections` | Collections | WIX_APP | 0 | 5 | Wix Stores / eCommerce | `1380b703-ce81-ff05-f115-39571d94dfcd` |
| `Stores/InventoryItems` | InventoryItems | WIX_APP | 0 | 6 | Wix Stores / eCommerce | `1380b703-ce81-ff05-f115-39571d94dfcd` |
| `Stores/Orders` | Orders | WIX_APP | 0 | 23 | Wix Stores / eCommerce | `1380b703-ce81-ff05-f115-39571d94dfcd` |
| `Stores/Products` | Products | WIX_APP | 7 | 35 | Wix Stores / eCommerce | `1380b703-ce81-ff05-f115-39571d94dfcd` |
| `Stores/Variants` | Variants | WIX_APP | 0 | 12 | Wix Stores / eCommerce | `1380b703-ce81-ff05-f115-39571d94dfcd` |

**Corte histórico de la tabla anterior:** 41 colecciones (12 NATIVE, 29 WIX_APP). La ausencia de DatosFiscales, InventarioStockVenta y MovimientosInventario corresponde únicamente a aquella captura; el inventario vigente está documentado en el addendum actual.

Para NATIVE Wix no devuelve ownerAppId: son colecciones CMS propias del proyecto. Para WIX_APP se conserva el identificador literal devuelto por Wix; SiteMembers es un valor simbólico y en Locations/Locations el propietario no viene informado. La atribución por prefijo es funcional y no sustituye el owner ID.

## 3. Esquema físico histórico — corte anterior, no aplicable al sitio actual

`key` identifica el campo CMS. El ID canónico de colección y `ownerAppId` identifican el recurso y la aplicación propietaria. Las referencias se muestran solo cuando Wix declara REFERENCE/MULTI_REFERENCE. Los campos TEXT terminados en Id no se consideran referencias tipadas sin evidencia adicional.

Cuando existe `description`, se copia el texto Wix. Cuando no existe, se declara que la descripción funcional no está configurada en CMS; la etiqueta Wix se mantiene en columna separada. No se inventan definiciones de negocio. La subestructura OBJECT/ARRAY resume los metadatos anidados que devolvió Wix. Los enums del proyecto se identifican con su fuente y no implican validación CMS automática.

### Blog/Categories — Categories

- Origen: **Wix Blog** · Tipo `WIX_APP` · ID canónico de colección `Blog/Categories` · ownerAppId=`14bcded7-0066-7c35-14d7-466cb3f09103`.
- Revisión: `4` · Campos: **11** · Campo de presentación: `slug`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `postCount` | Post Count | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `fullCategoryPageUrl` | Category Page URL | `URL` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `posts` | Posts | `MULTI_REFERENCE → Blog/Posts` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | `Blog/Posts` | — | No declarado en esquema CMS |
| `description` | Description | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `label` | Label | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `translationId` | Translation ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `slug` | Slug | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `categoryPageUrl` | Category Page Slug | `URL` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `coverImage` | Cover Image | `IMAGE` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `language` | Language | `LANGUAGE` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

### Blog/Posts — Posts

- Origen: **Wix Blog** · Tipo `WIX_APP` · ID canónico de colección `Blog/Posts` · ownerAppId=`14bcded7-0066-7c35-14d7-466cb3f09103`.
- Revisión: `0` · Campos: **27** · Campo de presentación: `slug`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `author` | Author | `REFERENCE → Members/PublicData` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | `Members/PublicData` | — | No declarado en esquema CMS |
| `mainCategory` | Main Category | `REFERENCE → Blog/Categories` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | `Blog/Categories` | — | No declarado en esquema CMS |
| `viewCount` | View Count | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `excerpt` | Excerpt | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `timeToRead` | Time To Read | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `tags` | Tags | `MULTI_REFERENCE → Blog/Tags` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | `Blog/Tags` | — | No declarado en esquema CMS |
| `uuid` | UUID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `featured` | Featured | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `translationId` | Translation ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `slug` | Slug | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `coverImage` | Cover Image | `IMAGE` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `plainContent` | Plain Content | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `commentCount` | Comment Count | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `language` | Language | `LANGUAGE` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `publishedDate` | Published Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `pinned` | Pinned | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `categories` | Categories | `MULTI_REFERENCE → Blog/Categories` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | `Blog/Categories` | — | No declarado en esquema CMS |
| `richContent` | Rich Content | `RICH_CONTENT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `postPageUrl` | Post Page URL | `PAGE_LINK` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `coverImageDisplayed` | Cover Image Displayed | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `title` | Title | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `lastPublishedDate` | Last Published Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `internalId` | Internal ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `relatedPosts` | Related Posts | `MULTI_REFERENCE → Blog/Posts` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | `Blog/Posts` | — | No declarado en esquema CMS |
| `hashtags` | Hashtags | `ARRAY_STRING` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `likeCount` | Like Count | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

### Blog/Tags — Tags

- Origen: **Wix Blog** · Tipo `WIX_APP` · ID canónico de colección `Blog/Tags` · ownerAppId=`14bcded7-0066-7c35-14d7-466cb3f09103`.
- Revisión: `0` · Campos: **7** · Campo de presentación: `slug`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `postCount` | Post Count | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `posts` | Posts | `MULTI_REFERENCE → Blog/Posts` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | `Blog/Posts` | — | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `label` | Label | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `slug` | Slug | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `tagPageUrl` | Tag Page URL | `URL` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `language` | Language | `LANGUAGE` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

### Bookings/Schedule — Schedule

- Origen: **Wix Bookings** · Tipo `WIX_APP` · ID canónico de colección `Bookings/Schedule` · ownerAppId=`13d21c63-b5ec-5912-8397-c3a5ddb27a97`.
- Revisión: `0` · Campos: **5** · Campo de presentación: `_id`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `service` | Service | `REFERENCE → Bookings/Services` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | `Bookings/Services` | — | No declarado en esquema CMS |
| `serviceDurationInMinutes` | Service Duration in Minutes | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `serviceSchedule` | Service Schedule | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `repeatsEveryXWeeks` | Repeats Every X Weeks | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

### Bookings/Services — Services

- Origen: **Wix Bookings** · Tipo `WIX_APP` · ID canónico de colección `Bookings/Services` · ownerAppId=`13d21c63-b5ec-5912-8397-c3a5ddb27a97`.
- Revisión: `5` · Campos: **20** · Campo de presentación: `serviceName`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `serviceType` | Service Type | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `servicePageUrl` | Service Page URL | `PAGE_LINK` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `description` | Service Description | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_id` | Service ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `serviceName` | Service Name | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `priceAmount` | Price Amount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `tagLine` | Service Tagline | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `maxNumberOfParticipantsPerReservation` | Max Number Of Participants Per Reservation | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `paymentType` | Payment Type | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `slug` | Slug | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `partOfPricingPlan` | Part Of Pricing Plan | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `priceSummary` | Price Summary | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `depositAmount` | Deposit Amount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `requiresApproval` | Requires Approval | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `currency` | Currency | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `maxSessionCapacity` | Max Session Capacity | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `bookingsFlowEntryUrl` | Booking Flow Entry URL | `PAGE_LINK` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `form` | Form Fields | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `imageURL` | Service Image | `IMAGE` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `link-services-all` | link-services-all | `PAGE_LINK` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

### Bookings/Staff — Staff

- Origen: **Wix Bookings** · Tipo `WIX_APP` · ID canónico de colección `Bookings/Staff` · ownerAppId=`13d21c63-b5ec-5912-8397-c3a5ddb27a97`.
- Revisión: `0` · Campos: **3** · Campo de presentación: `name`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `_id` | Staff ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `name` | Staff Name | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `image` | Staff Image | `IMAGE` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

### CajaActual — CAJA_ACTUAL

- Origen: **CMS propio del proyecto** · Tipo `NATIVE` · ID canónico de colección `CajaActual` · ownerAppId=`no informado`.
- Revisión: `13` · Campos: **80** · Campo de presentación: `singletonKey`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `singletonKey` | singletonKey | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `closedAt` | closedAt | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `closedBy` | closedBy | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `cierreZReference` | cierreZReference | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `openedAt` | openedAt | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `openedBy` | openedBy | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `operationDateHour` | operationDateHour | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `cashRegisterStatus` | cashRegisterStatus | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | CASH_REGISTER_STATUS: ABIERTA, CERRADA |
| `openingCashAmount` | openingCashAmount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `openingCardAmount` | openingCardAmount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `openingBizumAmount` | openingBizumAmount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `openingOtherAmount` | openingOtherAmount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `cashAmount` | cashAmount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `cardAmount` | cardAmount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `bizumAmount` | bizumAmount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `otherAmount` | otherAmount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `cashMovementId` | cashMovementId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `lastMovementAt` | lastMovementAt | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `snapshotSource` | snapshotSource | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `salesCount` | salesCount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `expectedCash` | expectedCash | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `countedCash` | countedCash | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `difference` | difference | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `differenceReason` | differenceReason | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `sequenceCounters` | sequenceCounters | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `ticketSequence` | ticketSequence | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `lastOperationId` | lastOperationId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `lastOperationType` | lastOperationType | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | MOVEMENT_TYPE: VENTA, VENTA_ONLINE, ANTICIPO, REEMBOLSO, DEVOLUCION, DEVOLUCION_SERVICIO, PROPINA, AJUSTE |
| `lastOperationAmount` | lastOperationAmount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `lastOperationPaymentMethod` | lastOperationPaymentMethod | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | PAYMENT_METHOD: EFECTIVO, TARJETA, BIZUM, TRANSFERENCIA, WIX_PAYMENTS |
| `lastOperationAt` | lastOperationAt | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `lastOperationStatus` | lastOperationStatus | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `traceId` | traceId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `posIntegrationStatus` | posIntegrationStatus | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `ticketSyncStatus` | ticketSyncStatus | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `orderId` | orderId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `checkoutId` | checkoutId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `paymentId` | paymentId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `transactionId` | transactionId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `paymentReference` | paymentReference | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `paymentStatus` | paymentStatus | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `paymentMethod` | paymentMethod | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | PAYMENT_METHOD: EFECTIVO, TARJETA, BIZUM, TRANSFERENCIA, WIX_PAYMENTS |
| `paymentBreakdown` | paymentBreakdown | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `amountReceived` | amountReceived | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `changeReturned` | changeReturned | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `posPaymentStatus` | posPaymentStatus | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `posPaymentMethod` | posPaymentMethod | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `posPaymentProvider` | posPaymentProvider | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `posAmount` | posAmount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `posCurrency` | posCurrency | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `posPaidAt` | posPaidAt | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `ticketNumber` | ticketNumber | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `ticketIssuedAt` | ticketIssuedAt | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `ticketType` | ticketType | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `ticketSeries` | ticketSeries | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `lineItems` | lineItems | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `conceptOperations` | conceptOperations | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `conceptQuantities` | conceptQuantities | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `customerName` | customerName | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `customerTaxId` | customerTaxId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `customerAddress` | customerAddress | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `netPrice` | netPrice | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `discountAmount` | discountAmount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `roundingAmount` | roundingAmount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `taxableBaseTotal` | taxableBaseTotal | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `appliedTax` | appliedTax | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `taxTotal` | taxTotal | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `ticketTotal` | ticketTotal | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `fiscalText` | fiscalText | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `verifactuReference` | verifactuReference | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `verificationQr` | verificationQr | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `ticketXControlReference` | ticketXControlReference | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `contactId` | contactId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `catalogItemId` | catalogItemId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `serviceId` | serviceId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `bookingId` | bookingId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_createdDate` | Created Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_updatedDate` | Updated Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_owner` | Owner | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

### CampaignManager/campaigns — Campaign Manager

- Origen: **Wix Campaign Manager** · Tipo `WIX_APP` · ID canónico de colección `CampaignManager/campaigns` · ownerAppId=`7fdf5576-9d52-4c0a-9840-6e226f2ec415`.
- Revisión: `0` · Campos: **32** · Campo de presentación: `campaignType`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `campaignType` | Campaign type | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `promotionUiType` | Promotion UI type | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `triggerType` | Trigger type | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `frequencyType` | Frequency type | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `campaignStatus` | Status | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `timeOnPage` | Time on page | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `scrollOnPage` | Scroll on page | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `countOfPages` | Count of pages | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `campaignDateStart` | Campaign Date Start | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `campaignDateEnd` | Campaign Date End | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `campaignName` | Campaign name | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `offeringType` | Offering type | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `offeringId` | Selected offering Id | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `offeringPageId` | Offering Page offering Id | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `offeringItemId` | Offering Page item Id | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `offeringPageUrl` | Offering Page Url | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `offeringItemUrl` | Offering Item Url | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `offeringData` | Offering Data | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | name:TEXT, startTime:NUMBER, expirationTime:NUMBER, isCoupon:BOOLEAN, code:TEXT, couponMetadata:OBJECT, id:TEXT, couponDiscountType:TEXT, offer:TEXT | No declarado en esquema CMS |
| `timeOnPageTargetPagesIds` | TimeOn PagesIds | `ARRAY_STRING` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `connectedWidgets` | Connected Widgets | `ANY` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `scrollOnPageTargetPagesIds` | ScrollOn PagesIds | `ARRAY_STRING` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `isAutomaticDiscounts` | Is Automatic Discounts | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `isFloatingTeaser` | Floating Teaser on | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `campaignState` | Campaign State | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `mainStateData` | Main State Data | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | campaignTitle:TEXT, campaignHeading:TEXT, campaignSubtitle:TEXT, campaignDisclaimer:TEXT | No declarado en esquema CMS |
| `successStateData` | Success State Data | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | campaignTitle:TEXT, campaignHeading:TEXT, campaignSubtitle:TEXT, campaignDisclaimer:TEXT | No declarado en esquema CMS |
| `campaignImage` | Image | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | name:TEXT, url:TEXT, id:TEXT, photoMetadata:OBJECT, title:TEXT | No declarado en esquema CMS |
| `campaignLogo` | Logo | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | name:TEXT, url:TEXT, id:TEXT, photoMetadata:OBJECT, title:TEXT | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_createdDate` | Created Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_updatedDate` | Updated Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_owner` | Owner | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

### CampaignManager/userConfig — User Config

- Origen: **Wix Campaign Manager** · Tipo `WIX_APP` · ID canónico de colección `CampaignManager/userConfig` · ownerAppId=`7fdf5576-9d52-4c0a-9840-6e226f2ec415`.
- Revisión: `0` · Campos: **5** · Campo de presentación: `addWidget`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `addWidget` | Add Widget | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | widgetType:TEXT, isAddWidget:BOOLEAN | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_createdDate` | Created Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_updatedDate` | Updated Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_owner` | Owner | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

### CitasF2 — CITAS_F2

- Origen: **CMS propio del proyecto** · Tipo `NATIVE` · ID canónico de colección `CitasF2` · ownerAppId=`no informado`.
- Revisión: `44` · Campos: **31** · Campo de presentación: `bookingId`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `slotStart` | slotStart | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `orderId` | orderId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `timeZone` | timeZone | `TEXT` | Zona horaria usada para interpretar fechas y horas de la reserva. | No declarado | — | — | No declarado en esquema CMS |
| `cancellationReason` | cancellationReason | `TEXT` | Motivo de cancelación, cuando se registre. | No declarado | — | — | No declarado en esquema CMS |
| `privacyNoticePurpose` | privacyNoticePurpose | `TEXT` | Finalidad de tratamiento informada en el contexto de la reserva. | No declarado | — | — | No declarado en esquema CMS |
| `privacyNoticeAcceptedAt` | privacyNoticeAcceptedAt | `DATETIME` | Fecha y hora de constancia de información de privacidad para la reserva; no sustituye consentimientos opcionales. | No declarado | — | — | No declarado en esquema CMS |
| `privacyNoticeVersion` | privacyNoticeVersion | `TEXT` | Versión del aviso de privacidad mostrado para la reserva. | No declarado | — | — | No declarado en esquema CMS |
| `totalAmount` | totalAmount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `slotEnd` | slotEnd | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `bookingId` | bookingId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `traceId` | traceId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `bookingType` | bookingType | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | BOOKING_TYPE: SIMPLE, DUAL_F1, DUAL_F2 |
| `bookingStatus` | bookingStatus | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | CITAS_BOOKING_STATUS: PENDING, CONFIRMED, COMPLETED, CANCELED, REFUNDED, NO_SHOW |
| `paymentStatus` | paymentStatus | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | CITAS_PAYMENT_STATUS: NOT_PAID, PENDING_PAYMENT, PENDING_LEDGER, PAID, PARTIALLY_PAID, REFUNDED, PARTIALLY_REFUNDED, EXEMPT, UNDEFINED |
| `serviceId` | serviceId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `resourceId` | resourceId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `pairToken` | pairToken | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `dateYmd` | dateYmd | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `scheduleId` | scheduleId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `contactDetails` | contactDetails | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `thirdPartyId` | thirdPartyId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `catalogId` | catalogId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `cashMovementId` | cashMovementId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `fiscalData` | fiscalData | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `invoicingDate` | invoicingDate | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `revision` | revision | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `meta` | meta | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_createdDate` | Created Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_updatedDate` | Updated Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_owner` | Owner | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

### ComplementosCatalogo — COMPLEMENTOS_CATALOGO

- Origen: **CMS propio del proyecto** · Tipo `NATIVE` · ID canónico de colección `ComplementosCatalogo` · ownerAppId=`no informado`.
- Revisión: `141` · Campos: **18** · Campo de presentación: `name`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `sku` | sku | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `taxIncluded` | taxIncluded | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `durationMinutes` | durationMinutes | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `tipoImpositivo` | tipoImpositivo | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `addonId` | addonId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `traceId` | traceId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `name` | name | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `description` | description | `RICH_TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_owner` | Owner | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `price` | price | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `itemNature` | itemNature | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `codigoImpuesto` | codigoImpuesto | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_updatedDate` | Updated Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_createdDate` | Created Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `claveRegimen` | claveRegimen | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `cuentaContableIngreso` | cuentaContableIngreso | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `ServiciosCatalogo_name` | ServiciosCatalogo_name | `MULTI_REFERENCE → ServiciosCatalogo` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | `ServiciosCatalogo` | — | No declarado en esquema CMS |

### ControlOperativo — CONTROL_OPERATIVO

- Origen: **CMS propio del proyecto** · Tipo `NATIVE` · ID canónico de colección `ControlOperativo` · ownerAppId=`no informado`.
- Revisión: `39` · Campos: **42** · Campo de presentación: `controlType`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `eventType` | Event Type | `TEXT` | Canonical Wix Bookings or eCommerce event type. Duplicates payload.eventType for indexed operational queries. | No declarado | — | — | No declarado en esquema CMS |
| `occurredAt` | Occurred At | `DATETIME` | Source event occurrence timestamp. Distinct from _createdDate and payload.processedAt. | No declarado | — | — | No declarado en esquema CMS |
| `controlType` | controlType | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | CONTROL_TYPE: ALERT, COMPENSATION, DAYS_CACHE, DISPLAY_TOKEN, DUAL_CACHE, DEDUPE_KEY, LEDGER_IDEMPOTENCY, IDEMPOTENCY, SLOT_LOCK, RATE_LIMIT, SYSTEM_FLAG, WEBHOOK_CLAIM, WEBHOOK_EVENT |
| `dedupeKey` | dedupeKey | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `traceId` | traceId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `status` | status | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `eventId` | eventId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `expiresAt` | expiresAt | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `bookingId` | bookingId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `pairToken` | pairToken | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `resourceId` | resourceId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `serviceId` | serviceId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `slotStart` | slotStart | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `slotEnd` | slotEnd | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `dateYmd` | dateYmd | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `transactionId` | transactionId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `orderId` | orderId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `refundId` | refundId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `kind` | kind | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `attempts` | attempts | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `maxAttempts` | maxAttempts | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `lastError` | lastError | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `totalAmount` | totalAmount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `operationDescription` | operationDescription | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `severity` | severity | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `alertType` | alertType | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `message` | message | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `surface` | surface | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `requesterKey` | requesterKey | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `requestCount` | requestCount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `windowStart` | windowStart | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `payload` | payload | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `version` | version | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `processedAt` | processedAt | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_createdDate` | Created Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_updatedDate` | Updated Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_owner` | Owner | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `heartbeatAt` | heartbeatAt | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `operationDate` | Operationdate | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `revision` | revision | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `compensationKind` | compensationKind | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

#### Aplicabilidad de campos por `controlType` — revisión del CSV sintético (2026-11-14)

Este inventario de 42 campos es el contrato físico de referencia del repositorio. La exportación CSV aportada contiene además encabezados que no pertenecen a este esquema. No se deben recrear campos CMS por el mero hecho de aparecer en una exportación.

**Convención de celdas vacías**

- `N/A` es una anotación de auditoría/exportación: significa que el campo no aplica a ese tipo de control.
- En Wix CMS se conserva el campo ausente o `null` según el contrato del writer. Nunca se escribe el texto `N/A` en un campo `DATETIME`, `NUMBER` u `OBJECT`, ni se usa como sustituto de un dato.
- Un campo aplicable que debería tener valor y está vacío es un defecto de persistencia, no un N/A.
- No se añaden valores ficticios para completar visualmente una fila.

**Campos comunes**

| Campo | Regla |
|---|---|
| `controlType` | Obligatorio; discriminador del registro. |
| `dedupeKey` | Obligatorio; identidad idempotente/determinista del control. |
| `traceId` | Obligatorio; correlación y, en `WEBHOOK_CLAIM`, token canónico de fencing CAS. |
| `payload` | Contenedor estructurado de datos específicos; no sustituye los campos superiores expresamente definidos para consulta/indexación. |

**Matriz para los tipos presentes en el CSV**

| controlType | Campos superiores aplicables | Vacíos intencionados / N/A en exportación |
|---|---|---|
| `IDEMPOTENCY` | `pairToken`, `serviceId`, `expiresAt`, `heartbeatAt`, `attempts`, `payload`; `bookingId` cuando la operación ya identifica una reserva. | `operationDate`, `slotStart`, `slotEnd`, `resourceId` superior cuando el resultado vive en `payload.result` y puede representar una reserva dual; campos de rate limit, webhook y alertas. |
| `RATE_LIMIT` | `requesterKey`, `surface`, `requestCount`, `windowStart`, `version`, `status`, `expiresAt`, `payload`. | `bookingId`, `resourceId`, `serviceId`, `slotStart`, `slotEnd`, `eventId`, `eventType`, `processedAt`, campos fiscales/compensación. `retryAfter` y `nextRetryAt` no pertenecen al esquema. |
| `DAYS_CACHE` | `serviceId`, `dateYmd` (clave de mes `YYYY-MM`), `expiresAt`, `payload`. | `resourceId` superior: la clave representa un conjunto/hash de recursos; la ubicación y el rango se conservan en `payload`. También son N/A los campos de transacción, rate limit, webhook y alertas. |
| `WEBHOOK_CLAIM` | `eventId`, `eventType`, `status`, `traceId`, `version`, `attempts`, `expiresAt`, `payload`. `serviceId` es condicional si el productor lo conoce y el contrato del evento lo requiere. | `ownerToken`, `attempt` y `leaseExpiresAt` son nombres retirados/no canónicos; no se escriben. `slotStart`, `slotEnd`, `operationDate`, importes y campos de rate limit son N/A. |
| `WEBHOOK_EVENT` | `eventId`, `eventType`, `status`, `traceId`, `expiresAt`, `processedAt`, `payload`; `serviceId` solo si metadata aporta un GUID válido. `eventType` y `processedAt` se duplican en `payload` para consulta indexada y trazabilidad. | `bookingId`, `resourceId`, `slotStart`, `slotEnd`, `operationDate`, campos de rate limit y de transacción salvo que un contrato específico los incorpore. |
| `SLOT_LOCK` de reserva | `resourceId`, `serviceId`, `slotStart`, `slotEnd`, `expiresAt`, `heartbeatAt`, `version`, `payload`. Los instantes se derivan de los minutos epoch codificados en `dedupeKey`. | Campos de webhook, rate limit, transacción y alertas. En locks fiscales/contables (también `SLOT_LOCK`), `slotStart` y `slotEnd` son N/A porque no bloquean una cita concreta. |

**Discrepancias del CSV y tratamiento**

- `ownerToken`, `retryAfter` y `nextRetryAt` no están entre los 42 campos del inventario CMS. `ownerToken` se sustituye por el campo canónico `traceId` para fencing; los otros dos no se persisten.
- `attempt` y `leaseExpiresAt` no son campos canónicos. Los intentos se guardan en `attempts` y el lease en `expiresAt`.
- En las filas `WEBHOOK_EVENT`, el CSV deja vacío el campo superior `eventType` aunque existe `payload.eventType`. El writer debe duplicar `eventType` arriba; también persistirá `processedAt` como `DATETIME` superior, manteniendo la copia ISO en payload.
- En las filas de `SLOT_LOCK` de reserva, `slotStart` y `slotEnd` se pueden recuperar de forma exacta desde la clave determinista. El writer debe persistirlos como `DATETIME`; no deben quedar vacíos.
- En las transacciones `IDEMPOTENCY`, `pairToken` es campo superior y coincide con la identidad del control; debe persistirse explícitamente.
- El valor `1970-01-01T00:00:00Z` en un `SLOT_LOCK` liberado es el sentinel terminal observado en el CSV; no se reemplaza por N/A ni por la fecha actual.

**Límite de alcance:** esta matriz cubre los seis tipos que aparecen en el CSV sintético. No define la aplicabilidad de `ALERT`, `COMPENSATION`, `DISPLAY_TOKEN`, `DUAL_CACHE`, `DEDUPE_KEY`, `LEDGER_IDEMPOTENCY` ni `SYSTEM_FLAG` sin revisar sus writers y consumidores.

### eCommerce/Orders — Orders

- Origen: **Wix Stores / eCommerce** · Tipo `WIX_APP` · ID canónico de colección `eCommerce/Orders` · ownerAppId=`1380b703-ce81-ff05-f115-39571d94dfcd`.
- Revisión: `0` · Campos: **45** · Campo de presentación: `_id`.
- Permisos: `read=ADMIN, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `number` | Number | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `payAfterFreeTrial` | Pay After Free Trial | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | totalAdditionalFees:OBJECT, tax:OBJECT, total:OBJECT, subtotal:OBJECT, discount:OBJECT, shipping:OBJECT | No declarado en esquema CMS |
| `additionalFees` | Additional Fees | `ARRAY` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | Elemento OBJECT | No declarado en esquema CMS |
| `demo` | Demo | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `extendedFields` | Extended Fields | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | namespaces:OBJECT | No declarado en esquema CMS |
| `recipientInfo` | Recipient Info | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | address:ADDRESS, contactDetails:OBJECT | No declarado en esquema CMS |
| `purchaseFlowId` | Purchase Flow ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `currencyConversionDetails` | Currency Conversion Details | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | originalCurrency:TEXT, conversionRate:TEXT | No declarado en esquema CMS |
| `platformFeeSummary` | Platform Fee Summary | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | total:OBJECT, totalPassOn:OBJECT, totalAbsorbed:OBJECT, fees:ARRAY | No declarado en esquema CMS |
| `lineItems` | Line Items | `ARRAY` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | Elemento OBJECT | No declarado en esquema CMS |
| `paymentStatus` | Payment Status | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `siteLanguage` | Site Language | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `archived` | Archived | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `seenByAHuman` | Seen By A Human | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_createdDate` | Created Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `tags` | Tags | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | privateTags:OBJECT, tags:OBJECT | No declarado en esquema CMS |
| `shippingInfo` | Shipping Info | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | code:TEXT, cost:OBJECT, logistics:OBJECT, carrierId:TEXT, region:OBJECT, title:TEXT | No declarado en esquema CMS |
| `activities` | Activities | `ARRAY` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | Elemento OBJECT | No declarado en esquema CMS |
| `appliedDiscounts` | Applied Discounts | `ARRAY` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | Elemento OBJECT | No declarado en esquema CMS |
| `customFields` | Custom Fields | `ARRAY` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | Elemento OBJECT | No declarado en esquema CMS |
| `taxIncludedInPrices` | Tax Included In Prices | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `businessLocation` | Business Location | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | id:TEXT, name:TEXT | No declarado en esquema CMS |
| `_updatedDate` | Updated Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `attributionSource` | Attribution Source | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `weightUnit` | Weight Unit | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `priceSummary` | Price Summary | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | totalAdditionalFees:OBJECT, tax:OBJECT, total:OBJECT, subtotal:OBJECT, discount:OBJECT, shipping:OBJECT | No declarado en esquema CMS |
| `buyerNote` | Buyer Note | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `imported` | Imported | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `status` | Status | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `billingInfo` | Billing Info | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | address:ADDRESS, contactDetails:OBJECT | No declarado en esquema CMS |
| `buyerInfo` | Buyer Info | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | visitorId:TEXT, memberId:TEXT, contactId:TEXT, email:TEXT | No declarado en esquema CMS |
| `forms` | Forms | `ARRAY` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | Elemento OBJECT | No declarado en esquema CMS |
| `purchasedDate` | Purchased Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `createdBy` | Created By | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | userId:TEXT, memberId:TEXT, visitorId:TEXT, appId:TEXT | No declarado en esquema CMS |
| `taxSummary` | Tax Summary | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | totalTax:OBJECT | No declarado en esquema CMS |
| `currency` | Currency | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `balanceSummary` | Balance Summary | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | platformFees:OBJECT, chargebackReversal:OBJECT, refunded:OBJECT, authorized:OBJECT, balance:OBJECT, cashRoundingAdjustment:OBJECT, paid:OBJECT, totalMinusPlatformFees:OBJECT, chargeback:OBJECT, pending:OBJECT, pendingRefund:OBJECT | No declarado en esquema CMS |
| `deposit` | Deposit | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | totalAdditionalFees:OBJECT, tax:OBJECT, total:OBJECT, subtotal:OBJECT, discount:OBJECT, shipping:OBJECT | No declarado en esquema CMS |
| `checkoutId` | Checkout ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `buyerLanguage` | Buyer Language | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `channelInfo` | Channel Info | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | type:TEXT, externalOrderId:TEXT, externalOrderUrl:TEXT | No declarado en esquema CMS |
| `taxInfo` | Tax Info | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | totalTax:OBJECT, taxBreakdown:ARRAY, taxExempt:BOOLEAN, totalExempt:OBJECT | No declarado en esquema CMS |
| `settings` | Settings | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | editableByEveryone:BOOLEAN, specificItemsCouponBehavior:TEXT, editableByOwnerApps:OBJECT, standardActions:BOOLEAN, limitedActions:BOOLEAN, customActions:OBJECT, createInvoice:BOOLEAN | No declarado en esquema CMS |
| `fulfillmentStatus` | Fulfillment Status | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

### Forms/subscribers03 — Subscriptions

- Origen: **Wix Forms** · Tipo `WIX_APP` · ID canónico de colección `Forms/subscribers03` · ownerAppId=`14ce1214-b278-a7e4-1373-00cebd1bef7c`.
- Revisión: `0` · Campos: **6** · Campo de presentación: `submissionTime`.
- Permisos: `read=ADMIN, insert=ANYONE, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `submissionTime` | Horario de envío | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `email` | Email | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_createdDate` | Created Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_updatedDate` | Updated Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_owner` | Owner | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

### HistoricoCierresZ — HISTORICO_CIERRES_Z

- Origen: **CMS propio del proyecto** · Tipo `NATIVE` · ID canónico de colección `HistoricoCierresZ` · ownerAppId=`no informado`.
- Revisión: `39` · Campos: **62** · Campo de presentación: `recordDomain`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `totalTips` | totalTips | `NUMBER` | Importe total de propinas incluidas en el cierre. | No declarado | — | — | No declarado en esquema CMS |
| `snapshotJSON` | snapshotJSON | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `closedAt` | closedAt | `DATETIME` | Instante exacto de cierre. | No declarado | — | — | No declarado en esquema CMS |
| `timeZone` | timeZone | `TEXT` | Zona horaria utilizada para delimitar el día operativo. | No declarado | — | — | No declarado en esquema CMS |
| `closingSchemaVersion` | closingSchemaVersion | `TEXT` | Versión de esquema usada al generar el cierre. | No declarado | — | — | No declarado en esquema CMS |
| `closingSource` | closingSource | `TEXT` | Origen del cierre: MANUAL o CRON. | No declarado | — | — | Descripción CMS: MANUAL, CRON |
| `auditedRecordsCount` | auditedRecordsCount | `NUMBER` | Número de registros comprobados por la auditoría del cierre. | No declarado | — | — | No declarado en esquema CMS |
| `taxTypeBreakdown` | taxTypeBreakdown | `OBJECT` | Desglose fiscal por tipo impositivo. | No declarado | — | — | No declarado en esquema CMS |
| `movementTypeBreakdown` | movementTypeBreakdown | `OBJECT` | Desglose del importe por tipo de movimiento. | No declarado | — | — | No declarado en esquema CMS |
| `endTicketNumber` | endTicketNumber | `TEXT` | Número de factura/ticket del último movimiento incluido. | No declarado | — | — | No declarado en esquema CMS |
| `startTicketNumber` | startTicketNumber | `TEXT` | Número de factura/ticket del primer movimiento incluido. | No declarado | — | — | No declarado en esquema CMS |
| `totalOperations` | totalOperations | `NUMBER` | Número de movimientos auditados en el cierre. | No declarado | — | — | No declarado en esquema CMS |
| `totalAdjustments` | totalAdjustments | `NUMBER` | Importe neto de ajustes incluidos en el cierre. | No declarado | — | — | No declarado en esquema CMS |
| `closeDate` | closeDate | `DATE` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `totalRefunds` | totalRefunds | `NUMBER` | Importe total de reembolsos incluidos en el cierre. | No declarado | — | — | No declarado en esquema CMS |
| `fiscalPeriod` | fiscalPeriod | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `totalTaxAmount` | totalTaxAmount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `totalTaxBase` | totalTaxBase | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `totalOnline` | totalOnline | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `totalBizum` | totalBizum | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `totalCard` | totalCard | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `totalCash` | totalCash | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `closedBy` | closedBy | `TEXT` | FK → MapaStaff.resourceId. | Sí | — | — | No declarado en esquema CMS |
| `recordDomain` | recordDomain | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `closingStatus` | closingStatus | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `operationDate` | operationDate | `DATE` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `consolidatedTotalAmount` | consolidatedTotalAmount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `grossSalesTotal` | grossSalesTotal | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `netTaxableAmount` | netTaxableAmount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `netTaxAmount` | netTaxAmount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `totalesMedioPago` | totalesMedioPago | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `startSequence` | startSequence | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `endSequence` | endSequence | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `startRecordHash` | startRecordHash | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `endRecordHash` | endRecordHash | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `isIntegrityVerified` | isIntegrityVerified | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `closingHash` | closingHash | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `closingSignature` | closingSignature | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `closingSignatureStatus` | closingSignatureStatus | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `verifiedAt` | verifiedAt | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `approverUser` | approverUser | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `estadoEnvioAEAT` | estadoEnvioAEAT | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `traceId` | traceId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `inventoryClosingId` | inventoryClosingId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `fiscalYear` | fiscalYear | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `closingType` | closingType | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `sku` | sku | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `wixProductId` | wixProductId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `stockQuantity` | stockQuantity | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `unitCost` | unitCost | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `stockValue` | stockValue | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `cuentaContable` | cuentaContable | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `summaryData` | summaryData | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `invoiceData` | invoiceData | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `packageStatus` | packageStatus | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `packageVersion` | packageVersion | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `sentTo` | sentTo | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `sentAt` | sentAt | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_createdDate` | Created Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_updatedDate` | Updated Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_owner` | Owner | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

### LibroAsientosContablesDetalle — LIBRO_ASIENTOS_CONTABLES_DETALLE

- Origen: **CMS propio del proyecto** · Tipo `NATIVE` · ID canónico de colección `LibroAsientosContablesDetalle` · ownerAppId=`no informado`.
- Revisión: `29` · Campos: **27** · Campo de presentación: `origenTipo`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `desgloseDetallado` | desgloseDetallado | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `entryId` | entryId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `recordTimestamp` | recordTimestamp | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `cashMovementId` | cashMovementId | `TEXT` | FK → MovimientosCaja. | No | — | — | No declarado en esquema CMS |
| `concept` | concept | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `lineNumber` | lineNumber | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `origenTipo` | origenTipo | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `origenRegistro` | origenRegistro | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `sourceMovementId` | sourceMovementId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `entryDate` | entryDate | `DATE` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `fiscalPeriod` | fiscalPeriod | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `accountCode` | accountCode | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `debitAmount` | debitAmount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `creditAmount` | creditAmount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `accountingAmount` | accountingAmount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `payloadFiscal` | payloadFiscal | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `recordHash` | recordHash | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `previousRecordHash` | previousRecordHash | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `idSistemaInformatico` | idSistemaInformatico | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `bookingId` | bookingId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `orderId` | orderId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `resourceId` | resourceId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `traceId` | traceId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_createdDate` | Created Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_updatedDate` | Updated Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_owner` | Owner | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

### Locations/Locations — Locations

- Origen: **Wix Locations** · Tipo `WIX_APP` · ID canónico de colección `Locations/Locations` · ownerAppId=`no informado`.
- Revisión: `6` · Campos: **17** · Campo de presentación: `name`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `businessSchedule` | Business Schedule | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | periods:ARRAY, specialHourPeriod:ARRAY | No declarado en esquema CMS |
| `name` | Name | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `extendedFields` | Extended Fields | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | namespaces:OBJECT | No declarado en esquema CMS |
| `email` | Email | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `description` | Description | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `archived` | Archived | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `revision` | Revision | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `fax` | Fax | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `status` | Status | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `default` | Default | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `locationTypes` | Location Types | `ARRAY_STRING` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `address` | Address | `ADDRESS` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `locationType` | Location Type | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `timeZone` | Time Zone | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `phone` | Phone | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `services` | services | `MULTI_REFERENCE → ServiciosCatalogo` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | `ServiciosCatalogo` | — | No declarado en esquema CMS |

### MapaStaff — MAPA_STAFF

- Origen: **CMS propio del proyecto** · Tipo `NATIVE` · ID canónico de colección `MapaStaff` · ownerAppId=`no informado`.
- Revisión: `105` · Campos: **56** · Campo de presentación: `staffName`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `displayName` | displayName | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `phoneFiscal` | Teléfono fiscal | `TEXT` | Teléfono utilizado para asuntos fiscales | No declarado | — | — | No declarado en esquema CMS |
| `phoneTrabajo` | Teléfono de trabajo | `TEXT` | Teléfono operativo o profesional | No declarado | — | — | No declarado en esquema CMS |
| `phonePersonal` | Teléfono personal | `TEXT` | Teléfono personal de la identidad | No declarado | — | — | No declarado en esquema CMS |
| `emailFiscal` | Email fiscal | `EMAIL` | Correo electrónico utilizado para asuntos fiscales | No declarado | — | — | No declarado en esquema CMS |
| `emailTrabajo` | Email de trabajo | `EMAIL` | Correo electrónico operativo o profesional | No declarado | — | — | No declarado en esquema CMS |
| `emailPersonal` | Email personal | `EMAIL` | Correo electrónico personal de la identidad | No declarado | — | — | No declarado en esquema CMS |
| `notes` | Notas | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `verificationSource` | Fuente de verificación | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `sourceRecordId` | Identificador del registro de origen | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `sourceSystem` | Sistema de origen | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `consultativeSummary` | Resumen consultivo | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `operationalScope` | Ámbito operativo | `ARRAY_STRING` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `fiscalRole` | Rol fiscal | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `fiscalIdType` | Tipo de identificador fiscal | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `fiscalRegion` | Región fiscal | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `fiscalCountry` | País fiscal | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `contactAddress` | Dirección de contacto | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `legalEntityId` | Identificador de entidad legal | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `legalEntityType` | Tipo de entidad legal | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `isPrimaryIdentity` | Es identidad principal | `BOOLEAN` | Indica si es la identidad principal de su tipo | No declarado | — | — | No declarado en esquema CMS |
| `identityCode` | Código de identidad | `TEXT` | Código estable para consultar la identidad dentro del ecosistema | No declarado | — | — | No declarado en esquema CMS |
| `identityStatus` | Estado de identidad | `TEXT` | Estado consultivo de la identidad | No declarado | — | — | No declarado en esquema CMS |
| `identityType` | Tipo de identidad | `TEXT` | STAFF_MEMBER, BUSINESS_FISCAL_IDENTITY o ACCOUNTING_FIRM | No declarado | — | — | Descripción CMS: STAFF_MEMBER, BUSINESS_FISCAL_IDENTITY, ACCOUNTING_FIRM |
| `traceId` | Trace ID | `TEXT` | UUID v4 de trazabilidad de la última mutación relevante. | No declarado | — | — | No declarado en esquema CMS |
| `staffMemberId` | staffMemberId | `TEXT` | Canonical native Wix Bookings staff member ID; distinct from resourceId. | No declarado | — | — | No declarado en esquema CMS |
| `scheduleId` | scheduleId | `TEXT` | Native Wix Bookings schedule ID. | No declarado | — | — | No declarado en esquema CMS |
| `thirdPartyId` | thirdPartyId | `TEXT` | Optional DatosFiscales reference; remains empty until formally linked. | No declarado | — | — | No declarado en esquema CMS |
| `rolWebsite` | rolWebsite | `TEXT` | Canonical business authorization role: ADMIN, GESTION, or ESTILISTA. | No declarado | — | — | ROL_WEBSITE: ADMIN, GESTION, ESTILISTA |
| `rolBookings` | rolBookings | `TEXT` | Native Wix Bookings staff role; canonical value STAFF. | No declarado | — | — | Wix Bookings staff role: STAFF |
| `memberId` | memberId | `TEXT` | Canonical Wix site-member ID verified from Members API. | No declarado | — | — | No declarado en esquema CMS |
| `resourceId` | resourceId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `ServiciosCatalogo_staffMembers` | ServiciosCatalogo_staffMembers | `MULTI_REFERENCE → ServiciosCatalogo` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | `ServiciosCatalogo` | — | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_createdDate` | Created Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_updatedDate` | Updated Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_owner` | Owner | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `recordType` | Tipo de registro | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | RECORD_TYPE: STAFF, GESTORIA, TERCERO, CONFIG_SISTEMA |
| `fechaInicioVerifactu` | Fecha de inicio Veri*Factu | `DATE` | Fecha ISO YYYY-MM-DD desde la que el sistema opera con la configuración Veri*Factu activa. | No declarado | — | — | No declarado en esquema CMS |
| `schemaVersion` | Versión de esquema | `NUMBER` | Versión del esquema del registro para migraciones controladas. | No declarado | — | — | No declarado en esquema CMS |
| `province` | Provincia | `TEXT` | Provincia del domicilio fiscal. | No declarado | — | — | No declarado en esquema CMS |
| `postalCode` | Código postal | `TEXT` | Código postal del domicilio fiscal. | No declarado | — | — | No declarado en esquema CMS |
| `streetNumber` | Número fiscal | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `businessDescription` | Descripción del negocio | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `currency` | Moneda | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `phone` | Teléfono fiscal | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `taxId` | NIF / VAT | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `legalName` | Razón social / nombre legal | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `thirdPartyType` | Tipo de tercero | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | THIRD_PARTY_TYPE: CLIENTE, STAFF, PROVEEDOR, EMISOR |
| `address` | Domicilio fiscal | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `taxRegime` | Régimen fiscal | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `verifactuEnabled` | Veri*Factu habilitado | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `verifactuVersion` | Versión Veri*Factu | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `tipoUsoPosibleMultiOT` | Uso posible de múltiples OT | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `indicadorMultiplesOT` | Indicador de múltiples OT | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `email` | Email | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

### Marketing/Coupons — Coupons

- Origen: **Wix Marketing / Coupons** · Tipo `WIX_APP` · ID canónico de colección `Marketing/Coupons` · ownerAppId=`14d7032a-0a65-5270-cca7-30f599708fed`.
- Revisión: `0` · Campos: **23** · Campo de presentación: `name`.
- Permisos: `read=ADMIN, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `freeShipping` | Free Shipping | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `name` | Name | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `startTime` | Start Time | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `expirationTime` | Expiration Time | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `numberOfUsages` | Number Of Usages | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `limitedToOneItem` | Limited To One Item | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `expired` | Expired | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `percentOffRate` | Percent Off Rate | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `limitPerCustomer` | Limit Per Customer | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `scope` | Scope | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `buyXGetY` | Buy X Get Y | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `displayData` | Display Data | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `moneyOffAmount` | Money Off Amount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `usageLimit` | Usage Limit | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `minimumSubtotal` | Minimum Subtotal | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `code` | Code | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_dateCreated` | Date Created | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `fixedPriceAmount` | Fixed Price Amount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `appliesToSubscriptions` | Applies To Subscriptions | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `type` | Type | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `appId` | App Id | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `active` | Active | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

### Members/Badges — Badges

- Origen: **Wix Members** · Tipo `WIX_APP` · ID canónico de colección `Members/Badges` · ownerAppId=`SiteMembers`.
- Revisión: `0` · Campos: **11** · Campo de presentación: `title`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `backgroundColor` | Background Color | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `description` | Description | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_createdDate` | Created Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `icon` | Icon | `IMAGE` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `textColor` | Text Color | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_updatedDate` | Updated Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `slug` | Slug | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `roleId` | Role ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `members` | Members | `MULTI_REFERENCE → Members/FullData` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | `Members/FullData` | — | No declarado en esquema CMS |
| `title` | Title | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

### Members/FullData — FullData

- Origen: **Wix Members** · Tipo `WIX_APP` · ID canónico de colección `Members/FullData` · ownerAppId=`SiteMembers`.
- Revisión: `0` · Campos: **28** · Campo de presentación: `loginEmail`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `customfields_system_address` | Address | `ADDRESS` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `loginEmail` | Login Email | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `custom_servicios-favoritos-extras` | SERVICIOS FAVORITOS & EXTRAS | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `custom_formula-de-color` | FORMULA DE COLOR | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `custom_gustos-y-estilos` | GUSTOS Y ESTILOS | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `privacyStatus` | Privacy Status | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_createdDate` | Creation Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `custom_correo-electronico` | Correo electrónico | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `aboutPlain` | About (Plain Text) | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `custom_cumpleanos` | CUMPLEAÑOS | `DATE` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `profilePhoto` | Profile Photo | `IMAGE` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `custom_checkinid` | checkInId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `aboutRich` | About (Rich Text) | `RICH_CONTENT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_updatedDate` | Last Updated | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `slug` | Slug | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `lastName` | Last Name | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `firstName` | First Name | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `customfields_contact_birthdate` | Birthdate | `DATE` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `activityStatus` | Activity Status | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `lastLoginDate` | Last Login Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `status` | Status | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `contactId` | Contact Id | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `custom_alergias-med` | ALERGIAS & MED | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `coverPhoto` | Cover Photo | `IMAGE` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `custom_genero` | COMENTARIO: | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `phone` | Phone | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `nickname` | Nickname | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

### Members/PrivateMembersData — PrivateMembersData

- Origen: **Wix Members** · Tipo `WIX_APP` · ID canónico de colección `Members/PrivateMembersData` · ownerAppId=`SiteMembers`.
- Revisión: `4` · Campos: **15** · Campo de presentación: `loginEmail`.
- Permisos: `read=SITE_MEMBER_AUTHOR, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `name` | Name | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `lastLogin` | Last Login Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `loginEmail` | Login Email | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_createdDate` | Creation Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_updatedDate` | Last Updated | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `slug` | Slug | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `phones` | Phones | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `lastName` | Last Name | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `firstName` | First Name | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `mainPhone` | Main Phone | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `language` | Language | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `status` | Status | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `picture` | Picture | `IMAGE` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `nickname` | Nickname | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

### Members/PublicData — PublicData

- Origen: **Wix Members** · Tipo `WIX_APP` · ID canónico de colección `Members/PublicData` · ownerAppId=`SiteMembers`.
- Revisión: `0` · Campos: **12** · Campo de presentación: `nickname`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_createdDate` | Created Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `custom_correo-electronico` | Correo electrónico | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `aboutPlain` | About (Plain Text) | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `profilePhoto` | Profile Photo | `IMAGE` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `aboutRich` | About (Rich Text) | `RICH_CONTENT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_updatedDate` | Updated Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `slug` | Slug | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `customfields_system_firstname` | First Name | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `coverPhoto` | Cover Photo | `IMAGE` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `title` | Title | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `nickname` | Nickname | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

### MovimientosCaja — MOVIMIENTOS_CAJA

- Origen: **CMS propio del proyecto** · Tipo `NATIVE` · ID canónico de colección `MovimientosCaja` · ownerAppId=`no informado`.
- Revisión: `80` · Campos: **88** · Campo de presentación: `numSerieFactura`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `resourceId` | resourceId | `TEXT` | Recurso nativo asociado a la operación, si aplica. | No declarado | — | — | No declarado en esquema CMS |
| `payloadAEAT` | payloadAEAT | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `NIFEmisor` | NIFEmisor | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `NIFDestinatario` | NIFDestinatario | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `IRPFWithholdingRate` | IRPFWithholdingRate | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `IRPFWithholdingAmount` | IRPFWithholdingAmount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `baseImponibleOImporteNoSujeto` | baseImponibleOImporteNoSujeto | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `signatureAlgorithm` | signatureAlgorithm | `TEXT` | Algoritmo de firma usado por el firmador. | No declarado | — | — | No declarado en esquema CMS |
| `hashAlgorithm` | hashAlgorithm | `TEXT` | Algoritmo usado para la huella del registro. | No declarado | — | — | No declarado en esquema CMS |
| `verificationQR` | verificationQR | `TEXT` | URL o contenido del QR de verificación asociado a la factura. | No declarado | — | — | No declarado en esquema CMS |
| `digitalSignature` | digitalSignature | `TEXT` | Firma digital producida por el firmador configurado. | No declarado | — | — | No declarado en esquema CMS |
| `generationTimestamp` | generationTimestamp | `DATETIME` | Instante de generación del registro fiscal. | No declarado | — | — | No declarado en esquema CMS |
| `serviceIdRedeemed` | serviceIdRedeemed | `TEXT` | Servicio asociado al canje de tarjeta regalo, si aplica. | No declarado | — | — | No declarado en esquema CMS |
| `giftCardOperation` | giftCardOperation | `TEXT` | Tipo de operación de tarjeta regalo: SALE o REDEMPTION. | No declarado | — | — | Descripción CMS: SALE, REDEMPTION |
| `giftCardId` | giftCardId | `TEXT` | Tarjeta regalo nativa asociada a venta o canje. | No declarado | — | — | No declarado en esquema CMS |
| `accountingSign` | accountingSign | `NUMBER` | Signo contable de la operación cuando el productor lo informa. | No declarado | — | — | No declarado en esquema CMS |
| `lineItems` | lineItems | `OBJECT` | Detalle de líneas recibido del checkout/caja, conservado como snapshot. | No declarado | — | — | No declarado en esquema CMS |
| `recordSource` | recordSource | `TEXT` | Sistema de origen del registro fiscal. | No declarado | — | — | No declarado en esquema CMS |
| `desgloseDetallado` | desgloseDetallado | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `bankReconciliationReference` | bankReconciliationReference | `TEXT` | Referencia bancaria para conciliar el cobro/pago. | No declarado | — | — | No declarado en esquema CMS |
| `vatAccrualStatus` | vatAccrualStatus | `TEXT` | Estado de devengo/aplicación de anticipo. | No declarado | — | — | No declarado en esquema CMS |
| `linkedAdvanceId` | linkedAdvanceId | `TEXT` | Anticipo fiscal aplicado a la operación. | No declarado | — | — | No declarado en esquema CMS |
| `article20Exempt` | article20Exempt | `BOOLEAN` | Indica exención fiscal por el artículo 20 cuando corresponda. | No declarado | — | — | No declarado en esquema CMS |
| `cashBasisRegime` | cashBasisRegime | `BOOLEAN` | Indica aplicación del régimen especial del criterio de caja. | No declarado | — | — | No declarado en esquema CMS |
| `nonSubjectReason` | nonSubjectReason | `TEXT` | Motivo fiscal de una operación no sujeta. | No declarado | — | — | No declarado en esquema CMS |
| `issuerThirdPartyTaxId` | issuerThirdPartyTaxId | `TEXT` | NIF del tercero que expide la factura cuando corresponda. | No declarado | — | — | No declarado en esquema CMS |
| `thirdPartyLegalName` | thirdPartyLegalName | `TEXT` | Razón social del tercero emisor/interviniente. | No declarado | — | — | No declarado en esquema CMS |
| `issuedByThirdPartyOrRecipient` | issuedByThirdPartyOrRecipient | `TEXT` | Código de quién expide la factura según el contrato fiscal. | No declarado | — | — | No declarado en esquema CMS |
| `isB2B` | isB2B | `BOOLEAN` | Indica si la operación es entre empresas/profesionales. | No declarado | — | — | No declarado en esquema CMS |
| `issuerLegalName` | issuerLegalName | `TEXT` | Razón social del emisor obtenida de la configuración fiscal SSOT. | No declarado | — | — | No declarado en esquema CMS |
| `correctionAmount` | correctionAmount | `NUMBER` | Importe de corrección asociado a una factura rectificativa. | No declarado | — | — | No declarado en esquema CMS |
| `issuerInvoiceNumber` | issuerInvoiceNumber | `TEXT` | Número de factura del emisor cuando la operación lo requiere. | No declarado | — | — | No declarado en esquema CMS |
| `previousInvoiceIssueDate` | previousInvoiceIssueDate | `DATE` | Fecha de expedición de la factura rectificada. | No declarado | — | — | No declarado en esquema CMS |
| `previousInvoiceNumber` | previousInvoiceNumber | `TEXT` | Número de la factura rectificada. | No declarado | — | — | No declarado en esquema CMS |
| `correctionReason` | correctionReason | `TEXT` | Motivo de la factura rectificativa. | No declarado | — | — | No declarado en esquema CMS |
| `withholdingBase` | withholdingBase | `NUMBER` | Base sobre la que se calcula la retención. | No declarado | — | — | No declarado en esquema CMS |
| `surchargeRate` | surchargeRate | `NUMBER` | Tipo porcentual del recargo de equivalencia. | No declarado | — | — | No declarado en esquema CMS |
| `linkedBookingIds` | linkedBookingIds | `ARRAY_STRING` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `bookingId` | bookingId | `TEXT` | FK → CitasF2. | No | — | — | No declarado en esquema CMS |
| `hash` | hash | `TEXT` | Hash encadenado Veri*Factu. | Sí | — | — | No declarado en esquema CMS |
| `amount` | amount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `taxAmount` | taxAmount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `taxBase` | taxBase | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `numSerieFactura` | numSerieFactura | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `sequenceNumber` | sequenceNumber | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `transactionId` | transactionId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `previousRecordHash` | previousRecordHash | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `recordTimestamp` | recordTimestamp | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `schemaVersion` | schemaVersion | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `traceId` | traceId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `movementType` | movementType | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | MOVEMENT_TYPE: VENTA, VENTA_ONLINE, ANTICIPO, REEMBOLSO, DEVOLUCION, DEVOLUCION_SERVICIO, PROPINA, AJUSTE |
| `totalAmount` | totalAmount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `paymentMethod` | paymentMethod | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | PAYMENT_METHOD: EFECTIVO, TARJETA, BIZUM, TRANSFERENCIA, WIX_PAYMENTS |
| `channelType` | channelType | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | CHANNEL_TYPE: ONLINE, PRESENCIAL |
| `operationDescription` | operationDescription | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `staffResourceId` | staffResourceId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `tipoFactura` | tipoFactura | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | TIPO_FACTURA: F1, F2, F3, R1, R2, R3, R4, R5 |
| `fechaExpedicionFactura` | fechaExpedicionFactura | `DATE` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `fechaOperacion` | fechaOperacion | `DATE` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `tipoImpositivo` | tipoImpositivo | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `recipientLegalName` | recipientLegalName | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `recipientAddress` | recipientAddress | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `payloadFiscal` | payloadFiscal | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `sistemaInformatico` | sistemaInformatico | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `estadoEnvioAEAT` | estadoEnvioAEAT | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `csvAEAT` | csvAEAT | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `fechaEnvioAEAT` | fechaEnvioAEAT | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `tipoRectificativa` | tipoRectificativa | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `previousInvoiceId` | previousInvoiceId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `claveRegimen` | claveRegimen | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `calificacionOperacion` | calificacionOperacion | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `operacionExenta` | operacionExenta | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `inversionSujetoPasivo` | inversionSujetoPasivo | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `surchargeAmount` | surchargeAmount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `fiscalRole` | fiscalRole | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | FISCAL_ROLE: EMISOR, RECEPTOR |
| `eventType` | eventType | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `thirdPartyId` | thirdPartyId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `catalogId` | catalogId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `pairToken` | pairToken | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `orderId` | orderId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `refundId` | refundId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `fiscalPeriod` | fiscalPeriod | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `accountingAmount` | accountingAmount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `projectionStatus` | projectionStatus | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_createdDate` | Created Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_updatedDate` | Updated Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_owner` | Owner | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

### PaquetesGestoria — Paquetes de Gestoria (append-only)

- Origen: **CMS propio del proyecto** · Tipo `NATIVE` · ID canónico de colección `PaquetesGestoria` · ownerAppId=`no informado`.
- Revisión: `5` · Campos: **17** · Campo de presentación: `periodType`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `invoiceData` | Facturas snapshot | `ARRAY` | Array of immutable invoice snapshot objects. | Sí | — | Elemento OBJECT | No declarado en esquema CMS |
| `periodType` | Tipo de periodo | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `fiscalYear` | Ejercicio fiscal | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `fiscalMonth` | Mes fiscal | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `fiscalQuarter` | Trimestre fiscal | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `packageVersion` | Version del paquete | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `summaryData` | Resumen fiscal snapshot | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `packageStatus` | Estado del paquete | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `snapshotHash` | SHA-256 snapshot | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `schemaVersion` | Version del esquema | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `source` | Origen del snapshot | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `traceId` | Trace ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `createdAt` | Fecha de creacion | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_createdDate` | Created Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_updatedDate` | Updated Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_owner` | Owner | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

### RegistroIntegracion — REGISTRO_INTEGRACION

- Origen: **CMS propio del proyecto** · Tipo `NATIVE` · ID canónico de colección `RegistroIntegracion` · ownerAppId=`no informado`.
- Revisión: `4` · Campos: **21** · Campo de presentación: `eventId`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `eventId` | eventId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `eventType` | eventType | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `sourceModule` | sourceModule | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `sourceCollection` | sourceCollection | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `sourceItemId` | sourceItemId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `occurredAt` | occurredAt | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `traceId` | traceId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `correlationId` | correlationId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `idempotencyKey` | idempotencyKey | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `schemaVersion` | schemaVersion | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `payload` | payload | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `payloadHash` | payloadHash | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `deliveryStatus` | deliveryStatus | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `deliveryAttempts` | deliveryAttempts | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `nextAttemptAt` | nextAttemptAt | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `deliveredAt` | deliveredAt | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `lastDeliveryError` | lastDeliveryError | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_createdDate` | Created Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_updatedDate` | Updated Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_owner` | Owner | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

### RegistrosHorariosStaff — REGISTROS_HORARIOS_STAFF

- Origen: **CMS propio del proyecto** · Tipo `NATIVE` · ID canónico de colección `RegistrosHorariosStaff` · ownerAppId=`no informado`.
- Revisión: `14` · Campos: **21** · Campo de presentación: `resourceId`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `resourceId` | resourceId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `notes` | notes | `TEXT` | Obligatorio si AJUSTE. | No | — | — | No declarado en esquema CMS |
| `memberId` | memberId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `recordedAt` | recordedAt | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `clockEventType` | clockEventType | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | CLOCK_EVENT_TYPE: ENTRADA, SALIDA, PAUSA_INICIO, PAUSA_FIN |
| `recordType` | recordType | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | RECORD_TYPE_HORARIOS: REGULAR, AJUSTE |
| `traceId` | traceId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `adjustmentReason` | adjustmentReason | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `signature` | signature | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `recordedTime` | recordedTime | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `dayKey` | dayKey | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `monthKey` | monthKey | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `staffName` | staffName | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `registeredBy` | registeredBy | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `registeredByMemberId` | registeredByMemberId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `deviceIpAddress` | deviceIpAddress | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `meta` | meta | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No | — | — | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_createdDate` | Created Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_updatedDate` | Updated Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_owner` | Owner | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

### ServiciosCatalogo — SERVICIOS_CATALOGO

- Origen: **CMS propio del proyecto** · Tipo `NATIVE` · ID canónico de colección `ServiciosCatalogo` · ownerAppId=`no informado`.
- Revisión: `199` · Campos: **44** · Campo de presentación: `slug`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `sessionCount` | sessionCount | `NUMBER` | Cantidad total de sesiones incluidas en el plan nativo. | No declarado | — | — | No declarado en esquema CMS |
| `staffMembers` | staffMembers | `MULTI_REFERENCE → MapaStaff` | Profesionales asociados al servicio en Wix Bookings. La disponibilidad horaria real procede de Wix Bookings. | No declarado | `MapaStaff` | — | No declarado en esquema CMS |
| `pricingPlanId` | pricingPlanId | `TEXT` | Identificador nativo de Wix Pricing Plans; no es un serviceId de Bookings. | No declarado | — | — | No declarado en esquema CMS |
| `catalogEntryType` | catalogEntryType | `TEXT` | Tipo de entrada: SERVICE para servicio reservable o PRICING_PLAN para bono o plan nativo. | No declarado | — | — | CATALOG_ENTRY_TYPE: SERVICE, PRICING_PLAN |
| `locationId` | locationId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `description` | description | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `serviceId` | serviceId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `title` | title | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `slug` | slug | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `tagLine` | tagLine | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `categoryId` | categoryId | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `itemNature` | itemNature | `TEXT` | Naturaleza del servicio según la Biblia técnica. | No declarado | — | — | ITEM_NATURE: SERVICIO, PRODUCTO |
| `sku` | sku | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `price` | price | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `currency` | currency | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `taxIncluded` | taxIncluded | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `tipoImpositivo` | tipoImpositivo | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `calificacionOperacion` | calificacionOperacion | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `totalDuration` | totalDuration | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `phase1Duration` | phase1Duration | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `phase2Duration` | phase2Duration | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `exposureDuration` | exposureDuration | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `allowCombine` | allowCombine | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `linkedPhases` | linkedPhases | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `location` | location | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `clientHidden` | clientHidden | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `onlinePayment` | onlinePayment | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `inPersonPayment` | inPersonPayment | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `pricingModel` | pricingModel | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `depositType` | depositType | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `depositAmount` | depositAmount | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `margin` | margin | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `internalNotes` | internalNotes | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `category` | category | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `precioCosteBase` | precioCosteBase | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_createdDate` | Created Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `mainMedia` | mainMedia | `IMAGE` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_updatedDate` | Updated Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_owner` | Owner | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `recomendaciones` | recomendaciones | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `name` | name | `MULTI_REFERENCE → ComplementosCatalogo` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | `ComplementosCatalogo` | — | No declarado en esquema CMS |
| `bookingsStaffNames` | Bookingsstaffnames | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `bookingsStaff` | Bookingsstaff | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

### StoreCatalog/Brands — Brands

- Origen: **Wix Stores Catalog V3** · Tipo `WIX_APP` · ID canónico de colección `StoreCatalog/Brands` · ownerAppId=`215238eb-22a5-4c36-9e7b-e7c08025e04e`.
- Revisión: `0` · Campos: **6** · Campo de presentación: `name`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `name` | Name | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_createdDate` | Created Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_updatedDate` | Updated Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `assignedProductsCount` | Assigned Products Count | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `revision` | Revision | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

### StoreCatalog/Categories — Categories

- Origen: **Wix Stores Catalog V3** · Tipo `WIX_APP` · ID canónico de colección `StoreCatalog/Categories` · ownerAppId=`215238eb-22a5-4c36-9e7b-e7c08025e04e`.
- Revisión: `0` · Campos: **17** · Campo de presentación: `_id`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `seoData` | Seo Data | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | tags:ARRAY, settings:OBJECT | No declarado en esquema CMS |
| `name` | Name | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `extendedFields` | Extended Fields | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | namespaces:OBJECT | No declarado en esquema CMS |
| `visible` | Visible | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `image` | Image | `IMAGE` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `description` | Description | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `_createdDate` | Created Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `breadcrumbsInfo` | Breadcrumbs Info | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | breadcrumbs:ARRAY | No declarado en esquema CMS |
| `_updatedDate` | Updated Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `slug` | Slug | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `revision` | Revision | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `treeReference` | Tree Reference | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | appNamespace:TEXT, treeKey:TEXT | No declarado en esquema CMS |
| `richContentDescription` | Rich Content Description | `RICH_CONTENT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `parentCategory` | Parent Category | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | id:TEXT, index:NUMBER | No declarado en esquema CMS |
| `managingAppId` | Managing App ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `itemCounter` | Item Counter | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

### StoreCatalog/Info sections — Info Sections

- Origen: **Wix Stores Catalog V3** · Tipo `WIX_APP` · ID canónico de colección `StoreCatalog/Info sections` · ownerAppId=`215238eb-22a5-4c36-9e7b-e7c08025e04e`.
- Revisión: `0` · Campos: **9** · Campo de presentación: `_id`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `description` | Description | `RICH_CONTENT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_createdDate` | Created Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_updatedDate` | Updated Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `assignedProductsCount` | Assigned Products Count | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `plainDescription` | Plain Description | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `revision` | Revision | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `title` | Title | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `uniqueName` | Unique Name | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |

### StoreCatalog/Inventory — Inventory

- Origen: **Wix Stores Catalog V3** · Tipo `WIX_APP` · ID canónico de colección `StoreCatalog/Inventory` · ownerAppId=`215238eb-22a5-4c36-9e7b-e7c08025e04e`.
- Revisión: `0` · Campos: **17** · Campo de presentación: `_id`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `variantId` | Variant ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `inStock` | In Stock | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `quantity` | Quantity | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `stockOverrides` | Stock Overrides | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | lowStockThreshold:NUMBER, lowStock:BOOLEAN | No declarado en esquema CMS |
| `trackQuantity` | Track Quantity | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `extendedFields` | Extended Fields | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | namespaces:OBJECT | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_createdDate` | Created Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `availabilityStatus` | Availability Status | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `inTransitQuantity` | In Transit Quantity | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_updatedDate` | Updated Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `revision` | Revision | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `locationId` | Location ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `productId` | Product ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `productV3Ref` | Product V3 Ref | `REFERENCE → StoreCatalog/Products` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | `StoreCatalog/Products` | — | No declarado en esquema CMS |
| `preorderInfo` | Preorder Info | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | quantity:NUMBER, enabled:BOOLEAN, message:TEXT, counter:NUMBER, limit:NUMBER | No declarado en esquema CMS |
| `product` | Product | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | name:TEXT, variantBarcode:TEXT, variantName:TEXT, brand:OBJECT, directCategoryIds:ARRAY_STRING, variantSku:TEXT, variantVisible:BOOLEAN | No declarado en esquema CMS |

### StoreCatalog/Product options & modifiers — Product Options Modifiers

- Origen: **Wix Stores Catalog V3** · Tipo `WIX_APP` · ID canónico de colección `StoreCatalog/Product options & modifiers` · ownerAppId=`215238eb-22a5-4c36-9e7b-e7c08025e04e`.
- Revisión: `0` · Campos: **12** · Campo de presentación: `_id`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `freeTextInput` | Free Text Input | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | maxCharCount:NUMBER, minCharCount:NUMBER, defaultAddedPrice:TEXT, key:TEXT, title:TEXT | No declarado en esquema CMS |
| `name` | Name | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `choicesSettings` | Choices Settings | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | choices:ARRAY, sortOrder:TEXT | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_createdDate` | Created Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_updatedDate` | Updated Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `assignedProductsCount` | Assigned Products Count | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `key` | Key | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `revision` | Revision | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `customizationType` | Customization Type | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `modifierSettings` | Modifier Settings | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | defaultMandatory:BOOLEAN | No declarado en esquema CMS |
| `customizationRenderType` | Customization Render Type | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |

### StoreCatalog/Products — Products

- Origen: **Wix Stores Catalog V3** · Tipo `WIX_APP` · ID canónico de colección `StoreCatalog/Products` · ownerAppId=`215238eb-22a5-4c36-9e7b-e7c08025e04e`.
- Revisión: `0` · Campos: **42** · Campo de presentación: `name`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `inventory` | Inventory | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | availabilityStatus:TEXT, preorderStatus:TEXT, preorderAvailability:TEXT | No declarado en esquema CMS |
| `additionalRibbons` | Additional Ribbons | `ARRAY` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | Elemento OBJECT | No declarado en esquema CMS |
| `seoData` | Seo Data | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | tags:ARRAY, settings:OBJECT | No declarado en esquema CMS |
| `physicalProperties` | Physical Properties | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | deliveryProfileId:TEXT, fulfillerId:TEXT, weightMeasurementUnitInfo:OBJECT, pricePerUnit:OBJECT, pricePerUnitRange:OBJECT, shippingWeightRange:OBJECT | No declarado en esquema CMS |
| `name` | Name | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `mainCategoryV3Ref` | Main Category V3 Ref | `REFERENCE → StoreCatalog/Categories` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | `StoreCatalog/Categories` | — | No declarado en esquema CMS |
| `extendedFields` | Extended Fields | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | namespaces:OBJECT | No declarado en esquema CMS |
| `infoSections` | Info Sections | `ARRAY` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | Elemento OBJECT | No declarado en esquema CMS |
| `compareAtPriceRange` | Compare At Price Range | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | minValue:OBJECT, maxValue:OBJECT | No declarado en esquema CMS |
| `subscriptionDetails` | Subscription Details | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | subscriptions:ARRAY, allowOneTimePurchases:BOOLEAN | No declarado en esquema CMS |
| `url` | Url | `URL` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `visible` | Visible | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `variantSummary` | Variant Summary | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | variantCount:NUMBER, minPriceVariant:OBJECT | No declarado en esquema CMS |
| `description` | Description | `RICH_CONTENT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `visibleInPos` | Visible In Pos | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_createdDate` | Created Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `tags` | Tags | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | privateTags:OBJECT, publicTags:OBJECT | No declarado en esquema CMS |
| `allCategoriesInfo` | All Categories Info | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | categories:ARRAY | No declarado en esquema CMS |
| `directCategoriesInfo` | Direct Categories Info | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | categories:ARRAY | No declarado en esquema CMS |
| `breadcrumbsInfo` | Breadcrumbs Info | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | breadcrumbs:ARRAY | No declarado en esquema CMS |
| `_updatedDate` | Updated Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `slug` | Slug | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `productType` | Product Type | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `brand` | Brand | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | id:TEXT, name:TEXT | No declarado en esquema CMS |
| `taxGroupId` | Tax Group ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `options` | Options | `ARRAY` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | Elemento OBJECT | No declarado en esquema CMS |
| `plainDescription` | Plain Description | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `revision` | Revision | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `discountInfo` | Discount Info | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | discountRuleNames:ARRAY_STRING | No declarado en esquema CMS |
| `modifiers` | Modifiers | `ARRAY` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | Elemento OBJECT | No declarado en esquema CMS |
| `mainCategoryId` | Main Category ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `inventoryAppId` | Inventory App ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `ribbon` | Ribbon | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | id:TEXT, name:TEXT | No declarado en esquema CMS |
| `media` | Media | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | main:OBJECT, itemsInfo:OBJECT | No declarado en esquema CMS |
| `currency` | Currency | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `actualPriceRange` | Actual Price Range | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | minValue:OBJECT, maxValue:OBJECT | No declarado en esquema CMS |
| `purchaseEligibility` | Purchase Eligibility | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | userCriteria:TEXT | No declarado en esquema CMS |
| `costRange` | Cost Range | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | minValue:OBJECT, maxValue:OBJECT | No declarado en esquema CMS |
| `variantsInfo` | Variants Info | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | variants:ARRAY | No declarado en esquema CMS |
| `handle` | Handle | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `importId` | Import ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

### StoreCatalog/Ribbons — Ribbons

- Origen: **Wix Stores Catalog V3** · Tipo `WIX_APP` · ID canónico de colección `StoreCatalog/Ribbons` · ownerAppId=`215238eb-22a5-4c36-9e7b-e7c08025e04e`.
- Revisión: `0` · Campos: **6** · Campo de presentación: `_id`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `name` | Name | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | Sí | — | — | No declarado en esquema CMS |
| `assignedProductCount` | Assigned Product Count | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_createdDate` | Created Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_updatedDate` | Updated Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `revision` | Revision | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

### StoreCatalog/Variants — Variants

- Origen: **Wix Stores Catalog V3** · Tipo `WIX_APP` · ID canónico de colección `StoreCatalog/Variants` · ownerAppId=`215238eb-22a5-4c36-9e7b-e7c08025e04e`.
- Revisión: `0` · Campos: **16** · Campo de presentación: `_id`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `locations` | Locations | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | listed:BOOLEAN | No declarado en esquema CMS |
| `variantId` | Variant ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `physicalProperties` | Physical Properties | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | weight:NUMBER, pricePerUnit:OBJECT, productDimensions:OBJECT, packageDimensions:OBJECT | No declarado en esquema CMS |
| `optionChoices` | Option Choices | `ARRAY` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | Elemento OBJECT | No declarado en esquema CMS |
| `sku` | Sku | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `revenueDetails` | Revenue Details | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | cost:OBJECT, profit:OBJECT, profitMargin:NUMBER | No declarado en esquema CMS |
| `barcode` | Barcode | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `visible` | Visible | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `price` | Price | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | actualPrice:OBJECT, compareAtPrice:OBJECT, priceAfterDiscount:OBJECT | No declarado en esquema CMS |
| `subscriptionPricesInfo` | Subscription Prices Info | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | subscriptionPrices:ARRAY | No declarado en esquema CMS |
| `productData` | Product Data | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | physicalProperties:OBJECT, name:TEXT, visible:BOOLEAN, visibleInPos:BOOLEAN, slug:TEXT, productType:TEXT, brand:OBJECT, revision:TEXT, mainCategoryId:TEXT, currency:TEXT, productId:TEXT, updatedDate:DATETIME, handle:TEXT | No declarado en esquema CMS |
| `discountInfo` | Discount Info | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | discountRuleNames:ARRAY_STRING | No declarado en esquema CMS |
| `digitalProperties` | Digital Properties | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | digitalFile:OBJECT | No declarado en esquema CMS |
| `media` | Media | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | displayName:TEXT, mediaType:TEXT, url:URL, image:IMAGE, altText:TEXT, thumbnail:OBJECT, uploadId:TEXT, id:TEXT, video:VIDEO | No declarado en esquema CMS |
| `inventoryStatus` | Inventory Status | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | inStock:BOOLEAN, preorderEnabled:BOOLEAN | No declarado en esquema CMS |

### Stores/Collections — Collections

- Origen: **Wix Stores / eCommerce** · Tipo `WIX_APP` · ID canónico de colección `Stores/Collections` · ownerAppId=`1380b703-ce81-ff05-f115-39571d94dfcd`.
- Revisión: `0` · Campos: **5** · Campo de presentación: `name`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `name` | Name | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `mainMedia` | Main Media | `IMAGE` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `slug` | Slug | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `categoryPageUrl` | Page Url | `PAGE_LINK` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

### Stores/InventoryItems — InventoryItems

- Origen: **Wix Stores / eCommerce** · Tipo `WIX_APP` · ID canónico de colección `Stores/InventoryItems` · ownerAppId=`1380b703-ce81-ff05-f115-39571d94dfcd`.
- Revisión: `0` · Campos: **6** · Campo de presentación: `_id`.
- Permisos: `read=ADMIN, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `trackQuantity` | Track Quantity | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `externalId` | External ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_updatedDate` | Updated Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `productId` | Product ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `variants` | Variants | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

### Stores/Orders — Orders

- Origen: **Wix Stores / eCommerce** · Tipo `WIX_APP` · ID canónico de colección `Stores/Orders` · ownerAppId=`1380b703-ce81-ff05-f115-39571d94dfcd`.
- Revisión: `0` · Campos: **23** · Campo de presentación: `number`.
- Permisos: `read=ADMIN, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `number` | Number | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `cartId` | Cart Id | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `lineItems` | Line Items | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `paymentStatus` | Payment Status | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `archived` | Archived | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `enteredBy` | Entered By | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `shippingInfo` | Shipping Info | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `activities` | Activities | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `customField` | Custom Field | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_updatedDate` | Updated Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `weightUnit` | Weight Unit | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `buyerNote` | Buyer Note | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_dateCreated` | Date Created | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `subscriptionInfo` | Subscription Information | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `billingInfo` | Billing Info | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `buyerInfo` | Buyer Info | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `currency` | Currency | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `buyerLanguage` | Buyer Language | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `channelInfo` | Channel Info | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `totals` | Totals | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `fulfillmentStatus` | Fulfillment Status | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `fulfillments` | Fulfillments | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

### Stores/Products — Products

- Origen: **Wix Stores / eCommerce** · Tipo `WIX_APP` · ID canónico de colección `Stores/Products` · ownerAppId=`1380b703-ce81-ff05-f115-39571d94dfcd`.
- Revisión: `7` · Campos: **35** · Campo de presentación: `name`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `seoData` | SEO Data | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `inStock` | In Stock | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `weight` | Weight | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `name` | Name | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `sku` | SKU | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `formattedDiscountedPrice` | Formatted Discounted Price | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `productOptions` | Product Options | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `mainMedia` | Main Media | `IMAGE` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `description` | Description | `RICH_TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `discountedPrice` | Discounted Price | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `formattedPrice` | Formatted Price | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `price` | Price | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `quantityInStock` | Quantity In Stock | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `collections` | Collections | `MULTI_REFERENCE → Stores/Collections` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | `Stores/Collections` | — | No declarado en esquema CMS |
| `inventoryItem` | Inventory Item | `REFERENCE → Stores/InventoryItems` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | `Stores/InventoryItems` | — | No declarado en esquema CMS |
| `_updatedDate` | Updated Date | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `formattedPricePerUnit` | Formatted Price Per Unit | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `slug` | Slug | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `productType` | Product Type | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `brand` | Brand | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `ribbons` | Ribbons | `ARRAY` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `pricePerUnitData` | Price Per Unit Data | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `mediaItems` | Media Items | `MEDIA_GALLERY` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `trackInventory` | Track Inventory | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `customTextFields` | Custom Text Fields | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `pricePerUnit` | Price Per Unit | `NUMBER` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `ribbon` | Ribbon | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `currency` | Currency | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `productPageUrl` | Product Page Url | `PAGE_LINK` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `numericId` | Numeric Id | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `manageVariants` | Manage Variants | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `discount` | Discount | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `additionalInfoSections` | Additional Info Sections | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `createdDate` | Date Created | `DATETIME` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

### Stores/Variants — Variants

- Origen: **Wix Stores / eCommerce** · Tipo `WIX_APP` · ID canónico de colección `Stores/Variants` · ownerAppId=`1380b703-ce81-ff05-f115-39571d94dfcd`.
- Revisión: `0` · Campos: **12** · Campo de presentación: `fullVariantName`.
- Permisos: `read=ANYONE, insert=ADMIN, update=ADMIN, remove=ADMIN`.

| Campo (key canónico) | Etiqueta Wix | Tipo de dato Wix | Descripción | Obligatorio | ID de colección referenciada | Subestructura OBJECT/ARRAY | Enum/opciones |
|---|---|---|---|---|---|---|---|
| `variantId` | Variant ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `stock` | Stock | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `sku` | SKU | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `choices` | Choices | `OBJECT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `_id` | ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `fullVariantName` | Full Variant Name | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `variantName` | Variant Name | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `collections` | Collections | `MULTI_REFERENCE → Stores/Collections` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | `Stores/Collections` | — | No declarado en esquema CMS |
| `managedVariant` | Managed Variant | `BOOLEAN` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `media` | Media | `IMAGE` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `productName` | Product Name | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |
| `productId` | Product ID | `TEXT` | No hay descripción funcional configurada en Wix CMS. Se conserva la etiqueta visible, sin inferir reglas de negocio. | No declarado | — | — | No declarado en esquema CMS |

## 4. Etiquetas CMS y significado documental

El `displayName` de Wix se conserva como etiqueta en cada fila de §3. El texto `description` se copia cuando está definido. En ausencia de `description`, el documento lo declara como no configurado; la etiqueta no debe confundirse con una descripción funcional validada. Las etiquetas CMS tampoco son necesariamente los textos visibles en la web: esos pertenecen a componentes y formularios frontend.

Para completar las descripciones funcionales pendientes se debe contrastar cada campo NATIVE con sus writers, readers, DTOs, validadores y flujos. En las colecciones WIX_APP, la semántica y los enums específicos deben proceder de la API oficial de la app propietaria.
## 5. Registro de aplicaciones Wix y sus identificadores

| Aplicación de origen | ownerAppId devuelto por Wix | Espacios/colecciones observados |
|---|---|---|
| Wix Blog | `14bcded7-0066-7c35-14d7-466cb3f09103` | `Blog/Categories`, `Blog/Posts`, `Blog/Tags` |
| Wix Bookings | `13d21c63-b5ec-5912-8397-c3a5ddb27a97` | `Bookings/Schedule`, `Bookings/Services`, `Bookings/Staff` |
| Wix Campaign Manager | `7fdf5576-9d52-4c0a-9840-6e226f2ec415` | `CampaignManager/campaigns`, `CampaignManager/userConfig` |
| Wix Stores / eCommerce | `1380b703-ce81-ff05-f115-39571d94dfcd` | `eCommerce/Orders`, `Stores/Collections`, `Stores/InventoryItems`, `Stores/Orders`, `Stores/Products`, `Stores/Variants` |
| Wix Forms | `14ce1214-b278-a7e4-1373-00cebd1bef7c` | `Forms/subscribers03` |
| Wix Marketing / Coupons | `14d7032a-0a65-5270-cca7-30f599708fed` | `Marketing/Coupons` |
| Wix Members | `SiteMembers` | `Members/Badges`, `Members/FullData`, `Members/PrivateMembersData`, `Members/PublicData` |
| Wix Stores Catalog V3 | `215238eb-22a5-4c36-9e7b-e7c08025e04e` | `StoreCatalog/Brands`, `StoreCatalog/Categories`, `StoreCatalog/Info sections`, `StoreCatalog/Inventory`, `StoreCatalog/Product options & modifiers`, `StoreCatalog/Products`, `StoreCatalog/Ribbons`, `StoreCatalog/Variants` |
| Wix Locations | No informado por Wix | `Locations/Locations` |

Los IDs `ownerAppId` son identificadores de aplicación; no son IDs de colección, de elemento, de recurso Bookings, de miembro ni de producto. Para el dato en sí, la clave del campo es `key`, la colección se identifica por su `id` y una referencia tipada apunta al `referencedCollectionId` exacto. Los IDs de elementos nativos se almacenan en campos como `serviceId`, `resourceId`, `memberId`, `bookingId` o `productId`; solo se atribuyen a un sistema nativo cuando lo acredita el contrato de campo o el código.
### 5.1 Mapa de IDs nativos de entidades

| Campo de referencia | Aplicación nativa | ID/campo canónico de destino | Observación |
|---|---|---|---|
| `CitasF2.bookingId` | Wix Bookings | `Bookings` booking ID | ID de reserva nativa; distinto de `CitasF2._id`. |
| `CitasF2.serviceId`, `ServiciosCatalogo.serviceId` | Wix Bookings | `Bookings/Services._id` | ID nativo de servicio; el maestro `ServiciosCatalogo` conserva su propio `_id`. |
| `CitasF2.resourceId`, `MapaStaff.resourceId`, `RegistrosHorariosStaff.resourceId` | Wix Bookings | `resourceId` del recurso/staff | No confundir con `Bookings/Staff._id`, `MapaStaff.staffMemberId` ni `memberId`. |
| `MapaStaff.staffMemberId` | Wix Bookings | `Bookings/Staff._id` / Staff Member ID | ID nativo del miembro del staff; distinto de `resourceId`. |
| `MapaStaff.scheduleId`, `CitasF2.scheduleId` | Wix Bookings | `Bookings/Schedule._id` | ID de agenda nativa, cuando se utiliza. |
| `MapaStaff.memberId`, `RegistrosHorariosStaff.memberId` | Wix Members | ID nativo de Site Member (`Members/PrivateMembersData._id` / API Members) | No es ID de staff ni recurso Bookings. |
| `ServiciosCatalogo.pricingPlanId` | Wix Pricing Plans | ID nativo del plan | Pricing Plans no aparece como colección CMS en este inventario; resolver mediante API nativa. |
| `ServiciosCatalogo.locationId` | Wix Locations | `Locations/Locations._id` | ID de sede/ubicación nativa. |
| `Locations/Locations._id` | Wix Locations | `_id` de Locations | Identificador nativo de la ubicación. |
| `StoreCatalog/Inventory.productId` | Wix Stores Catalog V3 | `StoreCatalog/Products._id` | ID del producto Catalog V3. |
| `StoreCatalog/Inventory.variantId`, `StoreCatalog/Variants.variantId` | Wix Stores Catalog V3 | `StoreCatalog/Variants.variantId` | ID de variante; no es el ID de producto. |
| `StoreCatalog/Inventory.productV3Ref` | Wix Stores Catalog V3 | `StoreCatalog/Products` | Referencia CMS tipada confirmada por Wix (`REFERENCE`). |
| `Stores/Products.inventoryItem` | Wix Stores | `Stores/InventoryItems._id` | Referencia CMS tipada confirmada por Wix. |
| `Stores/Products._id`, `Stores/Variants._id`, `Stores/InventoryItems._id` | Wix Stores | `_id` de la colección correspondiente | IDs de entidades Wix Stores; no intercambiables con Catalog V3. |
| `Blog/Posts.author` | Wix Members / Wix Blog | `Members/PublicData._id` | Referencia CMS tipada confirmada por Wix. |
| `Blog/Posts.mainCategory`, `Blog/Posts.categories` | Wix Blog | `Blog/Categories._id` | Referencia CMS tipada confirmada por Wix. |
| `Blog/Posts.tags` | Wix Blog | `Blog/Tags._id` | Referencia CMS tipada confirmada por Wix. |
| `Bookings/Schedule.service` | Wix Bookings | `Bookings/Services._id` | Referencia CMS tipada confirmada por Wix. |

Los campos no incluidos en esta tabla no tienen un mapeo de ID nativo suficientemente demostrado por metadatos Wix o por el contrato consultado. No derivar IDs de un nombre de campo por semejanza.

## 6. Keyfields canónicos y glosario

Las definiciones siguientes combinan contrato físico live y documentación/código del repositorio. Cuando un campo tiene un significado técnico exacto, se conserva ese significado; no se infiere un uso fiscal, contable o legal adicional.

### 6.1 Identidad, referencias y trazabilidad

| Keyfield | Colección(es) | Tipo físico | Etiqueta CMS actual | Significado |
|---|---|---|---|---|
| `_id` | Todas las NATIVE | TEXT | ID | Identificador interno del elemento CMS. No sustituye a IDs de Wix Bookings, Stores o Members. |
| `traceId` | Transversal | TEXT | Igual que key | Identificador de correlación de una operación a través de capas/módulos. El backend lo exige en varios contratos de escritura. |
| `bookingId` | CitasF2, ControlOperativo, MovimientosCaja, LibroAsientosContablesDetalle | TEXT | Igual que key | ID GUID de una reserva nativa de Wix Bookings. No es el `_id` de CitasF2. |
| `serviceId` | CitasF2, ControlOperativo, ServiciosCatalogo | TEXT | Igual que key | ID de servicio de Wix Bookings. En ServiciosCatalogo vincula el maestro local con el servicio nativo. |
| `resourceId` | CitasF2, ControlOperativo, MapaStaff, RegistrosHorariosStaff, CajaActual, MovimientosCaja, LibroAsientosContablesDetalle | TEXT | Igual que key | ID del recurso/profesional de Wix Bookings. No equivale a `memberId` ni a `staffMemberId`. |
| `staffMemberId` | MapaStaff | TEXT | Igual que key | ID nativo de Bookings Staff Member; distinto de `resourceId`. |
| `memberId` | MapaStaff, RegistrosHorariosStaff | TEXT | Igual que key | ID de miembro del sitio Wix (Members). No usarlo como resourceId. |
| `scheduleId` | CitasF2, MapaStaff | TEXT | Igual que key | ID de agenda/schedule de Bookings asociado al recurso/slot. La fuente exacta debe respetar el contrato del payload Bookings; no intercambiar con IDs de otros calendarios. |
| `catalogId` | CitasF2, MovimientosCaja, MovimientosInventario | TEXT | Igual que key | Referencia de catálogo usada por el dominio que genera la operación. En MovimientosInventario, la descripción CMS precisa que es el productId del maestro histórico InventarioStockVenta; no sustituirlo por el ID de Stores. |
| `orderId` | CitasF2, ControlOperativo, MovimientosCaja, MovimientosInventario, LibroAsientosContablesDetalle | TEXT | Igual que key | ID de pedido nativo de Wix eCommerce/Stores relacionado con la operación. No confundir con transactionId. |
| `refundId` | ControlOperativo, MovimientosCaja, MovimientosInventario | TEXT | Igual que key | Identificador del reembolso nativo asociado al evento/movimiento. |
| `thirdPartyId` | CitasF2, DatosFiscales (según relaciones del proyecto), MovimientosCaja, MovimientosInventario, MapaStaff | TEXT | Igual que key | Referencia a tercero fiscal/CRM cuando el contrato del módulo lo utiliza. La relación concreta depende del flujo; no equivale a memberId. |
| `pairToken` | CitasF2, ControlOperativo, MovimientosCaja | TEXT | Igual que key | Token compartido que vincula las dos reservas de una cita dual (DUAL_F1 y DUAL_F2). |
| `transactionId` | ControlOperativo, MovimientosCaja | TEXT | Igual que key | Identificador de transacción/operación usado para evitar duplicados y correlacionar el hecho económico. La unicidad debe comprobarse en el contrato/índice concreto; no asumirla por el nombre. |
| `eventId` | ControlOperativo, RegistroIntegracion | TEXT | Igual que key | Identificador del evento recibido o registrado. En ControlOperativo participa en el registro/deduplicación de eventos. |
| `sourceEventId` | MovimientosInventario | TEXT | Igual que key | ID del evento de origen que produjo el movimiento histórico. No existe en LibroAsientosContablesDetalle. |
| `correlationId` | RegistroIntegracion | TEXT | Igual que key | Identificador de correlación entre eventos/sistemas. |
| `idempotencyKey` | RegistroIntegracion | TEXT | Igual que key | Clave propuesta por el contrato de integración para impedir entregas duplicadas; uso live no demostrado. |
| `dedupeKey` | ControlOperativo | TEXT | Igual que key | Clave de deduplicación de controles operativos. El significado concreto depende de `controlType`. |
| `movementToken` | MovimientosInventario | TEXT | Igual que key | Token de idempotencia del movimiento de inventario histórico. No autoriza nuevos movimientos. |
| `sourceMovementId` | LibroAsientosContablesDetalle | TEXT | Igual que key | Referencia al movimiento de origen que se proyecta en la línea contable. Es el campo físico del contrato; no sustituir por sourceEventId. |

### 6.2 Reservas y agenda — CitasF2

| Keyfield | Tipo | Significado |
|---|---|---|
| `bookingStatus` | TEXT | Estado interno de la proyección de reserva. Validado por `CITAS_BOOKING_STATUS`; no es el tipo de webhook. |
| `paymentStatus` | TEXT | Estado de pago/tesorería asociado a la reserva. Validado por `CITAS_PAYMENT_STATUS`; no equivale al estado de la reserva. |
| `bookingType` | TEXT | Tipo de reserva: `SIMPLE`, `DUAL_F1` o `DUAL_F2`. |
| `slotStart` | DATETIME | Instante de inicio del slot reservado. |
| `slotEnd` | DATETIME | Instante de fin del slot reservado. |
| `timeZone` | TEXT | Zona horaria con la que se interpretan fechas/horas de la reserva. Descripción CMS: zona horaria usada para interpretar fechas y horas de la reserva. |
| `dateYmd` | TEXT | Clave de fecha en formato año-mes-día usada por el dominio/consultas. |
| `pairToken` | TEXT | Vincula los componentes F1/F2 de una reserva dual. Debe compartirse entre ambos registros. |
| `contactDetails` | OBJECT | Snapshot de datos de contacto asociados a la reserva; minimizar datos y no tratarlo como fuente de identidad autorizativa. |
| `privacyNoticePurpose` | TEXT | Finalidad informada en el contexto de la reserva. |
| `privacyNoticeAcceptedAt` | DATETIME | Momento en que se dejó constancia de haber mostrado/aceptado el aviso informativo. No sustituye consentimientos opcionales separados. |
| `privacyNoticeVersion` | TEXT | Versión del aviso de privacidad presentado. |
| `cancellationReason` | TEXT | Motivo de cancelación cuando se registra. |
| `orderId` | TEXT | Pedido asociado al checkout/pago de la reserva, cuando exista. |
| `cashMovementId` | TEXT | Referencia al movimiento fiscal/caja asociado, cuando exista. |
| `invoicingDate` | DATETIME | Fecha/hora asociada a la facturación, cuando proceda. |
| `totalAmount` | NUMBER | Importe total asociado a la reserva según el contrato de proyección. |
| `revision` | NUMBER | Revisión de negocio/proyección guardada en el item; no confundir con la revisión de esquema de la colección. |

### 6.3 Servicios y complementos

| Keyfield | Colección | Tipo | Significado |
|---|---|---|---|
| `catalogEntryType` | ServiciosCatalogo | TEXT | Discrimina `SERVICE` o `PRICING_PLAN`; valores canónicos en `CATALOG_ENTRY_TYPE`. |
| `serviceId` | ServiciosCatalogo | TEXT | ID nativo de Wix Bookings para un servicio reservable. |
| `pricingPlanId` | ServiciosCatalogo | TEXT | ID nativo de Wix Pricing Plans; no es un serviceId de Bookings. |
| `slug` | ServiciosCatalogo | TEXT | Identificador de routing/URL pública del elemento de catálogo. |
| `staffMembers` | ServiciosCatalogo | MULTI_REFERENCE | Referencias a miembros de staff elegibles para el servicio; no representan disponibilidad horaria. |
| `name` | ServiciosCatalogo | MULTI_REFERENCE | Referencia múltiple a ComplementosCatalogo para complementos asociados al servicio; no es el nombre textual del servicio. |
| `ServiciosCatalogo_name` | ComplementosCatalogo | MULTI_REFERENCE | Relación inversa desde complemento a servicios asociados. |
| `addonId` | ComplementosCatalogo | TEXT | Identificador propio del complemento. |
| `itemNature` | ServiciosCatalogo, ComplementosCatalogo | TEXT | Naturaleza funcional del elemento. Valores históricos pueden diferir del enum canónico de escritura; validar mediante internalConfig/validation. |
| `sku` | ServiciosCatalogo, ComplementosCatalogo, inventario legacy | TEXT | Código SKU del elemento comercial. No equivale a productId o variantId de Wix. |
| `price` | ServiciosCatalogo, ComplementosCatalogo, InventarioStockVenta | NUMBER | Precio numérico del elemento. La moneda y el tratamiento fiscal se documentan en campos separados. |
| `currency` | ServiciosCatalogo | TEXT | Código de moneda asociado al precio; producción usa EUR. |
| `taxIncluded` | ServiciosCatalogo, ComplementosCatalogo | BOOLEAN | Indica si el precio incorpora impuestos. |
| `tipoImpositivo` | ServiciosCatalogo, ComplementosCatalogo, MovimientosCaja | NUMBER | Tipo impositivo expresado como valor numérico según reglas fiscales aprobadas. No asumir que el campo contiene porcentaje entero. |
| `phase1Duration` | ServiciosCatalogo | NUMBER | Minutos de trabajo de la primera fase de una reserva dual. |
| `exposureDuration` | ServiciosCatalogo | NUMBER | Minutos de exposición/espera entre F1 y F2. |
| `phase2Duration` | ServiciosCatalogo | NUMBER | Minutos de trabajo de la segunda fase. |
| `totalDuration` | ServiciosCatalogo | NUMBER | Duración total; contrato documentado: suma de fase1Duration + exposureDuration + phase2Duration. |
| `linkedPhases` | ServiciosCatalogo | TEXT | ID de servicio F2 vinculado a la configuración dual. |
| `allowCombine` | ServiciosCatalogo | BOOLEAN | Habilita que el servicio participe en la composición dual, sujeto a validación backend. |
| `clientHidden` | ServiciosCatalogo | BOOLEAN | Controla si el elemento se oculta del catálogo público según el contrato UI. |
| `sessionCount` | ServiciosCatalogo | NUMBER | Número de sesiones incluidas en un plan nativo. |
| `depositType` / `depositAmount` | ServiciosCatalogo | TEXT / NUMBER | Tipo e importe de depósito configurado para el elemento. La política de cobro debe verificarse aparte. |

### 6.4 Personal y registro horario

| Keyfield | Colección | Tipo | Significado |
|---|---|---|---|
| `resourceId` | MapaStaff / RegistrosHorariosStaff | TEXT | ID del recurso de Bookings asociado al profesional. |
| `staffMemberId` | MapaStaff | TEXT | ID de miembro del staff de Bookings. |
| `memberId` | MapaStaff / RegistrosHorariosStaff | TEXT | ID del miembro de Wix autenticado/asociado. |
| `rolWebsite` | MapaStaff | TEXT | Rol de autorización de la web como dato de mapeo. El RBAC efectivo procede de `internalConfig.STAFF.WEBSITE_ROLE_BY_RESOURCE_ID`, no de confiar en este campo sin comprobación. |
| `rolBookings` | MapaStaff | TEXT | Rol del miembro en Bookings; el valor canónico documentado para staff es `STAFF`. |
| `clockEventType` | RegistrosHorariosStaff | TEXT | Tipo de evento de jornada (entrada, salida, pausa o ajuste según enum de backend). |
| `recordType` | RegistrosHorariosStaff | TEXT | Tipo de registro laboral, según dominio de validación. |
| `recordedAt` | RegistrosHorariosStaff | DATETIME | Instante fechado del evento de jornada. |
| `recordedTime` | RegistrosHorariosStaff | TEXT | Representación textual de la hora registrada; no sustituye el timestamp. |
| `dayKey` / `monthKey` | RegistrosHorariosStaff | TEXT | Claves derivadas de día y mes para agrupación/consulta. |
| `registeredBy` / `registeredByMemberId` | RegistrosHorariosStaff | TEXT | Actor que registró el evento y su ID de miembro cuando corresponda. |
| `adjustmentReason` / `notes` | RegistrosHorariosStaff | TEXT | Motivo/nota del ajuste. CMS describe `notes` como obligatorio si el tipo es AJUSTE. |
| `signature` | RegistrosHorariosStaff | TEXT | Firma/HMAC asociada al registro según contrato del writer; los elementos sintéticos históricos no acreditan una firma válida. |

### 6.5 Caja, fiscalidad y contabilidad

| Keyfield | Colección | Tipo | Significado |
|---|---|---|---|
| `singletonKey` | CajaActual | TEXT | Clave que identifica el registro singleton de la sesión/caja; valor canónico documentado `CAJA_PRINCIPAL`. |
| `sequenceCounters` | CajaActual | OBJECT | Contadores de secuencia utilizados por el ledger; no editar manualmente. |
| `operationDate` | CajaActual | DATE | Fecha de referencia operativa de la caja. |
| `openingAmount` | CajaActual | NUMBER | Saldo de apertura; se mantiene separado de expectedCash aunque coincidan en la fila sintética actual. |
| `cashAmount` | CajaActual | NUMBER | Importe de efectivo físico reflejado en la caja. |
| `expectedCash` | CajaActual | NUMBER | Efectivo esperado según movimientos físicos registrados. |
| `countedCash` | CajaActual | NUMBER | Efectivo contado físicamente en el arqueo. |
| `difference` / `differenceReason` | CajaActual | NUMBER / TEXT | Diferencia de arqueo y explicación asociada. |
| `cashRegisterStatus` | CajaActual | TEXT | Estado canónico de la caja. El sitio aislado usa `SIMULACION`; el código trata ese sentinel de forma explícita. |
| `cardAmount` / `otherAmount` / `voucherAmount` | CajaActual | NUMBER | Acumulados por concepto; no equivalen a efectivo físico ni prueban un desglose de Bizum. |
| `currentSequence` | CajaActual | NUMBER | Campo físico presente; no se localizó consumidor activo en src/. Candidato a retirada tras revisar contratos externos. |
| `id` | CajaActual | TEXT | Espejo físico de `_id` en el singleton leído; el keyfield CMS sigue siendo `_id`. |
| `taxId` | DatosFiscales | TEXT | NIF/NIE/CIF/VAT-UE del tercero; validado por `assertDatosFiscalesRecord`. |
| `legalName` | DatosFiscales | TEXT | Razón social/nombre legal del tercero o emisor. |
| `recordType` | DatosFiscales | TEXT | Discriminador fiscal: `TERCERO`, `GESTORIA`, `CONFIG_SISTEMA`. |
| `thirdPartyType` | DatosFiscales | TEXT | Tipo de tercero según enum fiscal del backend. |
| `numSerieFactura` | MovimientosCaja | TEXT | Número de serie/número correlativo de factura o ticket. |
| `sequenceNumber` | MovimientosCaja | NUMBER | Secuencia numérica del ledger, alimentada desde los contadores de CajaActual. |
| `transactionId` | MovimientosCaja | TEXT | Identidad de la transacción para idempotencia del hecho económico. |
| `taxBase` / `taxAmount` | MovimientosCaja | NUMBER | Base imponible y cuota de impuesto del movimiento fiscal. |
| `amount` / `totalAmount` | MovimientosCaja | NUMBER | Importe económico según el contrato de ledger; no intercambiar sin revisar el contexto. |
| `movementType` | MovimientosCaja | TEXT | Tipo de movimiento económico según enum canónico. |
| `paymentMethod` | MovimientosCaja | TEXT | Medio de pago (efectivo, tarjeta, Bizum, transferencia, Wix Payments u otro según enum). |
| `channelType` | MovimientosCaja | TEXT | Canal de la operación (presencial/online según enum). |
| `hash` | MovimientosCaja | TEXT | Huella del registro fiscal en la cadena del ledger. El campo físico canónico es `hash`. |
| `previousRecordHash` | MovimientosCaja / LibroAsientosContablesDetalle | TEXT | Huella del registro anterior al que se enlaza la cadena correspondiente. |
| `recordHash` | LibroAsientosContablesDetalle | TEXT | Huella de la línea contable. No confundir con `hash` de MovimientosCaja. |
| `entryId` | LibroAsientosContablesDetalle | TEXT | Identificador de asiento/conjunto de líneas contables relacionadas. |
| `lineNumber` | LibroAsientosContablesDetalle | NUMBER | Número de línea dentro del asiento. |
| `accountCode` | LibroAsientosContablesDetalle | TEXT | Código de cuenta contable aplicado a la línea. |
| `debitAmount` / `creditAmount` | LibroAsientosContablesDetalle | NUMBER | Importes de debe y haber de la línea contable. |
| `sourceMovementId` | LibroAsientosContablesDetalle | TEXT | Referencia al movimiento de origen. |
| `fiscalPeriod` | CajaActual / MovimientosCaja / LibroAsientosContablesDetalle / HistoricoCierresZ | TEXT | Periodo fiscal/operativo al que se asigna el registro. |
| `snapshotHash` | PaquetesGestoria | TEXT | Hash SHA-256 del snapshot documental del paquete. |
| `invoiceData` | PaquetesGestoria | ARRAY | Snapshot de facturas incluido en el paquete; descripción CMS lo define como array de snapshots inmutables. |

### 6.6 Inventario legacy — solo interpretación histórica

| Keyfield | Colección | Tipo | Significado documentado |
|---|---|---|---|
| `stockKey` | InventarioStockVenta / MovimientosInventario | TEXT | Clave canónica de producto/variante/ubicación en el esquema legacy. |
| `stockOnHand` | InventarioStockVenta | NUMBER | Stock físico disponible en el snapshot legacy. No es SSOT actual. |
| `stockReserved` | InventarioStockVenta | NUMBER | Stock reservado en el snapshot legacy. |
| `stockAvailable` | InventarioStockVenta | NUMBER | Stock disponible calculado en el modelo legacy. No usar para decisiones actuales. |
| `productId` / `variantId` | InventarioStockVenta / MovimientosInventario | TEXT | IDs de producto y variante asociados. Distinguir IDs de Wix Stores Catalog V3 y del modelo legacy. |
| `wixProductId` / `wixVariantId` | InventarioStockVenta / MovimientosInventario | TEXT | Referencias explícitas a producto/variante Wix. |
| `catalogVersion` | InventarioStockVenta / MovimientosInventario | TEXT | Versión del catálogo de Stores con la que se registró la referencia. |
| `locationId` | InventarioStockVenta / MovimientosInventario | TEXT | ID de ubicación de inventario Wix. |
| `quantityDelta` | MovimientosInventario | NUMBER | Variación cuantitativa de stock registrada en el movimiento histórico. |
| `stockBefore` / `stockAfter` | MovimientosInventario | NUMBER | Saldo anterior y posterior consignados en el movimiento histórico. |
| `movementToken` | MovimientosInventario | TEXT | Token idempotente histórico. |
| `stockApplied` | MovimientosInventario | BOOLEAN | Indica si el movimiento histórico se aplicó al saldo maestro legacy. |

## 7. Convenciones de nomenclatura

### 7.1 Estándar documental N1–N5 del proyecto

El dossier técnico define estas reglas:
- **N1 — keyfields:** `camelCase`; conservar identificadores nativos Wix en inglés (`bookingId`, `serviceId`, `resourceId`, `slug`). Para dominios AEAT/PGC se usan denominaciones normalizadas del dominio (`numSerieFactura`, `taxBase`, `tipoImpositivo`).
- **N2 — siglas:** mantener siglas en mayúsculas dentro del key (`payloadAEAT`).
- **N3 — etiquetas visibles:** traducir a español y expresar en camelCase, manteniendo orden y correspondencia con el key. Los identificadores nativos se conservan semánticamente (`serviceId` → etiqueta de servicio + ID).
- **N4 — claridad:** cada etiqueta debe identificar inequívocamente el dato y no reemplaza el key técnico.
- **N5 — enums:** todo campo de opciones cerradas debe tener enum canónico documentado y validado en backend.

### 7.2 Convenciones físicas observadas

| Patrón | Ejemplo | Lectura |
|---|---|---|
| Colección de negocio en PascalCase | `CitasF2`, `ServiciosCatalogo` | ID estable, sin espacios ni acentos |
| Nombre visible de colección en mayúsculas con guion bajo | `CITAS_F2`, `SERVICIOS_CATALOGO` | Etiqueta CMS de colección |
| Campo camelCase | `bookingStatus`, `totalAmount` | Convención dominante |
| Referencia por sufijo `Id` | `bookingId`, `resourceId`, `orderId` | Identificador externo/interno; siempre documentar sistema emisor |
| Instante por sufijo `At` | `occurredAt`, `recordedAt`, `deliveredAt` | Fecha-hora DATETIME |
| Fecha por sufijo `Date` | `operationDate`, `fechaOperacion` | Fecha DATE o, según esquema, DATETIME; revisar tipo real |
| Indicador booleano | `isOpen`, `active`, `needsWixReconciliation` | BOOLEAN |
| Huella criptográfica | `hash`, `recordHash`, `previousRecordHash` | No intercambiar entre ledgers |
| Versionado | `schemaVersion`, `revision`, `versionState` | Determinar si versiona esquema, proyección o estado |
| Referencia CMS | `MULTI_REFERENCE` | Relación CMS real, no texto libre |
| Campo compuesto | `OBJECT` | Subestructura; documentar propiedades internas por contrato |
| Array | `ARRAY`, `ARRAY_STRING` | Colección de valores/snapshots; definir tipo de elemento |
| Campo de sistema | Prefijo `_` | Reservado/gestionado por Wix cuando aplica |

**Diferencias y deuda de nomenclatura observada**
- No todos los keys están en camelCase puro: `NIFEmisor`, `NIFDestinatario`, `IRPFWithholdingRate`, `baseImponibleOImporteNoSujeto`, `payloadAEAT`, `ServiciosCatalogo_name`, `link-services-all` (este último pertenece a Wix App).
- Algunas etiquetas visibles CMS no siguen N3: muchas repiten el key en inglés; otras están en español; campos de sistema están en inglés.
- Hay mezcla de inglés/español en nombres fiscales y operativos. No renombrar automáticamente: son contratos físicos existentes y cualquier cambio puede romper consumidores.
- Hay campos de compatibilidad/históricos, por ejemplo `gestorNombre`; no eliminarlos sin búsqueda de consumidores y revisión de datos.
- Los tipos `OBJECT` y `ARRAY` no detallan aquí todos los subcampos internos; para esos objetos, el contrato de cada productor/consumidor y sus fixtures debe completar el esquema lógico.

### 7.3 Regla para nuevos campos

Antes de proponer un campo:
1. Buscar si existe un key canónico equivalente en la colección o en `internalConfig.js`.
2. Buscar todos los consumidores/escritores en `src/`.
3. Confirmar el sistema propietario del ID y la semántica de la relación.
4. Definir tipo CMS exacto, displayName español, descripción, enum y nulabilidad.
5. Actualizar validación centralizada, DTOs, WebMethods, tests y documentación.
6. Añadir/migrar solo con plan compatible, idempotente y aprobado.
7. Nunca crear alias para ocultar divergencias ni modificar ledger histórico.

## 8. Enums y opciones de respuesta

Los siguientes valores están respaldados por enums de backend o descripciones CMS. Los enums backend no son opciones configuradas en Wix CMS ni restricciones automáticas del almacenamiento.

| Colección.campo | Fuente y valores canónicos |
|---|---|
| `CitasF2.bookingStatus` | CITAS_BOOKING_STATUS: PENDING, CONFIRMED, COMPLETED, CANCELED, REFUNDED, NO_SHOW |
| `CitasF2.paymentStatus` | CITAS_PAYMENT_STATUS: NOT_PAID, PENDING_PAYMENT, PENDING_LEDGER, PAID, PARTIALLY_PAID, REFUNDED, PARTIALLY_REFUNDED, EXEMPT, UNDEFINED |
| `CitasF2.bookingType` | BOOKING_TYPE: SIMPLE, DUAL_F1, DUAL_F2 |
| `ControlOperativo.controlType` | CONTROL_TYPE: ALERT, COMPENSATION, DAYS_CACHE, DISPLAY_TOKEN, DUAL_CACHE, DEDUPE_KEY, LEDGER_IDEMPOTENCY, IDEMPOTENCY, SLOT_LOCK, RATE_LIMIT, SYSTEM_FLAG, WEBHOOK_CLAIM, WEBHOOK_EVENT |
| `CajaActual.cashRegisterStatus` | CASH_REGISTER_STATUS: ABIERTA, CERRADA |
| `CajaActual.paymentMethod` | PAYMENT_METHOD: EFECTIVO, TARJETA, BIZUM, TRANSFERENCIA, WIX_PAYMENTS |
| `CajaActual.lastOperationPaymentMethod` | PAYMENT_METHOD: EFECTIVO, TARJETA, BIZUM, TRANSFERENCIA, WIX_PAYMENTS |
| `CajaActual.lastOperationType` | MOVEMENT_TYPE: VENTA, VENTA_ONLINE, ANTICIPO, REEMBOLSO, DEVOLUCION, DEVOLUCION_SERVICIO, PROPINA, AJUSTE |
| `DatosFiscales.recordType` | RECORD_TYPE: GESTORIA, TERCERO, CONFIG_SISTEMA |
| `DatosFiscales.thirdPartyType` | THIRD_PARTY_TYPE: CLIENTE, STAFF, PROVEEDOR, EMISOR |
| `MapaStaff.rolWebsite` | ROL_WEBSITE: ADMIN, GESTION, ESTILISTA |
| `MapaStaff.rolBookings` | Wix Bookings staff role: STAFF |

| `RegistrosHorariosStaff.clockEventType` | CLOCK_EVENT_TYPE: ENTRADA, SALIDA, PAUSA_INICIO, PAUSA_FIN |
| `RegistrosHorariosStaff.recordType` | RECORD_TYPE_HORARIOS: REGULAR, AJUSTE |
| `ServiciosCatalogo.catalogEntryType` | CATALOG_ENTRY_TYPE: SERVICE, PRICING_PLAN |
| `ServiciosCatalogo.itemNature` | ITEM_NATURE: SERVICIO, PRODUCTO |
| `MovimientosCaja.paymentMethod` | PAYMENT_METHOD: EFECTIVO, TARJETA, BIZUM, TRANSFERENCIA, WIX_PAYMENTS |
| `MovimientosCaja.movementType` | MOVEMENT_TYPE: VENTA, VENTA_ONLINE, ANTICIPO, REEMBOLSO, DEVOLUCION, DEVOLUCION_SERVICIO, PROPINA, AJUSTE |
| `MovimientosCaja.channelType` | CHANNEL_TYPE: ONLINE, PRESENCIAL |
| `MovimientosCaja.tipoFactura` | TIPO_FACTURA: F1, F2, F3, R1, R2, R3, R4, R5 |
| `MovimientosCaja.fiscalRole` | FISCAL_ROLE: EMISOR, RECEPTOR |
| `MovimientosCaja.giftCardOperation` | Descripción CMS: SALE, REDEMPTION |
| `HistoricoCierresZ.closingSource` | Descripción CMS: MANUAL, CRON |

Los demás campos de texto no presentan opciones en los metadatos CMS consultados. Para Wix Apps, los enums propios deben contrastarse con el contrato oficial de la API correspondiente; no se deducen de nombres de campo.

## 9. Relaciones lógicas entre colecciones

| Origen | Key | Destino / significado |
|---|---|---|
| `CitasF2` | `bookingId` | Wix Bookings; identificador nativo de reserva |
| `CitasF2` | `serviceId` | Wix Bookings Services |
| `CitasF2` | `resourceId` | Wix Bookings Staff/Resource |
| `CitasF2` | `orderId` | Wix eCommerce/Stores Orders |
| `CitasF2` | `cashMovementId` | `MovimientosCaja` |
| `ComplementosCatalogo` | `ServiciosCatalogo_name` | `ServiciosCatalogo` mediante MULTI_REFERENCE |
| `ServiciosCatalogo` | `name` | `ComplementosCatalogo` mediante MULTI_REFERENCE |
| `ServiciosCatalogo` | `staffMembers` | `MapaStaff` mediante MULTI_REFERENCE |
| `MapaStaff` | `resourceId` | Wix Bookings resource |
| `MapaStaff` | `memberId` | Wix Members |
| `MapaStaff` | `staffMemberId` | Wix Bookings Staff Member |
| `MovimientosCaja` | `bookingId` | `CitasF2.bookingId` |
| `LibroAsientosContablesDetalle` | `cashMovementId` | `MovimientosCaja` |
| `LibroAsientosContablesDetalle` | `sourceMovementId` | Movimiento fuente del asiento |
| `MovimientosInventario` | `movementToken` | Idempotencia histórica de movimientos |
| `InventarioStockVenta` | `lastInventoryMovementId` | `MovimientosInventario._id` |

Las relaciones de la tabla son semánticas/contractuales; solo las marcadas MULTI_REFERENCE son relaciones físicas de referencia declaradas en el esquema CMS. Los campos TEXT con GUID no son referencias CMS por el mero hecho de contener un ID.

## 10. Permisos, inmutabilidad y límites de uso

**Política temporal del sitio aislado:** según la autorización expresa del propietario y el flag `ISOLATED_SITE_RECORD_MUTATIONS_ENABLED=true`, append-only e inmutabilidad están temporalmente en pausa para las colecciones propias del proyecto. Esta excepción no habilita mutaciones en WIX_APP ni desactiva RBAC, permisos, validaciones o gates de writers fiscales/contables/laborales. Restaurar las protecciones antes de cualquier actividad real solo cuando lo ordene el propietario.

- Las colecciones WIX_APP son propiedad de sus aplicaciones. No modificar directamente sus campos, tipos, datos ni permisos mediante este proyecto salvo flujo oficial aprobado.
- Antes de cualquier actividad real, los ledgers append-only no se editan ni borran. Las rectificaciones se incorporan como nuevos registros trazables.
- `CajaActual` es una proyección mutable de la sesión operativa y del efectivo físico. Los acumulados de tarjeta/Bizum no son efectivo ni saldo bancario; el ledger fuente sigue siendo `MovimientosCaja`.
- `InventarioStockVenta` y `MovimientosInventario` son legacy/históricos; no son autoridad de inventario actual.
- `RegistrosHorariosStaff` conserva datos sensibles laborales; sus writers permanecen deshabilitados hasta completar validación de seguridad, idempotencia, concurrencia y cumplimiento.
- `MovimientosCaja`, `LibroAsientosContablesDetalle`, `HistoricoCierresZ` y `PaquetesGestoria` no deben activarse por tener un esquema creado. Los flags fiscales/contables y el envío a gestoría permanecen fail-closed.
- `CitasF2` mantiene una incidencia P1 documentada de divergencia de estado con la reserva nativa Bookings. No corregir manualmente la proyección ni borrar la reserva.

## 11. Calidad del diccionario y discrepancias que requieren cierre

| ID | Hallazgo | Riesgo | Acción necesaria |
|---|---|---|---|
| CMS-DICT-01 | Las etiquetas CMS reales no siguen de forma general N3; predominan labels iguales al key en inglés | Baja legibilidad y divergencia con el estándar | Diseñar una matriz de etiquetas propuesta; no aplicarla sin revisión y compatibilidad |
| CMS-DICT-02 | `DatosFiscales` existe en el sitio actual con 28 campos y una fila placeholder; el código se alinea con ese esquema | No existe todavía configuración fiscal oficial | Mantener CONFIG_SISTEMA ausente y writers fail-closed hasta recibir datos oficiales y superar pruebas |
| CMS-DICT-03 | `RegistroIntegracion` existe pero no pertenece a `BUSINESS_COLLECTIONS` | Posible colección sin consumidor o contrato incompleto | Verificar consumidores/writers antes de adoptarla o retirarla |
| CMS-DICT-04 | El esquema live resume la subestructura OBJECT/ARRAY en los campos anidados que Wix devuelve en metadatos; no certifica toda la forma de payload de runtime | Contrato lógico parcial | Completar estructuras profundas contrastando DTOs, fixtures, productores/consumidores y APIs nativas |
| CMS-DICT-05 | IDs externos guardados como TEXT no son referencias CMS físicas | Integridad referencial depende de código | Documentar sistema propietario y validar GUID/relación en backend |
| CMS-DICT-06 | Esquemas CMS no sustituyen validación runtime | Datos mal tipados pueden persistir por rutas no protegidas | Mantener validación centralizada y tests de contrato |

## 12. Fuentes y método

### Evidencia Wix live
- Sitio objeto de trabajo: `50b39f33-e753-4331-ab35-b2ed43dc97f7` (banco de pruebas aislado, sin actividad real).
- Wix Data Collections API: listado live y lectura individual de las 23 colecciones (15 NATIVE y 8 WIX_APP), con campos, tipos, required, referencias tipadas, revisiones y metadatos disponibles.
- DatosFiscales existe en el inventario actual; InventarioStockVenta y MovimientosInventario existen físicamente, pero sus contratos/writers están retirados.
- El catálogo conserva las claves de campo y sus `displayName`; las descripciones se copian solo cuando Wix las declara. La ausencia de descripción no se suple con una suposición.
- Recuentos de elementos: Data Items Count API, corte de auditoría 2026-11-13.
- Ninguna mutación Wix durante la generación.

### Evidencia de repositorio
- `src/backend/internalConfig.js`: `BUSINESS_COLLECTIONS`, enums, flags fail-closed y constantes canónicas.
- `src/backend/validation.js`: contratos de validación de CitasF2, MapaStaff y ControlOperativo.
- `src/backend/citasManager.web.js`: consumidores de campos canónicos de reservas.
- `src/backend/accountingLedger.js`: contrato de huella y append-only contable.
- `DOSSIER TÉCNICO CONSOLIDADO.md`, sección 14 y secciones de modelo CMS/keyfields.
- `docs/qa/2026-11-13-citasf2-keyfields.md` y `docs/qa/2026-11-13-site-qa-environment.md`.

### Documentación oficial Wix
- [Wix Data APIs — Introduction](https://dev.wix.com/docs/api-reference/business-solutions/cms/introduction)
- [Data Collections API — Introduction](https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-collections/introduction)
- [List Data Collections](https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-collections/list-data-collections)
- [Get Data Collection](https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-collections/get-data-collection)
- [Wix App Collections](https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/wix-app-collections/introduction)

## 13. Mantenimiento del documento

Actualizar este diccionario cuando cambie cualquiera de estos elementos:
- Colección creada, retirada, renombrada o cambio de tipo.
- Campo creado/retirado, cambio de key, tipo, displayName, descripción, referencia o required.
- Enum o validación centralizada.
- Cambio de SSOT, propietario del dato o sistema externo de origen.
- Cambio de estado legacy/append-only o política de permisos.

Cada actualización debe incluir fecha/corte, entorno, revisión CMS, evidencia live, diff de código, consumidores afectados, pruebas y PR. No modificar Wix CMS como parte de una actualización documental.

## 14. Addendum histórico — contrato objetivo CajaActual / MovimientosCaja (2026-11-13)

> **Vigencia:** este addendum describe el diseño y las limitaciones observadas antes de la edición actual de CMS. Sus afirmaciones sobre revisión 49, ausencia de campos de ticket o ausencia de acumulado Bizum quedan supersedidas por el esquema live de revisión 64 documentado en §3.1 y §16. La presencia física de esos campos no acredita su implementación en backend.

**Autoridad y cardinalidad:** cada ticket/movimiento original permanece en `MovimientosCaja` como registro append-only. `CajaActual` conserva solo el resumen de la última operación, acumulados de la sesión y referencias a los IDs originales asociados a esa operación. No se copia a `CajaActual` el histórico completo de tickets.

**Datos de última operación:** actor resuelto en backend; instante exacto; tipo y descripción; conceptos/unidades cuando exista un contrato validado; importe y desglose por medio de pago; IDs fuente; `hash`, `previousRecordHash`, `sequenceNumber`, `recordTimestamp`, `digitalSignature` y `traceId` según disponibilidad del registro fuente. No reconstruir ni inventar datos ausentes.

**Acumulados:** la sesión debe distinguir al menos efectivo, tarjeta y Bizum, con importes y número de tickets/cobros. `cashAmount` y `expectedCash` continúan expresando efectivo físico y solo cambian por deltas físicos explícitos validados en backend. Tarjeta y Bizum presenciales actualizan los acumulados de sesión, nunca el efectivo físico. ONLINE, transferencias y pagos bancarios no se incorporan a la sesión física por inferencia.

**Límite histórico de implementación:** en el corte de revisión 49 faltaban campos de ticket, conceptos y acumulado Bizum. La revisión live 64 ya contiene `ticketNumber`, `ticketIssuedAt`, `ticketType`, `ticketSeries`, `ticketSequence`, campos de conceptos, precios, pago, referencias y `bizumAmount`. Sigue pendiente demostrar qué campos escriben/leen los módulos actuales; la migración de esquema no equivale a completar consumidores, validaciones, DTOs, WebMethods, hooks ni pruebas.

**Pagos mixtos y conceptos:** `MovimientosCaja.paymentMethod` es TEXT singular y `lineItems` es OBJECT sin contrato interno acreditado. No aceptar un desglose mixto ni mostrar cantidades como validadas hasta definir la estructura canónica, reglas de suma y pruebas de reconciliación. Cada movimiento fuente y su hash permanecen inmutables.

### Estado de implementación del contrato CajaActual — 2026-11-13

El código de la rama de trabajo reutiliza los campos físicos ya observados: `cashAmount` (efectivo físico), `netAmount` (mismo saldo físico), `cardAmount` (acumulado tarjeta), `bizumAmount` (acumulado Bizum), `staffResourceId`, `traceId` y `lastMovementAt`. La proyección se limita a cobros presenciales y a una sesión previamente abierta. No se crea ni se abre el singleton por efecto de un movimiento.

`getCashierState()` añade al DTO de lectura `sessionPayments` y `lastOperation`, derivados de los movimientos originales de `MovimientosCaja` entre `openedAt` y `closedAt`. `lastOperation.sourceMovementIds` referencia el `_id` original. Esto es una composición de lectura: **no significa que `lastOperation` o `lastMovementId` estén persistidos en `CajaActual`**. Los contadores por medio de pago se calculan desde el ledger, no se almacenan en columnas nuevas.

`openedBy`/`openedAt` siguen dependiendo de un flujo de apertura aún no implementado. El cierre Z manual guarda `closedBy` desde contexto backend, sujeto a que el writer continúe bloqueado por política. No hay migración CMS en esta rama. La revisión 49 es un corte histórico; la autoridad física vigente es la revisión 64 verificada en §3.1.

**Aclaración de campos reutilizados:** `sequenceCounters.appliedMovementIds` conserva los IDs de movimientos ya aplicados para deduplicación y referencia; `staffResourceId`, `traceId` y `lastMovementAt` reflejan el último movimiento proyectado. No existe columna física `lastMovementId` ni objeto `lastOperation` en la revisión 64. El proyector exige `recordTimestamp` válido. `salesCount` no representa todos los pagos; el contador por medio se deriva de `MovimientosCaja`.

`recordSource=MANUAL_PRESENCIAL_AUTHENTICATED` identifica movimientos presenciales manuales cuyo `staffResourceId` se obtuvo en backend desde la identidad autenticada. El frontend no puede asignar este valor. Los registros anteriores o de otro origen no se consideran autoría verificada aunque su `staffResourceId` pueda resolverse a un perfil.


## 15. Addendum — estado temporal de mutabilidad (2026-11-14)

La rama de desarrollo `chore/temporary-append-only-mutation-window` abre temporalmente update/remove individual para `MovimientosCaja`, `LibroAsientosContablesDetalle`, `RegistrosHorariosStaff`, `MovimientosInventario`, `HistoricoCierresZ`, `PaquetesGestoria` y los registros `ControlOperativo` de tipo `WEBHOOK_EVENT`.

Este estado temporal contradice deliberadamente la regla ordinaria de la sección 10 solo dentro de la rama de trabajo. No se ha aplicado a Wix live ni a los permisos de las colecciones. No hay bulk update/remove. La validación de inserciones permanece activa. No utilizar para alterar o eliminar datos reales sujetos a conservación legal.

**Reactivación previa a producción:** `APPEND_ONLY_MUTATION_WINDOW.ENABLED=false`; retirar ledgers de las allowlists de update/remove; restaurar tests que esperan `FISCAL_VIOLATION`; ejecutar CI completo y verificar hooks/permisos en Wix Local Editor. La publicación está bloqueada mientras esta excepción siga activa.


## 16. Addendum histórico — estado anterior y limpieza de datos sintéticos (2026-11-14)

## Estado histórico y limpieza de datos sintéticos — corte 2026-11-14

**Sitio:** `188bed94-177c-4bc9-a9f0-35080d874f3e`. **Rama de código:** `chore/temporary-append-only-mutation-window`. Este estado supersede los inventarios y addenda anteriores que contradigan estos datos.

### CMS verificado tras los cambios — HISTÓRICO, sustituido por §§2–3

> Este bloque conserva el corte anterior de 42 colecciones/revisión 64 de CajaActual. No representa el esquema live actual. La consulta completa del 2026-11-14 devuelve 41 colecciones (12 NATIVE, 29 WIX_APP), CajaActual revisión 13 y 80 campos; prevalecen §§2–3.

- Inventario live histórico: **42 colecciones** (13 `NATIVE`, 29 `WIX_APP`). `CajaActual` era `NATIVE`, revisión **64**, con **59 campos personalizados + 4 de sistema (63 físicos)**.
- **Permisos temporales:** las 13 `NATIVE` tienen `itemRead=ANYONE`; los permisos de insert/update/remove se preservaron sin cambios. En las 29 `WIX_APP`, Wix mantiene permisos definidos por las aplicaciones; 23 ya tenían lectura `ANYONE` y 6 mantienen restricciones de aplicación: `eCommerce/Orders`, `Forms/subscribers03`, `Marketing/Coupons`, `Members/PrivateMembersData`, `Stores/InventoryItems`, `Stores/Orders`. La documentación oficial indica que las colecciones de aplicaciones tienen permisos fijos.
- El esquema completo, con tipos y definiciones, queda documentado en §3.1.
- Los campos `operationDate`, `openingAmount`, `voucherAmount` e `isOpen` no existen en el esquema actual; sus sustitutos incluyen `operationDateHour`, los cuatro `opening*Amount` y `bizumAmount`.
- Estado del elemento singleton: el último readback documentado antes de esta revisión registraba `singletonKey=CAJA_PRINCIPAL` y caja cerrada. No se ha releído el elemento durante esta actualización de permisos; no se certifican aquí sus saldos ni su estado actual.
- Índice único `CajaActual_singletonKey_unique`: ACTIVE. Índice anterior `cashRegisterStatus_operationDate`: ya no aparece en el inventario final. Índice corregido `cashRegisterStatus_operationDateHour`: ACTIVE en el readback final.
- `MovimientosCaja`: revisión 78, 0 elementos; no modificada. `LibroAsientosContablesDetalle`: 0. `RegistrosHorariosStaff`: revisión 11, 0 tras limpieza. `HistoricoCierresZ`: 0. `PaquetesGestoria`: 0. `ControlOperativo`: 3 elementos. `MovimientosInventario` no figura en el inventario live de 42 colecciones; la fila histórica que lo describía como colección presente queda pendiente de reconciliación documental.

### Registros sintéticos eliminados

Se eliminaron únicamente dos filas de `RegistrosHorariosStaff`, tras releerlas y comprobar simultáneamente `meta.synthetic=true`, `meta.doNotImportToProduction=true`, `resourceId=QA_STAFF_ONLY`, `staffName=QA EMPLEADO FICTICIO` y notas que declaran que no acreditan jornada real:

- `1a4341a6-47be-490c-91a6-d04c8728e186` — `QA_LIVECMS_20261023_2000_TIME01_EXIT`.
- `f325c0c8-35ba-4efc-ac45-a409ab439e61` — `QA_LIVECMS_20261023_2000_TIME01_ENTRY`.

La eliminación se hizo por ID individual con condición de `traceId`; readback posterior: 0 filas restantes. Un barrido read-only de las 13 colecciones NATIVE no detectó otros candidatos con `meta.synthetic`, `doNotImportToProduction`, `runId/traceId` de simulación o `recordSource=SMOKE_TEST`. No se borró ningún fichaje real, movimiento de caja, asiento contable, cierre Z, paquete de gestoría ni registro de `ControlOperativo`. No se cambiaron permisos CMS ni se activaron writers.

### Ventana temporal TEC-033

**HISTÓRICO — TEC-033, sustituida por TEC-037.** El siguiente detalle describe la excepción inicial, limitada a update/remove individuales de determinados ledgers, y ya no representa la política vigente. La política actual está definida por `ISOLATED_SITE_RECORD_MUTATIONS_ENABLED=true`: update/remove individual y masivo en colecciones CMS propias, incluidos registros históricamente append-only. Las operaciones masivas requieren IDs explícitos. No se reactivan gates de inserción, writers fiscales/contables/laborales ni efectos externos.

La instrucción antigua de desactivar la ventana antes de fusionar o publicar queda sustituida: la política temporal está integrada en main para la fase de pruebas en el sitio aislado. Solo el usuario ordenará su restauración antes del despliegue. La publicación Wix de esta ampliación sigue pendiente.

### Alineación backend y estado pendiente

En esta rama, `cajas.web.js` y sus fixtures usan `operationDateHour`, `bizumAmount` y los cuatro campos `opening*Amount`; se ha retirado la comprobación redundante de `isOpen`. El DTO expone los cuatro saldos iniciales. **No existe todavía un WebMethod de apertura de sesión que persista esos cuatro importes**; por tanto permanecen null y la funcionalidad de apertura/saldos iniciales no está validada end-to-end. La proyección actual no se considera completa para `otherAmount` hasta probar su clasificación y conciliación desde `MovimientosCaja`.

No se ha ejecutado CI completo, Wix Local Editor ni E2E en runtime. No se ha publicado ni desplegado esta rama. La mutación CMS de este corte no equivale a publicar código Wix.

---


## Addendum de vigencia — contratos CMS del sitio actual (2026-11-14)

Este addendum sustituye los addenda históricos que describían MapaStaff como maestro fiscal o DatosFiscales como colección retirada.

**Esquema vigente leído en Wix Data API:** 23 colecciones (15 NATIVE y 8 WIX_APP), 524 campos NATIVE. MapaStaff tiene 18 campos/3 filas; DatosFiscales 28 campos/1 fila; ComplementosCatalogo 18 campos/36 filas; CajaActual 39 campos/1 fila; ControlOperativo 42 campos/0 filas.

**MapaStaff:** exclusivamente mapeo de identidad staff. Campos nativos relevantes: staffMemberId, resourceId, scheduleId y memberId. active es BOOLEAN. No existe recordType ni hay campos fiscales. _id es la clave del elemento CMS; resourceId conserva la identidad Bookings aunque coincida con _id en las tres filas.

**DatosFiscales:** maestro de terceros, gestoría y configuración fiscal. Declara recordType, taxId, legalName, thirdPartyType, address, verifactuEnabled, verifactuVersion, tipoUsoPosibleMultiOT, indicadorMultiplesOT, fechaInicioVerifactu (TEXT), gestorEmail, gestorName y gestorNombre. No declara traceId ni schemaVersion. gestorName es el keyfield canónico; gestorNombre queda retirado del contrato de código y pendiente de eliminación física.

**ComplementosCatalogo:** _id es el keyfield CMS canónico. addonId se conserva como espejo requerido por el esquema actual. El DTO addOnId se mantiene exclusivamente como contrato de transporte Bookings. name y description no se fusionan por tener tipos TEXT y RICH_TEXT. traceId está vacío y no tiene consumidor identificado.

**CajaActual y ControlOperativo:** sequenceCounters es OBJECT; ticketSequence no existe. ownerToken, retryAfter y nextRetryAt no son campos del esquema vigente; traceId es el fencing token canónico.

**Código en la rama** fix/current-site-cms-contract-alignment: separación de validadores/hooks MapaStaff y DatosFiscales; lectores y escritores fiscales migrados a DatosFiscales; keyfield _id para complementos; gestorName como nombre canónico. Cambios pendientes de CI y revisión PR. No se ha mutado el CMS ni se han migrado registros.

## Addendum de autoridad y pruebas en el sitio aislado — 2026-11-14

### Jerarquía de autoridad y SSOT

1. El propietario es la fuente de verdad de negocio, requisitos, prioridades, criterios de aceptación y autorizaciones.
2. La documentación oficial vigente de Wix y de cada integración define contratos, APIs, permisos y límites técnicos.
3. Las decisiones expresas posteriores del propietario prevalecen sobre cualquier registro histórico contradictorio.
4. Los dossiers, directrices, necesidades web, diccionario y estado del proyecto son documentación derivada; no crean autorizaciones por inferencia.
5. Código, configuración Wix, CMS y pruebas acreditan el estado implementado, no la autoridad para redefinir requisitos.

### Naturaleza y mutabilidad del sitio actual

El único sitio objeto de trabajo es 50b39f33-e753-4331-ab35-b2ed43dc97f7. Es un banco de pruebas aislado, sin actividad real, según declaración expresa del propietario. Los registros presentes se tratan como sintéticos.

ISOLATED_SITE_RECORD_MUTATIONS_ENABLED=true permite update/remove individuales y masivos en colecciones propias incluidas en ISOLATED_SITE_MUTABLE_COLLECTIONS. Las operaciones masivas requieren IDs explícitos y un máximo de 1.000 elementos. Las colecciones WIX_APP quedan excluidas. Se mantienen autenticación, autorización/RBAC, permisos CMS, validaciones, protección de secretos, allowlists de inserción y gates funcionales de writers/efectos externos.

La política temporal no habilita por sí misma pagos, reembolsos, facturación, fichajes, comunicaciones ni automatizaciones externas. No se han ejecutado mutaciones CMS ni publicado código Wix en esta intervención. La sincronización Editor↔Git y el SHA ejecutado por Wix siguen pendientes de acreditar.

