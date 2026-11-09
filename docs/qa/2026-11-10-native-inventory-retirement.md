# QA — Retirada de inventario personalizado y delegación en Wix nativo

**Fecha:** 2026-11-10  
**PR:** [#239](https://github.com/nachoortegazgz/marianmadridz/pull/239)  
**Rama:** `refactor/native-wix-inventory-only-2026-11-10-v2`  
**Baseline:** `main` en `0f1baa8d542fb90041ba3ec20f148eebe3479369`  
**Estado:** CI offline verde en commit `ca6bbdfa5d0e7d43ca863558a67f9185065cedb4`; runtime Wix y E2E pendientes.

## 1. Objetivo y alcance

Retirar la implementación personalizada de stock, sus WebMethods, validaciones específicas, UI de staff y sincronización CMS. Wix Stores Catalog V3 y sus funciones nativas son la única autoridad de stock comercial.

No se cambian las colecciones ni los datos existentes. Los hooks de protección append-only de `MovimientosInventario` se conservan.

## 2. Evidencia previa

- Wix Orders Settings consultado en solo lectura (HTTP 200): `inventoryUpdateTrigger=ON_ORDER_PAID`; `createInvoice=false`.
- Wix Stores Catalog V3 activo; 30/30 inventory items auditados con tracking de cantidad en una ubicación.
- El módulo custom previo mantenía reservas y proyecciones CMS y podía invocar ajustes nativos de stock manuales; sus webhooks de pedidos/pagos/cancelación/reembolso estaban acoplados a esa capa.
- La UI staff exponía consumo interno, recepciones y conciliación manual.

## 3. Cambios ejecutados en la rama

| Archivo / área | Cambio |
|---|---|
| `src/backend/inventario.web.js` | Eliminado (1.695 líneas). |
| `src/backend/events.js` | Quitadas reserva, proyección de venta, liberación y proyección de restock custom. Se conserva marcador idempotente, ledger fiscal, estado CitasF2 y rectificación de reembolso. |
| `src/backend/crons.js` | Reconciliador marca pedidos con referencias de catálogo completas (Bookings, Stores y mixtos); no crea stock ni movimientos. Referencias incompletas generan alerta de integridad de pedido. |
| `src/pages/ZONA MARIAN.gn7mx.js` | Eliminadas imports y acciones custom de inventario. |
| `#htmlOnlyStaff.txt` | Eliminados panel, handlers y mensajes de inventario. |
| `src/backend/internalConfig.js` | Eliminado `INVENTORY_CONFIG`. Se mantienen identificadores de colecciones históricas. |
| `src/backend/validation.js` | Eliminado `validateInventoryOrderLine`, ya sin consumidor. |
| Tests | Eliminado el test del writer retirado; añadidos contratos de no-escritura custom, replay de pedido y reconciliación de pedidos mixtos. |

## 4. Integridad fiscal y datos

- `wixEcom_onOrderPaymentStatusUpdated` mantiene el registro económico, recuperación fiscal, proyección de caja y actualización de pagos Bookings.
- `wixEcom_onOrderRefunded` mantiene el ledger de reembolso y su idempotencia; Wix aplica el side effect nativo de restock cuando corresponde.
- `wixEcom_onOrderCanceled` mantiene la cancelación de reservas Bookings; no libera stock desde CMS.
- No se insertan nuevos registros en `MovimientosInventario`; sus hooks `beforeUpdate` y `beforeRemove` siguen protegiendo el histórico.
- No se ha modificado Wix CMS, stock, servicios, reservas, pagos ni Orders Settings.

## 5. CI offline

**GitHub Actions run:** [42721080098](https://github.com/nachoortegazgz/marianmadridz/actions/runs/42721080098)

- Job: Layer 1 and 2 QA, offline regression, SDK contract and lint.
- 50 suites, 488 tests, 0 fallos.
- Contrato Wix eCommerce Cart V2: SUCCESS.
- Contrato Wix Bookings Reader V2: SUCCESS.
- ESLint: SUCCESS.
- La suite específica de inventario custom se retiró junto con el módulo; nuevas pruebas cubren el contrato de ausencia de escrituras custom.

El commit de CI verde fue `ca6bbdfa5d0e7d43ca863558a67f9185065cedb4`. Tras esa ejecución se ajustó la etiqueta de autoridad de catálogo en el marcador y su expectativa de test; la reejecución de CI sobre el HEAD actual debe confirmarse antes del merge.

## 6. Pruebas pendientes

1. Wix Local Editor/Preview: compra de producto con tracking activo; confirmar decremento nativo al pago.
2. Cancelación de pedido: comprobar la política nativa `restockAllItems` configurada por Wix.
3. Reembolso parcial/total: comprobar que el side effect nativo de restock se aplica solo cuando se solicita.
4. Confirmar que los webhooks no generan escrituras CMS de inventario.
5. Confirmar que venta y refund siguen creando movimientos económicos/fiscales correctos.
6. Verificar no regresión en pedidos Bookings, Stores y mixtos.

## 7. Reversión y despliegue

- PR no fusionado; no se han publicado cambios.
- Reversión técnica: cerrar el PR o revertir el merge commit antes de publicar. No requiere revertir datos porque no se han hecho mutaciones.
- No desplegar si CI del HEAD actual no está verde o si falla el E2E nativo de venta/cancelación/refund.
- La restauración de código custom no debe reactivar escrituras históricas ni modificar cantidades; cualquier reversión futura requiere nueva revisión de arquitectura.

## 8. Restricciones vigentes

No activar automatizaciones que contacten clientes. No realizar cargos reales, reservas reales, cambios de stock, escrituras CMS de producción ni publicación durante esta fase.
