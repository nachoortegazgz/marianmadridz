# Registro temporal de bloqueos — mantenimiento

Fecha: 2026-11-28
Rama base: main
Commit base: 796e8eaf8317d35d02744f40d0504e9a00d29c20
Rama: maintenance/temporary-unblock-register-2026-11-28

## Estado de ejecución

Esta rama registra la intervención de mantenimiento. No se han cambiado flags ni se ha desplegado código. El sitio y la pasarela no se modifican desde esta rama.

## Controles identificados y decisión

| Control | Valor observado en HEAD | Decisión durante mantenimiento | Motivo / condición para habilitar |
|---|---:|---|---|
| STAFF_CLOCKING_CONFIG.WRITES_ENABLED | false | CONSERVAR | El writer no acredita idempotencia por evento ni serialización por empleado/día; habilitar puede duplicar o desordenar fichajes. |
| STAFF_CLOCKING_CONFIG.ADJUSTMENTS_ENABLED | false | CONSERVAR | Requiere validar rectificación append-only, autorización y concurrencia. |
| TPV acceptPayment | false | CONSERVAR | No activar cobros ni afirmar recepción de pago sin confirmación de proveedor. |
| TPV printReceipt | false | CONSERVAR | Requiere contrato y prueba del hardware físico. |
| TPV requestRefund | false | CONSERVAR | No activar reembolsos sin flujo nativo, autorización y conciliación verificados. |
| TPV issueTicketZ | false | CONSERVAR | Cierre Z tiene efectos contables/fiscales y requiere contrato/runtime probado. |
| TPV exportAudit | false | CONSERVAR | Requiere contrato de exportación, entrega y read-back. |
| CUSTOMER_NOTIFICATIONS_ENABLED | false | CONSERVAR | Evita comunicaciones externas durante mantenimiento. |
| HARDWARE_ENABLED | false | CONSERVAR | Evita accionamiento físico de cajón/impresora. |
| ACCOUNTANT_SEND_ENABLED | false | CONSERVAR | Evita envío externo a gestoría. |
| TPV inventory readiness | INVENTORY_POLICY_NOT_CONFIGURED | REVISAR | No eliminar hasta verificar reserva/consumo/devolución de stock; no es un simple bloqueo de mantenimiento. |
| TPV sale readiness | PAYMENT_NOT_VERIFIED / CONSUMER_PRICE_PRESENTATION_UNVERIFIED | CONSERVAR | No registrar una venta como lista sin prueba de pago ni presentación de precio verificada. |
| Idempotencia, transactionId, locks, validación y append-only | activos | CONSERVAR | Salvaguardas de integridad; no son bloqueos operativos prescindibles. |

## Alcance CMS

No se ha identificado un interruptor global de escritura CMS que deba desconectarse. Los writers usan políticas por colección, hooks físicos y validación de contratos. No introducir bypass genérico ni suprimir hooks.

La auditoría de persistencia del mismo día documenta contratos y brechas concretas. Antes de habilitar una colección, comprobar sus campos required físicos, hooks, permisos backend, idempotencia y consumidor; después ejecutar prueba de inserción y lectura de vuelta en el sitio aislado.

## Restauración

No hay cambios de flags que restaurar porque ninguno se ha modificado. Si una intervención posterior cambia alguno, registrar aquí valor anterior, valor temporal, commit y prueba de restauración.

## Evidencia y límites

- Verificado estáticamente en GitHub HEAD: valores de configuración y guards referenciados arriba.
- No verificado: estado efectivo de pasarela, aislamiento real del sitio, código instalado en Wix Editor y comportamiento Runtime.
- No ejecutado: escrituras CMS, fichajes, ventas, pagos, reembolsos, hardware, comunicaciones ni cierres.
- Esta rama no se ha desplegado ni fusionado.
