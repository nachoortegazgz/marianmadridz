# ESQUEMA CMS — Marian Madrid

**Estado:** baseline físico consolidado, solo lectura.  
**Corte Wix:** 27-11-2026.  
**Site ID:** 188bed94-177c-4bc9-a9f0-35080d874f3e.  
**Entorno:** Wix Editor clásico, Velo habilitado, sitio Draft.  
**Fuente:** Wix Data Collections API y Data Items API con consistentRead=true.  
**Mutaciones durante la auditoría:** ninguna.

## 1. Reglas de interpretación

- Este documento refleja el esquema físico devuelto por Wix en la fecha de corte. Una revisión posterior de Wix lo sustituye.
- Wix CMS es la SSOT de las colecciones propias. Las colecciones WIX_APP pertenecen a Wix Apps; no redefinirlas desde el proyecto.
- NATIVE identifica colecciones propias; WIX_APP identifica colecciones administradas por aplicaciones.
- Los campos marcados con ! son required=true en el esquema físico de Wix. Esta marca no sustituye la validación backend: Wix Data no impone automáticamente el esquema al persistir items.
- Los campos _id, _createdDate, _updatedDate y _owner son campos de sistema cuando aparecen en el esquema.
- Los campos TEXT que contienen IDs no son referencias CMS tipadas salvo que Wix declare REFERENCE o MULTI_REFERENCE.
- Los nombres, tipos y referencias siguientes se copian de la lectura física. No se infieren enums ni reglas de negocio a partir del tipo.
- Los recuentos son lecturas de items en el corte, no prueba de que los registros sean operaciones económicas reales. Por política del proyecto, todo registro anterior al despliegue oficial de producción de 2027 es sintético.

## 2. Inventario actual

Wix devolvió 41 colecciones: 12 NATIVE y 29 WIX_APP. Las 12 colecciones NATIVE suman 238 items.

| Colección | Tipo | Revisión | Campos | Items |
|---|---:|---:|---:|---:|
| CajaActual | NATIVE | 20 | 83 | 1 |
| CitasF2 | NATIVE | 60 | 29 | 11 |
| ComplementosCatalogo | NATIVE | 144 | 17 | 36 |
| ControlOperativo | NATIVE | 95 | 34 | 81 |
| HistoricoCierresZ | NATIVE | 44 | 66 | 1 |
| LibroAsientosContablesDetalle | NATIVE | 9 | 103 | 3 |
| MapaStaff | NATIVE | 136 | 44 | 5 |
| MovimientosCaja | NATIVE | 110 | 114 | 5 |
| RegistroIntegracion | NATIVE | 5 | 21 | 3 |
| RegistrosHorariosStaff | NATIVE | 2 | 47 | 0 |
| ServiciosCatalogo | NATIVE | 204 | 43 | 95 |
| TransaccionesTPV | NATIVE | 7 | 27 | 0 |
| **Total NATIVE** | | | **628** | **241** |

### Colecciones Wix Apps

No son contratos de esquema del proyecto. Se conserva este inventario para identificar propietarios y evitar duplicar dominios nativos.

| ID de colección | Revisión | Campos |
|---|---:|---:|
| Blog/Categories | 4 | 11 |
| Blog/Posts | 0 | 27 |
| Blog/Tags | 0 | 7 |
| Bookings/Schedule | 0 | 5 |
| Bookings/Services | 5 | 20 |
| Bookings/Staff | 0 | 3 |
| CampaignManager/campaigns | 0 | 32 |
| CampaignManager/userConfig | 0 | 5 |
| eCommerce/Orders | 0 | 46 |
| Forms/subscribers03 | 0 | 6 |
| Locations/Locations | 6 | 17 |
| Marketing/Coupons | 0 | 23 |
| Members/Badges | 0 | 11 |
| Members/FullData | 0 | 28 |
| Members/PrivateMembersData | 4 | 15 |
| Members/PublicData | 0 | 12 |
| StoreCatalog/Brands | 0 | 6 |
| StoreCatalog/Categories | 0 | 17 |
| StoreCatalog/Info sections | 0 | 9 |
| StoreCatalog/Inventory | 0 | 17 |
| StoreCatalog/Product options & modifiers | 0 | 12 |
| StoreCatalog/Products | 0 | 42 |
| StoreCatalog/Ribbons | 0 | 6 |
| StoreCatalog/Variants | 0 | 16 |
| Stores/Collections | 0 | 5 |
| Stores/InventoryItems | 0 | 6 |
| Stores/Orders | 0 | 23 |
| Stores/Products | 7 | 35 |
| Stores/Variants | 0 | 12 |

