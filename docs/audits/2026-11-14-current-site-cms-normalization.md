# Auditoría de esquema CMS y normalización — sitio actual

**Fecha de lectura:** 2026-11-14  
**Site ID:** `50b39f33-e753-4331-ab35-b2ed43dc97f7`  
**Plataforma:** Wix Editor Classic + Velo  
**Alcance:** lectura de Data Collections API y lectura de registros CMS. No se ejecutaron escrituras, migraciones ni borrados.

## 1. Resultado del inventario

- 23 colecciones totales: 15 NATIVE y 8 WIX_APP.
- 524 definiciones físicas de campo en colecciones NATIVE.
- 140 registros distribuidos en las colecciones NATIVE.
- El propietario declara que el sitio es un banco de pruebas aislado y no tiene actividad real. Los registros se tratan como sintéticos y no como evidencia de actividad.

| Colección | Revisión | Campos | Registros |
|---|---:|---:|---:|
| CajaActual | 1 | 39 | 1 |
| CitasF2 | 1 | 34 | 0 |
| ComplementosCatalogo | 1 | 18 | 36 |
| ControlOperativo | 1 | 42 | 0 |
| DatosFiscales | 1 | 28 | 1 |
| HistoricoCierresZ | 1 | 62 | 0 |
| InventarioStockVenta | 1 | 29 | 1 |
| LibroAsientosContablesDetalle | 1 | 27 | 0 |
| MapaStaff | 1 | 18 | 3 |
| MovimientosCaja | 1 | 88 | 0 |
| MovimientosInventario | 1 | 38 | 1 |
| PaquetesGestoria | 1 | 17 | 0 |
| RegistroIntegracion | 1 | 21 | 0 |
| RegistrosHorariosStaff | 1 | 21 | 2 |
| ServiciosCatalogo | 1 | 42 | 95 |

### Colecciones administradas por Wix Apps

| ID de colección | Nombre visible | Campos | ownerAppId |
|---|---|---:|---|
| `CampaignManager/campaigns` | Campaign Manager | 32 | `7fdf5576-9d52-4c0a-9840-6e226f2ec415` |
| `CampaignManager/userConfig` | User Config | 5 | `7fdf5576-9d52-4c0a-9840-6e226f2ec415` |
| `Forms/subscribers03` | Subscriptions | 6 | `14ce1214-b278-a7e4-1373-00cebd1bef7c` |
| `Locations/Locations` | Locations | 17 | No informado |
| `Members/Badges` | Badges | 11 | `SiteMembers` |
| `Members/FullData` | FullData | 18 | `SiteMembers` |
| `Members/PrivateMembersData` | PrivateMembersData | 15 | `SiteMembers` |
| `Members/PublicData` | PublicData | 10 | `SiteMembers` |

## 2. Manifiesto físico de colecciones propias

Los campos de sistema Wix (`_id`, `_createdDate`, `_updatedDate`, `_owner`) se incluyen tal como devuelve la API. Los campos TEXT que terminan en `Id` no son referencias CMS tipadas salvo que Wix declare explícitamente REFERENCE/MULTI_REFERENCE.

