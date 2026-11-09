> **Nota de vigencia (2026-11-10):** este documento conserva evidencia histórica del estado auditado en su fecha. La decisión posterior es que Wix Stores Catalog V3 es la única autoridad de stock y que la capa custom de inventario se retira. Ver `docs/DECISION-LOG.md` y `docs/adr/2026-11-10-deposit-and-native-inventory.md`; no usar este snapshot como autorización para reactivar writers o proyecciones CMS.

# Matriz de trazabilidad de procesos — Marian Madrid

- **Versión:** 1.0
- **Fecha de corte:** 2026-11-05
- **Sitio:** https://www.marianmadrid.es
- **Repositorio:** nachoortegazgz/marianmadridz
- **Rama base:** main @ `146108fd9a336f54cdb060d14b1a2570373bc368`
- **Método:** contraste de módulos del repositorio y auditoría Wix de solo lectura `docs/audits/2026-11-01-wix-site-app-settings-readonly-audit.md`.
- **Alcance:** documentación y diseño de controles. No se han modificado CMS, ajustes Wix, automatizaciones, reservas, cobros, integraciones ni publicación.

## Cómo leer la matriz

- **PARCIAL:** existe código/configuración o evidencia de lectura, pero no una prueba completa sobre runtime publicado.
- **NO VERIFICADO:** no se ha demostrado que el flujo esté conectado o activo.
- **PROPUESTO:** campo/colección recomendado; no se afirma que exista actualmente.
- Las bases jurídicas y los plazos son decisiones documentales a validar por el responsable del tratamiento y asesoría. No se debe tratar el consentimiento como base universal.
- Los nombres de campos indicados como canónicos se basan en el contrato de código consultado. Antes de una migración, contrastar con el schema CMS publicado y sus hooks.

## Matriz maestra

