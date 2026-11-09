# DOSSIER TÉCNICO DE FLUJOS END-TO-END
## Capa 1 (Wix SSOT) → Capa 3 (SharePoint / M365)
### Marian Madrid Peluquería y Estética · marianmadrid.es

**Versión:** 1.0 · **Fecha:** 6 de noviembre de 2026
**Fuentes:** Biblia SSOT v10.0, Dossier Técnico Consolidado, PTD Kit Digital, Anexo Biblia Migración, Anexo Biblia por Wix, Directrices Desarrollo Código, Documentación oficial Wix Developers (noviembre 2026), Normativa fiscal/laboral/contable española vigente

> **Estado de implantación verificado — 8 de noviembre de 2026:** este documento describe la arquitectura objetivo de Capa 3; no acredita que esté desplegada. En `main` no existe `src/backend/exports/exportService.js`, no hay llamadas runtime a Resend ni los cuatro jobs específicos de exportación en `jobs.config`. Existe `verifyNightlyZClosing`, pero no genera ni envía actualmente el CSV de Cierre Z. El tenant M365, SharePoint y los flujos PA-01…PA-07 no han sido auditados; su estado queda **pendiente de verificación**, no se presume activo.
>
> **Disponibilidad Bookings (estado de código):** los slots y parejas duales se consultan de nuevo a Wix en cada petición; no se almacenan en caché. `DAYS_CACHE` conserva únicamente fechas disponibles/vacías durante 5 minutos. El DTO público aplica una separación mínima de 30 minutos entre inicios visibles. Las referencias a caché de slots en apartados antiguos deben entenderse como históricas, no como comportamiento vigente.

---

## ÍNDICE