```text
CajaActual:
netAmount NUMBER; closedBy TEXT; sequenceCounters OBJECT; versionState NUMBER; stateHash TEXT; lastMovementAt DATETIME; differenceReason TEXT; difference NUMBER; countedCash NUMBER; expectedCash NUMBER; cashAmount NUMBER; totalOutAmount NUMBER; totalInAmount NUMBER; paymentAmount NUMBER; paymentCount NUMBER; refundAmount NUMBER; refundCount NUMBER; salesAmount NUMBER; salesCount NUMBER; otherAmount NUMBER; voucherAmount NUMBER; cardAmount NUMBER; openedBy TEXT; openingAmount NUMBER; closedAt DATETIME; openedAt DATETIME; traceId TEXT; staffResourceId TEXT; operationDate DATE; cashRegisterStatus TEXT; singletonKey TEXT; isOpen BOOLEAN; id TEXT; currentSequence NUMBER; fiscalPeriod TEXT; _id TEXT; _createdDate DATETIME; _updatedDate DATETIME; _owner TEXT.

CitasF2:
slotStart DATETIME; timeZone TEXT; noShowReason TEXT; noShowAt DATETIME; cancellationReason TEXT; canceledAt DATETIME; privacyNoticePurpose TEXT; privacyNoticeAcceptedAt DATETIME; privacyNoticeVersion TEXT; totalAmount NUMBER; slotEnd DATETIME; bookingId TEXT; traceId TEXT; bookingType TEXT; bookingStatus TEXT; paymentStatus TEXT; serviceId TEXT; resourceId TEXT; pairToken TEXT; dateYmd TEXT; scheduleId TEXT; contactDetails OBJECT; thirdPartyId TEXT; catalogId TEXT; cashMovementId TEXT; fiscalData OBJECT; invoicingDate DATETIME; sourceEventId TEXT; revision NUMBER; _id TEXT; meta OBJECT; _createdDate DATETIME; _updatedDate DATETIME; _owner TEXT.

ComplementosCatalogo:
sku TEXT; taxIncluded BOOLEAN; durationMinutes NUMBER; tipoImpositivo NUMBER; addonId TEXT; traceId TEXT; name TEXT; description RICH_TEXT; _id TEXT; _owner TEXT; price NUMBER; itemNature TEXT; codigoImpuesto TEXT; _updatedDate DATETIME; _createdDate DATETIME; claveRegimen TEXT; cuentaContableIngreso TEXT; ServiciosCatalogo_name MULTI_REFERENCE.

ControlOperativo:
eventType TEXT; occurredAt DATETIME; controlType TEXT; dedupeKey TEXT; traceId TEXT; status TEXT; eventId TEXT; expiresAt DATETIME; bookingId TEXT; pairToken TEXT; resourceId TEXT; serviceId TEXT; slotStart DATETIME; slotEnd DATETIME; dateYmd TEXT; transactionId TEXT; orderId TEXT; refundId TEXT; kind TEXT; attempts NUMBER; maxAttempts NUMBER; lastError TEXT; totalAmount NUMBER; operationDescription TEXT; severity TEXT; alertType TEXT; message TEXT; surface TEXT; requesterKey TEXT; requestCount NUMBER; windowStart DATETIME; payload OBJECT; version NUMBER; processedAt DATETIME; _id TEXT; _createdDate DATETIME; _updatedDate DATETIME; _owner TEXT; heartbeatAt DATETIME; operationDate DATETIME; revision NUMBER; compensationKind TEXT.

DatosFiscales:
recordType TEXT; streetNumber TEXT; businessDescription TEXT; currency TEXT; phone TEXT; taxId TEXT; legalName TEXT; thirdPartyType TEXT; address TEXT; taxRegime TEXT; verifactuEnabled BOOLEAN; verifactuVersion TEXT; tipoUsoPosibleMultiOT BOOLEAN; indicadorMultiplesOT BOOLEAN; fechaInicioVerifactu TEXT; email TEXT; name TEXT; label TEXT; nif TEXT; gestorEmail TEXT; gestorName TEXT; gestorNombre TEXT; gestorNif TEXT; active BOOLEAN; _id TEXT; _createdDate DATETIME; _updatedDate DATETIME; _owner TEXT.

HistoricoCierresZ:
totalTips NUMBER; snapshotJSON TEXT; closedAt DATETIME; timeZone TEXT; closingSchemaVersion TEXT; closingSource TEXT; auditedRecordsCount NUMBER; taxTypeBreakdown OBJECT; movementTypeBreakdown OBJECT; endTicketNumber TEXT; startTicketNumber TEXT; totalOperations NUMBER; totalAdjustments NUMBER; closeDate DATE; totalRefunds NUMBER; fiscalPeriod TEXT; totalTaxAmount NUMBER; totalTaxBase NUMBER; totalOnline NUMBER; totalBizum NUMBER; totalCard NUMBER; totalCash NUMBER; closedBy TEXT; recordDomain TEXT; closingStatus TEXT; operationDate DATE; consolidatedTotalAmount NUMBER; grossSalesTotal NUMBER; netTaxableAmount NUMBER; netTaxAmount NUMBER; totalesMedioPago OBJECT; startSequence NUMBER; endSequence NUMBER; startRecordHash TEXT; endRecordHash TEXT; isIntegrityVerified BOOLEAN; closingHash TEXT; closingSignature TEXT; closingSignatureStatus TEXT; verifiedAt DATETIME; approverUser TEXT; estadoEnvioAEAT TEXT; traceId TEXT; inventoryClosingId TEXT; fiscalYear NUMBER; closingType TEXT; sku TEXT; wixProductId TEXT; stockQuantity NUMBER; unitCost NUMBER; stockValue NUMBER; cuentaContable TEXT; summaryData OBJECT; invoiceData OBJECT; packageStatus TEXT; packageVersion NUMBER; sentTo TEXT; sentAt DATETIME; _id TEXT; _createdDate DATETIME; _updatedDate DATETIME; _owner TEXT.

InventarioStockVenta:
name TEXT; catalogVersion TEXT; locationId TEXT; stockKey TEXT; lastInventoryMovementId TEXT; lastInventoryMovementAt DATETIME; location TEXT; tipoImpositivo NUMBER; taxIncluded BOOLEAN; price NUMBER; sku TEXT; stockOnHand NUMBER; stockReserved NUMBER; stockAvailable NUMBER; wixProductId TEXT; wixVariantId TEXT; traceId TEXT; stockId TEXT; productId TEXT; variantId TEXT; stockMinimo NUMBER; reorderPoint NUMBER; reorderQuantity NUMBER; needsWixReconciliation BOOLEAN; lastSyncAt DATETIME; _id TEXT; _createdDate DATETIME; _updatedDate DATETIME; _owner TEXT.

LibroAsientosContablesDetalle:
desgloseDetallado OBJECT; entryId TEXT; recordTimestamp DATETIME; cashMovementId TEXT; concept TEXT; lineNumber NUMBER; origenTipo TEXT; origenRegistro TEXT; sourceMovementId TEXT; entryDate DATE; fiscalPeriod TEXT; accountCode TEXT; debitAmount NUMBER; creditAmount NUMBER; accountingAmount NUMBER; payloadFiscal OBJECT; recordHash TEXT; previousRecordHash TEXT; idSistemaInformatico TEXT; bookingId TEXT; orderId TEXT; resourceId TEXT; traceId TEXT; _id TEXT; _createdDate DATETIME; _updatedDate DATETIME; _owner TEXT.

MapaStaff:
displayName TEXT; staffMemberId TEXT; scheduleId TEXT; thirdPartyId TEXT; staffName TEXT; rolWebsite TEXT; rolBookings TEXT; memberId TEXT; resourceId TEXT; active BOOLEAN; sortOrder NUMBER; sourceSystem TEXT; schemaVersion NUMBER; ServiciosCatalogo_staffMembers MULTI_REFERENCE; _id TEXT; _createdDate DATETIME; _updatedDate DATETIME; _owner TEXT.

MovimientosCaja:
resourceId TEXT; payloadAEAT OBJECT; NIFEmisor TEXT; NIFDestinatario TEXT; IRPFWithholdingRate NUMBER; IRPFWithholdingAmount NUMBER; baseImponibleOImporteNoSujeto NUMBER; signatureAlgorithm TEXT; hashAlgorithm TEXT; verificationQR TEXT; digitalSignature TEXT; generationTimestamp DATETIME; serviceIdRedeemed TEXT; giftCardOperation TEXT; giftCardId TEXT; accountingSign NUMBER; lineItems OBJECT; recordSource TEXT; desgloseDetallado OBJECT; bankReconciliationReference TEXT; vatAccrualStatus TEXT; linkedAdvanceId TEXT; article20Exempt BOOLEAN; cashBasisRegime BOOLEAN; nonSubjectReason TEXT; issuerThirdPartyTaxId TEXT; thirdPartyLegalName TEXT; issuedByThirdPartyOrRecipient TEXT; isB2B BOOLEAN; issuerLegalName TEXT; correctionAmount NUMBER; issuerInvoiceNumber TEXT; previousInvoiceIssueDate DATE; previousInvoiceNumber TEXT; correctionReason TEXT; withholdingBase NUMBER; surchargeRate NUMBER; linkedBookingIds ARRAY_STRING; bookingId TEXT; hash TEXT; amount NUMBER; taxAmount NUMBER; taxBase NUMBER; numSerieFactura TEXT; sequenceNumber NUMBER; transactionId TEXT; previousRecordHash TEXT; recordTimestamp DATETIME; schemaVersion TEXT; traceId TEXT; movementType TEXT; totalAmount NUMBER; paymentMethod TEXT; channelType TEXT; operationDescription TEXT; staffResourceId TEXT; tipoFactura TEXT; fechaExpedicionFactura DATE; fechaOperacion DATE; tipoImpositivo NUMBER; recipientLegalName TEXT; recipientAddress OBJECT; payloadFiscal OBJECT; sistemaInformatico OBJECT; estadoEnvioAEAT TEXT; csvAEAT TEXT; fechaEnvioAEAT DATETIME; tipoRectificativa TEXT; previousInvoiceId TEXT; claveRegimen TEXT; calificacionOperacion TEXT; operacionExenta BOOLEAN; inversionSujetoPasivo BOOLEAN; surchargeAmount NUMBER; fiscalRole TEXT; eventType TEXT; thirdPartyId TEXT; catalogId TEXT; pairToken TEXT; orderId TEXT; refundId TEXT; fiscalPeriod TEXT; accountingAmount NUMBER; projectionStatus TEXT; _id TEXT; _createdDate DATETIME; _updatedDate DATETIME; _owner TEXT.

MovimientosInventario:
variantId TEXT; orderId TEXT; productId TEXT; stockApplied BOOLEAN; lineItemId TEXT; catalogVersion TEXT; locationId TEXT; stockKey TEXT; magnitude NUMBER; nativeCommercialMovement BOOLEAN; requiresWixReconciliation BOOLEAN; actorMemberId TEXT; actorEmail TEXT; referenceId TEXT; refundId TEXT; recordTimestamp DATETIME; catalogId TEXT; productName TEXT; reason TEXT; movementToken TEXT; movementType TEXT; sku TEXT; quantityDelta NUMBER; traceId TEXT; direction TEXT; quantity NUMBER; stockBefore NUMBER; stockAfter NUMBER; operationDescription TEXT; sourceEventId TEXT; thirdPartyId TEXT; wixProductId TEXT; wixVariantId TEXT; movementId TEXT; _id TEXT; _createdDate DATETIME; _updatedDate DATETIME; _owner TEXT.

PaquetesGestoria:
invoiceData ARRAY; periodType TEXT; fiscalYear NUMBER; fiscalMonth NUMBER; fiscalQuarter NUMBER; packageVersion NUMBER; summaryData OBJECT; packageStatus TEXT; snapshotHash TEXT; schemaVersion TEXT; source TEXT; traceId TEXT; createdAt DATETIME; _id TEXT; _createdDate DATETIME; _updatedDate DATETIME; _owner TEXT.

RegistroIntegracion:
eventId TEXT; eventType TEXT; sourceModule TEXT; sourceCollection TEXT; sourceItemId TEXT; occurredAt DATETIME; traceId TEXT; correlationId TEXT; idempotencyKey TEXT; schemaVersion TEXT; payload OBJECT; payloadHash TEXT; deliveryStatus TEXT; deliveryAttempts NUMBER; nextAttemptAt DATETIME; deliveredAt DATETIME; lastDeliveryError TEXT; _id TEXT; _createdDate DATETIME; _updatedDate DATETIME; _owner TEXT.

RegistrosHorariosStaff:
resourceId TEXT; notes TEXT; memberId TEXT; recordedAt DATETIME; clockEventType TEXT; recordType TEXT; traceId TEXT; adjustmentReason TEXT; signature TEXT; recordedTime TEXT; dayKey TEXT; monthKey TEXT; staffName TEXT; registeredBy TEXT; registeredByMemberId TEXT; deviceIpAddress TEXT; meta OBJECT; _id TEXT; _createdDate DATETIME; _updatedDate DATETIME; _owner TEXT.

ServiciosCatalogo:
sessionCount NUMBER; staffMembers MULTI_REFERENCE; pricingPlanId TEXT; catalogEntryType TEXT; locationId TEXT; description TEXT; _id TEXT; serviceId TEXT; title TEXT; slug TEXT; tagLine TEXT; categoryId TEXT; itemNature TEXT; sku TEXT; price NUMBER; currency TEXT; taxIncluded BOOLEAN; tipoImpositivo NUMBER; calificacionOperacion TEXT; totalDuration NUMBER; phase1Duration NUMBER; phase2Duration NUMBER; exposureDuration NUMBER; allowCombine BOOLEAN; linkedPhases TEXT; location TEXT; clientHidden BOOLEAN; onlinePayment BOOLEAN; inPersonPayment BOOLEAN; pricingModel TEXT; depositType TEXT; depositAmount NUMBER; margin NUMBER; internalNotes TEXT; category TEXT; precioCosteBase NUMBER; _createdDate DATETIME; mainMedia IMAGE; _updatedDate DATETIME; _owner TEXT; recomendaciones TEXT; name MULTI_REFERENCE.
```