| ID | Proceso / finalidad | Trigger / recorrido | Autoridad y aplicación | Código propio | Colección / sistema | Datos que deben quedar trazables | Base jurídica / conservación a documentar | Estado / aceptación |
|---|---|---|---|---|---|---|---|---|
| WEB-01 | Captación y contacto | Envío formulario público | Wix Forms; destino pendiente | Frontend Wix; backend no demostrado | Wix Contacts; destino CMS no verificado | Nombre, email, teléfono, mensaje, fecha/hora, origen, aviso/versión, finalidad, estado de atención | Precontrato si solicita servicio; marketing separado. Retención según finalidad | PARCIAL. Probar envío, CRM, respuesta, baja y borrado |
| WEB-02 | Catálogo de servicios | Carga y selección de servicio | Wix CMS + widget custom | `widgetBridge.js`, HTML Components, backend catálogo | `ServiciosCatalogo` | `serviceId,title,slug,categoryId,sku,itemNature,price,currency,taxIncluded,tipoImpositivo,totalDuration,phase1Duration,exposureDuration,phase2Duration,allowCombine,linkedPhases,onlinePayment,inPersonPayment` | Información precontractual y contrato. Versionar precios ligados a operaciones | PARCIAL. Comparar CMS/Bookings y UI publicada |
| WEB-03 | Complementos | Selección de extra | Wix CMS + widget | Validación en `bookingCore.js` | `ComplementosCatalogo`; relación de servicio | `addonId,name,sku,description,price,durationMinutes,taxIncluded,tipoImpositivo,codigoImpuesto,claveRegimen,cuentaContableIngreso` | Precontrato/contrato y registro fiscal de lo cobrado | PARCIAL. Verificar asociación, precio, duración e impuestos |
| WEB-04 | Reserva simple | Servicio → profesional → slot → reservar | Wix Bookings V2 | `reservas.web.js`, `citasManager.web.js`, `bookingCore.js`, `bookingSaga.js` | Bookings + `CitasF2` + `ControlOperativo` | `CitasF2: bookingId,bookingType,catalogId,contactDetails,dateYmd,meta,paymentStatus,resourceId,revision,scheduleId,serviceId,slotStart,slotEnd,bookingStatus,thirdPartyId,totalAmount,traceId` | Medidas precontractuales/contrato; minimizar datos de contacto. Conservación según política y obligaciones documentales | PARCIAL. E2E navegador real pendiente |
| WEB-05 | Reserva dual F1/F2 | Selección dual → F1 → gap → F2 | Wix Bookings V2 + saga | `processDualBooking`, `bookingSaga.js`, `bookingCore.js` | Dos reservas Bookings + dos filas `CitasF2` + `ControlOperativo` | Dos `bookingId`; `bookingType=DUAL_F1/DUAL_F2`; `pairToken,serviceId,resourceId,scheduleId,slotStart,slotEnd,totalAmount,paymentStatus,traceId,meta` | Contrato/precontrato; no duplicar contacto innecesariamente entre fases | PARCIAL. Probar gap, recurso, fallo F2 y compensación |
| WEB-06 | Disponibilidad y selección de staff | Calendario consulta disponibilidad | Wix Bookings V2 | `reservas.web.js`, `staff.js`, `widgetBridge.js` | Bookings; `MapaStaff` | `serviceId,staffMemberId,resourceId,scheduleId,slotStart,slotEnd,timezone,locationId,traceId` | Precontractual; caché temporal y logs minimizados | PARCIAL. Availability API comprobada históricamente; navegador pendiente |
| WEB-07 | Checkout y pago online | Checkout Cart V2 → evento pago | Wix eCommerce / Payments | `bookingCore.js`, `citasManager.web.js`, `events.js` | Wix Orders/Payments; `CitasF2`, `MovimientosCaja`, `ControlOperativo` | `orderId,bookingId,paymentStatus,amount,currency,paymentMethod,channelType,transactionId,eventId,traceId,refundId,timestamps`. Nunca almacenar PAN/CVV | Contrato y obligación fiscal; documentar proveedor/encargado. Conservación fiscal/mercantil | PARCIAL. Checkout real detectado; no hacer pruebas de cobro en producción |
| WEB-08 | Cobro presencial | Confirmación de pago en caja | Backend custom | `cajas.web.js`, `citasManager.web.js`, `eventLog.js` | `MovimientosCaja`, `CajaActual`, `CitasF2`, `LibroAsientosContablesDetalle` | `bookingId,linkedBookingIds,paymentMethod,channelType,amount,totalAmount,taxBase,taxAmount,tipoImpositivo,fechaOperacion,fechaExpedicionFactura,numSerieFactura,nifEmisor,nifDestinatario,traceId` | Obligación fiscal/contable y contrato. Código de Comercio: conservación documental general de 6 años; aplicar reglas específicas | PARCIAL. Conciliar booking→cobro→asiento→cierre |
| WEB-09 | Cancelación/reprogramación | Cliente/staff/Wix cambia cita | Wix Bookings + backend | `events.js`, `citasManager.web.js`, `bookingSaga.js`, `crons.js` | Bookings; `CitasF2`; `ControlOperativo`; ledger si devolución | `bookingId,bookingStatus,revision,cancellationReason,eventId,traceId,pairToken,refundId,refundStatus,actor,timestamps` | Contrato; obligaciones fiscales en devolución | PARCIAL. Resolver discrepancia nativa 12 h vs copy 24 h |
| WEB-10 | Notificaciones transaccionales | Booking confirmado/cancelado/modificado | Wix Automations | No se encontró emisor email/SMS/WhatsApp propio en módulos revisados | Wix Automations; evidencia de entrega no acreditada | `automationId,trigger,destinationRole,channel,templateVersion,bookingId,eventId,sentAt,deliveryStatus,error,traceId` (registro propuesto si no existe) | Servicio contractual; marketing siempre separado | PARCIAL. Inventariar reglas paginadas, duplicados y prueba de entrega |
| WEB-11 | Webhooks | Evento server-to-server Bookings/eCommerce | Wix Webhooks | `events.js` | `ControlOperativo` | `controlType=WEBHOOK_EVENT,eventId,dedupeKey,status,payload` minimizado, `traceId,attempts,processedAt,lastError` | Seguridad/interés legítimo y contrato; payload minimizado y retención corta | PARCIAL. Probar firma, repetición, idempotencia, retry |
| WEB-12 | Saga, locks e idempotencia | Intento de reserva, timeout o recuperación | Backend custom | `bookingSaga.js`, `bookingCore.js`, `crons.js` | `ControlOperativo` | `controlType=IDEMPOTENCY/SLOT_LOCK/COMPENSATION,dedupeKey,status,bookingId,pairToken,serviceId,resourceId,leaseExpiresAt,heartbeatAt,attempts,nextRetryAt,lastError,traceId` | Seguridad operativa; no persistir datos personales que no hagan falta. TTL por tipo | PARCIAL. Probar concurrencia/reintentos; scheduler publicado no certificado |
| WEB-13 | Caja y arqueo | Apertura, movimientos, cierre diario | Backend custom | `cajas.web.js`, `eventLog.js`, `crons.js` | `CajaActual`, `MovimientosCaja`, `HistoricoCierresZ`, `LibroAsientosContablesDetalle` | `openedAt,openedBy,openingAmount,isOpen,cashAmount,expectedCash,countedCash,difference,differenceReason`; snapshot, hash, firma y verificación del cierre | Obligación mercantil/fiscal; plazos concretos por clase documental | PARCIAL. Código presente; runtime/firma externa pendiente |
| WEB-14 | Facturación / registro fiscal | Venta, rectificativa, cierre | Ledger fiscal propio; Wix Invoices instalada pero no integrada en código revisado | `cajas.web.js`, `eventLog.js` | `MovimientosCaja`, `DatosFiscales`, `LibroAsientosContablesDetalle`, `HistoricoCierresZ` | `numSerieFactura,fechaExpedicionFactura,fechaOperacion,tipoFactura,nifEmisor,nifDestinatario,recipientLegalName,taxBase,taxAmount,tipoImpositivo,claveRegimen,calificacionOperacion,totalAmount,hash,previousRecordHash,signatureAlgorithm,digitalSignature,verificationQR,payloadFiscal` y clave AEAT canónica tras reconciliar esquema | Obligación fiscal/contable; no es consentimiento | Conservación tributaria/mercantil según documento y prescripción | PARCIAL. No afirmar envío AEAT; revisar `aeatPayload` vs `payloadAEAT` |
| WEB-15 | Terceros fiscales | Alta/actualización de datos fiscales | Backend custom | `eventLog.js`, `cajas.web.js` | `DatosFiscales` | `taxId,legalName,address,postalCode,province,country,taxRegime,thirdPartyType,traceId` | Obligación fiscal cuando proceda; limitar campos y accesos | Vincular conservación al documento fiscal y política de bloqueo | PARCIAL. Probar validación NIF, duplicados y rectificación |
| WEB-16 | Proyección contable | Evento económico → asiento | Backend custom | `eventLog.js`, `crons.js` | `LibroAsientosContablesDetalle`; `MovimientosCaja` | `entryId,entryDate,fiscalPeriod,accountCode,debitAmount,creditAmount,sourceEventId,projectionStatus,traceId` | Obligación contable | Referencia general de 6 años; validar prescripción y reglas fiscales | PARCIAL. Revisar writer `debit/credit` vs schema `debitAmount/creditAmount` |
| WEB-17 | Inventario / pedidos | Venta, devolución, ajuste stock | Wix Stores V1 + backend | `storesCatalog.js`, `inventario.web.js`, `events.js` | `InventarioStockVenta`, `MovimientosInventario`, Wix Orders | `productId,variantId,sku,catalogVersion,locationId,stockKey,stockOnHand,stockReserved,stockAvailable,movementType,quantityDelta,stockBefore,stockAfter,movementToken,orderId,lineItemId,refundId,traceId` | Contrato y trazabilidad contable en venta; minimizar datos de comprador | Movimiento económico según conservación mercantil/fiscal; stock operativo según política | PARCIAL. Test venta/devolución y conciliación V1 |
| WEB-18 | Identidad de personal / RBAC | Login y autorización | Wix Members + Bookings + código | `staff.js`, `security.js`, `citasManager.web.js`, `horario.web.js` | `MapaStaff`, Wix Members, `ControlOperativo` | `staffMemberId,resourceId,scheduleId,memberId,thirdPartyId,staffName,rolWebsite,rolBookings,active,traceId` | Relación laboral/seguridad; mínimo privilegio | Mientras relación y obligaciones aplicables; revocar al cesar | PARCIAL. Test de roles por Member ID y permisos reales |
| WEB-19 | Fichaje laboral | Entrada/salida/pausas/ajustes | Backend custom + Wix Members | `horario.web.js`, `securityEngine.js` | `RegistrosHorariosStaff` | Campos canónicos: `resourceId,memberId,staffName,recordedAt,recordedTime,dayKey,monthKey,clockEventType,recordType,registeredBy,registeredByMemberId,adjustmentReason,deviceIpAddress,meta,traceId,signature` | Obligación laboral, no consentimiento como base ordinaria | 4 años según art. 34.9 ET; control de acceso y export | PARCIAL. HMAC writer existe; validar jornada, export y conservación |
| WEB-20 | Calendario externo | Sincronización de eventos | Google Calendar Wix connection; observada DISCONNECTED | M365 `SDK_CONFIG.M365.ENABLED=false`; no se acredita writer activo | No se identifica colección activa propia | Si se reactiva: `provider,connectionId,direction,connectedAt,lastSyncAt,syncStatus,externalEventId,bookingId,error,traceId` | Contrato y transferencias/proveedor; minimización | Según proveedor y política de reserva | NO OPERATIVA según lectura anterior. No reactivar sin aprobación |
| WEB-21 | Marketing / newsletter | Alta, campaña, baja | Wix Automations/Contacts; uso exacto por verificar | No se identificó backend marketing propio | Wix Contacts; nueva `ConsentimientosTratamiento` propuesta | `contactId,purpose=MARKETING,legalBasis,consentGiven,consentAt,noticeVersion,source,withdrawnAt,proof,campaignId,sentAt,suppressionStatus` | Consentimiento u otra base válida según canal/caso; LSSI/ePrivacy y RGPD | Hasta retirada/oposición y conservación mínima de prueba | PARCIAL. Probar opt-in separado, baja y lista de supresión |
| WEB-22 | Área de miembros | Registro/login/perfil | Wix Members | Backend específico no demostrado | Wix Members/Contacts; `MapaStaff` solo para staff | `memberId,contactId,role,createdAt,status`; registrar login solo si necesario | Contrato/seguridad; minimización | Baja y plazos de reclamación/obligaciones justificadas | NO VERIFICADO. App instalada no prueba flujo activo |
| WEB-23 | Bonos / Gift Cards | Emisión, venta, canje | Wix Gift Cards; Pricing Plans por confirmar | Integración custom no probada | Wix Gift Cards; referencia de canje en reserva si aplica | `giftCardId,orderId,purchaserContactId,recipientContactId,issuedAt,expiryDate,originalValue,remainingBalance,redemptionBookingId,status` | Contrato/consumo y obligaciones fiscales | Según validez, reclamaciones y fiscalidad | PARCIAL. Probar compra, canje, devolución y conciliación |
| WEB-24 | Blog / SEO | Publicación de contenido | Wix Blog + Promote SEO | No se identifica backend operativo | Wix Blog/CMS contenido | `contentId,slug,publishedAt,updatedAt,authorId,seoTitle,metaDescription,canonicalUrl,imageRights` | Derechos de autor; datos de autor y cookies si aplica | Mientras publicado y según licencias | NO VERIFICADO. Revisar contenido, indexación, cookies y derechos |
| WEB-25 | QA / regresión | Simulaciones CI y pruebas | GitHub Actions + mocks | `src/backend/tests/*`, workflow booking-regression | `QAE2ESimulaciones` si se persiste evidencia | `scenarioId,traceId,status,bookingId` sintético, `evidenceJson,testRunId,commitSha,createdAt,environment,piiRedacted` | QA/seguridad; preferir datos sintéticos | Retención limitada al ciclo QA/release | PARCIAL. CI mock no equivale a E2E navegador Wix |
| WEB-26 | Auditoría de seguridad | Alertas, errores, cambios de acceso | Backend custom + Wix roles | `security.js`, `logger.js`, `dataAccess.js` | `ControlOperativo` y destino logger por verificar | `controlType=ALERT,traceId,actorId,action,targetType,targetId,occurredAt,result,reason,source,correlationId`; excluir payload sensible | Seguridad/interés legítimo/obligación aplicable | Retención proporcional a riesgo y necesidad de investigación | PARCIAL. Revisar cobertura de acciones privilegiadas y expurgo |

