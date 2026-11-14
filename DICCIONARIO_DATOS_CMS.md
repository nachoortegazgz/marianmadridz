# Diccionario de datos CMS — Marian Madrid

> **Corte live:** 2026-11-14. **Entorno:** producción Wix, Site ID `188bed94-177c-4bc9-a9f0-35080d874f3e`. **Inventario:** 42 colecciones (13 NATIVE, 29 WIX_APP). **Cambios live de este corte:** creación de `CajaActual` con esquema corregido, singleton cerrado, índices reconciliados (ACTIVE en readback final) y eliminación de dos fichajes QA inequívocamente sintéticos. No se cambiaron permisos.
>
> El addendum de vigencia al inicio y §16 prevalecen sobre las tablas históricas que aún mencionen colecciones retiradas, revisiones antiguas o el contrato anterior de `CajaActual`. La fuente del esquema es Wix Data Collections API; los contratos de negocio se contrastan con el código de la rama identificada.



## 1. Alcance y criterio de lectura

Se documentan:
- Las 15 colecciones `NATIVE` del sitio de producción, con revisión live, nombre visible CMS, campo de presentación y todos los campos físicos observados.
- Las 29 colecciones `WIX_APP`, con nombre visible, propietario de aplicación, campo de presentación y número de campos. Sus esquemas son administrados por Wix Apps y no se redefinen aquí.
- Los keyfields de negocio y sus significados cuando están respaldados por el esquema, `internalConfig.js`, `validation.js` o documentación técnica del repositorio.
- Las reglas de nomenclatura que el dossier define como estándar y las diferencias reales que aparecen en CMS.

**Distinciones importantes**
1. `key` es el nombre técnico usado por CMS y backend.
2. `displayName` es la etiqueta visible del campo en el CMS. La Data Collections API no demuestra por sí sola el texto de etiquetas que se muestran a las clientas en formularios, páginas o widgets del frontend. Esas etiquetas pertenecen a la UI y deben auditarse en sus componentes.
3. `displayName` de colección es el nombre mostrado en CMS; `id` es el identificador estable usado en API/código.
4. Los campos `_id`, `_createdDate`, `_updatedDate` y `_owner` son campos de sistema de Wix cuando aparecen marcados como tales.
5. El esquema CMS describe tipos, pero Wix advierte que no constituye por sí mismo una validación estricta de cada valor escrito. Las validaciones del backend siguen siendo obligatorias.

## 2. Inventario de colecciones NATIVE

Recuento live documentado para producción: **42 colecciones (13 NATIVE y 29 WIX_APP)**. Los recuentos de elementos se obtuvieron mediante lectura de Data Items API tras la limpieza.

| ID de colección | Nombre visible CMS | Revisión de esquema | Campo de presentación | Elementos | Clasificación/uso |
|---|---|---:|---|---:|---|
| `CajaActual` | `CAJA_ACTUAL` | 3 | `singletonKey` | 1 | Proyección mutable de sesión; singleton |
| `CitasF2` | `CITAS_F2` | 42 | `bookingId` | 1 | Proyección interna de reservas |
| `ComplementosCatalogo` | `COMPLEMENTOS_CATALOGO` | 139 | `name` | 36 | Catálogo de complementos |
| `ControlOperativo` | `CONTROL_OPERATIVO` | 37 | `controlType` | 3 | Locks, idempotencia, webhooks, alertas y control |
| `DatosFiscales` | `DATOS_FISCALES` | 9 | `recordType` | 1 | Maestro fiscal de terceros/configuración |
| `HistoricoCierresZ` | `HISTORICO_CIERRES_Z` | 37 | `periodType` | 0 | Histórico de cierres Z |
| `LibroAsientosContablesDetalle` | `LIBRO_ASIENTOS_CONTABLES_DETALLE` | 27 | `entryId` | 0 | Ledger contable |
| `MapaStaff` | `MAPA_STAFF` | 23 | `displayName` | 3 | Correlación de identidades y recursos |
| `MovimientosCaja` | `MOVIMIENTOS_CAJA` | 78 | `numSerieFactura` | 0 | Ledger fiscal |
| `PaquetesGestoria` | `Paquetes de Gestoria (append-only)` | 3 | `periodType` | 0 | Snapshot documental |
| `RegistroIntegracion` | `REGISTRO_INTEGRACION` | 2 | `eventId` | 0 | Registro de integración; fuera de BUSINESS_COLLECTIONS |
| `RegistrosHorariosStaff` | `REGISTROS_HORARIOS_STAFF` | 11 | `resourceId` | 0 | Registro horario; writer deshabilitado |
| `ServiciosCatalogo` | `SERVICIOS_CATALOGO` | 195 | `slug` | 95 | Catálogo canónico de servicios y planes |



**Advertencia de autoridad**
- Wix CMS es la fuente de verdad transaccional propia del ecosistema.
- Wix Stores usa Catalog V3 como autoridad operativa del catálogo/stock comercial. `InventarioStockVenta` y `MovimientosInventario` se consideran legacy; conservar datos históricos y no reactivar writers por inferencia.
- `ServiciosCatalogo` está definido por el proyecto como maestro propio de configuración de servicios y planes; su sincronización completa con Wix Bookings debe probarse, no presumirse.
- `RegistroIntegracion` existe físicamente, pero no forma parte de `BUSINESS_COLLECTIONS` en `internalConfig.js`; no se ha demostrado un consumidor/writer activo.
- `HistoricoCierresZ`, `MovimientosCaja`, `LibroAsientosContablesDetalle`, `PaquetesGestoria` y `RegistrosHorariosStaff` deben tratarse conforme a sus restricciones de inmutabilidad/append-only y flags fail-closed. No editar ni borrar registros históricos.

## 3. Esquema físico de colecciones NATIVE

Formato: `key:TYPE`. Cuando no se indica otra cosa, el `displayName` de campo observado coincide con el `key`. Las etiquetas especiales de Wix se documentan en §4. El orden es el devuelto por Wix y no implica prioridad de negocio.

### 3.1 CajaActual — revisión 3 (esquema físico live)