## 3. Contratos de identidad y keyfields

| Entidad | Campo/clave canónica | Interpretación |
|---|---|---|
| Registro CMS | `_id` | Identidad del elemento dentro de su colección Wix. |
| Reserva Bookings | `bookingId` | ID nativo de la reserva; no es `CitasF2._id`. |
| Servicio Bookings | `serviceId` | ID nativo de servicio; `ServiciosCatalogo._id` es identidad CMS distinta. |
| Plan de precios Bookings | `pricingPlanId` | ID nativo del plan; no reutilizar `serviceId`. |
| Recurso Bookings | `resourceId` | ID nativo del recurso; distinto de `staffMemberId` y `memberId`. |
| Miembro de staff Bookings | `staffMemberId` | ID nativo del staff member. |
| Agenda Bookings | `scheduleId` | ID de agenda. |
| Miembro Wix Members | `memberId` | ID nativo de Site Member. |
| Evento webhook | `eventId` | ID del evento entregado por Wix. |
| Fencing/correlación | `traceId` | Token de correlación/fencing interno. |
| Idempotencia | `dedupeKey` | Clave determinista de deduplicación. |
| Complemento CMS | `_id` | En los 36 registros leídos coincide con el espejo `addonId`; el código debe priorizar `_id`. |

No se fusionan IDs de entidades distintas aunque todos tengan formato GUID. `_id` identifica el registro CMS; los campos nativos conservan el identificador de la entidad Wix correspondiente.

