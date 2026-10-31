/*
 * MODULE: backend/internalConfig.js
 * VERSION: v5010.11-SSOT-RESTORED
 * Correcciones criticas aplicadas (depuracion 2026-10-19):
 * - Se restauran los exports eliminados por la edicion v5010.10 que rompieron
 *   TODOS los modulos dependientes (SyntaxError: does not provide an export
 *   named 'ROL_WEBSITE', etc.). Lista completa verificada contra los
 *   importadores reales de src/ (backend, pages, public y suites de tests).
 * - Se conservan los nombres publicos originales de las constantes.
 * - Se corrigen referencias BOOKING_STATUS.
 * - Se conservan los enums nativos Wix con guion bajo.
 * - Se corrige el identificador de Alba.
 * - Se corrige la plantilla de buildInvoiceNumber.
 */

export const ROL_WEBSITE = Object.freeze({
  ADMIN: "ADMIN",
  GESTION: "GESTION",
  ESTILISTA: "ESTILISTA",
});

export const STAFF = Object.freeze({
  IDS: Object.freeze([
    "e556070a-6d6a-402e-8422-11133033ea76",
    "07f7344f-e7e4-4c53-854b-47fd82ac8d40",
    "9b905bfd-1a09-485d-9273-a24a20dfe648",
  ]),
  RESOURCE_TO_DISPLAY: Object.freeze({
    "e556070a-6d6a-402e-8422-11133033ea76": "MARIAN MADRID",
    "07f7344f-e7e4-4c53-854b-47fd82ac8d40": "ANDREA STAFF",
    "9b905bfd-1a09-485d-9273-a24a20dfe648": "ALBA STAFF",
  }),
  WEBSITE_ROLE_BY_RESOURCE_ID: Object.freeze({
    "e556070a-6d6a-402e-8422-11133033ea76": ROL_WEBSITE.ADMIN,
    "07f7344f-e7e4-4c53-854b-47fd82ac8d40": ROL_WEBSITE.ESTILISTA,
    "9b905bfd-1a09-485d-9273-a24a20dfe648": ROL_WEBSITE.ESTILISTA,
  }),
});

// Nombre por defecto cuando la identidad staff no se puede resolver via
// Bookings Staff API (staff.js v9, PEND-MAP-01).
export const STAFF_DEFAULT_NAME = "STAFF";

export const BUSINESS_COLLECTIONS = Object.freeze({
  CAJA_ACTUAL: "CajaActual",
  CITAS_F2: "CitasF2",
  COMPLEMENTOS_CATALOGO: "ComplementosCatalogo",
  CONTROL_OPERATIVO: "ControlOperativo",
  DATOS_FISCALES: "DatosFiscales",
  HISTORICO_CIERRES_Z: "HistoricoCierresZ",
  LIBRO_ASIENTOS_CONTABLES_DETALLE: "LibroAsientosContablesDetalle",
  INVENTARIO_STOCK_VENTA: "InventarioStockVenta",
  MOVIMIENTOS_CAJA: "MovimientosCaja",
  REGISTROS_HORARIOS_STAFF: "RegistrosHorariosStaff",
  SERVICIOS_CATALOGO: "ServiciosCatalogo",
});

// FASE3 (8-en-1, ADR-05): las colecciones de soporte/lock/cache fueron
// absorbidas por ControlOperativo. CERO-ALIAS (v13.0): los alias singulares
// MOVIMIENTO_CAJA / MOVIMIENTO_INVENTARIO y las claves sin consumidores
// PROVEEDORES_LISTA / SERVICIOS_CATALOGO quedan ERRADICADOS del SSOT; el
// nombre canonico plural vive en BUSINESS_COLLECTIONS (MOVIMIENTOS_CAJA) y
// OPERATIONAL_COLLECTIONS (MOVIMIENTOS_INVENTARIO). CONTROL_OPERATIVO se
// expone deliberadamente en ambos grupos con el mismo valor (alias
// intencional documentado en unit.testRunner allowedOverlaps).
export const OPERATIONAL_COLLECTIONS = Object.freeze({
  CONTROL_OPERATIVO: "ControlOperativo",
  MOVIMIENTOS_INVENTARIO: "MovimientosInventario",
});

