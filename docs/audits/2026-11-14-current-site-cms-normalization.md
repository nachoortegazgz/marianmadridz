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

## 6. Contratos backend alineados con el esquema físico

### 6.1 MapaStaff — mapa de identidades de personal

- MapaStaff contiene exclusivamente el mapeo entre identidades nativas de personal: staffMemberId (Bookings Staff Member), resourceId (Bookings Resource), scheduleId (agenda) y memberId (Wix Members).
- _id es la identidad del elemento CMS. Aunque resourceId = _id en las tres filas leídas, los campos no se fusionan: uno identifica el registro CMS y el otro el recurso nativo consumido por Bookings.
- active es BOOLEAN y el lector de proyección filtra staffMemberId + active=true.
- MapaStaff.thirdPartyId es TEXT opaco: el valor no es GUID, no coincide con _id de DatosFiscales y no tiene consumidor localizado en src/. No tratarlo como FK; candidato a retirada física tras revisar vistas/integraciones.
- El validador y los hooks MapaStaff_beforeInsert/MapaStaff_beforeUpdate validan exclusivamente esos campos de personal. No esperan recordType, traceId ni campos fiscales.
- MapaStaff no es autoridad RBAC; la autorización sigue resolviéndose en backend con las APIs nativas Wix Members/Bookings.

### 6.2 DatosFiscales — maestro fiscal y de terceros

- DatosFiscales es la colección física para recordType, taxId, legalName, thirdPartyType, address y datos de gestoría.
- Los valores admitidos de recordType son TERCERO, GESTORIA y CONFIG_SISTEMA. El registro actual es un placeholder TERCERO/PROVEEDOR; no constituye identidad fiscal real ni configura al emisor.
- DatosFiscales no declara traceId ni schemaVersion. Los writers no deben inventar esos campos: la trazabilidad permanece en el ledger/operación que origina la escritura.
- fechaInicioVerifactu es TEXT, no DATE. El validador exige formato ISO YYYY-MM-DD cuando el valor se informa.
- gestorName es el nombre canónico. gestorNombre es un espejo físico detectado en el único registro. Los lectores nuevos solo consumen gestorName; el hook de actualización elimina el espejo únicamente si ambos valores coinciden y falla cerrado ante divergencias.
- eventLog.js inserta terceros en DatosFiscales usando solo campos declarados. fiscalAggregator.web.js consulta allí CONFIG_SISTEMA y el adaptador histórico TERCERO/EMISOR. fiscalDocuments.web.js obtiene los destinatarios de gestoría desde la misma colección.
- No existe fila CONFIG_SISTEMA ni datos fiscales oficiales verificados. Los writers fiscales siguen fail-closed; alinear el contrato no habilita facturación ni envíos.

### 6.3 ComplementosCatalogo — identidad CMS y contrato Bookings

- _id es el keyfield canónico del elemento CMS.
- addonId se mantiene como espejo físico requerido por el esquema actual. El hook adopta su valor como _id solo cuando Wix no ha asignado todavía el ID; si ambos existen, exige igualdad.
- El DTO de transporte a Wix Bookings conserva addOnId porque es el nombre del campo del contrato nativo. No se confunde con el keyfield físico CMS.
- traceId está vacío en las 36 filas y no tiene consumidor específico localizado; queda como candidato de retirada física tras revisar automatizaciones y vistas CMS.
- name y description tienen el mismo texto, pero son TEXT y RICH_TEXT respectivamente. No se fusionan por igualdad de valores.

### 6.4 Otros contratos confirmados