Wix Stores está instalado como Catalog V3. El inventario comercial nativo se gobierna desde Stores Catalog V3; no reactivar colecciones legacy propias de inventario sin una decisión arquitectónica y una reconciliación específica.

## 3. Esquema físico de colecciones NATIVE

Formato: campo:TIPO; ! indica required=true. Las referencias tipadas se indican con ->colección. No se repiten campos de sistema en explicaciones funcionales.

### CajaActual — CAJA_ACTUAL
Revisión 20 · 83 campos · 1 item · permisos CMS ADMIN para read/insert/update/remove · plugins SINGLE_ITEM, EDITABLE_PAGE_LINK.

~~~text
recordNature:TEXT, recordTimestamp:DATETIME, singletonKey:TEXT, closedAt:DATETIME, closedBy:TEXT, cierreZReference:TEXT, openedAt:DATETIME, openedBy:TEXT, operationDateHour:DATETIME, cashRegisterStatus:TEXT, openingCashAmount:NUMBER, openingCardAmount:NUMBER, openingBizumAmount:NUMBER, openingOtherAmount:NUMBER, cashAmount:NUMBER, cardAmount:NUMBER, bizumAmount:NUMBER, otherAmount:NUMBER, cashMovementId:TEXT, lastMovementAt:DATETIME, snapshotSource:TEXT, salesCount:NUMBER, expectedCash:NUMBER, countedCash:NUMBER, difference:NUMBER, differenceReason:TEXT, sequenceCounters:OBJECT, ticketSequence:NUMBER, lastOperationId:TEXT, lastOperationType:TEXT, lastOperationAmount:NUMBER, lastOperationPaymentMethod:TEXT, lastOperationAt:DATETIME, lastOperationStatus:TEXT, traceId:TEXT, posIntegrationStatus:TEXT, ticketSyncStatus:TEXT, orderId:TEXT, checkoutId:TEXT, paymentId:TEXT, transactionId:TEXT, paymentReference:TEXT, paymentStatus:TEXT, paymentMethod:TEXT, paymentBreakdown:OBJECT, amountReceived:NUMBER, changeReturned:NUMBER, posPaymentStatus:TEXT, posPaymentMethod:TEXT, posPaymentProvider:TEXT, posAmount:NUMBER, posCurrency:TEXT, posPaidAt:DATETIME, ticketNumber:TEXT, ticketIssuedAt:DATETIME, ticketType:TEXT, ticketSeries:TEXT, lineItems:OBJECT, conceptOperations:OBJECT, conceptQuantities:OBJECT, customerName:TEXT, customerTaxId:TEXT, customerAddress:TEXT, netPrice:NUMBER, discountAmount:NUMBER, roundingAmount:NUMBER, taxableBaseTotal:NUMBER, appliedTax:NUMBER, taxTotal:NUMBER, ticketTotal:NUMBER, fiscalText:TEXT, verifactuReference:TEXT, verificationQr:TEXT, ticketXControlReference:TEXT, contactId:TEXT, catalogItemId:TEXT, serviceId:TEXT, bookingId:TEXT, snapshotUpdatedAt:ARRAY, _id:TEXT, _createdDate:DATETIME, _updatedDate:DATETIME, _owner:TEXT
~~~

### CitasF2 — CITAS_F2
Revisión 60 · 29 campos · 11 items · permisos CMS ADMIN para read/insert/update/remove.

~~~text
slotStart:DATETIME!, timeZone:TEXT, cancellationReason:TEXT, privacyNoticePurpose:TEXT, privacyNoticeAcceptedAt:DATETIME, privacyNoticeVersion:TEXT, totalAmount:NUMBER!, slotEnd:DATETIME!, bookingId:TEXT!, traceId:TEXT!, bookingType:TEXT!, bookingStatus:TEXT!, paymentStatus:TEXT!, serviceId:TEXT!, resourceId:TEXT!, pairToken:TEXT, dateYmd:TEXT!, scheduleId:TEXT, contactDetails:OBJECT, cashMovementId:TEXT, revision:NUMBER, _id:TEXT, meta:OBJECT, _createdDate:DATETIME, _updatedDate:DATETIME, _owner:TEXT, orderId:TEXT, thirdPartyId:TEXT, catalogId:TEXT
~~~

