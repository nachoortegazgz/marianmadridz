> **DOCUMENTO HISTÓRICO / SUPERSEDIDO.** Este inventario resumido no es el esquema físico vigente. Su fuente sustituta es [docs/ESQUEMA_CMS.md](docs/ESQUEMA_CMS.md), actualizado mediante lectura Wix read-only del 27-11-2026. No usar ambos como fuentes equivalentes ni ejecutar migraciones/escrituras a partir de este archivo. Se conserva para trazabilidad histórica.

---

# COLECCIONES PERSONALIZADAS EN CMS

### 1. CAJA_ACTUAL
`singletonKey`, `closedAt`, `closedBy`, `cierreZReference`, `openedAt`, `openedBy`, `operationDateHour`, `cashRegisterStatus`, `openingCashAmount`, `openingCardAmount`, `openingBizumAmount`, `openingOtherAmount`, `cashAmount`, `cardAmount`, `bizumAmount`, `otherAmount`, `cashMovementId`, `lastMovementAt`, `snapshotSource`, `salesCount`, `expectedCash`, `countedCash`, `difference`, `differenceReason`, `sequenceCounters`, `ticketSequence`, `lastOperationId`, `lastOperationType`, `lastOperationAmount`, `lastOperationPaymentMethod`, `lastOperationAt`, `lastOperationStatus`, `traceId`, `posIntegrationStatus`, `ticketSyncStatus`, `orderId`, `checkoutId`, `paymentId`, `transactionId`, `paymentReference`, `paymentStatus`, `paymentMethod`, `paymentBreakdown`, `amountReceived`, `changeReturned`, `posPaymentStatus`, `posPaymentMethod`, `posPaymentProvider`, `posAmount`, `posCurrency`, `posPaidAt`, `ticketNumber`, `ticketIssuedAt`, `ticketType`, `ticketSeries`, `lineItems`, `conceptOperations`, `conceptQuantities`, `customerName`, `customerTaxId`, `customerAddress`, `netPrice`, `discountAmount`, `taxableBaseTotal`, `appliedTax`, `taxTotal`, `ticketTotal`, `fiscalText`, `verifactuReference`, `verificationQr`, `ticketXControlReference`, `contactId`, `catalogItemId`, `serviceId`, `bookingId`, `snapshotUpdatedAt`.

### 2. CITAS_F2
`slotStart*`, `timeZone`, `cancellationReason`, `privacyNoticePurpose`, `privacyNoticeAcceptedAt`, `privacyNoticeVersion`, `totalAmount*`, `slotEnd*`, `bookingId*`, `traceId*`, `bookingType*`, `bookingStatus*`, `paymentStatus*`, `serviceId*`, `resourceId*`, `pairToken`, `dateYmd*`, `scheduleId`, `contactDetails`, `cashMovementId`, `revision`, `meta`, `orderId`, `thirdPartyId`, `catalogId`.

### 3. COMPLEMENTOS_CATALOGO
`sku*`, `taxIncluded*`, `durationMinutes`, `tipoImpositivo`, `addonId*`, `traceId`, `name`, `description`, `price`, `itemNature`, `codigoImpuesto`, `claveRegimen`, `cuentaContableIngreso`, `ServiciosCatalogo_name`.

### 4. CONTROL_OPERATIVO
`eventType`, `controlType*`, `dedupeKey*`, `traceId*`, `status`, `eventId`, `expiresAt`, `bookingId`, `resourceId`, `serviceId`, `dateYmd`, `attempts`, `surface`, `requesterKey`, `requestCount`, `windowStart`, `payload*`, `version`, `heartbeatAt`, `ownerToken`, `transactionId`, `orderId`, `refundId`, `kind`, `processedAt`, `operationDescription`, `lastError`, `totalAmount`.

### 5. HISTORICO_CIERRES_Z
`totalTips`, `workDate`, `memberId`, `staffResourceId`, `laborRecordId`, `snapshotJSON`, `closedAt`, `timeZone`, `closingSchemaVersion`, `closingSource`, `auditedRecordsCount`, `taxTypeBreakdown`, `movementTypeBreakdown`, `endTicketNumber`, `startTicketNumber`, `totalOperations`, `totalAdjustments`, `closeDate*`, `totalRefunds`, `fiscalPeriod*`, `totalTaxAmount*`, `totalTaxBase*`, `totalOnline*`, `totalBizum*`, `totalCard*`, `totalCash*`, `closedBy*`, `recordDomain*`, `closingStatus`, `operationDate*`, `consolidatedTotalAmount`, `grossSalesTotal`, `netTaxableAmount`, `netTaxAmount`, `totalesMedioPago`, `startSequence`, `endSequence`, `startRecordHash`, `endRecordHash`, `isIntegrityVerified`, `closingHash`, `closingSignature`, `closingSignatureStatus`, `verifiedAt`, `approverUser`, `estadoEnvioAEAT`, `traceId*`, `inventoryClosingId`, `fiscalYear`, `closingType`, `sku`, `wixProductId`, `stockQuantity`, `unitCost`, `stockValue`, `cuentaContable`, `summaryData`, `invoiceData`, `packageStatus`, `packageVersion`, `sentTo`, `sentAt`.

### 6. LIBRO_ASIENTOS_CONTABLES_DETALLE
Incluye datos de operación, reservas, pagos, facturación, impuestos, AEAT, firmas, auditoría y trazabilidad: `resourceId`, `workDate`, `memberId`, `laborRecordId`, `sequenceNumber`, `documentId`, `auditEventId`, `transactionId`, `orderId`, `bookingId`, `linkedBookingIds`, `refundId`, `journalEntryId`, `incidentId`, `staffResourceId`, `catalogId`, `thirdPartyId`, `pairToken`, `giftCardId`, `giftCardOperation`, `serviceIdRedeemed`, `recordSource`, `recordTimestamp`, `generationTimestamp`, `fechaOperacion`, `fechaExpedicionFactura`, `confirmedAt`, `closedAt`, `fiscalPeriod`, `schemaVersion`, `traceId`, `eventType`, `movementType`, `paymentMethod`, `channelType`, `operationDescription`, `amount`, `totalAmount`, `accountingAmount`, `accountingSign`, `taxBase`, `taxAmount`, `tipoImpositivo`, `correctionAmount`, `correctionReason`, `surchargeRate`, `surchargeAmount`, `withholdingBase`, `IRPFWithholdingRate`, `IRPFWithholdingAmount`, `lineItems`, `desgloseDetallado`, `bankReconciliationReference`, `projectionStatus`, `NIFEmisor`, `issuerLegalName`, `issuerThirdPartyTaxId`, `thirdPartyLegalName`, `issuedByThirdPartyOrRecipient`, `NIFDestinatario`, `recipientLegalName`, `recipientAddress`, `isB2B`, `tipoFactura`, `numSerieFactura`, `claveRegimen`, `calificacionOperacion`, `fiscalRole`, `operacionExenta`, `article20Exempt`, `cashBasisRegime`, `nonSubjectReason`, `tipoRectificativa`, `previousInvoiceId`, `previousInvoiceNumber`, `previousInvoiceIssueDate`, `inversionSujetoPasivo`, `payloadFiscal`, `payloadAEAT`, `sistemaInformatico`, `estadoEnvioAEAT`, `csvAEAT`, `verificationQR`, `digitalSignature`, `signatureAlgorithm`, `hashAlgorithm`, `hash`, `previousRecordHash`, `createdByUserId`, `confirmedByUserId`, `authorizedByUserId`, `reviewedByUserId`, `approvedByUserId`, `correctionRequestedBy`, `userRole`, `payee`, `documentType`.

