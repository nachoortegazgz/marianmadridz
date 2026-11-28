# TPV profesional — arquitectura objetivo y plan de ejecución

**Fecha:** 2026-11-28  
**Estado:** decisión de arquitectura propuesta a partir del código de `main`, la auditoría de persistencia del 28-11-2026 y documentación oficial Wix/BOE.  
**Objetivo:** una TPV profesional, nativa en su integración, con el mínimo código propio y trazabilidad completa de cada operación.

## 1. Criterio de éxito

El TPV solo se considera GO cuando:

1. Ejecuta el ciclo profesional de venta, cobro, devolución, caja y cierre sin divergencias entre widget, Velo, Wix Apps y CMS propio.
2. Cada operación deja todos los registros que le corresponden. Cada registro esperado debe estar en uno de estos estados terminales: persistido y leído de vuelta; rechazado con causa explícita; o pendiente de recuperación con claim/traceId. No se admiten registros desaparecidos, duplicados ni estados desconocidos.
3. Los importes cuadran en céntimos entre catálogo, cálculo fiscal Wix, pedido, pagos, devolución, ledger y cierre.
4. Wix gobierna sus entidades nativas; el CMS propio solo gobierna las entidades diferenciales y las proyecciones/correlaciones necesarias.
5. Desarrollo, pruebas y producción usan la misma lógica de dominio. Los adaptadores de prueba sustituyen proveedores/efectos externos, no el cálculo, validación, autorización, persistencia ni estados de negocio.

## 2. Arquitectura objetivo: una sola autoridad por entidad

| Dominio | Autoridad/SSOT | Papel del TPV |
|---|---|---|
| Productos, variantes, precios y stock | Wix Stores Catalog V3 / Inventory | Consultar y seleccionar; no duplicar catálogo ni inventario |
| Servicios, profesionales, disponibilidad y reservas | Wix Bookings | Consultar, vincular y actualizar por APIs Bookings |
| Pedido y líneas de venta | Wix eCommerce Orders | Crear un único pedido por venta presencial con canal POS |
| Pagos y transacciones del pedido | Wix eCommerce Order Transactions + PSP | Registrar pagos solo después de la confirmación real del medio de pago |
| Cobro con tarjeta presencial | Proveedor de terminal/PSP elegido | Solicitar el cobro, recibir confirmación verificable y correlacionar el ID externo |
| Efectivo y arqueos | Ledger propio `MovimientosCaja` | Registrar entradas/salidas/ventas en efectivo, arqueos y diferencias |
| Sesión/caja actual | `CajaActual` como proyección | Mostrar estado derivado; nunca usarlo como ledger |
| Intención/correlación TPV | `TransaccionesTPV` | Proyección de la operación propia enlazada a `orderId`, no segundo pedido |
| Locks, idempotencia, outbox y recuperación | `ControlOperativo` | Evitar duplicados y recuperar efectos parciales |
| Contactos | Wix CRM | Revalidar `contactId` en backend; no copiar la agenda a CMS |
| Factura/registro fiscal | Un único SIF autorizado/seleccionado | Emitir una vez, conservar evidencia y enlazar factura con pedido/pago |
| Informes X/Z y auditoría | Writers TPV propios | Snapshot/cierre operacional; no sustituir factura ni pago |

**Regla de no duplicación:** no crear una orden propia en `TransaccionesTPV` además de la orden nativa. No crear un segundo movimiento de stock si Wix Orders ya ha reducido inventario. No duplicar pagos en una colección propia como fuente de verdad: cualquier colección `PAGOS` que se conserve será una proyección reconciliable de Wix Order Transactions, no la autoridad del cobro.

## 3. Flujo profesional de venta

### 3.1 Preparación

1. El widget envía solo IDs, cantidades, variante, cliente y referencia de reserva.
2. El backend revalida operador/rol, sesión activa, permisos, catálogo y disponibilidad.
3. El backend vuelve a resolver precios y variantes en Stores/Bookings; nunca confía en importes del navegador.
4. Wix eCommerce Tax Calculation calcula impuestos. Se conservan totales y desglose por línea; no se reconstruyen tipos impositivos con reglas locales incompletas.
5. Se valida el importe total en céntimos y la presentación al consumidor.
6. Se crea una intención correlacionada/idempotente en `TransaccionesTPV` y un claim de recuperación antes de ejecutar efectos externos.