```text
singletonKey:TEXT, operationDateHour:DATETIME, cashRegisterStatus:TEXT,
staffResourceId:TEXT, traceId:TEXT, openedAt:DATETIME, closedAt:DATETIME,
openingCashAmount:NUMBER, openingCardAmount:NUMBER, openingBizumAmount:NUMBER,
openingOtherAmount:NUMBER, cashAmount:NUMBER, cardAmount:NUMBER, bizumAmount:NUMBER,
otherAmount:NUMBER, salesCount:NUMBER, netAmount:NUMBER, expectedCash:NUMBER,
countedCash:NUMBER, difference:NUMBER, differenceReason:TEXT, lastMovementAt:DATETIME,
sequenceCounters:OBJECT, openedBy:TEXT, closedBy:TEXT,
_id:TEXT, _createdDate:DATETIME, _updatedDate:DATETIME, _owner:TEXT
```

**Estado del singleton:** `CAJA_PRINCIPAL`, cerrado, saldos actuales a cero y saldos de apertura null. No existe sesión abierta. `operationDateHour` permanece null hasta la primera operación. `cashRegisterStatus` es el único estado de sesión; no existen `isOpen`, `operationDate`, `openingAmount` ni `voucherAmount`.

**Índices:** `CajaActual_singletonKey_unique` ACTIVE/unique. `cashRegisterStatus_operationDateHour` ACTIVE tras el readback final. El índice anterior `cashRegisterStatus_operationDate` fue retirado.

**Contrato de proyección:** los saldos iniciales de efectivo, tarjeta, Bizum y otros se persisten al abrir una sesión real; no se rellenan con cero en una caja cerrada. Los saldos actuales se inicializan desde esos importes y se proyectan mediante movimientos válidos de `MovimientosCaja`. El efectivo físico se mantiene separado de tarjeta/Bizum/otros. El ledger fuente no se modifica.

**Límite de implementación:** el esquema CMS está corregido, pero todavía no existe un WebMethod de apertura que persista los cuatro saldos iniciales. Los campos de apertura permanecen null; no declarar el flujo de apertura ni la conciliación completa como operativos hasta implementar y probar ese writer.

### 3.2 CitasF2 — revisión 42

```text
slotStart:DATETIME, orderId:TEXT, timeZone:TEXT, cancellationReason:TEXT,
privacyNoticePurpose:TEXT, privacyNoticeAcceptedAt:DATETIME, privacyNoticeVersion:TEXT,
totalAmount:NUMBER, slotEnd:DATETIME, bookingId:TEXT, traceId:TEXT, bookingType:TEXT,
bookingStatus:TEXT, paymentStatus:TEXT, serviceId:TEXT, resourceId:TEXT, pairToken:TEXT,
dateYmd:TEXT, scheduleId:TEXT, contactDetails:OBJECT, thirdPartyId:TEXT, catalogId:TEXT,
cashMovementId:TEXT, fiscalData:OBJECT, invoicingDate:DATETIME, revision:NUMBER,
_id:TEXT, meta:OBJECT, _createdDate:DATETIME, _updatedDate:DATETIME, _owner:TEXT
```

**Contrato canónico raíz:** `bookingId`, `bookingStatus`, `paymentStatus`, `orderId`, `cashMovementId`, `serviceId`, `resourceId`, `scheduleId`, `slotStart`, `slotEnd`, `timeZone`, `traceId`. Los lectores mantienen root-first y fallback a `meta` para registros históricos. Los escritores nuevos no duplican dentro de `meta` los campos de estado/referencia que tienen columna raíz canónica.

### 3.3 ComplementosCatalogo — revisión 139

```text
sku:TEXT, taxIncluded:BOOLEAN, durationMinutes:NUMBER, tipoImpositivo:NUMBER,
addonId:TEXT, traceId:TEXT, name:TEXT, description:RICH_TEXT, _id:TEXT,
_owner:TEXT, price:NUMBER, itemNature:TEXT, codigoImpuesto:TEXT,
_updatedDate:DATETIME, _createdDate:DATETIME, claveRegimen:TEXT,
cuentaContableIngreso:TEXT, ServiciosCatalogo_name:MULTI_REFERENCE
```

### 3.4 ControlOperativo — revisión 37

```text
eventType:TEXT, occurredAt:DATETIME, controlType:TEXT, dedupeKey:TEXT,
traceId:TEXT, status:TEXT, eventId:TEXT, expiresAt:DATETIME, bookingId:TEXT,
pairToken:TEXT, resourceId:TEXT, serviceId:TEXT, slotStart:DATETIME,
slotEnd:DATETIME, dateYmd:TEXT, transactionId:TEXT, orderId:TEXT, refundId:TEXT,
kind:TEXT, attempts:NUMBER, maxAttempts:NUMBER, lastError:TEXT, totalAmount:NUMBER,
operationDescription:TEXT, severity:TEXT, alertType:TEXT, message:TEXT, surface:TEXT,
requesterKey:TEXT, requestCount:NUMBER, windowStart:DATETIME, payload:OBJECT,
version:NUMBER, processedAt:DATETIME, _id:TEXT, _createdDate:DATETIME,
_updatedDate:DATETIME, _owner:TEXT, heartbeatAt:DATETIME, operationDate:DATETIME,
revision:NUMBER, compensationKind:TEXT
```

### 3.5 DatosFiscales — revisión 9

```text
recordType:TEXT, streetNumber:TEXT, businessDescription:TEXT, currency:TEXT,
phone:TEXT, taxId:TEXT, legalName:TEXT, thirdPartyType:TEXT, address:TEXT,
taxRegime:TEXT, verifactuEnabled:BOOLEAN, verifactuVersion:TEXT,
tipoUsoPosibleMultiOT:BOOLEAN, indicadorMultiplesOT:BOOLEAN, fechaInicioVerifactu:TEXT,
email:TEXT, name:TEXT, label:TEXT, nif:TEXT, gestorEmail:TEXT, gestorName:TEXT,
gestorNombre:TEXT, gestorNif:TEXT, active:BOOLEAN,
_id:TEXT, _createdDate:DATETIME, _updatedDate:DATETIME, _owner:TEXT
```

**Nota de contrato:** el esquema físico contiene `active`, pero `validation.js` prohíbe expresamente que se envíe `active` a `assertDatosFiscales`. No usar ese campo en escrituras ni deducir que está operativo. El estado live anterior registra un placeholder y ausencia de un registro `CONFIG_SISTEMA` válido; mantener la activación fiscal bloqueada.

