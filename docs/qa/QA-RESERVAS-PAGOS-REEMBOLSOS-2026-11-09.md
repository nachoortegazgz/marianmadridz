# QA — reservas, pagos y reembolsos

**Fecha:** 2026-11-09  
**Rama:** fix/booking-payment-refund-dual-reconciliation-20261109  
**Base:** a85f35e4d2357ed400b8dcdacc695feb5c5c4e3c

## Cambios de esta intervención

### B-01 — Estado de pago y reservas
- `registerBookingPayment` ya deduplica por `ORDER-{orderId}` y repite la comprobación bajo el bloqueo fiscal.
- `confirmPayment` ahora admite `PARTIAL` únicamente cuando el resultado incluye el movimiento fiscal persistido; no confunde el fallo de proyección `CajaActual` con ausencia del ledger.
- Una actualización parcial de F1/F2 puede reintentarse: las filas ya pagadas deben pertenecer al mismo pedido y el writer reutiliza el movimiento existente.
- El fallo al actualizar CitasF2 crea la alerta `PAYMENT_STATE_UPDATE_REQUIRED` con orderId, transactionId, cashMovementId y bookingIds.

### B-02 — Reembolsos
- Clave fiscal estable: `REFUND-{orderId}-{refundId}`.
- Reutilización idempotente del movimiento existente; rechazo de múltiples filas con la misma clave y de refundId reutilizado con otro pedido/transacción.
- El historial se lee paginado. Si no puede completarse dentro del límite defensivo, el flujo falla cerrado.
- Se rechaza un reembolso que supere el importe restante del cobro original.
- Base y cuota se prorratean en reembolsos parciales; el último reembolso aplica el residual para cuadrar el total original.
- El restock explícito de Wix se conserva como efecto nativo idempotente por refundId; el límite fiscal se aplica antes de crear la rectificativa en el ledger. Si falta el movimiento original, el flujo conserva el restock y deja la rectificativa en recuperación.

**Control de concurrencia:** el writer fiscal vuelve a comprobar refundId y el acumulado del pedido dentro del bloqueo fiscal global, antes de leer el head/hash y reservar secuencia. Esto serializa reembolsos distintos concurrentes del mismo pedido. La cobertura offline incluye un contrato estático de que la comprobación queda dentro de la sección crítica; la prueba E2E concurrente en Wix QA sigue pendiente.

### B-03 — Pares duales
El cron solo cierra la incidencia si se cumplen simultáneamente:
1. Exactamente dos filas CMS.
2. Una F1 y una F2, con relación F2 -> F1.
3. Mismo orderId y mismo paymentStatus no vacío.
4. Importe de ambas filas coincidente al céntimo.
5. Exactamente un movimiento `ORDER-{orderId}`, importe coincidente y vinculado a una de las reservas.
6. Si hay referencias `cashMovementId`, deben apuntar al movimiento validado.
7. Ambas reservas existen en Wix Bookings.

## Validación

- Pruebas añadidas: contrato B-01/B-02 y reconciliación dual válida / estado de pago divergente.
- CI run #42543224618 (run 79), commit funcional 381fa8f: **success**.
  - Layer 1: 18 suites, 234 pruebas, 0 fallos.
  - Layer 2: 15 suites, 141 pruebas, 0 fallos.
  - Regresión completa: 45 suites, 406 pruebas, 0 fallos.
  - Contratos SDK Wix, Bookings Reader V2 y ESLint: correctos.
- El commit posterior 004cc08 solo actualiza cabeceras/documentación de los tres módulos; no cambia lógica ejecutable.
- No se ejecutó Wix Preview ni Publish. No hubo escrituras en CMS real, reservas reales, pagos ni reembolsos reales.

## Pendiente de QA aislado
- Fallo entre persistencia fiscal y actualización de cada fila F1/F2.
- Reintento de confirmPayment con un miembro del par ya PAID y el otro pendiente.
- Dos confirmaciones simultáneas del mismo orderId.
- Refund duplicado con mismo refundId.
- Refund parcial y segundo refund hasta el total exacto.
- Refund superior al importe original.
- Dos refundId distintos concurrentes para el mismo pedido.
- Par dual con F1/F2 desalineados, sin ledger o con más de un ledger.
