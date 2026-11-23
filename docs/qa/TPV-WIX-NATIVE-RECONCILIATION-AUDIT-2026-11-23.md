# Auditoría TPV personalizado ↔ Wix POS/eCommerce/CMS — 2026-11-23

**Sitio:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Base Git:** `a71df25990305b0d6dc8d98089368b825b90dfbf`  
**Entorno Wix:** Draft, Editor clásico, Velo habilitado.  
**Modo:** exclusivamente lectura; consultas CMS con `consistentRead=true`. No se ejecutaron escrituras, pagos, reembolsos, cierres, cambios de automatizaciones ni publicación.

## 1. Resultado ejecutivo

**El TPV personalizado y Wix POS no están conciliados entre sí.** Existen registros sintéticos del TPV personalizado en `MovimientosCaja` y, por separado, pedidos/transacciones nativos Wix POS #10032 y #10033. No hay identificadores nativos de pedido/pago/reembolso enlazados a los eventos del TPV personalizado. Las compensaciones de webhook sí conservan referencias a los pedidos nativos, pero siguen `PENDING_RECOVERY`.

La confirmación del titular del 2026-11-23 clasifica #10032 y #10033 como operaciones sintéticas de QA. Esa declaración se conserva como evidencia de clasificación; no se reintentan compensaciones ni se crean asientos reales. La existencia de registros POS y transacciones nativas no demuestra por sí sola que hubiera movimiento económico externo.

## 2. Lecturas nativas Wix

### Pedidos POS

| Pedido | Order ID | Estado pedido | Estado pago | Canal | Total |
|---|---|---|---|---|---:|
| #10032 | `0749bb38-34b6-4255-988b-34e42138dab7` | APPROVED | PAID | POS | 92,45 € |
| #10033 | `d3a4ada9-6720-4816-bcef-51b7a0b64403` | APPROVED | FULLY_REFUNDED | POS | 18,15 € |

- #10032 contiene dos productos de tienda y una línea de servicio Bookings. Es una composición mixta.
- #10033 contiene una línea de servicio Bookings.
- Ambos pedidos constan como FULFILLED.

### Historial nativo de transacciones

Consulta de Wix Payments Transactions API para el intervalo 2026-11-14 a 2026-11-18, incluyendo refunds:

| Pedido | Transaction ID | Tipo/método | Estado | Importe | Provider transaction ID |
|---|---|---|---|---:|---|
| #10032 | `79ff054e-4724-447f-8622-dc65fe58836d` | `posCash` | APPROVED | 92,45 € | vacío |
| #10033 | `22212d66-d27a-4e71-9c80-1d8ad729b9f6` | `inPerson` | REFUND | 18,15 € | vacío |

Para #10033, Wix devuelve refund `4b005b4b-1a5b-497f-8f37-91483069bec9`, por 18,15 €, estado `SUCCEEDED`. El registro Order Transactions asocia además el refund `c7a5266c-7a19-4550-aa43-ee6cb913fa06`, también `SUCCEEDED`, con `externalRefund=false`.

**Límite probatorio:** `providerTransactionId` vacío y la confirmación del titular no son una conciliación bancaria ni un extracto de adquirente. No se ha demostrado settlement externo, pero tampoco debe afirmarse su ausencia solo a partir de estas APIs. La documentación de Order Transactions distingue el registro de pagos/reembolsos de la transferencia real de fondos: sus operaciones de registro no ejecutan por sí mismas cargos ni devoluciones.

## 3. Colecciones CMS y relación con el TPV personalizado

Lecturas consistentes de las colecciones:

| Colección | Registros | Hallazgo |
|---|---:|---|
| `CajaActual` | 1 | Singleton ABIERTA; apertura 300 €, efectivo esperado 320 €. No contiene orderId, checkoutId, paymentId, transactionId ni paymentReference. `snapshotSource=MOVIMIENTOS_CAJA_RECONCILIADOS`, `lastOperationType=RECONCILIATION_CORRECTION`, `traceId=0`; estado no acreditado como sesión TPV V2 canónica. |
| `MovimientosCaja` | 5 | Los cinco registros son sintéticos. Ninguno enlaza los pedidos nativos #10032/#10033. |
| `ControlOperativo` | 63 | Cinco marcadores `TPV_FUNCTIONAL_TEST` del run `TPV-QA-1795437582366`; tres compensaciones pendientes asociadas a #10032/#10033. |
| `HistoricoCierresZ` | 1 | Cierre `Z_SIMULATED`, dominio `TPV_CUSTOM_QA`, neto 20 €, sin envío AEAT. |
| `LibroAsientosContablesDetalle` | 3 | Dos ventas y una devolución `SIMULATED_ONLY`; payload marcado `simulated=true` y `notForSubmission=true`. |
| `CitasF2` | 6 | Dos proyecciones están enlazadas a los pedidos POS #10032/#10033. |

### Eventos sintéticos del run TPV más reciente

Run: `TPV-QA-1795437582366`.

| Evento | Colección lógica / medio | Importe |
|---|---|---:|
| Venta sintética | SALE / CASH | +20,00 € |
| Venta sintética | SALE / CARD | +35,00 € |
| Devolución sintética | REFUND / CARD | −35,00 € |
| **Neto** | | **20,00 €** |

Los tres eventos se encuentran en `MovimientosCaja` con `synthetic=true`, `source=TPV_FUNCTIONAL_TEST`, `recordSource=TPV_QA_DEVELOPMENT`, `status=SIMULATED_SUCCESS`. El cierre Z refleja ventas brutas 55 €, devoluciones 35 € y neto 20 €. Los tres registros del libro auxiliar reflejan +20 CASH, +35 CARD y −35 CARD, todos `SIMULATED_ONLY`.

