# QA — Guard de canal nativo eCommerce y fiscalidad POS

**Fecha:** 20/11/2026 (Europe/Madrid)  
**Estado:** implementado en código y CI; runtime Wix Sandbox/Preview pendiente.  
**Issue:** #441  
**Implementación:** PR #445  
**Merge commit:** `6e34ba0e501e6b11fbc17921b10c9cf231d6b82a`

## Objetivo
Impedir que pedidos de Wix eCommerce originados en POS u otros canales no web sean clasificados como ventas online con `WIX_PAYMENTS`, así como impedir que reembolsos de esos pedidos alcancen el escritor fiscal online.

## Comportamiento implementado

1. Los handlers `wixEcom_onOrderPaymentStatusUpdated` y `wixEcom_onOrderUpdated` resuelven el canal antes de procesar estados PAID o REFUNDED.
2. Se utiliza `order.channelInfo.type` del evento Wix. Si el evento no incluye canal, se consulta `orders.getOrder(orderId)` y se valida que el ID nativo coincida.
3. La lectura nativa solo enriquece `channelInfo`; conserva el estado de pago y resto del snapshot del evento que puede ser más reciente.
4. Solo `channelInfo.type === WEB` continúa hacia los escritores online.
5. POS, BACKOFFICE_MERCHANT, OTHER_PLATFORM y canal no verificable quedan bloqueados. Se registra una alerta operativa deduplicada con orderId, canal, estado de pago, moneda, número de líneas y evento. El handler no llama al writer fiscal, no actualiza CajaActual y no marca reservas como pagadas/reembolsadas por esta vía.
6. El payload fiscal de venta online conserva `sourceChannelType: WEB`. El cron de recuperación `EVENT_LOG_ORDER` exige ese campo; las compensaciones antiguas sin procedencia verificada no se reproducen automáticamente.

## Pruebas

- Contrato de código: el guard precede al procesamiento de reembolsos y al writer de venta.
- Fixture de tests: `orders.getOrder` devuelve el pedido nativo con `channelInfo.type=WEB` por defecto cuando el evento no lo incluye.
- Regresión runtime offline: POS PAID, POS PARTIALLY_REFUNDED y POS FULLY_REFUNDED por `ORDER_UPDATED` no generan movimientos fiscales y devuelven `MANUAL_REVIEW_REQUIRED`.
- Cron: payload de recuperación sin `sourceChannelType=WEB` es rechazado.
- CI del head `302de68b2713983442f4799b25525d2fb4d4fdb0`: Layer 1, Layer 2, suite offline completa, npm audit, SDK Cart V2, Order Transactions, TPV Catalog, ESLint y Secret scanning SUCCESS.

## Límites y riesgos pendientes

- CI offline no acredita la ejecución del handler en Wix runtime ni la persistencia real de alertas.
- Pendiente prueba en Wix Sandbox/Preview con pedidos sintéticos WEB y POS; no usar cargos reales.
- Los pedidos históricos 10032 y 10033 y sus tres compensaciones `PENDING_RECOVERY` no se han modificado ni reintentado. Requieren conciliación manual de origen.
- No se ha implementado mapper fiscal POS ni se infiere el método de pago desde etiquetas localizadas.
- Los escritores fiscales y contables continúan deshabilitados. No publicar ni activar remisiones AEAT.

## Procedimiento E2E pendiente

1. En Sandbox aislado, preparar un pedido sintético con `channelInfo.type=POS` y pago Cash; comprobar que se genera una alerta y ningún movimiento fiscal/caja.
2. Repetir con POS y método de pago alternativo; comprobar el mismo bloqueo.
3. Repetir POS REFUNDED por ambos handlers; comprobar que no se consulta ni procesa la transacción de reembolso desde el escritor.
4. Probar WEB PAID y WEB REFUNDED con datos sintéticos y writers simulados, verificando que solo WEB entra en el camino online.
5. Omitir `channelInfo` del evento y verificar que `orders.getOrder` se consulta y que una respuesta sin canal termina en revisión manual.
6. Verificar deduplicación de alertas y claims bajo replay/concurrencia.
7. Confirmar que no se modifican las compensaciones históricas ni el singleton LIVE.

**Criterio de cierre:** CI verde + E2E Sandbox con evidencia + revisión de las compensaciones históricas. No equivale a GO de producción; #209, #415, #416 y #434 continúan bloqueando.