// ITEM_NATURE canonico v12.0+ (SSOT-08). Los valores legacy observados en la
// exportacion real del CMS (SERVICIO_PROPIO, PRODUCTO_VENTA, PRODUCTO_USO,
// GASTO_FIJO) se aceptan en lectura via data.js VALID_ITEM_NATURES pero NO
// forman parte del enum canonico de escritura.
export const ITEM_NATURE = Object.freeze({
  SERVICIO: "SERVICIO",
  PRODUCTO: "PRODUCTO",
});

export const FORBIDDEN_COLLECTIONS = Object.freeze([
  "AsientosContables",
  "EventosSistemaFacturacion",
  "FacturasRecibidas",
  "ConfiguracionFiscal",
  "LibroRegistroFacturasRecibidas",
  "PlanCuentasContables",
  "CategoriasServicio",
  "LibroRegistroFacturasExpedidas",
]);

export const RECORD_TYPE = Object.freeze({
  TERCERO: "TERCERO",
  CONFIG_SISTEMA: "CONFIG_SISTEMA",
});
/* CERO-DEUDA H-03/H-04 (2026-10-20): eliminados RECORDTYPECONFIGSISTEMA y el
   alias paraguas COLLECTIONS ({...BUSINESS, ...OPERATIONAL}). Cero consumidores
   en src/. SSOT canonicos: RECORD_TYPE y los grupos BUSINESS_COLLECTIONS /
   OPERATIONAL_COLLECTIONS por separado. */

export const API = Object.freeze({
  STAFF_RESOURCE_TYPE_ID: "1cd44cf8-756f-41c3-bd90-3e2ffcaf1155",
  MARIAN_MANAGEMENT_RESOURCE_ID: STAFF.IDS[0],
});

export const SDK_CONFIG = Object.freeze({
  TZ: "Europe/Madrid",
  LOCATION_ID: "7a12abfd-bf30-4847-bcdf-00dc573d4802",
  LOCATION_TYPES: Object.freeze({
    TIME_SLOTS: "BUSINESS",
    BOOKINGS_WRITER: "OWNER_BUSINESS",
  }),
  M365: Object.freeze({ ENABLED: false }),
  ACCOUNTING: Object.freeze({ ENABLED: false }),
  SYNC_BOOKINGS_SERVICES_ENABLED: false,
});

export const BOOKING_STATUS = Object.freeze({
  CREATED: "CREATED",
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  DECLINED: "DECLINED",
  WAITING_LIST: "WAITING_LIST",
  UPDATED: "UPDATED",
  CANCELED: "CANCELED",
  REFUNDED: "REFUNDED",
});

/* CERO-DEUDA H-05 (2026-10-20): INACTIVE_BOOKING_STATUSES eliminado. Cero
   consumidores en src/; los filtros de estados inactivos se declaran inline
   donde son necesarios (unica fuente de verdad: BOOKING_STATUS + dominio
   CITAS_BOOKING_STATUS). */

export const PAYMENT_STATUS = Object.freeze({
  UNDEFINED: "UNDEFINED",
  NOT_PAID: "NOT_PAID",
  // FASE1-P0 (MATRIZ alias F): el alias UNPAID queda ERRADICADO. El valor
  // canonico es NOT_PAID; CITAS_PAYMENT_STATUS.UNPAID es dominio de lectura
  // legacy del CMS y no sustituye este enum.
  PENDING_PAYMENT: "PENDING_PAYMENT",
  PENDING_LEDGER: "PENDING_LEDGER",
  PAID: "PAID",
  PARTIALLY_PAID: "PARTIALLY_PAID",
  REFUNDED: "REFUNDED",
  PARTIALLY_REFUNDED: "PARTIALLY_REFUNDED",
  EXEMPT: "EXEMPT",
});

/* ===========================================================================
 * BLOQUE RESTAURADO (v5010.11): constantes consumidas por los modulos de
 * src/. Valores verificados contra los usos reales (comparaciones con
 * literales del ledger fiscal, espejo publico mmUtils.js, enums citados por
 * validation.js/cajas.web.js/crons.js y fixtures de las suites node --test).
 * =========================================================================*/