### ComplementosCatalogo — COMPLEMENTOS_CATALOGO
Revisión 144 · 17 campos · 36 items · permisos CMS ADMIN para read/insert/update/remove.

~~~text
sku:TEXT!, taxIncluded:BOOLEAN!, durationMinutes:NUMBER, tipoImpositivo:NUMBER, addonId:TEXT!, traceId:TEXT, name:TEXT, description:RICH_TEXT, _id:TEXT, _owner:TEXT, price:NUMBER, itemNature:TEXT, codigoImpuesto:TEXT, _updatedDate:DATETIME, _createdDate:DATETIME, claveRegimen:TEXT, cuentaContableIngreso:TEXT
~~~

### ControlOperativo — CONTROL_OPERATIVO
Revisión 95 · 34 campos · 81 items · permisos CMS ADMIN para read/insert/update/remove.

~~~text
eventType:TEXT, recordNature:TEXT, recordTimestamp:DATETIME, controlType:TEXT!, dedupeKey:TEXT!, traceId:TEXT!, status:TEXT, eventId:TEXT, expiresAt:DATETIME, bookingId:TEXT, resourceId:TEXT, serviceId:TEXT, dateYmd:TEXT, attempts:NUMBER, surface:TEXT, requesterKey:TEXT, requestCount:NUMBER, windowStart:DATETIME, payload:OBJECT!, version:NUMBER, heartbeatAt:DATETIME, ownerToken:TEXT, _id:TEXT, _createdDate:DATETIME, transactionId:TEXT, orderId:TEXT, _updatedDate:DATETIME, _owner:TEXT, refundId:TEXT, kind:TEXT, processedAt:DATETIME, operationDescription:TEXT, lastError:TEXT, totalAmount:NUMBER
~~~

### HistoricoCierresZ — HISTORICO_CIERRES_Z
Revisión 44 · 66 campos · 1 item · permisos CMS ADMIN para read/insert/update/remove.

~~~text
totalTips:NUMBER, workDate:DATE, memberId:TEXT, staffResourceId:TEXT, laborRecordId:TEXT, snapshotJSON:TEXT, closedAt:DATETIME, timeZone:TEXT, closingSchemaVersion:TEXT, closingSource:TEXT, auditedRecordsCount:NUMBER, taxTypeBreakdown:OBJECT, movementTypeBreakdown:OBJECT, endTicketNumber:TEXT, startTicketNumber:TEXT, totalOperations:NUMBER, totalAdjustments:NUMBER, closeDate:DATE!, totalRefunds:NUMBER, fiscalPeriod:TEXT!, totalTaxAmount:NUMBER!, totalTaxBase:NUMBER!, totalOnline:NUMBER!, totalBizum:NUMBER!, totalCard:NUMBER!, totalCash:NUMBER!, closedBy:TEXT!, recordDomain:TEXT!, closingStatus:TEXT, operationDate:DATE!, consolidatedTotalAmount:NUMBER, grossSalesTotal:NUMBER, netTaxableAmount:NUMBER, netTaxAmount:NUMBER, totalesMedioPago:OBJECT, startSequence:NUMBER, endSequence:NUMBER, startRecordHash:TEXT, endRecordHash:TEXT, isIntegrityVerified:BOOLEAN, closingHash:TEXT, closingSignature:TEXT, closingSignatureStatus:TEXT, verifiedAt:DATETIME, approverUser:TEXT, estadoEnvioAEAT:TEXT, traceId:TEXT!, inventoryClosingId:TEXT, fiscalYear:NUMBER, closingType:TEXT, sku:TEXT, wixProductId:TEXT, stockQuantity:NUMBER, unitCost:NUMBER, stockValue:NUMBER, cuentaContable:TEXT, summaryData:OBJECT, invoiceData:OBJECT, packageStatus:TEXT, packageVersion:NUMBER, sentTo:TEXT, sentAt:DATETIME, _id:TEXT, _createdDate:DATETIME, _updatedDate:DATETIME, _owner:TEXT
~~~

### LibroAsientosContablesDetalle — LIBRO_ASIENTOS_CONTABLES_DETALLE
Revisión 9 · 103 campos · 3 items · permisos CMS ADMIN para read/insert/update/remove.