Los otros dos registros de `MovimientosCaja` son pruebas sintéticas anteriores (+25 CARD y +20 CASH), no parte del run anterior.

**Importante:** el valor histórico `reconciliationStatus=RECONCILED` de estos registros legacy describe su marcador interno de prueba; no prueba conciliación con los pedidos POS nativos. Los eventos canónicos actuales del TPV usan `sourceType=SYNTHETIC`, `processingMode=INTERNAL` y `reconciliationStatus=NOT_RECONCILED`.

### Compensaciones de los pedidos POS

| Pedido | Transacción de recuperación | Importe | Estado | Alcance |
|---|---|---:|---|---|
| #10032 | `ORDER-0749bb38-34b6-4255-988b-34e42138dab7` | +92,45 € | PENDING_RECOVERY | `UNSUPPORTED_ORDER_COMPOSITION`; procesador MANUAL |
| #10033 | `ORDER-d3a4ada9-6720-4816-bcef-51b7a0b64403` | +18,15 € | PENDING_RECOVERY | `BOOKINGS_ONLY` |
| #10033 | `REFUND-d3a4ada9-6720-4816-bcef-51b7a0b64403-c7a5266c-7a19-4550-aa43-ee6cb913fa06` | −18,15 € | PENDING_RECOVERY | `WAIT_FOR_ORIGINAL_ORDER_LEDGER` |

Los tres registros proceden de webhooks eCommerce de pago/reembolso. No son los eventos del TPV personalizado del run de 55/35/20 €. Se mantienen sin reintento, sin mutación y sin asiento real porque el titular confirmó que los pedidos POS son sintéticos de QA.

## 4. Discrepancia Bookings ↔ CitasF2

Las dos proyecciones vinculadas a pedidos nativos siguen en CMS:

| Pedido | Booking ID | CitasF2 bookingStatus | CitasF2 paymentStatus |
|---|---|---|---|
| #10032 | `f137c63a-f704-461e-91bc-3295e853c67d` | CONFIRMED | PENDING_LEDGER |
| #10033 | `b18337da-2326-46fc-89c0-1843b6be0730` | CONFIRMED | PENDING_LEDGER |

La auditoría nativa Bookings Reader V2 del 2026-11-23 ya documentó que ambos bookings nativos estaban `CANCELED` con `paymentStatus=PAID`; el resultado fue 6/6 bookings nativos cancelados frente a seis proyecciones CMS no actualizadas. Esta divergencia sigue abierta en [#523](https://github.com/nachoortegazgz/marianmadridz/issues/523). En esta pasada no se repitió la consulta Extended Bookings, para respetar la desactivación de ese flujo en el contrato TPV/QA vigente.

## 5. Diagnóstico arquitectónico

1. **Separación de circuitos confirmada:** el TPV personalizado persiste eventos sintéticos propios en `MovimientosCaja`; Wix POS conserva sus pedidos y transacciones nativos.
2. **Sin vínculo TPV↔POS:** no existe un `orderId`, `paymentId`, `refundId` o referencia nativa en los cinco movimientos de caja leídos ni en la sesión singleton `CajaActual`.
3. **Compensaciones pendientes:** los webhooks han creado referencias recuperables en `ControlOperativo`, pero no hay ledger fiscal real asociado. No se debe ejecutar recuperación para pedidos que el titular ha clasificado como sintéticos.
4. **Singleton ambiguo:** `CajaActual` permanece ABIERTA y no presenta el envelope TPV V2 esperado. No debe asociarse automáticamente al run QA ni cerrarse/reconstruirse por inferencia.
5. **Proyección de reservas divergente:** dos filas `CitasF2` siguen CONFIRMED/PENDING_LEDGER pese al estado nativo CANCELED/PAID documentado.

## 6. Decisiones y acciones

- Mantener `ALLOW_NATIVE_WRITES=false`, `ALLOW_REAL_PAYMENTS=false`, `allowNativePayments=false`, `allowNativeRefunds=false` y escrituras fiscales cerradas.
- No crear pedidos, cargos, pagos, refunds, asientos, facturas ni movimientos para “hacer coincidir” importes.
- No reintentar ni cambiar las tres compensaciones PENDING_RECOVERY.
- No mutar `CajaActual`, `MovimientosCaja`, `HistoricoCierresZ`, `LibroAsientosContablesDetalle` ni `CitasF2`.
- Mantener #416 y #523 abiertas; mantener release NO-GO.
- Para futuras pruebas, separar explícitamente tres estados distintos: conciliación interna del ledger sintético, correlación con un pedido nativo y conciliación de liquidación externa. No reutilizar `RECONCILED` como prueba de las tres.
- Una integración TPV↔POS de producción requeriría una decisión de negocio/arquitectura y contrato de idempotencia con IDs nativos. No forma parte de la corrección QA actual.

## 7. Fuentes

- Wix CMS — [Query Data Items](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/query-data-items).
- Wix eCommerce — [Search Orders](https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/orders/search-orders).
- Wix eCommerce — [List Transactions For Multiple Orders](https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/order-transactions/list-transactions-for-multiple-orders).
- Wix Payments — [Transactions List](https://dev.wix.com/docs/api-reference/business-management/payments/cashier/payments/transaction/transactions-list).
- Wix eCommerce — [Order Transactions introduction](https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/order-transactions/introduction).
- Revalidación previa Bookings V2: [2026-11-23-bookings-revalidation.md](../audits/2026-11-23-bookings-revalidation.md).
- [Issue #416 — compensaciones y singleton](https://github.com/nachoortegazgz/marianmadridz/issues/416).
- [Issue #523 — CitasF2 y cancelaciones nativas](https://github.com/nachoortegazgz/marianmadridz/issues/523).