// Identidad de apps Wix usada por events.js / citasManager.web.js /
// bookingSaga.js al filtrar webhooks y crear bookings.
export const APP_IDS = Object.freeze({
  BOOKINGS: "bookings",
  STORES: "215238eb-22a5-4c36-9e7b-e7c08025e04e",
});

// Wix eCommerce catalog IDs are GUIDs and are distinct from webhook app IDs.
export const WIX_CATALOG_APP_IDS = Object.freeze({
  BOOKINGS: "13d21c63-b5ec-5912-8397-c3a5ddb27a97",
});

// CERO-DEUDA ZC-07: export JWT eliminado (generateJWT/verifyJWT ya no
// existen en securityEngine.js; no hay consumidores de config JWT).

// Timeout de busqueda de slots (espejo fiel de public/mmUtils.js SLOT_SEARCH,
// BIBLIA 3.2; MINUTOS_TOLERANCIA citado literalmente por bookingCore.js).
export const SLOT_SEARCH = Object.freeze({
  DIAS_LIMITE: 14,
  MINUTOS_TOLERANCIA: 120,
  MINUTOS_MAX_HUECO_DUAL: 120,
});

// Parametros de concurrencia/transaccion (bookingCore.js BCORE-*, crons.js).
export const CONCURRENCY = Object.freeze({
  DEFAULT_DURATION_MIN: 60,
  MS_LATIDO: 15000,
  MS_TTL_MUTEX: 300000,
  TRANSACTION_LEASE_MS: 300000,
  TRANSACTION_MAX_WAIT_MS: 3000,
  TRANSACTION_POLL_BASE_MS: 250,
});

// Singleton ids de caja (cajas.web.js ALN-04, eventLog.js).
export const SINGLETONS = Object.freeze({
  CAJA_PRINCIPAL: "CAJA_PRINCIPAL",
  CAJA_SEQ: "CAJA_SEQ",
});

// Enum de estados de caja. ALN-05: los miembros canonicos v12 son
// ABIERTA/CERRADA; OPEN/CLOSED se conservan como alias legacy.
export const CASH_REGISTER_STATUS = Object.freeze({
  ABIERTA: "ABIERTA",
  CERRADA: "CERRADA",
  OPEN: "ABIERTA",
  CLOSED: "CERRADA",
});

// Tipos de cita internos (ledger CitasF2). CERO-ALIAS v13.0: el dominio de
// persistencia CitasF2 usa EXACTAMENTE el mismo vocabulario canonico que el
// plano interno PAYMENT_STATUS/BOOKING_STATUS (ingles, mayusculas, sin
// traducciones es). Mapear dos enums distintos sobre la misma coleccion era
// una divergencia SSOT real: bookingCore escribia PENDING/NOT_PAID mientras
// las proyecciones leian ESPANOL -> filas invisibles para cualquier guard.
// Ahora hay UN solo estado canonicoy _toCms* son identity-safe.
export const CITAS_BOOKING_STATUS = Object.freeze({
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  // UNIT-ENUM-01 fix: el SDK BOOKING_STATUS.REFUNDED debe traducirse a un
  // estado CMS canonico. Sin esta clave, _toCmsBookingStatus("REFUNDED")
  // caia al fallback literal y violaba el contrato de pertenencia al enum.
  REFUNDED: "REFUNDED",
  NO_SHOW: "NO_SHOW",
});

export const CITAS_PAYMENT_STATUS = Object.freeze({
  NOT_PAID: "NOT_PAID",
  PENDING_PAYMENT: "PENDING_PAYMENT",
  PENDING_LEDGER: "PENDING_LEDGER",
  PAID: "PAID",
  PARTIALLY_PAID: "PARTIALLY_PAID",
  REFUNDED: "REFUNDED",
  PARTIALLY_REFUNDED: "PARTIALLY_REFUNDED",
  EXEMPT: "EXEMPT",
  UNDEFINED: "UNDEFINED",
});