~~~text
resourceId:TEXT, workDate:DATE, memberId:TEXT, laborRecordId:TEXT, fechaEnvioAEAT:DATETIME, sequenceNumber:NUMBER, documentId:TEXT, auditEventId:TEXT, transactionId:TEXT, orderId:TEXT, bookingId:TEXT, linkedBookingIds:ARRAY_STRING, refundId:TEXT, linkedAdvanceId:TEXT, journalEntryId:TEXT, incidentId:TEXT, staffResourceId:TEXT, catalogId:TEXT, thirdPartyId:TEXT, pairToken:TEXT, giftCardId:TEXT, giftCardOperation:TEXT, serviceIdRedeemed:TEXT, recordSource:TEXT, recordTimestamp:DATETIME, generationTimestamp:DATETIME, fechaOperacion:DATE, fechaExpedicionFactura:DATE, confirmedAt:DATETIME, closedAt:DATETIME, fiscalPeriod:TEXT, schemaVersion:TEXT, traceId:TEXT, eventType:TEXT, movementType:TEXT, paymentMethod:TEXT, channelType:TEXT, operationDescription:TEXT, amount:NUMBER, totalAmount:NUMBER, accountingAmount:NUMBER, accountingSign:NUMBER, taxBase:NUMBER, taxAmount:NUMBER, tipoImpositivo:NUMBER, correctionAmount:NUMBER, correctionReason:TEXT, surchargeRate:NUMBER, surchargeAmount:NUMBER, withholdingBase:NUMBER, IRPFWithholdingRate:NUMBER, IRPFWithholdingAmount:NUMBER, lineItems:OBJECT, desgloseDetallado:OBJECT, bankReconciliationReference:TEXT, projectionStatus:TEXT, NIFEmisor:TEXT, issuerLegalName:TEXT, issuerThirdPartyTaxId:TEXT, thirdPartyLegalName:TEXT, issuedByThirdPartyOrRecipient:TEXT, NIFDestinatario:TEXT, recipientLegalName:TEXT, recipientAddress:OBJECT, isB2B:BOOLEAN, tipoFactura:TEXT, numSerieFactura:TEXT, claveRegimen:TEXT, calificacionOperacion:TEXT, fiscalRole:TEXT, operacionExenta:BOOLEAN, article20Exempt:BOOLEAN, cashBasisRegime:BOOLEAN, nonSubjectReason:TEXT, tipoRectificativa:TEXT, previousInvoiceId:TEXT, previousInvoiceNumber:TEXT, previousInvoiceIssueDate:DATE, inversionSujetoPasivo:BOOLEAN, payloadFiscal:OBJECT, payloadAEAT:OBJECT, sistemaInformatico:OBJECT, estadoEnvioAEAT:TEXT, csvAEAT:TEXT, verificationQR:TEXT, digitalSignature:TEXT, signatureAlgorithm:TEXT, hashAlgorithm:TEXT, hash:TEXT, previousRecordHash:TEXT, createdByUserId:TEXT, confirmedByUserId:TEXT, authorizedByUserId:TEXT, reviewedByUserId:TEXT, approvedByUserId:TEXT, correctionRequestedBy:TEXT, userRole:TEXT, payee:TEXT, documentType:TEXT, _id:TEXT, _createdDate:DATETIME, _updatedDate:DATETIME, _owner:TEXT
~~~

### MapaStaff — MAPA_STAFF
Revisión 136 · 44 campos · 5 items · permisos CMS ADMIN para read/insert/update/remove.

~~~text
displayName:TEXT, productionActivationAt:DATETIME, phoneFiscal:TEXT, phonePersonal:TEXT, emailFiscal:EMAIL, emailPersonal:EMAIL, contactAddress:OBJECT, province:TEXT, postalCode:TEXT, streetNumber:TEXT, businessDescription:TEXT, currency:TEXT, legalName:TEXT, address:TEXT, traceId:TEXT, staffMemberId:TEXT, scheduleId:TEXT, memberId:TEXT, resourceId:TEXT, _id:TEXT, _createdDate:DATETIME, _updatedDate:DATETIME, _owner:TEXT, verificationSource:TEXT, sourceSystem:TEXT, identityStatus:TEXT, identityType:TEXT, recordType:TEXT, schemaVersion:NUMBER, rolWebsite:TEXT, rolBookings:TEXT, ServiciosCatalogo_staffMembers:MULTI_REFERENCE->ServiciosCatalogo, fiscalIdType:TEXT, fiscalCountry:TEXT, fechaInicioVerifactu:DATE, taxId:TEXT, taxRegime:TEXT, verifactuEnabled:BOOLEAN, verifactuVersion:TEXT, operationalScope:ARRAY_STRING, legalEntityType:TEXT, isPrimaryIdentity:BOOLEAN, thirdPartyType:TEXT, tipoUsoPosibleMultiOT:BOOLEAN
~~~