### 3.6 HistoricoCierresZ — revisión 37

```text
totalTips:NUMBER, snapshotJSON:TEXT, closedAt:DATETIME, timeZone:TEXT,
closingSchemaVersion:TEXT, closingSource:TEXT, auditedRecordsCount:NUMBER,
taxTypeBreakdown:OBJECT, movementTypeBreakdown:OBJECT, endTicketNumber:TEXT,
startTicketNumber:TEXT, totalOperations:NUMBER, totalAdjustments:NUMBER,
closeDate:DATE, totalRefunds:NUMBER, fiscalPeriod:TEXT, totalTaxAmount:NUMBER,
totalTaxBase:NUMBER, totalOnline:NUMBER, totalBizum:NUMBER, totalCard:NUMBER,
totalCash:NUMBER, closedBy:TEXT, recordDomain:TEXT, closingStatus:TEXT,
operationDate:DATE, consolidatedTotalAmount:NUMBER, grossSalesTotal:NUMBER,
netTaxableAmount:NUMBER, netTaxAmount:NUMBER, totalesMedioPago:OBJECT,
startSequence:NUMBER, endSequence:NUMBER, startRecordHash:TEXT, endRecordHash:TEXT,
isIntegrityVerified:BOOLEAN, closingHash:TEXT, closingSignature:TEXT,
closingSignatureStatus:TEXT, verifiedAt:DATETIME, approverUser:TEXT,
estadoEnvioAEAT:TEXT, traceId:TEXT, inventoryClosingId:TEXT, fiscalYear:NUMBER,
closingType:TEXT, sku:TEXT, wixProductId:TEXT, stockQuantity:NUMBER,
unitCost:NUMBER, stockValue:NUMBER, cuentaContable:TEXT, summaryData:OBJECT,
invoiceData:OBJECT, packageStatus:TEXT, packageVersion:NUMBER, sentTo:TEXT,
sentAt:DATETIME, _id:TEXT, _createdDate:DATETIME, _updatedDate:DATETIME, _owner:TEXT
```

### 3.7 InventarioStockVenta — revisión 20 (legacy)

```text
name:TEXT, catalogVersion:TEXT, locationId:TEXT, stockKey:TEXT,
lastInventoryMovementId:TEXT, lastInventoryMovementAt:DATETIME, location:TEXT,
tipoImpositivo:NUMBER, taxIncluded:BOOLEAN, price:NUMBER, sku:TEXT,
stockOnHand:NUMBER, stockReserved:NUMBER, stockAvailable:NUMBER,
wixProductId:TEXT, wixVariantId:TEXT, traceId:TEXT, stockId:TEXT,
productId:TEXT, variantId:TEXT, stockMinimo:NUMBER, reorderPoint:NUMBER,
reorderQuantity:NUMBER, needsWixReconciliation:BOOLEAN, lastSyncAt:DATETIME,
_id:TEXT, _createdDate:DATETIME, _updatedDate:DATETIME, _owner:TEXT
```

### 3.8 LibroAsientosContablesDetalle — revisión 27

```text
desgloseDetallado:OBJECT, entryId:TEXT, recordTimestamp:DATETIME,
cashMovementId:TEXT, concept:TEXT, lineNumber:NUMBER, origenTipo:TEXT,
origenRegistro:TEXT, sourceMovementId:TEXT, entryDate:DATE, fiscalPeriod:TEXT,
accountCode:TEXT, debitAmount:NUMBER, creditAmount:NUMBER, accountingAmount:NUMBER,
payloadFiscal:OBJECT, recordHash:TEXT, previousRecordHash:TEXT,
idSistemaInformatico:TEXT, bookingId:TEXT, orderId:TEXT, resourceId:TEXT, traceId:TEXT,
_id:TEXT, _createdDate:DATETIME, _updatedDate:DATETIME, _owner:TEXT
```

**Importante:** el esquema físico usa `sourceMovementId`; no existe `sourceEventId` en esta colección. `cashMovementId` es un campo de referencia distinto y opcional según el contrato técnico documentado. No construir un writer contable por analogía con otra colección.

### 3.9 MapaStaff — revisión 23

```text
displayName:TEXT, staffMemberId:TEXT, scheduleId:TEXT, thirdPartyId:TEXT,
staffName:TEXT, rolWebsite:TEXT, rolBookings:TEXT, memberId:TEXT,
resourceId:TEXT, active:BOOLEAN, sortOrder:NUMBER, sourceSystem:TEXT,
schemaVersion:NUMBER, ServiciosCatalogo_staffMembers:MULTI_REFERENCE,
_id:TEXT, _createdDate:DATETIME, _updatedDate:DATETIME, _owner:TEXT
```

### 3.10 MovimientosCaja — revisión 78

```text
resourceId:TEXT, payloadAEAT:OBJECT, NIFEmisor:TEXT, NIFDestinatario:TEXT,
IRPFWithholdingRate:NUMBER, IRPFWithholdingAmount:NUMBER,
baseImponibleOImporteNoSujeto:NUMBER, signatureAlgorithm:TEXT, hashAlgorithm:TEXT,
verificationQR:TEXT, digitalSignature:TEXT, generationTimestamp:DATETIME,
serviceIdRedeemed:TEXT, giftCardOperation:TEXT, giftCardId:TEXT, accountingSign:NUMBER,
lineItems:OBJECT, recordSource:TEXT, desgloseDetallado:OBJECT,
bankReconciliationReference:TEXT, vatAccrualStatus:TEXT, linkedAdvanceId:TEXT,
article20Exempt:BOOLEAN, cashBasisRegime:BOOLEAN, nonSubjectReason:TEXT,
issuerThirdPartyTaxId:TEXT, thirdPartyLegalName:TEXT,
issuedByThirdPartyOrRecipient:TEXT, isB2B:BOOLEAN, issuerLegalName:TEXT,
correctionAmount:NUMBER, issuerInvoiceNumber:TEXT, previousInvoiceIssueDate:DATE,
previousInvoiceNumber:TEXT, correctionReason:TEXT, withholdingBase:NUMBER,
surchargeRate:NUMBER, linkedBookingIds:ARRAY_STRING, bookingId:TEXT, hash:TEXT,
amount:NUMBER, taxAmount:NUMBER, taxBase:NUMBER, numSerieFactura:TEXT,
sequenceNumber:NUMBER, transactionId:TEXT, previousRecordHash:TEXT,
recordTimestamp:DATETIME, schemaVersion:TEXT, traceId:TEXT, movementType:TEXT,
totalAmount:NUMBER, paymentMethod:TEXT, channelType:TEXT, operationDescription:TEXT,
staffResourceId:TEXT, tipoFactura:TEXT, fechaExpedicionFactura:DATE,
fechaOperacion:DATE, tipoImpositivo:NUMBER, recipientLegalName:TEXT,
recipientAddress:OBJECT, payloadFiscal:OBJECT, sistemaInformatico:OBJECT,
estadoEnvioAEAT:TEXT, csvAEAT:TEXT, fechaEnvioAEAT:DATETIME, tipoRectificativa:TEXT,
previousInvoiceId:TEXT, claveRegimen:TEXT, calificacionOperacion:TEXT,
operacionExenta:BOOLEAN, inversionSujetoPasivo:BOOLEAN, surchargeAmount:NUMBER,
fiscalRole:TEXT, eventType:TEXT, thirdPartyId:TEXT, catalogId:TEXT, pairToken:TEXT,
orderId:TEXT, refundId:TEXT, fiscalPeriod:TEXT, accountingAmount:NUMBER,
projectionStatus:TEXT,
_id:TEXT, _createdDate:DATETIME, _updatedDate:DATETIME, _owner:TEXT
```