## 4. Duplicidades y decisiones de normalización

| Colección/campos | Evidencia | Decisión |
|---|---|---|
| `ComplementosCatalogo.addonId` / `_id` | Coinciden en 36/36 filas. | `_id` es identidad canónica CMS. El código prioriza `_id`, rechaza divergencia y conserva `addonId` como espejo físico hasta retirar la columna tras migrar consumidores. |
| `ComplementosCatalogo.name` / `description` | Texto idéntico en 36/36; tipos TEXT y RICH_TEXT. | No retirar aún: `name` es etiqueta y `description` es contenido rico usado por el widget. Revisar el diseño del catálogo antes de eliminar. |
| `ComplementosCatalogo.traceId` | Vacío en 36/36; no se localizó consumidor específico de catálogo. | Candidato a retirar después de revisar vistas/automatizaciones CMS. |
| `DatosFiscales.gestorName` / `gestorNombre` | Idénticos en 1/1 registro. | Propuesta: `gestorName` como keyfield canónico; retirar `gestorNombre` tras alinear lectores/writers. |
| `CajaActual.id` / `_id` | Idénticos en el singleton leído. | Candidato a retirar `id`; `_id` es el identificador CMS. |
| `MapaStaff.resourceId` / `_id` | Idénticos en 3/3 registros. | No fusionar todavía: `resourceId` es clave nativa Bookings con consumidores; requiere migrar lector, validador y writer antes de retirar columna. |
| `ServiciosCatalogo.onlinePayment` / `inPersonPayment` | Valores iguales en 94/94 filas SERVICE. | Conservar ambos: representan canales distintos y no son duplicados semánticos demostrados. |
| `CajaActual.expectedCash` / `openingAmount` | Iguales en el único registro de prueba. | Conservar: saldo esperado y saldo de apertura tienen significados diferentes. |
| `InventarioStockVenta` / `MovimientosInventario` | Colecciones presentes, con una fila sintética cada una. | Legacy retirado del código; no reactivar ni borrar automáticamente. |