### 7. MAPA_STAFF
`displayName`, `phoneFiscal`, `phonePersonal`, `emailFiscal`, `emailPersonal`, `contactAddress`, `province`, `postalCode`, `streetNumber`, `businessDescription`, `currency`, `legalName`, `address`, `traceId`, `staffMemberId`, `scheduleId`, `memberId`, `resourceId`, `verificationSource`, `sourceSystem`, `identityStatus`, `identityType`, `recordType`, `schemaVersion`, `rolWebsite`, `rolBookings`, `ServiciosCatalogo_staffMembers`, `fiscalIdType`, `fiscalCountry`, `fechaInicioVerifactu`, `taxId`, `taxRegime`, `verifactuEnabled`, `verifactuVersion`, `operationalScope`, `legalEntityType`, `isPrimaryIdentity`, `thirdPartyType`, `tipoUsoPosibleMultiOT`.

### 8. MOVIMIENTOS_CAJA
Contiene movimientos de caja, reservas, pagos, facturación, impuestos, AEAT, auditoría y hashes. Campos principales: `resourceId`, `workDate`, `memberId`, `laborRecordId`, `cashDenominationBreakdown`, `nextCashBalance`, `previousCashBalance`, `cashOperationType`, `cashMovementType`, `documentType`, `payee`, `userRole`, `approvedByUserId`, `correctionRequestedBy`, `reviewedByUserId`, `authorizedByUserId`, `confirmedByUserId`, `createdByUserId`, `closedAt`, `confirmedAt`, `journalEntryId`, `incidentId`, `cashCountId`, `openingId`, `auditEventId`, `documentId`, `payloadAEAT`, `NIFEmisor`, `NIFDestinatario`, `IRPFWithholdingRate`, `IRPFWithholdingAmount`, `baseImponibleOImporteNoSujeto`, `signatureAlgorithm`, `hashAlgorithm`, `verificationQR`, `digitalSignature`, `generationTimestamp`, `serviceIdRedeemed`, `giftCardOperation`, `giftCardId`, `accountingSign`, `lineItems`, `recordSource`, `desgloseDetallado`, `bankReconciliationReference`, `vatAccrualStatus`, `linkedAdvanceId`, `article20Exempt`, `cashBasisRegime`, `nonSubjectReason`, `issuerThirdPartyTaxId`, `thirdPartyLegalName`, `issuedByThirdPartyOrRecipient`, `isB2B`, `issuerLegalName`, `correctionAmount`, `issuerInvoiceNumber`, `previousInvoiceIssueDate`, `previousInvoiceNumber`, `correctionReason`, `withholdingBase`, `surchargeRate`, `linkedBookingIds`, `bookingId`, `hash*`, `amount*`, `taxAmount`, `taxBase`, `numSerieFactura*`, `sequenceNumber*`, `transactionId*`, `previousRecordHash*`, `recordTimestamp*`, `schemaVersion*`, `traceId*`, `movementType*`, `totalAmount*`, `paymentMethod*`, `channelType*`, `operationDescription*`, `staffResourceId*`, `tipoFactura*`, `fechaExpedicionFactura*`, `fechaOperacion`, `tipoImpositivo*`, `recipientLegalName`, `recipientAddress`, `payloadFiscal`, `sistemaInformatico`, `estadoEnvioAEAT`, `tipoRectificativa`, `previousInvoiceId`, `claveRegimen`, `calificacionOperacion`, `operacionExenta`, `inversionSujetoPasivo`, `surchargeAmount`, `fiscalRole`, `eventType`, `thirdPartyId`, `catalogId`, `pairToken`, `orderId`, `refundId`, `fiscalPeriod*`, `accountingAmount`, `projectionStatus`.

### 9. REGISTRO_INTEGRACION
`eventId`, `eventType`, `sourceModule`, `sourceCollection`, `sourceItemId`, `occurredAt`, `traceId`, `correlationId`, `idempotencyKey`, `schemaVersion`, `payload`, `payloadHash`, `deliveryStatus`, `deliveryAttempts`, `nextAttemptAt`, `deliveredAt`, `lastDeliveryError`.

### 10. REGISTROS_HORARIOS_STAFF
`resourceId*`, `memberId*`, `employeeNumber`, `staffName`, `workplaceId`, `workplaceName`, `recordId*`, `laborRecordId`, `clockEventType*`, `recordType*`, `source*`, `recordedAt*`, `recordedTime`, `workDate*`, `dayKey*`, `monthKey*`, `timeZone*`, `clockInAt`, `clockOutAt`, `workedMinutes`, `scheduledStartAt`, `scheduledEndAt`, `breakStartAt`, `breakEndAt`, `breakMinutes`, `overtimeMinutes`, `absenceType`, `isManualAdjustment`, `adjustmentReason`, `adjustedAt`, `adjustedByUserId`, `registeredBy`, `registeredByMemberId`, `approvedByUserId`, `reviewedByUserId`, `deviceId`, `deviceIpAddress`, `signature`, `recordHash*`, `previousRecordHash`, `schemaVersion*`, `traceId*`, `meta`.

### 11. SERVICIOS_CATALOGO
`sessionCount`, `staffMembers`, `pricingPlanId`, `catalogEntryType`, `locationId`, `description`, `serviceId`, `title`, `slug`, `tagLine`, `categoryId`, `itemNature`, `sku`, `price`, `currency`, `taxIncluded`, `tipoImpositivo`, `calificacionOperacion`, `totalDuration`, `phase1Duration`, `phase2Duration`, `exposureDuration`, `allowCombine`, `linkedPhases`, `location`, `clientHidden`, `onlinePayment`, `inPersonPayment`, `pricingModel`, `depositType`, `depositAmount`, `margin`, `internalNotes`, `category`, `precioCosteBase`, `mainMedia`, `recomendaciones`, `name`, `bookingsStaffNames`, `bookingsStaff`.

### 12. TRANSACCIONES_TPV
`sessionId*`, `orderId`, `lineas*`, `subtotalNeto*`, `subtotalNetoMinor*`, `impuestosTotal*`, `impuestosTotalMinor*`, `totalVenta*`, `totalVentaMinor*`, `medioPago`, `paymentSelection*`, `operatorResourceId*`, `operatorId*`, `createdAt*`, `status*`, `sourceType*`, `requiresReconciliation*`, `draftOrderReason`, `requestFingerprint*`, `currency*`, `traceId*`.

Esta lectura fue únicamente informativa: **no se modificó ninguna colección ni ningún campo**.


## Análisis funcional actualizado de las colecciones

### 1. Fuentes consultivas y catálogo

| Colección | Función probable |
|---|---|
| **ServiciosCatalogo** | Catálogo principal de servicios, tratamientos, precios, duración, categorías y profesionales asociados. |
| **ComplementosCatalogo** | Extras, complementos o productos adicionales vinculados a servicios o ventas. |
| **MapaStaff** | Relación entre profesionales, servicios que realizan, especialidades y configuración operativa del personal. |

**Relación confirmada:** `ServiciosCatalogo.staffMembers` ↔ `MapaStaff.ServiciosCatalogo_staffMembers`.

---

### 2. Reservas y agenda

| Colección | Función probable |
|---|---|
| **CitasF2** | Registro de citas o reservas del flujo F2: cliente, servicio, profesional, fecha, duración, estado y datos de exposición. |

Debe contrastarse con Wix Bookings para determinar si es una fuente auxiliar, una réplica o el registro principal de reservas.

---