**Convención histórica:** el campo canónico de huella de este ledger es `hash`; `recordHash` no es el campo físico de `MovimientosCaja`. No intercambiarlo con `recordHash` del ledger contable.

### 3.11 MovimientosInventario — revisión 29 (histórico/legacy)

```text
variantId:TEXT, orderId:TEXT, productId:TEXT, stockApplied:BOOLEAN,
lineItemId:TEXT, catalogVersion:TEXT, locationId:TEXT, stockKey:TEXT,
magnitude:NUMBER, nativeCommercialMovement:BOOLEAN, requiresWixReconciliation:BOOLEAN,
actorMemberId:TEXT, actorEmail:TEXT, referenceId:TEXT, refundId:TEXT,
recordTimestamp:DATETIME, catalogId:TEXT, productName:TEXT, reason:TEXT,
movementToken:TEXT, movementType:TEXT, sku:TEXT, quantityDelta:NUMBER,
traceId:TEXT, direction:TEXT, quantity:NUMBER, stockBefore:NUMBER, stockAfter:NUMBER,
operationDescription:TEXT, sourceEventId:TEXT, thirdPartyId:TEXT,
wixProductId:TEXT, wixVariantId:TEXT, movementId:TEXT,
_id:TEXT, _createdDate:DATETIME, _updatedDate:DATETIME, _owner:TEXT
```

### 3.12 PaquetesGestoria — revisión 3

```text
invoiceData:ARRAY, periodType:TEXT, fiscalYear:NUMBER, fiscalMonth:NUMBER,
fiscalQuarter:NUMBER, packageVersion:NUMBER, summaryData:OBJECT,
packageStatus:TEXT, snapshotHash:TEXT, schemaVersion:TEXT, source:TEXT,
traceId:TEXT, createdAt:DATETIME,
_id:TEXT, _createdDate:DATETIME, _updatedDate:DATETIME, _owner:TEXT
```

### 3.13 RegistroIntegracion — revisión 2

```text
eventId:TEXT, eventType:TEXT, sourceModule:TEXT, sourceCollection:TEXT,
sourceItemId:TEXT, occurredAt:DATETIME, traceId:TEXT, correlationId:TEXT,
idempotencyKey:TEXT, schemaVersion:TEXT, payload:OBJECT, payloadHash:TEXT,
deliveryStatus:TEXT, deliveryAttempts:NUMBER, nextAttemptAt:DATETIME,
deliveredAt:DATETIME, lastDeliveryError:TEXT,
_id:TEXT, _createdDate:DATETIME, _updatedDate:DATETIME, _owner:TEXT
```

### 3.14 RegistrosHorariosStaff — revisión 11

```text
resourceId:TEXT, notes:TEXT, memberId:TEXT, recordedAt:DATETIME,
clockEventType:TEXT, recordType:TEXT, traceId:TEXT, adjustmentReason:TEXT,
signature:TEXT, recordedTime:TEXT, dayKey:TEXT, monthKey:TEXT, staffName:TEXT,
registeredBy:TEXT, registeredByMemberId:TEXT, deviceIpAddress:TEXT, meta:OBJECT,
_id:TEXT, _createdDate:DATETIME, _updatedDate:DATETIME, _owner:TEXT
```

### 3.15 ServiciosCatalogo — revisión 195

```text
sessionCount:NUMBER, staffMembers:MULTI_REFERENCE, pricingPlanId:TEXT,
catalogEntryType:TEXT, locationId:TEXT, description:TEXT, _id:TEXT,
serviceId:TEXT, title:TEXT, slug:TEXT, tagLine:TEXT, categoryId:TEXT,
itemNature:TEXT, sku:TEXT, price:NUMBER, currency:TEXT, taxIncluded:BOOLEAN,
tipoImpositivo:NUMBER, calificacionOperacion:TEXT, totalDuration:NUMBER,
phase1Duration:NUMBER, phase2Duration:NUMBER, exposureDuration:NUMBER,
allowCombine:BOOLEAN, linkedPhases:TEXT, location:TEXT, clientHidden:BOOLEAN,
onlinePayment:BOOLEAN, inPersonPayment:BOOLEAN, pricingModel:TEXT, depositType:TEXT,
depositAmount:NUMBER, margin:NUMBER, internalNotes:TEXT, category:TEXT,
precioCosteBase:NUMBER, _createdDate:DATETIME, mainMedia:IMAGE,
_updatedDate:DATETIME, _owner:TEXT, recomendaciones:TEXT,
name:MULTI_REFERENCE
```

## 4. Etiquetas visibles CMS observadas

La API devuelve `displayName` para cada campo. En la mayoría de los campos NATIVE, el valor es exactamente igual a `key`; por tanto, no están aplicadas de forma general las reglas de traducción de etiquetas del estándar N1–N5.

Diferencias exhaustivas entre `key` y `displayName` identificadas en la lectura de las 15 colecciones NATIVE:

| Colección | Key | Etiqueta CMS (`displayName`) |
|---|---|---|
| Todas las NATIVE | `_id` | `ID` |
| Todas las NATIVE | `_createdDate` | `Created Date` |
| Todas las NATIVE | `_updatedDate` | `Updated Date` |
| Todas las NATIVE | `_owner` | `Owner` |
| `ControlOperativo` | `eventType` | `Event Type` |
| `ControlOperativo` | `occurredAt` | `Occurred At` |
| `ControlOperativo` | `operationDate` | `Operationdate` |
| `DatosFiscales` | `recordType` | `Tipo de registro` |
| `DatosFiscales` | `streetNumber` | `Número fiscal` |
| `DatosFiscales` | `businessDescription` | `Descripción del negocio` |
| `DatosFiscales` | `currency` | `Moneda` |
| `DatosFiscales` | `phone` | `Teléfono fiscal` |
| `DatosFiscales` | `taxId` | `NIF / VAT` |
| `DatosFiscales` | `legalName` | `Razón social / nombre legal` |
| `DatosFiscales` | `thirdPartyType` | `Tipo de tercero` |
| `DatosFiscales` | `address` | `Domicilio fiscal` |
| `DatosFiscales` | `taxRegime` | `Régimen fiscal` |
| `DatosFiscales` | `verifactuEnabled` | `Veri*Factu habilitado` |
| `DatosFiscales` | `verifactuVersion` | `Versión Veri*Factu` |
| `DatosFiscales` | `tipoUsoPosibleMultiOT` | `Uso posible de múltiples OT` |
| `DatosFiscales` | `indicadorMultiplesOT` | `Indicador de múltiples OT` |
| `DatosFiscales` | `fechaInicioVerifactu` | `Fecha de inicio Veri*Factu` |
| `DatosFiscales` | `email` | `Email` |
| `DatosFiscales` | `name` | `Nombre` |
| `DatosFiscales` | `label` | `Etiqueta` |
| `DatosFiscales` | `nif` | `NIF de contacto` |
| `DatosFiscales` | `gestorEmail` | `Email gestoría` |
| `DatosFiscales` | `gestorName` | `Nombre gestoría` |
| `DatosFiscales` | `gestorNombre` | `Nombre gestoría (compatibilidad)` |
| `DatosFiscales` | `gestorNif` | `NIF gestoría` |
| `DatosFiscales` | `active` | `Activo` |
| `PaquetesGestoria` | `invoiceData` | `Facturas snapshot` |
| `PaquetesGestoria` | `periodType` | `Tipo de periodo` |
| `PaquetesGestoria` | `fiscalYear` | `Ejercicio fiscal` |
| `PaquetesGestoria` | `fiscalMonth` | `Mes fiscal` |
| `PaquetesGestoria` | `fiscalQuarter` | `Trimestre fiscal` |
| `PaquetesGestoria` | `packageVersion` | `Version del paquete` |
| `PaquetesGestoria` | `summaryData` | `Resumen fiscal snapshot` |
| `PaquetesGestoria` | `packageStatus` | `Estado del paquete` |
| `PaquetesGestoria` | `snapshotHash` | `SHA-256 snapshot` |
| `PaquetesGestoria` | `schemaVersion` | `Version del esquema` |
| `PaquetesGestoria` | `source` | `Origen del snapshot` |
| `PaquetesGestoria` | `traceId` | `Trace ID` |
| `PaquetesGestoria` | `createdAt` | `Fecha de creacion` |

En las demás parejas key/displayName de campos NATIVE, los nombres coinciden exactamente en el corte.
La tabla anterior no representa las etiquetas del frontend. Para documentar etiquetas visibles de la web hay que revisar cada formulario, repeater, tabla, widget y DTO que exponga el dato.

## 5. Colecciones WIX_APP — inventario y propiedad

Estas colecciones las crean/administran aplicaciones Wix. Se documentan para reconocer referencias, no para definir su contrato ni modificarlas desde el backend de negocio. El campo `displayField` es el campo que Wix usa para presentar el elemento en vistas de colección; no necesariamente es una etiqueta visible al público.

| ID | Display name | Display field | Campos | Owner App |
|---|---|---|---:|---|
| `Blog/Categories` | Categories | `slug` | 11 | Wix Blog |
| `Blog/Posts` | Posts | `slug` | 27 | Wix Blog |
| `Blog/Tags` | Tags | `slug` | 7 | Wix Blog |
| `Bookings/Schedule` | Schedule | `_id` | 5 | Wix Bookings |
| `Bookings/Services` | Services | `serviceName` | 20 | Wix Bookings |
| `Bookings/Staff` | Staff | `name` | 3 | Wix Bookings |
| `CampaignManager/campaigns` | Campaign Manager | `campaignType` | 32 | Campaign Manager |
| `CampaignManager/userConfig` | User Config | `addWidget` | 5 | Campaign Manager |
| `eCommerce/Orders` | Orders | `_id` | 45 | Wix eCommerce |
| `Forms/subscribers03` | Subscriptions | `submissionTime` | 6 | Wix Forms & Payments |
| `Locations/Locations` | Locations | `name` | 17 | Wix Locations |
| `Marketing/Coupons` | Coupons | `name` | 23 | Wix Marketing |
| `Members/Badges` | Badges | `title` | 11 | Wix Members |
| `Members/FullData` | FullData | `loginEmail` | 28 | Wix Members |
| `Members/PrivateMembersData` | PrivateMembersData | `loginEmail` | 15 | Wix Members |
| `Members/PublicData` | PublicData | `nickname` | 12 | Wix Members |
| `StoreCatalog/Brands` | Brands | `name` | 6 | Wix Stores Catalog V3 |
| `StoreCatalog/Categories` | Categories | `_id` | 17 | Wix Stores Catalog V3 |
| `StoreCatalog/Info sections` | Info Sections | `_id` | 9 | Wix Stores Catalog V3 |
| `StoreCatalog/Inventory` | Inventory | `_id` | 17 | Wix Stores Catalog V3 |
| `StoreCatalog/Product options & modifiers` | Product Options Modifiers | `_id` | 12 | Wix Stores Catalog V3 |
| `StoreCatalog/Products` | Products | `name` | 42 | Wix Stores Catalog V3 |
| `StoreCatalog/Ribbons` | Ribbons | `_id` | 6 | Wix Stores Catalog V3 |
| `StoreCatalog/Variants` | Variants | `_id` | 16 | Wix Stores Catalog V3 |
| `Stores/Collections` | Collections | `name` | 5 | Wix Stores |
| `Stores/InventoryItems` | InventoryItems | `_id` | 6 | Wix Stores |
| `Stores/Orders` | Orders | `number` | 23 | Wix Stores |
| `Stores/Products` | Products | `name` | 35 | Wix Stores |
| `Stores/Variants` | Variants | `fullVariantName` | 12 | Wix Stores |