### MovimientosCaja — MOVIMIENTOS_CAJA
Revisión 110 · 114 campos · 5 items · permisos CMS ADMIN para read/insert/update/remove.

~~~text
resourceId:TEXT, recordNature:TEXT, workDate:DATE, memberId:TEXT, laborRecordId:TEXT, cashDenominationBreakdown:OBJECT, nextCashBalance:NUMBER, previousCashBalance:NUMBER, cashOperationType:TEXT, cashMovementType:TEXT, documentType:TEXT, payee:TEXT, userRole:TEXT, approvedByUserId:TEXT, correctionRequestedBy:TEXT, reviewedByUserId:TEXT, authorizedByUserId:TEXT, confirmedByUserId:TEXT, createdByUserId:TEXT, closedAt:DATETIME, confirmedAt:DATETIME, journalEntryId:TEXT, incidentId:TEXT, cashCountId:TEXT, openingId:TEXT, auditEventId:TEXT, documentId:TEXT, payloadAEAT:OBJECT, NIFEmisor:TEXT, NIFDestinatario:TEXT, IRPFWithholdingRate:NUMBER, IRPFWithholdingAmount:NUMBER, baseImponibleOImporteNoSujeto:NUMBER, signatureAlgorithm:TEXT, hashAlgorithm:TEXT, verificationQR:TEXT, digitalSignature:TEXT, generationTimestamp:DATETIME, serviceIdRedeemed:TEXT, giftCardOperation:TEXT, giftCardId:TEXT, accountingSign:NUMBER, lineItems:OBJECT, recordSource:TEXT, desgloseDetallado:OBJECT, bankReconciliationReference:TEXT, vatAccrualStatus:TEXT, linkedAdvanceId:TEXT, article20Exempt:BOOLEAN, cashBasisRegime:BOOLEAN, nonSubjectReason:TEXT, issuerThirdPartyTaxId:TEXT, thirdPartyLegalName:TEXT, issuedByThirdPartyOrRecipient:TEXT, isB2B:BOOLEAN, issuerLegalName:TEXT, correctionAmount:NUMBER, issuerInvoiceNumber:TEXT, previousInvoiceIssueDate:DATE, previousInvoiceNumber:TEXT, correctionReason:TEXT, withholdingBase:NUMBER, surchargeRate:NUMBER, linkedBookingIds:ARRAY_STRING, bookingId:TEXT, hash:TEXT!, amount:NUMBER!, taxAmount:NUMBER, taxBase:NUMBER, numSerieFactura:TEXT!, sequenceNumber:NUMBER!, transactionId:TEXT!, previousRecordHash:TEXT!, recordTimestamp:DATETIME!, schemaVersion:TEXT!, traceId:TEXT!, movementType:TEXT!, totalAmount:NUMBER!, paymentMethod:TEXT!, channelType:TEXT!, operationDescription:TEXT!, staffResourceId:TEXT!, tipoFactura:TEXT!, fechaExpedicionFactura:DATE!, fechaOperacion:DATE, tipoImpositivo:NUMBER!, recipientLegalName:TEXT, recipientAddress:OBJECT, payloadFiscal:OBJECT, sistemaInformatico:OBJECT, estadoEnvioAEAT:TEXT, csvAEAT:TEXT, fechaEnvioAEAT:DATETIME, tipoRectificativa:TEXT, previousInvoiceId:TEXT, claveRegimen:TEXT, calificacionOperacion:TEXT, operacionExenta:BOOLEAN, inversionSujetoPasivo:BOOLEAN, surchargeAmount:NUMBER, fiscalRole:TEXT, eventType:TEXT, thirdPartyId:TEXT, catalogId:TEXT, pairToken:TEXT, orderId:TEXT, refundId:TEXT, fiscalPeriod:TEXT!, accountingAmount:NUMBER, projectionStatus:TEXT, _id:TEXT, _createdDate:DATETIME, _updatedDate:DATETIME, _owner:TEXT
~~~

