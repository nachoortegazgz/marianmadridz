# Auditoría TPV personalizado ↔ Wix POS/eCommerce/CMS — 2026-11-23

**Sitio:** `188bed94-177c-4bc9-a9f0-35080d874f3e`  
**Base Git:** `a71df25990305b0d6dc8d98089368b825b90dfbf`  
**Entorno Wix:** Draft, Editor clásico, Velo habilitado.  
**Modo:** exclusivamente lectura; consultas CMS con `consistentRead=true`. No se ejecutaron escrituras, pagos, reembolsos, cierres, cambios de automatizaciones ni publicación.

## 1. Resultado ejecutivo

**El TPV personalizado y Wix POS no están conciliados entre sí.** En la consulta ampliada del 1 al 24-11-2026 aparecen cinco pedidos nativos POS (#10030–#10034). El titular confirmó como sintéticos de QA únicamente #10032 y #10033. Los otros tres (#10030, #10031 y #10034) permanecen sin clasificar y no tienen referencias en los ledgers personalizados ni marcadores asociados en ControlOperativo.

No hay identificadores nativos de pedido/pago/reembolso enlazados a los eventos del TPV personalizado. Las compensaciones de webhook sí conservan referencias a #10032/#10033, pero siguen `PENDING_RECOVERY`. No se reintentan compensaciones ni se crean asientos reales. La existencia de registros POS y transacciones nativas no demuestra por sí sola que hubiera movimiento económico externo.

## 2. Lecturas nativas Wix

### Pedidos POS

Consulta completa del 1 al 24-11-2026: 5 pedidos, todos con `channelInfo.type=POS`; paginación completa (una página). No se limitó la consulta a los dos pedidos previamente confirmados.

| Pedido | Order ID | Estado pago | Total | Contenido | Clasificación del titular |
|---|---|---|---:|---|---|
| #10030 | `628f0504-e5b4-419d-a194-5e0acb9ffbdb` | PAID | 18,15 € | Servicio Bookings | Pendiente |
| #10031 | `c9214120-d56a-468b-a6df-dd0d39ebb9a7` | PAID | 27,71 € | Producto tienda | Pendiente |
| #10032 | `0749bb38-34b6-4255-988b-34e42138dab7` | PAID | 92,45 € | 2 productos + servicio Bookings | Sintético QA confirmado |
| #10033 | `d3a4ada9-6720-4816-bcef-51b7a0b64403` | FULLY_REFUNDED | 18,15 € | Servicio Bookings | Sintético QA confirmado |
| #10034 | `7aecf923-1719-4c85-bb13-0da18f879706` | PAID | 18,15 € | Servicio Bookings | Pendiente |

Los tres pedidos sin clasificación (#10030, #10031 y #10034) suman 64,01 €. No se presume que sean reales ni sintéticos hasta confirmación del titular. Todos constan como APPROVED/FULFILLED.

### Historial nativo de transacciones

Consulta de Wix Payments Transactions API para el intervalo 2026-11-01 a 2026-11-24, incluyendo refunds: cinco transacciones, una por pedido POS. El campo `providerTransactionId` es nulo en las cinco.

| Pedido | Transaction ID | Método nativo | Estado | Importe | Refund |
|---|---|---|---|---:|---|
| #10030 | `a71d86e1-193a-4603-8fb4-6a89a6a30115` | `posCash` | APPROVED | 18,15 € | Ninguno |
| #10031 | `c1221698-df73-4a1f-bea8-e785e9c158bb` | `posCash` | APPROVED | 27,71 € | Ninguno |
| #10032 | `79ff054e-4724-447f-8622-dc65fe58836d` | `posCash` | APPROVED | 92,45 € | Ninguno |
| #10033 | `22212d66-d27a-4e71-9c80-1d8ad729b9f6` | `inPerson` | REFUND | 18,15 € | 18,15 € SUCCEEDED |
| #10034 | `7b91f911-9b5b-44d8-9682-f666aa8370b4` | `posCash` | APPROVED | 18,15 € | Ninguno |

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

La consulta nativa Bookings Reader V2 de cuatro IDs de servicio en pedidos POS devuelve:

| Pedido | Booking ID | Estado nativo | Pago nativo | Proyección CitasF2 |
|---|---|---|---|---|
| #10030 | `359e606d-bdd7-453d-bd5c-b62ba8eb94a2` | CANCELED | PAID | Ausente |
| #10032 | `f137c63a-f704-461e-91bc-3295e853c67d` | CANCELED | PAID | CONFIRMED / PENDING_LEDGER |
| #10033 | `b18337da-2326-46fc-89c0-1843b6be0730` | CANCELED | PAID | CONFIRMED / PENDING_LEDGER |
| #10034 | `bce61665-be70-41de-9420-3bebba437fe4` | CONFIRMED | PAID | Ausente |

- #10030: reserva nativa cancelada el 20-11-2026; pedido sigue PAID y no aparece refund en su historial nativo.
- #10034: reserva nativa CONFIRMED/PAID del 23-11-2026, sin proyección CitasF2.
- #10032/#10033: mantienen las dos proyecciones CMS CONFIRMED/PENDING_LEDGER pese a que el booking nativo está CANCELED/PAID.
- #10031 es una venta de producto sin línea de Bookings.

La auditoría nativa anterior documentó seis bookings proyectados, seis cancelados. Esta consulta adicional amplía el universo: #10030 y #10034 son bookings nativos adicionales que no aparecen en las seis filas de CitasF2. La discrepancia sigue abierta en [#523](https://github.com/nachoortegazgz/marianmadridz/issues/523).

## 5. Diagnóstico arquitectónico

1. **Separación de circuitos confirmada:** el TPV personalizado persiste eventos sintéticos propios en `MovimientosCaja`; Wix POS conserva sus pedidos y transacciones nativos.
2. **Sin vínculo TPV↔POS:** no existe un `orderId`, `paymentId`, `refundId` o referencia nativa en los cinco movimientos de caja leídos ni en la sesión singleton `CajaActual`.
3. **Compensaciones pendientes:** los webhooks han creado referencias recuperables en `ControlOperativo`, pero no hay ledger fiscal real asociado. No se debe ejecutar recuperación para pedidos que el titular ha clasificado como sintéticos.
4. **Singleton ambiguo:** `CajaActual` permanece ABIERTA y no presenta el envelope TPV V2 esperado. No debe asociarse automáticamente al run QA ni cerrarse/reconstruirse por inferencia.
5. **Proyección de reservas divergente:** dos filas `CitasF2` siguen CONFIRMED/PENDING_LEDGER pese al estado nativo CANCELED/PAID documentado.

## 5. Ausencia de correlación para pedidos POS

Se consultaron `MovimientosCaja` y `LibroAsientosContablesDetalle` mediante filtros por los cinco `orderId`, los cinco IDs de transacción nativos, los cuatro bookingId y los refundId conocidos: 0 coincidencias en ambas colecciones. La consulta de `ControlOperativo` por #10030/#10031/#10034 y los bookings #10030/#10034 también devolvió 0 marcadores.

Por tanto, los tres pedidos sin clasificación no tienen ledger TPV/fiscal correlacionado en las colecciones consultadas. El resultado no demuestra por sí solo que falte una obligación fiscal: antes hay que determinar si esas ventas son reales o QA y revisar el circuito fiscal autorizado correspondiente.

## 6. Decisiones y acciones

- Mantener `ALLOW_NATIVE_WRITES=false`, `ALLOW_REAL_PAYMENTS=false`, `allowNativePayments=false`, `allowNativeRefunds=false` y escrituras fiscales cerradas.
- No crear pedidos, cargos, pagos, refunds, asientos, facturas ni movimientos para “hacer coincidir” importes.
- No reintentar ni cambiar las tres compensaciones PENDING_RECOVERY de #10032/#10033.
- No mutar `CajaActual`, `MovimientosCaja`, `HistoricoCierresZ`, `LibroAsientosContablesDetalle` ni `CitasF2`.
- Solicitar al titular clasificación explícita de #10030, #10031 y #10034 antes de cualquier tratamiento económico/fiscal.
- #10030 requiere verificar el tratamiento de la cancelación frente al pago; no se ejecuta reembolso ni asiento por inferencia.
- #10034 requiere reconstruir la proyección CitasF2 de forma trazable solo después de resolver la causa de ausencia y confirmar su naturaleza.
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