## Colecciones canónicas y uso

| Colección | Rol en el sistema | Campos / contrato principal |
|---|---|---|
| `ServiciosCatalogo` | Catálogo maestro de servicios y vínculo F1/F2 | `serviceId,title,slug,sku,price,currency,totalDuration,phase1Duration,exposureDuration,phase2Duration,allowCombine,linkedPhases` |
| `ComplementosCatalogo` | Catálogo de extras | `addonId,name,sku,price,durationMinutes,tipoImpositivo,codigoImpuesto,claveRegimen,cuentaContableIngreso` |
| `CitasF2` | Proyección operativa propia de reservas; no sustituye Bookings | `bookingId,bookingType,catalogId,contactDetails,dateYmd,meta,pairToken,paymentStatus,resourceId,revision,scheduleId,serviceId,slotStart,slotEnd,bookingStatus,thirdPartyId,totalAmount,traceId` |
| `MapaStaff` | Identidad Bookings↔Member↔recurso y rol | `staffMemberId,resourceId,scheduleId,memberId,thirdPartyId,staffName,rolWebsite,rolBookings,active` |
| `ControlOperativo` | Locks, idempotencia, cachés, compensaciones, webhooks y alertas | `controlType,dedupeKey,status,eventId,traceId,payload,attempts,nextRetryAt,lastError,leaseExpiresAt,heartbeatAt,processedAt` según tipo |
| `MovimientosCaja` | Libro de movimientos económicos/fiscales | Claves canónicas: `amount,totalAmount,numSerieFactura,fechaExpedicionFactura,taxBase,taxAmount,tipoImpositivo,tipoFactura,nifEmisor,nifDestinatario,fechaOperacion,recordTimestamp,operationDescription,payloadFiscal,linkedBookingIds,movementType,paymentMethod,hash` y otras fiscales |
| `CajaActual` | Estado/proyección de caja abierta | `openedAt,openedBy,openingAmount,isOpen,cashAmount,expectedCash,countedCash,difference,differenceReason` |
| `HistoricoCierresZ` | Evidencia histórica de cierre | snapshot, hash, firma, verificación y timestamps definidos por writer/schema |
| `DatosFiscales` | Terceros fiscales | `taxId,legalName,address,postalCode,province,country,taxRegime,thirdPartyType` |
| `LibroAsientosContablesDetalle` | Proyección contable | Schema declara `entryId,entryDate,fiscalPeriod,accountCode,debitAmount,creditAmount`; verificar contrato del writer |
| `InventarioStockVenta` | Estado de stock | `productId,variantId,sku,catalogVersion,locationId,stockKey,stockOnHand,stockReserved,stockAvailable` |
| `MovimientosInventario` | Ledger de movimientos de stock | `movementType,quantityDelta,stockBefore,stockAfter,movementToken,orderId,lineItemId,refundId,traceId` |
| `RegistrosHorariosStaff` | Registro horario append-only | `resourceId,memberId,staffName,recordedAt,recordedTime,dayKey,monthKey,clockEventType,recordType,registeredBy,registeredByMemberId,adjustmentReason,deviceIpAddress,meta,traceId,signature` |
| `RegistroIntegracion` | No se ha demostrado como writer principal en módulos examinados | No convertir en fuente de verdad hasta definir consumidores y contrato |
| `QAE2ESimulaciones` | Evidencia de pruebas | `scenarioId,traceId,status,bookingId,evidenceJson`; usar IDs sintéticos/anonimizar |

