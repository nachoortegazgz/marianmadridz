# Auditoría integral CMS — 27-11-2026

**Sitio:** Marian Madrid · `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Repositorio base:** `main` · `1881955e62adda7ff10e187396f31f1857ad031a`  
**Corte:** 27-11-2026 · Wix Editor clásico · sitio Draft/no publicado.  
**Método:** Wix Data Collections API, Data Items API con `consistentRead=true`, y APIs oficiales Wix Stores Catalog V3.  
**Alcance de escritura:** solo dos definiciones de campo y tres metadatos de MapaStaff. Ningún ledger, cierre, pedido, producto, variante, pago o reserva fue modificado.

## 1. Resultado ejecutivo

- 41 colecciones inspeccionadas: 12 NATIVE y 29 WIX_APP.
- 731 items leídos: 242 NATIVE y 489 WIX_APP.
- Se corrigieron 2 tipos de campo en `ServiciosCatalogo` y 3 valores inválidos opcionales en `MapaStaff`.
- Se conservaron anomalías históricas en `MovimientosCaja`, `LibroAsientosContablesDetalle` y `HistoricoCierresZ`: son datos sintéticos preproducción y colecciones append-only.
- No se modificaron colecciones WIX_APP. El catálogo se contrastó con Catalog V3 oficial.
- No se ejecutaron pagos, reembolsos, reservas, escrituras fiscales/contables/laborales ni publicación.

## 2. Inventario NATIVE

| Colección | Revisión | Campos | Items |
|---|---:|---:|---:|
| CajaActual | 20 | 83 | 1 |
| CitasF2 | 60 | 29 | 12 |
| ComplementosCatalogo | 144 | 17 | 36 |
| ControlOperativo | 95 | 34 | 81 |
| HistoricoCierresZ | 44 | 66 | 1 |
| LibroAsientosContablesDetalle | 9 | 103 | 3 |
| MapaStaff | 136 | 44 | 5 |
| MovimientosCaja | 110 | 114 | 5 |
| RegistroIntegracion | 5 | 21 | 3 |
| RegistrosHorariosStaff | 2 | 47 | 0 |
| ServiciosCatalogo | 206 | 43 | 95 |
| TransaccionesTPV | 7 | 27 | 0 |
| **Total** | | **628** | **242** |

## 3. Inventario WIX_APP

Colecciones propiedad de Wix Apps. Los esquemas y datos se inspeccionaron, pero no se editaron.

| Colección | Revisión | Campos | Items |
|---|---:|---:|---:|
| Blog/Categories | 4 | 11 | 0 |
| Blog/Posts | 0 | 27 | 2 |
| Blog/Tags | 0 | 7 | 0 |
| Bookings/Schedule | 0 | 5 | 94 |
| Bookings/Services | 5 | 20 | 94 |
| Bookings/Staff | 0 | 3 | 3 |
| CampaignManager/campaigns | 0 | 32 | 1 |
| CampaignManager/userConfig | 0 | 5 | 1 |
| eCommerce/Orders | 0 | 46 | 34 |
| Forms/subscribers03 | 0 | 6 | 2 |
| Locations/Locations | 6 | 17 | 4 |
| Marketing/Coupons | 0 | 23 | 3 |
| Members/Badges | 0 | 11 | 2 |
| Members/FullData | 0 | 28 | 13 |
| Members/PrivateMembersData | 4 | 15 | 13 |
| Members/PublicData | 0 | 12 | 9 |
| StoreCatalog/Brands | 0 | 6 | 12 |
| StoreCatalog/Categories | 0 | 17 | 15 |
| StoreCatalog/Info sections | 0 | 9 | 1 |
| StoreCatalog/Inventory | 0 | 17 | 30 |
| StoreCatalog/Product options & modifiers | 0 | 12 | 3 |
| StoreCatalog/Products | 0 | 42 | 24 |
| StoreCatalog/Ribbons | 0 | 6 | 5 |
| StoreCatalog/Variants | 0 | 16 | 30 |
| Stores/Collections | 0 | 5 | 15 |
| Stores/InventoryItems | 0 | 6 | 24 |
| Stores/Orders | 0 | 23 | 1 |
| Stores/Products | 7 | 35 | 24 |
| Stores/Variants | 0 | 12 | 30 |
| **Total WIX_APP** | | | **489** |

## 4. Correcciones aplicadas y verificadas

### 4.1 ServiciosCatalogo — tipos de arrays

**Diagnóstico:** `bookingsStaffNames` y `bookingsStaff` estaban declarados como `OBJECT`. En 93 de los 95 items ambos campos contenían arrays cuyos elementos son cadenas; los dos restantes los dejan vacíos. El esquema no representaba el dato persistido.

**Corrección:** ambos campos actualizados a `ARRAY_STRING` mediante Wix Update Data Collection Field. La revisión de la colección pasó de 204 a 206. No se transformaron ni sobrescribieron los 95 items.

**Verificación:** lectura posterior confirma los dos tipos `ARRAY_STRING`; todos los valores existentes cumplen array de strings o están vacíos. Sin pérdida de valores.

### 4.2 MapaStaff — schemaVersion inválido

**Diagnóstico:** tres registros `recordType=STAFF` contenían `schemaVersion="N/A"`, incompatible con el tipo físico NUMBER. El validador de STAFF permite omitir este campo; exige entero positivo cuando se informa.

**Corrección:** retirada únicamente la propiedad `schemaVersion` de esos tres registros mediante Bulk Patch con condición `recordType=STAFF AND schemaVersion="N/A"`. No se asignó una versión inventada.

**Verificación:** 3/3 parches correctos, 0 fallos; lectura posterior confirma ausencia del placeholder en los tres registros. Los registros TERCERO y GESTORIA no se modificaron.

## 5. Contratos y anomalías en colecciones propias

### Colecciones sin incidencias de tipo ni required físico

- `CitasF2`: 12 items; 11 CONFIRMED, 1 PENDING; 10 NOT_PAID, 2 PENDING_LEDGER; 6 SIMPLE, 3 DUAL_F1, 3 DUAL_F2. Los 11 campos required están presentes y sus tipos son correctos.
- `ComplementosCatalogo`: 36 items; sus 3 campos required están presentes.
- `ControlOperativo`: 81 items; los 4 campos required están presentes y los tipos son correctos. La auditoría específica anterior y PR #654 ya endurecieron el contrato de SLOT_LOCK; no se modificaron registros terminales legacy.
- `RegistroIntegracion`: 3 items, deliveryStatus=NOT_SENT; sin campos required ausentes ni tipos incorrectos.
- `ServiciosCatalogo`: 95 items; tras la corrección, sin discrepancias de tipo.
- `CajaActual`: 1 singleton ABIERTA; tipos correctos, pero contiene tres claves raíz no declaradas.
- `RegistrosHorariosStaff` y `TransaccionesTPV`: 0 items. El esquema existe; no hay evidencia de inserciones runtime.

### Ledgers y cierres históricos incompletos

**MovimientosCaja — 5 items**

Los cinco registros muestran status SIMULATED_SUCCESS y son anteriores al despliegue de producción 2027. Tres tienen recordSource=TPV_QA_DEVELOPMENT; los otros dos presentan marcadores legacy diferentes. Se observan 67 ausencias acumuladas en campos físicos required. Entre los campos ausentes están hash, numSerieFactura, sequenceNumber, previousRecordHash, recordTimestamp, schemaVersion, operationDescription, staffResourceId, tipoFactura, fechaExpedicionFactura, tipoImpositivo y fiscalPeriod; uno carece además de transactionId. Dos carecen de movementType, totalAmount y channelType.

También persisten 15 propiedades raíz no declaradas: `synthetic`, `cashDelta`, `source`, `gatewayResponse`, `operationType`, `reconciliationStatus`, `testCase`, `changeReturned`, `operationDateHour`, `status`, `customer`, `cardDelta`, `otherDelta`, `amountReceived` y `createdAt`.

**Decisión:** conservar. Es ledger append-only; no completar, actualizar ni eliminar registros. El writer actual y sus validadores deben seguir rechazando entradas nuevas incompletas. La clasificación de estas filas históricas no las convierte en movimientos válidos.

**LibroAsientosContablesDetalle — 3 items**

Los tres tienen `projectionStatus=SIMULATED_ONLY` y carecen de campos exigidos por `assertAccountingLedgerRecord`, entre ellos journalEntryId, recordSource, documentId, fechaOperacion, sequenceNumber, hash, previousRecordHash y desgloseDetallado completo.

**Decisión:** conservar sin reescritura. El writer central y el hook beforeInsert ya validan el contrato; no reutilizar estos registros como asientos contables válidos.

**HistoricoCierresZ — 1 item**

Registro SIMULATED con `recordDomain=TPV_CUSTOM_QA`; faltan `fiscalPeriod`, `totalTaxAmount`, `totalTaxBase` y `operationDate`, todos required. El validador `assertHistoricoCierresZ` exige esos campos.

**Decisión:** conservar sin reescritura. El registro no acredita un cierre operativo ni fiscal.

### Otras propiedades raíz no declaradas

- `CajaActual`: `posOrderId`, `posTransactionId`, `posPaymentId`. La sesión está ABIERTA; no modificarla ni reutilizarla como fixture.
- `MapaStaff`: un item conserva una propiedad `email` no declarada. No se modificó porque requiere trazar consumidores y origen.
- `ControlOperativo`, `CitasF2`, `ComplementosCatalogo`, `RegistroIntegracion` y `ServiciosCatalogo`: sin propiedades raíz desconocidas en el corte.

## 6. Contraste de Wix Stores Catalog V3

`StoreCatalog/Products` tiene 24 items y el campo `variantsInfo` está marcado required en su esquema, pero no aparece en los 24 registros CMS. No se parcheó: es una colección WIX_APP administrada por Wix.

Contraste con APIs oficiales de Catalog V3, solo lectura:

- Query Products: 24 productos, sin página siguiente.
- Query Variants: 30 variantes, sin página siguiente.
- Los 24 IDs de producto de la colección CMS coinciden con los 24 productos devueltos por Catalog V3.
- Los 30 registros de variantes se distribuyen entre los 24 productos; todos tienen al menos una variante.

**Conclusión:** el CMS app-owned no expone `variantsInfo` en esos items, pero el catálogo nativo sí devuelve el conjunto completo de productos y variantes. No inferir pérdida de variantes ni escribir sobre StoreCatalog/Products. Los lectores operativos deben usar Catalog V3 Products/Variants, no reconstruir el catálogo a partir de ese campo ausente.

Se observaron además valores array en campos declarados OBJECT en colecciones WIX_APP (por ejemplo Members/PrivateMembersData, Stores/InventoryItems, Stores/Orders y Stores/Products). Se conservan sin cambios: sus contratos y serialización pertenecen a Wix Apps; no aplicar normalizaciones genéricas de colecciones propias.

## 7. Validación, alcance y límites

**VERIFICADO**
- 41/41 esquemas leídos.
- 41/41 colecciones paginadas hasta el final: 731 items.
- 12/12 colecciones NATIVE auditadas contra required físico, tipos y claves raíz.
- Dos campos de ServiciosCatalogo leídos de nuevo como ARRAY_STRING.
- Tres registros STAFF leídos de nuevo sin schemaVersion="N/A".
- 24 productos y 30 variantes confirmados mediante APIs Catalog V3.

**NO EJECUTADO**
- No se modificó código backend; por tanto, no se ejecutaron suites unitarias, integración ni CI en esta intervención documental.
- No se ejecutó Wix Preview, runtime ni producción.
- No se validó sincronización Git–Editor ni publicación.
- No se ejecutaron cierres, ventas, reembolsos, escrituras fiscales/contables/laborales ni envíos externos.

**Límites:** la lectura CMS acredita estado almacenado y esquema, no la autoría de los registros ni el comportamiento de hooks en runtime. Los datos anteriores al despliegue oficial 2027 se consideran sintéticos por la política del proyecto. Los registros append-only permanecen intactos.

## 8. Referencias oficiales Wix

- [List Data Collections](https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-collections/list-data-collections)
- [Get Data Collection](https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-collections/get-data-collection)
- [Query Data Items](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/query-data-items)
- [Update Data Collection Field](https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-collections/update-data-collection-field)
- [Bulk Patch Data Items](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/bulk-patch-data-items)
- [Catalog V3 Query Products](https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/products-v3/query-products)
- [Catalog V3 Query Variants](https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/read-only-variants-v3/query-variants)