- [Bloque A — Catálogo de Datos Trasladables](#bloque-a)
- [Bloque B — Arquitectura Técnica del Puente](#bloque-b)
- [Bloque C — Configuración Power Automate y SharePoint](#bloque-c)
- [Bloque D — Cumplimiento Normativo del Tránsito](#bloque-d)
- [Bloque E — Guía de Implementación Práctica](#bloque-e)
- [Anexo I — Matriz de Trazabilidad por Campo](#anexo-i)
- [Anexo II — Glosario de Acrónimos](#anexo-ii)

---

## BLOQUE A — CATÁLOGO DE DATOS TRASLADABLES

### A.1 Principio rector

> **Wix CMS (Capa 1) es la única fuente de verdad transaccional. Capa 3 (SharePoint) es un repositorio de evidencia documental para el gestor/contable. Capa 3 nunca es fuente de verdad, nunca se escribe desde Capa 3 hacia Capa 1, y ningún dato de Capa 3 tiene autoridad sobre el CMS.**

### A.2 Clasificación de procesos por origen

Los procesos que generan datos trasladables se clasifican en tres categorías según su origen técnico:

| Categoría | Origen | Ejemplos |
| :--- | :--- | :--- |
| **INTRÍNSECO WIX** | Generado nativamente por Wix Apps sin intervención del backend personalizado | Reservas nativas Bookings, pedidos Stores, cobros eCommerce, fichas Members |
| **BACKEND PERSONALIZADO** | Generado por módulos Velo propios del proyecto | Cierre Z, movimientos de caja, fichajes, inventario espejo, agregación fiscal |
| **EXTERNO MANUAL** | Generado fuera del sitio Wix y archivado manualmente por Marian | Facturas de proveedores, extractos bancarios, contratos |

### A.3 Procesos INTRÍNSECOS de Wix Apps

#### A.3.1 Wix Bookings V2 — Reservas y Citas

**Fuente oficial:** `dev.wix.com/docs/api-reference/business-solutions/bookings`

| Subproceso intrínseco | API Wix que lo genera | Datos generados | Colección CMS destino | ¿Se traslada a Capa 3? |
| :--- | :--- | :--- | :--- | :--- |
| Creación de reserva nativa | `createBooking` (Bookings Writer V2) | `bookingId`, `serviceId`, `resourceId`, `slotStart`, `slotEnd`, `status` (Wix nativo), `contactDetails` | `CitasF2` (proyección propia) | ✅ Sí — vía export mensual `CitasF2` |
| Actualización de reserva | `updateBooking` / webhook `booking_updated` | `bookingId`, nuevo `slotStart`/`slotEnd`, nuevo `resourceId` | `CitasF2` (update controlado) | ✅ Sí — incluido en export mensual |
| Cancelación de reserva | `cancelBooking` / webhook `booking_canceled` | `bookingId`, `status: CANCELED`, motivo | `CitasF2` + `MovimientosCaja` (rectificativo) | ✅ Sí — vía `MovimientosCaja` |
| Confirmación de reserva | Webhook `booking_confirmed` | `bookingId`, `status: CONFIRMED` | `CitasF2` | ✅ Sí — incluido en export mensual |
| Reprogramación | Webhook `booking_rescheduled` | `bookingId`, nuevo slot, nuevo recurso | `CitasF2` | ✅ Sí — incluido en export mensual |
| Consulta de disponibilidad | `listAvailabilityTimeSlots` (Time Slots V2) | Slots disponibles (efímeros) | No se persiste; se consulta de nuevo a Wix en cada petición (sin caché de slots) | ❌ No — dato efímero, sin relevancia fiscal |
| Creación de reserva dual (F1+F2) | Dos llamadas `createBooking` + `pairToken` | Dos `bookingId`, `pairToken`, `bookingType` | `CitasF2` (2 registros) + `ControlOperativo` | ✅ Sí — vía export mensual `CitasF2` |

**Datos que NO se trasladan de Bookings:**
- Slots de disponibilidad consultados (efímeros).
- Datos de contacto del cliente en `contactDetails` (PII — RGPD).
- `scheduleId` interno de Wix (técnico, sin relevancia fiscal).

#### A.3.2 Wix Stores Catalog V1 — Catálogo y Stock

**Fuente oficial:** `dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v1`
**Nota:** Migración a Catalog V3 preparada en código (PR #13, ADR-001) pero no activada en producción.

| Subproceso intrínseco | API Wix que lo genera | Datos generados | Colección CMS destino | ¿Se traslada a Capa 3? |
| :--- | :--- | :--- | :--- | :--- |
| Alta de producto | Panel Wix Stores / API V1 | `productId`, `name`, `price`, `sku`, `visible` | `Stores/Products` (WIX_APP, solo lectura) | ❌ No — dato maestro, no transaccional |
| Actualización de stock nativo | Checkout Wix Stores (descuento automático) | `inventoryItemId`, `quantity` decrementado | `Stores/InventoryItems` (WIX_APP) | ❌ No directamente — se traslada vía `MovimientosInventario` |
| Creación de pedido | Checkout eCommerce → `order_created` | `orderId`, `lineItems[]`, `totalAmount`, `paymentStatus` | `Stores/Orders` (WIX_APP) + `CitasF2` (si aplica) | ✅ Sí — vía export mensual ventas |
| Confirmación de pago | Webhook `order_payment_status_updated` | `orderId`, `transactionId`, `paymentStatus: PAID` | `MovimientosCaja` (insert append-only) | ✅ Sí — vía export diario `MovimientosCaja` |
| Reembolso | Webhook `order_refund_updated` | `refundId`, `amount`, `restock` (si aplica) | `MovimientosCaja` (rectificativo) + `MovimientosInventario` | ✅ Sí — vía ambos exports |

**Datos que NO se trasladan de Stores:**
- Metadatos de productos (descripciones, imágenes, SEO).
- Variantes sin movimiento de stock.
- Datos de navegación del carrito abandonado (PII — RGPD).

#### A.3.3 Wix eCommerce — Checkout y Pagos

**Fuente oficial:** `dev.wix.com/docs/api-reference/business-solutions/e-commerce/purchase-flow/cart-v2`
**Nota:** Migración a Cart V2 obligatoria antes de febrero 2027 (Biblia SSOT §16.1).

| Subproceso intrínseco | API Wix que lo genera | Datos generados | Colección CMS destino | ¿Se traslada a Capa 3? |
| :--- | :--- | :--- | :--- | :--- |
| Creación de carrito | `createCart` (Cart V2) | `cartId`, `lineItems[]`, `totalAmount` | Efímero (no se persiste en CMS propio) | ❌ No — dato efímero |
| Pago online procesado | Wix Payments → Wix eCommerce / evento de pago | `transactionId`, `paymentMethod` nativo/canónico, `amount`, `currency` | `MovimientosCaja` (insert append-only) | Sí — vía export diario del ledger propio |
| Método digital alternativo | Solo se registra como método online si Wix Payments lo ofrece y está habilitado para esta cuenta; no se presupone disponibilidad de Bizum. | Método nativo confirmado, `transactionId`, `amount` | `MovimientosCaja` (insert append-only) | Sí — vía export diario del ledger propio |
| Pago presencial (efectivo/tarjeta) | Registro manual en `cajas.web.js` | `transactionId`, `paymentMethod`, `channelType: PRESENCIAL` | `MovimientosCaja` (insert) | ✅ Sí — vía export diario |

#### A.3.4 Wix Members — Identidad

**Fuente oficial:** `dev.wix.com/docs/sdk/api-reference/members/introduction`

| Subproceso intrínseco | Datos generados | ¿Se traslada a Capa 3? |
| :--- | :--- | :--- |
| Alta de miembro | `memberId`, `email`, `firstName`, `lastName`, `phone` | ❌ No — PII (RGPD). Solo se usa para autenticación. |
| Autenticación de personal | `memberId` → resuelve `resourceId` en `MapaStaff` | ❌ No — dato operativo, no fiscal |
| Ficha técnica clienta (Wix CRM) | Fórmula de color, alergias, historial | ❌ No — PII sensible (RGPD). Sin relevancia fiscal. |

#### A.3.5 Wix Invoices V1 — Facturación Nativa

**Fuente oficial:** `dev.wix.com/docs/api-reference/business-solutions/invoices`
**Nota:** Separado del ledger propio Veri*Factu. No es fuente de verdad fiscal.

| Subproceso intrínseco | Datos generados | ¿Se traslada a Capa 3? |
| :--- | :--- | :--- |
| Factura simplificada nativa Wix | `invoiceId`, `amount`, `taxAmount`, `issueDate` | ❌ No directamente — el ledger propio `MovimientosCaja` es la fuente fiscal. Wix Invoices es complementario. |
| Factura completa (datos destinatario) | `invoiceId`, `recipientTaxId`, `recipientName` | ❌ No — PII del destinatario. Solo se traslada el importe y número de serie. |

#### A.3.6 Wix Gift Cards — Tarjetas Regalo

| Subproceso intrínseco | Datos generados | ¿Se traslada a Capa 3? |
| :--- | :--- | :--- |
| Emisión de tarjeta regalo | `giftCardId`, `amount`, `purchaseDate` | ✅ Sí — como `COBRO` en `MovimientosCaja` |
| Canje de tarjeta regalo | `giftCardId`, `redeemedAmount`, `bookingId` | ✅ Sí — como rectificación en `MovimientosCaja` |

### A.4 Procesos del BACKEND PERSONALIZADO

#### A.4.1 `cajas.web.js` — Ledger Fiscal Veri*Factu

**Módulo:** `backend/cajas.web.js`
**Colecciones:** `MovimientosCaja`, `CajaActual`, `HistoricoCierresZ`

| Subproceso | WebMethod / Función | Datos generados | Campos clave | ¿Se traslada a Capa 3? |
| :--- | :--- | :--- | :--- | :--- |
| Cobro presencial | `registerManualTransaction` | Movimiento de caja | `sequenceNumber`, `numSerieFactura`, `movementType: COBRO`, `channelType: PRESENCIAL`, `paymentMethod`, `amount`, `taxBase`, `taxAmount`, `tipoImpositivo`, `hash`, `previousRecordHash`, `transactionId`, `traceId` | ✅ Sí — export diario |
| Cobro online | Webhook `order_payment_status_updated` → insert | Movimiento de caja | Mismos campos + `channelType: ONLINE` | ✅ Sí — export diario |
| Devolución | `registerManualTransaction` / webhook | Movimiento rectificativo | `movementType: DEVOLUCION`, `previousInvoiceId`, `tipoRectificativa`, `correctionAmount` | ✅ Sí — export diario |
| Ajuste de caja | `registerManualTransaction` | Movimiento de ajuste | `movementType: AJUSTE`, `operationDescription` (obligatorio) | ✅ Sí — export diario |
| Aportación / Retiro | `registerManualTransaction` | Movimiento no comercial | `movementType: APORTACION` / `RETIRO` | ✅ Sí — export diario |
| Pago a proveedor | `registerManualTransaction` | Movimiento de gasto | `movementType: PAGO_PROVEEDOR`, `NIFDestinatario`, `thirdPartyLegalName` | ✅ Sí — export diario |
| Arqueo X | `registerXCount` | Estado de caja | `expectedCash`, `countedCash`, `difference`, `differenceReason` | ❌ No — dato operativo interno |
| Estado de caja | `getCashierState` | Lectura de `CajaActual` | `isOpen`, `cashAmount`, `salesCount` | ❌ No — dato en tiempo real, no histórico |

#### A.4.2 `crons.js` — Cierre Z Nocturno

**Módulo:** `backend/crons.js` → `verifyNightlyZClosing`
**Colección:** `HistoricoCierresZ`

| Subproceso | Frecuencia | Datos generados | Campos clave | ¿Se traslada a Capa 3? |
| :--- | :--- | :--- | :--- | :--- |
| Agregación de transacciones del día | Diario 01:20 | Totales por método de pago | `totalCash`, `totalCard`, `totalBizum`, `totalOnline`, `totalTaxBase`, `totalTaxAmount`, `totalRefunds` | ✅ Sí — export diario Cierre Z |
| Verificación de cadena SHA-256 | Diario 01:20 | Estado de integridad | `isIntegrityVerified`, `startRecordHash`, `endRecordHash`, `startSequence`, `endSequence` | ✅ Sí — incluido en CSV Cierre Z |
| Consolidación en HistoricoCierresZ | Diario 01:20 | Documento inmutable | `closeDate`, `fiscalPeriod`, `closingHash`, `closingSignature`, `closingSignatureStatus`, `taxTypeBreakdown`, `movementTypeBreakdown` | ✅ Sí — export diario Cierre Z |
| Alerta de Cierre Z faltante | Diario 08:00 | Alerta en `ControlOperativo` | `alertType`, `message`, `severity` | ❌ No — alerta interna |

#### A.4.3 `horario.web.js` — Fichajes Laborales

**Módulo:** `backend/horario.web.js`
**Colección:** `RegistrosHorariosStaff`

| Subproceso | WebMethod | Datos generados | Campos clave | ¿Se traslada a Capa 3? |
| :--- | :--- | :--- | :--- | :--- |
| Fichaje de entrada | `registrarFichaje` | Registro de jornada | `resourceId`, `memberId`, `clockEventType: ENTRADA`, `recordedAt`, `staffName`, `dayKey`, `monthKey`, `traceId` | ✅ Sí — export semanal |
| Fichaje de salida | `registrarFichaje` | Registro de jornada | `clockEventType: SALIDA`, `recordedAt` | ✅ Sí — export semanal |
| Pausa inicio/fin | `registrarFichaje` | Registro de pausa | `clockEventType: PAUSA_INICIO` / `PAUSA_FIN` | ✅ Sí — export semanal |
| Ajuste de registro | `registrarFichaje` | Corrección | `clockEventType: AJUSTE`, `notes` (obligatorio), `adjustmentReason`, `signature` | ✅ Sí — export semanal |
| Estado de jornada | `getEstadoJornada` | Lectura | Último fichaje del día | ❌ No — dato en tiempo real |
| Cálculo de horas | `calcularHorasTrabajadas` | Agregación | Total horas por `resourceId` y período | ✅ Sí — incluido en resumen mensual |

#### A.4.4 `inventario.web.js` — Inventario Espejo

**Módulo:** `backend/inventario.web.js`
**Colecciones:** `InventarioStockVenta`, `MovimientosInventario`

| Subproceso | Datos generados | Campos clave | ¿Se traslada a Capa 3? |
| :--- | :--- | :--- | :--- |
| Entrada de stock (proveedor) | Movimiento de inventario | `movementToken`, `movementType: ENTRADA_STOCK`, `sku`, `quantityDelta`, `stockBefore`, `stockAfter`, `reason`, `referenceId` | ✅ Sí — export mensual |
| Salida de stock (venta) | Movimiento de inventario | `movementType: VENTA`, `orderId`, `lineItemId`, `quantityDelta` (negativo) | ✅ Sí — export mensual |
| Devolución al stock | Movimiento de inventario | `movementType: DEVOLUCION`, `refundId`, `quantityDelta` (positivo) | ✅ Sí — export mensual |
| Ajuste por merma/rotura | Movimiento de inventario | `movementType: AJUSTE`, `reason` (obligatorio) | ✅ Sí — export mensual |
| Dashboard de inventario | Lectura de estado | `stockOnHand`, `stockAvailable`, `stockReserved`, `needsWixReconciliation` | ❌ No — dato operativo en tiempo real |

#### A.4.5 `fiscalAggregator.web.js` — Agregación Fiscal

**Módulo:** `backend/fiscalAggregator.web.js`
**Colección:** Query sobre `MovimientosCaja`

| Subproceso | WebMethod | Datos generados | ¿Se traslada a Capa 3? |
| :--- | :--- | :--- | :--- |
| Resumen trimestral de impuestos | `getQuarterlyTaxSummary` | IVA repercutido, IVA soportado, resultado por trimestre | ✅ Sí — consolidado en paquete trimestral |
| Libro registro facturas expedidas | `getLibroRegistroFacturasExpedidas` | Lista de `numSerieFactura`, `fechaExpedicionFactura`, `taxBase`, `taxAmount`, `amount` | ✅ Sí — incluido en paquete anual |
| Libro registro facturas recibidas | Query sobre `PAGO_PROVEEDOR` | Lista de facturas de proveedores | ✅ Sí — incluido en paquete anual |

#### A.4.6 `fiscalDocuments.web.js` — Paquetes para Gestoría

**Módulo:** `backend/fiscalDocuments.web.js`
**Colección:** `HistoricoCierresZ` (campos `packageStatus`, `packageVersion`, `sentTo`, `sentAt`)

| Subproceso | WebMethod | Datos generados | ¿Se traslada a Capa 3? |
| :--- | :--- | :--- | :--- |
| Vista previa de paquete | `previewManagerPackage` | JSON con resumen del período | ❌ No — vista previa interna |
| Creación de versión de paquete | `createManagerPackageVersion` | Documento consolidado con `packageVersion` | ✅ Sí — es el paquete que se entrega al gestor |
| Descarga de paquete | `downloadManagerPackageVersion` | Archivo descargable | ✅ Sí — se archiva en `6_ENTREGA_GESTOR/` |
| Envío por email | `emailManagerPackageVersion` | Email con adjunto | ✅ Sí — notificación al gestor |

### A.5 Procesos EXTERNOS MANUALES (sin origen en Wix)

| Proceso | Origen | Datos generados | Carpeta Capa 3 destino | Mecanismo de traslado |
| :--- | :--- | :--- | :--- | :--- |
| Factura de proveedor recibida | Email, papel, PDF externo | PDF/imagen de factura | `2_GASTOS/AAAA/MM/` | Marian reenvía email con asunto `[GASTO]` → Power Automate archiva |
| Extracto bancario mensual | Banca online Ibercaja | PDF del extracto | `3_BANCO/AAAA/` | Marian descarga y sube manualmente a SharePoint |
| Contrato de alquiler / seguros | Documento físico o PDF | PDF del documento | `9_DOCUMENTOS_NEGOCIO/` | Marian sube manualmente |
| Nóminas del personal | Gestoría laboral externa | PDF de nómina | `4_PERSONAL/Nominas/` | Marian recibe de gestoría y sube |

### A.6 Datos que NUNCA se trasladan a Capa 3

| Dato | Motivo de exclusión | Norma aplicable |
| :--- | :--- | :--- |
| PII de clientes (nombre, email, teléfono, dirección) | Minimización de datos. El gestor no necesita identidad de clientes para contabilidad. | RGPD art. 5.1.c) |
| Datos de tarjetas de crédito (PAN, CVV, caducidad) | PCI-DSS. Nunca llegan al CMS. Wix Payments procesa los datos de tarjeta durante el checkout; el CMS no almacena PAN ni CVV. | PCI-DSS, RGPD |
| Fórmulas de color, alergias, historial de clientas | Datos operativos del salón sin relevancia fiscal. PII sensible. | RGPD art. 9 (datos de salud) |
| Hashes Veri*Factu en la UI del frontend | Seguridad. Solo en CSV de export, nunca en DTO al cliente. | SSOT §18.1 |
| Cuentas contables PGC en el DTO frontend | Seguridad. Solo en export para gestor. | SSOT §18.1 |
| Márgenes comerciales y notas privadas | Confidencialidad empresarial. | SSOT §18.1 |
| Datos de marketing (clics, aperturas, tráfico web) | Sin relevancia contable ni fiscal. | No aplica |
| Slots de disponibilidad consultados | Datos efímeros sin persistencia. | No aplica |
| Registros de `ControlOperativo` (locks, rate limits) | Datos técnicos internos sin relevancia fiscal. | No aplica |

---

## BLOQUE B — ARQUITECTURA TÉCNICA DEL PUENTE

### B.1 Decisión de arquitectura: patrón email estructurado

**Restricción de licencia:** M365 Business Standard incluye Power Automate con conectores **estándar únicamente**. Los conectores HTTP (Request/Response) son **Premium** y no están incluidos. No existe conector nativo Wix para Power Automate.

**Solución adoptada:** El backend Wix genera un email con adjunto CSV/JSON mediante Resend (ya integrado según SSOT §9) y lo envía a `gestion@marianmadrid.es`. Power Automate detecta el email mediante el conector estándar **Office 365 Outlook**, extrae el adjunto y lo deposita en **SharePoint Online**.

**Justificación de la elección:**

| Alternativa evaluada | Motivo de descarte |
| :--- | :--- |
| Wix Webhook → Power Automate HTTP trigger | Conector HTTP es Premium. No incluido en M365 Business Standard. |
| Wix `wix-fetch` → Microsoft Graph API directo | Requiere registro de app en Azure AD, flujo OAuth2 client credentials, gestión de tokens. Complejidad desproporcionada. |
| Wix → Google Sheets → Power Automate | Conector Google no disponible en estándar. Añade dependencia externa. |
| Wix → FTP → OneDrive sync local | Requiere PC siempre encendido. Frágil. No auditable. |
| Copia manual por Marian | No automatizado. Error humano. Incumple prioridad 1 (Fiabilidad). |
| **Email estructurado → Power Automate → SharePoint** | **Elegido.** Conectores estándar. Ya descrito en PTD §7.5. Sin coste adicional. 100% legal. |

### B.2 Diagrama de arquitectura del puente

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CAPA 1 — WIX CMS (SSOT)                                                   │
│                                                                             │
│  MovimientosCaja ──────────────────────────────────────────────────────┐    │
│  HistoricoCierresZ ────────────────────────────────────────────────────┤    │
│  CitasF2 ──────────────────────────────────────────────────────────────┤    │
│  RegistrosHorariosStaff ───────────────────────────────────────────────┤    │
│  MovimientosInventario ────────────────────────────────────────────────┤    │
│  InventarioStockVenta ─────────────────────────────────────────────────┤    │
│  LibroAsientosContablesDetalle ────────────────────────────────────────┤    │
│  Stores/Orders (WIX_APP) ──────────────────────────────────────────────┤    │
│                                                                             │
│  MÓDULO DE EXPORTACIÓN: backend/exports/exportService.js                   │
│  (nuevo módulo — único punto de generación de exports)                     │
│  Consulta CMS con elevate() → formatea CSV → invoca Resend                 │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   │ Resend API (fetch desde backend)
                                   │ Asunto: [MM-EXPORT] TIPO FECHA
                                   │ Adjunto: CSV UTF-8
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  TRANSPORTE — EMAIL                                                        │
│                                                                             │
│  IONOS MX (mx00.ionos.es / mx01.ionos.es)                                 │
│  SPF: v=spf1 include:_spf-eu.ionos.com include:ascendbywix.com ~all       │
│  DKIM: activo (s1-ionos, s2-ionos)                                        │
│  DMARC: v=DMARC1; p=none; rua=mailto:gestion@marianmadrid.es              │
│  TLS: 1.2+                                                                 │
│                                                                             │
│  Buzón destino: gestion@marianmadrid.es                                    │
│  Acceso: Marian (exclusivo) — Gmail POP3 SSL 995                           │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   │ Conector Office 365 Outlook (ESTÁNDAR)
                                   │ Trigger: "When a new email arrives (V3)"
                                   │ Filtro: De = sistema@marianmadrid.es
                                   │         Asunto contiene [MM-EXPORT]
                                   │         Tiene adjuntos = Sí
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  POWER AUTOMATE (M365 Business Standard)                                   │
│                                                                             │
│  PA-01: Cierre Z → SharePoint                                              │
│  PA-02: Movimientos Caja → SharePoint                                      │
│  PA-03: Fichajes → SharePoint                                              │
│  PA-04: Ventas Mensual → SharePoint + Excel                                │
│  PA-05: Inventario → SharePoint + Excel                                    │
│  PA-06: Gastos manuales Marian → SharePoint                                │
│  PA-07: Consolidación trimestral → 6_ENTREGA_GESTOR                        │
│                                                                             │
│  Conectores usados: Office 365 Outlook + SharePoint + Excel Online         │
│  Todos ESTÁNDAR. Sin conectores Premium.                                   │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   │ Conector SharePoint Online (ESTÁNDAR)
                                   │ Acción: Create file
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  CAPA 3 — SHAREPOINT ONLINE                                                │
│  Sitio: MarianMadrid_Documentacion                                         │
│  Biblioteca: Documentos_Capa3                                              │
│                                                                             │
│  📁 1_VENTAS/     ← Cierres Z, Movimientos, Reservas, Tienda Online       │
│  📁 2_GASTOS/     ← Facturas de proveedores (Marian)                      │
│  📁 3_BANCO/      ← Extractos bancarios (Marian)                          │
│  📁 4_PERSONAL/   ← Fichajes, Resumen horas                               │
│  📁 5_INVENTARIO/ ← Movimientos de stock                                   │
│  📁 6_ENTREGA_GESTOR/ ← Paquete trimestral consolidado                    │
│  📁 9_DOCUMENTOS_NEGOCIO/ ← Contratos, seguros, licencias                  │
│                                                                             │
│  Permisos: Marian (Full Control) · Gestor (Read) · Staff (Sin acceso)     │
│  Retención: 6 años (Código de Comercio art. 30)                           │
│  Versionado: 500 versiones                                                 │
│  Cifrado: AES-256 en reposo · TLS 1.2+ en tránsito                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### B.3 Módulo de exportación: `backend/exports/exportService.js`

Este módulo es el **único punto de generación de exports** hacia Capa 3. No duplica lógica de negocio: consulta el CMS, formatea y envía.

**Ubicación canónica:** `backend/exports/exportService.js`
**Dependencias:** `@wix/data` (con `elevate()`), `backend/mmSecrets.js` (para `RESEND_API_KEY`), `public/mmUtils.js` (para `_roundMoney`, `getMadridLocalStringNoZ`)

**Funciones principales:**

| Función | Responsabilidad |
| :--- | :--- |
| `sendExportEmail({ exportType, dateLabel, csvContent, filename })` | Envía email con adjunto CSV vía Resend a `gestion@marianmadrid.es` |
| `buildCierreZCSV(cierreZ)` | Formatea el Cierre Z como CSV |
| `buildMovimientosCSV(movimientos)` | Formatea los movimientos de caja como CSV |
| `buildFichajesCSV(fichajes)` | Formatea los fichajes como CSV |
| `buildVentasCSV(citas)` | Formatea las ventas/reservas como CSV |
| `buildInventarioCSV(movimientos)` | Formatea los movimientos de inventario como CSV |
| `toCSV(rows)` | Utilidad genérica de serialización CSV |

**Formato canónico del asunto del email:**

```
[MM-EXPORT] {TIPO_EXPORT} {FECHA}
```

| `TIPO_EXPORT` | Frecuencia | Ejemplo de asunto |
| :--- | :--- | :--- |
| `CIERRE_Z` | Diario | `[MM-EXPORT] CIERRE_Z 2027-01-15` |
| `MOVIMIENTOS_CAJA` | Diario | `[MM-EXPORT] MOVIMIENTOS_CAJA 2027-01-15` |
| `FICHAJES_SEMANAL` | Semanal (lunes) | `[MM-EXPORT] FICHAJES_SEMANAL 2027-S03` |
| `VENTAS_MENSUAL` | Mensual (día 2) | `[MM-EXPORT] VENTAS_MENSUAL 2027-01` |
| `INVENTARIO_MENSUAL` | Mensual (día 3) | `[MM-EXPORT] INVENTARIO_MENSUAL 2027-01` |

### B.4 Crons de exportación

Se añaden a `backend/jobs.config` junto a los 8 crons existentes:

| Cron | Expresión | Colección consultada | Export generado |
| :--- | :--- | :--- | :--- |
| `exportDailyMovements` | `0 3 * * *` | `MovimientosCaja` (día anterior) | `MOVIMIENTOS_CAJA` |
| `exportWeeklyFichajes` | `0 6 * * 1` | `RegistrosHorariosStaff` (semana anterior) | `FICHAJES_SEMANAL` |
| `exportMonthlyVentas` | `0 6 2 * *` | `CitasF2` + `Stores/Orders` (mes anterior) | `VENTAS_MENSUAL` |
| `exportMonthlyInventario` | `0 6 3 * *` | `MovimientosInventario` (mes anterior) | `INVENTARIO_MENSUAL` |

El Cierre Z se exporta dentro del cron existente `verifyNightlyZClosing` (01:20), añadiendo la llamada a `sendExportEmail` tras la inserción en `HistoricoCierresZ`.

### B.5 Formato CSV canónico

Todos los CSV de export cumplen:

| Regla | Especificación |
| :--- | :--- |
| Separador | Coma (`,`) |
| Codificación | UTF-8 |
| Primera línea | Cabeceras en `camelCase` (nomenclatura SSOT) |
| PII | Nunca se incluyen nombres de clientes, emails ni teléfonos |
| Importes | 2 decimales, sin símbolo de moneda |
| Fechas | ISO 8601 (`AAAA-MM-DD` o `AAAA-MM-DDTHH:mm:ss`) |
| Zona horaria | Todos los timestamps en `Europe/Madrid` |
| Hashes | Se incluyen `hash` y `previousRecordHash` para trazabilidad Veri*Factu |
| `traceId` | Incluido en cada fila para trazabilidad end-to-end |

### B.6 Seguridad del flujo de exportación

| Aspecto | Implementación |
| :--- | :--- |
| Autenticación Resend | API key en Wix Secrets Manager (`RESEND_API_KEY`). Nunca en código ni frontend. |
| Cifrado transporte | TLS 1.2+ entre Resend y IONOS MX. SPF/DKIM/DMARC activos (PTD §19.3). |
| Cifrado reposo | SharePoint Online: AES-256. |
| PII | Los CSV de export **nunca** incluyen datos de clientes. Solo datos económicos y operativos. |
| Idempotencia | Cada export incluye `traceId`. Power Automate verifica que el archivo no exista ya en SharePoint antes de crearlo. |
| Elevación | Las consultas al CMS usan `elevate()` de `@wix/essentials` (SSOT §8, uso restringido a operaciones de sistema). |
| Autenticación del email | SPF incluye `ascendbywix.com` (Wix Ascend). DKIM firmado por IONOS. DMARC en `gestion@`. |

---

## BLOQUE C — CONFIGURACIÓN POWER AUTOMATE Y SHAREPOINT

### C.1 Catálogo de flujos Power Automate

| ID | Nombre | Trigger | Conectores | Frecuencia | Carpeta destino |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PA-01** | Cierre Z → SharePoint | Email arrives (V3) | Outlook + SharePoint | Diario | `1_VENTAS/Cierres_Z/AAAA/MM/` |
| **PA-02** | Movimientos Caja → SharePoint | Email arrives (V3) | Outlook + SharePoint | Diario | `1_VENTAS/Movimientos/AAAA/` |
| **PA-03** | Fichajes → SharePoint | Email arrives (V3) | Outlook + SharePoint | Semanal | `4_PERSONAL/Fichajes/AAAA/` |
| **PA-04** | Ventas Mensual → SharePoint + Excel | Email arrives (V3) | Outlook + SharePoint + Excel | Mensual | `1_VENTAS/Reservas/AAAA/` |
| **PA-05** | Inventario → SharePoint + Excel | Email arrives (V3) | Outlook + SharePoint + Excel | Mensual | `5_INVENTARIO/AAAA/` |
| **PA-06** | Gastos Marian → SharePoint | Email arrives (V3) | Outlook + SharePoint | Bajo demanda | `2_GASTOS/AAAA/MM/` |
| **PA-07** | Consolidación trimestral | Recurrence (día 10, meses post-trimestre) | SharePoint + Excel + Outlook | Trimestral | `6_ENTREGA_GESTOR/AAAA/Tn/` |

### C.2 Estructura del flujo PA-01 (plantilla para PA-01 a PA-05)

```
TRIGGER: When a new email arrives (V3)
│  Carpeta: Inbox
│  De: sistema@marianmadrid.es
│  Asunto contiene: [MM-EXPORT] CIERRE_Z
│  Tiene adjuntos: Sí
│
├─ PASO 1: Apply to each → Attachments
│   │
│   ├─ PASO 1.1: Compose → attachment.Name → fileName
│   ├─ PASO 1.2: Compose → base64ToBinary(attachment.ContentBytes) → fileContent
│   │
│   └─ PASO 1.3: SharePoint → Create file
│       Site: MarianMadrid_Documentacion
│       Library: Documentos_Capa3
│       Path: /1_VENTAS/Cierres_Z/2027/{mes}/
│       Name: fileName
│       Content: fileContent
│
├─ PASO 2: Condition → ¿Archivo creado correctamente?
│   ├─ SÍ → Send Email → marian@marianmadrid.es
│   │        "✅ Cierre Z recibido y archivado"
│   └─ NO → Send Email → marian@marianmadrid.es
│            "⚠️ Error al archivar Cierre Z"
│
└─ PASO 3: Mark email as read (opcional)
```

### C.3 Flujo PA-06: Gastos manuales de Marian

```
TRIGGER: When a new email arrives (V3)
│  Asunto contiene: [GASTO]
│  Tiene adjuntos: Sí
│
├─ PASO 1: Apply to each → Attachments
│   └─ SharePoint → Create file
│       Path: /2_GASTOS/2027/{mes_extraido_del_asunto}/
│       Name: attachment.Name
│       Content: attachment.ContentBytes
│
└─ PASO 2: Send Email → marian@marianmadrid.es
    "✅ Factura archivada en GASTOS"
```

**Uso por Marian:** Reenvía la factura a `gestion@marianmadrid.es` con asunto `[GASTO] 2027-01 Factura Loreal productos`. Power Automate la archiva automáticamente.

### C.4 Flujo PA-07: Consolidación trimestral

```
TRIGGER: Recurrence
│  Día: 10
│  Hora: 09:00
│  Solo en meses: Enero, Abril, Julio, Octubre
│
├─ PASO 1: Determinar trimestre terminado
│   Enero → T4 año anterior · Abril → T1 · Julio → T2 · Octubre → T3
│
├─ PASO 2: SharePoint → Get files (múltiples carpetas del trimestre)
│
├─ PASO 3: SharePoint → Create folder
│   Path: /6_ENTREGA_GESTOR/{year}/T{n}_{year}/
│
├─ PASO 4: SharePoint → Copy files al paquete
│
├─ PASO 5: Excel Online → Create workbook
│   /6_ENTREGA_GESTOR/{year}/T{n}_{year}/Resumen_Trimestre.xlsx
│   Hojas: VENTAS, GASTOS, IVA, PERSONAL, CHECKLIST
│
├─ PASO 6: Send Email → Gestor + Marian
│   "📦 Paquete T{n} {year} disponible"
│
└─ PASO 7: Create Event (Outlook Calendar)
    "PRESENTAR Modelo 303/130 T{n} {year}" — día 20
```

### C.5 Estructura de carpetas SharePoint

```
Documentos_Capa3/
│
├── 📁 1_VENTAS/
│   ├── 📁 Cierres_Z/
│   │   └── 📁 2027/
│   │       ├── 📁 01_Enero/
│   │       │   ├── 2027-01-02_CierreZ_Z-0001.csv
│   │       │   └── ...
│   │       └── ...
│   ├── 📁 Movimientos/
│   │   └── 📁 2027/
│   │       ├── 2027-01-02_Movimientos_Caja.csv
│   │       └── ...
│   ├── 📁 Reservas/
│   │   └── 📁 2027/
│   │       ├── 2027-01_Ventas_Reservas.csv
│   │       └── ...
│   ├── 📁 Tienda_Online/
│   │   └── 📁 2027/
│   └── 📁 Consolidado_Ventas_2027.xlsx
│
├── 📁 2_GASTOS/
│   └── 📁 2027/
│       ├── 📁 01_Enero/
│       └── ...
│
├── 📁 3_BANCO/
│   └── 📁 2027/
│       ├── 2027-01_Extracto_Ibercaja.pdf
│       └── ...
│
├── 📁 4_PERSONAL/
│   ├── 📁 Fichajes/
│   │   └── 📁 2027/
│   │       ├── 2027-S01_Fichajes_Staff.csv
│   │       └── ...
│   ├── 📁 Resumen_Mensual/
│   │   └── 📁 2027/
│   └── 📁 Nominas/
│       └── 📁 2027/
│
├── 📁 5_INVENTARIO/
│   └── 📁 2027/
│       ├── 2027-01_Movimientos_Inventario.csv
│       └── ...
│
├── 📁 6_ENTREGA_GESTOR/
│   └── 📁 2027/
│       ├── 📁 T1_2027/
│       ├── 📁 T2_2027/
│       ├── 📁 T3_2027/
│       ├── 📁 T4_2027/
│       └── 📁 Anual_2027/
│
└── 📁 9_DOCUMENTOS_NEGOCIO/
    ├── Contrato_Alquiler.pdf
    ├── Poliza_Seguro_RC.pdf
    ├── Alta_IAE.pdf
    └── Documentacion_Kit_Digital/
```

### C.6 Permisos SharePoint

| Usuario / Grupo | Permiso | Motivo |
| :--- | :--- | :--- |
| Marian Madrid (`marian@marianmadrid.es`) | **Full Control** | Titular del negocio. Gestiona todo. |
| Cuenta de sistema (flujo Power Automate) | **Contribute** | Necesario para que Power Automate cree archivos. |
| Gestor / Asesor (cuenta externa) | **Read** | Acceso de consulta. No puede modificar ni eliminar. |
| Alba / Andrea | **Sin acceso** | No acceden a datos financieros (RGPD, RBAC SSOT). |

### C.7 Configuración de la biblioteca SharePoint

| Parámetro | Valor | Motivo |
| :--- | :--- | :--- |
| Versionado | Activado, 500 versiones | Trazabilidad de modificaciones |
| Content approval | Desactivado | Simplificar. El gestor valida. |
| Check out obligatorio | Desactivado | Permite edición concurrente del Excel |
| Retención | 6 años (política de retención M365) | Código de Comercio art. 30 |
| Cifrado | AES-256 (por defecto en SharePoint Online) | RGPD |
| Recycle bin | 93 días (por defecto) | Recuperación ante borrado accidental |

---

## BLOQUE D — CUMPLIMIENTO NORMATIVO DEL TRÁNSITO

### D.1 Matriz normativa aplicada al traslado

| Norma | Requisito | Cómo lo garantiza el traslado Capa 1 → Capa 3 |
| :--- | :--- | :--- |
| **Ley 11/2021 (Veri*Factu)** | Inalterabilidad, trazabilidad, sin borrados | Los CSV incluyen `hash`, `previousRecordHash`, `sequenceNumber`, `numSerieFactura`. La cadena SHA-256 se preserva íntegra. SharePoint aplica versionado (500 versiones) y retención 6 años. Los ledgers en Capa 1 son append-only por hooks. |
| **RD 1007/2023** | Huella SHA-256, secuencia monótona, QR | El CSV de `MovimientosCaja` incluye todos los campos Veri*Factu. El Cierre Z incluye `closingHash` e `isIntegrityVerified`. |
| **RD 1619/2012** | Facturas correlativas, series rectificativas | `numSerieFactura` correlativo presente en cada movimiento exportado. `tipoRectificativa` y `previousInvoiceId` en devoluciones. |
| **Ley 37/1992 (IVA)** | Desglose base/cuota por tipo impositivo | Cada CSV incluye `taxBase`, `taxAmount`, `tipoImpositivo`. El gestor puede calcular el Modelo 303 directamente. |
| **PGC (RD 1514/2007)** | Libro diario, partida doble | `LibroAsientosContablesDetalle` se exporta (si se activa el escritor). El gestor genera los asientos en su sistema a partir de `MovimientosCaja`. |
| **RD 8/2019** | Registro horario inalterable, conservación 4 años | Fichajes exportados semanalmente con `clockEventType`, `recordedAt`, `staffName`. Retención 6 años en SharePoint (supera los 4 legales). |
| **RGPD / LOPDGDD** | Minimización PII, cifrado, acceso restringido | Los CSV **nunca** incluyen PII de clientes. SharePoint cifra con AES-256. Gestor accede en solo lectura. Alba y Andrea sin acceso. Datos en servidores UE. |
| **LGT 58/2003** | Conservación 4 años (fiscal) | Retención SharePoint: 6 años. |
| **Código de Comercio art. 30** | Conservación 6 años (mercantil) | Retención SharePoint: 6 años. Versionado 500 versiones. |
| **RD 253/2025 (Bizum, si resulta aplicable)** | Obligación y sujeto obligado pendientes de validar con AEAT/asesoría. | El Cierre Z conserva `totalBizum` cuando se registra; no se presume reporte automático de Wix Payments. Los informes de pagos/payouts se archivan solo tras verificar el formato disponible en el panel. |
| **LSSI-CE** | Transparencia de precios | No aplica directamente al traslado. Los textos legales están en el sitio web. |

### D.2 Trazabilidad end-to-end del dato

Cada dato que llega a Capa 3 conserva su `traceId` (UUID v4) desde el momento de su generación en Capa 1 hasta su archivo en SharePoint. Esto permite:

1. **Auditoría fiscal:** Ante requerimiento de la AEAT, se puede rastrear cualquier `numSerieFactura` desde el CSV en SharePoint hasta el registro original en `MovimientosCaja` en el CMS Wix, verificando el `hash` y el `previousRecordHash`.
2. **Auditoría laboral:** Ante Inspección de Trabajo, se puede rastrear cualquier fichaje desde el CSV en SharePoint hasta el registro original en `RegistrosHorariosStaff`.
3. **Conciliación bancaria:** El gestor cruza el extracto bancario con los movimientos de caja del CSV, usando `transactionId` como clave de conciliación.

### D.3 Gestión de errores y resiliencia

| Escenario de fallo | Detección | Acción | Alerta |
| :--- | :--- | :--- | :--- |
| Resend no envía el email | `sendExportEmail` lanza `EXPORT_EMAIL_FAIL` | Reintento automático (3 veces, exponential backoff) | Email a Marian + `ControlOperativo` (`SYSTEM_FLAG`) |
| Email no llega a `gestion@` | Power Automate no se dispara | Marian verifica carpeta `1_VENTAS/` el día 3 | Flujo PA-01 no genera confirmación → Marian contacta soporte |
| Power Automate falla al crear archivo | Condition en PA-01 detecta error | Reintento automático de Power Automate | Email a Marian: "⚠️ Error al archivar" |
| Archivo ya existe (duplicado) | Power Automate verifica nombre antes de crear | Skip (idempotencia) | Sin alerta (comportamiento esperado) |
| Cierre Z no se genera | `systemHealthCheck` (cron 07:00) detecta ausencia | Alerta en `ControlOperativo` | Email a Marian a las 08:00 |
| Cadena SHA-256 rota | `verifyNightlyZClosing` detecta `isIntegrityVerified: false` | Cierre Z marcado como `closingStatus: INTEGRITY_FAILED` | Alerta crítica a Marian + gestor |

### D.4 Test de estrés: acceso en caso de inspección

Según PTD Kit Digital §13 (25 escenarios, 96% resiliencia):

| Escenario | Tiempo de acceso a la documentación |
| :--- | :--- |
| AEAT requiere ventas de enero-febrero | <15 minutos (CSVs en SharePoint `1_VENTAS/`) |
| Inspección de Trabajo requiere registro horario | <2 minutos (CSVs en `4_PERSONAL/`) |
| AEAT requiere libro registro de facturas | <15 minutos (CSV consolidado o regeneración desde `MovimientosCaja`) |
| Gestor necesita paquete trimestral | Ya consolidado en `6_ENTREGA_GESTOR/` |
| AEAT requiere Cierre Z de un día concreto | <5 minutos (CSV en `1_VENTAS/Cierres_Z/AAAA/MM/`) |

---

## BLOQUE E — GUÍA DE IMPLEMENTACIÓN PRÁCTICA

### E.1 Fases de implementación

| Fase | Tarea | Duración | Quién |
| :--- | :--- | :--- | :--- |
| **F1** | Crear sitio SharePoint + biblioteca + estructura de carpetas + permisos | 2 horas | Agente Digitalizador |
| **F2** | Implementar `backend/exports/exportService.js` en Wix Velo | 4 horas | Agente Digitalizador |
| **F3** | Añadir crons de export a `jobs.config` | 1 hora | Agente Digitalizador |
| **F4** | Probar envío de emails vía Resend (entorno Preview) | 1 hora | Agente Digitalizador |
| **F5** | Crear los 7 flujos Power Automate | 3 horas | Agente Digitalizador |
| **F6** | Probar end-to-end: Wix → email → Power Automate → SharePoint | 2 horas | Agente Digitalizador |
| **F7** | Crear Excel consolidado con tablas | 1 hora | Agente Digitalizador |
| **F8** | Invitar al gestor como usuario externo SharePoint (solo lectura) | 0,5 horas | Marian |
| **F9** | Formación a Marian: cómo reenviar facturas de gastos por email | 0,5 horas | Agente Digitalizador |
| **TOTAL** | | **~15 horas** | |

### E.2 Checklist de validación antes de producción

| Prueba | Criterio de éxito |
| :--- | :--- |
| Cierre Z se genera y envía por email | Email recibido en `gestion@` con adjunto CSV válido |
| Power Automate detecta el email | Flujo se dispara en <2 minutos |
| Archivo se crea en SharePoint | CSV presente en `1_VENTAS/Cierres_Z/2027/MM/` |
| CSV contiene hash y sequenceNumber | Verificación manual del contenido |
| CSV NO contiene PII de clientes | Verificación manual: sin nombres, emails ni teléfonos de clientes |
| Gestor accede en solo lectura | Gestor puede descargar pero no editar |
| Alba y Andrea NO acceden | Acceso denegado |
| Flujo de gastos manual funciona | Marian reenvía email con `[GASTO]` → PDF archivado |
| Paquete trimestral se genera | Día 10: carpeta `6_ENTREGA_GESTOR/` con todo el trimestre |
| Cadena SHA-256 preservada | `hash` del CSV coincide con `hash` del registro en `MovimientosCaja` |
| `traceId` presente en cada fila del CSV | Verificación manual |

### E.3 Rutina operativa de Marian (post-implementación)

| Tarea | Tiempo | Frecuencia |
| :--- | :--- | :--- |
| Reenviar facturas de proveedores a `gestion@` con asunto `[GASTO]` | ~10 min | Según llegan (2-4 al mes) |
| Descargar extracto bancario de Ibercaja y subir a SharePoint | ~3 min | 1 vez al mes (día 1-5) |
| Verificar que el Cierre Z del mes anterior está en SharePoint | ~2 min | 1 vez al mes (día 3) |
| Verificar checklist trimestral y enviar email al gestor | ~10 min | 4 veces al año (día 15 post-trimestre) |
| **TOTAL** | **~20 min/mes + 10 min/trimestre** | |

---

## ANEXO I — MATRIZ DE TRAZABILIDAD POR CAMPO

| Campo SSOT (Capa 1) | Colección origen | Proceso que lo genera | CSV de export que lo incluye | Carpeta Capa 3 destino | Norma que exige su conservación |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `sequenceNumber` | `MovimientosCaja` | `registerManualTransaction` / webhook eCom | `MOVIMIENTOS_CAJA` | `1_VENTAS/Movimientos/` | RD 1007/2023 (secuencia monótona) |
| `numSerieFactura` | `MovimientosCaja` | Asignación desde `CAJA_SEQ` | `MOVIMIENTOS_CAJA` | `1_VENTAS/Movimientos/` | RD 1619/2012 (correlativo) |
| `hash` | `MovimientosCaja` | `hashChain(prevHash, payload)` | `MOVIMIENTOS_CAJA` | `1_VENTAS/Movimientos/` | Ley 11/2021 (inalterabilidad) |
| `previousRecordHash` | `MovimientosCaja` | Enlace al registro anterior | `MOVIMIENTOS_CAJA` | `1_VENTAS/Movimientos/` | Ley 11/2021 (cadena) |
| `taxBase` | `MovimientosCaja` | Cálculo en `cajas.web.js` | `MOVIMIENTOS_CAJA` | `1_VENTAS/Movimientos/` | Ley 37/1992 (IVA) |
| `taxAmount` | `MovimientosCaja` | Cálculo en `cajas.web.js` | `MOVIMIENTOS_CAJA` | `1_VENTAS/Movimientos/` | Ley 37/1992 (IVA) |
| `tipoImpositivo` | `MovimientosCaja` | Enum AEAT | `MOVIMIENTOS_CAJA` | `1_VENTAS/Movimientos/` | Ley 37/1992 (IVA) |
| `movementType` | `MovimientosCaja` | Enum negocio | `MOVIMIENTOS_CAJA` | `1_VENTAS/Movimientos/` | PGC (clasificación) |
| `channelType` | `MovimientosCaja` | Enum negocio | `MOVIMIENTOS_CAJA` | `1_VENTAS/Movimientos/` | obligación de información sobre Bizum, si aplica; no implica reporte automático del proveedor |
| `paymentMethod` | `MovimientosCaja` | Enum negocio | `MOVIMIENTOS_CAJA` | `1_VENTAS/Movimientos/` | obligación de información sobre Bizum, si aplica; no implica reporte automático del proveedor |
| `transactionId` | `MovimientosCaja` | Idempotencia | `MOVIMIENTOS_CAJA` | `1_VENTAS/Movimientos/` | Trazabilidad |
| `traceId` | Transversal | UUID v4 | Todos los CSV | Todas las carpetas | Trazabilidad end-to-end |
| `closingHash` | `HistoricoCierresZ` | `verifyNightlyZClosing` | `CIERRE_Z` | `1_VENTAS/Cierres_Z/` | Ley 11/2021 |
| `isIntegrityVerified` | `HistoricoCierresZ` | Verificación cadena | `CIERRE_Z` | `1_VENTAS/Cierres_Z/` | Ley 11/2021 |
| `totalCash` / `totalCard` / `totalBizum` / `totalOnline` | `HistoricoCierresZ` | Agregación | `CIERRE_Z` | `1_VENTAS/Cierres_Z/` | RD 253/2025, solo si aplica; validar obligación y sujeto obligado |
| `totalTaxBase` / `totalTaxAmount` | `HistoricoCierresZ` | Agregación | `CIERRE_Z` | `1_VENTAS/Cierres_Z/` | Ley 37/1992 |
| `bookingId` | `CitasF2` | Wix Bookings V2 | `VENTAS_MENSUAL` | `1_VENTAS/Reservas/` | Trazabilidad |
| `bookingStatus` | `CitasF2` | Enum CMS | `VENTAS_MENSUAL` | `1_VENTAS/Reservas/` | Trazabilidad |
| `paymentStatus` | `CitasF2` | Enum CMS | `VENTAS_MENSUAL` | `1_VENTAS/Reservas/` | Trazabilidad |
| `totalAmount` | `CitasF2` | Importe del servicio | `VENTAS_MENSUAL` | `1_VENTAS/Reservas/` | Ley 37/1992 |
| `clockEventType` | `RegistrosHorariosStaff` | Enum negocio | `FICHAJES_SEMANAL` | `4_PERSONAL/Fichajes/` | RD 8/2019 |
| `recordedAt` | `RegistrosHorariosStaff` | Timestamp | `FICHAJES_SEMANAL` | `4_PERSONAL/Fichajes/` | RD 8/2019 |
| `staffName` | `RegistrosHorariosStaff` | `MapaStaff` | `FICHAJES_SEMANAL` | `4_PERSONAL/Fichajes/` | RD 8/2019 |
| `movementToken` | `MovimientosInventario` | Idempotencia | `INVENTARIO_MENSUAL` | `5_INVENTARIO/` | Trazabilidad |
| `movementType` | `MovimientosInventario` | Enum negocio | `INVENTARIO_MENSUAL` | `5_INVENTARIO/` | PGC (valoración) |
| `sku` | `MovimientosInventario` | Catálogo | `INVENTARIO_MENSUAL` | `5_INVENTARIO/` | PGC (valoración) |
| `quantityDelta` | `MovimientosInventario` | Variación | `INVENTARIO_MENSUAL` | `5_INVENTARIO/` | PGC (valoración) |

---

## ANEXO II — GLOSARIO DE ACRÓNIMOS

| Acrónimo | Significado |
| :--- | :--- |
| **SSOT** | Single Source of Truth — Fuente única de verdad |
| **CMS** | Content Management System — Wix CMS (MongoDB subyacente) |
| **M365** | Microsoft 365 Business Standard (licencia Kit Digital) |
| **RGPD** | Reglamento General de Protección de Datos (UE 2016/679) |
| **LOPDGDD** | Ley Orgánica de Protección de Datos y Garantía de Derechos Digitales (3/2018) |
| **PGC** | Plan General de Contabilidad (RD 1514/2007) |
| **AEAT** | Agencia Estatal de Administración Tributaria |
| **LGT** | Ley General Tributaria (58/2003) |
| **LSSI-CE** | Ley de Servicios de la Sociedad de la Información y Comercio Electrónico (34/2002) |
| **Veri*Factu** | Sistema de facturación obligatorio (Ley 11/2021, RD 1007/2023) |
| **PII** | Personally Identifiable Information — Datos personales identificables |
| **PCI-DSS** | Payment Card Industry Data Security Standard |
| **SPF** | Sender Policy Framework (autenticación de email) |
| **DKIM** | DomainKeys Identified Mail (firma de email) |
| **DMARC** | Domain-based Message Authentication, Reporting & Conformance |
| **CSV** | Comma-Separated Values — Formato de exportación |
| **ADR** | Architecture Decision Record — Registro de decisión arquitectónica |
| **RBAC** | Role-Based Access Control — Control de acceso basado en roles |
| **PA** | Power Automate (flujo) |
| **PTD** | Plan de Transformación Digital (Kit Digital) |

---

## CIERRE DEL DOSSIER

Este Dossier Técnico de Flujos End-to-End Capa 1 → Capa 3 documenta de forma exhaustiva:

1. **Qué datos se generan** en cada proceso del sitio Wix (intrínsecos de Wix Apps y del backend personalizado).
2. **Qué datos se trasladan** a Capa 3 y cuáles se excluyen (con justificación normativa).
3. **Cómo se trasladan** (patrón email estructurado → Power Automate → SharePoint).
4. **Qué normativa se cumple** durante el tránsito (Veri*Factu, PGC, RD 8/2019, RGPD, LGT, Código de Comercio).
5. **Cómo se implementa** (fases, checklist, rutina operativa de Marian).

El flujo garantiza que **Marian dedica menos de 20 minutos al mes** a la gestión documental, que **el gestor recibe un paquete completo y trazable cada trimestre**, y que **el sistema cumple con la totalidad de la normativa española vigente** a noviembre de 2026, incluyendo la preparación para Veri*Factu antes del plazo legal del 1 de julio de 2027.

---

*Dossier generado el 6 de noviembre de 2026. Basado en la Biblia SSOT v10.0, el Dossier Técnico Consolidado, el PTD Kit Digital (Secciones 7.5, 10, 11, 12, 19), el Anexo Biblia Migración, el Anexo Biblia por Wix, las Directrices de Desarrollo de Código, la documentación oficial de Wix Developers (noviembre 2026) y la normativa fiscal/laboral/contable española vigente.*