## Riesgos de esquema ya identificados que deben cerrarse

1. **Fiscal:** revisar `aeatPayload` del writer frente a `payloadAEAT` del esquema CMS. Elegir clave canónica; no renombrar ni migrar registros históricos sin export, dry-run y test.
2. **Contabilidad:** el writer revisado proyecta `debit`/`credit`, mientras el schema declarado usa `debitAmount`/`creditAmount`. Verificar hook y datos live antes de corregir.
3. **Consentimiento:** `processDualBooking` exige `rgpdConsent === true`, pero `_persistBooking` no persiste prueba con finalidad, versión y timestamp. Distinguir aceptación contractual/aviso de consentimiento opcional (marketing).
4. **Bookings:** política nativa auditada: antelación 14 días y cancelación 12 h; calendario/backend: 15 días; copy comunica 24 h. Decisión comercial pendiente.
5. **Checkout:** en la auditoría Wix el checkout estaba en modo real (`testMode=DISABLED`) y checkbox de políticas marcado por defecto. No hacer pagos de prueba en producción.
6. **AEAT:** firma/hash/QR y payload en código no demuestran remisión efectiva ni acuse AEAT. No afirmar certificación Veri*factu.
7. **Google Calendar:** conexión observada `DISCONNECTED`; M365 y contabilidad externa deshabilitados en `SDK_CONFIG`.
8. **Automations:** no crear avisos paralelos antes de inventariar todas las reglas y destinatarios; la auditoría previa encontró duplicidad de notificación al profesional.