### 3.2 Pedido nativo

La documentación de Wix permite usar `@wix/ecom/orders.createOrder()` para registrar ventas manuales de POS y pedidos de sistemas externos. El canal `channelInfo.type = POS` está soportado. Wix documenta además un ejemplo de un único pedido con líneas de Wix Stores y Wix Bookings.

- Un pedido Wix por venta, con todas las líneas de producto/servicio y el cliente cuando exista.
- Usar `settings.orderApprovalStrategy = DEFAULT` y `settings.notifications.sendNotificationToBuyer=false / sendNotificationsToBusiness=false` para reservar/decrementar stock al crear el pedido sin enviar una confirmación antes del cobro. La notificación fiscal/recibo se emite después de completar pago y factura. El pedido puede estar `APPROVED` y `NOT_PAID`; eso no es una venta cobrada ni se suma a ingresos.
- Si no se completa ningún pago, cancelar el pedido con `orders.cancelOrder(..., {sendOrderCanceledEmail:false, restockAllItems:true})` para liberar stock.
- Si existe pago parcial, primero completar su reembolso por el medio correspondiente y verificarlo; después cancelar el pedido y restock. No asumir que `cancelOrder` devuelve dinero.
- No ejecutar decrementos ni reposiciones manuales paralelos.
- Guardar el `orderId`, número, revisión, importes, moneda, IDs de líneas y correlación con la intención TPV.
- Confirmar en Runtime que la venta de productos reduce stock una sola vez, en la ubicación correcta y solo en el momento acordado.
- Verificar la limitación documentada de `Create Order`: 5 llamadas/hora/sitio para apps aún no publicadas en Wix App Market. Debe comprobarse si aplica al contexto de este sitio Velo antes de declarar capacidad productiva. No crear una cola de reintentos que dispare pedidos duplicados.

**Idempotencia y recuperación de Create Order:** el contrato oficial expone `channelInfo.externalOrderId` (máximo 100 caracteres) como referencia al pedido del sistema externo. Usar el `transactionId` UUID de la intención TPV como `externalOrderId`. Search Orders no documenta ese campo como filtrable, por lo que la recuperación debe:
1. Persistir la intención local y el `externalOrderId` antes de llamar a Wix.
2. En caso de timeout, buscar pedidos por intervalo corto de `purchasedDate` y, si existe, `buyerInfo.contactId`/email.
3. Paginar todos los resultados necesarios y comparar en código `channelInfo.externalOrderId === transactionId`.
4. Si aparece exactamente uno, recuperar su `orderId`; si aparecen varios, marcar duplicidad y bloquear el cobro; si no aparece, repetir solo la búsqueda por la consistencia eventual del índice.
5. Nunca repetir automáticamente `Create Order` por el mero hecho de que no haya respuesta. Si no se puede demostrar ausencia, marcar `ORDER_CREATE_UNKNOWN / PENDING_RECOVERY` y resolver la operación sin volver a crear el pedido.

El campo de correlación sí está documentado como parte de `ChannelInfo`; su filtro directo no. Esta recuperación se debe probar en Preview con un timeout inyectado antes de habilitar reintentos de creación.

### 3.3 Cobro

**Efectivo**
1. El cajero confirma recepción física del efectivo.
2. Se añade al pedido Wix un payment record con `offlinePayment=true`, método Cash y el importe aplicado al pedido (no el efectivo entregado antes del cambio).
3. Se confirma el estado del payment record con `orderTransactions.updatePaymentStatus(..., {status: APPROVED})` solo después de la recepción efectiva. Este método cambia el estado del registro; no mueve dinero.
4. Se inserta el movimiento de efectivo en `MovimientosCaja` con clave idempotente, secuencia/hash y referencia a `orderId`/paymentId.
5. Se lee de vuelta el pedido/transacción y el ledger antes de devolver éxito.