// Tipo de booking (SIMPLE / DUAL F1 / DUAL F2). SSOT-KEYFIELD v13 CitasF2
// Apartado 2 (decisión de usuario, cierra ADR P2): canones FISICOS en la
// coleccion son DUAL_F1 / DUAL_F2. Las variantes sin guion (DUALF1/DUALF2)
// quedan ERRADICADAS como ID legacy: se promueven al canon en toda escritura
// via normalizeBookingType (frontera unica de entrada).
export const BOOKING_TYPE = Object.freeze({
  SIMPLE: "SIMPLE",
  DUAL_F1: "DUAL_F1",
  DUAL_F2: "DUAL_F2",
});

export function normalizeBookingType(value) {
  const s = String(value == null ? "" : value).trim().toUpperCase();
  // ID legacy erradicada: DUALF1/DUALF2 -> canon con guion.
  if (s === "DUALF1") return BOOKING_TYPE.DUAL_F1;
  if (s === "DUALF2") return BOOKING_TYPE.DUAL_F2;
  if (s === "DUAL-F1") return BOOKING_TYPE.DUAL_F1;
  if (s === "DUAL-F2") return BOOKING_TYPE.DUAL_F2;
  if (s === BOOKING_TYPE.DUAL_F1 || s === BOOKING_TYPE.DUAL_F2 || s === BOOKING_TYPE.SIMPLE) {
    return s;
  }
  return s || BOOKING_TYPE.SIMPLE;
}

export function isDualBookingType(value) {
  const t = normalizeBookingType(value);
  return t === BOOKING_TYPE.DUAL_F1 || t === BOOKING_TYPE.DUAL_F2;
}

// Canal de origen de la operacion (events.js, validaciones).
export const CHANNEL_TYPE = Object.freeze({
  ONLINE: "ONLINE",
  PRESENCIAL: "PRESENCIAL",
});

// Metodos de pago del ledger. Miembros EFECTIVO/TARJETA/BIZUM verificados en
// site.flows.e2e (paymentMethod 'EFECTIVO'); TRANSFERENCIA admitido por el
// runner legado; WIX_PAYMENTS por citasManager ALN-06/CM5-05.
// FASE1-P0 (CAJA-01 SSOT): alias legacy "ONLINE" ERRADICADO del enum. El canon
// de pago online es WIX_PAYMENTS; la frontera de escritura (cajas.web) traduce
// "ONLINE" -> WIX_PAYMENTS para payloads/crons legacy, y el canal "ONLINE"
// sigue existiendo como dato dimensional en CHANNEL_TYPE (no es metodo de pago).
export const PAYMENT_METHOD = Object.freeze({
  EFECTIVO: "EFECTIVO",
  TARJETA: "TARJETA",
  BIZUM: "BIZUM",
  TRANSFERENCIA: "TRANSFERENCIA",
  WIX_PAYMENTS: "WIX_PAYMENTS",
  TARJETA_REGALO: "TARJETA_REGALO",
});

// Tipos de movimiento del ledger de caja (cajas.web.js). Default historico:
// "VENTA" (cajas.web.js L544).
export const MOVEMENT_TYPE = Object.freeze({
  VENTA: "VENTA",
  VENTA_ONLINE: "VENTA_ONLINE",
  VENTA_TARJETA_REGALO: "VENTA_TARJETA_REGALO",
  CANJE_TARJETA_REGALO: "CANJE_TARJETA_REGALO",
  ANTICIPO: "ANTICIPO",
  REEMBOLSO: "REEMBOLSO",
  DEVOLUCION: "DEVOLUCION",
  DEVOLUCION_SERVICIO: "DEVOLUCION_SERVICIO",
  PROPINA: "PROPINA",
  AJUSTE: "AJUSTE",
});

// Tipos de movimiento de inventario (inventario.web.js, validation.js).
export const INVENTORY_MOVEMENT_TYPE = Object.freeze({
  ENTRADA: "ENTRADA",
  SALIDA: "SALIDA",
  COMPRA: "COMPRA",
  VENTA: "VENTA",
  MERMA: "MERMA",
  AJUSTE: "AJUSTE",
  DEVOLUCION: "DEVOLUCION",
});