### RegistroIntegracion — REGISTRO_INTEGRACION
Revisión 5 · 21 campos · 3 items · permisos CMS ADMIN para read/insert/update/remove.

~~~text
eventId:TEXT, eventType:TEXT, sourceModule:TEXT, sourceCollection:TEXT, sourceItemId:TEXT, occurredAt:DATETIME, traceId:TEXT, correlationId:TEXT, idempotencyKey:TEXT, schemaVersion:TEXT, payload:OBJECT, payloadHash:TEXT, deliveryStatus:TEXT, deliveryAttempts:NUMBER, nextAttemptAt:DATETIME, deliveredAt:DATETIME, lastDeliveryError:TEXT, _id:TEXT, _createdDate:DATETIME, _updatedDate:DATETIME, _owner:TEXT
~~~

### RegistrosHorariosStaff — REGISTROS_HORARIOS_STAFF
Revisión 2 · 47 campos · 0 items · permisos CMS ADMIN para read/insert/update/remove.

~~~text
resourceId:TEXT!, memberId:TEXT!, employeeNumber:TEXT, staffName:TEXT, workplaceId:TEXT, workplaceName:TEXT, recordId:TEXT!, laborRecordId:TEXT, clockEventType:TEXT!, recordType:TEXT!, source:TEXT!, recordedAt:DATETIME!, recordedTime:DATETIME, workDate:DATE!, dayKey:TEXT!, monthKey:TEXT!, timeZone:TEXT!, clockInAt:DATETIME, clockOutAt:DATETIME, workedMinutes:NUMBER, scheduledStartAt:DATETIME, scheduledEndAt:DATETIME, breakStartAt:DATETIME, breakEndAt:DATETIME, breakMinutes:NUMBER, overtimeMinutes:NUMBER, absenceType:TEXT, isManualAdjustment:BOOLEAN, adjustmentReason:TEXT, adjustedAt:DATETIME, adjustedByUserId:TEXT, registeredBy:TEXT, registeredByMemberId:TEXT, approvedByUserId:TEXT, reviewedByUserId:TEXT, deviceId:TEXT, deviceIpAddress:TEXT, signature:TEXT, recordHash:TEXT!, previousRecordHash:TEXT, schemaVersion:TEXT!, traceId:TEXT!, meta:OBJECT, _id:TEXT, _createdDate:DATETIME, _updatedDate:DATETIME, _owner:TEXT
~~~

### ServiciosCatalogo — SERVICIOS_CATALOGO
Revisión 204 · 43 campos · 95 items · permisos CMS ADMIN para read/insert/update/remove.

~~~text
sessionCount:NUMBER, staffMembers:MULTI_REFERENCE->MapaStaff, pricingPlanId:TEXT, catalogEntryType:TEXT, locationId:TEXT, description:TEXT, _id:TEXT, serviceId:TEXT, title:TEXT, slug:TEXT, tagLine:TEXT, categoryId:TEXT, itemNature:TEXT, sku:TEXT, price:NUMBER, currency:TEXT, taxIncluded:BOOLEAN, tipoImpositivo:NUMBER, calificacionOperacion:TEXT, totalDuration:NUMBER, phase1Duration:NUMBER, phase2Duration:NUMBER, exposureDuration:NUMBER, allowCombine:BOOLEAN, linkedPhases:TEXT, location:TEXT, clientHidden:BOOLEAN, onlinePayment:BOOLEAN, inPersonPayment:BOOLEAN, pricingModel:TEXT, depositType:TEXT, depositAmount:NUMBER, margin:NUMBER, internalNotes:TEXT, category:TEXT, precioCosteBase:NUMBER, _createdDate:DATETIME, mainMedia:IMAGE, _updatedDate:DATETIME, _owner:TEXT, recomendaciones:TEXT, bookingsStaffNames:OBJECT, bookingsStaff:OBJECT
~~~

### TransaccionesTPV — TRANSACCIONES_TPV
Revisión 7 · 27 campos · 0 items · permisos CMS ADMIN para read/insert/update/remove.

