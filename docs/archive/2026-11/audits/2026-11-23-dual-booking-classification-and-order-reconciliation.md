# Clasificación Bookings V2 y conciliación de pedidos — 2026-11-23

**Sitio:** Marian Madrid (188bed94-177c-4bc9-a9f0-35080d874f3e).  
**Método:** consultas oficiales Wix REST de solo lectura; CMS con consistentRead=true; Bookings Reader V2 con cursor pagination.  
**Estado:** evidencia observada, sin mutaciones.

## 1. Clasificación por servicio

| Universo | Registros | Estado |
|---|---:|---|
| Bookings nativos | 354 | 352 CANCELED; 2 CONFIRMED |
| Servicios CMS | 95 | 24 padres duales + 24 F2 enlazados |
| Bookings en servicios duales | 132 | 87 F1 + 45 F2; los 132 CANCELED |
| Bookings en servicios no duales | 222 | Fuera de la reconciliación dual |
| Bookings con multiServiceBookingInfo | 0 | No hay multiservicio nativo en el universo consultado |
| Proyecciones CitasF2 | 6 | 2 fases duales + 4 simples |

Los 48 service IDs del conjunto dual existen en Bookings Services V2. La clasificación usa el catálogo CMS y su relación explícita linkedPhases, no una inferencia por ausencia de proyección.

## 2. Proyecciones actuales

La pareja dual actual consta de una F1 y una F2 con el mismo pairToken y resourceId. F1: 20-11-2026 08:00–08:40 UTC; F2: 09:20–10:10 UTC. El gap observado es 40 minutos y coincide con ServiciosCatalogo.exposureDuration del servicio padre. Ambos bookings nativos están CANCELED, mientras que sus dos proyecciones CitasF2 siguen CONFIRMED.

Las otras cuatro filas CitasF2 son simples: tres del servicio Barba Perfecta en la misma franja y profesional (dos vinculadas a pedidos y una sin pedido), y una del servicio Corte de Pelo Niños. Sus bookings nativos también están cancelados. No deben confundirse con la pareja dual.

## 3. Bookings duales históricos sin proyección

De los 132 bookings en servicios padre/hijo duales, 130 no tienen fila CitasF2 (86 F1 y 44 F2). Una comparación heurística en memoria por mismo cliente (email), mismo resourceId y diferencia temporal exactamente igual a exposureDuration encuentra 34 parejas candidatas; quedan 53 F1 y 11 F2 sin pareja candidata. Esta heurística no prueba causalidad ni vínculo de saga: no hay pairToken nativo y los 132 bookings están cancelados. No insertar ni reconstruir proyecciones con este resultado. Hay que identificar origen, fecha, app creadora y evidencia de la saga antes de actuar.

## 4. Pedidos y compensaciones pendientes

| Pedido | Estado pedido | Importe | Transacción | Servicio |
|---|---|---:|---|---|
| #10032 | APPROVED / PAID | 92,45 EUR | APPROVED · Cash | Dos productos + Barba Perfecta |
| #10033 | APPROVED / FULLY_REFUNDED | 18,15 EUR | REFUNDED; refund registrado | Barba Perfecta |

Ambos bookings nativos vinculados están CANCELED. Las proyecciones CitasF2 están PENDING_LEDGER, totalAmount=0, sin cashMovementId. Para #10033 el pago se registró como “Other Payment Method” y el refund se registró el 16-11-2026. No se infiere que el método indique efectivo ni se supone que el reembolso sea una devolución física de caja.

En ControlOperativo se observaron exactamente tres compensaciones PENDING_RECOVERY relacionadas con estos dos pedidos:
- #10032: +92,45 EUR, escritura fiscal deshabilitada hasta certificar Runtime.
- #10033: +18,15 EUR, escritura fiscal deshabilitada hasta certificar Runtime.
- #10033: -18,15 EUR, error ORIGINAL_ORDER_LEDGER_MISSING.

No se observó bookingId en esas tres compensaciones. MovimientosCaja contiene cinco filas, todas synthetic=true, SIMULATED_SUCCESS, RECONCILED, sin orderId ni bookingId; ninguna se correlaciona con #10032/#10033. LibroAsientosContablesDetalle contiene cero filas.

## 5. Diagnóstico y acciones bloqueadas

1. P0: reconstruir la cadena de evidencia de #10032/#10033 desde pedidos, transacciones, refund, ControlOperativo, caja y ledger. Determinar si son operaciones sintéticas QA o hechos económicos reales; no asumir ninguna de las dos.
2. P0: comprobar por qué las dos proyecciones simples y la pareja dual permanecen CONFIRMED/PENDING_LEDGER tras la cancelación nativa.
3. P1: clasificar los 130 bookings duales históricos por origen y reconstruir parejas solo cuando haya evidencia de saga.
4. P1: validar el gap exacto y la política de ocupación por otros servicios en Wix Runtime.

**Prohibido en esta fase:** actualizar o cancelar bookings, crear o borrar proyecciones, generar asientos, completar compensaciones, emitir facturas, registrar pagos o reembolsos, limpiar datos históricos o activar notificaciones. Las colecciones append-only solo admiten nuevos registros rectificativos después de una reconciliación aprobada.

## 6. Fuentes y límites

- Wix Bookings Reader V2 — Query Extended Bookings.
- Wix Bookings Services V2 — Query Services.
- Wix CMS Data Items — Query Data Items y Get Data Collection.
- Wix eCommerce Orders — Get Order.
- Wix eCommerce Order Transactions — List Transactions For Multiple Orders.

La lectura confirma estados de sistema y registros Wix; no confirma movimiento bancario físico ni la clasificación legal/fiscal de las operaciones. Runtime, origen QA vs real, sincronización Git–Wix y validación fiscal permanecen pendientes.