**Tarjeta**
1. Se solicita el cargo al terminal/PSP seleccionado.
2. Se espera confirmación verificable del proveedor y se conserva su transactionId.
3. Solo entonces se registra el pago Wix con `offlinePayment=false`, datos de proveedor y estado aprobado según el contrato.
4. Se reconcilian Wix Order Transactions, pedido y correlación local.
5. Si el proveedor queda en timeout incierto, consultar el estado por su ID/idempotency key; nunca volver a cobrar por una respuesta perdida.

Wix documenta un ejemplo específico de pago con lector POS dentro de su Payment Service Provider Service Plugin (`Create Transaction`). Es una vía oficial, pero requiere desarrollar/configurar el plugin PSP y un proveedor compatible; no es una API de terminal que el widget pueda invocar directamente. La decisión entre PSP plugin y SDK directo del proveedor depende del terminal elegido y de su disponibilidad en España.

**Límite esencial:** Wix `orderTransactions.addPayments()` añade registros de pago al pedido, pero no efectúa el cargo. El estado global del pedido se recalcula de forma asíncrona. Un registro `PENDING` o `PENDING_MERCHANT` no se debe tratar como cobro confirmado. La tarjeta presencial requiere integración real con un PSP/terminal o un plugin de proveedor; no se inventa una pasarela ni se marca tarjeta como cobrada manualmente.

**Pago mixto:** Wix admite hasta 50 registros de pago por pedido. El TPV debe soportar tender dividido una vez que el writer y la conciliación se basen en los registros nativos. Cada medio se confirma por separado; la suma aplicada debe igualar exactamente el total, y el cambio solo puede corresponder a efectivo. El bloqueo local V1 de un solo medio debe retirarse cuando exista esta implementación completa, no antes.

### 3.4 Reservas y servicios Bookings

- La línea de servicio en un pedido Wix no demuestra por sí sola que una reserva existente haya quedado pagada o confirmada.
- Para una cita existente, consultar Bookings Reader V2 por contacto/bookingId y vincular explícitamente `bookingId` al pedido y a la transacción TPV.
- El widget TPV es un checkout propio. Para ese flujo, Wix documenta `bookings.confirmOrDeclineBooking(bookingId, { paymentStatus })`; tras el pago confirmado usar `PAID`, para un pago parcial `PARTIALLY_PAID` y para una intención no cobrada `NOT_PAID`. El método determina `CONFIRMED`, `PENDING` o `DECLINED` según la política del servicio y conflictos de agenda.
- No invocar `confirmOrDeclineBooking` para una reserva procesada por Wix eCommerce Checkout: en ese flujo Wix sincroniza automáticamente Bookings con el `paymentStatus` del pedido.
- Para una venta de servicio sin cita, crear la línea de servicio en el pedido Wix sin fabricar una reserva.
- Leer de vuelta Bookings V2 y verificar bookingId, paymentStatus y status.
- Nunca escribir una segunda reserva en CMS ni cambiar el estado nativo Bookings desde una proyección `CitasF2`.



## 4. Devoluciones

1. Resolver el pedido y los paymentIds desde Wix Order Transactions.
2. Consultar `orderBilling.getOrderRefundability()`.
3. Calcular el importe y las líneas/cantidades disponibles para devolver; evitar exceder el saldo reembolsable.
4. Ejecutar `orderBilling.refundPayments()`:
   - reembolso automático cuando el proveedor soporte la operación;
   - `externalRefund=true` solo después de haber realizado el reembolso real fuera de Wix.
5. Usar `sideEffects.restock` para reponer las líneas devueltas cuando proceda; no llamar además al decrement/increment de inventario por separado.
6. Registrar el movimiento de efectivo negativo si el reembolso se entrega en efectivo, o mantener la evidencia del proveedor para tarjeta.
7. Emitir el documento fiscal rectificativo que corresponda sin modificar ni borrar la factura original.
8. Leer de vuelta refund, payment, pedido, stock, ledger y auditoría.

