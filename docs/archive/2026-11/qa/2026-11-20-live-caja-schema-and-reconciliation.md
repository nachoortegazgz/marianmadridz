# Reconciliación live de CajaActual, CMS y reservas — 2026-11-20

## 1. Alcance y método

Lectura consistente (consistentRead=true) de Wix Data Items API, Get Order, List Transactions For Multiple Orders y Query Extended Bookings. No se ejecutó ninguna operación de escritura, reintento, refund, cancelación, cierre ni modificación de CMS.

Sitio: Marian Madrid Peluquería y Estética  
Site ID: 188bed94-177c-4bc9-a9f0-35080d874f3e  
Estado Wix observado: **Draft**. No publicado.

## 2. Estado de colecciones

| Colección | Revisión | Campos físicos | Elementos | Última actualización de esquema |
|---|---:|---:|---:|---|
| CajaActual | 18 | 81 | 1 | 2026-11-17 00:14:04Z |
| MovimientosCaja | 109 | 113 | 0 | 2026-11-17 00:13:59Z |
| HistoricoCierresZ | 44 | 66 | 0 | 2026-11-17 00:13:52Z |
| ControlOperativo | 93 | 32 | 58 | 2026-11-19 23:27:27Z |
| CitasF2 | 60 | 29 | 6 | 2026-11-19 23:40:34Z |
| LibroAsientosContablesDetalle | 9 | 103 | 0 | 2026-11-17 00:14:01Z |

Las seis colecciones devuelven permisos CMS ADMIN para read/insert/update/remove.

## 3. Cambio relevante del esquema CajaActual

La colección actual (revisión 18, 81 campos) incluye, entre otros:

- openingCashAmount, openingCardAmount, openingBizumAmount, openingOtherAmount
- bizumAmount
- operationDateHour
- cashAmount, cardAmount, otherAmount, expectedCash, countedCash, difference
- sequenceCounters de tipo OBJECT
- snapshotSource, traceId, cashRegisterStatus

Esto **sustituye la fotografía de 14/11**, que indicaba que openingCashAmount, bizumAmount, operationDateHour y los campos de apertura por medio no existían. El esquema fue actualizado el 17/11; la auditoría de 14/11 queda como histórico, no como contrato vigente.

### Desalineación localizada en código

- src/backend/tpv/tpvQaRepository.js lee openingCashAmount, coherente con el esquema live.
- PR #460 corrigió src/backend/cajas.web.js: el DTO getCashierState ahora devuelve openingCashAmount desde CAJA_KEYS.OPENING_CASH; no expone el alias openingAmount, que no existe en el esquema físico.
- PR #462 eliminó la escritura del campo raíz operationDate (ausente del esquema) y conserva operationDate como valor de presentación derivado de openedAt en Europe/Madrid; no usa operationDateHour porque su semántica no está aprobada. CI PR #462: Layer 1 333/333, Layer 2 266/266, suite offline 688/688; SDK, npm audit, ESLint y secret scanning SUCCESS.
- PR #460 corrigió el comentario obsoleto: la proyección de caja agrega Bizum en otherAmount por contrato, aunque el esquema físico también declara bizumAmount.
- La proyección de caja de cajas.web.js sigue usando otherAmount para el bucket no efectivo y su documentación anterior explica que Bizum se agrega ahí. tpvCaja.web.js devuelve bizumAmount como agregado de la lectura TPV. No se cambia esta semántica sin una decisión funcional explícita.
- La búsqueda estática no encontró consumo frontend del antiguo openingAmount. PR #460 alineó el DTO con el esquema físico y actualizó los fixtures; el HTML de ZONA MARIAN no consume el campo antiguo.

**Corrección de código posterior a la lectura live:** PR #460 integrada en main (1c3afcea4194e524dc2c67ab102581a4876e90f2). getCashierState devuelve openingCashAmount y los fixtures offline usan el nombre físico. CI PR #460: Layer 1 333/333, Layer 2 266/266, suite offline 688/688; contratos SDK, npm audit sin advisories, ESLint y secret scanning SUCCESS. No se ha ejecutado Wix Runtime.