~~~text
recordNature:TEXT, recordTimestamp:DATETIME, sessionId:TEXT!, orderId:TEXT, lineas:ARRAY!<OBJECT>, subtotalNeto:NUMBER!, subtotalNetoMinor:NUMBER!, impuestosTotal:NUMBER!, impuestosTotalMinor:NUMBER!, totalVenta:NUMBER!, totalVentaMinor:NUMBER!, medioPago:TEXT, paymentSelection:ARRAY!<OBJECT>, operatorResourceId:TEXT!, operatorId:TEXT!, createdAt:DATETIME!, status:TEXT!, sourceType:TEXT!, requiresReconciliation:BOOLEAN!, draftOrderReason:TEXT, requestFingerprint:TEXT!, currency:TEXT!, traceId:TEXT!, _id:TEXT, _createdDate:DATETIME, _updatedDate:DATETIME, _owner:TEXT
~~~

## 4. Relaciones tipadas confirmadas

- ServiciosCatalogo.staffMembers -> MapaStaff (MULTI_REFERENCE).
- MapaStaff.ServiciosCatalogo_staffMembers -> ServiciosCatalogo (MULTI_REFERENCE).
- Las demás relaciones de negocio representadas mediante campos TEXT/ID no son referencias CMS tipadas en este esquema.

## 5. Datos observados y calidad

Los recuentos y resúmenes se obtuvieron leyendo items de cada colección NATIVE con consistentRead=true. No se han exportado datos personales ni payloads completos.

| Colección | Observación de contenido |
|---|---|
| CajaActual | 1 singleton ABIERTA. Apertura 300 EUR; cashAmount/expectedCash 320 EUR; countedCash 0; difference 0; salesCount 2. snapshotSource=MOVIMIENTOS_CAJA_RECONCILIADOS. |
| CitasF2 | 11 items: 10 CONFIRMED, 1 PENDING; 9 NOT_PAID, 2 PENDING_LEDGER; 3 DUAL_F1, 3 DUAL_F2 y 5 SIMPLE. |
| ComplementosCatalogo | 36 items. |
| ControlOperativo | 81 items: 9 SLOT_LOCK liberados, 6 IDEMPOTENCY completados, 6 DAYS_CACHE (1 INVALIDATED y 5 sin status), 4 RATE_LIMIT activos, 15 WEBHOOK_EVENT completados, 33 WEBHOOK_CLAIM completados, 5 TPV_FUNCTIONAL_TEST completados y 3 COMPENSATION PENDING_RECOVERY. |
| HistoricoCierresZ | 1 item SIMULATED / Z_SIMULATED; faltan fiscalPeriod, totalTaxAmount, totalTaxBase y operationDate, todos required en el esquema actual. |
| LibroAsientosContablesDetalle | 3 items; los 3 tienen projectionStatus=SIMULATED_ONLY. |
| MapaStaff | 5 items: STAFF=3, TERCERO=1, GESTORIA=1. No existe item CONFIG_SISTEMA en el conjunto leído. |
| MovimientosCaja | 5 items: movementType SALE=2 y REFUND=1; recordSource=TPV_QA_DEVELOPMENT en 3. Un item no tiene transactionId. |
| RegistroIntegracion | 3 items, todos deliveryStatus=NOT_SENT; 2 TPV_SALE_SIMULATED y 1 TPV_REFUND_SIMULATED. |
| RegistrosHorariosStaff | 0 items. |
| ServiciosCatalogo | 95 items: 94 SERVICE y 1 PRICING_PLAN. |
| TransaccionesTPV | 0 items. |

### Incidencias de conformidad de datos

1. MovimientosCaja: los cinco items carecen de varios campos required del esquema físico: hash, numSerieFactura, sequenceNumber, previousRecordHash, recordTimestamp, schemaVersion, operationDescription, staffResourceId, tipoFactura, fechaExpedicionFactura, tipoImpositivo y fiscalPeriod. Dos items carecen además de movementType, totalAmount y channelType; uno carece de transactionId.
2. MovimientosCaja: existen claves persistidas que no están declaradas en el esquema actual, entre ellas synthetic, cashDelta, source, gatewayResponse, operationType, reconciliationStatus, testCase, changeReturned, operationDateHour, status, customer, cardDelta, otherDelta, amountReceived y createdAt. Wix Data permite persistir propiedades ajenas al esquema; esto no las convierte en campos canónicos.
3. HistoricoCierresZ: el único item no satisface cuatro campos required. Su estado SIMULATED/Z_SIMULATED impide tratarlo como cierre operativo válido.
4. CajaActual: el registro incluye posOrderId, posTransactionId y posPaymentId, que no existen en el esquema físico. La sesión está ABIERTA; no cerrarla ni reutilizarla como fixture.
5. MapaStaff: un item contiene la clave no declarada email. No existe CONFIG_SISTEMA en los cinco items leídos, aunque el esquema sí contiene los campos para recordType, taxId, legalName, productionActivationAt y configuración fiscal.
6. TransaccionesTPV: la colección está vacía y su esquema no declara transactionId. No confundir sessionId/requestFingerprint de la intención TPV con transactionId del movimiento fiscal en MovimientosCaja.
7. RegistrosHorariosStaff: la colección existe y su esquema está definido, pero no hay items.