// Signo de magnitudes (validation.js expectedInventoryMagnitude).
export const MAGNITUDE = Object.freeze({
  POSITIVE: "POSITIVE",
  NEGATIVE: "NEGATIVE",
  NEUTRAL: "NEUTRAL",
});

// Estados del registro de control operativo (ControlOperativo, ADR-05).
export const CONTROL_STATUS = Object.freeze({
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  OPEN: "OPEN",
  EXECUTED: "EXECUTED",
  COMPLETED: "COMPLETED",
  CLOSED: "CLOSED",
  RESOLVED: "RESOLVED",
  FAILED: "FAILED",
});

// Tipos de registro de ControlOperativo.
// La Biblia SSOT v10.0 entregada exige RATE_LIMIT persistido en esta coleccion.
// Las referencias a una supuesta v13.0 en comentarios historicos no tienen
// un documento normativo v13.0 en el repositorio ni entre las fuentes aportadas;
// por tanto no prevalecen sobre la SSOT aprobada disponible.
// DISPLAY_TOKEN se conserva por su productor activo en reservas.web.js.
export const CONTROL_TYPE = Object.freeze({
  ALERT: "ALERT",
  COMPENSATION: "COMPENSATION",
  DAYS_CACHE: "DAYS_CACHE",
  DISPLAY_TOKEN: "DISPLAY_TOKEN",
  DUAL_CACHE: "DUAL_CACHE",
  IDEMPOTENCY: "IDEMPOTENCY",
  SLOT_LOCK: "SLOT_LOCK",
  RATE_LIMIT: "RATE_LIMIT",
  SYSTEM_FLAG: "SYSTEM_FLAG",
  WEBHOOK_EVENT: "WEBHOOK_EVENT",
});

// Estados de proyeccion del log fiscal (eventLog.js).
export const PROJECTION_STATUS = Object.freeze({
  OK: "OK",
  ERROR: "ERROR",
  PENDIENTE: "PENDIENTE",
});

// Tipos de evento del log fiscal (eventLog.js, events.js).
export const EVENT_TYPE = Object.freeze({
  VENTA_LINEA: "VENTA_LINEA",
  COMPRA_LINEA: "COMPRA_LINEA",
  RECTIFICATIVA: "RECTIFICATIVA",
  AJUSTE: "AJUSTE",
  MOV_STOCK: "MOV_STOCK",
  CIERRE_Z: "CIERRE_Z",
});

// Rol fiscal del tercero (Veri*factu).
export const FISCAL_ROLE = Object.freeze({
  EMISOR: "EMISOR",
  RECEPTOR: "RECEPTOR",
});

// Tipos de tercero.
export const THIRD_PARTY_TYPE = Object.freeze({
  CLIENTE: "CLIENTE",
  STAFF: "STAFF",
  PROVEEDOR: "PROVEEDOR",
});

// Tipos de factura SII (events.js usa F1/F2/R1; audit.e2e admite serie completa).
export const TIPO_FACTURA = Object.freeze({
  F1: "F1",
  F2: "F2",
  F3: "F3",
  R1: "R1",
  R2: "R2",
  R3: "R3",
  R4: "R4",
  R5: "R5",
});

// Tipos de compensacion del saga (bookingSaga.js).
export const COMPENSATION_KIND = Object.freeze({
  CANCEL_BOOKING: "CANCEL_BOOKING",
});

export const COMPENSATION_STATUS = Object.freeze({
  PENDING: "PENDING",
  EXECUTED: "EXECUTED",
  FAILED: "FAILED",
});

// Motivos de correccion contable (events.js).
export const CORRECTION_REASON = Object.freeze({
  NUMERO_SERIE: "NUMERO_SERIE",
  OTRAS: "OTRAS",
});

// Tipos de fichaje (horario.web.js, validation.js).
export const CLOCK_EVENT_TYPE = Object.freeze({
  ENTRADA: "ENTRADA",
  SALIDA: "SALIDA",
  PAUSA_INICIO: "PAUSA_INICIO",
  PAUSA_FIN: "PAUSA_FIN",
});

export const CLOCK_REGISTERED_BY = Object.freeze({
  SELF: "SELF",
  MANAGER: "MANAGER",
});