## 4. Estado live del singleton

Existe un único elemento con singletonKey=CAJA_PRINCIPAL:

| Campo | Valor observado |
|---|---|
| cashRegisterStatus | ABIERTA |
| snapshotSource | APERTURA_CAJA |
| openedAt | 2026-11-14T06:00:00Z |
| closedAt | 2026-11-12T23:00:00Z |
| lastMovementAt | 2026-11-12T23:00:00Z |
| openingCashAmount | 300 EUR |
| cashAmount | 300 EUR |
| expectedCash | 300 EUR |
| countedCash | 300 EUR |
| difference | 0 EUR |
| traceId | vacío |
| sequenceCounters | cadena JSON {}, no objeto |

**Hallazgos:**

1. closedAt y lastMovementAt son anteriores a openedAt; la anomalía persiste.
2. No hay movimientos de caja ni cierres Z con los que reconstruir una sesión.
3. sequenceCounters está almacenado como texto, aunque el esquema físico declara OBJECT. El productor _updateCajaActual normaliza el valor al construir la proyección; el dato CMS sigue sin corregirse.
4. snapshotSource=APERTURA_CAJA y traceId vacío no cumplen los marcadores exigidos por el repositorio TPV QA (TPV_QA_SANDBOX_INITIALIZED / TPV_QA_SYNTHETIC). No usar este singleton como sandbox TPV ni ejecutar E2E de escritura contra él.
5. No se modifica ni se cierra la caja.

## 5. Compensaciones y pedidos Wix

ControlOperativo mantiene 3 registros FISCAL_LEDGER/PENDING_RECOVERY, todos con attempts=0:

| Registro | Pedido | Tipo | Estado / motivo |
|---|---|---|---|
| REC_ecd49c06ba3dd0710e9c3a38f001d9558f7731d9917c75bec7d56da3531bf3b8 | #10033 | Reembolso | WAIT_FOR_ORIGINAL_ORDER_LEDGER / ORIGINAL_ORDER_LEDGER_MISSING |
| REC_4b4d0beb300879e785fe2b7e30746ce3c2d45dcc278dfd9cf41b3d145bf6db7 | #10033 | Venta | EVENT_LOG_ORDER / BOOKINGS_ONLY |
| REC_bb1dbba094b17958fb2e762fe999755ae3a4e8b9d06c350dc4c66259e428d09a | #10032 | Venta | MANUAL / UNSUPPORTED_ORDER_COMPOSITION |

### Pedido Wix #10033 — 18,15 EUR

- Canal nativo POS; estado APPROVED; pago FULLY_REFUNDED.
- La transacción de pago está REFUNDED; método Wix Other Payment Method.
- Booking nativo b18337da-2326-46fc-89c0-1843b6be0730: CONFIRMED/PAID, selectedPaymentOption=ONLINE.
- La fila de CitasF2 asociada continúa CONFIRMED/PENDING_LEDGER, totalAmount=0.

Existe divergencia entre pedido totalmente reembolsado y booking todavía confirmado/pagado. No se presupone que el booking deba cancelarse; requiere decisión operativa.

### Pedido Wix #10032 — 92,45 EUR

- Canal nativo POS; estado APPROVED; pago PAID.
- Transacción APPROVED, método Wix Cash.
- Pedido mixto: dos líneas Stores y una línea Bookings.
- Booking nativo f137c63a-f704-461e-91bc-3295e853c67d: CONFIRMED/PAID, selectedPaymentOption=ONLINE.
- La fila de CitasF2 asociada continúa CONFIRMED/PENDING_LEDGER, totalAmount=0.

La composición mixta exige tratamiento manual; no debe pasar por un mapper fiscal de venta online ni generar movimientos para cuadrar caja.

### Importe de reserva en las líneas nativas del pedido

En ambos pedidos se localizó una línea Wix Bookings cuyo appId corresponde a Bookings y cuyo catalogItemId coincide con el bookingId nativo:

- Pedido #10033 / booking b18337da-2326-46fc-89c0-1843b6be0730: precio 15,00 EUR + IVA 3,15 EUR = total de línea 18,15 EUR.
- Pedido #10032 / booking f137c63a-f704-461e-91bc-3295e853c67d: precio 15,00 EUR + IVA 3,15 EUR = total de línea 18,15 EUR. Las otras dos líneas del pedido son productos Stores y permanecen separadas.

Las dos filas CitasF2 mantienen amountSource=NOT_EXPOSED_BY_BOOKINGS, amountReconciliationRequired=true, nativePhasePairUnknown=true y selectedPaymentOption=UNDEFINED; los bookings nativos consultados ahora devuelven CONFIRMED/PAID y selectedPaymentOption=ONLINE. La línea de pedido es una fuente nativa candidata para reconciliar el importe bruto por booking, correlacionada por appId + catalogItemId; no se actualiza CitasF2 ni se genera ledger hasta aprobar precedencia, tratamiento de impuestos y relación de pago POS.

## 6. Relación con la corrección del webhook POS

PR #445 está integrada en main (merge 6e34ba0e501e6b11fbc17921b10c9cf231d6b82a). El código actual resuelve el canal nativo antes de procesar PAID/REFUNDED y solo permite writers online para channelInfo.type=WEB; el cron exige sourceChannelType=WEB.

Esta corrección protege nuevos eventos. **No repara ni reintenta las tres compensaciones históricas**, que siguen bajo issue #416. La issue #441 queda abierta para E2E en Wix Sandbox y verificación de alerta/revisión.

## 7. Alertado de reservas pagadas y ejecución cron

- Query ControlOperativo por controlType=ALERT devuelve 0 registros.
- WEBHOOK_EVENT devuelve 13 registros COMPLETED, incluidos los dos BOOKING_CONFIRMED vinculados a estas reservas.
- COMPENSATION devuelve 3 registros PENDING_RECOVERY.
- src/backend/jobs.config declara reconcileMissingConfirmedBookingProjections con cronExpression 15,45 * * * *; src/backend/crons.js lo exporta.
- El código excluye bookings nativos PAID/PARTIALLY_PAID/REFUNDED de la proyección automática y solicita BOOKING_PAID_PROJECTION_REVIEW_REQUIRED mediante notifyOperationalAlert.
- No se ha obtenido evidencia de ejecución runtime del cron. El sitio está Draft y no hay alertas persistidas; esto no demuestra un fallo del código ni que el job se haya ejecutado.

**Decisión:** no ejecutar el cron manualmente en el sitio actual ni crear alertas/ledgers a mano. Primero acreditar la versión instalada y el entorno; después probar el job en Sandbox aislado con bookings sintéticos, comprobar la alerta deduplicada y mantener writers fiscales bloqueados.

## 8. Decisión y trabajo pendiente

1. Mantener las tres compensaciones sin cambios; no reintentar, marcar como completadas ni borrar.
2. Resolver manualmente la divergencia pedido #10033 reembolsado / booking CONFIRMED-PAID.
3. Definir tratamiento del pedido #10032 POS Cash mixto Stores+Bookings.
4. Mantener CajaActual sin cierre ni ajuste; no crear movimientos ni asientos para cuadrar.
5. Mantener alineado el diccionario con el esquema live; PR #460/462 corrigieron openingCashAmount y el daykey de sesión. La semántica de operationDateHour sigue pendiente y no se utiliza.
6. Preparar un singleton TPV QA independiente con marcadores exactos, después de verificar el proceso de reset/seed y el aislamiento.
7. Ejecutar E2E de hooks, pagos y caja solo en Sandbox inequívocamente aislado.
8. Mantener writers fiscales/contables deshabilitados y NO-GO producción.

## 9. Límites de validación

Verificado mediante lectura Wix: esquema, permisos, recuentos, estado del singleton, compensaciones, pedidos, transacciones y bookings nativos.

No ejecutado: escritura CMS, modificación de bookings/pedidos, reintentos, runtime de WebMethods, pruebas de concurrencia, E2E Sandbox ni publicación. La declaración del propietario de que los datos son sintéticos se conserva como contexto de QA, pero no sustituye los marcadores técnicos de aislamiento.