### 3. Caja y tesorería

| Colección | Función probable |
|---|---|
| **CajaActual** | Estado actual de caja, saldo, sesión abierta y datos del arqueo vigente. |
| **MovimientosCaja** | Entradas, salidas, ajustes, retiradas y movimientos manuales de efectivo. |
| **HistoricoCierresZ** | Historial de cierres Z, arqueos, totales diarios y consolidación de jornadas. |

`CajaActual` tiene los complementos `SINGLE_ITEM` y `EDITABLE_PAGE_LINK`.

---

### 4. TPV, ventas y cobros

| Colección | Función probable |
|---|---|
| **TransaccionesTPV** | Registro de ventas, cobros, líneas de venta, métodos de pago, importes, estados y referencias operativas. |

Estructuras destacadas:

- `lineas`: array de objetos.
- `paymentSelection`: array de objetos.
- Posibles vínculos con servicios, complementos, caja y contabilidad.
- No tiene actualmente el complemento `PUBLISH`.

Esta colección parece ser el núcleo transaccional del TPV, pero la finalidad exacta de cada campo debe validarse con registros reales.

---

### 5. Contabilidad y control administrativo

| Colección | Función probable |
|---|---|
| **LibroAsientosContablesDetalle** | Detalle de líneas contables, cuentas, importes, impuestos, conceptos y referencias a operaciones. |
| **ControlOperativo** | Parámetros de control, estados, validaciones, indicadores y reglas administrativas o de supervisión. |

`LibroAsientosContablesDetalle` parece depender funcionalmente de ventas, caja y cierres, aunque no se confirmó una relación estructural completa entre colecciones.

---

### 6. Personal y control horario

| Colección | Función probable |
|---|---|
| **RegistrosHorariosStaff** | Horarios, turnos, fichajes, presencia, actividad o control horario del personal. |
| **MapaStaff** | También participa en esta área por contener la identificación y configuración de los profesionales. |

`MapaStaff` tiene una función transversal: catálogo de personal, asignación de servicios y posible base para horarios.

---

### 7. Integraciones y trazabilidad técnica

| Colección | Función probable |
|---|---|
| **RegistroIntegracion** | Registro de sincronizaciones, llamadas externas, identificadores, estados, respuestas, errores y reintentos. |

Probablemente actúa como bitácora técnica para conectar TPV, reservas, contabilidad u otros servicios externos.

---

## Vista resumida

| Área funcional | Colecciones |
|---|---|
| Fuentes consultivas y catálogo | `ServiciosCatalogo`, `ComplementosCatalogo`, `MapaStaff` |
| Reservas y agenda | `CitasF2` |
| Caja y tesorería | `CajaActual`, `MovimientosCaja`, `HistoricoCierresZ` |
| TPV, ventas y cobros | `TransaccionesTPV` |
| Contabilidad | `LibroAsientosContablesDetalle`, `ControlOperativo` |
| Personal y horarios | `MapaStaff`, `RegistrosHorariosStaff` |
| Integraciones y trazabilidad | `RegistroIntegracion` |

### Conclusión

La arquitectura parece organizarse alrededor de este flujo:

**Catálogo y personal → reserva o venta → TPV y caja → cierre → contabilidad → integración y trazabilidad.**

Esta clasificación es funcional y está basada en los nombres, campos, estructuras y relaciones observadas. No confirma todavía qué colección es la fuente única de verdad de cada proceso.

## Colecciones agrupadas por función

### 1. Fuentes consultivas y catálogo operativo
Colecciones que sirven como fuentes consultivas para servicios, complementos y personal:

- **ServiciosCatalogo**  
  Catálogo de servicios ofrecidos, datos descriptivos, precios, duración, categorías y relación con profesionales.

- **ComplementosCatalogo**  
  Complementos o extras asociados a servicios, productos o tratamientos.

- **MapaStaff**  
  Registro de profesionales, especialidades, disponibilidad operativa y relación con los servicios del catálogo.

### 2. Reservas y agenda
Colecciones relacionadas con la gestión de citas:

- **CitasF2**  
  Reservas, citas o sesiones generadas en el flujo F2. Probablemente contiene cliente, servicio, profesional, fecha, estado y datos de exposición o confirmación.

> La función exacta de cada campo debe validarse con registros reales y con la configuración de Wix Bookings.

### 3. Caja y tesorería
Colecciones destinadas al control de efectivo y movimientos de caja:

- **CajaActual**  
  Estado o saldo actual de la caja. Incluye configuración de elemento único y enlace editable a página.

- **MovimientosCaja**  
  Entradas, salidas, ajustes y movimientos de efectivo.

- **HistoricoCierresZ**  
  Historial de cierres Z, arqueos y consolidaciones de caja por periodo o jornada.

### 4. TPV, pagos y ventas
Colección que concentra la información transaccional:

- **TransaccionesTPV**  
  Ventas, pagos, líneas de operación, métodos de pago, importes, estados y metadatos de la transacción.

  Contiene estructuras complejas como:

  - `lineas`: array de objetos.
  - `paymentSelection`: array de objetos.
  - Datos potencialmente vinculados con servicios, complementos, caja y clientes.

Actualmente no tiene el complemento `PUBLISH`, por lo que no utiliza el flujo de borrador/publicación del CMS.

### 5. Contabilidad y asientos
Colección orientada al detalle contable:

- **LibroAsientosContablesDetalle**  
  Líneas de asientos, cuentas, importes, conceptos, impuestos, referencias a operaciones y desglose contable.

- **ControlOperativo**  
  Parámetros, controles, estados, validaciones o indicadores utilizados para supervisar la operativa y los procesos administrativos.

### 6. Registro técnico e integraciones
Colecciones destinadas a trazabilidad, sincronizaciones y control técnico:

- **RegistroIntegracion**  
  Registro de intercambios con servicios externos, sincronizaciones, respuestas, errores, identificadores externos y estados de integración.

- **RegistrosHorariosStaff**  
  Registro de horarios, turnos, fichajes o actividad horaria del personal.

### 7. Resumen funcional

| Área | Colecciones |
|---|---|
| Catálogo y fuentes consultivas | `ServiciosCatalogo`, `ComplementosCatalogo`, `MapaStaff` |
| Reservas | `CitasF2` |
| Caja y tesorería | `CajaActual`, `MovimientosCaja`, `HistoricoCierresZ` |
| TPV y pagos | `TransaccionesTPV` |
| Contabilidad | `LibroAsientosContablesDetalle`, `ControlOperativo` |
| Integraciones y trazabilidad | `RegistroIntegracion` |
| Personal y horarios | `RegistrosHorariosStaff` |

Estas agrupaciones son **clasificaciones funcionales basadas en los nombres, campos y relaciones observadas**. No deben interpretarse como una validación definitiva de los procesos de negocio hasta contrastarlas con los registros reales, los flujos F1/F2 y la lógica Velo del sitio.
He consultado las **12 colecciones personalizadas**. Los campos obligatorios están marcados con **\***. También existen campos técnicos de Wix (`_id`, `_createdDate`, `_updatedDate`, `_owner`) en casi todas.

## Vínculos confirmados y probables