// Tipos de registro horario (horario.web.js).
export const RECORD_TYPE_HORARIOS = Object.freeze({
  REGULAR: "REGULAR",
  AJUSTE: "AJUSTE",
});

// Nombres de campos de RegistrosHorariosStaff (horario.web.js F.*).
export const REGISTROS_HORARIOS_FIELDS = Object.freeze({
  RESOURCE_ID: "resourceId",
  MEMBER_ID: "memberId",
  STAFF_NAME: "staffName",
  RECORDED_AT: "recordedAt",
  RECORDED_TIME: "recordedTime",
  DAY_KEY: "dayKey",
  MONTH_KEY: "monthKey",
  CLOCK_EVENT_TYPE: "clockEventType",
  RECORD_TYPE: "recordType",
  REGISTERED_BY: "registeredBy",
  REGISTERED_BY_MEMBER_ID: "registeredByMemberId",
  ADJUSTMENT_REASON: "adjustmentReason",
  DEVICE_IP_ADDRESS: "deviceIpAddress",
  META: "meta",
  TRACE_ID: "traceId",
  SIGNATURE: "signature",
});

// Campos logicos de booking normalizados (bookingCore.js / bookingSaga.js /
// citasManager.web.js / events.js).
// SSOT-KEYFIELD-01 (2026-10-20, Matriz CitasF2 Apartado 2): la clave canonica
// del estado interno en CitasF2 es "bookingStatus"; "status" queda ERRADICADO
// como alias legacy a eliminar. Se anade CASH_MOVEMENT_ID (FK MovimientosCaja)
// y ORDER_ID, consumidos por citasManager.web.js via BOOKING_FIELDS.
// v14: miembros CASH_MOVEMENT_ID y ORDER_ID erradicados (0 consumidores
// verificados por grep; el SSOT Apartado 1 los documenta como campos de
// coleccion, pero ningun writer/reader del codigo activo los referencia).
// MATRIZ v15 Bloque 2 (campos eliminados del CMS CitasF2): staffResourceId,
// startDate y endDate quedan ERRADICADOS del contrato (duplicaban resourceId,
// slotStart y slotEnd). En CitasF2 solo existe resourceId.
export const BOOKING_FIELDS = Object.freeze({
  BOOKING_ID: "bookingId",
  BOOKING_TYPE: "bookingType",
  CATALOG_ID: "catalogId",
  CONTACT_DETAILS: "contactDetails",
  DATE_YMD: "dateYmd",
  META: "meta",
  PAIR_TOKEN: "pairToken",
  PAYMENT_STATUS: "paymentStatus",
  RESOURCE_ID: "resourceId",
  REVISION: "revision",
  SCHEDULE_ID: "scheduleId",
  SERVICE_ID: "serviceId",
  SLOT_END: "slotEnd",
  SLOT_START: "slotStart",
  STATUS: "bookingStatus",
  THIRD_PARTY_ID: "thirdPartyId",
  TOTAL_AMOUNT: "totalAmount",
  TRACE_ID: "traceId",
});

// SSOT-KEYFIELD-02 / v14 (Matriz MovimientosCaja Apartado 2, decision de
// usuario 2026-10-20): el contrato vivo de claves del ledger son las literales
// canonicas AEAT/SSOT escritas directamente por los escritores
// (numSerieFactura, fechaExpedicionFactura, totalAmount, recordHash, ...) y el
// mapa unico MOVEMENT_LEGACY_READ_ALIASES de abajo. El antiguo espejo
// MOVEMENT_FIELDS quedo ERRADICADO por codigo muerto (0 consumidores verificados
// por grep; duplicaba literales ya presentes en los writers).