La igualdad de importes/contadores en un singleton simulado o en una única fila no demuestra duplicidad de contrato.

## 5. Tipos y formato

- Los valores numéricos consultados para campos NUMBER son números JSON, no cadenas.
- Los campos BOOLEAN consultados son booleanos.
- `CajaActual.sequenceCounters` es OBJECT y el valor persistido se leyó como objeto JSON válido.
- `RegistrosHorariosStaff.recordedAt` está declarado DATETIME; los dos valores se serializan como ISO 8601 UTC parseable.
- `CitasF2.dateYmd` es TEXT, adecuado para una fecha de calendario sin hora; no debe convertirse a DATETIME sin cambiar su semántica.
- `DatosFiscales.fechaInicioVerifactu` es TEXT y está vacío; no hay evidencia de formato real que permita cambiar su tipo.
- No se debe almacenar `N/A` en campos tipados; la no aplicabilidad se expresa omitiendo el valor o usando null cuando el contrato lo permita.

## 6. Contratos de colección alineados

La lectura física del sitio confirma que MapaStaff contiene exclusivamente claves de identidad y relación de personal; no contiene recordType, taxId, legalName, thirdPartyType, traceId ni schemaVersion. DatosFiscales contiene los campos fiscales, recordType y datos de gestoría, pero no traceId ni schemaVersion.