### Panel general de colecciones CMS
[**Abrir colecciones CMS**](https://manage.wix.com/dashboard/188bed94-177c-4bc9-a9f0-35080d874f3e/wix-cms)

### Colecciones personalizadas

- [CajaActual](https://manage.wix.com/dashboard/188bed94-177c-4bc9-a9f0-35080d874f3e/wix-cms/data/CajaActual)
- [CitasF2](https://manage.wix.com/dashboard/188bed94-177c-4bc9-a9f0-35080d874f3e/wix-cms/data/CitasF2)
- [ComplementosCatalogo](https://manage.wix.com/dashboard/188bed94-177c-4bc9-a9f0-35080d874f3e/wix-cms/data/ComplementosCatalogo)
- [ControlOperativo](https://manage.wix.com/dashboard/188bed94-177c-4bc9-a9f0-35080d874f3e/wix-cms/data/ControlOperativo)
- [HistoricoCierresZ](https://manage.wix.com/dashboard/188bed94-177c-4bc9-a9f0-35080d874f3e/wix-cms/data/HistoricoCierresZ)
- [LibroAsientosContablesDetalle](https://manage.wix.com/dashboard/188bed94-177c-4bc9-a9f0-35080d874f3e/wix-cms/data/LibroAsientosContablesDetalle)
- [MapaStaff](https://manage.wix.com/dashboard/188bed94-177c-4bc9-a9f0-35080d874f3e/wix-cms/data/MapaStaff)
- [MovimientosCaja](https://manage.wix.com/dashboard/188bed94-177c-4bc9-a9f0-35080d874f3e/wix-cms/data/MovimientosCaja)
- [RegistroIntegracion](https://manage.wix.com/dashboard/188bed94-177c-4bc9-a9f0-35080d874f3e/wix-cms/data/RegistroIntegracion)
- [RegistrosHorariosStaff](https://manage.wix.com/dashboard/188bed94-177c-4bc9-a9f0-35080d874f3e/wix-cms/data/RegistrosHorariosStaff)
- [ServiciosCatalogo](https://manage.wix.com/dashboard/188bed94-177c-4bc9-a9f0-35080d874f3e/wix-cms/data/ServiciosCatalogo)
- [TransaccionesTPV](https://manage.wix.com/dashboard/188bed94-177c-4bc9-a9f0-35080d874f3e/wix-cms/data/TransaccionesTPV)

## Vínculo confirmado entre colecciones

- `ServiciosCatalogo.staffMembers`
- ↔ `MapaStaff.ServiciosCatalogo_staffMembers`

Es una relación CMS de referencia entre servicios y profesionales.

## Vinculación funcional con aplicaciones Wix

| Colección | App Wix relacionada | Estado |
|---|---|---|
| `CitasF2` | Wix Bookings | Relación funcional probable; debe validarse con servicios y reservas reales |
| `MapaStaff` | Wix Bookings / Members Area | Relación funcional probable |
| `ServiciosCatalogo` | Wix Bookings / Stores | Catálogo personalizado; no sustituye automáticamente al catálogo nativo |
| `ComplementosCatalogo` | Wix Stores / Gift Cards | Relación funcional probable |
| `TransaccionesTPV` | Wix Stores, Checkout & Orders, Wix Payments | Registro TPV personalizado; no hay registros actuales |
| `MovimientosCaja` | Wix Payments / Checkout & Orders | Registro personalizado de caja y conciliación |
| `CajaActual` | Wix Payments / Checkout & Orders | Control interno de caja |
| `HistoricoCierresZ` | Wix Payments / Invoices | Control contable personalizado |
| `LibroAsientosContablesDetalle` | Wix Invoices V1 / Wix Payments | Libro contable personalizado |
| `RegistrosHorariosStaff` | Wix Bookings / Members Area | Control horario personalizado |
| `RegistroIntegracion` | Varias apps Wix | Bitácora técnica personalizada |
| `ControlOperativo` | Varias apps Wix | Control interno transversal |

### Importante

Las aplicaciones instaladas confirmadas son **Bookings, Stores V3, Payments, Invoices V1, Gift Cards, Members Area, Blog, Forms & Payments y Promote SEO**. La existencia de una colección con nombre relacionado **no demuestra por sí sola una integración automática** con una app. Actualmente, solo está confirmada estructuralmente la relación `ServiciosCatalogo`–`MapaStaff`; el resto son vínculos funcionales que requieren revisar datos, identificadores y automatizaciones.

# `ServiciosCatalogo` ↔ Wix Bookings

## Identidad y clasificación

| Campo de la colección | Dato relacionado en Bookings | ID canónica nativa en Bookings |
|---|---|---|
| `serviceId` | Servicio de Bookings | `service.id` |
| `title` | Nombre del servicio | `service.name` |
| `description` | Descripción | `service.description` |
| `catalogEntryType` | Tipo de servicio | `service.type` |
| `categoryId` | Categoría | `service.category.id` |
| `category` | Categoría | `service.category.id` |

## Duración y sesiones

| Campo de la colección | Dato relacionado en Bookings | ID canónica nativa en Bookings |
|---|---|---|
| `totalDuration` | Duración de la sesión | `service.schedule.id` |
| `sessionCount` | N/A | N/A |
| `phase1Duration` | N/A | N/A |
| `phase2Duration` | N/A | N/A |
| `exposureDuration` | N/A | N/A |

> La duración se almacena en `service.schedule.availabilityConstraints.sessionDurations`; el identificador canónico del horario es `service.schedule.id`.

## Personal

| Campo de la colección | Dato relacionado en Bookings | ID canónica nativa en Bookings |
|---|---|---|
| `staffMembers` | Personal asignado | `service.staffMemberIds[]` |
| `bookingsStaff` | Personal asignado | `service.staffMemberIds[]` |
| `bookingsStaffNames` | N/A directo; requiere resolver los miembros del personal | `staffMember.resourceId` |

## Precio y pagos

| Campo de la colección | Dato relacionado en Bookings | ID canónica nativa en Bookings |
|---|---|---|
| `price` | Precio fijo y tipo de tarifa | `service.payment.fixed.price.value` / `service.payment.rateType` |
| `onlinePayment` | Pago online habilitado | `service.payment.options.online` |
| `inPersonPayment` | Pago presencial habilitado | `service.payment.options.inPerson` |
| `currency` | Moneda del precio | `service.payment.fixed.price.currency` |
| `taxIncluded` | N/A | N/A |
| `tipoImpositivo` | N/A | N/A |
| `pricingModel` | N/A directo | N/A |
| `depositType` | N/A | N/A |
| `depositAmount` | N/A | N/A |
| `precioCosteBase` | N/A | N/A |
| `pricingPlanId` | N/A | N/A |

## Ubicación y visibilidad

| Campo de la colección | Dato relacionado en Bookings | ID canónica nativa en Bookings |
|---|---|---|
| `locationId` | Ubicación empresarial | `service.locations[].business.id` |
| `location` | Ubicaciones del servicio | `service.locations[]` |
| `clientHidden` | Servicio oculto o visible | `service.hidden` |

## Imagen

| Campo de la colección | Dato relacionado en Bookings | ID canónica nativa en Bookings |
|---|---|---|
| `mainMedia` | Imagen principal del servicio | `service.media.mainMedia.image.id` |

## Campos funcionales propios de la colección

| Campo de la colección | Dato relacionado en Bookings | ID canónica nativa en Bookings |
|---|---|---|
| `allowCombine` | N/A | N/A |
| `linkedPhases` | N/A | N/A |
| `itemNature` | N/A | N/A |
| `sku` | N/A | N/A |
| `tagLine` | N/A | N/A |
| `slug` | N/A | N/A |
| `margin` | N/A | N/A |
| `internalNotes` | N/A | N/A |
| `recomendaciones` | N/A | N/A |

## Campos técnicos de Wix CMS

| Campo de la colección | Dato relacionado en Bookings | ID canónica nativa en Bookings |
|---|---|---|
| `_id` | N/A; ID interno del ítem CMS | N/A |
| `_createdDate` | N/A | N/A |
| `_updatedDate` | N/A | N/A |
| `_owner` | N/A | N/A |

## Resumen

- **Campos con correspondencia:** 17.
- **Campos sin correspondencia directa:** 26.
- **ID principal del servicio en Bookings:** `service.id`.
- **ID principal del servicio en la colección:** `serviceId`.
- **La relación entre ambos debe resolverse mediante `ServiciosCatalogo.serviceId = Bookings.service.id`.**

# Correspondencias de las demás colecciones

> Estas tablas muestran correspondencias funcionales con datos nativos de Wix. No demuestran sincronización automática.

## `CITAS_F2` ↔ Wix Bookings

| Campo | Dato relacionado en Bookings | ID canónica nativa |
|---|---|---|
| `bookingId` | Reserva | `booking.id` |
| `serviceId` | Servicio reservado | `booking.bookedEntity.slot.serviceId` |
| `scheduleId` | Horario del servicio | `booking.bookedEntity.slot.scheduleId` |
| `slotStart` | Inicio de la cita | `booking.bookedEntity.slot.startDate` |
| `slotEnd` | Fin de la cita | `booking.bookedEntity.slot.endDate` |
| `timeZone` | Zona horaria | `booking.bookedEntity.slot.timezone` |
| `resourceId` | Personal asignado | `booking.bookedEntity.slot.resource.id` |
| `contactDetails` | Datos del cliente | `booking.contactDetails` |
| `bookingStatus` | Estado de la reserva | `booking.status` |
| `revision` | Revisión de la reserva | `booking.revision` |
| `totalAmount` | Importe total | `booking.totalAmount` |
| `paymentStatus` | Estado del pago | `booking.paymentStatus` |
| `orderId` | Pedido asociado | `order.id` |

## `MapaStaff` ↔ Wix Bookings Staff

| Campo | Dato relacionado en Bookings | ID canónica nativa |
|---|---|---|
| `staffMemberId` | Miembro del personal | `staffMember.id` |
| `resourceId` | Recurso del personal | `staffMember.resourceId` |
| `name` | Nombre del profesional | `staffMember.name` |
| `image` | Imagen del profesional | `staffMember.image` |
| `services` | Servicios asignados | `service.staffMemberIds[]` |

## `REGISTROS_HORARIOS_STAFF` ↔ Calendar / Bookings

| Campo | Dato relacionado | ID canónica nativa |
|---|---|---|
| `resourceId` | Recurso del profesional | `resource.id` |
| `memberId` | Miembro del sitio | `member.id` |
| `staffName` | Nombre del profesional | `staffMember.name` |
| `workplaceId` | Ubicación de trabajo | `location.id` |
| `clockInAt` | Inicio registrado | `calendarEvent.start` |
| `clockOutAt` | Fin registrado | `calendarEvent.end` |
| `scheduledStartAt` | Inicio programado | `calendarEvent.start` |
| `scheduledEndAt` | Fin programado | `calendarEvent.end` |
| `workDate` | Fecha de trabajo | `calendarEvent.start.localDate` |

## `COMPLEMENTOS_CATALOGO` ↔ Wix Stores

| Campo | Dato relacionado en Stores | ID canónica nativa |
|---|---|---|
| `addonId` | Producto o complemento | `product.id` |
| `sku` | SKU | `variant.sku` |
| `name` | Nombre del producto | `product.name` |
| `description` | Descripción | `product.description` |
| `price` | Precio | `variant.price` |
| `durationMinutes` | N/A directo | N/A |
| `taxIncluded` | Impuestos incluidos | `product.taxGroupId` |
| `itemNature` | Tipo de producto | `product.productType` |

## `CAJA_ACTUAL` ↔ Wix Orders / Payments

| Campo | Dato relacionado | ID canónica nativa |
|---|---|---|
| `orderId` | Pedido | `order.id` |
| `checkoutId` | Checkout | `checkout.id` |
| `paymentId` | Pago | `payment.id` |
| `transactionId` | Transacción | `transaction.id` |
| `contactId` | Contacto | `contact.id` |
| `catalogItemId` | Producto o servicio | `catalogItem.id` |
| `serviceId` | Servicio de Bookings | `service.id` |
| `bookingId` | Reserva | `booking.id` |
| `ticketTotal` | Total cobrado | `order.priceSummary.total` |
| `paymentStatus` | Estado del pago | `order.paymentStatus` |
| `paymentMethod` | Método de pago | `payment.method` |
| `lineItems` | Líneas del pedido | `order.lineItems[]` |
| `customerName` | Cliente | `order.buyerInfo` |
| `ticketNumber` | Número interno de ticket | N/A |
| `verifactuReference` | Referencia fiscal externa | N/A |

## `CONTROL_OPERATIVO` ↔ Bookings / Orders

| Campo | Dato relacionado | ID canónica nativa |
|---|---|---|
| `bookingId` | Reserva | `booking.id` |
| `serviceId` | Servicio | `service.id` |
| `resourceId` | Recurso | `resource.id` |
| `orderId` | Pedido | `order.id` |
| `transactionId` | Transacción | `transaction.id` |
| `refundId` | Reembolso | `refund.id` |
| `totalAmount` | Importe | `order.priceSummary.total` |
| `eventId` | Evento operativo | `event.id` |

## `TRANSACCIONES_TPV` ↔ Wix Orders / Payments

| Campo | Dato relacionado | ID canónica nativa |
|---|---|---|
| `orderId` | Pedido | `order.id` |
| `checkoutId` | Checkout | `checkout.id` |
| `paymentId` | Pago | `payment.id` |
| `transactionId` | Transacción | `transaction.id` |
| `bookingId` | Reserva | `booking.id` |
| `serviceId` | Servicio | `service.id` |
| `catalogItemId` | Producto o servicio | `catalogItem.id` |
| `contactId` | Cliente | `contact.id` |
| `amount` | Importe | `order.priceSummary.total` |
| `currency` | Moneda | `order.currency` |
| `paymentStatus` | Estado del pago | `order.paymentStatus` |
| `paymentMethod` | Método de pago | `payment.method` |
| `lineItems` | Líneas facturadas | `order.lineItems[]` |

## `HISTORICO_CIERRES_Z` ↔ Orders / Payments

| Campo | Dato relacionado | ID canónica nativa |
|---|---|---|
| `workDate` | Fecha operativa | N/A |
| `closedBy` | Usuario que realiza el cierre | `member.id` |
| `totalCash` | Ventas en efectivo | `order.priceSummary` |
| `totalCard` | Ventas con tarjeta | `payment.method` |
| `totalBizum` | Ventas por Bizum | N/A directo |
| `totalOnline` | Ventas online | `order.channelInfo` |
| `totalRefunds` | Reembolsos | `refund.id` |
| `grossSalesTotal` | Ventas brutas | `order.priceSummary` |
| `totalTaxAmount` | Impuestos | `order.taxSummary` |
| `wixProductId` | Producto Wix | `product.id` |
| `sku` | SKU | `variant.sku` |
| `stockQuantity` | Stock | `inventory.quantity` |

## `LIBRO_ASIENTOS_CONTABLES_DETALLE` ↔ Wix Orders / Bookings

| Campo | Dato relacionado | ID canónica nativa |
|---|---|---|
| `orderId` | Pedido | `order.id` |
| `bookingId` | Reserva | `booking.id` |
| `transactionId` | Transacción | `transaction.id` |
| `refundId` | Reembolso | `refund.id` |
| `serviceIdRedeemed` | Servicio utilizado | `service.id` |
| `giftCardId` | Tarjeta regalo | `giftCard.id` |
| `amount` | Importe | `order.priceSummary` |
| `totalAmount` | Total | `order.priceSummary.total` |
| `taxBase` | Base imponible | `order.taxSummary` |
| `taxAmount` | Impuesto | `order.taxSummary` |
| `paymentMethod` | Método de pago | `payment.method` |
| `currency` | Moneda | `order.currency` |

## `Locations/Locations` ↔ Wix Locations

| Campo | Dato relacionado | ID canónica nativa |
|---|---|---|
| `_id` | Ubicación | `location.id` |
| `name` | Nombre | `location.name` |
| `address` | Dirección | `location.address` |
| `email` | Email | `location.email` |
| `phone` | Teléfono | `location.phone` |
| `timeZone` | Zona horaria | `location.timeZone` |
| `default` | Ubicación predeterminada | `location.default` |
| `services` | Servicios asociados | `service.locations[]` |

## `CampaignManager/campaigns` ↔ Wix Marketing

| Campo | Dato relacionado | ID canónica nativa |
|---|---|---|
| `_id` | Campaña | `campaign.id` |
| `campaignName` | Nombre | `campaign.name` |
| `campaignStatus` | Estado | `campaign.status` |
| `campaignDateStart` | Inicio | `campaign.startDate` |
| `campaignDateEnd` | Fin | `campaign.endDate` |
| `offeringId` | Oferta relacionada | `product.id` / `service.id` |
| `offeringItemId` | Elemento promocionado | `catalogItem.id` |
| `isAutomaticDiscounts` | Descuento automático | `discountRule.id` |

## `StoreCatalog/Products` ↔ Wix Stores Catalog V3

| Campo | Dato relacionado | ID canónica nativa |
|---|---|---|
| `_id` | Producto | `product.id` |
| `name` | Nombre | `product.name` |
| `description` | Descripción | `product.description` |
| `productType` | Tipo de producto | `product.productType` |
| `visible` | Visibilidad | `product.visible` |
| `slug` | Slug | `product.slug` |
| `url` | URL del producto | `product.url` |
| `currency` | Moneda | `product.currency` |
| `mainCategoryId` | Categoría principal | `category.id` |
| `brand` | Marca | `brand.id` |
| `options` | Opciones | `product.options[]` |
| `variantsInfo` | Variantes | `variant.id` |
| `inventory` | Inventario | `inventoryItem.id` |
| `media` | Imágenes | `media.id` |

## `StoreCatalog/Inventory` ↔ Wix Stores Inventory

| Campo | Dato relacionado | ID canónica nativa |
|---|---|---|
| `_id` | Inventario | `inventoryItem.id` |
| `productId` | Producto | `product.id` |
| `variantId` | Variante | `variant.id` |
| `quantity` | Cantidad disponible | `inventoryItem.quantity` |
| `inStock` | Disponible | `inventoryItem.inStock` |
| `trackQuantity` | Seguimiento de stock | `inventoryItem.trackQuantity` |
| `locationId` | Ubicación | `location.id` |
| `preorderInfo` | Preventa | `inventoryItem.preorderInfo` |

## `Stores/Orders` ↔ Wix Stores Orders

| Campo | Dato relacionado | ID canónica nativa |
|---|---|---|
| `_id` | Pedido | `order.id` |
| `number` | Número de pedido | `order.number` |
| `cartId` | Carrito | `cart.id` |
| `lineItems` | Líneas | `order.lineItems[]` |
| `paymentStatus` | Estado del pago | `order.paymentStatus` |
| `buyerInfo` | Comprador | `order.buyerInfo` |
| `billingInfo` | Facturación | `order.billingInfo` |
| `currency` | Moneda | `order.currency` |
| `totals` | Totales | `order.totals` |
| `fulfillmentStatus` | Preparación/envío | `order.fulfillmentStatus` |

## `Members/FullData` ↔ Wix Members

| Campo | Dato relacionado | ID canónica nativa |
|---|---|---|
| `_id` | Miembro | `member.id` |
| `loginEmail` | Email de acceso | `member.loginEmail` |
| `firstName` | Nombre | `member.profile.firstName` |
| `lastName` | Apellidos | `member.profile.lastName` |
| `phone` | Teléfono | `member.contact.phone` |
| `profilePhoto` | Foto de perfil | `member.profile.photo` |
| `status` | Estado | `member.status` |
| `lastLoginDate` | Último acceso | `member.lastLoginDate` |
| `contactId` | Contacto CRM | `contact.id` |

## `Forms/subscribers03` ↔ Wix Forms

| Campo | Dato relacionado | ID canónica nativa |
|---|---|---|
| `_id` | Suscripción o envío | `submission.id` |
| `email` | Email enviado | `submission.fields.email` |
| `submissionTime` | Fecha del envío | `submission.createdDate` |

## `REGISTRO_INTEGRACION` ↔ Wix Automations / Webhooks

| Campo | Dato relacionado | ID canónica nativa |
|---|---|---|
| `eventId` | Evento de integración | `event.id` |
| `eventType` | Tipo de evento | `event.type` |
| `sourceItemId` | Elemento origen | `entity.id` |
| `sourceCollection` | Colección origen | `collection.id` |
| `occurredAt` | Fecha del evento | `event.createdDate` |
| `traceId` | Trazabilidad | N/A nativo |
| `correlationId` | Correlación | N/A nativo |
| `deliveryStatus` | Estado de entrega | `automation.execution.status` |
| `payload` | Datos del evento | `event.payload` |

## Colecciones sin correspondencia nativa directa

| Colección | Motivo |
|---|---|
| `ControlOperativo` | Control interno de idempotencia y operaciones |
| `HistoricoCierresZ` | Histórico fiscal y operativo propio |
| `LibroAsientosContablesDetalle` | Libro contable propio |
| `RegistroIntegracion` | Auditoría interna de integraciones |
| `RegistrosHorariosStaff` | Registro laboral propio |
| `CajaActual` | Estado interno de caja |
| `CampaignManager/userConfig` | Configuración propia del gestor de campañas |

**Conclusión:** las correspondencias más sólidas son `CITAS_F2` con Bookings, `MapaStaff` con Staff, `CAJA_ACTUAL`/`TRANSACCIONES_TPV` con Orders y Payments, y las colecciones `StoreCatalog/*` con Stores. Los campos fiscales, contables, de trazabilidad y control operativo no tienen un identificador nativo equivalente en Wix.


He revisado las rutas y nombres. Correcciones principales:

## Correcciones canónicas

| Anterior | Corrección canónica |
|---|---|
| `service.id` | Correcto: `service.id` |
| `service.schedule.id` | Correcto para el ID del horario: `service.schedule.id` |
| `service.schedule.availabilityConstraints.sessionDurations` | Correcto para duración de citas |
| `staffMember.id` | Correcto: identidad del miembro de personal |
| `staffMember.resourceId` | Correcto para asignarlo a servicios y eventos |
| `booking.bookedEntity.slot.resource.id` | Correcto para el recurso de una cita |
| `order.id` | Correcto para el pedido eCommerce |
| `payment.id` | No debe asumirse como campo directo del pedido; se obtiene mediante las transacciones del pedido |
| `transaction.id` | No es una ruta genérica confirmada; los pagos se consultan mediante las transacciones del pedido |
| `product.id` | Correcto para Catalog V3 |
| `variant.id` | Debe distinguirse del identificador de variante almacenado en `variantId` |
| `inventoryItem.id` | Correcto para inventario V3 |
| `location.id` | Correcto para ubicaciones |
| `member.id` | Correcto para miembros del sitio |
| `contact.id` | Correcto para contactos CRM |

## Rutas API verificadas

| Área | Ruta canónica |
|---|---|
| Servicio Bookings | `POST /bookings/v2/services/query` |
| Crear servicio Bookings | `POST /bookings/v2/bulk/services/create` |
| Obtener servicio Bookings | `GET /bookings/v2/services/{serviceId}` |
| Crear reserva | `POST /_api/bookings-service/v2/bookings` |
| Personal Bookings | `POST /bookings/v1/staff-members/query` |
| Crear personal | `POST /bookings/v1/staff-members` |
| Disponibilidad | `POST /_api/service-availability/v2/time-slots` |
| Producto Stores V3 | `GET /stores/v3/products/{productId}` |
| Crear producto Stores V3 | `POST /stores/v3/products-with-inventory` |
| Transacciones de un pedido | `GET /ecom/v1/payments/orders/{orderId}` |
| Transacciones de varios pedidos | `POST /ecom/v1/payments/list-by-ids` |

## Campos que deben marcarse como no canónicos o inferidos

Estos campos de las colecciones son propios, no nombres nativos confirmados de Wix:

- `catalogItemId`
- `cashMovementId`
- `cashRegisterStatus`
- `ticketNumber`
- `verifactuReference`
- `traceId`
- `pairToken`
- `laborRecordId`
- `closingHash`
- `transactionId`
- `paymentReference`
- `serviceIdRedeemed`

Pueden guardar IDs o referencias de Wix, pero no implican que exista una sincronización automática ni que sean campos nativos equivalentes.

## Correcciones específicas

- `CAJA_ACTUAL.paymentId` debe relacionarse con una entrada de `orderTransactions.payments[]`, no con un supuesto campo directo `payment.id` del pedido.
- `CAJA_ACTUAL.transactionId` debe considerarse referencia interna hasta comprobar el objeto concreto devuelto por la API de transacciones.
- `HISTORICO_CIERRES_Z.totalCard`, `totalCash`, `totalBizum` y `totalOnline` son agregados propios; no corresponden directamente a un único campo nativo de Wix.
- `LIBRO_ASIENTOS_CONTABLES_DETALLE.taxBase` y `taxAmount` deben relacionarse con estructuras fiscales del pedido, no con un campo simple confirmado.
- `StoreCatalog/Products.inventory` es un objeto de catálogo; el inventario operativo se consulta mediante Inventory API.
- `StoreCatalog/Variants.variantId` es un identificador de variante de catálogo, pero no debe sustituirse automáticamente por `_id`.
- `Bookings/Schedule.serviceDurationInMinutes` es un campo de colección derivado; la fuente nativa de duración está en `service.schedule.availabilityConstraints.sessionDurations`.
- `Bookings/Services._id` puede representar el ID del servicio en la colección, pero el dato nativo debe verificarse contra `service.id`.
- `Bookings/Staff._id` y `MapaStaff.staffMemberId` deben validarse contra `staffMember.id`; `resourceId` es una identidad distinta.

## Regla corregida

La columna **“ID canónica nativa”** debe contener únicamente identificadores confirmados por Wix:

```text
service.id
booking.id
staffMember.id
staffMember.resourceId
order.id
product.id
variant.id
inventoryItem.id
location.id
member.id
contact.id
```

Los campos de caja, fiscalidad, contabilidad, trazabilidad e integración deben clasificarse como:

```text
N/A — campo interno de la colección
```

hasta que se compruebe su valor real y su correspondencia con una respuesta concreta de Wix.


# Tablas actualizadas con nomenclatura canónica

> Se separan las correspondencias confirmadas de los campos internos. `N/A` significa que no existe un dato nativo de Wix confirmado.

## `ServiciosCatalogo`

| Campo | Dato relacionado en Bookings | ID canónica |
|---|---|---|
| `serviceId` | Servicio | `service.id` |
| `serviceName` | Nombre | `service.name` |
| `description` | Descripción | `service.description` |
| `serviceType` | Tipo de servicio | `service.type` |
| `totalDuration` | Duración configurada | `service.schedule.availabilityConstraints.sessionDurations` |
| `staffMembers` | Personal asignado | `service.staffMemberIds[]` → `staffMember.resourceId` |
| `price` | Precio | `service.payment.fixed.price.value` |
| `currency` | Moneda | `service.payment.fixed.price.currency` |
| `onlinePayment` | Pago online | `service.payment.options.online` |
| `inPersonPayment` | Pago presencial | `service.payment.options.inPerson` |
| `hidden` | Visibilidad | `service.hidden` |
| `image` | Imagen principal | `service.media.mainMedia` |
| `category` | Categoría | `service.category.id` |
| `scheduleId` | Horario del servicio | `service.schedule.id` |
| Otros campos propios | N/A | N/A |

---

## `MapaStaff`

| Campo | Dato relacionado en Bookings | ID canónica |
|---|---|---|
| `staffMemberId` | Miembro de personal | `staffMember.id` |
| `resourceId` | Recurso de personal | `staffMember.resourceId` |
| `name` | Nombre | `staffMember.name` |
| `image` | Imagen | `staffMember.mainMedia` |
| `services` | Servicios asignados | `service.staffMemberIds[]` |
| Campos de control interno | N/A | N/A |

---

## `CITAS_F2`

| Campo | Dato relacionado en Bookings | ID canónica |
|---|---|---|
| `bookingId` | Reserva | `booking.id` |
| `serviceId` | Servicio reservado | `booking.bookedEntity.slot.serviceId` |
| `scheduleId` | Horario | `booking.bookedEntity.slot.scheduleId` |
| `slotStart` | Inicio | `booking.bookedEntity.slot.startDate` |
| `slotEnd` | Fin | `booking.bookedEntity.slot.endDate` |
| `timeZone` | Zona horaria | `booking.bookedEntity.slot.timezone` |
| `resourceId` | Recurso asignado | `booking.bookedEntity.slot.resource.id` |
| `contactDetails` | Datos del cliente | `booking.contactDetails` |
| `bookingStatus` | Estado | `booking.status` |
| `paymentStatus` | Estado del pago | `booking.paymentStatus` |
| `revision` | Revisión | `booking.revision` |
| `totalAmount` | Importe | `booking.totalAmount` |
| `orderId` | Pedido asociado | `order.id` |
| `cashMovementId` | Movimiento interno de caja | N/A |

---

## `COMPLEMENTOS_CATALOGO`

| Campo | Dato relacionado en Stores V3 | ID canónica |
|---|---|---|
| `addonId` | Producto | `product.id` |
| `name` | Nombre | `product.name` |
| `description` | Descripción | `product.description` |
| `sku` | SKU de variante | `variant.sku` |
| `price` | Precio de variante | `variant.price.actualPrice.amount` |
| `taxIncluded` | Grupo fiscal | `product.taxGroupId` |
| `itemNature` | Tipo de producto | `product.productType` |
| `durationMinutes` | N/A directo en Stores | N/A |
| `codigoImpuesto` | Código fiscal propio | N/A |
| `cuentaContableIngreso` | Cuenta contable propia | N/A |

---

## `CAJA_ACTUAL`

| Campo | Dato relacionado en Wix | ID canónica |
|---|---|---|
| `orderId` | Pedido | `order.id` |
| `checkoutId` | Checkout | `checkout.id` |
| `bookingId` | Reserva Bookings | `booking.id` |
| `serviceId` | Servicio Bookings | `service.id` |
| `catalogItemId` | Elemento vendible | `catalogItem.id` |
| `contactId` | Contacto | `contact.id` |
| `paymentId` | Pago de pedido | `orderTransactions.payments[].id` |
| `paymentStatus` | Estado del pedido/pago | `order.paymentStatus` |
| `paymentMethod` | Método de pago | `orderTransactions.payments[].regularPaymentDetails.paymentMethodName` |
| `lineItems` | Líneas del pedido | `order.lineItems[]` |
| `currency` | Moneda | `order.currency` |
| `ticketTotal` | Total del pedido | `order.priceSummary.total` |
| `transactionId` | Identificador de transacción | N/A confirmado |
| `ticketNumber` | Número interno | N/A |
| Campos fiscales propios | N/A | N/A |

---

## `TRANSACCIONES_TPV`

| Campo | Dato relacionado en Wix | ID canónica |
|---|---|---|
| `orderId` | Pedido | `order.id` |
| `checkoutId` | Checkout | `checkout.id` |
| `bookingId` | Reserva | `booking.id` |
| `serviceId` | Servicio | `service.id` |
| `catalogItemId` | Elemento vendible | `catalogItem.id` |
| `contactId` | Contacto | `contact.id` |
| `paymentId` | Pago | `orderTransactions.payments[].id` |
| `paymentStatus` | Estado del pago | `order.paymentStatus` |
| `paymentMethod` | Método de pago | `orderTransactions.payments[].regularPaymentDetails.paymentMethodName` |
| `amount` | Importe | `order.priceSummary.total` |
| `currency` | Moneda | `order.currency` |
| `lineItems` | Líneas facturadas | `order.lineItems[]` |
| `transactionId` | Transacción | N/A confirmado |
| Campos fiscales propios | N/A | N/A |

---

## `CONTROL_OPERATIVO`

| Campo | Dato relacionado | ID canónica |
|---|---|---|
| `bookingId` | Reserva | `booking.id` |
| `serviceId` | Servicio | `service.id` |
| `resourceId` | Recurso | `staffMember.resourceId` |
| `orderId` | Pedido | `order.id` |
| `refundId` | Reembolso | N/A confirmado |
| `transactionId` | Transacción | N/A confirmado |
| `eventId` | Evento operativo interno | N/A |
| `traceId` | Trazabilidad propia | N/A |
| `dedupeKey` | Idempotencia propia | N/A |
| `payload` | Datos internos | N/A |

---

## `HISTORICO_CIERRES_Z`

| Campo | Dato relacionado | ID canónica |
|---|---|---|
| `memberId` | Miembro que realiza el cierre | `member.id` |
| `staffResourceId` | Recurso de personal | `staffMember.resourceId` |
| `wixProductId` | Producto Stores | `product.id` |
| `sku` | SKU de variante | `variant.sku` |
| `stockQuantity` | Cantidad de inventario | `inventoryItem.quantity` |
| `unitCost` | Coste del producto | N/A directo |
| `totalCash` | Agregado de ventas en efectivo | N/A directo |
| `totalCard` | Agregado de ventas con tarjeta | N/A directo |
| `totalBizum` | Agregado Bizum | N/A directo |
| `totalOnline` | Agregado de ventas online | N/A directo |
| `totalRefunds` | Agregado de reembolsos | N/A directo |
| `totalTaxAmount` | Agregado fiscal | N/A directo |
| `grossSalesTotal` | Ventas brutas agregadas | N/A directo |
| `closingHash` | Hash interno | N/A |
| `verifactuReference` | Referencia fiscal externa | N/A |

---

## `LIBRO_ASIENTOS_CONTABLES_DETALLE`

| Campo | Dato relacionado | ID canónica |
|---|---|---|
| `orderId` | Pedido | `order.id` |
| `bookingId` | Reserva | `booking.id` |
| `transactionId` | Transacción | N/A confirmado |
| `refundId` | Reembolso | N/A confirmado |
| `serviceIdRedeemed` | Servicio utilizado | `service.id` |
| `giftCardId` | Tarjeta regalo | N/A confirmado |
| `paymentMethod` | Método de pago | `orderTransactions.payments[].regularPaymentDetails.paymentMethodName` |
| `amount` | Importe | `order.priceSummary.total` |
| `totalAmount` | Total | `order.priceSummary.total` |
| `taxBase` | Base imponible | `order.taxSummary` |
| `taxAmount` | Impuesto | `order.taxSummary` |
| `currency` | Moneda | `order.currency` |
| `lineItems` | Líneas del pedido | `order.lineItems[]` |
| Campos fiscales y contables | N/A directo | N/A |

---

## `Locations/Locations`

| Campo | Dato relacionado en Wix Locations | ID canónica |
|---|---|---|
| `_id` | Ubicación | `location.id` |
| `name` | Nombre | `location.name` |
| `address` | Dirección | `location.address` |
| `email` | Email | `location.email` |
| `phone` | Teléfono | `location.phone` |
| `timeZone` | Zona horaria | `location.timeZone` |
| `default` | Ubicación predeterminada | `location.default` |
| `services` | Servicios ofrecidos | `service.locations[]` |
| `businessSchedule` | Horario comercial | N/A directo para Bookings |

---

## `REGISTRO_INTEGRACION`

| Campo | Dato relacionado | ID canónica |
|---|---|---|
| `sourceItemId` | Elemento origen | `entity.id` |
| `sourceCollection` | Colección origen | `collection.id` |
| `eventId` | Evento de integración | N/A |
| `eventType` | Tipo de evento | N/A |
| `occurredAt` | Fecha del evento | N/A |
| `deliveryStatus` | Estado de entrega | N/A |
| `payload` | Datos del evento | N/A |
| `traceId` | Trazabilidad | N/A |
| `correlationId` | Correlación | N/A |
| `idempotencyKey` | Idempotencia | N/A |

---

## `REGISTROS_HORARIOS_STAFF`

| Campo | Dato relacionado | ID canónica |
|---|---|---|
| `resourceId` | Recurso de personal | `staffMember.resourceId` |
| `memberId` | Miembro del sitio | `member.id` |
| `staffName` | Nombre del personal | `staffMember.name` |
| `workplaceId` | Ubicación | `location.id` |
| `clockInAt` | Inicio de evento | `calendarEvent.start` |
| `clockOutAt` | Fin de evento | `calendarEvent.end` |
| `scheduledStartAt` | Inicio programado | `calendarEvent.start` |
| `scheduledEndAt` | Fin programado | `calendarEvent.end` |
| `workDate` | Fecha laboral | `calendarEvent.start.localDate` |
| `recordId` | Registro interno | N/A |
| `laborRecordId` | Registro laboral propio | N/A |
| `recordHash` | Hash propio | N/A |

---

## Conclusión corregida

Las correspondencias nativas más sólidas son:

- `ServiciosCatalogo` ↔ `Bookings Services`
- `MapaStaff` ↔ `Bookings Staff Members`
- `CITAS_F2` ↔ `Bookings Bookings`
- `CAJA_ACTUAL` y `TRANSACCIONES_TPV` ↔ `eCommerce Orders` y `Order Transactions`
- `COMPLEMENTOS_CATALOGO` ↔ `Stores Catalog V3`
- `REGISTROS_HORARIOS_STAFF` ↔ `Calendar Events` y recursos de Bookings

Los campos fiscales, contables, de caja, trazabilidad e idempotencia se mantienen correctamente como **campos propios**, sin equivalencia nativa confirmada.

