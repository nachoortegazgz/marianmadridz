# Auditoría de persistencia operativa — lectura Wix CMS y fuentes nativas

**Proyecto:** Marian Madrid · siteId `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Fecha de lectura:** 2026-11-28  
**Modo:** solo lectura; cero mutaciones  
**Estado del sitio:** Draft · Wix Classic Editor · Velo habilitado  
**Resultado:** NO CONFORME para afirmar persistencia completa de todas las operaciones  
**Alcance:** 12 colecciones propias NATIVE, inventario de colecciones Wix, Bookings Reader V2, eCommerce Orders y Order Transactions, y revisión estática de writers en `main`.

> Esta auditoría acredita el estado observado en la lectura indicada. No acredita que el código de GitHub sea exactamente el código instalado en Wix Editor ni que el sitio tenga aceptación E2E/Runtime. Los registros anteriores al despliegue oficial de producción de 2027 se consideran sintéticos según la directriz del proyecto; no representan ventas, cobros o obligaciones reales.

## 1. Dictamen

No se puede afirmar que el sitio genere y registre todos los detalles de todas las operaciones. Hay brechas verificadas en la persistencia TPV, fiscal, contable, laboral, cierres, recuperación de pagos y sincronización de reservas duales.

El sitio está en estado Draft. La lectura fue exclusivamente observacional. No se crearon operaciones, no se reinyectaron webhooks, no se corrigieron proyecciones y no se tocaron caja, pagos, pedidos ni reservas.

## 2. Alcance y método

1. Se obtuvo contexto del sitio: Draft, Wix Classic Editor, Velo habilitado, zona horaria Europe/Madrid y moneda EUR.
2. Se enumeraron 41 colecciones del sitio.
3. Se consultaron las 12 colecciones propias `collectionType=NATIVE`, sus esquemas y registros actuales, con lectura paginada.
4. Se consultaron las fuentes autoritativas de Bookings mediante Bookings Reader V2 y de pedidos/pagos mediante eCommerce Orders y Order Transactions.
5. Se compararon las proyecciones propias con las fuentes nativas cuando existe correspondencia contractual.
6. Se inspeccionaron los writers y validadores de `main`.

Algunas colecciones Wix App no aceptan la consulta genérica CMS utilizada (límites de paginación distintos o error del driver). Para las fuentes operativas relevantes se usaron las APIs específicas de Bookings y eCommerce. No se declara auditada la totalidad de las 41 colecciones Wix App a nivel de cada campo.

## 3. Inventario de colecciones propias NATIVE

| Colección | Items | Hallazgo |
|---|---:|---|
| `CajaActual` | 1 | Proyección ABIERTA con diferencias internas frente al ledger actual |
| `CitasF2` | 12 | 6 proyecciones con estado distinto al booking nativo |
| `ComplementosCatalogo` | 36 | Sin ausencias de campos CMS required |
| `ControlOperativo` | 81 | 3 recuperaciones pendientes; cero marcadores de cancelación Bookings |
| `HistoricoCierresZ` | 1 | 1 registro incompleto |
| `LibroAsientosContablesDetalle` | 3 | Los 3 son SIMULATED_ONLY; ninguno es asiento PGC completo |
| `MapaStaff` | 5 | No existe singleton CONFIG_SISTEMA_FISCAL |
| `MovimientosCaja` | 5 | Los 5 son sintéticos y todos incompletos frente al esquema CMS |
| `RegistroIntegracion` | 3 | Los 3 están NOT_SENT |
| `RegistrosHorariosStaff` | 0 | Sin fichajes |
| `ServiciosCatalogo` | 95 | Catálogo presente |
| `TransaccionesTPV` | 0 | Sin intenciones comerciales TPV persistidas |

## 4. Hallazgos críticos por dominio

### 4.1 Caja y ledger físico — NO CONFORME

`MovimientosCaja` contiene 5 registros. Todos son sintéticos y proceden de flujos funcionales/simulados anteriores a 2027.

Ausencias observadas contra los 19 campos marcados required en el esquema CMS:

| Campo | Registros que lo omiten |
|---|---:|
| `hash` | 5/5 |
| `numSerieFactura` | 5/5 |
| `sequenceNumber` | 5/5 |
| `previousRecordHash` | 5/5 |
| `recordTimestamp` | 5/5 |
| `schemaVersion` | 5/5 |
| `operationDescription` | 5/5 |
| `staffResourceId` | 5/5 |
| `tipoFactura` | 5/5 |
| `fechaExpedicionFactura` | 5/5 |
| `tipoImpositivo` | 5/5 |
| `fiscalPeriod` | 5/5 |
| `transactionId` | 1/5 |
| `movementType`, `totalAmount`, `channelType` | 2/5 cada uno |

El código actual contiene un contrato diferenciado para `recordSource=TPV_LEDGER` en `MovimientosCaja_beforeInsert` y `assertMovimientosCajaRequiredFields`: exige identidad, secuencia, timestamp, hash, metadatos y envelope TPV, en lugar de todos los campos específicos de factura. Sin embargo, el esquema físico Wix sigue marcando 19 campos como required. Esta diferencia de contrato debe validarse con un insert sintético aislado antes de aceptar el writer en Runtime; la lectura actual no demuestra que un nuevo registro TPV pueda superar simultáneamente CMS y hook.

`CajaActual` tiene un único registro ABIERTA con `snapshotSource=MOVIMIENTOS_CAJA_RECONCILIADOS`, `cashAmount=320`, `cardAmount=25`, `expectedCash=320`, `countedCash=0` y `difference=0`. Los 5 movimientos actuales suman 40 en CASH y 25 en CARD. El efectivo de la proyección no coincide con los movimientos observados y el arqueo de 0 con diferencia 0 tampoco permite acreditar cuadre. Es una proyección antigua/sintética; no se ha modificado.

### 4.2 Cierres Z — NO CONFORME

`HistoricoCierresZ` contiene un registro `SIMULATED` con `recordDomain=TPV_CUSTOM_QA`. Le faltan cuatro campos required:
- `fiscalPeriod`
- `totalTaxAmount`
- `totalTaxBase`
- `operationDate`

No constituye evidencia de cierre Z válido. El writer legacy `cajas.web.js::registerZClosingInternal` y el flujo TPV nuevo de `tpvCierres.web.js::generarCierreZ` tienen contratos diferentes; no deben tratarse como una única escritura ni dar por equivalentes `HistoricoCierresZ` y el evento TPV `TICKET_Z`.

### 4.3 TPV comercial — NO PERSISTE VENTAS

`TransaccionesTPV` tiene 0 registros.

El writer `tpvVentas.web.js::registrarVenta` existe, pero `buildSaleReadiness()` añade siempre:
- `PAYMENT_NOT_VERIFIED`
- `CONSUMER_PRICE_PRESENTATION_UNVERIFIED`

El borrador comunica `paymentVerified=false` y `consumerPricePresentationVerified=false`. `registrarVenta` devuelve `TPV_SALE_NOT_READY` antes de insertar la intención comercial. El propio mensaje del writer declara que no crea ninguna intención comercial. Por tanto, el flujo actual no persiste ventas TPV nuevas a `TransaccionesTPV`.

Esto es un bloqueo específico de preparación/aceptación de la venta, no una prueba de pérdida de ventas cobradas.

### 4.4 Cobros y reembolsos eCommerce — BRECHA DE LEDGER Y RECUPERACIÓN

Lectura de eCommerce Orders:
- 34 pedidos: 32 APPROVED y 2 CANCELED.
- Estado de pago: 6 PAID, 1 FULLY_REFUNDED y 27 NOT_PAID.
- 8 registros de pago y 1 registro de reembolso asociados a los pedidos consultados.

Los 7 pedidos pagados o reembolsados no tienen un movimiento correlacionado `ORDER-{orderId}` en `MovimientosCaja`. El reembolso no tiene movimiento `REFUND-{orderId}-{refundId}` correlacionado.

En `ControlOperativo` hay 3 registros `PENDING_RECOVERY`:
- 2 recuperaciones de pedido (`ORDER-...`).
- 1 recuperación de reembolso (`REFUND-...`).

De los 7 pedidos pagados/reembolsados sin ledger, 2 tienen claim de recuperación de pedido; 5 no tienen un claim de recuperación correlacionado en la lectura. El reembolso tiene su claim pendiente. Esto requiere conciliación y recuperación controlada. Todos los datos consultados son anteriores a 2027 y, por directriz, sintéticos; no se interpreta como dinero real perdido ni se ejecutan reintentos durante esta auditoría.

La configuración fiscal canónica no está disponible: `MapaStaff` contiene 5 registros, pero cero registros `recordType=CONFIG_SISTEMA` / `_id=CONFIG_SISTEMA_FISCAL`. `cajas.web.js` y `eventLog.js` exigen esa configuración para los writers fiscales y devuelven `FISCAL_CONFIG_MISSING` cuando no existe. Por ello, el registro fiscal de pagos y ventas no puede darse por operativo.

### 4.5 Reservas Bookings V2 y CitasF2 — DIVERGENCIA CONFIRMADA

Bookings Reader V2 devolvió 360 reservas en 4 páginas:
- 352 CANCELED.
- 8 CONFIRMED.

`CitasF2` contiene 12 proyecciones. No es un espejo de todas las reservas: es una proyección específica del flujo de reserva dual; por tanto, no se exige que las 360 reservas estén duplicadas en CitasF2.

De las 12 proyecciones, 6 tienen estado distinto al registro nativo:
- 6 proyecciones conservan CONFIRMED/PENDING mientras Bookings V2 indica CANCELED.
- 2 de las proyecciones conservan `paymentStatus=PENDING_LEDGER` mientras Bookings V2 indica `PAID`.

En `ControlOperativo` se encontraron 14 marcadores BOOKING_CREATED, 12 BOOKING_CONFIRMED y 2 BOOKING_RESCHEDULED, pero cero BOOKING_CANCELED. El handler `wixBookingsV2_onBookingCanceled` existe en GitHub y tiene pruebas offline; la lectura del sitio no acredita entrega/procesamiento del evento de cancelación en Runtime. No se debe cambiar manualmente CitasF2 ni recrear/reconfirmar reservas. Primero se debe verificar el registro/delivery del webhook y reconciliar la proyección desde la fuente nativa.

### 4.6 Contabilidad PGC — SIN ASIENTOS COMPLETOS

`LibroAsientosContablesDetalle` contiene 3 registros:
- Los 3 tienen `projectionStatus=SIMULATED_ONLY`.
- 0 tienen `journalEntryId`.
- 0 contienen `accountCode` en `desgloseDetallado`.

El writer `accountingLedger.js::appendAccountingEntry` existe y valida partida doble, cuenta de seis dígitos, idempotencia y hash-chain. El comentario del módulo indica expresamente que no hay mapeo de cuentas hasta aprobación formal del PGC. La búsqueda de referencias del repositorio solo localizó el writer y sus tests, no un consumidor de negocio que lo invoque para registrar automáticamente cada operación. Por tanto, no hay automatización PGC demostrada.

### 4.7 Jornada laboral — ESCRITURA DESHABILITADA

`RegistrosHorariosStaff` contiene 0 registros y su esquema exige 14 campos.

`internalConfig.js` define:
- `STAFF_CLOCKING_CONFIG.WRITES_ENABLED=false`
- `STAFF_CLOCKING_CONFIG.ADJUSTMENTS_ENABLED=false`

`horario.web.js::registrarFichaje` devuelve `CLOCKING_WRITES_DISABLED` antes del insert. `registrarAjusteHorario` también está cerrado. No se generan ni persisten fichajes mediante el flujo actual.

### 4.8 Registro de integración / Capa 3 — SIN ENTREGA

`RegistroIntegracion` contiene 3 eventos TPV sintéticos:
- 3 `NOT_SENT`
- 0 intentos de entrega

No hay evidencia de transporte externo ni read-back de SharePoint. La preparación de exportación documentada en PR #641 no acredita entrega.

## 5. Matriz de estado por proceso

| Proceso | Fuente autoritativa | Writer/proyección | Resultado de lectura |
|---|---|---|---|
| Reservas | Wix Bookings V2 | CitasF2 solo para flujo dual | 6/12 proyecciones duales con estado divergente |
| Venta TPV | TPV custom + pago confirmado | TransaccionesTPV | 0 registros; writer rechaza por saleReady=false |
| Movimiento físico | Ledger TPV / MovimientosCaja | MovimientosCaja | 5 sintéticos antiguos; contrato incompleto |
| Cobro online | Wix eCommerce Orders + Transactions | MovimientosCaja fiscal | 7 pedidos pagados/reembolsados sin movimiento correlacionado |
| Reembolso | Wix Order Transactions | Movimiento rectificativo fiscal | 1 reembolso sin movimiento; claim pendiente |
| Cierre Z | Writer de cierre correspondiente | Ticket Z / HistoricoCierresZ según flujo | 1 histórico simulado e incompleto; Runtime no aceptado |
| Contabilidad | Hecho conciliado + reglas PGC aprobadas | LibroAsientosContablesDetalle | 3 proyecciones sintéticas; 0 asientos completos |
| Jornada | Eventos de fichaje | RegistrosHorariosStaff | 0 registros; writer deshabilitado |
| Auditoría/webhooks | Eventos Wix | ControlOperativo | 81 items; 0 markers BOOKING_CANCELED |
| Entrega externa | Export contract | RegistroIntegracion / SharePoint | 3 NOT_SENT; transporte no acreditado |

## 6. Revisión estática de código relevante

| Archivo / función | Observación |
|---|---|
| `src/backend/tpv/tpvVentas.web.js::registrarVenta` | Prepara venta, pero no inserta si `saleReadinessBlockers` no está vacío; actualmente siempre hay dos blockers |
| `src/backend/tpv/tpvRepository.js::insertTpvEvent` | Persistencia física TPV con idempotencia, secuencia, hash y envelope; pendiente validar escritura real en el esquema Wix instalado |
| `src/backend/cajas.web.js::registerManualTransaction` | Exige `transactionId` y configuración fiscal canónica |
| `src/backend/eventLog.js::registrarEventoEconomico` | Exige `transactionId`, CONFIG_SISTEMA_FISCAL, catálogo y lock antes de persistir |
| `src/backend/events.js` | Handlers de Bookings y eCommerce presentes; no hay evidencia live de que todas las entregas hayan sido procesadas |
| `src/backend/accountingLedger.js::appendAccountingEntry` | Writer append-only disponible; sin mapeo PGC ni consumidor de negocio localizado |
| `src/backend/horario.web.js::registrarFichaje` | Escritura deshabilitada por configuración |
| `src/backend/data.js::MovimientosCaja_beforeInsert` | Rama específica TPV_LEDGER separada de factura; debe validarse contra required fields físicos Wix |

## 7. Prioridades de corrección

### P0 — Integridad y configuración
1. Resolver el singleton fiscal canónico con datos legales verificados y aprobación del responsable; no introducir datos ficticios en configuración productiva.
2. Conciliar las 3 recuperaciones pendientes y los 7 pedidos pagados/reembolsados sin movimiento fiscal. No reintentar hasta identificar el estado de cada operación y aplicar idempotencia.
3. Verificar el delivery de BOOKING_CANCELED y reconciliar las 6 proyecciones duales obsoletas sin mutar el estado nativo.
4. Resolver la diferencia de contrato entre los campos required físicos de MovimientosCaja y el contrato específico TPV_LEDGER en un entorno de prueba aislado.

### P1 — Operaciones
5. Completar las condiciones reales de venta TPV: verificación de pago, presentación de precio, writer y persistencia de intención.
6. Verificar apertura, movimientos, devoluciones, Ticket X, Ticket Z y cierre mediante Runtime aislado y conciliación contra CajaActual.
7. Definir qué eventos fiscales de Bookings y eCommerce deben generar movimiento y garantizar que cada transición relevante tenga marker, claim, ledger o recuperación terminal.

### P2 — Contabilidad y jornada
8. Aprobar la matriz PGC y conectar el writer contable a los eventos conciliados; conservar partida doble y rectificaciones append-only.
9. Completar idempotencia, secuencia y concurrencia de fichajes; solo entonces evaluar habilitar escritores laborales.

### P3 — Externo
10. Implementar entrega SharePoint, read-back y checksum; no marcar entregado con un HTTP 2xx aislado.

## 8. Límites de la auditoría

- La auditoría CMS fue de solo lectura.
- No se ejecutaron writers ni pruebas de inserción Wix.
- No se realizaron pagos, reembolsos, cierres, fichajes, reservas ni webhooks de prueba.
- No se verificó el SHA del código realmente instalado en Wix Editor.
- No se verificó un Runtime E2E publicado: el sitio figura Draft.
- Las pruebas offline del repositorio no sustituyen Runtime ni Producción.
- Los registros previos a 2027 son sintéticos por directriz del proyecto.

## 9. Conclusión

**NO CONFORME para declarar persistencia integral.** Las colecciones y writers existen, pero hay operaciones bloqueadas, registros sintéticos incompletos, recuperaciones pendientes y proyecciones divergentes. El estado correcto es: implementación parcial, lectura CMS real completada para colecciones propias, conciliación nativa Bookings/eCommerce ejecutada, Runtime no aceptado y producción no verificada.

No se ha modificado ningún dato. La siguiente intervención debe ser una remediación controlada por P0, sin limpiar ni sobrescribir históricos.