## Plan de cierre priorizado

| ID | Trabajo | Prioridad | Criterio de cierre |
|---|---|---|---|
| ACT-01 | Alinear antelación, cancelación, copy y checkout | P0 | Una regla única configurada y probada en UI/API |
| ACT-02 | Diseñar y persistir evidencia de privacidad/consentimiento por finalidad | P0 | Aviso/version/fecha/finalidad y retirada demostrables; tests de reserva |
| ACT-03 | Reconciliar campos fiscales y contables con schema CMS | P0 | Writer, hooks y schema coinciden; migración dry-run y regresión |
| ACT-04 | Determinar obligación y verificar firma/QR/remisión AEAT | P0 | Validación asesoría + pruebas en entorno autorizado + acuse cuando aplique |
| ACT-05 | Separar marketing, opt-in, baja y supresión | P0 | Test de alta/baja y no reactivación |
| ACT-06 | Inventariar automatizaciones Wix con paginación completa | P1 | Matriz trigger→acción→destinatario y duplicados resueltos |
| ACT-07 | Verificar scheduler publicado y ejecución de 12 jobs | P1 | Evidencia live por job, timestamps y resultados |
| ACT-08 | Confirmar integraciones externas y encargados | P2 | Conexión verificada, test ida/vuelta y documentación de proveedor |
| ACT-09 | Completar RAT, encargados, transferencias y plazos | P0 | Aprobación del responsable/asesoría y revisión fechada |
| ACT-10 | Definir conservación, bloqueo, borrado y solicitudes de derechos | P1 | Procedimiento probado y responsables asignados |
| ACT-11 | E2E navegador en QA aislado, checkout sandbox | P0 | Reserva simple/dual, pago simulado, webhook, cancelación y limpieza |
| ACT-12 | Validar formularios administrativos y bloquear escrituras directas | P1 | RBAC backend y ledgers append-only verificados |
| ACT-13 | Verificar ventas/devoluciones/stock en Stores V1 | P1 | Conciliación Wix↔CMS por variante y ubicación |
| ACT-14 | Validar fichaje, ajustes, export y retención de cuatro años | P0 | Reconstrucción jornada y evidencia exportable |