**Versiones comprobadas en producción:** Wix Stores Catalog V3; Wix Invoices V1. No usar esquemas/REST de otra versión. No asumir que las colecciones `StoreCatalog/*` y `Stores/*` son intercambiables: pertenecen a espacios de datos/versiones de producto diferentes.

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
| `currentSequence` | CajaActual | NUMBER | Secuencia actual expuesta por el registro de caja. |
| `openingAmount` | CajaActual | NUMBER | Importe de apertura de caja física. |
| `cashAmount` | CajaActual | NUMBER | Importe de efectivo físico reflejado en la caja. |
| `expectedCash` | CajaActual | NUMBER | Efectivo esperado según movimientos físicos registrados. |
| `countedCash` | CajaActual | NUMBER | Efectivo contado físicamente en el arqueo. |
| `difference` / `differenceReason` | CajaActual | NUMBER / TEXT | Diferencia de arqueo y explicación asociada. |
| `cashRegisterStatus` / `isOpen` | CajaActual | TEXT / BOOLEAN | Estado de apertura/cierre de la caja física. |
| `taxId` | DatosFiscales | TEXT | NIF/NIE/CIF/VAT-UE del tercero; validado por `assertDatosFiscales`. |
| `legalName` | DatosFiscales | TEXT | Razón social/nombre legal del tercero. |
| `recordType` | DatosFiscales | TEXT | Discriminador fiscal; `RECORD_TYPE` contempla `TERCERO` y `CONFIG_SISTEMA`. |
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

## 8. Enums y valores cerrados conocidos

Los valores se mantienen exactamente como los define el backend. Esta lista no sustituye la lectura completa de `internalConfig.js`.

| Dominio | Keyfield | Valores canónicos observados |
|---|---|---|
| Tipo de catálogo | `ServiciosCatalogo.catalogEntryType` | `SERVICE`, `PRICING_PLAN` |
| Tipo de reserva | `CitasF2.bookingType` | `SIMPLE`, `DUAL_F1`, `DUAL_F2` |
| Estado de reserva CMS | `CitasF2.bookingStatus` | `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELED`, `REFUNDED`, `NO_SHOW` |
| Estado de pago CMS | `CitasF2.paymentStatus` | `NOT_PAID`, `PENDING_PAYMENT`, `PENDING_LEDGER`, `PAID`, `PARTIALLY_PAID`, `REFUNDED`, `PARTIALLY_REFUNDED`, `EXEMPT`, `UNDEFINED` |
| Tipo de registro fiscal | `DatosFiscales.recordType` | `TERCERO`, `CONFIG_SISTEMA` |
| Rol web | `MapaStaff.rolWebsite` / configuración backend | `ADMIN`, `GESTION`, `ESTILISTA` |
| Rol Bookings | `MapaStaff.rolBookings` | `STAFF` (valor canónico documentado) |
| Estado de caja | `CajaActual.cashRegisterStatus` | `ABIERTA`, `CERRADA` |
| Tipo de entrada de inventario | `InventarioStockVenta.itemNature` | El enum de escritura canónico es `SERVICIO`, `PRODUCTO`; valores históricos adicionales solo se aceptan en lectura según el código. |
| Tipo de tercero | `DatosFiscales.thirdPartyType` | `CLIENTE`, `PROVEEDOR`, `STAFF`, `AAPP`, `MIXTO`, `EMISOR` |

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

- Las colecciones WIX_APP son propiedad de sus aplicaciones. No modificar directamente sus campos, tipos, datos ni permisos mediante este proyecto salvo flujo oficial aprobado.
- Los ledgers append-only no se editan ni borran. Las rectificaciones se incorporan como nuevos registros trazables.
- `CajaActual` es una proyección mutable de la sesión operativa y del efectivo físico. Los acumulados de tarjeta/Bizum no son efectivo ni saldo bancario; el ledger fuente sigue siendo `MovimientosCaja`.
- `InventarioStockVenta` y `MovimientosInventario` son legacy/históricos; no son autoridad de inventario actual.
- `RegistrosHorariosStaff` conserva datos sensibles laborales; sus writers permanecen deshabilitados hasta completar validación de seguridad, idempotencia, concurrencia y cumplimiento.
- `MovimientosCaja`, `LibroAsientosContablesDetalle`, `HistoricoCierresZ` y `PaquetesGestoria` no deben activarse por tener un esquema creado. Los flags fiscales/contables y el envío a gestoría permanecen fail-closed.
- `CitasF2` mantiene una incidencia P1 documentada de divergencia de estado con la reserva nativa Bookings. No corregir manualmente la proyección ni borrar la reserva.

## 11. Calidad del diccionario y discrepancias que requieren cierre

| ID | Hallazgo | Riesgo | Acción necesaria |
|---|---|---|---|
| CMS-DICT-01 | Las etiquetas CMS reales no siguen de forma general N3; predominan labels iguales al key en inglés | Baja legibilidad y divergencia con el estándar | Diseñar una matriz de etiquetas propuesta; no aplicarla sin revisión y compatibilidad |
| CMS-DICT-02 | `DatosFiscales.active` existe en CMS, pero la validación backend prohíbe ese campo | Confusión de contrato/escritura | Resolver la discrepancia con análisis de consumidores y decisión explícita |
| CMS-DICT-03 | `RegistroIntegracion` existe pero no pertenece a `BUSINESS_COLLECTIONS` | Posible colección sin consumidor o contrato incompleto | Verificar consumidores/writers antes de adoptarla o retirarla |
| CMS-DICT-04 | Campos OBJECT/ARRAY no están completamente desglosados en este documento | Contrato lógico parcial | Completar desde DTOs, fixtures y productores/consumidores reales |
| CMS-DICT-05 | IDs externos guardados como TEXT no son referencias CMS físicas | Integridad referencial depende de código | Documentar sistema propietario y validar GUID/relación en backend |
| CMS-DICT-06 | Esquemas CMS no sustituyen validación runtime | Datos mal tipados pueden persistir por rutas no protegidas | Mantener validación centralizada y tests de contrato |