- CajaActual tiene 39 campos: operationDate DATE, openingAmount NUMBER, cashAmount/cardAmount/otherAmount, sequenceCounters OBJECT, cashRegisterStatus TEXT, isOpen BOOLEAN, id TEXT y currentSequence NUMBER. No existen operationDateHour, bizumAmount ni los cuatro opening*Amount. Wix DATE se persiste como String ISO YYYY-MM-DD.
- El singleton actual tiene cashRegisterStatus=SIMULACION e isOpen=true; no son equivalentes. El backend usa cashRegisterStatus como autoridad de sesión. id=_id; currentSequence=0 y no tiene consumidor localizado. openingAmount y expectedCash coinciden en importe en la fila sintética, pero no se fusionan.
- ControlOperativo.ownerToken, retryAfter y nextRetryAt no son campos físicos canónicos; el token de fencing es traceId.
- ServiciosCatalogo.serviceId y pricingPlanId son identificadores nativos distintos de _id CMS y entre sí. No se consolidan.
- DatosFiscales.gestorNombre, CajaActual.id y ComplementosCatalogo.addonId son candidatos a retirada física solo después de completar la migración de valores/consumidores y revisar contratos externos.

## 7. Cambios de código incluidos en la rama

- internalConfig.js: DatosFiscales se incorpora a BUSINESS_COLLECTIONS; RECORD_TYPE queda limitado a los tipos fiscales de esa colección; CASH_REGISTER_STATUS incorpora SIMULACION como sentinel del sitio aislado.
- validation.js y data.js: validación separada de MapaStaff y DatosFiscales; assertCajaActualRecord valida el esquema físico de CajaActual y sequenceCounters como OBJECT; no se exigen campos inexistentes.
- dataAccessPolicy.js: la validación de recordType se aplica a inserciones de DatosFiscales, no a MapaStaff. thirdPartyId de los payloads fiscales debe contener DatosFiscales._id; el hook valida formato GUID, no existencia referencial; no apunta a MapaStaff.
- eventLog.js: upsert de terceros y lectura de configuración migrados a DatosFiscales; no se persisten traceId ni schemaVersion allí.
- fiscalAggregator.web.js: lectura de NIF emisor migrada a DatosFiscales; ausencia de CONFIG_SISTEMA sigue provocando error fail-closed.
- fiscalDocuments.web.js: lectura de destinatarios migrada a DatosFiscales; gestorName es el único nombre consumido.
- cajas.web.js: usa operationDate DATE (ISO YYYY-MM-DD), acumula BIZUM en otherAmount y proyecta openingAmount; deja de escribir/leer operationDateHour, bizumAmount y opening*Amount inexistentes.
- ComplementosCatalogo: _id pasa a ser la identidad primaria del hook; addonId se mantiene solo como espejo requerido por el esquema físico.
- Pruebas actualizadas para validar la separación de maestros, tipos de campo y keyfield canónico.
- No se ha modificado Wix CMS, no se han migrado registros y no se han eliminado definiciones de campo.

## 8. Validación y límites

- Verificado por lectura Wix: 23 colecciones (15 NATIVE y 8 WIX_APP), 524 campos físicos NATIVE; MapaStaff 18 campos/3 filas y DatosFiscales 28 campos/1 fila.
- Verificado por lectura Wix: CajaActual tiene 39 campos y sequenceCounters es objeto; operationDate es DATE; operationDateHour, bizumAmount, ticketSequence y los cuatro opening*Amount no existen; ControlOperativo.ownerToken no existe; ComplementosCatalogo.addonId = _id en 36/36; DatosFiscales.gestorName = gestorNombre en 1/1.
- Verificado estáticamente en la rama: los consumidores fiscales apuntan a DatosFiscales; los hooks de MapaStaff solo validan identidades de personal.
- PR #370 está abierto pero `dirty` (109 commits ahead / 57 behind main). No hay checks asociados al HEAD actual; los últimos checks exitosos son del SHA 68a2f327 y no validan cambios posteriores.
- Pendiente: rebase/reconciliación, suite CI completa sobre HEAD, lint, análisis de seguridad y revisión del diff.
- Pendiente: validación de hooks/WebMethods en Wix Editor, pruebas de lectura/escritura sintéticas y E2E.
- No se ha publicado código Wix ni se ha modificado el CMS del sitio.
