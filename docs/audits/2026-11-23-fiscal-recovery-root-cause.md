# Causa raíz de recuperaciones fiscales — 2026-11-23

**Estado:** diagnóstico estático y consultas Wix de solo lectura. No se han cambiado flags, pedidos, transacciones, ledgers ni compensaciones.

## 1. Política de ejecución

El código de main declara en src/backend/internalConfig.js:

- FISCAL_RUNTIME_POLICY.LEDGER_WRITES_ENABLED = false.
- FISCAL_RUNTIME_POLICY.ACCOUNTING_LEDGER_WRITES_ENABLED = false.
- FISCAL_RUNTIME_POLICY.ALLOW_SIMULATION_RECORDS = false.

registrarEventoEconomico() en src/backend/eventLog.js devuelve FISCAL_LEDGER_WRITES_DISABLED antes de construir e insertar un movimiento. La política es fail-closed hasta completar la certificación Runtime. No debe alterarse como solución aislada.

## 2. Configuración canónica ausente

Consulta consistente de MapaStaff: 5 registros (GESTORIA 1, TERCERO 1, STAFF 3). No existe el registro con _id CONFIG_SISTEMA_FISCAL y recordType CONFIG_SISTEMA. El constructor fiscal también exige NIF, razón social, versión SIF e indicadores AEAT explícitos. No crear valores ficticios ni activar el writer hasta disponer de configuración legalmente validada.

## 3. Causalidad de las recuperaciones

- events.js: el webhook de pago llama a registrarEventoEconomico(); si no devuelve SUCCESS/PARTIAL, encola FISCAL_LEDGER en ControlOperativo.
- events.js: processCompletedEcommerceRefund() busca primero el movimiento original con transactionId ORDER-{orderId}. Si falta, encola WAIT_FOR_ORIGINAL_ORDER_LEDGER con ORIGINAL_ORDER_LEDGER_MISSING y devuelve OK al webhook.
- cajas.web.js: queueFiscalRecovery() crea una identidad determinista con hash/dedupeKey, inserta el registro y hace lectura fuerte para distinguir un duplicado. La cola es idempotente.

## 4. Evidencia de los dos pedidos

| Pedido | Operación | Importe | Estado |
|---|---|---:|---|
| #10032 | Pago | 92,45 EUR | APPROVED / PAID, método Cash |
| #10033 | Pago original | 18,15 EUR | REFUNDED |
| #10033 | Refund | -18,15 EUR | Refund registrado; pedido FULLY_REFUNDED |

Las tres compensaciones observadas son +92,45 EUR (#10032), +18,15 EUR (#10033) y -18,15 EUR (#10033). El refund de #10033 falla porque no existe el movimiento original en MovimientosCaja. No hay bookingId en las tres compensaciones.

Las proyecciones CitasF2 asociadas a ambos pedidos son SIMPLE/Barba Perfecta, con estado PENDING_LEDGER, totalAmount=0 y sin cashMovementId. Sus bookings nativos están CANCELED. MovimientosCaja contiene cinco registros, todos synthetic=true, SIMULATED_SUCCESS y RECONCILED, sin orderId/bookingId. LibroAsientosContablesDetalle está vacío.

La evidencia de Wix no permite decidir si los pedidos son datos sintéticos QA o hechos económicos reales. El estado de pago/refund en Wix tampoco prueba movimiento bancario físico.

## 5. Secuencia segura de recuperación

1. Identificar el origen de los pedidos y su checkout, aplicación creadora y trazas; contrastar recibo/caja y, si procede, extracto o adquirente.
2. Confirmar si los pedidos pertenecen a una ejecución QA sintética aislada. Si no puede acreditarse, tratarlos como operaciones económicas reales hasta resolverlo.
3. Validar CONFIG_SISTEMA_FISCAL, identidad del emisor, secretos/firma, proveedor SIF, permisos y requisitos legales aplicables.
4. Certificar los flujos Runtime de escritura y recuperación en un entorno aislado, sin remisión real ni cobros.
5. Aprobar el tratamiento contable/fiscal de cada pedido.
6. Reprocesar primero el movimiento original del pedido #10032 y el pago original de #10033; solo después, el refund de #10033. Cada corrección será un nuevo registro append-only, idempotente y trazable.
7. Verificar cadena/hash, secuencia, proyección, caja y compensaciones; cerrar incidencias solo con evidencia.

## 6. No-go

- No activar LEDGER_WRITES_ENABLED ni ACCOUNTING_LEDGER_WRITES_ENABLED por una modificación aislada.
- No completar PENDING_RECOVERY manualmente ni crear movimientos para que los saldos cuadren.
- No borrar ni actualizar registros históricos append-only.
- No emitir ni remitir documentos fiscales reales.
- No declarar la caja conciliada por el estado PAID/REFUNDED de Wix.

**Resultado:** causa técnica del bloqueo identificada y evidencia económica ordenada. La recuperación sigue pendiente de clasificación del origen de los pedidos, configuración fiscal canónica y certificación Runtime.