## 12. Fuentes y método

### Evidencia Wix live
- Sitio producción: `188bed94-177c-4bc9-a9f0-35080d874f3e`.
- Wix Data Collections API: listado de colecciones y lectura individual de las 44 colecciones.
- Para las 15 NATIVE se conservaron keys, displayNames y tipos físicos; revisión de esquema incluida en §2.
- Para las 29 WIX_APP se conservaron ID, displayName, ownerAppId, revision, displayField y fieldCount.
- Recuentos de elementos: Data Items Count API, corte de auditoría 2026-11-13.
- Ninguna mutación Wix durante la generación.

### Evidencia de repositorio
- `src/backend/internalConfig.js`: `BUSINESS_COLLECTIONS`, enums, flags fail-closed y constantes canónicas.
- `src/backend/validation.js`: contratos de validación de CitasF2, DatosFiscales y ControlOperativo.
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

## 14. Addendum — contrato objetivo CajaActual / MovimientosCaja (2026-11-13)

**Autoridad y cardinalidad:** cada ticket/movimiento original permanece en `MovimientosCaja` como registro append-only. `CajaActual` conserva solo el resumen de la última operación, acumulados de la sesión y referencias a los IDs originales asociados a esa operación. No se copia a `CajaActual` el histórico completo de tickets.

**Datos de última operación:** actor resuelto en backend; instante exacto; tipo y descripción; conceptos/unidades cuando exista un contrato validado; importe y desglose por medio de pago; IDs fuente; `hash`, `previousRecordHash`, `sequenceNumber`, `recordTimestamp`, `digitalSignature` y `traceId` según disponibilidad del registro fuente. No reconstruir ni inventar datos ausentes.

**Acumulados:** la sesión debe distinguir al menos efectivo, tarjeta y Bizum, con importes y número de tickets/cobros. `cashAmount` y `expectedCash` continúan expresando efectivo físico y solo cambian por deltas físicos explícitos validados en backend. Tarjeta y Bizum presenciales actualizan los acumulados de sesión, nunca el efectivo físico. ONLINE, transferencias y pagos bancarios no se incorporan a la sesión física por inferencia.

**Límite del esquema observado:** la revisión física 49 no contiene un bloque explícito de última operación, IDs fuente ni acumulado Bizum dedicado. Este addendum describe el contrato objetivo, no afirma que los campos existan. La migración requiere definir keys/tipos CMS, revisar consumidores, actualizar validación/DTOs/WebMethods/hooks/tests y comprobar la compatibilidad de `sequenceCounters` y `fiscalLedgerLock.js`. No ejecutar cambios CMS en esta actualización documental.

**Pagos mixtos y conceptos:** `MovimientosCaja.paymentMethod` es TEXT singular y `lineItems` es OBJECT sin contrato interno acreditado. No aceptar un desglose mixto ni mostrar cantidades como validadas hasta definir la estructura canónica, reglas de suma y pruebas de reconciliación. Cada movimiento fuente y su hash permanecen inmutables.

### Estado de implementación del contrato CajaActual — 2026-11-13

El código de la rama de trabajo reutiliza los campos físicos ya observados: `cashAmount` (efectivo físico), `netAmount` (mismo saldo físico), `cardAmount` (acumulado tarjeta), `voucherAmount` (acumulado Bizum según `CAJA_KEYS.BIZUM`), `staffResourceId`, `traceId` y `lastMovementAt`. La proyección se limita a cobros presenciales y a una sesión previamente abierta. No se crea ni se abre el singleton por efecto de un movimiento.

`getCashierState()` añade al DTO de lectura `sessionPayments` y `lastOperation`, derivados de los movimientos originales de `MovimientosCaja` entre `openedAt` y `closedAt`. `lastOperation.sourceMovementIds` referencia el `_id` original. Esto es una composición de lectura: **no significa que `lastOperation` o `lastMovementId` estén persistidos en `CajaActual`**. Los contadores por medio de pago se calculan desde el ledger, no se almacenan en columnas nuevas.

`openedBy`/`openedAt` siguen dependiendo de un flujo de apertura aún no implementado. El cierre Z manual guarda `closedBy` desde contexto backend, sujeto a que el writer continúe bloqueado por política. No hay migración CMS en esta rama. El esquema de la revisión 49 sigue siendo la autoridad física hasta que se apruebe y ejecute una migración.

**Aclaración de campos reutilizados:** `sequenceCounters.appliedMovementIds` conserva los IDs de movimientos ya aplicados para deduplicación y referencia; `staffResourceId`, `traceId` y `lastMovementAt` reflejan el último movimiento proyectado. No existe columna física `lastMovementId` ni objeto `lastOperation` en la revisión 49. El proyector exige `recordTimestamp` válido. `salesCount` no representa todos los pagos; el contador por medio se deriva de `MovimientosCaja`.

`recordSource=MANUAL_PRESENCIAL_AUTHENTICATED` identifica movimientos presenciales manuales cuyo `staffResourceId` se obtuvo en backend desde la identidad autenticada. El frontend no puede asignar este valor. Los registros anteriores o de otro origen no se consideran autoría verificada aunque su `staffResourceId` pueda resolverse a un perfil.


## 15. Addendum — estado temporal de mutabilidad (2026-11-14)

La rama de desarrollo `chore/temporary-append-only-mutation-window` abre temporalmente update/remove individual para `MovimientosCaja`, `LibroAsientosContablesDetalle`, `RegistrosHorariosStaff`, `MovimientosInventario`, `HistoricoCierresZ`, `PaquetesGestoria` y los registros `ControlOperativo` de tipo `WEBHOOK_EVENT`.

Este estado temporal contradice deliberadamente la regla ordinaria de la sección 10 solo dentro de la rama de trabajo. No se ha aplicado a Wix live ni a los permisos de las colecciones. No hay bulk update/remove. La validación de inserciones permanece activa. No utilizar para alterar o eliminar datos reales sujetos a conservación legal.