// =============================================================================
// SSOT-KEYFIELD-02 (Matriz MovimientosCaja, Apartado 2): mapa canon -> aliases
// legacy tolerados SOLO en lectura de documentos historicos pre-migracion.
// Fuente unica de verdad para los helpers de lectura dual (data.js y
// cajas.web.js comparten este contrato; cero duplicacion de listas).
// JAMAS usar las claves alias en escrituras nuevas: prohibidas por
// MovimientosCaja_beforeInsert via MOVEMENT_LEGACY_WRITE_FIELDS.
// =============================================================================
export const MOVEMENT_LEGACY_READ_ALIASES = Object.freeze({
  // MATRIZ v15 Bloque 1 apartado 5 (MovimientosCaja) + decision de usuario:
  // amount y totalAmount COEXISTEN como claves canonicas propias hasta cerrar
  // el ADR de la formula fiscal (amount = importe base; totalAmount = total
  // cobrado con impuestos). Ninguna es alias de la otra: no se promueven ni
  // destruyen entre si. "importeTotal" sigue siendo alias legacy de lectura.
  // Clave canonica "amount" propia (no figuran en este mapa: es clave SSOT,
  // no alias); solo sus literales legacy se toleran en lectura historica.
  amount: ["importe", "baseImponible"],
  totalAmount: ["importeTotal"],
  numSerieFactura: ["invoiceNumber", "numTicketFactura"],
  fechaExpedicionFactura: ["invoiceIssueDate"],
  taxBase: ["baseImponibleOImporteNoSujeto", "taxableBaseOrNonSubjectAmount", "taxableAmount"],
  // MATRIZ v15 Bloque 2 (campos eliminados): cuotaTotal queda ERRADICADA del
  // ledger; la cuota fiscal canónica es taxAmount. Los docs históricos con
  // cuotaTotal se leen via este contrato de tolerancia (nunca se reescriben).
  taxAmount: ["cuotaRepercutida", "cuotaIva"],
  tipoImpositivo: ["taxRate", "tasaIva"],
  tipoFactura: ["invoiceType", "claveRegistroFactura"],
  nifEmisor: ["issuerTaxId"],
  nifDestinatario: ["recipientTaxId", "nifTercero"],
  recipientLegalName: ["nombreRazonDestinatario", "razonSocialTercero"],
  claveRegimen: ["regimeKey"],
  calificacionOperacion: ["operationClassification"],
  operacionExenta: ["exemptOperation"],
  inversionSujetoPasivo: ["reverseCharge"],
  irpfWithholdingAmount: ["importeRetencionIRPF"],
  surchargeAmount: ["cuotaRecargoEquivalencia", "importeRecargoEquivalencia"],
  previousInvoiceId: ["idFacturaAnterior", "idFacturaRectificada"],
  tipoRectificativa: ["correctionType"],
  fechaOperacion: ["operationDate", "diaKey"],
  recordTimestamp: ["registeredAt", "fechaHoraHusoGenRegistro"],
  operationDescription: ["concept", "concepto", "descripcionOperacion", "description"],
  payloadFiscal: ["fiscalPayload"],
  desgloseDetallado: ["detailedBreakdown", "desgloseImpuestos"],
  linkedBookingIds: ["reservaIdVinculada", "reservationIdLinked"],
  movementType: ["tipoMovimiento"],
  paymentMethod: ["medioPago"],
  // MATRIZ v15 Bloque 2 (campos eliminados): recordHash queda ERRADICADA como
  // clave fisica de MovimientosCaja; la huella canónica del dominio caja/
  // fiscal es "hash". El alias NO se tolera en lectura: el hook promueve
  // docs históricos a "hash" en su próximo update autorizado y los lectores
  // usan readMovementHash (clave directa). Dominio contable: recordHash sigue
  // siendo canónico (LIBRO_LEGACY_WRITE_FIELDS); por dominio, no duplicidad.
  hash: ["currentRecordHash", "hashCadena", "huella"],
  operationNature: ["naturalezaOperacion"],
  recordSource: ["origen"],
});

// Lista plana alias->canon derivada del mapa anterior (inversion). Unica
// fuente para readMovementField y para la normalizacion destructiva del hook
// MovimientosCaja_beforeInsert; agregar un alias al mapa basta para que
// lectura dual, normalizacion y guardia de coherencia lo conozcan (cero
// listas paralelas). Los escritores internos (POS/cajas) entregan claves de
// dominio (invoiceNumber, taxRate, ...); el hook las PROMUEVE a su canon SSOT
// antes de persistir: ningun alias sobrevive al ledger.
export const MOVEMENT_ALIAS_TO_CANON = Object.freeze(
  Object.entries(MOVEMENT_LEGACY_READ_ALIASES).reduce((acc, [canon, aliases]) => {
    for (const a of aliases) acc[a] = canon;
    return acc;
  }, {})
);