Un reembolso solicitado, programado o pendiente no es un reembolso completado. Debe impedir el cierre solo cuando afecte a una conciliación pendiente real, no por una etiqueta genérica. La cancelación de un pedido no sustituye al reembolso de pagos ya capturados.

## 5. Caja, arqueo y cierres

- `CajaActual` es una proyección de la sesión activa. La lectura `CASHIER_STATE` debe ser read-only; el bootstrap del singleton pertenece a un comando explícito y trazable.
- `MovimientosCaja` es el ledger operacional. Entradas, salidas, efectivo aplicado a ventas, devoluciones en efectivo, arqueos y cierre deben usar el writer canónico.
- Los cobros no monetarios se concilian contra Wix Order Transactions/PSP; no se inventa efectivo en caja para cuadrarlos.
- Ticket X es una lectura/snapshot intermedio y no cierra sesión.
- Ticket Z es el único comando de cierre operativo: snapshot final, diferencias justificadas, registro histórico inmutable, movimiento de cierre y proyección cerrada. No debe existir un segundo camino `SESSION_CLOSE` que deje sin Z o viceversa.
- Una venta pendiente de pago no se suma a lo cobrado. El cierre puede contabilizar intenciones no cobradas separadamente si el contrato de caja lo permite; no se debe convertir una intención pendiente en cobro.
- La batería de pruebas no cierra ni adopta sesiones preexistentes.

## 6. Documentación fiscal y facturación

- Un ticket X/Z de caja no es una factura.
- Un justificante de pago no es automáticamente una factura simplificada.
- El TPV necesita un único SIF responsable de serie/número, expedición, registros de facturación, conservación, rectificación y, cuando corresponda, remisión AEAT.
- El RD 1619/2012 permite factura simplificada hasta 400 € con carácter general y hasta 3.000 € para operaciones enumeradas, entre ellas peluquería y servicios de institutos de belleza. La aplicación concreta a cada servicio/operación debe confirmarse con asesoría fiscal.
- El RDL 43/2026, publicado el 25-11-2026, modificó el calendario del RD 1007/2023. La disposición final cuarta remite el plazo general a 24 meses desde la entrada en vigor de la orden ministerial prevista en el RD 238/2026. La documentación fiscal del proyecto calcula el 06-10-2028 por la entrada en vigor de la Orden HAC/1028/2026; mantener ese calendario sujeto al ámbito/exclusiones y revisión profesional.
- La fecha anterior a 2027 puede identificar datos históricos de prueba por convención del proyecto, pero no convierte por sí sola una operación real en sintética ni exime de obligaciones legales. Las pruebas deben usar fixtures inequívocos, sin cobros reales y con adaptadores externos interceptados.
- Wix Invoices API no está disponible todavía para todos los sitios; la documentación indica error 428 cuando el sitio no ha sido migrado. Además, las facturas tipo ORDER las crea Wix eCommerce, no la API standalone. No crear una factura standalone adicional para el mismo pedido.
- Wix Invoices no se declara SIF conforme por el mero hecho de generar un PDF. Debe acreditarse la solución fiscal elegida, su declaración responsable y la integración oficial correspondiente.

## 7. Matriz de registros esperados por operación