La rama de alineación separa ambas responsabilidades:

- MapaStaff: el hook y el validador solo comprueban staffMemberId, resourceId y scheduleId como GUIDs Wix; memberId y thirdPartyId se validan como GUID cuando se informan. active debe ser BOOLEAN y schemaVersion, si se informa, un entero positivo. No se exige recordType.
- DatosFiscales: se declara como BUSINESS_COLLECTIONS.DATOS_FISCALES. El hook valida los tipos TERCERO, GESTORIA y CONFIG_SISTEMA. CONFIG_SISTEMA conserva el singleton CONFIG_SISTEMA_FISCAL y valida los BOOLEAN y fechaInicioVerifactu como texto YYYY-MM-DD. No se exigen ni persisten traceId/schemaVersion.
- eventLog.js crea/consulta terceros en DatosFiscales; fiscalAggregator.web.js lee allí la configuración del emisor; fiscalDocuments.web.js obtiene allí destinatarios de gestoría.
- Los writers fiscales continúan fail-closed mediante FISCAL_RUNTIME_POLICY. La alineación del contrato no habilita facturación ni crea registros.

## 7. Identidades canónicas y duplicidades

- _id es la clave primaria del registro CMS. Para ComplementosCatalogo, el código obtiene la identidad desde _id y la proyecta como addOnId en el DTO de reservas. addonId permanece como espejo físico porque la columna sigue siendo obligatoria en CMS; el hook comprueba igualdad cuando ambos valores están disponibles.
- CajaActual.id coincide con _id en el singleton leído. No se ha retirado la columna; queda pendiente confirmar que no haya consumidores externos.
- DatosFiscales.gestorName y gestorNombre coinciden en el único registro leído; el código usa solo gestorName. taxId está informado y nif vacío; no son dos valores duplicados. name y legalName están ambos informados pero difieren; gestorEmail está informado y email vacío, por lo que son campos de finalidades distintas.
- MapaStaff.resourceId coincide con _id en las tres filas, pero no es duplicado semántico: resourceId es la identidad nativa de Wix Bookings Resource y _id la identidad del registro CMS. Se conservan ambos.
- ServiciosCatalogo.serviceId y pricingPlanId identifican entidades nativas diferentes; no se sustituyen por _id ni se fusionan.
- ComplementosCatalogo.name y description coinciden textualmente en las 36 filas, pero TEXT y RICH_TEXT son contratos distintos de etiqueta y contenido; se conservan.
- ServiciosCatalogo.onlinePayment e inPersonPayment contienen valores iguales en el corte, pero expresan canales de cobro distintos; se conservan.

## 8. Validación y límites

- Verificado mediante lectura API: 23 colecciones del sitio actual (15 NATIVE, 8 WIX_APP), 524 campos NATIVE y 140 registros propios en el corte.
- Verificado mediante lectura de registros: CajaActual.sequenceCounters es objeto JSON; ticketSequence no está en el esquema; ControlOperativo.ownerToken no está en el esquema; addonId coincide con _id en 36/36; resourceId coincide con _id en 3/3.
- Verificado: PR #361–#366 integradas en main; HEAD de main 13b9ae095214e0c601f255fa75d629680c539933.
- PR #367: CI offline PASS, run #1137: Layer 1 23 suites/296 tests, Layer 2 18 suites/244 tests, regresión completa 69 suites/631 tests, 0 fallos. Wix SDK contracts, eCommerce Order Transactions SDK contract, Bookings Reader V2 SDK contract y ESLint: PASS. Secret scanning run #561: PASS.
- PR #367 integrada en main mediante merge `dfdee00d8ebc535427c95d49cae91b4c557e4209`.
- Pendiente: validación en Wix Local Editor y pruebas E2E.
- No se ha modificado el CMS ni se ha publicado/desplegado código Wix.