## Fuentes internas de evidencia

- `src/backend/internalConfig.js` — colecciones, campos canónicos, enums, zona horaria y flags de integración.
- `src/backend/citasManager.web.js`, `src/backend/booking/bookingSaga.js`, `src/backend/booking/bookingCore.js` — orquestación, escritura y persistencia de reservas.
- `src/backend/events.js` — webhooks Bookings/eCommerce.
- `src/backend/cajas.web.js`, `src/backend/eventLog.js` — ledger económico/fiscal y proyecciones.
- `src/backend/horario.web.js` — fichaje y firma HMAC.
- `src/backend/inventario.web.js` — movimientos de stock y pedidos.
- `src/backend/jobs.config`, `src/backend/crons.js` — tareas programadas.
- `docs/audits/2026-11-01-wix-site-app-settings-readonly-audit.md` — evidencia de ajustes Wix, apps, políticas, Forms, Automations, Stores, Invoices y SEO.

## Límites de esta matriz

Es una matriz técnica de trazabilidad y preparación de cumplimiento, no un dictamen jurídico ni certificación fiscal. Las colecciones/campos propuestos no existen hasta que se implementen. La existencia de un módulo o una app instalada no prueba que el flujo esté publicado, conectado o funcionando en producción. No se ejecutaron escrituras ni pruebas que creen reservas, cobros o cambios en el sitio.