| Operación | Registros/fuentes esperados | Comprobación de aceptación |
|---|---|---|
| Venta de producto/servicio cobrada | Pedido Wix; uno o más pagos Wix; intención/proyección TPV; ledger operacional correspondiente; auditoría; stock nativo si aplica; reserva Bookings si se vinculó; factura/documento cuando corresponda | IDs correlacionados, importe y moneda exactos, paymentStatus correcto, stock una sola vez, read-back completo |
| Venta pendiente | Intención TPV; pedido solo si se ha creado; estado pendiente explícito; claim de recuperación | No aparece como cobrada ni aumenta el efectivo |
| Movimiento de caja | Movimiento ledger; auditoría; proyección de caja actualizada | Importe en céntimos, tipo, operador, sesión, secuencia/hash, replay idempotente |
| Reembolso | Refund Wix; payment actualizado; intención/refund local; restock si procede; movimiento de efectivo si es cash; auditoría; rectificación fiscal cuando corresponda | Importe reembolsado <= disponible, no duplicidad, stock y caja conciliados |
| Ticket X | Snapshot X y auditoría | No cambia estado ni importes de caja |
| Ticket Z | Registro Z inmutable; movimiento cierre; CajaActual cerrada; auditoría | Conteo vs esperado, diferencia, IDs, hash/secuencia, sesión cerrada y read-back |
| Exportación | Archivo completo + evento de exportación | Conteo exportado = conteo fuente; no truncado; hash/identificador de archivo |
| Reserva pagada en TPV | Booking nativo actualizado + pedido/pago Wix + correlación TPV + auditoría | bookingId, orderId, paymentId y estado nativo conciliados |

**Métrica 100 %:** en una operación aceptada, `persistedAndReadBack === expectedApplicableRecords` para todos los registros aplicables. Una operación rechazada debe persistir su auditoría/error explícito y no se contabiliza como venta completada. `PENDING_RECOVERY` se mide aparte y bloquea GO. Objetivo de cierre: 100 % de registros aplicables leídos de vuelta, 0 pendientes de recuperación, 0 duplicados y 0 diferencias sin explicación.

## 8. Plan de ejecución por orden de dependencia

### P0 — habilitar una venta real coherente en Wix (sin tarjeta real todavía)
1. Corregir el contrato de venta para persistir la intención una sola vez y eliminar el stub `createSaleDraftOrder()`.
2. Construir el adaptador Wix Orders usando `@wix/ecom`, `channelInfo.type=POS`, `externalOrderId` idempotente, líneas nativas Stores/Bookings y reserva de stock al crear el pedido.
3. Implementar pago en efectivo con Add Payments + confirmación de estado, ledger de efectivo y read-back.
4. Corregir el mapping de estados y correlación entre TransaccionesTPV, Order, Payment, MovimientosCaja y Ticket X/Z.
5. Resolver la recuperación de `Create Order` tras timeout incierto antes de habilitar reintentos.
6. Hacer que la venta de producto utilice el decremento de inventario nativo de Wix Orders y demostrarlo en Runtime.
7. Habilitar permisos/capabilities de venta, X, Z y exportación según los permisos reales del backend.

**Criterio P0:** venta de servicio y producto en efectivo, pedido Wix POS, pago aprobado, stock reservado al crear el pedido y restituido por cancelación si no se cobra, ledger completo, X/Z correctos y read-back del 100 %.

### P1 — ciclo de vida profesional
1. Elegir PSP/terminal físico y documentar sus APIs, idempotencia, callbacks/webhooks, cancelación, timeout y devolución.
2. Implementar tarjeta y pago mixto con conciliación nativa.
3. Vincular reservas Bookings existentes y actualizar su estado de pago por API oficial.
4. Implementar devolución total/parcial, restock, efectivo y conciliación con PSP.
5. Completar cliente, descuentos autorizados y promociones mediante reglas backend.

### P2 — operación y documentación
1. Seleccionar SIF/proveedor fiscal o modalidad VERI*FACTU y completar declaración responsable/configuración.
2. Integrar factura simplificada/completa, rectificativas, series, QR y remisión según normativa aplicable.
3. Validar impresión de ticket/factura y periféricos físicos.
4. Completar exportaciones, conciliación de cierre y reportes de diferencias.

### P3 — optimización
1. Retirar código muerto y contratos V1 que ya no reflejen el flujo nativo.
2. Eliminar duplicidades de colecciones/proyecciones que no aporten trazabilidad.
3. Automatizar reconciliación diaria y alertas de `PENDING_RECOVERY`.
4. Optimizar consultas/paginación y métricas de rendimiento sin alterar la semántica.

## 9. Verificación y liberación