// Normalizacion destructiva de entrada (unica implementacion, compartida por
// el motor fiscal eventLog.registrarEventoEconomico y el hook
// data.MovimientosCaja_beforeInsert — SSOT-KEYFIELD-02 / HOOK-CAJA-06):
// promueve cada alias de su dominio al valor canonico SSOT y elimina el
// alias del documento. Reglas:
//   - canon presente + alias igual  -> se elimina el alias (idempotente).
//   - canon presente + alias distinto -> prevalece el valor canonico.
//   - solo alias                     -> se promueve a la clave canonica.
// Despues de esta funcion el objeto NO contiene ninguna clave legacy del
// dominio MovimientosCaja. Devuelve el mismo objeto (mutacion controlada en
// copias locales del caller).
export function normalizeMovementKeys(item) {
  if (!item || typeof item !== "object") return item;
  // MATRIZ v15 (recordHash ERRADICADA del ledger): migracion explicita de
  // docs historicos que aun entregan recordHash como huella de caja. Se
  // promueve ANTES del mapa de aliases porque recordHash ya no figura en el
  // contrato de lectura (erradicacion total, sin tolerancia pasiva).
  if ("recordHash" in item) {
    const legacyVal = item.recordHash;
    delete item.recordHash;
    if (legacyVal !== undefined && legacyVal !== null && legacyVal !== "" &&
        (item.hash === undefined || item.hash === null || item.hash === "")) {
      item.hash = legacyVal;
    }
  }
  for (const [alias, canonicalKey] of Object.entries(MOVEMENT_ALIAS_TO_CANON)) {
    if (!(alias in item)) continue;
    const aliasVal = item[alias];
    delete item[alias];
    if (aliasVal === undefined || aliasVal === null || aliasVal === "") continue;
    const canonVal = item[canonicalKey];
    if (canonVal === undefined || canonVal === null || canonVal === "") {
      item[canonicalKey] = aliasVal;
    }
  }
  return item;
}

// CERO-DEUDA ZC-07: contabilidad.js eliminado (modulo declarado DEAD CODE
// por la BIBLIA v5010.1, 0 importadores verificados con grep; MovimientosCaja
// es el SSOT fiscal unico y la proyeccion contable no tenia escritor activo).
// Mapa de cuentas PGC (Plan General Contable español, EHA/1609/2007).
// Códigos canónicos de 6 dígitos exigidos por el SII/AEAT en la proyección
// contable. Consumido por la auditoría E2E (CUENTAS_PGC_CANONICAS) y por
// cualquier escritor de asientos; fuente única de verdad — no duplicar
// literales de cuenta fuera de este mapa.
export const ACCOUNTING_ACCOUNT = Object.freeze({
  CASH: "570000",        // (570) Caja, e.
  BANKS: "572000",       // (572) Bancos c/c
  SUPPLIERS: "400000",   // (400) Proveedores
  CLIENTS: "430000",     // (430) Clientes
  SERVICE_REVENUE: "705000", // (705) Prestaciones de servicios
  VAT_OUTPUT: "477000",  // (477) H.P. IVA repercutido
  VAT_INPUT: "472000",   // (472) H.P.C. IVA soportado
});

// Tipos impositivos IVA Espana (rigor fiscal Ley 28/2014 RDL).
export const IVA_RATES = Object.freeze({
  GENERAL: 0.21,
  REDUCIDO: 0.10,
  SUPERREDUCIDO: 0.04,
  CERO: 0,
});

// Patron GUID canonico (VAL-R3-05: SSOT unico, validation.js/staff.js).
const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidGuid(value) {
  return typeof value === "string" && GUID_REGEX.test(value.trim());
}

/* CERO-DEUDA H-06 (2026-10-20): buildInvoiceNumber eliminado. Cero consumidores
   en src/; la numeracion fiscal real vive en fiscalDocuments.web.js. Si algun
   consumidor futuro la necesita, renace junto a el, no "por si acaso". */