**Reactivación previa a producción:** `APPEND_ONLY_MUTATION_WINDOW.ENABLED=false`; retirar ledgers de las allowlists de update/remove; restaurar tests que esperan `FISCAL_VIOLATION`; ejecutar CI completo y verificar hooks/permisos en Wix Local Editor. La publicación está bloqueada mientras esta excepción siga activa.


## 16. Addendum — estado live corregido y limpieza QA (2026-11-14)

## Estado live y limpieza QA — corte 2026-11-14

**Sitio:** `188bed94-177c-4bc9-a9f0-35080d874f3e`. **Rama de código:** `chore/temporary-append-only-mutation-window`. Este estado supersede los inventarios y addenda anteriores que contradigan estos datos.

### CMS verificado tras los cambios

- Inventario live: **42 colecciones**. `CajaActual` existe como `NATIVE`, revisión **3**, 25 campos de negocio + 4 campos de sistema (29 físicos), permisos ADMIN en insert/update/remove/read.
- Campos físicos de negocio de `CajaActual`: `singletonKey:TEXT`, `operationDateHour:DATETIME`, `cashRegisterStatus:TEXT`, `staffResourceId:TEXT`, `traceId:TEXT`, `openedAt:DATETIME`, `closedAt:DATETIME`, `openingCashAmount:NUMBER`, `openingCardAmount:NUMBER`, `openingBizumAmount:NUMBER`, `openingOtherAmount:NUMBER`, `cashAmount:NUMBER`, `cardAmount:NUMBER`, `bizumAmount:NUMBER`, `otherAmount:NUMBER`, `salesCount:NUMBER`, `netAmount:NUMBER`, `expectedCash:NUMBER`, `countedCash:NUMBER`, `difference:NUMBER`, `differenceReason:TEXT`, `lastMovementAt:DATETIME`, `sequenceCounters:OBJECT`, `openedBy:TEXT`, `closedBy:TEXT`.
- No existen en el nuevo esquema `operationDate`, `openingAmount`, `voucherAmount` ni `isOpen`. `cashRegisterStatus` es el único estado de sesión.
- Singleton único: `_id=18d8bbf8-ddd5-4ad9-8253-f2a5c285ef19`, `singletonKey=CAJA_PRINCIPAL`, `cashRegisterStatus=CERRADA`. Saldos actuales: 0 en efectivo/tarjeta/Bizum/otros. Saldos iniciales: null (no se ha abierto sesión). `operationDateHour` permanece null; no hay operación económica ni sesión abierta.
- Índice único `CajaActual_singletonKey_unique`: ACTIVE. Índice anterior `cashRegisterStatus_operationDate`: ya no aparece en el inventario final. Índice corregido `cashRegisterStatus_operationDateHour`: ACTIVE en el readback final.
- `MovimientosCaja`: revisión 78, 0 elementos; no modificada. `LibroAsientosContablesDetalle`: 0. `RegistrosHorariosStaff`: revisión 11, 0 tras limpieza. `HistoricoCierresZ`: 0. `PaquetesGestoria`: 0. `ControlOperativo`: 3 elementos. `MovimientosInventario` no figura en el inventario live de 42 colecciones; la fila histórica que lo describía como colección presente queda pendiente de reconciliación documental.

### Registros sintéticos eliminados

Se eliminaron únicamente dos filas de `RegistrosHorariosStaff`, tras releerlas y comprobar simultáneamente `meta.synthetic=true`, `meta.doNotImportToProduction=true`, `resourceId=QA_STAFF_ONLY`, `staffName=QA EMPLEADO FICTICIO` y notas que declaran que no acreditan jornada real:

- `1a4341a6-47be-490c-91a6-d04c8728e186` — `QA_LIVECMS_20261023_2000_TIME01_EXIT`.
- `f325c0c8-35ba-4efc-ac45-a409ab439e61` — `QA_LIVECMS_20261023_2000_TIME01_ENTRY`.

La eliminación se hizo por ID individual con condición de `traceId`; readback posterior: 0 filas restantes. Un barrido read-only de las 13 colecciones NATIVE no detectó otros candidatos con `meta.synthetic`, `doNotImportToProduction`, `runId/traceId` QA o `recordSource=SMOKE_TEST`. No se borró ningún fichaje real, movimiento de caja, asiento contable, cierre Z, paquete de gestoría ni registro de `ControlOperativo`. No se cambiaron permisos CMS ni se activaron writers.

### Ventana temporal TEC-033

En esta rama `APPEND_ONLY_MUTATION_WINDOW.ENABLED=true`, `TEMPORARY=true`, `RESTORE_BEFORE_PRODUCTION=true`. Permite update/remove individual en `MovimientosCaja`, `LibroAsientosContablesDetalle`, `RegistrosHorariosStaff`, `MovimientosInventario`, `HistoricoCierresZ`, `PaquetesGestoria` y `ControlOperativo/WEBHOOK_EVENT`. Bulk insert/update/remove siguen bloqueados; las validaciones de inserción y los controles de autorización/tipo continúan activos. La bandera solo afecta a los hooks/políticas de esta rama; no cambia los permisos CMS ni el runtime publicado.

Los gates `LEDGER_WRITES_ENABLED=false`, `ACCOUNTING_LEDGER_WRITES_ENABLED=false` y `ALLOW_SIMULATION_RECORDS=false` permanecen cerrados. No publicar ni fusionar esta rama mientras la ventana esté activa. Antes de integrar: desactivar la bandera, retirar allowlists temporales, restaurar pruebas `FISCAL_VIOLATION`, ejecutar CI completo y verificar hooks en Wix Local Editor.

### Alineación backend y estado pendiente

En esta rama, `cajas.web.js` y sus fixtures usan `operationDateHour`, `bizumAmount` y los cuatro campos `opening*Amount`; se ha retirado la comprobación redundante de `isOpen`. El DTO expone los cuatro saldos iniciales. **No existe todavía un WebMethod de apertura de sesión que persista esos cuatro importes**; por tanto permanecen null y la funcionalidad de apertura/saldos iniciales no está validada end-to-end. La proyección actual no se considera completa para `otherAmount` hasta probar su clasificación y conciliación desde `MovimientosCaja`.

No se ha ejecutado CI completo, Wix Local Editor ni E2E en runtime. No se ha publicado ni desplegado esta rama. La mutación CMS de este corte no equivale a publicar código Wix.

---