Por cada cambio:
- **Capa 0:** tests unitarios/contratos con mocks oficiales; import/SDK checks; lint.
- **Capa 1:** integración simulada de orden/pago/stock/refund con fallos parciales y replay.
- **Wix Preview/Runtime:** ejecutar el WebMethod real, verificar colecciones propias y APIs nativas mediante read-back. Registrar si Sandbox está habilitado; Preview puede usar Live si no lo está. No declarar aislamiento sin comprobarlo.
- **Producción:** pruebas controladas con autorización, proveedor real y SIF validado.

Pruebas obligatorias de fallo: timeout después de Create Order, Add Payments aceptado pero read-back retrasado, proveedor tarjeta sin respuesta, webhook duplicado/fuera de orden, insert CMS fallido tras pago confirmado, stock insuficiente, devolución parcial repetida, lock expirado y diferencia de arqueo.

**No GO** por tests estáticos ni CI offline. **GO TPV** requiere P0 completo y Runtime E2E PASS. **GO profesional completo** requiere además P1/P2 y revisión fiscal/proveedor. No publicar ni ejecutar cobros reales hasta que el propietario apruebe expresamente la puesta en producción.

## 10. Referencias oficiales consultadas

### Wix
- Create Order: https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/orders/create-order
- Add Payments: https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/order-transactions/add-payments
- Update Payment Status: https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/order-transactions/update-payment-status
- Search Orders: https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/orders/search-orders
- Find and Report on Orders (filtros y paginación soportados): https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/skills/find-and-report-on-orders
- Refund Payments: https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/order-billing/refund-payments
- Get Order Refundability: https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/order-billing/get-order-refundability
- Inventory decrement: https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/inventory-items-v3/bulk-decrement-inventory-items-by-variant-and-location
- Invoices API: https://dev.wix.com/docs/api-reference/business-management/get-paid/invoices/invoices/introduction
- Wix eCommerce architecture: https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/architecture-data-flow
- Bookings Confirm Or Decline Booking (custom checkout): https://dev.wix.com/docs/api-reference/business-solutions/bookings/bookings/bookings-writer-v2/confirm-or-decline-booking
- Wix PSP Create Transaction (incluye ejemplo POS card reader): https://dev.wix.com/docs/api-reference/business-management/payments/payment-service-provider-service-plugin/transactions/create-transaction

### BOE
- RD 1619/2012 (facturación): https://www.boe.es/eli/es/rd/2012/11/30/1619/con
- RD 1007/2023 (SIF): https://www.boe.es/eli/es/rd/2023/12/05/1007
- Orden HAC/1177/2024: https://www.boe.es/eli/es/o/2024/10/17/hac1177
- RD 238/2026 (factura electrónica B2B): https://www.boe.es/eli/es/rd/2026/03/25/238
- RDL 43/2026 (modifica calendario RD 1007/2023): https://www.boe.es/eli/es/rdl/2026/11/24/43

---

## 11. Estado de partida del código (inspección estática de main)

- `src/backend/tpv/tpvVentas.web.js::createSaleDraftOrder()` devuelve `orderId: null` y `TPV_DRAFT_ORDER_NOT_CONFIGURED`; no crea pedido nativo.
- `registrarVenta()` persiste `TransaccionesTPV` como `PENDING_PAYMENT`; no acredita cobro ni pedido Wix.
- `buildSaleReadiness()` añade `INVENTORY_POLICY_NOT_CONFIGURED` cuando hay productos.
- `tpvPageController.js` rechaza `REFUND` con `TPV_REFUND_DISABLED`.
- `obtenerReservasClienteTPV` no implementa lectura de reservas; devuelve lista vacía.
- `tpvWriteV1Contract.js` bloquea pago dividido.
- `package.json` ya incluye `@wix/ecom`, `@wix/stores`, `@wix/bookings`, `@wix/crm` y `@wix/essentials`; no incluye `@wix/get-paid`.
- La auditoría CMS del 28-11-2026 documenta 34 pedidos, 8 pagos y 1 refund nativos en la lectura histórica, pero no se deben asumir esos recuentos como actuales ni reintentar recuperaciones sin reconciliar.

Estos puntos son hallazgos de código/documentación, no pruebas Runtime.