8. ControlOperativo: auditoría Wix consistente del 2026-11-27 (81/81 items; revisión 95). Se detectaron 6 WEBHOOK_EVENT históricos con eventType/processedAt solo en payload, 6 WEBHOOK_CLAIM históricos con ownerToken y aliases payload.attempt/payload.leaseExpiresAt sin attempts/expiresAt top-level, y 3 SLOT_LOCK históricos liberados sin payload.slotStart/slotEnd. Los registros afectados son terminales; WEBHOOK_EVENT es append-only. No se modificaron ni migraron. Los writers actuales ya emiten los campos canónicos y sus hooks los validan; se endureció además la creación/validación de locks de reserva para rechazar intervalos ausentes o inválidos. No se detectaron tipos superiores incorrectos ni campos raíz desconocidos. resourceId vacío en DAYS_CACHE es intencional porque la clave representa un conjunto de recursos.

Los datos actuales son anteriores al despliegue oficial de producción de 2027 y, por la política del proyecto, son sintéticos. Los marcadores explícitos no son uniformes: por ejemplo, solo tres de los cinco movimientos indican recordSource=TPV_QA_DEVELOPMENT. No inferir naturaleza real a partir de la ausencia de marcador.

**Acción de seguridad:** no modificar, completar, borrar ni reconciliar estos items desde esta auditoría. Los defectos de conformidad deben resolverse mediante los writers y procedimientos de recuperación autorizados, preservando append-only donde corresponda.

## 6. Contratos y límites de responsabilidad

- Bookings V2 gobierna las reservas nativas. CitasF2 es una proyección propia reconciliable; bookingId conserva la identidad nativa.
- Stores Catalog V3 gobierna catálogo e inventario comercial. No usar Stores V1 ni reactivar InventarioStockVenta/MovimientosInventario legacy.
- ServiciosCatalogo y ComplementosCatalogo son catálogos propios; no sustituyen los IDs nativos de Bookings o Stores.
- MapaStaff es el maestro propio discriminado por recordType para personal, terceros, gestoría y configuración del sistema. El esquema existe; la configuración fiscal singleton no está presente en los datos leídos.
- TransaccionesTPV representa la intención comercial del TPV. No acredita pago, movimiento de caja ni registro fiscal.
- MovimientosCaja es el ledger de movimientos físicos/fiscales. Su writer debe cumplir los campos required, transactionId e idempotencia.
- CajaActual es una proyección de sesión, no un ledger.
- HistoricoCierresZ y LibroAsientosContablesDetalle conservan evidencia de cierre/contabilidad; sus registros no deben sobrescribirse para corregir datos.
- ControlOperativo conserva locks, idempotencia, webhooks y compensaciones. Sus estados operativos pueden cambiar mediante procedimientos idempotentes, sin borrar evidencia.
- RegistroIntegracion conserva entrega y resultado de eventos externos; no es fuente transaccional.
- RegistrosHorariosStaff es el repositorio de registros laborales append-only; su contenido está vacío en este corte.

## 7. Referencias oficiales y navegación

- [Wix Data Collections API — List Data Collections](https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-collections/list-data-collections)
- [Wix Data Items API — Query Data Items](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/query-data-items)
- [Wix Data Items API — Count Data Items](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/count-data-items)
- [Wix CMS — Data Collections](https://manage.wix.com/dashboard/188bed94-177c-4bc9-a9f0-35080d874f3e/wix-cms)

El diccionario extenso anterior y sus snapshots quedan en docs/archive como evidencia histórica. Para el estado físico actual prevalece este documento y debe renovarse con una nueva lectura consistente antes de cualquier migración o cambio CMS.
